// Маршрутизация по стадии сессии — тот же контракт, что и гард роутера в вебе:
// onboarding → phone → code → pin → authed.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { PhoneScreen } from '@/screens/PhoneScreen';
import { CodeScreen } from '@/screens/CodeScreen';
import { PinScreen } from '@/screens/PinScreen';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export type RootStackParamList = {
  Onboarding: undefined;
  Phone: undefined;
  Code: undefined;
  Pin: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Заглушка фазы 2 — главный экран приедет следующей фазой. */
function HomePlaceholder() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const me = useSession((s) => s.me);
  return (
    <View style={[styles.center, { backgroundColor: colors.cream }]}>
      <Text style={[styles.big, { color: colors.ink }]}>{t('tabs.home')}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{me?.name || me?.phone || '—'}</Text>
    </View>
  );
}

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
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {stage === 'onboarding' && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
        {stage === 'phone' && <Stack.Screen name="Phone" component={PhoneScreen} />}
        {stage === 'code' && <Stack.Screen name="Code" component={CodeScreen} />}
        {stage === 'pin' && <Stack.Screen name="Pin" component={PinScreen} />}
        {stage === 'authed' && <Stack.Screen name="Home" component={HomePlaceholder} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  big: { fontFamily: font.extrabold, fontSize: 32 },
  sub: { fontFamily: font.semibold, fontSize: 15 },
});
