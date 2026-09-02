// Вход в приложение: вордмарк ZAP! собирается и уходит, открывая интерфейс.
//
// Как это делают в приложениях, где вход ощущается «дорого» (Duolingo,
// Revolut, Monzo), и что из этого важно:
//
//   • Статичный launch screen системы должен совпадать с ПЕРВЫМ кадром
//     анимации. Иначе между ними виден скачок, и вся затея читается как
//     подтормаживание. Поэтому в LaunchScreen.storyboard лежит тот же
//     вордмарк на том же лайме, а оверлей стартует ровно с него.
//   • Анимация не должна задерживать приложение. Оверлей лежит ПОВЕРХ уже
//     смонтированного интерфейса и снимается, когда закончился и он сам, и
//     загрузка сессии — что дольше, то и определяет момент.
//   • Меньше секунды. Звуковые и визуальные логотипы длиннее секунды
//     перестают быть подписью бренда и начинают быть ожиданием.
//   • Показывается один раз за холодный старт. При возврате из фона его быть
//     не должно — это не событие, а запуск.
import React, { useCallback, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { cue, reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';

const WORDMARK = require('../../assets/brand/zap-wordmark-large.png');

/** Держим общую длительность в пределах, за которыми вход читается как ожидание. */
const HOLD_MS = 260;
const OUT_MS = 320;

interface Props {
  /** данные готовы — оверлею можно уходить */
  ready: boolean;
  onDone: () => void;
}

export function LaunchOverlay({ ready, onDone }: Props) {
  const { fixed } = useTheme();
  const still = reduceMotion();

  // Стартуем НЕ с нуля, а с состояния покоя: ровно то, что уже нарисовал
  // системный launch screen. Появление «с нуля» дало бы моргание — логотип
  // сначала исчез бы, потом появился заново.
  const mark = useSharedValue(1);
  const bolt = useSharedValue(0);
  const strike = useSharedValue(0);
  const veil = useSharedValue(1);

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    if (still) {
      bolt.value = 1;
      strike.value = 1;
      return;
    }
    // Короткая «подсадка» — вордмарк чуть уходит и возвращается пружиной.
    // Это и читается как «собрался», при этом кадр перехода со статичного
    // экрана остаётся тем же.
    mark.value = withSequence(
      withTiming(0.94, { duration: 120, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 200, mass: 0.7 }),
    );
    // блик-молния проходит по вордмарку слева направо, как в ZapLoader
    bolt.value = withDelay(120, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    // Разряд бьёт вниз прямо из-под вордмарка. Быстро — молния не «выезжает»,
    // а появляется целиком; поэтому короткий timing, а не пружина.
    strike.value = withDelay(150, withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }));
    cue('launch');
  }, [still, mark, bolt, strike]);

  // Уходим только когда и анимация отыграла, и сессия определилась: иначе под
  // оверлеем окажется пустой экран, и «дорогой» вход превратится в мигание.
  useEffect(() => {
    if (!ready) return;
    veil.value = withDelay(
      still ? 0 : HOLD_MS,
      withTiming(0, { duration: OUT_MS, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
    if (!still) {
      mark.value = withDelay(HOLD_MS, withSequence(
        withTiming(1.06, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1.14, { duration: OUT_MS, easing: Easing.in(Easing.quad) }),
      ));
    }
  }, [ready, still, veil, mark, finish]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: mark.value }] }));
  const strikeStyle = useAnimatedStyle(() => ({
    opacity: strike.value,
    // растёт из основания вордмарка вниз
    transform: [{ scaleY: 0.35 + 0.65 * strike.value }],
  }));
  const boltStyle = useAnimatedStyle(() => ({
    // блик идёт по вордмарку и гаснет к концу прохода
    opacity: bolt.value < 0.5 ? bolt.value * 1.6 : (1 - bolt.value) * 1.6,
    transform: [{ translateX: -120 + 240 * bolt.value }, { rotate: '14deg' }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: fixed.lime }, veilStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.stack, markStyle]}>
        <View style={styles.markClip}>
          <Image source={WORDMARK} style={styles.mark} resizeMode="contain" />
          <Animated.View style={[styles.bolt, boltStyle]} />
        </View>
        {/*
          Молния начинается вплотную к вордмарку — отрицательный отступ
          съедает прозрачные поля PNG, иначе между ними остаётся зазор,
          и удар читается как отдельная картинка рядом.
        */}
        <Animated.View style={[styles.strike, strikeStyle]}>
          <Svg width={54} height={76} viewBox="0 0 54 76">
            <Path
              d="M30 0 L8 40 H24 L18 76 L46 30 H28 L36 0 Z"
              fill={fixed.lime}
              stroke="#111110"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  stack: { alignItems: 'center' },
  markClip: { overflow: 'hidden' },
  // те же 150×100, что у картинки в LaunchScreen.storyboard
  mark: { width: 150, height: 100 },
  // вплотную к вордмарку: −18 гасит прозрачные поля картинки
  strike: { marginTop: -18, transformOrigin: 'top' },
  bolt: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 34,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
