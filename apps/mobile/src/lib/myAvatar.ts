// Выбор аватара пользователя (vision V2, часть C1: «avatars повсюду»,
// Airbuds-слой). Каталог — ТОЛЬКО характерные ассеты: фирменные стикеры и
// арты иконок приложения, итого 12.
//
// Файлы assets/brand/avatars/a*.png сюда НЕ входят: это не персонажи, а
// плоские кружки с буквами (А, И, Т…) — заглушки контактов из дизайна.
// В ленте выбора они выглядели как сломанные пустые аватары.
//
// Храним ключ в MMKV и раздаём через useSyncExternalStore: аватар виден в
// шапке главной и в профиле одновременно, и смена в одном месте должна сразу
// перерисовать другое — без глобального стора ради одной строки.
import { useSyncExternalStore } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { storage } from '@/theme/ThemeProvider';

const KEY = 'zap:my-avatar';

export interface AvatarOption {
  key: string;
  src: ImageSourcePropType;
}

export const MY_AVATARS: readonly AvatarOption[] = [
  { key: 'receipt', src: require('../../assets/stickers/receipt-hero.png') },
  { key: 'pizza', src: require('../../assets/stickers/theme-food.png') },
  { key: 'coffee', src: require('../../assets/stickers/theme-coffee.png') },
  { key: 'heart', src: require('../../assets/stickers/heart-zap.png') },
  { key: 'fist', src: require('../../assets/stickers/fist-bump.png') },
  { key: 'wallet', src: require('../../assets/stickers/wallet.png') },
  { key: 'selfie', src: require('../../assets/stickers/selfie.png') },
  { key: 'hands', src: require('../../assets/stickers/hands-heart.png') },
  { key: 'paid', src: require('../../assets/stickers/paid-done.png') },
  { key: 'iconReceipts', src: require('../../assets/app-icons/receipts.png') },
  { key: 'iconMosaic', src: require('../../assets/app-icons/mosaic.png') },
  { key: 'iconHands', src: require('../../assets/app-icons/hands.png') },
];

const listeners = new Set<() => void>();

export function myAvatarKey(): string | null {
  return storage.getString(KEY) ?? null;
}

export function setMyAvatar(key: string) {
  storage.set(KEY, key);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Источник картинки выбранного аватара; null — не выбран, рисуем инициалы. */
export function useMyAvatar(): ImageSourcePropType | null {
  const key = useSyncExternalStore(subscribe, myAvatarKey, myAvatarKey);
  return MY_AVATARS.find((a) => a.key === key)?.src ?? null;
}
