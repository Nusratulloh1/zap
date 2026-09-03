// Пол — один вопрос при первом входе, чтобы подобрать аватар.
//
// Спрашиваем ровно один раз и только ради аватара: подставлять парня девушке —
// плохое первое впечатление. Ответ хранится локально, на сервер не уходит.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { MY_AVATARS, setGender, type Gender } from '@/lib/myAvatar';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PREVIEW: Record<Gender, string> = { male: 'p01', female: 'p02' };

export function GenderSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  const pick = (g: Gender) => {
    trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    setGender(g);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('gender.title')}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{t('gender.subtitle')}</Text>

      <View style={styles.row}>
        {(['male', 'female'] as const).map((g) => {
          const src = MY_AVATARS.find((a) => a.key === PREVIEW[g])?.src;
          return (
            <PressableScale key={g} style={styles.cell} haptic={false} onPress={() => pick(g)}>
              <View style={[styles.card, { backgroundColor: colors.shell }]}>
                {src ? <Image source={src} style={styles.avatar} /> : null}
                <Text style={[styles.label, { color: colors.ink }]}>{t(`gender.${g}`)}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <PressableScale style={styles.skip} onPress={onClose}>
        <Text style={[styles.skipText, { color: colors.faint2 }]}>{t('gender.skip')}</Text>
      </PressableScale>

      <View style={[styles.hintRow, { backgroundColor: fixed.lime }]}>
        <Text style={styles.hintText}>{t('gender.hint')}</Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.extrabold, fontSize: 21, letterSpacing: -0.3 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 5, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
  card: { borderRadius: 22, paddingVertical: 18, alignItems: 'center', gap: 10 },
  avatar: { width: 84, height: 84, borderRadius: 999 },
  label: { fontFamily: font.extrabold, fontSize: 15 },
  skip: { alignSelf: 'center', paddingVertical: 14 },
  skipText: { fontFamily: font.bold, fontSize: 13.5 },
  hintRow: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6 },
  hintText: { fontFamily: font.semibold, fontSize: 12, color: '#121212', textAlign: 'center' },
});
