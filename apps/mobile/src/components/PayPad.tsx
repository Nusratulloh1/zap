// Платёжная клавиатура экрана 3a: 1–9 / 000 0 ⌫.
// Нажатие: scale 0.9 с пружинным отскоком + радиальная вспышка ink-8 %,
// как в web/src/components/PayPad.vue.
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { font } from '@/theme/tokens';
import { EASE_OUT_QUAD, SPRING_SNAPPY } from '@/lib/motion';

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', '⌫'],
];

interface Props {
  onKey: (k: string) => void;
  onBackspace: () => void;
  color?: string;
}

export function PayPad({ onKey, onBackspace, color = '#111110' }: Props) {
  return (
    <View style={styles.grid}>
      {ROWS.flat().map((k) => (
        <Key
          key={k}
          label={k}
          color={color}
          onPress={() => (k === '⌫' ? onBackspace() : onKey(k))}
        />
      ))}
    </View>
  );
}

function Key({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const glowScale = useSharedValue(1);

  const keyStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.9,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Pressable
      style={styles.cell}
      onPress={() => {
        trigger(Platform.OS === 'ios' ? 'selection' : 'impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        // как в вебе: клавиша уходит на 0.9 и возвращается с лёгким
        // перелётом, вспышка расходится от центра
        scale.value = 0.9;
        scale.value = withSpring(1, SPRING_SNAPPY);
        glowScale.value = 0.4;
        glowScale.value = withTiming(1, { duration: 400, easing: EASE_OUT_QUAD });
        glow.value = 1;
        glow.value = withTiming(0, { duration: 400, easing: EASE_OUT_QUAD });
        onPress();
      }}
    >
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={keyStyle}>
        <Text style={[styles.label, { color }, label === '000' && styles.triple, label === '⌫' && styles.back]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12 },
  cell: { width: '33.333%', height: 56, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', left: 8, right: 8, top: 0, bottom: 0, borderRadius: 16, backgroundColor: 'rgba(17,17,16,0.08)' },
  label: { fontFamily: font.bold, fontSize: 26 },
  triple: { fontFamily: font.extrabold, fontSize: 23 },
  back: { fontSize: 22 },
});
