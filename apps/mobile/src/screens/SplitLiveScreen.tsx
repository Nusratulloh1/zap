// Живой статус сплита — порт web/src/pages/SplitLivePage.vue (дизайн 3f):
// каунт-ап оплаченного, прогресс с чёрной точкой, участники со статусами,
// «Напомнить N» и «Покрыть остаток». Обновляется по сокету, при возврате
// из фона — перезапрос, чтобы пропущенное событие не оставило старый экран.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { PinSheet } from '@/components/PinSheet';
import { toast } from '@/components/ToastHost';
import { fetchSplit, remindMember, coverRemainder } from '@/api/splits';
import { qk } from '@/api/data';
import { joinSplitRoom, onRealtime } from '@/lib/realtime';
import { useHomeData } from '@/store/bootstrap';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function SplitLiveScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const id = route.params?.id as string;

  const { data: split, refetch } = useQuery({ queryKey: qk.split(id), queryFn: () => fetchSplit(id), enabled: !!id });

  // был ли активен при открытии — закрытие анимируем переходом на «Готово»
  const wasActive = useRef<boolean | null>(null);
  if (split && wasActive.current === null) wasActive.current = split.status === 'active';

  useEffect(() => {
    if (!split?.code) return;
    joinSplitRoom(split.code);
    return onRealtime(() => {
      void refetch();
      void qc.invalidateQueries({ queryKey: qk.bootstrap });
    });
  }, [split?.code, refetch, qc]);

  useEffect(() => {
    if (split?.status === 'closed' && wasActive.current) {
      const timer = setTimeout(() => nav.replace('SplitClosed', { id }), 900);
      return () => clearTimeout(timer);
    }
  }, [split?.status, nav, id]);

  const paidAmount = useMemo(
    () =>
      (split?.members ?? [])
        .filter((m) => m.status === 'paid' || m.status === 'debt')
        .reduce((s, m) => s + m.amount, 0),
    [split],
  );
  const progress = split ? paidAmount / split.total : 0;
  const remainder = useMemo(
    () =>
      (split?.members ?? [])
        .filter((m) => m.status !== 'paid' && m.status !== 'debt')
        .reduce((s, m) => s + m.amount, 0),
    [split],
  );
  const pending = (split?.members ?? []).filter((m) => m.status === 'waiting' || m.status === 'opened');

  const bar = useSharedValue(0);
  bar.value = withTiming(progress, { duration: 700 });
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.min(100, bar.value * 100)}%` }));

  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const [coverSheet, setCoverSheet] = useState(false);
  const [covering, setCovering] = useState(false);

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));
  const merchant = home.db?.merchants.find((m) => m.id === split?.merchantId);

  const remind = async (m: { contactId: string; memberId?: string }) => {
    setReminded((s) => new Set([...s, m.contactId]));
    try {
      await remindMember(id, (m as { memberId?: string }).memberId ?? m.contactId);
      toast.success(t('live.reminded'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
  };

  const confirmCover = async () => {
    setCoverSheet(false);
    if (covering) return;
    setCovering(true);
    try {
      await coverRemainder(id);
      await refetch();
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
    } finally {
      setCovering(false);
    }
  };

  if (!split) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />
        <Text style={[styles.loading, { color: colors.muted }]}>{t('bill.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.root}>
      <ScreenHeader onBack={() => nav.navigate('Tabs')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20, flexGrow: 1 }}>
        <View style={styles.head}>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {merchant?.name ?? split.title}
            {split.bill ? t('live.orderNo', { no: split.bill.orderNo }) : ''}
          </Text>
          <CountUp value={paidAmount} duration={600} style={[styles.amount, { color: colors.ink }]} />
          <Text style={[styles.of, { color: colors.faint }]}>{t('live.paidOfTotal', { total: money(split.total) })}</Text>

          <View style={[styles.track, { backgroundColor: colors.pebble }]}>
            <Animated.View style={[styles.fill, { backgroundColor: fixed.lime }, barStyle]} />
            <View style={[styles.dot, { backgroundColor: colors.ink }]} />
          </View>
        </View>

        <View style={styles.list}>
          {split.members.map((m, i) => {
            const waiting = m.status === 'waiting' || m.status === 'opened';
            return (
              <View
                key={m.contactId + i}
                style={[styles.row, i < split.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
              >
                <View style={waiting ? styles.dim : undefined}>
                  <Avatar name={nameOf(m.contactId)} contactId={m.contactId} color={colorOf(m.contactId)} size={40} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowName, { color: colors.ink }]}>
                    {nameOf(m.contactId)}
                    {m.isYou ? t('live.youSuffix') : ''}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.faint }]}>
                    {money(m.amount)}
                    {m.status === 'opened' ? t('live.openedLink') : m.status === 'debt' ? t('live.debtCovered') : ''}
                  </Text>
                </View>
                {m.status === 'paid' || m.status === 'debt' ? (
                  <View style={[styles.badge, { backgroundColor: colors.ink }]}>
                    <Text style={[styles.badgeCheck, { color: fixed.lime }]}>✓</Text>
                    <Text style={[styles.badgeText, { color: colors.cream }]}>
                      {m.status === 'debt' ? t('live.debtBadge') : t('live.statusPaid')}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: colors.pebble }]}>
                    <Text style={[styles.badgeText, { color: colors.muted }]}>{t('live.statusWaiting')}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.spacer} />

        {split.status === 'active' ? (
          <View style={styles.ctas}>
            {pending.map((m) => (
              <PressableScale
                key={m.contactId}
                disabled={reminded.has(m.contactId)}
                style={[styles.cta, { backgroundColor: colors.ink }, reminded.has(m.contactId) && styles.disabled]}
                onPress={() => void remind(m as never)}
              >
                <Text style={[styles.ctaText, { color: colors.cream }]}>
                  {reminded.has(m.contactId) ? t('live.reminded') : t('live.remind', { name: nameOf(m.contactId) })}
                </Text>
              </PressableScale>
            ))}
            {remainder > 0 ? (
              <PressableScale
                disabled={covering}
                style={[styles.cta, { backgroundColor: colors.sand }, covering && styles.disabled]}
                onPress={() => setCoverSheet(true)}
              >
                <Text style={[styles.ctaText, { color: colors.ink }]}>{t('live.coverRest', { amount: money(remainder) })}</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <PinSheet
        open={coverSheet}
        hint={
          merchant
            ? t('live.pinHintMerchant', { amount: money(remainder), merchant: merchant.name })
            : t('live.pinHint', { amount: money(remainder) })
        }
        onClose={() => setCoverSheet(false)}
        onConfirm={() => void confirmCover()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  loading: { fontFamily: font.semibold, fontSize: 15, marginTop: 40, textAlign: 'center' },
  head: { marginTop: 26, gap: 6 },
  sub: { fontFamily: font.semibold, fontSize: 13.5 },
  amount: { fontFamily: font.extrabold, fontSize: 42, letterSpacing: -1.3, lineHeight: 46 },
  of: { fontFamily: font.semibold, fontSize: 13 },
  track: { flexDirection: 'row', alignItems: 'center', height: 10, borderRadius: 999, marginTop: 12 },
  fill: { height: 10, borderRadius: 999 },
  dot: { width: 10, height: 10, borderRadius: 999, marginLeft: -5 },
  list: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  dim: { opacity: 0.6 },
  rowBody: { flex: 1, gap: 1 },
  rowName: { fontFamily: font.bold, fontSize: 15 },
  rowSub: { fontFamily: font.semibold, fontSize: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 12, borderRadius: 999 },
  badgeCheck: { fontFamily: font.extrabold, fontSize: 11 },
  badgeText: { fontFamily: font.bold, fontSize: 12 },
  spacer: { flexGrow: 1, minHeight: 20 },
  ctas: { gap: 10 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  disabled: { opacity: 0.4 },
});
