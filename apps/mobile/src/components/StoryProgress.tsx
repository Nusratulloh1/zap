// Полоски прогресса «сторис»: онбординг и итоги месяца показывают их
// одинаково, поэтому компонент общий — раньше он жил внутри OnboardingScreen.
//
// Палитры как в OnboardingPage.vue: на тёмной подложке пройденные сегменты
// лаймовые, активный — белый.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface Props {
  /** сколько всего панелей */
  count: number;
  /** индекс активной панели */
  index: number;
  /** заполненность активной панели, 0..1 */
  progress: number;
  /** тёмная подложка под полосками */
  dark?: boolean;
}

export function StoryProgress({ count, index, progress, dark = false }: Props) {
  const done = dark ? '#DDFF33' : '#111110';
  const active = dark ? '#FFFFFF' : '#111110';
  const track = dark ? 'rgba(255,255,255,0.25)' : 'rgba(17,17,16,0.2)';
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} fill={i < index ? 1 : i === index ? progress : 0} color={i < index ? done : active} track={track} />
      ))}
    </View>
  );
}

function Bar({ fill, color, track }: { fill: number; color: string; track: string }) {
  const w = useSharedValue(fill);
  // Присваивание shared value ПРЯМО В РЕНДЕРЕ (как было раньше) — запрещённый
  // приём: на холодном старте запись уходит в ещё не смонтированный узел, и
  // полоска остаётся нулевой ширины. Со второго открытия экран уже прогрет и
  // всё «чинилось само» — отсюда и плавающий баг. Пишем из эффекта.
  useEffect(() => {
    w.value = withTiming(fill, { duration: 120, easing: Easing.linear });
  }, [fill, w]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingTop: 20 },
  track: { flex: 1, height: 3, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
