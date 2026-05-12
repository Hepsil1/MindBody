export function ProductCardSkeleton() {
    return (
        <div className="product-card product-card--skeleton" aria-hidden="true">
            <div className="product-card__image-wrapper">
                <div className="skeleton skeleton--image" />
            </div>
            <div className="product-card__details">
                <div className="skeleton skeleton--line skeleton--line-title" />
                <div className="skeleton skeleton--line skeleton--line-price" />
                <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                    <div className="skeleton skeleton--dot" />
                    <div className="skeleton skeleton--dot" />
                    <div className="skeleton skeleton--dot" />
                </div>
            </div>
        </div>
    );
}

export default ProductCardSkeleton;
