import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAppScrollMovement,
  initialAppScrollChromeState,
  reduceAppScrollChrome,
} from '../src/shared/lib/scroll/appScrollChrome.ts';

test('hides after downward travel and reveals quickly on upward travel', () => {
  const hidden = reduceAppScrollChrome(initialAppScrollChromeState, { direction: 'down', distance: 24 }, 120);
  assert.equal(hidden.hidden, true);

  const shown = reduceAppScrollChrome(hidden, { direction: 'up', distance: 8 }, 112);
  assert.equal(shown.hidden, false);
});

test('reveals app chrome whenever the document returns to the top', () => {
  const hidden = { hidden: true, direction: 'down', travel: 0 };
  assert.deepEqual(reduceAppScrollChrome(hidden, null, 8), initialAppScrollChromeState);
});

test('ignores viewport-only movement and accumulates travel by direction', () => {
  assert.equal(getAppScrollMovement({ top: 400, remaining: 0 }, { top: 430, remaining: 0 }), null);

  const first = reduceAppScrollChrome(initialAppScrollChromeState, { direction: 'down', distance: 10 }, 90);
  const second = reduceAppScrollChrome(first, { direction: 'down', distance: 10 }, 100);
  assert.equal(second.hidden, false);
  assert.equal(second.travel, 20);

  const reversed = reduceAppScrollChrome(second, { direction: 'up', distance: 4 }, 96);
  assert.equal(reversed.direction, 'up');
  assert.equal(reversed.travel, 4);
});
