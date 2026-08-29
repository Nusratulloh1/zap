// Выбор языка нижним шитом — как в вебе. Отдельного BottomSheet в мобильном
// пока нет, поэтому шит собран здесь: Modal + подложка + пружинный выезд.
// Компонент отдаёт и таблетку-триггер, и сам шит: на онбординге он ставится
// одним элементом в правый верхний угол.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { FlagIcon } from '@/components/FlagIcon';
import { LOCALES, LOCALE_NAMES, applyLocale, currentLocale, type Locale } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { http } from '@/api/client';

type Props = {
  /** тёмная подложка слайда — таблетка становится стеклянной */
  onDark?: boolean;
  /** родителю нужно знать, что шит открыт: онбординг ставит сторис на паузу */
  onOpenChange?: (open: boolean) => void;
};

export function LanguageSwitcher({ onDark = false, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const stage = useSession((s) => s.stage);
  const current = (i18n.language as Locale) ?? currentLocale();

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  const pick = useCallback(
    async (next: Locale) => {
      trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      setOpen(false);
      if (next === current) return;
      await applyLocale(next);
      // на аккаунт — только если он уже есть; ошибка сети выбор не откатывает,
      // он уже сохранён на устройстве
      if (stage === 'authed') {
        void http('/me', { method: 'PATCH', body: JSON.stringify({ locale: next }) }).catch(() => undefined);
      }
    },
    [current, stage],
  );

  const pill = onDark
    ? { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.28)' }
    : { backgroundColor: fixed.ink, borderColor: 'transparent' };
  const pillText = onDark ? fixed.paper : fixed.cream;

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={LOCALE_NAMES[current]}
        style={[styles.pill, pill]}
        onPress={() => setOpen(true)}
      >
        <FlagIcon locale={current} size={19} />
        <Text style={[styles.pillText, { color: pillText }]}>{current.toUpperCase()}</Text>
        <Text style={[styles.chevron, { color: pillText }]}>▾</Text>
      </PressableScale>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          style={[styles.backdropWrap, { backgroundColor: colors.overlay }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(240)}
          exiting={SlideOutDown.duration(180)}
          style={[
            styles.sheet,
            { backgroundColor: colors.paper, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.stone }]} />
          <Text style={[styles.title, { color: colors.ink }]}>{t('profile.languageTitle')}</Text>

          {LOCALES.map((l) => (
            <PressableScale
              key={l}
              accessibilityRole="button"
              accessibilityState={{ selected: l === current }}
              style={[styles.row, l === current && { backgroundColor: colors.limeSoft }]}
              onPress={() => void pick(l)}
            >
              <FlagIcon locale={l} size={26} />
              <Text style={[styles.rowText, { color: colors.ink }]}>{LOCALE_NAMES[l]}</Text>
              {l === current ? <Text style={[styles.check, { color: colors.ink }]}>✓</Text> : null}
            </PressableScale>
          ))}
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontFamily: font.extrabold, fontSize: 13 },
  chevron: { fontFamily: font.bold, fontSize: 11, marginTop: -1 },
  backdropWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, marginBottom: 12 },
  title: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  rowText: { flex: 1, fontFamily: font.bold, fontSize: 16 },
  check: { fontFamily: font.extrabold, fontSize: 15 },
});
