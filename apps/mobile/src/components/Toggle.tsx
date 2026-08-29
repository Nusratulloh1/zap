// Тумблер из веба: лаймовая дорожка + чернильный кругляш, пружинный сдвиг.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  /** узкий вариант (профиль) или широкий (сохранение группы) */
  size?: 'sm' | 'md';
}

export function Toggle({ value, onChange, size = 'sm' }: Props) {
  const { colors, fixed } = useTheme();
  const w = size === 'sm' ? 46 : 52;
  const h = size === 'sm' ? 28 : 32;
  const knob = h - 6;
  const x = useSharedValue(value ? w - knob - 3 : 3);
  x.value = withSpring(value ? w - knob - 3 : 3, { damping: 16, stiffness: 260 });
  const track = useSharedValue(value ? 1 : 0);
  track.value = withTiming(value ? 1 : 0, { duration: 180 });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: track.value > 0.5 ? fixed.lime : colors.stone,
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        onChange(!value);
      }}
    >
      <Animated.View style={[{ width: w, height: h, borderRadius: 999 }, trackStyle]}>
        <Animated.View
          style={[styles.knob, { width: knob, height: knob, borderRadius: 999, top: 3 }, knobStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  knob: { position: 'absolute', backgroundColor: '#111110' },
});
