import { Link } from "react-router";
import type { Product } from "../types/product";
import { StorageUtils } from "../utils/storage";
import { useToast } from "./Toast";

interface ExtendedProduct extends Product {
    discount_percent?: number;
    image2?: string;
}

export default function ProductCard({ product }: { product: ExtendedProduct }) {
    const { showToast } = useToast();
    const { id, name, category, price, image, image2, is_new, is_sale, sale_price, colors, discount_percent } = product;

    const displayColors = colors?.length ? colors : [];

    const handleAddToWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        const added = StorageUtils.addToWishlist({
            id,
            name,
            price: sale_price || price,
            image,
            category
        });
        if (added) showToast('Додано до улюбленого!');
        else showToast('Вже у списку улюбленого', 'info');
    };

    // Badge priority: SALE > NEW (show only one to keep it clean)
    const badge = is_sale && sale_price
        ? { label: `-${discount_percent || Math.round((1 - sale_price / price) * 100)}%`, type: 'sale' as const }
        : is_new
            ? { label: 'NEW', type: 'new' as const }
            : null;

    return (
        <div className="product-card" data-product-id={id}>
            <div className="product-card__image-wrapper">
                <Link to={`/product/${id}`} prefetch="intent" className="product-card__image-link">
                    <img src={image} alt={name} className="product-card__img product-card__img--main" loading="lazy" />
                    {image2 && <img src={image2} alt={name} className="product-card__img product-card__img--hover" loading="lazy" />}
                    <div className="product-card__overlay"></div>
                </Link>

                {badge && (
                    <span className={`product-card__tag product-card__tag--${badge.type}`}>
                        {badge.label}
                    </span>
                )}

                <button
                    className="product-card__heart-btn"
                    aria-label="Add to wishlist"
                    onClick={handleAddToWishlist}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>

                <Link
                    to={`/product/${id}`}
                    prefetch="intent"
                    className="product-card__quick-view"
                    aria-label="Quick view"
                    onClick={(e) => { e.stopPropagation(); }}
                >
                    Швидкий Перегляд
                </Link>
            </div>

            <div className="product-card__details">
                <h3 className="product-card__title">
                    <Link to={`/product/${id}`} prefetch="intent">{name}</Link>
                </h3>

                <div className="product-card__price-row">
                    {is_sale && sale_price ? (
                        <>
                            <span className="product-card__price-main product-card__price-main--sale">
                                {sale_price.toLocaleString()} ₴
                            </span>
                            <span className="product-card__price-old">
                                {price.toLocaleString()} ₴
                            </span>
                        </>
                    ) : (
                        <span className="product-card__price-main">
                            {price.toLocaleString()} ₴
                        </span>
                    )}
                </div>

                {displayColors.length > 0 && (
                    <div className="product-card__colors">
                        {displayColors.map((color, i) => (
                            <span key={i} className="product-card__color-dot" style={{ backgroundColor: color === 'white' ? '#f5f5f5' : (color === 'black' ? '#222' : color) }} title={color}></span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

