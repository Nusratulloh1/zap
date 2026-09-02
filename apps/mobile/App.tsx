// Корень приложения: жесты → тема → i18n → сеть → навигация.
// Порядок важен: gesture-handler обязан быть самым внешним.
import React, { useRef, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ToastHost } from '@/components/ToastHost';
import { LaunchOverlay } from '@/components/LaunchOverlay';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime';
import { qk } from '@/api/data';
import { useSession } from '@/store/session';
import '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  const lastBackground = useRef(0);
  const hydrate = useSession((s) => s.hydrate);
  // Оверлей входа живёт ровно один холодный старт: при возврате из фона его
  // быть не должно — это не событие, а запуск.
  const [launched, setLaunched] = useState(false);
  const hydrated = useSession((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // сокет: в фоне отключаем (батарея), при возврате переподключаем и
  // перезапрашиваем данные — пропущенное событие не оставляет старый UI
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        connectRealtime();
        // короткий свайп в другое приложение не должен перезагружать базу
        const away = Date.now() - lastBackground.current;
        if (away > 30_000) void queryClient.invalidateQueries({ queryKey: qk.bootstrap });
      } else if (state === 'background') {
        lastBackground.current = Date.now();
        disconnectRealtime();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
        initialMetrics обязателен: без него провайдер измеряет безопасные зоны
        асинхронно, и ПЕРВЫЙ кадр после холодного старта рисуется с нулевыми
        отступами — шапка уезжает под статус-бар (у итогов месяца пропадали
        полоски прогресса и срезался логотип). Со второго открытия значения уже
        известны, поэтому баг выглядел плавающим. Метрики отдаёт нативная
        сторона синхронно на старте.
      */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator />
            <ToastHost />
            {launched ? null : <LaunchOverlay ready={hydrated} onDone={() => setLaunched(true)} />}
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
