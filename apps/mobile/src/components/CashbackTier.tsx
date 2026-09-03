// Ступень кэшбэка компании: сколько накопили вместе и сколько до следующего
// процента (макет «НАКОПИЛИ ВМЕСТЕ · 2.5% сейчас · ещё 9 000 до 3%»).
//
// Ставка и порог приходят с сервера (group.rateBp / group.nextTier) — считать
// их на клиенте нельзя: пороги продуктовые и меняются без релиза приложения.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  pool: number;
  rateBp?: number;
  nextTier?: { need: number; bp: number };
}

const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 ? 1 : 0)}%`;

export function CashbackTier({ pool, rateBp, nextTier }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!rateBp) return null;

  const target = nextTier ? pool + nextTier.need : pool;
  const progress = target > 0 ? Math.min(1, pool / target) : 1;

  return (
    <View style={styles.root}>
      <View style={styles.labels}>
        <Text style={[styles.hint, { color: 'rgba(17,17,16,0.6)' }]} numberOfLines={1}>
          {nextTier
            ? t('cashback.tierHint', { rate: pct(rateBp), need: money(nextTier.need), next: pct(nextTier.bp) })
            : t('cashback.tierMax', { rate: pct(rateBp) })}
        </Text>
        <Text style={styles.count}>
          {nextTier ? `${Math.round(pool / 1000)} / ${Math.round(target / 1000)}к` : pct(rateBp)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: 'rgba(17,17,16,0.16)' }]}>
        <View style={[styles.bar, { backgroundColor: colors.ink, width: `${Math.max(4, progress * 100)}%` }]} />
      </View>
      <Text style={[styles.note, { color: 'rgba(17,17,16,0.55)' }]}>{t('cashback.tierNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 14 },
  labels: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  hint: { flex: 1, fontFamily: font.semibold, fontSize: 12 },
  count: { fontFamily: font.extrabold, fontSize: 12, color: '#111110' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999 },
  note: { fontFamily: font.semibold, fontSize: 11, marginTop: 8 },
});
