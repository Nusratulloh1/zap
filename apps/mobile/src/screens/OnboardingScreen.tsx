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
import { Dimensions, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { translate } from '@/i18n';
import { STICKER } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { CountUp } from '@/components/CountUp';
import { StoryProgress } from '@/components/StoryProgress';
import { PressableScale } from '@/components/PressableScale';
import { LanguageSwitcher } from '@/components/LanguageSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import { useSession } from '@/store/session';
import Svg, { SvgXml, Circle as SvgCircle, Defs, Pattern, Rect as SvgRect } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;
const SLIDES = 3;
const DURATION = 5000;

const EASE_IN = Easing.bezier(0.32, 0.72, 0, 1);
const EASE_OUT = Easing.bezier(0.4, 0, 1, 1);

const avatars = [
  require('../../assets/brand/avatars/a12.png'),
  require('../../assets/brand/avatars/a33.png'),
  require('../../assets/brand/avatars/a68.png'),
];
// кафе-партнёры слайда про кэшбэк — стопка чипов внахлёст, как в вебе:
// bg — фирменный фон знака; безфоновые лежат на светлой плашке
const CAFES: { src: number; w: number; bg?: string; h?: number }[] = [
  { src: require('../../assets/brand/partners/safia-sq.png'), w: 56, bg: '#FFDEB7' },
  { src: require('../../assets/brand/partners/evos-logo.png'), w: 70, bg: '#4AA838' },
  { src: require('../../assets/brand/partners/feedup-logo.png'), w: 70, bg: '#000000' },
  { src: require('../../assets/brand/partners/bellissimo-logo.png'), w: 56, h: 30 },
];

// словесный логотип Oqtepa — SVG из веба, в квадрат не помещается
const OQTEPA_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"_\u0421\u043b\u043e\u0439_2\" data-name=\"\u0421\u043b\u043e\u0439_2\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 161.6 57.31\">\n  <defs>\n    <style>\n      .cls-1 {\n        fill: #c81e28;\n      }\n    </style>\n  </defs>\n  <g id=\"_\u0421\u043b\u043e\u0439_1-2\" data-name=\"\u0421\u043b\u043e\u0439_1\">\n    <g>\n      <g>\n        <path class=\"cls-1\" d=\"M28.98,14.52c-.02,3.51-1,6.69-3.26,9.42-2.06,2.49-4.71,4.06-7.86,4.74-3.49.75-6.9.43-10.12-1.16-3.94-1.94-6.34-5.13-7.31-9.39-.7-3.09-.56-6.16.6-9.12C2.76,4.62,5.95,1.8,10.48.58,14.7-.55,18.76-.06,22.51,2.24c3.29,2.02,5.27,5.02,6.08,8.77.25,1.14.32,2.33.48,3.49-.03,0-.06,0-.09.01ZM6.7,14.59c.03,2.22.55,4.37,1.99,6.21,1.74,2.22,4.06,3.16,6.84,2.8,2.55-.32,4.41-1.76,5.55-4.02,1.68-3.33,1.7-6.75,0-10.09-1.23-2.41-3.23-3.86-5.99-4.06-2.95-.21-5.23.99-6.84,3.45-1.12,1.7-1.54,3.61-1.56,5.7Z\"/>\n        <path class=\"cls-1\" d=\"M96.85,19.32h-14.84c.09.6.13,1.17.27,1.72.47,1.86,1.55,3.17,3.48,3.59,1.3.29,2.58.19,3.75-.51,1-.59,1.53-1.48,1.51-2.66,0-.12,0-.25,0-.42,1.8.19,3.56.37,5.35.56-.02.84-.23,1.6-.54,2.33-.86,2.02-2.38,3.41-4.39,4.2-3.44,1.35-6.9,1.31-10.25-.31-2.47-1.19-4.08-3.18-4.84-5.82-.89-3.12-.71-6.18.83-9.07,1.45-2.71,3.77-4.32,6.75-4.97,2.37-.52,4.72-.42,6.98.52,3.07,1.27,4.87,3.64,5.65,6.82.32,1.31.46,2.64.28,4.03ZM91,15.83c-.17-1.87-1.45-4.12-4.32-4.11-2.39.01-4.52,1.96-4.52,4.11h8.83Z\"/>\n        <path class=\"cls-1\" d=\"M59.16,12.68h-2.96c-.31,0-.56-.25-.56-.56v-3.87c.65-.08,1.29-.16,1.93-.24,1.62-.21,2.3-.84,2.56-2.47.18-1.11.29-2.22.44-3.36h4.86v6.03h5.65c.12,0,.21.09.21.21v4.03c0,.12-.09.21-.21.21h-5.63c0,.17-.02.29-.02.41,0,2.93,0,5.85,0,8.78,0,.37.04.74.13,1.1.26,1.07,1.05,1.63,2.11,1.53,1.13-.1,1.85-.81,1.92-1.91.07-1.09-.12-2.14-.52-3.15h0c-.05-.12.05-.24.17-.23.67.07,1.31.14,1.95.21.76.08,1.51.18,2.27.26.28.03.42.11.47.42.22,1.49.44,2.98,0,4.47-.65,2.16-2.11,3.52-4.25,4.13-2.03.58-4.07.5-6.07-.19-2.14-.74-3.45-2.27-4-4.43-.25-.99-.39-2.02-.42-3.04-.06-2.63-.02-5.25-.02-7.88,0-.14,0-.28,0-.47Z\"/>\n        <path class=\"cls-1\" d=\"M46.8,26.23c.05-.06.08-.14.11-.21l.11.02v10.95c0,.19.23.27.35.13,1.47-1.63,3.38-3.03,5.7-3.39.1-.02.17-.1.17-.2V8.45c0-.12-.09-.21-.21-.21h-5.45c-.12,0-.21.09-.21.21v2.7c-.28-.34-.47-.62-.7-.86-2.22-2.29-4.95-3.01-8.02-2.44-3.13.58-5.28,2.49-6.57,5.36-1.11,2.47-1.29,5.06-.81,7.7.36,1.97,1.15,3.75,2.52,5.23,1.6,1.73,3.59,2.67,5.94,2.86,2.81.23,5.18-.64,7.06-2.78ZM38.3,22.21c-.7-1.19-.96-2.48-.98-3.89.03-1.54.34-3.06,1.34-4.34,1.99-2.56,5.78-2.31,7.44.49.88,1.49,1.1,3.11.94,4.81-.11,1.18-.45,2.29-1.13,3.26-1.95,2.76-5.88,2.59-7.6-.33Z\"/>\n        <path class=\"cls-1\" d=\"M122.58,14.65c-.59-2.29-1.81-4.19-3.79-5.54-1.9-1.29-4-1.67-6.25-1.33-2.1.32-3.85,1.24-5.19,2.9-.22.27-.41.57-.67.92-.01-.17-.02-.25-.03-.33-.13-1.57-.86-2.74-2.37-3.27-1.96-.69-3.84-.36-5.64.61-.09.05-.16.24-.15.35.04.62.11,1.24.17,1.86.07.67.14,1.34.21,2.04.13-.07.21-.13.3-.18.82-.42,1.56,0,1.63.91.01.21,0,.42,0,.62,0,6.39,0,12.78,0,19.17,0,.13.11.22.24.2.32-.06.65-.11.99-.14,1.75-.17,3.34-.07,4.74.67.13.07.3-.02.3-.18v-7.95c2.08,2.43,4.7,3.34,7.76,2.95,2.99-.39,5.25-1.98,6.72-4.6,1.72-3.07,1.88-6.36,1.01-9.71ZM115.57,22.54c-1.92,2.73-5.84,2.6-7.57-.27-.89-1.48-1.12-3.11-.96-4.8.11-1.13.42-2.2,1.05-3.15.94-1.4,2.25-2.16,3.97-2.09,1.87.08,3.14,1.07,3.96,2.7.54,1.07.72,2.23.74,3.46-.03,1.47-.31,2.9-1.2,4.16Z\"/>\n        <path class=\"cls-1\" d=\"M137.72,42.03c-1.47.25-2.93.51-4.4.76-.23.04-.45-.14-.43-.38,0,0,0,0,0,0,.06-.97-.36-1.7-1.22-2.11-.52-.25-1.1-.44-1.67-.52-.98-.14-1.96-.11-2.91.24-1.07.4-1.56,1.33-1.23,2.3.17.5.52.84.98,1.01.71.25,1.45.45,2.19.63,1.75.43,3.5.8,5.24,1.26.99.26,1.88.76,2.65,1.45.99.88,1.5,2.01,1.62,3.31.17,1.81-.26,3.45-1.58,4.77-1.01,1.01-2.27,1.62-3.64,1.99-2.72.73-5.46.77-8.2.13-1.82-.42-3.43-1.24-4.56-2.81-.67-.93-1.02-1.96-1.14-3.1-.03-.27.17-.52.45-.55,1.4-.13,2.78-.26,4.16-.39.27-.03.51.18.54.45.01.19.03.37.07.55.17.81.7,1.34,1.42,1.69,1.11.55,2.3.65,3.51.6.79-.04,1.56-.16,2.28-.53.57-.3,1.04-.7,1.12-1.4.07-.62-.11-1.15-.62-1.53-.66-.5-1.45-.7-2.24-.87-1.44-.3-2.9-.54-4.35-.85-1.35-.29-2.64-.75-3.74-1.63-1.49-1.19-1.98-2.79-1.82-4.63.25-2.75,1.9-4.41,4.38-5.24,3.09-1.03,6.23-1.05,9.3.12,2.07.79,3.44,2.24,3.87,4.47.04.2.06.4.09.62.01.09-.05.16-.13.18Z\"/>\n        <path class=\"cls-1\" d=\"M34.04,51.54h12.04c.12,0,.21.09.21.21v4.76c0,.12-.09.21-.21.21h-18.37c-.22,0-.39-.18-.39-.39v-27.25c0-.12.09-.21.21-.21h5.92c.12,0,.21.09.21.21v22.07c0,.22.18.39.39.39Z\"/>\n        <path class=\"cls-1\" d=\"M71.69,36.49h5.96c.09,0,.17.06.2.15.27.9.55,1.81.83,2.71.97,3.21,1.98,6.41,2.91,9.63.31,1.06.43,2.17.63,3.25.01.06.03.13.04.19.03,0,.06,0,.09,0,.03-.27.05-.54.09-.81.2-1.53.67-2.99,1.15-4.45,1.14-3.47,2.28-6.94,3.42-10.41.01-.04.03-.09.05-.13.03-.08.11-.13.19-.13h5.4c.14,0,.24.14.2.27-.01.04-.03.08-.04.12-2.4,6.51-4.8,13.02-7.2,19.53-.08.21-.27.34-.49.34-1.98-.01-3.96-.01-5.94,0-.24,0-.34-.07-.42-.29-2.41-6.57-4.83-13.13-7.25-19.69,0,0,0,0,0,0-.05-.13.05-.28.2-.28Z\"/>\n        <path class=\"cls-1\" d=\"M62.62,38.93v-2.24c0-.12.09-.21.21-.21h5.9c.12,0,.21.09.21.21v.18c0,4.68,0,9.37,0,14.05,0,.24.01.49.06.72.15.77.72,1.07,1.44.76,0,0,0,0,0,0,.18-.08.39.03.41.23.06.53.11,1.05.16,1.56.06.6.1,1.2.18,1.79.03.21-.02.31-.2.42-1.27.73-2.63.96-4.07.84-1.03-.09-1.96-.43-2.71-1.17-.64-.62-.96-1.4-1.04-2.28,0-.05-.01-.1-.03-.22-.23.32-.41.59-.62.85-1.41,1.7-3.25,2.58-5.42,2.79-2.46.25-4.7-.36-6.65-1.9-1.8-1.42-2.89-3.31-3.41-5.52-.71-3.03-.54-6,.89-8.81,1.54-3.01,4.04-4.7,7.42-5.03,2.57-.26,4.82.47,6.67,2.3.19.19.36.39.6.66ZM62.74,46.61c-.03-1.53-.34-3.01-1.29-4.3-1.6-2.18-4.67-2.47-6.64-.64-.98.91-1.5,2.06-1.73,3.36-.33,1.9-.16,3.73.84,5.42,1.76,2.95,5.68,3.1,7.65.3.86-1.23,1.13-2.63,1.17-4.14Z\"/>\n        <path class=\"cls-1\" d=\"M109.87,53.59c-.23.32-.41.59-.61.84-1.28,1.56-2.95,2.44-4.94,2.75-2.54.39-4.87-.14-6.94-1.67-1.92-1.42-3.07-3.37-3.61-5.66-.73-3.04-.55-6.03.88-8.84,1.53-3,4.03-4.69,7.39-5.02,2.86-.28,5.28.6,7.16,2.82.02.02.05.04.11.09v-2.18c0-.12.09-.21.21-.21h5.92c.12,0,.21.09.21.21,0,.06,0,.13,0,.19,0,4.68,0,9.37,0,14.05,0,.24.01.49.06.72.14.75.67,1.03,1.39.76,0,0,0,0,0,0,.21-.08.45.05.47.28.08.74.15,1.47.23,2.2.04.36.05.72.11,1.07.03.18-.05.36-.21.45-1.27.72-2.63.95-4.07.82-1.04-.09-1.98-.45-2.74-1.2-.66-.66-.96-1.48-1.03-2.47ZM109.46,46.6c-.03-1.52-.34-3-1.29-4.3-1.6-2.18-4.67-2.48-6.64-.64-.98.91-1.5,2.06-1.73,3.35-.34,1.91-.16,3.76.86,5.45,1.76,2.93,5.67,3.07,7.63.27.86-1.23,1.13-2.63,1.17-4.15Z\"/>\n        <path class=\"cls-1\" d=\"M161.59,44.27c0-.84-.09-1.69-.27-2.51-.39-1.79-1.31-3.27-2.79-4.37-1.17-.87-2.5-1.32-3.94-1.44-2.08-.17-4,.26-5.7,1.49-.51.36-.95.82-1.45,1.26v-7.31c0-.13-.13-.23-.26-.19-.84.24-1.71.16-2.61.06-.63-.08-1.27-.26-1.84-.54-.47-.23-.84-.53-1.13-.88-.12-.15-.36-.06-.36.13v26.55c0,.12.09.21.21.21h5.79c.12,0,.21-.09.21-.21v-.23c0-3.56,0-7.13,0-10.69,0-.99.12-1.95.58-2.86,1.11-2.19,4.22-2.81,5.97-1.17.95.88,1.3,2.04,1.31,3.29.03,3.82.02,7.63.02,11.45,0,.07,0,.14,0,.21,0,.12.09.21.21.21h5.87c.12,0,.21-.09.21-.21v-.23c0-4,.01-8.01-.01-12.01Z\"/>\n        <path class=\"cls-1\" d=\"M141.69,25.46c-.52.56-1,1.18-1.57,1.68-1.29,1.13-2.83,1.71-4.53,1.86-2.95.25-5.5-.63-7.55-2.79-1.59-1.66-2.4-3.7-2.71-5.95-.31-2.24-.14-4.44.7-6.54,1.36-3.4,3.84-5.46,7.49-5.96,2.95-.4,5.51.45,7.48,2.77.03.03.06.06.13.13v-2.2c0-.12.09-.21.21-.21h5.91c.12,0,.21.09.21.21v.19c0,4.68,0,9.37,0,14.05,0,.24.02.49.06.72.14.74.65,1.02,1.36.77.15-.05.29-.14.46-.22.09.92.18,1.82.28,2.73.03.34.05.69.11,1.03.04.22-.02.34-.21.44-1.27.72-2.64.98-4.07.81-.63-.08-1.27-.26-1.84-.54-1.23-.61-1.82-1.68-1.92-3ZM141.28,18.35c-.03-1.52-.34-2.99-1.28-4.28-1.6-2.2-4.68-2.5-6.66-.65-.98.91-1.5,2.07-1.73,3.36-.33,1.91-.16,3.76.87,5.45,1.76,2.91,5.66,3.05,7.62.28.87-1.24,1.15-2.65,1.18-4.16Z\"/>\n      </g>\n      <path class=\"cls-1\" d=\"M150.24,7.66c0-1.7,1.23-2.99,3.02-2.99s2.97,1.3,2.98,2.99c0,1.66-1.24,3-2.98,3s-3.02-1.27-3.02-3ZM153.25,10.09c1.33,0,2.39-1.01,2.39-2.41s-1.04-2.41-2.38-2.41-2.38,1.01-2.38,2.41,1.01,2.41,2.36,2.41ZM151.87,6.05h1.46c.84,0,1.3.39,1.3.99,0,.39-.2.67-.58.82.25.09.35.33.4.57.06.26.15.69.3.83h-.93c-.1-.16-.13-.29-.21-.63-.09-.41-.21-.55-.6-.55h-.31v1.18h-.82v-3.21ZM153.25,7.51c.31,0,.54-.15.54-.43s-.23-.43-.55-.43h-.54v.85h.55Z\"/>\n    </g>\n  </g>\n</svg>";

/** Вход слайда: сдвиг по X в сторону перехода. */
// mode="out-in" из веба: пока старый слайд выходит (220 мс), новый невидим —
// иначе они рисуются друг на друге
const OUT_MS = 220;

// смена подвала hint <-> CTA: подъём 380 мс / уход 180 мс (footer-swap)
const footerIn = (values: EntryAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 16 }] },
    animations: {
      opacity: withDelay(180, withTiming(1, { duration: 380, easing: EASE_IN })),
      transform: [{ translateY: withDelay(180, withTiming(0, { duration: 380, easing: EASE_IN })) }],
    },
  };
};
const footerOut = (values: ExitAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: { opacity: withTiming(0, { duration: 180 }), transform: [{ translateY: withTiming(0, { duration: 180 }) }] },
  };
};

