import { Link } from "react-router";
import { StorageUtils } from "../utils/storage";
import { useToast } from "./Toast";
import { getColorHex } from "../utils/colors";

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
    inStock?: boolean;
}

interface ProductCardProps {
    product: Product;
    index?: number;
}

export default function ProductCard({ product, index = 99 }: ProductCardProps) {
    const { showToast } = useToast();
    const { id, name, category, price, image, image2, is_new, is_sale, sale_price, colors, discount_percent, inStock } = product;

    const displayColors = colors?.length ? colors : [];
    const isOutOfStock = inStock === false;
    const isPriority = index < 4;

    const handleAddToWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        const added = StorageUtils.addToWishlist({
            id,
            name,
            price: sale_price || price,
            image,
            category: category || ''
        });
        if (added) showToast('Додано до улюбленого!');
        else showToast('Вже у списку улюбленого', 'info');
    };

    // Badge priority: OUT-OF-STOCK > SALE > NEW (one at a time)
    const badge = isOutOfStock
        ? { label: 'Немає в наявності', type: 'outofstock' as const }
        : is_sale && sale_price
            ? { label: `-${discount_percent || Math.round((1 - sale_price / price) * 100)}%`, type: 'sale' as const }
            : is_new
                ? { label: 'NEW', type: 'new' as const }
                : null;

    return (
        <div
            className={`product-card${isOutOfStock ? ' product-card--out-of-stock' : ''}`}
            data-product-id={id}
        >
            <div className="product-card__image-wrapper">
                <Link to={`/product/${id}`} prefetch="intent" className="product-card__image-link">
                    <img
                        src={image}
                        alt={name}
                        className="product-card__img product-card__img--main"
                        loading={isPriority ? 'eager' : 'lazy'}
                        decoding={isPriority ? 'sync' : 'async'}
                        {...(index === 0 ? { fetchPriority: 'high' as const } : {})}
                    />
                    {image2 && (
                        <img
                            src={image2}
                            alt=""
                            aria-hidden="true"
                            className="product-card__img product-card__img--hover"
                            loading="lazy"
                        />
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
                    aria-label={`Додати ${name} до улюбленого`}
                    onClick={handleAddToWishlist}
                >
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>

                <Link
                    to={`/product/${id}`}
                    className="product-card__quick-view"
                    aria-label={`Переглянути ${name}`}
                    onClick={(e) => { e.stopPropagation(); }}
                >
                    Швидкий Перегляд
                </Link>
            </div>

            <div className="product-card__details">
                <h3 className="product-card__title">
                    <Link to={`/product/${id}`}>{name}</Link>
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
                    <div className="product-card__colors" aria-label="Доступні кольори">
                        {displayColors.map((color, i) => (
                            <span
                                key={i}
                                className="product-card__color-dot"
                                style={{ backgroundColor: getColorHex(color) }}
                                title={color}
                                aria-hidden="true"
                            ></span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

