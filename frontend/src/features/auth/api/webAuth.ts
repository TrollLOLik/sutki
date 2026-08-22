import type {
  ProfileSetupPayload,
  MediaUploadTarget,
  RequestCodeResponse,
  VerifyCodeResponse,
  WebAuthUser,
  WebSessionResponse,
} from '../model/webAuthTypes';

export class WebAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'WebAuthError';
  }
}

async function request<T>(action: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/web-auth/${action}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const record = typeof payload === 'object' && payload ? payload as Record<string, unknown> : null;
    const message = String(record?.error ?? record?.message ?? payload ?? 'Не удалось выполнить запрос');
    throw new WebAuthError(message, response.status, payload);
  }
  return payload as T;
}

function post<T>(action: string, body?: unknown): Promise<T> {
  return request<T>(action, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function loadWebSession(): Promise<WebSessionResponse> {
  return request<WebSessionResponse>('session');
}

export function requestPhoneCode(phone: string): Promise<RequestCodeResponse> {
  return post<RequestCodeResponse>('phone/request', { phone, accepted: true });
}

export function requestEmailCode(email: string): Promise<RequestCodeResponse> {
  return post<RequestCodeResponse>('email/request', { email, accepted: true });
}

export function verifyPhoneCode(phone: string, code: string, challengeId: string): Promise<VerifyCodeResponse> {
  return post<VerifyCodeResponse>('phone/verify', { phone, code, challenge_id: challengeId });
}

export function verifyEmailCode(email: string, code: string): Promise<VerifyCodeResponse> {
  return post<VerifyCodeResponse>('email/verify', { email, code });
}

export function requestPhoneVoiceFallback(phone: string, challengeId: string): Promise<RequestCodeResponse> {
  return post<RequestCodeResponse>('phone/fallback', { phone, challenge_id: challengeId });
}

export function saveProfileSetup(payload: ProfileSetupPayload): Promise<WebAuthUser> {
  return request<WebAuthUser>('profile', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function uploadProfileAvatar(source: string): Promise<string> {
  if (!source.startsWith('data:')) return source;

  const fileResponse = await fetch(source);
  const file = await fileResponse.blob();
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `avatar-${Date.now()}.${extension}`;
  const target = await post<MediaUploadTarget>('avatar/presign', {
    file_name: fileName,
    size: file.size,
    content_type: file.type || 'image/jpeg',
    type: 'avatar',
  });
  const form = new FormData();
  Object.entries(target.form_data ?? {}).forEach(([key, value]) => form.append(key, value));
  form.append('file', file, fileName);
  const upload = await fetch(target.url, { method: 'POST', body: form });
  if (!upload.ok) throw new WebAuthError('Не удалось загрузить фото. Попробуйте ещё раз.', upload.status);
  return target.key;
}

export function logoutWebSession(): Promise<void> {
  return post<void>('logout');
}
