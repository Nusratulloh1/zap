// Профиль — порт ProfilePage.vue (дизайн 5j): аватар с лаймовой обводкой,
// чип «ZAP! с мая 2026», стат-тайлы, КАРТЫ (добавление: форма → SMS → проверка),
// НАСТРОЙКИ (смена PIN, уведомления, язык, тема, мои группы, выйти).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { BottomSheet } from '@/components/BottomSheet';
import { PinDots } from '@/components/PinDots';
import { AvatarSheet } from '@/components/AvatarSheet';
import { SkinSheet } from '@/components/SkinSheet';
import { useSkin } from '@/lib/screenSkin';
import { PlayerCard } from '@/components/PlayerCard';
import { AchievementStrip } from '@/components/AchievementStrip';
import { STICKER } from '@/components/EmptyState';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
// SunIcon и MoonIcon нужны только скрытому переключателю темы, см. ниже
import { BackIcon } from '@/components/icons';
import { refocus, useKeyboardLock } from '@/lib/keyboard';
import { Toggle } from '@/components/Toggle';
import { toast } from '@/components/ToastHost';
import { addCard, setPrimaryCard, changePin, toggleDebtNotifications, fetchRecap } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { useSession } from '@/store/session';
import { money, phone, monthYear } from '@/lib/format';
import { titlesFor, personalBest, favouriteTheme, type TitleKey } from '@/lib/funStats';
import { useMyAvatar } from '@/lib/myAvatar';
import { APP_ICONS, ICON_PREVIEW, currentAppIcon, setAppIcon, type AppIconKey } from '@/lib/appIcon';
import { applyLocale, LOCALES, type Locale } from '@/i18n';
import { http } from '@/api/client';
import { trigger } from 'react-native-haptic-feedback';
import { themeByKey } from '@/lib/merchantTheme';
import { currentLocale } from '@/i18n';
import { ZapLoader } from '@/components/ZapLoader';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';
import type { Card } from '@zap/shared/types';

/** Все титулы (§C12) в порядке показа: ключ + значок открытого состояния. */
const ALL_TITLES: readonly [TitleKey, string][] = [
  ['fastestFinger', '⚡'],
  ['reliableOne', '🤝'],
  ['bigSpender', '💸'],
  ['pizzaCFO', '🍕'],
  ['coffeeAddict', '☕'],
  ['lastPayer', '👀'],
];

