// Всплеск реакции — перенос `particles()` из макета: 40 эмодзи влетают со ВСЕХ
// четырёх сторон и сходятся к точке чуть выше центра, вырастая с 0.3 до 1.25 и
// разворачиваясь на ±40°. Поверх них — крупный эмодзи, который всплывает и
// растворяется.
//
// Подписи под эмодзи нет: реакция говорит сама за себя.
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { reduceMotion } from '@/lib/feedback';
import { EASE_POP } from '@/lib/motion';

interface Props {
  /** эмодзи реакции; null — ничего не показываем */
  emoji: string | null;
  onDone: () => void;
}

const N = 40;
/** cubic-bezier(.2,.7,.3,1) из макета. */
const EASE = Easing.bezier(0.2, 0.7, 0.3, 1);

interface Fly {
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  dur: number;
  delay: number;
}

function Particle({ emoji, f }: { emoji: string; f: Fly }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(f.delay, withTiming(1, { duration: f.dur, easing: EASE }));
  }, [t, f.delay, f.dur]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.12 ? t.value / 0.12 : 1 - t.value,
    transform: [
      { translateX: t.value * f.dx },
      { translateY: t.value * f.dy },
      { rotate: `${t.value * f.rot}deg` },
      { scale: 0.3 + t.value * 0.95 },
    ],
  }));

  return (
    <Animated.Text style={[styles.fly, { left: f.x, top: f.y, fontSize: f.size }, style]}>
      {emoji}
    </Animated.Text>
  );
}

export function ReactionBurst({ emoji, onDone }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const p = useSharedValue(0);

  // старт с четырёх сторон, цель — точка на 0.42 высоты, как в макете
  const flies = useMemo<Fly[]>(() => {
    const r = Math.random;
    return Array.from({ length: N }, (_, i) => {
      const side = i % 4;
      const x = side === 0 ? r() * W : side === 1 ? W + 30 : side === 2 ? r() * W : -30;
      const y = side === 0 ? -30 : side === 1 ? r() * H : side === 2 ? H + 30 : r() * H;
      const tx = W / 2 + (r() - 0.5) * 220;
      const ty = H * 0.42 + (r() - 0.5) * 260;
      return {
        x,
        y,
        dx: tx - x,
        dy: ty - y,
        rot: r() * 80 - 40,
        size: 18 + r() * 22,
        dur: 1600 + r() * 1200,
        delay: r() * 600,
      };
    });
  }, [W, H]);

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
        1400,
        withTiming(0, { duration: 380 }, (fin) => {
          if (fin) runOnJS(onDone)();
        }),
      ),
    );
  }, [emoji, p, onDone]);

  const pop = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2),
    transform: [{ scale: 0.6 + p.value * 0.4 }],
  }));

  if (!emoji) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {!reduceMotion() ? flies.map((f, i) => <Particle key={i} emoji={emoji} f={f} />) : null}

      <Animated.View style={[styles.center, pop]}>
        <Text style={styles.big}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 65 },
  center: { alignItems: 'center' },
  big: { fontSize: 64, lineHeight: 72 },
  fly: { position: 'absolute' },
});
