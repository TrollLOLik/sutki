import { env } from '@/lib/env';
import { storeRef } from '@/lib/api/store-ref';
import { useAppVersionStore } from '@/store/appVersion';
import { useNetworkStatusStore } from '@/store/networkStatus';
import { getDeviceMetadata } from '@/lib/device';
import { getGuestId } from '@/lib/guestId';
import { reportHandledError } from '@/lib/observability';

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

const API_ERROR_TRANSLATIONS: Record<string, string> = {
  unauthorized: 'Необходимо войти в аккаунт.',
  forbidden: 'Недостаточно прав для этого действия.',
  'missing bearer token': 'Необходимо войти в аккаунт.',
  'invalid token': 'Сессия недействительна. Войдите снова.',
  'session revoked or expired': 'Сессия завершена. Войдите снова.',
  'internal error': 'Что-то пошло не так. Попробуйте ещё раз.',
  'file type is not allowed':
    'Этот тип файла не поддерживается. Выберите PDF, TXT, DOC, DOCX, XLS или XLSX.',
  'file size exceeds 15MB limit': 'Размер файла превышает 15 МБ.',
  'attachment exceeds 15MB limit': 'Размер вложения превышает 15 МБ.',
  'attachment exceeds size limit': 'Размер вложения превышает допустимый лимит.',
  'invalid attachment reference': 'Некорректное вложение. Выберите файл ещё раз.',
  'message cannot be empty': 'Сообщение не может быть пустым.',
  'not a participant of this conversation': 'У вас нет доступа к этому диалогу.',
  'listing not found': 'Объявление не найдено.',
  'user not found': 'Пользователь не найден.',
  'dates unavailable': 'Выбранные даты уже недоступны.',
  'listing unavailable': 'Объявление сейчас недоступно для бронирования.',
  'booking not pending': 'Заявка уже была обработана.',
  'phone already taken': 'Этот номер телефона уже используется.',
  'phone already linked': 'Этот номер телефона уже привязан к вашему аккаунту.',
  'email already taken': 'Этот email уже используется.',
  'invalid phone number': 'Неверный формат номера телефона.',
  'invalid email': 'Некорректный email.',
  'invalid code': 'Неверный код подтверждения.',
  'code expired': 'Срок действия кода истёк.',
  'too many attempts': 'Превышено количество попыток. Попробуйте позже.',
  'please wait before requesting a new code': 'Подождите перед повторным запросом кода.',
  'daily listing submission limit reached':
    'Достигнут дневной лимит публикаций. Попробуйте завтра.',
  'listing photo storage is temporarily unavailable':
    'Хранилище фотографий временно недоступно. Попробуйте позже.',
  'image moderation is temporarily unavailable':
    'Проверка изображения временно недоступна. Попробуйте ещё раз.',
  'review not allowed': 'Сейчас нельзя оставить отзыв.',
  'review not allowed in current status': 'Сейчас нельзя изменить этот отзыв.',
  'review attempts exceeded': 'Превышено количество попыток изменения отзыва.',
  'review unchanged': 'Текст отзыва не изменился.',
  'invalid review': 'Проверьте оценку и текст отзыва.',
  'reply not allowed in current status': 'Сейчас нельзя изменить ответ на отзыв.',
  'reply attempts exceeded': 'Превышено количество попыток изменения ответа.',
  'you can only message users you have a listing or booking relationship with':
    'Написать можно только пользователю, с которым вас связывает объявление или бронирование.',
  'user interaction is blocked':
    'Новые сообщения и заявки недоступны, пока между пользователями действует блокировка.',
};

function localizeApiMessage(message: string, status: number): string {
  const translated = API_ERROR_TRANSLATIONS[message.trim().toLocaleLowerCase('en-US')];
  if (translated) return translated;

  if (/^request failed \(\d+\)$/i.test(message)) {
    if (status === 401) return API_ERROR_TRANSLATIONS.unauthorized;
    if (status === 403) return API_ERROR_TRANSLATIONS.forbidden;
    if (status >= 500) return API_ERROR_TRANSLATIONS['internal error'];
    return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }

  // Provider and legacy endpoints may still return technical English text.
  // Keep such implementation details out of the user-facing alert.
  if (!/[А-Яа-яЁё]/.test(message) && /[A-Za-z]/.test(message)) {
    if (status === 401) return API_ERROR_TRANSLATIONS.unauthorized;
    if (status === 403) return API_ERROR_TRANSLATIONS.forbidden;
    if (status === 404) return 'Запрошенные данные не найдены.';
    if (status === 409) return 'Действие недоступно в текущем состоянии.';
    if (status === 429) return 'Слишком много запросов. Попробуйте позже.';
    if (status >= 500) return 'Сервис временно недоступен. Попробуйте позже.';
    return 'Проверьте введённые данные и попробуйте ещё раз.';
  }

  return message;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip attaching the Authorization header (e.g. for auth endpoints). */
  auth?: boolean;
}

