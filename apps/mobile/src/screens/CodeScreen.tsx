// Код из SMS. Поле скрытое, видимые — точки: так же, как в вебе.
// autoComplete="sms-otp" (Android) и textContentType="oneTimeCode" (iOS)
// включают нативный автоввод кода.
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput } from 'react-native';
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

  const [kbOpen, setKbOpen] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  // Поле ввода скрытое (1×1, прозрачное). Если клавиатуру закрыть свайпом или
  // кнопкой «назад», нажимать становится не на что и экран умирает —
  // ровно это и поймалось на телефоне. Поэтому любой тап по экрану возвращает
  // фокус, а подсказка показывает, что экран жив.
  useEffect(() => {
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    const show = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    return () => {
      hide.remove();
      show.remove();
    };
  }, []);

  const focusInput = () => input.current?.focus();

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
      {/* тап в любом месте возвращает клавиатуру */}
      <Pressable style={styles.tapCatcher} onPress={focusInput} accessibilityRole="button" />
      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.codeTitle')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {t('auth.codeHint')} {phone}
      </Text>

      <Pressable style={styles.dots} onPress={focusInput}>
        <PinDots filled={code.length} length={LEN} error={Boolean(error)} />
      </Pressable>

      {!kbOpen ? (
        <Pressable onPress={focusInput}>
          <Text style={[styles.reopen, { color: colors.muted }]}>{t('auth.tapToType')}</Text>
        </Pressable>
      ) : null}

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
  tapCatcher: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  reopen: { fontFamily: font.semibold, fontSize: 14, marginTop: 22 },
  error: { fontFamily: font.semibold, fontSize: 14, marginTop: 18 },
  // поле нужно только для клавиатуры и автоввода — визуально его нет
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
