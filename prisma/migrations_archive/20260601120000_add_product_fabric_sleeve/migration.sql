-- Deeper taxonomy attributes on Product (Level 3 fabric, Level 4 sleeve).
-- Additive + nullable = no data loss. Idempotent so it's safe to re-run and
-- safe alongside the moodType column that was applied out-of-band.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fabric" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sleeve" TEXT;

CREATE INDEX IF NOT EXISTS "Product_fabric_idx" ON "Product"("fabric");
CREATE INDEX IF NOT EXISTS "Product_sleeve_idx" ON "Product"("sleeve");
