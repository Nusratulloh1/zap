// Ввод номера: префикс +998 отдельным блоком, в поле — только 9 цифр.
// Ровно как в вебе, где код страны в поле ломал номер.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';

/** "901234221" -> "90 123 42 21" */
function mask(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

export function PhoneScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startLogin = useSession((s) => s.startLogin);

  const valid = useMemo(() => digits.length === 9, [digits]);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startLogin('+998' + digits);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.root} background={colors.paper}>
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
          placeholder="90 123 45 67"
          placeholderTextColor={colors.mist}
          style={[styles.input, { color: colors.ink }]}
          autoFocus
        />
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.spacer} />
      <Button title={t('auth.getCode')} disabled={!valid} loading={busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontFamily: font.extrabold, fontSize: 34, letterSpacing: -1 },
  hint: { fontFamily: font.semibold, fontSize: 15, marginTop: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 2, marginTop: 34, paddingBottom: 10 },
  prefix: { fontFamily: font.extrabold, fontSize: 28 },
  input: { flex: 1, fontFamily: font.extrabold, fontSize: 28, padding: 0 },
  error: { fontFamily: font.semibold, fontSize: 14, marginTop: 14 },
  spacer: { flex: 1 },
});
