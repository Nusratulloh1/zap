// Фирменное ожидание вместо замершего экрана.
//
// Создание сплита идёт 5–6 секунд, и всё это время экран не отвечал: CTA
// просто гасла. Пользователь в этот момент не знает, нажалось ли вообще, и
// жмёт ещё раз. Здесь поверх экрана появляется ZAP-лоадер с бегущей
// подписью — ожидание становится частью продукта, а не подвисанием.
//
// Подписи меняются по кругу каждые 1.6 с: одна строка на всё ожидание
// читается как «зависло», три — как работа.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { STICKER, type StickerKey } from '@/components/EmptyState';
import { ZapLoader } from '@/components/ZapLoader';
import { trigger } from 'react-native-haptic-feedback';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** Как долго висит одна подпись. */
const STEP_MS = 1600;

interface Props {
  /** показывать ли ожидание */
  open: boolean;
  /** ключи i18n подписей по порядку; крутятся по кругу */
  steps: readonly string[];
  /**
   * Стикеры под подписи — ожидание работает как маленькая витрина продукта
   * («Bir chek. Bir guruh. Oson.», «Skanerla. Bo'ling. Tayyor!»), а не как
   * пустая пауза. Меняются в такт подписям; если не заданы — только лоадер.
   */
  stickers?: readonly StickerKey[];
}

export function ZapOverlay({ open, steps, stickers }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!open) {
      setI(0);
      return;
    }
    // отдача в момент старта: нажатие подтверждено телом, а не только глазом
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    if (steps.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % steps.length), STEP_MS);
    return () => clearInterval(id);
  }, [open, steps.length]);

  if (!open) return null;

  const key = steps[Math.min(i, steps.length - 1)];
  const sticker = stickers?.length ? stickers[i % stickers.length] : undefined;

  return (
    <Animated.View
      entering={reduceMotion() ? undefined : FadeIn.duration(140)}
      exiting={reduceMotion() ? undefined : FadeOut.duration(160)}
      // перехватываем тапы: пока ждём, повторное нажатие ничего не должно делать
      style={[styles.root, { backgroundColor: colors.paper }]}
      accessibilityViewIsModal
      accessibilityLabel={key ? t(key) : undefined}
    >
      <View style={styles.center}>
        {sticker ? (
          <Animated.View key={sticker} entering={reduceMotion() ? undefined : FadeIn.duration(280)}>
            <Image source={STICKER[sticker]} style={styles.sticker} resizeMode="contain" />
          </Animated.View>
        ) : null}

        <ZapLoader size="lg" />
        {key ? (
          <Animated.View key={key} entering={reduceMotion() ? undefined : FadeIn.duration(200)}>
            <Text style={[styles.caption, { color: colors.muted }]}>{t(key)}</Text>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  sticker: { width: 172, height: 150 },
  caption: { fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
});
