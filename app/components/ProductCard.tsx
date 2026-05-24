import { Link } from "react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { StorageUtils } from "../utils/storage";
import { useToast } from "./Toast";
import { buildWebpSrcset } from "../utils/responsive-image";

export interface Product {
    id: string;
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

    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const displayColors = colors?.length ? colors : [];

    const handleAddToWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const added = StorageUtils.addToWishlist({
            id,
            name,
            price: sale_price || price,
            image,
            category: product.category || "",
        });
        if (added) showToast("Додано до улюбленого ✦");
        else showToast("Вже у списку улюбленого", "info");
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

    return (
        <motion.article
            className={`product-card ${!is_stock ? "product-card--sold-out" : ""}`}
            data-product-id={id}
            whileHover={{ y: -4, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
            whileTap={{ scale: 0.99 }}
        >
            <div className="product-card__image-wrapper">
                <Link to={`/product/${id}`} prefetch="intent" className="product-card__image-link">
                    <picture>
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
                            <span>Немає в наявності</span>
                        </div>
                    )}
                </Link>

                {badge && (
                    <span className={`product-card__badge product-card__badge--${badge.type}`}>
                        {badge.label}
                    </span>
                )}

                <motion.button
                    className="product-card__heart-btn"
                    aria-label="Додати в обране"
                    onClick={handleAddToWishlist}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </motion.button>
            </div>

            <div className="product-card__details">
                <h3 className="product-card__title">
                    <Link to={`/product/${id}`} prefetch="intent">
                        {name}
                    </Link>
                </h3>

                <div className="product-card__price-row">
                    {is_sale && sale_price ? (
                        <>
                            <span className="product-card__price product-card__price--sale">
                                {sale_price.toLocaleString()} ₴
                            </span>
                            <s
                                className="product-card__price-old"
                                aria-label={`Попередня ціна ${price.toLocaleString()} гривень`}
                            >
                                {price.toLocaleString()} ₴
                            </s>
                        </>
                    ) : (
                        <span className="product-card__price">{price.toLocaleString()} ₴</span>
                    )}
                </div>

                {displayColors.length > 0 && (
                    <div
                        className="product-card__colors"
                        role={onSelectColor ? "radiogroup" : undefined}
                        aria-label={onSelectColor ? "Колір" : undefined}
                    >
                        {displayColors.slice(0, 5).map((color, i) => {
                            const isInteractive = !!onSelectColor;
                            const isSelected = selectedColor === color;
                            const cls = `product-card__swatch${isSelected ? " is-selected" : ""}`;
                            const style = { backgroundColor: resolveColor(color) };
                            const title = color.charAt(0).toUpperCase() + color.slice(1);
                            return isInteractive ? (
                                <motion.button
                                    key={i}
                                    type="button"
                                    className={cls}
                                    style={style}
                                    title={title}
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={title}
                                    onClick={(e) => handleSwatchClick(e, color)}
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.92 }}
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
        </motion.article>
    );
}
