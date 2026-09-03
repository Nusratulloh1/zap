// Главная — порт web/src/pages/HomePage.vue один в один: тёмный герой
// (hero-иллюстрация / фото залов, категории с теми же SVG, поиск + «Сплит»),
// светлый лист (стат-карты, «Мои группы» вертикальным списком, сплиты).
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Circle as SvgCircle, Defs, Pattern, Rect as SvgRect } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { EmptyState, STICKER } from '@/components/EmptyState';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ActiveSplitPill } from '@/components/ActiveSplitPill';
import { ScanIcon, SearchIcon, CashIcon, TicketIcon } from '@/components/icons';
import { useHomeData } from '@/store/bootstrap';
import { useDraft } from '@/store/draft';
import { qk } from '@/api/data';
import { money, peopleCount, humanDateLc } from '@/lib/format';
import { suggestCrew } from '@/lib/crewStats';
import { setWidgetState } from '@/lib/liveActivity';
import { gender as storedGender, useMyAvatar } from '@/lib/myAvatar';
import { GenderSheet } from '@/components/GenderSheet';
import { VenueIcon } from '@/components/VenueIcon';
import { CrewEmojiSheet } from '@/components/CrewEmojiSheet';
import { useCrewColor, useCrewEmoji } from '@/lib/crewEmoji';
import type { Db } from '@zap/shared/types';
import { storage, useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font, radius } from '@/theme/tokens';
import type { Split } from '@zap/shared/types';

const wordmark = require('../../assets/brand/zap-wordmark-large.png');

type CategoryKey = 'all' | 'cashback' | 'promo' | 'discount';
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'home.filterAll' },
  { key: 'cashback', label: 'home.filterCashback' },
  { key: 'promo', label: 'home.filterPromo' },
  { key: 'discount', label: 'home.filterDiscount' },
];

/** Отказ от предложения собрать Crew — не спрашиваем снова. */
const CREW_SKIP_KEY = 'zap:crew-skipped';

