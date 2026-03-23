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

                        {/* Google Login Button - TEMPORARILY DISABLED
                        <button
                            type="button"
                            className="auth-google-btn"
                            onClick={handleGoogleLogin}
...
                        <div className="auth-divider">
                            <span>або</span>
                        </div>
                        */}

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
