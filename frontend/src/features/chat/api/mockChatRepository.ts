import type { ChatRepository } from './chatRepository';
import { createSeedSnapshot } from './seed';
import type { BookingStatusPayload, ChatAttachment, ChatMessage, ChatSnapshot, Conversation, SendMessageInput } from '../model/types';
import { sessionEvents, type BookingSessionEvent } from '@shared/api';

function latestTimestamp(conversation: Conversation): number {
  const last = conversation.messages[conversation.messages.length - 1];
  return last ? new Date(last.createdAt).getTime() : 0;
}

function cloneSnapshot(): ChatSnapshot {
  const seed = createSeedSnapshot();
  return {
    conversations: seed.conversations.map((conversation) => ({
      ...conversation,
      otherUser: { ...conversation.otherUser },
      listing: conversation.listing ? { ...conversation.listing } : undefined,
      messages: conversation.messages.map((message) => ({
        ...message,
        attachments: message.attachments?.map((attachment) => ({ ...attachment })),
        booking: message.booking ? { ...message.booking } : undefined,
      })),
    })),
  };
}

function toChatBookingEvent(status: BookingSessionEvent['status']): BookingStatusPayload['event'] {
  if (status === 'pending') return 'new';
  return status;
}

export class MockChatRepository implements ChatRepository {
  private snapshot: ChatSnapshot = cloneSnapshot();
  private listeners = new Set<() => void>();
  private nextMessageId = 90_000;
  private nextAttachmentId = 1;
  private nextRequestId = 10_000;

  constructor() {
    sessionEvents.subscribe('booking:status', (event) => {
      if (event.source === 'chat') return;
      this.appendExternalBookingEvent(event);
    });
    sessionEvents.subscribe('session:reset', ({ source }) => {
      if (source === 'chat') return;
      this.reset(false);
    });
  }