/** убирает ведущий эмодзи из названия темы — стикер уже показан рядом */
function stripGlyph(v: string): string {
  return v.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const logout = useSession((s) => s.logout);

  const me = home.db?.user;
  const cards = home.db?.cards ?? [];
  const groups = home.db?.groups ?? [];
  const [notifs, setNotifs] = useState(home.db?.settings.debtNotifications ?? true);
  useEffect(() => {
    if (home.db) setNotifs(home.db.settings.debtNotifications);
  }, [home.db]);

  const sinceLabel = (() => {
    const ts = Date.parse(me?.memberSince ?? '');
    if (Number.isNaN(ts)) return me?.memberSince ?? '';
    return monthYear(ts);
  })();

  // ---- добавление карты: форма → SMS → «проверяем карту» ----
  const [cardSheet, setCardSheet] = useState(false);
  const [cardStep, setCardStep] = useState<'form' | 'sms' | 'check'>('form');
  const [cardNetwork, setCardNetwork] = useState<Card['network']>('UZCARD');
  const [cardDigits, setCardDigits] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardOwner, setCardOwner] = useState('');
  const [cardSms, setCardSms] = useState('');
  const savingCard = useRef(false);

  const cardMask = cardDigits.padEnd(16, '•').match(/.{1,4}/g)?.join(' ') ?? '';
  const expiryValid = (() => {
    const m = cardExpiry.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const mm = Number(m[1]);
    return mm >= 1 && mm <= 12;
  })();
  const cardFormValid = cardDigits.length === 16 && expiryValid && cardOwner.trim().length >= 3;

  const openCardSheet = () => {
    setCardStep('form');
    setCardDigits('');
    setCardExpiry('');
    setCardOwner('');
    setCardSms('');
    setCardSheet(true);
  };

  useEffect(() => {
    // мок как в вебе: любой 6-значный код подтверждает, потом «проверка карты»
    if (cardSms.length !== 6 || savingCard.current) return;
    savingCard.current = true;
    void (async () => {
      await new Promise<void>((r) => setTimeout(r, 600));
      setCardStep('check');
      await new Promise<void>((r) => setTimeout(r, 1400));
      await addCard(cardNetwork, cardDigits.slice(-4));
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      savingCard.current = false;
      setCardSheet(false);
      toast.success(t('profile.cardAddedConfirmed'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSms]);

  const makePrimary = async (cardId: string, last4: string) => {
    await setPrimaryCard(cardId);
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
    toast.success(t('profile.cardNowPrimary', { last4 }));
  };

  // ---- смена PIN: старый → новый → повтор ----
  const [pinSheet, setPinSheet] = useState(false);
  const [pinStep, setPinStep] = useState<'old' | 'new' | 'repeat'>('old');
  const [pinOld, setPinOld] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinRepeat, setPinRepeat] = useState('');
  const [pinShake, setPinShake] = useState(false);
  const [pinError, setPinError] = useState('');
  const pinInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const cardNumberInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  const pinModel = pinStep === 'old' ? pinOld : pinStep === 'new' ? pinNew : pinRepeat;
  const setPinModel = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    if (pinStep === 'old') setPinOld(d);
    else if (pinStep === 'new') setPinNew(d);
    else setPinRepeat(d);
  };

  const openPinFlow = () => {
    setPinStep('old');
    setPinOld('');
    setPinNew('');
    setPinRepeat('');
    setPinError('');
    setPinSheet(true);
    setTimeout(() => pinInput.current?.focus(), 360);
  };

  const pinFail = (msg: string) => {
    setPinError(msg);
    setPinShake(true);
    setTimeout(() => {
      setPinShake(false);
      setPinModel('');
    }, 420);
  };

  useEffect(() => {
    if (pinModel.length !== 4) return;
    setPinError('');
    if (pinStep === 'old') setTimeout(() => setPinStep('new'), 220);
    else if (pinStep === 'new') setTimeout(() => setPinStep('repeat'), 220);
    else {
      void (async () => {
        if (pinRepeat !== pinNew) {
          pinFail(t('profile.pinMismatch'));
          return;
        }
        const ok = await changePin(pinOld, pinNew);
        if (!ok) {
          setPinStep('old');
          setPinOld('');
          setPinNew('');
          setPinRepeat('');
          pinFail(t('profile.pinOldWrong'));
          return;
        }
        setPinSheet(false);
        toast.success(t('profile.pinUpdated'));
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinModel]);

  const pinTitle =
    pinStep === 'old' ? t('profile.pinOld') : pinStep === 'new' ? t('profile.pinNew') : t('profile.pinRepeat');

  // ---- прочее ----
  const [groupsSheet, setGroupsSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [skinSheet, setSkinSheet] = useState(false);
  const skin = useSkin();
  const skinBg = skin ?? '#D9FF3A';
  const loggingOut = useRef(false);


  const confirmLogout = async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    await logout();
  };

  // Modal ещё анимируется — autoFocus Android глотает; фокусим с паузой
  useEffect(() => {
    if (!pinSheet) return;
    const id = setTimeout(() => pinInput.current?.focus(), 420);
    return () => clearTimeout(id);
  }, [pinSheet, pinStep]);
  useKeyboardLock(pinInput, pinSheet);

  useEffect(() => {
    if (!cardSheet || cardStep !== 'form') return;
    const id = setTimeout(() => cardNumberInput.current?.focus(), 420);
    return () => clearTimeout(id);
  }, [cardSheet, cardStep]);
  useKeyboardLock(cardNumberInput, cardSheet && cardStep === 'form');

  // стекло шапки: проявляется, когда контент уезжает под кнопки (как на главной)
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const glassStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 24], [0, 1], 'clamp') }));

  // Профиль как identity, а не как «Настройки» (vision §C13): свои титулы,
  // любимая категория и личный рекорд скорости. Всё считается из /bootstrap.
  const titles = useMemo(() => titlesFor(home.db, 'me'), [home.db]);
  const best = useMemo(() => personalBest(home.db, 'me'), [home.db]);
  const favTheme = useMemo(() => themeByKey(favouriteTheme(home.db, 'me')), [home.db]);

  /*
    Итоги месяца переехали сюда с главной: это личная статистика, а не ответ
    на вопрос «кто сегодня платит». Карточку показываем только когда есть что
    показать — пустой рекап выглядел бы как сломанный блок.
  */
  // vision V2 §C1: профиль — игровая карточка, всё открыто сразу
  const myAvatar = useMyAvatar();

  const [appIcon, setAppIconState] = useState<AppIconKey>('receipts');
  useEffect(() => {
    void currentAppIcon().then(setAppIconState);
  }, []);
  const pickAppIcon = (key: AppIconKey) => {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    if (key === appIcon) return;
    const run = async () => {
      try {
        await setAppIcon(key);
        setAppIconState(key);
      } catch (e) {
        toast(`${t('profile.appIconFailed')}: ${e instanceof Error ? e.message : ''}`.slice(0, 120));
      }
    };
    // Android при смене алиаса закрывает приложение — предупреждаем заранее
    if (Platform.OS === 'android') {
      Alert.alert(t('profile.appIconTitle'), t('profile.appIconRestart'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.ok'), onPress: () => void run() },
      ]);
    } else void run();
  };

  const locale = currentLocale();
  const pickLocale = (next: Locale) => {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    if (next === locale) return;
    void applyLocale(next).then(() => {
      void http('/me', { method: 'PATCH', body: JSON.stringify({ locale: next }) }).catch(() => undefined);
    });
  };

  const recapQuery = useQuery({ queryKey: ['recap'], queryFn: () => fetchRecap(), staleTime: 60 * 60_000 });
  const recap = recapQuery.data && !recapQuery.data.empty ? recapQuery.data : null;
  const recapMonth = recap ? t(`recap.month.${Number(recap.month.split('-')[1])}`) : '';

  const toggleNotifs = (v: boolean) => {
    setNotifs(v);
    void toggleDebtNotifications(v).catch(() => setNotifs(!v));
  };

  return (
    // без edges: отступ снизу задаёт сама прокрутка, иначе остаётся белая полоса
    // фон: выбранный кнопкой «🎨», по умолчанию — наш лайм
    <Screen style={styles.root} edges={[]} background={skinBg} darkBar={false}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} keyboardDismissMode="interactive" contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }}>
        {me ? (
          <>
            <PlayerCard
              avatar={myAvatar}
              initials={me.initials}
              name={me.name}
              handle={me.handle}
              since={t('profile.since', { date: sinceLabel })}
              splits={me.splitsCount}
              cashback={money(home.cashbackBalance)}
              groups={groups.length}
              onAvatarPress={() => setAvatarSheet(true)}
            />

            {/* ачивки сразу под полосой опыта — компактной лентой медалей */}
            <AchievementStrip all={ALL_TITLES} unlocked={titles.map((tt) => tt.key)} />

            {/*
              Итоги месяца — мини-афиша, а не строка со стрелкой: чернильная
              карточка с лаймовым штампом-молнией, крупный месяц и кнопка.
            */}
            {recap ? (
              <PressableScale
                style={[styles.recapCard, { backgroundColor: fixed.ink }]}
                onPress={() => nav.navigate('Recap')}
              >
                <Image source={STICKER.selfie} style={styles.recapArt} resizeMode="contain" />
                <View style={styles.recapBody}>
                  <Text style={[styles.recapKicker, { color: fixed.lime }]}>{t('profile.recapKicker')}</Text>
                  <Text style={styles.recapMonth} numberOfLines={1}>{recapMonth}</Text>
                </View>
                <View style={[styles.recapBtn, { backgroundColor: fixed.lime }]}>
                  <Text style={styles.recapBtnText}>{t('recap.open')}</Text>
                </View>
              </PressableScale>
            ) : null}

            {/*
              §C13: «не Islam Karimov / +998…», а любимый сплит и самая быстрая
              оплата — двумя плитками с крупным знаком, как статы в игре.
            */}
            {favTheme || best !== null ? (
              <View style={styles.identityRow2}>
                {favTheme ? (
                  <View style={[styles.identityTile, { backgroundColor: colors.paper }]}>
                    <Image
                      source={favTheme.sticker ? STICKER[favTheme.sticker] : STICKER.receiptHero}
                      style={styles.identitySticker}
                      resizeMode="contain"
                    />
                    <Text style={[styles.identityValue, { color: colors.ink }]} numberOfLines={1}>
                      {stripGlyph(t(favTheme.titleKey))}
                    </Text>
                    <Text style={[styles.identityLabel, { color: colors.faint2 }]} numberOfLines={1}>
                      {t('profile.favouriteSplit')}
                    </Text>
                  </View>
                ) : null}
                {best !== null ? (
                  <View style={[styles.identityTile, { backgroundColor: colors.paper }]}>
                    <Image source={STICKER.paidDone} style={styles.identitySticker} resizeMode="contain" />
                    <Text style={[styles.identityValue, { color: colors.ink }]} numberOfLines={1}>
                      {t('profile.seconds', { n: best })}
                    </Text>
                    <Text style={[styles.identityLabel, { color: colors.faint2 }]} numberOfLines={1}>
                      {t('profile.fastestPayment')}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/*
              Карты и настройки — сгруппированными карточками с иконками, а не
              сплошной лентой линий (замечание руководства). Разделители только
              внутри группы и с отступом под иконку.
            */}
            <Text style={[styles.mono, { color: colors.faint2, marginTop: 22 }]}>{t('profile.cards')}</Text>
            <View style={[styles.group, { backgroundColor: colors.paper }]}>
              {cards.map((card, ci) => (
                <PressableScale
                  key={card.id}
                  haptic={false}
                  style={[styles.gRow, ci < cards.length && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
                  onPress={() => !card.primary && void makePrimary(card.id, card.last4)}
                >
                  <View style={[styles.cardBadge, { backgroundColor: card.network === 'UZCARD' ? '#121212' : colors.sand }]}>
                    <Text style={[styles.cardBadgeText, { color: card.network === 'UZCARD' ? fixed.lime : colors.muted }]}>
                      {card.network === 'UZCARD' ? 'UZC' : 'HUMO'}
                    </Text>
                  </View>
                  <Text style={[styles.gTitle, { color: colors.ink }]}>
                    {card.network} ·· {card.last4}
                  </Text>
                  {card.primary ? (
                    <View style={[styles.primaryChip, { backgroundColor: fixed.lime }]}>
                      <Text style={styles.primaryText}>{t('profile.primary')}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.makePrimary, { color: colors.faint2 }]}>{t('profile.makePrimary')}</Text>
                  )}
                </PressableScale>
              ))}
              <PressableScale haptic={false} style={styles.gRow} onPress={openCardSheet}>
                <View style={[styles.gIcon, { backgroundColor: colors.sand }]}>
                  <Text style={[styles.plusGlyph, { color: colors.faint2 }]}>+</Text>
                </View>
                <Text style={[styles.gTitle, { color: colors.faint2 }]}>{t('profile.addCardRow')}</Text>
              </PressableScale>
            </View>

            <Text style={[styles.mono, { color: colors.faint2, marginTop: 22 }]}>{t('profile.settings')}</Text>
            <View style={[styles.group, { backgroundColor: colors.paper }]}>
              <PressableScale haptic={false} style={[styles.gRow, styles.gDiv, { borderBottomColor: colors.sand2 }]} onPress={openPinFlow}>
                <View style={[styles.gIcon, { backgroundColor: colors.sand }]}><Text style={styles.gGlyph}>🔐</Text></View>
                <Text style={[styles.gTitle, { color: colors.ink }]}>{t('profile.pinFaceId')}</Text>
                <Text style={[styles.chevron, { color: colors.mist }]}>›</Text>
              </PressableScale>

              <View style={[styles.gRow, styles.gDiv, { borderBottomColor: colors.sand2 }]}>
                <View style={[styles.gIcon, { backgroundColor: colors.sand }]}><Text style={styles.gGlyph}>🔔</Text></View>
                <Text style={[styles.gTitle, { color: colors.ink }]}>{t('profile.debtNotifs')}</Text>
                <Toggle value={notifs} onChange={toggleNotifs} />
              </View>

              {/* язык — инлайн, без шита: «всё открыто сразу» (vision V2 §C1) */}
              <View style={[styles.gRow, styles.gDiv, { borderBottomColor: colors.sand2 }]}>
                <View style={[styles.gIcon, { backgroundColor: colors.sand }]}><Text style={styles.gGlyph}>🌐</Text></View>
                <Text style={[styles.gTitle, { color: colors.ink }]}>{t('profile.language')}</Text>
                <View style={styles.inlinePills}>
                  {LOCALES.map((l) => (
                    <PressableScale
                      key={l}
                      haptic={false}
                      style={[styles.langPill, { backgroundColor: l === locale ? fixed.lime : colors.sand }]}
                      onPress={() => pickLocale(l)}
                    >
                      <Text style={[styles.langPillText, { color: '#121212' }]}>{l.toUpperCase()}</Text>
                    </PressableScale>
                  ))}
                </View>
              </View>


            </View>

            {/*
              Иконка приложения — сеткой, как в «Appearance» у Telegram:
              секция‑заголовок, карточка, иконки 60 с подписями. Три превью в
              строке настроек не давали понять, что это выбор.
            */}
            <Text style={[styles.mono, { color: colors.faint2, marginTop: 22 }]}>{t('profile.appIconSection')}</Text>
            <View style={[styles.group, { backgroundColor: colors.paper }]}>
              <View style={styles.iconGrid}>
                {APP_ICONS.map((k) => (
                  <PressableScale key={k} haptic={false} style={styles.iconCell} onPress={() => pickAppIcon(k)}>
                    <Image
                      source={ICON_PREVIEW[k]}
                      style={[styles.iconBig, k === appIcon && { borderColor: colors.ink, borderWidth: 2.5 }]}
                    />
                    <Text
                      style={[styles.iconLabel, { color: k === appIcon ? colors.ink : colors.muted }]}
                      numberOfLines={1}
                    >
                      {t(`profile.icon_${k}`)}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            <PressableScale haptic={false} style={[styles.logoutBtn, { borderColor: colors.sand2 }]} onPress={() => setLogoutSheet(true)}>
              <Text style={[styles.logoutText, { color: colors.ember }]}>{t('profile.logout')}</Text>
            </PressableScale>
          </>
        ) : null}
      </Animated.ScrollView>

      {/* шапка поверх скролла: кнопка «назад» и тема — на одной линии */}
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Animated.View style={[styles.topGlass, glassStyle]} pointerEvents="none">
          {/* фон шапки — цвет экрана, иначе при прокрутке сверху белая полоса */}
          <View style={[styles.topGlassFill, { backgroundColor: skinBg }]} />
          <Svg style={styles.topGlassFade} width="100%" height={22}>
            <Defs>
              <LinearGradient id="hdrFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={skinBg} stopOpacity={1} />
                <Stop offset="1" stopColor={skinBg} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <SvgRect x={0} y={0} width="100%" height={22} fill="url(#hdrFade)" />
          </Svg>
        </Animated.View>
        <PressableScale
          small
          accessibilityLabel={t('common.backAria')}
          style={[styles.topBtn, { backgroundColor: colors.sand }]}
          onPress={() => nav.goBack()}
        >
          <BackIcon size={20} color={colors.ink} />
        </PressableScale>
        <PressableScale
          small
          accessibilityLabel={t('skin.title')}
          style={[styles.topBtn, { backgroundColor: colors.sand }]}
          onPress={() => setSkinSheet(true)}
        >
          <Text style={styles.topGlyph}>🎨</Text>
        </PressableScale>
        {/*
          Переключатель темы скрыт: тёмная тема отключена по продуктовому
          решению, см. ThemeProvider. Кнопка оставлена в разметке — вернуть
          тему значит снять комментарий здесь и там.
        */}
        {/* <PressableScale
          small
          accessibilityLabel={name === 'dark' ? t('common.themeLight') : t('common.themeDark')}
          style={[styles.topBtn, { backgroundColor: colors.sand }]}
          onPress={() => setPref(name === 'dark' ? 'light' : 'dark')}
        >
          {name === 'dark' ? <MoonIcon size={19} color={colors.slate} /> : <SunIcon size={19} color={colors.slate} />}
        </PressableScale> */}
      </View>

      {/* новая карта */}
      <BottomSheet open={cardSheet} onClose={() => setCardSheet(false)} locked={cardStep === 'check'}>
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('profile.addCardTitle')}</Text>
          <View style={styles.networkRow}>
            {(['UZCARD', 'HUMO'] as const).map((n) => (
              <PressableScale
                key={n}
                style={[styles.networkChip, { backgroundColor: cardNetwork === n ? colors.ink : colors.sand }]}
                onPress={() => setCardNetwork(n)}
              >
                <Text style={[styles.networkText, { color: cardNetwork === n ? colors.cream : colors.muted }]}>{n}</Text>
              </PressableScale>
            ))}
          </View>

          {cardStep === 'form' ? (
            <>
              <Text style={[styles.fieldMono, { color: colors.faint2 }]}>{t('profile.cardNumberLabel')}</Text>
              <TextInput
                ref={cardNumberInput}
                value={cardDigits}
                onChangeText={(v) => setCardDigits(v.replace(/\D/g, '').slice(0, 16))}
                keyboardType="number-pad"
                style={styles.hiddenField}
              />
              <Text style={[styles.cardMask, { color: colors.ink }]} onPress={() => refocus(cardNumberInput)}>{cardMask}</Text>
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <Text style={[styles.fieldMono, { color: colors.faint2 }]}>{t('profile.cardExpiry')}</Text>
                  <TextInput
                    value={cardExpiry}
                    onChangeText={(v) => {
                      const d = v.replace(/\D/g, '').slice(0, 4);
                      setCardExpiry(d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d);
                    }}
                    keyboardType="number-pad"
                    placeholder={t('profile.cardExpiryPlaceholder')}
                    placeholderTextColor={colors.faint}
                    style={[styles.field, { color: colors.ink, borderBottomColor: colors.sand2 }]}
                  />
                </View>
                <View style={[styles.fieldCol, styles.fieldWide]}>
                  <Text style={[styles.fieldMono, { color: colors.faint2 }]}>{t('profile.cardHolder')}</Text>
                  <TextInput
                    value={cardOwner}
                    onChangeText={setCardOwner}
                    autoCapitalize="characters"
                    placeholder="AZIZ KARIMOV"
                    placeholderTextColor={colors.faint}
                    style={[styles.field, { color: colors.ink, borderBottomColor: colors.sand2 }]}
                  />
                </View>
              </View>
              <PressableScale
                disabled={!cardFormValid}
                style={[styles.sheetCta, { backgroundColor: fixed.lime }, !cardFormValid && styles.disabled]}
                onPress={() => {
                  setCardStep('sms');
                  setCardSms('');
                }}
              >
                <Text style={styles.ctaDark}>{t('common.continue')}</Text>
              </PressableScale>
            </>
          ) : cardStep === 'sms' ? (
            <>
              <Text style={[styles.smsHint, { color: colors.muted }]}>
                {t('profile.codeToNumber', { phone: phone(me?.phone ?? '') })}
              </Text>
              <TextInput
                value={cardSms}
                onChangeText={(v) => setCardSms(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoFocus
                style={styles.hiddenField}
              />
              <View style={styles.smsRow}>
                {Array.from({ length: 6 }, (_, i) => (
                  <View key={i} style={[styles.smsCell, { backgroundColor: colors.sand }]}>
                    <Text style={[styles.smsDigit, { color: colors.ink }]}>{cardSms[i] ?? ''}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.ownerNote, { color: colors.faint }]}>{t('profile.ownerConfirm')}</Text>
            </>
          ) : (
            <View style={styles.checking}>
              {/* кольцо-спиннер, как border-t-lime в вебе */}
              <View style={styles.checkingSpinner}>
                <ZapLoader size="sm" />
              </View>
              <Text style={[styles.checkingTitle, { color: colors.ink }]}>{t('profile.checkingCard')}</Text>
              <Text style={[styles.checkingSub, { color: colors.muted }]}>
                {cardNetwork} ·· {cardDigits.slice(-4)}
              </Text>
            </View>
          )}
        </View>
      </BottomSheet>

      {/* мои группы */}
      <BottomSheet open={groupsSheet} onClose={() => setGroupsSheet(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('profile.myGroups')}</Text>
        {groups.map((g, gi) => (
          <PressableScale
            key={g.id}
            haptic={false}
            style={[styles.groupRow, gi < (home.db?.groups?.length ?? 0) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
            onPress={() => {
              setGroupsSheet(false);
              nav.navigate('Group', { id: g.id });
            }}
          >
            <Text style={[styles.groupName, { color: colors.ink }]}>{g.name}</Text>
            <Text style={[styles.groupCashback, { color: colors.muted }]}>{money(g.cashback)}</Text>
          </PressableScale>
        ))}
      </BottomSheet>

      {/* смена PIN */}
      <BottomSheet open={pinSheet} onClose={() => setPinSheet(false)}>
        <Pressable onPress={() => refocus(pinInput)} style={styles.pinBody}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>{pinTitle}</Text>
          <Text style={[styles.pinHint, { color: pinError ? colors.danger : colors.muted }]}>
            {pinError || t('auth.pinHint')}
          </Text>
          <View style={styles.pinDots}>
            <PinDots filled={pinModel.length} length={4} error={pinShake} size={26} gap={14} barWidth={146} />
          </View>
          <TextInput
            ref={pinInput}
            key={pinStep}
            value={pinModel}
            onChangeText={setPinModel}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            style={styles.hiddenField}
          />
        </Pressable>
      </BottomSheet>

      {/* выход */}
      <SkinSheet open={skinSheet} onClose={() => setSkinSheet(false)} />

      <AvatarSheet open={avatarSheet} onClose={() => setAvatarSheet(false)} onCamera={() => nav.navigate('AvatarCamera')} />

      <BottomSheet open={logoutSheet} onClose={() => setLogoutSheet(false)}>
        <Text style={[styles.confirmTitle, { color: colors.ink }]}>{t('profile.logoutConfirm')}</Text>
        <Text style={[styles.confirmNote, { color: colors.muted }]}>{t('profile.logoutNote')}</Text>
        <View style={styles.confirmRow}>
          <PressableScale style={[styles.confirmBtn, { backgroundColor: colors.sand }]} onPress={() => setLogoutSheet(false)}>
            <Text style={[styles.confirmText, { color: colors.ink }]}>{t('common.cancel')}</Text>
          </PressableScale>
          <PressableScale style={[styles.confirmBtn, { backgroundColor: colors.ink }]} onPress={() => void confirmLogout()}>
            <Text style={[styles.confirmText, { color: colors.cream, fontFamily: font.extrabold }]}>
              {t('profile.logout')}
            </Text>
          </PressableScale>
        </View>
      </BottomSheet>

    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── сгруппированные карточки настроек ──
  group: { borderRadius: 22, marginTop: 10, overflow: 'hidden' },
  mono: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 16, paddingHorizontal: 8 },
  iconCell: { width: '33.33%', alignItems: 'center', paddingHorizontal: 4 },
  iconBig: { width: 60, height: 60, borderRadius: 14, borderWidth: 0, borderColor: 'transparent' },
  iconLabel: { fontFamily: font.semibold, fontSize: 11, marginTop: 7 },
  topGlyph: { fontSize: 17 },
  gRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14 },
  gRowTall: { minHeight: 72 },
  gDiv: { borderBottomWidth: 1 },
  gIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gGlyph: { fontSize: 17 },
  gTitle: { flex: 1, fontFamily: font.bold, fontSize: 15, letterSpacing: -0.2 },
  logoutBtn: { marginTop: 18, height: 52, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: font.extrabold, fontSize: 15 },

  // ── итоги месяца: мини-афиша ──
  recapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    padding: 14,
    marginTop: 22,
  },
  recapArt: { width: 52, height: 46 },
  recapBody: { flex: 1, minWidth: 0 },
  recapKicker: { fontFamily: font.monoBold, fontSize: 9.5, letterSpacing: 1.4 },
  recapMonth: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.3, color: '#F6F4EE', marginTop: 2 },
  recapBtn: { height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  recapBtnText: { fontFamily: font.extrabold, fontSize: 12.5, color: '#121212' },

  // ── две плитки «про меня» ──
  identityRow2: { flexDirection: 'row', gap: 10, marginTop: 10 },
  identityTile: { flex: 1, borderRadius: 22, paddingTop: 6, paddingBottom: 14, paddingHorizontal: 14, overflow: 'hidden' },
  // стикер крупный и «наклеен» — плитка перестаёт быть просто текстом в рамке
  identitySticker: { width: 66, height: 56, marginBottom: 6, marginLeft: -4 },
  identityValue: { fontFamily: font.extrabold, fontSize: 18, letterSpacing: -0.3 },
  identityLabel: { fontFamily: font.monoBold, fontSize: 9, letterSpacing: 1.2, marginTop: 4, textTransform: 'uppercase' },

  topRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBtn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  topGlass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: -22 },
  topGlassFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 22 },
  topGlassFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  root: { paddingHorizontal: SCREEN_PAD_X },
  sinceChip: { alignSelf: 'center', height: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center', marginTop: 2 },
  sinceText: { fontFamily: font.extrabold, fontSize: 11, color: '#121212' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 22 },
  stat: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 3 },
  statValue: { fontFamily: font.extrabold, fontSize: 20 },
  statLabel: { fontFamily: font.bold, fontSize: 11.5 },
  head: { alignItems: 'center', paddingTop: 4, paddingBottom: 6 },
  heroAvatar: {
    width: 124,
    height: 124,
    borderRadius: 999,
    borderWidth: 4,
    overflow: 'visible',
  },
  heroAvatarImg: { width: '100%', height: '100%', borderRadius: 999 },
  heroAvatarFallback: { width: '100%', height: '100%', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  heroAvatarLetter: { fontFamily: font.extrabold, fontSize: 46 },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  editBadgeText: { color: '#D9FF3A', fontSize: 16 },
  heroName: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.4, marginTop: 14 },
  heroHandle: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 3, marginBottom: 10 },
  inlinePills: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  langPill: { height: 34, paddingHorizontal: 13, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  langPillText: { fontFamily: font.extrabold, fontSize: 12.5 },
  iconPreview: { width: 46, height: 46, borderRadius: 12, borderWidth: 2.5, borderColor: 'transparent' },
  cardBadge: { width: 42, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardBadgeText: { fontFamily: font.monoBold, fontSize: 8 },
  plusGlyph: { fontSize: 16, fontFamily: font.semibold },
  primaryChip: { height: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  primaryText: { fontFamily: font.extrabold, fontSize: 11, color: '#121212' },
  makePrimary: { fontFamily: font.bold, fontSize: 12 },
  settingValue: { fontFamily: font.bold, fontSize: 13 },
  chevron: { fontFamily: font.semibold, fontSize: 15 },
  sheetBody: { paddingBottom: 8 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 16, textAlign: 'center', marginBottom: 4 },
  networkRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  networkChip: { height: 36, paddingHorizontal: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  networkText: { fontFamily: font.monoBold, fontSize: 12 },
  fieldMono: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, textAlign: 'center', marginTop: 18 },
  cardMask: { fontFamily: font.monoBold, fontSize: 20, textAlign: 'center', letterSpacing: 2, marginTop: 8 },
  fieldRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  fieldCol: { flex: 1 },
  fieldWide: { flex: 1.6 },
  field: { borderBottomWidth: 2, paddingBottom: 8, fontFamily: font.monoBold, fontSize: 15, textAlign: 'center', marginTop: 6 },
  hiddenField: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  sheetCta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#121212' },
  disabled: { opacity: 0.4 },
  smsHint: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center', marginTop: 18 },
  smsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  smsCell: { width: 36, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smsDigit: { fontFamily: font.extrabold, fontSize: 18 },
  ownerNote: { fontFamily: font.semibold, fontSize: 12, textAlign: 'center', marginTop: 14 },
  checking: { alignItems: 'center', paddingVertical: 26, gap: 4 },
  checkingSpinner: { marginBottom: 10 },
  checkingTitle: { fontFamily: font.bold, fontSize: 15 },
  checkingSub: { fontFamily: font.semibold, fontSize: 12.5 },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderBottomWidth: 1 },
  groupName: { fontFamily: font.bold, fontSize: 15 },
  groupCashback: { fontFamily: font.bold, fontSize: 13 },
  pinBody: { alignItems: 'center', paddingBottom: 12 },
  pinHint: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 4 },
  pinDots: { marginTop: 20 },
  confirmTitle: { fontFamily: font.extrabold, fontSize: 17, textAlign: 'center', marginTop: 8 },
  confirmNote: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', marginTop: 4 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
  confirmBtn: { flex: 1, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: font.bold, fontSize: 15 },
});
