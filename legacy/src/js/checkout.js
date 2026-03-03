/**
 * MIND BODY Checkout Logic
 * Handles order submission and Nova Poshta integration
 */

const CheckoutManager = {
    currentStep: 1,
    cart: [],
    novaPoshtaApiKey: '4462245bdf3041b440a6aab097425c0479c3adcf',
    cities: [],
    warehouses: [],

    init() {
        this.loadCart();
        this.renderCartSummary();
        this.setupNovaPoshtaAutocomplete();
        this.setupFormSubmit();
        console.log('🛒 Checkout initialized');
    },

    // Load cart from localStorage
    loadCart() {
        const cartData = localStorage.getItem('mb_cart');
        this.cart = cartData ? JSON.parse(cartData) : [];
        if (this.cart.length === 0) {
            Toast.warning('Ваш кошик порожній');
            window.location.href = 'shop-women.html';
        }
    },

    // Render cart summary in sidebar
    renderCartSummary() {
        const container = document.getElementById('summaryItems');
        if (!container) return;

        let html = '';
        let subtotal = 0;

        this.cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            html += `
                <div class="summary-item" data-index="${index}">
                    <img src="${item.image || 'pics/placeholder.jpg'}" alt="${item.name}">
                    <div class="summary-item__details">
                        <div class="summary-item__name">${item.name}</div>
                        <div class="summary-item__meta">Розмір: ${item.size || 'M'}</div>
                        <div class="summary-item__controls">
                            <div class="qty-control">
                                <button type="button" class="qty-btn" onclick="CheckoutManager.changeQty(${index}, -1)">−</button>
                                <span class="qty-value">${item.quantity}</span>
                                <button type="button" class="qty-btn" onclick="CheckoutManager.changeQty(${index}, 1)">+</button>
                            </div>
                            <div class="summary-item__price">${this.formatPrice(itemTotal)}</div>
                        </div>
                    </div>
                    <button type="button" class="remove-btn" onclick="CheckoutManager.removeItem(${index})" title="Видалити">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `;
        });

        if (this.cart.length === 0) {
            html = '<p style="text-align:center; color:#999; padding:40px 0;">Кошик порожній</p>';
        }

        container.innerHTML = html;

        // Update totals
        const total = subtotal;

        const subtotalEl = document.getElementById('subtotal');
        const deliveryEl = document.getElementById('delivery');
        const totalEl = document.getElementById('total');

        if (subtotalEl) subtotalEl.textContent = this.formatPrice(subtotal);
        if (deliveryEl) deliveryEl.textContent = 'За тарифами НП';
        if (totalEl) totalEl.textContent = this.formatPrice(total);
    },

    // Change item quantity
    changeQty(index, delta) {
        if (this.cart[index]) {
            this.cart[index].quantity += delta;
            if (this.cart[index].quantity < 1) {
                this.cart[index].quantity = 1;
            }
            this.saveCart();
            this.renderCartSummary();
        }
    },

    // Remove item from cart
    removeItem(index) {
        this.cart.splice(index, 1);
        this.saveCart();
        this.renderCartSummary();

        // Redirect if cart is empty
        if (this.cart.length === 0) {
            setTimeout(() => {
                Toast.warning('Ваш кошик порожній');
                window.location.href = 'shop-women.html';
            }, 300);
        }
    },

    // Save cart to localStorage
    saveCart() {
        localStorage.setItem('mb_cart', JSON.stringify(this.cart));
        // Update header cart count if available
        if (window.cart) {
            window.cart.items = this.cart;
            window.cart.updateHeaderCount();
        }
    },

    // Nova Poshta API: Search cities
    async searchCities(query) {
        if (query.length < 2) return [];

        try {
            const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: this.novaPoshtaApiKey,
                    modelName: 'Address',
                    calledMethod: 'searchSettlements',
                    methodProperties: {
                        CityName: query,
                        Limit: 10
                    }
                })
            });

            const data = await response.json();
            if (data.success && data.data[0]?.Addresses) {
                return data.data[0].Addresses.map(city => ({
                    ref: city.DeliveryCity || city.Ref,
                    name: city.Present || city.MainDescription
                }));
            }
        } catch (error) {
            console.error('Nova Poshta cities error:', error);
        }
        return [];
    },

    // Nova Poshta API: Get warehouses
    async getWarehouses(cityRef) {
        if (!cityRef) return [];

        try {
            const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: this.novaPoshtaApiKey,
                    modelName: 'Address',
                    calledMethod: 'getWarehouses',
                    methodProperties: {
                        CityRef: cityRef,
                        Limit: 50
                    }
                })
            });

            const data = await response.json();
            if (data.success && data.data) {
                return data.data.map(w => ({
                    ref: w.Ref,
                    name: w.Description
                }));
            }
        } catch (error) {
            console.error('Nova Poshta warehouses error:', error);
        }
        return [];
    },

    // Setup city and warehouse autocomplete with custom dropdowns
    setupNovaPoshtaAutocomplete() {
        const cityInput = document.getElementById('city');
        const addressInput = document.getElementById('address');

        if (!cityInput || !addressInput) return;

        // Create dropdown containers
        this.createDropdown(cityInput, 'cityDropdown');
        this.createDropdown(addressInput, 'warehouseDropdown');

        // City search
        let cityTimeout;
        cityInput.addEventListener('input', async (e) => {
            clearTimeout(cityTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                this.hideDropdown('cityDropdown');
                return;
            }

            this.showDropdownLoading('cityDropdown');

            cityTimeout = setTimeout(async () => {
                const cities = await this.searchCities(query);
                this.cities = cities;
                this.renderDropdown('cityDropdown', cities, (city) => {
                    cityInput.value = city.name;
                    this.selectedCityRef = city.ref;
                    this.hideDropdown('cityDropdown');
                    this.loadWarehouses(city.ref);
                });
            }, 300);
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.np-dropdown-wrapper')) {
                this.hideDropdown('cityDropdown');
                this.hideDropdown('warehouseDropdown');
            }
        });

        // Warehouse search/filter
        addressInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (this.warehouses && this.warehouses.length > 0) {
                const filtered = this.warehouses.filter(w =>
                    w.name.toLowerCase().includes(query)
                );
                this.renderDropdown('warehouseDropdown', filtered, (warehouse) => {
                    addressInput.value = warehouse.name;
                    this.hideDropdown('warehouseDropdown');
                });
            }
        });

        addressInput.addEventListener('focus', () => {
            if (this.warehouses && this.warehouses.length > 0) {
                this.renderDropdown('warehouseDropdown', this.warehouses.slice(0, 20), (warehouse) => {
                    addressInput.value = warehouse.name;
                    this.hideDropdown('warehouseDropdown');
                });
            }
        });
    },

    createDropdown(input, dropdownId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'np-dropdown-wrapper';
        wrapper.style.position = 'relative';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'np-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            max-height: 280px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            margin-top: 4px;
        `;
        wrapper.appendChild(dropdown);
    },

    showDropdownLoading(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'block';
            dropdown.innerHTML = '<div style="padding:16px; text-align:center; color:#999;">Завантаження...</div>';
        }
    },

    hideDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    },

    renderDropdown(dropdownId, items, onSelect) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        if (items.length === 0) {
            dropdown.innerHTML = '<div style="padding:16px; text-align:center; color:#999;">Нічого не знайдено</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = items.map((item, index) => `
            <div class="np-dropdown-item" data-index="${index}" style="
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid #f5f5f5;
                font-size: 14px;
                transition: background 0.2s;
            ">${item.name}</div>
        `).join('');

        dropdown.style.display = 'block';

        // Add click handlers
        dropdown.querySelectorAll('.np-dropdown-item').forEach((el, idx) => {
            el.addEventListener('click', () => onSelect(items[idx]));
            el.addEventListener('mouseenter', () => el.style.background = '#f5f5f5');
            el.addEventListener('mouseleave', () => el.style.background = '#fff');
        });
    },

    async loadWarehouses(cityRef) {
        const addressInput = document.getElementById('address');
        if (!addressInput) return;

        addressInput.value = '';
        addressInput.placeholder = 'Завантаження відділень...';
        addressInput.disabled = true;

        const warehouses = await this.getWarehouses(cityRef);
        this.warehouses = warehouses;

        addressInput.placeholder = `Виберіть відділення (${warehouses.length} доступно)`;
        addressInput.disabled = false;
        addressInput.focus();

        // Show dropdown immediately
        this.renderDropdown('warehouseDropdown', warehouses.slice(0, 20), (warehouse) => {
            addressInput.value = warehouse.name;
            this.hideDropdown('warehouseDropdown');
        });
    },

    // Setup form submission
    setupFormSubmit() {
        const form = document.getElementById('checkoutForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitOrder();
        });
    },

    // Submit order to backend
    async submitOrder() {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const customerName = `${firstName} ${lastName}`.trim();
        const paymentMethod = document.getElementById('paymentMethod').value;

        const orderData = {
            customer_name: customerName,
            customer_phone: document.getElementById('userPhone').value,
            customer_email: document.getElementById('userEmail').value || null,
            delivery_city: document.getElementById('city').value,
            delivery_address: document.getElementById('address').value,
            payment_method: paymentMethod,
            items: this.cart.map(item => ({
                product_id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                size: item.size || 'M',
                color: item.color || null
            }))
        };

        // Calculate total
        orderData.total_amount = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        try {
            // Show loading state
            const submitBtn = document.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader"></span> Обробка...';

            const response = await fetch('http://localhost:4444/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                const result = await response.json();

                // Clear cart
                localStorage.removeItem('mb_cart');
                if (window.cart) window.cart.clear();

                // Redirect to thank you page
                window.location.href = `thank-you.html?order=${result.order_number}`;
            } else {
                const error = await response.json();
                Toast.error('Помилка: ' + (error.detail || 'Не вдалося оформити замовлення'));
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        } catch (error) {
            console.error('Order submission error:', error);
            Toast.error('Помилка з\'єднання з сервером.');
        }
    },

    formatPrice(price) {
        return new Intl.NumberFormat('uk-UA').format(price) + ' грн';
    }
};

// Multi-step form navigation
function goToStep(step) {
    // Stage validation
    if (step > CheckoutManager.currentStep) {
        if (CheckoutManager.currentStep === 1) {
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const userPhone = document.getElementById('userPhone').value.trim();
            if (!firstName || !lastName || !userPhone) {
                Toast.warning('Будь ласка, заповніть контактні дані');
                return;
            }
        } else if (CheckoutManager.currentStep === 2) {
            const city = document.getElementById('city').value.trim();
            const address = document.getElementById('address').value.trim();
            if (!city || !address) {
                Toast.warning('Будь ласка, виберіть місто та відділення Нової Пошти');
                return;
            }
        }
    }

    // Hide all sections
    document.querySelectorAll('.form-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(`section${step}`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        CheckoutManager.currentStep = step;

        // Update progress indicators
        document.querySelectorAll('.progress-step').forEach((el, index) => {
            if (index + 1 <= step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Payment method selection
function setPaymentMethod(method) {
    document.getElementById('paymentMethod').value = method;

    // Update UI
    document.querySelectorAll('.payment-card').forEach(card => {
        if (card.dataset.method === method) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    CheckoutManager.init();
    goToStep(1);
});
