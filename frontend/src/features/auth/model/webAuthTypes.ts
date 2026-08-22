import type { WebAuthUser } from '@shared/api/webAuth.types';

export type { WebAuthUser } from '@shared/api/webAuth.types';

export type AuthChannel = 'phone' | 'email';

export interface RequestCodeResponse {
  sent: boolean;
  expires_in: number;
  dev_code?: string;
  challenge_id?: string;
  delivery_mode?: 'flash_call' | 'voice';
  code_length?: number;
  retry_after?: number;
  fallback_available?: boolean;
  reused?: boolean;
}

export interface WebSessionResponse {
  status: 'authenticated' | 'onboarding' | 'unauthenticated';
  user: WebAuthUser | null;
}

export interface VerifyCodeResponse {
  status: 'authenticated' | 'onboarding';
  user: WebAuthUser;
}

export interface ProfileSetupPayload {
  name: string;
  surname?: string;
  city: string;
  birthday?: string;
  avatar_url?: string;
}

export interface MediaUploadTarget {
  url: string;
  form_data: Record<string, string>;
  key: string;
}
