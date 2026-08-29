// Плавающий пилл-навигатор (дизайн 4b/5i): главная · пад суммы · история.
// Активная вкладка — в круге: лайм у главной и истории, чернила с лаймовыми
// точками у пада, как в вебе.
//
// Настоящего блюра нет: в проекте не стоит нативная библиотека размытия
// (@react-native-community/blur), поэтому пилл — плотная тёмная подложка.
// Если понадобится именно стекло — это отдельная нативная зависимость.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';

const ICON = { Home: 'home', Amount: 'grid', History: 'clock' } as const;
type IconKind = (typeof ICON)[keyof typeof ICON];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { fixed } = useTheme();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + 14 }]}>
      <View style={styles.pill}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const kind = ICON[route.name as keyof typeof ICON] ?? 'home';
          return (
            <TabButton
              key={route.key}
              kind={kind}
              focused={focused}
              lime={fixed.lime}
              onPress={() => {
                trigger('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  kind,
  focused,
  lime,
  onPress,
}: {
  kind: IconKind;
  focused: boolean;
  lime: string;
  onPress: () => void;
}) {
  // 200 мс морф активного состояния — как в вебе
  const v = useSharedValue(focused ? 1 : 0);
  v.value = withTiming(focused ? 1 : 0, { duration: 200 });
  const pop = useSharedValue(1);

  const bg = useAnimatedStyle(() => ({
    opacity: v.value,
    backgroundColor: kind === 'grid' ? '#111110' : lime,
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <PressableScale
      small
      haptic={false}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      style={styles.btn}
      onPress={() => {
        pop.value = 0.72;
        pop.value = withSpring(1, { damping: 9, stiffness: 320, mass: 0.5 });
        onPress();
      }}
    >
      <Animated.View style={[styles.activeBg, bg]} />
      <Animated.View style={iconStyle}>
        <Icon kind={kind} focused={focused} lime={lime} />
      </Animated.View>
    </PressableScale>
  );
}

/** Иконки нарисованы View-примитивами: react-native-svg в проекте нет. */
function Icon({ kind, focused, lime }: { kind: IconKind; focused: boolean; lime: string }) {
  const on = focused ? '#111110' : '#FFFFFF';

  if (kind === 'grid') {
    // пад суммы: шесть точек; на активном чернильном круге они лаймовые
    const dot = focused ? lime : '#FFFFFF';
    return (
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: dot }]} />
        ))}
      </View>
    );
  }

  if (kind === 'home') {
    return (
      <View style={styles.icon}>
        <View style={[styles.roof, { borderBottomColor: on }]} />
        <View style={[styles.house, { borderColor: on }]}>
          <View style={[styles.door, { backgroundColor: on }]} />
        </View>
      </View>
    );
  }

  // часы
  return (
    <View style={[styles.clock, { borderColor: on }]}>
      <View style={[styles.handV, { backgroundColor: on }]} />
      <View style={[styles.handH, { backgroundColor: on }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(24,24,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  btn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  activeBg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999 },
  icon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  house: { width: 16, height: 11, borderWidth: 2.2, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  door: { width: 4.5, height: 6 },
  grid: { width: 19, height: 19, flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 999 },
  clock: { width: 21, height: 21, borderRadius: 999, borderWidth: 2.2, alignItems: 'center', justifyContent: 'center' },
  handV: { position: 'absolute', width: 2, height: 6, borderRadius: 2, top: 3.5 },
  handH: { position: 'absolute', width: 5, height: 2, borderRadius: 2, left: 9.5, top: 8.6 },
});
