-- AlterTable Order: add accessToken and trackingNumber
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;

-- CreateTable AbandonedCart
CREATE TABLE IF NOT EXISTS "AbandonedCart" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uk',
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastRemindedAt" TIMESTAMP(3),
    "recoveredOrderId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable StockSubscription
CREATE TABLE IF NOT EXISTS "StockSubscription" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'uk',
    "status" TEXT NOT NULL DEFAULT 'active',
    "unsubToken" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AbandonedCart_sessionKey_key" ON "AbandonedCart"("sessionKey");
CREATE INDEX IF NOT EXISTS "AbandonedCart_status_lastActivityAt_idx" ON "AbandonedCart"("status", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "AbandonedCart_email_idx" ON "AbandonedCart"("email");
CREATE INDEX IF NOT EXISTS "AbandonedCart_phone_idx" ON "AbandonedCart"("phone");

CREATE UNIQUE INDEX IF NOT EXISTS "StockSubscription_unsubToken_key" ON "StockSubscription"("unsubToken");
CREATE INDEX IF NOT EXISTS "StockSubscription_productId_status_idx" ON "StockSubscription"("productId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "StockSubscription_productId_size_color_email_key" ON "StockSubscription"("productId", "size", "color", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "Order_accessToken_key" ON "Order"("accessToken");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockSubscription_productId_fkey'
    ) THEN
        ALTER TABLE "StockSubscription" ADD CONSTRAINT "StockSubscription_productId_fkey" 
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill Order.accessToken for existing orders
UPDATE "Order" 
SET "accessToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "accessToken" IS NULL;
