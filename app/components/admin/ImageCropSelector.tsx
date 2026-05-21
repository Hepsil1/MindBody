import { useRef, useState } from "react";
import { CameraIcon } from "./AdminIcons";

interface ImageCropSelectorProps {
    currentImageUrl: string;
    fileInputName: string;
    /**
     * Comma-less position string `"<x>% <y>% <scale>"` — admin/slides.tsx
     * round-trips this format through the DB so we keep parsing/emitting
     * it as-is rather than splitting into separate fields.
     */
    value: string;
    onChange: (val: string) => void;
    aspectRatio?: string;
    onFileSelect?: (file: File) => void;
    overlay?: React.ReactNode;
}

interface CropPosition {
    x: number;
    y: number;
    scale: number;
}

function parsePos(pos: string): CropPosition {
    const parts = pos.split(" ");
    return {
        x: parseInt(parts[0]) || 50,
        y: parseInt(parts[1]) || 50,
        scale: parseFloat(parts[2]) || 1,
    };
}

/**
 * Image position + zoom picker used by every "upload + place" widget in
 * the admin slides/categories/shop-pages editors. Drag the image to
 * pan, wheel or slider to zoom. The selected position is emitted as a
 * string that becomes Slide.image1Pos / Category.imagePos / etc.
 *
 * Extracted from admin/slides.tsx so the same widget is wired the same
 * way everywhere (and so the parent file becomes humanly navigable).
 */
export function ImageCropSelector({
    currentImageUrl,
    fileInputName,
    value,
    onChange,
    aspectRatio = "400/380",
    onFileSelect,
    overlay,
}: ImageCropSelectorProps) {
    const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<CropPosition>(parsePos(value));

    const emitChange = (newPos: CropPosition) => {
        onChange(`${Math.round(newPos.x)}% ${Math.round(newPos.y)}% ${newPos.scale.toFixed(2)}`);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            const newPos = { x: 50, y: 50, scale: 1 };
            setPos(newPos);
            emitChange(newPos);
            onFileSelect?.(file);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Sensitivity adjusted for scale — more zoomed = more precise control
        const sensitivity = 100 / pos.scale;
        const deltaX = ((e.clientX - dragStart.x) / rect.width) * sensitivity;
        const deltaY = ((e.clientY - dragStart.y) / rect.height) * sensitivity;
        const newX = Math.max(0, Math.min(100, pos.x - deltaX));
        const newY = Math.max(0, Math.min(100, pos.y - deltaY));
        const newPos = { ...pos, x: newX, y: newY };
        setPos(newPos);
        setDragStart({ x: e.clientX, y: e.clientY });
        emitChange(newPos);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newScale = Math.max(1, Math.min(2.5, pos.scale + delta));
        const newPos = { ...pos, scale: newScale };
        setPos(newPos);
        emitChange(newPos);
    };

    const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newScale = parseFloat(e.target.value);
        const newPos = { ...pos, scale: newScale };
        setPos(newPos);
        emitChange(newPos);
    };

    return (
        <div style={{ marginBottom: "20px" }}>
            {/* File Input with styled button */}
            <div style={{ marginBottom: "16px" }}>
                <label
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 16px",
                        background: "linear-gradient(135deg, #1e293b, #0f172a)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: "#94a3b8",
                        transition: "all 0.2s",
                    }}
                >
                    <CameraIcon />
                    Обрати фото
                    <input
                        type="file"
                        name={fileInputName}
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                    />
                </label>
                {previewUrl && (
                    <span style={{ marginLeft: "12px", fontSize: "11px", color: "#64748b" }}>
                        ✓ Фото завантажено
                    </span>
                )}
            </div>

            {/* Preview — exact match to category card */}
            {previewUrl && (
                <div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "10px",
                            padding: "8px 12px",
                            background: "rgba(94, 234, 212, 0.1)",
                            borderRadius: "6px",
                            border: "1px solid rgba(94, 234, 212, 0.2)",
                        }}
                    >
                        <span style={{ fontSize: "14px" }}>✛</span>
                        <span style={{ fontSize: "11px", color: "var(--accent-primary)" }}>
                            Перетягуйте + колесо миші для масштабу
                        </span>
                    </div>

                    {/* Card Preview Container */}
                    <div
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        style={{
                            position: "relative",
                            width: "100%",
                            maxWidth: "100%",
                            aspectRatio: aspectRatio,
                            background: "#f0f0f0",
                            borderRadius: "20px",
                            overflow: "hidden",
                            cursor: isDragging ? "grabbing" : "grab",
                            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                            userSelect: "none",
                        }}
                    >
                        {/* Image with scale */}
                        <img
                            src={previewUrl}
                            alt="Preview"
                            draggable={false}
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: `${pos.x}% ${pos.y}%`,
                                transform: `scale(${pos.scale})`,
                                transformOrigin: `${pos.x}% ${pos.y}%`,
                                pointerEvents: "none",
                            }}
                        />

                        {overlay ? (
                            overlay
                        ) : (
                            <>
                                {/* Gradient overlay */}
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background:
                                            "linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.6) 100%)",
                                        pointerEvents: "none",
                                    }}
                                ></div>

                                {/* Sample text overlay */}
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        padding: "30px",
                                        color: "#fff",
                                        pointerEvents: "none",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "11px",
                                            letterSpacing: "0.2em",
                                            textTransform: "uppercase",
                                            opacity: 0.8,
                                            marginBottom: "4px",
                                        }}
                                    >
                                        Колекція
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "24px",
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        Категорія
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Drag indicator */}
                        {isDragging && (
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "rgba(0,0,0,0.3)",
                                    pointerEvents: "none",
                                }}
                            >
                                <div
                                    style={{
                                        width: "60px",
                                        height: "60px",
                                        border: "2px solid var(--accent-primary)",
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "24px",
                                            color: "var(--accent-primary)",
                                        }}
                                    >
                                        ✛
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Zoom Slider */}
                    <div style={{ marginTop: "12px", maxWidth: "320px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "14px" }}>🔍</span>
                            <input
                                type="range"
                                min="1"
                                max="2.5"
                                step="0.05"
                                value={pos.scale}
                                onChange={handleScaleChange}
                                style={{
                                    flex: 1,
                                    accentColor: "var(--accent-primary)",
                                    height: "6px",
                                }}
                            />
                            <span style={{ fontSize: "11px", color: "#64748b", minWidth: "40px" }}>
                                {Math.round(pos.scale * 100)}%
                            </span>
                        </div>
                    </div>

                    {/* Position info */}
                    <div
                        style={{
                            marginTop: "8px",
                            fontSize: "10px",
                            color: "#475569",
                            display: "flex",
                            gap: "12px",
                        }}
                    >
                        <span>X: {Math.round(pos.x)}%</span>
                        <span>Y: {Math.round(pos.y)}%</span>
                        <span>Масштаб: {Math.round(pos.scale * 100)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
}
