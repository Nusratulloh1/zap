// Кнопка «⚡ пингануть» — одна на все экраны: чёрный кружок с лаймовой молнией.
//
// Раньше на экране сплита это была молния, а в долгах и в компании — текстовая
// плашка «Напомнить». Действие одно и то же, и выглядеть оно должно одинаково:
// ⚡ в ZAP — это глагол, а не украшение.
//
// При нажатии кнопка пружинит и выпускает два расходящихся кольца
// (zapPulse + zapRing/zapRing2 из макета) — иначе тап выглядит как «ничего не
// произошло»: сам эффект напоминания улетает на сервер.
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { reduceMotion } from '@/lib/feedback';
import { EASE_OUT_QUAD, EASE_POP } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  /** напоминание уже ушло — кнопка гаснет */
  pinged?: boolean;
  size?: number;
  onPress: () => void;
}

export function PingButton({ pinged, size = 36, onPress }: Props) {
  const { fixed } = useTheme();

  const wave = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!pinged || reduceMotion()) return;
    wave.value = 0;
    wave.value = withTiming(1, { duration: 900, easing: EASE_OUT_QUAD });
    pulse.value = withSequence(
      withTiming(-0.15, { duration: 90 }),
      withTiming(0.18, { duration: 160, easing: EASE_POP }),
      withTiming(0, { duration: 200 }),
    );
  }, [pinged, wave, pulse]);

  const btn = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value }] }));
  const ring1 = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - wave.value),
    transform: [{ scale: 1 + wave.value * 1.6 }],
  }));
  const ring2 = useAnimatedStyle(() => ({
    opacity: 0.7 * Math.max(0, 1 - wave.value * 1.3),
    transform: [{ scale: 1 + wave.value * 2.4 }],
  }));

  return (
    <Animated.View style={btn}>
      <PressableScale
        small
        disabled={pinged}
        style={[
          styles.btn,
          { width: size, height: size, backgroundColor: fixed.ink },
          pinged && styles.dimmed,
        ]}
        onPress={onPress}
      >
        <Animated.View style={[styles.wave, { borderColor: fixed.lime }, ring1]} pointerEvents="none" />
        <Animated.View style={[styles.wave, { borderColor: fixed.lime }, ring2]} pointerEvents="none" />
        <Text style={[styles.glyph, { color: fixed.lime, fontSize: size * 0.39 }]}>⚡</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  glyph: { textAlign: 'center' },
  wave: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999, borderWidth: 2 },
  dimmed: { opacity: 0.45 },
});
