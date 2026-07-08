import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Booking, BookingsPage, CreateBookingBody } from '@/types/booking';

export interface ListBookingsParams {
  limit?: number;
  offset?: number;
  /** Filters "my requests": 'active' (pending/upcoming) or 'history' (terminal). */
  scope?: 'active' | 'history';
}

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (params: ListBookingsParams) => [...bookingKeys.all, 'list', params] as const,
  incoming: (params: ListBookingsParams) => [...bookingKeys.all, 'incoming', params] as const,
  detail: (id: number) => [...bookingKeys.all, 'detail', id] as const,
};

function buildQuery(params: ListBookingsParams): string {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  if (params.scope != null) sp.set('scope', params.scope);
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Create a booking request for a listing (POST /api/v1/listings/{id}/requests). */
export function createBooking(listingId: number, body: CreateBookingBody): Promise<Booking> {
  return api.post<Booking>(`/api/v1/listings/${listingId}/requests`, body);
}

/** A confirmed (occupied) date range on a listing. end_date is null for one night. */
export interface BookedRange {
  start_date: string;
  end_date: string | null;
  status: string;
}

interface AvailabilityResponse {
  ranges: BookedRange[];
}

/** Confirmed occupied ranges for a listing, used to block taken dates. Public. */
export function fetchListingAvailability(listingId: number): Promise<AvailabilityResponse> {
  return api.get<AvailabilityResponse>(`/api/v1/listings/${listingId}/availability`, {
    auth: false,
  });
}

export function useListingAvailability(listingId: number | undefined) {
  return useQuery({
    queryKey: [...bookingKeys.all, 'availability', listingId ?? 0] as const,
    queryFn: () => fetchListingAvailability(listingId as number),
    enabled: listingId != null && listingId > 0,
    staleTime: 1000 * 60,
  });
}

/** My bookings as a tenant. */
export function fetchMyBookings(params: ListBookingsParams = {}): Promise<BookingsPage> {
  return api.get<BookingsPage>(`/api/v1/requests${buildQuery(params)}`);
}

/** Incoming bookings on listings I own. */
export function fetchIncomingBookings(params: ListBookingsParams = {}): Promise<BookingsPage> {
  return api.get<BookingsPage>(`/api/v1/requests/incoming${buildQuery(params)}`);
}

export function fetchBooking(id: number): Promise<Booking> {
  return api.get<Booking>(`/api/v1/requests/${id}`);
}

/** Tenant cancels their own pending booking. */
export function cancelBooking(id: number): Promise<Booking> {
  return api.post<Booking>(`/api/v1/requests/${id}/cancel`);
}

/** Owner confirms a pending booking on their listing. */
export function confirmBooking(id: number): Promise<Booking> {
  return api.post<Booking>(`/api/v1/requests/${id}/confirm`);
}

/** Owner rejects a pending booking; reason is optional. */
export function rejectBooking(id: number, reason?: string): Promise<Booking> {
  const trimmed = reason?.trim();
  return api.post<Booking>(`/api/v1/requests/${id}/reject`, trimmed ? { reason: trimmed } : undefined);
}

export function useMyBookings(
  params: ListBookingsParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: () => fetchMyBookings(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useIncomingBookings(params: ListBookingsParams = {}) {
  return useQuery({
    queryKey: bookingKeys.incoming(params),
    queryFn: () => fetchIncomingBookings(params),
    placeholderData: keepPreviousData,
  });
}

export function useBooking(id: number | undefined) {
  return useQuery({
    queryKey: bookingKeys.detail(id ?? 0),
    queryFn: () => fetchBooking(id as number),
    enabled: id != null && id > 0,
  });
}

export function useCreateBooking(listingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBookingBody) => createBooking(listingId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelBooking(id),
    onSuccess: (booking) => {
      qc.setQueryData(bookingKeys.detail(booking.id), booking);
      qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => confirmBooking(id),
    onSuccess: (booking) => {
      patchDetail(qc, booking);
      qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

export function useRejectBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => rejectBooking(id, reason),
    onSuccess: (booking) => {
      patchDetail(qc, booking);
      qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

/**
 * Update the cached detail after a status transition. The confirm/reject/cancel
 * responses omit the house summary (only GET /requests/{id} joins it), so keep
 * the previously cached house instead of dropping it from the open screen.
 */
function patchDetail(qc: ReturnType<typeof useQueryClient>, booking: Booking) {
  qc.setQueryData<Booking>(bookingKeys.detail(booking.id), (prev) =>
    prev ? { ...booking, house: booking.house ?? prev.house } : booking,
  );
}
