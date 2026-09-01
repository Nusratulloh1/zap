# ZAP! Mobile — запуск от чистого клона

RN 0.87.1, новая архитектура, Hermes. Android собирается и ставится;
iOS ни разу не собирался (разработка шла на Windows) — см. раздел iOS.

---

## 1. Что нужно на машине

| Что | Версия | Проверить |
|---|---|---|
| Node | 20+ | `node -v` |
| JDK | 17 | `java -version` |
| Android SDK | platform 37, build-tools 37 | `sdkmanager --list_installed` |
| NDK | **27.1.12297006** (жёстко в `android/build.gradle`) | `ls $ANDROID_HOME/ndk` |
| CMake | 3.31.6 | `ls $ANDROID_HOME/cmake` |
| Эмулятор | Android 13+ (API 33+) | `emulator -list-avds` |

`ANDROID_HOME` должен быть выставлен; на Windows в `android/local.properties`
пути пишутся **через прямой слэш** (`sdk.dir=D:/Android/Sdk`) — обратный слэш
Java читает как escape и SDK «не находится».

---

## 2. Запуск

```bash
git clone <repo> && cd zap_split
cd apps/mobile
npm install                 # postinstall прогонит patch-package — так и надо
npm start -- --reset-cache  # отдельным терминалом
npm run android
```

Первая сборка компилирует нативные модули (reanimated, worklets, gesture-handler,
vision-camera) — 10–40 минут в зависимости от машины. Дальше инкрементально.

**Успех выглядит так:** `BUILD SUCCESSFUL`, приложение стартует, показывает
онбординг-сторис (лаймовый экран, вордмарк ZAP!, автолистание 3 слайдов).

---

## 3. Вход в приложение

Прод-бэкенд, тестовый номер (SMS не уходит, код детерминирован):

```
телефон: +998 90 000 00 91
код:     424242
PIN:     любой — на первом входе вы его придумываете сами
```

Работает, пока на сервере заданы `TEST_PHONES` и `TEST_OTP_CODE`
(`apps/backend/src/auth/auth.service.ts`). На локальном бэкенде добавьте их в
`.env`, иначе придёт настоящая SMS.

### API_URL

По умолчанию `https://use.zapapp.uz/api` (`src/lib/env.ts`).
Проверено `curl`: **и `zapapp.uz/api/health`, и `use.zapapp.uz/api/health`
отвечают 200** — оба хоста проксируют API, дефолт менять не нужно.
Разделение доменов: `zapapp.uz` — лендинг, `use.zapapp.uz` — платформа
(`docs/MONOREPO.md`), API отдаётся с обоих.

Локальный бэкенд:
```bash
API_URL=http://10.0.2.2:3202 npm run android   # 10.0.2.2 = хост из эмулятора
```

---

## 4. Если не собирается

| Симптом | Причина | Что делать |
|---|---|---|
| `The paging file is too small` / `Insufficient system resources` | clang жрёт память на параллельной сборке | закрыть java/node, затем `CMAKE_BUILD_PARALLEL_LEVEL=1 ./gradlew assembleDebug --no-daemon --max-workers=1`. Крайний случай — собрать нативку отдельно: `cd android/app/.cxx/*/*/arm64-v8a && ninja -j1` |
| `Gradle build daemon disappeared` | JVM не хватило heap | `./gradlew ... -Dkotlin.compiler.execution.strategy=in-process -Dorg.gradle.jvmargs="-Xmx1792m"` |
| `Filename longer than 260 characters` | Windows + длинные пути ninja | в `local.properties` указать `cmake.dir=D:/Android/Sdk/cmake/3.31.6` (хэширует пути) |
| `package com.horcrux.svg does not exist` и подобное | протухший автолинк после смены зависимостей | `rm -rf android/.gradle android/app/build/generated/autolinking && npm run android` |
| `Unable to load script` / красный экран | Metro не запущен или закэширован | `npm start -- --reset-cache`, затем `adb reverse tcp:8081 tcp:8081` |
| Приложение стартует и сразу падает | не прогнан `patch-package` | `npm install` ещё раз (postinstall) — патчи в `patches/` обязательны для blur и change-icon |
| Логин не проходит | нет `TEST_PHONES` на бэкенде или нет сети | проверить `curl https://use.zapapp.uz/api/health` → 200 |
| Пустой список после входа | бэкенд отдал пустой `/bootstrap` | это нормально для нового номера — создайте сплит |

Логи устройства: `adb logcat | grep -i "zap\|ReactNative\|AndroidRuntime"`.

---

## 5. iOS (ни разу не собиралось)

Нужен Mac. `Podfile.lock` в репозитории **нет** — его создаст первый прогон:

```bash
cd apps/mobile && npm ci
cd ios && pod install          # создаст ZapMobile.xcworkspace и Podfile.lock
open ZapMobile.xcworkspace
```

В Xcode задать `DEVELOPMENT_TEAM` (не задан — проект собран на Windows).
Для универсальных ссылок выложить `apple-app-site-association` на
`https://zapapp.uz/.well-known/` с `appID = <TEAMID>.uz.zapapp.app`,
`paths: ["/s/*", "/g/*"]`. Подробности — `scratchpad/mobile/audit.md`.

---

## 6. Идентификаторы (не путать)

- `namespace com.zapmobile` — Java/Kotlin-пакет нативного кода (`MainActivity.kt`).
- `applicationId uz.zapapp.app` — идентификатор приложения в сторе, совпадает
  с iOS `PRODUCT_BUNDLE_IDENTIFIER`.

Это **не** рассинхрон: в RN так и задумано. Менять `namespace` нельзя — за ним
тянутся пути исходников и сгенерированный код.
