# ZAP! V1 — hand-off к релизу

Что развернуть, что настроить, что могу сделать только вы. Ничего из
перечисленного я не деплоил.

Обозначения: **[ваше]** — нужен ваш аккаунт/ключ/сервер; **[код готов]** —
лежит в репозитории; **[не сделано]** — в этом заходе не реализовано.

---

## 1. Бэкенд: что деплоить и в каком порядке

Последняя миграция в репозитории — **`0007_push_tokens`**. Новых миграций я
**не добавлял** — Recap считается из существующих данных; Разделы 3, 5, 6 не реализованы (см. §5).

| # | Что | Состояние |
|---|---|---|
| 1 | `0007_push_tokens` — таблица токенов | **[код готов]**, применить `npx prisma migrate deploy` |
| 2 | OG link-preview | **[код готов]**, миграция не нужна — см. §2 |
| 3 | **Monthly Recap** — `src/recap/*`, зарегистрирован в `app.module.ts` | **[код готов]**, миграция НЕ нужна |
| 4 | Moments / Profile-aggregates / Photo | **[не сделано]** |

```bash
cd apps/backend
npx prisma migrate deploy      # применит 0007
npm run build && pm2 restart zap-backend   # или ваш способ рестарта
```

---

## 2. OG link-preview — уточнение

В задании он значился как «диff в `scratchpad/og-backend.diff`». **Такого файла
нет ни на диске, ни в истории git.** Проверил: код уже в репозитории и
подключён — `apps/backend/src/og/og.controller.ts`, зарегистрирован в
`SplitsModule` (не в `app.module.ts`, поэтому легко не заметить). Отдельный
диff отдавать нечего, деплоится вместе с бэкендом.

Чтобы превью заработало, нужно **[ваше]**:

1. nginx — отдать `/s/` на бэкенд (иначе SPA перехватит маршрут и скрейпер
   получит пустой html):

```nginx
location ^~ /s/ {
    proxy_pass http://127.0.0.1:3202/og/s/;
    proxy_set_header Host $host;
}
```

2. Переменные окружения бэкенда:

```
WEB_INDEX_PATH=/var/www/zapapp/index.html   # собранный index.html веба
PUBLIC_ORIGIN=https://zapapp.uz
```

3. Положить постер `og-default.png` в корень статики (`https://zapapp.uz/og-default.png`).

**Проверка:** вставить `https://zapapp.uz/s/КОД` в Telegram → должна появиться
карточка с названием сплита. Картинка пока одна на все сплиты — пер-сплитный
рендер не делался.

---

## 3. Пуш-уведомления **[ваше]**

Код клиента и сервера готов; нативный модуль подключается «мягко» — без
Firebase-файлов приложение собирается и работает, просто без пушей.

1. Firebase-проект, в нём Android-приложение `uz.zapapp.app` и iOS `uz.zapapp.app`.
2. Скачать и положить:
   - `apps/mobile/android/app/google-services.json`
   - `apps/mobile/ios/GoogleService-Info.plist` (добавить в target через Xcode)
3. Установить пакеты:
   ```bash
   cd apps/mobile
   npm i @react-native-firebase/app @react-native-firebase/messaging
   cd ios && pod install
   ```
4. APNs-ключ (.p8) загрузить в Firebase → Cloud Messaging.
5. Переменная бэкенда: `FCM_SERVICE_ACCOUNT` — **содержимое** service-account
   JSON из Firebase (Project settings → Service accounts).
6. Пересобрать оба клиента. `src/lib/push.ts` менять не нужно — `require`
   подхватит модуль сам.

Разрешение на уведомления спрашивается не на старте, а после первого сплита —
так у запроса есть понятный повод.

---

## 4. Переменные окружения — сводка **[ваше]**

| Переменная | Где | Зачем |
|---|---|---|
| `FCM_SERVICE_ACCOUNT` | бэкенд | отправка пушей |
| `WEB_INDEX_PATH` | бэкенд | OG-превью читает собранный index.html |
| `PUBLIC_ORIGIN` | бэкенд | абсолютные ссылки в og:-тегах |
| `GEMINI_API_KEY` | бэкенд | распознавание фото чека (без него 503) |
| `OFD_HOSTS` | бэкенд | хосты фискальных QR, по умолчанию `ofd.soliq.uz` |
| `OCR_HOURLY_LIMIT` | бэкенд | лимит распознаваний, по умолчанию 20 |

Значения не привожу — их ставите вы.

### nginx: обязательная правка **[ваше] [блокер для фото чека]**

`client_max_body_size` не задан → действует дефолт **1 МБ**, и загрузка фото
чека обрывается (413), хотя бэкенд разрешает 8 МБ. Поставить:

```nginx
client_max_body_size 10m;
```

