// Главная — порт web/src/pages/HomePage.vue: тёмный герой с промо-каруселью,
// категориями и поиском, ниже светлый лист со стат-картами, группами и
// сплитами. Шапка липкая и проявляется стеклом при скролле, как в вебе.
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
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
import { translate } from '@/i18n';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import { PromoCarousel, buildSlides } from '@/components/PromoCarousel';
import { ActiveSplitPill } from '@/components/ActiveSplitPill';
import { useHomeData } from '@/store/bootstrap';
import { qk } from '@/api/data';
import { money, peopleCount, humanDateLc } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius } from '@/theme/tokens';
import type { Contact, Merchant, Split } from '@zap/shared/types';

const wordmark = require('../../assets/brand/zap-wordmark.png');

type CategoryKey = 'all' | 'cashback' | 'promo' | 'discount';
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'home.filterAll' },
  { key: 'cashback', label: 'home.filterCashback' },
  { key: 'promo', label: 'home.filterPromo' },
  { key: 'discount', label: 'home.filterDiscount' },
];

export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();

  const home = useHomeData();
  const [category, setCategory] = useState<CategoryKey>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // шапка: прозрачная вверху → тёмное стекло при скролле
  const headerBg = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], 'clamp'),
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
    setRefreshing(false);
  }, [qc]);

  const merchants = home.db?.merchants ?? [];
  // translate(), а не t() из хука: у него простая сигнатура (key, params) => string.
  // lang в зависимостях намеренно: translate читает текущий язык в момент
  // вызова, линтер такую связь не видит, а без неё слайды не перерисуются
  // при смене языка.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slides = useMemo(() => buildSlides(filterMerchants(merchants, category), translate), [merchants, category, lang]);

  // живой поиск: контакты по имени/юзернейму, сплиты по названию
  const q = search.trim().toLowerCase();
  const contactMatches = useMemo(
    () =>
      q.length < 1
        ? []
        : (home.db?.contacts ?? [])
            .filter((c) => c.name.toLowerCase().includes(q) || (c.handle ?? '').toLowerCase().includes(q))
            .slice(0, 6),
    [home.db?.contacts, q],
  );
  const splitRows = useMemo(
    () => (q ? home.splits.filter((s) => s.title.toLowerCase().includes(q)) : home.splits).slice(0, 6),
    [home.splits, q],
  );

  const me = home.db?.user;

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
              <View style={styles.scanIcon}>
                {['tl', 'tr', 'bl', 'br'].map((c) => (
                  <View key={c} style={[styles.scanCorner, cornerStyle(c)]} />
                ))}
              </View>
            </PressableScale>
            <PressableScale
              small
              accessibilityRole="button"
              accessibilityLabel={t('common.profileAria')}
              onPress={() => nav.navigate('Profile')}
            >
              <Avatar name={me?.name} letter={me?.initials} color="#111110" size={40} ring={fixed.lime} />
            </PressableScale>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // таб-бар (~62) + пилюля активного сплита (~58) + зазоры — иначе
        // последние секции оказываются под плавающими элементами
        contentContainerStyle={{ paddingBottom: insets.bottom + (home.activeSplit ? 196 : 128) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        {/* ── тёмный герой ── */}
        <View style={[styles.hero, { paddingTop: insets.top + 74 }]}>
          {home.loading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <Skeleton height={168} radius={radius.card} />
            </View>
          ) : (
            <PromoCarousel slides={slides} onPress={() => nav.navigate('Scan')} />
          )}

          {/* категории */}
          <View style={styles.categories}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <PressableScale key={c.key} style={styles.category} onPress={() => setCategory(c.key)}>
                  <View style={[styles.categoryIcon, { backgroundColor: active ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.12)' }]}>
                    <Text style={[styles.categoryGlyph, { color: active ? fixed.lime : '#FFFFFF' }]}>
                      {c.key === 'all' ? '▦' : c.key === 'cashback' ? '▤' : c.key === 'promo' ? '◈' : '%'}
                    </Text>
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
              <Text style={styles.searchGlyph}>⌕</Text>
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
          {contactMatches.map((c: Contact, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 30).duration(220)}>
              <PressableScale style={styles.contactRow} onPress={() => nav.navigate('Amount')}>
                <Avatar name={c.name} letter={c.initials} color={c.color} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName]}>{c.name}</Text>
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
                  <Avatar key={d.id} name={d.name} letter={d.initials} color={d.color} size={28} ring={colors.paper} style={styles.debtorAvatar} />
                ))}
              </View>
            </PressableScale>
          </View>

          {/* мои группы */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.myGroups')}</Text>
            {home.groups.length ? <Text style={[styles.seeAll, { color: colors.muted }]}>{t('home.seeAll')}</Text> : null}
          </View>

          {home.loading ? (
            <View style={styles.gap10}>
              <Skeleton height={64} radius={20} />
              <Skeleton height={64} radius={20} />
            </View>
          ) : home.groups.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsRow}>
              {home.groups.map((g, gi) => (
                <Animated.View key={g.id} entering={FadeInDown.delay(gi * 45).duration(260)}>
                  <PressableScale
                    style={[styles.groupCard, { backgroundColor: colors.paper }]}
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
                            color={c?.color ?? '#111110'}
                            size={34}
                            ring={colors.paper}
                            style={{ marginLeft: i ? -12 : 0 }}
                          />
                        );
                      })}
                    </View>
                    <Text style={[styles.groupName, { color: colors.ink }]} numberOfLines={1}>{g.name}</Text>
                    <Text style={[styles.groupSub, { color: colors.faint }]} numberOfLines={1}>
                      {t('home.groupSub', { people: peopleCount(g.memberIds.length), amount: money(g.cashback) })}
                    </Text>
                    <PressableScale
                      style={[styles.groupSplitBtn, { backgroundColor: fixed.lime }]}
                      onPress={() => nav.navigate('Amount', { memberIds: g.memberIds })}
                    >
                      <Text style={styles.groupSplitText}>{t('home.split')}</Text>
                    </PressableScale>
                  </PressableScale>
                </Animated.View>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.empty, { color: colors.muted }]}>{t('home.groupsEmpty')}</Text>
          )}

          {/* ваши сплиты */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.yourSplits')}</Text>
            <PressableScale onPress={() => nav.navigate('History')}>
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
            <View style={[styles.splitList, { backgroundColor: colors.paper }]}>
              {splitRows.map((s: Split, i) => (
                <Animated.View key={s.id} entering={FadeInDown.delay(i * 40).duration(240)}>
                  <PressableScale style={styles.splitRow} onPress={() => nav.navigate('SplitLive', { id: s.id })}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.splitTitle, { color: colors.ink }]} numberOfLines={1}>{s.title}</Text>
                      <Text style={[styles.splitSub, { color: colors.faint }]} numberOfLines={1}>
                        {t('home.splitSubPeople', {
                          names: s.members
                            .filter((m) => !m.isYou)
                            .map((m) => home.contactById(m.contactId)?.name ?? '')
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(', '),
                          date: humanDateLc(s.createdAt),
                        })}
                      </Text>
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
              ))}
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.muted }]}>{t('home.splitsEmpty')}</Text>
          )}
        </View>
      </Animated.ScrollView>

      {home.activeSplit ? (
        <ActiveSplitPill
          split={home.activeSplit}
          nameOf={(id) => home.contactById(id)?.name ?? ''}
          onPress={() => nav.navigate('SplitLive', { id: home.activeSplit!.id })}
        />
      ) : null}
    </View>
  );
}

