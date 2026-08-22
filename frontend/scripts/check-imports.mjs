import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const scanRoots = [src, path.join(root, '.storybook')].filter(fs.existsSync);
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'];
const aliases = {
  '@app': path.join(src, 'app'),
  '@pages': path.join(src, 'screens'),
  '@features': path.join(src, 'features'),
  '@entities': path.join(src, 'entities'),
  '@widgets': path.join(src, 'widgets'),
  '@shared': path.join(src, 'shared'),
  '@ui': path.join(src, 'shared', 'ui'),
  '@': src,
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function candidates(base) {
  return [
    base,
    ...extensions.map((ext) => `${base}${ext}`),
    ...extensions.map((ext) => path.join(base, `index${ext}`)),
  ];
}

function resolveInternal(fromFile, specifier) {
  if (specifier.startsWith('.')) return candidates(path.resolve(path.dirname(fromFile), specifier)).find(fs.existsSync);
  for (const [alias, directory] of Object.entries(aliases).sort((a, b) => b[0].length - a[0].length)) {
    if (specifier === alias) return candidates(directory).find(fs.existsSync);
    if (specifier.startsWith(`${alias}/`)) {
      return candidates(path.join(directory, specifier.slice(alias.length + 1))).find(fs.existsSync);
    }
  }
  return true;
}

const pattern = /(?:from\s+|import\s*\()(['"])([^'"]+)\1/g;
const failures = [];
for (const file of scanRoots.flatMap(walk)) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = pattern.exec(source))) {
    const specifier = match[2];
    if (!specifier.startsWith('.') && !specifier.startsWith('@')) continue;
    if (!resolveInternal(file, specifier)) failures.push(`${path.relative(root, file)} -> ${specifier}`);
  }
}

if (failures.length) {
  console.error('Unresolved internal imports:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Internal import check passed.');
