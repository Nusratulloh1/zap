// Плавающий пилл-навигатор (дизайн 4b/5i): главная · пад суммы · история.
// Активная вкладка — в круге: лайм у главной и истории, чернила с лаймовыми
// точками у пада, как в вебе.
//
// Стекло собрано ровно как в вебе (.zap-tabbar в apps/web/src/styles/main.css):
// белая подложка с НИЗКОЙ альфой, размытие, светлая рамка, верхний глянец и
// мягкая тень. Низкая альфа там оговорена отдельно: при 0.5+ подложка «съедает»
// размытие и пилл выглядит сплошным.
//
// Тёмный пилл, который был здесь до этого, — моя ошибка: я ориентировался на
// скриншоты в тёмной теме, а не на веб-исходник.
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import { Glass } from '@/components/Glass';
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
  // пилл светлый, как в вебе — значит иконки чернильные
  const dark = false;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.min(insets.bottom, 20) + 10 }]}>
      <Glass thin fallback="rgba(255,255,255,0.86)" style={[styles.pill, styles.pillSurface]}>
        {/* верхний глянец — блик на стекле, .zap-tabbar::before из веба */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="tabGloss" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
              <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <SvgRect x={0} y={0} width="100%" height="100%" fill="url(#tabGloss)" />
        </Svg>
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
      </Glass>
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
  // Собственный тинт снят полностью: любой белый слой поверх материала делает
  // пилл плотнее, а материал iOS и так подсветляет фон. Осталась только рамка,
  // чтобы пилл не растворялся на светлом контенте, и размытие.
  pillSurface: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.45)' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    // подложка по теме — как no-blur фолбэк .zap-tabbar в вебе
    borderWidth: 1,
    shadowColor: '#111110',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
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
