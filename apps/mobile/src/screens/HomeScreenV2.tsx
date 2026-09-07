// Главная «Pulse» — перенос прототипа «ZAP Home Prototype»: тёмный холст в
// точку, сторис компаний, крупный герой, промо на наклонённой карточке, две
// плитки, список Crews, ряд заведений и лента жизни.
//
// Это ВТОРАЯ главная: классическая остаётся в коде, выбор живёт в профиле
// (A/B). Поэтому экран самодостаточен — свои цвета и свои размеры прямо из
// прототипа, без общих токенов: они рассчитаны на светлый песочный холст, а
// здесь по умолчанию тёмный.
//
// Данные — те же, что у классической главной: /bootstrap, ничего лишнего не
// запрашиваем. Чего в данных нет (реакции на посты ленты), того и не рисуем.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { PingButton } from '@/components/PingButton';
import { BottomSheet } from '@/components/BottomSheet';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { toast } from '@/components/ToastHost';
import { CheckIcon, ScanIcon } from '@/components/icons';
import { useHomeData } from '@/store/bootstrap';
import { useTheme } from '@/theme/ThemeProvider';
import { qk } from '@/api/data';
import { remindMember } from '@/api/splits';
import { homeFeed } from '@/lib/homeFeed';
import { crewColorOf, crewEmojiOf, useCrewSignsVersion } from '@/lib/crewEmoji';
import { merchantLogo } from '@/lib/merchantLogo';
import { VENUES, venuePlate } from '@/lib/venues';
import { hasKey, translate } from '@/i18n';
import { money, peopleCount } from '@/lib/format';
import { cue, reduceMotion } from '@/lib/feedback';
import { useHomeLogo, setHomeLogo } from '@/lib/homeVariant';
import { font, fontHome } from '@/theme/tokens';

const MASCOT = require('../../assets/home2/mascot.png');
const STK_RECEIPT = require('../../assets/home2/receipt-qr.png');
const STK_CHECK = require('../../assets/home2/check-avatars.png');
// логотип-наклейка из прототипа: он же и на тёмном, и на светлом холсте
const LOGO = require('../../assets/home2/logo.png');

/** Стили логотипа из прототипа: тап по шапке открывает этот выбор. */
const HOME_LOGOS = [
  { key: 'classic', src: LOGO, bg: '#FFFFFF' },
  { key: 'mono', src: require('../../assets/home2/logo-mono.png'), bg: '#D9FF3A' },
  { key: 'heart', src: require('../../assets/home2/heart.png'), bg: '#FFFFFF' },
  { key: 'phone', src: require('../../assets/home2/phone-check.png'), bg: '#D9FF3A' },
  { key: 'receipt', src: require('../../assets/home2/receipt-qr.png'), bg: '#FFFFFF' },
] as const;

/** Безопасную зону сверху рисует сама шапка — SafeAreaView не вмешивается. */
const NO_EDGES = [] as const;

/** Явный нулевой инсет: iOS иначе подставляет свой. */
const ZERO_INSET = { top: 0, bottom: 0, left: 0, right: 0 } as const;

/** Сколько событий ленты показываем за раз. */
const FEED_PAGE = 6;

const LIME = '#D9FF3A';
const INK = '#121212';

/** Имя для плитки витрины: «Bellissimo Pizza» в 118 pt не влезает. */
function shortName(name: string): string {
  return name.length > 12 ? (name.split(' ')[0] ?? name) : name;
}

/*
  Плитки в прототипе показывают «5.3M», а не «5 300 000»: цифра там — акцент
  крупным кеглем, и полная сумма в две строки не влезает. Миллионы сокращаем,
  всё что меньше — как обычно.
*/
function compact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
  }
  return money(v);
}

