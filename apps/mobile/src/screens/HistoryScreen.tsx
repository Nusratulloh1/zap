// «История» — порт HistoryPage.vue (дизайн 5i): чипы-вкладки, моно-лейблы
// дней, строки 68px, суммы со знаком. Вкладка нижнего пилл-нава.
import React, { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { SplitFaces } from '@/components/SplitFaces';
import { SearchIcon } from '@/components/icons';
import { useHomeData } from '@/store/bootstrap';
import { money, dayLabel } from '@/lib/format';
import { entryText } from '@/lib/entryText';
import { useMyAvatar } from '@/lib/myAvatar';
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';
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
  const { colors, fixed, name: themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const home = useHomeData();
  const myAvatar = useMyAvatar();
  const splitById = (id: string) => home.db?.splits.find((sp) => sp.id === id);

  const [tab, setTab] = useState<TabKey>('all');
  // Поиск. Кнопка-лупа существовала с первого дня, но не делала НИЧЕГО —
  // без onPress и без логики. Теперь она раскрывает строку поиска.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (home.db?.history ?? []).filter((e) => {
      if (!KIND_BY_TAB[tab].includes(e.kind)) return false;
      if (!q) return true;
      // ищем по названию, подписи и сумме — по тому, что человек видит в строке
      return (
        entryText(e.title, e.titleKey).toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q) ||
        String(Math.abs(e.amount)).includes(q.replace(/\s/g, ''))
      );
    });
    const out: { label: string; items: HistoryEntry[] }[] = [];
    for (const e of rows) {
      const label = dayLabel(e.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [home.db?.history, tab, query]);

  const amountText = (e: HistoryEntry) =>
    (e.amount > 0 ? '+' : e.amount < 0 ? '−' : '') + money(Math.abs(e.amount));

  return (
    <Screen style={styles.flex}>
      {/*
        Один скролл на весь экран: заголовок, поиск и вкладки едут вместе со
        списком. Закреплённая шапка отъедала верх, и длинная история
        прокручивалась в узком окне.
      */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollBody, { paddingBottom: insets.bottom + 120 }]}
      >
        <View style={styles.headRow}>
          <Text style={[styles.title, { color: colors.ink }]}>{t('history.title')}</Text>
          <View style={styles.headBtns}>
            <PressableScale
              small
              accessibilityLabel={t('common.searchAria')}
              style={[styles.searchBtn, { backgroundColor: searchOpen ? fixed.lime : colors.sand }]}
              onPress={() => {
                setSearchOpen((v) => {
                  if (v) setQuery('');
                  else setTimeout(() => searchRef.current?.focus(), 60);
                  return !v;
                });
              }}
            >
              <SearchIcon size={18} color="#5B594F" />
            </PressableScale>
            <PressableScale small accessibilityLabel={t('common.profileAria')} onPress={() => nav.navigate('Profile')}>
              <Avatar source={myAvatar ?? undefined} name={home.db?.user?.name} letter={home.db?.user?.initials} color="#111110" size={44} ring={fixed.lime} ringWidth={2} />
            </PressableScale>
          </View>
        </View>

        {searchOpen ? (
          <View style={[styles.searchBar, { backgroundColor: colors.sand }]}>
            <SearchIcon size={16} color="#8A887E" />
            <TextInput
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              placeholder={t('history.searchPlaceholder')}
              placeholderTextColor={colors.faint2}
              style={[styles.searchInput, { color: colors.ink }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <PressableScale small onPress={() => setQuery('')}>
                <Text style={[styles.searchClear, { color: colors.muted }]}>✕</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs}>
          {TABS.map((tb) => {
            const active = tab === tb.key;
            return (
              <PressableScale
                key={tb.key}
                style={[styles.tab, { backgroundColor: active ? fixed.lime : colors.sand }]}
                onPress={() => setTab(tb.key)}
              >
                <Text style={[active ? styles.tabTextActive : styles.tabText, { color: active ? '#111110' : colors.slate }]}>{t(tb.label)}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
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
                      <Avatar name={e.title} letter={e.letter} contactId={e.contactId} color={e.color} size={42} />
                    ) : e.splitId && splitById(e.splitId) ? (
                      /* сплит в истории — лица участников, а не буква мерчанта */
                      <SplitFaces split={splitById(e.splitId)!} size={42} />
                    ) : merchantLogo(e.title) ? (
                      <Image source={merchantLogo(e.title)!} style={styles.icon} />
                    ) : (
                      <View style={[styles.icon, { backgroundColor: colors.sand }]}>
                        <Text style={styles.iconLetter}>{merchantGlyph(e.title)}</Text>
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                        {entryText(e.title, e.titleKey)}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.faint }]} numberOfLines={1}>{e.subtitle}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text
                        style={[
                          styles.rowAmount,
                          {
                            color:
                              themeName === 'dark'
                                ? e.amount > 0
                                  ? colors.lime
                                  : e.amount < 0
                                    ? colors.danger
                                    : colors.ink
                                : colors.ink,
                          },
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
            <EmptyState sticker="oneBill" title={t('empty.historyTitle')} hint={t('empty.historyHint')} />
          ) : null}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /*
    Боковой отступ живёт здесь, а не на экране. ScrollView обрезает всё, что
    выходит за его границы: когда padding был на экране, ScrollView занимал
    ширину без него, и кнопка шапки, чуть выступавшая за отступ, обрезалась
    посреди себя. Теперь ScrollView во всю ширину, а отступ — у содержимого.
  */
  scrollBody: { paddingHorizontal: SCREEN_PAD_X },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  headBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: font.semibold, fontSize: 15, padding: 0 },
  searchClear: { fontFamily: font.bold, fontSize: 15, paddingHorizontal: 4 },
  searchBtn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3 },
  // Отрицательный отступ ровно на боковой padding: лента вкладок доезжает до
  // края экрана и ни на пиксель дальше. Было -24 при отступе 16 — лишние 8 px
  // с каждой стороны уходили за экран.
  tabsWrap: { flexGrow: 0, height: 42, marginTop: 18, marginBottom: 4, marginHorizontal: -SCREEN_PAD_X },
  tabs: { gap: 8, paddingHorizontal: SCREEN_PAD_X, alignItems: 'center' },
  tab: { height: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: font.bold, fontSize: 13 },
  tabTextActive: { fontFamily: font.extrabold, fontSize: 13 },
  dayLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, marginTop: 20, marginBottom: 4 },
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
