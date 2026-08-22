export type DataMode = 'session-mock' | 'http';

function readDataMode(value: unknown): DataMode {
  return value === 'http' ? 'http' : 'session-mock';
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const runtimeConfig = Object.freeze({
  apiBaseUrl: String(process.env.NEXT_PUBLIC_API_BASE_URL || '/api').replace(/\/$/, ''),
  chatDataMode: readDataMode(process.env.NEXT_PUBLIC_CHAT_DATA_MODE),
  requestDataMode: readDataMode(process.env.NEXT_PUBLIC_REQUESTS_DATA_MODE),
  mockLatencyMs: Math.max(0, readNumber(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS, 220)),
});
