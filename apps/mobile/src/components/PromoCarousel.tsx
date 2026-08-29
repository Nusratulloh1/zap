// Промо-карусель главной: слайды с инерцией и примагничиванием + сегменты
// сверху, как в вебе. Индикатор двигается за скроллом, а не переключается
// скачком — значение прогресса живёт на UI-потоке.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius } from '@/theme/tokens';
import type { Merchant } from '@zap/shared/types';

export interface PromoSlide {
  key: string;
  kind: 'hero' | 'offer';
  title: string;
  subtitle: string;
  /** плашка «×2» / «10%» у предложения заведения */
  badge?: string;
  color: string;
  letter: string;
}

/** Слайды: сначала общий промо-герой, дальше предложения заведений. */
export function buildSlides(
  merchants: Merchant[],
  t: (k: string, p?: Record<string, unknown>) => string,
): PromoSlide[] {
  const hero: PromoSlide = {
    key: 'hero',
    kind: 'hero',
    title: t('home.promoHeroTitle'),
    subtitle: t('home.promoHeroTerms'),
    color: '#DDFF33',
    letter: '★',
  };
  const offers = merchants
    .filter((m) => m.offer)
    .slice(0, 4)
    .map<PromoSlide>((m) => ({
      key: m.id,
      kind: 'offer',
      title: t('home.offerAt', { label: m.offer!.label, name: m.name }),
      subtitle: m.offer!.terms,
      badge: m.offer!.label,
      color: m.color,
      letter: m.letter,
    }));
  return [hero, ...offers];
}

export function PromoCarousel({ slides, onPress }: { slides: PromoSlide[]; onPress?: (s: PromoSlide) => void }) {
  const { width } = useWindowDimensions();
  const { colors, fixed } = useTheme();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // ширина слайда = ширина экрана минус поля; следующий слайд чуть выглядывает
  const H_PAD = 20;
  const slideW = width - H_PAD * 2;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / slideW));
    },
    [slideW],
  );

  const segments = useMemo(() => slides.map((s, i) => ({ key: s.key, active: i === index })), [slides, index]);

  if (!slides.length) return null;

  return (
    <View>
      <View style={[styles.segments, { paddingHorizontal: H_PAD }]}>
        {segments.map((s) => (
          <Segment key={s.key} active={s.active} color={fixed.lime} dim={'rgba(255,255,255,0.22)'} />
        ))}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={slideW}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingHorizontal: H_PAD }}
      >
        {slides.map((s) => (
          <PressableScale
            key={s.key}
            style={[styles.slide, { width: slideW }]}
            onPress={() => onPress?.(s)}
            accessibilityRole="button"
          >
            <View style={[styles.card, { backgroundColor: s.kind === 'hero' ? fixed.lime : colors.paper }]}>
              <View style={styles.cardHead}>
                <View style={[styles.logo, { backgroundColor: s.color }]}>
                  <Text style={styles.logoLetter}>{s.letter}</Text>
                </View>
                {s.badge ? (
                  <View style={[styles.badge, { backgroundColor: s.kind === 'hero' ? '#111110' : fixed.lime }]}>
                    <Text style={[styles.badgeText, { color: s.kind === 'hero' ? fixed.lime : '#111110' }]}>{s.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.title, { color: s.kind === 'hero' ? '#111110' : colors.ink }]}
                numberOfLines={2}
              >
                {s.title}
              </Text>
              <Text
                style={[styles.subtitle, { color: s.kind === 'hero' ? 'rgba(17,17,16,0.62)' : colors.muted }]}
                numberOfLines={2}
              >
                {s.subtitle}
              </Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
      <Text style={[styles.srOnly]} accessibilityElementsHidden importantForAccessibility="no">
        {t('home.promoTitle')}
      </Text>
    </View>
  );
}

function Segment({ active, color, dim }: { active: boolean; color: string; dim: string }) {
  const v = useSharedValue(active ? 1 : 0);
  v.value = withTiming(active ? 1 : 0, { duration: 220 });
  const style = useAnimatedStyle(() => ({
    backgroundColor: v.value > 0.5 ? color : dim,
    opacity: 0.45 + v.value * 0.55,
  }));
  return <Animated.View style={[styles.segment, style]} />;
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  segment: { flex: 1, height: 3, borderRadius: 999 },
  slide: { paddingRight: 12 },
  card: { borderRadius: radius.card, padding: 18, minHeight: 168, justifyContent: 'space-between' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 18, color: '#FFFFFF' },
  badge: { paddingHorizontal: 12, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: font.extrabold, fontSize: 13 },
  title: { fontFamily: font.extrabold, fontSize: 21, letterSpacing: -0.4, lineHeight: 25, marginTop: 14 },
  subtitle: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, marginTop: 6 },
  srOnly: { height: 0, opacity: 0 },
});
