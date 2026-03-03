import { Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { AuthUtils, validateEmail, validatePassword } from "../utils/auth";

type AuthMode = 'login' | 'register';

export default function Auth() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreeTerms, setAgreeTerms] = useState(false);

    // Check if already logged in
    useEffect(() => {
        const authState = AuthUtils.getAuthState();
        if (authState.isAuthenticated) {
            navigate('/profile');
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (mode === 'login') {
                const result = AuthUtils.login(email, password);
                if (result.success) {
                    setSuccess(result.message);
                    setTimeout(() => navigate('/profile'), 1000);
                } else {
                    setError(result.message);
                }
            } else {
                // Validate registration
                if (!name.trim()) {
                    setError("Введіть ваше ім'я");
                    setIsLoading(false);
                    return;
                }

                if (!validateEmail(email)) {
                    setError('Невірний формат email');
                    setIsLoading(false);
                    return;
                }

                const passwordCheck = validatePassword(password);
                if (!passwordCheck.valid) {
                    setError(passwordCheck.message);
                    setIsLoading(false);
                    return;
                }

                if (password !== confirmPassword) {
                    setError('Паролі не співпадають');
                    setIsLoading(false);
                    return;
                }

                if (!agreeTerms) {
                    setError('Необхідно погодитися з умовами');
                    setIsLoading(false);
                    return;
                }

                const result = await AuthUtils.register(name, email, password, phone);
                if (result.success) {
                    setSuccess(result.message);
                    setTimeout(() => navigate('/profile'), 1500);
                } else {
                    setError(result.message);
                }
            }
        } catch (err) {
            setError('Сталася помилка. Спробуйте ще раз.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await AuthUtils.loginWithGoogle();
            if (result.success) {
                setSuccess(result.message);
                setTimeout(() => navigate('/profile'), 1000);
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError('Помилка входу через Google');
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
    };

    return (
        <main className="auth-page">
            {/* Hero Section */}
            <section className="auth-hero">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/">Головна</Link>
                        <span>/</span>
                        <span className="active">{mode === 'login' ? 'Вхід' : 'Реєстрація'}</span>
                    </nav>
                    <h1 className="auth-hero__title">
                        {mode === 'login' ? (
                            <>Вхід в <em>акаунт</em></>
                        ) : (
                            <>Створити <em>акаунт</em></>
                        )}
                    </h1>
                    <p className="auth-hero__subtitle">
                        {mode === 'login'
                            ? 'Увійдіть, щоб отримати доступ до вашого особистого кабінету'
                            : 'Приєднуйтесь до MIND BODY та отримуйте ексклюзивні пропозиції'
                        }
                    </p>
                </div>
            </section>

            {/* Auth Form Section */}
            <section className="auth-content">
                <div className="container">
                    <div className="auth-card">
                        {/* Mode Tabs */}
                        <div className="auth-tabs">
                            <button
                                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                                onClick={() => switchMode('login')}
                            >
                                Вхід
                            </button>
                            <button
                                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                                onClick={() => switchMode('register')}
                            >
                                Реєстрація
                            </button>
                        </div>

                        {/* Error/Success Messages */}
                        {error && (
                            <div className="auth-message auth-message--error">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="auth-message auth-message--success">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                {success}
                            </div>
                        )}

                        {/* Google Login Button */}
                        <button
                            type="button"
                            className="auth-google-btn"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            {mode === 'login' ? 'Увійти через Google' : 'Зареєструватися через Google'}
                        </button>

                        <div className="auth-divider">
                            <span>або</span>
                        </div>

                        {/* Form */}
                        <form className="auth-form" onSubmit={handleSubmit}>
                            {mode === 'register' && (
                                <div className="form-group">
                                    <label htmlFor="name">Ім'я та прізвище</label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Олена Шевченко"
                                        required
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    required
                                />
                            </div>

                            {mode === 'register' && (
                                <div className="form-group">
                                    <label htmlFor="phone">Телефон (необов'язково)</label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+380 XX XXX XX XX"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="password">Пароль</label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                                {mode === 'register' && (
                                    <span className="form-hint">Мінімум 6 символів, включаючи цифру</span>
                                )}
                            </div>

                            {mode === 'register' && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="confirmPassword">Підтвердіть пароль</label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>

                                    <label className="auth-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={agreeTerms}
                                            onChange={(e) => setAgreeTerms(e.target.checked)}
                                        />
                                        <span className="checkmark"></span>
                                        <span>
                                            Я погоджуюся з{' '}
                                            <Link to="/terms" target="_blank">умовами використання</Link>
                                            {' '}та{' '}
                                            <Link to="/privacy" target="_blank">політикою конфіденційності</Link>
                                        </span>
                                    </label>
                                </>
                            )}

                            {mode === 'login' && (
                                <div className="auth-forgot">
                                    <a href="#">Забули пароль?</a>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="auth-submit-btn"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="auth-loading">
                                        <span className="spinner"></span>
                                        Зачекайте...
                                    </span>
                                ) : (
                                    mode === 'login' ? 'Увійти' : 'Зареєструватися'
                                )}
                            </button>
                        </form>

                        {/* Switch Mode Link */}
                        <p className="auth-switch">
                            {mode === 'login' ? (
                                <>
                                    Ще немає акаунту?{' '}
                                    <button onClick={() => switchMode('register')}>
                                        Зареєструватися
                                    </button>
                                </>
                            ) : (
                                <>
                                    Вже маєте акаунт?{' '}
                                    <button onClick={() => switchMode('login')}>
                                        Увійти
                                    </button>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
