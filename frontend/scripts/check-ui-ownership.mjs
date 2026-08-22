import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const sourceFiles = walk(sourceRoot).filter((file) => /\.(tsx|ts|css)$/u.test(file));
const canonicalDialogs = new Set([
  path.join(sourceRoot, 'shared', 'ui', 'Modal.tsx'),
  path.join(sourceRoot, 'shared', 'ui', 'BottomSheet.tsx'),
  path.join(sourceRoot, 'shared', 'ui', 'OverlaySurface.tsx'),
]);
const sharedUiRoot = path.join(sourceRoot, 'shared', 'ui') + path.sep;

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);

  if (file.endsWith('.tsx') && /(?:role=["']dialog["']|aria-modal)/u.test(source) && !file.startsWith(sharedUiRoot)) {
    failures.push(`${relative}: dialog semantics must be owned by shared UI`);
  }

  if (source.includes('usePageScrollLock')
    && !canonicalDialogs.has(file)
    && !file.endsWith(path.join('shared', 'lib', 'scroll', 'ScrollSystem.tsx'))) {
    failures.push(`${relative}: page scroll locking must be owned by a shared overlay primitive`);
  }
}

const requiredConsumers = new Map([
  ['src/screens/home/ui/HomePage.tsx', ['CatalogToolbar', 'CatalogFilterShortcuts', 'CatalogFeed', 'useCatalogPageController']],
  ['src/screens/messages/ui/MessagesPage.tsx', ['ConversationSidebar', 'ChatDialog', 'useMessagesListController']],
  ['src/screens/messages/ui/ConversationSidebar.tsx', ['PersonalListToolbar', 'CountedTabs']],
  ['src/screens/messages/ui/ChatDialog.tsx', ['MessageItem', 'ChatComposer', 'ChatDialogs']],
  ['src/screens/messages/ui/ChatDialogs.tsx', ['BottomSheet', 'ConfirmationDialog']],
  ['src/screens/notifications/ui/NotificationsPage.tsx', ['PersonalListToolbar']],
  ['src/screens/requests/ui/RequestsPage.tsx', ['RequestsListView', 'RequestDetail', 'RequestDialog', 'useRequestsPageController']],
  ['src/screens/requests/ui/RequestsListView.tsx', ['PersonalListToolbar', 'CountedTabs', 'RequestCard']],
  ['src/screens/reviews/ui/MyReviewsPage.tsx', ['MyReviewsContent', 'DeleteReviewDialog', 'useMyReviewsPageController']],
  ['src/screens/reviews/ui/MyReviewsContent.tsx', ['PersonalListToolbar', 'CountedTabs', 'ReviewCard']],
  ['src/screens/booking/ui/BookingPage.tsx', ['BookingFormContent', 'BookingMobileActionBar', 'BookingSuccessDialog', 'useBookingForm']],
  ['src/screens/booking/ui/BookingFormContent.tsx', ['Field', 'TextField', 'Counter', 'BookingDatesSection', 'BookingContactSection', 'BookingSummaryCard']],
  ['src/screens/booking/ui/BookingActions.tsx', ['StickyActionBar', 'ConfirmationDialog']],
  ['src/screens/listing-detail/ui/ListingDetailPage.tsx', ['ListingGallery', 'ListingDetailContent', 'ListingDesktopBookingCard', 'ListingMobileBookingBar', 'ListingDetailOverlays', 'useListingDetailController']],
  ['src/screens/listing-detail/ui/ListingDetailOverlays.tsx', ['OverlaySurface', 'DateSheet', 'GuestSheet']],
  ['src/screens/listing-detail/ui/ListingBookingPanels.tsx', ['StickyActionBar']],
  ['src/screens/map/ui/MapPage.tsx', ['MapResultsPanel', 'MapCanvas']],
  ['src/screens/map/ui/MapResultsPanel.tsx', ['MapResultCard']],
  ['src/screens/map/ui/MapCanvas.tsx', ['MapSelectedCard']],
  ['src/screens/profile/ui/ProfilePage.tsx', ['ProfileOverview', 'ProfileSettingsPanels', 'ProfileSessionDialogs', 'ProfileContactDialog', 'ProfileDeleteDialogs']],
  ['src/screens/create-listing/ui/CreateListingPage.tsx', ['CreateListingHeader', 'CreateListingStepContent', 'CreateListingSidebar', 'CreateListingActionBar', 'CreateListingSuccess', 'useCreateListingController']],
  ['src/screens/create-listing/ui/CreateListingStepContent.tsx', ['ListingBasicsStep', 'ListingAddressStep', 'ListingDetailsStep', 'ListingDescriptionStep', 'ListingPhotosStep', 'ListingReviewStep']],
  ['src/screens/my-listings/ui/MyListingsPage.tsx', ['MyListingsControls', 'MyListingsResults', 'MyListingsOverlays', 'useMyListingsPageController']],
  ['src/screens/my-listings/ui/MyListingsControls.tsx', ['PersonalListToolbar', 'CountedTabs']],
  ['src/screens/my-listings/ui/MyListingsResults.tsx', ['OwnerListingCard']],
  ['src/screens/public-profile/ui/PublicProfilePage.tsx', ['PublicProfileOverview', 'PublicProfileListings', 'PublicProfileOverlays', 'usePublicProfileController']],
]);

for (const [relative, symbols] of requiredConsumers) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const symbol of symbols) {
    if (!new RegExp(`\\b${symbol}\\b`, 'u').test(source)) failures.push(`${relative}: missing canonical ${symbol} consumer`);
  }
}

if (failures.length) {
  console.error('UI ownership check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('UI ownership check passed for shared dialogs, scroll locking and canonical page consumers.');
