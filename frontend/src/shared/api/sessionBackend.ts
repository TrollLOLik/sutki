import { runtimeConfig } from '../config/runtime';

export type BookingEventStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface BookingSessionEvent {
  source: 'chat' | 'requests';
  requestId: number;
  conversationId: number;
  status: BookingEventStatus;
  startDate: string;
  endDate: string;
  guests: number;
  reason?: string;
  isOwner?: boolean;
  listing?: {
    id: number;
    title: string;
    address: string;
    price: number;
    coverUrl?: string;
  };
  counterparty?: {
    id: number;
    name: string;
    surname: string;
    phone?: string;
    avatarUrl?: string;
    verified?: boolean;
    rating?: number;
    reviewsCount?: number;
  };
}

export interface ListingSessionEvent {
  source: 'my-listings';
  listingId: number;
  action: 'created' | 'updated' | 'promoted' | 'published' | 'unpublished';
}

export interface ReviewSessionEvent {
  source: 'reviews';
  reviewId: number;
  action: 'submitted' | 'updated' | 'replied';
}

interface SessionEvents {
  'booking:status': BookingSessionEvent;
  'listing:changed': ListingSessionEvent;
  'review:changed': ReviewSessionEvent;
  'session:reset': { source?: string };
}

type Listener<K extends keyof SessionEvents> = (payload: SessionEvents[K]) => void;

class SessionEventBus {
  private listeners = new Map<keyof SessionEvents, Set<(payload: never) => void>>();

  emit<K extends keyof SessionEvents>(event: K, payload: SessionEvents[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload as never));
  }

  subscribe<K extends keyof SessionEvents>(event: K, listener: Listener<K>): () => void {
    const bucket = this.listeners.get(event) ?? new Set();
    bucket.add(listener as (payload: never) => void);
    this.listeners.set(event, bucket);
    return () => bucket.delete(listener as (payload: never) => void);
  }
}

export const sessionEvents = new SessionEventBus();

export function mockDelay(ms = runtimeConfig.mockLatencyMs): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
