// Участник по ссылке /s/:code — порт ParticipantPage.vue: публичный вид
// сплита, чипы суммы (доля/половина/за двоих/своя), оплата через OTP-lite,
// успех с прогрессом. Открывается диплинком или сканом QR сплита.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { BottomSheet } from '@/components/BottomSheet';
import { toast } from '@/components/ToastHost';
import { fetchPublicSplit, markOpened, payPublic, type PublicView } from '@/api/actions';
import { joinSplitRoom, onRealtime } from '@/lib/realtime';
import { useSession } from '@/store/session';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

const r1000 = (n: number) => Math.round(n / 1000) * 1000;

export function ParticipantScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
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
  const progress = view?.totalAmount ? Math.min(100, Math.round(((view.paidTotal ?? 0) / view.totalAmount) * 100)) : 0;
  const alreadyPaid = view?.yourStatus === 'paid' || view?.yourStatus === 'debt';

  const chips = [
    { key: 'mine', label: t('participant.chipMine'), value: myShare },
    { key: 'half', label: t('participant.chipHalf'), value: r1000(myShare / 2) },
    { key: 'two', label: t('participant.chipTwo'), value: Math.min(myShare * 2, remaining || myShare * 2) },
  ].filter((c) => c.value > 0);

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
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />
      </Screen>
    );
  }

  if (!view) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />
        <View style={styles.center}>
          <Text style={[styles.notFound, { color: colors.muted }]}>{t('participant.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  // успех / уже оплачено
  if (paid || alreadyPaid || isClosed) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />
        <View style={styles.center}>
          <View style={[styles.bigCheck, { backgroundColor: fixed.lime }]}>
            <Text style={styles.bigCheckGlyph}>✓</Text>
          </View>
          <Text style={[styles.doneTitle, { color: colors.ink }]}>
            {paid ? t('participant.paidNow') : isClosed ? t('participant.splitClosed') : t('participant.alreadyPaid')}
          </Text>
          <Text style={[styles.doneSub, { color: colors.muted }]}>
            {isClosed && (view.yourCashback ?? 0) > 0
              ? t('participant.cashbackCredited', { amount: money(view.yourCashback ?? 0) })
              : t('participant.paidText')}
          </Text>

          <View style={styles.progressBlock}>
            <Text style={[styles.progressLabel, { color: colors.faint }]}>
              {t('participant.paidOfCount', { paid: view.paidCount, total: view.memberCount })}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.pebble }]}>
              <View style={[styles.fill, { backgroundColor: fixed.lime, width: `${progress}%` }]} />
            </View>
          </View>

          <PressableScale style={[styles.cta, styles.doneCta, { backgroundColor: colors.ink }]} onPress={() => nav.navigate('Tabs')}>
            <Text style={[styles.ctaText, { color: colors.cream }]}>{t('participant.openApp')}</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.root}>
      <ScreenHeader onBack={() => nav.navigate('Tabs')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16, flexGrow: 1 }}>
        <Text style={[styles.asks, { color: colors.ink }]}>
          {t('participant.asks', { name: view.creatorName || t('participant.organizer') })}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {view.merchant?.name ?? view.title}
          {view.bill ? t('participant.orderNo', { no: view.bill.orderNo }) : ''}
        </Text>

        <View style={styles.amountBlock}>
          <Text style={[styles.selLabel, { color: colors.faint2 }]}>
            {amount === myShare ? t('participant.yourShare') : t('participant.toPayLabel')}
          </Text>
          <Text style={[styles.amount, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(amount)}
          </Text>
        </View>

        <View style={styles.chips}>
          {chips.map((c, i) => (
            <Animated.View key={c.key} entering={FadeInDown.delay(i * 45)}>
              <PressableScale
                style={[styles.chip, { backgroundColor: amount === c.value ? fixed.lime : colors.sand }]}
                onPress={() => setAmount(c.value)}
              >
                <Text style={[styles.chipLabel, { color: amount === c.value ? '#111110' : colors.slate }]}>{c.label}</Text>
                <Text style={[styles.chipValue, { color: amount === c.value ? '#111110' : colors.muted }]}>{money(c.value)}</Text>
              </PressableScale>
            </Animated.View>
          ))}
          <PressableScale style={[styles.chip, { backgroundColor: colors.sand }]} onPress={() => setCustomSheet(true)}>
            <Text style={[styles.chipLabel, { color: colors.slate }]}>{t('participant.custom')}</Text>
          </PressableScale>
        </View>

        <Text style={[styles.hint, { color: colors.muted }]}>{t('participant.hint')}</Text>

        <View style={styles.progressBlock}>
          <Text style={[styles.progressLabel, { color: colors.faint }]}>
            {t('participant.paidOfCount', { paid: view.paidCount, total: view.memberCount })} · {t('participant.collecting')}
          </Text>
          <View style={[styles.track, { backgroundColor: colors.pebble }]}>
            <View style={[styles.fill, { backgroundColor: fixed.lime, width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.spacer} />

        <PressableScale
          disabled={amount <= 0}
          style={[styles.cta, { backgroundColor: fixed.lime }, amount <= 0 && styles.disabled]}
          onPress={() => void startPay()}
        >
          <Text style={styles.ctaDark}>{t('participant.pay', { amount: money(amount) })}</Text>
        </PressableScale>
        <PressableScale style={styles.laterBtn} onPress={() => nav.navigate('Tabs')}>
          <Text style={[styles.laterText, { color: colors.muted }]}>{t('participant.later')}</Text>
        </PressableScale>
      </ScrollView>

      {/* своя сумма */}
      <BottomSheet open={customSheet} onClose={() => setCustomSheet(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('participant.toPayLabel')}</Text>
        <TextInput
          value={customRaw}
          onChangeText={(v) => setCustomRaw(v.replace(/\D/g, '').slice(0, 9))}
          keyboardType="number-pad"
          autoFocus
          style={[styles.customInput, { color: colors.ink }]}
          selectionColor={fixed.lime}
        />
        <PressableScale
          style={[styles.sheetCta, { backgroundColor: fixed.lime }]}
          onPress={() => {
            const v = Number(customRaw || '0');
            if (v > 0) setAmount(remaining > 0 ? Math.min(v, remaining) : v);
            setCustomSheet(false);
            setCustomRaw('');
          }}
        >
          <Text style={styles.ctaDark}>{t('common.done')}</Text>
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
  root: { paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  notFound: { fontFamily: font.bold, fontSize: 15 },
  asks: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.4, marginTop: 24, lineHeight: 30 },
  meta: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6 },
  amountBlock: { alignItems: 'center', marginTop: 30, gap: 6 },
  selLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  amount: { fontFamily: font.extrabold, fontSize: 52, letterSpacing: -1.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24, justifyContent: 'center' },
  chip: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1 },
  chipLabel: { fontFamily: font.bold, fontSize: 12.5 },
  chipValue: { fontFamily: font.monoBold, fontSize: 11.5 },
  hint: { fontFamily: font.semibold, fontSize: 12.5, textAlign: 'center', marginTop: 18 },
  progressBlock: { marginTop: 22, gap: 8, alignSelf: 'stretch' },
  progressLabel: { fontFamily: font.semibold, fontSize: 12.5, textAlign: 'center' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  spacer: { flexGrow: 1, minHeight: 24 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontFamily: font.bold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  bigCheck: { width: 84, height: 84, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  bigCheckGlyph: { fontSize: 38, fontFamily: font.extrabold, color: '#111110' },
  doneTitle: { fontFamily: font.extrabold, fontSize: 23, marginTop: 18, textAlign: 'center' },
  doneSub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6, textAlign: 'center' },
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
