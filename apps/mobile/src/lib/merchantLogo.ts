// Логотип заведения по названию — один справочник на всё приложение.
//
// До этого «логотип мерчанта» был захардкожен как Bellissimo в пяти экранах
// (закрытие сплита, начисление кэшбэка, счёт, история, живой сплит): у EVOS
// или Safia на этих экранах всё равно рисовалась пицца. Теперь знак ищется по
// названию, а если партнёр не наш — экран показывает знак категории заведения
// (🍕 ☕ 🍻 …), а не безликую букву.
import type { ImageSourcePropType } from 'react-native';
import { themeForMerchant } from '@/lib/merchantTheme';

const BY_NAME: Record<string, ImageSourcePropType> = {
  'Bellissimo Pizza': require('../../assets/brand/partners/bellissimo.png'),
  Bellissimo: require('../../assets/brand/partners/bellissimo.png'),
  'Safia café': require('../../assets/brand/partners/safia-sq.png'),
  Safia: require('../../assets/brand/partners/safia-sq.png'),
  EVOS: require('../../assets/brand/partners/evos-logo.png'),
  Evos: require('../../assets/brand/partners/evos-logo.png'),
  'Feed Up': require('../../assets/brand/partners/feedup-logo.png'),
  FeedUp: require('../../assets/brand/partners/feedup-logo.png'),
};

/** Знак партнёра или null, если заведение не наше. */
export function merchantLogo(name: string | null | undefined): ImageSourcePropType | null {
  if (!name) return null;
  if (BY_NAME[name]) return BY_NAME[name]!;
  const low = name.toLowerCase();
  for (const key of Object.keys(BY_NAME)) {
    if (low.includes(key.toLowerCase())) return BY_NAME[key]!;
  }
  return null;
}

/** Чем подписать кружок, когда логотипа нет: знак категории или чек. */
export function merchantGlyph(name: string | null | undefined): string {
  return themeForMerchant(name)?.glyph ?? '🧾';
}
