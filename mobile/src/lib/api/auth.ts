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

/** Delete the current user's account (used when aborting onboarding). */
export function deleteMe(): Promise<void> {
  return api.delete<void>('/api/v1/me');
}

export function useDeleteMe() {
  return useMutation({ mutationFn: deleteMe });
}

/** Request a code for the current email to verify ownership before change. */
export function requestOldEmailCode(): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/change-email/request-old');
}

/** Verify ownership of the current email. Returns a temp token. */
export function verifyOldEmailCode(code: string): Promise<{ temp_token: string }> {
  return api.post<{ temp_token: string }>('/api/v1/me/change-email/verify-old', { code });
}

/** Request a code for the new email. Takes the temp token. */
export function requestNewEmailCode(tempToken: string, newEmail: string): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/change-email/request-new', {
    temp_token: tempToken,
    new_email: newEmail,
  });
}

/** Confirm the email change with the code sent to the new email. Returns the updated User. */
export function confirmEmailChange(newEmail: string, code: string): Promise<User> {
  return api.post<User>('/api/v1/me/change-email/confirm', { new_email: newEmail, code });
}

export function useRequestOldEmailCode() {
  return useMutation({ mutationFn: requestOldEmailCode });
}

export function useVerifyOldEmailCode() {
  return useMutation({
    mutationFn: (code: string) => verifyOldEmailCode(code),
  });
}

export function useRequestNewEmailCode() {
  return useMutation({
    mutationFn: ({ tempToken, newEmail }: { tempToken: string; newEmail: string }) =>
      requestNewEmailCode(tempToken, newEmail),
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: ({ newEmail, code }: { newEmail: string; code: string }) =>
      confirmEmailChange(newEmail, code),
  });
}

/** Check if the current user has any active bookings blocking account deletion. */
export function checkDeleteMe(): Promise<{ has_active_bookings: boolean }> {
  return api.get<{ has_active_bookings: boolean }>('/api/v1/me/delete/check');
}

/** Request a 6-digit confirmation code to be sent to the user's email for deletion verification. */
export function requestDeleteMeCode(): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/delete/request');
}

/** Confirm account deletion with the 6-digit code. */
export function confirmDeleteMe(code: string): Promise<void> {
  return api.post<void>('/api/v1/me/delete/confirm', { code });
}

export function useCheckDeleteMe() {
  return useMutation({ mutationFn: checkDeleteMe });
}

export function useRequestDeleteMeCode() {
  return useMutation({ mutationFn: requestDeleteMeCode });
}

export function useConfirmDeleteMe() {
  return useMutation({ mutationFn: (code: string) => confirmDeleteMe(code) });
}


