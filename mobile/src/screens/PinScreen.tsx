// PIN: создание (ввод + повтор) и разблокировка по биометрии на повторных
// запусках. Клавиатура своя — как в вебе, где системная ломала вёрстку.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeBiometrics from 'react-native-biometrics';
import { trigger } from 'react-native-haptic-feedback';
import { Screen } from '@/components/Screen';
import { PinDots } from '@/components/PinDots';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
const biometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export function PinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const createPin = useSession((s) => s.createPin);

  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const repeating = first.length === 4;

  // на повторных открытиях предлагаем разблокировку отпечатком/лицом
  useEffect(() => {
    void (async () => {
      const { available } = await biometrics.isSensorAvailable();
      if (!available) return;
      await biometrics
        .simplePrompt({ promptMessage: t('auth.pinHint') })
        .catch(() => undefined);
    })();
  }, [t]);

  const submit = useCallback(
    async (value: string) => {
      if (!repeating) {
        setFirst(value);
        setPin('');
        return;
      }
      if (value !== first) {
        trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
        setError(t('auth.pinMismatch'));
        setFirst('');
        setPin('');
        return;
      }
      setBusy(true);
      try {
        await createPin(value);
        trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : t('errors.generic'));
        setFirst('');
        setPin('');
      } finally {
        setBusy(false);
      }
    },
    [createPin, first, repeating, t],
  );

  function press(k: string) {
    if (busy || !k) return;
    setError(null);
    if (k === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      const next = (p + k).slice(0, 4);
      if (next.length === 4) setTimeout(() => void submit(next), 120);
      return next;
    });
  }

  return (
    <Screen style={styles.root} background={colors.paper}>
      <Text style={[styles.title, { color: colors.ink }]}>
        {repeating ? t('auth.pinRepeat') : t('auth.pinCreate')}
      </Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('auth.pinSectionHint')}</Text>

      <View style={styles.dots}>
        <PinDots filled={pin.length} error={Boolean(error)} />
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.spacer} />
      <View style={styles.pad}>
        {KEYS.map((k, i) => (
          <PressableScale
            key={i}
            small
            haptic={Boolean(k)}
            disabled={!k}
            onPress={() => press(k)}
            style={styles.key}
          >
            <Text style={[styles.keyLabel, { color: colors.ink, opacity: k ? 1 : 0 }]}>{k}</Text>
          </PressableScale>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontFamily: font.extrabold, fontSize: 34, letterSpacing: -1 },
  hint: { fontFamily: font.semibold, fontSize: 15, marginTop: 8 },
  dots: { marginTop: 36 },
  error: { fontFamily: font.semibold, fontSize: 14, marginTop: 16 },
  spacer: { flex: 1 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 12 },
  key: { width: '33.333%', height: 68, alignItems: 'center', justifyContent: 'center' },
  keyLabel: { fontFamily: font.extrabold, fontSize: 26 },
});
