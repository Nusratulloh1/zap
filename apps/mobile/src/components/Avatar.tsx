// Аватар — один в один с web/src/components/ZapAvatar.vue:
// фото из дизайна по id контакта; без фото — светлый tint-фон цвета контакта
// (color + 26 alpha) и буква ТЕМ ЖЕ цветом; чернильный — лаймовая буква.
// Раньше был сплошной цвет + белая буква — с вебом не совпадало.
import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font } from '@/theme/tokens';

// фото-аватары из дизайна, по id контакта — как web/src/lib/avatars.ts
const AVATAR_BY_CONTACT: Record<string, number> = {
  me: require('../../assets/brand/avatars/a12.png'),
  c_ali: require('../../assets/brand/avatars/a33.png'),
  c_bek: require('../../assets/brand/avatars/a68.png'),
  c_aziz: require('../../assets/brand/avatars/a11.png'),
  c_timur: require('../../assets/brand/avatars/a15.png'),
  c_madina: require('../../assets/brand/avatars/a47.png'),
};

interface Props {
  name?: string;
  letter?: string;
  color?: string;
  /** id контакта — если для него есть фото из дизайна, рендерим его */
  contactId?: string;
  size?: number;
  /** обводка цветом фона — для наложенных стопкой аватаров */
  ring?: string;
  /** приглушить (ожидающий участник) */
  dim?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, letter, color = '#8A887E', contactId, size = 40, ring, dim, style }: Props) {
  const photo = contactId ? AVATAR_BY_CONTACT[contactId] : undefined;
  const ch = (letter ?? name?.trim()?.[0] ?? '?').toUpperCase();
  const isDark = color === '#111110';
  const ringW = ring ? Math.max(2, size * 0.06) : 0;

  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ringW,
    borderColor: ring,
    opacity: dim ? 0.6 : 1,
  };

  if (photo) {
    return <Image source={photo} style={[frame, style as object]} />;
  }

  return (
    <View
      style={[
        styles.root,
        frame,
        { backgroundColor: isDark ? color : color + '26' },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.36, color: isDark ? '#DDFF33' : color }]} numberOfLines={1}>
        {ch}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { fontFamily: font.extrabold, opacity: 0.9 },
});
