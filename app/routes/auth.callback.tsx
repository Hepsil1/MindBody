import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AuthUtils } from "../utils/auth";

/**
 * OAuth Callback Route — handles redirect from Google OAuth.
 * Processes the callback and syncs the user session.
 */
export default function AuthCallback() {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const result = await AuthUtils.handleOAuthCallback();

                if (result.success) {
                    navigate('/profile', { replace: true });
                } else {
                    setError('Помилка авторизації. Спробуйте ще раз.');
                    setTimeout(() => navigate('/auth', { replace: true }), 3000);
                }
            } catch (e) {
                console.error('OAuth callback error:', e);
                setError('Несподівана помилка. Перенаправлення...');
                setTimeout(() => navigate('/auth', { replace: true }), 3000);
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <main style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            flexDirection: 'column',
            gap: '16px'
        }}>
            {error ? (
                <>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
                        {error}
                    </p>
                </>
            ) : (
                <>
                    <div className="spinner" style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid var(--color-border)',
                        borderTopColor: 'var(--color-primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
                        Завершуємо авторизацію...
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
            )}
        </main>
    );
}
