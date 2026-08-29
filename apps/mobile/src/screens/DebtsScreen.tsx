// «Вам должны» — порт DebtsPage.vue (дизайн 5g): сумма 44px, вкладки,
// должники с «Напомнить» (кулдаун 30с), пояснение, «Напомнить всем».
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { toast } from '@/components/ToastHost';
import { remindDebt, remindAllDebts } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { money, humanDateLc } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function DebtsScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const home = useHomeData();

  const [tab, setTab] = useState<'owedToMe' | 'iOwe'>('owedToMe');
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  const openDebts = useMemo(
    () => (home.db?.debts ?? []).filter((d) => d.direction === 'owedToMe' && d.status === 'open'),
    [home.db?.debts],
  );
  const isCooling = (id: string) => (cooldowns[id] ?? 0) > Date.now();

  const remind = async (debtId: string) => {
    setCooldowns((c) => ({ ...c, [debtId]: Date.now() + 30000 }));
    setTimeout(() => setCooldowns((c) => ({ ...c })), 30500);
    try {
      await remindDebt(debtId);
      toast.success(t('debts.remindedToast'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
  };

  const remindAll = async () => {
    const till = Date.now() + 30000;
    setCooldowns(Object.fromEntries(openDebts.map((d) => [d.id, till])));
    setTimeout(() => setCooldowns((c) => ({ ...c })), 30500);
    try {
      await remindAllDebts();
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success(t('debts.remindedToast'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('debts.allAlreadyReminded'));
    }
  };

  return (
    <Screen style={styles.root}>
      <ScreenHeader />

      <Text style={[styles.title, { color: colors.ink }]}>{t('debts.title')}</Text>
      <View style={styles.amountRow}>
        <CountUp value={home.totalOwedToMe} duration={800} style={[styles.amount, { color: colors.ink }]} />
        <Text style={[styles.unit, { color: colors.faint2 }]}>
          UZS · {home.debtors.length} {t('debts.peopleUnit')}
        </Text>
      </View>

      <View style={styles.tabs}>
        {(['owedToMe', 'iOwe'] as const).map((k) => {
          const active = tab === k;
          return (
            <PressableScale
              key={k}
              style={[styles.tab, { backgroundColor: active ? fixed.lime : colors.sand }]}
              onPress={() => setTab(k)}
            >
              <Text style={[styles.tabText, { color: active ? '#111110' : colors.slate }]}>
                {k === 'owedToMe' ? t('debts.tabOwedToMe') : t('debts.iOweZero')}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {tab === 'owedToMe' ? (
        <Animated.View key="owed" entering={FadeIn.duration(200)} style={styles.flex}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16, flexGrow: 1 }}>
            <View style={styles.list}>
              {openDebts.map((d, i) => {
                const c = home.contactById(d.contactId);
                return (
                  <Animated.View
                    key={d.id}
                    entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)}
                    style={[styles.row, i < openDebts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                  >
                    <Avatar name={c?.name} letter={c?.initials} color={c?.color ?? '#8A887E'} size={48} />
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowName, { color: colors.ink }]}>{c?.name ?? '?'}</Text>
                      <Text style={[styles.rowSub, { color: colors.faint }]} numberOfLines={1}>
                        {d.reason} · {humanDateLc(d.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.rowAmount, { color: colors.ink }]}>{money(d.amount)}</Text>
                      {d.note ? (
                        <View style={[styles.chip, { backgroundColor: colors.sand }]}>
                          <Text style={[styles.chipText, { color: colors.muted }]}>
                            {d.note[0]?.toUpperCase() + d.note.slice(1)}
                          </Text>
                        </View>
                      ) : (
                        <PressableScale
                          disabled={isCooling(d.id)}
                          style={[styles.chip, { backgroundColor: isCooling(d.id) ? colors.sand : colors.ink }]}
                          onPress={() => void remind(d.id)}
                        >
                          <Text style={[styles.chipText, { color: isCooling(d.id) ? colors.muted : fixed.lime }]}>
                            {isCooling(d.id) ? t('debts.reminded') : t('debts.remind')}
                          </Text>
                        </PressableScale>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
              {!openDebts.length ? (
                <Text style={[styles.empty, { color: colors.muted }]}>{t('debts.empty')}</Text>
              ) : null}
            </View>

            <View style={[styles.note, { borderTopColor: colors.sand2 }]}>
              <Text style={[styles.noteText, { color: colors.muted }]}>{t('debts.autoNoteLong')}</Text>
            </View>

            <View style={styles.spacer} />

            {openDebts.length ? (
              <PressableScale style={[styles.cta, { backgroundColor: fixed.lime }]} onPress={() => void remindAll()}>
                <Text style={styles.ctaText}>{t('debts.remindAll')}</Text>
              </PressableScale>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View key="iowe" entering={FadeIn.duration(200)} style={styles.center}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={[styles.emptyBold, { color: colors.muted }]}>{t('debts.empty')}</Text>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24 },
  flex: { flex: 1 },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 24 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  amount: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: -1.4, lineHeight: 48 },
  unit: { fontFamily: font.monoBold, fontSize: 11 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tab: { height: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: font.bold, fontSize: 13 },
  list: { marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 74 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontFamily: font.bold, fontSize: 16 },
  rowSub: { fontFamily: font.semibold, fontSize: 12.5 },
  rowRight: { alignItems: 'flex-end', gap: 5 },
  rowAmount: { fontFamily: font.extrabold, fontSize: 16 },
  chip: { height: 28, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  chipText: { fontFamily: font.bold, fontSize: 11.5 },
  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
  note: { borderTopWidth: 1, paddingTop: 16, marginTop: 20 },
  noteText: { fontFamily: font.semibold, fontSize: 12.5, lineHeight: 18 },
  spacer: { flexGrow: 1, minHeight: 20 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ctaText: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emoji: { fontSize: 32 },
  emptyBold: { fontFamily: font.bold, fontSize: 14 },
});
