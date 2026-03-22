export interface Product {
    id: number | string;
    name: string;
    description?: string;
    price: number;
    price_usd?: number;
    image: string;
    image2?: string;
    category: string;
    sub_category?: string;
    colors?: string[];
    sizes?: string[];
    is_new?: boolean;
    is_sale?: boolean;
    sale_price?: number;
}
