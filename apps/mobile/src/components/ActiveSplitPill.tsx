// Пилюля активного сплита над таб-баром: «ждём Али и Бека · 240 000».
// Появляется выездом снизу, чтобы не мигать при первом рендере списка.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { money } from '@/lib/format';
import type { Split } from '@zap/shared/types';

interface Props {
  split: Split;
  nameOf: (contactId: string) => string;
  onPress: () => void;
}

export function ActiveSplitPill({ split, nameOf, onPress }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();

  const waiting = split.members.filter((m) => !m.isYou && m.status !== 'paid');
  const left = waiting.reduce((sum, m) => sum + m.amount, 0);
  const names = waiting.map((m) => nameOf(m.contactId)).filter(Boolean);

  const label = names.length
    ? t('home.waitingFor', { names: names.slice(0, 2).join(t('common.and')), amount: money(left) })
    : t('home.allPaid');

  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      exiting={FadeOutDown.duration(180)}
      // над таб-баром: его высота 62 + отступ 14 + безопасная зона
      style={[styles.wrap, { bottom: insets.bottom + 90 }]}
      pointerEvents="box-none"
    >
      <PressableScale style={[styles.pill, { backgroundColor: colors.ink }]} onPress={onPress}>
        <View style={[styles.dot, { backgroundColor: fixed.lime }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.cream }]} numberOfLines={1}>
            {t('home.activeSplit')}
          </Text>
          <Text style={[styles.sub, { color: colors.mist }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.cream }]}>›</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 58,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  dot: { width: 9, height: 9, borderRadius: 999 },
  title: { fontFamily: font.extrabold, fontSize: 13.5 },
  sub: { fontFamily: font.semibold, fontSize: 12, marginTop: 1 },
  chevron: { fontFamily: font.extrabold, fontSize: 20, marginTop: -2 },
});
