import { useEffect, useRef, useState, type ChangeEventHandler } from "react";
import type { FetcherWithComponents } from "react-router";
import type { HomeBrandWorldSettings } from "../../../utils/site-settings";

interface BrandWorldPanelProps {
    brandWorld: HomeBrandWorldSettings;
    fetcher: FetcherWithComponents<unknown>;
}

/**
 * "Налаштування → Brand World" — the 4 feature blocks on the home page, each
 * with a title, a description AND its own brand video. A new video per block is
 * optional (the current one is kept when no file is chosen); on upload the
 * server re-encodes it to a web-tuned H.264 + poster (video.server.ts). Multipart
 * form, intent "update_brand_world". The number (01–04) and the "Каталог" link
 * are fixed in code — only these fields are editable here.
 */
export function BrandWorldPanel({ brandWorld, fetcher }: BrandWorldPanelProps) {
    const saving = fetcher.state !== "idle";

    return (
        <div
            className="custom-scrollbar"
            style={{ height: "100%", overflowY: "auto", background: "#0a0c10" }}
        >
            <fetcher.Form
                method="post"
                encType="multipart/form-data"
                style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 24px 80px" }}
            >
                <input type="hidden" name="intent" value="update_brand_world" />

                <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>
                    Brand World — 4 блоки з відео
                </h2>
                <p
                    style={{
                        color: "#64748b",
                        fontSize: "13px",
                        margin: "0 0 10px",
                        lineHeight: 1.6,
                    }}
                >
                    Кожен блок має заголовок, опис і власне відео. Відео грає у ротації в рамці та
                    при наведенні на блок. Нове відео — за бажанням; без файлу лишається поточне.
                </p>
                <p
                    style={{
                        color: "#475569",
                        fontSize: "12px",
                        margin: "0 0 28px",
                        lineHeight: 1.6,
                    }}
                >
                    Формати: MP4, MOV, WebM (до 200 МБ). Найкраще — вертикальні кадри 9:16. Сервер
                    сам стисне відео у якісний веб-формат і зробить постер. Для максимальної
                    плавності знімайте у 60 к/с — сайт збереже вашу частоту кадрів.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {brandWorld.items.map((item, i) => (
                        <BrandWorldCard key={i} index={i} item={item} />
                    ))}
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
                    {saving ? "Збереження… (обробка відео може зайняти хвилину)" : "Зберегти блоки"}
                </button>
            </fetcher.Form>
        </div>
    );
}

function BrandWorldCard({
    index,
    item,
}: {
    index: number;
    item: HomeBrandWorldSettings["items"][number];
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        const file = e.target.files?.[0] || null;
        setFileName(file ? file.name : null);
        setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return file ? URL.createObjectURL(file) : null;
        });
    };

    // The picked-file preview (object URL) wins over the currently-saved video so
    // the operator sees exactly what they're about to upload.
    const shownVideo = previewUrl || item.video || "";

    return (
        <div
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
                        width: 96,
                        height: 128,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "#000",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    {shownVideo && (
                        <video
                            key={shownVideo}
                            src={shownVideo}
                            poster={item.poster || undefined}
                            muted
                            loop
                            playsInline
                            autoPlay
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                    Блок {String(index + 1).padStart(2, "0")}
                </div>

                {/* Keep the current video/poster when no new file is chosen. */}
                <input type="hidden" name={`bw_${index}_currentVideo`} value={item.video ?? ""} />
                <input type="hidden" name={`bw_${index}_currentPoster`} value={item.poster ?? ""} />

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input
                        name={`bw_${index}_title`}
                        defaultValue={item.title ?? ""}
                        placeholder="Заголовок (напр. Дихаючі тканини)"
                        aria-label={`Заголовок блоку ${index + 1}`}
                        style={inputStyle}
                    />
                    <textarea
                        name={`bw_${index}_desc`}
                        defaultValue={item.desc ?? ""}
                        placeholder="Опис"
                        aria-label={`Опис блоку ${index + 1}`}
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
                    />

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            position: "relative",
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            name={`bw_${index}_video_file`}
                            accept="video/*"
                            onChange={handleChange}
                            tabIndex={-1}
                            style={{
                                position: "absolute",
                                left: 0,
                                bottom: 0,
                                width: "1px",
                                height: "1px",
                                opacity: 0,
                                pointerEvents: "none",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 14px",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: "8px",
                                color: "#e2e8f0",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                            }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            Замінити відео
                        </button>
                        <span
                            style={{
                                fontSize: "12px",
                                color: fileName ? "#e2e8f0" : "#64748b",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                            }}
                        >
                            {fileName ?? "Поточне відео"}
                        </span>
                    </div>
                </div>
            </div>
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
