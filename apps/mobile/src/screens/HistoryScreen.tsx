// «История» — порт HistoryPage.vue (дизайн 5i): чипы-вкладки, моно-лейблы
// дней, строки 68px, суммы со знаком. Вкладка нижнего пилл-нава.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { useHomeData } from '@/store/bootstrap';
import { money, dayLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import type { HistoryEntry } from '@zap/shared/types';

type TabKey = 'all' | 'splits' | 'cashback' | 'debts';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'history.tabAll' },
  { key: 'splits', label: 'history.tabSplits' },
  { key: 'cashback', label: 'history.tabCashback' },
  { key: 'debts', label: 'history.tabDebts' },
];
const KIND_BY_TAB: Record<TabKey, HistoryEntry['kind'][]> = {
  all: ['split', 'cashback', 'debt', 'payment'],
  splits: ['split', 'payment'],
  cashback: ['cashback'],
  debts: ['debt'],
};

export function HistoryScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const home = useHomeData();
  const [tab, setTab] = useState<TabKey>('all');

  const grouped = useMemo(() => {
    const rows = (home.db?.history ?? []).filter((e) => KIND_BY_TAB[tab].includes(e.kind));
    const out: { label: string; items: HistoryEntry[] }[] = [];
    for (const e of rows) {
      const label = dayLabel(e.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [home.db?.history, tab]);

  const amountText = (e: HistoryEntry) =>
    (e.amount > 0 ? '+' : e.amount < 0 ? '−' : '') + money(Math.abs(e.amount));

  return (
    <Screen style={styles.root}>
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: colors.ink }]}>{t('history.title')}</Text>
        <PressableScale small accessibilityLabel={t('common.profileAria')} onPress={() => nav.navigate('Profile')}>
          <Avatar name={home.db?.user?.name} letter={home.db?.user?.initials} color="#111110" size={44} ring={fixed.lime} />
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs}>
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <PressableScale
              key={tb.key}
              style={[styles.tab, { backgroundColor: active ? fixed.lime : colors.sand }]}
              onPress={() => setTab(tb.key)}
            >
              <Text style={[styles.tabText, { color: active ? '#111110' : colors.slate }]}>{t(tb.label)}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <Animated.View key={tab} entering={FadeIn.duration(200)}>
          {grouped.map((g) => (
            <View key={g.label}>
              <Text style={[styles.dayLabel, { color: colors.faint2 }]}>{g.label}</Text>
              {g.items.map((e, i) => (
                <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(240)}>
                  <PressableScale
                    haptic={false}
                    disabled={!e.splitId}
                    style={[styles.row, i < g.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                    onPress={() => e.splitId && nav.navigate('SplitLive', { id: e.splitId })}
                  >
                    {e.kind === 'cashback' ? (
                      <View style={[styles.icon, { backgroundColor: fixed.lime }]}>
                        <Text style={styles.iconPct}>%</Text>
                      </View>
                    ) : e.kind === 'debt' && e.contactId ? (
                      <Avatar name={e.title} letter={e.letter} color={e.color} size={42} />
                    ) : (
                      <View style={[styles.icon, { backgroundColor: colors.ink }]}>
                        <Text style={[styles.iconLetter, { color: colors.cream }]}>{e.letter}</Text>
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{e.title}</Text>
                      <Text style={[styles.rowSub, { color: colors.faint }]} numberOfLines={1}>{e.subtitle}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text
                        style={[
                          styles.rowAmount,
                          { color: e.amount > 0 ? '#4E7A00' : colors.ink },
                        ]}
                      >
                        {amountText(e)}
                      </Text>
                      {e.note ? <Text style={[styles.rowNote, { color: colors.muted }]}>{e.note}</Text> : null}
                    </View>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          ))}
          {!grouped.length ? (
            <Text style={[styles.empty, { color: colors.muted }]}>{t('history.empty')}</Text>
          ) : null}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3 },
  tabsWrap: { flexGrow: 0, marginTop: 18 },
  tabs: { gap: 8 },
  tab: { height: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: font.bold, fontSize: 13 },
  dayLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, marginTop: 24, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconPct: { fontFamily: font.extrabold, fontSize: 15, color: '#111110' },
  iconLetter: { fontFamily: font.extrabold, fontSize: 15 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: font.bold, fontSize: 15 },
  rowSub: { fontFamily: font.semibold, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontFamily: font.extrabold, fontSize: 15 },
  rowNote: { fontFamily: font.bold, fontSize: 11.5 },
  empty: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center', marginTop: 64 },
});
