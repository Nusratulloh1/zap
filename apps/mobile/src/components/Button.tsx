// Пилюля-кнопка из веба: высота 56, radius 999, лайм/чернила/призрак.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { ZapLoader } from '@/components/ZapLoader';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

type Variant = 'lime' | 'ink' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** палитра брендового экрана (лайм-фулблид), если он не следует теме */
  fixed?: boolean;
}

export function Button({ title, onPress, variant = 'lime', disabled, loading, fixed }: Props) {
  const theme = useTheme();
  const c = fixed ? theme.fixed : theme.colors;

  const bg = variant === 'lime' ? c.lime : variant === 'ink' ? c.ink : 'transparent';
  const fg = variant === 'lime' ? c.onLime : variant === 'ink' ? c.paper : c.ink;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: bg, opacity: disabled ? 0.35 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: c.sand2 },
      ]}
    >
      <View style={styles.row}>
        {loading ? <ZapLoader size="xs" /> : <Text style={[styles.label, { color: fg }]}>{title}</Text>}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { height: 56, borderRadius: 999, justifyContent: 'center', paddingHorizontal: 28 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontFamily: font.extrabold, fontSize: 16 },
});
