// 📷 QR → счёт: «код превращается в чек» (vision, часть A + часть C §20).
//
// Ключевая мысль видения: пользователь не должен почувствовать
// QR → loading → страница. Он должен увидеть, как код физически становится
// счётом. Такты идут ПОСЛЕДОВАТЕЛЬНО (QR_TIMELINE):
//
//   1. углы видоискателя садятся на реальный прямоугольник кода;
//   2. по коду проходит лаймовая линия;
//   3. код целиком лаймовый и держится 200 мс — «поймал»;
//   4. этот же прямоугольник РАСТЁТ в чек, лайм на нём растворяется;
//   5. чек занимает экран, и под ним меняется сам экран.
//
// Всё движение — ТОЛЬКО transform (translate/scale).
//
// Первая версия анимировала left/top/width/height: каждый кадр пересчитывался
// layout, картинка «прыгала» между тактами, а на среднем телефоне экран
// вставал колом. Поэтому каждый слой имеет фиксированный размер и ставится на
// место сдвигом и масштабом относительно своего центра.
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  measure,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import { reduceMotion } from '@/lib/feedback';
import { QR_TIMELINE as T } from '@/lib/motion';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** Углы видоискателя, которые схлопываются на код. */
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
type Corner = (typeof CORNERS)[number];

/** Сторона уголка. */
const SIZE = 40;

/** База для слоёв, привязанных к коду: ставим 100×100 и масштабируем под факт. */
const BASE = 100;

/** Внутреннее представление прямоугольника. */
const WORDMARK = require('../../../assets/brand/zap-wordmark-large.png');

type Rect = { x: number; y: number; w: number; h: number };

interface Props {
  /** запустить раскадровку */
  run: boolean;
  /** рамка сканера — запасная геометрия, если детектор не дал координат */
  frameRef: AnimatedRef<View>;
  /** сумма чека, если она уже известна из кода — видение просит её показать */
  amount?: number;
  /** бумага заняла экран — пора менять экран под ней */
  onHandoff: () => void;
}

/**
 * Откуда стартует превращение.
 *
 * Здесь была попытка использовать прямоугольник кода от детектора. От неё
 * пришлось отказаться: vision-camera отдаёт его в координатах кадра анализа,
 * а не в dp экрана, и пересчёт зависит от разрешения потока, поворота и
 * кропа под resizeMode="cover". На проверке одно и то же устройство давало
 * то смещение вправо, то в верхний угол — превращение начиналось там, где
 * кода нет. Подгонять это под каждую модель телефона смысла нет.
 *
 * Берём видоискатель: пользователь наводит код именно в рамку, поэтому её
 * центр — и есть место, где код виден. Небольшой квадрат внутри рамки
 * читается как «поймали код», и результат одинаково верен на любом телефоне.
 *
 * Если координаты детектора когда-нибудь станут надёжными, вернуть их можно
 * здесь одной строкой — остальная раскадровка от источника не зависит.
 */
function resolveBox(vf: Rect): Rect {
  'worklet';
  const side = vf.w * 0.52;
  return { x: vf.x + (vf.w - side) / 2, y: vf.y + (vf.h - side) / 2, w: side, h: side };
}

/** Прогресс отрезка раскадровки: 0..1 внутри своего окна времени. */
function seg(time: number, at: number, dur: number): number {
  'worklet';
  return interpolate(time, [at, at + dur], [0, 1], 'clamp');
}

