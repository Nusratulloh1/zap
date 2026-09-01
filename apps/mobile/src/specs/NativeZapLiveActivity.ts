// Спека TurboModule для Live Activity / Dynamic Island (vision §C18)
// и данных домашнего виджета (§C19).
//
// Это первый собственный нативный модуль в проекте, поэтому здесь же
// появляется codegenConfig в package.json. Путь именно такой (спека на TS,
// реализация — ObjC++ поверх Swift), как у пропатченного react-native-change-icon:
// в bridgeless-режиме RN 0.87 легаси-модули работают только через интероп,
// а он уже дважды выходил боком.
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Поддерживает ли устройство Live Activity (iOS 16.1+, разрешение включено). */
  isSupported(): boolean;

  /**
   * Запустить активность для счёта. Повторный вызов с тем же splitId
   * не создаёт вторую — обновляет существующую.
   */
  start(splitId: string, merchant: string, amount: string, paid: number, total: number, pending: string): void;

  /** Обновить прогресс: сколько оплатили и кого ждём. */
  update(splitId: string, paid: number, total: number, pending: string): void;

  /** Завершить активность (счёт закрыт или отменён). */
  end(splitId: string): void;

  /**
   * Данные для виджета домашнего экрана (§C19): короткая строка состояния.
   * Пишутся в App Group, виджет читает их сам.
   */
  setWidgetState(title: string, subtitle: string): void;
}

export default TurboModuleRegistry.get<Spec>('ZapLiveActivity');
