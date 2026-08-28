-- Язык интерфейса на аккаунте: следует за пользователем между устройствами
-- и позволит локализовать SMS по получателю.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'uz';
