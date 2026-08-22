import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Storybook introduction imports doc blocks from addon-docs', async () => {
  const source = await readFile(new URL('../src/shared/ui/stories/Introduction.mdx', import.meta.url), 'utf8');
  assert.match(source, /from ['"]@storybook\/addon-docs\/blocks['"]/);
  assert.doesNotMatch(source, /from ['"]@storybook\/blocks['"]/);
});
