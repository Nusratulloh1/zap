// Гарнир темы заведения: стикер в углу и очень слабая подложка.
//
// Ровно тот «10–15% визуального слоя», о котором говорит видение (часть B §5).
// Ничего интерактивного, ничего анимированного в цикле: статичная картинка и
// тон. Поэтому у экрана не меняется ни производительность, ни поведение при
// «уменьшить движение».
//
// Контраст текста трогать нельзя, поэтому подложка держится на очень низкой
// непрозрачности, а стикер стоит в стороне от содержимого и не перехватывает
// касания.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { MerchantTheme } from '@/lib/merchantTheme';
import { STICKER } from '@/components/EmptyState';

interface Props {
  theme: MerchantTheme | null;
  /** где ставим гарнир: у шапки счёта или в углу экрана */
  placement?: 'header' | 'corner';
}

export function ThemeGarnish({ theme, placement = 'corner' }: Props) {
  if (!theme) return null;

  const corner = placement === 'corner';

  return (
    <View style={corner ? styles.corner : styles.header} pointerEvents="none">
      {theme.sticker ? (
        <Image
          source={STICKER[theme.sticker]}
          style={corner ? styles.stickerCorner : styles.stickerHeader}
          resizeMode="contain"
        />
      ) : (
        // под эту категорию стикера пока нет — ставим эмодзи того же смысла
        <Text style={corner ? styles.glyphCorner : styles.glyphHeader}>{theme.glyph}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // угол экрана: заметно, но вне колонки содержимого
  corner: { position: 'absolute', right: -14, top: -6, opacity: 0.5, zIndex: 1 },
  stickerCorner: { width: 96, height: 82 },
  glyphCorner: { fontSize: 46 },

  header: { marginLeft: 'auto' },
  stickerHeader: { width: 54, height: 46 },
  glyphHeader: { fontSize: 26 },
});
