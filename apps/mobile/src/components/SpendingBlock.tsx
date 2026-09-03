// Аналитика расходов в истории (редизайн): чернильная карточка с расходом и
// тремя цифрами, разбивка «на что уходит» и «с кем тратишь».
//
// Всё считается из /bootstrap (lib/spending.ts). Период переключается неделя /
// месяц — как в макете.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { byCategory, byPerson, spendSummary, topPlace } from '@/lib/spending';
import { money } from '@/lib/format';
import { useHomeData } from '@/store/bootstrap';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function SpendingBlock() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const home = useHomeData();
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  const sum = useMemo(() => spendSummary(home.db, period), [home.db, period]);
  const cats = useMemo(() => byCategory(home.db, period), [home.db, period]);
  const people = useMemo(() => byPerson(home.db, period), [home.db, period]);
  const place = useMemo(() => topPlace(home.db, period), [home.db, period]);

  // пока нечего показывать — блок не занимает экран прочерками
  if (!sum.splits) return null;

  return (
    <View>
      <View style={[styles.card, { backgroundColor: fixed.ink }]}>
        <View style={styles.head}>
          <Text style={[styles.kicker, { color: fixed.lime }]}>{t('history.spent')}</Text>
          <View style={styles.periods}>
            {(['week', 'month'] as const).map((p) => (
              <PressableScale
                key={p}
                haptic={false}
                style={[styles.period, period === p && { backgroundColor: 'rgba(255,255,255,0.12)' }]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodText, { color: period === p ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }]}>
                  {t(`history.period.${p}`)}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{money(sum.spent)}</Text>
          {sum.deltaPct !== null ? (
            <Text style={[styles.delta, { color: sum.deltaPct <= 0 ? fixed.lime : '#FF8A6B' }]}>
              {sum.deltaPct > 0 ? '+' : ''}{sum.deltaPct}%
            </Text>
          ) : null}
        </View>
        <Text style={styles.sub}>
          {t('history.spentSub', { splits: sum.splits, groups: sum.groups })}
        </Text>

        <View style={styles.metrics}>
          {[
            { l: t('history.mCashback'), v: `+${money(sum.cashback)}`, lime: true },
            { l: t('history.mReturned'), v: `+${money(sum.returned)}` },
            { l: t('history.mAvg'), v: money(sum.avgBill) },
          ].map((m) => (
            <View key={m.l} style={styles.metric}>
              <Text style={styles.metricLabel}>{m.l}</Text>
              <Text style={[styles.metricValue, m.lime && { color: fixed.lime }]} numberOfLines={1} adjustsFontSizeToFit>
                {m.v}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {cats.length ? (
        <>
          <Text style={[styles.section, { color: colors.ink }]}>{t('history.whereGoes')}</Text>
          <View style={styles.bars}>
            {cats.map((c) => (
              <View key={c.key} style={styles.catRow}>
                <Text style={styles.catGlyph}>{c.glyph}</Text>
                <View style={styles.catBody}>
                  <View style={styles.catLine}>
                    <Text style={[styles.catName, { color: colors.ink }]}>{t(`category.${c.key}`)}</Text>
                    <Text style={[styles.catAmount, { color: colors.ink }]}>{money(c.amount)}</Text>
                  </View>
                  <View style={[styles.catTrack, { backgroundColor: colors.sand }]}>
                    <View style={[styles.catFill, { backgroundColor: fixed.lime, width: `${Math.max(3, c.share)}%` }]} />
                  </View>
                </View>
                <Text style={[styles.catShare, { color: colors.faint }]}>{c.share}%</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {people.length ? (
        <>
          <Text style={[styles.section, { color: colors.ink }]}>{t('history.withWhom')}</Text>
          <View style={[styles.peopleCard, { backgroundColor: colors.shell }]}>
            {people.map((p) => {
              const c = home.contactById(p.contactId);
              return (
                <View key={p.contactId} style={styles.personRow}>
                  <Avatar contactId={p.contactId} name={c?.name} color={c?.color ?? '#8A887E'} size={38} />
                  <View style={styles.personBody}>
                    <Text style={[styles.personName, { color: colors.ink }]} numberOfLines={1}>{c?.name ?? '?'}</Text>
                    <Text style={[styles.personSub, { color: colors.faint }]}>
                      {t('debts.splitsCount', { n: p.splits })}
                    </Text>
                  </View>
                  <Text style={[styles.personAmount, { color: colors.ink }]} numberOfLines={1}>{money(p.amount)}</Text>
                </View>
              );
            })}
            {place ? (
              <Text style={[styles.place, { color: colors.muted }]} numberOfLines={1}>
                {t('history.topPlace', { name: place.name, n: place.times })}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, marginTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: font.monoBold, fontSize: 8.5, letterSpacing: 2.4 },
  periods: { flexDirection: 'row', gap: 4 },
  period: { height: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  periodText: { fontFamily: font.bold, fontSize: 11.5 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  amount: { fontFamily: font.extrabold, fontSize: 34, letterSpacing: -1, color: '#FFFFFF' },
  delta: { fontFamily: font.extrabold, fontSize: 14 },
  sub: { fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metric: { flex: 1 },
  metricLabel: { fontFamily: font.monoBold, fontSize: 7.5, letterSpacing: 1.8, color: 'rgba(255,255,255,0.45)' },
  metricValue: { fontFamily: font.extrabold, fontSize: 15.5, color: '#FFFFFF', marginTop: 4 },
  section: { fontFamily: font.extrabold, fontSize: 18, letterSpacing: -0.3, marginTop: 24 },
  bars: { marginTop: 12, gap: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catGlyph: { fontSize: 20, width: 26, textAlign: 'center' },
  catBody: { flex: 1, minWidth: 0 },
  catLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 5 },
  catName: { fontFamily: font.bold, fontSize: 13.5 },
  catAmount: { fontFamily: font.extrabold, fontSize: 13.5 },
  catTrack: { height: 7, borderRadius: 999, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 999 },
  catShare: { fontFamily: font.extrabold, fontSize: 11.5, width: 34, textAlign: 'right' },
  peopleCard: { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 6, marginTop: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  personBody: { flex: 1, minWidth: 0 },
  personName: { fontFamily: font.bold, fontSize: 14.5 },
  personSub: { fontFamily: font.semibold, fontSize: 11 },
  personAmount: { fontFamily: font.extrabold, fontSize: 14.5 },
  place: { fontFamily: font.semibold, fontSize: 12, paddingVertical: 10 },
});
