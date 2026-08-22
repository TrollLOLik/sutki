import { createHttpClient } from '@shared/api';
import { runtimeConfig } from '@shared/config/runtime';
import type { BookingStatusPayload, ChatAttachment, ChatMessage, ChatSnapshot, Conversation, SendMessageInput } from '../model/types';
import type { ChatRepository } from './chatRepository';

export class HttpChatRepository implements ChatRepository {
  private readonly request = createHttpClient({ baseUrl: runtimeConfig.apiBaseUrl });
  private snapshot: ChatSnapshot = { conversations: [] };
  private listeners = new Set<() => void>();
  private nextLocalId = -1;
  private nextAttachmentId = 1;

  constructor() {
    void this.refresh();
  }

  getSnapshot = (): ChatSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(conversations: Conversation[]): void {
    this.snapshot = { conversations };
    this.listeners.forEach((listener) => listener());
  }

  private patchConversation(id: number, updater: (conversation: Conversation) => Conversation): void {
    this.emit(this.snapshot.conversations.map((conversation) => conversation.id === id ? updater(conversation) : conversation));
  }

  refresh = async (): Promise<void> => {
    const payload = await this.request<ChatSnapshot>('/chat/conversations');
    this.emit(payload.conversations);
  };

  markRead(conversationId: number): void {
    this.patchConversation(conversationId, (conversation) => ({ ...conversation, unreadCount: 0 }));
    void this.request(`/chat/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => this.refresh());
  }

  sendMessage(conversationId: number, input: SendMessageInput): number {
    const localId = this.nextLocalId--;
    const optimistic: ChatMessage = {
      id: localId,
      conversationId,
      senderId: 'me',
      kind: 'user',
      body: input.body?.trim() || undefined,
      replyToId: input.replyToId,
      attachments: input.attachments,
      createdAt: new Date().toISOString(),
      delivery: 'sent',
    };
    this.patchConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, optimistic] }));
    void this.request(`/chat/conversations/${conversationId}/messages`, { method: 'POST', body: input }).then(() => this.refresh()).catch(() => this.refresh());
    return localId;
  }

  editMessage(conversationId: number, messageId: number, body: string): void {
    this.patchConversation(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.id === messageId ? { ...message, body, editedAt: new Date().toISOString() } : message) }));
    void this.request(`/chat/conversations/${conversationId}/messages/${messageId}`, { method: 'PATCH', body: { body } }).catch(() => this.refresh());
  }

  deleteMessage(conversationId: number, messageId: number): void {
    this.patchConversation(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.id === messageId ? { ...message, deletedAt: new Date().toISOString(), body: undefined, attachments: undefined } : message) }));
    void this.request(`/chat/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' }).catch(() => this.refresh());
  }

  confirmBooking(_conversationId: number, requestId: number): void {
    void this.request(`/requests/${requestId}/confirm`, { method: 'POST' }).then(() => this.refresh());
  }

  rejectBooking(_conversationId: number, requestId: number, reason: string): void {
    void this.request(`/requests/${requestId}/reject`, { method: 'POST', body: { reason } }).then(() => this.refresh());
  }

  cancelBooking(_conversationId: number, requestId: number): void {
    void this.request(`/requests/${requestId}/cancel`, { method: 'POST' }).then(() => this.refresh());
  }

  createBooking(conversationId: number, payload: Omit<BookingStatusPayload, 'event'>): void {
    void this.request(`/chat/conversations/${conversationId}/bookings`, { method: 'POST', body: payload }).then(() => this.refresh());
  }

  togglePinned(conversationId: number): void {
    this.toggleFlag(conversationId, 'pinned');
  }

  toggleMuted(conversationId: number): void {
    this.toggleFlag(conversationId, 'muted');
  }

  toggleArchived(conversationId: number): void {
    this.toggleFlag(conversationId, 'archived');
  }

  private toggleFlag(conversationId: number, field: 'pinned' | 'muted' | 'archived'): void {
    const conversation = this.snapshot.conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    const value = !conversation[field];
    this.patchConversation(conversationId, (item) => ({ ...item, [field]: value }));
    void this.request(`/chat/conversations/${conversationId}`, { method: 'PATCH', body: { [field]: value } }).catch(() => this.refresh());
  }

  createLocalAttachment(file: File, kind: ChatAttachment['kind']): ChatAttachment {
    return { id: `local-${this.nextAttachmentId++}`, kind, name: file.name, url: URL.createObjectURL(file), sizeLabel: formatBytes(file.size) };
  }

  reset(): void {
    void this.refresh();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
