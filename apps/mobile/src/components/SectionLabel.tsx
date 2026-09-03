// Заголовок секции — один на все экраны: «ВАМ ДОЛЖНЫ», «ПО ГРУППАМ»,
// «ПОСЛЕДНИЕ ZAP», «ИСТОРИЯ КОМПАНИИ».
//
// До этого каждый экран набирал их по-своему: где-то моно 8 с разрядкой 2.5,
// где-то моно 10 с разрядкой 1.6, где-то экстраболд 12.5 — и три разных серых.
// Мелкие подписи держат ритм экрана: как только они разъезжаются, страница
// начинает выглядеть собранной из кусков. Здесь один размер и один цвет.
import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  /** фон экрана тёмный — оливковый на нём не читается */
  onDark?: boolean;
  /** подпись внутри карточки: там серый мерчантский, а не оливковый */
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children, onDark, color, style }: Props) {
  const { colors } = useTheme();

  return (
    <Text style={[styles.label, { color: color ?? (onDark ? colors.sand : colors.deep) }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
});

/** Те же метрики для мест, где нужен голый стиль, а не компонент. */
export const SECTION_LABEL_STYLE = styles.label;
