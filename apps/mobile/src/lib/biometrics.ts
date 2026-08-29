// Face ID / отпечаток для подтверждения оплаты.
//
// Библиотека была в зависимостях, но не использовалась: платёж подтверждался
// только PIN-ом. На iOS это главный «не-нативный» разрыв в платёжном
// приложении, на Android — привычный отпечаток.
//
// Биометрия здесь — УСКОРЕНИЕ, а не замена PIN: отказ или отсутствие сенсора
// молча возвращает пользователя к вводу кода.
import ReactNativeBiometrics from 'react-native-biometrics';
import { storage } from '@/theme/ThemeProvider';

const KEY = 'zap:biometrics-enabled';
const rnb = new ReactNativeBiometrics({ allowDeviceCredentials: false });

/** Пользователь не запрещал биометрию (по умолчанию включена). */
export function biometricsEnabled(): boolean {
  return storage.getString(KEY) !== 'off';
}

export function setBiometricsEnabled(on: boolean): void {
  storage.set(KEY, on ? 'on' : 'off');
}

/** Есть ли на устройстве Face ID / Touch ID / отпечаток. */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    const { available } = await rnb.isSensorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Показать системный запрос. true — подтверждено, false — отказ/недоступно
 * (вызывающий экран просто оставляет ввод PIN).
 */
export async function promptBiometrics(reason: string): Promise<boolean> {
  if (!biometricsEnabled()) return false;
  try {
    const { available } = await rnb.isSensorAvailable();
    if (!available) return false;
    const { success } = await rnb.simplePrompt({ promptMessage: reason, cancelButtonText: '' });
    return success;
  } catch {
    return false;
  }
}
