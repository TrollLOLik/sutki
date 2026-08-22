import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessageActions } from '../src/features/chat/model/messageActions.ts';

const now = Date.parse('2026-07-31T12:00:00.000Z');

function message(overrides = {}) {
  return {
    id: 1,
    conversationId: 101,
    senderId: 'me',
    kind: 'user',
    body: 'Добрый день',
    createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    delivery: 'sent',
    ...overrides,
  };
}

test('an unread recent own message can be edited and deleted', () => {
  assert.deepEqual(getMessageActions(message(), now), {
    canReply: true,
    canCopy: true,
    canEdit: true,
    canDelete: true,
  });
});

test('a read message cannot be edited but remains deletable for one hour', () => {
  const actions = getMessageActions(message({ delivery: 'read' }), now);
  assert.equal(actions.canEdit, false);
  assert.equal(actions.canDelete, true);
});

test('edit and delete windows expire independently', () => {
  const twentyMinutesOld = message({ createdAt: new Date(now - 20 * 60 * 1000).toISOString() });
  assert.equal(getMessageActions(twentyMinutesOld, now).canEdit, false);
  assert.equal(getMessageActions(twentyMinutesOld, now).canDelete, true);

  const olderThanHour = message({ createdAt: new Date(now - 61 * 60 * 1000).toISOString() });
  assert.equal(getMessageActions(olderThanHour, now).canEdit, false);
  assert.equal(getMessageActions(olderThanHour, now).canDelete, false);
});

test('incoming messages allow reply and copy but not owner actions', () => {
  assert.deepEqual(getMessageActions(message({ senderId: 'anna' }), now), {
    canReply: true,
    canCopy: true,
    canEdit: false,
    canDelete: false,
  });
});