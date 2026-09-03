// Корешок чека того, кто ещё не оплатил (spec/11): оторванный кусок бумаги с
// зубцами сверху, строкой человека и двумя действиями — «Дать в долг» и ⚡.
//
// Пинг анимирован ровно как в макете (zapPulse + zapRing/zapRing2): кнопка
// проседает и разбухает, из неё расходятся два лаймовых кольца. Без этого тап
// по ⚡ выглядел бы как «ничего не произошло»: молния улетает мгновенно.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { TornEdge } from '@/components/bill/TornEdge';
import { money } from '@/lib/format';
import { reduceMotion } from '@/lib/feedback';
import { EASE_OUT_QUAD, EASE_POP } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/*
  zapSplit: корешок «отрывается» от чека, когда счёт только что разделили —
  выезжает сверху вниз, будто его отрезали от общего листа.

  zapMerge из макета: когда человек оплатил, его корешок уезжает вверх и
  растворяется — а строка тут же появляется в чеке. Получается один жест
  «кусок вернулся в чек», а не «одно исчезло, другое возникло».
*/
const SPLIT_OUT = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -46 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(700);

const MERGE_UP = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  30: { opacity: 1, transform: [{ translateY: -6 }, { scale: 1.02 }] },
  100: { opacity: 0, transform: [{ translateY: -46 }, { scale: 0.96 }] },
}).duration(520);

interface Props {
  contactId: string;
  name: string;
  initials?: string;
  color?: string;
  amount: number;
  width: number;
  /** последний корешок — низ скруглён, иначе снова зубцы */
  last: boolean;
  /** это моя доля: вместо «дать в долг» — «оплатить» */
  mine?: boolean;
  pinged?: boolean;
  /** порядковый номер: корешки отрываются от чека по очереди */
  index?: number;
  /** счёт только что разделили — корешки выезжают из чека */
  justSplit?: boolean;
  onLend: () => void;
  /** точка вылета молнии — экранные координаты нажатой кнопки */
  onPing: (from: { x: number; y: number } | null) => void;
}

export function UnpaidStub({
  contactId, name, initials, color, amount, width, last, mine, pinged, index = 0, justSplit, onLend, onPing,
}: Props) {
  const boltRef = useRef<React.ComponentRef<typeof View>>(null);
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  // одна волна на тап: кольцо расходится и гаснет
  const wave = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!pinged || reduceMotion()) return;
    wave.value = 0;
    wave.value = withTiming(1, { duration: 900, easing: EASE_OUT_QUAD });
    pulse.value = withSequence(
      withTiming(-0.15, { duration: 90 }),
      withTiming(0.18, { duration: 160, easing: EASE_POP }),
      withTiming(0, { duration: 200 }),
    );
  }, [pinged, wave, pulse]);

  const boltStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value }] }));
  const ring1 = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - wave.value),
    transform: [{ scale: 1 + wave.value * 1.6 }],
  }));
  const ring2 = useAnimatedStyle(() => ({
    opacity: 0.7 * Math.max(0, 1 - wave.value * 1.3),
    transform: [{ scale: 1 + wave.value * 2.4 }],
  }));

  return (
    <Animated.View
      style={styles.root}
      entering={justSplit && !reduceMotion() ? SPLIT_OUT.delay(index * 160) : undefined}
      exiting={reduceMotion() ? undefined : MERGE_UP}
    >
      <TornEdge color={colors.paper} side="top" width={width} />

      <View style={[styles.body, { backgroundColor: colors.paper }]}>
        <View style={styles.row}>
          <Avatar
            contactId={contactId}
            name={name}
            letter={initials}
            color={color ?? '#8A887E'}
            size={36}
            style={styles.face}
          />
          <View style={styles.text}>
            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.state, { color: colors.ember }]} numberOfLines={1}>
              {t('live.notPaidYet')}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.muted }]} numberOfLines={1}>{money(amount)}</Text>
        </View>

        <View style={styles.actions}>
          <PressableScale style={[styles.lend, { backgroundColor: fixed.lime }]} onPress={onLend}>
            <Text style={[styles.lendText, { color: fixed.ink }]} numberOfLines={1}>
              {mine ? t('live.payMine') : t('live.lend')}
            </Text>
          </PressableScale>

          <View ref={boltRef} collapsable={false}>
            <Animated.View style={boltStyle}>
            <PressableScale
              style={[styles.ping, { backgroundColor: fixed.ink }, pinged && styles.dimmed]}
              disabled={pinged}
              onPress={() => {
                // молния должна вылететь ровно из этой кнопки
                boltRef.current?.measureInWindow((x, y, w, h) =>
                  onPing({ x: x + w / 2, y: y + h / 2 }),
                );
              }}
            >
              <Animated.View style={[styles.wave, { borderColor: fixed.lime }, ring1]} pointerEvents="none" />
              <Animated.View style={[styles.wave, { borderColor: fixed.lime }, ring2]} pointerEvents="none" />
              <Text style={[styles.pingGlyph, { color: fixed.lime }]}>⚡</Text>
              </PressableScale>
            </Animated.View>
          </View>
        </View>
      </View>

      {last ? (
        <View style={[styles.foot, { backgroundColor: colors.paper }]} />
      ) : (
        <TornEdge color={colors.paper} side="bottom" width={width} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 14 },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  face: { opacity: 0.7 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.bold, fontSize: 13 },
  state: { fontFamily: font.semibold, fontSize: 10, marginTop: 2 },
  amount: { fontFamily: font.monoBold, fontSize: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 12 },
  lend: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lendText: { fontFamily: font.bold, fontSize: 12 },
  ping: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pingGlyph: { fontSize: 14 },
  wave: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999, borderWidth: 2 },
  dimmed: { opacity: 0.45 },
  foot: { height: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
});
