class WishlistManager {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('mb_wishlist')) || [];
        this.validProductPrefixes = ['w', 'k']; // Valid product ID prefixes (women, kids)
        this.init();
    }

    init() {
        // Clean invalid IDs immediately on any page load
        this.cleanInvalidIds();
        this.updateHeaderCount();

        // Listen for cross-tab changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'mb_wishlist') {
                this.items = JSON.parse(e.newValue) || [];
                this.updateHeaderCount();
                this.updateUI();
            }
        });
    }

    cleanInvalidIds() {
        // Filter out any IDs that don't match valid product ID patterns
        // Valid IDs: w1, w2, k1, k2, etc.
        const validPattern = /^[wk]\d+$/;
        const validItems = this.items.filter(id => validPattern.test(id));

        if (validItems.length !== this.items.length) {
            console.log(`Wishlist: cleaned ${this.items.length - validItems.length} invalid IDs`);
            this.items = validItems;
            this.save();
        }
    }

    toggleItem(productId) {
        // Validate product ID format before adding
        const validPattern = /^[wk]\d+$/;
        if (!validPattern.test(productId)) {
            console.warn('Invalid product ID format:', productId);
            return;
        }

        const index = this.items.indexOf(productId);
        if (index > -1) {
            this.items.splice(index, 1);
            console.log('Removed from wishlist:', productId);
        } else {
            this.items.push(productId);
            console.log('Added to wishlist:', productId);
        }
        this.save();
        this.updateUI();
    }

    isInWishlist(productId) {
        return this.items.includes(productId);
    }

    save() {
        localStorage.setItem('mb_wishlist', JSON.stringify(this.items));
        this.updateHeaderCount();
    }

    updateHeaderCount() {
        const counts = document.querySelectorAll('.header__wishlist-count');
        counts.forEach(el => {
            el.textContent = this.items.length;
            el.style.display = this.items.length > 0 ? 'flex' : 'none';
        });
    }

    updateUI() {
        // Toggle active state on hearts across the page
        document.querySelectorAll(`[data-product-id]`).forEach(btn => {
            const id = btn.getAttribute('data-product-id');
            if (this.isInWishlist(id)) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }
}

const wishlist = new WishlistManager();
window.wishlist = wishlist;