export function QrToReceipt({ run, frameRef, amount, onHandoff }: Props) {
  const { colors, fixed } = useTheme();
  const { width, height } = useWindowDimensions();

  const time = useSharedValue(0);
  const ready = useSharedValue(0);
  const view = useSharedValue<Rect>({ x: 0, y: 0, w: 232, h: 232 });
  const box = useSharedValue<Rect>({ x: 0, y: 0, w: 232, h: 232 });

  // промежуточная цель морфа — карточка чека: узкая и высокая, как лента
  const rw = Math.min(width - 64, 300);
  const rh = Math.min(height * 0.5, 400);

  useEffect(() => {
    if (!run) {
      ready.value = 0;
      time.value = 0;
      return;
    }
    if (reduceMotion()) {
      // «уменьшить движение»: без вспышки и морфа — короткий переход
      const quick = setTimeout(onHandoff, 160);
      return () => clearTimeout(quick);
    }

    runOnUI(() => {
      'worklet';
      const m = measure(frameRef);
      const vr: Rect = m
        ? { x: m.pageX, y: m.pageY, w: m.width, h: m.height }
        : { x: 0, y: 0, w: 232, h: 232 };
      view.value = vr;
      box.value = resolveBox(vr);
      // диагностика происхождения морфа: из кода или из запасной рамки
      ready.value = 1;
      time.value = 0;
      // Часы раскадровки идут РОВНО, как в Split the Bill и Everyone Paid.
      //
      // Здесь стоял EASE_ZAP, и это ломало всю раскадровку: сильный ease-out
      // проглатывал первые такты за несколько кадров — углы не летели на код,
      // а прыгали, — после чего остаток тянулся. Смягчение живёт внутри
      // тактов, а не в самом времени.
      time.value = withTiming(T.total, { duration: T.total, easing: Easing.linear });
    })();

    // удар ровно на вспышке — «поймал», и лёгкий тик, когда бумага встала
    const hit = setTimeout(
      () => trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
      T.flash.at,
    );
    const tick = setTimeout(
      () => trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false }),
      T.morph.at + T.morph.dur,
    );
    const id = setTimeout(onHandoff, T.handoff);
    return () => {
      clearTimeout(hit);
      clearTimeout(tick);
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  /** Затемнение: кадр с кодом должен оставаться видимым, поэтому не глубже 0.42. */
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: ready.value * seg(time.value, T.corners.at, T.corners.dur) * 0.42,
  }));

  /**
   * Все слои привязаны к экрану через left:0/top:0 и ставятся сдвигом —
   * ровно так же, как уголки, которые попадают на код точно.
   *
   * Раньше бумага лежала во flex-контейнере по центру, и её положение
   * считалось от центра экрана через useWindowDimensions. Любое расхождение
   * между этой высотой и реальной высотой контейнера уводило старт морфа в
   * сторону — превращение начиналось не с кода. Теперь система координат
   * одна на все слои.
   */

  /** Лаймовая линия идёт по коду сверху вниз. */
  const sweepStyle = useAnimatedStyle(() => {
    const p = seg(time.value, T.sweep.at, T.sweep.dur);
    const b = box.value;
    return {
      opacity: ready.value * interpolate(p, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: b.x + b.w / 2 - BASE / 2 },
        { translateY: b.y + p * b.h },
        { scaleX: b.w / BASE },
      ],
    };
  });

  /** Код целиком лаймовый; гаснет не сам, а передавая цвет бумаге. */
  const flashStyle = useAnimatedStyle(() => {
    const p = seg(time.value, T.flash.at, T.flash.dur);
    const b = box.value;
    const fade = 1 - seg(time.value, T.morph.at, T.morph.dur * 0.35);
    return {
      opacity: ready.value * interpolate(p, [0, 0.2, 1], [0, 1, 1]) * fade,
      transform: [
        { translateX: b.x + b.w / 2 - BASE / 2 },
        { translateY: b.y + b.h / 2 - BASE / 2 },
        { scaleX: b.w / BASE },
        { scaleY: b.h / BASE },
      ],
    };
  });

  /**
   * Ключевой такт: прямоугольник кода растёт в чек, затем чек — в экран.
   * Карточка лежит в левом верхнем углу и ставится сдвигом, как уголки.
   */
  const paperStyle = useAnimatedStyle(() => {
    const b = box.value;
    const m = seg(time.value, T.morph.at, T.morph.dur);
    const st = seg(time.value, T.settle.at, T.settle.dur);

    // старт — точно на коде; цель морфа — карточка по центру экрана
    const tx0 = b.x + b.w / 2 - rw / 2;
    const ty0 = b.y + b.h / 2 - rh / 2;
    const txC = width / 2 - rw / 2;
    const tyC = height / 2 - rh / 2;

    const tx = interpolate(m, [0, 1], [tx0, txC]);
    const ty = interpolate(m, [0, 1], [ty0, tyC]);
    const sx = interpolate(m, [0, 1], [b.w / rw, 1]);
    const sy = interpolate(m, [0, 1], [b.h / rh, 1]);

    return {
      opacity: ready.value * interpolate(m, [0, 0.08], [0, 1], 'clamp'),
      transform: [
        { translateX: interpolate(st, [0, 1], [tx, txC]) },
        { translateY: interpolate(st, [0, 1], [ty, tyC]) },
        { scaleX: interpolate(st, [0, 1], [sx, width / rw]) },
        { scaleY: interpolate(st, [0, 1], [sy, height / rh]) },
      ],
    };
  });

  /**
   * ZAP! — по видению появляется ровно в момент, когда карточка счёта
   * «выезжает» из кода: всплывает на границе вспышки и морфа и уходит,
   * когда бумага занимает экран.
   */
  const zapStyle = useAnimatedStyle(() => {
    const p = seg(time.value, T.morph.at - 60, 260);
    const out = seg(time.value, T.settle.at, T.settle.dur * 0.6);
    return {
      opacity: ready.value * p * (1 - out),
      transform: [
        { scale: interpolate(p, [0, 0.6, 1], [0.5, 1.12, 1]) },
        { translateY: interpolate(p, [0, 1], [18, 0]) - out * 24 },
      ],
    };
  });

  /** Лайм кода ещё лежит на бумаге и растворяется — это и есть переход. */
  const tintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(seg(time.value, T.morph.at, T.morph.dur), [0, 0.45, 1], [1, 0.5, 0], 'clamp'),
  }));

  /** Содержимое проступает на морфе и гаснет, когда бумага займёт экран. */
  const inkStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(seg(time.value, T.morph.at, T.morph.dur), [0.45, 1], [0, 1], 'clamp') *
      (1 - interpolate(seg(time.value, T.settle.at, T.settle.dur), [0, 0.7], [0, 1], 'clamp')),
  }));

  if (!run) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.fill, scrimStyle]} />

      {CORNERS.map((c) => (
        <CornerBracket key={c} corner={c} time={time} ready={ready} view={view} box={box} color={fixed.lime} />
      ))}

      <Animated.View style={[styles.flash, { backgroundColor: fixed.lime }, flashStyle]} />
      <Animated.View style={[styles.sweep, { backgroundColor: fixed.lime }, sweepStyle]} />

      <Animated.View
        style={[styles.paper, { width: rw, height: rh, backgroundColor: colors.paper }, paperStyle]}
      >
          <Animated.View style={[styles.fillAbs, { backgroundColor: fixed.lime }, tintStyle]} />
          {/* набросок чека: шапка, линия отрыва, строки — узнаётся как бумага */}
          <Animated.View style={[styles.ink, inkStyle]}>
            <View style={[styles.logo, { backgroundColor: colors.ink }]} />
            <View style={[styles.lineWide, { backgroundColor: colors.pebble }]} />
            <View style={[styles.tear, { borderColor: colors.hairline }]} />
            {amount && amount > 0 ? (
              <Text style={[styles.amount, { color: colors.ink }]} numberOfLines={1}>
                {money(amount)}
              </Text>
            ) : (
              <View style={[styles.lineAmount, { backgroundColor: colors.pebble }]} />
            )}
            <View style={[styles.lineThin, { backgroundColor: colors.hairline }]} />
          </Animated.View>
        </Animated.View>

      {/* ZAP! рядом с выезжающим чеком — как в видении, вордмарком, не текстом */}
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={zapStyle}>
          <Image source={WORDMARK} style={styles.zap} resizeMode="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * Один уголок: летит со своего места на соответствующий угол кода и гаснет,
 * когда по коду проходит лайм. Отдельным компонентом — чтобы хук анимации был
 * свой у каждого и не зависел от порядка рендера списка.
 */