export function HomeScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const draft = useDraft();

  const home = useHomeData();
  const myAvatar = useMyAvatar();
  // какой компании сейчас выбирают знак (null — шит закрыт)
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  // пол спрашиваем один раз, ради подбора аватара
  const [genderSheet, setGenderSheet] = useState(() => storedGender() === null);

  // лента считается из уже загруженного /bootstrap — без лишних запросов
  // живой сплит уже показан пилюлей внизу — лента его не дублирует
  // Предложение собрать Crew (vision §C1). Показываем, когда одна и та же
  // компания встретилась несколько раз и группы для неё ещё нет; отказ
  // запоминаем, чтобы не спрашивать снова.
  const suggestion = useMemo(() => suggestCrew(home.db), [home.db]);
  const [crewSkipped, setCrewSkipped] = useState(() => storage.getString(CREW_SKIP_KEY) === 'yes');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [search, setSearch] = useState('');
  // фильтрация идёт по отложенному значению: ввод не тормозит на каждом символе
  const query = useDeferredValue(search);
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
  const q = query.trim().toLowerCase();

  /*
    Виджет домашнего экрана (vision §C19): «Friday Crew ⚡ Nothing owed ✓»
    или «Dinner 3/4 paid». Ещё одна точка возврата без push-спама.

    Пишем при каждом изменении данных главной: виджет живёт в другом процессе
    и сам ничего не знает про сеть — он читает то, что положило приложение.
  */
  useEffect(() => {
    const active = home.activeSplit;
    if (active) {
      const paid = active.members.filter((m) => m.status === 'paid' || m.status === 'debt').length;
      const merchant = home.db?.merchants.find((m) => m.id === active.merchantId)?.name ?? active.title;
      setWidgetState(merchant, t('home.widgetPaid', { paid, total: active.members.length }));
      return;
    }
    const owed = (home.db?.debts ?? []).length;
    setWidgetState('ZAP!', owed ? t('home.widgetOwed', { n: owed }) : t('home.widgetClear'));
  }, [home.activeSplit, home.db, t]);

  const contactMatches = useMemo(() => {
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return (home.db?.contacts ?? [])
      .filter((c) => c.name.toLowerCase().includes(q) || (digits.length > 1 && (c.phone ?? '').includes(digits)))
      .slice(0, 6);
  }, [home.db?.contacts, q]);

  const splitRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return home.splits
      .filter((sp) => {
        const merchant = home.db?.merchants.find((m) => m.id === sp.merchantId);
        if (category === 'cashback' && !(sp.cashback && sp.cashback > 0)) return false;
        if (category === 'promo' && !merchant?.offer?.multiplier) return false;
        if (category === 'discount' && !merchant?.offer?.percent) return false;
        if (!q) return true;
        return (
          sp.title.toLowerCase().includes(q) ||
          (merchant?.name.toLowerCase().includes(q) ?? false) ||
          sp.members.some((m) => home.contactById(m.contactId)?.name.toLowerCase().includes(q))
        );
      })
      .slice(0, 5);
  }, [category, query, home]);
  const me = home.db?.user;

  const splitSub = (s: Split) => {
    const g = s.groupId ? home.groups.find((gg) => gg.id === s.groupId) : undefined;
    const date = humanDateLc(s.createdAt);
    if (g) {
      return t('home.splitSubGroup', {
        group: g.name.toUpperCase(),
        people: peopleCount(s.members.length),
        date,
      });
    }
    const others = s.members
      .filter((m) => m.contactId !== 'me')
      .map((m) => home.contactById(m.contactId)?.name ?? '?');
    return t('home.splitSubPeople', { names: others.join(', '), date });
  };

  const quickSplit = (memberIds: string[]) => {
    const bill = home.db?.featuredBill ?? null;
    draft.startForGroup(bill, memberIds);
    nav.navigate(bill ? 'Bill' : 'Members');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.dune }]}>
      {/* липкая шапка поверх контента */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
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
              <ScanIcon size={20} color="#FFFFFF" strokeWidth={1.8} center />
            </PressableScale>
            <PressableScale
              small
              accessibilityRole="button"
              accessibilityLabel={t('common.profileAria')}
              onPress={() => nav.navigate('Profile')}
            >
              <Avatar source={myAvatar ?? undefined} name={me?.name} letter={me?.initials} color="#121212" size={44} ring={fixed.lime} ringWidth={2} />
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
        {/*
          Заглушка над героем: при оттягивании списка вниз (bounce) над тёмной
          шапкой выглядывал кремовый фон экрана — тёмный блок «отрывался» от
          верха. Кладём в скролл тёмную простыню, уходящую за верхнюю границу.
        */}
        <View style={styles.bounceCover} pointerEvents="none" />

        {/* ── тёмный герой ── */}
        <View style={[styles.hero, { paddingTop: insets.top + 84 }]}>
          {/* точечная сетка фона — radial-gradient 16px из веба */}
          <Svg style={StyleSheet.absoluteFill as object} pointerEvents="none">
            <Defs>
              <Pattern id="heroDots" width={16} height={16} patternUnits="userSpaceOnUse">
                <SvgCircle cx={2} cy={2} r={1.25} fill="rgba(255,255,255,0.07)" />
              </Pattern>
            </Defs>
            <SvgRect x={0} y={0} width="100%" height="100%" fill="url(#heroDots)" />
          </Svg>
          <PromoCarousel category={category} />

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

          {/* поиск + Сплит: один пилл, лаймовая кнопка внутри */}
          <View style={styles.searchPill}>
            <SearchIcon size={20} color="#A3A199" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.faint2}
              style={styles.searchInput}
            />
            <PressableScale style={[styles.splitBtn, { backgroundColor: colors.lime }]} onPress={() => nav.navigate('Scan')}>
              <Text style={[styles.splitBtnText, { color: colors.onLime }]}>{t('home.split')}</Text>
            </PressableScale>
          </View>

          {/* результаты по контактам: горизонтальная лента аватаров */}
          {contactMatches.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchRow}>
              {contactMatches.map((c) => (
                <PressableScale key={c.id} style={styles.matchCol} onPress={() => nav.popTo('Tabs', { screen: 'Amount' })}>
                  <Avatar name={c.name} letter={c.initials} contactId={c.id} color={c.color} size={48} />
                  <Text style={styles.matchName} numberOfLines={1}>{c.name}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* ── светлый лист ── */}
        <View style={[styles.sheet, { backgroundColor: colors.dune }]}>
          {/*
            Лента жизни идёт ПЕРВОЙ (vision, часть C §2): открывая ZAP, человек
            должен видеть, что происходит у него с людьми, а не сводку счетов.
            Цифры остаются ниже — они никуда не делись, просто перестали быть
            первым, что встречает.
          */}

          {suggestion && !crewSkipped ? (
            <View style={[styles.crewCard, { backgroundColor: colors.ink }]}>
              <Text style={[styles.crewTitle, { color: fixed.lime }]}>{t('crew.suggestTitle')}</Text>
              <Text style={styles.crewBody}>{t('crew.suggestBody', { n: suggestion.splits })}</Text>
              <View style={styles.crewCtas}>
                <PressableScale
                  style={[styles.crewCta, { backgroundColor: fixed.lime }]}
                  onPress={() => nav.navigate('SaveGroup', { id: suggestion.splitId })}
                >
                  <Text style={[styles.crewCtaText, { color: fixed.ink }]}>{t('crew.suggestCta')}</Text>
                </PressableScale>
                <PressableScale
                  style={styles.crewSkip}
                  onPress={() => {
                    storage.set(CREW_SKIP_KEY, 'yes');
                    setCrewSkipped(true);
                  }}
                >
                  <Text style={styles.crewSkipText}>{t('crew.suggestSkip')}</Text>
                </PressableScale>
              </View>
            </View>
          ) : null}


          {/* стат-карты */}
          <View style={styles.stats}>
            <PressableScale
              style={[styles.statCard, styles.cardShadow, { backgroundColor: colors.paper, width: (width - SCREEN_PAD_X * 2 - 12) / 2 }]}
              onPress={() => nav.navigate('Cashback')}
            >
              <Text style={[styles.statTitle, { color: colors.ink }]}>{t('home.cashbackCard')}</Text>
              <Text style={[styles.statSub, { color: colors.faint }]} numberOfLines={2}>
                {home.cashbackCount
                  ? t('home.cashbackWithCount', {
                      amount: money(home.cashbackBalance),
                      count: t('home.cashbackUnit', { n: home.cashbackCount }),
                    })
                  : t('home.cashbackEmpty')}
              </Text>
              {/*
                Только стикер: логотипы партнёров и аватары должников убраны по
                замечанию руководства — плитки должны читаться как наклейки, а
                не как сводка с иконками.
              */}
              <View style={styles.statSticker}>
                <Image source={STICKER.wallet} style={styles.statStickerImg} resizeMode="contain" />
              </View>
            </PressableScale>

            <PressableScale
              style={[styles.statCard, styles.cardShadow, { backgroundColor: colors.paper, width: (width - SCREEN_PAD_X * 2 - 12) / 2 }]}
              onPress={() => nav.navigate('Debts')}
            >
              <Text style={[styles.statTitle, { color: colors.ink }]}>{t('home.debtorsCard')}</Text>
              <Text style={[styles.statSub, { color: colors.faint }]} numberOfLines={2}>
                {home.debtors.length
                  ? t('home.cashbackWithCount', {
                      amount: money(home.totalOwedToMe),
                      count: peopleCount(home.debtors.length),
                    })
                  : t('home.debtorsEmpty')}
              </Text>
              <View style={styles.statSticker}>
                <Image source={STICKER.receiptHero} style={styles.statStickerImg} resizeMode="contain" />
              </View>
            </PressableScale>
          </View>

          {/* мои группы — белая карточка, как rounded-card в вебе */}
          <View style={[styles.sectionCard, styles.cardShadow, { backgroundColor: colors.paper }]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.myGroups')}</Text>
          </View>

          {home.loading ? (
            <View style={styles.gap10}>
              <Skeleton height={56} radius={18} />
              <Skeleton height={56} radius={18} />
            </View>
          ) : home.groups.length ? (
            home.groups.map((g, gi) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(Math.min(gi, 8) * 45).duration(260)}>
                <PressableScale
                  haptic={false}
                  style={[styles.groupRow, gi < home.groups.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                  onPress={() => nav.navigate('Group', { id: g.id })}
                >
                  <PressableScale haptic onPress={() => setEmojiFor(g.id)}>
                    <CrewIcon db={home.db} groupId={g.id} name={g.name} />
                  </PressableScale>
                  <View style={styles.flex1}>
                    <Text style={[styles.groupName, { color: colors.ink }]} numberOfLines={1}>{g.name}</Text>
                    <Text style={[styles.groupSub, { color: colors.faint }]} numberOfLines={1}>
                      {t('home.groupSub', { people: peopleCount(new Set(g.memberIds).size), amount: money(g.cashback) })}
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
            <EmptyState sticker="selfie" size="sm" title={t('empty.groupsTitle')} hint={t('empty.groupsHint')} />
          )}

          </View>

          {/* ваши сплиты — белая карточка */}
          <View style={[styles.sectionCard, styles.cardShadow, { backgroundColor: colors.paper }]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('home.yourSplits')}</Text>
          </View>

          {home.loading ? (
            <View style={styles.gap10}>
              <Skeleton height={56} radius={18} />
              <Skeleton height={56} radius={18} />
              <Skeleton height={56} radius={18} />
            </View>
          ) : splitRows.length ? (
            splitRows.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)}>
                <PressableScale
                  haptic={false}
                  style={[styles.splitRow, i < splitRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                  onPress={() => nav.navigate('SplitLive', { id: s.id })}
                >
                  <VenueIcon name={home.db?.merchants.find((mm) => mm.id === s.merchantId)?.name ?? s.title} size={46} />
                  <View style={styles.flex1}>
                    <Text style={[styles.splitTitle, { color: colors.ink }]} numberOfLines={1}>
                      {home.db?.merchants.find((mm) => mm.id === s.merchantId)?.name ?? s.title}
                    </Text>
                    <Text style={[styles.splitSub, { color: colors.muted }]} numberOfLines={1}>{splitSub(s)}</Text>
                  </View>
                  <View style={styles.splitRight}>
                    <Text style={[styles.splitAmount, { color: colors.ink }]}>{money(s.total)}</Text>
                    <View style={[styles.badge, { backgroundColor: s.status === 'closed' ? colors.pebble2 : colors.lime }]}>
                      <Text style={[styles.badgeText, { color: s.status === 'closed' ? colors.muted : colors.onLime }]}>
                        {s.status === 'closed' ? t('home.closedBadge') : t('home.activeBadge')}
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              </Animated.View>
            ))
          ) : (
            <EmptyState sticker="receiptHero" size="sm" title={t('empty.splitsTitle')} hint={t('empty.splitsHint')} />
          )}
          </View>
        </View>
      </Animated.ScrollView>

      <GenderSheet open={genderSheet} onClose={() => setGenderSheet(false)} />

      {emojiFor ? (
        <CrewEmojiPicker db={home.db} groupId={emojiFor} onClose={() => setEmojiFor(null)} />
      ) : null}

      {home.activeSplit ? (
        <ActiveSplitPill
          merchant={home.db?.merchants.find((m) => m.id === home.activeSplit?.merchantId)}
          split={home.activeSplit}
          nameOf={(id) => home.contactById(id)?.name?.split(' ')[0] ?? ''}
          onPress={() => nav.navigate('SplitLive', { id: home.activeSplit!.id })}
        />
      ) : null}
    </View>
  );
}

/** Знак компании отдельным компонентом: хук нельзя звать внутри map. */
function CrewIcon({ db, groupId, name }: { db: Db | undefined; groupId: string; name: string }) {
  const glyph = useCrewEmoji(db, groupId);
  const color = useCrewColor(db, groupId);
  return <VenueIcon name={name} glyph={glyph} color={color} size={46} />;
}

/** Шит выбора: отдельный компонент, иначе хук звался бы условно. */
function CrewEmojiPicker({ db, groupId, onClose }: { db: Db | undefined; groupId: string; onClose: () => void }) {
  const current = useCrewEmoji(db, groupId);
  const color = useCrewColor(db, groupId);
  return (
    <CrewEmojiSheet open groupId={groupId} current={current} currentColor={color} onClose={onClose} />
  );
}

const styles = StyleSheet.create({
  matchRow: { gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  matchCol: { alignItems: 'center', gap: 6, maxWidth: 64 },
  matchName: { fontFamily: font.bold, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    marginTop: 16,
    marginHorizontal: 20,
    paddingLeft: 16,
    paddingRight: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: font.semibold, fontSize: 15.5, color: '#FFFFFF', padding: 0 },
  splitBtn: { height: 40, paddingHorizontal: 15, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  splitBtnText: { fontFamily: font.extrabold, fontSize: 14.5 },
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, paddingHorizontal: 20, paddingBottom: 10 },
  headerGlass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(14,14,12,0.96)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { height: 52, width: 78 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleBtn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },

  hero: { backgroundColor: '#0E0E0C', paddingBottom: 44 },
  bounceCover: { position: 'absolute', top: -600, left: 0, right: 0, height: 600, backgroundColor: '#0E0E0C' },
  heroSkeleton: { paddingHorizontal: 24 },
  categories: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingHorizontal: 20, marginTop: 26 },
  category: { alignItems: 'center', gap: 7, flex: 1 },
  categoryIcon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  gridIcon: { width: 17, height: 17, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  gridDot: { width: 6, height: 6, borderRadius: 2 },
  pctGlyph: { fontFamily: font.extrabold, fontSize: 17 },
  categoryLabel: { fontFamily: font.semibold, fontSize: 11, textAlign: 'center', lineHeight: 13 },



  crewCard: { borderRadius: 24, padding: 18, gap: 6, marginTop: 14 },
  crewTitle: { fontFamily: font.extrabold, fontSize: 17, letterSpacing: -0.2 },
  crewBody: { fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 18 },
  crewCtas: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  crewCta: { height: 42, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  crewCtaText: { fontFamily: font.extrabold, fontSize: 14 },
  crewSkip: { height: 42, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  crewSkipText: { fontFamily: font.bold, fontSize: 13.5, color: 'rgba(255,255,255,0.5)' },
  greeting: { fontFamily: font.extrabold, fontSize: 24, letterSpacing: -0.5, marginTop: 8, marginBottom: 2 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, paddingTop: 18, paddingHorizontal: SCREEN_PAD_X },
  stats: { flexDirection: 'row', gap: 12, marginTop: 10 },
  statCard: { borderRadius: radius.card, padding: 18, height: 224, justifyContent: 'flex-start' },
  statTitle: { fontFamily: font.extrabold, fontSize: 16.5, letterSpacing: -0.3, lineHeight: 20 },
  statSub: { fontFamily: font.semibold, fontSize: 13, marginTop: 5, lineHeight: 17 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', minHeight: 60 },
  // Аватары в стопку, а не колонками с подписями.
  //
  // Колонки требовали 3 x 52 + отступы = 172 px, а внутри карточки на экране
  // 360 dp есть ~122 px — ряд вылезал за правый край карточки. Стопка с
  // нахлёстом умещается в 116 px, и лица при этом остаются крупными
  // (vision §C4). Имена не теряются: строкой выше уже стоит «... · 4 человека».
  debtorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', minHeight: 60 },
  debtorStacked: { marginLeft: -12 },
  statSticker: { marginTop: 'auto', minHeight: 60, justifyContent: 'flex-end' },
  statStickerImg: { width: 72, height: 58 },
  debtorMore: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  debtorMoreText: { fontFamily: font.extrabold, fontSize: 12.5 },

  sectionCard: { borderRadius: 28, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6, marginTop: 12 },
  cardShadow: {
    shadowColor: '#1E1C10',
    shadowOpacity: 0.05,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  // тот же кегль, что statTitle («Накопленные кэшбеки») — единая шкала
  sectionTitle: { fontFamily: font.extrabold, fontSize: 16.5, letterSpacing: -0.3, lineHeight: 20 },

  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62 },
  groupAvatars: { flexDirection: 'row' },
  groupStacked: { marginLeft: -12 },
  groupName: { fontFamily: font.bold, fontSize: 15 },
  groupSub: { fontFamily: font.semibold, fontSize: 12, marginTop: 1 },
  groupSplitBtn: { height: 34, paddingHorizontal: 15, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  groupSplitText: { fontFamily: font.extrabold, fontSize: 13, color: '#121212' },

  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62 },
  splitIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  splitIconText: { fontFamily: font.extrabold, fontSize: 15 },
  splitTitle: { fontFamily: font.bold, fontSize: 15.5 },
  splitSub: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 1 },
  splitRight: { alignItems: 'flex-end', gap: 5 },
  splitAmount: { fontFamily: font.extrabold, fontSize: 16 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontFamily: font.monoBold, fontSize: 9.5, letterSpacing: 0.95 },

  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  gap10: { gap: 10 },
});
