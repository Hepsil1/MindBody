export interface CartItem {
    id: string | number;
    name: string;
    price: number;
    image: string;
    size?: string;
    color?: string;
    quantity: number;
}

export interface WishlistItem {
    id: string | number;
    name: string;
    price: number;
    image: string;
    category: string;
}

const STORAGE_KEYS = {
    CART: 'cart',
    WISHLIST: 'wishlist'
};

const EVENTS = {
    CART_UPDATED: 'cart-updated',
    WISHLIST_UPDATED: 'wishlist-updated'
};

export const StorageUtils = {
    // CART METHODS
    getCart: (): CartItem[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
        } catch {
            return [];
        }
    },

    addToCart: (item: CartItem) => {
        const cart = StorageUtils.getCart();
        const existingIndex = cart.findIndex(
            i => i.id === item.id && i.size === item.size && i.color === item.color
        );

        if (existingIndex > -1) {
            cart[existingIndex].quantity += item.quantity;
        } else {
            cart.push(item);
        }

        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
        window.dispatchEvent(new Event(EVENTS.CART_UPDATED));
        window.dispatchEvent(new Event('cart-item-added'));
    },

    updateCartQuantity: (id: string | number, delta: number, size?: string, color?: string) => {
        const cart = StorageUtils.getCart();
        const updated = cart.map(item => {
            // Match loosely if size/color not specified or match exactly
            const isMatch = item.id === id &&
                (size ? item.size === size : true) &&
                (color ? item.color === color : true);

            if (isMatch) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
            return item;
        });

        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
        window.dispatchEvent(new Event(EVENTS.CART_UPDATED));
    },

    removeFromCart: (id: string | number, size?: string, color?: string) => {
        let cart = StorageUtils.getCart();
        cart = cart.filter(item => {
            // Match by id, size, AND color (treat undefined as matching anything)
            const idMatch = item.id === id;
            const sizeMatch = size === undefined || item.size === size;
            const colorMatch = color === undefined || item.color === color;

            // Remove item if ALL criteria match
            return !(idMatch && sizeMatch && colorMatch);
        });

        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
        window.dispatchEvent(new Event(EVENTS.CART_UPDATED));
    },

    clearCart: () => {
        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
        window.dispatchEvent(new Event(EVENTS.CART_UPDATED));
    },

    // WISHLIST METHODS
    getWishlist: (): WishlistItem[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.WISHLIST) || '[]');
        } catch {
            return [];
        }
    },

    addToWishlist: (item: WishlistItem): boolean => {
        const list = StorageUtils.getWishlist();
        if (list.some(i => i.id === item.id)) return false; // Already exists

        list.push(item);
        localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(list));
        window.dispatchEvent(new Event(EVENTS.WISHLIST_UPDATED));
        return true;
    },

    removeFromWishlist: (id: string | number) => {
        let list = StorageUtils.getWishlist();
        list = list.filter(item => item.id !== id);

        localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(list));
        window.dispatchEvent(new Event(EVENTS.WISHLIST_UPDATED));
    },

    isInWishlist: (id: string | number): boolean => {
        const list = StorageUtils.getWishlist();
        return list.some(item => item.id === id);
    },

    // SUBSCRIPTIONS
    subscribeToCart: (callback: () => void) => {
        window.addEventListener(EVENTS.CART_UPDATED, callback);
        return () => window.removeEventListener(EVENTS.CART_UPDATED, callback);
    },

    subscribeToWishlist: (callback: () => void) => {
        window.addEventListener(EVENTS.WISHLIST_UPDATED, callback);
        return () => window.removeEventListener(EVENTS.WISHLIST_UPDATED, callback);
    }
};
