/** Shimmer placeholder rows for a table's initial load. Render as the <tbody>. */
export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <tbody>
            {Array.from({ length: rows }).map((_, r) => (
                <tr key={r}>
                    {Array.from({ length: cols }).map((_, c) => (
                        <td key={c}>
                            <div
                                className="admin-skeleton"
                                style={{ height: "14px", width: c === 0 ? "60%" : "45%" }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
}
