import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const sharedUiRoot = path.join(sourceRoot, 'shared', 'ui') + path.sep;
const forbidden = /<(button|a|input|textarea|select|h[1-6]|p|strong|small|label)(?:\s|>)/gu;
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

for (const file of walk(sourceRoot)) {
  if (!file.endsWith('.tsx') || file.startsWith(sharedUiRoot) || file.endsWith('.stories.tsx')) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(forbidden)) {
    const line = source.slice(0, match.index).split('\n').length;
    failures.push(`${path.relative(root, file)}:${line}: raw <${match[1]}> must be replaced by a shared UI component`);
  }
}

if (failures.length) {
  console.error('Shared component usage check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Shared component usage check passed: product TSX contains no raw controls or typography tags.');
