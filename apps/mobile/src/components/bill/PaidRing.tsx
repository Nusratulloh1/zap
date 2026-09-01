// ✅ Friend Paid — кольцо участника заполняется лаймом (vision, часть A).
//
// Общий узел: этим же кольцом заканчивается Split the Bill (шаг 800–1000 мс),
// поэтому заливка вынесена сюда, а не продублирована в двух анимациях.
//
// Кольцо рисуем SVG-окружностью: заливка идёт ПО ОКРУЖНОСТИ через
// strokeDashoffset, а не появлением цвета — как в спецификации
// («серое кольцо быстро заполняется lime по окружности → ✓»).
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { EASE_ZAP, RING_FILL } from '@/lib/motion';
import { reduceMotion } from '@/lib/feedback';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  size: number;
  /** толщина кольца */
  width?: number;
  paid: boolean;
  limeColor: string;
  idleColor: string;
  /** задержка старта — Split the Bill зажигает кольца по очереди */
  delay?: number;
  children?: React.ReactNode;
}

export function PaidRing({ size, width = 3, paid, limeColor, idleColor, delay = 0, children }: Props) {
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;

  // 0 — кольцо серое, 1 — лайм полностью замкнулся
  const fill = useSharedValue(paid ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion()) {
      fill.value = paid ? 1 : 0;
      return;
    }
    if (paid) {
      fill.value = withDelay(delay, withTiming(1, { duration: RING_FILL.dur, easing: EASE_ZAP }));
      // лёгкий подскок аватара в конце заливки
      pop.value = withDelay(
        delay + RING_FILL.dur - 120,
        withSequence(withTiming(1.06, { duration: 120, easing: EASE_ZAP }), withSpring(1, RING_FILL.pop)),
      );
    } else {
      fill.value = withTiming(0, { duration: 200 });
    }
  }, [paid, delay, fill, pop]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, styles.root, popStyle]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill as object}>
        {/* серое кольцо-подложка */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={idleColor} strokeWidth={width} fill="none" />
        {/* лаймовая дуга: растёт по окружности от 12 часов */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={limeColor}
          strokeWidth={width}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={ringProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.inner}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  inner: { alignItems: 'center', justifyContent: 'center' },
});
