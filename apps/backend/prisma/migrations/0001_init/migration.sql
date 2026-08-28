-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('login', 'participant_pay');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('UZCARD', 'HUMO');

-- CreateEnum
CREATE TYPE "SplitMode" AS ENUM ('equal', 'manual', 'items');

-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('active', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('pending', 'opened', 'paid', 'covered', 'debt');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('open', 'settled');

-- CreateEnum
CREATE TYPE "CashbackStatus" AS ENUM ('available', 'held_debt', 'spent', 'withdrawn');

-- CreateEnum
CREATE TYPE "SmsKind" AS ENUM ('otp', 'split_link', 'reminder');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "handle" TEXT,
    "avatarUrl" TEXT,
    "pinHash" TEXT,
    "pinFailCount" INTEGER NOT NULL DEFAULT 0,
    "pinLockedTil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'login',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumedJti" (
    "jti" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedJti_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL,
    "last4" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "linkedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "letter" TEXT NOT NULL DEFAULT 'M',
    "color" TEXT NOT NULL DEFAULT '#111110',
    "logoUrl" TEXT,
    "cashbackRate" INTEGER NOT NULL DEFAULT 25,
    "cashbackX2" BOOLEAN NOT NULL DEFAULT false,
    "cashbackConditions" JSONB,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "tableRef" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Split" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "billId" TEXT,
    "merchantId" TEXT,
    "title" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "mode" "SplitMode" NOT NULL,
    "status" "SplitStatus" NOT NULL DEFAULT 'active',
    "groupId" TEXT,
    "cashback" INTEGER,
    "cashbackX2" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Split_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitMember" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shareAmount" INTEGER NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'pending',
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "lastRemindedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "coveredById" TEXT,

    CONSTRAINT "SplitMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAssignment" (
    "splitMemberId" TEXT NOT NULL,
    "billItemId" TEXT NOT NULL,
    "qtyShare" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ItemAssignment_pkey" PRIMARY KEY ("splitMemberId","billItemId")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cashbackPoolEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cashbackPool" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "debtorUserId" TEXT,
    "debtorPhone" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL DEFAULT '',
    "splitId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "DebtStatus" NOT NULL DEFAULT 'open',
    "settledAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashbackEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "splitId" TEXT,
    "merchantId" TEXT,
    "amount" INTEGER NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "status" "CashbackStatus" NOT NULL DEFAULT 'available',
    "releasedByDebtId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "badge" TEXT NOT NULL DEFAULT '',
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashbackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "amountSigned" INTEGER NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "kind" "SmsKind" NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "debtNotifications" BOOLEAN NOT NULL DEFAULT true,
    "promoDismissed" BOOLEAN NOT NULL DEFAULT false,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "pendingCashback" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_phone_key" ON "Contact"("ownerId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_qrPayload_key" ON "Bill"("qrPayload");

-- CreateIndex
CREATE UNIQUE INDEX "Split_code_key" ON "Split"("code");

-- CreateIndex
CREATE INDEX "Split_creatorId_createdAt_idx" ON "Split"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "SplitMember_phone_idx" ON "SplitMember"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "SplitMember_splitId_phone_key" ON "SplitMember"("splitId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_phone_key" ON "GroupMember"("groupId", "phone");

-- CreateIndex
CREATE INDEX "Debt_creditorId_status_idx" ON "Debt"("creditorId", "status");

-- CreateIndex
CREATE INDEX "Debt_debtorPhone_idx" ON "Debt"("debtorPhone");

-- CreateIndex
CREATE INDEX "CashbackEntry_userId_createdAt_idx" ON "CashbackEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HistoryEvent_userId_createdAt_idx" ON "HistoryEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_phone_createdAt_idx" ON "SmsLog"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Split" ADD CONSTRAINT "Split_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Split" ADD CONSTRAINT "Split_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Split" ADD CONSTRAINT "Split_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Split" ADD CONSTRAINT "Split_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitMember" ADD CONSTRAINT "SplitMember_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_splitMemberId_fkey" FOREIGN KEY ("splitMemberId") REFERENCES "SplitMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_debtorUserId_fkey" FOREIGN KEY ("debtorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackEntry" ADD CONSTRAINT "CashbackEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackEntry" ADD CONSTRAINT "CashbackEntry_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackEntry" ADD CONSTRAINT "CashbackEntry_releasedByDebtId_fkey" FOREIGN KEY ("releasedByDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

