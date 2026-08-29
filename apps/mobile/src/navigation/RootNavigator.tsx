// Маршрутизация по стадии сессии — тот же контракт, что и гард роутера в вебе:
// onboarding → phone → code → pin → authed. После входа монтируется стек
// приложения: вкладки внизу + экраны «вглубь» поверх них.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { PhoneScreen } from '@/screens/PhoneScreen';
import { CodeScreen } from '@/screens/CodeScreen';
import { PinScreen } from '@/screens/PinScreen';
import { SoonScreen } from '@/screens/SoonScreen';
import { TabNavigator } from '@/navigation/TabNavigator';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export type RootStackParamList = {
  Onboarding: undefined;
  Phone: undefined;
  Code: undefined;
  Pin: undefined;
  Tabs: undefined;
  // экраны следующих чанков — маршруты объявлены заранее, чтобы переходы с
  // главной уже работали и вели назад, а не были мёртвыми нажатиями
  Scan: undefined;
  SplitLive: { id: string };
  Group: { id: string };
  Debts: undefined;
  Cashback: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { colors, name } = useTheme();
  const stage = useSession((s) => s.stage);
  const hydrated = useSession((s) => s.hydrated);

  if (!hydrated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.cream }]}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  const navTheme = name === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: { ...navTheme.colors, background: colors.cream, primary: colors.lime, text: colors.ink },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // свайп-назад на iOS; на Android аппаратная кнопка работает штатно
          gestureEnabled: true,
        }}
      >
        {stage === 'onboarding' && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
        {stage === 'phone' && <Stack.Screen name="Phone" component={PhoneScreen} />}
        {stage === 'code' && <Stack.Screen name="Code" component={CodeScreen} />}
        {stage === 'pin' && <Stack.Screen name="Pin" component={PinScreen} />}
        {stage === 'authed' && (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            {/* сканер — полноэкранный «захват», поэтому выезжает снизу */}
            <Stack.Screen name="Scan" component={SoonScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="SplitLive" component={SoonScreen} />
            <Stack.Screen name="Group" component={SoonScreen} />
            <Stack.Screen name="Debts" component={SoonScreen} />
            <Stack.Screen name="Cashback" component={SoonScreen} />
            <Stack.Screen name="Profile" component={SoonScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
