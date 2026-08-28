// Адрес бэкенда. Меняется через .env (см. mobile/README.md): на проде —
// https://use.zapapp.uz/api, локально — http://10.0.2.2:3202 для Android-эмулятора.
import { Platform } from 'react-native';

const PROD = 'https://use.zapapp.uz/api';

/** Локальный бэкенд: у Android-эмулятора хост — 10.0.2.2, у iOS-симулятора — localhost. */
export const LOCAL_API = Platform.select({
  android: 'http://10.0.2.2:3202',
  default: 'http://localhost:3202',
});

const fromEnv = (globalThis as any)?.process?.env?.API_URL as string | undefined;

export const API_URL = (fromEnv && fromEnv.trim()) || PROD;
