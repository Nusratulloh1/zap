// Тосты — как в вебе: тёмная плашка сверху, success с лаймовой галкой.
// Стор глобальный (zustand), хост монтируется один раз в App.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeOutUp,
  withSpring,
  withTiming,
  type EntryAnimationsValues,
} from 'react-native-reanimated';
import { SPRING_GENTLE } from '@/lib/motion';

// вход тоста с лёгким перелётом — web .toast-enter (cubic-bezier(.34,1.4,.5,1))
const toastIn = (values: EntryAnimationsValues) => {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -16 }, { scale: 0.96 }] },
    animations: {
      opacity: withTiming(1, { duration: 220 }),
      transform: [{ translateY: withSpring(0, SPRING_GENTLE) }, { scale: withSpring(1, SPRING_GENTLE) }],
    },
  };
};
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

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(hide, 2600);
    return () => clearTimeout(id);
  }, [msg, seq, hide]);

  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View key={seq} entering={toastIn} exiting={FadeOutUp.duration(200)} style={styles.pill}>
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
