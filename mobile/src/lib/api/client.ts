import { env } from '@/lib/env';
import { storeRef } from '@/lib/api/store-ref';
import { getDeviceMetadata } from '@/lib/device';
import { getGuestId } from '@/lib/guestId';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip attaching the Authorization header (e.g. for auth endpoints). */
  auth?: boolean;
}

let activeRefreshPromise: Promise<string | null> | null = null;

async function networkFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Нет подключения к интернету.', { network_error: true });
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;
  const metadata = getDeviceMetadata();
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-Device-Name': metadata.deviceName,
    'X-Device-OS': metadata.deviceOS,
    'X-App-Version': metadata.appVersion,
    ...(headers as Record<string, string> | undefined),
  };

  const guestId = getGuestId();
  if (guestId) {
    finalHeaders['X-Guest-Id'] = guestId;
  }

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = storeRef.getState?.()?.accessToken;
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await networkFetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const state = storeRef.getState?.();
    const refreshToken = state?.refreshToken;
    if (refreshToken) {
      try {
        if (!activeRefreshPromise) {
          activeRefreshPromise = (async () => {
            try {
              const refreshRes = await networkFetch(`${env.apiUrl}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  'X-Device-Name': metadata.deviceName,
                  'X-Device-OS': metadata.deviceOS,
                  'X-App-Version': metadata.appVersion,
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });
              if (refreshRes.ok) {
                const data = await refreshRes.json();
                await state.beginSession(
                  { accessToken: data.access_token, refreshToken: data.refresh_token },
                  data.user,
                );
                return data.access_token as string;
              } else {
                await state.signOut();
                return null;
              }
            } catch (err) {
              console.error('Failed to auto-refresh token inside promise:', err);
              if (err instanceof ApiError && err.status === 0) throw err;
              await state.signOut();
              return null;
            } finally {
              activeRefreshPromise = null;
            }
          })();
        }

        const newAccessToken = await activeRefreshPromise;
        if (newAccessToken) {
          const retryHeaders = {
            ...finalHeaders,
            Authorization: `Bearer ${newAccessToken}`,
          };
          const retryRes = await networkFetch(`${env.apiUrl}${path}`, {
            ...rest,
            headers: retryHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
          const retryIsJson = retryRes.headers.get('content-type')?.includes('application/json');
          const retryPayload = retryIsJson ? await retryRes.json().catch(() => undefined) : undefined;
          if (retryRes.ok) {
            return retryPayload as T;
          }
          const errBody = retryPayload as { message?: string; error?: string } | undefined;
          const message = errBody?.message ?? errBody?.error ?? `Request failed (${retryRes.status})`;
          throw new ApiError(retryRes.status, message, retryPayload);
        }
      } catch (refreshErr) {
        console.error('Failed to auto-refresh token:', refreshErr);
      }
    }
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const errBody = payload as { message?: string; error?: string } | undefined;
    const message = errBody?.message ?? errBody?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
