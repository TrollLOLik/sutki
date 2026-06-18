import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper over expo-secure-store (Android Keystore / iOS Keychain).
 * Used to persist JWT refresh/access tokens per TZ §5.
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

export const SECURE_KEYS = {
  accessToken: 'sutki.accessToken',
  refreshToken: 'sutki.refreshToken',
  /**
   * Recent city searches (JSON string[]). Not sensitive, but stored here to
   * reuse the existing wrapper and avoid pulling in AsyncStorage as a new
   * native dependency (which would require a fresh build, not an OTA update).
   */
  recentSearches: 'sutki.recentSearches',
} as const;
