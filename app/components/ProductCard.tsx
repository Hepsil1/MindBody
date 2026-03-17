import { Link } from "react-router";
import type { Product } from "../utils/api";
import { StorageUtils } from "../utils/storage";
import { useToast } from "./Toast";

export default function ProductCard({ product }: { product: Product }) {
    const { showToast } = useToast();
    const { id, name, category, price, price_usd, image, image2, is_new, is_sale, sale_price, colors } = product;

    // Use actual product colors if available, otherwise just use mock colors for demonstration of the UI
    const mockColors = colors?.length ? colors : ['black', 'blue'];

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        StorageUtils.addToCart({
            id,
            name,
            price: sale_price || price,
            image,
            quantity: 1
        });
        showToast('Додано до кошика!');
    };

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

    // Generate consistent mock reviews based on product ID
    const getProductReviews = (id: string | number) => {
        const numId = typeof id === 'string'
            ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            : id;

        // Rating between 4.5 and 5.0
        const rating = 4.5 + (numId % 6) * 0.1;
        // Count between 12 and 145
        const count = 12 + (numId % 134);

        return {
            rating: rating > 5 ? 5 : rating,
            count
        };
    };

    const reviews = getProductReviews(id);

    return (
        <div className="product-card" data-product-id={id}>
            <div className="product-card__image-wrapper">
                <Link to={`/product/${id}`} prefetch="intent" className="product-card__image-link">
                    <img src={image} alt={name} className="product-card__img product-card__img--main" loading="lazy" />
                    {image2 && <img src={image2} alt={name} className="product-card__img product-card__img--hover" loading="lazy" />}
                    <div className="product-card__overlay"></div>
                </Link>

                {is_new && <span className="product-card__tag product-card__tag--new">NEW</span>}

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
                    onClick={(e) => { e.stopPropagation(); /* TODO: quick view modal logic */ }}
                >
                    Швидкий Перегляд
                </Link>
            </div>

            <div className="product-card__details">
                <div className="product-card__rating">
                    <span>★</span><span>★</span><span>★</span><span>★</span>
                    <span className={reviews.rating === 5 ? "" : "star-half"}>★</span>
                    <span className="product-card__rating-count">({reviews.count})</span>
                </div>

                <h3 className="product-card__title">
                    <Link to={`/product/${id}`} prefetch="intent">{name}</Link>
                </h3>

                <div className="product-card__price-row">
                    <span className="product-card__price-main">
                        {is_sale && sale_price ? sale_price : price} ₴
                    </span>
                    {is_sale && sale_price && (
                        <span className="product-card__price-old">
                            {price} ₴
                        </span>
                    )}
                </div>

                <div className="product-card__colors">
                    {mockColors.map((color, i) => (
                        <span key={i} className="product-card__color-dot" style={{ backgroundColor: color === 'white' ? '#f5f5f5' : (color === 'black' ? '#222' : color) }} title={color}></span>
                    ))}
                </div>
            </div>
        </div>
    );
}
