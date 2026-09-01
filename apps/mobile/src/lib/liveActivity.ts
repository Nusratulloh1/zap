// Live Activity / Dynamic Island (vision §C18) и виджет главного экрана (§C19).
//
// Обёртка над нативным модулем: на Android его нет вовсе, на iOS < 16.1 он
// отвечает isSupported() = false. Все вызовы отсюда безопасны на любой
// платформе — экранам не нужно знать про Platform.OS.
import { Platform } from 'react-native';
import NativeZapLiveActivity from '@/specs/NativeZapLiveActivity';

const mod = Platform.OS === 'ios' ? NativeZapLiveActivity : null;

let supported: boolean | null = null;

function ok(): boolean {
  if (!mod) return false;
  // спрашиваем один раз: ActivityAuthorizationInfo не бесплатный, а ответ
  // в рамках сессии не меняется
  if (supported === null) {
    try {
      supported = mod.isSupported();
    } catch {
      supported = false;
    }
  }
  return supported;
}

export function startLiveActivity(
  splitId: string,
  merchant: string,
  amount: string,
  paid: number,
  total: number,
  pending: string,
) {
  if (!ok()) return;
  try {
    mod!.start(splitId, merchant, amount, paid, total, pending);
  } catch {
    // Живая плашка — украшение. Её отказ не должен всплывать в сценарии оплаты.
  }
}

export function updateLiveActivity(splitId: string, paid: number, total: number, pending: string) {
  if (!ok()) return;
  try {
    mod!.update(splitId, paid, total, pending);
  } catch {}
}

export function endLiveActivity(splitId: string) {
  if (!ok()) return;
  try {
    mod!.end(splitId);
  } catch {}
}

/** Строки для виджета домашнего экрана (§C19). */
export function setWidgetState(title: string, subtitle: string) {
  if (!mod) return;
  try {
    mod.setWidgetState(title, subtitle);
  } catch {}
}