  getSnapshot = (): ChatSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(nextConversations: Conversation[]) {
    this.snapshot = {
      conversations: [...nextConversations].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return latestTimestamp(b) - latestTimestamp(a);
      }),
    };
    this.listeners.forEach((listener) => listener());
  }

  private updateConversation(conversationId: number, updater: (conversation: Conversation) => Conversation) {
    this.emit(this.snapshot.conversations.map((conversation) => (
      conversation.id === conversationId ? updater(conversation) : conversation
    )));
  }

  private findBooking(conversationId: number, requestId: number): BookingStatusPayload | undefined {
    const conversation = this.snapshot.conversations.find((item) => item.id === conversationId);
    return [...(conversation?.messages ?? [])].reverse().find((item) => item.booking?.requestId === requestId)?.booking;
  }

  private appendBookingPayload(conversationId: number, booking: BookingStatusPayload): void {
    this.updateConversation(conversationId, (conversation) => {
      const latest = [...conversation.messages].reverse().find((item) => item.booking?.requestId === booking.requestId)?.booking;
      if (latest?.event === booking.event && latest.reason === booking.reason) return conversation;
      const message: ChatMessage = {
        id: this.nextMessageId++,
        conversationId,
        senderId: null,
        kind: 'booking_status',
        createdAt: new Date().toISOString(),
        booking,
      };
      return { ...conversation, archived: false, messages: [...conversation.messages, message] };
    });
  }

  private appendExternalBookingEvent(event: BookingSessionEvent): void {
    if (!this.snapshot.conversations.some((conversation) => conversation.id === event.conversationId) && event.listing && event.counterparty) {
      const conversation: Conversation = {
        id: event.conversationId,
        otherUser: {
          id: String(event.counterparty.id),
          name: event.counterparty.name,
          surname: event.counterparty.surname,
          phone: event.counterparty.phone,
          avatarUrl: event.counterparty.avatarUrl,
          verified: event.counterparty.verified,
          rating: event.counterparty.rating,
          reviewsCount: event.counterparty.reviewsCount,
        },
        listing: {
          id: event.listing.id,
          title: event.listing.title,
          address: event.listing.address,
          rooms: 1,
          price: event.listing.price,
          coverUrl: event.listing.coverUrl,
        },
        isOwner: Boolean(event.isOwner),
        unreadCount: 0,
        messages: [],
      };
      this.emit([conversation, ...this.snapshot.conversations]);
    }
    const previous = this.findBooking(event.conversationId, event.requestId);
    this.appendBookingPayload(event.conversationId, {
      requestId: event.requestId,
      event: toChatBookingEvent(event.status),
      startDate: previous?.startDate ?? event.startDate,
      endDate: previous?.endDate ?? event.endDate,
      guests: previous?.guests ?? event.guests,
      address: previous?.address ?? event.listing?.address,
      reason: event.reason,
    });
  }

  private publishBooking(conversationId: number, booking: BookingStatusPayload): void {
    sessionEvents.emit('booking:status', {
      source: 'chat',
      requestId: booking.requestId,
      conversationId,
      status: booking.event === 'new' ? 'pending' : booking.event,
      startDate: booking.startDate,
      endDate: booking.endDate,
      guests: booking.guests,
      reason: booking.reason,
    });
  }

  markRead(conversationId: number) {
    this.updateConversation(conversationId, (conversation) => (
      conversation.unreadCount === 0 ? conversation : { ...conversation, unreadCount: 0 }
    ));
  }

  sendMessage(conversationId: number, input: SendMessageInput): number {
    const id = this.nextMessageId++;
    const outgoing: ChatMessage = {
      id,
      conversationId,
      senderId: 'me',
      kind: 'user',
      body: input.body?.trim() || undefined,
      replyToId: input.replyToId,
      attachments: input.attachments?.length ? input.attachments : undefined,
      createdAt: new Date().toISOString(),
      delivery: 'sent',
    };
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      archived: false,
      messages: [...conversation.messages, outgoing],
    }));

    // Tiny mock-server behaviour: one demo conversation answers automatically.
    if (conversationId === 103 && input.body?.trim()) {
      window.setTimeout(() => {
        const incoming: ChatMessage = {
          id: this.nextMessageId++,
          conversationId,
          senderId: 'elena',
          kind: 'user',
          body: 'Спасибо за сообщение! Отвечу подробнее в ближайшее время.',
          createdAt: new Date().toISOString(),
          delivery: 'sent',
        };
        this.updateConversation(conversationId, (conversation) => ({
          ...conversation,
          unreadCount: document.visibilityState === 'visible' ? 0 : conversation.unreadCount + 1,
          messages: [...conversation.messages, incoming],
        }));
      }, 1200);
    }
    return id;
  }

  editMessage(conversationId: number, messageId: number, body: string) {
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((item) => item.id === messageId
        ? { ...item, body: body.trim(), editedAt: new Date().toISOString() }
        : item),
    }));
  }

  deleteMessage(conversationId: number, messageId: number) {
    this.updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((item) => item.id === messageId
        ? { ...item, body: undefined, attachments: undefined, deletedAt: new Date().toISOString() }
        : item),
    }));
  }

  private appendBookingEvent(conversationId: number, requestId: number, event: BookingStatusPayload['event'], reason?: string) {
    const conversation = this.snapshot.conversations.find((item) => item.id === conversationId);
    const previous = this.findBooking(conversationId, requestId);
    if (!previous) return;
    const booking: BookingStatusPayload = {
      ...previous,
      event,
      reason,
      address: event === 'confirmed' ? (conversation?.listing ? `Казань, ${conversation.listing.address}, кв. 17` : previous.address) : previous.address,
    };
    this.appendBookingPayload(conversationId, booking);
    this.publishBooking(conversationId, booking);
  }

  confirmBooking(conversationId: number, requestId: number) {
    this.appendBookingEvent(conversationId, requestId, 'confirmed');
  }

  rejectBooking(conversationId: number, requestId: number, reason: string) {
    this.appendBookingEvent(conversationId, requestId, 'rejected', reason.trim() || 'Даты недоступны.');
  }

  cancelBooking(conversationId: number, requestId: number) {
    this.appendBookingEvent(conversationId, requestId, 'cancelled');
  }

  createBooking(conversationId: number, payload: Omit<BookingStatusPayload, 'event'>) {
    const booking: BookingStatusPayload = {
      ...payload,
      requestId: payload.requestId || this.nextRequestId++,
      event: 'new',
    };
    this.appendBookingPayload(conversationId, booking);
    this.publishBooking(conversationId, booking);
  }

  togglePinned(conversationId: number) {
    this.updateConversation(conversationId, (conversation) => ({ ...conversation, pinned: !conversation.pinned }));
  }

  toggleMuted(conversationId: number) {
    this.updateConversation(conversationId, (conversation) => ({ ...conversation, muted: !conversation.muted }));
  }

  toggleArchived(conversationId: number) {
    this.updateConversation(conversationId, (conversation) => ({ ...conversation, archived: !conversation.archived }));
  }

  createLocalAttachment(file: File, kind: ChatAttachment['kind']): ChatAttachment {
    return {
      id: `local-${this.nextAttachmentId++}`,
      kind,
      name: file.name,
      url: URL.createObjectURL(file),
      sizeLabel: formatBytes(file.size),
    };
  }

  reset(publish = true): void {
    this.snapshot = cloneSnapshot();
    this.nextMessageId = 90_000;
    this.nextAttachmentId = 1;
    this.nextRequestId = 10_000;
    this.listeners.forEach((listener) => listener());
    if (publish) sessionEvents.emit('session:reset', { source: 'chat' });
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
