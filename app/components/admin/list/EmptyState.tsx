export interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    /** Optional CTA, e.g. an "Add" link or a "Clear filters" button. */
    action?: React.ReactNode;
}

/** Centered empty state for lists with no rows (or no matches for a filter). */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="admin-card" style={{ padding: "64px 32px", textAlign: "center" }}>
            {icon && (
                <div style={{ color: "var(--text-muted)", margin: "0 auto 16px", lineHeight: 0 }}>
                    {icon}
                </div>
            )}
            <div
                style={{
                    color: "var(--text-main)",
                    fontWeight: 600,
                    marginBottom: "8px",
                    fontSize: "16px",
                }}
            >
                {title}
            </div>
            {description && (
                <div
                    style={{
                        color: "var(--text-muted)",
                        fontSize: "14px",
                        maxWidth: "380px",
                        margin: "0 auto",
                    }}
                >
                    {description}
                </div>
            )}
            {action && <div style={{ marginTop: "20px" }}>{action}</div>}
        </div>
    );
}
