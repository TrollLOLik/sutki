import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthEmail } from '../src/features/auth/model/authEmail.ts';

test('email authorization normalizes a valid identifier', () => {
  assert.equal(normalizeAuthEmail(' Demo.User@Example.RU '), 'demo.user@example.ru');
});

test('email authorization rejects malformed and oversized identifiers', () => {
  assert.equal(normalizeAuthEmail(''), null);
  assert.equal(normalizeAuthEmail('demo.example.ru'), null);
  assert.equal(normalizeAuthEmail('demo @example.ru'), null);
  assert.equal(normalizeAuthEmail('demo@example'), null);
  assert.equal(normalizeAuthEmail(`${'a'.repeat(245)}@example.ru`), null);
});
