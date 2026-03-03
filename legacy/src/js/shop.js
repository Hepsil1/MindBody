/* ================================================
   MIND BODY - Shop Logic (Filters, Rendering)
   ================================================ */

const Shop = {
    state: {
        products: [],
        filteredProducts: [],
        filters: {
            colors: [],
            sizes: [],
            priceMin: 0,
            priceMax: 10000
        },
        sort: 'newest' // newest, price-asc, price-desc
    },

    init() {
        this.grid = document.getElementById('shop-grid');
        this.countLabel = document.getElementById('products-count');

        if (!this.grid) return;

        const category = this.grid.dataset.category; // 'women' or 'kids'
        this.loadProducts(category);
        this.bindEvents();
    },

    async loadProducts(category) {
        try {
            const response = await fetch(`data/products_${category}.json?v=${new Date().getTime()}`);
            const data = await response.json();

            this.state.products = data;
            this.state.filteredProducts = data;

            // Initial render
            this.renderProducts();
            this.updateFilterCounts();
        } catch (err) {
            console.error('Error loading products:', err);
            this.grid.innerHTML = '<div class="error">Не вдалося завантажити товари. Спробуйте пізніше.</div>';
        }
    },

    bindEvents() {
        // Sort
        const sortSelect = document.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.state.sort = e.target.value;
                this.applyFilters();
            });
        }

        // Color Checkboxes
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                this.updateFiltersState();
            });
        });

        // Size Buttons
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('active');
                this.updateFiltersState();
            });
        });

        // Price Range (if exists)
        const priceRange = document.getElementById('price-range');
        if (priceRange) {
            priceRange.addEventListener('input', (e) => {
                this.state.filters.priceMax = parseInt(e.target.value);
                document.getElementById('price-value').textContent = `${this.state.filters.priceMax} ₴`;
                this.applyFilters(); // Debounce recommended but simple change for now
            });
        }

        // Reset
        const resetBtn = document.querySelector('.filters__reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }
    },

    updateFiltersState() {
        // Collect checked colors
        const checkedColors = Array.from(document.querySelectorAll('.filter-option input[type="checkbox"]:checked'))
            .map(input => input.value);

        // Collect active sizes
        const activeSizes = Array.from(document.querySelectorAll('.size-btn.active'))
            .map(btn => btn.dataset.size);

        this.state.filters.colors = checkedColors;
        this.state.filters.sizes = activeSizes;

        this.applyFilters();
    },

    resetFilters() {
        // Uncheck boxes
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(input => input.checked = false);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));

        // Reset state
        this.state.filters.colors = [];
        this.state.filters.sizes = [];

        this.applyFilters();
    },

    applyFilters() {
        let result = [...this.state.products];

        // Filter by Color
        if (this.state.filters.colors.length > 0) {
            result = result.filter(p => {
                // Check if product has ANY of the selected colors
                return p.colors.some(c => this.state.filters.colors.includes(c.name));
            });
        }

        // Filter by Size
        if (this.state.filters.sizes.length > 0) {
            result = result.filter(p => {
                // Check if product has ANY of the selected sizes
                return p.sizes.some(s => this.state.filters.sizes.includes(s));
            });
        }

        // Filter by Price
        // (Assuming simple max price filter for now if needed range)

        // Sort
        if (this.state.sort === 'price-asc') {
            result.sort((a, b) => a.price - b.price);
        } else if (this.state.sort === 'price-desc') {
            result.sort((a, b) => b.price - a.price);
        } else if (this.state.sort === 'newest') {
            // Assume json order is somewhat relevant or use isNew flag
            result.sort((a, b) => (b.isNew === true) - (a.isNew === true));
        }

        this.state.filteredProducts = result;
        this.renderProducts();
        this.updateFilterCounts();
    },

    renderProducts() {
        this.grid.innerHTML = '';

        if (this.state.filteredProducts.length === 0) {
            this.grid.innerHTML = '<div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px;"><h3>Нічого не знайдено</h3><p>Спробуйте змінити параметри фільтрації</p></div>';
            if (this.countLabel) this.countLabel.textContent = '0';
            return;
        }

        if (this.countLabel) {
            this.countLabel.textContent = this.state.filteredProducts.length;
        }

        const fragment = document.createDocumentFragment();

        this.state.filteredProducts.forEach((product, index) => {
            const card = document.createElement('div');
            card.className = 'product-card';

            // Animation delay
            card.style.animationDelay = `${index * 0.1}s`;
            card.setAttribute('onclick', `location.href='product.html?id=${product.id}'`);

            // Badge
            let badgeHtml = '';
            if (product.isNew) {
                badgeHtml = '<span class="product-card__badge">NEW</span>';
            } else if (product.price < 3000 && product.price > 0) { // Example condition
                // badgeHtml = '<span class="product-card__badge product-card__badge--sale">SALE</span>';
            }

            // Colors dots
            const colorDots = product.colors.map(c =>
                `<span style="width:12px; height:12px; border-radius:50%; background-color:${c.code}; display:inline-block; border:1px solid #ddd;" title="${c.name}"></span>`
            ).join(' ');

            card.innerHTML = `
                <div class="product-card__image">
                    ${badgeHtml}
                    <button class="product-card__wishlist" onclick="event.stopPropagation(); ProductCards.toggleWishlist(this, '${product.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </button>
                    <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
                    <div class="product-card__actions">
                        <button class="product-card__action-btn product-card__action-btn--primary" onclick="event.stopPropagation(); Cart.addDirectly('${product.id}')">
                            В Кошик
                        </button>
                        <button class="product-card__action-btn product-card__action-btn--icon" onclick="event.stopPropagation(); QuickView.open('${product.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="product-card__info">
                    <div class="product-card__category">${this.getDisplayCategory(product.category)}</div>
                    <h3 class="product-card__name">${product.name}</h3>
                    <div class="product-card__colors" style="margin-bottom: 8px; gap: 4px; display: flex;">
                        ${colorDots}
                    </div>
                    <div class="product-card__details">
                        <div class="product-card__price">${product.price} ₴</div>
                    </div>
                </div>
            `;

            fragment.appendChild(card);
        });

        this.grid.appendChild(fragment);

        // Initialize animations if needed (checking ScrollReveal later)
        // Re-init generic listeners if broken
        if (typeof ProductCards !== 'undefined' && ProductCards.init) {
            ProductCards.init();
        }
    },

    getDisplayCategory(catCode) {
        const map = {
            'jumpsuit': 'Комбінезон',
            'jumpsuit-bell': 'Комбінезон',
            'leggings': 'Легінси',
            'tops': 'Топи'
        };
        return map[catCode] || catCode;
    },

    updateFilterCounts() {
        // Optional: Update numbers next to filters based on current filtered items
        // This is complex to do perfectly without re-calculating full sets,
        // for now we stick to simple rendering.
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Shop.init();
});
