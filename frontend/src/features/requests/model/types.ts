export type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'pending_verification'
  | 'confirmed'
  | 'active'
  | 'cancelled'
  | 'completed';

export type RequestDirection = 'incoming' | 'outgoing';
export type RequestListTab = 'current' | 'history';
export type RequestSort = 'newest' | 'oldest' | 'checkin_asc' | 'checkin_desc';

export interface RequestPerson {
  id: number;
  profileId?: string;
  deleted?: boolean;
  name: string;
  surname: string;
  patronymic?: string;
  phone: string;
  avatarUrl?: string;
  verified?: boolean;
  rating?: number;
  reviewsCount?: number;
}

export interface RequestListing {
  id: number;
  title: string;
  address: string;
  city: string;
  price: number;
  coverUrl?: string;
  owner: RequestPerson;
}

export interface RentalRequest {
  id: number;
  direction: RequestDirection;
  listing: RequestListing;
  guest: RequestPerson;
  guests: number;
  message: string;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  rejectionReason?: string;
  cancelledBy?: 'guest' | 'owner';
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  reviewAvailable?: boolean;
  reviewLabel?: string;
  reviewStatus?: 'pending_moderation' | 'active' | 'rejected' | 'moderation_review';
  chatConversationId: number;
}

export interface RequestsSnapshot {
  requests: RentalRequest[];
}

export interface CreateOutgoingRequestInput {
  listing: Omit<RequestListing, 'owner'>;
  guest: Pick<RequestPerson, 'name' | 'phone'>;
  guests: number;
  message: string;
  startDate: string;
  endDate: string;
}
