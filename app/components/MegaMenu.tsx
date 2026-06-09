import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { subcategoriesFor, fabricLabel, sleeveLabel } from "../utils/taxonomy";
import { buildWebpSrcset } from "../utils/responsive-image";

export interface MegaFeatured {
    image: string;
    badge?: string;
    title: string;
}

interface MegaMenuProps {
    /** shopPageSlug — yoga | sport | dance | casual | kids | yogatools */
    shop: string;
    featured: MegaFeatured;
    /** Called on any link click (closes the mobile menu in the header). */
    onNavigate?: () => void;
}

/**
 * Data-driven hero mega-menu rendered from TAXONOMY (app/utils/taxonomy.ts) —
 * the full category → subcategory → fabric → sleeve depth, mirroring the brand
 * spreadsheet. Desktop-only (hidden on mobile via .mega-menu display:none).
 * Deep links carry the facets as query params so they land on a pre-filtered
 * shop page, e.g. /shop/yoga/jumpsuit?fabric=sport&sleeve=long.
 */
export default function MegaMenu({ shop, featured, onNavigate }: MegaMenuProps) {
    const subs = subcategoriesFor(shop);

    // Sections with a lot of fabric/sleeve depth (yoga, sport) get an explicit
    // wider panel so the column flow can form multiple balanced columns;
    // shallow sections stay compact. A shrink-wrapped multi-column panel
    // collapses to a single tall column, hence this flag.
    const deepCount = subs.reduce((n, [, d]) => {
        const f = d.fabrics?.length ?? 0;
        const s = d.sleeves?.length ?? 0;
        return n + (f > 0 ? f * (1 + s) : s);
    }, 0);
    const wide = deepCount >= 8;

    // Smart positioning: the panel is centred under its nav item via
    // translateX(-50%). On the edge items (yoga = leftmost, yogatools =
    // rightmost) a wide panel can run off-screen, so clamp it into the
    // viewport with a CSS-var offset. Recomputed on hover (the header shifts
    // between hero/scrolled states) and on resize. Measured even while hidden —
    // visibility:hidden keeps layout, so getBoundingClientRect is valid.
    const megaRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = megaRef.current;
        const li = el?.parentElement;
        if (!el || !li) return;
        // Batch the reset→measure→set in a single rAF so repeated mouseenters
        // don't each force a synchronous reflow (layout thrash).
        let raf = 0;
        const position = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                el.style.setProperty("--mega-shift", "0px");
                const rect = el.getBoundingClientRect();
                const margin = 12;
                let shift = 0;
                if (rect.left < margin) shift = margin - rect.left;
                else if (rect.right > window.innerWidth - margin)
                    shift = window.innerWidth - margin - rect.right;
                el.style.setProperty("--mega-shift", `${Math.round(shift)}px`);
            });
        };
        position();
        li.addEventListener("mouseenter", position);
        window.addEventListener("resize", position);
        return () => {
            cancelAnimationFrame(raf);
            li.removeEventListener("mouseenter", position);
            window.removeEventListener("resize", position);
        };
    }, [wide, shop]);

    return (
        <div ref={megaRef} className={`mega-menu${wide ? " mega-menu--wide" : ""}`}>
            <div className="mega-menu__inner">
                <div className="mega-menu__cols">
                    {/* Category root */}
                    <div className="mega-menu__group">
                        <Link
                            to={`/shop/${shop}`}
                            prefetch="intent"
                            className="mega-menu__group-head mega-menu__group-head--all"
                            onClick={onNavigate}
                        >
                            Всі товари
                        </Link>
                    </div>

                    {subs.map(([sub, def]) => {
                        const base = `/shop/${shop}/${sub}`;
                        return (
                            <div key={sub} className="mega-menu__group">
                                <Link
                                    to={base}
                                    prefetch="intent"
                                    className="mega-menu__group-head"
                                    onClick={onNavigate}
                                >
                                    {def.label}
                                </Link>

                                {/* Level 3/4: fabric → sleeve (if any). */}
                                {def.fabrics && def.fabrics.length > 0
                                    ? def.fabrics.map((f) => (
                                          <div key={f} className="mega-menu__fabric">
                                              <Link
                                                  to={`${base}?fabric=${f}`}
                                                  prefetch="intent"
                                                  className="mega-menu__sublink mega-menu__sublink--fabric"
                                                  onClick={onNavigate}
                                              >
                                                  {fabricLabel(f)}
                                              </Link>
                                              {def.sleeves?.map((s) => (
                                                  <Link
                                                      key={s}
                                                      to={`${base}?fabric=${f}&sleeve=${s}`}
                                                      prefetch="intent"
                                                      className="mega-menu__sublink mega-menu__sublink--sleeve"
                                                      onClick={onNavigate}
                                                  >
                                                      {sleeveLabel(s)}
                                                  </Link>
                                              ))}
                                          </div>
                                      ))
                                    : def.sleeves?.map((s) => (
                                          <Link
                                              key={s}
                                              to={`${base}?sleeve=${s}`}
                                              prefetch="intent"
                                              className="mega-menu__sublink mega-menu__sublink--sleeve"
                                              onClick={onNavigate}
                                          >
                                              {sleeveLabel(s)}
                                          </Link>
                                      ))}
                            </div>
                        );
                    })}
                </div>

                <div className="mega-menu__featured">
                    <div className="mega-menu__featured-img">
                        <picture>
                            <source
                                srcSet={buildWebpSrcset(featured.image)}
                                sizes="(max-width: 1024px) 50vw, 240px"
                                type="image/webp"
                            />
                            <img
                                src={featured.image}
                                alt={featured.title}
                                loading="lazy"
                                decoding="async"
                            />
                        </picture>
                        {featured.badge && (
                            <div className="mega-menu__featured-badge">{featured.badge}</div>
                        )}
                    </div>
                    <div className="mega-menu__featured-content">
                        <h5>{featured.title}</h5>
                        <Link
                            to={`/shop/${shop}`}
                            prefetch="intent"
                            className="mega-menu__featured-link"
                            onClick={onNavigate}
                        >
                            Переглянути →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
