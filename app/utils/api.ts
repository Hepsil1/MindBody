import productsWomen from "../data/products_women.json";
import productsKids from "../data/products_kids.json";

const API_BASE_URL = 'http://localhost:4444';

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

export class ApiService {
    static mapLegacyProduct(p: any): Product {
        const ensureSlash = (path: string) => path && !path.startsWith('/') ? `/${path}` : path;

        // Map color names to standardized filter values
        const normalizeColorName = (colorName: string): string => {
            const normalized = colorName.toLowerCase();
            if (normalized.includes('чорн')) return 'black';
            if (normalized.includes('біл')) return 'white';
            if (normalized.includes('син') || normalized.includes('blue')) return 'blue';
            if (normalized.includes('рож') || normalized.includes('pink')) return 'pink';
            if (normalized.includes('зелен') || normalized.includes('green') || normalized.includes('смарагд')) return 'green';
            if (normalized.includes('сір') || normalized.includes('gray') || normalized.includes('графіт')) return 'gray';
            if (normalized.includes('черв') || normalized.includes('red') || normalized.includes('виш') || normalized.includes('бордо')) return 'red';
            return 'other';
        };

        return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            price_usd: p.priceUSD || p.price_usd,
            image: ensureSlash(p.images?.[0] || p.image || ''),
            image2: p.images?.[1] ? ensureSlash(p.images[1]) : undefined,
            category: p.category,
            sub_category: p.sub_category,
            colors: p.colors?.map((c: any) => {
                const colorName = typeof c === 'string' ? c : c.name;
                return normalizeColorName(colorName);
            }),
            sizes: p.sizes,
            is_new: p.isNew || p.is_new,
            is_sale: p.isSale || p.is_sale,
            sale_price: p.salePrice || p.sale_price
        };
    }

    static async fetchProducts(category: string = ''): Promise<Product[]> {
        try {
            const url = category ? `${API_BASE_URL}/products?category=${category}` : `${API_BASE_URL}/products`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data.map((p: any) => this.mapLegacyProduct(p));
        } catch (error) {
            console.warn('API connection failed, using local JSON data');
            let data: any[] = [];
            if (category === 'kids') data = productsKids;
            else if (category === 'women') data = productsWomen;
            else data = [...productsWomen, ...productsKids];

            return data.map((p: any) => this.mapLegacyProduct(p));
        }
    }

    static async fetchProductById(id: string | number): Promise<Product | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`);
            if (response.ok) {
                const data = await response.json();
                return this.mapLegacyProduct(data);
            }
            throw new Error('Product not found in API');
        } catch (error) {
            const allProducts = [...productsWomen, ...productsKids];
            const p = allProducts.find(p => String(p.id) === String(id));
            return p ? this.mapLegacyProduct(p) : null;
        }
    }
}
