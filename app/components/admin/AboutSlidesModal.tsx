import { useState, useEffect, useRef } from "react";
import type { FetcherWithComponents } from "react-router";
import type { Slide } from "@prisma/client";
import { CloseIcon, TrashIcon } from "./AdminIcons";
import { ImageCropSelector } from "./ImageCropSelector";
import { ConfirmDialog } from "./ConfirmDialog";
import { FilePickerField } from "./FilePickerField";
import { useModalA11y } from "./useModalA11y";

interface AboutSlideForm {
    name: string;
    type: string;
    image1_url: string;
    image1Pos: string;
    image2_url: string;
    image2Pos: string;
    image3_url: string;
    image3Pos: string;
}

interface AboutSlidesModalProps {
    isOpen: boolean;
    onClose: () => void;
    slides: Slide[];
    fetcher: FetcherWithComponents<unknown>;
}

/**
 * About Slides Modal — manages the slide rotation on the /about
 * page. Extracted from app/routes/admin/slides.tsx; original file
 * mixed three modals inline, this one is for "about" page slides
 * (distinct from the home-page HeroSlider slides).
 */
// --- About Slides Editor Modal Component ---

// --- About Slides Editor Modal Component ---
export function AboutSlidesModal({ isOpen, onClose, slides, fetcher }: AboutSlidesModalProps) {
    const defaultSlideData = {
        name: "New Slide",
        type: "triptych",
        image1_url: "/pics1cloths/IMG_6201.JPG",
        image1Pos: "center center",
        image2_url: "/pics1cloths/IMG_6203.JPG",
        image2Pos: "center center",
        image3_url: "/pics1cloths/IMG_6204.JPG",
        image3Pos: "center center",
    };

    const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
    const [creationData, setCreationData] = useState<AboutSlideForm>(defaultSlideData);

    // File states for creation
    const [file1, setFile1] = useState<File | null>(null);
    const [file2, setFile2] = useState<File | null>(null);
    const [file3, setFile3] = useState<File | null>(null);

    // File states for editing
    const [editFile1, setEditFile1] = useState<File | null>(null);
    const [editFile2, setEditFile2] = useState<File | null>(null);
    const [editFile3, setEditFile3] = useState<File | null>(null);

    // Reset creation data when modal opens
    useEffect(() => {
        if (isOpen) {
            setCreationData(defaultSlideData);
            setFile1(null);
            setFile2(null);
            setFile3(null);
            setEditingSlide(null);
        }
    }, [isOpen]);

    // Delete confirmation (replaces window.confirm) + success-gated form reset:
    // the create/edit forms used to reset BEFORE the server responded, so a
    // failed upload wiped the operator's input and looked like it saved. Now the
    // reset/exit happens only after the shared fetcher confirms success.
    const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
    const afterSubmit = useRef<null | "create" | "update">(null);
    useEffect(() => {
        if (fetcher.state !== "idle" || !afterSubmit.current) return;
        const which = afterSubmit.current;
        afterSubmit.current = null;
        const res = fetcher.data as { ok?: boolean } | undefined;
        if (!res?.ok) return; // keep the form on error so the operator can retry
        if (which === "create") {
            setCreationData(defaultSlideData);
            setFile1(null);
            setFile2(null);
            setFile3(null);
        } else {
            setEditingSlide(null);
            setEditFile1(null);
            setEditFile2(null);
            setEditFile3(null);
        }
    }, [fetcher.state, fetcher.data]);

    const handleCreate = () => {
        const formData = new FormData();
        formData.append("intent", "create_about_slide");
        formData.append("name", creationData.name);
        formData.append("type", creationData.type);
        formData.append("image1_url", creationData.image1_url);
        formData.append("image1Pos", creationData.image1Pos);

        if (creationData.type === "triptych") {
            formData.append("image2_url", creationData.image2_url);
            formData.append("image2Pos", creationData.image2Pos);
            formData.append("image3_url", creationData.image3_url);
            formData.append("image3Pos", creationData.image3Pos);
        }

        if (file1) formData.append("image1_file", file1);
        if (file2) formData.append("image2_file", file2);
        if (file3) formData.append("image3_file", file3);

        afterSubmit.current = "create";
        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
        // Form resets only AFTER the server confirms success (see effect above).
    };

    const handleUpdate = () => {
        if (!editingSlide) return;
        const formData = new FormData();
        formData.append("intent", "update_about_slide");
        formData.append("id", editingSlide.id);
        formData.append("name", editingSlide.name);
        formData.append("type", editingSlide.type);

        formData.append("image1_url", editingSlide.image1);
        formData.append("image1Pos", editingSlide.image1Pos);

        if (editingSlide.type === "triptych") {
            formData.append("image2_url", editingSlide.image2 || "");
            formData.append("image2Pos", editingSlide.image2Pos || "center center");
            formData.append("image3_url", editingSlide.image3 || "");
            formData.append("image3Pos", editingSlide.image3Pos || "center center");
        }

        if (editFile1) formData.append("image1_file", editFile1);
        if (editFile2) formData.append("image2_file", editFile2);
        if (editFile3) formData.append("image3_file", editFile3);

        afterSubmit.current = "update";
        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
        // Exit edit mode only on success (see effect) — on error the form stays.
    };

    const handleDelete = (id: string) => setConfirmDelId(id);
    const doDelete = () => {
        if (!confirmDelId) return;
        const formData = new FormData();
        formData.append("intent", "delete_about_slide");
        formData.append("id", confirmDelId);
        fetcher.submit(formData, { method: "post" });
        setConfirmDelId(null);
    };

    // Focus trap + Escape-to-close; suspended while the delete ConfirmDialog owns focus.
    const dialogRef = useRef<HTMLDivElement>(null);
    useModalA11y(dialogRef, onClose, isOpen && confirmDelId === null);

    if (!isOpen) return null;

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(10px)",
                }}
            >
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Слайди «Про бренд»"
                    style={{
                        background: "#0f1216",
                        borderRadius: "16px",
                        width: "90%",
                        maxWidth: "900px",
                        maxHeight: "85vh",
                        display: "flex",
                        flexDirection: "column",
                        border: "1px solid rgba(255,255,255,0.1)",
                        overflow: "hidden",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "24px 32px",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: "20px",
                                    fontWeight: 700,
                                    color: "#f8fafc",
                                }}
                            >
                                Слайди "Про бренд"
                            </h2>
                            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                                Керуйте слайдами на сторінці About
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Закрити"
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                padding: "8px",
                            }}
                        >
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
                        {/* Slides List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {slides.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "48px",
                                        color: "#64748b",
                                    }}
                                >
                                    <p>Немає слайдів. Додайте перший!</p>
                                </div>
                            ) : (
                                slides.map((slide) => (
                                    <div
                                        key={slide.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "16px",
                                            padding: "16px",
                                            background: "#161b22",
                                            borderRadius: "12px",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                    >
                                        <div style={{ display: "flex", gap: "4px" }}>
                                            <img
                                                src={slide.image1}
                                                alt="1"
                                                style={{
                                                    width: "60px",
                                                    height: "60px",
                                                    objectFit: "cover",
                                                    borderRadius: "4px",
                                                }}
                                            />
                                            {slide.type === "triptych" && (
                                                <>
                                                    <img
                                                        src={slide.image2 ?? undefined}
                                                        alt="2"
                                                        style={{
                                                            width: "60px",
                                                            height: "60px",
                                                            objectFit: "cover",
                                                            borderRadius: "4px",
                                                        }}
                                                    />
                                                    <img
                                                        src={slide.image3 ?? undefined}
                                                        alt="3"
                                                        style={{
                                                            width: "60px",
                                                            height: "60px",
                                                            objectFit: "cover",
                                                            borderRadius: "4px",
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    color: "#f8fafc",
                                                    fontSize: "15px",
                                                }}
                                            >
                                                {slide.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "11px",
                                                    color: "#5eead4",
                                                    marginTop: "4px",
                                                }}
                                            >
                                                {slide.type}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={() => setEditingSlide({ ...slide })}
                                                style={{
                                                    padding: "8px 14px",
                                                    borderRadius: "8px",
                                                    background: "rgba(94, 234, 212, 0.1)",
                                                    border: "1px solid rgba(94, 234, 212, 0.2)",
                                                    color: "#5eead4",
                                                    cursor: "pointer",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Редагувати
                                            </button>
                                            <button
                                                onClick={() => handleDelete(slide.id)}
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: "8px",
                                                    background: "rgba(239, 68, 68, 0.1)",
                                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                                    color: "#ef4444",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* New Slide Form (Collapsible or just inline) */}
                        <div
                            style={{
                                marginTop: "32px",
                                paddingTop: "24px",
                                borderTop: "1px solid rgba(255,255,255,0.1)",
                            }}
                        >
                            <h3
                                style={{ fontSize: "16px", color: "#f8fafc", marginBottom: "16px" }}
                            >
                                Додати новий слайд
                            </h3>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "16px",
                                    marginBottom: "16px",
                                }}
                            >
                                <input
                                    type="text"
                                    placeholder="Назва слайду"
                                    value={creationData.name}
                                    onChange={(e) =>
                                        setCreationData({ ...creationData, name: e.target.value })
                                    }
                                    style={{
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        color: "#fff",
                                    }}
                                />
                                <select
                                    value={creationData.type}
                                    onChange={(e) =>
                                        setCreationData({ ...creationData, type: e.target.value })
                                    }
                                    style={{
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        padding: "10px",
                                        borderRadius: "8px",
                                        color: "#fff",
                                    }}
                                >
                                    <option value="triptych">Триптих (3 фото)</option>
                                    <option value="single">Одне фото</option>
                                </select>
                            </div>

                            {/* Image Inputs */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr 1fr",
                                    gap: "12px",
                                }}
                            >
                                {/* Image 1 */}
                                <div>
                                    <div
                                        style={{
                                            fontSize: "12px",
                                            color: "#94a3b8",
                                            marginBottom: "8px",
                                        }}
                                    >
                                        Фото 1 (ліве/головне)
                                    </div>
                                    <FilePickerField
                                        label="Обрати фото"
                                        onFileChange={(f) => setFile1(f)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="URL зображення"
                                        value={creationData.image1_url}
                                        onChange={(e) =>
                                            setCreationData({
                                                ...creationData,
                                                image1_url: e.target.value,
                                            })
                                        }
                                        style={{
                                            width: "100%",
                                            marginTop: "8px",
                                            background: "#0f1216",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            padding: "8px",
                                            borderRadius: "6px",
                                            color: "#fff",
                                            fontSize: "12px",
                                        }}
                                    />
                                </div>

                                {creationData.type === "triptych" && (
                                    <>
                                        {/* Image 2 */}
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: "#94a3b8",
                                                    marginBottom: "8px",
                                                }}
                                            >
                                                Фото 2 (центр)
                                            </div>
                                            <FilePickerField
                                                label="Обрати фото"
                                                onFileChange={(f) => setFile2(f)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="URL зображення"
                                                value={creationData.image2_url}
                                                onChange={(e) =>
                                                    setCreationData({
                                                        ...creationData,
                                                        image2_url: e.target.value,
                                                    })
                                                }
                                                style={{
                                                    width: "100%",
                                                    marginTop: "8px",
                                                    background: "#0f1216",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    padding: "8px",
                                                    borderRadius: "6px",
                                                    color: "#fff",
                                                    fontSize: "12px",
                                                }}
                                            />
                                        </div>
                                        {/* Image 3 */}
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: "#94a3b8",
                                                    marginBottom: "8px",
                                                }}
                                            >
                                                Фото 3 (праве)
                                            </div>
                                            <FilePickerField
                                                label="Обрати фото"
                                                onFileChange={(f) => setFile3(f)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="URL зображення"
                                                value={creationData.image3_url}
                                                onChange={(e) =>
                                                    setCreationData({
                                                        ...creationData,
                                                        image3_url: e.target.value,
                                                    })
                                                }
                                                style={{
                                                    width: "100%",
                                                    marginTop: "8px",
                                                    background: "#0f1216",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    padding: "8px",
                                                    borderRadius: "6px",
                                                    color: "#fff",
                                                    fontSize: "12px",
                                                }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={handleCreate}
                                style={{
                                    marginTop: "20px",
                                    width: "100%",
                                    padding: "12px",
                                    background: "var(--accent-primary)",
                                    border: "none",
                                    borderRadius: "8px",
                                    color: "#000",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Додати слайд
                            </button>

                            <div style={{ marginTop: "16px", textAlign: "center" }}>
                                <button
                                    onClick={() =>
                                        setCreationData({
                                            name: "MIND BODY Lifestyle",
                                            type: "single",
                                            image1_url: "/generalpics/338_131123.jpg",
                                            image1Pos: "center center",
                                            image2_url: "",
                                            image2Pos: "center center",
                                            image3_url: "",
                                            image3Pos: "center center",
                                        })
                                    }
                                    style={{
                                        background: "transparent",
                                        border: "1px dashed rgba(255,255,255,0.2)",
                                        padding: "8px 16px",
                                        borderRadius: "8px",
                                        color: "#94a3b8",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Імпортувати стандартний слайд (Default)
                                </button>
                            </div>
                        </div>

                        {/* Edit Form */}
                        {editingSlide && (
                            <div
                                style={{
                                    marginTop: "24px",
                                    padding: "24px",
                                    background: "#161b22",
                                    borderRadius: "12px",
                                    border: "1px solid rgba(94, 234, 212, 0.2)",
                                }}
                            >
                                <h3
                                    style={{
                                        margin: "0 0 20px",
                                        fontSize: "16px",
                                        color: "#5eead4",
                                    }}
                                >
                                    Редагування слайду
                                </h3>

                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "16px",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <div>
                                        <label
                                            style={{
                                                display: "block",
                                                marginBottom: "8px",
                                                fontSize: "12px",
                                                color: "#94a3b8",
                                            }}
                                        >
                                            Назва
                                        </label>
                                        <input
                                            type="text"
                                            value={editingSlide.name}
                                            onChange={(e) =>
                                                setEditingSlide({
                                                    ...editingSlide,
                                                    name: e.target.value,
                                                })
                                            }
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                borderRadius: "8px",
                                                background: "#0f1216",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                color: "#fff",
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label
                                            style={{
                                                display: "block",
                                                marginBottom: "8px",
                                                fontSize: "12px",
                                                color: "#94a3b8",
                                            }}
                                        >
                                            Тип
                                        </label>
                                        <select
                                            value={editingSlide.type}
                                            onChange={(e) =>
                                                setEditingSlide({
                                                    ...editingSlide,
                                                    type: e.target.value,
                                                })
                                            }
                                            style={{
                                                width: "100%",
                                                padding: "10px",
                                                borderRadius: "8px",
                                                background: "#0f1216",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                color: "#fff",
                                            }}
                                        >
                                            <option value="triptych">Триптих</option>
                                            <option value="single">Одне фото</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Edit Image Inputs */}
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr 1fr",
                                        gap: "12px",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "12px",
                                                color: "#94a3b8",
                                                marginBottom: "8px",
                                            }}
                                        >
                                            Фото 1
                                        </div>
                                        <ImageCropSelector
                                            currentImageUrl={editingSlide.image1}
                                            fileInputName="image1_file"
                                            value={editingSlide.image1Pos || "center center"}
                                            onChange={(val: string) =>
                                                setEditingSlide({ ...editingSlide, image1Pos: val })
                                            }
                                            onFileSelect={setEditFile1}
                                            aspectRatio={
                                                editingSlide.type === "single" ? "16/9" : "9/16"
                                            }
                                            overlay={
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        inset: 0,
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        zIndex: 10,
                                                        pointerEvents: "none",
                                                        background:
                                                            "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            marginTop: "-40px",
                                                        }}
                                                    >
                                                        <img
                                                            src="/pics/mind_body_logo.png"
                                                            alt="MIND BODY"
                                                            style={{
                                                                maxWidth: "75vw",
                                                                width: "250px",
                                                                height: "auto",
                                                                filter: "brightness(0) invert(1) drop-shadow(0 0 15px rgba(255,255,255,0.3))",
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            left: "20px",
                                                            bottom: "20px",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            gap: "15px",
                                                            opacity: 0.8,
                                                        }}
                                                    >
                                                        <p
                                                            style={{
                                                                writingMode: "vertical-rl",
                                                                textOrientation: "mixed",
                                                                transform: "rotate(180deg)",
                                                                color: "#fff",
                                                                fontSize: "10px",
                                                                fontFamily:
                                                                    "'Tenor Sans', sans-serif",
                                                                letterSpacing: "0.15em",
                                                                textTransform: "uppercase",
                                                                textShadow:
                                                                    "0 2px 4px rgba(0,0,0,0.5)",
                                                                margin: 0,
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            Одяг, який надихає тебе рухатись
                                                        </p>
                                                        <div
                                                            style={{
                                                                width: "1px",
                                                                height: "20px",
                                                                background: "#fff",
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <input
                                            type="text"
                                            value={editingSlide.image1}
                                            onChange={(e) =>
                                                setEditingSlide({
                                                    ...editingSlide,
                                                    image1: e.target.value,
                                                })
                                            }
                                            style={{
                                                width: "100%",
                                                marginTop: "8px",
                                                background: "#0f1216",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                padding: "8px",
                                                borderRadius: "6px",
                                                color: "#fff",
                                                fontSize: "12px",
                                            }}
                                        />
                                    </div>
                                    {editingSlide.type === "triptych" && (
                                        <>
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#94a3b8",
                                                        marginBottom: "8px",
                                                    }}
                                                >
                                                    Фото 2
                                                </div>
                                                <ImageCropSelector
                                                    currentImageUrl={editingSlide.image2 || ""}
                                                    fileInputName="image2_file"
                                                    value={
                                                        editingSlide.image2Pos || "center center"
                                                    }
                                                    onChange={(val: string) =>
                                                        setEditingSlide({
                                                            ...editingSlide,
                                                            image2Pos: val,
                                                        })
                                                    }
                                                    onFileSelect={setEditFile2}
                                                    aspectRatio="9/16"
                                                    overlay={
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                inset: 0,
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                zIndex: 10,
                                                                pointerEvents: "none",
                                                                background:
                                                                    "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    left: "20px",
                                                                    bottom: "20px",
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    alignItems: "center",
                                                                    gap: "15px",
                                                                    opacity: 0.8,
                                                                }}
                                                            >
                                                                <p
                                                                    style={{
                                                                        writingMode: "vertical-rl",
                                                                        textOrientation: "mixed",
                                                                        transform: "rotate(180deg)",
                                                                        color: "#fff",
                                                                        fontSize: "10px",
                                                                        fontFamily:
                                                                            "'Tenor Sans', sans-serif",
                                                                        letterSpacing: "0.15em",
                                                                        textTransform: "uppercase",
                                                                        textShadow:
                                                                            "0 2px 4px rgba(0,0,0,0.5)",
                                                                        margin: 0,
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    Одяг, який надихає тебе рухатись
                                                                </p>
                                                                <div
                                                                    style={{
                                                                        width: "1px",
                                                                        height: "20px",
                                                                        background: "#fff",
                                                                    }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    }
                                                />
                                                <input
                                                    type="text"
                                                    value={editingSlide.image2 || ""}
                                                    onChange={(e) =>
                                                        setEditingSlide({
                                                            ...editingSlide,
                                                            image2: e.target.value,
                                                        })
                                                    }
                                                    style={{
                                                        width: "100%",
                                                        marginTop: "8px",
                                                        background: "#0f1216",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        padding: "8px",
                                                        borderRadius: "6px",
                                                        color: "#fff",
                                                        fontSize: "12px",
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#94a3b8",
                                                        marginBottom: "8px",
                                                    }}
                                                >
                                                    Фото 3
                                                </div>
                                                <ImageCropSelector
                                                    currentImageUrl={editingSlide.image3 || ""}
                                                    fileInputName="image3_file"
                                                    value={
                                                        editingSlide.image3Pos || "center center"
                                                    }
                                                    onChange={(val: string) =>
                                                        setEditingSlide({
                                                            ...editingSlide,
                                                            image3Pos: val,
                                                        })
                                                    }
                                                    onFileSelect={setEditFile3}
                                                    aspectRatio="9/16"
                                                    overlay={
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                inset: 0,
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                zIndex: 10,
                                                                pointerEvents: "none",
                                                                background:
                                                                    "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    right: "20px",
                                                                    bottom: "20px",
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    alignItems: "center",
                                                                    gap: "15px",
                                                                    opacity: 0.8,
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        width: "1px",
                                                                        height: "20px",
                                                                        background:
                                                                            "rgba(255,255,255,0.4)",
                                                                        overflow: "hidden",
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: "100%",
                                                                            height: "100%",
                                                                            background: "#fff",
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    }
                                                />
                                                <input
                                                    type="text"
                                                    value={editingSlide.image3 || ""}
                                                    onChange={(e) =>
                                                        setEditingSlide({
                                                            ...editingSlide,
                                                            image3: e.target.value,
                                                        })
                                                    }
                                                    style={{
                                                        width: "100%",
                                                        marginTop: "8px",
                                                        background: "#0f1216",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        padding: "8px",
                                                        borderRadius: "6px",
                                                        color: "#fff",
                                                        fontSize: "12px",
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                                    <button
                                        onClick={() => {
                                            setEditingSlide(null);
                                            setEditFile1(null);
                                            setEditFile2(null);
                                            setEditFile3(null);
                                        }}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: "8px",
                                            background: "transparent",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            color: "#94a3b8",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={handleUpdate}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: "8px",
                                            background: "var(--accent-primary)",
                                            border: "none",
                                            color: "#000",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Зберегти зміни
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <ConfirmDialog
                open={confirmDelId !== null}
                title="Видалити слайд?"
                body="Цей слайд сторінки «Про бренд» буде видалено."
                busy={fetcher.state !== "idle"}
                onConfirm={doDelete}
                onCancel={() => setConfirmDelId(null)}
            />
        </>
    );
}
