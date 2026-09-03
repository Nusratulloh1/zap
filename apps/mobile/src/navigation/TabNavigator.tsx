// Три вкладки из дизайна: главная · пад суммы · история. Таб-бар свой
// (components/TabBar), стандартный скрыт — он не совпадает с дизайном.
//
// Переключение вкладок — кроссфейд без сдвига: вкладки одного уровня, боковая
// анимация читалась бы как переход «вглубь».
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '@/screens/HomeScreen';
import { HomeScreenV2 } from '@/screens/HomeScreenV2';
import { useHomeVariant } from '@/lib/homeVariant';
import { AmountScreen } from '@/screens/AmountScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { TabBar } from '@/components/TabBar';

export type TabParamList = {
  Home: undefined;
  Amount: { memberIds?: string[] } | undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  /*
    A/B: главных две. Классическая — та, что была; «Pulse» — перенос прототипа.
    Выбор живёт в профиле и хранится локально, остальные вкладки общие.
  */
  const variant = useHomeVariant();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        // экраны вкладок держатся смонтированными: возврат на главную не
        // перезапрашивает данные и не теряет позицию скролла
        lazy: true,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tab.Screen name="Home" component={variant === 'pulse' ? HomeScreenV2 : HomeScreen} />
      <Tab.Screen name="Amount" component={AmountScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
