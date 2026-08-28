// Онбординг-сторис: три кадра на лайме, свайп и тап, полоски прогресса
// заполняются как в вебе. Палитра брендовая (fixed) — экран одинаков в обеих темах.
import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { LanguageSwitcher } from '@/components/LanguageSheet';

const { width } = Dimensions.get('window');
const SLIDES = 3;

function Progress({ index, color }: { index: number; color: string }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: SLIDES }, (_, i) => (
        <Bar key={i} active={i <= index} color={color} />
      ))}
    </View>
  );
}

function Bar({ active, color }: { active: boolean; color: string }) {
  const w = useSharedValue(active ? 1 : 0);
  w.value = withTiming(active ? 1 : 0, { duration: 320 });
  const style = useAnimatedStyle(() => ({ flex: 1, opacity: 0.25 + 0.75 * w.value }));
  return (
    <View style={[styles.barTrack, { backgroundColor: color + '33' }]}>
      <Animated.View style={[style, { backgroundColor: color, height: '100%' }]} />
    </View>
  );
}

export function OnboardingScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const [index, setIndex] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  // в RN 0.87 ScrollView — функциональный компонент, тип инстанса берём из пропсов
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(SLIDES - 1, i));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  }, []);

  const slides = [
    { title: t('onboarding.s1Title'), text: t('onboarding.s1Text'), stage: 1 },
    { title: `${t('onboarding.s2TitleA')}\n${t('onboarding.s2TitleB')}`, text: t('onboarding.s2Text'), stage: 2 },
    { title: `${t('onboarding.s3TitleA')}\n${t('onboarding.s3TitleB')}`, text: t('onboarding.s3Text'), stage: 3 },
  ];

  const last = index === SLIDES - 1;

  return (
    <Screen background={fixed.lime} darkBar={false} style={styles.root}>
      <Progress index={index} color={fixed.ink} />

      {/* язык — в правом верхнем углу, напротив логотипа; тап по нему не листает сторис */}
      <View style={styles.topBar}>
        <LanguageSwitcher onOpenChange={setLangOpen} />
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
      >
        {slides.map((s) => (
          <PressableScale
            key={s.stage}
            haptic={false}
            style={[styles.slide, { width }]}
            onPress={() => {
              // пока открыт шит языка, тап по слайду ничего не листает
              if (!langOpen) goTo(index + 1);
            }}
          >
            <Animated.View entering={FadeInDown.duration(420)}>
              <Text style={[styles.stage, { color: fixed.ink }]}>{t('onboarding.stage', { n: s.stage })}</Text>
              <Text style={[styles.title, { color: fixed.ink }]}>{s.title}</Text>
              <Text style={[styles.text, { color: fixed.deep }]}>{s.text}</Text>
            </Animated.View>
          </PressableScale>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {last ? (
          <>
            <Button title={t('onboarding.start')} variant="ink" fixed onPress={() => useSession.setState({ stage: 'phone' })} />
            <View style={styles.gap} />
            <Button title={t('onboarding.haveAccount')} variant="ghost" fixed onPress={() => useSession.setState({ stage: 'phone' })} />
          </>
        ) : (
          <Text style={[styles.hint, { color: fixed.deep }]} onPress={() => goTo(index + 1)}>
            {t('onboarding.tapHint')}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  progressRow: { flexDirection: 'row', gap: 6, paddingTop: 8 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12 },
  barTrack: { flex: 1, height: 3, borderRadius: 999, overflow: 'hidden' },
  pager: { flex: 1, marginHorizontal: -20 },
  slide: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  stage: { fontFamily: font.monoBold, fontSize: 10.5, letterSpacing: 1.7, opacity: 0.55 },
  title: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -1.2, lineHeight: 42, marginTop: 14 },
  text: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21, marginTop: 14, maxWidth: 300, opacity: 0.7 },
  footer: { paddingBottom: 16 },
  gap: { height: 10 },
  hint: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center', paddingVertical: 18, opacity: 0.6 },
});
