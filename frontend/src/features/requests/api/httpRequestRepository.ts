import { createHttpClient } from '@shared/api';
import { runtimeConfig } from '@shared/config/runtime';
import type { CreateOutgoingRequestInput, RentalRequest, RequestsSnapshot } from '../model/types';
import type { RequestRepository } from './requestRepository';

export class HttpRequestRepository implements RequestRepository {
  private readonly request = createHttpClient({ baseUrl: runtimeConfig.apiBaseUrl });
  private snapshot: RequestsSnapshot = { requests: [] };
  private listeners = new Set<() => void>();

  constructor() {
    void this.refresh();
  }

  getSnapshot = (): RequestsSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(requests: RentalRequest[]): void {
    this.snapshot = { requests };
    this.listeners.forEach((listener) => listener());
  }

  refresh = async (): Promise<void> => {
    const payload = await this.request<RequestsSnapshot | RentalRequest[]>('/requests');
    this.emit(Array.isArray(payload) ? payload : payload.requests);
  };

  async createOutgoing(input: CreateOutgoingRequestInput): Promise<RentalRequest> {
    const created = await this.request<RentalRequest>('/requests', { method: 'POST', body: input });
    await this.refresh();
    return created;
  }

  async confirmIncoming(id: number): Promise<void> {
    await this.request(`/requests/${id}/confirm`, { method: 'POST' });
    await this.refresh();
  }

  async rejectIncoming(id: number, reason?: string): Promise<void> {
    await this.request(`/requests/${id}/reject`, { method: 'POST', body: { reason } });
    await this.refresh();
  }

  async cancelOutgoing(id: number, reason?: string): Promise<void> {
    await this.request(`/requests/${id}/cancel`, { method: 'POST', body: { reason } });
    await this.refresh();
  }

  syncReview(id: number, status: NonNullable<RentalRequest['reviewStatus']>): void {
    this.emit(this.snapshot.requests.map((request) => request.id === id ? {
      ...request,
      reviewStatus: status,
      reviewAvailable: status === 'rejected' || status === 'moderation_review',
      reviewLabel: status === 'rejected' || status === 'moderation_review' ? 'Изменить отзыв' : undefined,
    } : request));
  }

  reset(): void {
    void this.refresh();
  }
}
