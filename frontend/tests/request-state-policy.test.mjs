import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRequestCapabilities,
  getRequestStatusMeta,
  isCurrentRequest,
} from '../src/features/requests/model/status.ts';

const baseRequest = {
  id: 1,
  direction: 'outgoing',
  listing: {
    id: 1,
    title: 'Квартира',
    address: 'Адрес',
    city: 'Город',
    price: 1000,
    owner: { id: 2, name: 'Иван', surname: 'Иванов', phone: '+70000000000' },
  },
  guest: { id: 3, name: 'Анна', surname: 'Петрова', phone: '+71111111111' },
  guests: 2,
  message: '',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  status: 'pending',
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T10:00:00.000Z',
  chatConversationId: 101,
};

test('request state policy keeps tabs, labels and actions consistent', () => {
  const outgoingPending = { ...baseRequest };
  assert.equal(isCurrentRequest(outgoingPending), true);
  assert.equal(getRequestStatusMeta(outgoingPending).label, 'На рассмотрении');
  assert.deepEqual(getRequestCapabilities(outgoingPending), {
    confirm: false,
    reject: false,
    cancel: true,
    repeat: false,
    review: false,
    chat: true,
    contact: false,
  });

  const incomingPending = { ...baseRequest, direction: 'incoming' };
  assert.equal(getRequestStatusMeta(incomingPending).label, 'На рассмотрении');
  assert.equal(getRequestCapabilities(incomingPending).confirm, true);
  assert.equal(getRequestCapabilities(incomingPending).reject, true);

  const incomingConfirmed = { ...baseRequest, direction: 'incoming', status: 'confirmed' };
  assert.equal(isCurrentRequest(incomingConfirmed), false);
  assert.equal(getRequestCapabilities(incomingConfirmed).contact, true);

  const completed = { ...baseRequest, status: 'completed', reviewAvailable: true };
  assert.equal(isCurrentRequest(completed), false);
  assert.equal(getRequestCapabilities(completed).repeat, true);
  assert.equal(getRequestCapabilities(completed).review, true);

  const cancelled = { ...baseRequest, status: 'cancelled' };
  assert.equal(isCurrentRequest(cancelled), false);
  assert.equal(getRequestCapabilities(cancelled).repeat, true);
  assert.equal(getRequestCapabilities(cancelled).cancel, false);

  const cancelledByGuestWithReason = { ...cancelled, cancelledBy: 'guest', rejectionReason: 'Изменились планы.' };
  assert.equal(getRequestStatusMeta(cancelledByGuestWithReason).label, 'Отменена');

  const rejectedByOwner = { ...cancelled, cancelledBy: 'owner', rejectionReason: 'Даты заняты.' };
  assert.equal(getRequestStatusMeta(rejectedByOwner).label, 'Отклонена');
});
