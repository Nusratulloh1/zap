// Момент успеха стикером: появился, подержался, ушёл.
//
// Лаймовый кружок с ⚡ читался как значок статуса, а не как радость. Стикер
// живёт своей жизнью поверх экрана: выпрыгивает пружиной, чуть качается,
// держится и растворяется. Ничего не перекрывает — тапы проходят насквозь,
// экран под ним доступен сразу.
//
// Используется там, где действие уже удалось: сплит создан, остаток закрыт.
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { STICKER, type StickerKey } from '@/components/EmptyState';
import { reduceMotion } from '@/lib/feedback';

/** Сколько стикер держится на экране до растворения. */
const HOLD_MS = 900;
const OUT_MS = 320;

interface Props {
  /** запустить показ */
  run: boolean;
  sticker: StickerKey;
  /** размер стороны; стикер вписывается по большей */
  size?: number;
  /** вызывается, когда стикер полностью ушёл */
  onDone?: () => void;
}

export function StickerBurst({ run, sticker, size = 168, onDone }: Props) {
  const v = useSharedValue(0);
  const out = useSharedValue(0);

  useEffect(() => {
    if (!run) {
      v.value = 0;
      out.value = 0;
      return;
    }
    if (reduceMotion()) {
      // без движения: короткий показ и уход, без пружин и качания
      v.value = 1;
      out.value = withDelay(HOLD_MS, withTiming(1, { duration: OUT_MS }, (done) => {
        'worklet';
        if (done && onDone) runOnJS(onDone)();
      }));
      return;
    }
    v.value = 0;
    out.value = 0;
    v.value = withSequence(
      withSpring(1, { damping: 11, stiffness: 190 }),
      withSpring(0.96, { damping: 14, stiffness: 150 }),
    );
    out.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: OUT_MS, easing: Easing.out(Easing.quad) }, (done) => {
        'worklet';
        if (done && onDone) runOnJS(onDone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const style = useAnimatedStyle(() => ({
    opacity: v.value * (1 - out.value),
    transform: [
      { scale: 0.55 + v.value * 0.45 + out.value * 0.12 },
      { translateY: (1 - v.value) * 22 - out.value * 26 },
      { rotate: `${(1 - v.value) * -8}deg` },
    ],
  }));

  if (!run) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={style}>
        <Image source={STICKER[sticker]} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
  },
});
