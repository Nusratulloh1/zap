// Карточка участника живого счёта — «показывай лица намного больше»
// (vision, часть C §4): аватар крупный, деньги вторичны.
//
// Состояния (часть B §2, часть C §5 «Who's left?»):
//   оплатил  — яркое лаймовое кольцо и ✓, подпись «{name} zapped ⚡»
//   ждём     — приглушённый серый, 👀 и кнопка «⚡ Пингануть»
// Никаких красных алертов: мозг сам видит незакрытый цикл.
//
// Раскладка — ОДНА строка: лицо, имя с деньгами, действия справа. Реакции
// показываются отдельной строкой только когда они есть: пустая строка под
// каждым участником растягивала карточку вдвое и оставляла половину пустой.
//
// Узел зарегистрирован в BillStage: к нему полетит кусок чека (Split the
// Bill) и здесь же будет заполняться кольцо (Friend Paid).
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { PaidRing } from '@/components/bill/PaidRing';
import { PressableScale } from '@/components/PressableScale';
import { useBillStage } from '@/lib/billStage';
import { reduceMotion } from '@/lib/feedback';
import { SPRING_GENTLE, SPRING_SNAPPY } from '@/lib/motion';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius } from '@/theme/tokens';
import type { SplitReaction } from '@zap/shared/types';

export const REACTIONS = ['⚡', '😂', '❤️', '🫡', '🤝'] as const;

/** Шаг выезда эмодзи в вертикальной палитре. */
const PICK_STEP_MS = 34;

interface Props {
  memberId: string;
  contactId: string;
  name: string;
  initials?: string;
  color: string;
  amount: number;
  paid: boolean;
  isYou?: boolean;
  /** ссылка отправлена, но человек ещё не оплатил */
  opened?: boolean;
  /** долю закрыл организатор */
  covered?: boolean;
  pinged?: boolean;
  /** задержка заливки кольца — Split the Bill зажигает их по очереди */
  ringDelay?: number;
  reactions: SplitReaction[];
  myUserId?: string;
  onPing?: () => void;
  onReact?: (emoji: string) => void;
}

