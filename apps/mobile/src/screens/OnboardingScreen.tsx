// Онбординг-сторис — порт web/src/pages/OnboardingPage.vue вместе с моторикой.
//
// Кривые и тайминги взяты один в один из .story-fwd/.story-back в main.css:
//   вход слайда  — 400 мс, cubic-bezier(0.32, 0.72, 0, 1), сдвиг ±28 px
//   выход слайда — 220 мс, cubic-bezier(0.4, 0, 1, 1), сдвиг ∓20 px
//   элементы внутри — те же 400 мс, сдвиг 14 px вверх, задержка индекс × 55 мс
//
// Раньше здесь был горизонтальный пейджер со стандартным FadeInDown: ни
// направления, ни стаггера, ни выхода — с вебом это не совпадало никак.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { translate } from '@/i18n';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { LanguageSwitcher } from '@/components/LanguageSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';

const SLIDES = 3;
const DURATION = 6000;

const EASE_IN = Easing.bezier(0.32, 0.72, 0, 1);
const EASE_OUT = Easing.bezier(0.4, 0, 1, 1);

const avatars = [
  require('../../assets/brand/avatars/a12.png'),
  require('../../assets/brand/avatars/a33.png'),
  require('../../assets/brand/avatars/a68.png'),
];
const partners = [
  require('../../assets/brand/partners/evos-logo.png'),
  require('../../assets/brand/partners/feedup-logo.png'),
  require('../../assets/brand/partners/bellissimo-logo.png'),
];

/** Вход слайда: сдвиг по X в сторону перехода. */
const slideEnter = (dx: number) => (values: EntryAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ translateX: dx }] },
    animations: {
      opacity: withTiming(1, { duration: 400, easing: EASE_IN }),
      transform: [{ translateX: withTiming(0, { duration: 400, easing: EASE_IN }) }],
    },
  };
};

/** Выход слайда: короче входа и в противоположную сторону. */
const slideExit = (dx: number) => (values: ExitAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 220, easing: EASE_OUT }),
      transform: [{ translateX: withTiming(dx, { duration: 220, easing: EASE_OUT }) }],
    },
  };
};

/** Элемент слайда: всплывает на 14 px со ступенькой 55 мс — как .st в вебе. */
const stagger = (i: number) => (values: EntryAnimationsValues) => {
  'worklet';
  void values;
  const delay = i * 55;
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 14 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 400, easing: EASE_IN })),
      transform: [{ translateY: withDelay(delay, withTiming(0, { duration: 400, easing: EASE_IN })) }],
    },
  };
};

function Progress({ index, progress, color }: { index: number; progress: number; color: string }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: SLIDES }, (_, i) => (
        <Bar key={i} fill={i < index ? 1 : i === index ? progress : 0} color={color} />
      ))}
    </View>
  );
}

