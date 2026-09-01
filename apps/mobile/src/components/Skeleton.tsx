// Скелет загрузки: мягкая пульсация на UI-потоке. Пока данных нет, экран
// держит ту же высоту, что и с данными, — список не «прыгает» при подстановке.
import React, { useEffect } from 'react';
import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  height?: number;
  width?: DimensionValue;
  radius?: number;
  style?: object;
}

export function Skeleton({ height = 48, width = '100%', radius = 16, style }: Props) {
  const v = useSharedValue(0.5);

  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [v]);

  const { colors } = useTheme();
  const animated = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.35 }));

  return (
    <Animated.View
      style={[styles.base, { height, width, borderRadius: radius, backgroundColor: colors.stone }, animated, style]}
    />
  );
}

const styles = StyleSheet.create({ base: { overflow: 'hidden' } });
