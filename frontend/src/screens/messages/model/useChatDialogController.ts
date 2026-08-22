import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type UIEvent as ReactUIEvent,
} from 'react';
import { scrollToValidationAnchor } from '@shared/lib/forms/scrollToValidationError';
import {
  chatRepository,
  getMessageActionHint,
  getMessageActions,
  useChatSnapshot,
  type BookingStatusPayload,
  type ChatAttachment,
  type ChatMessage,
  type Conversation,
} from '@features/chat';
import { formatLastSeen } from './formatters';

const chatThreadScrollPositions = new Map<number, number>();

interface UseChatDialogControllerOptions {
  conversation: Conversation;
  onToast: (message: string) => void;
}

export function useChatDialogController({ conversation, onToast }: UseChatDialogControllerOptions) {
  const { conversations } = useChatSnapshot();
  const liveConversation = conversations.find((item) => item.id === conversation.id) ?? conversation;
  const [input, setInput] = useState('');
  const [replyToId, setReplyToId] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<number | undefined>();
  const [staged, setStaged] = useState<ChatAttachment[]>([]);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [actionsTarget, setActionsTarget] = useState<ChatMessage | null>(null);
  const [renderedActionsTarget, setRenderedActionsTarget] = useState<ChatMessage | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [confirmingRequestId, setConfirmingRequestId] = useState<number | null>(null);
  const [safetyVisible, setSafetyVisible] = useState(true);
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('Даты уже заняты.');
  const [rejectError, setRejectError] = useState('');
  const [attachmentModerationOpen, setAttachmentModerationOpen] = useState(false);
  const [attachmentModerationMessage, setAttachmentModerationMessage] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const messageListStateRef = useRef({ conversationId: liveConversation.id, count: liveConversation.messages.length });
  const messageScrollTopRef = useRef(chatThreadScrollPositions.get(liveConversation.id) ?? 0);
  const messageDistanceFromBottomRef = useRef(0);
  const moderationAttemptRef = useRef(0);

  const messages = liveConversation.messages;
  const messageMap = useMemo(() => new Map(messages.map((item) => [item.id, item])), [messages]);
  const repliedMessageIds = useMemo(() => new Set(messages.flatMap((item) => item.replyToId == null ? [] : [item.replyToId])), [messages]);
  const visibleMessages = useMemo(
    () => messages.filter((item) => !(item.deletedAt && repliedMessageIds.has(item.id))),
    [messages, repliedMessageIds],
  );
  const conversationGalleryImages = useMemo(
    () => messages.flatMap((item) => item.deletedAt ? [] : (item.attachments ?? []).filter((attachment) => attachment.kind === 'image')),
    [messages],
  );
  const latestBookingEvent = useMemo(() => {
    const map = new Map<number, BookingStatusPayload['event']>();
    messages.forEach((item) => {
      if (item.booking) map.set(item.booking.requestId, item.booking.event);
    });
    return map;
  }, [messages]);

  useEffect(() => {
    if (liveConversation.unreadCount > 0) chatRepository.markRead(liveConversation.id);
  }, [liveConversation.id, liveConversation.unreadCount]);

  useEffect(() => {
    if (actionsTarget) setRenderedActionsTarget(actionsTarget);
  }, [actionsTarget]);

  useEffect(() => {
    setInput('');
    setReplyToId(undefined);
    setEditingId(undefined);
    setStaged([]);
    setActionsTarget(null);
    setDeletingMessage(null);
    setConfirmingRequestId(null);
    setAttachmentModerationOpen(false);
    setSafetyVisible(true);
  }, [liveConversation.id]);

  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return undefined;
    const conversationId = liveConversation.id;
    const savedPosition = chatThreadScrollPositions.get(conversationId);
    element.scrollTop = savedPosition ?? element.scrollHeight;
    messageScrollTopRef.current = element.scrollTop;
    messageDistanceFromBottomRef.current = Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
    return () => {
      chatThreadScrollPositions.set(conversationId, messageScrollTopRef.current);
    };
  }, [liveConversation.id]);

  useEffect(() => {
    const previous = messageListStateRef.current;
    if (previous.conversationId !== liveConversation.id) {
      messageListStateRef.current = { conversationId: liveConversation.id, count: messages.length };
      return;
    }
    if (messages.length > previous.count) {
      const element = listRef.current;
      window.requestAnimationFrame(() => element?.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }));
    }
    messageListStateRef.current.count = messages.length;
  }, [liveConversation.id, messages.length]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    let frame = 0;
    const preserveMessagePosition = () => {
      const distanceFromBottom = messageDistanceFromBottomRef.current;
      const composerFocused = document.activeElement?.closest('.chat-composer') != null;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const element = listRef.current;
        if (!element || (distanceFromBottom > 96 && !composerFocused)) return;
        element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - distanceFromBottom);
        messageScrollTopRef.current = element.scrollTop;
        messageDistanceFromBottomRef.current = Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
      });
    };

    viewport.addEventListener('resize', preserveMessagePosition);
    viewport.addEventListener('scroll', preserveMessagePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', preserveMessagePosition);
      viewport.removeEventListener('scroll', preserveMessagePosition);
    };
  }, [liveConversation.id]);

  const fullName = liveConversation.otherUser.deleted
    ? 'Удалённый профиль'
    : `${liveConversation.otherUser.name} ${liveConversation.otherUser.surname}`.trim();
  const presence = liveConversation.otherUser.deleted
    ? 'Профиль удалён'
    : liveConversation.startedAtLabel
      ? liveConversation.startedAtLabel
      : liveConversation.otherUser.online
        ? 'В сети'
        : formatLastSeen(liveConversation.otherUser.lastSeenAt);
  const humanMessageCount = messages.filter((item) => item.kind === 'user').length;
  const showSafety = safetyVisible && !liveConversation.otherUser.deleted && humanMessageCount < 7;
  const replyMessage = replyToId ? messageMap.get(replyToId) : undefined;
  const editingMessage = editingId ? messageMap.get(editingId) : undefined;
  const quickReplies = liveConversation.isOwner
    ? ['Здравствуйте! Даты свободны.', 'Заселение после 14:00.', 'Да, можно с питомцем.', 'Подтвержу заявку сегодня.']
    : ['Спасибо, всё подходит.', 'Во сколько можно заселиться?', 'Есть ли парковка?', 'Отправлю заявку сейчас.'];
  const messageActions = renderedActionsTarget
    ? getMessageActions(renderedActionsTarget)
    : { canReply: false, canCopy: false, canEdit: false, canDelete: false };
  const messageActionHint = renderedActionsTarget ? getMessageActionHint(renderedActionsTarget) : null;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = input.trim();
    if (editingId) {
      if (!body) return;
      chatRepository.editMessage(liveConversation.id, editingId, body);
      setEditingId(undefined);
      setInput('');
      return;
    }
    if (!body && staged.length === 0) return;
    chatRepository.sendMessage(liveConversation.id, { body, replyToId, attachments: staged });
    setInput('');
    setReplyToId(undefined);
    setStaged([]);
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>, kind: ChatAttachment['kind']) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    moderationAttemptRef.current += 1;
    const hasSensitiveName = files.some((file) => /(screen|screenshot|скрин|passport|паспорт|phone|телефон|chat|переписк)/i.test(file.name));
    const sampledForReview = moderationAttemptRef.current % 4 === 0;
    if (hasSensitiveName || sampledForReview) {
      setAttachmentModerationMessage(kind === 'document'
        ? 'ИИ-модератор не смог подтвердить, что документ не содержит персональные данные. Чтобы защитить участников, файл не отправлен. Удалите личные данные или выберите другой документ.'
        : 'ИИ-модератор заметил возможные персональные данные: имя, номер телефона или фрагмент переписки. Вложение не отправлено. Скройте данные или выберите другое изображение.');
      setAttachmentModerationOpen(true);
      setAttachmentMenu(false);
      event.target.value = '';
      return;
    }
    const attachments = files.slice(0, Math.max(0, 6 - staged.length)).map((file) => chatRepository.createLocalAttachment(file, kind));
    setStaged((current) => [...current, ...attachments].slice(0, 6));
    setAttachmentMenu(false);
    event.target.value = '';
  };

  const openActions = (message: ChatMessage) => {
    if (message.kind !== 'user' || message.deletedAt) return;
    setActionsTarget(message);
  };

  const startReply = (message: ChatMessage) => {
    setReplyToId(message.id);
    setEditingId(undefined);
    setActionsTarget(null);
  };

  const jumpToReply = (messageId: number) => {
    const target = document.getElementById(`chat-message-${messageId}`);
    if (!target) return;
    const scroller = target.closest('.chat-message-list');
    const scrollerBounds = scroller?.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const alreadyVisible = Boolean(scrollerBounds && targetBounds.top >= scrollerBounds.top && targetBounds.bottom <= scrollerBounds.bottom);
    let highlighted = false;
    const highlight = () => {
      if (highlighted) return;
      highlighted = true;
      scroller?.removeEventListener('scrollend', highlight);
      target.classList.remove('is-reply-target');
      window.requestAnimationFrame(() => {
        target.classList.add('is-reply-target');
        window.setTimeout(() => target.classList.remove('is-reply-target'), 1000);
      });
    };

    if (!alreadyVisible) scroller?.addEventListener('scrollend', highlight, { once: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (alreadyVisible) highlight();
    else window.setTimeout(highlight, 1800);
  };

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setReplyToId(undefined);
    setStaged([]);
    setInput(message.body ?? '');
    setActionsTarget(null);
  };

  const copyMessage = async (message: ChatMessage) => {
    setActionsTarget(null);
    try {
      await navigator.clipboard.writeText(message.body ?? '');
    } catch {
      onToast('Не удалось скопировать текст');
    }
  };

  const openDeleteConfirmation = (message: ChatMessage) => {
    setActionsTarget(null);
    window.setTimeout(() => setDeletingMessage(message), 430);
  };

  const preserveThreadPosition = () => {
    const position = listRef.current?.scrollTop ?? messageScrollTopRef.current;
    messageScrollTopRef.current = position;
    chatThreadScrollPositions.set(liveConversation.id, position);
  };

  const handleMessageListScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    const position = event.currentTarget.scrollTop;
    messageScrollTopRef.current = position;
    messageDistanceFromBottomRef.current = Math.max(0, event.currentTarget.scrollHeight - event.currentTarget.clientHeight - position);
    chatThreadScrollPositions.set(liveConversation.id, position);
  };

  const deleteMessage = () => {
    if (!deletingMessage) return;
    chatRepository.deleteMessage(liveConversation.id, deletingMessage.id);
    setDeletingMessage(null);
  };

  const confirmRequest = () => {
    if (confirmingRequestId == null) return;
    chatRepository.confirmBooking(liveConversation.id, confirmingRequestId);
    setConfirmingRequestId(null);
  };

  const closeRejectRequest = () => {
    setRejectingRequestId(null);
    setRejectError('');
  };

  const submitRejectRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = rejectReason.trim();
    if (rejectingRequestId == null) return;
    if (!reason) {
      setRejectError('Укажите причину отказа.');
      scrollToValidationAnchor('chat-reject-reason');
      return;
    }
    chatRepository.rejectBooking(liveConversation.id, rejectingRequestId, reason);
    setRejectingRequestId(null);
    setRejectError('');
  };

  const changeRejectReason = (value: string) => {
    setRejectReason(value);
    if (rejectError) setRejectError('');
  };

  return {
    liveConversation,
    messageMap,
    visibleMessages,
    conversationGalleryImages,
    latestBookingEvent,
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
    listRef,
    imageInputRef,
    cameraInputRef,
    videoInputRef,
    documentInputRef,
    setInput,
    setAttachmentMenu,
    setActionsTarget,
    setDeletingMessage,
    setConfirmingRequestId,
    setRejectingRequestId,
    setAttachmentModerationOpen,
    setSafetyVisible,
    setReplyToId,
    submit,
    addFiles,
    openActions,
    startReply,
    jumpToReply,
    startEdit,
    copyMessage,
    openDeleteConfirmation,
    preserveThreadPosition,
    handleMessageListScroll,
    removeAttachment: (attachmentId: string) => setStaged((current) => current.filter((entry) => entry.id !== attachmentId)),
    cancelEdit: () => { setEditingId(undefined); setInput(''); },
    sendQuickReply: (body: string) => chatRepository.sendMessage(liveConversation.id, { body }),
    cancelBooking: (requestId: number) => chatRepository.cancelBooking(liveConversation.id, requestId),
    deleteMessage,
    confirmRequest,
    closeRejectRequest,
    submitRejectRequest,
    changeRejectReason,
  };
}

export type ChatDialogController = ReturnType<typeof useChatDialogController>;
