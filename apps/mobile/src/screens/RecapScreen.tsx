// Итоги месяца «Твой август ⚡» — сторис-панели поверх реальной истории.
//
// Формат намеренно тот же, что у онбординга: полноэкранные панели, полоски
// прогресса сверху, тап слева/справа для перелистывания. Полоски — общий
// StoryProgress, а не копия.
//
// Автоперелистывания нет: в отличие от онбординга здесь цифры, которые
// хочется рассмотреть, и таймер бы мешал.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StoryProgress } from '@/components/StoryProgress';
import { PressableScale } from '@/components/PressableScale';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { fetchRecap, type MonthlyRecap } from '@/api/actions';
import { themeForMerchant } from '@/lib/merchantTheme';
import { money } from '@/lib/format';
import { cue } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

const WORDMARK = require('../../assets/brand/zap-wordmark-large.png');

type Panel =
  | { kind: 'zaps' }
  | { kind: 'breakdown' }
  | { kind: 'total' }
  | { kind: 'buddy' }
  | { kind: 'spot' };

/** Панели с пустыми данными не показываем — лучше короче, чем с прочерками. */
function panelsFor(r: MonthlyRecap): Panel[] {
  const p: Panel[] = [{ kind: 'zaps' }];
  if (r.byMerchant.length) p.push({ kind: 'breakdown' });
  if (r.totalSplit > 0) p.push({ kind: 'total' });
  if (r.topBuddy) p.push({ kind: 'buddy' });
  if (r.favouriteSpot) p.push({ kind: 'spot' });
  return p;
}

export function RecapScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['recap'], queryFn: () => fetchRecap() });

  const panels = useMemo(() => (data ? panelsFor(data) : []), [data]);
  const monthLabel = data ? t(`recap.month.${Number(data.month.split('-')[1])}`) : '';

  if (isLoading || !data) {
    return (
      <Screen style={styles.root} background={fixed.ink} darkBar noTopFade edges={['bottom']}>
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader tint="onDark" />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={fixed.lime} />
        </View>
      </Screen>
    );
  }

  if (data.empty) {
    return (
      <Screen style={styles.root} background={fixed.ink} darkBar noTopFade edges={['bottom']}>
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader tint="onDark" />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('recap.empty')}</Text>
          <Text style={styles.emptySub}>{t('recap.emptySub')}</Text>
        </View>
      </Screen>
    );
  }

  const go = (next: number) => {
    if (next < 0) return;
    if (next >= panels.length) {
      nav.popTo('Tabs');
      return;
    }
    cue('scan');
    setIndex(next);
  };

  const panel = panels[index]!;

  return (
    <Screen style={styles.root} background={fixed.ink} darkBar noTopFade edges={['bottom']}>
      {/*
        Отступ сверху задаём сами, а не через edges={['top']} у Screen.
        Экран презентуется как fullScreenModal, а SafeAreaView внутри модального
        контроллера на первом показе отдаёт нулевые вставки — шапка уезжала под
        статус-бар. Ровно так же (insets.top вручную) сделан ScanScreen, который
        тоже модальный и работает.
      */}
      <View style={{ paddingTop: insets.top }}>
        <StoryProgress count={panels.length} index={index} progress={1} dark />
      </View>

      <View style={styles.topRow}>
        <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.month}>{t('recap.title', { month: monthLabel })}</Text>
      </View>

      {/* зоны перелистывания — как в сторис: слева назад, справа вперёд */}
      <View style={styles.stage}>
        <Animated.View key={index} entering={FadeIn.duration(220)} style={styles.panel}>
          <PanelBody panel={panel} recap={data} lime={fixed.lime} />
        </Animated.View>

        <PressableScale haptic={false} style={[styles.tapZone, { width: width * 0.35, left: 0 }]} onPress={() => go(index - 1)} />
        <PressableScale haptic={false} style={[styles.tapZone, { width: width * 0.65, right: 0 }]} onPress={() => go(index + 1)} />
      </View>

      <PressableScale style={[styles.share, { backgroundColor: fixed.lime }]} onPress={() => setShareOpen(true)}>
        <Text style={[styles.shareText, { color: colors.ink }]}>{t('recap.share')}</Text>
      </PressableScale>

      <ShareCardSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t('recap.cardTitle', { month: monthLabel })}
        total={data.totalSplit}
        members={[]}
        code={data.month}
      />
    </Screen>
  );
}

