import { Form, useSearchParams } from "react-router";

export interface AdminToolbarProps {
    /** Search + filter controls — rendered inside a GET <Form>. */
    children: React.ReactNode;
    /** Params to preserve across submits (e.g. a non-default perPage). `page` is
     *  intentionally never included, so changing a filter resets to page 1. */
    hidden?: Record<string, string>;
    /** Right-aligned actions outside the form (e.g. an "Add" button). */
    right?: React.ReactNode;
}

/** Toolbar wrapper: a GET form holding the list's search/filter controls, plus
 *  an optional right-aligned action slot. */
export function AdminToolbar({ children, hidden, right }: AdminToolbarProps) {
    const [searchParams] = useSearchParams();
    // Preserve the active sort across search/filter submits — this GET form
    // replaces the whole query string, which would otherwise reset the user's
    // column sort to default. `page` stays dropped on purpose (resets to 1).
    const preserved: Record<string, string> = {};
    for (const key of ["sort", "dir"]) {
        const v = searchParams.get(key);
        if (v && hidden?.[key] === undefined) preserved[key] = v;
    }
    const allHidden: Record<string, string> = { ...preserved, ...(hidden ?? {}) };

    return (
        <div
            style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
                flexWrap: "wrap",
            }}
        >
            <Form
                method="get"
                style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    flex: 1,
                }}
            >
                {Object.entries(allHidden).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                ))}
                {children}
            </Form>
            {right && <div style={{ display: "flex", gap: "12px" }}>{right}</div>}
        </div>
    );
}
