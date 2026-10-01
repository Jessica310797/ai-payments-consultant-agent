import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedCheck } from './types';

// Everything here stays on this phone only.
const CHECKS = 'checks.v1';
const SETTINGS = 'settings.v1';
const DEVICE = 'device.v1';
const MAX_CHECKS = 50;

export interface Settings {
  apiUrl: string;
  accessKey: string;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const listChecks = () => readJson<SavedCheck[]>(CHECKS, []);

export async function saveCheck(check: SavedCheck): Promise<void> {
  const all = (await listChecks()).filter((c) => c.id !== check.id);
  await AsyncStorage.setItem(CHECKS, JSON.stringify([check, ...all].slice(0, MAX_CHECKS)));
}

export async function deleteCheck(id: string): Promise<void> {
  const all = await listChecks();
  await AsyncStorage.setItem(CHECKS, JSON.stringify(all.filter((c) => c.id !== id)));
}

export const loadSettings = () => readJson<Partial<Settings>>(SETTINGS, {});

export async function storeSettings(s: Partial<Settings>): Promise<void> {
  await AsyncStorage.setItem(SETTINGS, JSON.stringify(s));
}

export async function deviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE).catch(() => null);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE, id).catch(() => undefined);
  }
  return id;
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
