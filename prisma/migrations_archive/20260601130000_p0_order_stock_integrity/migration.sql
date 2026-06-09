-- P0 order/stock integrity.
-- Additive + idempotent (IF NOT EXISTS / inline FK) so it is safe to re-run and
-- safe to apply on top of an existing DB. No data loss.

-- Order: promo snapshot + checkout idempotency + email outcome.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "appliedPromoCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(65,30) DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "emailStatus" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- Append-only stock audit.
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantKey" TEXT,
    "delta" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- Order status / payment transitions audit.
CREATE TABLE IF NOT EXISTS "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT 'status',
    "fromValue" TEXT,
    "toValue" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'admin',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");
