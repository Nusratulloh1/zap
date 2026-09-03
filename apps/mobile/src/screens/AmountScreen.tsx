// Экран 3a — лаймовый платёжный пад: скан-иконка и аватар сверху, сумма
// JetBrains Mono 64 с автоужатием, клавиатура, «Оплатить» / «Сплит».
// Порт web/src/pages/AmountPage.vue.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { cue } from '@/lib/feedback';
import { ZapOverlay } from '@/components/ZapOverlay';
import { PressableScale } from '@/components/PressableScale';
import { PayPad } from '@/components/PayPad';
import { AnimatedAmount } from '@/components/AnimatedAmount';
import { PinSheet } from '@/components/PinSheet';
import { Avatar } from '@/components/Avatar';
import { useHomeData } from '@/store/bootstrap';
import { useDraft } from '@/store/draft';
import { storage } from '@/theme/ThemeProvider';
import { money } from '@/lib/format';
import { payAlone } from '@/api/actions';
import { toast } from '@/components/ToastHost';
import { ScanIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

const DRAFT_KEY = 'zap:amount-draft';

/** Подписи ожидания оплаты. */
const PAY_STEPS = ['loading.paying1', 'loading.paying2'] as const;
const PAY_STICKERS = ['heartZap', 'paidDone'] as const;

export function AmountScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fixed } = useTheme();
  const nav = useNavigation<any>();
  const home = useHomeData();
  const startManual = useDraft((s) => s.startManual);

  const [raw, setRawState] = useState(() => storage.getString(DRAFT_KEY) ?? '');
  const setRaw = (v: string | ((p: string) => string)) => {
    setRawState((prev: string) => {
      const next = typeof v === 'function' ? v(prev) : v;
      storage.set(DRAFT_KEY, next);
      return next;
    });
  };
  const [paySheet, setPaySheet] = useState(false);
  const [paying, setPaying] = useState(false);

  const amount = Number(raw || '0');
  const ready = amount > 0;

  const onKey = (k: string) => {
    if (k === '000') {
      if (!raw) return;
      setRaw((v) => (v + '000').slice(0, 9));
      return;
    }
    setRaw((v) => (v.length >= 9 ? v : (v + k).replace(/^0+(?=\d)/, '')));
  };

  // кнопки: плавный фейд доступности (transition-opacity в вебе), без scale
  const cta = useSharedValue(ready ? 1 : 0.4);
  useEffect(() => {
    cta.value = withTiming(ready ? 1 : 0.4, { duration: 200 });
  }, [ready, cta]);
  const ctaStyle = useAnimatedStyle(() => ({ opacity: cta.value }));

  return (
    <Screen background={fixed.lime} darkBar={false} style={styles.root}>
      <View style={styles.header}>
        <PressableScale
          small
          accessibilityLabel={t('amount.scannerAria')}
          style={styles.iconBtn}
          onPress={() => nav.navigate('Scan')}
        >
          <ScanIcon size={26} color={fixed.ink} />
        </PressableScale>
        <PressableScale small onPress={() => nav.navigate('Profile')}>
          <Avatar name={home.db?.user?.name} letter={home.db?.user?.initials} color="#111110" size={44} ring={fixed.lime} ringWidth={2} />
        </PressableScale>
      </View>

      <View style={styles.amountWrap}>
        <AnimatedAmount digits={raw} color={fixed.ink} />
      </View>

      <PayPad onKey={onKey} onBackspace={() => setRaw((v) => v.slice(0, -1))} color={fixed.ink} />

      {/*
        86 хватало, пока Screen резервировал нижнюю безопасную зону. Теперь
        экран идёт до края, и кнопки надо поднимать над плавающим таб-баром
        самим: его высота 62 + отступ 14 + зона индикатора.
      */}
      <Animated.View style={[styles.actions, ctaStyle, { paddingBottom: insets.bottom + 88 }]}>
        <PressableScale
          disabled={!ready}
          style={[styles.btn, styles.btnPay]}
          onPress={() => setPaySheet(true)}
        >
          <Text style={[styles.btnPayText, { color: fixed.ink }]}>{t('amount.pay')}</Text>
        </PressableScale>
        <PressableScale
          disabled={!ready}
          style={[styles.btn, styles.btnSplit, { backgroundColor: fixed.ink }]}
          onPress={() => {
            startManual(amount);
            nav.navigate('Members');
          }}
        >
          <Text style={styles.btnSplitText}>{t('amount.split')}</Text>
        </PressableScale>
      </Animated.View>

      <PinSheet
        open={paySheet}
        hint={t('amount.pinHint', { amount: money(amount) })}
        onClose={() => setPaySheet(false)}
        onConfirm={() => {
          setPaySheet(false);
          void (async () => {
            // оплата идёт по сети — держим ZAP на экране, а не пустоту
            setPaying(true);
            try {
              const res = await payAlone(amount);
              cue('paid');
              setRaw('');
              // чек вместо тоста: номер транзакции нужен для поддержки
              nav.navigate('PaidReceipt', {
                splitId: '',
                amount,
                txId: res?.txId ?? null,
                at: Date.now(),
              });
            } catch (e) {
              toast(e instanceof Error && e.message ? e.message : t('errors.payCancelled'));
            } finally {
              setPaying(false);
            }
          })();
        }}
      />
      <ZapOverlay open={paying} steps={PAY_STEPS} stickers={PAY_STICKERS} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  amountWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  amount: { fontFamily: font.mono, fontSize: 64, fontWeight: '700', letterSpacing: -1.3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnPay: { flex: 1, backgroundColor: '#FFFFFF' },
  btnSplit: { flex: 1.4 },
  btnPayText: { fontFamily: font.bold, fontSize: 16 },
  btnSplitText: { fontFamily: font.extrabold, fontSize: 16, color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
});
