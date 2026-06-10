import { useRef, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { Category } from "@prisma/client";
import { ChevronDown, CloseIcon } from "../AdminIcons";
import { ImageCropSelector } from "../ImageCropSelector";
import { useModalA11y } from "../useModalA11y";

/* moodType is a raw-SQL column (Windows query-engine DLL gotcha) — the local
   generated client may predate it, so widen the row type structurally. */
type CategoryRow = Category & { moodType?: string | null; imagePos?: string | null };

interface CategoryManagerPanelProps {
    categories: CategoryRow[];
    fetcher: FetcherWithComponents<unknown>;
    onClose: () => void;
}

/**
 * Home category-card manager — right-side dark panel of the visual editor
 * (accordion row per category with the edit form inside). Extracted 1:1 from
 * app/routes/admin/slides.tsx (SE1). Submits intent "update_category" through
 * the editor's shared fetcher.
 */
export function CategoryManagerPanel({ categories, fetcher, onClose }: CategoryManagerPanelProps) {
    const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
    // Focal-point edits keyed `${categoryId}_${field}` — local until the form posts.
    const [positions, setPositions] = useState<Record<string, string>>({});
    const updatePos = (id: string, field: string, value: string) => {
        setPositions((prev) => ({ ...prev, [`${id}_${field}`]: value }));
    };

    // ESC closes, Tab trapped, focus restored to the opener.
    const dialogRef = useRef<HTMLDivElement>(null);
    useModalA11y(dialogRef, onClose);

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Редагування категорій"
            style={{
                position: "fixed",
                top: "24px",
                right: "24px",
                width: "420px",
                maxHeight: "calc(100vh - 48px)",
                background: "#0f1216",
                borderRadius: "16px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                zIndex: 2000,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h2 style={{ fontSize: "16px", fontWeight: 500, margin: 0, color: "#fff" }}>
                    Редагування категорій
                </h2>
                <button
                    onClick={onClose}
                    aria-label="Закрити"
                    style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        padding: 4,
                    }}
                >
                    <CloseIcon />
                </button>
            </div>

            <div
                className="custom-scrollbar"
                style={{ flex: 1, overflowY: "auto", padding: "24px" }}
            >
                {categories.length === 0 && (
                    <div
                        style={{
                            padding: "12px 14px",
                            background: "rgba(94, 234, 212, 0.07)",
                            border: "1px solid rgba(94, 234, 212, 0.25)",
                            borderRadius: "10px",
                            color: "#9fe8d8",
                            fontSize: "12.5px",
                            lineHeight: 1.5,
                            marginBottom: "16px",
                        }}
                    >
                        Категорій у базі немає — на головній показуються стандартні картки. Додайте
                        категорії в розділі «Категорії» адмін-панелі.
                    </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {categories.map((cat) => (
                        <div
                            key={cat.id}
                            style={{
                                background: "#16191f",
                                border: "1px solid rgba(255,255,255,0.05)",
                                borderRadius: "12px",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                onClick={() =>
                                    setExpandedCategoryId(
                                        expandedCategoryId === cat.id ? null : cat.id,
                                    )
                                }
                                style={{
                                    padding: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "14px",
                                    cursor: "pointer",
                                }}
                            >
                                <div
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 6,
                                        background: "#000",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                    }}
                                >
                                    <img
                                        src={cat.image}
                                        alt=""
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}
                                    >
                                        {cat.title}
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: "12px" }}>
                                        {cat.subtitle}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        color:
                                            expandedCategoryId === cat.id
                                                ? "var(--accent-primary)"
                                                : "#64748b",
                                        transform:
                                            expandedCategoryId === cat.id
                                                ? "rotate(180deg)"
                                                : "none",
                                        transition: "0.2s",
                                    }}
                                >
                                    <ChevronDown />
                                </div>
                            </div>

                            {expandedCategoryId === cat.id && (
                                <div
                                    style={{
                                        padding: "0 16px 16px",
                                        borderTop: "1px solid rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <fetcher.Form
                                        method="post"
                                        encType="multipart/form-data"
                                        style={{
                                            paddingTop: "16px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "12px",
                                        }}
                                    >
                                        <input
                                            type="hidden"
                                            name="intent"
                                            value="update_category"
                                        />
                                        <input type="hidden" name="id" value={cat.id} />

                                        <div>
                                            <label
                                                style={{
                                                    display: "block",
                                                    fontSize: "11px",
                                                    color: "#64748b",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                Назва (Головна)
                                            </label>
                                            <input
                                                name="title"
                                                defaultValue={cat.title}
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    fontSize: "13px",
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label
                                                style={{
                                                    display: "block",
                                                    fontSize: "11px",
                                                    color: "#64748b",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                Підзаголовок
                                            </label>
                                            <input
                                                name="subtitle"
                                                defaultValue={cat.subtitle ?? ""}
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    fontSize: "13px",
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label
                                                style={{
                                                    display: "block",
                                                    fontSize: "11px",
                                                    color: "#64748b",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                Текст кнопки
                                            </label>
                                            <input
                                                name="buttonText"
                                                defaultValue={cat.buttonText}
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    fontSize: "13px",
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label
                                                style={{
                                                    display: "block",
                                                    fontSize: "11px",
                                                    color: "#64748b",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                Посилання
                                            </label>
                                            <input
                                                name="link"
                                                defaultValue={cat.link}
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    fontSize: "13px",
                                                }}
                                            />
                                        </div>

                                        {/* Batch 41: mood dropdown — pilot ships YOGA only;
                                            остальные mood-варианты будут включены в Batch 42+
                                            после визуальной валидации на проде. */}
                                        <div>
                                            <label
                                                style={{
                                                    display: "block",
                                                    fontSize: "11px",
                                                    color: "#64748b",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                Mood (опціонально)
                                            </label>
                                            <select
                                                name="moodType"
                                                defaultValue={cat.moodType || ""}
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    fontSize: "13px",
                                                }}
                                            >
                                                <option value="">
                                                    Без mood (стандартний вигляд)
                                                </option>
                                                <option value="yoga">
                                                    Yoga — calm teal, light Cormorant
                                                </option>
                                                <option value="sport" disabled>
                                                    Sport (скоро)
                                                </option>
                                                <option value="dance" disabled>
                                                    Dance (скоро)
                                                </option>
                                                <option value="casual" disabled>
                                                    Casual (скоро)
                                                </option>
                                                <option value="kids" disabled>
                                                    Kids (скоро)
                                                </option>
                                            </select>
                                            <small
                                                style={{
                                                    display: "block",
                                                    marginTop: "4px",
                                                    fontSize: "10px",
                                                    color: "#64748b",
                                                }}
                                            >
                                                Yoga додає легкий теал-tint та витончений Cormorant
                                                — у дусі Sézane / Cuyana.
                                            </small>
                                        </div>

                                        <ImageCropSelector
                                            currentImageUrl={cat.image}
                                            fileInputName="image_file"
                                            value={
                                                positions[`${cat.id}_imagePos`] ||
                                                cat.imagePos ||
                                                "center center"
                                            }
                                            onChange={(val: string) =>
                                                updatePos(cat.id, "imagePos", val)
                                            }
                                            aspectRatio="400/380"
                                            overlay={
                                                <>
                                                    <div
                                                        className="category-card__overlay"
                                                        style={{
                                                            pointerEvents: "none",
                                                            position: "absolute",
                                                            inset: 0,
                                                            zIndex: 2,
                                                        }}
                                                    ></div>
                                                    <div
                                                        className="category-card__content"
                                                        style={{
                                                            pointerEvents: "none",
                                                            position: "absolute",
                                                            inset: 0,
                                                            zIndex: 3,
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            justifyContent: "flex-end",
                                                            padding: "40px",
                                                            textAlign: "left",
                                                        }}
                                                    >
                                                        <p
                                                            className="category-card__count"
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "12px",
                                                                fontSize: "13px",
                                                                letterSpacing: "0.2em",
                                                                textTransform: "uppercase",
                                                                margin: 0,
                                                            }}
                                                        >
                                                            {cat.subtitle || "ДЛЯ ВАС"}
                                                        </p>
                                                        <h3
                                                            className="category-card__title"
                                                            style={{
                                                                fontSize: "32px",
                                                                marginBottom: "8px",
                                                                textTransform: "uppercase",
                                                                marginTop: "8px",
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {cat.title}
                                                        </h3>
                                                        <div
                                                            className="category-card__shop-now"
                                                            style={{
                                                                marginTop: "24px",
                                                                fontSize: "11px",
                                                                fontWeight: 700,
                                                                textTransform: "uppercase",
                                                                padding: "12px 28px",
                                                                background:
                                                                    "rgba(255, 255, 255, 0.15)",
                                                                backdropFilter: "blur(12px)",
                                                                width: "fit-content",
                                                                borderRadius: "30px",
                                                                border: "1px solid rgba(255, 255, 255, 0.3)",
                                                                opacity: 1,
                                                                transform: "none",
                                                            }}
                                                        >
                                                            {cat.buttonText || "Переглянути все"}
                                                        </div>
                                                    </div>
                                                </>
                                            }
                                        />
                                        <input type="hidden" name="image_url" value={cat.image} />
                                        <input
                                            type="hidden"
                                            name="imagePos"
                                            value={
                                                positions[`${cat.id}_imagePos`] ||
                                                cat.imagePos ||
                                                "center center"
                                            }
                                        />

                                        <button
                                            type="submit"
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                background: "var(--accent-primary)",
                                                color: "#000",
                                                border: "none",
                                                borderRadius: 8,
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                marginTop: "4px",
                                            }}
                                        >
                                            {fetcher.state === "submitting"
                                                ? "Збереження..."
                                                : "Зберегти зміни"}
                                        </button>
                                    </fetcher.Form>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
