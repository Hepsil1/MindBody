import type { Route } from "./+types/slides";
import { prisma } from "../../db.server";
import { useState, useRef, useEffect } from "react";
import { useLoaderData, useFetcher, Link, useSearchParams } from "react-router";
import { validateFilterConfig } from "../../utils/filters";
import { FilterEditorModal } from "../../components/admin/FilterEditorModal";
import { AboutSlidesModal } from "../../components/admin/AboutSlidesModal";
import { SlideManagerPanel } from "../../components/admin/editor/SlideManagerPanel";
import { CategoryManagerPanel } from "../../components/admin/editor/CategoryManagerPanel";
import { ShopBgEditorModal } from "../../components/admin/editor/ShopBgEditorModal";
import {
    EditorToolbar,
    TOOLBAR_BUTTON_STYLE,
    TOOLBAR_BUTTON_PRIMARY_STYLE,
} from "../../components/admin/editor/EditorToolbar";
import { useActionToast } from "../../components/admin/useActionToast";
import { SHOP_SLUGS } from "../../utils/taxonomy";
import { SHOP_PAGE_OPTIONS, shopPageTitle } from "../../utils/shop-pages";

export async function loader({ request }: Route.LoaderArgs) {
    // Defense-in-depth: the _layout loader already redirects unauthenticated
    // requests, but guard here too (consistency with orders/$id, customers/$id).
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        // Run all queries in parallel for speed
        const [allSlides, categories, shopPages, filterConfigs] = await Promise.all([
            prisma.slide.findMany({ orderBy: { order: "asc" } }),
            prisma.category.findMany({ orderBy: { order: "asc" } }),
            prisma.shopPage.findMany(),
            prisma.filterConfig.findMany(),
        ]);

        // Slide.page is NOT NULL (default 'home'), so a simple equality split works.
        const slides = allSlides.filter((s) => s.page === "home");
        const aboutSlides = allSlides.filter((s) => s.page === "about");

        return { slides, categories, shopPages, filterConfigs, aboutSlides };
    } catch (error) {
        console.error("Loader error:", error);
        return { slides: [], categories: [], shopPages: [], filterConfigs: [], aboutSlides: [] };
    }
}

