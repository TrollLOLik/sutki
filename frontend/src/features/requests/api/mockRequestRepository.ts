import type { RequestRepository } from './requestRepository';
import { requestSeed } from './seed';
import type { CreateOutgoingRequestInput, RentalRequest, RequestsSnapshot, RequestStatus } from '../model/types';
import { mockDelay, sessionEvents, type BookingSessionEvent } from '@shared/api';

const demoRequestSeed: RentalRequest[] = [
  ...requestSeed,
  ...requestSeed.slice(0, 10).map((item, index) => ({
    ...item,
    id: 10001 + index,
    createdAt: `2026-07-${String(18 - index).padStart(2, '0')}T10:00:00+05:00`,
    updatedAt: `2026-07-${String(18 - index).padStart(2, '0')}T10:00:00+05:00`,
  })),
];

const cloneSeed = (): RentalRequest[] => demoRequestSeed.map((item) => ({
  ...item,
  listing: { ...item.listing, owner: { ...item.listing.owner } },
  guest: { ...item.guest },
}));

let requests = cloneSeed();
let snapshot: RequestsSnapshot = { requests };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function update(id: number, updater: (request: RentalRequest) => RentalRequest): RentalRequest {
  let updated: RentalRequest | null = null;
  requests = requests.map((request) => {
    if (request.id !== id) return request;
    updated = updater(request);
    return updated;
  });
  if (!updated) throw new Error('Заявка не найдена');
  snapshot = { requests };
  notify();
  return updated;
}

function toSessionStatus(status: RequestStatus): BookingSessionEvent['status'] {
  if (status === 'confirmed' || status === 'active' || status === 'completed') return 'confirmed';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

function publish(request: RentalRequest, reason?: string): void {
  const counterparty = request.direction === 'incoming' ? request.guest : request.listing.owner;
  sessionEvents.emit('booking:status', {
    source: 'requests',
    requestId: request.id,
    conversationId: request.chatConversationId,
    status: request.cancelledBy === 'owner' ? 'rejected' : toSessionStatus(request.status),
    startDate: request.startDate,
    endDate: request.endDate,
    guests: request.guests,
    reason: reason ?? request.rejectionReason,
    isOwner: request.direction === 'incoming',
    listing: {
      id: request.listing.id,
      title: request.listing.title,
      address: request.listing.address,
      price: request.listing.price,
      coverUrl: request.listing.coverUrl,
    },
    counterparty: { ...counterparty },
  });
}

function applyExternalEvent(event: BookingSessionEvent): void {
  if (event.source === 'requests') return;
  const existing = requests.find((request) => request.id === event.requestId);
  if (!existing) return;
  update(event.requestId, (request) => {
    const now = new Date().toISOString();
    if (event.status === 'confirmed') {
      return { ...request, status: 'confirmed', confirmedAt: now, updatedAt: now, rejectionReason: undefined, cancelledBy: undefined };
    }
    if (event.status === 'rejected') {
      return { ...request, status: 'cancelled', updatedAt: now, cancelledBy: 'owner', rejectionReason: event.reason || 'Владелец отклонил заявку.' };
    }
    if (event.status === 'cancelled') {
      return { ...request, status: 'cancelled', updatedAt: now, cancelledBy: request.direction === 'outgoing' ? 'guest' : 'owner', rejectionReason: event.reason };
    }
    return { ...request, status: 'in_progress', updatedAt: now };
  });
}

sessionEvents.subscribe('booking:status', applyExternalEvent);
sessionEvents.subscribe('session:reset', ({ source }) => {
  if (source === 'requests') return;
  requests = cloneSeed();
  snapshot = { requests };
  notify();
});

function buildOutgoingRequest(input: CreateOutgoingRequestInput): RentalRequest {
  const matchingRequest = requests.find((request) => (
    request.direction === 'outgoing' && request.listing.id === input.listing.id
  ));
  const fallbackRequest = requests.find((request) => request.direction === 'outgoing');
  const owner = matchingRequest?.listing.owner ?? fallbackRequest?.listing.owner;
  if (!owner) throw new Error('Не удалось определить владельца объявления');

  const now = new Date().toISOString();
  return {
    id: Math.max(0, ...requests.map((request) => request.id)) + 1,
    direction: 'outgoing',
    listing: { ...input.listing, owner: { ...owner } },
    guest: {
      id: Date.now(),
      name: input.guest.name,
      surname: '',
      phone: input.guest.phone,
    },
    guests: input.guests,
    message: input.message,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    chatConversationId: matchingRequest?.chatConversationId ?? (10_000 + input.listing.id),
  };
}

export const mockRequestRepository: RequestRepository = {
  getSnapshot(): RequestsSnapshot {
    return snapshot;
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async createOutgoing(input) {
    await mockDelay();
    const created = buildOutgoingRequest(input);
    requests = [created, ...requests];
    snapshot = { requests };
    notify();
    publish(created);
    return created;
  },
  async confirmIncoming(id) {
    await mockDelay();
    const updated = update(id, (request) => {
      if (request.direction !== 'incoming' || !['pending', 'in_progress'].includes(request.status)) throw new Error('Заявка уже обработана');
      const now = new Date().toISOString();
      return { ...request, status: 'confirmed', confirmedAt: now, updatedAt: now, rejectionReason: undefined, cancelledBy: undefined };
    });
    publish(updated);
  },
  async rejectIncoming(id, reason) {
    await mockDelay();
    const updated = update(id, (request) => {
      if (request.direction !== 'incoming' || !['pending', 'in_progress'].includes(request.status)) throw new Error('Заявка уже обработана');
      const now = new Date().toISOString();
      return { ...request, status: 'cancelled', rejectionReason: reason?.trim() || 'Владелец отклонил заявку.', cancelledBy: 'owner', updatedAt: now };
    });
    publish(updated, updated.rejectionReason);
  },
  async cancelOutgoing(id, reason) {
    await mockDelay();
    const updated = update(id, (request) => {
      if (request.direction !== 'outgoing' || !['pending', 'in_progress', 'pending_verification'].includes(request.status)) throw new Error('Эту заявку уже нельзя отменить');
      const now = new Date().toISOString();
      return { ...request, status: 'cancelled', cancelledBy: 'guest', rejectionReason: reason?.trim() || 'Пользователь отменил заявку.', updatedAt: now };
    });
    publish(updated);
  },
  syncReview(id, status) {
    update(id, (request) => ({
      ...request,
      reviewStatus: status,
      reviewAvailable: status === 'rejected' || status === 'moderation_review',
      reviewLabel: status === 'rejected' || status === 'moderation_review' ? 'Изменить отзыв' : undefined,
    }));
  },
  reset() {
    requests = cloneSeed();
    snapshot = { requests };
    notify();
    sessionEvents.emit('session:reset', { source: 'requests' });
  },
};
