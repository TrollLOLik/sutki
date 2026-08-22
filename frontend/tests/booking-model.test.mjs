import test from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, guestsLabel, isPhoneComplete, maskPhone, nightsLabel } from '../src/screens/booking/model/bookingModel.ts';

test('booking dates calculate whole nights without timezone drift', () => {
  assert.equal(daysBetween('2026-08-14', '2026-08-18'), 4);
  assert.equal(daysBetween('2026-08-18', '2026-08-14'), 0);
  assert.equal(daysBetween('', '2026-08-18'), 0);
});

test('phone input is normalized to a Russian display mask', () => {
  assert.equal(maskPhone('8 999 123-45-67'), '+7 (999) 123-45-67');
  assert.equal(maskPhone('+7 (999) 123-45-67'), '+7 (999) 123-45-67');
  assert.equal(maskPhone('291234567', 'BY'), '+375 (29) 123-45-67');
  assert.equal(maskPhone('99123456', 'AM'), '+374 (99) 123-456');
  assert.equal(isPhoneComplete('+375 (29) 123-45-67', 'BY'), true);
  assert.equal(isPhoneComplete('+375 (29) 123-45', 'BY'), false);
});

test('Russian guest and night labels use the correct plural form', () => {
  assert.equal(nightsLabel(1), '1 ночь');
  assert.equal(nightsLabel(2), '2 ночи');
  assert.equal(nightsLabel(5), '5 ночей');
  assert.equal(nightsLabel(11), '11 ночей');
  assert.equal(guestsLabel(1), '1 гость');
  assert.equal(guestsLabel(3), '3 гостя');
  assert.equal(guestsLabel(12), '12 гостей');
});
