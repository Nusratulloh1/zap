// Платёжная клавиатура экрана 3a: 1–9 / 000 0 ⌫.
// Нажатие: scale 0.9 с пружинным отскоком + радиальная вспышка ink-8 %,
// как в web/src/components/PayPad.vue.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { font } from '@/theme/tokens';

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

  const keyStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.4 + (1 - glow.value) * 0.6 }],
  }));

  return (
    <Pressable
      style={styles.cell}
      onPress={() => {
        trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        scale.value = 0.9;
        scale.value = withSpring(1, { damping: 8, stiffness: 300, mass: 0.5 });
        glow.value = 1;
        glow.value = withTiming(0, { duration: 400 });
        onPress();
      }}
    >
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={keyStyle}>
        <Text style={[styles.label, { color }, label === '⌫' && styles.back]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12 },
  cell: { width: '33.333%', height: 62, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 62, height: 62, borderRadius: 999, backgroundColor: 'rgba(17,17,16,0.08)' },
  label: { fontFamily: font.mono, fontSize: 27, fontWeight: '700' },
  back: { fontSize: 22 },
});
