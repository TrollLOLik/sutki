import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Booking, BookingsPage, CreateBookingBody } from '@/types/booking';

export interface ListBookingsParams {
  limit?: number;
  offset?: number;
}

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (params: ListBookingsParams) => [...bookingKeys.all, 'list', params] as const,
  detail: (id: number) => [...bookingKeys.all, 'detail', id] as const,
};

function buildQuery(params: ListBookingsParams): string {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Create a booking request for a listing (POST /api/v1/listings/{id}/requests). */
export function createBooking(listingId: number, body: CreateBookingBody): Promise<Booking> {
  return api.post<Booking>(`/api/v1/listings/${listingId}/requests`, body);
}

/** My bookings as a tenant. */
export function fetchMyBookings(params: ListBookingsParams = {}): Promise<BookingsPage> {
  return api.get<BookingsPage>(`/api/v1/requests${buildQuery(params)}`);
}

export function fetchBooking(id: number): Promise<Booking> {
  return api.get<Booking>(`/api/v1/requests/${id}`);
}

/** Tenant cancels their own pending booking. */
export function cancelBooking(id: number): Promise<Booking> {
  return api.post<Booking>(`/api/v1/requests/${id}/cancel`);
}

export function useMyBookings(params: ListBookingsParams = {}) {
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: () => fetchMyBookings(params),
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
