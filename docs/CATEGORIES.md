# Categories: slugs, subcategory URLs, and how to add new ones

## TL;DR

- `Product.category` in the database stores a **slug** (latin, lowercase,
  hyphenated). Never a Ukrainian label.
- The Ukrainian display label is derived **on the fly** through
  `slugToLabel(slug)` from `app/utils/categoryMap.ts`.
- Each `(shop, subcategory)` pair gets its own URL:
  `/shop/<shop>/<subcategory>` (e.g. `/shop/sport/longsleeve`). No
  Cyrillic in URLs — ever.
- Old `?categories=` and `?cat=` query strings (including Cyrillic ones
  that may be in Google's index) 301-redirect to the new path form
  automatically.

## Why

We had a hidden mismatch: `Product.category` historically stored the
Ukrainian label (`"Лонгсліви"`), while the UI generated URLs with the
slug (`?categories=longsleeve`). The runtime glued them together with
`labelToSlug()` / `slugToLabel()`, but any URL built directly from a DB
value leaked Cyrillic into the address bar. Cyrillic in URLs:

- becomes `%D0%9B%D0%BE%D0%BD%D0%B3...` in social previews (Telegram,
  Facebook, Twitter render placeholder cards instead of the article);
- ranks worse in Google than ASCII paths;
- looks unprofessional when shared in chats.

The migration on 2026-05-19 collapsed the two stores into one (slug),
moved subcategories from `?categories=` to the URL path, and added a
whitelist so invalid combinations 301 back to the parent shop.

## Adding a new subcategory

Four steps, in this order:

1. **Add the slug → label entry** to `CATEGORY_MAP` in
   `app/utils/categoryMap.ts`. Use a lowercase ASCII slug
   (`bra-tops`, not `bra_tops` or `BraTops`).
2. **Whitelist the pair** in `CATEGORY_BY_SHOP_PAGE`. List every
   shop slug (`yoga`, `sport`, `dance`, `casual`, `kids`, `yogatools`)
   that should expose this subcategory. Pairs NOT in the whitelist
   301-redirect to the parent shop — Google won't index them and direct
   visitors land on the safe parent listing.
3. **Add the nav link** in `app/components/Header.tsx`. Use the literal
   path form (`to="/shop/<shop>/<sub>"`) — no `?categories=` and no
   Cyrillic in the `to=` value.
4. **Use the slug in the admin** when creating products. The admin select
   dropdown sources labels from `FilterConfig.config` in the DB; if the
   slug isn't there yet, the admin needs to add it via the filter editor
   (or the DB needs a tiny `UPDATE` on `FilterConfig` to extend the
   `categories` map).

That's it. Sitemap, JSON-LD, breadcrumbs, and 301 redirects pick the new
pair up automatically.

## What gets generated for `/shop/sport/longsleeve`

Each subcategory URL ships its own:

- `<title>`: `Лонгсліви — SPORT | MIND BODY`
- `<link rel="canonical">`: `https://saleid.icu/shop/sport/longsleeve`
- Open Graph + Twitter Card (title, description, image)
- `BreadcrumbList` JSON-LD with 3 levels (Home → SPORT → Лонгсліви)
- `CollectionPage` JSON-LD with an `ItemList` of just the products in
  this subcategory (not the whole shop)

The sidebar reflects the path-selected subcategory as a pre-checked
filter. The URL stays clean — the sync-to-URL effect knows when it's on
`/shop/cat/sub` and avoids re-stamping `?categories=` onto the query.

## Defence in depth

- `app/utils/categoryMap.ts → ALLOWED_CATEGORY_SLUGS` — central set of
  every recognised slug. Use it for any future server-side validation.
- `app/utils/categoryMap.ts → isValidSubcategory(shop, sub)` — the
  guard the route uses to 301 invalid combinations. Reuse it instead of
  duplicating the whitelist.
- `app/routes/shop.$category.tsx` loader redirects single-selection
  legacy queries (`?categories=longsleeve`, `?categories=Лонгсліви`,
  `?cat=Лонгсліви`) to the new path. Multi-select (`?categories=a,b`)
  stays as a query because there's no clean single-canonical equivalent.

## Where everything lives

| Concern                                 | File                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| Slug ↔ label table                      | `app/utils/categoryMap.ts`                           |
| Per-shop whitelist                      | `app/utils/categoryMap.ts` → `CATEGORY_BY_SHOP_PAGE` |
| URL builder                             | `app/utils/categoryMap.ts` → `buildSubcategoryUrl`   |
| Listing route (parent)                  | `app/routes/shop.$category.tsx`                      |
| Subcategory route (nested)              | `app/routes/shop.$category.$subcategory.tsx`         |
| 301 redirects (legacy query → new path) | `app/routes/shop.$category.tsx` loader               |
| Sitemap subcategory URLs                | `app/routes/sitemap[.]xml.tsx`                       |
| Nav links                               | `app/components/Header.tsx`                          |
| Unit tests                              | `tests/unit/categoryMap.test.ts`                     |

## Verification one-liners

```powershell
# 1. No Cyrillic left in DB
psql -d mindbody_db -c "SELECT category, COUNT(*) FROM \"Product\" WHERE category ~ '[А-Яа-яІіЇїЄєҐґ]' GROUP BY category;"

# 2. New URL works + has subcategory CollectionPage JSON-LD
curl -s https://saleid.icu/shop/sport/longsleeve | findstr "CollectionPage"

# 3. Legacy queries 301
curl -I "https://saleid.icu/shop/sport?categories=longsleeve"
curl -I "https://saleid.icu/shop/sport?categories=%D0%9B%D0%BE%D0%BD%D0%B3%D1%81%D0%BB%D1%96%D0%B2%D0%B8"

# 4. Sitemap lists subcategories
curl -s https://saleid.icu/sitemap.xml | findstr /R "/shop/.*/.*<"
```
