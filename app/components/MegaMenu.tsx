import { Link } from "react-router";
import { subcategoriesFor, fabricLabel, sleeveLabel } from "../utils/taxonomy";
import { buildWebpSrcset } from "../utils/responsive-image";

export interface MegaFeatured {
    image: string;
    badge?: string;
    title: string;
}

export interface MegaNavItem {
    /** shopPageSlug — yoga | sport | dance | casual | kids | yogatools */
    shop: string;
    label: string;
    featured: MegaFeatured;
}

/**
 * Text-column volume of a section in "rows" (group heads + fabric/sleeve
 * links + the «Всі товари» root). Drives how many masonry columns the
 * desktop panel gets — counting ONLY fabric/sleeve depth (the old
 * heuristic) collapsed sub-heavy sections like CASUAL (8 plain groups)
 * into a single viewport-tall column.
 */
function megaColsFor(shop: string): 1 | 2 | 3 {
    const rows = subcategoriesFor(shop).reduce((n, [, d]) => {
        const f = d.fabrics?.length ?? 0;
        const s = d.sleeves?.length ?? 0;
        return n + 1 + (f > 0 ? f * (1 + s) : s);
    }, 1);
    return rows >= 20 ? 3 : rows >= 8 ? 2 : 1;
}

interface MegaMenuContentProps {
    shop: string;
    featured: MegaFeatured;
    /** Called on any link click (closes the panel / the mobile drawer). */
    onNavigate?: () => void;
}

/**
 * The taxonomy-driven body shared by BOTH mega-menu surfaces: the mobile
 * drawer accordion (inside its nav <li>) and the desktop shared panel.
 * Renders the full category → subcategory → fabric → sleeve depth from
 * TAXONOMY (app/utils/taxonomy.ts). Deep links carry facets as query params
 * so they land on a pre-filtered shop page, e.g.
 * /shop/yoga/jumpsuit?fabric=sport&sleeve=long.
 */
export function MegaMenuContent({ shop, featured, onNavigate }: MegaMenuContentProps) {
    const subs = subcategoriesFor(shop);

    return (
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
    );
}

interface MegaMenuProps {
    shop: string;
    featured: MegaFeatured;
    onNavigate?: () => void;
}

/**
 * Mobile-only accordion body inside each drawer nav <li>. On desktop
 * .mega-menu is display:none — the hover panel is <MegaPanel> below, a
 * SINGLE shared element so two categories can never overlap. (The old
 * per-item :hover/:focus-within panels pinned open after SPA clicks —
 * focus stayed on the link — and crossfaded over each other in transit.)
 */
export default function MegaMenu({ shop, featured, onNavigate }: MegaMenuProps) {
    return (
        <div className="mega-menu">
            <MegaMenuContent shop={shop} featured={featured} onNavigate={onNavigate} />
        </div>
    );
}

interface MegaPanelProps {
    items: MegaNavItem[];
    /** Currently hovered/active shop, or null when the panel is closed. */
    active: string | null;
    /** Last non-null shop — keeps content rendered during the close fade. */
    shown: string;
    id: string;
    onNavigate?: () => void;
    onPanelEnter?: (e: React.PointerEvent) => void;
    onPanelLeave?: (e: React.PointerEvent) => void;
}

/**
 * The desktop mega-menu: ONE panel anchored under the header, shared by all
 * nav items. Hovering another category swaps the page inside (quick fade +
 * width morph between 1/2/3-column sizes) instead of opening a second
 * absolutely-positioned panel — overlap is impossible by construction.
 * All six pages stay in the SSR DOM (hidden) so crawlers see every deep link.
 */
export function MegaPanel({
    items,
    active,
    shown,
    id,
    onNavigate,
    onPanelEnter,
    onPanelLeave,
}: MegaPanelProps) {
    const cols = megaColsFor(shown);
    const open = active !== null;

    return (
        <>
            <div className={`mega-panel-backdrop${open ? " is-open" : ""}`} aria-hidden="true" />
            <div
                id={id}
                className={`mega-panel mega-panel--c${cols}${open ? " is-open" : ""}`}
                onPointerEnter={onPanelEnter}
                onPointerLeave={onPanelLeave}
            >
                {items.map((item) => (
                    <div
                        key={item.shop}
                        className={`mega-panel__page${item.shop === active ? " is-active" : ""}`}
                        hidden={item.shop !== shown}
                    >
                        <MegaMenuContent
                            shop={item.shop}
                            featured={item.featured}
                            onNavigate={onNavigate}
                        />
                    </div>
                ))}
            </div>
        </>
    );
}
