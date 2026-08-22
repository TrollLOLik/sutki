import fs from 'node:fs';
import path from 'node:path';

const [, , name] = process.argv;
if (!name || !/^[A-Z][A-Za-z0-9]+$/.test(name)) {
  console.error('Usage: npm run generate:ui -- <PascalCaseName>');
  process.exit(1);
}

const kebab = name.replace(/[A-Z]/g, (letter, index) => `${index ? '-' : ''}${letter.toLowerCase()}`);
const uiRoot = path.join(process.cwd(), 'src', 'shared', 'ui');
const componentPath = path.join(uiRoot, `${name}.tsx`);
if (fs.existsSync(componentPath)) {
  console.error(`UI component already exists: ${name}`);
  process.exit(1);
}

fs.writeFileSync(componentPath, `import type { HTMLAttributes } from 'react';\nimport { cx } from '@shared/lib/cx';\nimport './${name}.css';\n\nexport interface ${name}Props extends HTMLAttributes<HTMLDivElement> {}\n\nexport function ${name}({ className, ...props }: ${name}Props) {\n  return <div {...props} className={cx('ui-${kebab}', className)} />;\n}\n`);
fs.writeFileSync(path.join(uiRoot, `${name}.css`), `.ui-${kebab} {\n  color: var(--ui-ink);\n}\n`);

const indexPath = path.join(uiRoot, 'index.ts');
fs.appendFileSync(indexPath, `export * from './${name}';\n`);

const storyPath = path.join(uiRoot, 'stories', `${name}.stories.tsx`);
fs.writeFileSync(storyPath, `import type { Meta, StoryObj } from '@storybook/react-vite';\nimport { ${name} } from '..';\n\nconst meta = {\n  title: 'UI Kit/${name}',\n  component: ${name},\n  tags: ['autodocs'],\n  args: { children: '${name}' },\n} satisfies Meta<typeof ${name}>;\n\nexport default meta;\ntype Story = StoryObj<typeof meta>;\nexport const Default: Story = {};\n`);
console.log(`Created ${name}, styles, public export and Storybook story.`);
