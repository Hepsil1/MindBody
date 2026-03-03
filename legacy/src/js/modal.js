/**
 * Modal System
 * Modern replacement for browser prompt() and confirm() dialogs
 */

(function () {
    'use strict';

    // Create modal structure if it doesn't exist
    function createModalStructure() {
        let overlay = document.querySelector('.modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title"></h2>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn--cancel"></button>
                        <button class="modal-btn modal-btn--primary"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    /**
     * Show a custom prompt modal
     * @param {string} title - Modal title
     * @param {string} message - Modal message/instruction
     * @param {string} defaultValue - Initial input value
     * @returns {Promise<string|null>}
     */
    function showPrompt(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = createModalStructure();
            const modalTitle = overlay.querySelector('.modal-title');
            const modalBody = overlay.querySelector('.modal-body');
            const cancelBtn = overlay.querySelector('.modal-btn--cancel');
            const primaryBtn = overlay.querySelector('.modal-btn--primary');

            modalTitle.textContent = title;
            modalBody.innerHTML = `
                <p>${message}</p>
                <input type="text" class="modal-input" value="${defaultValue}" placeholder="Введіть значення...">
            `;

            cancelBtn.textContent = 'Скасувати';
            primaryBtn.textContent = 'Підтвердити';

            const input = modalBody.querySelector('.modal-input');

            const cleanup = (value) => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    resolve(value);
                }, 300);
            };

            const onConfirm = () => {
                const val = input.value.trim();
                cleanup(val || null);
            };

            const onCancel = () => cleanup(null);

            // Event listeners
            primaryBtn.onclick = onConfirm;
            cancelBtn.onclick = onCancel;
            overlay.onclick = (e) => { if (e.target === overlay) onCancel(); };

            // Handle Enter key
            input.onkeyup = (e) => {
                if (e.key === 'Enter') onConfirm();
                if (e.key === 'Escape') onCancel();
            };

            // Show and focus
            overlay.classList.add('active');
            setTimeout(() => input.focus(), 100);
        });
    }

    /**
     * Show a custom confirm modal
     * @param {string} title
     * @param {string} message
     * @returns {Promise<boolean>}
     */
    function showConfirm(title, message) {
        return new Promise((resolve) => {
            const overlay = createModalStructure();
            const modalTitle = overlay.querySelector('.modal-title');
            const modalBody = overlay.querySelector('.modal-body');
            const cancelBtn = overlay.querySelector('.modal-btn--cancel');
            const primaryBtn = overlay.querySelector('.modal-btn--primary');

            modalTitle.textContent = title;
            modalBody.innerHTML = `<p>${message}</p>`;

            cancelBtn.textContent = 'Ні';
            primaryBtn.textContent = 'Так, впевнений';

            const cleanup = (value) => {
                overlay.classList.remove('active');
                setTimeout(() => resolve(value), 300);
            };

            primaryBtn.onclick = () => cleanup(true);
            cancelBtn.onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };

            overlay.classList.add('active');
        });
    }

    // Expose global API
    window.Modal = {
        prompt: showPrompt,
        confirm: showConfirm
    };

})();
