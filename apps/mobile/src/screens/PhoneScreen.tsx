// Ввод номера — порт AuthPhonePage.vue: круг-назад, лаймовое подчёркивание,
// чекбокс согласия, лаймовый CTA. Префикс +998 отдельным блоком, в поле — 9 цифр.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { toast } from '@/components/ToastHost';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { keyboardLift, useKeyboardHeight } from '@/lib/keyboard';

/** "901234221" -> "90 123 42 21" */
function mask(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

export function PhoneScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  const [terms, setTerms] = useState(true);
  const [busy, setBusy] = useState(false);
  const kb = useKeyboardHeight();
  const startLogin = useSession((s) => s.startLogin);

  const valid = useMemo(() => digits.length === 9 && terms, [digits, terms]);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await startLogin('+998' + digits);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('auth.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.root} background={colors.paper}>
      <ScreenHeader onBack={() => useSession.setState({ stage: 'onboarding' })} />

      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.phoneTitle')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('auth.phoneHint')}</Text>

      <View style={[styles.field, { borderBottomColor: colors.lime }]}>
        <Text style={[styles.prefix, { color: colors.muted }]}>+998</Text>
        <TextInput
          value={mask(digits)}
          onChangeText={(v) => setDigits(v.replace(/\D/g, '').slice(0, 9))}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={12}
          placeholder="90 123 42 21"
          placeholderTextColor={colors.faint}
          cursorColor={colors.lime}
          selectionColor={colors.lime}
          style={[styles.input, { color: colors.ink }]}
          autoFocus
          onSubmitEditing={() => void submit()}
        />
      </View>

      {/* согласие с условиями */}
      <View style={styles.termsRow}>
        <PressableScale
          small
          accessibilityRole="checkbox"
          accessibilityState={{ checked: terms }}
          style={[styles.check, { backgroundColor: terms ? colors.lime : colors.stone }]}
          onPress={() => setTerms((v) => !v)}
        >
          {terms ? <Text style={[styles.checkMark, { color: colors.onLime }]}>✓</Text> : null}
        </PressableScale>
        <Text style={[styles.termsText, { color: colors.muted }]} onPress={() => setTerms((v) => !v)}>
          {t('auth.terms')}
        </Text>
      </View>

      <View style={styles.spacer} />
      {/* edge-to-edge: adjustResize не двигает контент — поднимаем CTA сами */}
      <View style={{ paddingBottom: kb > 0 ? keyboardLift(kb, insets.bottom) + 12 : 28 }}>
        <Button title={t('auth.getCode')} disabled={!valid} loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24 },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 24 },
  hint: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 2, marginTop: 26, paddingBottom: 12 },
  prefix: { fontFamily: font.bold, fontSize: 26 },
  input: { flex: 1, fontFamily: font.extrabold, fontSize: 26, letterSpacing: 0.26, padding: 0 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  check: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontFamily: font.extrabold, fontSize: 12 },
  termsText: { flex: 1, fontFamily: font.semibold, fontSize: 12 },
  spacer: { flex: 1 },
});
