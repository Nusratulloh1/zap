// Чек после оплаты (редизайн): «ОПЛАТА ПРОШЛА», сумма, заведение, номер
// транзакции, карта и кэшбэк группе.
//
// Номер транзакции приходит с сервера (`/payments/pay` → txId): выдумывать его
// на клиенте нельзя — по нему ищут платёж в поддержке.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { VenueIcon } from '@/components/VenueIcon';
import { useHomeData } from '@/store/bootstrap';
import { dayMonth, money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

export function PaidReceiptScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'PaidReceipt'>>();
  const home = useHomeData();

  const split = home.db?.splits.find((s) => s.id === params.splitId);
  const merchant = home.db?.merchants.find((m) => m.id === split?.merchantId);
  const card = home.db?.cards.find((c) => c.primary) ?? home.db?.cards[0];
  const name = merchant?.name ?? split?.title ?? '';
  const paidCount = split?.members.filter((m) => m.status === 'paid' || m.status === 'debt').length ?? 0;

  return (
    <Screen style={styles.root} background={fixed.ink} darkBar noTopFade>
      <ScreenHeader tint="onDark" onBack={() => nav.popTo('Tabs')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.head}>
          <Text style={styles.kicker}>{t('receipt.done')}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {money(params.amount)}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {t('receipt.sub', {
              members: `${paidCount} / ${split?.members.length ?? 0}`,
              title: split?.title ?? '',
            })}
          </Text>
        </Animated.View>

        <View style={[styles.card, { backgroundColor: colors.paper }]}>
          <View style={styles.merchantRow}>
            <VenueIcon name={name} size={44} />
            <View style={styles.merchantBody}>
              <Text style={[styles.merchantName, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.orderLine, { color: colors.faint2 }]} numberOfLines={1}>
                {split?.bill?.orderNo ? t('receipt.order', { no: split.bill.orderNo }) : ''}
                {split?.bill?.orderNo ? ' · ' : ''}
                {dayMonth(new Date(params.at))}
              </Text>
            </View>
            <View style={[styles.paidChip, { backgroundColor: fixed.lime }]}>
              <Text style={styles.paidChipText}>{t('receipt.paid')}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.sand2 }]} />

          {[
            { l: t('receipt.tx'), v: params.txId ?? '—' },
            { l: t('receipt.card'), v: card ? `${card.network} ·· ${card.last4}` : '—' },
            ...(params.cashback ? [{ l: t('receipt.cashbackGroup'), v: `+${money(params.cashback)}` }] : []),
          ].map((r) => (
            <View key={r.l} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>{r.l}</Text>
              <Text
                style={[styles.rowValue, { color: colors.ink }]}
                numberOfLines={1}
              >
                {r.v}
              </Text>
            </View>
          ))}
        </View>

        <PressableScale
          style={[styles.cta, { backgroundColor: fixed.lime }]}
          onPress={() => nav.popTo('Tabs')}
        >
          <Text style={styles.ctaText}>{t('receipt.close')}</Text>
        </PressableScale>

        {split ? (
          <PressableScale
            style={styles.ghost}
            onPress={() => nav.navigate('SplitLive', { id: split.id })}
          >
            <Text style={styles.ghostText}>{t('receipt.backToBill')}</Text>
          </PressableScale>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16 },
  head: { alignItems: 'center', marginTop: 18 },
  kicker: { fontFamily: font.monoBold, fontSize: 8.5, letterSpacing: 2.4, color: 'rgba(255,255,255,0.6)' },
  amount: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: -1.4, color: '#FFFFFF', marginTop: 8 },
  sub: { fontFamily: font.semibold, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  card: { borderRadius: 24, padding: 16, marginTop: 26 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  merchantBody: { flex: 1, minWidth: 0 },
  merchantName: { fontFamily: font.extrabold, fontSize: 16 },
  orderLine: { fontFamily: font.monoBold, fontSize: 8.5, letterSpacing: 1.6, marginTop: 4 },
  paidChip: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  paidChipText: { fontFamily: font.extrabold, fontSize: 10, color: '#111110' },
  divider: { height: 1, marginVertical: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  rowLabel: { fontFamily: font.semibold, fontSize: 13 },
  rowValue: { fontFamily: font.extrabold, fontSize: 13.5, flexShrink: 1, textAlign: 'right' },
  cta: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  ctaText: { fontFamily: font.extrabold, fontSize: 15.5, color: '#111110' },
  ghost: { alignItems: 'center', paddingVertical: 16 },
  ghostText: { fontFamily: font.bold, fontSize: 14, color: 'rgba(255,255,255,0.6)' },
});
