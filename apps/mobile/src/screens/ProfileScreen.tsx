// Профиль — порт ProfilePage.vue (дизайн 5j): аватар с лаймовой обводкой,
// чип «ZAP! с мая 2026», стат-тайлы, КАРТЫ (добавление: форма → SMS → проверка),
// НАСТРОЙКИ (смена PIN, уведомления, язык, тема, мои группы, выйти).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { PinDots } from '@/components/PinDots';
import { Toggle } from '@/components/Toggle';
import { toast } from '@/components/ToastHost';
import { LanguagePickerSheet } from '@/components/LanguageSheet';
import { addCard, setPrimaryCard, changePin, toggleDebtNotifications } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { useSession } from '@/store/session';
import { money, phone, dayMonth } from '@/lib/format';
import { LOCALE_NAMES, currentLocale } from '@/i18n';
import { useTheme, type ThemePref } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import type { Card } from '@zap/shared/types';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, fixed, pref, setPref } = useTheme();
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
    const d = new Date(ts);
    return `${dayMonth(d).split('-').pop()} ${d.getFullYear()}`.trim();
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
  const [languageSheet, setLanguageSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState(false);
  const loggingOut = useRef(false);

  const themeLabel =
    pref === 'system' ? t('profile.themeSystem') : pref === 'dark' ? t('common.themeDark') : t('common.themeLight');
  const cycleTheme = () => {
    const next: ThemePref = pref === 'system' ? 'light' : pref === 'light' ? 'dark' : 'system';
    setPref(next);
  };

  const confirmLogout = async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    await logout();
  };

  const toggleNotifs = (v: boolean) => {
    setNotifs(v);
    void toggleDebtNotifications(v).catch(() => setNotifs(!v));
  };

  return (
    <Screen style={styles.root}>
      <ScreenHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {me ? (
          <>
            <View style={styles.headRow}>
              <Avatar name={me.name} letter={me.initials} contactId="me" color="#111110" size={76} ring={fixed.lime} />
              <View style={styles.headBody}>
                <Text style={[styles.name, { color: colors.ink }]}>{me.name}</Text>
                <Text style={[styles.handle, { color: colors.muted }]}>
                  {me.handle} · {phone(me.phone)}
                </Text>
                <View style={[styles.sinceChip, { backgroundColor: fixed.lime }]}>
                  <Text style={styles.sinceText}>{t('profile.since', { date: sinceLabel })}</Text>
                </View>
              </View>
            </View>

            <View style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: colors.shell }]}>
                <Text style={[styles.statValue, { color: colors.ink }]}>{me.splitsCount}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{t('profile.statSplitsUnit')}</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.shell }]}>
                <Text style={[styles.statValue, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(home.cashbackBalance)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{t('profile.statCashbackUnit')}</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.shell }]}>
                <Text style={[styles.statValue, { color: colors.ink }]}>{groups.length}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{t('profile.statGroupsUnit')}</Text>
              </View>
            </View>

            <Text style={[styles.mono, { color: colors.faint2 }]}>{t('profile.cards')}</Text>
            {cards.map((card) => (
              <PressableScale
                key={card.id}
                haptic={false}
                style={[styles.cardRow, { borderBottomColor: colors.sand2 }]}
                onPress={() => !card.primary && void makePrimary(card.id, card.last4)}
              >
                <View style={[styles.cardBadge, { backgroundColor: card.network === 'UZCARD' ? '#111110' : colors.sand }]}>
                  <Text style={[styles.cardBadgeText, { color: card.network === 'UZCARD' ? fixed.lime : colors.muted }]}>
                    {card.network === 'UZCARD' ? 'UZC' : 'HUMO'}
                  </Text>
                </View>
                <Text style={[styles.cardName, { color: colors.ink }]}>
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
            <PressableScale haptic={false} style={styles.cardRow} onPress={openCardSheet}>
              <View style={[styles.cardBadge, { backgroundColor: colors.sand }]}>
                <Text style={[styles.plusGlyph, { color: colors.faint2 }]}>+</Text>
              </View>
              <Text style={[styles.cardName, { color: colors.faint2 }]}>{t('profile.addCardRow')}</Text>
            </PressableScale>

            <Text style={[styles.mono, { color: colors.faint2, marginTop: 22 }]}>{t('profile.settings')}</Text>

            <PressableScale haptic={false} style={[styles.settingRow, { borderBottomColor: colors.sand2 }]} onPress={openPinFlow}>
              <Text style={[styles.settingText, { color: colors.ink }]}>{t('profile.pinFaceId')}</Text>
              <Text style={[styles.chevron, { color: colors.mist }]}>›</Text>
            </PressableScale>

            <View style={[styles.settingRow, { borderBottomColor: colors.sand2 }]}>
              <Text style={[styles.settingText, { color: colors.ink }]}>{t('profile.debtNotifs')}</Text>
              <Toggle value={notifs} onChange={toggleNotifs} />
            </View>

            <PressableScale haptic={false} style={[styles.settingRow, { borderBottomColor: colors.sand2 }]} onPress={() => setLanguageSheet(true)}>
              <Text style={[styles.settingText, { color: colors.ink }]}>{t('profile.language')}</Text>
              <Text style={[styles.settingValue, { color: colors.muted }]}>{LOCALE_NAMES[currentLocale()]}</Text>
              <Text style={[styles.chevron, { color: colors.mist }]}>›</Text>
            </PressableScale>

            <PressableScale haptic={false} style={[styles.settingRow, { borderBottomColor: colors.sand2 }]} onPress={cycleTheme}>
              <Text style={[styles.settingText, { color: colors.ink }]}>{t('profile.theme')}</Text>
              <Text style={[styles.settingValue, { color: colors.muted }]}>{themeLabel}</Text>
              <Text style={[styles.chevron, { color: colors.mist }]}>›</Text>
            </PressableScale>

            <PressableScale haptic={false} style={[styles.settingRow, { borderBottomColor: colors.sand2 }]} onPress={() => setGroupsSheet(true)}>
              <Text style={[styles.settingText, { color: colors.ink }]}>{t('profile.myGroups')}</Text>
              <Text style={[styles.settingValue, { color: colors.muted }]}>{groups.length}</Text>
              <Text style={[styles.chevron, { color: colors.mist }]}>›</Text>
            </PressableScale>

            <PressableScale haptic={false} style={styles.settingRow} onPress={() => setLogoutSheet(true)}>
              <Text style={[styles.settingText, { color: colors.ember }]}>{t('profile.logout')}</Text>
            </PressableScale>
          </>
        ) : null}
      </ScrollView>

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
                value={cardDigits}
                onChangeText={(v) => setCardDigits(v.replace(/\D/g, '').slice(0, 16))}
                keyboardType="number-pad"
                style={styles.hiddenField}
                autoFocus
              />
              <Text style={[styles.cardMask, { color: colors.ink }]}>{cardMask}</Text>
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
        {groups.map((g) => (
          <PressableScale
            key={g.id}
            haptic={false}
            style={[styles.groupRow, { borderBottomColor: colors.sand2 }]}
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
        <View style={styles.pinBody}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>{pinTitle}</Text>
          <Text style={[styles.pinHint, { color: pinError ? colors.danger : colors.muted }]}>
            {pinError || t('auth.pinHint')}
          </Text>
          <View style={styles.pinDots}>
            <PinDots filled={pinModel.length} length={4} error={pinShake} />
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
        </View>
      </BottomSheet>

      {/* выход */}
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

      <LanguagePickerSheet open={languageSheet} onClose={() => setLanguageSheet(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 22 },
  headBody: { flex: 1, gap: 3 },
  name: { fontFamily: font.extrabold, fontSize: 23, letterSpacing: -0.2 },
  handle: { fontFamily: font.semibold, fontSize: 13.5 },
  sinceChip: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center', marginTop: 2 },
  sinceText: { fontFamily: font.extrabold, fontSize: 11, color: '#111110' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 22 },
  stat: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14, gap: 3 },
  statValue: { fontFamily: font.extrabold, fontSize: 20 },
  statLabel: { fontFamily: font.bold, fontSize: 11.5 },
  mono: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, marginTop: 26 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  cardBadge: { width: 42, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardBadgeText: { fontFamily: font.monoBold, fontSize: 8 },
  plusGlyph: { fontSize: 16, fontFamily: font.semibold },
  cardName: { flex: 1, fontFamily: font.bold, fontSize: 15 },
  primaryChip: { height: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  primaryText: { fontFamily: font.extrabold, fontSize: 11, color: '#111110' },
  makePrimary: { fontFamily: font.bold, fontSize: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  settingText: { flex: 1, fontFamily: font.bold, fontSize: 15 },
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
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  disabled: { opacity: 0.4 },
  smsHint: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center', marginTop: 18 },
  smsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  smsCell: { width: 36, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smsDigit: { fontFamily: font.extrabold, fontSize: 18 },
  ownerNote: { fontFamily: font.semibold, fontSize: 12, textAlign: 'center', marginTop: 14 },
  checking: { alignItems: 'center', paddingVertical: 26, gap: 4 },
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
