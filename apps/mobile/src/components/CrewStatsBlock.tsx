// «История компании» на экране группы (vision, часть C §1 и §6).
//
// Не streak и не лидерборд: видение прямо говорит, что для приложения оплаты
// это искусственно. Здесь общая память компании — сколько ужинов и кофе было
// вместе, любимое место, кто сейчас не закрыл долю и кто платил в прошлый раз
// (§C7 — чтобы снять вечное «кто платит?»).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import type { CrewStats } from '@/lib/crewStats';
import type { FunStat } from '@/lib/funStats';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius } from '@/theme/tokens';

/** Эмодзи категории — те же, что в темах заведений. */
const GLYPH: Record<string, string> = {
  food: '🍕',
  coffee: '☕',
  taxi: '🚕',
  shopping: '🛒',
  trip: '✈️',
  gift: '🎁',
};

/** Значок наблюдения (§C11) — тон шуточный, поэтому эмодзи, а не иконки. */
const STAT_GLYPH: Record<FunStat['kind'], string> = {
  fastest: '⚡',
  alwaysLast: '👀',
  biggest: '🍕',
  buddy: '🤝',
  bigWallet: '💸',
  smallWallet: '🪙',
  alwaysBroke: '🫠',
};

interface Props {
  stats: CrewStats;
  /** смешная статистика компании (vision §C11); пустой массив — блока нет */
  fun?: FunStat[];
  nameOf: (contactId: string) => string;
  initialsOf: (contactId: string) => string | undefined;
  colorOf: (contactId: string) => string;
}

export function CrewStatsBlock({ stats, fun = [], nameOf, initialsOf, colorOf }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  if (!stats.zaps) return null;

  return (
    <View style={styles.root}>
      <Text style={[styles.section, { color: colors.muted }]}>{t('crew.stats')}</Text>

      {/* крупные цифры: сколько раз и на сколько */}
      <View style={[styles.card, { backgroundColor: colors.paper }]}>
        <View style={styles.headRow}>
          <Text style={[styles.zaps, { color: colors.ink }]}>{t('crew.zaps', { n: stats.zaps })}</Text>
          <Text style={[styles.total, { color: colors.faint }]}>
            {t('crew.totalSplit', { amount: money(stats.total) })}
          </Text>
        </View>

        {stats.byTheme.length ? (
          <View style={styles.chips}>
            {stats.byTheme.map((th) => (
              <View key={th.key} style={[styles.chip, { backgroundColor: colors.sand }]}>
                <Text style={styles.chipGlyph}>{GLYPH[th.key] ?? '⚡'}</Text>
                <Text style={[styles.chipText, { color: colors.ink }]}>
                  {t(`crew.theme${th.key.charAt(0).toUpperCase()}${th.key.slice(1)}`, { n: th.count })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {stats.favourite ? (
          <View style={styles.favRow}>
            <Text style={[styles.favLabel, { color: colors.muted }]}>{t('crew.favourite')}</Text>
            <Text style={[styles.favName, { color: colors.ink }]} numberOfLines={1}>
              {stats.favourite.name}
            </Text>
          </View>
        ) : null}
      </View>

      {/*
        Смешная статистика (§C11). Не лидерборд и не очки — пара наблюдений
        про компанию: кто платит быстрее всех и кого всегда ждут.
      */}
      {fun.length ? (
        <View style={[styles.card, { backgroundColor: colors.paper }]}>
          {fun.map((s) => (
            <View key={s.kind} style={styles.funRow}>
              <Text style={styles.funGlyph}>{STAT_GLYPH[s.kind]}</Text>
              <Text style={[styles.funText, { color: colors.ink }]} numberOfLines={1}>
                {t(`crew.stat${s.kind.charAt(0).toUpperCase()}${s.kind.slice(1)}`, {
                  name: s.contactId ? nameOf(s.contactId) : '',
                  sec: s.value,
                  n: s.value,
                  amount: money(s.value),
                  place: s.label ?? '',
                })}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* кто сейчас должен — единственная строка, требующая действия */}
      {stats.owing.length ? (
        <View style={[styles.card, { backgroundColor: colors.paper }]}>
          <Text style={[styles.owingLabel, { color: colors.muted }]}>{t('crew.owingNow')}</Text>
          {stats.owing.map((o) => (
            <View key={o.contactId} style={styles.owingRow}>
              <Avatar
                name={nameOf(o.contactId)}
                letter={initialsOf(o.contactId)}
                contactId={o.contactId}
                color={colorOf(o.contactId)}
                size={38}
              />
              <Text style={[styles.owingName, { color: colors.ink }]} numberOfLines={1}>
                {nameOf(o.contactId)}
              </Text>
              <Text style={[styles.owingAmount, { color: colors.ink }]}>{money(o.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* «кто платил в прошлый раз» — снимает вечный спор (vision §C7) */}
      {stats.lastPayer ? (
        <View style={[styles.hint, { backgroundColor: fixed.lime }]}>
          <Text style={[styles.hintText, { color: fixed.ink }]} numberOfLines={1}>
            {t('crew.lastPaid', { name: nameOf(stats.lastPayer) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, marginTop: 18 },
  section: {
    fontFamily: font.extrabold,
    fontSize: 12.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  card: { borderRadius: radius.inner, padding: 16, gap: 12 },
  headRow: { gap: 2 },
  zaps: { fontFamily: font.extrabold, fontSize: 22, letterSpacing: -0.4 },
  total: { fontFamily: font.monoBold, fontSize: 14 },
  funRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  funGlyph: { fontSize: 17, width: 24, textAlign: 'center' },
  funText: { flex: 1, fontFamily: font.semibold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 999 },
  chipGlyph: { fontSize: 14 },
  chipText: { fontFamily: font.bold, fontSize: 13 },
  favRow: { gap: 2 },
  favLabel: { fontFamily: font.semibold, fontSize: 12 },
  favName: { fontFamily: font.bold, fontSize: 16 },

  owingLabel: { fontFamily: font.semibold, fontSize: 12 },
  owingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  owingName: { flex: 1, fontFamily: font.bold, fontSize: 15 },
  owingAmount: { fontFamily: font.monoBold, fontSize: 15 },

  hint: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  hintText: { fontFamily: font.bold, fontSize: 13.5, textAlign: 'center' },
});
