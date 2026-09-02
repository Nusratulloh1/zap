// Выбор персоны-аватара: сетка 15 вариантов в бэттом-шите.
//
// Стандартный паттерн «character select»: тап по аватару в профиле открывает
// сетку, тап по варианту применяет мгновенно — без кнопки «Сохранить»,
// результат и так виден за шитом.
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { MY_AVATARS, myAvatarKey, setMyAvatar } from '@/lib/myAvatar';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  /** «сфотографироваться» — навигацию делает экран-владелец */
  onCamera: () => void;
}

export function AvatarSheet({ open, onClose, onCamera }: Props) {
  const { colors, fixed } = useTheme();
  const { t } = useTranslation();
  const current = myAvatarKey();

  const pick = (key: string) => {
    trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    setMyAvatar(key);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('profile.avatarTitle')}</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        {/* своё фото — первой плиткой */}
        <PressableScale haptic={false} onPress={() => { onClose(); onCamera(); }}>
          <View style={[styles.cell, styles.cameraCell, { backgroundColor: colors.sand }]}>
            <Text style={styles.cameraGlyph}>📷</Text>
          </View>
        </PressableScale>
        {MY_AVATARS.map((a) => {
          const active = a.key === current;
          return (
            <PressableScale key={a.key} haptic={false} onPress={() => pick(a.key)}>
              <View style={[styles.cell, active && { borderColor: fixed.lime }]}>
                <Image source={a.src} style={styles.img} />
                {active ? (
                  <View style={[styles.check, { backgroundColor: fixed.lime }]}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 440 },
  cameraCell: { alignItems: 'center', justifyContent: 'center' },
  cameraGlyph: { fontSize: 24 },
  title: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.2, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 8 },
  cell: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'visible',
  },
  img: { width: '100%', height: '100%', borderRadius: 999 },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkMark: { fontFamily: font.extrabold, fontSize: 12, color: '#111110' },
});
