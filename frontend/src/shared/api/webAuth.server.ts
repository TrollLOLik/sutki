import type { NextRequest, NextResponse } from 'next/server';
import type { WebAuthUser } from './webAuth.types';

const ACCESS_COOKIE = 'vigazh_access_token';
const REFRESH_COOKIE = 'vigazh_refresh_token';
const GUEST_COOKIE = 'vigazh_guest_id';
const backendBaseUrl = String(process.env.BACKEND_API_BASE_URL ?? 'https://arenda.wigaj.ru').replace(/\/$/, '');

export interface BackendAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: WebAuthUser;
}

export function requestGuestId(request: NextRequest): string {
  return request.cookies.get(GUEST_COOKIE)?.value ?? crypto.randomUUID();
}

export function hasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

export function backendHeaders(request: NextRequest, guestId?: string): Headers {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
    'X-App-Version': '1.0.0',
    'X-Device-Name': 'Web browser',
    'X-Device-OS': request.headers.get('sec-ch-ua-platform')?.replaceAll('"', '') || 'Web',
  });
  const userAgent = request.headers.get('user-agent');
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (userAgent) headers.set('User-Agent', userAgent);
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);
  if (guestId) headers.set('X-Guest-Id', guestId);
  return headers;
}

export async function callBackend(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
  guestId?: string,
): Promise<Response> {
  const headers = backendHeaders(request, guestId);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
}

export function setGuestCookie(response: NextResponse, guestId: string): void {
  response.cookies.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function setAuthCookies(response: NextResponse, auth: BackendAuthResponse): void {
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  response.cookies.set(ACCESS_COOKIE, auth.access_token, {
    ...common,
    maxAge: Math.max(60, auth.expires_in),
  });
  response.cookies.set(REFRESH_COOKIE, auth.refresh_token, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function authenticatedBackendRequest(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
): Promise<{ upstream: Response; refreshed?: BackendAuthResponse }> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) {
    return { upstream: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }

  if (accessToken) {
    const upstream = await callBackend(request, path, {
      ...init,
      headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${accessToken}` },
    });
    if (upstream.status !== 401 || !refreshToken) return { upstream };
  }

  const refreshResponse = await callBackend(request, '/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!refreshResponse.ok) return { upstream: refreshResponse };
  const refreshed = await refreshResponse.json() as BackendAuthResponse;
  const upstream = await callBackend(request, path, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${refreshed.access_token}` },
  });
  return { upstream, refreshed };
}
