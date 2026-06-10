import { useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { ShopPage } from "@prisma/client";
import { ImageCropSelector } from "../ImageCropSelector";
import { shopPageLabel } from "../../../utils/shop-pages";

interface ShopBgEditorModalProps {
    /** Validated shop slug (taxonomy SHOP_SLUGS) whose hero is being edited. */
    slug: string;
    /** Existing ShopPage row, if any — seeds the crop position + image. */
    shopPage: ShopPage | undefined;
    fetcher: FetcherWithComponents<unknown>;
    onClose: () => void;
}

/**
 * Shop-page hero/background editor — centered dark modal with the crop
 * selector styled to mimic the real shop hero composition (breadcrumbs,
 * title, signature, stroke text). Extracted 1:1 from
 * app/routes/admin/slides.tsx (SE1). Mount with key={slug} so state re-seeds
 * per page. Submits intent "update_shop_page" via the shared fetcher.
 */
export function ShopBgEditorModal({ slug, shopPage, fetcher, onClose }: ShopBgEditorModalProps) {
    const [shopBgPos, setShopBgPos] = useState(shopPage?.heroImagePos || "50% 50% 1");
    const [shopBgImage] = useState(shopPage?.heroImage || "");

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                style={{
                    width: "90%",
                    maxWidth: "500px",
                    background: "#0f1216",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 50px 100px rgba(0,0,0,0.5)",
                    animation: "fadeIn 0.2s ease",
                }}
            >
                <div
                    style={{
                        padding: "20px 24px",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#161b22",
                        borderRadius: "16px 16px 0 0",
                    }}
                >
                    <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 600 }}>
                        Фон сторінки: {shopPageLabel(slug).title}
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label="Закрити"
                        style={{
                            color: "#94a3b8",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div style={{ padding: "24px" }}>
                    <fetcher.Form
                        method="post"
                        encType="multipart/form-data"
                        onSubmit={() => setTimeout(onClose, 500)}
                    >
                        <input type="hidden" name="intent" value="update_shop_page" />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="currentHeroImage" value={shopBgImage} />

                        <div style={{ marginBottom: "12px", fontSize: "13px", color: "#94a3b8" }}>
                            Завантажте фото та налаштуйте його відображення.
                        </div>

                        <ImageCropSelector
                            currentImageUrl={
                                shopBgImage || "https://placehold.co/1200x600/1e293b/FFF"
                            }
                            fileInputName="heroImageFile"
                            value={shopBgPos}
                            onChange={setShopBgPos}
                            aspectRatio="16/5"
                            overlay={
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        pointerEvents: "none",
                                        zIndex: 1,
                                    }}
                                >
                                    {/* Dark gradient overlay — exactly like the real page */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            background:
                                                "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.5) 100%)",
                                        }}
                                    />

                                    {/* Grain texture */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            opacity: 0.06,
                                            backgroundImage:
                                                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                                            backgroundSize: "128px 128px",
                                        }}
                                    />

                                    {/* Breadcrumbs */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "16%",
                                            left: "8%",
                                            display: "flex",
                                            gap: "6px",
                                            alignItems: "center",
                                            fontSize: "8px",
                                            letterSpacing: "0.15em",
                                            textTransform: "uppercase",
                                            color: "rgba(255,255,255,0.5)",
                                            fontFamily: "DM Sans, sans-serif",
                                        }}
                                    >
                                        <span>Головна</span>
                                        <span style={{ opacity: 0.4 }}>/</span>
                                        <span style={{ color: "rgba(255,255,255,0.7)" }}>
                                            Магазин
                                        </span>
                                    </div>

                                    {/* Hero composition — title + signature */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: "12%",
                                            left: "8%",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "6px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: "28px",
                                                fontWeight: 300,
                                                color: "#fff",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.12em",
                                                fontFamily: "Italiana, serif",
                                                lineHeight: 1.1,
                                            }}
                                        >
                                            {shopPageLabel(slug).title.toUpperCase()}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "10px",
                                                letterSpacing: "0.25em",
                                                color: "rgba(255,255,255,0.45)",
                                                textTransform: "uppercase",
                                                fontFamily: "DM Sans, sans-serif",
                                            }}
                                        >
                                            колекція
                                        </div>

                                        {/* Signature line */}
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                                marginTop: "8px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "24px",
                                                    height: "1px",
                                                    background: "rgba(255,255,255,0.2)",
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: "9px",
                                                    letterSpacing: "0.3em",
                                                    color: "rgba(255,255,255,0.35)",
                                                    textTransform: "uppercase",
                                                    fontFamily: "DM Sans, sans-serif",
                                                }}
                                            >
                                                mind body
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tagline accent - right side */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            bottom: "20%",
                                            right: "8%",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "16px",
                                                height: "1px",
                                                background: "rgba(255,255,255,0.15)",
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontSize: "8px",
                                                letterSpacing: "0.15em",
                                                color: "rgba(255,255,255,0.3)",
                                                textTransform: "uppercase",
                                                fontFamily: "DM Sans, sans-serif",
                                            }}
                                        >
                                            {shopPageLabel(slug).tagline}
                                        </span>
                                        <div
                                            style={{
                                                width: "16px",
                                                height: "1px",
                                                background: "rgba(255,255,255,0.15)",
                                            }}
                                        />
                                    </div>

                                    {/* Decorative stroke text — faint background */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "50%",
                                            left: "50%",
                                            transform: "translate(-50%, -50%)",
                                            fontSize: "60px",
                                            fontWeight: 800,
                                            textTransform: "uppercase",
                                            fontFamily: "Italiana, serif",
                                            color: "transparent",
                                            WebkitTextStroke: "1px rgba(255,255,255,0.06)",
                                            letterSpacing: "0.1em",
                                            whiteSpace: "nowrap",
                                            userSelect: "none",
                                        }}
                                    >
                                        {shopPageLabel(slug).stroke}
                                    </div>
                                </div>
                            }
                        />

                        <button
                            type="submit"
                            disabled={fetcher.state !== "idle"}
                            style={{
                                width: "100%",
                                padding: "14px",
                                borderRadius: "8px",
                                background: "var(--accent-primary)",
                                color: "#000",
                                border: "none",
                                fontWeight: "bold",
                                fontSize: "13px",
                                cursor: "pointer",
                                marginTop: "16px",
                            }}
                        >
                            {fetcher.state !== "idle" ? "Збереження..." : "Зберегти фон"}
                        </button>
                    </fetcher.Form>
                </div>
            </div>
        </div>
    );
}
