// Выбор аватара пользователя (vision V2, часть C1: «avatars повсюду»,
// Airbuds-слой). Каталог собран из своих ассетов: шесть персонажей из
// дизайна + шесть фирменных стикеров — итого 12, выбор мгновенный и офлайн.
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
  { key: 'a11', src: require('../../assets/brand/avatars/a11.png') },
  { key: 'a12', src: require('../../assets/brand/avatars/a12.png') },
  { key: 'a15', src: require('../../assets/brand/avatars/a15.png') },
  { key: 'a33', src: require('../../assets/brand/avatars/a33.png') },
  { key: 'a47', src: require('../../assets/brand/avatars/a47.png') },
  { key: 'a68', src: require('../../assets/brand/avatars/a68.png') },
  { key: 'receipt', src: require('../../assets/stickers/receipt-hero.png') },
  { key: 'heart', src: require('../../assets/stickers/heart-zap.png') },
  { key: 'fist', src: require('../../assets/stickers/fist-bump.png') },
  { key: 'wallet', src: require('../../assets/stickers/wallet.png') },
  { key: 'selfie', src: require('../../assets/stickers/selfie.png') },
  { key: 'hands', src: require('../../assets/stickers/hands-heart.png') },
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
