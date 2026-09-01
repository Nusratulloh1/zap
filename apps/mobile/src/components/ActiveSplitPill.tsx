// Плашка активного сплита над таб-баром — порт ActiveSplitPill.vue:
// круг мерчанта (лого Bellissimo или буква на цвете), «Активный сплит» +
// «ждём … · сумма» справа, лаймовый прогресс-бар 6px.
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { money } from '@/lib/format';
import type { Merchant, Split } from '@zap/shared/types';

interface Props {
  split: Split;
  merchant?: Merchant;
  nameOf: (contactId: string) => string;
  onPress: () => void;
}

export function ActiveSplitPill({ split, merchant, nameOf, onPress }: Props) {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const insets = useSafeAreaInsets();

  const waitingNames = split.members
    .filter((m) => m.status === 'waiting' || m.status === 'opened')
    .map((m) => nameOf(m.contactId))
    .filter(Boolean);
  const remaining = split.members
    .filter((m) => m.status !== 'paid' && m.status !== 'debt')
    .reduce((s, m) => s + m.amount, 0);
  const paid = split.members
    .filter((m) => m.status === 'paid' || m.status === 'debt')
    .reduce((s, m) => s + m.amount, 0);
  const progress = split.total > 0 ? Math.min(1, paid / split.total) : 0;

  const label = waitingNames.length
    ? t('home.waitingFor', { names: waitingNames.join(t('common.and')), amount: money(remaining) })
    : t('home.allPaid');

  // прогресс подъезжает за 500 мс — как transition в вебе
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 500, easing: Easing.bezier(0.32, 0.72, 0, 1) });
  }, [progress, p]);
  const barStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  const isBellissimo = split.merchantId === 'm_bellissimo';

  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      exiting={FadeOutDown.duration(180)}
      // над таб-баром: его высота 62 + отступ 14 + безопасная зона
      style={[styles.wrap, { bottom: insets.bottom + 90 }]}
      pointerEvents="box-none"
    >
      <PressableScale style={[styles.pill, { backgroundColor: fixed.ink }]} onPress={onPress}>
        {isBellissimo ? (
          <Image source={require('../../assets/brand/partners/bellissimo.png')} style={styles.logo} />
        ) : (
          <View style={[styles.logo, { backgroundColor: merchant?.color ?? '#3E3C35', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[styles.logoLetter, { color: fixed.paper }]}>
              {merchant?.letter ?? split.title[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: fixed.paper }]} numberOfLines={1}>
              {t('home.activeSplit')}
            </Text>
            <Text style={[styles.sub, { color: fixed.paper }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.bar, { backgroundColor: fixed.lime }, barStyle]} />
          </View>
        </View>
        <Text style={[styles.chevron, { color: fixed.paper }]}>›</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    maxWidth: 374,
    paddingVertical: 13,
    paddingLeft: 11,
    paddingRight: 18,
    borderRadius: 999,
    shadowColor: '#1E1C10',
    shadowOpacity: 0.35,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  logo: { width: 42, height: 42, borderRadius: 999 },
  logoLetter: { fontFamily: font.extrabold, fontSize: 16 },
  body: { flex: 1, minWidth: 0, gap: 7 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: font.extrabold, fontSize: 14.5 },
  sub: { flexShrink: 1, fontFamily: font.bold, fontSize: 12, opacity: 0.55 },
  track: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999 },
  chevron: { fontFamily: font.semibold, fontSize: 17, opacity: 0.5 },
});
