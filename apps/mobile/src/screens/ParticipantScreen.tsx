// Участник по ссылке /s/:code — порт ParticipantPage.vue: публичный вид
// сплита, чипы суммы (доля/половина/за двоих/своя), оплата через OTP-lite,
// успех с прогрессом. Открывается диплинком или сканом QR сплита.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { AnimatedAmount } from '@/components/AnimatedAmount';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { toast } from '@/components/ToastHost';
import { fetchPublicSplit, markOpened, payPublic, type PublicView } from '@/api/actions';
import { joinSplitRoom, onRealtime } from '@/lib/realtime';
import { useSession } from '@/store/session';
import { money, peopleCount } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

const r1000 = (n: number) => Math.round(n / 1000) * 1000;

/** Плитка суммы 62px: значение и (опционально) подпись; выбранная — в лаймовой рамке. */
function Tile({ value, label, active, onPress }: { value: number; label?: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      style={[
        styles.tile,
        active ? { borderWidth: 2, borderColor: colors.lime } : { backgroundColor: colors.sand },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.tileValue, { color: colors.ink }]}>{money(value)}</Text>
      {label ? <Text style={[styles.tileLabel, { color: colors.muted }]}>{label}</Text> : null}
    </PressableScale>
  );
}

export function ParticipantScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const code = route.params?.code as string;
  const phone = useSession((s) => s.phone) ?? '';

  const [view, setView] = useState<PublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [amount, setAmount] = useState(0);

  const load = useCallback(async () => {
    try {
      const v = await fetchPublicSplit(code, phone || undefined);
      setView(v);
      if (v.yourShare && !paid) setAmount((a) => (a > 0 ? a : v.yourShare ?? 0));
      if (v.yourStatus === 'waiting' && phone) void markOpened(code, phone);
    } catch {
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [code, phone, paid]);

  useEffect(() => {
    void load();
    joinSplitRoom(code);
    return onRealtime(() => void load());
  }, [code, load]);

  const isClosed = view?.status === 'closed';
  const myShare = view?.yourShare ?? 0;
  const remaining = Math.max(0, (view?.totalAmount ?? 0) - (view?.paidTotal ?? 0));
  const alreadyPaid = view?.yourStatus === 'paid' || view?.yourStatus === 'debt';

  const half = r1000(myShare / 2);
  const double = Math.min(myShare * 2, remaining || myShare * 2);
  const quickAmounts = [100000, 250000].filter((q) => q < myShare);

  // своя сумма
  const [customSheet, setCustomSheet] = useState(false);
  const [customRaw, setCustomRaw] = useState('');

  // оплата: сервер шлёт OTP → вводим код → повторный вызов с кодом
  const [otpSheet, setOtpSheet] = useState(false);
  const [otp, setOtp] = useState('');
  const paying = useRef(false);
  const otpInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  const startPay = async () => {
    if (paying.current || amount <= 0) return;
    paying.current = true;
    try {
      const res = await payPublic(code, phone, amount);
      if (res.otpRequired) {
        setOtp('');
        setOtpSheet(true);
        setTimeout(() => otpInput.current?.focus(), 380);
      } else {
        setPaid(true);
        await load();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : t('participant.payFailed'));
    } finally {
      paying.current = false;
    }
  };

  useEffect(() => {
    if (otp.length !== 6 || paying.current) return;
    paying.current = true;
    void (async () => {
      try {
        await payPublic(code, phone, amount, otp);
        setOtpSheet(false);
        setPaid(true);
        await load();
      } catch (e) {
        setOtp('');
        toast(e instanceof Error ? e.message : t('participant.payFailed'));
      } finally {
        paying.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (loading) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader onBack={() => nav.popTo('Tabs')} />
      </Screen>
    );
  }

  if (!view) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader onBack={() => nav.popTo('Tabs')} />
        <View style={styles.center}>
          <Text style={[styles.notFound, { color: colors.muted }]}>{t('participant.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  // успех / уже оплачено — как в вебе: заголовок и сумма по центру,
  // shell-карточка с прогресс-баром и кружками участников, лаймовый CTA
  if (paid || alreadyPaid) {
    const progressPct = view.totalAmount ? Math.min(100, Math.round(((view.paidTotal ?? 0) / view.totalAmount) * 100)) : 0;
    return (
      <Screen style={styles.root}>
        <Image source={require('../../assets/brand/zap-wordmark-large.png')} style={styles.wordmark} resizeMode="contain" />
        <View style={styles.doneWrap}>
          <Text style={[styles.doneTitle, { color: colors.ink }]}>
            {paid ? t('participant.paidNow') : t('participant.alreadyPaid')}
          </Text>
          {myShare > 0 ? (
            <Text style={[styles.doneAmount, { color: colors.ink }]}>{money(myShare)}</Text>
          ) : null}
          <Text style={[styles.doneSub, { color: colors.muted }]}>
            {isClosed && (view.yourCashback ?? 0) > 0
              ? t('participant.cashbackCredited', { amount: money(view.yourCashback ?? 0) })
              : t('participant.paidText')}
          </Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.shell }]}>
          <View style={styles.statusHead}>
            <Text style={[styles.statusTitle, { color: colors.ink }]}>
              {isClosed ? t('participant.splitClosed') : t('participant.collecting')}
            </Text>
            <Text style={[styles.statusRight, { color: colors.muted }]}>
              {t('participant.paidOfCount', { paid: view.paidCount, total: view.memberCount })}
            </Text>
          </View>
          <View style={[styles.statusTrack, { backgroundColor: colors.sand }]}>
            <View style={[styles.statusBar, { backgroundColor: colors.lime, width: `${progressPct}%` }]} />
          </View>
          <View style={styles.statusDots}>
            {view.members.map((m, i) => {
              const done = m.status === 'paid' || m.status === 'debt';
              return (
                <View key={m.id + i} style={[styles.statusDot, { backgroundColor: done ? colors.ink : colors.sand }]}>
                  <Text style={[styles.statusDotCheck, { color: done ? fixed.lime : colors.faint2 }]}>
                    {done ? '✓' : (m.initial || m.name[0] || '?').toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.doneSpacer} />
        <PressableScale style={[styles.cta, styles.doneCta, { backgroundColor: fixed.lime }]} onPress={() => nav.popTo('Tabs')}>
          <Text style={styles.ctaDark}>{t('participant.openApp')}</Text>
        </PressableScale>
      </Screen>
    );
  }

  return (
    <Screen style={styles.root}>
      <Image source={require('../../assets/brand/zap-wordmark-large.png')} style={styles.wordmark} resizeMode="contain" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 12, flexGrow: 1 }}>
        {/* организатор просит долю */}
        <View style={styles.asksRow}>
          <View style={[styles.creatorDot, { backgroundColor: colors.ink }]}>
            <Text style={[styles.creatorLetter, { color: fixed.lime }]}>
              {(view.creatorName || t('participant.organizer'))[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.asks, { color: colors.muted }]} numberOfLines={2}>
            {t('participant.asks', { name: view.creatorName || t('participant.organizer') })}
          </Text>
        </View>

        <Text style={[styles.splitTitle, { color: colors.ink }]}>{view.title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {view.bill ? t('participant.orderNo', { no: view.bill.orderNo }) : ''}
          {peopleCount(view.memberCount)}
        </Text>

        <View style={styles.amountRow}>
          <AnimatedAmount digits={amount ? String(amount) : ''} color={colors.ink} fontSize={46} />
          <Text style={[styles.selLabel, { color: colors.faint2 }]}>
            {amount === myShare ? t('participant.yourShare') : t('participant.toPayLabel')}
          </Text>
        </View>

        <Text style={[styles.payNowLabel, { color: colors.faint2 }]}>{t('participant.payNowLabel')}</Text>
        <View style={styles.tiles}>
          <Tile
            value={myShare}
            label={t('participant.chipMine')}
            active={amount === myShare}
            onPress={() => setAmount(myShare)}
          />
          <Tile value={half} label={t('participant.chipHalf')} active={amount === half} onPress={() => setAmount(half)} />
          {double > myShare ? (
            <Tile value={double} label={t('participant.chipTwo')} active={amount === double} onPress={() => setAmount(double)} />
          ) : null}
          {quickAmounts.map((q) => (
            <Tile key={q} value={q} active={amount === q} onPress={() => setAmount(q)} />
          ))}
          <PressableScale style={[styles.tile, { backgroundColor: colors.sand }]} onPress={() => setCustomSheet(true)}>
            <Text style={[styles.tileDots, { color: colors.faint2 }]}>···</Text>
          </PressableScale>
        </View>

        <View style={styles.hintRow}>
          <View style={[styles.hintDot, { backgroundColor: fixed.lime, borderColor: fixed.ink }]} />
          <Text style={[styles.hint, { color: colors.muted }]}>{t('participant.hint')}</Text>
        </View>

        <View style={styles.spacer} />

        <PressableScale
          disabled={amount <= 0}
          style={[styles.cta, { backgroundColor: fixed.lime }, amount <= 0 && styles.disabled]}
          onPress={() => void startPay()}
        >
          <Text style={styles.ctaDark}>{t('participant.pay', { amount: money(amount) })}</Text>
        </PressableScale>
        <PressableScale
          style={[styles.cta, styles.laterBtn, { backgroundColor: colors.sand }]}
          onPress={() => toast(t('participant.laterToast'))}
        >
          <Text style={[styles.laterText, { color: colors.ink }]}>{t('participant.later')}</Text>
        </PressableScale>
      </ScrollView>

      {/* своя сумма */}
      <BottomSheet open={customSheet} onClose={() => setCustomSheet(false)}>
        <TextInput
          value={customRaw}
          onChangeText={(v) => setCustomRaw(v.replace(/\D/g, '').slice(0, 9))}
          keyboardType="number-pad"
          autoFocus
          style={[styles.customInput, { color: colors.ink }]}
          selectionColor={fixed.lime}
        />
        <Text style={[styles.customCurrency, { color: colors.faint2 }]}>UZS</Text>
        <PressableScale
          style={[styles.sheetCta, { backgroundColor: colors.ink }]}
          onPress={() => {
            const v = Number(customRaw || '0');
            if (v > 0) setAmount(remaining > 0 ? Math.min(v, remaining) : v);
            setCustomSheet(false);
            setCustomRaw('');
          }}
        >
          <Text style={[styles.sheetCtaText, { color: colors.paper }]}>{t('common.done')}</Text>
        </PressableScale>
      </BottomSheet>

      {/* OTP подтверждение оплаты */}
      <BottomSheet open={otpSheet} onClose={() => setOtpSheet(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('auth.sheetCodeTitle')}</Text>
        <Text style={[styles.otpHint, { color: colors.muted }]}>{t('auth.sheetCodeHint')}</Text>
        <TextInput
          ref={otpInput}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          style={styles.hiddenInput}
        />
        <View style={styles.otpRow}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[styles.otpCell, { backgroundColor: colors.sand }]}>
              <Text style={[styles.otpDigit, { color: colors.ink }]}>{otp[i] ?? ''}</Text>
            </View>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  asksRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26 },
  creatorDot: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  creatorLetter: { fontFamily: font.extrabold, fontSize: 14 },
  asks: { flex: 1, fontFamily: font.semibold, fontSize: 13.5 },
  splitTitle: { fontFamily: font.extrabold, fontSize: 26, letterSpacing: -0.3, marginTop: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 22 },
  selLabel: { fontFamily: font.monoBold, fontSize: 11 },
  payNowLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, marginTop: 30 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tile: {
    height: 62,
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileValue: { fontFamily: font.extrabold, fontSize: 15 },
  tileLabel: { fontFamily: font.bold, fontSize: 10.5 },
  tileDots: { fontFamily: font.bold, fontSize: 19 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  hintDot: { width: 9, height: 9, borderRadius: 999, borderWidth: 2 },
  hint: { flex: 1, fontFamily: font.semibold, fontSize: 12 },
  customCurrency: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, textAlign: 'center', marginTop: 6 },
  sheetCtaText: { fontFamily: font.bold, fontSize: 15 },
  root: { paddingHorizontal: SCREEN_PAD_X },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  notFound: { fontFamily: font.bold, fontSize: 15 },
  meta: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6 },
  spacer: { flexGrow: 1, minHeight: 24 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#121212' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  laterBtn: { marginTop: 10 },
  laterText: { fontFamily: font.bold, fontSize: 16 },
  disabled: { opacity: 0.4 },
  wordmark: { height: 48, width: 72, marginTop: 12 },
  doneWrap: { alignItems: 'center', marginTop: 32 },
  doneSpacer: { flex: 1 },
  doneTitle: { fontFamily: font.extrabold, fontSize: 24, textAlign: 'center' },
  doneAmount: { fontFamily: font.extrabold, fontSize: 30, letterSpacing: -0.6, marginTop: 4 },
  doneSub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6, textAlign: 'center' },
  statusCard: { alignSelf: 'stretch', borderRadius: 28, padding: 18, marginTop: 32 },
  statusHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  statusTitle: { fontFamily: font.extrabold, fontSize: 15 },
  statusRight: { fontFamily: font.semibold, fontSize: 13 },
  statusTrack: { height: 10, borderRadius: 999, marginTop: 12, overflow: 'hidden' },
  statusBar: { height: '100%', borderRadius: 999 },
  statusDots: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusDot: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  statusDotCheck: { fontFamily: font.extrabold, fontSize: 12 },
  doneCta: { alignSelf: 'stretch', marginTop: 28 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center' },
  customInput: { fontFamily: font.extrabold, fontSize: 36, textAlign: 'center', marginVertical: 18, padding: 0 },
  sheetCta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  otpHint: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', marginTop: 4 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  otpCell: { width: 36, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  otpDigit: { fontFamily: font.extrabold, fontSize: 18 },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
