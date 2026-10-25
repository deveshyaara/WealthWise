-- AlterTable accounts: Add currency with safe default 'USD'
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

-- CreateTable: budget_categories
CREATE TABLE IF NOT EXISTS "budget_categories" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "category" TEXT NOT NULL,
    "accountId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: receipt_attachments
CREATE TABLE IF NOT EXISTS "receipt_attachments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT,
    "fileData" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budget_categories_userId_category_accountId_key" ON "budget_categories"("userId", "category", "accountId");
CREATE INDEX IF NOT EXISTS "budget_categories_userId_idx" ON "budget_categories"("userId");
CREATE INDEX IF NOT EXISTS "budget_categories_accountId_idx" ON "budget_categories"("accountId");

CREATE UNIQUE INDEX IF NOT EXISTS "receipt_attachments_transactionId_key" ON "receipt_attachments"("transactionId");
CREATE INDEX IF NOT EXISTS "receipt_attachments_userId_idx" ON "receipt_attachments"("userId");
CREATE INDEX IF NOT EXISTS "receipt_attachments_transactionId_idx" ON "receipt_attachments"("transactionId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'budget_categories_userId_fkey'
    ) THEN
        ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'budget_categories_accountId_fkey'
    ) THEN
        ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'receipt_attachments_transactionId_fkey'
    ) THEN
        ALTER TABLE "receipt_attachments" ADD CONSTRAINT "receipt_attachments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'receipt_attachments_userId_fkey'
    ) THEN
        ALTER TABLE "receipt_attachments" ADD CONSTRAINT "receipt_attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
