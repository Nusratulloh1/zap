-- Токены устройств для пуш-уведомлений.
-- Аддитивная миграция: существующие таблицы не трогаются, веб не затрагивается.
CREATE TABLE IF NOT EXISTS "PushToken" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "platform"   TEXT NOT NULL,
    "locale"     TEXT NOT NULL DEFAULT 'uz',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_token_key" ON "PushToken"("token");
CREATE INDEX IF NOT EXISTS "PushToken_userId_idx" ON "PushToken"("userId");

ALTER TABLE "PushToken"
    ADD CONSTRAINT "PushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
