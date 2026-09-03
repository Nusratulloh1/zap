// Плашка активного сплита над таб-баром — устроена как строка в «Zaps»
// (требование руководства): лица участников, название заведения, сумма
// справа. Служебная надпись «Активный сплит» убрана — понятно и без неё.
// Под строкой — лаймовый прогресс-бар оплаты.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { VenueIcon } from '@/components/VenueIcon';
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
    ? t('home.waitingNames', { names: waitingNames.join(t('common.and')) })
    : t('home.allPaid');

  // прогресс подъезжает за 500 мс — как transition в вебе
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 500, easing: Easing.bezier(0.32, 0.72, 0, 1) });
  }, [progress, p]);
  const barStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));


  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      exiting={FadeOutDown.duration(180)}
      // над таб-баром, но ближе к нему — по замечанию, плашка висела высоко
      style={[styles.wrap, { bottom: insets.bottom + 74 }]}
      pointerEvents="box-none"
    >
      <PressableScale style={[styles.pill, { backgroundColor: fixed.ink }]} onPress={onPress}>
        <VenueIcon name={merchant?.name ?? split.title} size={42} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: fixed.paper }]} numberOfLines={1}>
            {merchant?.name ?? split.title}
          </Text>
          <Text style={[styles.sub, { color: fixed.paper }]} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.track}>
            <Animated.View style={[styles.bar, { backgroundColor: fixed.lime }, barStyle]} />
          </View>
        </View>
        <Text style={[styles.amount, { color: fixed.paper }]} numberOfLines={1}>
          {money(remaining)}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // отступы как у карточек листа (16) — плашка стоит ровно по их оси
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'center',
    width: '100%',
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
  logo: { width: 42, height: 42, borderRadius: 999, borderWidth: 2, borderColor: '#D9FF3A' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 16 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: font.extrabold, fontSize: 14.5 },
  amount: { fontFamily: font.extrabold, fontSize: 14.5 },
  sub: { fontFamily: font.bold, fontSize: 11.5, opacity: 0.55 },
  track: { height: 5, borderRadius: 999, marginTop: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999 },
  chevron: { fontFamily: font.semibold, fontSize: 17, opacity: 0.5 },
  sticker: {
    position: 'absolute',
    right: 44,
    top: -18,
    width: 52,
    height: 44,
    transform: [{ rotate: '-10deg' }],
    zIndex: 1,
  },
});
