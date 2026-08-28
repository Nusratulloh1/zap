# ZAP! Mobile — нативный клиент (React Native, bare CLI)

Второй клиент к тому же бэкенду, что и веб-PWA. Дизайн-токены, экраны и
**файлы локализации общие с вебом** — `src/locales/*.json` в корне репозитория
читаются напрямую (см. `metro.config.js` → `watchFolders`), переводы не дублируются.

- React Native **0.87.1**, TypeScript **strict** (+ `noUncheckedIndexedAccess`)
- Навигация — react-navigation (native-stack)
- Состояние — Zustand, серверный кэш — @tanstack/react-query
- Анимации — reanimated + gesture-handler (на UI-потоке)
- Токены — Keychain (iOS) / Keystore (Android), **не** в обычном сторидже
- i18n — i18next поверх общих JSON, включая русское правило плюрализации

`mobile/` намеренно **не** входит в pnpm-workspace: у RN свои требования к
раскладке `node_modules`, поэтому здесь обычный npm со своим деревом.

---

## Требования

| | версия |
|---|---|
| Node | ≥ 22.11 |
| JDK | 17 |
| Android SDK | platform 36, build-tools 36, platform-tools, эмулятор |
| Xcode | 16+ (только macOS) |
| CocoaPods | для iOS |

## Установка

```bash
cd mobile
npm install
# iOS (только на macOS)
cd ios && pod install && cd ..
```

Шрифты (Manrope, JetBrains Mono) уже слинкованы: лежат в `assets/fonts`,
прописаны в `Info.plist` и в `android/app/src/main/assets/fonts`.
После добавления новых — `npx react-native-asset`.

## Запуск

```bash
npm start              # Metro
npm run android        # эмулятор/устройство Android
npm run ios            # симулятор iOS (macOS)
```

## Адрес бэкенда

По умолчанию — прод `https://use.zapapp.uz/api` (`src/lib/env.ts`).

Локальный бэкенд:

```bash
API_URL=http://10.0.2.2:3202 npm run android   # 10.0.2.2 — хост-машина для Android-эмулятора
API_URL=http://localhost:3202 npm run ios
```

Тестовые номера прода (SMS не отправляется, код `424242`):
`+998 90 000 00 91`, `…92`, `…93`.

## Что уже есть — Фаза 1

- Тема light/dark/system, токены один в один с вебом (`src/theme/tokens.ts`)
- i18n uz/ru/en на общих локалях, язык устройства → uz/ru/en, fallback uz
- API-клиент с Bearer + тихой ротацией refresh-токена (контракт `web/src/api/real.ts`)
- Сессия со стадиями `onboarding → phone → code → pin → authed`, переживает перезапуск
- Экраны: онбординг-сторис (свайп + тап, анимированный прогресс), ввод номера
  (+998 отдельным блоком, маска), код из SMS (нативный автоввод: `oneTimeCode` на
  iOS, `sms-otp` на Android), создание PIN со своей клавиатурой и биометрией
- Пресс-фидбек и хаптика на ключевых действиях

**Фаза 1 проверена типами (`tsc --noEmit`), линтом (0 ошибок) и сборкой Metro-бандла
(2.5 МБ, общие локали внутри). На эмуляторе не запускалась — запуск за вами.**

## Что осталось (фазы 2–3)

Главная и карусель, пад суммы, участники (3 режима), share/QR, live-статус,
секции, сканер (vision-camera), участник по deep link, пуши (FCM/APNs),
bootsplash и иконка.

---

## Чек-лист для публикации (делаете вы)

**Android**
1. `applicationId` — `uz.zapapp.app` (уже прописан)
2. Ключ подписи: `keytool -genkeypair -v -storetype PKCS12 -keystore zap-release.keystore -alias zap -keyalg RSA -keysize 2048 -validity 10000`
3. Положить в `android/app/`, прописать в `~/.gradle/gradle.properties`:
   `ZAP_UPLOAD_STORE_FILE`, `ZAP_UPLOAD_KEY_ALIAS`, `ZAP_UPLOAD_STORE_PASSWORD`, `ZAP_UPLOAD_KEY_PASSWORD`
4. Сборка: `cd android && ./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`
5. Play Console: иконка 512×512, фича-графика 1024×500, скриншоты телефона (мин. 2, 16:9 или 9:16),
   политика конфиденциальности (URL), форма Data Safety

**iOS**
1. Bundle ID — `uz.zapapp.app` (уже прописан), подпись в Xcode под вашим Apple ID
2. Archive → Distribute App → App Store Connect
3. App Store Connect: иконка 1024×1024 без альфы, скриншоты 6.7" и 6.5",
   политика конфиденциальности, App Privacy («Data Used to Track You» — нет)

**Общее:** описание uz/ru/en, возрастной рейтинг, контакт поддержки.
