// Логотип заведения по названию — один справочник на всё приложение.
//
// До этого «логотип мерчанта» был захардкожен как Bellissimo в пяти экранах
// (закрытие сплита, начисление кэшбэка, счёт, история, живой сплит): у EVOS
// или Safia на этих экранах всё равно рисовалась пицца. Теперь знак ищется по
// названию, а если партнёр не наш — экран показывает знак категории заведения
// (🍕 ☕ 🍻 …), а не безликую букву.
import { themeForMerchant } from '@/lib/merchantTheme'
import bellissimo from '@/assets/brand/partners/bellissimo.png'
import safia from '@/assets/brand/partners/safia-sq.png'
import evos from '@/assets/brand/partners/evos-logo.png'
import feedup from '@/assets/brand/partners/feedup-logo.png'

const BY_NAME: Record<string, string> = {
  'Bellissimo Pizza': bellissimo,
  Bellissimo: bellissimo,
  'Safia café': safia,
  Safia: safia,
  EVOS: evos,
  Evos: evos,
  'Feed Up': feedup,
  FeedUp: feedup,
}

/** Знак партнёра или null, если заведение не наше. */
export function merchantLogo(name: string | null | undefined): string | null {
  if (!name) return null
  if (BY_NAME[name]) return BY_NAME[name]!
  const low = name.toLowerCase()
  for (const key of Object.keys(BY_NAME)) {
    if (low.includes(key.toLowerCase())) return BY_NAME[key]!
  }
  return null
}

/*
  Знак заведения — по КОНКРЕТНОМУ виду еды, а не по широкой категории.

  Раньше всё, что попадало в «еду», получало пиццу: и Bellissimo, и EVOS, и
  «Ужин пятница». Список идёт от частного к общему, первое совпадение
  выигрывает.
*/
const GLYPH_BY_KEYWORD: readonly (readonly [string[], string])[] = [
  [['pizza', 'пицца', 'bellissimo', 'беллиссимо'], '🍕'],
  [['sushi', 'суши', 'роллы', 'sakura'], '🍣'],
  [['burger', 'бургер', 'evos', 'эвос', 'kfc', 'max way', 'maxway'], '🍔'],
  [['chicken', 'wings', 'куриц', 'tovuq'], '🍗'],
  [['lavash', 'лаваш', 'oqtepa', 'shaurma', 'шаурма', 'doner', 'донер'], '🌯'],
  [['feed up', 'feedup', 'fries', 'фри', 'hot dog', 'хот-дог'], '🍟'],
  [['lagman', 'лагман', 'noodle', 'ramen', 'рамен', 'udon'], '🍜'],
  [['plov', 'плов', 'osh', 'milliy', 'национальн', 'choyxona', 'чайхана'], '🍲'],
  [['somsa', 'сомса', 'manti', 'манты', 'chuchvara', 'пельмен'], '🥟'],
  [['salad', 'салат', 'veg', 'green'], '🥗'],
  [['tort', 'торт', 'cake', 'desert', 'десерт', 'safia', 'сафия', 'shirinlik',
    'конди', 'kondit', 'bakery', 'pishiriq'], '🍰'],
  [['ice cream', 'мороже', 'muzqaymoq', 'gelato'], '🍦'],
  [['bubble', 'tea', 'чай', 'choy'], '🧋'],
  [['coffee', 'кофе', 'kofe', 'bon!', 'espresso', 'эспрессо', 'barista', 'cofix',
    'starbucks', 'kofexona'], '☕'],
  [['bar', 'бар', 'pub', 'паб', 'beer', 'пиво', 'wine', 'вино'], '🍻'],
  [['ужин', 'kechki', 'dinner', 'обед', 'tushlik', 'lunch', 'завтрак', 'nonushta',
    'breakfast', 'restoran', 'ресторан', 'restaurant', 'kafe', 'кафе', 'cafe',
    'oshxona', 'ошхона', 'food'], '🍽️'],
  [['cinema', 'кино', 'imax', 'film', 'фильм'], '🎬'],
  [['taxi', 'такси', 'yandex', 'uber'], '🚕'],
  [['apteka', 'аптека', 'pharm'], '💊'],
  [['fitness', 'фитнес', 'gym', 'спорт', 'sport'], '🏋️'],
  [['korzinka', 'корзинка', 'makro', 'макро', 'havas', 'market', 'маркет'], '🛒'],
  [['avia', 'авиа', 'hotel', 'отель', 'mehmonxona', 'travel'], '✈️'],
  [['gift', 'подарок', 'sovg', 'flower', 'gul'], '🎁'],
]

/**
 * Знак для плитки, когда логотипа нет.
 *
 * 1) конкретный вид заведения по ключевому слову («Bellissimo» → 🍕,
 *    «EVOS» → 🍔, «Ужин пятница» → 🍽️)
 * 2) широкая категория темы
 * 3) эмодзи, который уже есть в названии
 * 4) молния — фирменный запасной вариант. Бледный чек 🧾 отсюда убран.
 */
export function merchantGlyph(name: string | null | undefined): string {
  if (!name) return '⚡'
  const low = name.toLowerCase()
  for (const [words, glyph] of GLYPH_BY_KEYWORD) {
    if (words.some((w) => low.includes(w))) return glyph
  }
  const th = themeForMerchant(name)
  if (th) return th.glyph
  const found = name.match(/\p{Extended_Pictographic}/u)
  return found?.[0] ?? '⚡'
}
