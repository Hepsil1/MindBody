/**
 * MIND BODY - Inline Visual Editor
 * Provides edit-in-place functionality for admin users
 */

const AdminEditor = {
    API_URL: 'http://localhost:4444',
    isEditMode: false,
    currentElement: null,
    hasUnsavedChanges: false,

    /**
     * Initialize the admin editor
     */
    init() {
        // Check for edit mode in URL
        const params = new URLSearchParams(window.location.search);
        const token = localStorage.getItem('admin_token');

        if (params.get('edit') === 'true' && token) {
            this.enableEditMode();
        }
    },

    /**
     * Enable edit mode - inject toolbar and setup listeners
     */
    enableEditMode() {
        this.isEditMode = true;
        document.body.classList.add('admin-mode');

        this.injectToolbar();
        this.injectSidebar();
        this.setupEditableElements();

        console.log('🔧 Admin Edit Mode Enabled');
    },

    /**
     * Inject admin toolbar at top of page
     */
    injectToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'admin-toolbar';
        toolbar.innerHTML = `
            <div class="admin-toolbar__left">
                <div class="admin-toolbar__logo">
                    <span class="icon">🔧</span>
                    <span>MIND BODY Admin</span>
                </div>
                <span class="admin-toolbar__status">Режим редагування</span>
            </div>
            <div class="admin-toolbar__right">
                <button class="admin-toolbar__btn admin-toolbar__btn--secondary" onclick="AdminEditor.openOrdersPage()">
                    📦 Замовлення
                </button>
                <button class="admin-toolbar__btn admin-toolbar__btn--primary" onclick="AdminEditor.saveAllChanges()">
                    💾 Зберегти
                </button>
                <button class="admin-toolbar__btn admin-toolbar__btn--secondary" onclick="AdminEditor.previewMode()">
                    👁️ Превью
                </button>
                <button class="admin-toolbar__btn admin-toolbar__btn--danger" onclick="AdminEditor.logout()">
                    🚪 Вийти
                </button>
            </div>
        `;
        document.body.prepend(toolbar);
    },

    /**
     * Inject sidebar editor panel
     */
    injectSidebar() {
        const sidebar = document.createElement('aside');
        sidebar.className = 'admin-sidebar';
        sidebar.id = 'adminSidebar';
        sidebar.innerHTML = `
            <div class="admin-sidebar__header">
                <h3 class="admin-sidebar__title">Редагування</h3>
                <button class="admin-sidebar__close" onclick="AdminEditor.closeSidebar()">×</button>
            </div>
            <div class="admin-sidebar__content" id="sidebarContent">
                <!-- Dynamic content -->
            </div>
        `;
        document.body.appendChild(sidebar);
    },

    /**
     * Setup editable elements with click handlers
     */
    setupEditableElements() {
        // Mark product cards as editable
        document.querySelectorAll('.product-card').forEach(card => {
            card.setAttribute('data-editable', 'product');
            card.addEventListener('click', (e) => {
                if (this.isEditMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.editProduct(card);
                }
            });
        });

        // Mark text elements as editable
        document.querySelectorAll('[data-editable="text"]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (this.isEditMode) {
                    e.preventDefault();
                    this.editText(el);
                }
            });
        });

        // Mark images as editable
        document.querySelectorAll('[data-editable="image"]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (this.isEditMode) {
                    e.preventDefault();
                    this.editImage(el);
                }
            });
        });
    },

    /**
     * Edit a product card
     */
    editProduct(card) {
        const productId = card.dataset.productId || card.querySelector('a')?.href?.split('/').pop()?.split('?')[0];

        this.openSidebar(`
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">ID товару</label>
                <input type="text" class="admin-sidebar__input" id="editProductId" value="${productId || ''}" readonly>
            </div>
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">Назва</label>
                <input type="text" class="admin-sidebar__input" id="editProductName" value="${card.querySelector('.product-card__title')?.textContent || ''}">
            </div>
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">Ціна (грн)</label>
                <input type="number" class="admin-sidebar__input" id="editProductPrice" value="${this.extractPrice(card)}">
            </div>
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">Зображення</label>
                <div class="image-uploader" onclick="AdminEditor.triggerImageUpload('productImage')">
                    <div class="image-uploader__icon">📷</div>
                    <div class="image-uploader__text">Натисніть для завантаження</div>
                    <img class="image-uploader__preview" id="productImagePreview" src="${card.querySelector('img')?.src || ''}" style="display: ${card.querySelector('img') ? 'block' : 'none'}">
                </div>
                <input type="file" id="productImage" accept="image/*" style="display:none" onchange="AdminEditor.handleImageUpload(this)">
            </div>
            <div class="admin-sidebar__actions">
                <button class="admin-sidebar__save" onclick="AdminEditor.saveProduct()">Зберегти</button>
                <button class="admin-sidebar__cancel" onclick="AdminEditor.closeSidebar()">Скасувати</button>
            </div>
        `, 'Редагування товару');

        this.currentElement = card;
    },

    /**
     * Edit text element
     */
    editText(el) {
        this.openSidebar(`
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">Текст</label>
                <textarea class="admin-sidebar__input admin-sidebar__textarea" id="editTextValue">${el.textContent}</textarea>
            </div>
            <div class="admin-sidebar__actions">
                <button class="admin-sidebar__save" onclick="AdminEditor.saveText()">Зберегти</button>
                <button class="admin-sidebar__cancel" onclick="AdminEditor.closeSidebar()">Скасувати</button>
            </div>
        `, 'Редагування тексту');

        this.currentElement = el;
    },

    /**
     * Edit image element
     */
    editImage(el) {
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');

        this.openSidebar(`
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">Зображення</label>
                <div class="image-uploader" onclick="AdminEditor.triggerImageUpload('editImageFile')">
                    <div class="image-uploader__icon">📷</div>
                    <div class="image-uploader__text">Натисніть для завантаження</div>
                    <img class="image-uploader__preview" id="editImagePreview" src="${img?.src || ''}" style="display: block">
                </div>
                <input type="file" id="editImageFile" accept="image/*" style="display:none" onchange="AdminEditor.handleImageUpload(this)">
            </div>
            <div class="admin-sidebar__group">
                <label class="admin-sidebar__label">Alt текст</label>
                <input type="text" class="admin-sidebar__input" id="editImageAlt" value="${img?.alt || ''}">
            </div>
            <div class="admin-sidebar__actions">
                <button class="admin-sidebar__save" onclick="AdminEditor.saveImage()">Зберегти</button>
                <button class="admin-sidebar__cancel" onclick="AdminEditor.closeSidebar()">Скасувати</button>
            </div>
        `, 'Редагування зображення');

        this.currentElement = el;
    },

    /**
     * Open sidebar with content
     */
    openSidebar(content, title = 'Редагування') {
        const sidebar = document.getElementById('adminSidebar');
        const contentEl = document.getElementById('sidebarContent');
        const titleEl = sidebar.querySelector('.admin-sidebar__title');

        titleEl.textContent = title;
        contentEl.innerHTML = content;
        sidebar.classList.add('open');
    },

    /**
     * Close sidebar
     */
    closeSidebar() {
        document.getElementById('adminSidebar').classList.remove('open');
        this.currentElement = null;
    },

    /**
     * Trigger file input click
     */
    triggerImageUpload(inputId) {
        document.getElementById(inputId).click();
    },

    /**
     * Handle image upload
     */
    async handleImageUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const preview = input.parentElement.querySelector('.image-uploader__preview');

        // Show local preview
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // Upload to server
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'products');

            const response = await fetch(`${this.API_URL}/media/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                input.dataset.uploadedUrl = data.url;
                this.showToast('Зображення завантажено', 'success');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            this.showToast('Помилка завантаження', 'error');
        }
    },

    /**
     * Save product changes
     */
    async saveProduct() {
        const productId = document.getElementById('editProductId').value;
        const name = document.getElementById('editProductName').value;
        const price = parseFloat(document.getElementById('editProductPrice').value);

        try {
            const response = await fetch(`${this.API_URL}/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({ name, price })
            });

            if (response.ok) {
                // Update UI
                if (this.currentElement) {
                    const titleEl = this.currentElement.querySelector('.product-card__title');
                    const priceEl = this.currentElement.querySelector('.product-card__price');
                    if (titleEl) titleEl.textContent = name;
                    if (priceEl) priceEl.textContent = `${price} грн`;
                }

                this.showToast('Товар збережено', 'success');
                this.closeSidebar();
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            this.showToast('Помилка збереження', 'error');
        }
    },

    /**
     * Save text changes
     */
    saveText() {
        const newText = document.getElementById('editTextValue').value;
        if (this.currentElement) {
            this.currentElement.textContent = newText;
        }
        this.hasUnsavedChanges = true;
        this.showToast('Текст оновлено', 'success');
        this.closeSidebar();
    },

    /**
     * Save image changes
     */
    saveImage() {
        const newSrc = document.getElementById('editImageFile').dataset.uploadedUrl;
        const newAlt = document.getElementById('editImageAlt').value;

        if (this.currentElement) {
            const img = this.currentElement.tagName === 'IMG' ? this.currentElement : this.currentElement.querySelector('img');
            if (img) {
                if (newSrc) img.src = newSrc;
                img.alt = newAlt;
            }
        }
        this.hasUnsavedChanges = true;
        this.showToast('Зображення оновлено', 'success');
        this.closeSidebar();
    },

    /**
     * Save all pending changes
     */
    async saveAllChanges() {
        this.showToast('Зміни збережено', 'success');
        this.hasUnsavedChanges = false;
    },

    /**
     * Preview mode - temporarily hide admin UI
     */
    previewMode() {
        document.body.classList.toggle('admin-mode');
        document.querySelector('.admin-toolbar').classList.toggle('hidden');
    },

    /**
     * Open orders management page
     */
    openOrdersPage() {
        window.location.href = '/admin/orders.html';
    },

    /**
     * Logout admin
     */
    async logout() {
        if (this.hasUnsavedChanges) {
            const confirmed = await Modal.confirm(
                'Незбережені зміни',
                'У вас є незбережені зміни. Ви впевнені, що хочете вийти?'
            );
            if (!confirmed) {
                return;
            }
        }
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/';
    },

    /**
     * Extract price from product card
     */
    extractPrice(card) {
        const priceText = card.querySelector('.product-card__price')?.textContent || '';
        return parseFloat(priceText.replace(/[^\d]/g, '')) || 0;
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.admin-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Auto-initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    AdminEditor.init();
});

// Expose globally
window.AdminEditor = AdminEditor;
