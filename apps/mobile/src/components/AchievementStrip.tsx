// Ачивки лентой под полосой опыта: горизонтальная прокрутка (руководство
// вернуло ленту после сетки — так видно, что коллекция продолжается).
//
// Медаль — не плоский кружок: лаймовый градиент, чернильный кант, блик сверху
// и звёздочка в углу у открытых; закрытые — пунктирная «пустая ячейка» с
// замком, как невыбитое достижение в игре.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle as SvgCircle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { font, SCREEN_PAD_X } from '@/theme/tokens';

const SIZE = 58;

interface Props {
  /** все ачивки в фиксированном порядке: [ключ, эмодзи] */
  all: readonly (readonly [string, string])[];
  /** ключи открытых */
  unlocked: readonly string[];
}

export function AchievementStrip({ all, unlocked }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const done = all.filter(([k]) => unlocked.includes(k)).length;

  // открытые — первыми: коллекция выглядит собранной, а не дырявой
  const sorted = [...all].sort(
    (a, b) => Number(unlocked.includes(b[0])) - Number(unlocked.includes(a[0])),
  );

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.mono, { color: colors.faint2 }]}>{t('profile.achievements')}</Text>
        <Text style={[styles.count, { color: colors.muted }]}>
          {t('profile.achievementsOf', { done, total: all.length })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripBody}
      >
        {sorted.map(([key, glyph]) => {
          const open = unlocked.includes(key);
          return (
            <View key={key} style={styles.item}>
              <View style={styles.medal}>
                {open ? (
                  <>
                    <Svg width={SIZE} height={SIZE}>
                      <Defs>
                        <RadialGradient id={`g-${key}`} cx="35%" cy="28%" r="78%">
                          <Stop offset="0" stopColor="#F2FF8F" />
                          <Stop offset="0.55" stopColor={fixed.lime} />
                          <Stop offset="1" stopColor="#B9D92B" />
                        </RadialGradient>
                      </Defs>
                      <SvgCircle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={SIZE / 2 - 2}
                        fill={`url(#g-${key})`}
                        stroke={colors.ink}
                        strokeWidth={2.5}
                      />
                      {/* блик — как на металле */}
                      <SvgCircle cx={SIZE * 0.34} cy={SIZE * 0.26} r={SIZE * 0.13} fill="#FFFFFF" opacity={0.42} />
                    </Svg>
                    <Text style={styles.glyph}>{glyph}</Text>
                    <View style={[styles.star, { backgroundColor: colors.ink }]}>
                      <Text style={styles.starGlyph}>★</Text>
                    </View>
                  </>
                ) : (
                  <View style={[styles.locked, { borderColor: colors.sand2, backgroundColor: colors.sand }]}>
                    <Text style={styles.lockGlyph}>🔒</Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.label, { color: open ? colors.ink : colors.faint }]}
                numberOfLines={2}
              >
                {t(`titles.${key}`)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22 },
  mono: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  count: { fontFamily: font.extrabold, fontSize: 12 },
  strip: { marginHorizontal: -SCREEN_PAD_X, marginTop: 12 },
  stripBody: { paddingHorizontal: SCREEN_PAD_X, gap: 12 },
  item: { width: 68, alignItems: 'center' },
  medal: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  glyph: { position: 'absolute', fontSize: 24 },
  locked: {
    width: SIZE,
    height: SIZE,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockGlyph: { fontSize: 18, opacity: 0.45 },
  star: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGlyph: { fontSize: 10, color: '#DDFF33' },
  label: { fontFamily: font.bold, fontSize: 10.5, lineHeight: 13, textAlign: 'center', marginTop: 6 },
});
