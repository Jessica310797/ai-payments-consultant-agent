import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { deviceId, loadSettings } from './storage';
import type { Check, Draft, Page, Report } from './types';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; accessKey?: string };

export class ApiError extends Error {}

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
      headers: { ...(init.headers ?? {}), 'X-App-Key': accessKey, 'X-Device-Id': await deviceId() },
    });
  } catch (e) {
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
    throw new ApiError(detail);
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
