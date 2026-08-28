-- CreateTable
CREATE TABLE "FiscalReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'page',
    "merchantName" TEXT,
    "merchantInn" TEXT,
    "receiptDatetime" TIMESTAMP(3),
    "totalAmount" INTEGER,
    "snapshotFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qtyMilli" INTEGER NOT NULL DEFAULT 1000,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "FiscalReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalReceipt_fiscalKey_key" ON "FiscalReceipt"("fiscalKey");

-- CreateIndex
CREATE INDEX "FiscalReceipt_userId_createdAt_idx" ON "FiscalReceipt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FiscalEvent_kind_createdAt_idx" ON "FiscalEvent"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "FiscalReceiptItem" ADD CONSTRAINT "FiscalReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "FiscalReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

