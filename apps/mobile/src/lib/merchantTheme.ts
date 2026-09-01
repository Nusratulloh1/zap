// Тема заведения — «ZAP знает, где я нахожусь» (vision, часть B §5, часть C §9).
//
// Это НЕ перекраска экрана. Меняются ~10–15% визуального слоя: маленький
// стикер-акцент, очень слабая подложка и предлагаемое имя счёта. Лайм, чернила,
// типографика и раскладка остаются прежними — экран обязан читаться как ZAP.
//
// ОПРЕДЕЛЕНИЕ КАТЕГОРИИ — MVP-эвристика по названию заведения.
//
// В фискальных данных категории нет: чек несёт только название юрлица. Держим
// словарь ключевых слов здесь, в одном месте, чтобы его можно было заменить
// одной правкой, когда у мерчанта появится настоящее поле категории
// (в схеме Prisma это `Merchant.category` + отдача в /bootstrap — дешёвое
// изменение, но оно не нужно, чтобы выкатить тему сейчас).
//
// Правило безопасности: не уверены — темы нет. Неверная тема хуже отсутствия.
import type { StickerKey } from '@/components/EmptyState';

export type ThemeKey = 'food' | 'coffee' | 'taxi' | 'shopping' | 'trip' | 'gift';

export interface MerchantTheme {
  key: ThemeKey;
  /** стикер-гарнир; если его нет — берём эмодзи */
  sticker?: StickerKey;
  /** эмодзи-акцент для тем, под которые стикер ещё не нарисован */
  glyph: string;
  /** ключ i18n для имени счёта по умолчанию */
  titleKey: string;
}

const THEMES: Record<ThemeKey, MerchantTheme> = {
  food: { key: 'food', sticker: 'themeFood', glyph: '🍕', titleKey: 'theme.titleFood' },
  coffee: { key: 'coffee', sticker: 'themeCoffee', glyph: '☕', titleKey: 'theme.titleCoffee' },
  taxi: { key: 'taxi', glyph: '🚕', titleKey: 'theme.titleTaxi' },
  shopping: { key: 'shopping', glyph: '🛒', titleKey: 'theme.titleShopping' },
  trip: { key: 'trip', glyph: '✈️', titleKey: 'theme.titleTrip' },
  gift: { key: 'gift', glyph: '🎁', titleKey: 'theme.titleGift' },
};

/**
 * Ключевые слова по категориям. Латиница и кириллица, потому что названия в
 * чеках приходят и так и так. Сравнение идёт по строке в нижнем регистре.
 */
const KEYWORDS: Record<ThemeKey, readonly string[]> = {
  food: [
    'pizza', 'пицца', 'bellissimo', 'беллиссимо', 'evos', 'эвос', 'max way', 'maxway',
    'kfc', 'burger', 'бургер', 'oshxona', 'ошхона', 'restoran', 'ресторан', 'restaurant',
    'kafe', 'кафе', 'cafe', 'choyxona', 'чойхона', 'lavash', 'лаваш', 'somsa', 'сомса',
    'milliy taom', 'feedup', 'food', 'kebab', 'кебаб', 'sushi', 'суши',
  ],
  coffee: [
    'coffee', 'кофе', 'kofe', 'safia', 'сафия', 'espresso', 'эспрессо', 'barista',
    'бариста', 'chaykhana coffee', 'kofexona', 'cofix', 'starbucks',
  ],
  taxi: [
    'taxi', 'такси', 'yandex go', 'яндекс', 'uber', 'убер', 'mytaxi', 'ride',
    'transport', 'транспорт', 'metro', 'метро',
  ],
  shopping: [
    'korzinka', 'корзинка', 'market', 'маркет', 'mart', 'март', 'supermarket',
    'texnomart', 'техномарт', 'idea', 'shop', 'магазин', 'do‘kon', 'dokon',
    'universam', 'универсам', 'mall', 'молл',
  ],
  trip: [
    'avia', 'авиа', 'airport', 'аэропорт', 'uzairways', 'railway', 'temir yo', 'вокзал',
    'hotel', 'отель', 'mehmonxona', 'booking', 'travel', 'tур', 'tour',
  ],
  gift: ['gift', 'подарок', 'sovg', 'flower', 'цвет', 'gul', 'buket', 'букет'],
};

/** Порядок проверки: более специфичные категории раньше общих. */
const ORDER: readonly ThemeKey[] = ['coffee', 'food', 'taxi', 'trip', 'gift', 'shopping'];

/**
 * Тема по названию заведения. null — тема не определилась, экран остаётся
 * в обычном виде.
 */
export function themeForMerchant(name: string | null | undefined): MerchantTheme | null {
  if (!name) return null;
  const s = name.toLowerCase();
  for (const key of ORDER) {
    const words = KEYWORDS[key];
    for (const w of words) {
      if (s.includes(w)) return THEMES[key];
    }
  }
  return null;
}

/** Тема по ключу — для случаев, когда категория уже известна. */
export function themeByKey(key: ThemeKey | null | undefined): MerchantTheme | null {
  return key ? THEMES[key] : null;
}
