// ⚡ Split the Bill — подписная анимация ZAP (PRODUCT-VISION, часть A).
//
// Раскадровка из видения, суммарно 1150 мс:
//   0–150    чек сжимается 1 → 0.96
//   150–300  сверху вниз проходит яркая лаймовая молния
//   300–550  чек физически разрывается на 3–4 части
//   550–800  каждый кусок летит к аватару своего участника (со своей суммой)
//   800–1000 аватары получают лаймовое кольцо (заливка — PaidRing)
//   1000–1150 короткий ZAP! ⚡ и экран возвращается к обычному виду
//
// Звук zzzt-pop и один medium-haptic в момент разрыва — через lib/feedback.
//
// Как это работает технически: оверлей рисуется поверх экрана, позиции чека
// и аватаров измеряются через measure() на UI-потоке, куски летят
// transform'ами (translate/rotate/scale) — layout не трогаем, поэтому 60fps.
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useBillStage } from '@/lib/billStage';
import { cue, reduceMotion } from '@/lib/feedback';
import { money } from '@/lib/format';
import { SPLIT_TIMELINE as T } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** Кусок чека: куда лететь и что на нём написано. */
interface Piece {
  memberId: string;
  amount: number;
}

interface Props {
  /** запускается, когда становится true */
  run: boolean;
  pieces: Piece[];
  onDone: () => void;
}

/** Визуально чек рвётся на 3–4 куска, даже если участников больше. */
const MAX_PIECES = 4;

