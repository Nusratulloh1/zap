// 📸 Снимок → счёт: продолжение магии QR для случая, когда кода нет.
//
// Раньше здесь висел спиннер поверх камеры: пользователь снимал чек и
// несколько секунд смотрел на кружок. Теперь превращение видно целиком —
// и, в отличие от QR, оно построено вокруг ОЖИДАНИЯ, потому что OCR идёт
// секунды:
//
//   1. затвор — короткая белая вспышка;
//   2. сам снимок садится в карточку чека по центру;
//   3. по карточке циклически идёт лаймовая линия — продукт «читает» чек,
//      рядом ZAP-лоадер и сменяющиеся подписи;
//   4. ответ пришёл → лаймовая вспышка и разворот карточки на весь экран,
//      дальше экран счёта (ровно как handoff у QR);
//   5. не распознали → карточка вздрагивает и уходит, камера остаётся.
//
// Используется реальный файл снимка, поэтому «бумага» на экране — это тот
// самый чек, который человек только что сфотографировал.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { ZapLoader } from '@/components/ZapLoader';
import { reduceMotion } from '@/lib/feedback';
import { EASE_ZAP, PHOTO_TIMELINE as T } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** Подписи ожидания — крутятся, пока идёт распознавание. */
const STEPS = ['loading.photo1', 'loading.photo2', 'loading.photo3'] as const;
const STEP_MS = 1600;

export type PhotoPhase = 'reading' | 'done' | 'failed';

interface Props {
  /** file:// путь к снимку; null — оверлей выключен */
  photoUri: string | null;
  /** что сейчас: читаем, распознали, не смогли */
  phase: PhotoPhase;
  /** карточка заняла экран — пора менять экран под ней */
  onHandoff: () => void;
  /** не распознали — оверлей убрался, камера снова активна */
  onDismiss: () => void;
}

export function PhotoToReceipt({ photoUri, phase, onHandoff, onDismiss }: Props) {
  const { colors, fixed } = useTheme();
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();

  const enter = useSharedValue(0);   // затвор + посадка снимка в карточку
  const scan = useSharedValue(0);    // бегущая линия чтения
  const finish = useSharedValue(0);  // вспышка + разворот
  const shake = useSharedValue(0);   // неудача
  const [step, setStep] = useState(0);

  // карточка чека: узкая полоса по центру, как реальный чек
  const cardW = Math.min(width - 56, 320);
  const cardH = Math.min(height * 0.52, 420);

  useEffect(() => {
    if (!photoUri) {
      enter.value = 0;
      scan.value = 0;
      finish.value = 0;
      setStep(0);
      return;
    }
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    enter.value = 0;
    enter.value = withTiming(1, { duration: T.settle.at + T.settle.dur, easing: EASE_ZAP });
    if (!reduceMotion()) {
      scan.value = 0;
      scan.value = withRepeat(withTiming(1, { duration: T.scanLoop, easing: Easing.inOut(Easing.quad) }), -1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUri]);

  useEffect(() => {
    if (!photoUri || phase !== 'reading') return;
    const id = setInterval(() => setStep((n) => (n + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, [photoUri, phase]);

  useEffect(() => {
    if (!photoUri) return;

    if (phase === 'done') {
      trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      finish.value = withTiming(1, { duration: T.expand.at + T.expand.dur, easing: EASE_ZAP });
      const id = setTimeout(onHandoff, reduceMotion() ? 120 : T.handoff);
      return () => clearTimeout(id);
    }

    if (phase === 'failed') {
      shake.value = withSequence(
        withTiming(-1, { duration: 60 }),
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 70 }),
      );
      const id = setTimeout(onDismiss, T.fail);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, photoUri]);

  /** Затвор: белая вспышка на первых кадрах. */
  const shutterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.18, 0.42], [0.9, 0.55, 0], 'clamp'),
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.2, 1], [0, 0.82], 'clamp'),
  }));

  /**
   * Снимок: из полного кадра садится в карточку, потом дорастает до экрана.
   *
   * ВАЖНО: анимируются только transform. Первая версия двигала
   * width/height/left/top — это пересчёт layout на каждом кадре, да ещё с
   * <Image> внутри: на среднем телефоне экран вставал колом. Карточка теперь
   * имеет фиксированный размер, а её положение и масштаб задаются
   * translate/scale относительно центра.
   */
  const cardStyle = useAnimatedStyle(() => {
    const e = interpolate(enter.value, [0.25, 1], [0, 1], 'clamp');
    const f = finish.value;

    // состояние 0 — снимок во весь экран, 1 — карточка, 2 — снова во весь экран
    const sxFull = width / cardW;
    const syFull = height / cardH;

    const sx = interpolate(e, [0, 1], [sxFull, 1]);
    const sy = interpolate(e, [0, 1], [syFull, 1]);

    return {
      opacity: 1,
      transform: [
        { translateX: shake.value * 9 },
        { rotate: `${shake.value * 2.5}deg` },
        { scaleX: interpolate(f, [0, 1], [sx, sxFull]) },
        { scaleY: interpolate(f, [0, 1], [sy, syFull]) },
      ],
      borderRadius: 22,
    };
  });

  /** Лаймовая линия чтения — ходит по карточке, пока ждём ответ. */
  const lineStyle = useAnimatedStyle(() => {
    const on = phase === 'reading' ? interpolate(enter.value, [0.6, 1], [0, 1], 'clamp') : 0;
    return {
      opacity: on * interpolate(scan.value, [0, 0.08, 0.92, 1], [0, 1, 1, 0]) * (1 - finish.value),
      top: scan.value * cardH,
    };
  });

  /** Финальная вспышка: чек прочитан. */
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(finish.value, [0, 0.25, 0.6], [0, 0.85, 0], 'clamp'),
  }));

  /** Подпись и лоадер уходят, как только начинается разворот. */
  const captionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.7, 1], [0, 1], 'clamp') * (1 - finish.value),
  }));

  if (!photoUri) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.fill, { backgroundColor: colors.ink }, scrimStyle]} />

      <View style={styles.center}>
        <Animated.View style={[styles.card, { width: cardW, height: cardH }, cardStyle]}>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          {/* бумага того же цвета, что фон экрана счёта — по ней и уходит стык */}
          <Animated.View style={[styles.fill, { backgroundColor: colors.paper }, flashStyle]} />
          <Animated.View style={[styles.line, { backgroundColor: fixed.lime }, lineStyle]} />
        </Animated.View>

        <Animated.View style={[styles.caption, captionStyle]}>
          <ZapLoader size="sm" />
          <Text style={[styles.captionText, { color: '#FFFFFF' }]}>{t(STEPS[step] ?? STEPS[0])}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.fill, styles.shutter, shutterStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  shutter: { backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  card: { overflow: 'hidden', backgroundColor: '#000000' },
  photo: { width: '100%', height: '100%' },
  line: { position: 'absolute', left: 0, right: 0, height: 3 },
  caption: { alignItems: 'center', gap: 12 },
  captionText: { fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
});
