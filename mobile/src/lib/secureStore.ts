// Токены — только в Keychain (iOS) / Keystore (Android). В обычном сторидже
// их держать нельзя: он читается с рутованного устройства и попадает в бэкапы.
import * as Keychain from 'react-native-keychain';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const SERVICE = 'uz.zapapp.tokens';

export async function saveTokens(t: Tokens): Promise<void> {
  await Keychain.setGenericPassword('zap', JSON.stringify(t), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadTokens(): Promise<Tokens | null> {
  const res = await Keychain.getGenericPassword({ service: SERVICE });
  if (!res) return null;
  try {
    const parsed = JSON.parse(res.password) as Tokens;
    return parsed.accessToken && parsed.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
