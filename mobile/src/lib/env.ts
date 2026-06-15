import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Public runtime config. Values prefixed with EXPO_PUBLIC_ are inlined at build
 * time by Expo and are safe to expose to the client.
 */
const getLocalHost = () => {
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.50:8081"
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8080`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
};

export const env = {
  /** Base URL of the Go backend REST API. */
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? getLocalHost(),
} as const;
