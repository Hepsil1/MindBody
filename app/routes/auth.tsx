import { Link, useNavigate, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { AuthUtils, validateEmail, validatePassword } from "../utils/auth";

// Tab title — without this, /auth shows blank in browser tab + history.
// SEO + UX (audit P2).
export function meta() {
    return [{ title: "Вхід / Реєстрація | MIND BODY" }];
}

type AuthMode = "login" | "register";

export default function Auth() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Atom C: respect ?redirect=... so deep-linked pages (e.g.
    // /profile or /checkout) return the user there after login.
    // Whitelist relative paths only to prevent open-redirect.
    const redirectTo = (() => {
        const r = searchParams.get("redirect");
        return r && r.startsWith("/") && !r.startsWith("//") ? r : "/profile";
    })();
    const [mode, setMode] = useState<AuthMode>("login");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [agreeTerms, setAgreeTerms] = useState(false);
    // Phase 7e: password reveal toggle (audit P0 — mobile users can't
    // verify what they typed on a soft keyboard without it).
    const [showPassword, setShowPassword] = useState(false);

    // Atom D: per-field validation errors (Ukrainian).  Populated
    // onBlur so the user sees their typo immediately, not after
    // submit.  Empty string = no error.
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const validateField = (id: string, value: string): string => {
        if (id === "email") {
            if (!value.trim()) return "Введіть email";
            if (!validateEmail(value)) return "Невірний формат email";
        }
        if (id === "password" && value && mode === "register") {
            const check = validatePassword(value);
            if (!check.valid) return check.message;
        }
        if (id === "confirmPassword" && value && value !== password) {
            return "Паролі не співпадають";
        }
        if (id === "name" && mode === "register" && !value.trim()) {
            return "Введіть ваше ім'я";
        }
        return "";
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFieldErrors((prev) => ({ ...prev, [id]: validateField(id, value) }));
    };

    // Check if already logged in
    useEffect(() => {
        const checkAuth = async () => {
            const authState = await AuthUtils.getAuthStateAsync();
            if (authState.isAuthenticated) {
                navigate(redirectTo);
            }
        };
        checkAuth();
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setIsLoading(true);

        try {
            if (mode === "login") {
                const result = await AuthUtils.login(email, password);
                if (result.success) {
                    setSuccess(result.message);
                    setTimeout(() => navigate(redirectTo), 1000);
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
                    setError("Невірний формат email");
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
                    setError("Паролі не співпадають");
                    setIsLoading(false);
                    return;
                }

                if (!agreeTerms) {
                    setError("Необхідно погодитися з умовами");
                    setIsLoading(false);
                    return;
                }

                const result = await AuthUtils.register(name, email, password, phone);
                if (result.success) {
                    setSuccess(result.message);
                    setTimeout(() => navigate(redirectTo), 1500);
                } else {
                    setError(result.message);
                }
            }
        } catch (err) {
            setError("Сталася помилка. Спробуйте ще раз.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError("");

        try {
            const result = await AuthUtils.loginWithGoogle();
            if (result.success) {
                setSuccess(result.message);
                // Will redirect to Google — no manual navigation needed
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError("Помилка входу через Google");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Введіть email для відновлення паролю");
            return;
        }
        setIsLoading(true);
        setError("");
        const result = await AuthUtils.resetPassword(email);
        if (result.success) {
            setSuccess(result.message);
        } else {
            setError(result.message);
        }
        setIsLoading(false);
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setError("");
        setSuccess("");
    };

    return (
        <main className="auth-page">
            {/* Hero Section */}
            <section className="auth-hero">
                <div className="container">
                    <nav className="breadcrumb">
                        <Link to="/">Головна</Link>
                        <span>/</span>
                        <span className="active">{mode === "login" ? "Вхід" : "Реєстрація"}</span>
                    </nav>
                    <h1 className="auth-hero__title">
                        {mode === "login" ? (
                            <>
                                Вхід в <em>акаунт</em>
                            </>
                        ) : (
                            <>
                                Створити <em>акаунт</em>
                            </>
                        )}
                    </h1>
                    <p className="auth-hero__subtitle">
                        {mode === "login"
                            ? "Увійдіть, щоб отримати доступ до вашого особистого кабінету"
                            : "Приєднуйтесь до MIND BODY та отримуйте ексклюзивні пропозиції"}
                    </p>
                </div>
            </section>

            {/* Auth Form Section */}
            <section className="auth-content">
                <div className="container">
                    <div className="auth-card">
                        {/* Mode Tabs */}
                        <div className="auth-tabs" role="tablist" aria-label="Вхід або реєстрація">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === "login"}
                                aria-controls="auth-panel"
                                className={`auth-tab ${mode === "login" ? "active" : ""}`}
                                onClick={() => switchMode("login")}
                            >
                                Вхід
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === "register"}
                                aria-controls="auth-panel"
                                className={`auth-tab ${mode === "register" ? "active" : ""}`}
                                onClick={() => switchMode("register")}
                            >
                                Реєстрація
                            </button>
                        </div>

                        {/* Error/Success Messages */}
                        {error && (
                            <div className="auth-message auth-message--error">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="auth-message auth-message--success">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
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
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            {mode === "login"
                                ? "Увійти через Google"
                                : "Зареєструватися через Google"}
                        </button>

                        <div className="auth-divider">
                            <span>або</span>
                        </div>

                        {/* Form */}
                        <form
                            id="auth-panel"
                            role="tabpanel"
                            className="auth-form"
                            onSubmit={handleSubmit}
                        >
                            {mode === "register" && (
                                <div className="form-group">
                                    <label htmlFor="name">Ім'я та прізвище</label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onBlur={handleBlur}
                                        placeholder="Ваше повне ім'я"
                                        autoComplete="name"
                                        aria-invalid={!!fieldErrors.name}
                                        aria-describedby={
                                            fieldErrors.name ? "name-error" : undefined
                                        }
                                        required
                                    />
                                    {fieldErrors.name && (
                                        <span
                                            id="name-error"
                                            className="field-error-text"
                                            role="alert"
                                        >
                                            {fieldErrors.name}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={handleBlur}
                                    placeholder="email@example.com"
                                    autoComplete="email"
                                    inputMode="email"
                                    aria-invalid={!!fieldErrors.email}
                                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                                    required
                                />
                                {fieldErrors.email && (
                                    <span
                                        id="email-error"
                                        className="field-error-text"
                                        role="alert"
                                    >
                                        {fieldErrors.email}
                                    </span>
                                )}
                            </div>

                            {mode === "register" && (
                                <div className="form-group">
                                    <label htmlFor="phone">Телефон (необов'язково)</label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+380 XX XXX XX XX"
                                        autoComplete="tel"
                                        inputMode="tel"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="password">Пароль</label>
                                <div className="password-input-wrap">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onBlur={handleBlur}
                                        placeholder="••••••••"
                                        autoComplete={
                                            mode === "register"
                                                ? "new-password"
                                                : "current-password"
                                        }
                                        aria-invalid={!!fieldErrors.password}
                                        aria-describedby={
                                            fieldErrors.password ? "password-error" : undefined
                                        }
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="password-reveal-btn"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={
                                            showPassword ? "Приховати пароль" : "Показати пароль"
                                        }
                                        aria-pressed={showPassword}
                                    >
                                        {showPassword ? (
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                width="20"
                                                height="20"
                                                aria-hidden="true"
                                            >
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                width="20"
                                                height="20"
                                                aria-hidden="true"
                                            >
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {fieldErrors.password && (
                                    <span
                                        id="password-error"
                                        className="field-error-text"
                                        role="alert"
                                    >
                                        {fieldErrors.password}
                                    </span>
                                )}
                                {mode === "register" && !fieldErrors.password && (
                                    <span className="form-hint">
                                        Мінімум 6 символів, включаючи цифру
                                    </span>
                                )}
                            </div>

                            {mode === "register" && (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="confirmPassword">Підтвердіть пароль</label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            onBlur={handleBlur}
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            aria-invalid={!!fieldErrors.confirmPassword}
                                            aria-describedby={
                                                fieldErrors.confirmPassword
                                                    ? "confirmPassword-error"
                                                    : undefined
                                            }
                                            required
                                        />
                                        {fieldErrors.confirmPassword && (
                                            <span
                                                id="confirmPassword-error"
                                                className="field-error-text"
                                                role="alert"
                                            >
                                                {fieldErrors.confirmPassword}
                                            </span>
                                        )}
                                    </div>

                                    <label className="auth-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={agreeTerms}
                                            onChange={(e) => setAgreeTerms(e.target.checked)}
                                        />
                                        <span className="checkmark"></span>
                                        <span>
                                            Я погоджуюся з{" "}
                                            <Link to="/terms" target="_blank">
                                                умовами використання
                                            </Link>{" "}
                                            та{" "}
                                            <Link to="/privacy" target="_blank">
                                                політикою конфіденційності
                                            </Link>
                                        </span>
                                    </label>
                                </>
                            )}

                            {mode === "login" && (
                                <div className="auth-forgot">
                                    <a href="#" onClick={handleForgotPassword}>
                                        Забули пароль?
                                    </a>
                                </div>
                            )}

                            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="auth-loading">
                                        <span className="spinner"></span>
                                        Зачекайте...
                                    </span>
                                ) : mode === "login" ? (
                                    "Увійти"
                                ) : (
                                    "Зареєструватися"
                                )}
                            </button>
                        </form>

                        {/* Switch Mode Link */}
                        <p className="auth-switch">
                            {mode === "login" ? (
                                <>
                                    Ще немає акаунту?{" "}
                                    <button onClick={() => switchMode("register")}>
                                        Зареєструватися
                                    </button>
                                </>
                            ) : (
                                <>
                                    Вже маєте акаунт?{" "}
                                    <button onClick={() => switchMode("login")}>Увійти</button>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}
