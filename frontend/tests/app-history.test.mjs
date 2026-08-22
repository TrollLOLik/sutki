import assert from 'node:assert/strict';
import test from 'node:test';
import { readAppHistoryIndex, readAppHistoryScroll, withAppHistoryIndex, withAppHistoryScroll } from '../src/app/router/appHistory.ts';

test('reads only valid application history indexes', () => {
  assert.equal(readAppHistoryIndex({ __sutkiHistoryIndex: 2 }), 2);
  assert.equal(readAppHistoryIndex({ __sutkiHistoryIndex: -1 }), null);
  assert.equal(readAppHistoryIndex({ __sutkiHistoryIndex: 1.5 }), null);
  assert.equal(readAppHistoryIndex(null), null);
});

test('adds an application index without discarding existing history state', () => {
  assert.deepEqual(withAppHistoryIndex({ source: 'listing' }, 3), {
    source: 'listing',
    __sutkiHistoryIndex: 3,
  });
});

test('stores and validates scroll positions without discarding history state', () => {
  assert.equal(readAppHistoryScroll({ __sutkiScrollY: 480 }), 480);
  assert.equal(readAppHistoryScroll({ __sutkiScrollY: -1 }), null);
  assert.equal(readAppHistoryScroll({ __sutkiScrollY: Number.NaN }), null);
  assert.deepEqual(withAppHistoryScroll({ source: 'listing' }, 320), {
    source: 'listing',
    __sutkiScrollY: 320,
  });
});
