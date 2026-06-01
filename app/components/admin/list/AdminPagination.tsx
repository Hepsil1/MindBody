import { Link, useSearchParams } from "react-router";

/** Structural shape of paginate()'s result (kept local to avoid importing the
 *  .server module into client code). */
export interface PageInfo {
    page: number;
    pageCount: number;
    from: number;
    to: number;
    total: number;
    hasPrev: boolean;
    hasNext: boolean;
}

/** Prev/next pager with an "N–M of T" summary. Preserves all other params. */
export function AdminPagination({ page }: { page: PageInfo }) {
    const [sp] = useSearchParams();
    if (page.total === 0) return null;

    const linkTo = (p: number) => {
        const params = new URLSearchParams(sp);
        params.set("page", String(p));
        return `?${params.toString()}`;
    };

    const btn: React.CSSProperties = {
        padding: "8px 14px",
        borderRadius: "9px",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "var(--text-main)",
        textDecoration: "none",
        fontSize: "13px",
    };
    const btnDisabled: React.CSSProperties = {
        ...btn,
        color: "var(--text-muted)",
        opacity: 0.4,
        cursor: "default",
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
            }}
        >
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                {page.from}–{page.to} з {page.total}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {page.hasPrev ? (
                    <Link to={linkTo(page.page - 1)} preventScrollReset style={btn}>
                        ← Назад
                    </Link>
                ) : (
                    <span style={btnDisabled}>← Назад</span>
                )}
                <span style={{ color: "var(--text-muted)", fontSize: "13px", padding: "0 4px" }}>
                    {page.page} / {page.pageCount}
                </span>
                {page.hasNext ? (
                    <Link to={linkTo(page.page + 1)} preventScrollReset style={btn}>
                        Далі →
                    </Link>
                ) : (
                    <span style={btnDisabled}>Далі →</span>
                )}
            </div>
        </div>
    );
}