function CornerBracket({
  corner,
  time,
  ready,
  view,
  box,
  color,
}: {
  corner: Corner;
  time: SharedValue<number>;
  ready: SharedValue<number>;
  view: SharedValue<Rect>;
  box: SharedValue<Rect>;
  color: string;
}) {
  const isLeft = corner === 'tl' || corner === 'bl';
  const isTop = corner === 'tl' || corner === 'tr';

  const style = useAnimatedStyle(() => {
    const p = seg(time.value, T.corners.at, T.corners.dur);
    const v = view.value;
    const b = box.value;
    const fromX = isLeft ? v.x : v.x + v.w - SIZE;
    const fromY = isTop ? v.y : v.y + v.h - SIZE;
    const toX = isLeft ? b.x : b.x + b.w - SIZE;
    const toY = isTop ? b.y : b.y + b.h - SIZE;
    return {
      opacity: ready.value * interpolate(time.value, [T.sweep.at, T.flash.at], [1, 0], 'clamp'),
      transform: [
        { translateX: interpolate(p, [0, 1], [fromX, toX]) },
        { translateY: interpolate(p, [0, 1], [fromY, toY]) },
        { scale: interpolate(p, [0, 1], [1, 0.72]) },
      ],
    };
  });

  const edges =
    corner === 'tl'
      ? { borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 }
      : corner === 'tr'
        ? { borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 }
        : corner === 'bl'
          ? { borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 }
          : { borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 };

  return <Animated.View style={[styles.bracket, edges, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000000' },
  fillAbs: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // уголки ставятся сдвигом от левого верхнего угла экрана
  bracket: { position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sweep: { position: 'absolute', left: 0, top: 0, width: BASE, height: 3, borderRadius: 999 },
  flash: { position: 'absolute', left: 0, top: 0, width: BASE, height: BASE, borderRadius: 18 },
  paper: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', borderRadius: 20 },
  ink: { padding: 18, gap: 12 },
  amount: { fontFamily: font.monoBold, fontSize: 30, letterSpacing: -1 },
  zap: { width: 168, height: 112 },
  logo: { width: 44, height: 44, borderRadius: 14 },
  lineWide: { width: '62%', height: 14, borderRadius: 7 },
  tear: { borderTopWidth: 2, borderStyle: 'dashed', marginVertical: 4 },
  lineAmount: { width: '46%', height: 26, borderRadius: 8 },
  lineThin: { width: '34%', height: 10, borderRadius: 5 },
});
