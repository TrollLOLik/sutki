import test from 'node:test';
import assert from 'node:assert/strict';
import { contactCodeLength, getTrustedContact, maskContact } from '../src/screens/profile/model/contactVerification.ts';

test('phone is the primary trusted contact and email is the fallback', () => {
  assert.deepEqual(getTrustedContact({ phone: '+7 (999) 111-22-33', email: 'user@example.com' }), { channel: 'phone', value: '+7 (999) 111-22-33' });
  assert.deepEqual(getTrustedContact({ phone: '', email: ' USER@Example.com ' }), { channel: 'email', value: 'user@example.com' });
  assert.equal(getTrustedContact({ phone: ' ', email: ' ' }), null);
});

test('verification code length follows the delivery channel', () => {
  assert.equal(contactCodeLength('phone'), 4);
  assert.equal(contactCodeLength('email'), 6);
});

test('trusted identifiers are masked in verification copy', () => {
  assert.equal(maskContact('phone', '+7 (999) 111-22-33'), '+7 ••• •••-22-33');
  assert.equal(maskContact('email', 'artem9@mail.ru'), 'a****9@mail.ru');
});
