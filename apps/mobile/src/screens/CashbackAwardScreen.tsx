// «Кэшбэк зачислен» — порт CashbackAwardPage.vue (дизайн 3i): каунт-ап
// «+60 000», лаймовый пилл «×2 …», по-участникам, итог группы, CTA.
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { toast } from '@/components/ToastHost';
import { fetchSplit } from '@/api/splits';
import { qk } from '@/api/data';
import type { Db } from '@zap/shared/types';
import { useHomeData } from '@/store/bootstrap';
import { money, equalShares } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function CashbackAwardScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const route = useRoute<any>();
  const home = useHomeData();
  const id = route.params?.id as string;

  const { data: split } = useQuery({
    queryKey: qk.split(id),
    queryFn: () => fetchSplit(id),
    enabled: !!id,
    // сплит уже есть в загруженном /bootstrap — рисуем сразу, сеть догоняет
    initialData: () => qc.getQueryData<Db>(qk.bootstrap)?.splits.find((s) => s.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.bootstrap)?.dataUpdatedAt,
  });

  if (!split) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />
      </Screen>
    );
  }

  const group = split.groupId ? home.db?.groups.find((g) => g.id === split.groupId) : undefined;
  const merchant = home.db?.merchants.find((m) => m.id === split.merchantId);
  const shares = split.cashback ? equalShares(split.cashback, split.members.length) : [];
  const perMember = split.members.map((m, i) => ({
    contactId: m.contactId,
    amount: shares[i] ?? 0,
    held: m.status === 'debt',
  }));

  const n = split.members.length;
  const reason = n === 2 ? t('cashbackAward.reasonTwo') : n === 3 ? t('cashbackAward.reasonThree') : t('cashbackAward.reasonMany');

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));

  return (
    <Screen style={styles.root}>
      <ScreenHeader onBack={() => nav.navigate('Tabs')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}>
        <View style={styles.head}>
          {split?.merchantId === 'm_bellissimo' ? (
            <Image source={require('../../assets/brand/partners/bellissimo.png')} style={styles.logo} />
          ) : (
          <View style={[styles.logo, { backgroundColor: fixed.ink }]}>
            <Text style={[styles.logoLetter, { color: fixed.lime }]}>
              {merchant?.letter ?? split.title[0]?.toUpperCase() ?? 'Z'}
            </Text>
          </View>
          )}
          <Text style={[styles.title, { color: colors.ink }]}>{t('cashbackAward.title')}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {merchant?.name ?? split.title}
            {split.bill ? t('live.orderNo', { no: split.bill.orderNo }) : ''}
            {group ? ` · ${group.name}` : ''}
          </Text>
          <View style={styles.amountRow}>
            <CountUp value={split.cashback ?? 0} prefix="+" duration={1200} style={[styles.amount, { color: colors.ink }]} />
            <Text style={[styles.currency, { color: colors.faint2 }]}>UZS</Text>
          </View>
          {split.cashbackX2 ? (
            <View style={[styles.reasonPill, { backgroundColor: fixed.lime }]}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.list, { borderTopColor: colors.sand2 }]}>
          {perMember.map((p, i) => (
            <View
              key={p.contactId + i}
              style={[styles.row, i < perMember.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
            >
              <Avatar name={nameOf(p.contactId)} contactId={p.contactId} color={colorOf(p.contactId)} size={38} solid
              />
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, { color: colors.ink }]} numberOfLines={1}>
                  {nameOf(p.contactId)}
                  {p.contactId === 'me' ? t('live.youSuffix') : ''}
                </Text>
                {p.held ? <Text style={[styles.rowSub, { color: colors.faint }]}>{t('cashbackAward.afterDebt')}</Text> : null}
              </View>
              <Text style={[styles.rowAmount, { color: p.held ? colors.faint : colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>+{money(p.amount)}</Text>
            </View>
          ))}
        </View>

        {group ? (
          <View style={styles.groupRow}>
            <Text style={[styles.groupLabel, { color: colors.muted }]}>
              {t('cashbackAward.groupTotalLabel', { name: group.name })}
            </Text>
            <Text style={[styles.groupAmount, { color: colors.ink }]}>{money(group.cashback)}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        <View style={styles.ctas}>
          <PressableScale
            style={[styles.cta, { backgroundColor: fixed.lime }]}
            onPress={() => {
              toast.success(t('cashbackAward.spendToast'));
              nav.navigate('Tabs');
            }}
          >
            <Text style={styles.ctaDark}>{t('cashbackAward.spend')}</Text>
          </PressableScale>
          <PressableScale style={[styles.cta, { backgroundColor: colors.sand }]} onPress={() => nav.navigate('Tabs')}>
            <Text style={[styles.ctaLight, { color: colors.ink }]}>{t('cashbackAward.keep')}</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  head: { marginTop: 30 },
  logo: { width: 76, height: 76, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 26 },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.3, marginTop: 10 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 5 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 24 },
  amount: { fontFamily: font.extrabold, fontSize: 48, letterSpacing: -1.5, lineHeight: 52 },
  currency: { fontFamily: font.monoBold, fontSize: 11 },
  reasonPill: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', marginTop: 14 },
  reasonText: { fontFamily: font.extrabold, fontSize: 12.5, color: '#111110' },
  list: { marginTop: 26, borderTopWidth: 1, paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  rowBody: { flex: 1, gap: 1 },
  rowName: { fontFamily: font.bold, fontSize: 15 },
  rowSub: { fontFamily: font.semibold, fontSize: 12 },
  rowAmount: { fontFamily: font.extrabold, fontSize: 15 },
  groupRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20 },
  groupLabel: { fontFamily: font.bold, fontSize: 14.5 },
  groupAmount: { fontFamily: font.extrabold, fontSize: 19 },
  spacer: { flexGrow: 1, minHeight: 24 },
  ctas: { gap: 10 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  ctaLight: { fontFamily: font.bold, fontSize: 16 },
});
