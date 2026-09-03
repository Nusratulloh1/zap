// Аналитика расходов в истории (редизайн): чернильная карточка с расходом и
// тремя цифрами, разбивка «на что уходит» и «с кем тратишь».
//
// Всё считается из /bootstrap (lib/spending.ts). Период переключается неделя /
// месяц — как в макете.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Podium } from '@/components/Podium';
import { PressableScale } from '@/components/PressableScale';
import { byCategory, byPerson, daily, spendSummary, topPlace } from '@/lib/spending';
import { money } from '@/lib/format';
import { useHomeData } from '@/store/bootstrap';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** Цвета сегментов бублика — из макета: чернила, лайм и три оттенка песка. */
const SLICE_COLORS = ['#121212', '#D9FF3A', '#8E8C86', '#C9C6BB', '#E1DED4'];

export function SpendingBlock() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const home = useHomeData();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  // выбранный столбик — показываем его сумму над графиком
  const [picked, setPicked] = useState<number | null>(null);
  const monthLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: 'long' }),
    [],
  );

  const sum = useMemo(() => spendSummary(home.db, period), [home.db, period]);
  const cats = useMemo(() => byCategory(home.db, period), [home.db, period]);
  const people = useMemo(() => byPerson(home.db, period), [home.db, period]);
  const place = useMemo(() => topPlace(home.db, period), [home.db, period]);
  const days = useMemo(() => daily(home.db), [home.db]);
  const maxDay = useMemo(() => Math.max(...days.map((d) => d.amount), 1), [days]);

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
                style={[
                  styles.period,
                  { backgroundColor: period === p ? fixed.lime : 'rgba(255,255,255,0.1)' },
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodText, { color: period === p ? '#121212' : '#FFFFFF' }]}>
                  {t(`history.period.${p}`)}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{money(sum.spent)}</Text>
          <Text style={styles.amountUnit}>{t('common.currency')}</Text>
        </View>
        <View style={styles.deltaRow}>
          {sum.deltaPct !== null ? (
            <View style={[styles.deltaChip, { backgroundColor: 'rgba(217,255,58,0.15)' }]}>
              <Text style={[styles.deltaText, { color: fixed.lime }]}>
                {sum.deltaPct > 0 ? '+' : ''}{sum.deltaPct}%
              </Text>
            </View>
          ) : null}
          <Text style={styles.sub} numberOfLines={1}>
            {t('history.spentSub', { splits: sum.splits, groups: sum.groups })}
          </Text>
        </View>

        {/*
          Столбики за неделю. Тап по столбику показывает сумму этого дня —
          иначе график только «настроение», а цифру за вторник не узнать.
        */}
        {picked !== null && days[picked] ? (
          <View style={styles.tipRow}>
            <View style={[styles.tip, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Text style={styles.tipText}>
                {days[picked]!.label} · {money(days[picked]!.amount)}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.chart}>
          {days.map((d, i) => (
            <PressableScale
              key={i}
              haptic={false}
              style={styles.barTap}
              onPress={() => setPicked(picked === i ? null : i)}
            >
              <View
                style={[
                  styles.bar2,
                  {
                    height: Math.max(8, (d.amount / Math.max(1, maxDay)) * 96),
                    backgroundColor: d.today || picked === i ? fixed.lime : 'rgba(255,255,255,0.18)',
                  },
                ]}
              />
            </PressableScale>
          ))}
        </View>
        <View style={styles.chartLabels}>
          {days.map((d, i) => (
            <Text
              key={i}
              style={[styles.chartLabel, d.today && { color: fixed.lime, fontFamily: font.monoBold }]}
            >
              {d.label}
            </Text>
          ))}
        </View>

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
        <View style={[styles.whiteCard, { backgroundColor: colors.paper }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('history.whereGoes')}</Text>
            <Text style={[styles.cardSub, { color: colors.faint2 }]}>{monthLabel}</Text>
          </View>

          {/*
            Бублик как в макете: сегменты — dasharray по долям, в центре доля
            крупнейшей категории. Радиус 15.9155 даёт длину окружности 100,
            поэтому проценты кладутся в dasharray без пересчёта.
          */}
          <View style={styles.donutWrap}>
            <Svg width={180} height={180} viewBox="0 0 42 42" style={styles.donut}>
              {cats.slice(0, 5).map((c, i) => {
                const offset = -cats.slice(0, i).reduce((a, x) => a + x.share, 0) + 25;
                return (
                  <SvgCircle
                    key={c.key}
                    cx={21}
                    cy={21}
                    r={15.9155}
                    fill="none"
                    stroke={SLICE_COLORS[i]}
                    strokeWidth={7}
                    strokeDasharray={`${c.share} ${100 - c.share}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </Svg>
            {/* эмодзи категорий по окружности — ориентир без легенды */}
            {cats.slice(0, 5).map((c, i) => {
              const before = cats.slice(0, i).reduce((a, x) => a + x.share, 0);
              const angle = ((before + c.share / 2) / 100) * 2 * Math.PI - Math.PI / 2;
              return (
                <Text
                  key={`g-${c.key}`}
                  style={[
                    styles.donutGlyph,
                    { left: 90 + Math.cos(angle) * 66 - 10, top: 90 + Math.sin(angle) * 66 - 10 },
                  ]}
                >
                  {c.glyph}
                </Text>
              );
            })}
            <View style={styles.donutCenter} pointerEvents="none">
              <Text style={[styles.donutPct, { color: colors.ink }]}>{cats[0]?.share ?? 0}%</Text>
              <Text style={[styles.donutName, { color: colors.faint2 }]}>
                {cats[0] ? t(`category.${cats[0].key}`).toLowerCase() : ''}
              </Text>
            </View>
          </View>

          <View style={styles.legend}>
            {cats.slice(0, 5).map((c, i) => (
              <View key={c.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: SLICE_COLORS[i] }]} />
                <Text style={[styles.legendName, { color: colors.ink }]} numberOfLines={1}>
                  {c.glyph} {t(`category.${c.key}`)}
                </Text>
                <Text style={[styles.legendAmount, { color: colors.ink }]} numberOfLines={1}>{money(c.amount)}</Text>
                <Text style={[styles.legendShare, { color: colors.faint2 }]}>{c.share}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {people.length ? (
        <View style={[styles.whiteCard, { backgroundColor: colors.paper, borderRadius: 24 }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle2, { color: colors.ink }]}>{t('history.withWhom')}</Text>
            <Text style={[styles.cardSub, { color: colors.faint2 }]}>{t('history.sharedSplits')}</Text>
          </View>

          <Podium
            frame={colors.paper}
            items={people.slice(0, 3).map((p) => {
              const c = home.contactById(p.contactId);
              return {
                key: p.contactId,
                contactId: p.contactId,
                name: (c?.name ?? '?').split(' ')[0] ?? '?',
                color: c?.color,
                initials: c?.initials,
                amount: p.amount,
                sub: t('debts.splitsCount', { n: p.splits }),
              };
            })}
          />

          {place ? (
            <View style={[styles.placeRow, { borderTopColor: colors.dune2 }]}>
              <Text style={[styles.placeText, { color: colors.faint2 }]} numberOfLines={1}>
                {t('history.topPlaceLead')}
              </Text>
              <Text style={[styles.placeValue, { color: colors.ink }]} numberOfLines={1}>
                {place.name} ×{place.times}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16, marginTop: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96, marginTop: 20 },
  bar2: { borderRadius: 8 },
  chartLabels: { flexDirection: 'row', marginTop: 8 },
  chartLabel: { flex: 1, textAlign: 'center', fontFamily: font.mono, fontSize: 8, color: 'rgba(255,255,255,0.4)' },
  whiteCard: { borderRadius: 28, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, marginTop: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: font.extrabold, fontSize: 18, letterSpacing: -0.4 },
  cardTitle2: { fontFamily: font.extrabold, fontSize: 16, letterSpacing: -0.3 },
  cardSub: { fontFamily: font.semibold, fontSize: 10 },
  donutWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 16, height: 180 },
  donut: { transform: [{ rotate: '-90deg' }] },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutPct: { fontFamily: font.extrabold, fontSize: 30 },
  donutName: { fontFamily: font.semibold, fontSize: 11, marginTop: 4 },
  legend: { marginTop: 18, gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
  legendName: { flex: 1, fontFamily: font.bold, fontSize: 13 },
  legendAmount: { fontFamily: font.monoBold, fontSize: 13 },
  legendShare: { width: 40, textAlign: 'right', fontFamily: font.semibold, fontSize: 12 },
  placeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  placeText: { fontFamily: font.semibold, fontSize: 10, flex: 1 },
  placeValue: { fontFamily: font.bold, fontSize: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: font.monoBold, fontSize: 8.5, letterSpacing: 2.4 },
  periods: { flexDirection: 'row', gap: 4 },
  period: { height: 26, paddingHorizontal: 11, borderRadius: 999, justifyContent: 'center' },
  periodText: { fontFamily: font.bold, fontSize: 11.5 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  amount: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -1, color: '#FFFFFF' },
  amountUnit: { fontFamily: font.semibold, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  deltaChip: { borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 },
  deltaText: { fontFamily: font.extrabold, fontSize: 11 },
  tipRow: { alignItems: 'center', marginTop: 12 },
  tip: { borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  tipText: { fontFamily: font.bold, fontSize: 11, color: '#FFFFFF' },
  barTap: { flex: 1, justifyContent: 'flex-end' },
  donutGlyph: { position: 'absolute', fontSize: 16, width: 20, textAlign: 'center' },
  delta: { fontFamily: font.extrabold, fontSize: 14 },
  sub: { flex: 1, fontFamily: font.semibold, fontSize: 11, color: 'rgba(255,255,255,0.55)' },
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
