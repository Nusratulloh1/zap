// Корень приложения: жесты → тема → i18n → сеть → навигация.
// Порядок важен: gesture-handler обязан быть самым внешним.
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ToastHost } from '@/components/ToastHost';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime';
import { qk } from '@/api/data';
import { useSession } from '@/store/session';
import '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  const hydrate = useSession((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // сокет: в фоне отключаем (батарея), при возврате переподключаем и
  // перезапрашиваем данные — пропущенное событие не оставляет старый UI
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        connectRealtime();
        void queryClient.invalidateQueries({ queryKey: qk.bootstrap });
      } else if (state === 'background') {
        disconnectRealtime();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator />
            <ToastHost />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
