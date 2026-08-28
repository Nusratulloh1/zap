// HTTP-клиент к тому же бэкенду, что и веб. Повторяет контракт web/src/api/real.ts:
// Bearer-доступ, один тихий refresh с ротацией при 401, единый ApiError.
// Токены живут в Keychain/Keystore, а не в обычном сторидже.
import { API_URL } from '@/lib/env';
import { loadTokens, saveTokens, clearTokens, type Tokens } from '@/lib/secureStore';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let tokens: Tokens | null = null;
/** одноразовый токен подтверждения оплаты — как X-Payment-Token в вебе */
let paymentToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Вызывается стором после старта: подтягиваем токены из Keychain. */
export async function restoreTokens(): Promise<Tokens | null> {
  tokens = await loadTokens();
  return tokens;
}

export function getTokens(): Tokens | null {
  return tokens;
}

export async function setTokens(next: Tokens | null): Promise<void> {
  tokens = next;
  if (next) await saveTokens(next);
  else await clearTokens();
}

export function setPaymentToken(v: string | null) {
  paymentToken = v;
}

/** Стор подписывается сюда, чтобы разлогинить UI при протухшем refresh. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

interface Options extends RequestInit {
  /** false — публичная ручка, Authorization не шлём */
  auth?: boolean;
  /** true — приложить X-Payment-Token (одноразовый) */
  pt?: boolean;
}

export async function http<T = unknown>(path: string, init: Options = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (init.auth !== false && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    if (init.pt && paymentToken) {
      headers['X-Payment-Token'] = paymentToken;
      paymentToken = null; // одноразовый
    }
    return fetch(API_URL + path, { ...init, headers });
  };

  let res = await doFetch();

  // один тихий refresh с ротацией — как в вебе
  if (res.status === 401 && tokens && init.auth !== false && !path.startsWith('/auth/')) {
    const rr = await fetch(API_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (rr.ok) {
      await setTokens((await rr.json()) as Tokens);
      res = await doFetch();
    } else {
      await setTokens(null);
      onUnauthorized?.();
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(msg ?? `Ошибка ${res.status}`, res.status);
  }
  return (await res.json().catch(() => ({}))) as T;
}
