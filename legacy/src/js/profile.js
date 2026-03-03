const profileApp = {
    user: null,

    async init() {
        // Check Auth
        this.user = await window.api.getCurrentUser();
        if (!this.user) {
            window.location.href = 'index.html';
            return;
        }

        this.renderUserInfo();
        this.renderStats();
        this.renderOrders();
        this.fillSettingsForm();
        this.initSlider();
    },

    renderUserInfo() {
        // Sidebar (no avatar, just name and email)
        document.getElementById('sidebarName').textContent = this.user.full_name;
        document.getElementById('sidebarEmail').textContent = this.user.email;

        // Dashboard Header
        document.getElementById('dashName').textContent = this.user.full_name.split(' ')[0];
    },

    async renderOrders() {
        const orders = await window.api.getMyOrders();
        const container = document.getElementById('ordersList');

        // Update simple counter logic
        if (document.getElementById('statsOrders')) {
            document.getElementById('statsOrders').textContent = orders.length;
        }
        // "Total Spent" logic removed as requested

        // Render List
        if (orders.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; color:#888;">
                    <p style="margin-bottom:16px;">Історія замовлень порожня.</p>
                    <a href="shop-women.html" class="btn btn--outline btn--small">Перейти до каталогу</a>
                </div>
            `;
            return;
        }

        // Full List
        container.innerHTML = orders.map(o => this.createOrderCard(o)).join('');
    },

    createOrderCard(order) {
        const date = new Date(order.created_at).toLocaleDateString('uk-UA');
        const itemsSummary = order.items.map(i => `${i.name} x${i.quantity}`).join(', ');

        let statusClass = 'status-processing';
        let statusText = 'В обробці';
        if (order.status === 'delivered') {
            statusClass = 'status-delivered';
            statusText = 'Доставлено';
        }

        return `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <div class="order-id">Замовлення #${order.id}</div>
                        <div style="font-size:12px; color:#888;">${date}</div>
                    </div>
                    <div class="order-status ${statusClass}">${statusText}</div>
                </div>
                <div style="margin-bottom:12px; color:#555;">
                    ${itemsSummary}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600;">${order.total_amount.toLocaleString()} ₴</span>
                    <button class="btn btn--outline btn--small">Детальніше</button>
                </div>
            </div>
        `;
    },

    renderStats() {
        // Logic moved to renderOrders for efficiency
    },

    fillSettingsForm() {
        document.getElementById('settingName').value = this.user.full_name || '';
        document.getElementById('settingEmail').value = this.user.email || '';
        document.getElementById('settingPhone').value = this.user.phone || '';
        document.getElementById('settingAddress').value = this.user.address || '';
    },

    async saveSettings(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Збереження...';
        btn.disabled = true;

        const updatedData = {
            full_name: document.getElementById('settingName').value,
            phone: document.getElementById('settingPhone').value,
            address: document.getElementById('settingAddress').value
        };

        const res = await window.api.updateUser(updatedData);

        btn.textContent = originalText;
        btn.disabled = false;

        if (res.error) {
            Toast.error('Помилка: ' + res.error);
        } else {
            this.user = res;
            this.renderUserInfo(); // Update sidebar name instantly

            const msg = document.getElementById('saveMsg');
            msg.style.display = 'block';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }
    },

    initSlider() {
        const slides = document.querySelectorAll('.profile-hero__slide');
        if (!slides.length) return;

        let currentSlide = 0;
        const intervalTime = 5000;

        const nextSlide = () => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        };

        setInterval(nextSlide, intervalTime);
    },

    switchTab(tabName) {
        // Update Nav
        document.querySelectorAll('.profile-nav-btn').forEach(el => el.classList.remove('active'));

        // Find button by onclick attribute value for robustness (or just index if cleaner)
        // Since we know the order: Dashboard(0), Orders(1), Settings(2)
        const btnIndex = { 'dashboard': 0, 'orders': 1, 'settings': 2 }[tabName];
        const buttons = document.querySelectorAll('.profile-nav-btn:not(.logout-btn)');
        if (buttons[btnIndex]) buttons[btnIndex].classList.add('active');

        // Update Content
        document.querySelectorAll('.content-block').forEach(el => el.classList.remove('active'));
        const content = document.getElementById(`tab-${tabName}`);
        if (content) content.classList.add('active');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    profileApp.init();
});