function PanelBody({ panel, recap, lime }: { panel: Panel; recap: MonthlyRecap; lime: string }) {
  const { t } = useTranslation();

  if (panel.kind === 'zaps') {
    return (
      <>
        <Text style={[styles.big, { color: lime }]}>{recap.zaps}</Text>
        <Text style={styles.label}>{t('recap.zaps', { n: recap.zaps })}</Text>
        <Text style={styles.sub}>{t('recap.zapsSub')}</Text>
      </>
    );
  }

  if (panel.kind === 'total') {
    return (
      <>
        <Text style={[styles.bigMoney, { color: lime }]}>{money(recap.totalSplit)}</Text>
        <Text style={styles.label}>{t('recap.total')}</Text>
      </>
    );
  }

  if (panel.kind === 'buddy') {
    return (
      <>
        <Text style={[styles.big, { color: lime }]}>👥</Text>
        <Text style={styles.label}>{recap.topBuddy?.name}</Text>
        <Text style={styles.sub}>{t('recap.buddySub', { n: recap.topBuddy?.count ?? 0 })}</Text>
        <Text style={styles.caption}>{t('recap.buddy')}</Text>
      </>
    );
  }

  if (panel.kind === 'spot') {
    return (
      <>
        <Text style={[styles.big, { color: lime }]}>
          {themeForMerchant(recap.favouriteSpot?.name)?.glyph ?? '📍'}
        </Text>
        <Text style={styles.label}>{recap.favouriteSpot?.name}</Text>
        <Text style={styles.sub}>{t('recap.spotSub', { n: recap.favouriteSpot?.count ?? 0 })}</Text>
        <Text style={styles.caption}>{t('recap.spot')}</Text>
      </>
    );
  }

  // Разбивка по заведениям. Раньше здесь группировалось по эмодзи темы, но
  // themeForMerchant возвращает null для большинства названий, и всё
  // схлопывалось в одну строку «🧾 4» — цифра без смысла. Показываем сами
  // заведения, а тему используем только как значок рядом.
  const rows = recap.byMerchant.slice(0, 4);

  return (
    <View style={styles.breakWrap}>
      <Text style={styles.caption}>{t('recap.breakdown')}</Text>
      {rows.map((m) => (
        <View key={m.name} style={styles.breakRow}>
          <Text style={styles.breakGlyph}>{themeForMerchant(m.name)?.glyph ?? '🧾'}</Text>
          <Text style={styles.breakName} numberOfLines={1}>
            {m.name}
          </Text>
          <Text style={[styles.breakCount, { color: lime }]}>{m.count}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  wordmark: { height: 40, width: 60 },
  month: { fontFamily: font.extrabold, fontSize: 17, color: '#FFFFFF' },
  stage: { flex: 1, justifyContent: 'center' },
  panel: { alignItems: 'center', gap: 6 },
  tapZone: { position: 'absolute', top: 0, bottom: 0 },
  big: { fontFamily: font.extrabold, fontSize: 96, letterSpacing: -2 },
  bigMoney: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: -1, textAlign: 'center' },
  label: { fontFamily: font.extrabold, fontSize: 24, color: '#FFFFFF', textAlign: 'center' },
  sub: { fontFamily: font.semibold, fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  caption: { fontFamily: font.bold, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10, textAlign: 'center' },
  emptyTitle: { fontFamily: font.extrabold, fontSize: 22, color: '#FFFFFF', textAlign: 'center' },
  emptySub: { fontFamily: font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  breakWrap: { alignSelf: 'stretch', alignItems: 'stretch' },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  breakGlyph: { fontSize: 30, width: 38, textAlign: 'center' },
  breakName: { flex: 1, fontFamily: font.bold, fontSize: 18, color: '#FFFFFF' },
  breakCount: { fontFamily: font.extrabold, fontSize: 28 },
  share: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  shareText: { fontFamily: font.extrabold, fontSize: 16 },
});
