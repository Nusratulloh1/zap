// Экран с безопасными зонами и цветом фона по теме. Статус-бар подстраивается
// под фон: на лайме и креме — тёмные иконки, на чернилах — светлые.
import React from 'react';
import { StatusBar, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: React.ReactNode;
  /** фон экрана; по умолчанию — cream текущей темы */
  background?: string;
  /** тёмный фон → светлые иконки статус-бара */
  darkBar?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, background, darkBar, edges = ['top', 'bottom'], style }: Props) {
  const { colors, name } = useTheme();
  const bg = background ?? colors.cream;
  // в RN 0.87 Android edge-to-edge по умолчанию: у StatusBar остался только стиль
  const isDarkSurface = darkBar ?? name === 'dark';
  const bar = isDarkSurface ? 'light-content' : 'dark-content';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={bar} />
      <SafeAreaView edges={edges} style={[styles.root, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
