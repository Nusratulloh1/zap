// Код из SMS — порт AuthCodePage.vue: назад к номеру, 6 больших кругов,
// «Не пришло? Отправить ещё раз · 0:60», раздел про будущий PIN.
// Поле скрытое; тап по экрану возвращает клавиатуру (ловилось на устройстве).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PinDots } from '@/components/PinDots';
import { toast } from '@/components/ToastHost';
import { trigger } from 'react-native-haptic-feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { phone as formatPhone } from '@/lib/format';
import { refocus, useKeyboardLock } from '@/lib/keyboard';

const LEN = 6;

export function CodeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const sessionPhone = useSession((s) => s.phone);
  const verifyCode = useSession((s) => s.verifyCode);
  const startLogin = useSession((s) => s.startLogin);

  // таймер повторной отправки = серверный лимит 1 SMS/мин
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  // клавиатура всегда открыта: закрыл — вернём (выход только «назад»)
  useKeyboardLock(input, true);

  useEffect(() => {
    if (code.length !== LEN) return;
    let cancelled = false;
    void (async () => {
      try {
        await verifyCode(code);
        trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      } catch (e) {
        trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
        if (cancelled) return;
        setError(e instanceof Error && e.message ? e.message : t('auth.wrongCode'));
        setTimeout(() => {
          if (cancelled) return;
          setError(null);
          setCode('');
        }, 3000);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, verifyCode, t]);

  const resend = async () => {
    if (seconds > 0 || !sessionPhone) return;
    try {
      await startLogin(sessionPhone);
      setSeconds(60);
      toast(t('auth.codeResent'));
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('auth.sendFailed'));
    }
  };

  const focusInput = () => refocus(input);
  const timer = `0:${String(Math.max(0, seconds)).padStart(2, '0')}`;

  return (
    <Screen style={styles.root} background={colors.paper}>
      {/* тап в любом месте возвращает клавиатуру */}
      <Pressable style={styles.tapCatcher} onPress={focusInput} accessibilityRole="button" />

      <ScreenHeader onBack={() => useSession.setState({ stage: 'phone' })} />

      <Text style={[styles.title, { color: colors.ink }]}>{t('auth.codeTitle')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        {t('auth.codeSentTo', { phone: formatPhone((sessionPhone ?? '').replace(/\D/g, '').slice(-9)) })}
      </Text>

      {/* 6 точек с лаймовым баром — как PinDots в вебе */}
      <Pressable style={styles.dots} onPress={focusInput}>
        <PinDots length={LEN} filled={code.length} error={Boolean(error)} size={26} gap={14} barWidth={264} />
      </Pressable>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {/* «Не пришло? Отправить ещё раз · 0:60» */}
      <View style={styles.resendRow}>
        <Text style={[styles.resendMuted, { color: colors.muted }]}>{t('auth.notArrived')} </Text>
        <Pressable onPress={() => void resend()}>
          <Text style={[styles.resendBold, { color: colors.ink }, seconds <= 0 && styles.resendUnderline]}>
            {seconds > 0 ? t('auth.resendIn', { time: timer }) : t('auth.resend')}
          </Text>
        </Pressable>
      </View>

      {/* раздел про будущий PIN */}
      <View style={[styles.pinNote, { borderTopColor: colors.sand2 }]}>
        <Text style={[styles.pinTitle, { color: colors.ink }]}>{t('auth.pinTitle')}</Text>
        <Text style={[styles.pinHint, { color: colors.muted }]}>{t('auth.pinSectionHint')}</Text>
      </View>

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
  root: { paddingHorizontal: 24 },
  tapCatcher: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 24 },
  hint: { fontFamily: font.semibold, fontSize: 14, marginTop: 6 },
  dots: { marginTop: 26, alignSelf: 'flex-start' },
  error: { fontFamily: font.bold, fontSize: 13, marginTop: 12 },
  resendRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  resendMuted: { fontFamily: font.semibold, fontSize: 13 },
  resendBold: { fontFamily: font.bold, fontSize: 13 },
  resendUnderline: { textDecorationLine: 'underline' },
  pinNote: { borderTopWidth: 1, marginTop: 26, paddingTop: 20, gap: 4 },
  pinTitle: { fontFamily: font.extrabold, fontSize: 15.5 },
  pinHint: { fontFamily: font.semibold, fontSize: 13 },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
