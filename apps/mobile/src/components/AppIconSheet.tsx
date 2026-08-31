// Выбор иконки приложения. Шит собран как LanguagePickerSheet, но строка —
// с превью самого мастера, чтобы было видно, что именно окажется на домашнем
// экране.
//
// Android при смене алиаса закрывает приложение, поэтому там спрашиваем
// подтверждение; на iOS система сама показывает свой алерт постфактум.
import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { BottomSheet } from '@/components/BottomSheet';
import { toast } from '@/components/ToastHost';
import { APP_ICONS, ICON_PREVIEW, currentAppIcon, setAppIcon, type AppIconKey } from '@/lib/appIcon';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

const LABEL: Record<AppIconKey, string> = {
  receipts: 'profile.iconReceipts',
  mosaic: 'profile.iconMosaic',
  hands: 'profile.iconHands',
};

export function AppIconSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [current, setCurrent] = useState<AppIconKey>('receipts');

  useEffect(() => {
    if (open) void currentAppIcon().then(setCurrent);
  }, [open]);

  const apply = async (key: AppIconKey) => {
    onClose();
    if (key === current) return;
    try {
      await setAppIcon(key);
      setCurrent(key);
      // iOS сам показывает системный алерт — свой тост там был бы вторым подряд
      if (Platform.OS === 'android') toast.success(t('profile.appIconDone'));
    } catch (e) {
      // причину показываем: коды нативного модуля (NOT_SUPPORTED,
      // ICON_ALREADY_USED) без неё неотличимы от «модуль не подключён»
      const reason = e instanceof Error && e.message ? e.message : String(e);
      toast(`${t('profile.appIconFailed')}: ${reason}`.slice(0, 120));
    }
  };

  const pick = (key: AppIconKey) => {
    trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
    if (key === current) return onClose();
    if (Platform.OS !== 'android') return void apply(key);
    // предупреждаем до того, как система закроет приложение
    Alert.alert(t('profile.appIconTitle'), t('profile.appIconRestart'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.ok'), onPress: () => void apply(key) },
    ]);
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('profile.appIconTitle')}</Text>
      {APP_ICONS.map((key) => (
        <PressableScale
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: key === current }}
          style={[styles.row, key === current && { backgroundColor: 'rgba(221,255,51,0.25)' }]}
          onPress={() => pick(key)}
        >
          <Image source={ICON_PREVIEW[key]} style={styles.preview} />
          <Text style={[styles.rowText, { color: colors.ink }]}>{t(LABEL[key])}</Text>
          {key === current ? <Text style={[styles.check, { color: colors.ink }]}>✓</Text> : null}
        </PressableScale>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 66,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  // радиус как у иконки на домашнем экране — превью читается «иконкой»
  preview: { width: 46, height: 46, borderRadius: 11 },
  rowText: { flex: 1, fontFamily: font.bold, fontSize: 16 },
  check: { fontFamily: font.extrabold, fontSize: 15 },
});
