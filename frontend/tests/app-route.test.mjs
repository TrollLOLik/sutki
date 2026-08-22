import test from 'node:test';
import assert from 'node:assert/strict';
import { appRoutePath, parseAppRoute, routeTitle } from '../src/app/router/appRoute.ts';

const routes = [
  [{ name: 'welcome' }, '/welcome'],
  [{ name: 'auth-phone' }, '/phone'],
  [{ name: 'auth-email' }, '/email'],
  [{ name: 'auth-code', channel: 'phone', identifier: '+7 (999) 111-22-33' }, '/code?channel=phone&identifier=%2B7+%28999%29+111-22-33'],
  [{ name: 'auth-code', channel: 'email', identifier: 'demo@example.ru' }, '/code?channel=email&identifier=demo%40example.ru'],
  [{ name: 'profile-setup' }, '/profile-setup'],
  [{ name: 'home' }, '/'],
  [{ name: 'map' }, '/map'],
  [{ name: 'map', listingId: 6 }, '/map?listing=6'],
  [{ name: 'create' }, '/create'],
  [{ name: 'create', editId: 6 }, '/create?editId=6'],
  [{ name: 'profile' }, '/profile'],
  [{ name: 'my-listings' }, '/my-listings'],
  [{ name: 'my-listings', tab: 'pending' }, '/my-listings?tab=pending'],
  [{ name: 'notifications' }, '/notifications'],
  [{ name: 'my-reviews' }, '/my-reviews'],
  [{ name: 'my-reviews', tab: 'received' }, '/my-reviews?tab=received'],
  [{ name: 'my-reviews', tab: 'received', focusReviewId: 42 }, '/my-reviews?tab=received&focus=42'],
  [{ name: 'review-editor', requestId: 9203 }, '/review/9203'],
  [{ name: 'public-reviews', kind: 'listing', subjectId: '5' }, '/reviews/listing/5'],
  [{ name: 'public-reviews', kind: 'user', subjectId: 'anna' }, '/reviews/user/anna'],
  [{ name: 'public-profile', userId: 'anna' }, '/profile/anna'],
  [{ name: 'ui-kit' }, '/ui-kit'],
  [{ name: 'messages', conversationId: null }, '/messages'],
  [{ name: 'messages', conversationId: 101 }, '/chat/101'],
  [{ name: 'requests', direction: 'incoming', requestId: null }, '/incoming'],
  [{ name: 'requests', direction: 'incoming', requestId: 8401 }, '/incoming/8401'],
  [{ name: 'requests', direction: 'outgoing', requestId: null }, '/bookings'],
  [{ name: 'requests', direction: 'outgoing', requestId: 9201 }, '/bookings/9201'],
  [{ name: 'listing', listingId: 1 }, '/listing/1'],
  [{ name: 'booking', listingId: 1 }, '/booking/1'],
];

test('route contracts round-trip for every ready screen', () => {
  for (const [route, path] of routes) {
    assert.equal(appRoutePath(route), path);
    assert.deepEqual(parseAppRoute(path), route);
  }
});

test('unknown paths safely fall back to the home screen', () => {
  assert.deepEqual(parseAppRoute('/unknown/path'), { name: 'home' });
});

test('malformed encoded paths safely fall back to the home screen', () => {
  assert.deepEqual(parseAppRoute('/profile/%E0%A4%A'), { name: 'home' });
  assert.deepEqual(parseAppRoute('/reviews/user/%E0%A4%A'), { name: 'home' });
});

test('route titles stay user-facing', () => {
  assert.equal(routeTitle({ name: 'listing', listingId: 1 }, 'Квартира в центре'), 'Квартира в центре');
  assert.equal(routeTitle({ name: 'requests', direction: 'incoming', requestId: null }), 'Входящие заявки');
  assert.equal(routeTitle({ name: 'requests', direction: 'outgoing', requestId: null }), 'Мои брони');
});
