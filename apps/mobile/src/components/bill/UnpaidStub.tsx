// Корешок чека того, кто ещё не оплатил (spec/11): оторванный кусок бумаги с
// зубцами сверху, строкой человека и двумя действиями — «Дать в долг» и ⚡.
//
// Пинг анимирован ровно как в макете (zapPulse + zapRing/zapRing2): кнопка
// проседает и разбухает, из неё расходятся два лаймовых кольца. Без этого тап
// по ⚡ выглядел бы как «ничего не произошло»: молния улетает мгновенно.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { PingButton } from '@/components/PingButton';
import { PressableScale } from '@/components/PressableScale';
import { TornEdge } from '@/components/bill/TornEdge';
import { money } from '@/lib/format';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/*
  zapSplit: корешок отрывается от чека — выезжает из-под него, вырастая в
  высоту от нуля (в макете это max-height 0 → 160 при overflow:hidden). Без
  роста высоты корешок просто съезжал поверх чека, и «отрыва» не читалось:
  бумага должна выходить из-под бумаги.

  zapMerge из макета: когда человек оплатил, его корешок уезжает вверх и
  растворяется — а строка тут же появляется в чеке. Получается один жест
  «кусок вернулся в чек», а не «одно исчезло, другое возникло».
*/
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
  /** проиграть отрыв от чека */
  justSplit?: boolean;
  /** задержка перед отрывом, мс (после подписной анимации разделения) */
  delay?: number;
  onLend: () => void;
  /** точка вылета молнии — экранные координаты нажатой кнопки */
  onPing: (from: { x: number; y: number } | null) => void;
}

export function UnpaidStub({
  contactId, name, initials, color, amount, width, last, mine, pinged, index = 0, justSplit, delay = 0,
  onLend, onPing,
}: Props) {
  const boltRef = useRef<React.ComponentRef<typeof View>>(null);

  /*
    Высоту знаем только после раскладки, поэтому обёртка режет содержимое по
    анимируемой высоте, а сам корешок сообщает свою через onLayout.
  */
  const [full, setFull] = useState(0);
  const play = justSplit && !reduceMotion();
  const grow = useSharedValue(play ? 0 : -1);

  useEffect(() => {
    if (!full || !play) return;
    grow.value = 0;
    grow.value = withDelay(
      delay + index * 160,
      withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
    );
  }, [full, play, grow, delay, index]);

  const tear = useAnimatedStyle(() => ({
    // -1 — анимации нет: высоту не трогаем, чтобы не мешать раскладке
    height: grow.value < 0 || !full ? undefined : full * grow.value,
    // до первой раскладки высота неизвестна — прячем, иначе мелькнёт целиком
    opacity: grow.value < 0 ? 1 : full ? Math.min(1, grow.value * 2.2) : 0,
  }));

  const slide = useAnimatedStyle(() => ({
    transform: [
      { translateY: grow.value < 0 ? 0 : (1 - grow.value) * -46 },
      { scale: grow.value < 0 ? 1 : 0.96 + grow.value * 0.04 },
    ],
  }));
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  return (
    <Animated.View style={[styles.root, tear]} exiting={reduceMotion() ? undefined : MERGE_UP}>
      <Animated.View onLayout={(e) => setFull((h) => h || e.nativeEvent.layout.height)} style={slide}>
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
              <PingButton
                pinged={pinged}
                onPress={() => {
                  // молния должна вылететь ровно из этой кнопки
                  boltRef.current?.measureInWindow((x, y, w, h) =>
                    onPing({ x: x + w / 2, y: y + h / 2 }),
                  );
                }}
              />
            </View>
          </View>
        </View>

        {last ? (
          <View style={[styles.foot, { backgroundColor: colors.paper }]} />
        ) : (
          <TornEdge color={colors.paper} side="bottom" width={width} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 14, overflow: 'hidden' },
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
  foot: { height: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
});
