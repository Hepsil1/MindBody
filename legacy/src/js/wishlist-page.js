class WishlistPage {
    constructor() {
        this.container = document.getElementById('wishlistApp');
        this.countLabel = document.getElementById('wishlistCount');
        this.init();
    }

    async init() {
        const savedIds = wishlist.items;

        if (!savedIds || savedIds.length === 0) {
            this.renderEmpty();
            this.updateCountLabel(0);
            return;
        }

        await this.loadAndRender(savedIds);
    }

    updateCountLabel(count) {
        if (this.countLabel) {
            if (count === 0) {
                this.countLabel.textContent = 'Ваш список порожній';
            } else if (count === 1) {
                this.countLabel.innerHTML = '<span>1</span> товар збережено';
            } else if (count >= 2 && count <= 4) {
                this.countLabel.innerHTML = `<span>${count}</span> товари збережено`;
            } else {
                this.countLabel.innerHTML = `<span>${count}</span> товарів збережено`;
            }
        }
    }

    async loadAndRender(ids) {
        this.container.innerHTML = `
            <div class="wishlist-loading">
                <div class="wishlist-loading__spinner"></div>
                <p>Завантаження товарів...</p>
            </div>
        `;

        try {
            const products = [];
            const validIds = [];

            for (const id of ids) {
                const product = await window.api.fetchProductById(id);
                if (product) {
                    products.push(product);
                    validIds.push(id);
                }
            }

            // Clean orphaned IDs from localStorage
            if (validIds.length !== ids.length) {
                console.log(`Wishlist cleanup: removed ${ids.length - validIds.length} orphaned IDs`);
                wishlist.items = validIds;
                wishlist.save();
            }

            this.updateCountLabel(products.length);

            if (products.length === 0) {
                this.renderEmpty();
                return;
            }

            this.renderProducts(products);
        } catch (error) {
            console.error('Error loading wishlist products:', error);
            this.container.innerHTML = `
                <div class="wishlist-empty">
                    <div class="wishlist-empty__icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4M12 16h.01"/>
                        </svg>
                    </div>
                    <h2 class="wishlist-empty__title">Помилка завантаження</h2>
                    <p class="wishlist-empty__text">Не вдалося завантажити товари. Спробуйте оновити сторінку.</p>
                    <button class="wishlist-empty__btn" onclick="location.reload()">
                        Оновити
                    </button>
                </div>
            `;
        }
    }

    renderEmpty() {
        this.container.innerHTML = `
            <div class="wishlist-empty">
                <div class="wishlist-empty__icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </div>
                <h2 class="wishlist-empty__title">Список порожній</h2>
                <p class="wishlist-empty__text">Ви ще не додали жодного товару до улюблених. Перегляньте наш каталог та знайдіть щось особливе для себе!</p>
                <a href="shop-women.html" class="wishlist-empty__btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    Перейти до каталогу
                </a>
            </div>
        `;
    }

    renderProducts(products) {
        const actionsHTML = products.length > 1 ? `
            <div class="wishlist-actions">
                <span style="color: var(--color-text-secondary); font-size: 14px;">
                    ${products.length} ${this.getItemsWord(products.length)} в списку
                </span>
                <button class="wishlist-actions__clear" onclick="wishlistPage.clearAll()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Очистити все
                </button>
            </div>
        ` : '';

        this.container.innerHTML = `
            ${actionsHTML}
            <div class="wishlist-grid">
                ${products.map(product => this.createProductCard(product)).join('')}
            </div>
        `;
    }

    getItemsWord(count) {
        if (count === 1) return 'товар';
        if (count >= 2 && count <= 4) return 'товари';
        return 'товарів';
    }

    getCategoryName(category) {
        const map = {
            'jumpsuit': 'Комбінезон',
            'jumpsuit-bell': 'Комбінезон',
            'leggings': 'Легінси',
            'tops': 'Топи',
            'set': 'Комплект',
            'dress': 'Сукня'
        };
        return map[category] || category || 'Одяг';
    }

    createProductCard(product) {
        const badgeHTML = product.isNew ? '<span class="wishlist-card__badge">NEW</span>' : '';

        return `
            <article class="wishlist-card" onclick="location.href='product.html?id=${product.id}'">
                <div class="wishlist-card__image">
                    ${badgeHTML}
                    <button class="wishlist-card__remove" onclick="event.stopPropagation(); wishlistPage.removeItem('${product.id}')" aria-label="Видалити">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </button>
                    <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
                </div>
                <div class="wishlist-card__info">
                    <p class="wishlist-card__category">${this.getCategoryName(product.category)}</p>
                    <h3 class="wishlist-card__name">${product.name}</h3>
                    <div class="wishlist-card__footer">
                        <span class="wishlist-card__price">${product.price.toLocaleString()} ₴</span>
                        <button class="wishlist-card__action" onclick="event.stopPropagation(); wishlistPage.addToCart('${product.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                            В кошик
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    removeItem(id) {
        // Add fade-out animation
        const card = this.container.querySelector(`[onclick*="'${id}'"]`);
        if (card && card.classList.contains('wishlist-card')) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            card.style.transition = 'all 0.3s ease';

            setTimeout(() => {
                wishlist.toggleItem(id);
                this.init();
            }, 300);
        } else {
            wishlist.toggleItem(id);
            this.init();
        }
    }

    addToCart(productId) {
        if (typeof Cart !== 'undefined' && Cart.addDirectly) {
            Cart.addDirectly(productId);
        } else if (typeof cart !== 'undefined') {
            // Try alternative method
            window.api.fetchProductById(productId).then(product => {
                if (product) {
                    cart.addItem(product);
                    Toast.success('Додано до кошика');
                }
            });
        }
    }

    async clearAll() {
        const confirmed = await Modal.confirm(
            'Очистити список?',
            'Ви впевнені, що хочете очистити весь список улюблених?'
        );

        if (confirmed) {
            wishlist.items = [];
            wishlist.save();
            this.init();
        }
    }

    showToast(message) {
        // Check if ProductCards has showToast
        if (typeof ProductCards !== 'undefined' && ProductCards.showToast) {
            Toast.info('Список очищено');
        }
    }
}

const wishlistPage = new WishlistPage();
window.wishlistPage = wishlistPage;
