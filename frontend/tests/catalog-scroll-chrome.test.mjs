import assert from 'node:assert/strict';
import test from 'node:test';

import { getCatalogScrollMovement } from '../src/screens/home/model/catalogScrollChrome.ts';

test('detects real document scroll in both directions', () => {
  assert.deepEqual(
    getCatalogScrollMovement({ top: 100, remaining: 900 }, { top: 128, remaining: 872 }),
    { direction: 'down', distance: 28 },
  );
  assert.deepEqual(
    getCatalogScrollMovement({ top: 128, remaining: 872 }, { top: 116, remaining: 884 }),
    { direction: 'up', distance: 12 },
  );
});

test('ignores dynamic viewport chrome that shifts top without moving through the document', () => {
  assert.equal(
    getCatalogScrollMovement({ top: 600, remaining: 0 }, { top: 648, remaining: 0 }),
    null,
  );
});

test('ignores content-height changes when the scroll position did not move', () => {
  assert.equal(
    getCatalogScrollMovement({ top: 240, remaining: 760 }, { top: 240, remaining: 980 }),
    null,
  );
});

test('ignores inconsistent metric movement instead of guessing a direction', () => {
  assert.equal(
    getCatalogScrollMovement({ top: 300, remaining: 700 }, { top: 320, remaining: 720 }),
    null,
  );
});
