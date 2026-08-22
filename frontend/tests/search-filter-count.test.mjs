import test from 'node:test';
import assert from 'node:assert/strict';
import { countActiveFilters, defaultFilters } from '../src/shared/types/filters.ts';

test('filter badge includes favorites and own-listing visibility', () => {
  assert.equal(countActiveFilters(defaultFilters), 0);
  assert.equal(countActiveFilters({ ...defaultFilters, favoritesOnly: true }), 1);
  assert.equal(countActiveFilters({ ...defaultFilters, showOwnListings: true }), 1);
  assert.equal(countActiveFilters({
    ...defaultFilters,
    favoritesOnly: true,
    showOwnListings: true,
    rooms: ['1', '2'],
  }), 4);
});