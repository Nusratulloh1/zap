// Кэшбэк по заведениям — свайп-карточки вверху экрана.
//
// Требование руководства: сверху 2–3 заведения (Bellissimo, EVOS, Feed Up),
// листаются пальцем, минимализм — «супер-эпп для молодых». Первая карточка —
// «все» с общим балансом, дальше по заведению: сколько накопилось именно там.
//
// Прокрутка с привязкой к карточке (snapToInterval), под лентой — точки.
import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CountUp } from '@/components/CountUp';
import type { CashbackEntry } from '@zap/shared/types';
import { money } from '@/lib/format';
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

const GAP = 10;

interface Props {
  entries: CashbackEntry[];
  total: number;
}

export function MerchantCashbackSlider({ entries, total }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  // карточка чуть уже экрана — край следующей виден, и понятно, что листается
  const CARD_W = width - SCREEN_PAD_X * 2 - 34;
  const STEP = CARD_W + GAP;

  const byMerchant = useMemo(() => {
    const acc = new Map<string, { title: string; amount: number; count: number; badge: string }>();
    for (const e of entries) {
      const cur = acc.get(e.title) ?? { title: e.title, amount: 0, count: 0, badge: e.badge };
      cur.amount += e.amount;
      cur.count += 1;
      acc.set(e.title, cur);
    }
    return [...acc.values()].sort((a, b) => b.amount - a.amount).slice(0, 4);
  }, [entries]);

  const onScroll = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(ev.nativeEvent.contentOffset.x / STEP));
  };

  const pages = 1 + byMerchant.length;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={STEP}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.strip}
        contentContainerStyle={styles.stripBody}
      >
        {/* общая — как «все группы», только суммой */}
        <View style={[styles.card, { width: CARD_W, backgroundColor: fixed.lime }]}>
          <Text style={styles.kicker}>{t('cashback.available')}</Text>
          <CountUp value={total} duration={800} style={styles.bigValue} />
          <Text style={styles.cardFoot}>{t('cashback.allPlaces')}</Text>
        </View>

        {byMerchant.map((m) => (
          <View key={m.title} style={[styles.card, { width: CARD_W, backgroundColor: colors.shell }]}>
            <View style={styles.cardHead}>
              {merchantLogo(m.title) ? (
                <Image source={merchantLogo(m.title)!} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoLetter, { backgroundColor: colors.sand }]}>
                  <Text style={styles.logoLetterText}>{merchantGlyph(m.title)}</Text>
                </View>
              )}
              <View style={[styles.pct, { backgroundColor: fixed.lime }]}>
                <Text style={styles.pctText}>{m.badge.split(' · ')[0]}</Text>
              </View>
            </View>
            <Text style={[styles.value, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {money(m.amount)}
            </Text>
            <Text style={[styles.cardFootDim, { color: colors.muted }]} numberOfLines={1}>
              {m.title}
            </Text>
          </View>
        ))}
      </ScrollView>

      {pages > 1 ? (
        <View style={styles.dots}>
          {Array.from({ length: pages }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? colors.ink : colors.sand2 },
                i === page && styles.dotActive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: -SCREEN_PAD_X },
  stripBody: { paddingHorizontal: SCREEN_PAD_X, gap: GAP },
  card: { borderRadius: 24, padding: 18, minHeight: 132, justifyContent: 'space-between' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 40, height: 40, borderRadius: 13 },
  logoLetter: { alignItems: 'center', justifyContent: 'center' },
  logoLetterText: { fontFamily: font.extrabold, fontSize: 17 },
  pct: { height: 24, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center' },
  pctText: { fontFamily: font.extrabold, fontSize: 11.5, color: '#111110' },
  kicker: { fontFamily: font.monoBold, fontSize: 9.5, letterSpacing: 1.5, color: 'rgba(17,17,16,0.55)' },
  bigValue: { fontFamily: font.extrabold, fontSize: 38, letterSpacing: -1.2, color: '#111110', marginTop: 4 },
  value: { fontFamily: font.extrabold, fontSize: 30, letterSpacing: -0.9, marginTop: 12 },
  cardFoot: { fontFamily: font.bold, fontSize: 12, color: 'rgba(17,17,16,0.55)', marginTop: 6 },
  cardFootDim: { fontFamily: font.bold, fontSize: 12, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotActive: { width: 16 },
});
