// ⚡ Пинг целиком, как в макете (экран «Пинг ⚡ — анимация»): молния вылетает
// из кнопки, летит к аватару должника, там вспыхивает лаймовое пятно
// (zapFlash) и сверху бьёт крупная молния (zapStrike).
//
// Раньше летела только маленькая молния — жест был, но удара не было. В макете
// смысл именно в попадании: «⚡ прилетело вот в этого человека».
//
// Координаты цели берём measure() на UI-потоке (как в Split the Bill), точку
// старта передаёт кнопка — так молния вылетает из того ⚡, который нажали.
import React, { useEffect } from 'react';
import { StyleSheet, Text, type View } from 'react-native';
import Animated, {
  type AnimatedRef,
  Easing,
  interpolate,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useBillStage } from '@/lib/billStage';
import { reduceMotion } from '@/lib/feedback';

/** Вся сцена: полёт, вспышка и удар. Дольше — и частые пинги начнут бесить. */
const TOTAL_MS = 1150;
/** Доля таймлайна, на которой молния долетает (в макете — 40% из 2.6 с). */
const HIT = 0.55;

interface Props {
  /** memberId получателя пинга; null — сцена спит */
  toMemberId: string | null;
  /**
   * Слой, внутри которого рисуется сцена. measure() отдаёт оконные
   * координаты, а left/top считаются от этого слоя — без вычитания его начала
   * молния приземлялась со сдвигом на поля экрана.
   */
  layer?: AnimatedRef<View>;
  /** экранные координаты кнопки ⚡, из которой вылетает молния */
  from?: { x: number; y: number } | null;
  onHit: () => void;
  onDone: () => void;
}

export function PingStrike({ toMemberId, layer, from, onHit, onDone }: Props) {
  const stage = useBillStage();
  const t = useSharedValue(0);
  const src = useSharedValue({ x: 0, y: 0 });
  const dst = useSharedValue({ x: 0, y: 0 });
  const ready = useSharedValue(0);

  useEffect(() => {
    if (!toMemberId) return;
    if (reduceMotion()) {
      onHit();
      onDone();
      return;
    }

    const fx = from?.x ?? 0;
    const fy = from?.y ?? 0;

    runOnUI(() => {
      'worklet';
      const target = toMemberId ? stage?.members.get(toMemberId) : null;
      const mt = target ? measure(target) : null;
      if (!mt) {
        runOnJS(onHit)();
        runOnJS(onDone)();
        return;
      }
      const ml = layer ? measure(layer) : null;
      const ox = ml ? ml.pageX : 0;
      const oy = ml ? ml.pageY : 0;
      dst.value = { x: mt.pageX + mt.width / 2 - ox, y: mt.pageY + mt.height / 2 - oy };
      src.value = fx || fy ? { x: fx - ox, y: fy - oy } : { x: dst.value.x, y: dst.value.y + 220 };

      ready.value = 1;
      t.value = 0;
      t.value = withTiming(1, { duration: TOTAL_MS, easing: Easing.linear }, (done) => {
        'worklet';
        if (done) {
          ready.value = 0;
          runOnJS(onDone)();
        }
      });
    })();

    // «прилетело» — ровно в момент попадания, а не в конце сцены
    const hit = setTimeout(onHit, TOTAL_MS * HIT);
    return () => clearTimeout(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toMemberId]);

  /** Летящая молния: дуга от кнопки к аватару, как zapBolt. */
  const bolt = useAnimatedStyle(() => {
    const k = Math.min(1, t.value / HIT);
    const x = interpolate(k, [0, 1], [src.value.x, dst.value.x]);
    const y = interpolate(k, [0, 1], [src.value.y, dst.value.y]) - Math.sin(k * Math.PI) * 54;
    return {
      opacity: ready.value * interpolate(t.value, [0, 0.06, HIT * 0.92, HIT], [0, 1, 1, 0]),
      transform: [
        { translateX: x - 18 },
        { translateY: y - 18 },
        { scale: interpolate(k, [0, 0.3, 1], [0.4, 1, 1.6]) },
        { rotate: `${interpolate(k, [0, 1], [-16, 12])}deg` },
      ],
    };
  });

  /** Вспышка на аватаре: 76 pt радиальное пятно (zapFlash). */
  const flash = useAnimatedStyle(() => {
    const k = interpolate(t.value, [HIT - 0.06, HIT + 0.02, HIT + 0.16], [0, 1, 2], 'clamp');
    return {
      opacity: ready.value * interpolate(k, [0, 1, 2], [0, 1, 0]),
      transform: [
        { translateX: dst.value.x - 38 },
        { translateY: dst.value.y - 38 },
        { scale: interpolate(k, [0, 1, 2], [0.3, 1.4, 1.9]) },
      ],
    };
  });

  /** Удар сверху: крупная молния падает на аватар (zapStrike). */
  const strike = useAnimatedStyle(() => {
    const k = interpolate(t.value, [HIT - 0.12, HIT, HIT + 0.1], [0, 1, 2], 'clamp');
    return {
      opacity: ready.value * interpolate(k, [0, 0.4, 1, 2], [0, 1, 1, 0]),
      transform: [
        { translateX: dst.value.x - 26 },
        { translateY: dst.value.y - 26 + interpolate(k, [0, 1, 2], [-90, 4, 12]) },
        { scaleY: interpolate(k, [0, 1, 2], [1.6, 1, 0.6]) },
        { scale: interpolate(k, [0, 1, 2], [1, 1, 0.6]) },
      ],
    };
  });

  if (!toMemberId) return null;

  return (
    <>
      <Animated.View style={[styles.flash, flash]} pointerEvents="none">
        <Svg width={76} height={76}>
          <Defs>
            <RadialGradient id="zapFlash" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#D9FF3A" stopOpacity={1} />
              <Stop offset="45%" stopColor="#D9FF3A" stopOpacity={0.6} />
              <Stop offset="72%" stopColor="#D9FF3A" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={38} cy={38} r={38} fill="url(#zapFlash)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.strike, strike]} pointerEvents="none">
        <Text style={styles.strikeGlyph}>⚡</Text>
      </Animated.View>

      <Animated.View style={[styles.bolt, bolt]} pointerEvents="none">
        <Text style={styles.boltGlyph}>⚡</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bolt: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#D9FF3A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 96,
  },
  boltGlyph: { fontSize: 18, width: 24, lineHeight: 22, textAlign: 'center' },
  flash: { position: 'absolute', left: 0, top: 0, width: 76, height: 76, zIndex: 94 },
  strike: { position: 'absolute', left: 0, top: 0, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', zIndex: 97 },
  strikeGlyph: { fontSize: 46, width: 52, lineHeight: 52, textAlign: 'center' },
});
