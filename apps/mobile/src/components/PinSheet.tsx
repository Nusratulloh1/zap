// Подтверждение PIN перед оплатой/созданием сплита: точки, тряска при ошибке,
// биометрия если включена — как web/src/components/PinSheet.vue.
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ReactNativeBiometrics from 'react-native-biometrics';
import { trigger } from 'react-native-haptic-feedback';
import { BottomSheet } from '@/components/BottomSheet';
import { PinDots } from '@/components/PinDots';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { verifyPin } from '@/api/auth';

const LEN = 4;

interface Props {
  open: boolean;
  hint?: string;
  title?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function PinSheet({ open, hint, title, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kbOpen, setKbOpen] = useState(true);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!open) {
      setPin('');
      setWrong(false);
      return;
    }
    const id = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(id);
  }, [open]);

  // та же ловушка, что была на экране SMS: скрытое поле + закрытая клавиатура
  // = мёртвый шит. Любой тап возвращает фокус.
  useEffect(() => {
    const h = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    const s = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    return () => {
      h.remove();
      s.remove();
    };
  }, []);

  useEffect(() => {
    if (pin.length !== LEN || busy) return;
    setBusy(true);
    void (async () => {
      const ok = await verifyPin(pin);
      setBusy(false);
      if (ok) {
        trigger('notificationSuccess', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        setPin('');
        onConfirm();
      } else {
        trigger('notificationError', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        setWrong(true);
        setTimeout(() => {
          setWrong(false);
          setPin('');
        }, 700);
      }
    })();
  }, [pin, busy, onConfirm]);

  const promptBiometrics = async () => {
    try {
      const rnb = new ReactNativeBiometrics();
      const { available } = await rnb.isSensorAvailable();
      if (!available) return;
      const { success } = await rnb.simplePrompt({ promptMessage: title ?? t('pin.confirmTitle') });
      if (success) onConfirm();
    } catch {
      /* биометрия недоступна — остаётся PIN */
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} locked={busy}>
      <Pressable onPress={() => input.current?.focus()} style={styles.body}>
        <Text style={[styles.title, { color: colors.ink }]}>{title ?? t('pin.confirmTitle')}</Text>
        <Text style={[styles.hint, { color: wrong ? colors.danger : colors.muted }]}>
          {wrong ? t('pin.wrong') : (hint ?? t('pin.confirmHint'))}
        </Text>

        <View style={styles.dots}>
          <PinDots filled={pin.length} length={LEN} error={wrong} />
        </View>

        {!kbOpen ? (
          <Text style={[styles.reopen, { color: colors.muted }]}>{t('auth.tapToType')}</Text>
        ) : null}

        <Pressable onPress={() => void promptBiometrics()} style={styles.bio}>
          <Text style={[styles.bioText, { color: colors.muted }]}>{t('profile.pinFaceId')}</Text>
        </Pressable>

        <TextInput
          ref={input}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, LEN))}
          keyboardType="number-pad"
          maxLength={LEN}
          secureTextEntry
          caretHidden
          style={styles.hidden}
        />
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingBottom: 8 },
  title: { fontFamily: font.extrabold, fontSize: 17 },
  hint: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6, textAlign: 'center' },
  dots: { marginTop: 22 },
  reopen: { fontFamily: font.semibold, fontSize: 13, marginTop: 16 },
  bio: { marginTop: 18, paddingVertical: 8 },
  bioText: { fontFamily: font.bold, fontSize: 14 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
