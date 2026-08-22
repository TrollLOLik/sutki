import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const scanRoots = [path.join(root, 'src'), path.join(root, '.storybook')].filter(fs.existsSync);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
}

scanRoots.forEach(walk);
const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  for (const diagnostic of sourceFile.parseDiagnostics) {
    const position = diagnostic.start != null
      ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
      : null;
    const location = position ? `:${position.line + 1}:${position.character + 1}` : '';
    failures.push(`${path.relative(root, file)}${location} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

if (failures.length) {
  console.error('TypeScript syntax check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`TypeScript syntax check passed for ${files.length} files.`);