import { uploadFileChecked } from "../../utils/upload.server";
import { requireAdmin } from "../../utils/admin-guard.server";
import { invalidateCache, invalidatePrefix } from "../../utils/cache.server";
import { actionOk, actionError } from "../../utils/action-result.server";

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    // Every branch returns a structural ActionResult ({ ok, toast?, error? }) —
    // the editor client reads `data.ok` (preview reload / modal close gates) and
    // useActionToast fires the attached toast. Legacy `{ success }` is gone.
    const saved = () => actionOk(undefined, { type: "success", message: "Збережено" });
    // Cache is invalidated per-intent on SUCCESS (see each branch) rather than a
    // blanket invalidateAll() up front: the old call cleared every cached surface
    // (home + all shop pages) on every submit — even validation failures and
    // unknown intents — re-running 3+ Prisma queries for unrelated pages. The
    // read keys are: home:slides, home:categories (home.tsx) and the shop pages'
    // TWO-LAYER namespace — shop:{slug} (route loader) wrapping
    // shop:{slug}:{sub|all} (loadShopData) — hence invalidatePrefix, which
    // clears the key AND its sub-keys so the preview reload can't serve stale
    // inner-cache data. /about is uncached, so about-slide edits invalidate
    // nothing.
    // Resolve an uploaded image field: keep `current` when no file was chosen,
    // use the new path on success, and ABORT the save (throw → caught below,
    // returns an ActionError) when a chosen file fails to process. Previously a
    // failed upload was silently swallowed and the record saved with a
    // stale/empty image. `label` names the field in the error so the operator
    // knows WHICH image failed (e.g. a triptych has three — "Фото 2: …" beats a
    // bare reason).
    const resolveImage = async (
        file: FormDataEntryValue | null,
        current: string,
        label: string,
    ): Promise<string> => {
        const outcome = await uploadFileChecked(file);
        if (outcome.status === "error") throw new Error(`${label}: ${outcome.reason}`);
        return outcome.status === "ok" ? outcome.path : current;
    };
    // Image focal positions are free-form strings that end up in CSS
    // object-position / background-position. Accept only keyword/percent pairs
    // with an optional scale ("center center", "50% 30%", "50% 30% 1.2") and
    // silently normalize anything else to `fallback` — never block a save over
    // a stale position value, but never let garbage reach the storefront CSS.
    const POS_RE =
        /^(?:left|center|right|top|bottom|\d{1,3}%)\s+(?:left|center|right|top|bottom|\d{1,3}%)(?:\s+\d*\.?\d+)?$/;
    const normalizePos = (raw: FormDataEntryValue | null, fallback: string): string => {
        const value = typeof raw === "string" ? raw.trim() : "";
        return POS_RE.test(value) ? value : fallback;
    };
    try {
        const formData = await request.formData();

        const intent = formData.get("intent");

        if (intent === "update_shop_page") {
            const slug = formData.get("slug") as string;
            // Only real shop slugs (taxonomy.ts) — never the legacy women/kids
            // phantom pages, which no storefront route reads.
            if (!SHOP_SLUGS.includes(slug)) {
                return actionError(`Невідома сторінка магазину "${slug}".`);
            }
            const heroImagePos = normalizePos(formData.get("heroImagePos"), "50% 50% 1");
            let heroImage = (formData.get("currentHeroImage") as string) || "";
            const file = formData.get("heroImageFile");

            heroImage = await resolveImage(file, heroImage, "Фонове зображення");
            if (!heroImage) {
                return actionError("Потрібне фонове зображення сторінки.");
            }

            // Upsert logic for shop page
            await prisma.shopPage.upsert({
                where: { slug },
                update: { heroImage, heroImagePos },
                create: {
                    slug,
                    heroImage,
                    heroImagePos,
                    title: shopPageTitle(slug),
                    subtitle: "колекція",
                },
            });
            invalidatePrefix(`shop:${slug}`);
            return saved();
        }

        if (intent === "create" || intent === "update") {
            const id = formData.get("id") as string;
            const name = (formData.get("name") as string) || "Без назви";
            const type = (formData.get("type") as string) || "triptych";
            const link = (formData.get("link") as string) || null;

            const image1Pos = normalizePos(formData.get("image1Pos"), "center center");
            const image2Pos = normalizePos(formData.get("image2Pos"), "center center");
            const image3Pos = normalizePos(formData.get("image3Pos"), "center center");

            let image1 = (formData.get("image1_url") as string) || "";
            let image2 = (formData.get("image2_url") as string) || "";
            let image3 = (formData.get("image3_url") as string) || "";

            const image1File = formData.get("image1_file");
            const image2File = formData.get("image2_file");
            const image3File = formData.get("image3_file");

            image1 = await resolveImage(image1File, image1, "Фото 1");
            image2 = await resolveImage(image2File, image2, "Фото 2");
            image3 = await resolveImage(image3File, image3, "Фото 3");

            if (!image1) {
                return actionError("Потрібне головне зображення (фото 1).");
            }
            if (type === "triptych" && (!image2 || !image3)) {
                return actionError("Триптих потребує 3 зображення (додайте фото 2 і 3).");
            }

            const slideData = {
                name,
                type,
                link: link || null,
                image1,
                image1Pos,
                image2: type === "single" ? null : image2 || null,
                image2Pos: type === "single" ? "center center" : image2Pos,
                image3: type === "single" ? null : image3 || null,
                image3Pos: type === "single" ? "center center" : image3Pos,
            };
            if (intent === "create") {
                const maxOrder = await prisma.slide.aggregate({ _max: { order: true } });
                const newOrder = (maxOrder._max.order ?? 0) + 1;
                await prisma.slide.create({
                    data: { ...slideData, page: "home", order: newOrder, isActive: true },
                });
            } else {
                await prisma.slide.update({ where: { id }, data: slideData });
            }
            invalidateCache("home:slides");
            return saved();
        }

        if (intent === "delete") {
            const id = formData.get("id") as string;
            try {
                await prisma.slide.delete({ where: { id } });
                invalidateCache("home:slides");
                return saved();
            } catch (error) {
                console.error("Failed to delete slide:", error);
                return actionError("Failed to delete");
            }
        }

        if (intent === "update_category") {
            const id = formData.get("id") as string;
            const title = (formData.get("title") as string) || "";
            const subtitle = (formData.get("subtitle") as string) || null;
            const link = (formData.get("link") as string) || "";
            const buttonText = (formData.get("buttonText") as string) || "Переглянути все";
            const imagePos = normalizePos(formData.get("imagePos"), "center center");

            // Batch 41: moodType is optional.  Empty string from the
            // dropdown ("Без mood") translates to NULL so the card
            // renders neutrally; only valid mood values get persisted.
            const moodRaw = (formData.get("moodType") as string) || "";
            const ALLOWED_MOODS = ["yoga", "sport", "dance", "casual", "kids"];
            const moodType = ALLOWED_MOODS.includes(moodRaw) ? moodRaw : null;

            let image = (formData.get("image_url") as string) || "";
            const imageFile = formData.get("image_file");

            image = await resolveImage(imageFile, image, "Зображення категорії");
            if (!image) {
                return actionError("Потрібне зображення категорії.");
            }

            await prisma.category.update({
                where: { id },
                data: { title, subtitle, link, buttonText, image, imagePos, moodType },
            });

            // Bust the home loader cache so the new mood shows up on
            // the next page render instead of waiting 60 s.
            invalidateCache("home:categories");

            return saved();
        }

        if (intent === "update_filters") {
            const config = formData.get("config") as string;
            const pageSlug = (formData.get("pageSlug") as string) || "global";
            // Only "global" or a real shop slug may hold a filter config — never a
            // phantom row (the storefront merges per-slug configs).
            if (pageSlug !== "global" && !SHOP_SLUGS.includes(pageSlug)) {
                return actionError(`Невідома сторінка "${pageSlug}".`);
            }
            // Reject malformed/invalid JSON before it silently rots in the DB
            // (the read path falls back to defaults, hiding the corruption).
            const valid = validateFilterConfig(config);
            if (!valid.ok) {
                return actionError(valid.error);
            }
            try {
                await prisma.filterConfig.upsert({
                    where: { id: pageSlug },
                    update: { config },
                    create: { id: pageSlug, config },
                });
            } catch (e) {
                console.error("FilterConfig update failed:", e);
                // Don't report success on a failed write — the product editor's
                // colour/size pickers read FilterConfig, so a silent failure
                // would build the next product against stale options.
                return actionError("Не вдалося зберегти фільтри");
            }
            // A per-shop config is read only by that shop's page; the global
            // config is the fallback for EVERY shop (loadShopData reads id IN
            // {slug, "global"}), so editing global must clear all shop caches.
            if (pageSlug === "global") {
                for (const s of SHOP_SLUGS) invalidatePrefix(`shop:${s}`);
            } else {
                invalidatePrefix(`shop:${pageSlug}`);
            }
            return saved();
        }

        // About Slides actions - use Slide model with page: "about"
        if (intent === "create_about_slide") {
            const name = (formData.get("name") as string) || "About Slide";
            const type = (formData.get("type") as string) || "triptych";

            let image1 = (formData.get("image1_url") as string) || "/pics1cloths/IMG_6201.JPG";
            let image2 = (formData.get("image2_url") as string) || "";
            let image3 = (formData.get("image3_url") as string) || "";

            const image1Pos = normalizePos(formData.get("image1Pos"), "center center");
            const image2Pos = normalizePos(formData.get("image2Pos"), "center center");
            const image3Pos = normalizePos(formData.get("image3Pos"), "center center");

            const image1File = formData.get("image1_file");
            const image2File = formData.get("image2_file");
            const image3File = formData.get("image3_file");

            image1 = await resolveImage(image1File, image1, "Фото 1");
            image2 = await resolveImage(image2File, image2, "Фото 2");
            image3 = await resolveImage(image3File, image3, "Фото 3");

            if (!image1) {
                return actionError("Потрібне головне зображення (фото 1).");
            }
            if (type === "triptych" && (!image2 || !image3)) {
                return actionError("Триптих потребує 3 зображення.");
            }

            const maxOrder = await prisma.slide.aggregate({ _max: { order: true } });
            const newOrder = (maxOrder._max.order ?? 0) + 1;

            await prisma.slide.create({
                data: {
                    name,
                    type,
                    page: "about",
                    image1,
                    image1Pos,
                    image2: image2 || null,
                    image2Pos,
                    image3: image3 || null,
                    image3Pos,
                    order: newOrder,
                    isActive: true,
                },
            });
            return saved();
        }

        if (intent === "update_about_slide") {
            const id = formData.get("id") as string;
            const name = (formData.get("name") as string) || "About Slide";
            const type = (formData.get("type") as string) || "triptych";

            const image1Pos = normalizePos(formData.get("image1Pos"), "center center");
            const image2Pos = normalizePos(formData.get("image2Pos"), "center center");
            const image3Pos = normalizePos(formData.get("image3Pos"), "center center");

            let image1 = (formData.get("image1_url") as string) || "";
            let image2 = (formData.get("image2_url") as string) || "";
            let image3 = (formData.get("image3_url") as string) || "";

            const image1File = formData.get("image1_file");
            const image2File = formData.get("image2_file");
            const image3File = formData.get("image3_file");

            image1 = await resolveImage(image1File, image1, "Фото 1");
            image2 = await resolveImage(image2File, image2, "Фото 2");
            image3 = await resolveImage(image3File, image3, "Фото 3");

            if (!image1) {
                return actionError("Потрібне головне зображення (фото 1).");
            }
            if (type === "triptych" && (!image2 || !image3)) {
                return actionError("Триптих потребує 3 зображення.");
            }

            await prisma.slide.update({
                where: { id },
                data: {
                    name,
                    type,
                    image1,
                    image1Pos,
                    image2: image2 || null,
                    image2Pos,
                    image3: image3 || null,
                    image3Pos,
                },
            });
            return saved();
        }

        if (intent === "delete_about_slide") {
            const id = formData.get("id") as string;
            await prisma.slide.delete({ where: { id } });
            return saved();
        }

        return actionError("Unknown intent");
    } catch (e) {
        console.error("Action error:", e);
        // Preserve thrown messages (resolveImage labels which photo failed) —
        // a generic wrapper would swallow "Фото 2: …".
        return actionError(e instanceof Error ? e.message : "Сталася серверна помилка");
    }
}

