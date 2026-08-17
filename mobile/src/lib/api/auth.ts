import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api/client';
import type {
  AuthResponse,
  ReauthChallengeResponse,
  ReauthPurpose,
  RequestCodeResponse,
  UpdateProfileBody,
} from '@/types/auth';
import type { User } from '@/types/user';

/**
 * Auth endpoints are unauthenticated (no Bearer header) — `{ auth: false }`.
 * The /me endpoints rely on the Authorization header attached by the client.
 */

/** Request a 6-digit login code for an email (no SMTP yet — see dev_code). */
export function requestEmailCode(email: string, accepted = false): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/auth/email/request', {
    email,
    accept_terms: accepted,
    accept_personal_data: accepted,
  }, { auth: false });
}

/** Verify a login code → issue access/refresh tokens + user. */
export function verifyEmailCode(email: string, code: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/v1/auth/email/verify', { email, code }, { auth: false });
}

export function isEmailAccountNotFoundError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 404) return false;
  const body = error.body as { error?: unknown } | undefined;
  return body?.error === 'email account not found';
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
  return useMutation({
    mutationFn: ({ email, accepted }: { email: string; accepted: boolean }) => requestEmailCode(email, accepted),
  });
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

/**
 * Re-authentication: prove control of the factor already on the account.
 *
 * Required before changing the phone or the email. The backend picks the
 * factor and never accepts a target from us — that is what makes it a proof of
 * ownership rather than a formality. The resulting `temp_token` lives 15
 * minutes and must be passed to every step of the change that follows.
 */
export function requestReauthCode(purpose: ReauthPurpose): Promise<ReauthChallengeResponse> {
  return api.post<ReauthChallengeResponse>('/api/v1/me/reauth/request', { purpose });
}

/**
 * Re-deliver the pending phone re-auth code as a voice call. Takes nothing: the
 * server knows which challenge is in flight.
 */
export function requestReauthVoiceFallback(): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/reauth/fallback');
}

/**
 * Exchange the re-auth code for the short-lived proof token.
 *
 * Sends only the code. What the resulting proof authorizes was fixed by the
 * server when the code was requested — the client cannot restate it here, which
 * is what stops a code issued to change the email being redeemed to change the
 * phone.
 */
export function verifyReauthCode(code: string): Promise<{ temp_token: string }> {
  return api.post<{ temp_token: string }>('/api/v1/me/reauth/verify', { code });
}

export function useRequestReauthCode() {
  return useMutation({ mutationFn: (purpose: ReauthPurpose) => requestReauthCode(purpose) });
}

export function useVerifyReauthCode() {
  return useMutation({ mutationFn: (code: string) => verifyReauthCode(code) });
}

/** Request a code for the new email. Takes the temp token. */
export function requestNewEmailCode(tempToken: string, newEmail: string): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/change-email/request-new', {
    temp_token: tempToken,
    new_email: newEmail,
  });
}

/**
 * Confirm the email change with the code sent to the new email. Returns the
 * updated User. `tempToken` is the re-auth proof: the backend re-checks it here
 * as well as at request time, so the proof must still be live at the moment the
 * account actually changes hands.
 */
export function confirmEmailChange(newEmail: string, code: string, tempToken: string): Promise<User> {
  return api.post<User>('/api/v1/me/change-email/confirm', {
    new_email: newEmail,
    code,
    temp_token: tempToken,
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
    mutationFn: ({ newEmail, code, tempToken }: { newEmail: string; code: string; tempToken: string }) =>
      confirmEmailChange(newEmail, code, tempToken),
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

export interface Session {
  id: number;
  device_name: string;
  device_os: string;
  app_version: string;
  ip_address: string;
  location: string;
  last_active_at: string;
}

export interface SessionsResponse {
  current: Session;
  active: Session[];
}

export function fetchSessions(): Promise<SessionsResponse> {
  return api.get<SessionsResponse>('/api/v1/me/sessions');
}

export function revokeOtherSessions(): Promise<void> {
  return api.delete<void>('/api/v1/me/sessions');
}

export function revokeSession(id: number): Promise<void> {
  return api.delete<void>(`/api/v1/me/sessions/${id}`);
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  });
}

export function useRevokeOtherSessions() {
  return useMutation({
    mutationFn: revokeOtherSessions,
  });
}

export function useRevokeSession() {
  return useMutation({
    mutationFn: (id: number) => revokeSession(id),
  });
}

/** Start the primary Flash Call challenge for a phone number. */
export function requestPhoneCode(phone: string, accepted = false): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/auth/phone/request', {
    phone,
    accept_terms: accepted,
    accept_personal_data: accepted,
  }, { auth: false });
}