function Bar({ fill, color }: { fill: number; color: string }) {
  const w = useSharedValue(fill);
  w.value = withTiming(fill, { duration: 120, easing: Easing.linear });
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%` }));
  return (
    <View style={[styles.barTrack, { backgroundColor: color + '2E' }]}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, style]} />
    </View>
  );
}

export function OnboardingScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [progress, setProgress] = useState(0);
  const [langOpen, setLangOpen] = useState(false);

  const paused = useRef(false);
  const elapsed = useRef(0);
  const last = useRef(0);

  const isDark = index === 1;

  const goTo = useCallback((next: number) => {
    const target = Math.max(0, Math.min(SLIDES - 1, next));
    setDir(target >= 0 ? 1 : -1);
    setIndex((cur) => {
      setDir(target >= cur ? 1 : -1);
      return target;
    });
    elapsed.current = 0;
    setProgress(0);
  }, []);

  // автолистание: тот же 6-секундный шаг, что и в вебе
  useEffect(() => {
    let raf: number;
    const tick = (ts: number) => {
      if (!last.current) last.current = ts;
      const dt = ts - last.current;
      last.current = ts;
      if (!paused.current && !langOpen) {
        elapsed.current += dt;
        const p = Math.min(1, elapsed.current / DURATION);
        setProgress(p);
        if (p >= 1) {
          if (index < SLIDES - 1) goTo(index + 1);
          else paused.current = true;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, langOpen, goTo]);

  const onTap = (x: number) => {
    if (langOpen) return;
    if (x < width * 0.35) goTo(index - 1);
    else if (index < SLIDES - 1) goTo(index + 1);
  };

  const last3 = index === SLIDES - 1;

  return (
    <Screen background={isDark ? '#0E0E0C' : fixed.lime} darkBar={isDark} style={styles.root}>
      <Progress index={index} progress={progress} color={isDark ? '#FFFFFF' : fixed.ink} />

      <View style={styles.topBar}>
        <Image
          source={
            isDark
              ? require('../../assets/brand/zap-wordmark-light.png')
              : require('../../assets/brand/zap-wordmark.png')
          }
          style={styles.wordmark}
          resizeMode="contain"
        />
        <LanguageSwitcher onDark={isDark} onOpenChange={setLangOpen} />
      </View>

      <PressableScale
        haptic={false}
        style={styles.stageArea}
        onPressIn={() => (paused.current = true)}
        onPressOut={() => (paused.current = false)}
        onPress={(e) => onTap(e.nativeEvent.locationX)}
      >
        <Animated.View
          key={index}
          entering={slideEnter(dir * 28)}
          exiting={slideExit(dir * -20)}
          style={styles.slideAbs}
        >
          {index === 0 ? <SlideScan t={translate} fixed={fixed} /> : null}
          {index === 1 ? <SlideSplit t={translate} fixed={fixed} /> : null}
          {index === 2 ? <SlideCashback t={translate} fixed={fixed} /> : null}
        </Animated.View>
      </PressableScale>

      <View style={styles.footer}>
        {last3 ? (
          <>
            <Button title={t('onboarding.start')} variant="ink" fixed onPress={() => useSession.setState({ stage: 'phone' })} />
            <View style={styles.gap} />
            <Button
              title={t('onboarding.haveAccount')}
              variant="ghost"
              fixed
              onPress={() => useSession.setState({ stage: 'phone' })}
            />
          </>
        ) : (
          <Text style={[styles.hint, { color: isDark ? '#FFFFFFA8' : fixed.deep }]} onPress={() => goTo(index + 1)}>
            {t('onboarding.tapHint')}
          </Text>
        )}
      </View>
    </Screen>
  );
}

type SlideProps = {
  t: (k: string, p?: Record<string, unknown>) => string;
  fixed: { lime: string; ink: string; deep: string };
};

/** 1/3 — чернильный квадрат со скан-рамкой, как в вебе. */
function SlideScan({ t, fixed }: SlideProps) {
  return (
    <>
      <Animated.View entering={stagger(0)} style={[styles.scanTile, { backgroundColor: fixed.ink }]}>
        <View style={styles.scanFrame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.scanCorner, corner(c), { borderColor: fixed.lime }]} />
          ))}
          <View style={[styles.scanCore, { backgroundColor: fixed.lime }]} />
        </View>
      </Animated.View>
      <Animated.View entering={stagger(1)}>
        <Text style={[styles.stage, { color: fixed.ink }]}>{t('onboarding.stage', { n: 1 })}</Text>
      </Animated.View>
      <Animated.View entering={stagger(2)}>
        <Text style={[styles.title, { color: fixed.ink }]}>{t('onboarding.s1Title')}</Text>
      </Animated.View>
      <Animated.View entering={stagger(3)}>
        <Text style={[styles.text, { color: fixed.deep }]}>{t('onboarding.s1Text')}</Text>
      </Animated.View>
    </>
  );
}

/** 2/3 — тёмный слайд: стопка аватаров, «+5» и чипы режимов. */
function SlideSplit({ t, fixed }: SlideProps) {
  const chips = ['onboarding.s2ChipEqual', 'onboarding.s2ChipManual', 'onboarding.s2ChipDebt'];
  return (
    <>
      <Animated.View entering={stagger(0)} style={styles.avatarRow}>
        {avatars.map((a, i) => (
          <Image key={i} source={a} style={[styles.avatar, { marginLeft: i ? -18 : 0 }]} />
        ))}
        <View style={[styles.avatar, styles.avatarPlus, { backgroundColor: fixed.lime, marginLeft: -18 }]}>
          <Text style={[styles.plusText, { color: fixed.ink }]}>+5</Text>
        </View>
      </Animated.View>
      <Animated.View entering={stagger(1)}>
        <Text style={[styles.stage, { color: '#FFFFFF80' }]}>{t('onboarding.stage', { n: 2 })}</Text>
      </Animated.View>
      <Animated.View entering={stagger(2)}>
        <Text style={[styles.title, { color: '#F5F3EE' }]}>
          {t('onboarding.s2TitleA')}
          {'\n'}
          {t('onboarding.s2TitleB')}
        </Text>
      </Animated.View>
      <Animated.View entering={stagger(3)}>
        <Text style={[styles.text, { color: '#F5F3EEA6' }]}>{t('onboarding.s2Text')}</Text>
      </Animated.View>
      <Animated.View entering={stagger(4)} style={styles.chipRow}>
        {chips.map((c, i) => (
          <View
            key={c}
            style={[styles.chip, { backgroundColor: i === 0 ? fixed.lime : 'rgba(245,243,238,0.12)' }]}
          >
            <Text style={[styles.chipText, { color: i === 0 ? fixed.ink : '#F5F3EE' }]}>{t(c)}</Text>
          </View>
        ))}
      </Animated.View>
    </>
  );
}

/** 3/3 — партнёры и счётчик группового кэшбэка. */
function SlideCashback({ t, fixed }: SlideProps) {
  return (
    <>
      <Animated.View entering={stagger(0)} style={styles.partnerRow}>
        {partners.map((p, i) => (
          <View key={i} style={styles.partnerTile}>
            <Image source={p} style={styles.partnerLogo} resizeMode="contain" />
          </View>
        ))}
      </Animated.View>
      <Animated.View entering={stagger(1)}>
        <Text style={[styles.stage, { color: fixed.ink }]}>{t('onboarding.stage', { n: 3 })}</Text>
      </Animated.View>
      <Animated.View entering={stagger(2)}>
        <Text style={[styles.title, { color: fixed.ink }]}>
          {t('onboarding.s3TitleA')}
          {'\n'}
          {t('onboarding.s3TitleB')}
        </Text>
      </Animated.View>
      <Animated.View entering={stagger(3)}>
        <Text style={[styles.text, { color: fixed.deep }]}>{t('onboarding.s3Text')}</Text>
      </Animated.View>
      <Animated.View entering={stagger(4)} style={[styles.counter, { backgroundColor: fixed.ink }]}>
        <Text style={[styles.counterAmount, { color: fixed.lime }]}>+60 000</Text>
        <Text style={styles.counterLabel}>{t('onboarding.s3Counter')}</Text>
      </Animated.View>
    </>
  );
}

function corner(c: 'tl' | 'tr' | 'bl' | 'br') {
  switch (c) {
    case 'tl': return { top: 0, left: 0, borderTopWidth: 2.6, borderLeftWidth: 2.6, borderTopLeftRadius: 6 };
    case 'tr': return { top: 0, right: 0, borderTopWidth: 2.6, borderRightWidth: 2.6, borderTopRightRadius: 6 };
    case 'bl': return { bottom: 0, left: 0, borderBottomWidth: 2.6, borderLeftWidth: 2.6, borderBottomLeftRadius: 6 };
    default: return { bottom: 0, right: 0, borderBottomWidth: 2.6, borderRightWidth: 2.6, borderBottomRightRadius: 6 };
  }
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  progressRow: { flexDirection: 'row', gap: 6, paddingTop: 8 },
  barTrack: { flex: 1, height: 3, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  wordmark: { height: 46, width: 78 },

  stageArea: { flex: 1 },
  stage: { fontFamily: font.monoBold, fontSize: 10.5, letterSpacing: 1.7, opacity: 0.62 },
  // абсолют, чтобы уходящий и приходящий слайды лежали в одном боксе
  slideAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 18,
  },
  title: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -1.2, lineHeight: 42 },
  text: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21, maxWidth: 310, opacity: 0.72 },

  scanTile: {
    height: 96, width: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  scanFrame: { width: 46, height: 46 },
  scanCorner: { position: 'absolute', width: 14, height: 14 },
  scanCore: { position: 'absolute', left: 15, top: 15, width: 16, height: 16, borderRadius: 4 },

  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 62, height: 62, borderRadius: 999, borderWidth: 3, borderColor: '#0E0E0C' },
  avatarPlus: { alignItems: 'center', justifyContent: 'center' },
  plusText: { fontFamily: font.extrabold, fontSize: 15 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: font.bold, fontSize: 12.5 },

  partnerRow: { flexDirection: 'row', gap: 10 },
  partnerTile: {
    width: 62, height: 62, borderRadius: 18, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  partnerLogo: { width: '100%', height: '100%' },
  counter: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 18, borderRadius: 999 },
  counterAmount: { fontFamily: font.extrabold, fontSize: 17 },
  counterLabel: { fontFamily: font.monoBold, fontSize: 9.5, letterSpacing: 1.4, color: '#FFFFFF8A' },

  footer: { paddingBottom: 16 },
  gap: { height: 10 },
  hint: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center', paddingVertical: 18, opacity: 0.62 },
});
