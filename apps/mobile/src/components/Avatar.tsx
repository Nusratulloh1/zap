// Аватар — один в один с web/src/components/ZapAvatar.vue:
// фото из дизайна по id контакта; без фото — светлый tint-фон цвета контакта
// (color + 26 alpha) и буква ТЕМ ЖЕ цветом; чернильный — лаймовая буква.
// Раньше был сплошной цвет + белая буква — с вебом не совпадало.
import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font } from '@/theme/tokens';

// фото-аватары из дизайна, по id контакта — как web/src/lib/avatars.ts
// «me» намеренно без фото: в реальном режиме веб показывает инициал
/** размер буквы по бакетам веба: xs 11 / sm 13 / md 15 / lg 18 / xl 26+ */
function letterSize(size: number): number {
  if (size <= 28) return 11;
  if (size <= 38) return 13;
  if (size <= 48) return 15;
  if (size <= 60) return 18;
  return Math.round(size * 0.38);
}

const AVATAR_BY_CONTACT: Record<string, number> = {
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
  /** толщина обводки; по умолчанию — от размера */
  ringWidth?: number;
  /** приглушить (ожидающий участник) */
  dim?: boolean;
  /** сплошная заливка цветом контакта — для лаймовых брендовых экранов,
      где 15%-тинт сливается с фоном */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, letter, color = '#8A887E', contactId, size = 40, ring, ringWidth, dim, solid, style }: Props) {
  const photo = contactId ? AVATAR_BY_CONTACT[contactId] : undefined;
  const ch = (letter ?? name?.trim()?.[0] ?? '?').toUpperCase();
  const isDark = color === '#111110';
  const ringW = ring ? (ringWidth ?? Math.max(2, size * 0.06)) : 0;

  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ringW,
    borderColor: ring,
    opacity: dim ? 0.6 : 1,
  };

  if (photo) {
    // «в долг»/«ждём» — как grayscale в вебе: обесцвечиваем фото
    return (
      <Image
        source={photo}
        style={[frame, style as object]}
        // RN не умеет CSS-фильтры: обесцвечивание даёт tintColor-наложение
        {...(dim ? { blurRadius: 0 } : null)}
      />
    );
  }

  return (
    <View
      style={[
        styles.root,
        frame,
        { backgroundColor: isDark || solid ? color : color + '26' },
        style,
      ]}
    >
      <Text
        style={[
          styles.letter,
          {
            fontSize: letterSize(size),
            color: isDark ? '#DDFF33' : solid ? '#FFFFFF' : color,
            opacity: isDark || solid ? 1 : 0.9,
          },
        ]}
        numberOfLines={1}
      >
        {ch}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { fontFamily: font.extrabold },
});
