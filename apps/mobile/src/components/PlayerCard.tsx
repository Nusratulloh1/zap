// Карточка игрока — шапка профиля (vision V2 §C1, слой Duolingo).
//
// Профиль был «просто аккаунт»: аватар, имя, телефон. Здесь он читается как
// профиль в игре — ранг, полоса опыта до следующего ранга и три показателя
// одной строкой. Светлая: тёмную шапку руководство отклонило.
//
// Ранг считается от числа сплитов: это единственная метрика, которая растёт
// от использования продукта и не зависит от денег.
import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

/** пороги рангов: индекс = уровень, значение = сплитов для входа */
const RANKS = [0, 5, 15, 30, 60, 120] as const;

export function rankOf(splits: number): { level: number; from: number; next: number | null } {
  let level = 0;
  for (let i = 0; i < RANKS.length; i++) if (splits >= RANKS[i]!) level = i;
  return { level, from: RANKS[level]!, next: RANKS[level + 1] ?? null };
}

interface Props {
  avatar: ImageSourcePropType | null;
  initials: string;
  name: string;
  handle: string;
  /** «в ZAP! с августа» — короткой строкой под ником */
  since: string;
  splits: number;
  cashback: string;
  groups: number;
  onAvatarPress: () => void;
}

export function PlayerCard({ avatar, initials, name, handle, since, splits, cashback, groups, onAvatarPress }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const { level, from, next } = rankOf(splits);
  const progress = next ? Math.min(1, (splits - from) / (next - from)) : 1;

  return (
    // spec/16 (Screen 3): без карточки-подложки, аватар 98 между колонками
    <Animated.View entering={FadeIn.duration(260)} style={styles.card}>
      {/*
        Аватар по центру, показатели по бокам — как в присланном образце
        игрового профиля: слева уровень, справа число сплитов.
      */}
      <View style={styles.top}>
        <View style={styles.side}>
          <Stat label={t('profile.level')} value={`✦ ${level + 1}`} />
          <Stat label={t('profile.statSplitsUnit')} value={String(splits)} />
        </View>

        <PressableScale haptic={false} onPress={onAvatarPress}>
          <View style={[styles.avatarWrap, { borderColor: fixed.lime }]}>
            {avatar ? (
              <Image source={avatar} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.ink }]}>
                <Text style={[styles.fallbackText, { color: fixed.lime }]}>{initials}</Text>
              </View>
            )}
            {/* уровень — как шеврон на аватаре в играх */}
            <View style={[styles.levelBadge, { backgroundColor: colors.ink, borderColor: colors.shell }]}>
              <Text style={[styles.levelText, { color: fixed.lime }]}>{level + 1}</Text>
            </View>
            <View style={[styles.editDot, { backgroundColor: fixed.lime, borderColor: colors.shell }]}>
              <Text style={styles.editGlyph}>✎</Text>
            </View>
          </View>
        </PressableScale>

        <View style={[styles.side, styles.sideRight]}>
          <Stat label={t('profile.statGroupsUnit')} value={String(groups)} align="right" />
          <Stat label={t('profile.statCashbackUnit')} value={cashback} align="right" />
        </View>
      </View>

      <View style={styles.who}>
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.handle, { color: colors.muted }]} numberOfLines={1}>
          {handle} · {since}
        </Text>
        <View style={[styles.rankChip, { backgroundColor: fixed.lime }]}>
          <Text style={styles.rankText} numberOfLines={1}>{t(`profile.rank${level}`)}</Text>
        </View>
      </View>

      {/* полоса опыта до следующего ранга */}
      <View style={styles.xpBlock}>
        <View style={styles.xpLabels}>
          <Text style={[styles.xpText, { color: colors.muted }]}>
            {next ? t('profile.toNextRank', { n: next - splits, rank: t(`profile.rank${level + 1}`) }) : t('profile.maxRank')}
          </Text>
          <Text style={[styles.xpCount, { color: colors.ink }]}>{next ? `${splits}/${next}` : `${splits}`}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: 'rgba(18,18,18,0.12)' }]}>
          <View style={[styles.bar, { backgroundColor: colors.ink, width: `${Math.max(6, progress * 100)}%` }]} />
        </View>
      </View>

    </Animated.View>
  );
}

/** Показатель у края карточки: подпись мелким моно, значение жирным. */
function Stat({ label, value, align }: { label: string; value: string; align?: 'right' }) {
  const { colors } = useTheme();
  const side = align === 'right' ? ({ textAlign: 'right' } as const) : undefined;
  return (
    <View style={styles.stat}>
      <Text style={[styles.sideLabel, { color: colors.faint2 }, side]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.sideValue, { color: colors.ink }, side]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 4, paddingTop: 8, marginTop: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { flex: 1, gap: 14 },
  sideRight: { alignItems: 'flex-end' },
  stat: { alignSelf: 'stretch' },
  sideLabel: { fontFamily: font.monoBold, fontSize: 7, letterSpacing: 2, textTransform: 'uppercase' },
  sideValue: { fontFamily: font.bold, fontSize: 18, marginTop: 4 },
  avatarWrap: { width: 98, height: 98, borderRadius: 999 },
  avatar: { width: '100%', height: '100%', borderRadius: 999 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontFamily: font.extrabold, fontSize: 34 },
  levelBadge: {
    position: 'absolute',
    left: -4,
    bottom: -2,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { fontFamily: font.extrabold, fontSize: 13 },
  editDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGlyph: { fontSize: 12, color: '#121212' },
  who: { alignItems: 'center', marginTop: 14 },
  name: { fontFamily: font.extrabold, fontSize: 21 },
  handle: { fontFamily: font.semibold, fontSize: 12, marginTop: 4 },
  rankChip: { alignSelf: 'center', marginTop: 8, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 12 },
  rankText: { fontFamily: font.bold, fontSize: 11 },
  xpBlock: { marginTop: 20 },
  xpLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
  xpText: { fontFamily: font.semibold, fontSize: 10, flex: 1, marginRight: 8 },
  xpCount: { fontFamily: font.bold, fontSize: 10 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
});
