// Всплеск реакции — как в Telegram: выбранный эмодзи вырастает прямо там, где
// его поставили, и из него во все стороны разлетаются копии.
//
// В макете значки, наоборот, слетались к центру со всех краёв экрана; на
// телефоне это читается как посторонний листопад, а не как «я отреагировал вот
// на этого человека». Поэтому движение развёрнуто наружу и привязано к аватару,
// а подписи под эмодзи нет — реакция говорит сама за себя.
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
  /** откуда разлетается: экранные координаты аватара */
  origin?: { x: number; y: number } | null;
  onDone: () => void;
}

const N = 18;
/** cubic-bezier(.2,.7,.3,1) — та же кривая, что у макета. */
const EASE = Easing.bezier(0.2, 0.7, 0.3, 1);

interface Fly {
  dx: number;
  dy: number;
  rot: number;
  size: number;
  dur: number;
  delay: number;
}

function Particle({ emoji, f, x, y }: { emoji: string; f: Fly; x: number; y: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(f.delay, withTiming(1, { duration: f.dur, easing: EASE }));
  }, [t, f.delay, f.dur]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 ? t.value / 0.1 : 1 - t.value,
    transform: [
      // к концу полёта значки слегка проседают — так разлёт выглядит живым
      { translateX: t.value * f.dx },
      { translateY: t.value * f.dy + t.value * t.value * 60 },
      { rotate: `${t.value * f.rot}deg` },
      { scale: 0.4 + t.value * 0.8 },
    ],
  }));

  return (
    <Animated.Text style={[styles.fly, { left: x, top: y, fontSize: f.size }, style]}>
      {emoji}
    </Animated.Text>
  );
}

export function ReactionBurst({ emoji, origin, onDone }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const p = useSharedValue(0);

  const x = origin?.x ?? W / 2;
  const y = origin?.y ?? H * 0.35;

  // разлёт по кругу: угол равномерный, дальность и размер — случайные
  const flies = useMemo<Fly[]>(() => {
    const r = Math.random;
    return Array.from({ length: N }, (_, i) => {
      const angle = (i / N) * Math.PI * 2 + r() * 0.5;
      const dist = 110 + r() * 190;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 40,
        rot: r() * 120 - 60,
        size: 16 + r() * 18,
        dur: 900 + r() * 700,
        delay: r() * 160,
      };
    });
  }, []);

  useEffect(() => {
    if (!emoji) return;
    if (reduceMotion()) {
      const timer = setTimeout(onDone, 600);
      return () => clearTimeout(timer);
    }
    p.value = 0;
    p.value = withSequence(
      withTiming(1, { duration: 420, easing: EASE_POP }),
      withDelay(
        700,
        withTiming(0, { duration: 320 }, (fin) => {
          if (fin) runOnJS(onDone)();
        }),
      ),
    );
  }, [emoji, p, onDone]);

  // крупный эмодзи всплывает ровно над аватаром и уходит вверх, растворяясь
  const pop = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2),
    transform: [{ scale: 0.5 + p.value * 0.75 }, { translateY: -20 * p.value }],
  }));

  if (!emoji) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {!reduceMotion() ? flies.map((f, i) => <Particle key={i} emoji={emoji} f={f} x={x} y={y} />) : null}

      <Animated.View style={[styles.center, { left: x - 40, top: y - 40 }, pop]}>
        <Text style={styles.big}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 65 },
  center: { position: 'absolute', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 56, lineHeight: 64 },
  fly: { position: 'absolute' },
});