export function MemberOrb({
  memberId,
  contactId,
  name,
  initials,
  color,
  amount,
  paid,
  isYou,
  opened,
  covered,
  pinged,
  ringDelay,
  reactions,
  myUserId,
  onPing,
  onReact,
}: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const stage = useBillStage();
  const ref = useAnimatedRef<View>();

  useEffect(() => {
    stage?.setMember(memberId, ref);
    return () => stage?.setMember(memberId, null);
  }, [stage, memberId, ref]);

  const mine = reactions.find((r) => r.fromUserId === myUserId)?.emoji;
  const [open, setOpen] = React.useState(false);

  // Карточка подпрыгивает ровно в тот момент, когда друг закрыл свою долю:
  // без этого «оплатил» приезжает по сокету и меняет текст молча.
  const pop = useSharedValue(0);
  const wasPaid = useRef(paid);
  useEffect(() => {
    if (paid && !wasPaid.current && !reduceMotion()) {
      pop.value = 0;
      pop.value = withDelay(
        ringDelay ?? 0,
        withSequence(withSpring(1, SPRING_SNAPPY), withSpring(0, SPRING_GENTLE)),
      );
    }
    wasPaid.current = paid;
  }, [paid, pop, ringDelay]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.03 }, { translateY: -pop.value * 3 }],
  }));

  // Прилетела молния «пинга»: аватар вздрагивает влево-вправо (vision §Reminder).
  const shake = useSharedValue(0);
  const wasPinged = useRef(pinged);
  useEffect(() => {
    if (pinged && !wasPinged.current && !reduceMotion()) {
      shake.value = 0;
      shake.value = withSequence(
        withTiming(-1, { duration: 55 }),
        withTiming(1, { duration: 70 }),
        withTiming(-0.6, { duration: 60 }),
        withSpring(0, SPRING_SNAPPY),
      );
    }
    wasPinged.current = pinged;
  }, [pinged, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 7 }, { rotate: `${shake.value * 5}deg` }],
  }));

  // Имя может не приехать («?»). Для «вы» показываем «Вы», чужим — молнию в
  // кружке; голый суффикс «· вы» без имени выглядел как обрыв строки.
  const noName = !name.trim() || name.trim() === '?';
  const shownName = noName ? (isYou ? t('common.you') : '') : name;
  const avatarLetter = noName ? '⚡' : initials;

  const state = paid
    ? covered
      ? t('live.debtCovered')
      : isYou
        ? t('live.youZapped')
        : t('live.zapped', { name })
    : opened
      ? t('live.openedLink')
      : '👀';

  return (
    <Animated.View ref={ref} style={[styles.root, { backgroundColor: colors.paper }, popStyle]}>
      <View style={styles.faceRow}>
        {/* кольцо заполняется лаймом по окружности — это и есть Friend Paid */}
        <Animated.View style={[!paid ? styles.dim : undefined, shakeStyle]}>
          <PaidRing size={70} paid={paid} limeColor={fixed.lime} idleColor={colors.pebble} delay={ringDelay}>
            <Avatar name={name} letter={avatarLetter} contactId={contactId} color={color} size={58} />
          </PaidRing>
          {paid ? (
            <View style={[styles.check, { backgroundColor: fixed.lime, borderColor: colors.paper }]}>
              <Text style={[styles.checkGlyph, { color: fixed.ink }]}>✓</Text>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
            {shownName}
            {isYou && shownName !== t('common.you') ? t('live.youSuffix') : ''}
          </Text>
          {/* деньги — вторичны, поэтому мелко и приглушённо */}
          <Text style={[styles.amount, { color: colors.faint }]} numberOfLines={1}>
            {money(amount)}
          </Text>
          <Text style={[styles.state, { color: paid ? colors.slate : colors.muted }]} numberOfLines={1}>
            {state}
          </Text>
        </View>

        {/* справа от лица — только реакция; «Пингануть» живёт ниже, в колонке
            имени: пилюля рядом с именем оставляла от «Shoshiy» одно «Shos…» */}
        <PressableScale
          small
          accessibilityLabel={t('live.reactAria')}
          style={[styles.reactBtn, { backgroundColor: mine ? fixed.lime : colors.sand }]}
          onPress={() => setOpen((v) => !v)}
        >
          <Text style={styles.reactBtnText}>{mine ?? '⚡'}</Text>
        </PressableScale>
      </View>

      {!paid && onPing ? (
        <PressableScale
          small
          disabled={pinged}
          style={[styles.ping, { backgroundColor: pinged ? colors.sand : fixed.ink }]}
          onPress={onPing}
        >
          <Text style={[styles.pingText, { color: pinged ? colors.muted : fixed.lime }]}>
            {pinged ? t('live.pinged') : t('live.pingAction')}
          </Text>
        </PressableScale>
      ) : null}

      {/* реакции прямо на деньги (vision §16) — строка есть только когда есть что показать */}
      {reactions.length ? (
        <Animated.View
          entering={reduceMotion() ? undefined : FadeIn.duration(180)}
          style={styles.reactedList}
        >
          {reactions.slice(0, 4).map((r, i) => (
            <View key={r.fromUserId + i} style={[styles.reacted, { backgroundColor: colors.sand }]}>
              <Text style={styles.reactedEmoji}>{r.emoji}</Text>
              <Text style={[styles.reactedName, { color: colors.muted }]} numberOfLines={1}>
                {r.fromName}
              </Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {/* Палитра как в Telegram: столбиком вверх от кнопки, эмодзи выезжают по очереди */}
      {open ? (
        <>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" />
          <Animated.View
            entering={reduceMotion() ? undefined : FadeIn.duration(120)}
            exiting={reduceMotion() ? undefined : FadeOut.duration(110)}
            style={[styles.picker, { backgroundColor: colors.paper, shadowColor: fixed.ink }]}
          >
            {REACTIONS.map((e, i) => (
              <PickItem
                key={e}
                emoji={e}
                index={i}
                active={mine === e}
                lime={fixed.lime}
                onPress={() => {
                  setOpen(false);
                  onReact?.(e);
                }}
              />
            ))}
          </Animated.View>
        </>
      ) : null}
    </Animated.View>
  );
}

/** Одно эмодзи палитры: выезжает снизу вверх со своей задержкой. */
function PickItem({
  emoji,
  index,
  active,
  lime,
  onPress,
}: {
  emoji: string;
  index: number;
  active: boolean;
  lime: string;
  onPress: () => void;
}) {
  // счёт снизу вверх: ближнее к пальцу эмодзи появляется первым
  const at = (REACTIONS.length - 1 - index) * PICK_STEP_MS;
  const v = useSharedValue(reduceMotion() ? 1 : 0);

  useEffect(() => {
    if (reduceMotion()) return;
    v.value = withDelay(at, withSpring(1, SPRING_SNAPPY));
  }, [v, at]);

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(v.value, { duration: 90 }),
    transform: [{ scale: 0.4 + v.value * 0.6 }, { translateY: (1 - v.value) * 16 }],
  }));

  return (
    <Animated.View style={style}>
      <PressableScale small style={[styles.pick, active && { backgroundColor: lime }]} onPress={onPress}>
        <Text style={styles.pickEmoji}>{emoji}</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.card, padding: 12, gap: 8 },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dim: { opacity: 0.55 },
  check: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { fontFamily: font.extrabold, fontSize: 13 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: font.extrabold, fontSize: 17, letterSpacing: -0.3 },
  amount: { fontFamily: font.semibold, fontSize: 12.5 },
  state: { fontFamily: font.bold, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ping: { alignSelf: 'stretch', height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  pingText: { fontFamily: font.bold, fontSize: 13.5 },
  reactedList: { flexDirection: 'row', gap: 6, paddingLeft: 2 },
  reacted: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: 999, maxWidth: 120 },
  reactedEmoji: { fontSize: 13 },
  reactedName: { fontFamily: font.bold, fontSize: 11 },
  reactBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  reactBtnText: { fontSize: 17 },
  // ловит тап мимо палитры; на весь экран не растягиваем, чтобы не перекрыть прокрутку
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  picker: {
    position: 'absolute',
    right: 10,
    bottom: 52,
    padding: 6,
    gap: 4,
    borderRadius: 999,
    alignItems: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pick: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pickEmoji: { fontSize: 21 },
});
