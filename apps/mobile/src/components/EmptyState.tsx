// Пустое состояние со стикером вместо серой строчки.
//
// Пустой список — это первое, что видит новый пользователь, и до сих пор там
// стоял технический текст («Сплитов не найдено»). По vision §8–9 стикеры
// живут именно здесь: пустое состояние, успех, онбординг — и больше нигде,
// иначе они перестают работать.
//
// Стикер подгружается лениво самим RN (require резолвится в id ассета,
// декодируется при первом показе) и нарисован не больше 300 px, так что на
// прокрутку не влияет.
import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** Стикеры, нарезанные из листов docs/product (tools: scratchpad/slice2.py). */
export const STICKER = {
  receiptHero: require('../../assets/stickers/receipt-hero.png') as ImageSourcePropType,
  oneBill: require('../../assets/stickers/one-bill.png') as ImageSourcePropType,
  wallet: require('../../assets/stickers/wallet.png') as ImageSourcePropType,
  fistBump: require('../../assets/stickers/fist-bump.png') as ImageSourcePropType,
  /** телефон с «Hisob bo'lindi!» — счёт ПОДЕЛЕН (не оплачен) */
  billDone: require('../../assets/stickers/bill-done.png') as ImageSourcePropType,
  /** чек с деньгами и зелёной галочкой — ОПЛАЧЕНО, без текста */
  paidDone: require('../../assets/stickers/paid-done.png') as ImageSourcePropType,
  /** руки сердцем — «выручил друга», закрыл чужую долю */
  handsHeart: require('../../assets/stickers/hands-heart.png') as ImageSourcePropType,
  heartZap: require('../../assets/stickers/heart-zap.png') as ImageSourcePropType,
  selfie: require('../../assets/stickers/selfie.png') as ImageSourcePropType,
  howItWorks: require('../../assets/stickers/how-it-works.png') as ImageSourcePropType,
  /** гарнир темы заведения — еда */
  themeFood: require('../../assets/stickers/theme-food.png') as ImageSourcePropType,
  /** гарнир темы заведения — кофе */
  themeCoffee: require('../../assets/stickers/theme-coffee.png') as ImageSourcePropType,
} as const;

export type StickerKey = keyof typeof STICKER;

interface Props {
  sticker: StickerKey;
  /** крупная строка голосом ZAP: «Первый ZAP ещё впереди ⚡» */
  title: string;
  /** необязательное пояснение под ней */
  hint?: string;
  /** sm — внутри карточки на главной, md — на весь экран списка */
  size?: 'sm' | 'md';
}

export function EmptyState({ sticker, title, hint, size = 'md' }: Props) {
  const { colors } = useTheme();
  const px = size === 'md' ? 132 : 92;

  return (
    <Animated.View
      entering={reduceMotion() ? undefined : FadeIn.duration(260)}
      style={[styles.root, size === 'sm' && styles.rootSm]}
    >
      <Image source={STICKER[sticker]} style={{ width: px, height: px }} resizeMode="contain" />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.ink }, size === 'sm' && styles.titleSm]}>{title}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12, paddingVertical: 26 },
  rootSm: { paddingVertical: 12, gap: 8 },
  text: { alignItems: 'center', gap: 4 },
  title: { fontFamily: font.extrabold, fontSize: 17, letterSpacing: -0.2, textAlign: 'center' },
  titleSm: { fontSize: 14.5 },
  hint: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
