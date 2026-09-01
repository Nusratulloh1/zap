// ⚡ Фирменный лоадер (vision §17: «даже loading должен быть ZAP»).
//
// Вместо ○ ○ ○ — вордмарк ZAP! с лаймовой молнией, которая проходит по нему
// слева направо, и мягкой пульсацией. Реализовано нативно на reanimated:
// MP4 из docs/product в бандл НЕ кладём (прозрачное видео тяжёлое и
// по-разному рендерится на iOS/Android), см. vision §1.
//
// При «уменьшить движение» — статичный вордмарк без движения.
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

const WORDMARK = require('../../assets/brand/zap-wordmark-large.png');

interface Props {
  /** подпись под вордмарком: «Получаем чек…» */
  label?: string;
  /**
   * lg — ожидание на весь экран, sm — внутри блока,
   * xs — внутри кнопки (вордмарк ужимается до высоты строки).
   */
  size?: 'xs' | 'sm' | 'lg';
}

export function ZapLoader({ label, size = 'lg' }: Props) {
  const { colors, fixed } = useTheme();
  const t = useSharedValue(0);

  const w = size === 'lg' ? 96 : size === 'sm' ? 56 : 34;
  const h = Math.round(w / 1.5); // пропорция вордмарка

  useEffect(() => {
    if (reduceMotion()) return;
    // один цикл 1200 мс — тот же ритм, что в референсном ролике
    t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
  }, [t]);

  // вордмарк слегка «дышит» в такт пробегу молнии
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [0, 0.45, 0.6, 1], [1, 1.04, 1, 1]) }],
  }));

  /** Молния: лаймовая полоса проходит по вордмарку слева направо. */
  const boltStyle = useAnimatedStyle(() => {
    const p = interpolate(t.value, [0.15, 0.55], [0, 1], 'clamp');
    return {
      left: -w * 0.4 + p * w * 1.5,
      opacity: interpolate(p, [0, 0.15, 0.85, 1], [0, 0.9, 0.9, 0]),
    };
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[{ width: w, height: h }, styles.mark, markStyle]}>
        <Image source={WORDMARK} style={styles.image} resizeMode="contain" />
        {/* пробегающая лаймовая молния поверх букв */}
        <Animated.View
          style={[
            styles.bolt,
            { height: h * 1.4, width: size === 'xs' ? 6 : 10, backgroundColor: fixed.lime },
            boltStyle,
          ]}
          pointerEvents="none"
        />
      </Animated.View>

      {label ? (
        <Text style={[styles.label, { color: colors.muted, fontSize: size === 'lg' ? 14 : 12.5 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  bolt: {
    position: 'absolute',
    top: '-20%',
    width: 10,
    borderRadius: 999,
    transform: [{ rotate: '18deg' }],
  },
  label: { fontFamily: font.semibold },
});
