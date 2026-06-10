import { useEffect, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { Slide } from "@prisma/client";
import { TrashIcon, ChevronDown, CloseIcon } from "../AdminIcons";
import { ImageCropSelector } from "../ImageCropSelector";

interface SlideManagerPanelProps {
    slides: Slide[];
    fetcher: FetcherWithComponents<unknown>;
    onClose: () => void;
}

/**
 * Home hero-slide manager — the right-side dark panel of the visual editor
 * (list + expandable edit form per slide + "add new" form). Extracted 1:1
 * from app/routes/admin/slides.tsx (SE1); owns its expansion/position state.
 * Submits through the editor's shared fetcher (intents: create/update/delete).
 */
export function SlideManagerPanel({ slides, fetcher, onClose }: SlideManagerPanelProps) {
    const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
    const [newSlideType, setNewSlideType] = useState<"triptych" | "single">("triptych");
    // Focal-point edits keyed `${slideId}_${field}` — local until the form posts.
    const [positions, setPositions] = useState<Record<string, string>>({});
    const updatePos = (id: string, field: string, value: string) => {
        setPositions((prev) => ({ ...prev, [`${id}_${field}`]: value }));
    };

    // Reset the create form only after the server confirms success (the action
    // returns ActionResult — `ok`, not the legacy `success`).
    useEffect(() => {
        if (fetcher.state !== "idle") return;
        const res = fetcher.data as { ok?: boolean } | undefined;
        if (res?.ok) {
            (document.getElementById("create-slide-form") as HTMLFormElement)?.reset();
        }
    }, [fetcher.state, fetcher.data]);

    const toggleSlide = (id: string) => {
        setExpandedSlideId((prev) => (prev === id ? null : id));
    };

    return (
        <div
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
            {/* Header */}
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
                    Управління слайдами
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
                {/* Active Slides List */}
                <div style={{ marginBottom: "32px" }}>
                    <div
                        style={{
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            color: "#64748b",
                            marginBottom: "16px",
                            fontWeight: 600,
                        }}
                    >
                        Активні слайди ({slides.length})
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {slides.map((slide) => (
                            <div
                                key={slide.id}
                                style={{
                                    background: "#16191f",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                }}
                            >
                                {/* Row Header */}
                                <div
                                    style={{
                                        padding: "12px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "14px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 8,
                                            background: "#000",
                                            overflow: "hidden",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <img
                                            src={slide.image1}
                                            alt=""
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                color: "#fff",
                                                fontSize: "14px",
                                                fontWeight: 500,
                                                marginBottom: 2,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {slide.name}
                                        </div>
                                        <div style={{ color: "#64748b", fontSize: "12px" }}>
                                            {slide.type === "triptych"
                                                ? "3 фото (триптих)"
                                                : "1 фото (full)"}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            onClick={() => toggleSlide(slide.id)}
                                            aria-label={
                                                expandedSlideId === slide.id
                                                    ? "Згорнути слайд"
                                                    : "Редагувати слайд"
                                            }
                                            style={{
                                                width: 32,
                                                height: 32,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background: "none",
                                                border: "none",
                                                color:
                                                    expandedSlideId === slide.id
                                                        ? "var(--accent-primary)"
                                                        : "#64748b",
                                                cursor: "pointer",
                                                transform:
                                                    expandedSlideId === slide.id
                                                        ? "rotate(180deg)"
                                                        : "rotate(0)",
                                                transition: "transform 0.2s",
                                            }}
                                        >
                                            <ChevronDown />
                                        </button>

                                        <fetcher.Form
                                            method="post"
                                            onSubmit={(e) => {
                                                if (!confirm("Видалити слайд?")) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        >
                                            <input type="hidden" name="intent" value="delete" />
                                            <input type="hidden" name="id" value={slide.id} />
                                            <button
                                                type="submit"
                                                aria-label="Видалити слайд"
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: "rgba(255,80,80,0.1)",
                                                    border: "none",
                                                    borderRadius: 8,
                                                    color: "#ff6b6b",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <TrashIcon />
                                            </button>
                                        </fetcher.Form>
                                    </div>
                                </div>

                                {/* Expanded Edit Form */}
                                {expandedSlideId === slide.id && (
                                    <div
                                        style={{
                                            padding: "0 16px 16px 16px",
                                            borderTop: "1px solid rgba(255,255,255,0.05)",
                                            marginTop: 4,
                                        }}
                                    >
                                        <fetcher.Form
                                            method="post"
                                            encType="multipart/form-data"
                                            style={{ padding: "16px 0 0 0" }}
                                        >
                                            <input type="hidden" name="intent" value="update" />
                                            <input type="hidden" name="id" value={slide.id} />
                                            <input type="hidden" name="type" value={slide.type} />

                                            <div style={{ marginBottom: 12 }}>
                                                <input
                                                    name="name"
                                                    defaultValue={slide.name}
                                                    placeholder="Назва слайду"
                                                    style={{
                                                        width: "100%",
                                                        background: "#0a0c10",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        color: "#fff",
                                                        padding: "10px 12px",
                                                        borderRadius: 8,
                                                        fontSize: "13px",
                                                    }}
                                                />
                                            </div>
                                            <div style={{ marginBottom: 16 }}>
                                                <input
                                                    name="link"
                                                    defaultValue={slide.link || ""}
                                                    placeholder="/shop/category"
                                                    style={{
                                                        width: "100%",
                                                        background: "#0a0c10",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        color: "#fff",
                                                        padding: "10px 12px",
                                                        borderRadius: 8,
                                                        fontSize: "13px",
                                                    }}
                                                />
                                            </div>

                                            <ImageCropSelector
                                                currentImageUrl={slide.image1}
                                                fileInputName="image1_file"
                                                value={
                                                    positions[`${slide.id}_image1Pos`] ||
                                                    slide.image1Pos ||
                                                    "center center"
                                                }
                                                onChange={(val: string) =>
                                                    updatePos(slide.id, "image1Pos", val)
                                                }
                                                aspectRatio={
                                                    slide.type === "single" ? "16/9" : "9/16"
                                                }
                                                overlay={
                                                    <div
                                                        className="hero-slider__overlay"
                                                        style={{
                                                            background:
                                                                "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                            position: "absolute",
                                                            inset: 0,
                                                            pointerEvents: "none",
                                                            zIndex: 5,
                                                        }}
                                                    ></div>
                                                }
                                            />
                                            <input
                                                type="hidden"
                                                name="image1Pos"
                                                value={
                                                    positions[`${slide.id}_image1Pos`] ||
                                                    slide.image1Pos ||
                                                    "center center"
                                                }
                                            />
                                            <input
                                                type="hidden"
                                                name="image1_url"
                                                value={slide.image1}
                                            />

                                            {slide.type === "triptych" && (
                                                <>
                                                    <ImageCropSelector
                                                        currentImageUrl={slide.image2 || ""}
                                                        fileInputName="image2_file"
                                                        value={
                                                            positions[`${slide.id}_image2Pos`] ||
                                                            slide.image2Pos ||
                                                            "center center"
                                                        }
                                                        onChange={(val: string) =>
                                                            updatePos(slide.id, "image2Pos", val)
                                                        }
                                                        aspectRatio="9/16"
                                                        overlay={
                                                            <div
                                                                className="hero-slider__overlay"
                                                                style={{
                                                                    background:
                                                                        "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                                    position: "absolute",
                                                                    inset: 0,
                                                                    pointerEvents: "none",
                                                                    zIndex: 5,
                                                                }}
                                                            ></div>
                                                        }
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="image2Pos"
                                                        value={
                                                            positions[`${slide.id}_image2Pos`] ||
                                                            slide.image2Pos ||
                                                            "center center"
                                                        }
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="image2_url"
                                                        value={slide.image2 || ""}
                                                    />

                                                    <ImageCropSelector
                                                        currentImageUrl={slide.image3 || ""}
                                                        fileInputName="image3_file"
                                                        value={
                                                            positions[`${slide.id}_image3Pos`] ||
                                                            slide.image3Pos ||
                                                            "center center"
                                                        }
                                                        onChange={(val: string) =>
                                                            updatePos(slide.id, "image3Pos", val)
                                                        }
                                                        aspectRatio="9/16"
                                                        overlay={
                                                            <div
                                                                className="hero-slider__overlay"
                                                                style={{
                                                                    background:
                                                                        "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                                    position: "absolute",
                                                                    inset: 0,
                                                                    pointerEvents: "none",
                                                                    zIndex: 5,
                                                                }}
                                                            ></div>
                                                        }
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="image3Pos"
                                                        value={
                                                            positions[`${slide.id}_image3Pos`] ||
                                                            slide.image3Pos ||
                                                            "center center"
                                                        }
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="image3_url"
                                                        value={slide.image3 || ""}
                                                    />
                                                </>
                                            )}

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

                {/* Add New Slide Section */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px" }}>
                    <div
                        style={{
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            color: "var(--accent-primary)",
                            marginBottom: "20px",
                            fontWeight: 600,
                        }}
                    >
                        + Додати новий слайд
                    </div>

                    <fetcher.Form
                        method="post"
                        encType="multipart/form-data"
                        id="create-slide-form"
                    >
                        <input type="hidden" name="intent" value="create" />

                        {/* Radio Type Toggle */}
                        <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
                            <label
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    cursor: "pointer",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="type"
                                    value="triptych"
                                    checked={newSlideType === "triptych"}
                                    onChange={() => setNewSlideType("triptych")}
                                    style={{ accentColor: "var(--accent-primary)" }}
                                />
                                Триптих (3 фото)
                            </label>
                            <label
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    cursor: "pointer",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="type"
                                    value="single"
                                    checked={newSlideType === "single"}
                                    onChange={() => setNewSlideType("single")}
                                    style={{ accentColor: "var(--accent-primary)" }}
                                />
                                Одне фото (Full)
                            </label>
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <input
                                name="name"
                                required
                                placeholder="Назва слайду (напр. Summer Sale)"
                                style={{
                                    width: "100%",
                                    background: "#16191f",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    color: "#fff",
                                    padding: "12px",
                                    borderRadius: 8,
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: "24px" }}>
                            <input
                                name="link"
                                placeholder="Посилання (напр. /shop/yoga)"
                                style={{
                                    width: "100%",
                                    background: "#16191f",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    color: "#fff",
                                    padding: "12px",
                                    borderRadius: 8,
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div
                            style={{
                                background: "#16191f",
                                padding: "16px",
                                borderRadius: "12px",
                                marginBottom: "24px",
                            }}
                        >
                            <div style={{ marginBottom: "16px" }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: "12px",
                                        color: "#64748b",
                                        marginBottom: "8px",
                                    }}
                                >
                                    Головне фото (обов'язково)
                                </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="file"
                                        name="image1_file"
                                        accept="image/*"
                                        required
                                        style={{
                                            width: "100%",
                                            fontSize: "12px",
                                            color: "#94a3b8",
                                        }}
                                    />
                                </div>
                            </div>

                            {newSlideType === "triptych" && (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "16px",
                                    }}
                                >
                                    <div>
                                        <label
                                            style={{
                                                display: "block",
                                                fontSize: "12px",
                                                color: "#64748b",
                                                marginBottom: "8px",
                                            }}
                                        >
                                            Фото 2 (центр)
                                        </label>
                                        <input
                                            type="file"
                                            name="image2_file"
                                            accept="image/*"
                                            required
                                            style={{
                                                width: "100%",
                                                fontSize: "12px",
                                                color: "#94a3b8",
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label
                                            style={{
                                                display: "block",
                                                fontSize: "12px",
                                                color: "#64748b",
                                                marginBottom: "8px",
                                            }}
                                        >
                                            Фото 3 (праворуч)
                                        </label>
                                        <input
                                            type="file"
                                            name="image3_file"
                                            accept="image/*"
                                            required
                                            style={{
                                                width: "100%",
                                                fontSize: "12px",
                                                color: "#94a3b8",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            style={{
                                width: "100%",
                                padding: "16px",
                                background: "var(--accent-primary)",
                                color: "#000",
                                border: "none",
                                borderRadius: "12px",
                                fontSize: "15px",
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 4px 15px rgba(94, 234, 212, 0.2)",
                            }}
                        >
                            {fetcher.state === "submitting" ? "Створення..." : "Створити слайд"}
                        </button>
                    </fetcher.Form>
                </div>
            </div>
        </div>
    );
}
