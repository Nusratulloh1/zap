// Значок заведения / компании: цветная плитка с градиентом и бликом.
//
// Голый эмодзи на сером квадрате выглядел дёшево («эмодзи мусор»). Здесь знак
// живёт на фирменной плитке: вертикальный градиент цвета категории, тонкий
// светлый кант сверху и мягкая тень — как иконка приложения, а не смайлик.
import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import { colorForGlyph } from '@/lib/crewEmoji';
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo';

interface Props {
  /** название заведения или сплита — из него берётся знак по умолчанию */
  name: string;
  size?: number;
  /** свой знак (у компании — выбранный пользователем) */
  glyph?: string;
  /** свой цвет плитки */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const m = (v: number) => Math.round(v * (1 - k));
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

export function VenueIcon({ name, size = 46, glyph, color, style }: Props) {
  /*
    У наших партнёров — их собственный знак (Bellissimo, EVOS, Feed Up, Safia,
    Bon!), эмодзи остаётся для всех прочих заведений. Если знак компании выбран
    вручную, он важнее логотипа.
  */
  const logo = glyph ? null : merchantLogo(name);
  if (logo) {
    return (
      <View
        style={[
          styles.root,
          styles.logoTile,
          { width: size, height: size, borderRadius: size * 0.32 },
          style,
        ]}
      >
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>
    );
  }

  const g = glyph ?? merchantGlyph(name);
  const base = color ?? colorForGlyph(g);
  const id = `vi-${base.replace('#', '')}`;
  const radius = size * 0.32;

  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: radius }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={lighten(base, 0.3)} />
            <Stop offset="1" stopColor={darken(base, 0.12)} />
          </LinearGradient>
        </Defs>
        <SvgRect x={0} y={0} width={size} height={size} rx={radius} fill={`url(#${id})`} />
        {/* световая полоса сверху — плитка перестаёт быть плоской заливкой */}
        <SvgRect
          x={size * 0.1}
          y={size * 0.08}
          width={size * 0.8}
          height={size * 0.3}
          rx={size * 0.15}
          fill="#FFFFFF"
          opacity={0.22}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.5 }}>{g}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoTile: { backgroundColor: '#FFFFFF' },
  logo: { width: '78%', height: '78%' },
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#1E1C10',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
