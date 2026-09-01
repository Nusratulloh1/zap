-- Реакции на оплату участника сплита (⚡ 😂 ❤️ 🫡 🤝).
-- Одна реакция от пользователя на участника: повторный тап меняет эмодзи,
-- тап тем же эмодзи снимает реакцию (обрабатывается в сервисе).
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Reaction_memberId_fromUserId_key" ON "Reaction"("memberId", "fromUserId");
CREATE INDEX "Reaction_splitId_idx" ON "Reaction"("splitId");

ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_splitId_fkey"
    FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "SplitMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
