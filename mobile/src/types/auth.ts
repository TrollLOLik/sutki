/**
 * Auth DTOs mirror the backend wire format (snake_case kept 1:1). See
 * backend/internal/delivery/http/auth_handler.go.
 */
import type { User } from '@/types/user';

/** Response of POST /api/v1/auth/email/verify, /auth/refresh. */
export interface AuthResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  /** Access token lifetime, in seconds. */
  expires_in: number;
  user: User;
}

/**
 * Response of POST /api/v1/auth/email/request. `dev_code` is only present when
 * the backend runs with AUTH_EXPOSE_CODE=true (dev, no SMTP) — used to prefill
 * the code screen for local testing.
 */
export interface RequestCodeResponse {
  sent: boolean;
  /** Code lifetime, in seconds. */
  expires_in: number;
  dev_code?: string;
	challenge_id?: string;
	delivery_mode?: 'flash_call' | 'voice';
	code_length?: number;
	retry_after?: number;
	fallback_available?: boolean;
	reused?: boolean;
}

/**
 * What a re-authentication proof authorizes. The backend scopes each proof, so
 * one minted to change the email is refused when presented for the phone.
 */
export type ReauthPurpose = 'change_phone' | 'change_email';

/**
 * Response of POST /api/v1/me/reauth/request.
 *
 * Re-authentication proves the user still controls a factor already on the
 * account, and is required before any phone/email change. The backend chooses
 * the factor — a verified phone wins over email — so the client must branch on
 * `factor` rather than assume. Phone challenges carry the same delivery fields
 * as a login challenge.
 */
export interface ReauthChallengeResponse extends RequestCodeResponse {
  factor: 'phone' | 'email';
}

/** Partial profile update body for PATCH /api/v1/me. */
export interface UpdateProfileBody {
  name?: string;
  surname?: string;
  patronymic?: string;
  phone?: string;
  city?: string;
  birthday?: string;
  avatar_url?: string;
  vk_id?: string;
  vk_id_do_null?: boolean;
}
