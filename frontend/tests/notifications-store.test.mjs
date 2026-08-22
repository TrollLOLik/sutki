import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
};

const { notificationRepository } = await import('../src/features/notifications/model/notifications.ts');

test('notification repository keeps unread state synchronized', () => {
  notificationRepository.reset();
  assert.equal(notificationRepository.getSnapshot().unread, 3);

  notificationRepository.markRead(6);
  assert.equal(notificationRepository.getSnapshot().unread, 2);
  assert.equal(notificationRepository.getSnapshot().items.find((item) => item.id === 6)?.read, true);

  notificationRepository.markAllRead();
  assert.equal(notificationRepository.getSnapshot().unread, 0);
  assert.ok(notificationRepository.getSnapshot().items.every((item) => item.read));
});

test('notification repository replaces duplicate ids when adding events', () => {
  notificationRepository.reset();
  const first = notificationRepository.getSnapshot().items[0];
  notificationRepository.add({ ...first, title: 'Обновлённое событие', read: false });

  const matching = notificationRepository.getSnapshot().items.filter((item) => item.id === first.id);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].title, 'Обновлённое событие');
});