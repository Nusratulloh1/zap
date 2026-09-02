// Вход в приложение: вордмарк ZAP! раскручивается и уходит, открывая интерфейс.
//
// Что здесь важно и почему сделано именно так:
//
//   • Статичный launch screen системы совпадает с ПЕРВЫМ кадром анимации:
//     в LaunchScreen.storyboard лежит тот же вордмарк того же размера на том
//     же лайме. Иначе между ними виден скачок. По той же причине окно и
//     корневой вид RN покрашены в лайм (AppDelegate) — без этого в зазоре
//     между storyboard и первым кадром JS мелькал белый фон.
//   • Оверлей не задерживает запуск: он лежит ПОВЕРХ уже смонтированного
//     интерфейса и снимается, когда закончились и вращение, и загрузка сессии.
//   • Показывается один раз за холодный старт. При возврате из фона его быть
//     не должно — это не событие, а запуск.
import React, { useCallback, useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';

const WORDMARK = require('../../assets/brand/zap-wordmark-large.png');

/*
  Сколько полных оборотов делает вордмарк.

  Вордмарк — это текст, читаемый только в 0° и 360°; всё, что между, читается
  как перевёрнутая надпись. Поэтому оборотов должно быть мало: на трёх вход
  начинал выглядеть индикатором загрузки, а не подписью бренда.
*/
const TURNS = 2;
const SPIN_MS = 620;
/** Пауза после вращения, чтобы логотип «встал», прежде чем уйти. */
const HOLD_MS = 110;
const OUT_MS = 300;

interface Props {
  /** данные готовы — оверлею можно уходить */
  ready: boolean;
  onDone: () => void;
}

export function LaunchOverlay({ ready, onDone }: Props) {
  const { fixed } = useTheme();
  const still = reduceMotion();

  const spin = useSharedValue(0);
  // Стартуем из состояния покоя: ровно то, что уже нарисовал системный launch
  // screen. Появление «с нуля» дало бы моргание — логотип сначала исчез бы,
  // потом появился заново.
  const scale = useSharedValue(1);
  const veil = useSharedValue(1);

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    if (still) return;
    // Easing.out, а не inOut: на нескольких оборотах нужен резкий старт с
    // торможением к концу — так вращение читается как раскрутка и остановка,
    // а не как равномерно крутящийся индикатор загрузки.
    spin.value = withTiming(1, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) });
  }, [still, spin]);

  // Уходим только когда и вращение отыграло, и сессия определилась: иначе под
  // оверлеем окажется пустой экран, и вход превратится в мигание.
  useEffect(() => {
    if (!ready) return;
    const delay = still ? 0 : SPIN_MS + HOLD_MS;
    veil.value = withDelay(
      delay,
      withTiming(0, { duration: OUT_MS, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
    if (!still) {
      scale.value = withDelay(
        delay,
        withSequence(
          withTiming(1.05, { duration: 110, easing: Easing.out(Easing.quad) }),
          withTiming(1.13, { duration: OUT_MS, easing: Easing.in(Easing.quad) }),
        ),
      );
    }
  }, [ready, still, veil, scale, finish]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360 * TURNS}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: fixed.lime }, veilStyle]}
      pointerEvents="none"
    >
      <Animated.View style={markStyle}>
        <Image source={WORDMARK} style={styles.mark} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  // те же 150×100, что у картинки в LaunchScreen.storyboard
  mark: { width: 150, height: 100 },
});
