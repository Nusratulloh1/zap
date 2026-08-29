// Промо-карусель главной — один в один с HomePage.vue: hero-слайд с
// иллюстрацией + слайды заведений с фото зала. Сегменты сверху, снап по слайду.
import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { font } from '@/theme/tokens';
import { translate, hasKey } from '@/i18n';

const heroImg = require('../../assets/brand/promo-hero.png');

type OfferType = 'cashback' | 'promo' | 'discount';

/** Заведения с иллюстрацией зала — только они идут в баннеры (как в вебе). */
const VENUES: {
  id: string;
  name: string;
  img: number;
  badgeKind: OfferType;
  badgeValue: string;
  type: OfferType;
}[] = [
  { id: 'b_evos', name: 'EVOS', img: require('../../assets/brand/venues/evos.webp'), badgeKind: 'promo', badgeValue: '1+1', type: 'promo' },
  { id: 'b_bellissimo', name: 'Bellissimo Pizza', img: require('../../assets/brand/venues/bellissimo.webp'), badgeKind: 'discount', badgeValue: '10%', type: 'discount' },
  { id: 'b_safia', name: 'Safia café', img: require('../../assets/brand/venues/safia.webp'), badgeKind: 'cashback', badgeValue: '×2', type: 'cashback' },
  { id: 'b_feedup', name: 'Feed Up', img: require('../../assets/brand/venues/feedup.webp'), badgeKind: 'promo', badgeValue: '2+1', type: 'promo' },
  { id: 'b_bon', name: 'Bon!', img: require('../../assets/brand/venues/bon.webp'), badgeKind: 'discount', badgeValue: '20%', type: 'discount' },
];

interface Props {
  /** активная категория-фильтр: слайды заведений фильтруются по типу */
  category: 'all' | OfferType;
  onPress?: () => void;
}

export function PromoCarousel({ category, onPress }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const venues = category === 'all' ? VENUES : VENUES.filter((v) => v.type === category);
  const count = 1 + venues.length;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  return (
    <View>
      {/* сегменты прогресса — как сторис */}
      <View style={styles.segments}>
        {Array.from({ length: count }, (_, i) => (
          <Segment key={i} active={i === index} />
        ))}
      </View>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onMomentumEnd}>
        {/* hero: иллюстрация + заголовок + условия, всё по центру */}
        <Pressable style={{ width }} onPress={onPress}>
          <View style={styles.heroImgWrap}>
            <Image source={heroImg} style={styles.heroImg} resizeMode="contain" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{translate('home.promoHeroTitle')}</Text>
            <Text style={styles.heroTerms}>{translate('home.promoHeroTerms')}</Text>
          </View>
        </Pressable>

        {/* заведения: фото зала + «×2 keshbek EVOS da» + условие */}
        {venues.map((v) => {
          const label = translate(`badge.${v.badgeKind}`, { v: v.badgeValue });
          const termsKey = `offers.${v.id}`;
          return (
            <Pressable key={v.id} style={{ width }} onPress={onPress}>
              <View style={styles.venueImgWrap}>
                <Image source={v.img} style={styles.venueImg} resizeMode="contain" />
              </View>
              <View style={styles.venueText}>
                <Text style={styles.venueTitle} numberOfLines={1}>
                  {translate('home.offerAt', { label, name: v.name })}
                </Text>
                <Text style={styles.venueTerms} numberOfLines={1}>
                  {hasKey(termsKey) ? translate(termsKey) : translate('home.promoText')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Segment({ active }: { active: boolean }) {
  const v = useSharedValue(active ? 1 : 0);
  v.value = withTiming(active ? 1 : 0, { duration: 220 });
  const style = useAnimatedStyle(() => ({
    backgroundColor: v.value > 0.5 ? '#DDFF33' : 'rgba(255,255,255,0.22)',
  }));
  return <Animated.View style={[styles.segment, style]} />;
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, marginBottom: 16 },
  segment: { flex: 1, height: 3, borderRadius: 999 },
  heroImgWrap: { marginHorizontal: 24 },
  heroImg: { height: 148, width: '100%', borderRadius: 20 },
  heroText: { alignItems: 'center', gap: 6, paddingHorizontal: 16, marginTop: 16 },
  heroTitle: {
    fontFamily: font.extrabold,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroTerms: { fontFamily: font.semibold, fontSize: 14.5, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  venueImgWrap: { paddingHorizontal: 8, paddingTop: 4 },
  venueImg: { height: 218, width: '100%' },
  venueText: { alignItems: 'center', gap: 4, paddingHorizontal: 12, marginTop: 12 },
  venueTitle: { fontFamily: font.extrabold, fontSize: 20, letterSpacing: -0.2, color: '#FFFFFF', textAlign: 'center' },
  venueTerms: { fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
