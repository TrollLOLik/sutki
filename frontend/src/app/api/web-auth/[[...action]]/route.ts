import { NextRequest, NextResponse } from 'next/server';
import type { BackendAuthResponse } from '@shared/api/webAuth.server';
import {
  authenticatedBackendRequest,
  callBackend,
  clearAuthCookies,
  hasTrustedOrigin,
  requestGuestId,
  setAuthCookies,
  setGuestCookie,
} from '@shared/api/webAuth.server';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ action?: string[] }>;
}

async function actionName(context: RouteContext): Promise<string> {
  return (await context.params).action?.join('/') ?? '';
}

async function jsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function proxyPayload(upstream: Response): Promise<{ payload: unknown; contentType: string }> {
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  const payload = contentType.includes('application/json')
    ? await upstream.json().catch(() => ({ error: 'Некорректный ответ сервера' }))
    : await upstream.text();
  return { payload, contentType };
}

function proxiedResponse(payload: unknown, status: number): NextResponse {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function upstreamUnavailable(): NextResponse {
  return proxiedResponse({ error: 'Сервис временно недоступен. Попробуйте ещё раз.' }, 503);
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (await actionName(context) !== 'session') return proxiedResponse({ error: 'not found' }, 404);
  try {
    const { upstream, refreshed } = await authenticatedBackendRequest(request, '/api/v1/me');
    if (upstream.status === 401 || upstream.status === 404) {
      const response = proxiedResponse({ status: 'unauthenticated', user: null }, 200);
      clearAuthCookies(response);
      return response;
    }
    const { payload } = await proxyPayload(upstream);
    if (!upstream.ok) return proxiedResponse(payload, upstream.status);
    const user = payload as BackendAuthResponse['user'];
    const response = proxiedResponse({ status: user.name.trim() ? 'authenticated' : 'onboarding', user }, 200);
    if (refreshed) setAuthCookies(response, refreshed);
    return response;
  } catch {
    return upstreamUnavailable();
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return proxiedResponse({ error: 'invalid request origin' }, 403);
  const action = await actionName(context);
  const body = await jsonBody(request);
  try {
    if (action === 'logout') {
      const refreshToken = request.cookies.get('vigazh_refresh_token')?.value;
      if (refreshToken) {
        await callBackend(request, '/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        }).catch(() => undefined);
      }
      const response = new NextResponse(null, { status: 204 });
      clearAuthCookies(response);
      return response;
    }

    if (action === 'avatar/presign') {
      const { upstream, refreshed } = await authenticatedBackendRequest(request, '/api/v1/media/presign', {
        method: 'POST',
        body: JSON.stringify({
          file_name: body.file_name,
          size: body.size,
          content_type: body.content_type,
          type: 'avatar',
        }),
      });
      const { payload } = await proxyPayload(upstream);
      const response = proxiedResponse(payload, upstream.status);
      if (refreshed) setAuthCookies(response, refreshed);
      if (upstream.status === 401) clearAuthCookies(response);
      return response;
    }

    const publicActions: Record<string, string> = {
      'phone/request': '/api/v1/auth/phone/request',
      'phone/verify': '/api/v1/auth/phone/verify',
      'phone/fallback': '/api/v1/auth/phone/fallback',
      'email/request': '/api/v1/auth/email/request',
      'email/verify': '/api/v1/auth/email/verify',
    };
    const backendPath = publicActions[action];
    if (!backendPath) return proxiedResponse({ error: 'not found' }, 404);

    const guestId = requestGuestId(request);
    const isRequest = action.endsWith('/request');
    const upstreamBody = isRequest
      ? {
          ...(action.startsWith('phone') ? { phone: body.phone } : { email: body.email }),
          accept_terms: body.accepted === true,
          accept_personal_data: body.accepted === true,
        }
      : body;
    const upstream = await callBackend(request, backendPath, {
      method: 'POST',
      body: JSON.stringify(upstreamBody),
    }, guestId);
    const { payload } = await proxyPayload(upstream);
    if (!upstream.ok) return proxiedResponse(payload, upstream.status);

    if (action.endsWith('/verify')) {
      const auth = payload as BackendAuthResponse;
      const response = proxiedResponse({
        status: auth.user.name.trim() ? 'authenticated' : 'onboarding',
        user: auth.user,
      }, 200);
      setAuthCookies(response, auth);
      setGuestCookie(response, guestId);
      return response;
    }

    const response = proxiedResponse(payload, upstream.status);
    setGuestCookie(response, guestId);
    return response;
  } catch {
    return upstreamUnavailable();
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return proxiedResponse({ error: 'invalid request origin' }, 403);
  if (await actionName(context) !== 'profile') return proxiedResponse({ error: 'not found' }, 404);
  const body = await jsonBody(request);
  try {
    const { upstream, refreshed } = await authenticatedBackendRequest(request, '/api/v1/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const { payload } = await proxyPayload(upstream);
    const response = proxiedResponse(payload, upstream.status);
    if (refreshed) setAuthCookies(response, refreshed);
    if (upstream.status === 401) clearAuthCookies(response);
    return response;
  } catch {
    return upstreamUnavailable();
  }
}
