-- Editable shop taxonomy (shop -> category -> {label, fabrics[], sleeves[]})
-- stored as one JSON blob. Absent/empty -> code falls back to DEFAULT_TAXONOMY,
-- so the menu/filters never break.
CREATE TABLE "TaxonomyConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxonomyConfig_pkey" PRIMARY KEY ("id")
);
