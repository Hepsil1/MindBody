class ProductPage {
    constructor() {
        this.productId = new URLSearchParams(window.location.search).get('id');
        this.product = null;
        this.init();
    }

    async init() {
        if (!this.productId) {
            window.location.href = 'index.html';
            return;
        }

        await this.loadProduct();
        this.render();
        window.scrollTo(0, 0);
    }

    async loadProduct() {
        try {
            this.product = await window.api.fetchProductById(this.productId);

            if (!this.product) {
                console.error('Product not found in API');
                // Use default item for demo if not found
                this.product = {
                    id: this.productId,
                    name: 'Товар MIND BODY',
                    category: 'Одяг',
                    price: 2500,
                    colors: [{ code: '#3D7A8C', name: 'Original' }],
                    images: ['pics/mind_body_logo_sun.png'],
                    sizes: ['S', 'M', 'L'],
                    description: 'Детальний опис товару скоро з\'явиться.'
                };
            }
        } catch (error) {
            console.error('Error loading product from API:', error);
        }
    }

    render() {
        const container = document.getElementById('productApp');
        if (!container || !this.product) return;

        const badgeHTML = this.product.badge || this.product.isNew ? `<span class="product-info__label">NEW</span>` : '';
        const sizesHTML = (this.product.sizes || []).map((s, i) =>
            `<div class="size-box ${i === 0 ? 'active' : ''}" onclick="productPage.selectSize(this)">${s}</div>`
        ).join('');

        const colorsHTML = (this.product.colors || []).map((c, i) =>
            `<div class="color-circle ${i === 0 ? 'active' : ''}" style="background-color: ${c.code}" title="${c.name}" onclick="productPage.selectColor(this)"></div>`
        ).join('');

        const thumbsHTML = (this.product.images || []).map((img, i) =>
            `<div class="thumb ${i === 0 ? 'active' : ''}" onclick="productPage.changeImage('${img}', this)">
                <img src="${img}" alt="${this.product.name}" onerror="this.src='pics/mind_body_logo_sun.png';">
            </div>`
        ).join('');

        container.innerHTML = `
            <div class="product-details">
                <div class="product-gallery">
                    <div class="gallery-thumbs">${thumbsHTML}</div>
                    <div class="main-image">
                        <img src="${this.product.images[0]}" id="mainProductImg" alt="${this.product.name}" onerror="this.src='pics/mind_body_logo_sun.png'; this.style.objectFit='contain';">
                    </div>
                </div>
                <div class="product-info">
                    ${badgeHTML}
                    <h1 class="product-info__title">${this.product.name}</h1>
                    <div class="product-info__price-row">
                        <span class="current-price">${this.product.price.toLocaleString()} ₴</span>
                        ${this.product.oldPrice ? `<span class="old-price">${this.product.oldPrice.toLocaleString()} ₴</span>` : ''}
                    </div>

                    <div class="product-section">
                        <h3 class="section-title">Оберіть розмір</h3>
                        <div class="size-selector">${sizesHTML}</div>
                    </div>

                    <div class="product-section">
                        <h3 class="section-title">Колір</h3>
                        <div class="color-selector">${colorsHTML}</div>
                    </div>

                    <div class="action-btns">
                        <button class="btn-add-cart" onclick="productPage.addToCart()">Додати в кошик</button>
                        <button class="btn-wishlist ${wishlist.isInWishlist(this.product.id) ? 'active' : ''}" 
                            aria-label="Add to Favorites" 
                            onclick="productPage.toggleWishlist()">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="${wishlist.isInWishlist(this.product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                        </button>
                    </div>

                    <button class="btn btn--outline" style="width:100%; margin-bottom:40px; height:60px; border-radius:12px;" onclick="productPage.quickOrder()">
                        Купити в 1 клік
                    </button>

                    <div class="product-description">
                        <div class="accordion-item active">
                            <button class="accordion-trigger" onclick="productPage.toggleAccordion(this)">
                                Опис товару <span class="arrow">↓</span>
                            </button>
                            <div class="accordion-content">
                                <p>${this.product.description || 'Професійний одяг для спорту та йоги. Тканина 4-way stretch забезпечує повну свободу рухів.'}</p>
                            </div>
                        </div>
                        <div class="accordion-item">
                            <button class="accordion-trigger" onclick="productPage.toggleAccordion(this)">
                                Догляд та склад <span class="arrow">↓</span>
                            </button>
                            <div class="accordion-content">
                                <p>80% Поліамід, 20% Еластан. Прання при 30 градусах.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;
    }

    changeImage(src, thumb) {
        document.getElementById('mainProductImg').src = src;
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
    }

    selectSize(box) {
        document.querySelectorAll('.size-box').forEach(b => b.classList.remove('active'));
        box.classList.add('active');
    }

    selectColor(circle) {
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
        circle.classList.add('active');
    }

    toggleAccordion(btn) {
        btn.parentElement.classList.toggle('active');
    }

    toggleWishlist() {
        wishlist.toggleItem(this.product.id);
        this.render(); // Re-render to update the heart icon
    }

    async quickOrder() {
        const phone = await Modal.prompt(
            "Швидке замовлення",
            "Введіть ваш номер телефону для швидкого замовлення:",
            ""
        );

        if (phone) {
            const selectedSize = document.querySelector('.size-box.active')?.textContent;
            const selectedColor = document.querySelector('.color-circle.active')?.title;

            console.log('Quick Order Request:', {
                productId: this.product.id,
                phone: phone,
                variant: { size: selectedSize, color: selectedColor }
            });

            Toast.success("Дякуємо! Наш менеджер зв'яжеться з вами найближчим часом.");
        }
    }

    addToCart() {
        if (!this.product) return;

        const selectedSize = document.querySelector('.size-box.active')?.textContent;
        const selectedColor = document.querySelector('.color-circle.active')?.title;

        // Custom event for CartManager
        document.dispatchEvent(new CustomEvent('cart:add', {
            detail: {
                product: this.product,
                variant: { size: selectedSize, color: selectedColor }
            }
        }));

        Toast.success('Товар додано до кошика!');
    }
}

const productPage = new ProductPage();
