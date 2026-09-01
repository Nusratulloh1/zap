// ⚡ «Пингануть» — фирменная механика напоминания (vision, часть A, «👀 Reminder»).
//
// Вместо строчки «Напоминание отправлено» из аватара отправителя вылетает
// молния и летит к аватару должника; тот вздрагивает и получает «Pinged 👀».
// Пользователь видит действие, а не отчёт о нём.
//
// Координаты берём через measure() на UI-потоке — как в Split the Bill:
// летит только transform, layout не трогаем, поэтому кадры не проседают.
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useBillStage } from '@/lib/billStage';
import { reduceMotion } from '@/lib/feedback';

/** Длительность полёта. Дольше — и жест начинает раздражать при частых пингах. */
const FLIGHT_MS = 540;

interface Props {
  /** memberId отправителя (обычно «вы»); если не найден — стартуем снизу */
  fromMemberId?: string;
  /** memberId получателя пинга */
  toMemberId: string | null;
  onDone: () => void;
}

export function BoltFlight({ fromMemberId, toMemberId, onDone }: Props) {
  const stage = useBillStage();
  const t = useSharedValue(0);
  const from = useSharedValue({ x: 0, y: 0 });
  const to = useSharedValue({ x: 0, y: 0 });
  const ready = useSharedValue(0);

  useEffect(() => {
    if (!toMemberId) return;
    if (reduceMotion()) {
      onDone();
      return;
    }

    runOnUI(() => {
      'worklet';
      const target = toMemberId ? stage?.members.get(toMemberId) : null;
      const source = fromMemberId ? stage?.members.get(fromMemberId) : null;
      if (!target) {
        runOnJS(onDone)();
        return;
      }
      const mt = measure(target);
      if (!mt) {
        runOnJS(onDone)();
        return;
      }
      // целимся в аватар — он слева в карточке, а не в её центр
      to.value = { x: mt.pageX + 42, y: mt.pageY + mt.height / 2 };

      const ms = source ? measure(source) : null;
      from.value = ms
        ? { x: ms.pageX + 42, y: ms.pageY + ms.height / 2 }
        : { x: mt.pageX + 42, y: mt.pageY + mt.height + 120 };

      ready.value = 1;
      t.value = 0;
      t.value = withTiming(1, { duration: FLIGHT_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        'worklet';
        if (done) {
          ready.value = 0;
          runOnJS(onDone)();
        }
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toMemberId]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    // дуга: молния не ползёт по прямой, а закладывает небольшой крюк вверх
    const x = interpolate(p, [0, 1], [from.value.x, to.value.x]);
    const y = interpolate(p, [0, 1], [from.value.y, to.value.y]) - Math.sin(p * Math.PI) * 46;
    return {
      opacity: ready.value * interpolate(p, [0, 0.12, 0.82, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x - 15 },
        { translateY: y - 15 },
        { scale: interpolate(p, [0, 0.3, 1], [0.5, 1.15, 0.75]) },
        { rotate: `${interpolate(p, [0, 1], [-18, 14])}deg` },
      ],
    };
  });

  if (!toMemberId) return null;

  return (
    <Animated.View style={[styles.root, style]} pointerEvents="none">
      <Text style={styles.glyph}>⚡</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', zIndex: 95 },
  glyph: { fontSize: 26 },
});
