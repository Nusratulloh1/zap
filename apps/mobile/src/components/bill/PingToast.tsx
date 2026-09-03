// Плашка «получил пинг» — из макета (zapToast): чёрная карточка сверху, в ней
// лаймовый кружок ⚡, имя и сама подколка, которую увидит должник.
//
// Обычный тост приложения тут не годится: в макете это часть сцены пинга —
// приезжает сверху ровно тогда, когда молния долетела.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reduceMotion } from '@/lib/feedback';
import { EASE_ZAP } from '@/lib/motion';
import { font } from '@/theme/tokens';

interface Props {
  /** «Shoshiy получил пинг» — null прячет плашку */
  title: string | null;
  /** «Эй, 400 000 ждут тебя» */
  line: string;
  onDone: () => void;
}

export function PingToast({ title, line, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);

  useEffect(() => {
    if (!title) return;
    if (reduceMotion()) {
      const timer = setTimeout(onDone, 1600);
      return () => clearTimeout(timer);
    }
    p.value = 0;
    p.value = withSequence(
      withTiming(1, { duration: 340, easing: EASE_ZAP }),
      withDelay(
        1900,
        withTiming(0, { duration: 260 }, (fin) => {
          if (fin) runOnJS(onDone)();
        }),
      ),
    );
  }, [title, p, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * -70 }],
  }));

  if (!title) return null;

  return (
    <Animated.View style={[styles.root, { top: insets.top + 8 }, style]} pointerEvents="none">
      <View style={styles.card}>
        <View style={styles.chip}>
          <Text style={styles.chipGlyph}>⚡</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.line} numberOfLines={1}>{line}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 15, right: 15, alignItems: 'center', zIndex: 98 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#121212',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#121212',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  chip: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#D9FF3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipGlyph: { fontSize: 13 },
  body: { flexShrink: 1 },
  title: { fontFamily: font.bold, fontSize: 12, color: '#FFFFFF' },
  line: { fontFamily: font.semibold, fontSize: 9.5, color: '#9EB53A', marginTop: 2 },
});
