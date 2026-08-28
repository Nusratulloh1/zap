// Тема: светлая/тёмная/системная. Выбор хранится в MMKV, как в вебе — в
// localStorage. `fixed` отдаёт светлую палитру для брендовых экранов
// (онбординг, пад суммы) — аналог .theme-fixed из веба.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { palette, fixedPalette, type Palette, type ThemeName } from './tokens';

export const storage = new MMKV({ id: 'zap' });

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
