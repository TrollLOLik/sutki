import type { CreateOutgoingRequestInput, RentalRequest, RequestsSnapshot } from '../model/types';

export interface RequestRepository {
  getSnapshot(): RequestsSnapshot;
  subscribe(listener: () => void): () => void;
  refresh?: () => Promise<void>;
  createOutgoing(input: CreateOutgoingRequestInput): Promise<RentalRequest>;
  confirmIncoming(id: number): Promise<void>;
  rejectIncoming(id: number, reason?: string): Promise<void>;
  cancelOutgoing(id: number, reason?: string): Promise<void>;
  syncReview(id: number, status: NonNullable<RentalRequest['reviewStatus']>): void;
  reset(): void;
}
