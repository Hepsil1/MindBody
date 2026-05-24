import { Link } from "react-router";
import { useRef } from "react";
import { StorageUtils } from "../utils/storage";
import { useToast } from "./Toast";

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
}

export default function ProductCard({
    product,
    priority = false,
}: {
    product: Product;
    /** When true, the main image loads eager + fetchPriority="high".
        Pass true for the first 2-4 cards above the fold so LCP doesn't
        wait on lazy-load. Default false keeps lazy behaviour for the
        rest of the grid. */
    priority?: boolean;
}) {
    const { showToast } = useToast();
    const {
        id,
        name,
        category,
        price,
        image,
        image2,
        is_new,
        is_sale,
        sale_price,
        colors,
        discount_percent,
    } = product;
    const cardRef = useRef<HTMLElement>(null);

    const displayColors = colors?.length ? colors : [];

    const handleTiltMove = (e: React.MouseEvent<HTMLElement>) => {
        const card = cardRef.current;
        if (!card) return;
        const { left, top, width, height } = card.getBoundingClientRect();
        const x = (e.clientX - left) / width - 0.5;
        const y = (e.clientY - top) / height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
    };

    const handleTiltLeave = () => {
        const card = cardRef.current;
        if (!card) return;
        card.style.transform = "";
    };

    const handleAddToWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        const added = StorageUtils.addToWishlist({
            id,
            name,
            price: sale_price || price,
            image,
            category: category || "",
        });
        if (added) showToast("Додано до улюбленого!");
        else showToast("Вже у списку улюбленого", "info");
    };

    // Badge priority: SALE > NEW (show only one to keep it clean)
    const badge =
        is_sale && sale_price
            ? {
                  label: `-${discount_percent || Math.round((1 - sale_price / price) * 100)}%`,
                  type: "sale" as const,
              }
            : is_new
              ? { label: "NEW", type: "new" as const }
              : null;

    return (
        <article
            className="product-card"
            data-product-id={id}
            ref={cardRef}
            onMouseMove={handleTiltMove}
            onMouseLeave={handleTiltLeave}
        >
            <div className="product-card__image-wrapper">
                <Link to={`/product/${id}`} prefetch="intent" className="product-card__image-link">
                    <picture>
                        {image.match(/\.(jpg|jpeg|JPG|JPEG|png|PNG)$/) && (
                            <source
                                srcSet={image.replace(/\.(jpg|jpeg|JPG|JPEG|png|PNG)$/, ".webp")}
                                type="image/webp"
                            />
                        )}
                        <img
                            src={image}
                            alt={name}
                            className="product-card__img product-card__img--main"
                            loading={priority ? "eager" : "lazy"}
                            decoding="async"
                            fetchPriority={priority ? "high" : "auto"}
                            sizes="(max-width: 768px) 50vw, 25vw"
                            width="400"
                            height="500"
                        />
                    </picture>
                    {image2 && (
                        <picture>
                            {image2.match(/\.(jpg|jpeg|JPG|JPEG|png|PNG)$/) && (
                                <source
                                    srcSet={image2.replace(
                                        /\.(jpg|jpeg|JPG|JPEG|png|PNG)$/,
                                        ".webp",
                                    )}
                                    type="image/webp"
                                />
                            )}
                            <img
                                src={image2}
                                alt={name}
                                className="product-card__img product-card__img--hover"
                                loading="lazy"
                                decoding="async"
                                sizes="(max-width: 768px) 50vw, 25vw"
                                width="400"
                                height="500"
                            />
                        </picture>
                    )}
                    <div className="product-card__overlay"></div>
                </Link>

                {badge && (
                    <span className={`product-card__tag product-card__tag--${badge.type}`}>
                        {badge.label}
                    </span>
                )}

                <button
                    className="product-card__heart-btn"
                    aria-label="Додати в обране"
                    onClick={handleAddToWishlist}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                    >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>

                <Link
                    to={`/product/${id}`}
                    prefetch="intent"
                    className="product-card__quick-view"
                    aria-label="Quick view"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    Швидкий Перегляд
                </Link>
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
                            <span className="product-card__price-main product-card__price-main--sale">
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
                        <span className="product-card__price-main">{price.toLocaleString()} ₴</span>
                    )}
                </div>

                {displayColors.length > 0 && (
                    <div className="product-card__colors">
                        {displayColors.map((color, i) => (
                            <span
                                key={i}
                                className="product-card__color-dot"
                                style={{
                                    backgroundColor:
                                        color === "white"
                                            ? "#f5f5f5"
                                            : color === "black"
                                              ? "#222"
                                              : color,
                                }}
                                title={color}
                            ></span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
