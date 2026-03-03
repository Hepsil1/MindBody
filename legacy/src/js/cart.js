class CartManager {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('mb_cart')) || [];
        this.init();
    }

    init() {
        this.updateHeaderCount();
        this.bindGlobalEvents();
    }

    bindGlobalEvents() {
        // Listen for "Add to Cart" events from other scripts
        document.addEventListener('cart:add', (e) => {
            this.addItem(e.detail.product, e.detail.variant);
        });
    }

    addItem(product, variant = {}) {
        const cartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0],
            size: variant.size || 'Unselected',
            color: variant.color || 'Default',
            quantity: 1,
            addedAt: new Date().toISOString()
        };

        // Check if item already exists with same variants
        const existingIndex = this.items.findIndex(item =>
            item.id === cartItem.id && item.size === cartItem.size && item.color === cartItem.color
        );

        if (existingIndex > -1) {
            this.items[existingIndex].quantity += 1;
        } else {
            this.items.push(cartItem);
        }

        this.save();
        this.showAddedNotification(cartItem);
    }

    // Helper for Shop page cards
    async addDirectly(productId) {
        // Try to fetch full product data first or use minimal info
        // Ideally we fetch from the products array if available globally, but we'll try to find it in the DOM or API

        let product = null;

        // Try to find in Shop JS state if available
        if (typeof Shop !== 'undefined' && Shop.state && Shop.state.products) {
            product = Shop.state.products.find(p => p.id === productId);
        }

        if (!product) {
            // Fallback: minimal stub
            product = {
                id: productId,
                name: 'Товар ' + productId,
                price: 0,
                images: ['pics/mind_body_logo_sun.png']
            };
        }

        this.addItem(product, { size: 'M', color: 'Default' }); // Default variants for quick add
        Toast.success('Додано в кошик!');
    }

    removeItem(index) {
        this.items.splice(index, 1);
        this.save();
        document.dispatchEvent(new CustomEvent('cart:updated'));
    }

    updateQuantity(index, delta) {
        this.items[index].quantity += delta;
        if (this.items[index].quantity < 1) this.items[index].quantity = 1;
        this.save();
        document.dispatchEvent(new CustomEvent('cart:updated'));
    }

    getTotal() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    save() {
        localStorage.setItem('mb_cart', JSON.stringify(this.items));
        this.updateHeaderCount();
    }

    updateHeaderCount() {
        const counts = document.querySelectorAll('.header__cart-count, .cart-count');
        const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
        counts.forEach(el => {
            el.textContent = totalItems;
            el.style.display = totalItems > 0 ? 'flex' : 'none';
        });
    }

    showAddedNotification(item) {
        console.log('Cart Notification:', item.name);
        // Professional toast or mini-cart popup logic would go here
    }

    clear() {
        this.items = [];
        this.save();
    }

    // Quick Order logic
    async placeQuickOrder(contactInfo) {
        console.log('PLACING QUICK ORDER:', {
            items: this.items,
            total: this.getTotal(),
            customer: contactInfo
        });
        // Mock server delay
        return new Promise(resolve => setTimeout(resolve, 1500));
    }
}

const cart = new CartManager();
window.cart = cart; // Global access for modules
