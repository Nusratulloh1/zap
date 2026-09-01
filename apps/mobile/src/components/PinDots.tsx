// Точки PIN/кода — порт web/src/components/PinDots.vue:
// заполненные — чернила (при ошибке — danger), пустые — pebble-2,
// под ними лаймовый прогресс-бар; при ошибке короткая тряска.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  filled: number;
  length?: number;
  error?: boolean;
  shake?: boolean;
  /** PIN принят: точки и бар загораются лаймом */
  success?: boolean;
  /** диаметр точки: 26 — SMS-код, 34 — PIN (как в вебе) */
  size?: number;
  gap?: number;
  /** ширина полного лаймового бара; 0 — не показывать */
  barWidth?: number;
}

export function PinDots({ filled, length = 4, error, shake, success, size = 34, gap = 22, barWidth = 0 }: Props) {
  const shakeX = useSharedValue(0);
  const { colors } = useTheme();

  useEffect(() => {
    if (!(error || shake)) return;
    shakeX.value = withSequence(
      withTiming(-8, { duration: 72 }),
      withTiming(8, { duration: 72 }),
      withTiming(-6, { duration: 72 }),
      withTiming(6, { duration: 72 }),
      withTiming(0, { duration: 72 }),
    );
  }, [error, shake, shakeX]);

  const rootStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  return (
    <Animated.View style={[styles.col, rootStyle]}>
      <View style={[styles.row, { gap }]}>
        {Array.from({ length }, (_, i) => (
          <Dot
            key={i}
            on={success || i < filled}
            size={size}
            color={error ? colors.danger : success ? colors.lime : colors.ink}
            idle={colors.pebble2}
          />
        ))}
      </View>
      {barWidth ? (
        <Bar width={success ? barWidth : (filled / length) * barWidth} color={error ? colors.danger : colors.lime} />
      ) : null}
    </Animated.View>
  );
}

function Bar({ width, color }: { width: number; color: string }) {
  const w = useSharedValue(width);
  useEffect(() => {
    w.value = withTiming(width, { duration: 200 });
  }, [width, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

function Dot({ on, size, color, idle }: { on: boolean; size: number; color: string; idle: string }) {
  // пустые точки полноразмерные (меняется только цвет); заполнение — поп
  // 0.6 -> 1.25 -> 1 за 180 мс, как @keyframes dot-pop в вебе
  const pop = useSharedValue(1);
  const prev = useRef(on);
  useEffect(() => {
    if (on && !prev.current) {
      pop.value = 0.6;
      pop.value = withSequence(withTiming(1.25, { duration: 100 }), withTiming(1, { duration: 80 }));
    }
    prev.current = on;
  }, [on, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: 999, backgroundColor: on ? color : idle }, style]}
    />
  );
}

const styles = StyleSheet.create({
  col: { gap: 14 },
  row: { flexDirection: 'row' },
  bar: { height: 3, borderRadius: 999 },
});
