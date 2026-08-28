// Ручки авторизации. Один в один с web/src/api/real.ts, чтобы поведение
// (стадии сессии, ротация токенов, PIN) не разъезжалось между клиентами.
import { http, setTokens, setPaymentToken } from './client';
import type { Tokens } from '@/lib/secureStore';

export type Stage = 'onboarding' | 'phone' | 'code' | 'pin' | 'authed';

export interface Session {
  stage: Stage;
  phone?: string;
}

export async function requestOtp(phone: string): Promise<{ devCode?: string }> {
  return http<{ devCode?: string }>('/auth/otp/request', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, code: string): Promise<{ needsPin: boolean }> {
  const res = await http<Tokens & { needsPin: boolean }>('/auth/otp/verify', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone, code }),
  });
  await setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  return { needsPin: res.needsPin };
}

export async function setPin(pin: string): Promise<void> {
  await http('/auth/pin/set', { method: 'POST', body: JSON.stringify({ pin }) });
}

/** true — PIN верный; попутно сохраняем одноразовый токен оплаты. */
export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const res = await http<{ paymentToken: string }>('/auth/pin/verify', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    setPaymentToken(res.paymentToken);
    return true;
  } catch {
    return false;
  }
}

export async function logout(refreshToken?: string): Promise<void> {
  if (refreshToken) {
    await http('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  await setTokens(null);
}

export interface Me {
  id: string;
  name: string;
  handle: string;
  phone: string;
  initials: string;
  memberSince: string;
  splitsCount: number;
  locale?: string;
}

export function me(): Promise<Me> {
  return http<Me>('/me');
}
