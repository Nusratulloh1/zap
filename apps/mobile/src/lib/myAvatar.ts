// Выбор аватара пользователя (vision V2 §C1). Каталог — 15 сгенерированных
// персон (tools/gen-personas.py): flat-иллюстрации людей в стиле Notion
// personas, разные тона кожи, причёски и аксессуары. Файлы уже круглые и
// полноразмерные, рисуются обычным cover без подложек.
//
// Храним ключ в MMKV и раздаём через useSyncExternalStore: аватар виден в
// шапке главной и в профиле одновременно, и смена в одном месте должна сразу
// перерисовать другое — без глобального стора ради одной строки.
import { useSyncExternalStore } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { storage } from '@/theme/ThemeProvider';

const KEY = 'zap:my-avatar';
const KEY_GENDER = 'zap:gender';

export type Gender = 'male' | 'female';

/*
  Женские персоны в наборе. Список ручной: по картинке пол определить нечем, а
  подставлять мужчину девушке — худшее первое впечатление, чем лишняя строка
  кода. Хранится локально: на сервере поля пола нет, и заводить его ради
  выбора аватара не нужно.
*/
const FEMALE_KEYS = ['p02', 'p05', 'p07', 'p14', 'p16', 'p17', 'p22', 'p24'];

export function isFemaleAvatar(key: string): boolean {
  return FEMALE_KEYS.includes(key);
}

export function gender(): Gender | null {
  return (storage.getString(KEY_GENDER) as Gender | undefined) ?? null;
}

export function setGender(g: Gender) {
  storage.set(KEY_GENDER, g);
  // аватар по умолчанию подбираем под пол, если пользователь его ещё не менял
  if (!storage.getString(KEY)) storage.set(KEY, g === 'female' ? 'p02' : 'p01');
  listeners.forEach((l) => l());
}

export function useGender(): Gender | null {
  return useSyncExternalStore(subscribe, gender, gender);
}
const KEY_PHOTO = 'zap:my-avatar-photo';

/** Дефолт для всех новых пользователей — p01 (решение руководства). */
const DEFAULT_KEY = 'p01';

export interface AvatarOption {
  key: string;
  src: ImageSourcePropType;
}

export const MY_AVATARS: readonly AvatarOption[] = [
  { key: 'p01', src: require('../../assets/brand/personas/p01.png') },
  { key: 'p02', src: require('../../assets/brand/personas/p02.png') },
  { key: 'p03', src: require('../../assets/brand/personas/p03.png') },
  { key: 'p04', src: require('../../assets/brand/personas/p04.png') },
  { key: 'p05', src: require('../../assets/brand/personas/p05.png') },
  { key: 'p06', src: require('../../assets/brand/personas/p06.png') },
  { key: 'p07', src: require('../../assets/brand/personas/p07.png') },
  { key: 'p08', src: require('../../assets/brand/personas/p08.png') },
  { key: 'p09', src: require('../../assets/brand/personas/p09.png') },
  { key: 'p10', src: require('../../assets/brand/personas/p10.png') },
  { key: 'p11', src: require('../../assets/brand/personas/p11.png') },
  { key: 'p12', src: require('../../assets/brand/personas/p12.png') },
  { key: 'p13', src: require('../../assets/brand/personas/p13.png') },
  { key: 'p14', src: require('../../assets/brand/personas/p14.png') },
  { key: 'p15', src: require('../../assets/brand/personas/p15.png') },
  { key: 'p16', src: require('../../assets/brand/personas/p16.png') },
  { key: 'p17', src: require('../../assets/brand/personas/p17.png') },
  { key: 'p18', src: require('../../assets/brand/personas/p18.png') },
  { key: 'p19', src: require('../../assets/brand/personas/p19.png') },
  { key: 'p20', src: require('../../assets/brand/personas/p20.png') },
  { key: 'p21', src: require('../../assets/brand/personas/p21.png') },
  { key: 'p22', src: require('../../assets/brand/personas/p22.png') },
  { key: 'p23', src: require('../../assets/brand/personas/p23.png') },
  { key: 'p24', src: require('../../assets/brand/personas/p24.png') },
];

const listeners = new Set<() => void>();

export function myAvatarKey(): string {
  return storage.getString(KEY) ?? (gender() === 'female' ? 'p02' : DEFAULT_KEY);
}

/** Своё фото вместо персоны: data-URI хранится в MMKV (~100 КБ на 512px). */
export function setMyAvatarPhoto(dataUri: string) {
  storage.set(KEY_PHOTO, dataUri);
  storage.set(KEY, 'photo');
  listeners.forEach((l) => l());
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
  if (key === 'photo') {
    const uri = storage.getString(KEY_PHOTO);
    if (uri) return { uri };
  }
  return MY_AVATARS.find((a) => a.key === key)?.src ?? MY_AVATARS[0]!.src;
}
