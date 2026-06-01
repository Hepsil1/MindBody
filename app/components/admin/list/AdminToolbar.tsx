import { Form } from "react-router";

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
                {hidden &&
                    Object.entries(hidden).map(([k, v]) => (
                        <input key={k} type="hidden" name={k} value={v} />
                    ))}
                {children}
            </Form>
            {right && <div style={{ display: "flex", gap: "12px" }}>{right}</div>}
        </div>
    );
}
