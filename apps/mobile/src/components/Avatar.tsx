// Аватар-кружок с инициалом. Цвет приходит из данных контакта (как в вебе),
// поэтому один и тот же человек везде одного цвета.
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font } from '@/theme/tokens';

interface Props {
  name?: string;
  letter?: string;
  color?: string;
  size?: number;
  /** обводка цветом фона — для наложенных стопкой аватаров */
  ring?: string;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, letter, color = '#3E3C35', size = 40, ring, style }: Props) {
  const ch = (letter ?? name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: ring ? Math.max(2, size * 0.075) : 0,
          borderColor: ring,
        },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.4 }]} numberOfLines={1}>
        {ch}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: font.extrabold, color: '#FFFFFF' },
});
