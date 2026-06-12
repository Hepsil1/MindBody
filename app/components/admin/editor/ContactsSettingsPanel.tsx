import { useEffect, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { ContactsSettings } from "../../../utils/site-settings";

interface ContactsSettingsPanelProps {
    contacts: ContactsSettings;
    fetcher: FetcherWithComponents<unknown>;
}

const FIELDS: Array<{
    name: keyof ContactsSettings;
    label: string;
    hint?: string;
    placeholder?: string;
}> = [
    {
        name: "phoneDisplay",
        label: "Телефон (як відображається)",
        hint: "Шапка сайту, футер, сторінка контактів",
        placeholder: "+38 (096) 665-08-55",
    },
    {
        name: "phoneTel",
        label: "Телефон для дзвінка (tel:)",
        hint: "Лише цифри та +, без пробілів — куди реально дзвонить кнопка",
        placeholder: "+380966650855",
    },
    {
        name: "hoursLabel",
        label: "Графік підтримки",
        placeholder: "Пн–Пт · 9:00–18:00",
    },
    {
        name: "instagramUrl",
        label: "Instagram (повне посилання)",
        placeholder: "https://instagram.com/...",
    },
    {
        name: "telegramUrl",
        label: "Telegram (повне посилання)",
        hint: "Використовується у футері та плаваючому віджеті",
        placeholder: "https://t.me/...",
    },
    {
        name: "viberPhone",
        label: "Viber (лише цифри)",
        placeholder: "380509656737",
    },
    {
        name: "whatsappPhone",
        label: "WhatsApp (лише цифри)",
        placeholder: "380973542848",
    },
];

/**
 * "Налаштування → Контакти" — edits the single source of truth for every
 * phone/messenger/hours string on the storefront (header top-bar, footer,
 * floating widget, contacts page). Submits intent "update_site_settings"
 * (key=contacts); the server Zod-validates before persisting.
 */
export function ContactsSettingsPanel({ contacts, fetcher }: ContactsSettingsPanelProps) {
    const [form, setForm] = useState<ContactsSettings>(contacts);
    const dirty = JSON.stringify(form) !== JSON.stringify(contacts);
    const saving = fetcher.state !== "idle";

    // Re-sync local state when the SAVED value changes (loader revalidates
    // after a successful save). Keyed on content, not object identity — the
    // loader returns a fresh object every render, so an identity dep would
    // clobber in-progress typing. Without this, the server's canonical form
    // (e.g. Zod-trimmed strings) diverges from local state and the «Є
    // незбережені зміни» badge sticks after the first save.
    const contactsKey = JSON.stringify(contacts);
    useEffect(() => {
        setForm(JSON.parse(contactsKey));
    }, [contactsKey]);

    const save = () => {
        const fd = new FormData();
        fd.append("intent", "update_site_settings");
        fd.append("key", "contacts");
        fd.append("value", JSON.stringify(form));
        fetcher.submit(fd, { method: "post" });
    };

    return (
        <div
            className="custom-scrollbar"
            style={{ height: "100%", overflowY: "auto", background: "#0a0c10" }}
        >
            <div style={{ maxWidth: "620px", margin: "0 auto", padding: "40px 24px 80px" }}>
                <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>
                    Контакти магазину
                </h2>
                <p
                    style={{
                        color: "#64748b",
                        fontSize: "13px",
                        margin: "0 0 28px",
                        lineHeight: 1.6,
                    }}
                >
                    Єдине джерело для телефону, графіка і месенджерів — шапка сайту, футер,
                    плаваючий віджет і сторінка «Контакти» оновлюються разом.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {FIELDS.map((f) => (
                        <div key={f.name}>
                            <label
                                htmlFor={`contacts-${f.name}`}
                                style={{
                                    display: "block",
                                    fontSize: "12px",
                                    color: "#94a3b8",
                                    marginBottom: "6px",
                                    fontWeight: 600,
                                }}
                            >
                                {f.label}
                            </label>
                            <input
                                id={`contacts-${f.name}`}
                                value={form[f.name]}
                                placeholder={f.placeholder}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                                }
                                style={{
                                    width: "100%",
                                    background: "#16191f",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    color: "#fff",
                                    padding: "11px 14px",
                                    borderRadius: 10,
                                    fontSize: "14px",
                                }}
                            />
                            {f.hint && (
                                <small
                                    style={{
                                        display: "block",
                                        marginTop: "4px",
                                        fontSize: "11px",
                                        color: "#64748b",
                                    }}
                                >
                                    {f.hint}
                                </small>
                            )}
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        marginTop: "28px",
                    }}
                >
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !dirty}
                        style={{
                            padding: "12px 32px",
                            borderRadius: "12px",
                            background: "var(--accent-primary)",
                            color: "#000",
                            border: "none",
                            cursor: saving || !dirty ? "default" : "pointer",
                            fontWeight: 700,
                            fontSize: "14px",
                            opacity: saving || !dirty ? 0.5 : 1,
                        }}
                    >
                        {saving ? "Збереження…" : "Зберегти контакти"}
                    </button>
                    {dirty && !saving && (
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                            Є незбережені зміни
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
