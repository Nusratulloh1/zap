# ZAP! Backend — NestJS + PostgreSQL + Prisma + Socket.IO

Продакшен-бэкенд сплит-платежей. Деньги — только целые UZS, телефоны — `998XXXXXXXXX`.
Прод стартует ПУСТЫМ: никаких сидов; `pnpm seed:demo` (Bellissimo + счёт #481) — только
с `ALLOW_DEMO_SEED=true`.

## Быстрый старт (локально, без Docker)

```bash
pnpm install
pnpm dev:db                 # настоящий PostgreSQL (embedded) на :5433
cp .env.example .env        # DATABASE_URL=postgresql://zap:zap@localhost:5433/zap
pnpm migrate:deploy
ALLOW_DEMO_SEED=true pnpm seed:demo
pnpm start:dev              # API на :3000, SMS_DRY_RUN=true → коды в логах
```

Фронт в real-режиме: `pnpm dev --mode real` в корне PWA (`.env.real` → VITE_API_URL).

## Тесты (приёмочный гейт)

```bash
pnpm test:e2e   # 10 тестов на НАСТОЯЩЕМ PostgreSQL: otp→pin→сплит(долг)→
                # участник open+pay (OTP-lite)→cover→автозакрытие→кэшбэк
                # (held_debt)→settle долга релизит кэшбэк + идемпотентность,
                # одноразовость paymentToken, rate-limit
```

## Docker / Railway

- `docker compose up` — Postgres 16 + API (миграции на старте).
- Railway: сервис из Dockerfile + плагин Postgres; `DATABASE_URL` из плагина;
  переменные из `.env.example`. Бэкапы: включите Daily Snapshots у плагина.

## Продакшен на egox (zapapp.uz)

- API: systemd `zap-api` (порт 3202), код в `~/zap/backend`, env — `~/zap/backend/.env`.
- БД: контейнер `egox-postgres` (127.0.0.1:5481), база `zap` / роль `zap`.
- Статика PWA: `/var/www/zapapp` (сборка с `VITE_API_URL=https://zapapp.uz/api`).
- nginx: `/etc/nginx/sites-available/zapapp.uz` — SPA-фолбэк, `/api/` → :3202
  (websocket upgrade для `/api/socket.io`).
- Бэкапы: cron 03:15 `pg_dump` → `~/zap/backups` (хранится 14 копий).
- Деплой обновления:
  ```bash
  # backend
  scp -r src prisma egox:~/zap/backend/ && ssh egox 'cd ~/zap/backend && pnpm build \
    && npx prisma migrate deploy && sudo systemctl restart zap-api'
  # frontend
  pnpm build && tar -czf f.tgz -C dist . && scp f.tgz egox:~/zap/ \
    && ssh egox 'sudo tar -xzf ~/zap/f.tgz -C /var/www/zapapp'
  ```
- TLS: после делегирования DNS (`zapapp.uz A 185.187.170.241`, `www` тоже):
  `sudo certbot --nginx -d zapapp.uz -d www.zapapp.uz`.

## SMS (send.smsxabar.uz)

`POST {SMS_SERVICE_URL}/broker-api/send`, Basic auth `USERNAME:PASSWORD`,
originator `SMS_ORIGINATOR` (по умолчанию 3700). `SMS_DRY_RUN=true` — коды в лог
(локалка/стейдж). **Креды, публиковавшиеся в переписке, считать скомпрометированными —
ротируйте в кабинете и обновите только `.env` на сервере.**

## Безопасность

- OTP: bcrypt-хэш, 5 мин TTL, 5 попыток, 3/час и 1/мин на номер + IP-троттлинг.
- PIN: bcrypt, 5 ошибок → лок 10 мин; деньги — только с одноразовым `X-Payment-Token`
  (JWT 2 мин, jti сжигается в БД).
- Refresh-токены: хэш в БД, ротация на каждом refresh, revoke на logout.
- Деньги: `Idempotency-Key` на POST, `SELECT … FOR UPDATE` на Split против гонок.
- PII: телефоны в логах маскируются (998\*\*\*\*\*\*XXX), body полей phone/code/pin — redact.
- Фискальные QR: заглушка `FiscalQrService` (контракт в merchants.service.ts) — след. фаза.
