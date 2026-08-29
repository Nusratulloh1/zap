// Общий шит: пружинный вход с лёгким overshoot, drag-to-dismiss с резинкой
// и velocity-релизом, контент стаггерится после приземления — как
// web/src/components/BottomSheet.vue.
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { EASE_ZAP, STAGGER_STEP } from '@/lib/motion';
import { keyboardLift, useKeyboardHeight } from '@/lib/keyboard';

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
  // с клавиатурой шит едет вверх: edge-to-edge не двигает низ окна сам
  const kb = useKeyboardHeight();

  const y = useSharedValue(height);

  useEffect(() => {
    if (open) {
      // из-за нижней границы к месту, без отскока: spring перелетал
      // выше и «падал» обратно — выглядело как прыжок
      y.value = height;
      // как в вебе: доезжает на -4px и мягко возвращается
      y.value = withSequence(
        withTiming(-4, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 140, easing: EASE_ZAP }),
      );
    } else {
      y.value = withTiming(height, { duration: 240, easing: EASE_ZAP });
    }
  }, [open, height, y]);

  const pan = Gesture.Pan()
    .enabled(!locked)
    .onChange((e) => {
      // тянем только вниз; вверх — резинка
      y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.2;
    })
    .onEnd((e) => {
      const far = y.value > height * 0.35;
      const fast = e.velocityY > 800;
      if (far || fast) {
        y.value = withTiming(height, { duration: 180 }, () => runOnJS(onClose)());
      } else {
        y.value = withSpring(0, { damping: 14, stiffness: 180, mass: 0.8 });
      }
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
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
            { backgroundColor: colors.paper, paddingBottom: insets.bottom + 16, bottom: keyboardLift(kb, insets.bottom) },
            panelStyle,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.stone }]} />
          {React.Children.map(children, (child, i) =>
            React.isValidElement(child) ? (
              <Animated.View
                entering={FadeInDown.duration(280)
                  .delay(160 + i * STAGGER_STEP)
                  .easing(EASE_ZAP)
                  .withInitialValues({ transform: [{ translateY: 10 }] })}
              >
                {child}
              </Animated.View>
            ) : (
              child
            ),
          )}
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
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, marginBottom: 14 },
});
