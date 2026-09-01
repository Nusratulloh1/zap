// Кнопка «назад» в кружке + опциональная правая кнопка — шапка внутренних
// экранов, как в вебе (кружок bg-sand, стрелка ←).
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { Glass } from '@/components/Glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { BackIcon } from '@/components/icons';

interface Props {
  /**
   * Плавающая шапка: прокрутка идёт ПОД ней, а контент растворяется в
   * подложке — на iOS это настоящее стекло, на Android градиент того же
   * цвета (нативного блюра в RN 0.87 на Android нет, см. Glass.tsx).
   * Экран обязан компенсировать высоту шапки отступом контента.
   */
  floating?: boolean;
  /** цвет подложки/градиента; обязателен вместе с floating */
  background?: string;
  /** куда ведёт «назад»; по умолчанию goBack, 'home' — на главную */
  onBack?: () => void;
  /** правая кнопка: символ + обработчик (например «⋯» меню) */
  right?: { glyph: string; label: string; onPress: () => void };
  /** светлая кнопка на тёмном/лаймовом фоне */
  tint?: 'sand' | 'onLime' | 'onDark';
}

export function ScreenHeader({ onBack, right, tint = 'sand', floating, background }: Props) {
  const nav = useNavigation<{
    goBack: () => void;
    navigate: (s: string) => void;
    canGoBack: () => boolean;
    popTo: (s: string) => void;
  }>();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const btnBg =
    tint === 'onLime' ? 'rgba(17,17,16,0.08)' : tint === 'onDark' ? 'rgba(255,255,255,0.12)' : colors.sand;
  const fg = tint === 'onDark' ? '#FFFFFF' : colors.ink;

  const back = () => {
    if (onBack) onBack();
    else if (nav.canGoBack()) nav.goBack();
    else nav.popTo('Tabs');
  };

  const insets = useSafeAreaInsets();

  if (floating) {
    const bg = background ?? colors.cream;
    return (
      <View style={[styles.floatWrap, { top: -insets.top }]} pointerEvents="box-none">
        {/* подложка: стекло на iOS, градиент на Android */}
        {Platform.OS === 'ios' ? (
          <Glass fallback={bg} style={StyleSheet.absoluteFill} />
        ) : (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="hdrFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={bg} stopOpacity={1} />
                <Stop offset="0.72" stopColor={bg} stopOpacity={0.96} />
                <Stop offset="1" stopColor={bg} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#hdrFade)" />
          </Svg>
        )}
        <View style={[styles.row, styles.floatRow, { marginTop: insets.top + 12 }]}>
          <BackBtn />
          {right ? (
            <PressableScale
              small
              accessibilityRole="button"
              accessibilityLabel={right.label}
              style={[styles.btn, { backgroundColor: btnBg }]}
              onPress={right.onPress}
            >
              <Text style={[styles.glyph, { color: fg }]}>{right.glyph}</Text>
            </PressableScale>
          ) : null}
        </View>
      </View>
    );
  }

  function BackBtn() {
    return (
      <PressableScale
        small
        accessibilityRole="button"
        accessibilityLabel={t('common.backAria')}
        style={[styles.btn, { backgroundColor: btnBg }]}
        onPress={back}
      >
        <BackIcon size={20} color={fg} />
      </PressableScale>
    );
  }

  return (
    <View style={styles.row}>
      <PressableScale
        small
        accessibilityRole="button"
        accessibilityLabel={t('common.backAria')}
        style={[styles.btn, { backgroundColor: btnBg }]}
        onPress={back}
      >
        <BackIcon size={20} color={fg} />
      </PressableScale>
      {right ? (
        <PressableScale
          small
          accessibilityRole="button"
          accessibilityLabel={right.label}
          style={[styles.btn, { backgroundColor: btnBg }]}
          onPress={right.onPress}
        >
          <Text style={[styles.glyph, { color: fg }]}>{right.glyph}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrap: { position: 'absolute', left: 0, right: 0, zIndex: 40, paddingBottom: 16 },
  floatRow: { paddingHorizontal: 0, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  btn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 19, fontFamily: font.bold },
});
