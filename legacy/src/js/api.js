const API_BASE_URL = 'http://localhost:4444';

class ApiService {
    static async fetchProducts(category = '') {
        try {
            const url = category ? `${API_BASE_URL}/products?category=${category}` : `${API_BASE_URL}/products`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            // Fallback to static JSON if local server is down
            try {
                const fileName = category === 'kids' ? 'products_kids.json' : 'products_women.json';
                const response = await fetch(`data/${fileName}`);
                return await response.json();
            } catch (e) {
                return [];
            }
        }
    }

    static async fetchProductById(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`);
            if (response.ok) return await response.json();

            // Fallback
            const womenResponse = await fetch('data/products_women.json');
            const womenData = await womenResponse.json();
            let product = womenData.find(p => p.id === id);

            if (!product) {
                const kidsResponse = await fetch('data/products_kids.json');
                const kidsData = await kidsResponse.json();
                product = kidsData.find(p => p.id === id);
            }

            return product || null;
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    }

    // === TELEGRAM CONFIG ===
    static TG_BOT_TOKEN = '6439938942:AAH1_jFloUmBmWT2OEPPOijK3_KdsR2c9Xc';
    static TG_CHAT_ID = '974895094';

    // === MOCK DATABASE HELPERS ===
    static _getDb() {
        return {
            users: JSON.parse(localStorage.getItem('mb_users')) || [],
            orders: JSON.parse(localStorage.getItem('mb_orders')) || []
        };
    }

    static _saveDb(users, orders) {
        if (users) localStorage.setItem('mb_users', JSON.stringify(users));
        if (orders) localStorage.setItem('mb_orders', JSON.stringify(orders));
    }

    // === AUTHENTICATION ===

    static async register(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            if (!response.ok) return { error: result.detail || 'Помилка реєстрації' };

            // Send Notification to Telegram (side effect)
            if (this.TG_BOT_TOKEN && this.TG_CHAT_ID) {
                const message = `🌟 <b>Нова реєстрація!</b>\n👤 <b>Ім'я:</b> ${userData.full_name}\n📧 <b>Email:</b> ${userData.email}`;
                const url = `https://api.telegram.org/bot${this.TG_BOT_TOKEN}/sendMessage?chat_id=${this.TG_CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=HTML`;
                fetch(url).catch(e => console.error(e));
            }

            // Auto-login after registration
            return await this.login(userData.email, userData.password);
        } catch (error) {
            return { error: 'Не вдалося підключитися до сервера' };
        }
    }

    static async login(email, password) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            const result = await response.json();
            if (!response.ok) return { error: result.detail || 'Невірний email або пароль' };

            localStorage.setItem('mb_token', result.access_token);

            // Get user info
            const user = await this.getCurrentUser();
            return { access_token: result.access_token, user };
        } catch (error) {
            return { error: 'Не вдалося підключитися до сервера' };
        }
    }

    static async logout() {
        localStorage.removeItem('mb_token');
        window.location.href = 'index.html';
    }

    static async getCurrentUser() {
        const token = localStorage.getItem('mb_token');
        if (!token) return null;

        try {
            const response = await fetch(`${API_BASE_URL}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) return await response.json();

            // If token expired
            localStorage.removeItem('mb_token');
            return null;
        } catch (error) {
            return null;
        }
    }

    static async updateUser(data) {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return { error: 'Unauthorized' };

        const { users } = this._getDb();
        const index = users.findIndex(u => u.id === currentUser.id);

        if (index === -1) return { error: 'User not found' };

        // Update fields
        const updatedUser = { ...users[index], ...data };
        users[index] = updatedUser;
        this._saveDb(users, null);

        return updatedUser;
    }

    // === ORDERS ===

    static async createOrder(orderData) {
        const token = localStorage.getItem('mb_token');
        try {
            const response = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(orderData)
            });

            if (!response.ok) throw new Error('Failed to create order');
            const newOrder = await response.json();

            // Notify Telegram (side effect)
            if (this.TG_BOT_TOKEN && this.TG_CHAT_ID) {
                const itemsList = orderData.items.map(i => `- ${i.name} (${i.size}) x${i.quantity}`).join('\n');
                const message = `🛍 <b>Нове замовлення!</b> #${newOrder.id}\n👤 <b>Сума:</b> ${orderData.total_amount} ₴\n📍 <b>Доставка:</b> ${orderData.delivery_city}`;
                const url = `https://api.telegram.org/bot${this.TG_BOT_TOKEN}/sendMessage?chat_id=${this.TG_CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=HTML`;
                fetch(url).catch(e => { });
            }

            return newOrder;
        } catch (error) {
            console.error(error);
            // Local fallback if needed
            return { id: Date.now(), ...orderData, status: 'pending' };
        }
    }

    static async getMyOrders() {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return [];

        const { orders } = this._getDb();
        // Filter orders for this user and sort by date desc
        return orders
            .filter(o => o.user_id === currentUser.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // === GUEST ORDER NOTIFICATION ===
    static async sendOrderNotification(orderData) {
        if (!this.TG_BOT_TOKEN || !this.TG_CHAT_ID) {
            console.warn('Telegram not configured');
            return false;
        }

        try {
            const itemsList = orderData.items.map(i =>
                `• ${i.name} (${i.size || '-'}) × ${i.quantity} = ${i.price * i.quantity} ₴`
            ).join('\n');

            const message = `
🛍 <b>НОВЕ ЗАМОВЛЕННЯ!</b> ${orderData.order_number}

👤 <b>Клієнт:</b> ${orderData.customer.first_name} ${orderData.customer.last_name}
📞 <b>Телефон:</b> ${orderData.customer.phone}
📧 <b>Email:</b> ${orderData.customer.email || 'Не вказано'}

📦 <b>Товари:</b>
${itemsList}

💰 <b>Разом:</b> ${orderData.total_amount} ₴

🚚 <b>Доставка:</b> Нова Пошта
📍 <b>Місто:</b> ${orderData.delivery.city}
🏢 <b>Адреса:</b> ${orderData.delivery.address}

💵 <b>Оплата:</b> Наложенний платіж
            `.trim();

            const url = `https://api.telegram.org/bot${this.TG_BOT_TOKEN}/sendMessage?chat_id=${this.TG_CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=HTML`;
            await fetch(url, { mode: 'no-cors' });
            console.log('Telegram notification sent');
            return true;
        } catch (e) {
            console.error('Telegram Error:', e);
            return false;
        }
    }
}

window.api = ApiService;
