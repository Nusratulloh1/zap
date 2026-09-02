// Плавающий пилл-навигатор (дизайн 4b/5i): главная · пад суммы · история.
// Активная вкладка — в круге: лайм у главной и истории, чернила с лаймовыми
// точками у пада, как в вебе.
//
// Настоящего блюра нет: в проекте не стоит нативная библиотека размытия
// (@react-native-community/blur), поэтому пилл — плотная тёмная подложка.
// Если понадобится именно стекло — это отдельная нативная зависимость.
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { HomeIcon, ClockIcon } from '@/components/icons';

const ICON = { Home: 'home', Amount: 'grid', History: 'clock' } as const;
type IconKind = (typeof ICON)[keyof typeof ICON];

/** Общая сетка иконок таб-бара. */
const ICON_SIZE = 24;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { fixed } = useTheme();
  /*
    Пилл всегда тёмный и полупрозрачный.

    От блюра отказались осознанно: UIVisualEffectView честно размывал фон, но
    светлый материал поверх светлой темы визуально не отличался от сплошной
    заливки — «стекла» не было видно ни на одном материале, вплоть до
    ultraThin. Тёмный полупрозрачный слой на светлом контенте даёт тот эффект,
    ради которого блюр и ставили: сквозь пилл видно, что под ним.

    Иконки при этом всегда светлые — на тёмной подложке иначе не прочитать.
  */
  const dark = true;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.min(insets.bottom, 20) + 10 }]}>
      <View style={[styles.pill, styles.pillSurface]}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const kind = ICON[route.name as keyof typeof ICON] ?? 'home';
          return (
            <TabButton
              key={route.key}
              kind={kind}
              focused={focused}
              lime={fixed.lime}
              dark={dark}
              onPress={() => {
                trigger(Platform.OS === 'ios' ? 'selection' : 'impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
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
  dark,
  onPress,
}: {
  kind: IconKind;
  focused: boolean;
  lime: string;
  dark?: boolean;
  onPress: () => void;
}) {
  // 200 мс морф активного состояния — как в вебе
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    v.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, v]);
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
        <Icon kind={kind} focused={focused} lime={lime} dark={dark} />
      </Animated.View>
    </PressableScale>
  );
}

/** Иконки нарисованы View-примитивами: react-native-svg в проекте нет. */
function Icon({ kind, focused, lime, dark }: { kind: IconKind; focused: boolean; lime: string; dark?: boolean }) {
  // неактивные приглушены; в тёмной теме — светлые (как .tab-btn в вебе)
  const on = focused ? '#111110' : dark ? 'rgba(245,243,238,0.7)' : 'rgba(17,17,16,0.55)';

  if (kind === 'grid') {
    // пад суммы: шесть точек; на активном чернильном круге они лаймовые
    const dot = focused ? lime : on;
    return (
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: dot }]} />
        ))}
      </View>
    );
  }

  // один размер на все три вкладки: иконки нарисованы по-разному (два SVG и
  // сетка из вью), и без общей сетки 24×24 они читались разнокалиберными
  if (kind === 'home') return <HomeIcon size={ICON_SIZE} color={on} />;
  return <ClockIcon size={ICON_SIZE} color={on} />;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  // непрозрачность подобрана так, чтобы контент под пиллом угадывался, но
  // иконки на нём оставались читаемыми
  pillSurface: { backgroundColor: 'rgba(17,17,16,0.72)', borderColor: 'rgba(255,255,255,0.12)' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    // подложка по теме — как no-blur фолбэк .zap-tabbar в вебе
    borderWidth: 1,
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
  // 3 точки × 6px + 2 зазора × 3px = 24px — ровно бокс SVG-иконок соседних вкладок
  grid: { width: ICON_SIZE, flexDirection: 'row', flexWrap: 'wrap', gap: 3, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 999 },
  clock: { width: 21, height: 21, borderRadius: 999, borderWidth: 2.2, alignItems: 'center', justifyContent: 'center' },
  handV: { position: 'absolute', width: 2, height: 6, borderRadius: 2, top: 3.5 },
  handH: { position: 'absolute', width: 5, height: 2, borderRadius: 2, left: 9.5, top: 8.6 },
});
