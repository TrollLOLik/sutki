import { Clock3, CornerUpLeft, Image as ImageIcon, MessageCircle, Pencil, Smile, Star, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { REVIEW_BODY_LIMIT, ReviewRating, reviewRepository, type Review } from '@features/reviews';
import {
  Avatar,
  Badge,
  BadgeText,
  BodyText,
  BottomSheet,
  Button,
  DescriptionText,
  Field,
  IconButton,
  Surface,
  TextArea,
} from '@ui';

const emoji = ['😀', '😊', '🙂', '😍', '😂', '👍', '🙏', '👌', '🔥', '❤️', '🎉', '🏠', '📍', '✅', '🙌', '☀️'];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function replyStatus(review: Review): string | null {
  if (!review.reply) return null;
  if (review.reply.status === 'pending_moderation') return 'Ответ отправлен на проверку';
  if (review.reply.status === 'moderation_review') return 'Ответ проходит дополнительную проверку';
  if (review.reply.status === 'rejected') return 'Ответ отклонён';
  return null;
}

export function ReviewCard({ review, mode, onEdit, onDelete, onToast }: {
  review: Review;
  mode: 'written' | 'received' | 'public';
  onEdit?: () => void;
  onDelete?: () => void;
  onToast: (message: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canReply = (mode === 'received' || mode === 'public') && review.receivedByMe && !review.reply;
  const statusText = replyStatus(review);

  const sendReply = async () => {
    setBusy(true);
    setError('');
    try {
      await reviewRepository.reply(review.id, body);
      setReplying(false);
      setBody('');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось отправить ответ';
      setError(message);
      onToast(message);
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'written') {
    return (
      <Surface level="raised" radius="xl" className={`review-card review-card-written ui-personal-collection-card ${review.status === 'deleted' ? 'is-deleted' : ''}`}>
        <header className="review-written-head">
          {review.listing.coverUrl ? <img src={review.listing.coverUrl} alt="" /> : <span><ImageIcon size={20} /></span>}
          <div>
            <BodyText as="strong" weight={500} truncate>{review.listing.address}</BodyText>
            <BadgeText color="secondary" truncate>{review.listing.city}</BadgeText>
          </div>
        </header>
        <div className="review-written-meta">
          <ReviewRating className="review-stars-pill" value={review.rating} size="md" />
          <BadgeText color="muted">{formatDate(review.createdAt)}</BadgeText>
        </div>
        <DescriptionText as="p" className="review-card-body" color="default">{review.body}</DescriptionText>
        {review.status !== 'active' ? (
          <Badge
            tone={review.status === 'rejected' ? 'danger' : review.status === 'deleted' ? 'neutral' : 'primary'}
            before={review.status === 'rejected' ? <XCircle size={14} /> : review.status === 'deleted' ? <Trash2 size={14} /> : <Clock3 size={14} />}
          >
            {review.status === 'rejected' ? 'Отклонён' : review.status === 'moderation_review' ? 'Дополнительная проверка' : review.status === 'deleted' ? 'Удалён' : 'На проверке'}
          </Badge>
        ) : null}
        {review.status === 'rejected' && review.rejectionReason ? <BadgeText as="p" className="review-rejection-text" color="danger">{review.rejectionReason}</BadgeText> : null}
        {onEdit || onDelete ? (
          <div className="review-edit-action">
            {onEdit ? <Button size="sm" mode="soft" tone="neutral" startIcon={<Pencil size={15} />} onClick={onEdit}>Изменить</Button> : null}
            {onDelete ? <Button className="review-delete-button" size="sm" mode="outline" tone="danger" startIcon={<Trash2 size={15} />} onClick={onDelete}>Удалить</Button> : null}
          </div>
        ) : null}
      </Surface>
    );
  }

  return (
    <Surface level="raised" radius="xl" className="review-card review-card-received ui-personal-collection-card">
      <header className="review-author-head">
        <Avatar className="review-author-avatar" size="sm" src={review.authorAvatarUrl} name={review.authorName || 'Гость'} />
        <div>
          <BodyText as="strong" weight={500} truncate>{review.authorName || 'Гость'}</BodyText>
          <BadgeText color="secondary" truncate>{formatDate(review.createdAt)}</BadgeText>
        </div>
        {mode === 'public' ? <Badge className="review-score-pill" tone="primary" before={<Star size={14} fill="currentColor" />}>{review.rating.toFixed(1)}</Badge> : null}
      </header>
      {mode === 'received' ? (
        <div className="review-received-meta">
          <ReviewRating className="review-stars-pill" value={review.rating} size="md" />
          <Badge className="review-address-pill" tone="neutral">{review.listing.address}</Badge>
        </div>
      ) : null}
      <DescriptionText as="p" className="review-card-body" color="default">{review.body}</DescriptionText>
      {review.reply?.status === 'active' ? (
        <Surface className="review-owner-reply" level="muted" radius="md" bordered={false}>
          <BadgeText as="strong" color="accent"><MessageCircle size={16} />Ответ владельца</BadgeText>
          <DescriptionText as="p">{review.reply.body}</DescriptionText>
        </Surface>
      ) : statusText ? (
        <BadgeText as="p" className={review.reply?.status === 'rejected' ? 'review-reply-status error' : 'review-reply-status'} color={review.reply?.status === 'rejected' ? 'danger' : 'accent'}>{statusText}</BadgeText>
      ) : canReply && !replying ? (
        <Button className="review-reply-pill" size="sm" mode="soft" tone="neutral" startIcon={<CornerUpLeft size={17} />} onClick={() => setReplying(true)}>Ответить</Button>
      ) : null}
      {replying ? (
        <div className="review-reply-editor">
          <Field className="review-reply-field" error={error || undefined} messageId={`review-reply-error-${review.id}`}>
            <div className="review-reply-input">
              <TextArea autoFocus value={body} maxLength={REVIEW_BODY_LIMIT} rows={3} placeholder="Ответ гостю" invalid={Boolean(error)} aria-describedby={error ? `review-reply-error-${review.id}` : undefined} onChange={(event) => { setBody(event.target.value); setError(''); }} />
              <IconButton label="Выбрать смайлик" size="sm" mode="soft" tone="neutral" icon={<Smile size={18} />} onClick={() => setEmojiOpen(true)} />
            </div>
          </Field>
          <div className="review-reply-actions">
            <Button size="sm" mode="soft" tone="neutral" onClick={() => { setReplying(false); setBody(''); setError(''); }}>Отмена</Button>
            <Button size="sm" mode="solid" tone="primary" loading={busy} disabled={!body.trim()} onClick={() => void sendReply()}>Отправить</Button>
          </div>
          <BadgeText as="p" color="muted">Ответ появится после проверки.</BadgeText>
        </div>
      ) : null}
      <BottomSheet className="review-emoji-sheet" desktopPresentation="modal" open={emojiOpen} title="Смайлик" onClose={() => setEmojiOpen(false)}>
        <div className="review-emoji-grid">
          {emoji.map((item) => <IconButton key={item} label={`Добавить ${item}`} size="sm" mode="soft" tone="neutral" icon={<span aria-hidden="true">{item}</span>} onClick={() => { setBody((value) => value + item); setError(''); setEmojiOpen(false); }} />)}
        </div>
      </BottomSheet>
    </Surface>
  );
}
