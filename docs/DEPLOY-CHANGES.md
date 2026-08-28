# Что изменилось для деплоя после реструктуризации

Ничего из перечисленного я на прод не применял. Ниже — точные значения,
которые нужно проставить в панелях хостинга и в командах выкладки.

## 1. Веб (Netlify)

`netlify.toml` в корне репозитория уже обновлён:

```toml
[build]
  command = "pnpm --filter web build"
  publish = "apps/web/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**В панели Netlify** (Site configuration → Build & deploy):

| Поле | Было | Стало |
|---|---|---|
| Base directory | *(пусто)* | **оставить пустым** |
| Build command | `pnpm build` | `pnpm --filter web build` |
| Publish directory | `dist` | `apps/web/dist` |

Base directory намеренно остаётся пустым: если задать `apps/web`, Netlify
поставит зависимости внутри пакета, pnpm не увидит workspace и общие пакеты
`@zap/locales` / `@zap/shared` не разрешатся.

## 2. Веб (Vercel)

`vercel.json` в корне:

```json
{
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "pnpm install --frozen-lockfile",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**В панели Vercel** (Settings → General): Root Directory оставить **корнем
репозитория**, не `apps/web` — по той же причине, что и у Netlify.

SPA-фолбэк не изменился, `/s/:code` продолжает отдаваться через `index.html`
(правило `/(.*)` + `apps/web/public/_redirects`, который копируется в `dist`).

## 3. Бэкенд (systemd `zap-api` на egox)

**Раскладка на сервере не меняется.** `/root/zap/backend`, `WorkingDirectory`,
`EnvironmentFile=/root/zap/backend/.env` и `ExecStart` остаются как есть —
systemd трогать не нужно.

Меняется только то, что кладётся в архив: источник теперь `apps/backend`,
а не `backend`.

```bash
# было
tar -czf backend.tgz --exclude=node_modules --exclude=dist \
    backend/src backend/prisma backend/package.json backend/tsconfig.json backend/nest-cli.json
scp backend.tgz egox:/tmp/ && ssh egox 'cd /root/zap && tar -xzf /tmp/backend.tgz'

# стало: раскрываем в ту же папку /root/zap/backend
tar -czf backend.tgz --exclude=node_modules --exclude=dist \
    -C apps/backend src prisma package.json tsconfig.json nest-cli.json
scp backend.tgz egox:/tmp/
ssh egox 'cd /root/zap/backend && tar -xzf /tmp/backend.tgz && rm /tmp/backend.tgz \
          && pnpm install --prod=false && pnpm exec prisma migrate deploy \
          && pnpm build && systemctl restart zap-api'
```

`pnpm install` на сервере теперь сам дёргает `prisma generate` — это добавленный
`postinstall`. Раньше генерацию приходилось звать руками, и её молчаливый сбой
ронял сборку на пустых типах Prisma.

## 4. CI

GitHub Actions в репозитории нет — обновлять нечего. Если появится, рабочие
команды: `pnpm install`, затем `pnpm --filter web build` /
`pnpm --filter zap-backend build`; для мобильного — `npm ci` внутри
`apps/mobile` (он вне workspace).

## 5. Мобильный

Ничего для деплоя: в сторы пока не выкладывается. Локально —
`cd apps/mobile && npm install && npm run android`.

## 6. Секреты

- `.env.production` (`VITE_API_URL=/api`) и `.env.real` **отслеживаются в git**.
  Секретов в них нет — это конфигурация сборки, и `.env.production` обязан быть
  в репозитории: иначе прод-сборка на Netlify/Vercel потеряет `VITE_API_URL`
  и приложение свалится на оффлайн-мок. Оставлены как есть осознанно.
- `apps/backend/.env.development` (содержит `JWT_SECRET`, `DATABASE_URL`)
  **в git не попадал** и теперь закрыт правилом `.gitignore` — раньше env-правил
  не было вообще, и один `git add -A` отправил бы его в историю.
- `apps/backend/.env` на сервере не трогался.
