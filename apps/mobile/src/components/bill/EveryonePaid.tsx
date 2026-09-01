// 🎉 Everyone Paid — эмоциональный пик продукта (PRODUCT-VISION, часть A).
//
// «Последний человек оплачивает. Все аватары быстро прилетают к центру → ⚡ ←
// короткая lime-вспышка. Потом: ZAP! Everyone's paid. И буквально 5–7
// небольших particles. Всё занимает ~1.3 сек. После автоматически
// появляется: Share this moment →»
//
// Частицы — обычные Animated.View (7 штук), а не библиотека: держим сцену
// дешёвой и предсказуемой. Всё на transform/opacity, поэтому 60fps.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { STICKER } from '@/components/EmptyState';
import { cue, reduceMotion } from '@/lib/feedback';
import { EVERYONE_TIMELINE as T, PARTICLE_COUNT } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  run: boolean;
  onDone: () => void;
  onShare: () => void;
}

const GLYPHS = ['⚡', '✦', '•', '⚡', '✦', '•', '⚡'];

export function EveryonePaid({ run, onDone, onShare }: Props) {
  /** Празднование доиграло — показываем действия и ждём пользователя. */
  const [settled, setSettled] = useState(false);
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const { width, height } = useWindowDimensions();

  const time = useSharedValue(0);
  const visible = useSharedValue(0);

  // разлёт частиц фиксируем один раз: случайность не должна меняться на
  // каждом кадре ре-рендера
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.6;
        const dist = 90 + Math.random() * 70;
        return {
          glyph: GLYPHS[i % GLYPHS.length]!,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 20,
          delay: Math.random() * 120,
          spin: (Math.random() - 0.5) * 240,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!run) return;

    if (reduceMotion()) {
      // без празднования: сразу показываем итог и ждём решения пользователя
      visible.value = 1;
      setSettled(true);
      return;
    }

    cue('everyonePaid');
    visible.value = 1;
    time.value = 0;
    time.value = withTiming(T.total, { duration: T.total, easing: Easing.linear }, (done) => {
      'worklet';
      // Раньше здесь сразу дёргался onDone, и поверх празднования через
      // секунду сам собой выезжал экран итога с кнопками — выглядело как
      // сбой. Теперь момент застывает, а уходит по кнопке.
      if (done) runOnJS(setSettled)(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: visible.value }));

  /** Лаймовая вспышка в центре. */
  const flashStyle = useAnimatedStyle(() => {
    const p = interpolate(time.value, [T.flash.at, T.flash.at + T.flash.dur], [0, 1], 'clamp');
    return {
      opacity: interpolate(p, [0, 0.35, 1], [0, 0.9, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [0.4, 2.6]) }],
    };
  });

  /** ZAP! + «Все оплатили. Красиво. ⚡» */
  const headlineStyle = useAnimatedStyle(() => {
    const p = interpolate(time.value, [T.headline.at, T.headline.at + T.headline.dur], [0, 1], 'clamp');
    return {
      opacity: p,
      transform: [{ scale: interpolate(p, [0, 1], [0.86, 1]) }, { translateY: interpolate(p, [0, 1], [10, 0]) }],
    };
  });

  /** «Share this moment →» появляется последним. */
  const shareStyle = useAnimatedStyle(() => {
    const p = interpolate(time.value, [T.share.at, T.share.at + T.share.dur], [0, 1], 'clamp');
    return { opacity: p, transform: [{ translateY: interpolate(p, [0, 1], [12, 0]) }] };
  });

  if (!run) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill as object, styles.root, rootStyle]}>
      <View style={[styles.scrim, { backgroundColor: colors.cream }]} />

      <View style={[styles.center, { left: width / 2, top: height / 2 }]} pointerEvents="none">
        <Animated.View style={[styles.flash, { backgroundColor: fixed.lime }, flashStyle]} />
        {particles.map((p, i) => (
          <Particle key={i} time={time} {...p} />
        ))}
      </View>

      <Animated.View style={[styles.headline, headlineStyle]} pointerEvents="none">
        {/* стикер празднования (vision §9): момент, ради которого всё затевалось */}
        <Image source={STICKER.paidDone} style={styles.sticker} resizeMode="contain" />
        <Text style={[styles.zap, { color: colors.ink }]}>ZAP!</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>{t('live.allPaidHeadline')}</Text>
      </Animated.View>

      <Animated.View style={[styles.shareWrap, shareStyle]}>
        <PressableScale primary style={[styles.share, { backgroundColor: fixed.ink }]} onPress={onShare}>
          <Text style={[styles.shareText, { color: fixed.lime }]}>{t('live.shareMoment')}</Text>
        </PressableScale>
        {settled ? (
          <Animated.View entering={reduceMotion() ? undefined : FadeIn.duration(220)}>
            <PressableScale style={styles.done} onPress={onDone}>
              <Text style={[styles.doneText, { color: colors.muted }]}>{t('live.allPaidDone')}</Text>
            </PressableScale>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

/** Одна частица: разлетается от центра, крутится и гаснет. */
function Particle({
  time,
  glyph,
  dx,
  dy,
  delay,
  spin,
}: {
  time: SharedValue<number>;
  glyph: string;
  dx: number;
  dy: number;
  delay: number;
  spin: number;
}) {
  const style = useAnimatedStyle(() => {
    const start = T.particles.at + delay;
    const p = interpolate(time.value, [start, start + T.particles.dur], [0, 1], 'clamp');
    return {
      opacity: interpolate(p, [0, 0.15, 0.75, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: dx * p },
        { translateY: dy * p + 40 * p * p }, // лёгкое падение к концу
        { rotate: `${spin * p}deg` },
        { scale: interpolate(p, [0, 0.3, 1], [0.4, 1, 0.7]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, style]} pointerEvents="none">
      <Text style={styles.particleGlyph}>{glyph}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 60, alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.96 },
  center: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', width: 120, height: 120, borderRadius: 999, marginLeft: -60, marginTop: -60 },
  particle: { position: 'absolute' },
  particleGlyph: { fontSize: 20 },
  headline: { alignItems: 'center', gap: 6 },
  done: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  doneText: { fontFamily: font.bold, fontSize: 15 },
  sticker: { width: 116, height: 116, marginBottom: 6 },
  zap: { fontFamily: font.extrabold, fontSize: 56, letterSpacing: -2 },
  sub: { fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
  shareWrap: { position: 'absolute', left: 24, right: 24, bottom: 48 },
  share: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  shareText: { fontFamily: font.extrabold, fontSize: 16 },
});
