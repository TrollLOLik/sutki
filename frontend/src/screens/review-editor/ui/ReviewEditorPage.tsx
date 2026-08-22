import { Check, Star } from 'lucide-react';
import { DesktopTopbar } from '@widgets/app-navigation';
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ListPageHeader,
} from '@ui';
import { useReviewEditorController } from '../model/useReviewEditorController';
import { ReviewEditorContent } from './ReviewEditorContent';
import '../review-editor.css';

export interface ReviewEditorPageProps {
  requestId: number;
  onBack: () => void;
  onDone: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onToast: (message: string) => void;
}

export function ReviewEditorPage(props: ReviewEditorPageProps) {
  const controller = useReviewEditorController(props.requestId);

  return (
    <div className="review-editor-page">
      <DesktopTopbar active="profile" onSearch={props.onHome} onMap={props.onMap} onMessages={props.onMessages} onProfile={props.onProfile} onCreate={props.onCreate} />
      <ListPageHeader presentation="mobile" className="review-app-header" title={controller.title} onBack={props.onBack} />
      {controller.request ? (
        <ReviewEditorContent controller={controller} onBack={props.onBack} />
      ) : (
        <main className="review-editor-main">
          <EmptyState className="review-not-found" icon={<Star size={34} />} title="Заявка не найдена" description="Оставить отзыв можно после завершённого проживания." actionLabel="Вернуться к бронированиям" onAction={props.onBack} />
        </main>
      )}
      <ConfirmationDialog
        open={controller.submitted}
        onClose={() => {}}
        closeOnBackdrop={false}
        title="Отзыв отправлен"
        description="Он появится после проверки."
        icon={<Check size={20} />}
        tone="success"
        singleAction
        actions={<Button size="sm" mode="solid" tone="primary" startIcon={<Check size={16} />} onClick={props.onDone}>Понятно</Button>}
      />
    </div>
  );
}
