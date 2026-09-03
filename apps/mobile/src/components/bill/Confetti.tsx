// Конфетти «все оплатили» — перенос zapConfetti из макета: 70 бумажек и
// десяток эмодзи сыплются сверху, разлетаясь в стороны и кувыркаясь.
//
// Цвета и размеры взяты из макета один в один (#D9FF3A, #121212, #FFFFFF,
// #FF6B3A, #3AB4FF; 6–14 pt, круг или прямоугольник). Разлёт считается один
// раз при монтировании: пересчёт на каждом кадре превратил бы праздник в
// дрожь.
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { reduceMotion } from '@/lib/feedback';

const COLORS = ['#D9FF3A', '#121212', '#FFFFFF', '#FF6B3A', '#3AB4FF'];
const GLYPHS = ['🎉', '⚡', '🍕'];
const PAPER_N = 70;
const GLYPH_N = 10;

/** cubic-bezier(.2,.6,.4,1) из макета. */
const EASE = Easing.bezier(0.2, 0.6, 0.4, 1);

interface Piece {
  left: number;
  size: number;
  round: boolean;
  color: string;
  glyph?: string;
  dx: number;
  dy: number;
  rot: number;
  dur: number;
  delay: number;
}

function Flake({ p }: { p: Piece }) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: p.dur, easing: EASE }));
  }, [t, p.delay, p.dur]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.08 ? t.value / 0.08 : 1 - t.value,
    transform: [
      { translateX: t.value * p.dx },
      { translateY: t.value * p.dy },
      { rotate: `${t.value * p.rot}deg` },
      { scale: 0.6 + t.value * 0.4 },
    ],
  }));

  if (p.glyph) {
    return (
      <Animated.Text style={[styles.piece, { left: p.left, top: -30, fontSize: p.size }, style]}>
        {p.glyph}
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: p.left,
          top: -20,
          width: p.size,
          height: p.round ? p.size : p.size * 1.6,
          borderRadius: p.round ? 999 : 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ run }: { run: boolean }) {
  const { width } = useWindowDimensions();

  const pieces = useMemo<Piece[]>(() => {
    const r = Math.random;
    const out: Piece[] = [];
    for (let i = 0; i < PAPER_N; i += 1) {
      out.push({
        left: r() * width,
        size: 6 + r() * 8,
        round: r() > 0.5,
        color: COLORS[i % COLORS.length]!,
        dx: (r() - 0.5) * 160,
        dy: 520 + r() * 420,
        rot: r() * 720 - 360,
        dur: 1800 + r() * 1200,
        delay: r() * 600,
      });
    }
    for (let i = 0; i < GLYPH_N; i += 1) {
      out.push({
        left: r() * width,
        size: 20 + r() * 14,
        round: false,
        color: 'transparent',
        glyph: GLYPHS[i % GLYPHS.length],
        dx: (r() - 0.5) * 120,
        dy: 500 + r() * 400,
        rot: r() * 200 - 100,
        dur: 2000 + r() * 1000,
        delay: r() * 500,
      });
    }
    return out;
  }, [width]);

  if (!run || reduceMotion()) return null;

  return (
    <Animated.View style={styles.root} pointerEvents="none">
      {pieces.map((p, i) => (
        <Flake key={i} p={p} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, overflow: 'hidden', zIndex: 70 },
  piece: { position: 'absolute' },
});