/** Фильтр витрины по типу предложения: кэшбэк · акция · скидка. */
function filterMerchants(list: Merchant[], category: CategoryKey): Merchant[] {
  if (category === 'all') return list;
  return list.filter((m) => {
    const o = m.offer;
    if (!o) return false;
    if (category === 'cashback') return !!o.multiplier;
    if (category === 'discount') return !!o.percent;
    return !o.multiplier && !o.percent;
  });
}

function cornerStyle(c: string) {
  const r = 3;
  switch (c) {
    case 'tl': return { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: r };
    case 'tr': return { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: r };
    case 'bl': return { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: r };
    default: return { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: r };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, paddingHorizontal: 20, paddingBottom: 10 },
  headerGlass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(14,14,12,0.92)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { height: 34, width: 92 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleBtn: {
    width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  scanIcon: { width: 18, height: 18 },
  scanCorner: { position: 'absolute', width: 7, height: 7, borderColor: '#FFFFFF' },

  hero: { backgroundColor: '#0E0E0C', paddingBottom: 26 },
  categories: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingHorizontal: 20, marginTop: 24 },
  category: { alignItems: 'center', gap: 7, flex: 1 },
  categoryIcon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  categoryGlyph: { fontSize: 18, fontFamily: font.extrabold },
  categoryLabel: { fontFamily: font.semibold, fontSize: 11, textAlign: 'center', lineHeight: 13 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 22 },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingLeft: 18, paddingRight: 8,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  searchGlyph: { color: 'rgba(255,255,255,0.55)', fontSize: 17 },
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

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontFamily: font.extrabold, fontSize: 18, letterSpacing: -0.2 },
  seeAll: { fontFamily: font.bold, fontSize: 14 },

  groupsRow: { gap: 12, paddingRight: 20 },
  groupCard: { width: 190, borderRadius: radius.card, padding: 14 },
  groupAvatars: { flexDirection: 'row', marginBottom: 10 },
  groupName: { fontFamily: font.extrabold, fontSize: 15.5 },
  groupSub: { fontFamily: font.semibold, fontSize: 12, marginTop: 2 },
  groupSplitBtn: { marginTop: 12, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  groupSplitText: { fontFamily: font.extrabold, fontSize: 13.5, color: '#111110' },

  splitList: { borderRadius: radius.card, paddingHorizontal: 14 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  splitTitle: { fontFamily: font.bold, fontSize: 15 },
  splitSub: { fontFamily: font.semibold, fontSize: 12, marginTop: 2 },
  splitRight: { alignItems: 'flex-end', gap: 6 },
  splitAmount: { fontFamily: font.extrabold, fontSize: 15 },
  badge: { paddingHorizontal: 10, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: font.extrabold, fontSize: 11 },

  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  gap10: { gap: 10 },
});
