import { useState, useEffect } from "react";
import { StorageUtils } from "../utils/storage";
import { useToast } from "./Toast";
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
    onSelectColor,
    imageSizes = "(max-width: 768px) 50vw, 25vw",
}: {
    product: Product;
    /** When true, the main image loads eager + fetchPriority="high".
        Pass true for the first 2-4 cards above the fold so LCP doesn't
        wait on lazy-load. Default false keeps lazy behaviour for the
        rest of the grid. */
    priority?: boolean;
    /** Optional callback when a color swatch is clicked. When omitted,
        the swatches are display-only (still keyboard-focusable). */
    onSelectColor?: (product: Product, color: string) => void;
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
        is_new,
        is_sale,
        sale_price,
        colors,
        discount_percent,
        is_stock = true,
    } = product;
    // Canonical public URL is /p/<slug>; fall back to /product/<id> (which 301s
    // to the slug) when a card's data doesn't carry a slug yet.
    const href = product.slug ? `/p/${product.slug}` : `/product/${id}`;

    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const displayColors = colors?.length ? colors : [];

    // Reflect wishlist membership (client-only — avoids an SSR mismatch since
    // localStorage isn't available on the server). Subscribe so the heart stays
    // in sync if the item is toggled elsewhere (e.g. the wishlist page).
    const [wished, setWished] = useState(false);
    useEffect(() => {
        const sync = () => setWished(StorageUtils.isInWishlist(id));
        sync();
        return StorageUtils.subscribeToWishlist(sync);
    }, [id]);

    const handleAddToWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
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

    const handleSwatchClick = (e: React.MouseEvent, color: string) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedColor(color);
        onSelectColor?.(product, color);
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
        <article
            className={`product-card ${!is_stock ? "product-card--sold-out" : ""}`}
            data-product-id={id}
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
                            supported (96%+ modern), falls back to WebP. */}
                        <source
                            srcSet={buildAvifSrcset(image)}
                            sizes={imageSizes}
                            type="image/avif"
                        />
                        <source
                            srcSet={buildWebpSrcset(image)}
                            sizes={imageSizes}
                            type="image/webp"
                        />
                        <img
                            src={image}
                            alt={name}
                            className="product-card__img product-card__img--main"
                            loading={priority ? "eager" : "lazy"}
                            decoding="async"
                            fetchPriority={priority ? "high" : "auto"}
                            width="400"
                            height="533"
                        />
                    </picture>
                    {image2 && (
                        <picture>
                            <source
                                srcSet={buildAvifSrcset(image2)}
                                sizes={imageSizes}
                                type="image/avif"
                            />
                            <source
                                srcSet={buildWebpSrcset(image2)}
                                sizes={imageSizes}
                                type="image/webp"
                            />
                            <img
                                src={image2}
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
                                aria-label={t("Попередня ціна {price}", { price: money(price) })}
                            >
                                {money(price)}
                            </s>
                        </>
                    ) : (
                        <span className="product-card__price">{money(price)}</span>
                    )}
                </div>

                {displayColors.length > 0 && (
                    <div
                        className="product-card__colors"
                        role={onSelectColor ? "radiogroup" : undefined}
                        aria-label={onSelectColor ? t("Колір") : undefined}
                    >
                        {displayColors.slice(0, 5).map((color, i) => {
                            const isInteractive = !!onSelectColor;
                            const isSelected = selectedColor === color;
                            const cls = `product-card__swatch${isSelected ? " is-selected" : ""}`;
                            const style = { backgroundColor: resolveColor(color) };
                            const title = color.charAt(0).toUpperCase() + color.slice(1);
                            return isInteractive ? (
                                <button
                                    key={i}
                                    type="button"
                                    className={cls}
                                    style={style}
                                    title={title}
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={title}
                                    onClick={(e) => handleSwatchClick(e, color)}
                                />
                            ) : (
                                <span
                                    key={i}
                                    className={cls}
                                    style={style}
                                    title={title}
                                    aria-hidden="true"
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </article>
    );
}
