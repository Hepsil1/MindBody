import { Link, useSearchParams } from "react-router";

export interface SortableThProps {
    /** Sort key — must match a key in the route's ListSpec.sortable. */
    field: string;
    label: string;
    state: { sort: string; dir: "asc" | "desc" };
    align?: "left" | "right";
}

/** Table header cell that toggles sort/direction via a GET link (keeps the list
 *  state in the URL). Clicking a new column starts ascending; clicking the
 *  active column flips direction. Resets to page 1. */
export function SortableTh({ field, label, state, align = "left" }: SortableThProps) {
    const [sp] = useSearchParams();
    const active = state.sort === field;
    const nextDir = active && state.dir === "asc" ? "desc" : "asc";

    const params = new URLSearchParams(sp);
    params.set("sort", field);
    params.set("dir", active ? nextDir : "asc");
    params.delete("page");

    const indicator = active ? (state.dir === "asc" ? "↑" : "↓") : "↕";

    return (
        <th style={{ textAlign: align }}>
            <Link
                to={`?${params.toString()}`}
                preventScrollReset
                style={{
                    color: "inherit",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                }}
            >
                {label}
                <span style={{ opacity: active ? 1 : 0.35, fontSize: "11px" }}>{indicator}</span>
            </Link>
        </th>
    );
}
