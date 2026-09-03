// Реакция во весь экран (spec/12 «Реакция — сердечки»): большой эмодзи с
// zapPop, подпись «кто поставил» и облако улетающих значков (zapFly).
//
// Реакция в ZAP — это событие за столом, а не иконка в углу карточки: её видно
// всем в комнате. Поэтому она разворачивается поверх экрана и уходит сама.
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EASE_OUT_QUAD, EASE_POP } from '@/lib/motion';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  /** эмодзи реакции; null — ничего не показываем */
  emoji: string | null;
  title: string;
  sub: string;
  onDone: () => void;
}

const FLY_N = 14;
const { width: SW, height: SH } = Dimensions.get('window');

/** Разлёт задаётся один раз: цифры не должны прыгать между кадрами. */
const FLIGHTS = Array.from({ length: FLY_N }, (_, i) => ({
  x: (i % 2 ? 1 : -1) * (30 + ((i * 37) % 130)),
  y: -(160 + ((i * 53) % 260)),
  rot: ((i * 47) % 60) - 30,
  size: 20 + ((i * 13) % 26),
  delay: (i % 7) * 90,
  left: 24 + ((i * 61) % Math.max(1, Math.round(SW - 80))),
}));

type Flight = (typeof FLIGHTS)[number];

function Fly({ emoji, f }: { emoji: string; f: Flight }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(f.delay, withTiming(1, { duration: 1500, easing: EASE_OUT_QUAD }));
  }, [p, f.delay]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.12 ? p.value / 0.12 : 1 - (p.value - 0.12) / 0.88,
    transform: [
      { translateX: p.value * f.x },
      { translateY: p.value * f.y },
      { rotate: `${p.value * f.rot}deg` },
      { scale: 0.3 + p.value * 0.95 },
    ],
  }));

  return (
    <Animated.Text style={[styles.fly, { left: f.left, fontSize: f.size }, style]}>{emoji}</Animated.Text>
  );
}

export function ReactionBurst({ emoji, title, sub, onDone }: Props) {
  const p = useSharedValue(0);

  useEffect(() => {
    if (!emoji) return;
    if (reduceMotion()) {
      const timer = setTimeout(onDone, 700);
      return () => clearTimeout(timer);
    }
    p.value = 0;
    p.value = withSequence(
      withTiming(1, { duration: 600, easing: EASE_POP }),
      withDelay(
        900,
        withTiming(0, { duration: 320 }, (fin) => {
          if (fin) runOnJS(onDone)();
        }),
      ),
    );
  }, [emoji, p, onDone]);

  const { colors } = useTheme();

  const pop = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2),
    transform: [{ scale: 0.6 + p.value * 0.4 }],
  }));

  if (!emoji) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {!reduceMotion()
        ? FLIGHTS.map((f, i) => <Fly key={i} emoji={emoji} f={f} />)
        : null}

      <Animated.View style={[styles.center, pop]}>
        <Text style={styles.big}>{emoji}</Text>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{sub}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  big: { fontSize: 64, lineHeight: 72 },
  title: { fontFamily: font.bold, fontSize: 14, marginTop: 14 },
  sub: { fontFamily: font.semibold, fontSize: 11, marginTop: 4 },
  fly: { position: 'absolute', top: SH * 0.62 },
});
