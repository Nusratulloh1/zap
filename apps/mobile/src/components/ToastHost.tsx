// Тосты — как в вебе: тёмная плашка сверху, success с лаймовой галкой.
// Стор глобальный (zustand), хост монтируется один раз в App.
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SPRING_GENTLE } from '@/lib/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { font } from '@/theme/tokens';

interface ToastState {
  msg: string | null;
  ok: boolean;
  seq: number;
  show: (msg: string, ok?: boolean) => void;
  hide: () => void;
}

const useToastStore = create<ToastState>((set) => ({
  msg: null,
  ok: false,
  seq: 0,
  show: (msg, ok = false) => set((s) => ({ msg, ok, seq: s.seq + 1 })),
  hide: () => set({ msg: null }),
}));

/** toast('текст') / toast.success('текст') — API как в вебе. */
export const toast = Object.assign((msg: string) => useToastStore.getState().show(msg, false), {
  success: (msg: string) => useToastStore.getState().show(msg, true),
});

export function ToastHost() {
  const { msg, ok, seq, hide } = useToastStore();
  const insets = useSafeAreaInsets();

  // Анимация на shared value, а НЕ на layout-анимациях (entering/exiting).
  // Внутри FullWindowOverlay это отдельное UIWindow, создаваемое под каждый
  // тост: layout-анимации там срываются — плашка появляется рывком и застывает.
  // Ручная прогрессия таких проблем не имеет, потому что живёт на UI-потоке
  // и не зависит от монтирования вью в новом окне.
  const p = useSharedValue(0);

  useEffect(() => {
    if (!msg) return;
    p.value = 0;
    p.value = withSpring(1, SPRING_GENTLE);
    const id = setTimeout(() => {
      // уводим плашку сами и только потом чистим стор — иначе вью исчезнет
      // мгновенно, без ухода
      p.value = withTiming(0, { duration: 200 }, (done) => {
        if (done) runOnJS(hide)();
      });
    }, 2600);
    return () => clearTimeout(id);
  }, [msg, seq, hide, p]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: -16 + p.value * 16 }, { scale: 0.96 + p.value * 0.04 }],
  }));

  if (!msg) return null;

  const body = (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View style={[styles.pill, pillStyle]}>
        {ok ? (
          <View style={styles.check}>
            <Text style={styles.checkGlyph}>✓</Text>
          </View>
        ) : null}
        <Text style={styles.text} numberOfLines={2}>
          {msg}
        </Text>
      </Animated.View>
    </View>
  );

  // На iOS экраны с presentation: 'modal' (сканер, итоги сплита, кешбэк)
  // показываются отдельным UIViewController поверх корневого — тост, живущий
  // в корне рядом с навигатором, оказывается ПОД ними и его просто не видно.
  // Из-за этого сканер молча уходил в режим фото: сообщение «чек не распознан»
  // отправлялось, но не отображалось. FullWindowOverlay рендерит в отдельное
  // UIWindow поверх всего, включая модалки. На Android модалки — часть той же
  // иерархии, там оверлей не нужен.
  return Platform.OS === 'ios' ? <FullWindowOverlay>{body}</FullWindowOverlay> : body;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, zIndex: 99, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    maxWidth: '100%',
    backgroundColor: 'rgba(24,24,22,0.96)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  check: { width: 18, height: 18, borderRadius: 999, backgroundColor: '#DDFF33', alignItems: 'center', justifyContent: 'center' },
  checkGlyph: { fontSize: 11, fontFamily: font.extrabold, color: '#111110' },
  text: { fontFamily: font.bold, fontSize: 13.5, color: '#FFFFFF', flexShrink: 1 },
});
