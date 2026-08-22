import type { Conversation } from '@features/chat';
import { useChatDialogController } from '../model/useChatDialogController';
import { ChatComposer } from './ChatComposer';
import { ChatDialogContext } from './ChatDialogContext';
import { ChatDialogHeader } from './ChatDialogHeader';
import { ChatDialogs } from './ChatDialogs';
import { ChatMessageList } from './ChatMessageList';

export function ChatDialog({
  conversation,
  onBack,
  onOpenListing,
  onOpenProfile,
  onOpenRequest,
  onToast,
}: {
  conversation: Conversation;
  onBack: () => void;
  onOpenListing: (listingId: number) => void;
  onOpenProfile: (userId: string) => void;
  onOpenRequest: (requestId: number) => void;
  onToast: (message: string) => void;
}) {
  const controller = useChatDialogController({ conversation, onToast });
  const {
    liveConversation,
    fullName,
    presence,
    showSafety,
    replyMessage,
    editingMessage,
    quickReplies,
    messageActions,
    messageActionHint,
    input,
    staged,
    attachmentMenu,
    actionsTarget,
    renderedActionsTarget,
    deletingMessage,
    confirmingRequestId,
    rejectingRequestId,
    rejectReason,
    rejectError,
    attachmentModerationOpen,
    attachmentModerationMessage,
    imageInputRef,
    cameraInputRef,
    videoInputRef,
    documentInputRef,
    setInput,
    setAttachmentMenu,
    setActionsTarget,
    setDeletingMessage,
    setConfirmingRequestId,
    setAttachmentModerationOpen,
    setSafetyVisible,
    setReplyToId,
    submit,
    addFiles,
    startReply,
    startEdit,
    copyMessage,
    openDeleteConfirmation,
    preserveThreadPosition,
    removeAttachment,
    cancelEdit,
    sendQuickReply,
    deleteMessage,
    confirmRequest,
    closeRejectRequest,
    submitRejectRequest,
    changeRejectReason,
  } = controller;

  return (
    <div className="chat-dialog">
      <ChatDialogHeader conversation={liveConversation} fullName={fullName} presence={presence} onBack={onBack} onOpenProfile={onOpenProfile} onPreserveThreadPosition={preserveThreadPosition} />
      <ChatDialogContext conversation={liveConversation} showSafety={showSafety} onHideSafety={() => setSafetyVisible(false)} onOpenListing={onOpenListing} onPreserveThreadPosition={preserveThreadPosition} />
      <ChatMessageList controller={controller} onOpenRequest={onOpenRequest} onToast={onToast} />

      <ChatComposer
        deleted={Boolean(liveConversation.otherUser.deleted)}
        staged={staged}
        editingMessage={editingMessage}
        replyMessage={replyMessage}
        fullName={fullName}
        quickReplies={quickReplies}
        input={input}
        onInputChange={setInput}
        onRemoveAttachment={removeAttachment}
        onCancelEdit={cancelEdit}
        onCancelReply={() => setReplyToId(undefined)}
        onPickQuickReply={setInput}
        onSendQuickReply={sendQuickReply}
        onOpenAttachmentMenu={() => setAttachmentMenu(true)}
        onSubmit={submit}
      />

      <ChatDialogs
        cameraInputRef={cameraInputRef}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        documentInputRef={documentInputRef}
        attachmentMenuOpen={attachmentMenu}
        actionsOpen={Boolean(actionsTarget)}
        actionsTarget={renderedActionsTarget}
        messageActions={messageActions}
        messageActionHint={messageActionHint}
        deletingMessage={deletingMessage}
        confirmingRequestId={confirmingRequestId}
        rejectingRequestId={rejectingRequestId}
        rejectReason={rejectReason}
        rejectError={rejectError}
        attachmentModerationOpen={attachmentModerationOpen}
        attachmentModerationMessage={attachmentModerationMessage}
        onFilesChange={addFiles}
        onCloseAttachmentMenu={() => setAttachmentMenu(false)}
        onCloseActions={() => setActionsTarget(null)}
        onReply={startReply}
        onCopy={copyMessage}
        onEdit={startEdit}
        onDeleteRequest={openDeleteConfirmation}
        onCloseDelete={() => setDeletingMessage(null)}
        onDelete={deleteMessage}
        onCloseConfirmRequest={() => setConfirmingRequestId(null)}
        onConfirmRequest={confirmRequest}
        onCloseRejectRequest={closeRejectRequest}
        onRejectSubmit={submitRejectRequest}
        onRejectReasonChange={changeRejectReason}
        onCloseAttachmentModeration={() => setAttachmentModerationOpen(false)}
      />
    </div>
  );
}
