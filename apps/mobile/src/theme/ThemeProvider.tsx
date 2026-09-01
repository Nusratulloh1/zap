// Тема: светлая/тёмная/системная. Выбор хранится в MMKV, как в вебе — в
// localStorage. `fixed` отдаёт светлую палитру для брендовых экранов
// (онбординг, пад суммы) — аналог .theme-fixed из веба.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { palette, fixedPalette, type Palette, type ThemeName } from './tokens';

/**
 * MMKV создаётся на этапе импорта модуля, а его импортирует i18n — то есть это
 * самый ранний нативный вызов в приложении. Если TurboModule почему-то не
 * поднялся, без страховки приложение уходит в белый экран ещё до первого
 * рендера. Падаем в память: язык и тема не переживут перезапуск, но приложение
 * запустится и покажет, что не так.
 */
function createStorage(): Pick<MMKV, 'getString' | 'set' | 'delete'> {
  try {
    return new MMKV({ id: 'zap' });
  } catch (e) {
    console.warn('[zap] MMKV недоступен, настройки не сохранятся:', e);
    const mem = new Map<string, string>();
    return {
      getString: (k: string) => mem.get(k),
      set: (k: string, v: string | number | boolean) => void mem.set(k, String(v)),
      delete: (k: string) => void mem.delete(k),
    } as Pick<MMKV, 'getString' | 'set' | 'delete'>;
  }
}

export const storage = createStorage();

const KEY = 'zap:theme';
export type ThemePref = ThemeName | 'system';

interface ThemeValue {
  colors: Palette;
  /** палитра брендовых экранов — одинаковая в обеих темах */
  fixed: Palette;
  name: ThemeName;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}

const Ctx = createContext<ThemeValue | null>(null);

function readPref(): ThemePref {
  const v = storage.getString(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>(readPref);

  useEffect(() => {
    storage.set(KEY, pref);
  }, [pref]);

  const name: ThemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  const value = useMemo<ThemeValue>(
    () => ({ colors: palette[name], fixed: fixedPalette, name, pref, setPref: setPrefState }),
    [name, pref],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}