export function SplitTheBill({ run, pieces, onDone }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const stage = useBillStage();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // общий прогресс таймлайна 0 → 1150 мс
  const time = useSharedValue(0);
  // геометрия чека, измеренная на UI-потоке
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const rw = useSharedValue(0);
  const rh = useSharedValue(0);
  // цели кусков (до MAX_PIECES)
  const tx = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const ty = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  const visible = useSharedValue(0);

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  const shown = pieces.slice(0, MAX_PIECES);

  useEffect(() => {
    if (!run) return;

    // при «уменьшить движение» показываем результат без разрыва и полётов
    if (reduceMotion()) {
      const id = setTimeout(finish, 220);
      return () => clearTimeout(id);
    }

    const memberIds = shown.map((p) => p.memberId);

    // измеряем чек и аватары на UI-потоке: layout стабилен, значит один
    // проход measure() даёт корректные экранные координаты
    runOnUI(() => {
      'worklet';
      const receiptRef = stage?.receipt.current;
      if (receiptRef) {
        const m = measure(receiptRef);
        if (m) {
          rx.value = m.pageX;
          ry.value = m.pageY;
          rw.value = m.width;
          rh.value = m.height;
        }
      }
      for (let i = 0; i < memberIds.length && i < MAX_PIECES; i++) {
        const ref = stage?.members.get(memberIds[i] as string);
        const mm = ref ? measure(ref) : null;
        if (mm) {
          // цель — центр карточки участника
          tx[i]!.value = mm.pageX + mm.width / 2;
          ty[i]!.value = mm.pageY + mm.height / 2;
        }
      }
    })();

    visible.value = 1;
    time.value = 0;
    time.value = withTiming(T.total, { duration: T.total, easing: Easing.linear }, (done) => {
      'worklet';
      if (done) {
        visible.value = 0;
        runOnJS(finish)();
      }
    });

    // разрыв — единственный тактильный момент анимации (medium, один раз)
    const tearAt = setTimeout(() => cue('split'), T.tear.at);
    return () => clearTimeout(tearAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  // ---- слои таймлайна -----------------------------------------------------

  const rootStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    pointerEvents: visible.value ? 'auto' : 'none',
  }));

  /** Сам чек: сжимается, затем исчезает в момент разрыва (его сменяют куски). */
  const receiptStyle = useAnimatedStyle(() => {
    const squeeze = interpolate(time.value, [0, T.squeeze.dur], [1, 0.96], 'clamp');
    const gone = time.value >= T.tear.at ? 0 : 1;
    return {
      left: rx.value,
      top: ry.value,
      width: rw.value,
      height: rh.value,
      opacity: gone,
      transform: [{ scale: squeeze }],
    };
  });

  /** Лаймовая молния: проходит по центру чека сверху вниз за 150 мс. */
  const boltStyle = useAnimatedStyle(() => {
    const p = interpolate(time.value, [T.bolt.at, T.bolt.at + T.bolt.dur], [0, 1], 'clamp');
    const alive = time.value >= T.bolt.at && time.value <= T.tear.at + 60;
    return {
      left: rx.value,
      top: ry.value + p * rh.value,
      width: rw.value,
      opacity: alive ? interpolate(p, [0, 0.2, 0.85, 1], [0, 1, 1, 0]) : 0,
    };
  });

  /** Вспышка ZAP! в конце. */
  const flashStyle = useAnimatedStyle(() => {
    const p = interpolate(time.value, [T.flash.at, T.flash.at + T.flash.dur], [0, 1], 'clamp');
    return {
      opacity: interpolate(p, [0, 0.3, 1], [0, 1, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [0.9, 1.15]) }],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill as object, styles.root, rootStyle]} pointerEvents="none">
      {/* фантом чека: сжимается и уходит, когда появляются куски */}
      <Animated.View style={[styles.receipt, { backgroundColor: colors.paper }, receiptStyle]} />

      {/* молния */}
      <Animated.View style={[styles.bolt, { backgroundColor: fixed.lime }, boltStyle]} />

      {/* куски чека: разлетаются и летят к своим аватарам */}
      {shown.map((piece, i) => (
        <PieceView
          key={piece.memberId}
          index={i}
          count={shown.length}
          amount={piece.amount}
          time={time}
          rx={rx}
          ry={ry}
          rw={rw}
          rh={rh}
          tx={tx[i]!}
          ty={ty[i]!}
        />
      ))}

      {/* ZAP! */}
      <Animated.View
        style={[styles.flash, { left: screenW / 2 - 90, top: screenH / 2 - 60 }, flashStyle]}
        pointerEvents="none"
      >
        <View style={[styles.flashBurst, { backgroundColor: fixed.lime }]} />
        <Text style={[styles.flashText, { color: fixed.ink }]}>{t('live.zapFlash')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Один кусок чека. Появляется в момент разрыва на своей полосе исходного
 * чека, слегка разлетается, затем летит к аватару участника, унося
 * его сумму (по видению: «Islam — 85 000 / Aziz — 120 000»).
 */
function PieceView({
  index,
  count,
  amount,
  time,
  rx,
  ry,
  rw,
  rh,
  tx,
  ty,
}: {
  index: number;
  count: number;
  amount: number;
  time: SharedValue<number>;
  rx: SharedValue<number>;
  ry: SharedValue<number>;
  rw: SharedValue<number>;
  rh: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}) {
  const { colors, fixed } = useTheme();
  // куски разлетаются веером: крайние сильнее
  const spread = (index - (count - 1) / 2) * 26;

  const style = useAnimatedStyle(() => {
    const h = rh.value / Math.max(1, count);
    const startX = rx.value;
    const startY = ry.value + h * index;

    // 300–550: разрыв (кусок «отваливается» и чуть поворачивается)
    const tear = interpolate(time.value, [T.tear.at, T.tear.at + T.tear.dur], [0, 1], 'clamp');
    // 550–800: полёт к аватару
    const fly = interpolate(time.value, [T.fly.at, T.fly.at + T.fly.dur], [0, 1], 'clamp');

    const midX = startX + spread * tear;
    const midY = startY + 10 * tear;
    const x = midX + (tx.value - rw.value / 2 - midX) * fly;
    const y = midY + (ty.value - h / 2 - midY) * fly;

    return {
      left: 0,
      top: 0,
      width: rw.value,
      height: h,
      opacity: time.value < T.tear.at ? 0 : interpolate(fly, [0, 0.75, 1], [1, 1, 0]),
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${spread * 0.12 * tear + spread * 0.2 * fly}deg` },
        { scale: interpolate(fly, [0, 1], [1, 0.42]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.piece, { backgroundColor: colors.paper, borderColor: colors.hairline }, style]}>
      <Text style={[styles.pieceAmount, { color: fixed.ink }]} numberOfLines={1}>
        {money(amount)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50 },
  receipt: { position: 'absolute', borderRadius: 28 },
  bolt: { position: 'absolute', height: 4, borderRadius: 999 },
  piece: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  pieceAmount: { fontFamily: font.monoBold, fontSize: 15 },
  flash: { position: 'absolute', width: 180, height: 120, alignItems: 'center', justifyContent: 'center' },
  flashBurst: { position: 'absolute', width: 150, height: 96, borderRadius: 28, transform: [{ rotate: '-6deg' }] },
  flashText: { fontFamily: font.extrabold, fontSize: 42, letterSpacing: -1.5 },
});
