/**
 * Persistent cookie jar for native platforms.
 *
 * On web, the browser manages the session cookie automatically
 * (`credentials: "include"`). React Native's fetch has no browser-grade
 * cookie persistence, so on iOS/Android we wrap the global fetch to:
 *   1. capture `Set-Cookie` headers from API responses,
 *   2. persist them in AsyncStorage, and
 *   3. replay them as a `Cookie` header on every request to the API origin.
 *
 * Both the hand-written auth client and the generated API client go through
 * global fetch, so a single install covers every API call.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'krediflo.cookies';

/** name → value pairs of cookies set by the API server. */
let cookies: Record<string, string> = {};
let loaded = false;

async function loadCookies(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) cookies = JSON.parse(raw) as Record<string, string>;
  } catch {
    cookies = {};
  }
  loaded = true;
}

function persistCookies(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cookies)).catch(() => {});
}

function absorbSetCookie(headerValue: string): void {
  // Multiple cookies may arrive comma-joined; split conservatively on the
  // `name=value` boundary that follows a comma.
  const parts = headerValue.split(/,(?=\s*[^;,\s=]+=[^;,]*)/);
  for (const part of parts) {
    const first = part.split(';')[0];
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    // An expired/cleared cookie (e.g. logout) comes back empty.
    if (value === '' || /expires=Thu, 01 Jan 1970/i.test(part)) {
      delete cookies[name];
    } else {
      cookies[name] = value;
    }
  }
  persistCookies();
}

function cookieHeader(): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** Clears the persisted session cookies (used on logout as a safety net). */
export async function clearCookies(): Promise<void> {
  cookies = {};
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

/**
 * Wraps global fetch so requests to `apiOrigin` carry and capture the
 * session cookie. No-op on web, where the browser handles cookies.
 */
export function installCookieJar(apiOrigin: string): void {
  if (Platform.OS === 'web') return;

  const origin = apiOrigin.replace(/\/+$/, '');
  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!url.startsWith(origin)) {
      return nativeFetch(input as RequestInfo, init);
    }

    await loadCookies();

    const headers = new Headers(
      init?.headers ??
        (typeof input === 'object' && 'headers' in input ? input.headers : undefined),
    );
    const jar = cookieHeader();
    if (jar) headers.set('Cookie', jar);

    const response = await nativeFetch(input as RequestInfo, {
      ...init,
      headers,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) absorbSetCookie(setCookie);

    return response;
  }) as typeof fetch;
}