export function requestPhoneVoiceFallback(phone: string, challengeId: string): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/auth/phone/fallback', { phone, challenge_id: challengeId }, { auth: false });
}

/** Verify a login code against a concrete phone challenge. */
export function verifyPhoneCode(phone: string, code: string, challengeId: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/v1/auth/phone/verify', { phone, code, challenge_id: challengeId }, { auth: false });
}

/**
 * Request a verification code to change/link a new phone number.
 *
 * `tempToken` comes from the re-auth flow above and is mandatory: without it
 * the backend answers 403. A valid session alone is deliberately not enough —
 * whoever can rebind the phone owns the account permanently.
 */
export function requestChangePhoneCode(phone: string, tempToken: string): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/change-phone/request', {
    phone,
    temp_token: tempToken,
  });
}

export function requestChangePhoneVoiceFallback(phone: string, challengeId: string): Promise<RequestCodeResponse> {
  return api.post<RequestCodeResponse>('/api/v1/me/change-phone/fallback', { phone, challenge_id: challengeId });
}

/** Confirm phone number change/linking with verification code. */
export function confirmPhoneChange(
  phone: string,
  code: string,
  challengeId: string,
  tempToken: string,
): Promise<User> {
  return api.post<User>('/api/v1/me/change-phone/confirm', {
    phone,
    code,
    challenge_id: challengeId,
    temp_token: tempToken,
  });
}

export function useRequestPhoneCode() {
  return useMutation({
    mutationFn: ({ phone, accepted }: { phone: string; accepted: boolean }) => requestPhoneCode(phone, accepted),
  });
}

export function acceptDataDissemination(): Promise<void> {
  return api.post<void>('/api/v1/me/legal-consents/dissemination', { accepted: true });
}

export type LegalDocumentType =
  | 'user_agreement'
  | 'personal_data'
  | 'personal_data_dissemination';

export interface LegalConsentItem {
  type: LegalDocumentType;
  version: string;
  sha256: string;
  accepted: boolean;
}

export interface LegalConsentStatus {
  items: LegalConsentItem[];
  public_profile_visible: boolean;
}

export const legalConsentKeys = {
  status: ['legal-consents', 'status'] as const,
};

export function fetchLegalConsentStatus(): Promise<LegalConsentStatus> {
  return api.get<LegalConsentStatus>('/api/v1/me/legal-consents');
}

export function revokeDataDissemination(reason = 'Отозвано пользователем в приложении'): Promise<void> {
  return api.delete<void>('/api/v1/me/legal-consents/dissemination', { reason });
}

export function useLegalConsentStatus(enabled = true) {
  return useQuery({
    queryKey: legalConsentKeys.status,
    queryFn: fetchLegalConsentStatus,
    enabled,
    staleTime: 60_000,
  });
}

export function useAcceptDataDissemination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptDataDissemination,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legalConsentKeys.status }),
  });
}

export function useRevokeDataDissemination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeDataDissemination(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legalConsentKeys.status }),
  });
}

export function useVerifyPhoneCode() {
  return useMutation({
    mutationFn: ({ phone, code, challengeId }: { phone: string; code: string; challengeId: string }) =>
      verifyPhoneCode(phone, code, challengeId),
  });
}

export function useRequestChangePhoneCode() {
  return useMutation({
    mutationFn: ({ phone, tempToken }: { phone: string; tempToken: string }) =>
      requestChangePhoneCode(phone, tempToken),
  });
}

export function useConfirmPhoneChange() {
  return useMutation({
    mutationFn: ({
      phone,
      code,
      challengeId,
      tempToken,
    }: {
      phone: string;
      code: string;
      challengeId: string;
      tempToken: string;
    }) => confirmPhoneChange(phone, code, challengeId, tempToken),
  });
}

export function useRequestPhoneVoiceFallback() {
  return useMutation({ mutationFn: ({ phone, challengeId }: { phone: string; challengeId: string }) => requestPhoneVoiceFallback(phone, challengeId) });
}

export function useRequestChangePhoneVoiceFallback() {
  return useMutation({ mutationFn: ({ phone, challengeId }: { phone: string; challengeId: string }) => requestChangePhoneVoiceFallback(phone, challengeId) });
}


