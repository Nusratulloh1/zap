// Живая сумма — порт web/src/components/AnimatedAmount.vue: каждый символ
// со стабильным ключом от правого края (единицы = d0), поэтому «555»→«5 555»
// не перемонтирует цифры — существующие глайдят, монтируется только новая
// левая. Ужатие при росте — scale контейнера, а не смена font-size.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated';
import { font } from '@/theme/tokens';

const EASE_ZAP = Easing.bezier(0.32, 0.72, 0, 1);

// новая цифра: подъём + лёгкий скейл с пружинкой (.achar-enter)
const charEnter = (values: EntryAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 6 }, { scale: 0.96 }] },
    animations: {
      opacity: withTiming(1, { duration: 180, easing: EASE_ZAP }),
      transform: [
        { translateY: withTiming(0, { duration: 180, easing: EASE_ZAP }) },
        { scale: withTiming(1, { duration: 180, easing: EASE_ZAP }) },
      ],
    },
  };
};

// удаление: быстрое затухание вниз (.achar-leave)
const charExit = (values: ExitAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 140 }),
      transform: [
        { translateY: withTiming(6, { duration: 140 }) },
        { scale: withTiming(0.9, { duration: 140 }) },
      ],
    },
  };
};

interface Props {
  /** сырые цифры без разделителей ('' = zero-state) */
  digits: string;
  color: string;
  /** размер шрифта (масштаб-ужатие поверх него) */
  fontSize?: number;
}

export function AnimatedAmount({ digits, color, fontSize = 64 }: Props) {
  type Char = { key: string; ch: string; sep: boolean };
  const chars: Char[] = [];
  if (!digits) {
    chars.push({ key: 'zero', ch: '0', sep: false });
  } else {
    const n = digits.length;
    for (let r = n - 1; r >= 0; r--) {
      chars.push({ key: 'd' + r, ch: digits[n - 1 - r]!, sep: false });
      if (r > 0 && r % 3 === 0) chars.push({ key: 's' + r, ch: '', sep: true });
    }
  }

  // 64px-эквиваленты 52/44/38 через scale, как в вебе
  const len = chars.length;
  const target = len >= 11 ? 38 / 64 : len >= 9 ? 44 / 64 : len >= 7 ? 52 / 64 : 1;
  const scale = useSharedValue(target);
  useEffect(() => {
    scale.value = withTiming(target, { duration: 240, easing: EASE_ZAP });
  }, [target, scale]);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const dim = !digits;

  return (
    <View style={[styles.line, { height: fontSize }]}>
      <Animated.View style={[styles.row, scaleStyle]}>
        {chars.map((c) => (
          <Animated.View
            key={c.key}
            entering={charEnter}
            exiting={charExit}
            layout={LinearTransition.duration(200).easing(EASE_ZAP)}
          >
            {c.sep ? (
              <View style={{ width: fontSize * 0.32 }} />
            ) : (
              <Text style={[styles.char, { fontSize, color, opacity: dim ? 0.35 : 1, lineHeight: fontSize * 1.06 }]}>
                {c.ch}
              </Text>
            )}
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  char: { fontFamily: font.monoBold, letterSpacing: -1.28, fontVariant: ['tabular-nums'] },
});
