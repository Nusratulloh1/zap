// Чек живого счёта — перенос spec/11 «Оплата — рваный чек»: белая карточка со
// скруглением только сверху (снизу её рвёт зубчатый край), стикер заведения в
// углу, сумма моно 30 pt, строки оплативших и итог «ОПЛАЧЕНО».
//
// Это ОДИН адресуемый узел: следующая анимация Split the Bill сжимает его и
// разрывает на куски, поэтому корень — Animated.View с ref в BillStage.
//
// Строка появляется в чеке в момент оплаты (zapRowIn из макета): въезжает
// снизу и вспыхивает лаймом, который за 600 мс гаснет в белый. Так видно, кто
// именно только что закрыл долю, — без строки «кто-то оплатил».
import React, { useEffect } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { useBillStage } from '@/lib/billStage';
import { money, peopleCount } from '@/lib/format';
import { receiptTitle } from '@/lib/merchant';
import { EASE_ZAP } from '@/lib/motion';
import { reduceMotion } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export interface ReceiptRow {
  key: string;
  contactId: string;
  name: string;
  initials?: string;
  color?: string;
  /** «Вы оплатили ⚡», «в долг, вы покрыли» */
  sub: string;
  amount: number;
  /** оплатил только что — строка въезжает с лаймовой вспышкой */
  fresh?: boolean;
}

interface Props {
  merchantName: string;
  orderLine?: string;
  sticker?: ImageSourcePropType;
  paidAmount: number;
  total: number;
  membersCount: number;
  rows: ReceiptRow[];
  onPressTitle?: () => void;
}

function PaidRow({ row, last }: { row: ReceiptRow; last: boolean }) {
  const { colors, fixed } = useTheme();
  const p = useSharedValue(row.fresh && !reduceMotion() ? 0 : 1);

  useEffect(() => {
    if (row.fresh && !reduceMotion()) {
      p.value = withDelay(60, withTiming(1, { duration: 620, easing: EASE_ZAP }));
    }
  }, [row.fresh, p]);

  const anim = useAnimatedStyle(() => ({
    opacity: 0.2 + p.value * 0.8,
    transform: [{ translateY: (1 - p.value) * 18 }],
    backgroundColor: interpolateColor(p.value, [0, 0.55, 1], [fixed.lime, fixed.lime, colors.paper]),
  }));

  return (
    <Animated.View
      style={[styles.row, anim, !last && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
    >
      <Avatar
        contactId={row.contactId}
        name={row.name}
        letter={row.initials}
        color={row.color ?? '#8A887E'}
        size={36}
      />
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.ink }]} numberOfLines={1}>{row.name}</Text>
        <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>{row.sub}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: colors.ink }]} numberOfLines={1}>{money(row.amount)}</Text>
    </Animated.View>
  );
}

export function LiveReceipt({
  merchantName, orderLine, sticker, paidAmount, total, membersCount, rows, onPressTitle,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const stage = useBillStage();
  const ref = useAnimatedRef<View>();

  useEffect(() => {
    stage?.setReceipt(ref);
    return () => stage?.setReceipt(null);
  }, [stage, ref]);

  return (
    <Animated.View ref={ref} style={[styles.root, { backgroundColor: colors.paper }]}>
      <View style={styles.head}>
        <Text
          style={[styles.merchant, { color: colors.ink }]}
          numberOfLines={1}
          onPress={onPressTitle}
        >
          {receiptTitle(merchantName)}
        </Text>
        {orderLine ? (
          <Text style={[styles.order, { color: colors.muted }]} numberOfLines={1}>{orderLine}</Text>
        ) : null}
      </View>

      {sticker ? <Image source={sticker} style={styles.sticker} resizeMode="contain" /> : null}

      <View style={[styles.dashed, { borderTopColor: colors.sand2 }]} />

      <CountUp value={paidAmount} style={[styles.sum, { color: colors.ink }]} />
      <Text style={[styles.sumSub, { color: colors.muted }]} numberOfLines={1}>
        {t('live.paidOutOf', { total: money(total), people: peopleCount(membersCount) })}
      </Text>

      <View style={[styles.dashed, { borderTopColor: colors.sand2 }]} />

      {rows.map((r, i) => (
        <PaidRow key={r.key} row={r} last={i === rows.length - 1} />
      ))}

      <View style={[styles.total, { borderTopColor: colors.ink }]}>
        <Text style={[styles.totalLabel, { color: colors.muted }]}>{t('live.paidLabel')}</Text>
        <Text style={[styles.totalValue, { color: colors.ink }]}>{money(paidAmount)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // снизу скругления нет: там начинается рваный край
  root: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 8 },
  head: { paddingRight: 74 },
  merchant: { fontFamily: font.bold, fontSize: 15 },
  order: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 2, marginTop: 4 },
  sticker: { position: 'absolute', right: 14, top: 6, width: 66, height: 66 },
  dashed: { borderTopWidth: 1.5, borderStyle: 'dashed', marginTop: 16 },
  sum: { fontFamily: font.monoBold, fontSize: 30, letterSpacing: 1, marginTop: 16 },
  sumSub: { fontFamily: font.semibold, fontSize: 11, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderStyle: 'dashed' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: font.bold, fontSize: 13 },
  rowSub: { fontFamily: font.semibold, fontSize: 10, marginTop: 2 },
  rowAmount: { fontFamily: font.monoBold, fontSize: 16 },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    paddingTop: 12,
    paddingBottom: 8,
  },
  totalLabel: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 2 },
  totalValue: { fontFamily: font.monoBold, fontSize: 16 },
});
