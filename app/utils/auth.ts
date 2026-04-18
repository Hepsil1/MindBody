// Auth Utilities for MindBody — localStorage-based Auth
// Handles user registration, login (email + Google OAuth), and session management

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    createdAt: string;
    provider: 'email' | 'google';
}

export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
}

export interface Address {
    id: string;
    label: string;
    city: string;
    cityRef?: string;
    warehouse: string;
    warehouseRef?: string;
    isDefault: boolean;
}

export interface UserSettings {
    notifications: {
        email: boolean;
        sms: boolean;
        promotions: boolean;
    };
    language: 'uk' | 'en';
    theme: 'light' | 'dark' | 'auto';
}

const STORAGE_KEYS = {
    AUTH_USER: 'auth_user',
    ADDRESSES: 'user_addresses',
    SETTINGS: 'user_settings'
};

const EVENTS = {
    AUTH_CHANGED: 'auth-changed'
};

// Validate email format
export const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Validate password strength
export const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 6) {
        return { valid: false, message: 'Пароль має бути мінімум 6 символів' };
    }
    if (!/\d/.test(password)) {
        return { valid: false, message: 'Пароль має містити хоча б одну цифру' };
    }
    return { valid: true, message: '' };
};

// Send registration notification via server-side route
const sendRegistrationNotification = async (user: User): Promise<void> => {
    const message = `
🎉 *НОВА РЕЄСТРАЦІЯ - MIND BODY*
━━━━━━━━━━━━━━━━━━━━━
👤 *Ім'я:* ${user.name}
📧 *Email:* ${user.email}
📱 *Телефон:* ${user.phone || 'Не вказано'}

ℹ️ *Додаткова інформація:*
🔐 *Метод реєстрації:* ${user.provider === 'google' ? 'Google' : 'Email/Пароль'}
🆔 *ID:* \`${user.id}\`
📅 *Дата:* ${new Date().toLocaleString('uk-UA')}
━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    try {
        await fetch('/api/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
    } catch (error) {
        console.error('Failed to send registration notification:', error);
    }
};

export const AuthUtils = {
    // Get current auth state (synchronous — from sessionStorage)
    getAuthState: (): AuthState => {
        try {
            const cached = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
            if (cached) {
                const user = JSON.parse(cached);
                return { isAuthenticated: true, user };
            }
        } catch { }
        return { isAuthenticated: false, user: null };
    },

    // Async version — same as sync now (no Supabase to verify with)
    getAuthStateAsync: async (): Promise<AuthState> => {
        return AuthUtils.getAuthState();
    },

    // Register new user via our own API
    register: async (
        name: string,
        email: string,
        password: string,
        phone?: string
    ): Promise<{ success: boolean; message: string; user?: User }> => {
        if (!validateEmail(email)) {
            return { success: false, message: 'Невірний формат email' };
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, message: passwordValidation.message };
        }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone })
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, message: data.error || 'Помилка реєстрації' };
            }

            const user: User = {
                id: data.id,
                name: `${data.firstName} ${data.lastName || ''}`.trim(),
                email: data.email,
                phone: data.phone,
                avatar: data.avatar,
                createdAt: data.createdAt,
                provider: 'email'
            };

            sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
            window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));

            // Send Telegram notification
            await sendRegistrationNotification(user);

            // Initialize default settings
            AuthUtils.saveSettings({
                notifications: { email: true, sms: false, promotions: true },
                language: 'uk',
                theme: 'light'
            });

            return { success: true, message: 'Реєстрація успішна!', user };
        } catch (e) {
            console.error('Registration error:', e);
            return { success: false, message: 'Помилка з\'єднання із сервером' };
        }
    },

    // Login with email/password via our own API
    login: async (email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, message: data.error || 'Невірний email або пароль' };
            }

            const user: User = {
                id: data.id,
                name: `${data.firstName} ${data.lastName || ''}`.trim(),
                email: data.email,
                phone: data.phone,
                avatar: data.avatar,
                createdAt: data.createdAt,
                provider: 'email'
            };

            sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
            window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));
            return { success: true, message: 'Вхід успішний!', user };
        } catch (e) {
            console.error('Login error:', e);
            return { success: false, message: 'Помилка підключення до сервера' };
        }
    },

    // Google OAuth login — uses Google Identity Services
    loginWithGoogle: async (): Promise<{ success: boolean; message: string }> => {
        try {
            // Redirect to our own Google OAuth endpoint
            window.location.href = '/api/auth/google';
            return { success: true, message: 'Перенаправлення на Google...' };
        } catch (e) {
            console.error('Google login error:', e);
            return { success: false, message: 'Помилка підключення до Google' };
        }
    },

    // Logout
    logout: async (): Promise<void> => {
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
        window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));
    },

    // Handle OAuth callback
    handleOAuthCallback: async (): Promise<{ success: boolean; user?: User }> => {
        try {
            // Parse user data from URL params (set by server callback)
            const params = new URLSearchParams(window.location.search);
            const userData = params.get('user');

            if (userData) {
                const data = JSON.parse(decodeURIComponent(userData));
                const user: User = {
                    id: data.id,
                    name: `${data.firstName} ${data.lastName || ''}`.trim(),
                    email: data.email,
                    phone: data.phone,
                    avatar: data.avatar,
                    createdAt: data.createdAt,
                    provider: 'google'
                };

                sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
                window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));
                return { success: true, user };
            }

            return { success: false };
        } catch (e) {
            console.error('OAuth callback error:', e);
            return { success: false };
        }
    },

    // Update user profile
    updateProfile: (updates: Partial<User>): { success: boolean; user?: User } => {
        try {
            const cached = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
            if (!cached) return { success: false };

            const currentUser = JSON.parse(cached);
            const updatedUser = { ...currentUser, ...updates };
            sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(updatedUser));
            window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));
            return { success: true, user: updatedUser };
        } catch {
            return { success: false };
        }
    },

    // Change password
    changePassword: async (_currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
        try {
            const authState = AuthUtils.getAuthState();
            if (!authState.user) {
                return { success: false, message: 'Необхідно увійти в систему' };
            }

            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: authState.user.email,
                    currentPassword: _currentPassword,
                    newPassword
                })
            });

            const data = await res.json();
            if (!res.ok) {
                return { success: false, message: data.error || 'Помилка зміни паролю' };
            }

            return { success: true, message: 'Пароль успішно змінено!' };
        } catch {
            return { success: false, message: 'Помилка зміни паролю' };
        }
    },

    // Password reset
    resetPassword: async (_email: string): Promise<{ success: boolean; message: string }> => {
        // Without Supabase, password reset via email isn't available
        return { success: false, message: 'Для відновлення паролю зверніться в підтримку через Telegram або Instagram.' };
    },

    // Get user addresses
    getAddresses: (): Address[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
            if (data) return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse addresses:', e);
        }
        return [];
    },

    // Save address
    saveAddress: (address: Omit<Address, 'id'>): Address => {
        const addresses = AuthUtils.getAddresses();
        const newAddress: Address = {
            ...address,
            id: 'addr_' + Date.now().toString(36)
        };

        if (newAddress.isDefault) {
            addresses.forEach(a => a.isDefault = false);
        }

        addresses.push(newAddress);
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
        return newAddress;
    },

    // Delete address
    deleteAddress: (id: string): void => {
        let addresses = AuthUtils.getAddresses();
        addresses = addresses.filter(a => a.id !== id);
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
    },

    // Get user settings
    getSettings: (): UserSettings => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (data) return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse settings:', e);
        }
        return {
            notifications: { email: true, sms: false, promotions: true },
            language: 'uk',
            theme: 'light'
        };
    },

    // Save settings
    saveSettings: (settings: UserSettings): void => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },

    // Subscribe to auth changes (custom events only — no Supabase)
    subscribeToAuth: (callback: () => void) => {
        window.addEventListener(EVENTS.AUTH_CHANGED, callback);

        return () => {
            window.removeEventListener(EVENTS.AUTH_CHANGED, callback);
        };
    }
};
