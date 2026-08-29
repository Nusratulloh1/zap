// Экран с безопасными зонами и цветом фона по теме. Статус-бар подстраивается
// под фон: на лайме и креме — тёмные иконки, на чернилах — светлые.
import React from 'react';
import { StatusBar, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView, type Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: React.ReactNode;
  /** фон экрана; по умолчанию — paper (bg-paper у страниц веба) */
  background?: string;
  /** тёмный фон → светлые иконки статус-бара */
  darkBar?: boolean;
  edges?: readonly Edge[];
  /** убрать верхнее затухание (брендовые экраны без прокрутки) */
  noTopFade?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, background, darkBar, edges = ['top', 'bottom'], noTopFade, style }: Props) {
  const { colors, name } = useTheme();
  const bg = background ?? colors.paper;
  const insets = useSafeAreaInsets();
  // в RN 0.87 Android edge-to-edge по умолчанию: у StatusBar остался только стиль
  const isDarkSurface = darkBar ?? name === 'dark';
  const bar = isDarkSurface ? 'light-content' : 'dark-content';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={bar} />
      <SafeAreaView edges={edges} style={[styles.root, style]}>
        {children}
      </SafeAreaView>
      {/* контент, уходящий под статус-бар, растворяется, а не обрезается */}
      {noTopFade ? null : (
        <Svg style={[styles.topFade, { height: insets.top + 14 }]} pointerEvents="none">
          <Defs>
            <LinearGradient id="screenTopFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={bg} stopOpacity={1} />
              <Stop offset="0.65" stopColor={bg} stopOpacity={1} />
              <Stop offset="1" stopColor={bg} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <SvgRect x={0} y={0} width="100%" height="100%" fill="url(#screenTopFade)" />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
});
