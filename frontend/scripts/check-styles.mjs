import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const styleRoot = path.join(root, 'src');
const files = [];
const definitions = new Set();
const usages = [];
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.css')) files.push(fullPath);
  }
}

walk(styleRoot);

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const character of withoutComments) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) failures.push(`${path.relative(root, file)}: unbalanced CSS braces (${depth})`);

  for (const match of source.matchAll(/(--[\w-]+)\s*:/g)) definitions.add(match[1]);
  for (const match of source.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    usages.push({ file, name: match[1], hasFallback: Boolean(match[2]) });
  }
}

for (const usage of usages) {
  if (!definitions.has(usage.name) && !usage.hasFallback) {
    failures.push(`${path.relative(root, usage.file)}: ${usage.name} is used without a definition or fallback`);
  }
}

if (failures.length) {
  console.error('Style contract check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Style contract check passed for ${files.length} CSS files and ${definitions.size} custom properties.`);