let activeRefreshPromise: Promise<string | null> | null = null;
let networkRequestSequence = 0;
let latestSuccessfulNetworkRequest = 0;

async function networkFetch(input: string, init: RequestInit): Promise<Response> {
  const requestSequence = ++networkRequestSequence;
  try {
    const response = await fetch(input, init);
    latestSuccessfulNetworkRequest = Math.max(latestSuccessfulNetworkRequest, requestSequence);
    useNetworkStatusStore.getState().reportOnline();
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    // A slower request may fail after a newer one has already proved that the
    // API is reachable. Do not let that stale result flip the whole app back
    // to offline and start an online/offline render loop.
    if (requestSequence >= latestSuccessfulNetworkRequest) {
      useNetworkStatusStore.getState().reportOffline();
    }
    throw new ApiError(0, 'Нет подключения к интернету.', { network_error: true });
  }
}

function normalizedEndpoint(path: string): string {
  return path
    .split('?', 1)[0]
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':uuid');
}

function apiError(status: number, message: string, payload: unknown, method: string, path: string): ApiError {
  const error = new ApiError(status, localizeApiMessage(message, status), payload);
  if (status >= 500) {
    const endpoint = normalizedEndpoint(path);
    reportHandledError(error, {
      component: 'api-client',
      operation: 'server-response',
      tags: {
        http_status: String(status),
        http_method: method,
        endpoint,
      },
      fingerprint: ['mobile-api-error', method, endpoint, String(status)],
    });
  }
  return error;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;
  const method = String(rest.method ?? 'GET').toUpperCase();
  const metadata = getDeviceMetadata();
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-Device-Name': metadata.deviceName,
    'X-Device-OS': metadata.deviceOS,
    'X-Client-Platform': 'android',
    // Omitted when the platform cannot tell us the version (web, Expo Go).
    // The server's minimum-version gate fails open on a missing header, so
    // omitting is correct; sending an empty or invented value is not.
    ...(metadata.appVersion ? { 'X-App-Version': metadata.appVersion } : {}),
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
                  ...(metadata.appVersion ? { 'X-App-Version': metadata.appVersion } : {}),
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });
              const refreshIsJson = refreshRes.headers.get('content-type')?.includes('application/json');
              const refreshPayload = refreshIsJson
                ? await refreshRes.json().catch(() => undefined)
                : undefined;
              if (refreshRes.ok) {
                const data = refreshPayload;
                await state.beginSession(
                  { accessToken: data.access_token, refreshToken: data.refresh_token },
                  data.user,
                );
                return data.access_token as string;
              }

              if (refreshRes.status === 401) {
                await state.signOut();
                return null;
              }

              const errBody = refreshPayload as { message?: string; error?: string } | undefined;
              const message =
                errBody?.message ?? errBody?.error ?? `Request failed (${refreshRes.status})`;
              throw apiError(refreshRes.status, message, refreshPayload, 'POST', '/api/v1/auth/refresh');
            } catch (err) {
              console.error('Failed to auto-refresh token inside promise:', err);
              throw err;
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
          throw apiError(retryRes.status, message, retryPayload, method, path);
        }
      } catch (refreshErr) {
        console.error('Failed to auto-refresh token:', refreshErr);
        throw refreshErr;
      }
    }
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const errBody = payload as
      | { message?: string; error?: string; minimum_supported_version?: string }
      | undefined;
    // 426 means this build is older than the backend's MIN_APP_VERSION. It is
    // not a per-request failure the caller can act on, so flip the global flag:
    // the root layout replaces the whole UI with an update screen rather than
    // letting a generic error land on whatever form we happened to be on.
    if (res.status === 426) {
      useAppVersionStore.getState().requireUpgrade(errBody?.minimum_supported_version ?? null);
    }
    const message = errBody?.message ?? errBody?.error ?? `Request failed (${res.status})`;
    throw apiError(res.status, message, payload, method, path);
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
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE', body }),
};
