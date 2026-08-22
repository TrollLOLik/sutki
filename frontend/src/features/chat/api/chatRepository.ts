import type { BookingStatusPayload, ChatAttachment, ChatSnapshot, SendMessageInput } from '../model/types';

export interface ChatRepository {
  getSnapshot(): ChatSnapshot;
  subscribe(listener: () => void): () => void;
  refresh?: () => Promise<void>;
  markRead(conversationId: number): void;
  sendMessage(conversationId: number, input: SendMessageInput): number;
  editMessage(conversationId: number, messageId: number, body: string): void;
  deleteMessage(conversationId: number, messageId: number): void;
  confirmBooking(conversationId: number, requestId: number): void;
  rejectBooking(conversationId: number, requestId: number, reason: string): void;
  cancelBooking(conversationId: number, requestId: number): void;
  createBooking(conversationId: number, payload: Omit<BookingStatusPayload, 'event'>): void;
  togglePinned(conversationId: number): void;
  toggleMuted(conversationId: number): void;
  toggleArchived(conversationId: number): void;
  createLocalAttachment(file: File, kind: ChatAttachment['kind']): ChatAttachment;
  reset(): void;
}
