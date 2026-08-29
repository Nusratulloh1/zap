// Главная — порт web/src/pages/HomePage.vue один в один: тёмный герой
// (hero-иллюстрация / фото залов, категории с теми же SVG, поиск + «Сплит»),
// светлый лист (стат-карты, «Мои группы» вертикальным списком, сплиты).
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ActiveSplitPill } from '@/components/ActiveSplitPill';
import { ScanIcon, SearchIcon, CashIcon, TicketIcon } from '@/components/icons';
import { useHomeData } from '@/store/bootstrap';
import { useDraft } from '@/store/draft';
import { qk } from '@/api/data';
import { money, peopleCount, humanDateLc } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius } from '@/theme/tokens';
import type { Split } from '@zap/shared/types';

const wordmark = require('../../assets/brand/zap-wordmark-light.png');

type CategoryKey = 'all' | 'cashback' | 'promo' | 'discount';
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'home.filterAll' },
  { key: 'cashback', label: 'home.filterCashback' },
  { key: 'promo', label: 'home.filterPromo' },
  { key: 'discount', label: 'home.filterDiscount' },
];

export function HomeScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const draft = useDraft();

  const home = useHomeData();
  const [category, setCategory] = useState<CategoryKey>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // шапка: прозрачная вверху → тёмное стекло при скролле (как в вебе)
  const headerBg = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], 'clamp'),
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
    setRefreshing(false);
  }, [qc]);

  // живой поиск по контактам (имя/номер) — как в вебе
  const q = search.trim().toLowerCase();
  const contactMatches = useMemo(() => {
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return (home.db?.contacts ?? [])
      .filter((c) => c.name.toLowerCase().includes(q) || (digits.length > 1 && (c.phone ?? '').includes(digits)))
      .slice(0, 6);
  }, [home.db?.contacts, q]);

  const splitRows = useMemo(() => home.splits.slice(0, 6), [home.splits]);
  const me = home.db?.user;

  const splitSub = (s: Split) => {
    const others = s.members
      .filter((m) => !m.isYou)
      .map((m) => home.contactById(m.contactId)?.name?.split(' ')[0] ?? '')
      .filter(Boolean);
    const date = humanDateLc(s.createdAt);
    const g = s.groupId ? home.db?.groups.find((x) => x.id === s.groupId) : undefined;
    if (g) return t('home.splitSubGroup', { group: g.name, date });
    return t('home.splitSubPeople', { names: others.slice(0, 2).join(', '), date });
  };

  const quickSplit = (memberIds: string[]) => {
    const bill = home.db?.featuredBill ?? null;
    draft.startForGroup(bill, memberIds);
    nav.navigate(bill ? 'Bill' : 'Members');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.cream }]}>
      {/* липкая шапка поверх контента */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <Animated.View style={[styles.headerGlass, headerBg]} pointerEvents="none" />
        <View style={styles.headerRow}>
          <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
          <View style={styles.headerActions}>
            <PressableScale
              small
              accessibilityRole="button"
              accessibilityLabel={t('home.scanAria')}
              style={styles.circleBtn}
              onPress={() => nav.navigate('Scan')}
            >
              <ScanIcon size={22} color="#FFFFFF" />
            </PressableScale>
            <PressableScale
              small
              accessibilityRole="button"
              accessibilityLabel={t('common.profileAria')}
              onPress={() => nav.navigate('Profile')}
            >
              <Avatar name={me?.name} letter={me?.initials} contactId="me" color="#111110" size={40} ring={fixed.lime} />
            </PressableScale>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (home.activeSplit ? 196 : 128) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        {/* ── тёмный герой ── */}
        <View style={[styles.hero, { paddingTop: insets.top + 68 }]}>
          {home.loading ? (
            <View style={styles.heroSkeleton}>
              <Skeleton height={218} radius={20} />
            </View>
          ) : (
            <PromoCarousel category={category} onPress={() => nav.navigate('Scan')} />
          )}

          {/* категории — SVG-иконки из веба */}
          <View style={styles.categories}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              const iconColor = active ? fixed.lime : '#FFFFFF';
              return (
                <PressableScale key={c.key} style={styles.category} onPress={() => setCategory(c.key)}>
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: active ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.12)' },
                    ]}
                  >
                    {c.key === 'all' ? (
                      <View style={styles.gridIcon}>
                        {Array.from({ length: 4 }, (_, i) => (
                          <View key={i} style={[styles.gridDot, { backgroundColor: iconColor }]} />
                        ))}
                      </View>
                    ) : c.key === 'cashback' ? (
                      <CashIcon size={24} color={iconColor} />
                    ) : c.key === 'promo' ? (
                      <TicketIcon size={24} color={iconColor} />
                    ) : (
                      <Text style={[styles.pctGlyph, { color: iconColor }]}>%</Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[styles.categoryLabel, { color: active ? '#FFFFFF' : 'rgba(255,255,255,0.7)' }]}
                  >
                    {t(c.label)}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* поиск + Сплит */}
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <SearchIcon size={17} color="rgba(255,255,255,0.55)" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
              />
            </View>
            <PressableScale style={[styles.splitBtn, { backgroundColor: fixed.lime }]} onPress={() => nav.navigate('Scan')}>
              <Text style={styles.splitBtnText}>{t('home.split')}</Text>
            </PressableScale>
          </View>

          {/* результаты по контактам */}
          {contactMatches.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 30).duration(220)}>
              <PressableScale
                haptic={false}
                style={styles.contactRow}
                onPress={() => nav.navigate('Tabs', { screen: 'Amount' })}
              >
                <Avatar name={c.name} letter={c.initials} contactId={c.id} color={c.color} size={38} />
                <View style={styles.flex1}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  {c.handle ? <Text style={styles.contactHandle}>{c.handle}</Text> : null}
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        {/* ── светлый лист ── */}
        <View style={[styles.sheet, { backgroundColor: colors.cream }]}>
          {/* стат-карты */}
          <View style={styles.stats}>
            <PressableScale
              style={[styles.statCard, { backgroundColor: colors.paper, width: (width - 52) / 2 }]}
              onPress={() => nav.navigate('Cashback')}
            >
              <Text style={[styles.statTitle, { color: colors.ink }]}>{t('home.cashbackCard')}</Text>
              <Text style={[styles.statSub, { color: colors.muted }]} numberOfLines={2}>
                {home.cashbackCount
                  ? t('home.cashbackWithCount', {
                      amount: money(home.cashbackBalance),
                      count: t('home.cashbackUnit', { n: home.cashbackCount }),
                    })
                  : t('home.cashbackEmpty')}
              </Text>
            </PressableScale>

            <PressableScale
              style={[styles.statCard, { backgroundColor: colors.paper, width: (width - 52) / 2 }]}
              onPress={() => nav.navigate('Debts')}
            >
              <Text style={[styles.statTitle, { color: colors.ink }]}>{t('home.debtorsCard')}</Text>
              <Text style={[styles.statSub, { color: colors.muted }]} numberOfLines={2}>
                {home.debtors.length
                  ? t('home.cashbackWithCount', {
                      amount: money(home.totalOwedToMe),
                      count: peopleCount(home.debtors.length),
                    })
                  : t('home.debtorsEmpty')}
              </Text>
              <View style={styles.debtorRow}>
                {home.debtors.slice(0, 4).map((d) => (
                  <Avatar
                    key={d.id}
                    name={d.name}
                    letter={d.initials}
                    contactId={d.id}
                    color={d.color}
                    size={28}
                    ring={colors.paper}
                    style={styles.debtorAvatar}
                  />
                ))}
              </View>
            </PressableScale>
          </View>

          {/* мои группы — вертикальный список, как в вебе */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.myGroups')}</Text>
            {home.groups.length ? <Text style={[styles.seeAll, { color: colors.muted }]}>{t('home.seeAll')}</Text> : null}
          </View>

          {home.loading ? (
            <View style={styles.gap10}>
              <Skeleton height={56} radius={18} />
              <Skeleton height={56} radius={18} />
            </View>
          ) : home.groups.length ? (
            home.groups.map((g, gi) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(gi * 45).duration(260)}>
                <PressableScale
                  haptic={false}
                  style={[styles.groupRow, gi < home.groups.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                  onPress={() => nav.navigate('Group', { id: g.id })}
                >
                  <View style={styles.groupAvatars}>
                    {g.memberIds.slice(0, 3).map((cid, i) => {
                      const c = home.contactById(cid);
                      return (
                        <Avatar
                          key={cid}
                          name={c?.name ?? t('home.me')}
                          letter={c?.initials}
                          contactId={cid}
                          color={c?.color ?? '#111110'}
                          size={38}
                          ring={colors.cream}
                          style={i > 0 ? styles.groupStacked : undefined}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.flex1}>
                    <Text style={[styles.groupName, { color: colors.ink }]} numberOfLines={1}>{g.name}</Text>
                    <Text style={[styles.groupSub, { color: colors.faint }]} numberOfLines={1}>
                      {t('home.groupSub', { people: peopleCount(g.memberIds.length), amount: money(g.cashback) })}
                    </Text>
                  </View>
                  <PressableScale
                    style={[styles.groupSplitBtn, { backgroundColor: fixed.lime }]}
                    onPress={() => quickSplit(g.memberIds)}
                  >
                    <Text style={styles.groupSplitText}>{t('home.split')}</Text>
                  </PressableScale>
                </PressableScale>
              </Animated.View>
            ))
          ) : (
            <Text style={[styles.empty, { color: colors.muted }]}>{t('home.groupsEmpty')}</Text>
          )}

          {/* ваши сплиты */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.yourSplits')}</Text>
            <PressableScale onPress={() => nav.navigate('Tabs', { screen: 'History' })}>
              <Text style={[styles.seeAll, { color: colors.muted }]}>{t('home.seeAll')}</Text>
            </PressableScale>
          </View>

          {home.loading ? (
            <View style={styles.gap10}>
              <Skeleton height={56} radius={18} />
              <Skeleton height={56} radius={18} />
              <Skeleton height={56} radius={18} />
            </View>
          ) : splitRows.length ? (
            splitRows.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(i * 40).duration(240)}>
                <PressableScale
                  haptic={false}
                  style={[styles.splitRow, i < splitRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                  onPress={() => nav.navigate('SplitLive', { id: s.id })}
                >
                  <View style={styles.flex1}>
                    <Text style={[styles.splitTitle, { color: colors.ink }]} numberOfLines={1}>{s.title}</Text>
                    <Text style={[styles.splitSub, { color: colors.faint }]} numberOfLines={1}>{splitSub(s)}</Text>
                  </View>
                  <View style={styles.splitRight}>
                    <Text style={[styles.splitAmount, { color: colors.ink }]}>{money(s.total)}</Text>
                    <View style={[styles.badge, { backgroundColor: s.status === 'closed' ? colors.sand : fixed.lime }]}>
                      <Text style={[styles.badgeText, { color: s.status === 'closed' ? colors.muted : '#111110' }]}>
                        {s.status === 'closed' ? t('home.closedBadge') : t('home.activeBadge')}
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              </Animated.View>
            ))
          ) : (
            <Text style={[styles.empty, { color: colors.muted }]}>{t('home.splitsEmpty')}</Text>
          )}
        </View>
      </Animated.ScrollView>

      {home.activeSplit ? (
        <ActiveSplitPill
          split={home.activeSplit}
          nameOf={(id) => home.contactById(id)?.name?.split(' ')[0] ?? ''}
          onPress={() => nav.navigate('SplitLive', { id: home.activeSplit!.id })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, paddingHorizontal: 20, paddingBottom: 10 },
  headerGlass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(14,14,12,0.92)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { height: 40, width: 104 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  hero: { backgroundColor: '#0E0E0C', paddingBottom: 28 },
  heroSkeleton: { paddingHorizontal: 24 },
  categories: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingHorizontal: 20, marginTop: 26 },
  category: { alignItems: 'center', gap: 7, flex: 1 },
  categoryIcon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  gridIcon: { width: 17, height: 17, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  gridDot: { width: 6, height: 6, borderRadius: 2 },
  pctGlyph: { fontFamily: font.extrabold, fontSize: 17 },
  categoryLabel: { fontFamily: font.semibold, fontSize: 11, textAlign: 'center', lineHeight: 13 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 22 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  searchInput: { flex: 1, fontFamily: font.semibold, fontSize: 14.5, color: '#FFFFFF', padding: 0 },
  splitBtn: { height: 54, paddingHorizontal: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  splitBtnText: { fontFamily: font.extrabold, fontSize: 15, color: '#111110' },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  contactName: { fontFamily: font.bold, fontSize: 15, color: '#FFFFFF' },
  contactHandle: { fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },

  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -22, paddingTop: 24, paddingHorizontal: 20 },
  stats: { flexDirection: 'row', gap: 12 },
  statCard: { borderRadius: radius.card, padding: 16, minHeight: 132, justifyContent: 'flex-start' },
  statTitle: { fontFamily: font.extrabold, fontSize: 18, letterSpacing: -0.2, lineHeight: 21 },
  statSub: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  debtorRow: { flexDirection: 'row', marginTop: 'auto', paddingTop: 10 },
  debtorAvatar: { marginRight: -8 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 6 },
  sectionTitle: { fontFamily: font.extrabold, fontSize: 18, letterSpacing: -0.2 },
  seeAll: { fontFamily: font.bold, fontSize: 14 },

  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  groupAvatars: { flexDirection: 'row' },
  groupStacked: { marginLeft: -12 },
  groupName: { fontFamily: font.bold, fontSize: 15 },
  groupSub: { fontFamily: font.semibold, fontSize: 12, marginTop: 1 },
  groupSplitBtn: { height: 36, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  groupSplitText: { fontFamily: font.extrabold, fontSize: 13, color: '#111110' },

  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  splitTitle: { fontFamily: font.bold, fontSize: 15 },
  splitSub: { fontFamily: font.semibold, fontSize: 12, marginTop: 2 },
  splitRight: { alignItems: 'flex-end', gap: 5 },
  splitAmount: { fontFamily: font.extrabold, fontSize: 15 },
  badge: { paddingHorizontal: 10, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: font.extrabold, fontSize: 11 },

  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  gap10: { gap: 10 },
});
