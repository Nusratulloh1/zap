// Палитра реакций — белая пилюля из макета, открывается по-телеграмному:
// сама пилюля выезжает пружиной, а кружки эмодзи всплывают по очереди.
//
// Мгновенное появление читалось как «выскочило меню»; стаггер в 28 мс делает
// из этого жест — палитра раскрывается слева направо, как в Telegram.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { reduceMotion } from '@/lib/feedback';
import { SPRING_SNAPPY } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';

/** Набор из макета: ❤️ 🔥 👏 😂 ⚡. */
export const REACTION_EMOJI = ['❤️', '🔥', '👏', '😂', '⚡'] as const;

const STEP_MS = 28;

interface Props {
  /** уже поставленная мной реакция — её кружок подсвечен лаймом */
  current?: string;
  onPick: (emoji: string) => void;
}

function Cell({ emoji, index, active, onPick }: { emoji: string; index: number; active: boolean; onPick: () => void }) {
  const { colors, fixed } = useTheme();
  const p = useSharedValue(reduceMotion() ? 1 : 0);

  useEffect(() => {
    if (reduceMotion()) return;
    p.value = withDelay(index * STEP_MS, withSpring(1, SPRING_SNAPPY));
  }, [p, index]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.6),
    transform: [{ scale: 0.4 + p.value * 0.6 }, { translateY: (1 - p.value) * 10 }],
  }));

  return (
    <Animated.View style={style}>
      <PressableScale
        style={[styles.cell, { backgroundColor: active ? fixed.lime : colors.sand }]}
        onPress={onPick}
      >
        <Text style={styles.glyph}>{emoji}</Text>
      </PressableScale>
    </Animated.View>
  );
}

export function ReactionPicker({ current, onPick }: Props) {
  const { colors } = useTheme();
  const p = useSharedValue(reduceMotion() ? 1 : 0);

  useEffect(() => {
    if (reduceMotion()) return;
    p.value = withSpring(1, SPRING_SNAPPY);
  }, [p]);

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(p.value, { duration: 120 }),
    transform: [{ scale: 0.86 + p.value * 0.14 }, { translateY: (1 - p.value) * -8 }],
  }));

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.pill, { backgroundColor: colors.paper }, style]}>
        {REACTION_EMOJI.map((e, i) => (
          <Cell key={e} emoji={e} index={i} active={current === e} onPick={() => onPick(e)} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', marginTop: 14 },
  pill: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 8,
    // тень из макета: 0 6px 20px rgba(18,18,18,.10)
    shadowColor: '#121212',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cell: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 18 },
});
