-- i18n: per-entity translation JSON + order locale.
-- All additive & nullable/defaulted — safe to apply on a live database.

ALTER TABLE "Product" ADD COLUMN "translations" TEXT;

ALTER TABLE "Category" ADD COLUMN "translations" TEXT;

ALTER TABLE "ShopPage" ADD COLUMN "translations" TEXT;

ALTER TABLE "Order" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'uk';
