import fs from 'node:fs';
import path from 'node:path';

const [, , slug, ...titleParts] = process.argv;
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run generate:page -- <kebab-case-name> [Page title]');
  process.exit(1);
}

const pascal = slug.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
const title = titleParts.join(' ') || pascal;
const directory = path.join(process.cwd(), 'src', 'screens', slug);
if (fs.existsSync(directory)) {
  console.error(`Page already exists: src/screens/${slug}`);
  process.exit(1);
}

const uiDirectory = path.join(directory, 'ui');
fs.mkdirSync(uiDirectory, { recursive: true });
fs.writeFileSync(path.join(directory, 'index.ts'), `export { ${pascal}Page } from './ui/${pascal}Page';\n`);
fs.writeFileSync(path.join(uiDirectory, `${pascal}Page.tsx`), `import { Container, Stack, Typography } from '@ui';\nimport '../${slug}.css';\n\nexport interface ${pascal}PageProps {\n  title?: string;\n}\n\nexport function ${pascal}Page({ title = '${title}' }: ${pascal}PageProps) {\n  return (\n    <main className=\"${slug}-page\">\n      <Container>\n        <Stack gap={16}>\n          <Typography as=\"h1\" variant=\"title1\">{title}</Typography>\n          <Typography tone=\"secondary\">Новая страница собрана из Sutki UI Kit.</Typography>\n        </Stack>\n      </Container>\n    </main>\n  );\n}\n`);
fs.writeFileSync(path.join(directory, `${slug}.css`), `.${slug}-page {\n  min-height: 100vh;\n  padding-block: var(--ui-space-8);\n  background: var(--screen);\n}\n`);
fs.writeFileSync(path.join(directory, `${pascal}Page.stories.tsx`), `import type { Meta, StoryObj } from '@storybook/react-vite';\nimport { ${pascal}Page } from '.';\n\nconst meta = {\n  title: 'Pages/${title}',\n  component: ${pascal}Page,\n  parameters: { layout: 'fullscreen' },\n  tags: ['autodocs'],\n} satisfies Meta<typeof ${pascal}Page>;\n\nexport default meta;\ntype Story = StoryObj<typeof meta>;\nexport const Default: Story = {};\n`);

console.log(`Created src/screens/${slug}`);
console.log('Next: add the route contract in src/app/router/appRoute.ts and compose the page in src/app/App.tsx.');
