// Кнопка «назад» в кружке + опциональная правая кнопка — шапка внутренних
// экранов, как в вебе (кружок bg-sand, стрелка ←).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { BackIcon } from '@/components/icons';

interface Props {
  /** куда ведёт «назад»; по умолчанию goBack, 'home' — на главную */
  onBack?: () => void;
  /** правая кнопка: символ + обработчик (например «⋯» меню) */
  right?: { glyph: string; label: string; onPress: () => void };
  /** светлая кнопка на тёмном/лаймовом фоне */
  tint?: 'sand' | 'onLime' | 'onDark';
}

export function ScreenHeader({ onBack, right, tint = 'sand' }: Props) {
  const nav = useNavigation<{ goBack: () => void; navigate: (s: string) => void; canGoBack: () => boolean }>();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const bg =
    tint === 'onLime' ? 'rgba(17,17,16,0.08)' : tint === 'onDark' ? 'rgba(255,255,255,0.12)' : colors.sand;
  const fg = tint === 'onDark' ? '#FFFFFF' : colors.ink;

  const back = () => {
    if (onBack) onBack();
    else if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Tabs');
  };

  return (
    <View style={styles.row}>
      <PressableScale
        small
        accessibilityRole="button"
        accessibilityLabel={t('common.backAria')}
        style={[styles.btn, { backgroundColor: bg }]}
        onPress={back}
      >
        <BackIcon size={20} color={fg} />
      </PressableScale>
      {right ? (
        <PressableScale
          small
          accessibilityRole="button"
          accessibilityLabel={right.label}
          style={[styles.btn, { backgroundColor: bg }]}
          onPress={right.onPress}
        >
          <Text style={[styles.glyph, { color: fg }]}>{right.glyph}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  btn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 19, fontFamily: font.bold },
});
