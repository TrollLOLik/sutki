import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const uiRoot = path.join(root, 'src', 'shared', 'ui');
const indexSource = fs.readFileSync(path.join(uiRoot, 'index.ts'), 'utf8');
const storyRoot = path.join(uiRoot, 'stories');
const storySources = fs.readdirSync(storyRoot)
  .filter((name) => /\.(stories\.tsx|mdx)$/.test(name))
  .map((name) => fs.readFileSync(path.join(storyRoot, name), 'utf8'))
  .join('\n');
const failures = [];

const componentFiles = fs.readdirSync(uiRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
  .map((entry) => entry.name)
  .sort();

for (const fileName of componentFiles) {
  const moduleName = fileName.replace(/\.tsx$/, '');
  const source = fs.readFileSync(path.join(uiRoot, fileName), 'utf8');
  const exportedComponent = source.match(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/u)?.[1];

  if (!exportedComponent) {
    failures.push(`${fileName}: no exported React component was found`);
    continue;
  }

  if (!indexSource.includes(`export * from './${moduleName}';`)) {
    failures.push(`${fileName}: missing public export in src/shared/ui/index.ts`);
  }

  if (!new RegExp(`\\b${exportedComponent}\\b`, 'u').test(storySources)) {
    failures.push(`${fileName}: ${exportedComponent} is not rendered or documented in shared UI stories`);
  }
}

if (failures.length) {
  console.error('UI Kit contract check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`UI Kit contract check passed for ${componentFiles.length} components.`);
