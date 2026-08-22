import { MessageCircle, Sparkles } from 'lucide-react';
import {
  REVIEW_BODY_LIMIT,
  ReviewRating,
  remainingReviewAttempts,
} from '@features/reviews';
import {
  Badge,
  BadgeText,
  BodyText,
  Button,
  CompactAlert,
  DescriptionText,
  Field,
  ListPageHeader,
  RouteActionBarPortal,
  Surface,
  TextArea,
} from '@ui';
import { useMediaQuery } from '@shared/lib/adaptivity';
import type { ReviewEditorController } from '../model/useReviewEditorController';

export function ReviewEditorContent({ controller, onBack }: { controller: ReviewEditorController; onBack: () => void }) {
  const { request, existing, busy, rating, setRating, body, setBody, setError, editing, title, hint, ratingLabel, ratingError, bodyError, submissionError, submit } = controller;
  const desktop = useMediaQuery('(min-width: 900px)');
  if (!request) return null;

  const moderationNote = existing && editing ? (
    <CompactAlert
      className="review-moderation-note"
      tone={existing.rejectionReason ? 'danger' : 'info'}
      title={existing.rejectionReason ? 'Причина отклонения предыдущего отзыва' : 'Редактирование отзыва'}
      meta={`Осталось попыток редактирования: ${remainingReviewAttempts(existing)} из ${existing.maxAttempts}`}
      descriptionColor="secondary"
    >
      {existing.rejectionReason ?? 'Измените оценку или текст и отправьте отзыв на повторную проверку.'}
    </CompactAlert>
  ) : null;

  const submissionAlert = submissionError ? <CompactAlert tone="danger">{submissionError}</CompactAlert> : null;

  const ratingCard = (
    <Surface level="raised" radius="xl" className="review-editor-card review-rating-card">
      <div className="review-section-heading">
        <span className="review-section-icon"><Sparkles size={21} /></span>
        <div>
          <BodyText as="strong" weight={500}>Как прошло проживание?</BodyText>
          <DescriptionText>Поставьте общую оценку жилью</DescriptionText>
        </div>
        <BadgeText as="em" color="muted">1 из 2</BadgeText>
      </div>
      <Field className="review-rating-field" error={ratingError} messageId="review-rating-error">
        <ReviewRating className="review-rating-input" value={rating} size="lg" label="Оценка проживания" aria-describedby={ratingError ? 'review-rating-error' : undefined} onChange={(value) => { setRating(value); setError(''); }} />
      </Field>
      <DescriptionText className={`review-rating-label ${rating ? 'selected' : ''}`} color={rating ? 'accent' : 'muted'} weight={500}>{ratingLabel}</DescriptionText>
    </Surface>
  );

  const commentCard = (
    <Surface level="raised" radius="xl" className="review-editor-card review-comment-card">
      <div className="review-section-heading">
        <span className="review-section-icon"><MessageCircle size={20} /></span>
        <div>
          <BodyText as="strong" weight={500}>Расскажите подробнее</BodyText>
          <DescriptionText>Что особенно запомнилось?</DescriptionText>
        </div>
        <BadgeText as="em" color="muted">2 из 2</BadgeText>
      </div>
      <div className="review-topic-chips" aria-label="Темы отзыва">
        <Badge tone="neutral">Чистота</Badge>
        <Badge tone="neutral">Удобство</Badge>
        <Badge tone="neutral">Общение</Badge>
      </div>
      <Field error={bodyError} messageId="review-body-error">
        <TextArea value={body} maxLength={REVIEW_BODY_LIMIT} rows={7} showCount invalid={Boolean(bodyError)} aria-describedby={bodyError ? 'review-body-error' : undefined} placeholder="Напишите ваш отзыв..." onChange={(event) => { setBody(event.target.value); setError(''); }} />
      </Field>
    </Surface>
  );

  const submitPanel = (
    <footer className="review-submit-panel">
      <BadgeText as="p" color="muted">{hint}</BadgeText>
      <Button size="md" mode="solid" tone="primary" stretched loading={busy} onClick={() => void submit()}>{editing ? 'Сохранить изменения' : 'Отправить отзыв'}</Button>
    </footer>
  );

  return (
    <>
      <main className="review-editor-main">
        <ListPageHeader presentation="desktop" title={title} onBack={onBack} />
        {desktop ? (
          <div className="review-editor-workspace">
            <section className="review-editor-column review-editor-settings-column">
              {moderationNote}
              {submissionAlert}
              {ratingCard}
            </section>
            <section className="review-editor-column review-editor-copy-column">
              {commentCard}
              {submitPanel}
            </section>
          </div>
        ) : (
          <>
            {moderationNote}
            {submissionAlert}
            {ratingCard}
            {commentCard}
          </>
        )}
      </main>
      {!desktop ? <RouteActionBarPortal contextClassName="review-editor-page">{submitPanel}</RouteActionBarPortal> : null}
    </>
  );
}
