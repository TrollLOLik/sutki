#!/usr/bin/env node
/**
 * One-shot codemod for the dark theme migration:
 *  - rewrites `import { palette, ... } from '@/theme/tokens'` to keep the
 *    non-palette names and adds `import { useAppTheme } from '@/theme/useAppTheme'`
 *  - inserts `const { palette } = useAppTheme();` at the top of every
 *    top-level React component (or use* hook) whose body references `palette.`
 *  - refuses to touch module-level / helper-function usages and reports them
 *    as MANUAL so they can be refactored by hand (rules of hooks).
 *
 * Deleted once the migration is complete.
 */
const fs = require('fs');

const files = process.argv.slice(2);
let manualCount = 0;

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('palette')) continue;
  if (src.includes('useAppTheme()')) {
    console.log(`SKIP (already migrated): ${file}`);
    continue;
  }

  // --- 1. Import rewrite -------------------------------------------------
  const importRe = /import\s*\{([^}]*)\}\s*from\s*'@\/theme\/tokens';?/;
  const m = src.match(importRe);
  if (m) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const rest = names.filter((n) => n !== 'palette');
    let repl = '';
    if (rest.length) repl = `import { ${rest.join(', ')} } from '@/theme/tokens';\n`;
    repl += `import { useAppTheme } from '@/theme/useAppTheme';`;
    src = src.replace(importRe, repl);
  }

  // --- 2. Hook insertion per top-level component -------------------------
  const lines = src.split('\n');

  // Top-level declaration boundaries (column 0).
  const boundaries = [];
  lines.forEach((l, i) => {
    if (/^(export\s+)?(default\s+)?(async\s+)?(function|const|let|var|class|type|interface|enum)\b/.test(l)) {
      boundaries.push(i);
    }
  });
  boundaries.push(lines.length);

  const insertions = []; // { afterLine, indent }
  const manual = [];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const start = boundaries[b];
    const end = boundaries[b + 1];
    const segment = lines.slice(start, end).join('\n');
    if (!/\bpalette\./.test(segment)) continue;

    const decl = lines[start];
    // Components: function Upper / const Upper = ...; hooks: function useX / const useX =
    const isComponent =
      /^(export\s+)?(default\s+)?(async\s+)?function\s+[A-Z]/.test(decl) ||
      /^(export\s+)?const\s+[A-Z]\w*\s*[:=]/.test(decl) ||
      /^(export\s+)?(default\s+)?function\s+use[A-Z]/.test(decl) ||
      /^(export\s+)?const\s+use[A-Z]\w*\s*[:=]/.test(decl);

    if (!isComponent) {
      manual.push({ file, line: start + 1, decl: decl.slice(0, 80) });
      continue;
    }

    // Find the body-opening line: first line in the segment ending with `) {`
    // or `=> {`.
    let opened = -1;
    for (let i = start; i < end; i++) {
      if (/(\)|=>)\s*\{\s*$/.test(lines[i])) {
        opened = i;
        break;
      }
    }
    if (opened === -1) {
      manual.push({ file, line: start + 1, decl: `${decl.slice(0, 60)} (no body brace found)` });
      continue;
    }
    insertions.push({ afterLine: opened });
  }

  // Apply insertions bottom-up so indices stay valid.
  insertions.sort((a, b) => b.afterLine - a.afterLine);
  for (const ins of insertions) {
    lines.splice(ins.afterLine + 1, 0, '  const { palette } = useAppTheme();');
  }

  fs.writeFileSync(file, lines.join('\n'));
  const status = insertions.length > 0 || m ? 'MIGRATED' : 'UNCHANGED';
  console.log(`${status}: ${file} (+${insertions.length} hooks)`);
  for (const mm of manual) {
    manualCount++;
    console.log(`  MANUAL: ${mm.file}:${mm.line} ${mm.decl}`);
  }
}

console.log(`\nManual follow-ups: ${manualCount}`);
