// Промо-карусель главной — один в один с HomePage.vue: hero-слайд с
// иллюстрацией + слайды заведений с фото зала. Сегменты сверху, снап по слайду.
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { font } from '@/theme/tokens';
import { EASE_ZAP } from '@/lib/motion';
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
}

export function PromoCarousel({ category }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const venues = category === 'all' ? VENUES : VENUES.filter((v) => v.type === category);
  const count = 1 + venues.length;

  // тап по слайду листает: левые 40%% — назад, остальное — вперёд (как onPromoTap)
  const onTap = (x: number) => {
    const next = x < width * 0.4 ? Math.max(0, index - 1) : Math.min(count - 1, index + 1);
    if (next === index) return;
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

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

      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onMomentumEnd}>
        {/* hero: иллюстрация + заголовок + условия, всё по центру */}
        <Pressable style={{ width }} onPress={(e) => onTap(e.nativeEvent.locationX)}>
          <View style={styles.heroImgWrap}>
            <Image source={heroImg} style={styles.heroImg} resizeMode="contain" fadeDuration={0} />
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
            <Pressable key={v.id} style={{ width }} onPress={(e) => onTap(e.nativeEvent.locationX)}>
              <View style={styles.venueImgWrap}>
                {/*
                  contain и одинаковая пропорция у всех файлов.

                  Баннеры пришли разной ширины (1.6–2.43:1), и при contain
                  каждый упирался в свою сторону кадра: широкий feedup выходил
                  вдвое ниже прочих. cover это выравнивал, но резал рисунок —
                  у feedup уходил край лаваша.

                  Поэтому выравнивание сделано в самих файлах: четырём новым
                  добавлены прозрачные поля по бокам. Не до пропорции feedup —
                  тогда все мельчали до 156 pt, — а до 2.05:1. Они рисуются
                  182 pt против 156 у feedup: разница почти не читается, и
                  ничего не обрезано.

                  Полностью это чинится только перерисовкой feedup в
                  пропорциях остальных четырёх — он единственный 2.4:1, и
                  сложить его в кадр повыше нельзя: рисунок цельный, элементы
                  соприкасаются и по отдельности не переставляются.
                */}
                <Image source={v.img} style={styles.venueImg} resizeMode="contain" fadeDuration={0} />
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
  useEffect(() => {
    v.value = withTiming(active ? 1 : 0, { duration: 300, easing: EASE_ZAP });
  }, [active, v]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], ['rgba(255,255,255,0.22)', '#DDFF33']),
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
  // под самый высокий из баннеров (182 pt) плюс немного воздуха
  venueImg: { height: 188, width: '100%' },
  venueText: { alignItems: 'center', gap: 4, paddingHorizontal: 12, marginTop: 12 },
  venueTitle: { fontFamily: font.extrabold, fontSize: 20, letterSpacing: -0.2, color: '#FFFFFF', textAlign: 'center' },
  venueTerms: { fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
