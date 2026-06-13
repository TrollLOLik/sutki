import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { AuthResponse, RequestCodeResponse, UpdateProfileBody } from '@/types/auth';
import type { User } from '@/types/user';

/**
 * Auth endpoints are unauthenticated (no Bearer header) — `{ auth: false }`.
 * The /me endpoints rely on the Authorization header attached by the client.
 */

/** Request a 6-digit login code for an email (no SMTP yet — see dev_code). */
export function requestEmailCode(email: string): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/auth/email/request', { email }, { auth: false });
}

/** Verify a login code → issue access/refresh tokens + user. */
export function verifyEmailCode(email: string, code: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/v1/auth/email/verify', { email, code }, { auth: false });
}

/** Rotate a refresh token → new token pair (old token is revoked server-side). */
export function refreshTokens(refreshToken: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/v1/auth/refresh', { refresh_token: refreshToken }, { auth: false });
}

/** Revoke a refresh token (best-effort on sign-out). */
export function logout(refreshToken: string): Promise<void> {
  return api.post<void>('/api/v1/auth/logout', { refresh_token: refreshToken }, { auth: false });
}

/** Current authenticated user. */
export function fetchMe(): Promise<User> {
  return api.get<User>('/api/v1/me');
}

/** Partial update of the current user's profile (omitted fields unchanged). */
export function updateMe(body: UpdateProfileBody): Promise<User> {
  return api.patch<User>('/api/v1/me', body);
}

export function useRequestEmailCode() {
  return useMutation({ mutationFn: (email: string) => requestEmailCode(email) });
}

export function useVerifyEmailCode() {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => verifyEmailCode(email, code),
  });
}

export function useUpdateMe() {
  return useMutation({ mutationFn: (body: UpdateProfileBody) => updateMe(body) });
}
