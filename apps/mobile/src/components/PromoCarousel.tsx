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
import { VENUES, type OfferType } from '@/lib/venues';

const heroImg = require('../../assets/brand/promo-hero.webp');


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
            {/* перечень брендов — строго в одну строку, кегль подстраивается */}
            <Text style={styles.heroTerms} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {translate('home.promoHeroTerms')}
            </Text>
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
              <View style={styles.heroText}>
                {/* заголовок всегда в одну строку: длинный (Bellissimo)
                    ужимается кеглем, а не переносится */}
                <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
                  {translate('home.offerAt', { label, name: v.name })}
                </Text>
                <Text style={styles.heroTerms}>
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
    backgroundColor: interpolateColor(v.value, [0, 1], ['rgba(255,255,255,0.22)', '#D9FF3A']),
  }));
  return <Animated.View style={[styles.segment, style]} />;
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, marginBottom: 16 },
  segment: { flex: 1, height: 3, borderRadius: 999 },
  heroImgWrap: { marginHorizontal: 24 },
  // Без borderRadius: он остался от прежнего героя-карточки, а нынешний
  // баннер — прозрачный коллаж, и скругление срезало монеты по углам.
  // Высота под пропорцию 1.60:1 при ширине экрана минус поля.
  heroImg: { height: 214, width: '100%' },
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
  /*
    Отступ сверху был 22, и слайды заведений оказывались на 12 pt выше по
    высоте блока, чем герой (214): сверху зияла пустая полоса. Ставим 10 —
    блок ровно 214, как у героя, а небольшой воздух над рисунком остаётся.
  */
  venueImgWrap: { paddingHorizontal: 8, paddingTop: 10 },
  // Все пять баннеров приведены к одной пропорции 1.83:1 (feedup перерисован
  // в кадре остальных, поля добиты прозрачным) — при contain они рисуются
  // одной высотой и без обрезки. 204 ≈ (390−16)/1.83.
  venueImg: { height: 204, width: '100%' },
});
