// Экран 3a — лаймовый платёжный пад: скан-иконка и аватар сверху, сумма
// JetBrains Mono 64 с автоужатием, клавиатура, «Оплатить» / «Сплит».
// Порт web/src/pages/AmountPage.vue.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { PayPad } from '@/components/PayPad';
import { PinSheet } from '@/components/PinSheet';
import { Avatar } from '@/components/Avatar';
import { useHomeData } from '@/store/bootstrap';
import { useDraft } from '@/store/draft';
import { money } from '@/lib/format';
import { ScanIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function AmountScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const home = useHomeData();
  const startManual = useDraft((s) => s.startManual);

  const [raw, setRaw] = useState('');
  const [paySheet, setPaySheet] = useState(false);

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

  // сумма всегда 64px; не влезает — нативное ужатие adjustsFontSizeToFit
  const text = raw ? money(amount) : '0';

  const cta = useSharedValue(ready ? 1 : 0.92);
  cta.value = withSpring(ready ? 1 : 0.92, { damping: 10, stiffness: 260 });
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: cta.value }] }));

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
          <Avatar
            name={home.db?.user?.name}
            letter={home.db?.user?.initials}
            contactId="me"
            color={fixed.ink}
            size={44}
            ring={fixed.lime}
          />
        </PressableScale>
      </View>

      <View style={styles.amountWrap}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.amount, { color: fixed.ink, opacity: raw ? 1 : 0.32 }]}
        >
          {text}
        </Text>
        <Text style={[styles.currency, { color: fixed.ink }]}>{t('common.currency')}</Text>
      </View>

      <PayPad onKey={onKey} onBackspace={() => setRaw((v) => v.slice(0, -1))} color={fixed.ink} />

      <Animated.View style={[styles.actions, ctaStyle, { paddingBottom: insets.bottom + 86 }]}>
        <PressableScale
          disabled={!ready}
          style={[styles.btn, styles.btnPay, !ready && styles.disabled]}
          onPress={() => setPaySheet(true)}
        >
          <Text style={[styles.btnPayText, { color: fixed.ink }]}>{t('amount.pay')}</Text>
        </PressableScale>
        <PressableScale
          disabled={!ready}
          style={[styles.btn, styles.btnSplit, { backgroundColor: fixed.ink }, !ready && styles.disabled]}
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
          setRaw('');
          nav.navigate('Home');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  amountWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  amount: { fontFamily: font.mono, fontSize: 64, fontWeight: '700', letterSpacing: -1.3 },
  currency: { fontFamily: font.monoBold, fontSize: 13, opacity: 0.5, marginTop: 22 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnPay: { flex: 1, backgroundColor: '#FFFFFF' },
  btnSplit: { flex: 1.4 },
  btnPayText: { fontFamily: font.bold, fontSize: 16 },
  btnSplitText: { fontFamily: font.extrabold, fontSize: 16, color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
});
