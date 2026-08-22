import { CircleAlert, CircleCheck, CircleX, Copy, Edit3, FileText, Image as ImageIcon, Reply, Trash2, X } from 'lucide-react';
import type { ChangeEvent, FormEventHandler, RefObject } from 'react';
import type { ChatAttachment, ChatMessage } from '@features/chat';
import { BadgeText, BottomSheet, Button, ConfirmationDialog, DescriptionText, Field, HiddenFileInput, ListCell, TextArea } from '@ui';
import { latestMessagePreview } from '../model/formatters';

interface MessageActions {
  canReply: boolean;
  canCopy: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface ChatDialogsProps {
  cameraInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  documentInputRef: RefObject<HTMLInputElement | null>;
  attachmentMenuOpen: boolean;
  actionsOpen: boolean;
  actionsTarget: ChatMessage | null;
  messageActions: MessageActions;
  messageActionHint: string | null;
  deletingMessage: ChatMessage | null;
  confirmingRequestId: number | null;
  rejectingRequestId: number | null;
  rejectReason: string;
  rejectError: string;
  attachmentModerationOpen: boolean;
  attachmentModerationMessage: string;
  onFilesChange: (event: ChangeEvent<HTMLInputElement>, kind: ChatAttachment['kind']) => void;
  onCloseAttachmentMenu: () => void;
  onCloseActions: () => void;
  onReply: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDeleteRequest: (message: ChatMessage) => void;
  onCloseDelete: () => void;
  onDelete: () => void;
  onCloseConfirmRequest: () => void;
  onConfirmRequest: () => void;
  onCloseRejectRequest: () => void;
  onRejectSubmit: FormEventHandler<HTMLFormElement>;
  onRejectReasonChange: (value: string) => void;
  onCloseAttachmentModeration: () => void;
}

export function ChatDialogs({
  cameraInputRef,
  imageInputRef,
  videoInputRef,
  documentInputRef,
  attachmentMenuOpen,
  actionsOpen,
  actionsTarget,
  messageActions,
  messageActionHint,
  deletingMessage,
  confirmingRequestId,
  rejectingRequestId,
  rejectReason,
  rejectError,
  attachmentModerationOpen,
  attachmentModerationMessage,
  onFilesChange,
  onCloseAttachmentMenu,
  onCloseActions,
  onReply,
  onCopy,
  onEdit,
  onDeleteRequest,
  onCloseDelete,
  onDelete,
  onCloseConfirmRequest,
  onConfirmRequest,
  onCloseRejectRequest,
  onRejectSubmit,
  onRejectReasonChange,
  onCloseAttachmentModeration,
}: ChatDialogsProps) {
  return (
    <>
      <HiddenFileInput ref={cameraInputRef} hidden accept="image/*" capture="environment" onChange={(event) => onFilesChange(event, 'image')} />
      <HiddenFileInput ref={imageInputRef} hidden accept="image/*" multiple onChange={(event) => onFilesChange(event, 'image')} />
      <HiddenFileInput ref={videoInputRef} hidden accept="video/*" onChange={(event) => onFilesChange(event, 'video')} />
      <HiddenFileInput ref={documentInputRef} hidden multiple onChange={(event) => onFilesChange(event, 'document')} />

      <BottomSheet open={attachmentMenuOpen} title="Добавить в сообщение" subtitle="Выберите тип вложения" onClose={onCloseAttachmentMenu} desktopPresentation="modal" className="chat-bottom-sheet">
        <div className="chat-action-list">
          <ListCell before={<ImageIcon size={21} />} title="Камера" subtitle="Сделать снимок сейчас" onClick={() => cameraInputRef.current?.click()} />
          <ListCell before={<ImageIcon size={21} />} title="Фото" subtitle="Выбрать до 6 изображений" onClick={() => imageInputRef.current?.click()} />
          <ListCell before={<FileText size={21} />} title="Документ" subtitle="PDF, DOC, XLS и другие файлы" onClick={() => documentInputRef.current?.click()} />
        </div>
      </BottomSheet>

      <BottomSheet open={actionsOpen} title="Действия с сообщением" subtitle={actionsTarget ? latestMessagePreview(actionsTarget) : undefined} onClose={onCloseActions} desktopPresentation="modal" className="chat-bottom-sheet">
        <div className="chat-action-list">
          {actionsTarget && messageActions.canReply ? <ListCell before={<Reply size={21} />} title="Ответить" chevron={false} onClick={() => onReply(actionsTarget)} /> : null}
          {actionsTarget && messageActions.canCopy ? <ListCell before={<Copy size={21} />} title="Копировать текст" chevron={false} onClick={() => onCopy(actionsTarget)} /> : null}
          {actionsTarget && messageActions.canEdit ? <ListCell before={<Edit3 size={21} />} title="Изменить" subtitle="Пока сообщение не прочитано, в течение 15 минут" chevron={false} onClick={() => onEdit(actionsTarget)} /> : null}
          {actionsTarget && messageActions.canDelete ? <ListCell className="danger" before={<Trash2 size={21} />} title="Удалить" subtitle="У себя и у собеседника" chevron={false} onClick={() => onDeleteRequest(actionsTarget)} /> : null}
        </div>
        {messageActionHint ? <BadgeText as="p" className="chat-action-hint" weight={400} color="muted">{messageActionHint}</BadgeText> : null}
      </BottomSheet>

      <ConfirmationDialog open={Boolean(deletingMessage)} title="Удалить сообщение?" description="Оно исчезнет у вас и у собеседника." icon={<Trash2 size={20} />} tone="danger" onClose={onCloseDelete} actions={<>
        <Button size="sm" mode="soft" tone="neutral" startIcon={<X size={18} />} onClick={onCloseDelete}>Отмена</Button>
        <Button size="sm" mode="outline" tone="danger" onClick={onDelete} startIcon={<Trash2 size={18} />}>Удалить</Button>
      </>} />

      <ConfirmationDialog
        open={confirmingRequestId != null}
        title="Подтвердить бронирование?"
        description="Гость получит подтверждение в переписке, а бронь появится в активных."
        icon={<CircleCheck size={20} />}
        tone="primary"
        onClose={onCloseConfirmRequest}
        actions={<>
          <Button size="sm" mode="soft" tone="neutral" onClick={onCloseConfirmRequest}>Отмена</Button>
          <Button size="sm" mode="solid" tone="primary" onClick={onConfirmRequest}>Подтвердить</Button>
        </>}
      />

      <ConfirmationDialog open={rejectingRequestId != null} className="chat-reject-confirm-dialog" title="Отклонить заявку?" description="Гость увидит причину в переписке." icon={<CircleAlert size={20} />} tone="danger" onClose={onCloseRejectRequest} actions={<><Button size="sm" mode="soft" tone="neutral" onClick={onCloseRejectRequest}>Отмена</Button><Button size="sm" mode="outline" tone="danger" type="submit" form="chat-reject-form">Отклонить</Button></>}>
        <form id="chat-reject-form" noValidate onSubmit={onRejectSubmit}>
          <Field label="Причина" labelFor="chat-reject-reason" error={rejectError || undefined} messageId="chat-reject-error">
            <TextArea
              id="chat-reject-reason"
              aria-invalid={Boolean(rejectError)}
              aria-describedby={rejectError ? 'chat-reject-error' : undefined}
              value={rejectReason}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onRejectReasonChange(event.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Например, даты уже заняты"
              invalid={Boolean(rejectError)}
            />
          </Field>
        </form>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={attachmentModerationOpen}
        title="Вложение не отправлено"
        description="Проверка ИИ-модератором"
        icon={<CircleX size={20} />}
        tone="primary"
        onClose={onCloseAttachmentModeration}
        singleAction
        actions={<Button size="sm" mode="solid" tone="primary" onClick={onCloseAttachmentModeration}>Понятно</Button>}
      >
        <DescriptionText as="p" className="chat-attachment-moderation-copy">{attachmentModerationMessage}</DescriptionText>
      </ConfirmationDialog>
    </>
  );
}
