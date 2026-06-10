import type { FetcherWithComponents } from "react-router";
import type { NavFeaturedSettings } from "../../../utils/site-settings";
import { SHOP_PAGE_OPTIONS } from "../../../utils/shop-pages";
import { FilePickerField } from "../FilePickerField";

interface NavFeaturedPanelProps {
    navFeatured: NavFeaturedSettings;
    fetcher: FetcherWithComponents<unknown>;
}

/**
 * "Налаштування → Мега-меню" — edits the featured card (image + badge + title)
 * shown in each top-level category's hover panel. Multipart form: a new image
 * per category is optional (the current one is kept when no file is chosen),
 * via intent "update_nav_featured" which uploads files and Zod-validates the
 * resulting map before persisting.
 */
export function NavFeaturedPanel({ navFeatured, fetcher }: NavFeaturedPanelProps) {
    const saving = fetcher.state !== "idle";

    return (
        <div
            className="custom-scrollbar"
            style={{ height: "100%", overflowY: "auto", background: "#0a0c10" }}
        >
            <fetcher.Form
                method="post"
                encType="multipart/form-data"
                style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px 80px" }}
            >
                <input type="hidden" name="intent" value="update_nav_featured" />

                <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>
                    Картки мега-меню
                </h2>
                <p
                    style={{
                        color: "#64748b",
                        fontSize: "13px",
                        margin: "0 0 28px",
                        lineHeight: 1.6,
                    }}
                >
                    Велике фото, бейдж і назва, що показуються у випадному меню кожної категорії при
                    наведенні. Нове фото — за бажанням; без вибору файлу лишається поточне.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {SHOP_PAGE_OPTIONS.map((opt) => {
                        const slug = opt.slug;
                        const item = navFeatured.items[slug];
                        return (
                            <div
                                key={slug}
                                style={{
                                    background: "#16191f",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: "14px",
                                    padding: "18px",
                                    display: "flex",
                                    gap: "16px",
                                }}
                            >
                                <div style={{ flexShrink: 0 }}>
                                    <div
                                        style={{
                                            width: 84,
                                            height: 105,
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "#000",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                        }}
                                    >
                                        {item?.image && (
                                            <img
                                                src={item.image}
                                                alt=""
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: "11px",
                                            textTransform: "uppercase",
                                            letterSpacing: "1px",
                                            color: "var(--accent-primary)",
                                            fontWeight: 700,
                                            marginBottom: "12px",
                                        }}
                                    >
                                        {opt.title}
                                    </div>
                                    <input
                                        type="hidden"
                                        name={`${slug}_currentImage`}
                                        value={item?.image ?? ""}
                                    />
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "10px",
                                        }}
                                    >
                                        <FilePickerField
                                            name={`${slug}_image_file`}
                                            label="Замінити фото"
                                        />
                                        <input
                                            name={`${slug}_title`}
                                            defaultValue={item?.title ?? ""}
                                            placeholder="Назва (напр. Yoga Колекція)"
                                            aria-label={`Назва картки ${opt.title}`}
                                            style={inputStyle}
                                        />
                                        <input
                                            name={`${slug}_badge`}
                                            defaultValue={item?.badge ?? ""}
                                            placeholder="Бейдж (необов'язково, напр. YOGA)"
                                            aria-label={`Бейдж картки ${opt.title}`}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        marginTop: "26px",
                        padding: "12px 32px",
                        borderRadius: "12px",
                        background: "var(--accent-primary)",
                        color: "#000",
                        border: "none",
                        cursor: saving ? "default" : "pointer",
                        fontWeight: 700,
                        fontSize: "14px",
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    {saving ? "Збереження…" : "Зберегти картки"}
                </button>
            </fetcher.Form>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0a0c10",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 9,
    fontSize: "13px",
};
