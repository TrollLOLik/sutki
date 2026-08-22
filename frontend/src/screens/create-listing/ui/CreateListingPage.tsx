import type { CSSProperties } from 'react';
import { DesktopTopbar } from '@widgets/app-navigation';
import { useCreateListingController } from '../model/useCreateListingController';
import { CreateListingActionBar, CreateListingHeader, CreateListingSidebar } from './CreateListingNavigation';
import { CreateListingStepContent } from './CreateListingStepContent';
import { CreateListingSuccess } from './CreateListingSuccess';

interface CreateListingPageProps {
  editId?: number;
  onClose: () => void;
  onOpenMyListings: () => void;
  onPromote: (listingId: number) => void;
  onPublished: (message: string) => void;
  onHome: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onCreate: () => void;
}

export function CreateListingPage({ editId, onClose, onOpenMyListings, onPromote, onPublished, onHome, onMap, onMessages, onProfile, onCreate }: CreateListingPageProps) {
  const controller = useCreateListingController({ editId, onClose, onPublished });

  if (controller.published) {
    return <CreateListingSuccess editing={Boolean(editId)} listingId={controller.publishedListingId} onPromote={onPromote} onOpenMyListings={onOpenMyListings} onClose={onClose} />;
  }

  return (
    <div className="create-page-shell" style={{ '--create-keyboard-offset': `${controller.keyboardOffset}px` } as CSSProperties}>
      <DesktopTopbar className="create-desktop-topbar" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={onProfile} onCreate={onCreate} />
      <CreateListingHeader controller={controller} />
      <main className="create-page-layout">
        <CreateListingStepContent controller={controller} />
        <CreateListingSidebar controller={controller} />
      </main>
      <CreateListingActionBar controller={controller} />
    </div>
  );
}
