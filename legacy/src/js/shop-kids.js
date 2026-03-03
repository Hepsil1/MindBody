class ShopKids {
    constructor() {
        this.allProducts = [];
        this.filteredProducts = [];
        this.filters = {
            categories: [],
            sizes: []
        };
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.bindEvents();
        this.renderProducts();
    }

    async loadProducts() {
        try {
            this.allProducts = await window.api.fetchProducts('kids');
            this.filteredProducts = [...this.allProducts];
            console.log(`Loaded ${this.allProducts.length} kids products via API`);
        } catch (error) {
            console.error('Error loading products from API:', error);
        }
    }

    bindEvents() {
        // Category filters
        document.querySelectorAll('.filter-option input').forEach(input => {
            input.addEventListener('change', () => {
                this.updateFilters();
                this.applyFilters();
            });
        });

        // Size buttons
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('active');
                this.updateFilters();
                this.applyFilters();
            });
        });

        // Sort select
        const sortSelect = document.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortProducts(sortSelect.value);
                this.renderProducts();
            });
        }

        // Reset filters
        const resetBtn = document.querySelector('.filters__reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.querySelectorAll('.filter-option input').forEach(cb => cb.checked = false);
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                this.updateFilters();
                this.applyFilters();
            });
        }
    }

    updateFilters() {
        this.filters.categories = Array.from(document.querySelectorAll('.filter-option input:checked'))
            .map(input => input.nextElementSibling.nextElementSibling.textContent.trim());

        this.filters.sizes = Array.from(document.querySelectorAll('.size-btn.active'))
            .map(btn => btn.textContent.trim());
    }

    applyFilters() {
        this.filteredProducts = this.allProducts.filter(product => {
            const categoryMatch = this.filters.categories.length === 0 ||
                this.filters.categories.includes(product.category);

            const sizeMatch = this.filters.sizes.length === 0 ||
                (product.sizes && product.sizes.some(s => this.filters.sizes.includes(s)));

            return categoryMatch && sizeMatch;
        });

        this.renderProducts();
    }

    sortProducts(sortType) {
        switch (sortType) {
            case 'price-asc':
                this.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price-desc':
                this.filteredProducts.sort((a, b) => b.price - a.price);
                break;
            case 'new':
                this.filteredProducts.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
                break;
        }
    }

    renderProducts() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;

        if (this.filteredProducts.length === 0) {
            grid.innerHTML = `<div class="loading">На жаль, товарів за вашим запитом не знайдено.</div>`;
        } else {
            grid.innerHTML = this.filteredProducts.map(product => this.createProductCard(product)).join('');
        }

        const countEl = document.querySelector('.products__count strong');
        if (countEl) {
            countEl.textContent = this.filteredProducts.length;
        }
    }

    createProductCard(product) {
        let badgeHTML = '';
        if (product.badge === 'NEW' || product.isNew) {
            badgeHTML = `<span class="product-card__badge">NEW</span>`;
        } else if (product.badge && product.badge.includes('%')) {
            badgeHTML = `<span class="product-card__badge product-card__badge--sale">${product.badge}</span>`;
        } else if (product.badge) {
            badgeHTML = `<span class="product-card__badge">${product.badge}</span>`;
        }

        const colorDots = (product.colors || []).map(color =>
            `<span class="color-dot" style="background-color: ${color.code}" title="${color.name}"></span>`
        ).join('');

        const imageSrc = product.images && product.images[0]
            ? product.images[0]
            : 'pics/mind_body_logo_sun.png';

        return `
            <article class="product-card" onclick="location.href='product.html?id=${product.id}'">
                <div class="product-card__image">
                    <img src="${imageSrc}" alt="${product.name}" loading="lazy" 
                        onerror="this.src='pics/mind_body_logo_sun.png'; this.style.objectFit='contain'; this.style.padding='40px';">
                    ${badgeHTML}
                    <div class="product-card__overlay">
                        <div class="product-card__actions">
                            <button class="product-card__action-btn product-card__action-btn--primary">
                                Переглянути
                            </button>
                            <button class="product-card__action-btn product-card__action-btn--icon ${wishlist.isInWishlist(product.id) ? 'is-active' : ''}" 
                                aria-label="Додати в улюблені" 
                                data-product-id="${product.id}"
                                onclick="event.stopPropagation(); shopKids.toggleWishlist('${product.id}')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="${wishlist.isInWishlist(product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="product-card__info">
                    <p class="product-card__category">${product.category || product.collection || 'Одяг'}</p>
                    <h3 class="product-card__name">${product.name}</h3>
                    <div class="product-card__details">
                        <span class="product-card__price">${product.price.toLocaleString()} ₴</span>
                        <div class="product-card__colors">
                            ${colorDots}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    toggleWishlist(productId) {
        wishlist.toggleItem(productId);
        this.renderProducts();
    }
}

// Initialize
const shopKids = new ShopKids();
