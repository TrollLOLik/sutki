import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyListingDraft } from '../src/screens/create-listing/model/createListingDraft.ts';
import {
  findFirstCreateListingError,
  validateCreateListingStep,
} from '../src/screens/create-listing/model/createListingValidation.ts';

function validDraft() {
  return {
    ...createEmptyListingDraft(),
    category: 'apartment',
    rooms: '2',
    city: 'Казань',
    street: 'Баумана',
    houseNumber: '12',
    area: '45',
    price: '4500',
    maxGuests: '4',
    description: 'Светлая квартира рядом с метро и магазинами.',
  };
}

test('create listing validation returns the first actionable field', () => {
  const draft = createEmptyListingDraft();
  assert.deepEqual(findFirstCreateListingError(draft), {
    step: 0,
    error: { message: 'Выберите тип жилья', anchor: 'create-category' },
  });
});

test('numeric listing constraints reject invalid finite ranges', () => {
  const draft = { ...validDraft(), area: 'Infinity' };
  assert.equal(validateCreateListingStep(draft, 2)?.anchor, 'create-area');
  assert.equal(validateCreateListingStep({ ...validDraft(), price: '149' }, 2)?.anchor, 'create-price');
  assert.equal(validateCreateListingStep({ ...validDraft(), maxGuests: '101' }, 2)?.anchor, 'create-guests');
});

test('complete create listing draft passes every publish validation step', () => {
  assert.equal(findFirstCreateListingError(validDraft()), null);
});
