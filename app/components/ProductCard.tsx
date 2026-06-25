import { useState, useEffect } from "react";
import { StorageUtils } from "../utils/storage";
import { AuthUtils } from "../utils/auth";
import { useToast } from "./Toast";
import { WishlistAuthModal } from "./WishlistAuthModal";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { useI18n, useMoney, LLink } from "../i18n";

export interface Product {
    id: string;
    slug?: string | null;
    name: string;
    category?: string;
    price: number;
    image: string;
    image2?: string | null;
    is_new?: boolean;
    is_sale?: boolean;
    sale_price?: number;
    colors?: string[];
    /** Per-colour gallery override {color: [urls]}. When present for a colour,
        hovering/tapping that swatch swaps the card's photos to that colour —
        "each colour is its own product". Missing colours just don't swap. */
    colorImages?: Record<string, string[]>;
    discount_percent?: number;
    is_stock?: boolean;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const NAMED_COLORS: Record<string, string> = {
    white: "#f5f5f5",
    black: "#1a1a1a",
    cream: "#faf8f6",
    teal: "#2a5a5a",
    sliva: "#4b3b6b",
    marsala: "#722f37",
    beige: "#d4c4a4",
    nude: "#e4d2c0",
    grey: "#999",
    gray: "#999",
};

function resolveColor(c: string): string {
    const key = c.toLowerCase().trim();
    if (NAMED_COLORS[key]) return NAMED_COLORS[key];
    if (HEX_RE.test(c)) return c;
    return c; // pass-through, browser may understand css color
}

export default function ProductCard({
    product,
    priority = false,
    imageSizes = "(max-width: 768px) 50vw, 25vw",
}: {
    product: Product;
    /** When true, the main image loads eager + fetchPriority="high".
        Pass true for the first 2-4 cards above the fold so LCP doesn't
        wait on lazy-load. Default false keeps lazy behaviour for the
        rest of the grid. */
    priority?: boolean;
    /** Override the responsive `sizes` attribute. Default is "50vw / 25vw"
        which matches the shop 2-col mobile grid. When the card is rendered
        in a larger context (e.g. home page carousel at 78vw) override this
        so the browser picks 800w/1200w webp variants instead of 400w —
        otherwise images render upscaled and look blurry on retina screens. */
    imageSizes?: string;
}) {
    const { showToast } = useToast();
    const { t } = useI18n();
    const money = useMoney();
    const {
        id,
        name,
        price,
        image,
        image2,
        colorImages,
        is_new,
        is_sale,
        sale_price,
        colors,
        discount_percent,
        is_stock = true,
    } = product;
    // Canonical public URL is /p/<slug>; fall back to /product/<id> (which 301s
    // to the slug) when a card's data doesn't carry a slug yet.
    const baseHref = product.slug ? `/p/${product.slug}` : `/product/${id}`;

    const displayColors = colors?.length ? colors : [];

    // Hovering (desktop) / focusing a swatch previews that colour right on the
    // card: the photos swap to the colour's own gallery. Tapping/clicking the
    // swatch opens the PDP already switched to that colour (?color=). Colours
    // without their own photos still link through, they just don't preview.
    const [activeColor, setActiveColor] = useState<string | null>(null);
    const activeGallery =
        activeColor && colorImages?.[activeColor]?.length ? colorImages[activeColor] : null;
    // Main image follows the previewed colour; the CSS hover-swap image is the
    // colour's 2nd photo (or its cover if it only has one) so the on-hover flip
    // stays inside the previewed colour instead of jumping back to the default.
    const mainImage = activeGallery ? activeGallery[0] : image;
    const hoverImage = activeGallery ? (activeGallery[1] ?? activeGallery[0]) : image2;
    // Clicking the photo carries the previewed colour into the PDP too.
    const href = activeColor ? `${baseHref}?color=${encodeURIComponent(activeColor)}` : baseHref;

    // Reflect wishlist membership (client-only — avoids an SSR mismatch since
    // localStorage isn't available on the server). Subscribe so the heart stays
    // in sync if the item is toggled elsewhere (e.g. the wishlist page).
    const [wished, setWished] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    useEffect(() => {
        const sync = () => setWished(StorageUtils.isInWishlist(id));
        sync();
        return StorageUtils.subscribeToWishlist(sync);
    }, [id]);

    const handleAddToWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!AuthUtils.getAuthState().isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        if (StorageUtils.isInWishlist(id)) {
            StorageUtils.removeFromWishlist(id);
            showToast(t("Прибрано з улюбленого"), "info");
            return;
        }
        StorageUtils.addToWishlist({
            id,
            name,
            price: sale_price || price,
            image,
            category: product.category || "",
        });
        showToast(t("Додано до улюбленого ✦"));
    };

    // Badge: SALE wins over NEW. Sold-out wins over both.
    const badge = !is_stock
        ? { label: "Sold out", type: "soldout" as const }
        : is_sale && sale_price
          ? {
                label: `−${discount_percent || Math.round((1 - sale_price / price) * 100)}%`,
                type: "sale" as const,
            }
          : is_new
            ? { label: "New", type: "new" as const }
            : null;

