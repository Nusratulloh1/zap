// Смешная статистика компании как игровые ачивки.
//
// Сетка 2×2 без прокрутки (требование руководства: всё должно помещаться в
// экран). Плитка — стикер, значение, подпись; тон ироничный (§C11), это не
// лидерборд.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STICKER } from '@/components/EmptyState';
import type { FunStat } from '@/lib/funStats';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** фирменные стикеры вместо эмодзи — по замечанию руководства */
const ART: Record<FunStat['kind'], keyof typeof STICKER> = {
  fastest: 'paidDone',
  alwaysLast: 'receiptHero',
  biggest: 'themeFood',
  buddy: 'fistBump',
};

interface Props {
  fun: FunStat[];
  nameOf: (contactId: string) => string;
}

export function FunStatCards({ fun, nameOf }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!fun.length) return null;

  /* значение плитки: у «быстрее всех» и «вечно последний» — человек, у
     «самого крупного» — сумма; так подпись читается без второй строки */
  const value = (s: FunStat): string => {
    if (s.kind === 'fastest') return nameOf(s.contactId ?? '') || t('profile.seconds', { n: s.value });
    if (s.kind === 'biggest') return money(s.value);
    if (s.kind === 'buddy') return nameOf(s.contactId ?? '') || '—';
    return nameOf(s.contactId ?? '') || '—';
  };

  return (
    <View style={styles.grid}>
      {fun.map((s) => (
        <View key={s.kind} style={[styles.card, { backgroundColor: colors.shell }]}>
          <Image source={STICKER[ART[s.kind]]} style={styles.art} resizeMode="contain" />
          <View style={styles.body}>
            <Text style={[styles.value, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {value(s)}
            </Text>
            <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
              {t(`crew.card${s.kind.charAt(0).toUpperCase()}${s.kind.slice(1)}`)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  // без тени: крупная мягкая тень выглядела тяжело
  card: { flexGrow: 1, flexBasis: '47%', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 38, height: 34 },
  body: { flex: 1, minWidth: 0 },
  value: { fontFamily: font.extrabold, fontSize: 15, letterSpacing: -0.3 },
  label: { fontFamily: font.semibold, fontSize: 10.5, marginTop: 4, lineHeight: 15 },
});