// One panel/modal can be open at a time — a discriminated union instead of
// five independent booleans, which let panels stack and block each other
// (the old shop-bg backdrop trapped clicks while a side panel was open).
type ActivePanel =
    | { kind: "slides" }
    | { kind: "categories" }
    | { kind: "filters" }
    | { kind: "about" }
    | { kind: "shopBg"; slug: string }
    | null;

/**
 * Visual site editor. Every view previews the REAL storefront page in an
 * iframe (`/?editor=1`, `/shop/{slug}?editor=1`, `/about`) under a persistent
 * toolbar — the old hand-built home replica (stale sections, "[Product Grid
 * Preview]" placeholder) is gone. Editable sections inside the preview render
 * click-to-edit affordances (see app/components/EditorAffordance.tsx) that
 * post bridge messages back here.
 */
export default function AdminVisualEditor() {
    const { slides, categories, shopPages, filterConfigs, aboutSlides } =
        useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    const [activePanel, setActivePanel] = useState<ActivePanel>(null);

    // Editor state lives in the URL (refreshable / shareable). `tab` = which
    // section, `shop` = which shop page the Shop tab previews/edits.
    const [searchParams, setSearchParams] = useSearchParams();
    const currentView = (searchParams.get("tab") as "home" | "shop" | "about") || "home";
    const activeShop = searchParams.get("shop") || SHOP_SLUGS[0];
    const setCurrentView = (view: "home" | "shop" | "about") => {
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.set("tab", view);
                if (view === "shop" && !p.get("shop")) p.set("shop", SHOP_SLUGS[0]);
                return p;
            },
            { preventScrollReset: true },
        );
    };
    const setActiveShop = (slug: string) => {
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.set("tab", "shop");
                p.set("shop", slug);
                return p;
            },
            { preventScrollReset: true },
        );
    };

    // Bumped after a successful save to force the preview iframe to reload.
    const [previewNonce, setPreviewNonce] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    // Preview scroll position captured right before a reload, restored on load.
    const savedScrollRef = useRef(0);

    // Storefront → editor bridge: validated dispatch map. Trust requires the
    // same origin AND our own preview iframe as the source (not another
    // same-origin tab/window), then a per-type payload whitelist.
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
            const msg = event.data as { type?: unknown; category?: unknown } | null;
            if (!msg || typeof msg.type !== "string") return;
            if (msg.type === "OPEN_SHOP_BG_EDITOR") {
                const slug = msg.category;
                if (typeof slug === "string" && SHOP_SLUGS.includes(slug)) {
                    setActivePanel({ kind: "shopBg", slug });
                }
            } else if (msg.type === "OPEN_HOME_SLIDES_EDITOR") {
                setActivePanel({ kind: "slides" });
            } else if (msg.type === "OPEN_HOME_CATEGORIES_EDITOR") {
                setActivePanel({ kind: "categories" });
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // Reload the preview after any successful save — capturing its scroll
    // position first so the operator doesn't lose their place (same-origin
    // access is legal under the iframe's allow-same-origin sandbox).
    useEffect(() => {
        if (fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
            try {
                savedScrollRef.current = iframeRef.current?.contentWindow?.scrollY ?? 0;
            } catch {
                savedScrollRef.current = 0;
            }
            setPreviewNonce((n) => n + 1);
        }
    }, [fetcher.data]);

    const restorePreviewScroll = () => {
        const w = iframeRef.current?.contentWindow;
        const y = savedScrollRef.current;
        if (!w || !y) return;
        const apply = () => {
            try {
                w.scrollTo(0, y);
            } catch {
                /* preview navigated cross-origin — nothing to restore */
            }
        };
        apply();
        // Lazy images shift layout once shortly after load — re-apply.
        window.setTimeout(apply, 300);
    };

    // Action results carry their toast payload (actionOk/actionError).
    useActionToast(fetcher.data);

    const previewSrc =
        currentView === "shop"
            ? `/shop/${activeShop}?editor=1`
            : currentView === "about"
              ? "/about"
              : "/?editor=1";
    const openSiteHref =
        currentView === "shop" ? `/shop/${activeShop}` : currentView === "about" ? "/about" : "/";

    const closePanel = () => setActivePanel(null);

    return (
        <div
            className="visual-editor-fullscreen"
            style={{ background: "#000", height: "100vh", overflow: "hidden" }}
        >
            {/* Sidebar - Fixed Position */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "240px",
                    background: "#0f1216",
                    borderRight: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    zIndex: 50,
                }}
            >
                <div
                    style={{
                        padding: "24px 20px",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                >
                    <div
                        style={{
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            color: "#64748b",
                            fontWeight: 600,
                        }}
                    >
                        Редактор сайту
                    </div>
                </div>
                <div
                    style={{
                        padding: "16px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        flex: 1,
                    }}
                >
                    <Link
                        to="/admin"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 16px",
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#94a3b8",
                            textDecoration: "none",
                            fontSize: "13px",
                            fontWeight: 500,
                            marginBottom: "12px",
                            transition: "all 0.2s",
                        }}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M19 12H5" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        В адмін-панель
                    </Link>

                    <button
                        onClick={() => setCurrentView("home")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 16px",
                            background:
                                currentView === "home" ? "rgba(94, 234, 212, 0.1)" : "transparent",
                            border: "1px solid",
                            borderColor:
                                currentView === "home" ? "rgba(94, 234, 212, 0.2)" : "transparent",
                            borderRadius: "8px",
                            color: currentView === "home" ? "var(--accent-primary)" : "#94a3b8",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 500,
                            transition: "all 0.2s",
                            outline: "none",
                        }}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Головна (Слайди)
                    </button>
                    <button
                        onClick={() => setCurrentView("shop")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 16px",
                            background:
                                currentView === "shop" ? "rgba(94, 234, 212, 0.1)" : "transparent",
                            border: "1px solid",
                            borderColor:
                                currentView === "shop" ? "rgba(94, 234, 212, 0.2)" : "transparent",
                            borderRadius: "8px",
                            color: currentView === "shop" ? "var(--accent-primary)" : "#94a3b8",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 500,
                            transition: "all 0.2s",
                            outline: "none",
                        }}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        Магазин (Категорії)
                    </button>
                    <button
                        onClick={() => setCurrentView("about")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 16px",
                            background:
                                currentView === "about" ? "rgba(94, 234, 212, 0.1)" : "transparent",
                            border: "1px solid",
                            borderColor:
                                currentView === "about" ? "rgba(94, 234, 212, 0.2)" : "transparent",
                            borderRadius: "8px",
                            color: currentView === "about" ? "var(--accent-primary)" : "#94a3b8",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 500,
                            transition: "all 0.2s",
                            outline: "none",
                        }}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        Про бренд
                    </button>
                    <button
                        onClick={() => window.open("/", "_blank")}
                        style={{
                            marginTop: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 16px",
                            background: "transparent",
                            border: "1px solid transparent",
                            borderRadius: "8px",
                            color: "#64748b",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 500,
                            transition: "all 0.2s",
                            outline: "none",
                        }}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Відкрити сайт
                    </button>
                </div>
            </div>

            {/* Main area: persistent toolbar + the live storefront preview */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: "240px",
                    right: 0,
                    bottom: 0,
                    background: "#fff",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <EditorToolbar
                    siteUrl={openSiteHref}
                    onRefresh={() => setPreviewNonce((n) => n + 1)}
                >
                    {currentView === "home" && (
                        <>
                            <button
                                type="button"
                                style={TOOLBAR_BUTTON_PRIMARY_STYLE}
                                onClick={() => setActivePanel({ kind: "slides" })}
                            >
                                Слайди
                            </button>
                            <button
                                type="button"
                                style={TOOLBAR_BUTTON_STYLE}
                                onClick={() => setActivePanel({ kind: "categories" })}
                            >
                                Категорії
                            </button>
                        </>
                    )}
                    {currentView === "shop" && (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "4px",
                                    background: "rgba(255,255,255,0.04)",
                                    padding: "4px",
                                    borderRadius: "20px",
                                    border: "1px solid rgba(148, 163, 184, 0.2)",
                                }}
                            >
                                {SHOP_PAGE_OPTIONS.map((o) => (
                                    <button
                                        key={o.slug}
                                        type="button"
                                        onClick={() => setActiveShop(o.slug)}
                                        style={{
                                            padding: "5px 12px",
                                            borderRadius: "16px",
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            letterSpacing: "0.03em",
                                            background:
                                                o.slug === activeShop
                                                    ? "var(--accent-primary)"
                                                    : "transparent",
                                            color: o.slug === activeShop ? "#000" : "#cbd5e1",
                                            transition: "all 0.15s",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {o.title}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                style={TOOLBAR_BUTTON_PRIMARY_STYLE}
                                onClick={() => setActivePanel({ kind: "shopBg", slug: activeShop })}
                            >
                                Змінити фон
                            </button>
                            <button
                                type="button"
                                style={TOOLBAR_BUTTON_STYLE}
                                onClick={() => setActivePanel({ kind: "filters" })}
                            >
                                Фільтри
                            </button>
                        </>
                    )}
                    {currentView === "about" && (
                        <button
                            type="button"
                            style={TOOLBAR_BUTTON_PRIMARY_STYLE}
                            onClick={() => setActivePanel({ kind: "about" })}
                        >
                            Редагувати слайди
                        </button>
                    )}
                </EditorToolbar>

                <iframe
                    ref={iframeRef}
                    key={`${currentView}-${activeShop}-${previewNonce}`}
                    src={previewSrc}
                    onLoad={restorePreviewScroll}
                    style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
                    title="Перегляд сайту"
                    // Same-origin storefront preview: allow its scripts +
                    // same-origin (hydration + the postMessage bridge) but block
                    // top-navigation, popups and forms so a storefront bug can't
                    // drive the admin UI.
                    sandbox="allow-scripts allow-same-origin"
                />
            </div>

            {/* --- Panels / modals (exactly one open — activePanel union) --- */}
            {activePanel?.kind === "slides" && (
                <SlideManagerPanel slides={slides} fetcher={fetcher} onClose={closePanel} />
            )}
            {activePanel?.kind === "categories" && (
                <CategoryManagerPanel
                    categories={categories}
                    fetcher={fetcher}
                    onClose={closePanel}
                />
            )}
            {activePanel?.kind === "shopBg" && (
                <ShopBgEditorModal
                    key={activePanel.slug}
                    slug={activePanel.slug}
                    shopPage={(shopPages || []).find((p) => p.slug === activePanel.slug)}
                    fetcher={fetcher}
                    onClose={closePanel}
                />
            )}
            {activePanel?.kind === "filters" && (
                <FilterEditorModal
                    isOpen
                    onClose={closePanel}
                    filterConfigs={filterConfigs}
                    shopPages={shopPages}
                    fetcher={fetcher}
                />
            )}
            {activePanel?.kind === "about" && (
                <AboutSlidesModal
                    isOpen
                    onClose={closePanel}
                    slides={aboutSlides}
                    fetcher={fetcher}
                />
            )}
        </div>
    );
}
