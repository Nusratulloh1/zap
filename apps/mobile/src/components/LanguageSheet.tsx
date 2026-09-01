// Выбор языка нижним шитом — как в вебе. Отдельного BottomSheet в мобильном
// пока нет, поэтому шит собран здесь: Modal + подложка + пружинный выезд.
// Компонент отдаёт и таблетку-триггер, и сам шит: на онбординге он ставится
// одним элементом в правый верхний угол.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { BottomSheet } from '@/components/BottomSheet';
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

/** Шит выбора языка — используется и таблеткой онбординга, и профилем. */
export function LanguagePickerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const stage = useSession((s) => s.stage);
  const current = (i18n.language as Locale) ?? currentLocale();

  const pick = async (next: Locale) => {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    onClose();
    if (next === current) return;
    await applyLocale(next);
    if (stage === 'authed') {
      void http('/me', { method: 'PATCH', body: JSON.stringify({ locale: next }) }).catch(() => undefined);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('profile.languageTitle')}</Text>
      {LOCALES.map((l) => (
        <PressableScale
          key={l}
          accessibilityRole="button"
          accessibilityState={{ selected: l === current }}
          style={[styles.row, l === current && { backgroundColor: 'rgba(221,255,51,0.25)' }]}
          onPress={() => void pick(l)}
        >
          <FlagIcon locale={l} size={26} />
          <Text style={[styles.rowText, { color: colors.ink }]}>{LOCALE_NAMES[l]}</Text>
          {l === current ? <Text style={[styles.check, { color: colors.ink }]}>✓</Text> : null}
        </PressableScale>
      ))}
    </BottomSheet>
  );
}

export function LanguageSwitcher({ onDark = false, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const { fixed } = useTheme();
  const current = (i18n.language as Locale) ?? currentLocale();

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  const pill = onDark
    ? { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.28)' }
    : { backgroundColor: fixed.ink, borderColor: 'transparent' };
  const pillText = onDark ? '#FFFFFF' : '#FFFFFF';

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

      <LanguagePickerSheet
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    minWidth: 68,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pillText: { fontFamily: font.extrabold, fontSize: 13 },
  chevron: { fontFamily: font.bold, fontSize: 11, marginTop: -1 },
  title: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  rowText: { flex: 1, fontFamily: font.bold, fontSize: 16 },
  check: { fontFamily: font.extrabold, fontSize: 15 },
});
