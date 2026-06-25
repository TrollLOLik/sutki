import * as SecureStore from 'expo-secure-store';

const GUEST_ID_KEY = 'guest_id_v1';
let cachedGuestId: string | null = null;

export function generateSecureUUID(): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC4122
      
      let uuid = '';
      for (let i = 0; i < 16; i++) {
        uuid += bytes[i].toString(16).padStart(2, '0');
        if (i === 3 || i === 5 || i === 7 || i === 9) {
          uuid += '-';
        }
      }
      return uuid;
    }
  } catch (e) {
    console.warn('Secure crypto not available, falling back to Math.random', e);
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function initGuestId(): Promise<string> {
  if (cachedGuestId) {
    return cachedGuestId;
  }
  try {
    let id = await SecureStore.getItemAsync(GUEST_ID_KEY);
    if (!id) {
      id = generateSecureUUID();
      await SecureStore.setItemAsync(GUEST_ID_KEY, id);
    }
    cachedGuestId = id;
    return id;
  } catch (e) {
    console.error('Failed to init guest ID', e);
    if (!cachedGuestId) {
      cachedGuestId = generateSecureUUID();
    }
    return cachedGuestId;
  }
}

export function getGuestId(): string | null {
  return cachedGuestId;
}
