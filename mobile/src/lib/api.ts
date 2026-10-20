import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { sessionToken, type Profile, type Session } from './session';
import { deviceId, loadSettings } from './storage';
import type { Check, Draft, Page, Report } from './types';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; accessKey?: string };

export class ApiError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

/** Called when the server says the session has ended, so the app can go back to the login screen. */
let onSignedOut: (() => void) | null = null;
export const setSignedOutHandler = (fn: (() => void) | null) => {
  onSignedOut = fn;
};

async function config() {
  const saved = await loadSettings();
  // Settings screen first, then the build's environment (EXPO_PUBLIC_* is baked into the app), then app.json.
  const apiUrl = (saved.apiUrl || process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || '').replace(/\/+$/, '');
  if (!apiUrl) throw new ApiError('No server is set up yet - add the server address in Settings.');
  return { apiUrl, accessKey: saved.accessKey || process.env.EXPO_PUBLIC_APP_ACCESS_KEY || extra.accessKey || '' };
}

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const { apiUrl, accessKey } = await config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.headers ?? {}),
        'X-App-Key': accessKey,
        'X-Device-Id': await deviceId(),
        ...(sessionToken() ? { Authorization: `Bearer ${sessionToken()}` } : {}),
      },
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? 'The server took too long to answer - check the signal and try again.'
        : "Couldn't reach the server - check you're online and the server address in Settings.",
    );
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : `Server error (${res.status}).`;
    if (res.status === 401 && sessionToken() && !path.startsWith('/v1/auth/login') && !path.startsWith('/v1/auth/delete-account')) onSignedOut?.();
    throw new ApiError(detail, res.status);
  }
  return body as T;
}

/** Send the statement (one PDF, or photos of its pages in order) to be read by Claude on the server. */
export async function readStatement(pages: Page[]): Promise<{ draft: Draft; checks: Check[]; notes: string }> {
  const form = new FormData();
  for (const p of pages) {
    if (Platform.OS === 'web' && p.file) {
      form.append('files', p.file, p.name);
    } else {
      // React Native's FormData takes a file reference object.
      form.append('files', { uri: p.uri, name: p.name, type: p.type } as unknown as Blob);
    }
  }
  return call('/v1/invoice/read', { method: 'POST', body: form }, 180_000);
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const checkDraft = (draft: Draft) => call<{ checks: Check[] }>('/v1/invoice/check', json(draft), 30_000);

export const buildReport = (draft: Draft) => call<Report>('/v1/report', json(draft), 30_000);

// ---------- accounts ----------

export const logIn = (email: string, password: string) => call<Session>('/v1/auth/login', json({ email, password }), 30_000);

export const acceptInvite = (code: string, email: string, password: string) =>
  call<Session>('/v1/auth/invite', json({ code, email, password }), 30_000);

export const fetchProfile = () => call<Profile>('/v1/auth/me', { method: 'GET' }, 20_000);

export const logOut = () => call<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }, 10_000);

export const deleteAccount = (password: string) => call<{ ok: boolean }>('/v1/auth/delete-account', json({ password }), 30_000);
