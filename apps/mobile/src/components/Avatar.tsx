// Аватар. У КАЖДОГО человека — наша персона, а не буква (требование
// руководства): для «me» — выбранная в профиле, для остальных контактов —
// стабильно закреплённая по id из каталога 24 персон. Так люди узнаются в
// сплитах, группах и списках, а не читаются как инициалы.
//
// Буква остаётся только там, где человека нет вовсе (мерчант, пустой слот).
import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { MY_AVATARS, useMyAvatar } from '@/lib/myAvatar';
import { font } from '@/theme/tokens';

/**
 * Персона по id контакта: сумма кодов символов → индекс в каталоге.
 * Детерминированно — у человека всегда одно и то же лицо на всех экранах.
 */
function personaFor(id: string): ImageSourcePropType {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MY_AVATARS[h % MY_AVATARS.length]!.src;
}

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
  /** явная картинка (выбранный аватар пользователя) — приоритетнее contactId */
  source?: ImageSourcePropType;
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
  /** не подставлять персону (мерчант, а не человек) */
  noPersona?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ source, name, letter, color = '#8A887E', contactId, size = 40, ring, ringWidth, dim, solid, noPersona, style }: Props) {
  const mine = useMyAvatar();
  const photo =
    source ??
    (contactId === 'me' ? mine : undefined) ??
    (contactId && !noPersona ? (AVATAR_BY_CONTACT[contactId] ?? personaFor(contactId)) : undefined);
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
    return (
      <Image
        source={photo}
        style={[frame, style as object]}
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
