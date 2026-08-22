export interface HttpClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export interface HttpRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function createHttpClient({ baseUrl, getAccessToken }: HttpClientOptions) {
  return async function request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const token = await getAccessToken?.();
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `HTTP ${response.status}`;
      throw new HttpError(message, response.status, payload);
    }
    return payload as T;
  };
}
