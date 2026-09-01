# Публикация ZAP! в сторы

Чек-лист под подачу V1. Отмечено, что уже в репозитории, а что придётся сделать
руками — с точным местом и командой.

Статусы: **[готово]** — лежит в репозитории и проверено; **[ваше]** — требует
вашего аккаунта/ключа/Mac-шага; **[блокер]** — без этого сторы откажут.

---

## 0. Блокеры, которые надо закрыть до первой сборки

| Что | Где | Статус |
|---|---|---|
| Release подписан **debug-ключом** | `android/app/build.gradle` → `buildTypes.release.signingConfig` | **[блокер] [ваше]** |
| Нет privacy-policy URL | форма в обоих сторах | **[блокер] [ваше]** |
| `NSMicrophoneUsageDescription` описывает неиспользуемое разрешение | `ios/ZapMobile/Info.plist` | **[блокер-риск]** см. §4 |
| `debuggableVariants` включал `release` | `android/app/build.gradle` | **[готово]** убрано |
| `gradlew` без бита исполнения | `android/gradlew` | **[готово]** `chmod +x` |

---

## 1. Идентификаторы и версии

| | Значение | Где менять |
|---|---|---|
| iOS bundle ID | `uz.zapapp.app` | `ios/ZapMobile.xcodeproj` → `PRODUCT_BUNDLE_IDENTIFIER` |
| Android applicationId | `uz.zapapp.app` | `android/app/build.gradle` |
| Отображаемое имя | `ZAP!` | `Info.plist` → `CFBundleDisplayName`, `strings.xml` |
| versionName / MARKETING_VERSION | `1.0` | оба проекта |
| versionCode / CURRENT_PROJECT_VERSION | `1` | **поднимать на каждую загрузку** |
| iOS deployment target | 15.1 | |
| Android min / target / compile | 24 / 36 / 37 | `android/build.gradle` |

Версии в iOS и Android независимы, но держите их синхронными — иначе саппорт
не поймёт, о какой сборке речь.

---

## 2. Иконки и заставка

**[готово]** Мастера — `assets/app-icons/*.png` (1024×1024, full-bleed, без альфы).
Пересборка обеих платформ одной командой:

```bash
cd apps/mobile && python3 tools/gen-app-icons.py
```

- **iOS:** `AppIcon` (основная, «чеки») + `IconMosaic`, `IconHands` как
  альтернативные. Объявлены в `Info.plist` → `CFBundleAlternateIcons`, включён
  `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS`. Смена — из профиля.
- **Android:** legacy + round + adaptive (foreground вписан в safe zone),
  три набора `ic_launcher*`, переключение через `activity-alias`.
- **App Store иконка 1024×1024 без альфа-канала** — берётся из `AppIcon`,
  требование выполнено (проверено: `hasAlpha: no`).
- Заставка — `LaunchScreen.storyboard` (iOS) / `SplashTheme` (Android).

---

## 3. Разрешения и тексты

**iOS** (`ios/ZapMobile/Info.plist`) — тексты видит пользователь и ревьюер:

| Ключ | Текст | Нужен? |
|---|---|---|
| `NSCameraUsageDescription` | «Сканирование чеков — камера нужна для чтения QR-кода» | да |
| `NSFaceIDUsageDescription` | «Face ID заменяет ввод PIN при входе в ZAP!» | да |
| `NSMicrophoneUsageDescription` | «Микрофон не используется…» | **нет, см. ниже** |

**Android** (`AndroidManifest.xml`): `INTERNET`, `CAMERA`, `USE_BIOMETRIC`, `VIBRATE`.

### Микрофон — убрать до подачи

Ключ приехал вместе с VisionCamera, а сам текст честно говорит, что микрофон не
используется. Apple цепляется за разрешения без сценария, и формулировка сама
подсказывает ревьюеру вопрос. Правильно — отключить аудио у VisionCamera и убрать
ключ. **[ваше решение]** — сделать могу, но это меняет конфигурацию камеры.

### Звуки: обязательный шаг после клона

Мастера лежат в `assets/sounds/*.mp3` (в репозитории). Android-каталог
`res/raw/` **в .gitignore** — он генерируемый, поэтому после свежего клона
звуков на Android не будет, пока не выполнить:

```bash
cd apps/mobile && npx react-native-asset
```

