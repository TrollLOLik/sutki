import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageFiles = [
  '../src/screens/home/ui/HomePage.tsx',
  '../src/screens/map/ui/MapPage.tsx',
  '../src/screens/messages/ui/MessagesPage.tsx',
  '../src/screens/profile/ui/ProfilePage.tsx',
  '../src/screens/requests/ui/RequestsPage.tsx',
  '../src/screens/listing-detail/ui/ListingDetailPage.tsx',
  '../src/screens/booking/ui/BookingPage.tsx',
];

test('ready desktop pages use the shared topbar without page-specific geometry overrides', async () => {
  for (const relativePath of pageFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /<DesktopTopbar\b/, `${relativePath} must render DesktopTopbar`);
    assert.doesNotMatch(source, /<DesktopTopbar[^>]*\b(?:className|innerClassName)=/s, `${relativePath} must not override shared topbar geometry`);
  }
});