---

## 5. Что сделано в этом заходе, а что нет

### Сделано

| Что | Где |
|---|---|
| Иконки приложения (3 шт.) + переключение из профиля, обе платформы | `assets/app-icons`, `tools/gen-app-icons.py` |
| Стекло таб-бара (BlurView не регистрировался как Fabric-компонент) | `patches/@react-native-community+blur…` |
| Смена иконки (модуль объявлял спек, но не реализовывал его) | `patches/react-native-change-icon…` |
| Звуки: файлы не были слинкованы ни в один нативный проект | `react-native.config.js`, `res/raw`, Xcode |
| Звук глушился боковым переключателем | `feedback.ts`: `Ambient` → `Playback` |
| Тосты были не видны поверх модалок на iOS | `ToastHost` → `FullWindowOverlay` |
| Кнопки «на главную» не работали: RN Navigation v7 сменил семантику `navigate` | 19 вызовов → `popTo('Tabs')` |
| Иконки таб-бара разнокалиберные (22/23/ручная сетка) | одна сетка 24×24 |
| multipart без boundary — файл терялся | `api/client.ts` |
| `debuggableVariants` больше не помечает release | `android/app/build.gradle` |
| `gradlew` без бита исполнения (Android не собирался с чистого клона) | `chmod +x` |
| Чек-лист публикации | `docs/mobile/STORE.md` |
| **§4 Итоги месяца** — эндпоинт + сторис-панели + карточка на главной | `src/recap/*`, `RecapScreen.tsx` |
| `StoryProgress` вынесен из онбординга в общий компонент (переиспользование, а не копия) | `components/StoryProgress.tsx` |

### Не сделано **[не сделано]**

| Раздел | Почему |
|---|---|
| §3 ZAP Moments | не начинался: после постановки был ответ «STOP for my device run», подтверждения не было |
| §5 Social profile | **зависит от §3** — коллекция стикеров берётся из Moments |
| §6 Photo Moment | требует загрузки и хранения файлов на бэкенде |
| §8 Финальный QA обеих платформ | нужен ваш прогон на устройствах |
| §C18/C19 Live Activity, виджет | отложено, не V1-критично |

Отдельно: `scratchpad/mobile/audit.md` в репозитории **нет** — обновлять было
нечего, файл не заводился.

---

## 6. Блокеры для сторов **[ваше]**

1. **Release подписан debug-ключом** — Play откажет. Инструкция: `STORE.md` §4.
2. **Нет privacy-policy URL** — форму не отправить без него.
3. **`NSMicrophoneUsageDescription`** описывает неиспользуемое разрешение —
   формулировка сама провоцирует вопрос ревьюера. Убрать вместе с отключением
   аудио у VisionCamera (могу сделать, меняет конфиг камеры).
4. Аккаунты: Apple $99/год, Google Play $25 разово.
5. `assetlinks.json` на `zapapp.uz` — без него Android App Links не верифицируются.
6. Разблокировка SMS-провайдера на боевые номера.
7. **App Group для виджета (§C19)** — единственное, что упирается в ваш
   аккаунт Apple. Live Activity / Dynamic Island (§C18) уже работает и от
   этого не зависит; виджет домашнего экрана — да. Что сделать:
   1. developer.apple.com → Identifiers → App Groups → создать
      `group.uz.zapapp.app`;
   2. включить его на App ID `uz.zapapp.app` и `uz.zapapp.app.ZapActivity`;
   3. вернуть в `ios/ZapMobile/ZapMobile.entitlements` и
      `ios/ZapActivity/ZapActivity.entitlements` ключ
      `com.apple.security.application-groups` со значением `group.uz.zapapp.app`,
      а в `ZapActivity` вернуть `CODE_SIGN_ENTITLEMENTS`;
   4. раскомментировать `ZapWidget()` в `ios/ZapActivity/ZapActivityBundle.swift`.

   Код виджета и запись состояния из приложения (`setWidgetState` в
   HomeScreen) уже на месте — включается этими четырьмя шагами. Пока
   capability не заведена, автоподпись роняет сборку **обоих** таргетов,
   поэтому сейчас App Group снят, а виджет не зарегистрирован: постоянно
   одинаковая плашка в галерее хуже, чем её отсутствие.

---

## 7. Состояние сборки

- **iOS** — собирается, установлено на устройство, проверено вживую.
- **Android** — release-сборка запускалась на Mac после снятия
  `debuggableVariants`; результат на момент написания не подтверждён, см.
  отчёт в чате. APK/AAB я не подписывал (нет release-ключа).

Перед подачей: `npx tsc --noEmit`, `npm run lint`,
`node scripts/i18n-check.mjs`, поднять `versionCode`/`CURRENT_PROJECT_VERSION`.