Команда раскладывает и шрифты, и звуки: Android → `res/raw/`, iOS → ссылки в
`project.pbxproj` (он закоммичен, поэтому на iOS шаг нужен только при добавлении
новых файлов).

Сейчас 6 из 7 звуков — синтезированные заглушки; настоящий только «разрыв
бумаги» (`split.mp3`). Финальные звуки от дизайна класть туда же, под теми же
именами, и прогнать команду выше.

---

## 4. Сборка Android

```bash
cd apps/mobile/android
export ANDROID_HOME="$HOME/Library/Android/sdk"

# AAB для Play Console (именно bundle, не APK)
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab

# APK для ручной проверки на устройстве
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

### Ключ подписи **[ваше] [блокер]**

Сейчас release подписан debug-ключом — Play такую сборку не примет.

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore zap-release.keystore -alias zap \
  -keyalg RSA -keysize 2048 -validity 10000
```

Положить в `android/app/`, в `~/.gradle/gradle.properties` (НЕ в репозиторий):

```properties
ZAP_UPLOAD_STORE_FILE=zap-release.keystore
ZAP_UPLOAD_KEY_ALIAS=zap
ZAP_UPLOAD_STORE_PASSWORD=…
ZAP_UPLOAD_KEY_PASSWORD=…
```

и заменить `signingConfig signingConfigs.debug` в блоке `release` на реальный
конфиг. Keystore потерять нельзя — без него не выпустить обновление.

---

## 5. Сборка iOS

```bash
cd apps/mobile
npm install          # postinstall прогонит patch-package — обязателен
cd ios && pod install
```

Дальше в Xcode: **Any iOS Device** → Product → Archive → Distribute App →
App Store Connect.

- Подпись: команда `9QCQW78H54` (ACCELERATION, MChJ), автоматическая.
- Профиль `uz.zapapp.app` включает `associated-domains` (диплинки `zapapp.uz`).
- **Патчи обязательны** (`patches/`, применяются postinstall):
  `@react-native-community/blur` — регистрация Fabric-компонента;
  `react-native-change-icon` — TurboModule-спек;
  `react-native-sound` — buildscript под AGP 9.
  Без них: нет стекла, не работает смена иконки, не собирается Android.

### Если линковка падает на `facebook::react::Sealable`

Устаревший пред-собранный React-Core после смены зависимостей:

```bash
cd apps/mobile/ios
rm -rf Pods/React-Core-prebuilt Pods/hermes-engine Pods/ReactNativeDependencies build
rm -rf ~/Library/Developer/Xcode/DerivedData/ZapMobile-*
pod install
```

---

## 6. Материалы для листингов **[ваше]**

**Оба стора:** privacy-policy URL, support URL/email, описание uz/ru/en,
возрастной рейтинг, категория (Finance / Utilities).

**App Store Connect:** иконка 1024×1024, скриншоты 6.7" и 6.5"
(1290×2796 и 1242×2688), App Privacy (сбор: телефон, имя; «Data Used to Track
You» — нет), демо-аккаунт для ревью:

```
Phone: +998 90 000 00 91  (вводить 900000091)
SMS code: 424242
PIN: любой 4-значный
```

**Play Console:** иконка 512×512, фича-графика 1024×500, минимум 2 скриншота
телефона, форма Data Safety, декларация разрешений камеры.

---

## 7. Перед каждой загрузкой

```bash
cd apps/mobile
npx tsc --noEmit          # типы
npm run lint              # линт
node ../../scripts/i18n-check.mjs   # ключи uz/ru/en совпадают
```

Поднять `versionCode` / `CURRENT_PROJECT_VERSION`. Проверить, что
`src/lib/env.ts` смотрит на прод (`https://use.zapapp.uz/api`).

---

## 8. Что умеет только владелец аккаунтов **[ваше]**

- Apple Developer Program — $99/год; Google Play Console — $25 разово.
- Создание записи приложения, SKU (рекомендую `uz.zapapp.app`), TestFlight.
- Release-keystore Android и его хранение.
- Хостинг privacy policy на `zapapp.uz`.
- `assetlinks.json` на домене — без него Android App Links не верифицируются
  (`autoVerify` в манифесте уже стоит).
- Разблокировка SMS-провайдера на боевые номера.
