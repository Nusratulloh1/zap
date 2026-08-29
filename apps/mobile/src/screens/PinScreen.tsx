// Создание PIN — порт шага pin1/pin2 в AuthCodePage.vue: круг-назад,
// заголовок «Придумайте PIN» → «Повторите PIN», 4 точки с лаймовым баром,
// системная клавиатура (скрытое поле + тап-ловушка, как на экране кода).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PinDots } from '@/components/PinDots';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { refocus, useKeyboardLock } from '@/lib/keyboard';

const LEN = 4;

export function PinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const createPin = useSession((s) => s.createPin);

  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [shake, setShake] = useState(false);
  const busy = useRef(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  const repeating = first.length === LEN;

  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  useKeyboardLock(input, true);

  useEffect(() => {
    if (pin.length !== LEN || busy.current) return;
    if (!repeating) {
      // первый ввод принят — через паузу переходим к повтору (как в вебе)
      const id = setTimeout(() => {
        setFirst(pin);
        setPin('');
      }, 250);
      return () => clearTimeout(id);
    }
    if (pin !== first) {
      trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      setMismatch(true);
      setShake(true);
      const id = setTimeout(() => {
        setShake(false);
        setFirst('');
        setPin('');
      }, 450);
      return () => clearTimeout(id);
    }
    busy.current = true;
    void (async () => {
      try {
        await createPin(pin);
        trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      } catch {
        setFirst('');
        setPin('');
      } finally {
        busy.current = false;
      }
    })();
  }, [pin, first, repeating, createPin]);

  const focusInput = () => refocus(input);

  return (
    <Screen style={styles.root} background={colors.paper}>
      <Pressable style={styles.tapCatcher} onPress={focusInput} accessibilityRole="button" />

      <ScreenHeader onBack={() => useSession.setState({ stage: 'phone' })} />

      <Text style={[styles.title, { color: colors.ink }]}>
        {repeating ? t('auth.pinRepeat') : t('auth.pinCreate')}
      </Text>
      <Text style={[styles.hint, { color: mismatch ? colors.danger : colors.muted }]}>
        {mismatch ? t('auth.pinMismatch') : t('auth.pinSectionHint')}
      </Text>

      <Pressable style={styles.dots} onPress={focusInput}>
        <PinDots length={LEN} filled={pin.length} shake={shake} size={34} gap={22} barWidth={186} />
      </Pressable>

      <TextInput
        ref={input}
        value={pin}
        onChangeText={(v) => {
          setMismatch(false);
          setPin(v.replace(/\D/g, '').slice(0, LEN));
        }}
        keyboardType="number-pad"
        secureTextEntry
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
  hint: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6 },
  dots: { marginTop: 28, alignSelf: 'flex-start' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
