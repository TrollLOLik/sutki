import type { AuthChannel, RequestCodeResponse } from './webAuthTypes';

const STORAGE_KEY = 'vigazh-web-auth-challenge-v1';

export interface PendingAuthChallenge {
  channel: AuthChannel;
  identifier: string;
  challengeId: string;
  codeLength: number;
  expiresIn: number;
  retryAfter: number;
  fallbackAvailable: boolean;
  devCode?: string;
}

let memoryChallenge: PendingAuthChallenge | null = null;

function readStoredChallenge(): PendingAuthChallenge | null {
  if (typeof window === 'undefined') return memoryChallenge;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryChallenge;
    const value = JSON.parse(raw) as Partial<PendingAuthChallenge>;
    if (
      (value.channel !== 'phone' && value.channel !== 'email')
      || typeof value.identifier !== 'string'
      || typeof value.challengeId !== 'string'
    ) return null;
    return {
      channel: value.channel,
      identifier: value.identifier,
      challengeId: value.challengeId,
      codeLength: Number(value.codeLength) || (value.channel === 'phone' ? 4 : 6),
      expiresIn: Number(value.expiresIn) || 60,
      retryAfter: Number(value.retryAfter) || 60,
      fallbackAvailable: Boolean(value.fallbackAvailable),
      ...(typeof value.devCode === 'string' ? { devCode: value.devCode } : {}),
    };
  } catch {
    return memoryChallenge;
  }
}

export function createPendingChallenge(
  channel: AuthChannel,
  identifier: string,
  response: RequestCodeResponse,
): PendingAuthChallenge {
  const challenge: PendingAuthChallenge = {
    channel,
    identifier,
    challengeId: response.challenge_id ?? '',
    codeLength: response.code_length ?? (channel === 'phone' ? 4 : 6),
    expiresIn: response.expires_in || 60,
    retryAfter: response.retry_after ?? 60,
    fallbackAvailable: Boolean(response.fallback_available),
    ...(response.dev_code ? { devCode: response.dev_code } : {}),
  };
  memoryChallenge = challenge;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
  } catch {
    // The in-memory challenge remains usable when sessionStorage is restricted.
  }
  return challenge;
}

export function getPendingChallenge(channel: AuthChannel, identifier: string): PendingAuthChallenge | null {
  const challenge = readStoredChallenge();
  return challenge?.channel === channel && challenge.identifier === identifier ? challenge : null;
}

export function clearPendingChallenge(): void {
  memoryChallenge = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required when sessionStorage is restricted.
  }
}

