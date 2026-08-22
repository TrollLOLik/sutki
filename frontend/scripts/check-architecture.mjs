import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const violations = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function layerOf(filePath) {
  const relative = path.relative(srcRoot, filePath).replaceAll('\\', '/');
  const physicalLayer = relative.split('/')[0] ?? '';
  return physicalLayer === 'screens' ? 'pages' : physicalLayer;
}

function importsOf(source) {
  const results = [];
  const pattern = /(?:from\s+|import\s*\()(['"])([^'"]+)\1/g;
  let match;
  while ((match = pattern.exec(source))) results.push(match[2]);
  return results;
}

const forbiddenByLayer = {
  shared: ['@entities', '@features', '@widgets', '@pages', '@app'],
  entities: ['@features', '@widgets', '@pages', '@app'],
  features: ['@widgets', '@pages', '@app'],
  widgets: ['@pages', '@app'],
  pages: ['@app'],
};

for (const file of walk(srcRoot)) {
  const layer = layerOf(file);
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');

  for (const specifier of importsOf(source)) {
    for (const prefix of forbiddenByLayer[layer] ?? []) {
      if (specifier === prefix || specifier.startsWith(`${prefix}/`)) {
        violations.push(`${relative}: ${layer} must not import ${specifier}`);
      }
    }

    if (layer === 'pages' && specifier.startsWith('@pages/')) {
      violations.push(`${relative}: pages must not import another page (${specifier})`);
    }

    if (specifier.startsWith('@features/')) {
      const parts = specifier.split('/');
      if (parts.length > 2 && !specifier.endsWith('/testing')) {
        violations.push(`${relative}: import feature through its public API (${specifier})`);
      }
    }

    if (specifier.startsWith('@entities/')) {
      const parts = specifier.split('/');
      if (parts.length > 2) violations.push(`${relative}: import entity through its public API (${specifier})`);
    }

    if (specifier.startsWith('@widgets/')) {
      const parts = specifier.split('/');
      if (parts.length > 2) violations.push(`${relative}: import widget through its public API (${specifier})`);
    }

    if (specifier.startsWith('@ui/')) {
      violations.push(`${relative}: import UI Kit through @ui, not ${specifier}`);
    }
  }
}


function requirePublicApi(directory, label) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleDirectory = path.join(directory, entry.name);
    if (!fs.existsSync(path.join(moduleDirectory, 'index.ts'))) {
      violations.push(`${label}/${entry.name} must expose index.ts`);
    }
  }
}

requirePublicApi(path.join(srcRoot, 'screens'), 'src/screens');
requirePublicApi(path.join(srcRoot, 'widgets'), 'src/widgets');
requirePublicApi(path.join(srcRoot, 'features'), 'src/features');
requirePublicApi(path.join(srcRoot, 'entities'), 'src/entities');

const pagesRoot = path.join(srcRoot, 'screens');
if (fs.existsSync(pagesRoot)) {
  for (const entry of fs.readdirSync(pagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pageDirectory = path.join(pagesRoot, entry.name);
    if (!fs.existsSync(path.join(pageDirectory, 'ui'))) {
      violations.push(`src/screens/${entry.name} must keep route UI in ui/`);
    }
    const hasStory = fs.readdirSync(pageDirectory).some((name) => name.endsWith('.stories.tsx'));
    if (!hasStory) violations.push(`src/screens/${entry.name} must include a Storybook page story`);
  }
}

const legacyComponents = path.join(srcRoot, 'components');
if (fs.existsSync(legacyComponents)) violations.push('src/components is forbidden; use pages, widgets, features, entities, or shared/ui');

if (violations.length) {
  console.error('Architecture check failed:\n');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('Architecture check passed.');
