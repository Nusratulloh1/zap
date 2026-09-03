// Выбор фона экрана — кнопка «🎨» из макета.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { SKINS, setSkin, useSkin } from '@/lib/screenSkin';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  /** дополнительные действия под палитрой (у компании — знак, переименовать, удалить) */
  extra?: { label: string; onPress: () => void; danger?: boolean }[];
}

export function SkinSheet({ open, onClose, extra }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const current = useSkin();

  const pick = (c: string) => {
    trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    setSkin(c);
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('skin.title')}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{t('skin.hint')}</Text>
      <View style={styles.grid}>
        {SKINS.map((c) => (
          <PressableScale key={c} haptic={false} onPress={() => pick(c)}>
            <View
              style={[
                styles.cell,
                { backgroundColor: c, borderColor: c === (current ?? SKINS[0]) ? colors.ink : colors.sand2 },
              ]}
            />
          </PressableScale>
        ))}
      </View>

      {extra?.length ? (
        <View style={styles.extra}>
          {extra.map((a) => (
            <PressableScale
              key={a.label}
              style={[styles.action, { backgroundColor: colors.sand }]}
              onPress={a.onPress}
            >
              <Text style={[styles.actionText, { color: a.danger ? colors.ember : colors.ink }]}>
                {a.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.2 },
  sub: { fontFamily: font.semibold, fontSize: 13, marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 8 },
  cell: { width: 62, height: 62, borderRadius: 20, borderWidth: 3 },
  extra: { gap: 8, marginTop: 16, paddingBottom: 4 },
  action: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: font.bold, fontSize: 15 },
});
