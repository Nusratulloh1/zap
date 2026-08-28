// Флаги без SVG: react-native-svg в проекте нет, а тащить нативную зависимость
// ради трёх иконок незачем. Полосы и кресты собираются обычными View —
// на 26px читается не хуже растра и не зависит от системных эмодзи.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Locale } from '@/i18n';

type Props = { locale: Locale; size?: number };

export function FlagIcon({ locale, size = 26 }: Props) {
  const w = size;
  const h = (size / 3) * 2;
  const box = [styles.box, { width: w, height: h, borderRadius: Math.max(3, size * 0.12) }];

  if (locale === 'ru') {
    return (
      <View style={box}>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
        <View style={{ flex: 1, backgroundColor: '#0039A6' }} />
        <View style={{ flex: 1, backgroundColor: '#D52B1E' }} />
        <View style={styles.hairline} />
      </View>
    );
  }

  if (locale === 'uz') {
    return (
      <View style={box}>
        <View style={{ flex: 1, backgroundColor: '#0099B5' }} />
        <View style={{ height: h * 0.045, backgroundColor: '#CE1126' }} />
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
        <View style={{ height: h * 0.045, backgroundColor: '#CE1126' }} />
        <View style={{ flex: 1, backgroundColor: '#1EB53A' }} />
        {/* полумесяц: белый круг с «вырезом» кругом цвета флага */}
        <View
          style={[
            styles.moon,
            { left: w * 0.1, top: h * 0.1, width: h * 0.28, height: h * 0.28, borderRadius: h * 0.14 },
          ]}
        />
        <View
          style={[
            styles.moon,
            {
              left: w * 0.16,
              top: h * 0.1,
              width: h * 0.28,
              height: h * 0.28,
              borderRadius: h * 0.14,
              backgroundColor: '#0099B5',
            },
          ]}
        />
        <View style={styles.hairline} />
      </View>
    );
  }

  // Union Jack: диагонали — повёрнутые полосы, поверх прямой крест
  const diag = Math.hypot(w, h);
  const angle = `${(Math.atan2(h, w) * 180) / Math.PI}deg`;
  const antiAngle = `-${(Math.atan2(h, w) * 180) / Math.PI}deg`;
  const bar = (color: string, thickness: number, rotate: string) => ({
    position: 'absolute' as const,
    left: (w - diag) / 2,
    top: h / 2 - thickness / 2,
    width: diag,
    height: thickness,
    backgroundColor: color,
    transform: [{ rotate }],
  });

  return (
    <View style={[box, { backgroundColor: '#012169' }]}>
      <View style={bar('#FFFFFF', h * 0.2, antiAngle)} />
      <View style={bar('#FFFFFF', h * 0.2, angle)} />
      <View style={bar('#C8102E', h * 0.11, antiAngle)} />
      <View style={bar('#C8102E', h * 0.11, angle)} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: h * 0.33, height: h * 0.34, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: w * 0.33, width: w * 0.34, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: h * 0.4, height: h * 0.2, backgroundColor: '#C8102E' }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: w * 0.4, width: w * 0.2, backgroundColor: '#C8102E' }} />
      <View style={styles.hairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  moon: { position: 'absolute', backgroundColor: '#FFFFFF' },
  // тонкая рамка, чтобы белая полоса не сливалась со светлым фоном
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
    borderRadius: 3,
  },
});
