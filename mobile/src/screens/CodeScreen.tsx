// Код из SMS. Поле скрытое, видимые — точки: так же, как в вебе.
// autoComplete="sms-otp" (Android) и textContentType="oneTimeCode" (iOS)
// включают нативный автоввод кода.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { PinDots } from '@/components/PinDots';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';

const LEN = 6;

export function CodeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const phone = useSession((s) => s.phone);
  const verifyCode = useSession((s) => s.verifyCode);

  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (code.length !== LEN) return;
    let cancelled = false;
    void (async () => {
      try {
        await verifyCode(code);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t('errors.generic'));
        setCode('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, verifyCode, t]);

  return (
    <Screen style={styles.root} background={colors.paper}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.codeTitle')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {t('auth.codeHint')} {phone}
      </Text>

      <View style={styles.dots}>
        <PinDots filled={code.length} length={LEN} error={Boolean(error)} />
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          setError(null);
          setCode(v.replace(/\D/g, '').slice(0, LEN));
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LEN}
        style={styles.hiddenInput}
        caretHidden
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontFamily: font.extrabold, fontSize: 34, letterSpacing: -1 },
  hint: { fontFamily: font.semibold, fontSize: 15, marginTop: 8 },
  dots: { marginTop: 40 },
  error: { fontFamily: font.semibold, fontSize: 14, marginTop: 18 },
  // поле нужно только для клавиатуры и автоввода — визуально его нет
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
