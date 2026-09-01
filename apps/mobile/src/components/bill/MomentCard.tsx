// Карточка ZAP Moment на экране закрытого счёта: милестоун компании (§B6)
// или редкий случайный момент (§C10).
//
// Экран закрытия лаймовый, поэтому карточка — чернильная: максимальный
// контраст без единого нового цвета. Празднование здесь намеренно тише, чем
// в EveryonePaid: тот момент — пик, этот идёт сразу после него, и второй
// полноэкранный салют подряд читался бы как навязчивость.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { cue, reduceMotion } from '@/lib/feedback';
import { markMomentSeen, markRandomShown, type Moment } from '@/lib/moments';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius } from '@/theme/tokens';

/** Пять искр — столько же, сколько в Everyone Paid, чтобы язык был один. */
const SPARKS = ['⚡', '✦', '•', '✦', '⚡'];

interface Props {
  moment: Moment;
  /** id счёта — чтобы сюрприз не исчезал при повторном заходе */
  splitId: string;
}

export function MomentCard({ moment, splitId }: Props) {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const still = reduceMotion();

  // Запоминаем факт показа именно здесь: momentFor чистая и зовётся в
  // рендере, побочный эффект ей нельзя.
  useEffect(() => {
    if (moment.milestone) markMomentSeen(moment.kind);
    else markRandomShown(splitId);
    cue('everyonePaid');
  }, [moment.kind, moment.milestone, splitId]);

  return (
    <Animated.View
      entering={still ? undefined : FadeIn.duration(320).delay(180)}
      style={[styles.card, { backgroundColor: fixed.ink }]}
    >
      <View style={styles.sparkRow}>
        {SPARKS.map((s, i) => (
          <Spark key={i} glyph={s} index={i} still={still} lime={fixed.lime} />
        ))}
      </View>

      <Text style={styles.glyph}>{moment.glyph}</Text>
      <Text style={[styles.title, { color: fixed.lime }]}>
        {t(`moments.${moment.kind}.title`, moment.vars ?? {})}
      </Text>
      <Text style={styles.sub}>{t(`moments.${moment.kind}.sub`, moment.vars ?? {})}</Text>
    </Animated.View>
  );
}

function Spark({ glyph, index, still, lime }: { glyph: string; index: number; still: boolean; lime: string }) {
  const v = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    v.value = withDelay(300 + index * 70, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
  }, [index, still, v]);

  const style = useAnimatedStyle(() => ({
    opacity: v.value < 0.5 ? v.value * 2 : 2 - v.value * 2,
    transform: [{ translateY: -10 * v.value }, { scale: 0.6 + 0.4 * v.value }],
  }));

  return <Animated.Text style={[styles.spark, { color: lime }, style]}>{glyph}</Animated.Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, paddingVertical: 22, paddingHorizontal: 20, marginTop: 22, overflow: 'hidden' },
  sparkRow: { position: 'absolute', top: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly' },
  spark: { fontSize: 13 },
  glyph: { fontSize: 40, textAlign: 'center' },
  title: { fontFamily: font.extrabold, fontSize: 22, letterSpacing: -0.3, textAlign: 'center', marginTop: 8 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6 },
});
