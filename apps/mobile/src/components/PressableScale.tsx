// Пресс-фидбек как в вебе: элемент сжимается при нажатии и пружинит обратно.
// Анимация живёт на UI-потоке (reanimated), поэтому не спотыкается о JS.
import React from 'react';
import { Platform, Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import { DUR, EASE_OUT_QUAD, SPRING_GENTLE } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** мелкие круглые кнопки сжимаются заметнее — как .press в вебе */
  small?: boolean;
  /** крупная кнопка действия: помимо сжатия «проседает» на 1px (web motion.ts) */
  primary?: boolean;
  haptic?: boolean;
  children?: React.ReactNode;
}

export function PressableScale({ style, small, primary, haptic = Platform.OS !== 'ios', children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const sink = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: sink.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withTiming(small ? 0.9 : 0.96, { duration: DUR.fast, easing: EASE_OUT_QUAD });
        if (primary) sink.value = withTiming(1, { duration: DUR.fast, easing: EASE_OUT_QUAD });
        if (haptic) trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 18, stiffness: 420, mass: 0.6 });
        if (primary) sink.value = withSpring(0, SPRING_GENTLE);
        rest.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
