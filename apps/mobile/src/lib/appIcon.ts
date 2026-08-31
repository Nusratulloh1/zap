// Смена иконки приложения. Прячет две несовместимые платформенные модели за
// одним списком ключей:
//
//   iOS     — CFBundleAlternateIcons, имя = .appiconset (IconMosaic/IconHands),
//             основная иконка передаётся как null.
//   Android — activity-alias .MainActivity<Name>; для основной это
//             .MainActivityDefault, т.е. имя 'Default', а не null.
//
// Мастера и раскладка по платформам — assets/app-icons + tools/gen-app-icons.py.
import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Берём модуль напрямую из TurboModuleRegistry, а не через JS-обёртку пакета:
 * она ходит в NativeModules, а это в bridgeless лишний слой совместимости.
 * Нативная часть патчится в patches/react-native-change-icon+5.0.0.patch —
 * апстрим объявляет спек, но не реализует его.
 */
interface ChangeIconSpec extends TurboModule {
  changeIcon(iconName?: string): Promise<string>;
  getIcon(): Promise<string>;
}

function nativeModule(): ChangeIconSpec {
  const mod = TurboModuleRegistry.get<ChangeIconSpec>('ChangeIcon');
  if (!mod) throw new Error('ChangeIcon native module is not linked');
  return mod;
}

export type AppIconKey = 'receipts' | 'mosaic' | 'hands';

export const APP_ICONS: readonly AppIconKey[] = ['receipts', 'mosaic', 'hands'];

/** Ключ -> имя, которое понимает нативная сторона конкретной платформы. */
const NATIVE_NAME: Record<AppIconKey, { ios: string | null; android: string }> = {
  receipts: { ios: null, android: 'Default' },
  mosaic: { ios: 'IconMosaic', android: 'Mosaic' },
  hands: { ios: 'IconHands', android: 'Hands' },
};

/** Превью для экрана выбора — те же мастера, что ушли в нативные наборы. */
export const ICON_PREVIEW: Record<AppIconKey, number> = {
  receipts: require('../../assets/app-icons/receipts.png'),
  mosaic: require('../../assets/app-icons/mosaic.png'),
  hands: require('../../assets/app-icons/hands.png'),
};

function fromNative(name: string | null | undefined): AppIconKey {
  if (!name) return 'receipts';
  const found = APP_ICONS.find((k) => {
    const n = NATIVE_NAME[k];
    return n.ios === name || n.android === name;
  });
  return found ?? 'receipts';
}

/** Какая иконка стоит сейчас. Ошибки не пробрасываем — это только для подсветки. */
export async function currentAppIcon(): Promise<AppIconKey> {
  try {
    return fromNative(await nativeModule().getIcon());
  } catch {
    return 'receipts';
  }
}

/**
 * Переключить иконку. На Android это включение/выключение activity-alias, из-за
 * чего система ЗАКРЫВАЕТ приложение — вызывающий код обязан предупредить
 * пользователя заранее. На iOS система показывает свой алерт «You have changed
 * the icon», подавить его нельзя.
 */
export async function setAppIcon(key: AppIconKey): Promise<void> {
  const target = NATIVE_NAME[key];
  // iOS ждёт имя .appiconset (для основной — «Default»), Android — суффикс алиаса
  await nativeModule().changeIcon(Platform.OS === 'ios' ? target.ios ?? 'Default' : target.android);
}
