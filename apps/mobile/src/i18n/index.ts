// i18n мобильного клиента. Локали НЕ дублируются — читаются те же файлы,
// что и в вебе — пакет packages/locales, см. metro.config.js watchFolders.
import i18n, { type PostProcessorModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';
import { storage } from '@/theme/ThemeProvider';

import uz from '@locales/uz.json';
import ru from '@locales/ru.json';
import en from '@locales/en.json';

export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

const KEY = 'zap:locale';

const isLocale = (v: unknown): v is Locale =>
  typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/** Язык системы → наш; всё, что не ru/en, считаем узбекским рынком. */
function deviceLocale(): Locale {
  let tag = '';
  if (Platform.OS === 'ios') {
    const s = NativeModules.SettingsManager?.settings;
    tag = String(s?.AppleLocale ?? s?.AppleLanguages?.[0] ?? '');
  } else {
    tag = String(NativeModules.I18nManager?.localeIdentifier ?? '');
  }
  const t = tag.toLowerCase();
  if (t.startsWith('ru')) return 'ru';
  if (t.startsWith('en')) return 'en';
  return 'uz';
}

export function storedLocale(): Locale | null {
  const v = storage.getString(KEY);
  return isLocale(v) ? v : null;
}

export const initialLocale: Locale = storedLocale() ?? deviceLocale();

/**
 * Общие локали написаны в синтаксисе vue-i18n: подстановки «{n}», плюрализация
 * «один | два | пять», литералы «{'@'}». i18next ничего из этого не понимает —
 * он ждёт «{{n}}». Без этого пост-процессора на экране остаётся сырое
 * «{n}-BOSQICH» (поймано на устройстве).
 *
 * Пост-процессор вешается глобально, поэтому работает и для t() из
 * useTranslation(), и для translate() — иначе часть экранов чинится, а часть нет.
 */
const zapFormat: PostProcessorModule = {
  type: 'postProcessor',
  name: 'zapFormat',
  process(value: string, _key, options) {
    let out = typeof value === 'string' ? value : String(value);
    const params = (options ?? {}) as Record<string, unknown>;

    if (out.includes('|')) {
      const n = Number(params.n ?? params.count ?? 0);
      out = pickPlural(out, n, i18n.language as Locale);
    }
    // {'@'} — экранированный литерал vue-i18n
    out = out.replace(/\{'([^']*)'\}/g, '$1');
    // {name} → значение; неизвестный ключ оставляем как есть, это заметно
    out = out.replace(/\{(\w+)\}/g, (m, k: string) =>
      params[k] === undefined ? m : String(params[k]),
    );
    return out;
  },
};

void i18n
  .use(zapFormat)
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: 'ru',
    resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
    returnNull: false,
    postProcess: ['zapFormat'],
  });

/**
 * Веб-локали используют формат vue-i18n: «1 файл | 2 файла | 5 файлов».
 * i18next такого не понимает, поэтому выбираем форму сами — правила те же,
 * что в вебе (ru — 3 формы, uz/en — 1|2).
 */
function pickPlural(message: string, n: number, locale: Locale): string {
  const forms = message.split('|').map((s) => s.trim());
  if (forms.length < 2) return message;
  if (locale === 'ru' && forms.length >= 3) {
    const mod10 = Math.abs(n) % 10;
    const mod100 = Math.abs(n) % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0]!;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]!;
    return forms[2]!;
  }
  return n === 1 ? forms[0]! : forms[1] ?? forms[0]!;
}

/** Перевод с поддержкой веб-формата плюрализации и подстановок. */
export function translate(key: string, params?: Record<string, unknown>): string {
  // вся обработка формата — в zapFormat, здесь только вызов
  return i18n.t(key, params ?? {}) as string;
}

/** Есть ли такой ключ в текущей локали — для необязательных текстов. */
export function hasKey(key: string): boolean {
  return i18n.exists(key);
}

export function currentLocale(): Locale {
  return (i18n.language as Locale) ?? 'uz';
}

export async function applyLocale(locale: Locale, opts: { persist?: boolean } = {}) {
  if (!isLocale(locale)) return;
  await i18n.changeLanguage(locale);
  if (opts.persist !== false) storage.set(KEY, locale);
}

export default i18n;