const slideEnter = (dirSv: { value: number }, base: number) => (values: EntryAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ translateX: dirSv.value * base }] },
    animations: {
      opacity: withDelay(OUT_MS, withTiming(1, { duration: 400, easing: EASE_IN })),
      transform: [{ translateX: withDelay(OUT_MS, withTiming(0, { duration: 400, easing: EASE_IN })) }],
    },
  };
};

/** Выход слайда: короче входа и в противоположную сторону. */
const slideExit = (dirSv: { value: number }, base: number) => (values: ExitAnimationsValues) => {
  'worklet';
  void values;
  const dx = dirSv.value * base;
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
  const delay = OUT_MS + i * 55;
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 14 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 400, easing: EASE_IN })),
      transform: [{ translateY: withDelay(delay, withTiming(0, { duration: 400, easing: EASE_IN })) }],
    },
  };
};


export function OnboardingScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const dirSv = useSharedValue(1);
  const [progress, setProgress] = useState(0);
  const [langOpen, setLangOpen] = useState(false);

  const paused = useRef(false);
  const elapsed = useRef(0);
  const last = useRef(0);
  const pressStart = useRef(0);

  const isDark = index === 1;
  // кроссфейд лайм <-> тёмный + точечная сетка (320 мс, как в вебе)
  const darkSv = useSharedValue(isDark ? 1 : 0);
  useEffect(() => {
    darkSv.value = withTiming(isDark ? 1 : 0, { duration: 320 });
  }, [isDark, darkSv]);
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(darkSv.value, [0, 1], ['#D9FF3A', '#0E0E0C']),
  }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: darkSv.value }));

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(SLIDES - 1, next));
      setIndex((cur) => {
        dirSv.value = target >= cur ? 1 : -1;
        return target;
      });
      elapsed.current = 0;
      setProgress(0);
    },
    [dirSv],
  );

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
    const area = width - 40; // stageArea лежит внутри px-20
    if (x < area * 0.35) goTo(index - 1);
    else if (index < SLIDES - 1) goTo(index + 1);
  };

  const last3 = index === SLIDES - 1;

  return (
    <Screen background="transparent" darkBar={isDark} style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill as object, bgStyle]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFill as object, dotsStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="onbDots" width={16} height={16} patternUnits="userSpaceOnUse">
              <SvgCircle cx={2} cy={2} r={1.25} fill="rgba(255,255,255,0.07)" />
            </Pattern>
          </Defs>
          <SvgRect x={0} y={0} width="100%" height="100%" fill="url(#onbDots)" />
        </Svg>
      </Animated.View>
      <StoryProgress count={SLIDES} index={index} progress={progress} dark={isDark} />

      <View style={styles.topBar}>
        <Image
          source={
            isDark
              ? require('../../assets/brand/zap-wordmark-light.png')
              : require('../../assets/brand/zap-wordmark-large.png')
          }
          style={styles.wordmark}
          resizeMode="contain"
        />
        <LanguageSwitcher onDark={isDark} onOpenChange={setLangOpen} />
      </View>

      <PressableScale
        haptic={false}
        style={styles.stageArea}
        onPressIn={() => {
          paused.current = true;
          pressStart.current = Date.now();
        }}
        onPressOut={() => (paused.current = false)}
        onPress={(e) => {
          // долгий прижим — пауза истории, не перелистывание (как в вебе)
          if (Date.now() - pressStart.current > 250) return;
          onTap(e.nativeEvent.locationX);
        }}
      >
        <Animated.View
          key={index}
          entering={slideEnter(dirSv, 28)}
          exiting={slideExit(dirSv, -20)}
          style={styles.slideAbs}
        >
          {index === 0 ? <SlideScan t={translate} fixed={fixed} /> : null}
          {index === 1 ? <SlideSplit t={translate} fixed={fixed} /> : null}
          {index === 2 ? <SlideCashback t={translate} fixed={fixed} /> : null}
        </Animated.View>
      </PressableScale>

      <View style={styles.footer}>
        {last3 ? (
          <Animated.View key="cta" entering={footerIn} exiting={footerOut}>
            <Button title={t('onboarding.start')} variant="ink" fixed onPress={() => useSession.setState({ stage: 'phone' })} />
            <View style={styles.gap} />
            <PressableScale
              accessibilityRole="button"
              style={styles.haveAccount}
              onPress={() => useSession.setState({ stage: 'phone' })}
            >
              <Text style={[styles.haveAccountText, { color: fixed.ink }]}>{t('onboarding.haveAccount')}</Text>
            </PressableScale>
          </Animated.View>
        ) : (
          <Animated.View key="hint" entering={footerIn} exiting={footerOut}>
            <Text style={[styles.hint, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(18,18,18,0.5)' }]} onPress={() => goTo(index + 1)}>
              {t('onboarding.tapHint')}
            </Text>
          </Animated.View>
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
        <Text style={[styles.stage, { color: 'rgba(18,18,18,0.55)' }]}>{t('onboarding.stage', { n: 1 })}</Text>
      </Animated.View>
      <Animated.View entering={stagger(2)}>
        <Text style={[styles.title, { color: fixed.ink }]}>{t('onboarding.s1Title')}</Text>
      </Animated.View>
      <Animated.View entering={stagger(3)}>
        <Text style={[styles.text, { color: 'rgba(18,18,18,0.7)' }]}>{t('onboarding.s1Text')}</Text>
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
      {/* «Skanerla. Bo'ling. Tayyor!» — весь продукт одной картинкой */}
      <Animated.View entering={stagger(1)}>
        <Image source={STICKER.howItWorks} style={styles.slideSticker} resizeMode="contain" />
      </Animated.View>
      <Animated.View entering={stagger(2)}>
        <Text style={[styles.stage, { color: 'rgba(255,255,255,0.5)' }]}>{t('onboarding.stage', { n: 2 })}</Text>
      </Animated.View>
      <Animated.View entering={stagger(3)}>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>
          {t('onboarding.s2TitleA')}
          {'\n'}
          {t('onboarding.s2TitleB')}
        </Text>
      </Animated.View>
      <Animated.View entering={stagger(4)}>
        <Text style={[styles.text, { color: 'rgba(255,255,255,0.65)' }]}>{t('onboarding.s2Text')}</Text>
      </Animated.View>
      <Animated.View entering={stagger(5)} style={styles.chipRow}>
        {chips.map((c, i) => (
          <View
            key={c}
            style={[styles.chip, { backgroundColor: i === 0 ? fixed.lime : 'rgba(245,243,238,0.12)' }]}
          >
            <Text style={[i === 0 ? styles.chipTextActive : styles.chipText, { color: i === 0 ? fixed.ink : '#F5F3EE' }]}>{t(c)}</Text>
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
      <Animated.View entering={stagger(0)} style={[styles.cafeRow, SCREEN_W < 360 && { transform: [{ scale: 0.86 }] }]}>
        {CAFES.map((c, ci) => (
          <View
            key={ci}
            style={[
              styles.cafeChip,
              {
                width: c.w,
                marginLeft: ci ? -8 : 0,
                zIndex: CAFES.length - ci,
                backgroundColor: c.bg ?? 'rgba(255,255,255,0.9)',
              },
            ]}
          >
            <Image
              source={c.src}
              style={c.bg ? styles.cafeLogoFull : { height: c.h ?? 30, width: c.w - 12 }}
              resizeMode="contain"
            />
          </View>
        ))}
        <View style={[styles.cafeChip, { width: 84, marginLeft: -8, backgroundColor: 'rgba(255,255,255,0.9)' }]}>
          <SvgXml xml={OQTEPA_XML} width={64} height={20} />
        </View>
      </Animated.View>
      <Animated.View entering={stagger(1)}>
        <Text style={[styles.stage, { color: 'rgba(18,18,18,0.55)' }]}>{t('onboarding.stage', { n: 3 })}</Text>
      </Animated.View>
      <Animated.View entering={stagger(2)}>
        <Text style={[styles.title, { color: fixed.ink }]}>
          {t('onboarding.s3TitleA')}
          {'\n'}
          {t('onboarding.s3TitleB')}
        </Text>
      </Animated.View>
      <Animated.View entering={stagger(3)}>
        <Text style={[styles.text, { color: 'rgba(18,18,18,0.7)' }]}>{t('onboarding.s3Text')}</Text>
      </Animated.View>
      <Animated.View entering={stagger(4)} style={[styles.counter, { backgroundColor: fixed.ink }]}>
        <CountUp value={60000} prefix="+" duration={1400} style={[styles.counterAmount, { color: fixed.lime }]} />
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
  cafeRow: { flexDirection: 'row', alignItems: 'center', transformOrigin: 'left center' },
  cafeChip: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(18,18,18,0.06)',
    shadowColor: '#1E1C10',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  cafeLogoFull: { width: '100%', height: '100%', padding: 3 },
  haveAccount: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  haveAccountText: { fontFamily: font.bold, fontSize: 16 },
  root: { paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  wordmark: { height: 56, width: 84 },

  stageArea: { flex: 1 },
  stage: { fontFamily: font.monoBold, fontSize: 10.5, letterSpacing: 1.7 },
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
  slideSticker: { width: 168, height: 150, marginTop: 14, marginBottom: 2 },
  title: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -1.2, lineHeight: 42 },
  text: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21, maxWidth: 310 },

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
  chipTextActive: { fontFamily: font.extrabold, fontSize: 12.5 },

  counter: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 18, borderRadius: 999 },
  counterAmount: { fontFamily: font.extrabold, fontSize: 14 },
  counterLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },

  footer: { paddingTop: 16, paddingBottom: 32 },
  gap: { height: 10 },
  hint: { fontFamily: font.bold, fontSize: 12.5, textAlign: 'center', paddingVertical: 18 },
});
