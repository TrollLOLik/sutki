export type ReviewStatus = 'pending_moderation' | 'active' | 'rejected' | 'moderation_review' | 'deleted';
export type ReviewSort = 'newest' | 'oldest' | 'rating_desc' | 'rating_asc';

export interface ReviewReply {
  id: number;
  body: string;
  status: ReviewStatus;
  rejectionReason?: string;
  createdAt: string;
}

export interface ReviewListing {
  id: number;
  title: string;
  address: string;
  city: string;
  coverUrl?: string;
  ownerId: string;
}

export interface Review {
  id: number;
  requestId?: number;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  status: ReviewStatus;
  rejectionReason?: string;
  editAttempts: number;
  maxAttempts: number;
  listing: ReviewListing;
  writtenByMe: boolean;
  receivedByMe: boolean;
  reply?: ReviewReply;
}

export interface ReviewsSnapshot {
  reviews: Review[];
}

export interface SubmitReviewInput {
  requestId: number;
  rating: number;
  body: string;
  listing: ReviewListing;
}
