/**
 * Public runtime config. Values prefixed with EXPO_PUBLIC_ are inlined at build
 * time by Expo and are safe to expose to the client.
 */
export const env = {
  /** Base URL of the Go backend REST API. */
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080',
} as const;