export function HomeScreenV2() {
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const insets = useSafeAreaInsets();
  // листы рисуются в общей теме приложения, поэтому берём её палитру
  const { colors, name: themeName } = useTheme();

  // знаки компаний живут в MMKV — версия заставляет список перерисоваться
  const signs = useCrewSignsVersion();
  const logo = useHomeLogo();
  // холст следует теме приложения: выбор темы живёт в профиле
  const dark = themeName === 'dark';

  // палитра прототипа: тёмный холст либо песочный
  const c = useMemo(
    () => ({
      bg: dark ? INK : '#F1EFE9',
      fg: dark ? '#FFFFFF' : INK,
      card: dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      line: dark ? 'rgba(255,255,255,0.14)' : 'rgba(18,18,18,0.06)',
      mute: dark ? 'rgba(255,255,255,0.5)' : '#8E8C86',
      avBorder: dark ? '#2A2A2A' : '#FFFFFF',
      accent: dark ? LIME : INK,
      dot: dark ? 'rgba(255,255,255,0.07)' : 'rgba(18,18,18,0.06)',
    }),
    [dark],
  );

  const [feedFilter, setFeedFilter] = useState<'crew' | 'all'>('all');
  /*
    Лента грузится порциями: сразу шесть событий, дальше по мере прокрутки.
    Целиком она уезжала на несколько экранов вниз, и до нижних секций никто
    не доходил.
  */
  const [logoSheet, setLogoSheet] = useState(false);
  // карточка заведения: условия и «сплитить здесь»
  const [venueSheet, setVenueSheet] = useState<{ name: string; tag: string; terms: string } | null>(null);
  const [shown, setShown] = useState(FEED_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pinged, setPinged] = useState<Set<string>>(new Set());

  const feed = useMemo(
    () => homeFeed(home.db, home.nameOfContact),
    [home.db, home.nameOfContact],
  );
  const filtered = feedFilter === 'crew' ? feed.filter((f) => f.crew) : feed;
  const shownFeed = filtered.slice(0, shown);
  const hasMore = filtered.length > shownFeed.length;

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setShown((n) => n + FEED_PAGE);
      setLoadingMore(false);
    }, 400);
  };

  /*
    «Где Zарабатывать»: сперва заведения из данных, у которых есть предложение,
    затем партнёры из общего списка (они же в промо-карусели классической
    главной). Без второго ряд почти всегда пустой — предложения приходят не по
    всем мерчантам, а прототип показывает витрину.
  */
  const offers = useMemo(() => {
    const own = (home.db?.merchants ?? [])
      .filter((m) => m.offer)
      .map((m) => ({
        key: m.id,
        name: m.name,
        letter: m.letter,
        color: m.color,
        // подложка логотипа фирменная: у Bellissimo она лаймовая, как в макете
        plate: venuePlate(m.name),
        fg: INK,
        tag: m.offer?.label ?? '',
        terms: m.offer?.terms ?? '',
      }));
    const taken = new Set(own.map((o) => o.name.toLowerCase()));
    const partners = VENUES.filter((v) => !taken.has(v.name.toLowerCase())).map((v) => ({
      key: v.id,
      name: v.name,
      letter: v.abbr ?? v.name,
      color: v.logoBg ?? '#EAE8E1',
      plate: v.logoBg,
      fg: v.logoFg ?? INK,
      tag: translate(`badge.${v.badgeKind}`, { v: v.badgeValue }),
      terms: hasKey(`offers.${v.id}`) ? translate(`offers.${v.id}`) : '',
    }));
    return [...own, ...partners];
  }, [home.db?.merchants]);

  const promo = offers[0];

  const firstName = (home.db?.user?.name ?? '').split(' ')[0] ?? '';

  /** Компания в ленте сторис: знак, цвет и есть ли незакрытый счёт. */
  const crews = useMemo(
    () =>
      home.groups.map((g) => {
        const active = home.splits.find((s) => s.groupId === g.id && s.status === 'active');
        const waiting = active
          ? active.members.filter((m) => m.status !== 'paid' && m.status !== 'debt')
          : [];
        return {
          id: g.id,
          name: g.name,
          glyph: crewEmojiOf(home.db, g.id),
          color: crewColorOf(home.db, g.id),
          fresh: !!active,
          split: active,
          waiting,
          members: g.memberIds,
        };
      }),
    // signs — версия локальных знаков: без неё смена эмодзи не долетит сюда
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [home.groups, home.splits, home.db, signs],
  );

  /** ⚡ по компании: напоминание всем, кто ещё не закрыл долю. */
  const pingCrew = async (crewId: string) => {
    const crew = crews.find((x) => x.id === crewId);
    if (!crew?.split || !crew.waiting.length) return;
    setPinged((p) => new Set([...p, crewId]));
    cue('reminder');
    try {
      for (const m of crew.waiting) {
        await remindMember(crew.split.id, (m as { memberId?: string }).memberId ?? m.contactId);
      }
      toast.success(t('home2.pingedCrew', { name: crew.name }));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
  };

  /** ⚡ в ленте: по конкретному участнику или долгу. */
  const pingFeed = async (item: { id: string; splitId?: string; memberId?: string; who: string }) => {
    if (!item.splitId || !item.memberId) return;
    setPinged((p) => new Set([...p, item.id]));
    cue('reminder');
    try {
      await remindMember(item.splitId, item.memberId);
      toast.success(t('live.pingToast', { name: item.who.split(' ')[0] }));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
  };

  /*
    Прокрутка: стекло шапки проявляется на первых 60 pt, а у нижнего края
    подгружается лента. Хендлер один — он на UI-потоке, поэтому подгрузку
    зовём через runOnJS.
  */
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const bottom = e.contentOffset.y + e.layoutMeasurement.height;
    if (bottom > e.contentSize.height - 240) runOnJS(loadMore)();
  });
  const headGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], 'clamp'),
  }));

  // маскот на промо-карточке качается, как в прототипе (float 4s)
  const floatY = useSharedValue(0);
  React.useEffect(() => {
    if (reduceMotion()) return;
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [floatY]);
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  return (
    /*
      edges={[]} — безопасную зону сверху отрабатывает сама шапка своим
      paddingTop. С edges={['top']} её добавлял ещё и SafeAreaView, причём
      асинхронно: контент уезжал вниз на высоту статус-бара уже после первой
      раскладки — это и была та самая пустая полоса.
    */
    <Screen style={styles.root} background={c.bg} darkBar={dark} edges={NO_EDGES} noTopFade>
      {/* фон в точку: 1 px через 14 — как background-image в прототипе */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="dots" width={14} height={14} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={c.dot} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#dots)" />
      </Svg>

      {/*
        contentInsetAdjustmentBehavior=never: iOS сам добавляет скроллу у края
        экрана верхний инсет безопасной зоны, и вместе с нашим отступом под
        шапку он складывался в пустую полосу над сторис.
      */}
      {/*
        Шапка плавает над лентой — как на классической главной: контейнер
        абсолютом, внутри обычный ряд. Липкий заголовок внутри скролла я уже
        пробовал: RN оборачивает его по-своему, и ряд разъезжался в колонку.
      */}
      <View
        style={[styles.head, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.headGlass, headGlassStyle]} pointerEvents="none">
          <Glass
            dark={dark}
            amount={18}
            fallback={dark ? 'rgba(18,18,18,0.82)' : 'rgba(241,239,233,0.82)'}
            tint={dark ? 'rgba(18,18,18,0.28)' : 'rgba(255,255,255,0.24)'}
            style={StyleSheet.absoluteFill as object}
          />
        </Animated.View>

        <View style={styles.headRow}>
          {/* тап по логотипу — выбор его стиля, как в прототипе */}
          <PressableScale haptic={false} onPress={() => setLogoSheet(true)}>
            <Image source={HOME_LOGOS[logo]?.src ?? LOGO} style={styles.logo} resizeMode="contain" />
          </PressableScale>
          <View style={styles.headBtns}>
            <PressableScale
              small
              style={[styles.round, { backgroundColor: c.card, borderColor: c.line }]}
              onPress={() => nav.navigate('Scan')}
            >
              <ScanIcon size={18} color={c.fg} strokeWidth={2} />
            </PressableScale>
            <PressableScale small onPress={() => nav.navigate('Profile')}>
              <Avatar contactId="me" size={40} ring={c.accent} ringWidth={3} />
            </PressableScale>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        /*
          Верхний инсет гасим тремя способами сразу: iOS упорно добавляет
          скроллу у края экрана высоту статус-бара, и она складывалась с нашим
          отступом под шапку — между логотипом и сторис зияла полоса.
        */
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentInset={ZERO_INSET}
        scrollIndicatorInsets={ZERO_INSET}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 74 }]}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        {/* сторис компаний */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stories}
        >
          {/* «Что нового» — сводка месяца: единственный экран, где это и лежит */}
          <PressableScale haptic={false} style={styles.story} onPress={() => nav.navigate('Recap')}>
            <View style={[styles.storyRing, { borderColor: c.accent, borderStyle: 'solid' }]}>
              <View style={[styles.storyInner, { backgroundColor: INK }]}>
                <Text style={styles.storyGlyph}>💸</Text>
                <View style={[styles.storyDot, { backgroundColor: LIME, borderColor: INK }]} />
              </View>
            </View>
            <Text style={[styles.storyName, { color: c.fg }]} numberOfLines={1}>
              {t('home2.whatsNew')}
            </Text>
          </PressableScale>

          {crews.map((crew) => (
            <PressableScale
              key={crew.id}
              haptic={false}
              style={styles.story}
              onPress={() => nav.navigate('Group', { id: crew.id })}
            >
              <View
                style={[
                  styles.storyRing,
                  {
                    borderColor: crew.fresh ? c.accent : c.mute,
                    borderStyle: crew.fresh ? 'solid' : 'dashed',
                  },
                ]}
              >
                <View style={[styles.storyInner, { backgroundColor: crew.color }]}>
                  <Text style={styles.storyGlyph}>{crew.glyph}</Text>
                </View>
              </View>
              <Text style={[styles.storyName, { color: c.fg }]} numberOfLines={1}>
                {crew.name}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>

        {/* герой */}
        <View style={styles.hero}>
          <Text style={[styles.heroKicker, { color: c.mute }]} numberOfLines={1}>
            {t('home2.greeting', { name: firstName.toUpperCase() })}
          </Text>
          <Text style={[styles.heroLine, { color: c.fg }]}>{t('home2.heroSplit')}</Text>
          <Text
            style={[
              styles.heroLine,
              styles.heroAccent,
              dark ? { color: LIME } : { color: INK, backgroundColor: LIME },
            ]}
          >
            {t('home2.heroEarn')}
          </Text>
        </View>

        {/* промо: лаймовая карточка под наклоном и белая поверх */}
        {promo ? (
          <PressableScale
            haptic={false}
            style={styles.promoWrap}
            onPress={() => nav.navigate('Cashback')}
          >
            <View style={[styles.promoTilt, { backgroundColor: LIME }]} />
            <View style={styles.promoCard}>
              <Text style={styles.promoTitle} numberOfLines={3}>
                {t('home.offerAt', { label: promo.tag, name: promo.name })}
              </Text>
              <Text style={styles.promoSub} numberOfLines={2}>{promo.terms}</Text>
              {/*
                «Собрать Crew» ведёт туда, где компания и собирается: пад суммы,
                следом выбор людей. Экран участников сам по себе не открывается —
                без суммы он отправляет обратно на сканер.
              */}
              <PressableScale style={styles.promoCta} onPress={() => nav.navigate('Amount')}>
                <Text style={styles.promoCtaText}>{t('home2.promoCta')}</Text>
                <Text style={styles.promoCtaArrow}>→</Text>
              </PressableScale>
              <Animated.Image source={MASCOT} style={[styles.mascot, mascotStyle]} resizeMode="contain" />
            </View>
          </PressableScale>
        ) : null}

        {/* две плитки: кэшбэк и должники */}
        <View style={styles.tiles}>
          <PressableScale
            haptic={false}
            style={[styles.tile, { backgroundColor: LIME }]}
            onPress={() => nav.navigate('Cashback')}
          >
            <Text style={[styles.tileKicker, { color: '#5A6A16' }]}>{t('home2.tileCashback')}</Text>
            <Text style={[styles.tileValue, { color: INK }]} numberOfLines={1} adjustsFontSizeToFit>
              {compact(home.cashbackBalance)}
            </Text>
            <Text style={[styles.tileSub, { color: '#5A6A16' }]} numberOfLines={1}>
              {t('home2.tileGroups', { n: home.groups.length })}
            </Text>
            <Image source={STK_RECEIPT} style={styles.tileArtRight} resizeMode="contain" />
          </PressableScale>

          <PressableScale
            haptic={false}
            style={[styles.tile, { backgroundColor: c.card, borderColor: c.line, borderWidth: 1 }]}
            onPress={() => nav.navigate('Debts')}
          >
            <Text style={[styles.tileKicker, { color: c.mute }]}>{t('home2.tileOwed')}</Text>
            <Text style={[styles.tileValue, { color: c.fg }]} numberOfLines={1} adjustsFontSizeToFit>
              {compact(home.totalOwedToMe)}
            </Text>
            <View style={styles.tileFaces}>
              {home.debtors.slice(0, 2).map((d, i) => (
                <Avatar
                  key={d.id}
                  contactId={d.id}
                  name={d.name}
                  color={d.color}
                  size={18}
                  ring={c.avBorder}
                  ringWidth={1.5}
                  style={i > 0 ? styles.tileFaceStacked : undefined}
                />
              ))}
              <Text style={[styles.tileSub, { color: c.mute, marginLeft: 6 }]} numberOfLines={1}>
                {peopleCount(home.debtors.length)}
              </Text>
            </View>
            <Image source={STK_CHECK} style={styles.tileArtRight} resizeMode="contain" />
          </PressableScale>
        </View>

        {/* твои Crews */}
        {crews.length ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: c.fg }]}>{t('home2.crews')}</Text>
              <PressableScale haptic={false} onPress={() => nav.navigate('Crews')}>
                <Text style={[styles.sectionLink, { color: c.accent }]}>
                  {t('home2.seeAllN', { n: crews.length })}
                </Text>
              </PressableScale>
            </View>

            <View style={styles.crewRows}>
              {crews.slice(0, 3).map((crew) => (
                <PressableScale
                  key={crew.id}
                  haptic={false}
                  style={[styles.crewRow, { backgroundColor: c.card, borderColor: c.line }]}
                  onPress={() => nav.navigate('Group', { id: crew.id })}
                >
                  <View style={[styles.crewIcon, { backgroundColor: crew.color }]}>
                    <Text style={styles.crewIconGlyph}>{crew.glyph}</Text>
                  </View>
                  <View style={styles.crewBody}>
                    <Text style={[styles.crewTitle, { color: c.fg }]} numberOfLines={1}>
                      {crew.split ? `${crew.name} · ${crew.split.title}` : crew.name}
                    </Text>
                    <View style={styles.crewSubRow}>
                      {crew.members.slice(0, 3).map((cid, i) => (
                        <Avatar
                          key={cid}
                          contactId={cid}
                          name={home.nameOfContact(cid)}
                          color={home.contactById(cid)?.color}
                          size={18}
                          ring={c.avBorder}
                          ringWidth={1.5}
                          style={i > 0 ? styles.tileFaceStacked : undefined}
                        />
                      ))}
                      <Text style={[styles.crewSub, { color: c.mute }]} numberOfLines={1}>
                        {crew.split
                          ? t('home2.crewWaiting', {
                              n: crew.waiting.length,
                              amount: money(crew.split.total),
                            })
                          : t('home2.crewSettled')}
                      </Text>
                    </View>
                  </View>

                  {crew.waiting.length ? (
                    <PressableScale
                      small
                      disabled={pinged.has(crew.id)}
                      style={[styles.crewPing, pinged.has(crew.id) && styles.dim]}
                      onPress={() => void pingCrew(crew.id)}
                    >
                      <Text style={styles.crewPingGlyph}>⚡</Text>
                    </PressableScale>
                  ) : (
                    /*
                      «Всё оплачено»: в макете это тонкая галочка-обводка, а не
                      текстовый ✓ — тот вставал жирной кляксой и спорил с ⚡
                      соседней строки.
                    */
                    <View style={[styles.crewDone, { backgroundColor: c.card, borderColor: c.line }]}>
                      <CheckIcon size={18} color={c.accent} strokeWidth={2.6} />
                    </View>
                  )}
                </PressableScale>
              ))}
            </View>
          </>
        ) : null}

        {/* где зарабатывать */}
        {offers.length ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: c.fg }]}>{t('home2.earn')}</Text>
              <Text style={[styles.sectionLink, { color: c.accent }]}>{offers.length} →</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.merchants}
            >
              {offers.map((m, i) => {
                const logo = merchantLogo(m.name);
                return (
                  /*
                    Наклон живёт на обёртке: PressableScale держит собственный
                    transform для нажатия и затирает наш — плитки вставали
                    ровными вопреки прототипу.
                  */
                  <View key={m.key} style={{ transform: [{ rotate: i % 2 ? '2deg' : '-2deg' }] }}>
                  <PressableScale
                    haptic={false}
                    style={[
                      styles.merchant,
                      // чередование белая/лаймовая — ритм витрины из прототипа
                      { backgroundColor: i % 2 ? LIME : '#FFFFFF' },
                    ]}
                    onPress={() => setVenueSheet({ name: m.name, tag: m.tag, terms: m.terms })}
                  >
                    <View
                      style={[
                        styles.merchantLogo,
                        { backgroundColor: logo ? (m.plate ?? '#FFFFFF') : m.color },
                      ]}
                    >
                      {logo ? (
                        <Image source={logo} style={styles.merchantLogoImg} resizeMode="contain" />
                      ) : (
                        <Text style={[styles.merchantLetter, { color: m.fg }]} numberOfLines={2}>
                          {m.letter}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.merchantName} numberOfLines={1}>{shortName(m.name)}</Text>
                    <View style={styles.merchantTag}>
                      <Text style={styles.merchantTagText} numberOfLines={1}>{m.tag}</Text>
                    </View>
                  </PressableScale>
                  </View>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* лента */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: c.fg }]}>{t('home2.feed')}</Text>
          <View style={styles.filters}>
            {(['crew', 'all'] as const).map((f) => (
              <PressableScale
                key={f}
                haptic={false}
                style={[
                  styles.filter,
                  {
                    backgroundColor: feedFilter === f ? LIME : c.card,
                    borderColor: c.line,
                  },
                ]}
                onPress={() => setFeedFilter(f)}
              >
                <Text style={[styles.filterText, { color: feedFilter === f ? INK : c.fg }]}>
                  {f === 'crew' ? t('home2.filterCrew') : t('home2.filterAll')}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.feed}>
          {shownFeed.map((item) => (
            <Animated.View key={item.id} entering={FadeIn.duration(200)} style={styles.feedRow}>
              <View style={[styles.feedFace, item.bolt && { backgroundColor: LIME }]}>
                {item.bolt ? (
                  <Text style={styles.feedBolt}>⚡</Text>
                ) : (
                  <View style={item.dim ? styles.dim : undefined}>
                    <Avatar
                      contactId={item.contactId ?? 'me'}
                      name={item.who}
                      color={home.contactById(item.contactId ?? '')?.color}
                      size={36}
                    />
                  </View>
                )}
              </View>

              <PressableScale
                haptic={false}
                style={[styles.bubble, { backgroundColor: c.card, borderColor: c.line }]}
                onPress={() => item.splitId && nav.navigate('SplitLive', { id: item.splitId })}
              >
                <Text style={[styles.bubbleText, { color: c.fg }]}>
                  <Text style={styles.bubbleWho}>{item.who}</Text>
                  {` ${item.text}`}
                  {item.tail ? <Text style={{ color: c.mute }}>{` ${item.tail}`}</Text> : null}
                </Text>
                <View style={styles.bubbleFoot}>
                  <Text style={[styles.bubbleTime, { color: c.mute }]} numberOfLines={1}>{item.time}</Text>
                  {item.memberId ? (
                    <PingButton size={28} pinged={pinged.has(item.id)} onPress={() => void pingFeed(item)} />
                  ) : null}
                </View>
              </PressableScale>
            </Animated.View>
          ))}
          {hasMore ? (
            <View style={styles.feedMore}>
              <ActivityIndicator size="small" color={c.mute} />
              <Text style={[styles.feedMoreText, { color: c.mute }]}>{t('home2.loadingMore')}</Text>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/*
        Растворение низа: в прототипе под таб-баром градиент в цвет фона, без
        него лента упиралась в плашку и читалась как обрезанная.
      */}
      <Svg style={styles.bottomFade} pointerEvents="none">
        <Defs>
          <LinearGradient id="homeFade" x1="0" y1="0" x2="0" y2="1">
            {/*
              Заливка начинается сразу над пиллом (≈95 pt от низа), выше —
              мягкий переход. Тянуть её выше нельзя: чёрная полоса съедала
              заголовок «Твои Crews», а обрывать по середине пилла — он
              становился двухцветным.
            */}
            <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
            <Stop offset="0.37" stopColor={c.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#homeFade)" />
      </Svg>

      {/* выбор логотипа — как в прототипе: сетка стилей */}
      <BottomSheet open={logoSheet} onClose={() => setLogoSheet(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('home2.logoTitle')}</Text>
        <Text style={[styles.sheetSub, { color: colors.muted }]}>{t('home2.logoHint')}</Text>
        <View style={styles.logoGrid}>
          {HOME_LOGOS.map((l, i) => (
            <PressableScale
              key={l.key}
              haptic={false}
              style={[
                styles.logoCell,
                { backgroundColor: l.bg, borderColor: i === logo ? colors.ink : 'transparent' },
              ]}
              onPress={() => {
                setHomeLogo(i);
                setLogoSheet(false);
              }}
            >
              <Image source={l.src} style={styles.logoCellImg} resizeMode="contain" />
            </PressableScale>
          ))}
        </View>
      </BottomSheet>

      {/* карточка заведения: условия предложения и путь к сплиту */}
      <BottomSheet open={!!venueSheet} onClose={() => setVenueSheet(null)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]} numberOfLines={1}>
          {venueSheet?.name}
        </Text>
        <View style={[styles.venueTag, { backgroundColor: colors.ctaBg }]}>
          <Text style={[styles.venueTagText, { color: colors.ctaFg }]}>{venueSheet?.tag}</Text>
        </View>
        {venueSheet?.terms ? (
          <Text style={[styles.sheetSub, { color: colors.muted }]}>{venueSheet.terms}</Text>
        ) : null}
        <PressableScale
          primary
          style={[styles.venueCta, { backgroundColor: colors.ctaBg }]}
          onPress={() => {
            setVenueSheet(null);
            nav.navigate('Amount');
          }}
        >
          <Text style={[styles.venueCtaText, { color: colors.ctaFg }]}>{t('home2.venueCta')}</Text>
        </PressableScale>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 0 },
  scroll: { paddingBottom: 120 },

  head: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, paddingHorizontal: 16, paddingBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headGlass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  logo: { height: 44, width: 68 },
  headBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  stories: { gap: 14, paddingLeft: 16, paddingRight: 16, paddingTop: 8 },
  story: { alignItems: 'center', gap: 6, width: 68 },
  storyRing: { width: 64, height: 64, borderRadius: 999, borderWidth: 2, padding: 3 },
  storyInner: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyGlyph: { fontSize: 26, lineHeight: 32 },
  storyDot: { position: 'absolute', right: 4, top: 4, width: 9, height: 9, borderRadius: 999, borderWidth: 2 },
  storyName: { fontFamily: fontHome.bold, fontSize: 10 },

  hero: { paddingHorizontal: 16, paddingTop: 26 },
  heroKicker: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 2.5 },
  // 44/900 с плотным интерлиньяжем — как в прототипе
  heroLine: { fontFamily: fontHome.black, fontSize: 42, lineHeight: 44, letterSpacing: -1.5, marginTop: 8 },
  heroAccent: { alignSelf: 'flex-start', marginTop: 0, borderRadius: 8, paddingHorizontal: 6, fontStyle: 'italic' },

  promoWrap: { height: 196, marginHorizontal: 16, marginTop: 22 },
  promoTilt: { ...StyleSheet.absoluteFill, borderRadius: 26, transform: [{ rotate: '-2deg' }] },
  promoCard: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 18, overflow: 'hidden' },
  promoTitle: { fontFamily: fontHome.black, fontSize: 24, lineHeight: 26, letterSpacing: -0.6, color: INK, marginTop: 10, width: 190 },
  promoSub: { fontFamily: fontHome.semibold, fontSize: 11, color: '#8E8C86', marginTop: 8, width: 180 },
  promoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    height: 36,
    borderRadius: 18,
    backgroundColor: INK,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  promoCtaText: { fontFamily: fontHome.extrabold, fontSize: 12, color: LIME },
  promoCtaArrow: { fontFamily: fontHome.extrabold, fontSize: 12, color: LIME },
  mascot: { position: 'absolute', right: -8, bottom: -10, width: 150, height: 150 },

  tiles: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 22 },
  tile: { flex: 1, minHeight: 128, borderRadius: 24, padding: 14, overflow: 'hidden' },
  tileKicker: { fontFamily: font.monoBold, fontSize: 7, letterSpacing: 2 },
  tileValue: { fontFamily: fontHome.black, fontSize: 26, letterSpacing: -0.5, marginTop: 8 },
  tileSub: { fontFamily: fontHome.semibold, fontSize: 10, marginTop: 3 },
  tileFaces: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  tileFaceStacked: { marginLeft: -8 },
  tileArtRight: { position: 'absolute', right: -6, bottom: -8, width: 82, height: 82 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 26 },
  sectionTitle: { fontFamily: fontHome.black, fontSize: 20, letterSpacing: -0.5 },
  sectionLink: { fontFamily: fontHome.extrabold, fontSize: 12 },

  crewRows: { gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  crewIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  crewIconGlyph: { fontSize: 20 },
  crewBody: { flex: 1, minWidth: 0 },
  crewTitle: { fontFamily: fontHome.black, fontSize: 14 },
  crewSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  crewSub: { fontFamily: fontHome.semibold, fontSize: 10, marginLeft: 6, flexShrink: 1 },
  crewPing: { width: 44, height: 44, borderRadius: 999, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  crewPingGlyph: { fontSize: 18 },
  crewDone: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  merchants: { gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  merchant: {
    width: 118,
    borderRadius: 22,
    padding: 12,
    // мягкая тень из прототипа — без неё плитки выглядят наклейками на бумаге
    shadowColor: INK,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  merchantLogo: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  merchantLogoImg: { width: '100%', height: '100%' },
  merchantLetter: { fontFamily: fontHome.extrabold, fontSize: 11, lineHeight: 13, textAlign: 'center', paddingHorizontal: 3 },
  merchantName: { fontFamily: fontHome.black, fontSize: 13, color: INK, marginTop: 12 },
  merchantTag: { alignSelf: 'flex-start', backgroundColor: INK, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 6 },
  merchantTagText: { fontFamily: fontHome.extrabold, fontSize: 10, color: LIME },

  filters: { flexDirection: 'row', gap: 6 },
  filter: { height: 26, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, justifyContent: 'center' },
  filterText: { fontFamily: fontHome.extrabold, fontSize: 11 },

  feed: { gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  feedFace: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feedBolt: { fontSize: 16 },
  // «хвостик» слева сверху, как у пузыря сообщения
  bubble: { flex: 1, borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, paddingVertical: 12, paddingHorizontal: 14 },
  bubbleText: { fontFamily: fontHome.semibold, fontSize: 13, lineHeight: 18 },
  bubbleWho: { fontFamily: fontHome.extrabold },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  bubbleTime: { fontFamily: fontHome.semibold, fontSize: 10, flexShrink: 1 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  sheetTitle: { fontFamily: fontHome.black, fontSize: 19, letterSpacing: -0.4 },
  sheetSub: { fontFamily: fontHome.semibold, fontSize: 12.5, marginTop: 4 },
  logoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, paddingBottom: 4 },
  logoCell: { width: '47%', height: 104, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  logoCellImg: { width: '64%', height: 54 },
  venueTag: { alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginTop: 10 },
  venueTagText: { fontFamily: fontHome.extrabold, fontSize: 12 },
  venueCta: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  venueCtaText: { fontFamily: fontHome.extrabold, fontSize: 15 },
  feedMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  feedMoreText: { fontFamily: fontHome.semibold, fontSize: 11 },

  dim: { opacity: 0.5 },
});
