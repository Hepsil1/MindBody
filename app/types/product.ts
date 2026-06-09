// Shared product-related types. Imported by both server (loaders, API routes)
// and client (components) so the contract is enforced in one place.

/**
 * One row of the inventory JSON array stored on Product.inventory.
 * Variants are keyed by the {size,color} pair.
 */
export interface InventoryVariant {
    size?: string | null;
    color?: string | null;
    stock?: number;
}

/**
 * Subset of Review fields exposed to the client. Matches the shape returned
 * by GET /api/reviews?productId=…
 */
export interface ReviewData {
    id: string;
    productId: string;
    authorName: string;
    rating: number;
    text: string;
    isVerified: boolean;
    createdAt: string;
}

/**
 * Related-product card data — what the PDP needs to render the "Related"
 * carousel without a full Product fetch.
 */
export interface RelatedProductCard {
    id: string;
    slug: string | null;
    name: string;
    price: number;
    image: string;
}

/**
 * FilterConfig.config JSON shape — just the slice the PDP uses to map
 * color-name strings to hex codes.
 */
export interface FilterConfigData {
    colors: Record<string, string>;
}
