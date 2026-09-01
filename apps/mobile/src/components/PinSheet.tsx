// Подтверждение PIN перед оплатой — порт web/src/components/PinSheet.vue:
// ПОЛНОЭКРАННЫЙ слой на bg-paper (не нижний шит): круг-крестик, заголовок
// слева, точки 34px с лаймовым баром, системная клавиатура (скрытое поле).
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { PinDots } from '@/components/PinDots';
import { CloseIcon } from '@/components/icons';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { verifyPin } from '@/api/auth';
import { refocus, useKeyboardLock } from '@/lib/keyboard';
import { promptBiometrics } from '@/lib/biometrics';

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
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!open) {
      setPin('');
      setWrong(false);
      return;
    }
    let cancelled = false;
    // системный запрос идёт первым; отказ просто оставляет ввод PIN
    void (async () => {
      const ok = await promptBiometrics(title ?? hint ?? '');
      if (cancelled) return;
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          confirmRef.current();
        }, 240);
        return;
      }
      input.current?.focus();
    })();
    const id = setTimeout(() => {
      if (!cancelled) input.current?.focus();
    }, 380);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, title, hint]);

  // клавиатура всегда открыта, пока шит виден; выход — крестик
  useKeyboardLock(input, open);

  // свежий колбэк без перезапуска эффекта
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  useEffect(() => {
    if (pin.length !== LEN || busy) return;
    setBusy(true);
    void (async () => {
      const ok = await verifyPin(pin);
      setBusy(false);
      if (ok) {
        trigger('notificationSuccess', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        // лаймовый чек над точками, подтверждение через 380 мс — как в вебе
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setPin('');
          confirmRef.current();
        }, 380);
      } else {
        trigger('notificationError', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        setWrong(true);
        setTimeout(() => {
          setWrong(false);
          setPin('');
        }, 400);
      }
    })();
  }, [pin, busy]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable
        onPress={() => refocus(input)}
        style={[styles.page, { backgroundColor: colors.paper, paddingTop: insets.top + 24 }]}
      >
        <PressableScale
          small
          accessibilityLabel={t('common.cancel')}
          style={[styles.close, { backgroundColor: colors.sand }]}
          onPress={onClose}
          disabled={busy}
        >
          <CloseIcon size={18} color={colors.ink} />
        </PressableScale>

        <Text style={[styles.title, { color: colors.ink }]}>{title ?? t('pin.confirmTitle')}</Text>
        <Text style={[styles.hint, { color: wrong ? colors.danger : colors.muted }]}>
          {wrong ? t('pin.wrong') : (hint ?? t('pin.confirmHint'))}
        </Text>

        <View style={styles.dots}>
          <PinDots filled={pin.length} length={LEN} error={wrong} success={success} barWidth={186} />
        </View>

        <TextInput
          ref={input}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, LEN))}
          keyboardType="number-pad"
          maxLength={LEN}
          secureTextEntry
          textContentType="none"
          autoComplete="off"
          importantForAutofill="no"
          caretHidden
          style={styles.hidden}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24 },
  close: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 22 },
  hint: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 6 },
  dots: { marginTop: 28, alignSelf: 'flex-start' },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
