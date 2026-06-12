-- Per-colour gallery override for products. JSON map color -> image URLs.
-- Colours without an entry fall back to the shared "images" array.
ALTER TABLE "Product" ADD COLUMN "colorImages" TEXT;
