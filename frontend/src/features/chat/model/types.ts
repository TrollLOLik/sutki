export type ConversationFilter = 'all' | 'unread' | 'bookings' | 'archived';
export type ConversationSort = 'recent' | 'oldest' | 'unread';
export type MessageKind = 'user' | 'booking_status' | 'system';
export type AttachmentKind = 'image' | 'video' | 'document';
export type BookingEvent = 'new' | 'confirmed' | 'rejected' | 'cancelled';

export interface ChatUser {
  id: string;
  name: string;
  surname: string;
  phone?: string;
  avatarUrl?: string;
  online?: boolean;
  lastSeenAt?: string;
  deleted?: boolean;
  verified?: boolean;
  rating?: number;
  reviewsCount?: number;
  city?: string;
  memberSince?: string;
  responseTime?: string;
}

export interface ChatListingContext {
  id: number;
  title: string;
  address: string;
  rooms: number;
  price: number;
  coverUrl?: string;
}

export interface ChatAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  url: string;
  sizeLabel?: string;
}

export interface BookingStatusPayload {
  requestId: number;
  event: BookingEvent;
  startDate: string;
  endDate: string;
  guests: number;
  address?: string;
  reason?: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: 'me' | string | null;
  kind: MessageKind;
  body?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  replyToId?: number;
  attachments?: ChatAttachment[];
  booking?: BookingStatusPayload;
  delivery?: 'pending' | 'sent' | 'read' | 'failed';
}

export interface Conversation {
  id: number;
  otherUser: ChatUser;
  /** Human-readable date shown below the participant name in the dialog header. */
  startedAtLabel?: string;
  listing?: ChatListingContext;
  /** Current user owns the listing and can accept incoming booking requests. */
  isOwner: boolean;
  unreadCount: number;
  archived?: boolean;
  pinned?: boolean;
  muted?: boolean;
  messages: ChatMessage[];
}

export interface ChatSnapshot {
  conversations: Conversation[];
}

export interface SendMessageInput {
  body?: string;
  replyToId?: number;
  attachments?: ChatAttachment[];
}
