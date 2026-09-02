// Смешная статистика компании как ИГРОВЫЕ ачивки (замечание руководства:
// строчки списком читались как мелочь — нужны крупные карточки, как в играх).
//
// Горизонтальная лента крупных карточек: большая эмодзи-монета, жирное
// значение, подпись. Тон остаётся ироничным (§C11) — это не лидерборд.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FunStat } from '@/lib/funStats';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { SCREEN_PAD_X } from '@/theme/tokens';

const GLYPH: Record<FunStat['kind'], string> = {
  fastest: '⚡',
  alwaysLast: '👀',
  biggest: '🍕',
  buddy: '🤝',
};

interface Props {
  fun: FunStat[];
  nameOf: (contactId: string) => string;
}

export function FunStatCards({ fun, nameOf }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  if (!fun.length) return null;

  const value = (s: FunStat): string => {
    if (s.kind === 'fastest') return t('profile.seconds', { n: s.value });
    if (s.kind === 'biggest') return money(s.value);
    return nameOf(s.contactId ?? '') || '—';
  };
  const sub = (s: FunStat): string => {
    if (s.kind === 'fastest') return nameOf(s.contactId ?? '');
    if (s.kind === 'biggest') return s.label ?? '';
    if (s.kind === 'buddy') return t('crew.cardTogether', { n: s.value });
    return '';
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripBody}
    >
      {fun.map((s) => (
        <View key={s.kind} style={[styles.card, { backgroundColor: colors.paper }]}>
          <View style={[styles.coin, { backgroundColor: fixed.lime }]}>
            <Text style={styles.coinGlyph}>{GLYPH[s.kind]}</Text>
          </View>
          <Text style={[styles.value, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {value(s)}
          </Text>
          <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
            {t(`crew.card${s.kind.charAt(0).toUpperCase()}${s.kind.slice(1)}`)}
          </Text>
          {sub(s) ? (
            <Text style={[styles.sub, { color: colors.faint }]} numberOfLines={1}>{sub(s)}</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: -SCREEN_PAD_X, marginTop: 18 },
  stripBody: { paddingHorizontal: SCREEN_PAD_X, gap: 10, paddingVertical: 8 },
  card: {
    width: 168,
    borderRadius: 22,
    padding: 14,
    shadowColor: '#1E1C10',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  coin: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  coinGlyph: { fontSize: 26 },
  value: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.3 },
  sub: { fontFamily: font.semibold, fontSize: 11, marginTop: 1 },
  label: { fontFamily: font.semibold, fontSize: 11.5, marginTop: 4, lineHeight: 15 },
});
