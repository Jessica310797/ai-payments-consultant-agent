import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The sign-in token lives in the iOS Keychain / Android Keystore. On web (development only) it falls back to localStorage.
const KEY = 'pn.session';

export interface Profile {
  email: string;
  merchant: { id: number; name: string };
}
export interface Session extends Profile {
  token: string;
}

let current: Session | null = null;

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
    current = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    current = null;
  }
  return current;
}

export async function saveSession(s: Session | null): Promise<void> {
  current = s;
  try {
    if (Platform.OS === 'web') {
      if (s) globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
      else globalThis.localStorage?.removeItem(KEY);
    } else if (s) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(s));
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    /* the session still works for this launch */
  }
}

export const sessionToken = () => current?.token ?? null;
