// «Готово, сплит закрыт» — порт SplitClosedPage.vue (дизайн 3g): лаймовый
// экран, логотип мерчанта, сумма каунт-апом, пилл кэшбэка, участники, CTA.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { BottomSheet } from '@/components/BottomSheet';
import { fetchSplit } from '@/api/splits';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function SplitClosedScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const home = useHomeData();
  const id = route.params?.id as string;

  const { data: split } = useQuery({ queryKey: qk.split(id), queryFn: () => fetchSplit(id), enabled: !!id });
  const [billSheet, setBillSheet] = useState(false);

  if (!split) {
    return (
      <Screen background={fixed.lime} darkBar={false} style={styles.root}>
        <ScreenHeader tint="onLime" onBack={() => nav.navigate('Tabs')} />
      </Screen>
    );
  }

  const group = split.groupId ? home.db?.groups.find((g) => g.id === split.groupId) : undefined;
  const merchant = home.db?.merchants.find((m) => m.id === split.merchantId);
  const isSolo = split.members.length < 2;

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));

  return (
    <Screen background={fixed.lime} darkBar={false} style={styles.root}>
      <ScreenHeader tint="onLime" onBack={() => nav.navigate('Tabs')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 18, flexGrow: 1 }}>
        <View style={styles.head}>
          <View style={[styles.logo, { backgroundColor: fixed.ink }]}>
            <Text style={[styles.logoLetter, { color: fixed.lime }]}>
              {merchant?.letter ?? split.title[0]?.toUpperCase() ?? 'Z'}
            </Text>
          </View>
          <Text style={[styles.title, { color: fixed.ink }]}>{t('closed.title')}</Text>
          <Text style={styles.sub}>
            {merchant?.name ?? split.title}
            {split.bill ? t('live.orderNo', { no: split.bill.orderNo }) : ''}
            {group ? ` · ${group.name}` : isSolo ? t('closed.paidWhole') : ''}
          </Text>
          <View style={styles.amountRow}>
            <CountUp value={split.total} duration={900} style={[styles.amount, { color: fixed.ink }]} />
            <Text style={styles.currency}>UZS</Text>
          </View>
          {split.cashback ? (
            <View style={[styles.cashbackPill, { backgroundColor: fixed.ink }]}>
              <Text style={[styles.cashbackText, { color: fixed.lime }]}>
                {t('closed.cashbackBadge', { amount: money(split.cashback) })}
              </Text>
            </View>
          ) : null}
        </View>

        {!isSolo ? (
          <View style={styles.list}>
            {split.members.map((m, i) => (
              <View
                key={m.contactId + i}
                style={[styles.row, i < split.members.length - 1 && styles.rowBorder]}
              >
                <Avatar name={nameOf(m.contactId)} color={colorOf(m.contactId)} size={38} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowName, { color: fixed.ink }]}>
                    {nameOf(m.contactId)}
                    {m.isYou ? t('live.youSuffix') : ''}
                  </Text>
                  {m.status === 'debt' ? <Text style={styles.rowSub}>{t('closed.covered')}</Text> : null}
                </View>
                <Text style={[styles.rowAmount, { color: fixed.ink }]}>{money(m.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {group ? (
          <View style={styles.groupRow}>
            <Text style={styles.groupLabel}>{t('closed.groupTotalLabel', { name: group.name })}</Text>
            <Text style={[styles.groupAmount, { color: fixed.ink }]}>{money(group.cashback)}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        {!isSolo ? (
          <View style={styles.ctas}>
            <PressableScale style={[styles.cta, { backgroundColor: fixed.ink }]} onPress={() => nav.navigate('SaveGroup', { id })}>
              <Text style={[styles.ctaText, { color: colors.cream }]}>{t('closed.saveGroup')}</Text>
            </PressableScale>
            <PressableScale style={[styles.cta, styles.ctaGhost]} onPress={() => nav.navigate('CashbackAward', { id })}>
              <Text style={[styles.ctaText, { color: fixed.ink }]}>{t('closed.close')}</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.ctas}>
            <PressableScale style={[styles.cta, { backgroundColor: fixed.ink }]} onPress={() => nav.navigate('Tabs')}>
              <Text style={[styles.ctaText, { color: colors.cream }]}>{t('closed.close')}</Text>
            </PressableScale>
            {split.bill ? (
              <PressableScale style={[styles.cta, styles.ctaGhost]} onPress={() => setBillSheet(true)}>
                <Text style={[styles.ctaText, { color: fixed.ink }]}>{t('closed.viewReceipt')}</Text>
              </PressableScale>
            ) : null}
          </View>
        )}
      </ScrollView>

      <BottomSheet open={billSheet} onClose={() => setBillSheet(false)}>
        {split.bill ? (
          <View style={styles.billBody}>
            <Text style={[styles.billTitle, { color: colors.ink }]}>
              {merchant?.name ?? split.title} · #{split.bill.orderNo}
            </Text>
            <View style={[styles.dashed, { borderColor: colors.hairline }]} />
            {split.bill.items.map((item) => (
              <View key={item.id} style={styles.billRow}>
                <Text style={[styles.billItem, { color: colors.ink }]}>
                  {item.title}
                  {item.qty > 1 ? ` ×${item.qty}` : ''}
                </Text>
                <Text style={[styles.billAmount, { color: colors.ink }]}>{money(item.amount)}</Text>
              </View>
            ))}
            <View style={[styles.dashed, { borderColor: colors.hairline }]} />
            <View style={styles.billTotalRow}>
              <Text style={[styles.billTotalLabel, { color: colors.ink }]}>{t('closed.totalRow')}</Text>
              <Text style={[styles.billTotal, { color: colors.ink }]}>{money(split.bill.total)}</Text>
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24 },
  head: { marginTop: 30 },
  logo: { width: 76, height: 76, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 26 },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.3, marginTop: 10 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 5, color: 'rgba(17,17,16,0.6)' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 24 },
  amount: { fontFamily: font.extrabold, fontSize: 48, letterSpacing: -1.5, lineHeight: 52 },
  currency: { fontFamily: font.monoBold, fontSize: 11, color: 'rgba(17,17,16,0.55)' },
  cashbackPill: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', marginTop: 14 },
  cashbackText: { fontFamily: font.extrabold, fontSize: 12.5 },
  list: { marginTop: 26, borderTopWidth: 1, borderTopColor: 'rgba(17,17,16,0.14)', paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,16,0.14)' },
  rowBody: { flex: 1, gap: 1 },
  rowName: { fontFamily: font.bold, fontSize: 15 },
  rowSub: { fontFamily: font.semibold, fontSize: 12, color: 'rgba(17,17,16,0.55)' },
  rowAmount: { fontFamily: font.extrabold, fontSize: 15 },
  groupRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20 },
  groupLabel: { fontFamily: font.bold, fontSize: 14.5, color: 'rgba(17,17,16,0.6)' },
  groupAmount: { fontFamily: font.extrabold, fontSize: 19 },
  spacer: { flexGrow: 1, minHeight: 24 },
  ctas: { gap: 10 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaGhost: { backgroundColor: 'rgba(255,255,255,0.55)' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  billBody: { paddingBottom: 10 },
  billTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center' },
  dashed: { borderTopWidth: 2, borderStyle: 'dashed', marginTop: 12, marginBottom: 6 },
  billRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 },
  billItem: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  billAmount: { fontFamily: font.monoBold, fontSize: 12.5 },
  billTotalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 },
  billTotalLabel: { fontFamily: font.extrabold, fontSize: 15 },
  billTotal: { fontFamily: font.extrabold, fontSize: 17 },
});
