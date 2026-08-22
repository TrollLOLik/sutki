import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('request session repository exposes a cached external-store snapshot', async () => {
  const source = await readFile(new URL('../src/features/requests/api/mockRequestRepository.ts', import.meta.url), 'utf8');

  assert.match(source, /let snapshot:\s*RequestsSnapshot\s*=\s*\{ requests \}/);
  assert.match(source, /getSnapshot\(\):\s*RequestsSnapshot\s*\{\s*return snapshot;\s*\}/s);
  assert.doesNotMatch(source, /getSnapshot\(\):\s*RequestsSnapshot\s*\{\s*return\s*\{\s*requests\s*\};\s*\}/s);
});
