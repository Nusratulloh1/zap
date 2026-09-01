// Пуш-уведомления: регистрация токена и обработка нажатия.
//
// Нативный модуль подключается «мягко», как звук и снимок карточки. Причина
// жёсткая: @react-native-firebase требует google-services.json на этапе
// сборки, и без него Android-сборка ПАДАЕТ. Пока файла нет, приложение должно
// собираться и работать — просто без пушей.
//
// Как включить (после того, как в Firebase заведён проект):
//   npm i @react-native-firebase/app @react-native-firebase/messaging
//   android/app/google-services.json      — из консоли Firebase
//   ios/GoogleService-Info.plist          — оттуда же
//   пересборка (см. docs/mobile/RUN.md)
// Код ниже менять не нужно: require подхватит модуль сам.
//
// Разрешение спрашиваем НЕ на первом запуске: человек ещё не понимает, зачем
// ему уведомления. Спрашиваем после первого сплита — в этот момент смысл
// очевиден («узнаешь, когда друг оплатит»).
import { Platform } from 'react-native';
import { http } from '@/api/client';
import { storage } from '@/theme/ThemeProvider';
import { currentLocale } from '@/i18n';

const ASKED_KEY = 'zap:push-asked';
const TOKEN_KEY = 'zap:push-token';

type Messaging = {
  requestPermission: () => Promise<number>;
  getToken: () => Promise<string>;
  onTokenRefresh: (cb: (t: string) => void) => () => void;
  onNotificationOpenedApp: (cb: (msg: RemoteMessage) => void) => () => void;
  getInitialNotification: () => Promise<RemoteMessage | null>;
  onMessage: (cb: (msg: RemoteMessage) => void) => () => void;
};

export interface RemoteMessage {
  data?: Record<string, string>;
  notification?: { title?: string; body?: string };
}

let lib: (() => Messaging) | null | undefined;

function messaging(): Messaging | null {
  if (lib === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@react-native-firebase/messaging');
      lib = (mod?.default ?? mod) as () => Messaging;
    } catch {
      lib = null;
    }
  }
  return lib ? lib() : null;
}

/** Доступны ли пуши в этой сборке. */
export function pushAvailable(): boolean {
  return messaging() !== null;
}

/** Уже спрашивали разрешение — второй раз не тревожим. */
export function pushAsked(): boolean {
  return storage.getString(ASKED_KEY) === 'yes';
}

/**
 * Спросить разрешение и зарегистрировать токен.
 * Возвращает true, если токен ушёл на сервер.
 */
export async function enablePush(): Promise<boolean> {
  const m = messaging();
  if (!m) return false;
  storage.set(ASKED_KEY, 'yes');

  try {
    const status = await m.requestPermission();
    // 0 — отказ; всё остальное (authorized/provisional) считаем согласием
    if (status === 0) return false;

    const token = await m.getToken();
    if (!token) return false;

    await http('/users/me/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale: currentLocale() }),
    });
    storage.set(TOKEN_KEY, token);
    return true;
  } catch {
    // отсутствие пушей не должно ломать сценарий, ради которого их включали
    return false;
  }
}

/** Отозвать токен при выходе из аккаунта. */
export async function disablePush(): Promise<void> {
  const token = storage.getString(TOKEN_KEY);
  if (!token) return;
  try {
    await http('/users/me/push-token', { method: 'DELETE', body: JSON.stringify({ token }) });
  } catch {
    /* сервер недоступен — токен протухнет сам */
  }
  storage.delete(TOKEN_KEY);
}

/**
 * Подписки на жизненный цикл уведомлений.
 *
 * @param openRoute  куда вести по нажатию: data.type + data.splitId
 * @returns функция отписки
 */
export function attachPushHandlers(openRoute: (data: Record<string, string>) => void): () => void {
  const m = messaging();
  if (!m) return () => {};

  const offRefresh = m.onTokenRefresh((token) => {
    void http('/users/me/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale: currentLocale() }),
    }).catch(() => {});
    storage.set(TOKEN_KEY, token);
  });

  // приложение было в фоне и открыто нажатием
  const offOpened = m.onNotificationOpenedApp((msg) => {
    if (msg.data) openRoute(msg.data);
  });

  // приложение было закрыто полностью
  void m.getInitialNotification().then((msg) => {
    if (msg?.data) openRoute(msg.data);
  });

  // пуш пришёл, когда приложение открыто: системную шторку Android не
  // показывает, поэтому событие просто игнорируем — данные и так приедут
  // по сокету, а второй баннер поверх живого экрана мешает
  const offMessage = m.onMessage(() => {});

  return () => {
    offRefresh();
    offOpened();
    offMessage();
  };
}
