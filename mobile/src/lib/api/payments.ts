import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export interface PaymentProduct {
  code: string;
  title: string;
  purpose: string;
  amount_kopecks: number;
  currency: string;
  service_type?: 'boost' | 'highlight';
  duration_seconds?: number;
}

export interface CheckoutResult {
  payment_id: number;
  status: string;
  confirmation_url: string;
  provider: 'mock' | 'yookassa';
}

export interface PaymentStatus {
  id: number;
  purpose: string;
  product_code: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount_kopecks: number;
  currency: string;
  confirmation_url: string;
  created_at: string;
  paid_at: string | null;
}

export function usePaymentProducts() {
  return useQuery({
    queryKey: ['payment-products'],
    queryFn: () => api.get<{ items: PaymentProduct[] }>('/api/v1/payment-products', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({ productCode, idempotencyKey }: { productCode: string; idempotencyKey: string }) =>
      api.post<CheckoutResult>(
        '/api/v1/payments/checkout',
        { product_code: productCode },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
  });
}

export function usePaymentStatus(paymentId: number | null) {
  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api.get<PaymentStatus>(`/api/v1/payments/${paymentId}`),
    enabled: paymentId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'succeeded' || status === 'canceled' ? false : 2_000;
    },
  });
}

export function confirmMockPayment(paymentId: number) {
  return api.post<{ status: string }>(`/api/v1/payments/${paymentId}/mock-confirm`);
}
