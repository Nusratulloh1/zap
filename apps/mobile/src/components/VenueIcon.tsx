// Знак заведения в строке сплита — крупная плитка с эмодзи категории
// («Emoji of cafe type: if Bellissimo → Pizza»).
//
// Стопка лиц участников отсюда убрана по замечанию руководства: в списке важно
// «где», а «с кем» и так написано во второй строке.
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { merchantGlyph } from '@/lib/merchantLogo';

interface Props {
  /** название заведения или сплита */
  name: string;
  size?: number;
  /** свой знак (у компании — выбранный пользователем) */
  glyph?: string;
  style?: StyleProp<ViewStyle>;
}

export function VenueIcon({ name, size = 46, glyph, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.root,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: colors.sand },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.52 }}>{glyph ?? merchantGlyph(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
