// Маршрутизация по стадии сессии — тот же контракт, что и гард роутера в вебе:
// onboarding → phone → code → pin → authed. После входа — вкладки + экраны
// «вглубь». Диплинки zapapp.uz/s/CODE ведут на экран участника.
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { attachPushHandlers } from '@/lib/push';
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
import { RecapScreen } from '@/screens/RecapScreen';
import { PhotoMomentScreen } from '@/screens/PhotoMomentScreen';
import { TabNavigator } from '@/navigation/TabNavigator';
import { useSession } from '@/store/session';
import { ZapLoader } from '@/components/ZapLoader';
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
  Recap: undefined;
  PhotoMoment: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// диплинки: ссылка сплита открывает экран участника прямо в приложении
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://zapapp.uz', 'zap://'],
  config: {
    screens: {
      Participant: 's/:code',
          Group: 'g/:id',
    },
  },
};


/**
 * Нажатие на пуш открывает нужный экран.
 *
 * Ссылка на навигацию берётся через ref, а не через хук: уведомление может
 * прийти, когда ни один экран не смонтирован (приложение было закрыто), и
 * навигировать надо из обработчика верхнего уровня.
 */
const navRef = createNavigationContainerRef<RootStackParamList>();

function usePushRouting(): void {
  useEffect(() => {
    return attachPushHandlers((data) => {
      if (!navRef.isReady()) return;
      if (data.type === 'split' && data.splitId) {
        navRef.navigate('SplitLive', { id: data.splitId });
      }
    });
  }, []);
}

export function RootNavigator() {
  const { colors, name } = useTheme();
  const stage = useSession((s) => s.stage);
  usePushRouting();
  const hydrated = useSession((s) => s.hydrated);

  if (!hydrated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.cream }]}>
        <ZapLoader size="lg" />
      </View>
    );
  }

  const navTheme = name === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      ref={navRef}
      linking={linking}
      theme={{
        ...navTheme,
        colors: { ...navTheme.colors, background: colors.cream, primary: colors.lime, text: colors.ink },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // iOS получает системный push с параллаксом и полноэкранным
          // свайпом назад, Android — быстрый слайд
          animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
          ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true } : { animationDuration: 220 }),
          gestureEnabled: true,
          freezeOnBlur: true,
        }}
      >
        {stage === 'onboarding' && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
        {stage === 'phone' && <Stack.Screen name="Phone" component={PhoneScreen} />}
        {stage === 'code' && <Stack.Screen name="Code" component={CodeScreen} />}
        {stage === 'pin' && <Stack.Screen name="Pin" component={PinScreen} />}
        {stage === 'authed' && (
          <Stack.Group>
            {/* корень: обычная карточка во весь экран — никогда не модалка */}
            <Stack.Screen name="Tabs" component={TabNavigator} options={{ presentation: 'card' }} />
            {/*
              Сканер и итоги — полноэкранные «захваты», выезжают снизу.

              На iOS это ИМЕННО fullScreenModal, а не 'modal'. 'modal' в
              native-stack — это UIModalPresentationPageSheet: карточка с
              «ручкой» сверху, скруглёнными углами и щелями по краям. Хуже
              того, всё, что попадает в этот слот дальше (Scan делает
              replace на Bill/Members/Participant), наследует ту же
              презентацию — и весь флоу сплита ехал внутри шита.
              fullScreenModal даёт тот же выезд снизу, но во весь экран.
            */}
            <Stack.Screen name="Scan" component={ScanScreen} options={Platform.OS === 'ios' ? { presentation: 'fullScreenModal' } : { animation: 'slide_from_bottom' }} />
            {/*
              Счёт въезжает затуханием, а не слайдом: к этому моменту
              QrToReceipt уже развернул бумагу на весь кадр, и сдвиг экрана
              разорвал бы «код превратился в чек» пополам.
            */}
            <Stack.Screen name="Bill" component={BillScreen} options={{ animation: 'fade', animationDuration: 200 }} />
            <Stack.Screen name="ReviewItems" component={ReviewItemsScreen} />
            <Stack.Screen name="Members" component={MembersScreen} />
            <Stack.Screen name="Share" component={ShareScreen} />
            <Stack.Screen name="SplitLive" component={SplitLiveScreen} />
            {/*
              Итог приходит сразу после празднования «все оплатили»: выезд
              снизу читался как «поверх успеха выскочил ещё один экран».
              Затухание держит это одним движением, а не двумя.
            */}
            <Stack.Screen name="SplitClosed" component={SplitClosedScreen} options={Platform.OS === 'ios' ? { presentation: 'fullScreenModal', animation: 'fade' } : { animation: 'fade', animationDuration: 260 }} />
            <Stack.Screen name="SaveGroup" component={SaveGroupScreen} />
            <Stack.Screen name="CashbackAward" component={CashbackAwardScreen} options={Platform.OS === 'ios' ? { presentation: 'fullScreenModal' } : { animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Group" component={GroupScreen} />
            <Stack.Screen name="Debts" component={DebtsScreen} />
            <Stack.Screen name="Cashback" component={CashbackScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Participant" component={ParticipantScreen} options={{ animation: 'fade', animationDuration: 200 }} />
            <Stack.Screen name="PhotoMoment" component={PhotoMomentScreen} options={Platform.OS === 'ios' ? { presentation: 'fullScreenModal' } : { animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Recap" component={RecapScreen} options={Platform.OS === 'ios' ? { presentation: 'fullScreenModal' } : { animation: 'slide_from_bottom' }} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
