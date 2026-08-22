import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findFirstValidationError,
  VALIDATION_ERROR_SELECTOR,
} from '../src/shared/lib/forms/scrollToValidationError.ts';

test('validation scrolling looks for the shared invalid-field contract', () => {
  const marker = { id: 'first-error' };
  const root = {
    querySelector(selector) {
      assert.equal(selector, VALIDATION_ERROR_SELECTOR);
      return marker;
    },
  };

  assert.equal(findFirstValidationError(root), marker);
});
