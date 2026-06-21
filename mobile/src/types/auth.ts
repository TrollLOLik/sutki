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