    // framer-motion removed — the hover-lift / tap-shrink is now pure CSS
    // (.product-card:hover/:active in app.css). That drops the 6 MB
    // framer-motion dep out of the catalogue/home hydration bundle, where
    // ProductCard renders dozens of times.
    return (
        <>
            {showAuthModal && <WishlistAuthModal onClose={() => setShowAuthModal(false)} />}
            <article
                className={`product-card ${!is_stock ? "product-card--sold-out" : ""}`}
                data-product-id={id}
                onMouseLeave={() => setActiveColor(null)}
            >
                <div
                    className="product-card__image-wrapper"
                    /* Batch 40 atom 8: LQIP blur-up — apply the tiny base64
                   placeholder as background-image so visitors see the
                   image's overall composition instantly instead of a
                   blank cream rectangle while the sharp variant decodes.
                   When the <img> finishes loading it covers the blur. */
                    style={getLqipStyle(image)}
                >
                    <LLink to={href} prefetch="intent" className="product-card__image-link">
                        <picture>
                            {/* Batch 40 atom 6: AVIF first — browser picks if
                            supported (96%+ modern), falls back to WebP.
                            `key` forces a fresh decode when the previewed
                            colour swaps the cover so the new photo paints. */}
                            <source
                                key={`avif-${mainImage}`}
                                srcSet={buildAvifSrcset(mainImage)}
                                sizes={imageSizes}
                                type="image/avif"
                            />
                            <source
                                key={`webp-${mainImage}`}
                                srcSet={buildWebpSrcset(mainImage)}
                                sizes={imageSizes}
                                type="image/webp"
                            />
                            <img
                                src={mainImage}
                                alt={name}
                                className="product-card__img product-card__img--main"
                                loading={priority ? "eager" : "lazy"}
                                decoding="async"
                                fetchPriority={priority ? "high" : "auto"}
                                width="400"
                                height="533"
                            />
                        </picture>
                        {hoverImage && (
                            <picture>
                                <source
                                    key={`avif-h-${hoverImage}`}
                                    srcSet={buildAvifSrcset(hoverImage)}
                                    sizes={imageSizes}
                                    type="image/avif"
                                />
                                <source
                                    key={`webp-h-${hoverImage}`}
                                    srcSet={buildWebpSrcset(hoverImage)}
                                    sizes={imageSizes}
                                    type="image/webp"
                                />
                                <img
                                    src={hoverImage}
                                    alt={name}
                                    className="product-card__img product-card__img--hover"
                                    loading="lazy"
                                    decoding="async"
                                    width="400"
                                    height="533"
                                />
                            </picture>
                        )}
                        {!is_stock && (
                            <div className="product-card__soldout-overlay" aria-hidden="true">
                                <span>{t("Немає в наявності")}</span>
                            </div>
                        )}
                    </LLink>

                    {badge && (
                        <span className={`product-card__badge product-card__badge--${badge.type}`}>
                            {badge.label}
                        </span>
                    )}

                    <button
                        type="button"
                        className={`product-card__heart-btn${wished ? " is-active" : ""}`}
                        aria-label={wished ? t("Прибрати з обраного") : t("Додати в обране")}
                        aria-pressed={wished}
                        onClick={handleAddToWishlist}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill={wished ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </button>
                </div>

                <div className="product-card__details">
                    <h3 className="product-card__title">
                        <LLink to={href} prefetch="intent">
                            {name}
                        </LLink>
                    </h3>

                    <div className="product-card__price-row">
                        {is_sale && sale_price ? (
                            <>
                                <span className="product-card__price product-card__price--sale">
                                    {money(sale_price)}
                                </span>
                                <s
                                    className="product-card__price-old"
                                    aria-label={t("Попередня ціна {price}", {
                                        price: money(price),
                                    })}
                                >
                                    {money(price)}
                                </s>
                            </>
                        ) : (
                            <span className="product-card__price">{money(price)}</span>
                        )}
                    </div>

                    {displayColors.length > 0 && (
                        <div className="product-card__colors" role="group" aria-label={t("Колір")}>
                            {displayColors.slice(0, 5).map((color, i) => {
                                const isActive = activeColor === color;
                                const hasGallery = !!colorImages?.[color]?.length;
                                const cls = `product-card__swatch${isActive ? " is-active" : ""}${
                                    hasGallery ? " has-gallery" : ""
                                }`;
                                const style = { backgroundColor: resolveColor(color) };
                                const title = color.charAt(0).toUpperCase() + color.slice(1);
                                return (
                                    <LLink
                                        key={i}
                                        to={`${baseHref}?color=${encodeURIComponent(color)}`}
                                        prefetch="intent"
                                        className={cls}
                                        style={style}
                                        title={title}
                                        aria-label={title}
                                        onMouseEnter={() => setActiveColor(color)}
                                        onFocus={() => setActiveColor(color)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </article>
        </>
    );
}
