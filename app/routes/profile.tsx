import { Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { AuthUtils, type User, type Address, type UserSettings } from "../utils/auth";
import { StorageUtils } from "../utils/storage";

type DashboardTab = 'overview' | 'orders' | 'addresses' | 'settings';

interface Order {
    id: string;
    date: string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    total: number;
    items: Array<{
        name: string;
        image: string;
        quantity: number;
        price: number;
        size?: string;
        color?: string;
    }>;
}

export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [orders, setOrders] = useState<Order[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [wishlistCount, setWishlistCount] = useState(0);

    // Edit profile state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');

    // Change password state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // Add address state
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [newAddress, setNewAddress] = useState({ label: '', city: '', warehouse: '', isDefault: false });

    // Toast state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const authState = AuthUtils.getAuthState();
        if (!authState.isAuthenticated || !authState.user) {
            navigate('/auth');
            return;
        }
        setUser(authState.user);
        setEditName(authState.user.name);
        setEditPhone(authState.user.phone || '');

        // Self-healing: Sync legacy/unsynced users to DB
        if (authState.user) {
            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: authState.user.name,
                    email: authState.user.email,
                    phone: authState.user.phone
                })
            }).catch(console.error);
        }

        // Load data
        setAddresses(AuthUtils.getAddresses());
        setSettings(AuthUtils.getSettings());
        setWishlistCount(StorageUtils.getWishlist().length);

        // Load orders
        if (authState.user) {
            fetch(`/api/orders/list?email=${authState.user.email}`)
                .then(res => res.json())
                .then(data => setOrders(data))
                .catch(err => console.error('Failed to fetch orders:', err));
        }

        // Subscribe to changes
        const unsubAuth = AuthUtils.subscribeToAuth(() => {
            const state = AuthUtils.getAuthState();
            if (!state.isAuthenticated) {
                navigate('/auth');
            } else {
                setUser(state.user);
            }
        });

        const unsubWishlist = StorageUtils.subscribeToWishlist(() => {
            setWishlistCount(StorageUtils.getWishlist().length);
        });

        return () => {
            unsubAuth();
            unsubWishlist();
        };
    }, [navigate]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleLogout = () => {
        AuthUtils.logout();
        navigate('/');
    };

    const handleSaveProfile = () => {
        const result = AuthUtils.updateProfile({ name: editName, phone: editPhone });
        if (result.success) {
            setUser(result.user!);
            setIsEditing(false);
            showToast('Профіль оновлено!', 'success');
        }
    };

    const handleChangePassword = () => {
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword !== confirmNewPassword) {
            setPasswordError('Паролі не співпадають');
            return;
        }

        const result = AuthUtils.changePassword(currentPassword, newPassword);
        if (result.success) {
            setPasswordSuccess(result.message);
            setTimeout(() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                showToast('Пароль змінено!', 'success');
            }, 1500);
        } else {
            setPasswordError(result.message);
        }
    };

    const handleAddAddress = () => {
        if (!newAddress.label || !newAddress.city || !newAddress.warehouse) {
            showToast('Заповніть всі поля', 'error');
            return;
        }
        AuthUtils.saveAddress(newAddress);
        setAddresses(AuthUtils.getAddresses());
        setShowAddressModal(false);
        setNewAddress({ label: '', city: '', warehouse: '', isDefault: false });
        showToast('Адресу додано!', 'success');
    };

    const handleDeleteAddress = (id: string) => {
        AuthUtils.deleteAddress(id);
        setAddresses(AuthUtils.getAddresses());
        showToast('Адресу видалено', 'success');
    };

    const handleSettingsChange = (key: keyof UserSettings, value: any) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        AuthUtils.saveSettings(newSettings);
        showToast('Налаштування збережено', 'success');
    };

    const getStatusLabel = (status: Order['status']) => {
        const labels = {
            pending: { text: 'Очікує', color: '#f59e0b' },
            processing: { text: 'Обробляється', color: '#3b82f6' },
            shipped: { text: 'Відправлено', color: '#8b5cf6' },
            delivered: { text: 'Доставлено', color: '#10b981' },
            cancelled: { text: 'Скасовано', color: '#ef4444' }
        };
        return labels[status];
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (!user) {
        return (
            <main className="dashboard-page">
                <div className="dashboard-loading">
                    <div className="spinner"></div>
                    <p>Завантаження...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="dashboard-page">
            {/* Hero Section */}
            <section className="dashboard-hero">
                <div className="container">
                    <div className="dashboard-hero__content">
                        <div className="dashboard-hero__avatar">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} />
                            ) : (
                                <span>{getInitials(user.name)}</span>
                            )}
                        </div>
                        <div className="dashboard-hero__info">
                            <h1>Привіт, <em>{user.name.split(' ')[0]}</em>!</h1>
                            <p>{user.email}</p>
                        </div>
                        <button className="dashboard-hero__logout" onClick={handleLogout}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Вийти
                        </button>
                    </div>
                </div>
            </section>

            {/* Dashboard Content */}
            <section className="dashboard-content">
                <div className="container">
                    {/* Quick Stats */}
                    <div className="dashboard-stats">
                        <div className="stat-card">
                            <div className="stat-card__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <path d="M16 10a4 4 0 0 1-8 0" />
                                </svg>
                            </div>
                            <div className="stat-card__content">
                                <span className="stat-card__value">{orders.length}</span>
                                <span className="stat-card__label">Замовлень</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                            </div>
                            <div className="stat-card__content">
                                <span className="stat-card__value">{wishlistCount}</span>
                                <span className="stat-card__label">В обраному</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="dashboard-tabs">
                        <button
                            className={`dashboard-tab ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            Огляд
                        </button>
                        <button
                            className={`dashboard-tab ${activeTab === 'orders' ? 'active' : ''}`}
                            onClick={() => setActiveTab('orders')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                            Замовлення
                        </button>
                        <button
                            className={`dashboard-tab ${activeTab === 'addresses' ? 'active' : ''}`}
                            onClick={() => setActiveTab('addresses')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            Адреси
                        </button>
                        <button
                            className={`dashboard-tab ${activeTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Налаштування
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="dashboard-panel">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="dashboard-overview">
                                {/* Quick Actions */}
                                <div className="quick-actions">
                                    <h3 className="section-title">Швидкі дії</h3>
                                    <div className="quick-actions__grid">
                                        <Link to="/shop/women" className="action-card">
                                            <div className="action-card__icon">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="9" cy="21" r="1" />
                                                    <circle cx="20" cy="21" r="1" />
                                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                                </svg>
                                            </div>
                                            <span>Каталог</span>
                                        </Link>
                                        <Link to="/wishlist" className="action-card">
                                            <div className="action-card__icon">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                </svg>
                                            </div>
                                            <span>Обране</span>
                                            {wishlistCount > 0 && <span className="action-card__badge">{wishlistCount}</span>}
                                        </Link>
                                        <Link to="/contacts" className="action-card">
                                            <div className="action-card__icon">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                </svg>
                                            </div>
                                            <span>Підтримка</span>
                                        </Link>
                                        <button className="action-card" onClick={() => setActiveTab('settings')}>
                                            <div className="action-card__icon">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="3" />
                                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                                </svg>
                                            </div>
                                            <span>Налаштування</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Profile Card */}
                                <div className="profile-card">
                                    <div className="profile-card__header">
                                        <h3>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            Інформація профілю
                                        </h3>
                                        {!isEditing ? (
                                            <button className="profile-card__edit" onClick={() => setIsEditing(true)}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                Редагувати
                                            </button>
                                        ) : (
                                            <div className="profile-card__actions">
                                                <button className="btn-cancel" onClick={() => setIsEditing(false)}>Скасувати</button>
                                                <button className="btn-save" onClick={handleSaveProfile}>Зберегти</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="profile-card__content">
                                        <div className="profile-grid">
                                            <div className="profile-field">
                                                <label>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                        <circle cx="12" cy="7" r="4" />
                                                    </svg>
                                                    Ім'я
                                                </label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                ) : (
                                                    <span>{user.name}</span>
                                                )}
                                            </div>
                                            <div className="profile-field">
                                                <label>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                        <polyline points="22,6 12,13 2,6" />
                                                    </svg>
                                                    Email
                                                </label>
                                                <span>{user.email}</span>
                                            </div>
                                            <div className="profile-field">
                                                <label>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                    </svg>
                                                    Телефон
                                                </label>
                                                {isEditing ? (
                                                    <input
                                                        type="tel"
                                                        value={editPhone}
                                                        onChange={(e) => setEditPhone(e.target.value)}
                                                        placeholder="+380 XX XXX XX XX"
                                                    />
                                                ) : (
                                                    <span>{user.phone || 'Не вказано'}</span>
                                                )}
                                            </div>
                                            <div className="profile-field">
                                                <label>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    Метод реєстрації
                                                </label>
                                                <span className="profile-provider">
                                                    {user.provider === 'google' ? (
                                                        <>
                                                            <svg width="14" height="14" viewBox="0 0 24 24">
                                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                                            </svg>
                                                            Google
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                                <polyline points="22,6 12,13 2,6" />
                                                            </svg>
                                                            Email
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {user.provider === 'email' && (
                                        <button className="profile-card__password" onClick={() => setShowPasswordModal(true)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                            </svg>
                                            Змінити пароль
                                        </button>
                                    )}
                                </div>

                                {/* Recent Orders */}
                                {orders.length > 0 && (
                                    <div className="recent-orders">
                                        <div className="recent-orders__header">
                                            <h3>Останні замовлення</h3>
                                            <button onClick={() => setActiveTab('orders')}>Всі замовлення →</button>
                                        </div>
                                        <div className="recent-orders__list">
                                            {orders.slice(0, 3).map(order => (
                                                <div key={order.id} className="order-card">
                                                    <div className="order-card__header">
                                                        <span className="order-card__id">#{order.id}</span>
                                                        <span
                                                            className="order-card__status"
                                                            style={{ background: getStatusLabel(order.status).color }}
                                                        >
                                                            {getStatusLabel(order.status).text}
                                                        </span>
                                                    </div>
                                                    <div className="order-card__date">{order.date}</div>
                                                    <div className="order-card__total">{order.total.toLocaleString()} ₴</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Orders Tab */}
                        {activeTab === 'orders' && (
                            <div className="orders-section">
                                <h3>Мої замовлення</h3>
                                {orders.length === 0 ? (
                                    <div className="empty-state">
                                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                            <line x1="3" y1="6" x2="21" y2="6" />
                                            <path d="M16 10a4 4 0 0 1-8 0" />
                                        </svg>
                                        <h4>У вас ще немає замовлень</h4>
                                        <p>Перейдіть до каталогу, щоб зробити перше замовлення</p>
                                        <Link to="/shop/women" className="btn-primary">Перейти до каталогу</Link>
                                    </div>
                                ) : (
                                    <div className="orders-list">
                                        {orders.map(order => (
                                            <div key={order.id} className="order-item-full">
                                                <div className="order-item-full__header">
                                                    <div className="order-item-full__info">
                                                        <span className="order-item-full__id">Замовлення #{order.id}</span>
                                                        <span className="order-item-full__date">{order.date}</span>
                                                    </div>
                                                    <span
                                                        className="order-item-full__status"
                                                        style={{ background: getStatusLabel(order.status).color }}
                                                    >
                                                        {getStatusLabel(order.status).text}
                                                    </span>
                                                </div>
                                                <div className="order-item-full__products">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="order-product">
                                                            <img src={item.image} alt={item.name} />
                                                            <div className="order-product__info">
                                                                <span>{item.name}</span>
                                                                <span className="order-product__meta">
                                                                    {item.size && <span style={{ marginRight: 8 }}>Розмір: {item.size}</span>}
                                                                    {item.color && <span style={{ marginRight: 8 }}>Колір: {item.color}</span>}
                                                                    <span style={{ fontWeight: 600 }}>{item.quantity} шт</span>
                                                                </span>
                                                            </div>
                                                            <span className="order-product__price">{item.price} ₴</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="order-item-full__footer">
                                                    <span className="order-item-full__total">Разом: {order.total.toLocaleString()} ₴</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Addresses Tab */}
                        {activeTab === 'addresses' && (
                            <div className="addresses-section">
                                <div className="addresses-section__header">
                                    <h3>Мої адреси</h3>
                                    <button className="btn-add" onClick={() => setShowAddressModal(true)}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Додати адресу
                                    </button>
                                </div>
                                {addresses.length === 0 ? (
                                    <div className="empty-state">
                                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <h4>Немає збережених адрес</h4>
                                        <p>Додайте адресу доставки для швидкого оформлення замовлень</p>
                                    </div>
                                ) : (
                                    <div className="addresses-grid">
                                        {addresses.map(addr => (
                                            <div key={addr.id} className={`address-card ${addr.isDefault ? 'default' : ''}`}>
                                                {addr.isDefault && <span className="address-card__badge">За замовчуванням</span>}
                                                <h4>{addr.label}</h4>
                                                <p>{addr.city}</p>
                                                <p>{addr.warehouse}</p>
                                                <button
                                                    className="address-card__delete"
                                                    onClick={() => handleDeleteAddress(addr.id)}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && settings && (
                            <div className="settings-section">
                                <h3>Налаштування</h3>

                                <div className="settings-group">
                                    <h4>Сповіщення</h4>
                                    <label className="setting-toggle">
                                        <span>Email сповіщення</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.email}
                                            onChange={(e) => handleSettingsChange('notifications', {
                                                ...settings.notifications,
                                                email: e.target.checked
                                            })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <label className="setting-toggle">
                                        <span>SMS сповіщення</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.sms}
                                            onChange={(e) => handleSettingsChange('notifications', {
                                                ...settings.notifications,
                                                sms: e.target.checked
                                            })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <label className="setting-toggle">
                                        <span>Промо-акції та знижки</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.promotions}
                                            onChange={(e) => handleSettingsChange('notifications', {
                                                ...settings.notifications,
                                                promotions: e.target.checked
                                            })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div className="settings-group">
                                    <h4>Мова</h4>
                                    <div className="setting-select">
                                        <select
                                            value={settings.language}
                                            onChange={(e) => handleSettingsChange('language', e.target.value)}
                                        >
                                            <option value="uk">Українська</option>
                                            <option value="en">English</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3>Змінити пароль</h3>
                            <button className="modal__close" onClick={() => setShowPasswordModal(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal__content">
                            {passwordError && <div className="modal__error">{passwordError}</div>}
                            {passwordSuccess && <div className="modal__success">{passwordSuccess}</div>}
                            <div className="form-group">
                                <label>Поточний пароль</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Новий пароль</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Підтвердіть новий пароль</label>
                                <input
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal__footer">
                            <button className="btn-cancel" onClick={() => setShowPasswordModal(false)}>Скасувати</button>
                            <button className="btn-primary" onClick={handleChangePassword}>Змінити</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Address Modal */}
            {showAddressModal && (
                <div className="modal-overlay" onClick={() => setShowAddressModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3>Додати адресу</h3>
                            <button className="modal__close" onClick={() => setShowAddressModal(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal__content">
                            <div className="form-group">
                                <label>Назва (наприклад, "Дім", "Робота")</label>
                                <input
                                    type="text"
                                    value={newAddress.label}
                                    onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                                    placeholder="Дім"
                                />
                            </div>
                            <div className="form-group">
                                <label>Місто</label>
                                <input
                                    type="text"
                                    value={newAddress.city}
                                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                                    placeholder="Київ"
                                />
                            </div>
                            <div className="form-group">
                                <label>Відділення / Адреса</label>
                                <input
                                    type="text"
                                    value={newAddress.warehouse}
                                    onChange={(e) => setNewAddress({ ...newAddress, warehouse: e.target.value })}
                                    placeholder="Відділення Нова Пошта №1"
                                />
                            </div>
                            <label className="auth-checkbox">
                                <input
                                    type="checkbox"
                                    checked={newAddress.isDefault}
                                    onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                                />
                                <span className="checkmark"></span>
                                <span>Зробити адресою за замовчуванням</span>
                            </label>
                        </div>
                        <div className="modal__footer">
                            <button className="btn-cancel" onClick={() => setShowAddressModal(false)}>Скасувати</button>
                            <button className="btn-primary" onClick={handleAddAddress}>Додати</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    {toast.type === 'success' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    )}
                    {toast.message}
                </div>
            )}
        </main>
    );
}
