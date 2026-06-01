import { useSubmit } from "react-router";

export interface FilterOption {
    value: string;
    label: string;
}

export interface FilterSelectProps {
    name: string;
    /** Current value from loader state. */
    value: string;
    options: FilterOption[];
    /** Label for the "no filter" option, e.g. "Всі статуси". */
    allLabel: string;
}

/**
 * Dropdown filter that submits its enclosing GET <Form> on change. Uncontrolled
 * (defaultValue) for instant feedback; `key` ties it to the current value so an
 * external reset (clear filters) remounts it with the right selection.
 */
export function FilterSelect({ name, value, options, allLabel }: FilterSelectProps) {
    const submit = useSubmit();
    return (
        <select
            key={`${name}:${value}`}
            name={name}
            defaultValue={value}
            aria-label={allLabel}
            onChange={(e) => {
                const form = e.currentTarget.form;
                if (form) submit(form, { method: "get", replace: true });
            }}
            style={{
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "var(--text-main)",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer",
            }}
        >
            <option value="">{allLabel}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
