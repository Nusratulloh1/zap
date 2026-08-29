// Маршрутизация по стадии сессии — тот же контракт, что и гард роутера в вебе:
// onboarding → phone → code → pin → authed. После входа — вкладки + экраны
// «вглубь». Диплинки zapapp.uz/s/CODE ведут на экран участника.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { PhoneScreen } from '@/screens/PhoneScreen';
import { CodeScreen } from '@/screens/CodeScreen';
import { PinScreen } from '@/screens/PinScreen';
import { MembersScreen } from '@/screens/MembersScreen';
import { ShareScreen } from '@/screens/ShareScreen';
import { SplitLiveScreen } from '@/screens/SplitLiveScreen';
import { SplitClosedScreen } from '@/screens/SplitClosedScreen';
import { SaveGroupScreen } from '@/screens/SaveGroupScreen';
import { CashbackAwardScreen } from '@/screens/CashbackAwardScreen';
import { GroupScreen } from '@/screens/GroupScreen';
import { DebtsScreen } from '@/screens/DebtsScreen';
import { CashbackScreen } from '@/screens/CashbackScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { BillScreen } from '@/screens/BillScreen';
import { ReviewItemsScreen } from '@/screens/ReviewItemsScreen';
import { ScanScreen } from '@/screens/ScanScreen';
import { ParticipantScreen } from '@/screens/ParticipantScreen';
import { TabNavigator } from '@/navigation/TabNavigator';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme/ThemeProvider';

export type RootStackParamList = {
  Onboarding: undefined;
  Phone: undefined;
  Code: undefined;
  Pin: undefined;
  Tabs: undefined;
  Scan: undefined;
  Bill: undefined;
  ReviewItems: undefined;
  Members: undefined;
  Share: { id: string };
  SplitLive: { id: string };
  SplitClosed: { id: string };
  SaveGroup: { id: string };
  CashbackAward: { id: string };
  Group: { id: string };
  Debts: undefined;
  Cashback: undefined;
  Profile: undefined;
  Participant: { code: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// диплинки: ссылка сплита открывает экран участника прямо в приложении
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://zapapp.uz', 'zap://'],
  config: {
    screens: {
      Participant: 's/:code',
    },
  },
};

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
      linking={linking}
      theme={{
        ...navTheme,
        colors: { ...navTheme.colors, background: colors.cream, primary: colors.lime, text: colors.ink },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
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
            {/* сканер и итоги — полноэкранные «захваты», выезжают снизу */}
            <Stack.Screen name="Scan" component={ScanScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Bill" component={BillScreen} />
            <Stack.Screen name="ReviewItems" component={ReviewItemsScreen} />
            <Stack.Screen name="Members" component={MembersScreen} />
            <Stack.Screen name="Share" component={ShareScreen} />
            <Stack.Screen name="SplitLive" component={SplitLiveScreen} />
            <Stack.Screen name="SplitClosed" component={SplitClosedScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="SaveGroup" component={SaveGroupScreen} />
            <Stack.Screen name="CashbackAward" component={CashbackAwardScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Group" component={GroupScreen} />
            <Stack.Screen name="Debts" component={DebtsScreen} />
            <Stack.Screen name="Cashback" component={CashbackScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Participant" component={ParticipantScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
