import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CheckoutResult } from '@/lib/api/payments';

export interface ListingPromotion {
  id: number; house_id: number; payment_id: number | null;
  type: 'boost' | 'highlight';
  status: 'pending_payment'|'active'|'paused'|'expired'|'payment_failed'|'cancelled';
  duration_seconds: number; remaining_seconds: number;
  starts_at: string|null; expires_at: string|null; pause_reason?: string;
}
export function useListingPromotions(houseId:number){return useQuery({queryKey:['listing-promotions',houseId],queryFn:()=>api.get<{items:ListingPromotion[]}>(`/api/v1/listings/${houseId}/promotions`)})}
export function usePromotionCheckout(houseId:number){return useMutation({mutationFn:({productCode,idempotencyKey}:{productCode:string;idempotencyKey:string})=>api.post<{promotion:ListingPromotion;payment:CheckoutResult}>(`/api/v1/listings/${houseId}/promotions/checkout`,{product_code:productCode},{headers:{'Idempotency-Key':idempotencyKey}})})}
