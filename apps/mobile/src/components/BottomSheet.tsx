// Общий шит: пружинный вход с лёгким overshoot, drag-to-dismiss с резинкой
// и velocity-релизом, контент стаггерится после приземления — как
// web/src/components/BottomSheet.vue.
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  /** шит нельзя утащить вниз — например, пока идёт оплата */
  locked?: boolean;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, locked, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const y = useSharedValue(height);

  useEffect(() => {
    if (open) {
      // лёгкий overshoot: шит «доезжает» и слегка отыгрывает назад
      y.value = withSpring(0, { damping: 18, stiffness: 260, mass: 0.7 });
    } else {
      y.value = withTiming(height, { duration: 200 });
    }
  }, [open, height, y]);

  const pan = Gesture.Pan()
    .enabled(!locked)
    .onChange((e) => {
      // тянем только вниз; вверх — резинка
      y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.2;
    })
    .onEnd((e) => {
      const far = y.value > 120;
      const fast = e.velocityY > 800;
      if (far || fast) {
        y.value = withTiming(height, { duration: 180 }, () => runOnJS(onClose)());
      } else {
        y.value = withSpring(0, { damping: 18, stiffness: 260, mass: 0.7 });
      }
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={styles.backdropWrap}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={locked ? undefined : onClose}
        />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: colors.paper, paddingBottom: insets.bottom + 14 },
            panelStyle,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.stone }]} />
          {children}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, marginBottom: 14 },
});
