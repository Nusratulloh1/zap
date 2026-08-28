# Структура монорепо

## Дерево

```
zap/
├── apps/
│   ├── web/                 Vue PWA — было в корне
│   │   ├── src/             (включая маршрут лендинга — см. «Решение по лендингу»)
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts, tailwind.config.ts, postcss.config.js
│   │   ├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
│   │   └── package.json      name: web
│   ├── backend/             NestJS + Prisma — было backend/
│   │   └── package.json      name: zap-backend
│   └── mobile/              React Native — было mobile/
│       └── package.json      name: ZapMobile  (вне pnpm-workspace, см. ниже)
├── packages/
│   ├── locales/             uz/ru/en JSON — единственный источник переводов
│   │   └── package.json      name: @zap/locales
│   └── shared/              доменные типы, контракт ApiClient, денежные утилиты
│       └── package.json      name: @zap/shared
├── scripts/                 инструментарий репозитория (смоуки, i18n-check, иконки)
├── docs/                    документация
├── design-reference/        исходники дизайна (в .gitignore)
├── package.json             корень workspace: оркестрация через --filter
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── netlify.toml, vercel.json
└── pnpm-lock.yaml
```

## Решение по лендингу

**Лендинг остаётся маршрутом внутри `apps/web`, отдельным приложением не выносится.**

`LandingPage.vue` импортирует `@/lib/site`, `@/lib/toast`, `@/api`,
`@/lib/landingMotion`, ассеты веба и живёт в его роутере вместе с host-гардом
(`zapapp.uz` → лендинг, `use.zapapp.uz` → платформа). Выделение в `apps/landing`
потянуло бы за собой половину веба либо потребовало третьего общего пакета с
UI-примитивами. Разделение здесь дороже связности, которую оно убирает.

## Что куда переехало

| Было | Стало |
|---|---|
| `src/` | `apps/web/src/` |
| `index.html`, `public/`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js` | `apps/web/` |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | `apps/web/` |
| `src/locales/*.json` | `packages/locales/` |
| `src/entities/types.ts` | `packages/shared/src/types.ts` |
| чистые `money`/`phone`/`equalShares` из `src/lib/format.ts` | `packages/shared/src/money.ts` |
| `backend/` | `apps/backend/` |
| `mobile/` | `apps/mobile/` |

Всё переносилось через `git mv` — история переименований сохранена
(`git log --follow apps/web/src/main.ts`).

## Изменённые пути

**Веб**
- импорты `@/entities/types` → `@zap/shared/types` (18 файлов)
- импорты `@/locales/*.json` → `@zap/locales/*.json`
- `vite.config.ts`: алиасы `@zap/locales`, `@zap/shared` → `../../packages/...`
- `tsconfig.app.json`: `paths` и `include` → `../../packages/...`
- `build` зовёт корневой `../../scripts/i18n-check.mjs`
- `src/lib/format.ts` реэкспортирует чистые функции из `@zap/shared/money`,
  у себя оставляет только зависящее от локали (`peopleCount`, даты)

**Мобильный**
- babel-alias `@locales` → `../../packages/locales`, добавлен `@zap/shared`
- `metro.config.js`: `repoRoot` поднят на два уровня, в `watchFolders` обе папки
- `tsconfig.json`: `paths` и `include` → `../../packages/...`
- дублированный интерфейс `Me` заменён общим `User` из `@zap/shared/types`

**Корень**
- `scripts/{dev-all,dev-run,dev-stop,fiscal-fixture,ofd-json-fixture}.mjs` → `apps/backend`
- `playwright-core` вернулся в корневые devDependencies: им пользуются
  корневые `scripts/` (смоуки, скриншоты, parity)

## React Native: почему вне workspace

`apps/mobile` исключён из `pnpm-workspace.yaml` (`!apps/mobile`) и ставится
своим `npm install`. Причина: Metro и нативные модули RN плохо переносят
симлинки pnpm и подъём зависимостей — резолвер начинает находить пакеты вне
`mobile/node_modules` и сборка ломается непредсказуемо.

Общие пакеты подключены **алиасами, а не зависимостями**:
`@locales` и `@zap/shared` в `babel.config.js` + `watchFolders` в
`metro.config.js`, а `resolver.nodeModulesPaths` намеренно ограничен
`mobile/node_modules`. Так RN видит общий код, но не чужое дерево зависимостей.

## Проверка после миграции

```bash
pnpm install                       # 4 воркспейса: zap, web, zap-backend, @zap/locales, @zap/shared
pnpm --filter web build            # ✓ i18n-паритет 255 ключей + vue-tsc + vite
pnpm --filter zap-backend build    # ✓ nest build
cd apps/mobile && npx tsc --noEmit # ✓
cd apps/mobile && npx react-native bundle --platform android \
  --dev false --entry-file index.js --bundle-output /tmp/b.js   # ✓
```

`@zap/locales` разрешается из обоих клиентов в одну и ту же папку — проверено
поиском строки `Chekni skanlang` в бандле веба и в бандле Metro.

## Найдено и исправлено по ходу

- **`prisma/schema.prisma`**: многострочный комментарий `/** … */` — недопустимый
  синтаксис Prisma, `generate` падал с `P1012`. Заменено на `///`.
- **`apps/backend`**: добавлен `postinstall: prisma generate`. Без
  сгенерированного клиента `nest build` валится 200+ ошибками на пустых типах —
  ровно это и случилось после переустановки зависимостей.
- **`.gitignore`**: закрыты `.env*` (кроме `*.example`), `scratchpad/`,
  `tsbuildinfo`, `apps/*/dist`. Раньше env-правил не было вообще, и
  `apps/backend/.env.development` с `JWT_SECRET` мог уехать в коммит по `git add -A`.
- **`apps/mobile/.git`**: RN CLI создал внутри вложенный репозиторий — в монорепо
  он превратился бы в пустой gitlink. Удалён.
