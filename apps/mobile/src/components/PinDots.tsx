// Точки PIN: заполняются по мере ввода, при ошибке — короткая тряска.
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

export function PinDots({ filled, error, length = 4 }: { filled: number; error?: boolean; length?: number }) {
  const shake = useSharedValue(0);
  const { colors } = useTheme();

  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 60 }),
    );
  }, [error, shake]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      {Array.from({ length }, (_, i) => (
        <Dot key={i} on={i < filled} color={error ? colors.danger : colors.ink} idle={colors.sand} />
      ))}
    </Animated.View>
  );
}

function Dot({ on, color, idle }: { on: boolean; color: string; idle: string }) {
  const s = useSharedValue(on ? 1 : 0);
  s.value = withSpring(on ? 1 : 0, { damping: 16, stiffness: 380 });
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + 0.15 * s.value }],
    backgroundColor: s.value > 0.5 ? color : idle,
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  dot: { width: 18, height: 18, borderRadius: 999 },
});
