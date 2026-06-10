import type { Route } from "./+types/slides";
import { prisma } from "../../db.server";
import { useState, useRef, useEffect } from "react";
import { useLoaderData, useFetcher, Link, useSearchParams } from "react-router";
import HeroSlider, { type SlideData } from "../../components/HeroSlider";
import CategoryCard from "../../components/CategoryCard";
import { validateFilterConfig } from "../../utils/filters";
import { FilterEditorModal } from "../../components/admin/FilterEditorModal";
import { AboutSlidesModal } from "../../components/admin/AboutSlidesModal";
import { SlideManagerPanel } from "../../components/admin/editor/SlideManagerPanel";
import { CategoryManagerPanel } from "../../components/admin/editor/CategoryManagerPanel";
import { ShopBgEditorModal } from "../../components/admin/editor/ShopBgEditorModal";
import { ShopView } from "../../components/admin/editor/ShopView";
import { AboutView } from "../../components/admin/editor/AboutView";
import { useActionToast } from "../../components/admin/useActionToast";
import { SHOP_SLUGS } from "../../utils/taxonomy";
import { shopPageTitle } from "../../utils/shop-pages";
import homeStyles from "../../styles/home.css?url";

export function links() {
    return [{ rel: "stylesheet", href: homeStyles }];
}

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
import { invalidateCache } from "../../utils/cache.server";
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
    // read keys are: home:slides, home:categories (home.tsx) and shop:{slug}
    // (shop.$category.tsx → loadShopData, which holds both the shop's FilterConfig
    // and its hero). /about is uncached, so about-slide edits invalidate nothing.
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
            invalidateCache(`shop:${slug}`);
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
                for (const s of SHOP_SLUGS) invalidateCache(`shop:${s}`);
            } else {
                invalidateCache(`shop:${pageSlug}`);
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

// The slide/category panels, the shop-bg modal and the shop/about iframe views
// live in app/components/admin/editor/ (SE1 split). This route keeps the
// loader/action, the sidebar shell and the legacy home replica (replaced by a
// real /?editor=1 iframe in SE2).

export default function AdminVisualEditor() {
    const { slides, categories, shopPages, filterConfigs, aboutSlides } =
        useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();

    // UI State
    const [managerOpen, setManagerOpen] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [aboutSlidesOpen, setAboutSlidesOpen] = useState(false);

    // Editor state lives in the URL (refreshable / shareable). `tab` = which
    // section, `shop` = which shop page the Shop tab previews/edits. setCurrentView
    // keeps the same signature the sidebar tabs already call.
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

    // --- Shop page background editor (opened from the toolbar or the in-iframe
    // storefront button via postMessage) ---
    const [editingShopPageSlug, setEditingShopPageSlug] = useState<string | null>(null);
    // Bumped after a successful save to force the preview iframe to reload.
    const [previewNonce, setPreviewNonce] = useState(0);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Only trust messages from our own storefront (same origin) — closes
            // the wildcard '*' gap.
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === "OPEN_SHOP_BG_EDITOR") {
                // Never trust an arbitrary string from a postMessage, even
                // same-origin — only open the editor for a real shop slug.
                const slug = event.data.category;
                if (typeof slug === "string" && SHOP_SLUGS.includes(slug)) {
                    setEditingShopPageSlug(slug);
                }
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // Reload the preview iframe after any successful save so edits show at once.
    useEffect(() => {
        if (fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
            setPreviewNonce((n) => n + 1);
        }
    }, [fetcher.data]);

    // Action results carry their toast payload (actionOk/actionError).
    useActionToast(fetcher.data);

    const closeShopEditor = () => setEditingShopPageSlug(null);

    // Scroll Logic for "Visual" background
    const contentScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scrollContainer = contentScrollRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            // Use plain querySelector inside the route container, or scoped ref if possible.
            // But existing code uses querySelector globally on document.
            // We'll keep it simple: selector finds the element inside the page.
            const section = document.querySelector(".values-modern") as HTMLElement;
            const bgElement = document.querySelector(
                ".values-modern .values-premium__bg-image",
            ) as HTMLElement;

            if (section && bgElement) {
                // Get rect relative to viewport. This works fine with internal scrolling.
                const rect = section.getBoundingClientRect();
                const sectionCenter = rect.top + rect.height / 2;
                const viewportCenter = window.innerHeight / 2;
                const offset = (sectionCenter - viewportCenter) * 0.4;
                bgElement.style.transform = `translateY(${offset}px)`;
            }
        };

        scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }, []);

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

            {/* Main Content Area - Identical Layout for both views */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: "240px",
                    right: 0,
                    bottom: 0,
                    background: "#fff",
                    overflow: "hidden",
                }}
            >
                {currentView === "shop" ? (
                    <ShopView
                        activeShop={activeShop}
                        previewNonce={previewNonce}
                        onSelectShop={setActiveShop}
                        onEditBg={() => setEditingShopPageSlug(activeShop)}
                        onEditFilters={() => setFiltersOpen(true)}
                    />
                ) : currentView === "about" ? (
                    <AboutView
                        previewNonce={previewNonce}
                        onEditSlides={() => setAboutSlidesOpen(true)}
                    />
                ) : (
                    <div
                        ref={contentScrollRef}
                        className="visual-editor-container"
                        style={{
                            background: "var(--color-bg-cream)",
                            height: "100%",
                            width: "100%",
                            overflowY: "auto",
                            position: "relative",
                        }}
                    >
                        {/* --- VISUAL SITE BACKGROUND ---
                            Legacy hand-built replica of the home page (hero +
                            categories + stale sections). SE2 replaces this whole
                            block with the real / page in an iframe. */}
                        <div
                            style={{
                                position: "relative",
                                opacity: managerOpen ? 0.4 : 1,
                                transition: "opacity 0.3s",
                                pointerEvents: managerOpen ? "none" : "auto",
                            }}
                        >
                            {/* Prisma types Slide.type as plain string; SlideData narrows it
                                to the "triptych" | "single" union the DB actually holds. */}
                            <HeroSlider slides={slides as unknown as SlideData[]} />

                            {/* Categories */}
                            <section className="categories section" id="shop">
                                <div className="container">
                                    <div className="section__header">
                                        <h2 className="section__title">Обирайте свій стиль</h2>
                                        <p className="section__subtitle">
                                            Колекції для активного способу життя
                                        </p>
                                    </div>
                                    <div className="categories__grid">
                                        {categories.map((cat) => (
                                            <CategoryCard
                                                key={cat.id}
                                                title={cat.title}
                                                subtitle={cat.subtitle ?? ""}
                                                image={cat.image}
                                                imagePos={cat.imagePos ?? undefined}
                                                link={cat.link}
                                                buttonText={cat.buttonText}
                                                moodType={cat.moodType}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* New Collections Preview */}
                            <section
                                className="section section--alt new-arrivals"
                                id="new-collections"
                            >
                                <div className="logo-pattern-bg"></div>
                                <div className="container">
                                    <div className="section__header section__header--center">
                                        <span className="section__badge">Новинки 2025</span>
                                        <h2 className="section__title">Нові надходження</h2>
                                        <p className="section__subtitle">
                                            Сезонні новинки колекції для всієї родини
                                        </p>
                                    </div>

                                    <div
                                        style={{
                                            padding: "40px",
                                            textAlign: "center",
                                            color: "var(--text-muted)",
                                            border: "1px dashed rgba(255,255,255,0.1)",
                                            borderRadius: "12px",
                                        }}
                                    >
                                        [Product Grid Preview]
                                    </div>
                                </div>
                            </section>

                            {/* Values Section */}
                            <section className="section values-modern" id="values">
                                <div
                                    className="values-premium__bg-image"
                                    data-parallax="true"
                                ></div>
                                <div className="values-premium__overlay"></div>
                                <div className="logo-pattern-bg"></div>

                                <div className="container">
                                    <div className="values-modern__header">
                                        <span
                                            className="values-modern__signature"
                                            style={{
                                                fontFamily: "'Great Vibes', cursive",
                                                fontSize: "3.2rem",
                                                color: "#ffffff",
                                                textShadow: "0 2px 15px rgba(0,0,0,0.25)",
                                                fontWeight: 400,
                                            }}
                                        >
                                            Motivate for active life
                                        </span>
                                        <h3 className="values-modern__title">
                                            Що робить нас особливими
                                        </h3>
                                    </div>

                                    <div className="values-modern__grid">
                                        <div className="value-item">
                                            <div className="value-item__icon">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                >
                                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                </svg>
                                            </div>
                                            <div className="value-item__content">
                                                <h4 className="value-item__title">
                                                    Made with soul
                                                </h4>
                                                <p className="value-item__text">
                                                    Українська дух у кожному шві
                                                </p>
                                            </div>
                                        </div>
                                        <div className="value-item">
                                            <div className="value-item__icon">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                >
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 6v6l4 2" />
                                                </svg>
                                            </div>
                                            <div className="value-item__content">
                                                <h4 className="value-item__title">Breathable</h4>
                                                <p className="value-item__text">
                                                    Комфорт, що дихає разом з вами
                                                </p>
                                            </div>
                                        </div>
                                        <div className="value-item">
                                            <div className="value-item__icon">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                >
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                </svg>
                                            </div>
                                            <div className="value-item__content">
                                                <h4 className="value-item__title">Eco-friendly</h4>
                                                <p className="value-item__text">
                                                    Турбота про майбутнє планети
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* About Section */}
                            <section className="about-modern section" id="about">
                                <div className="logo-pattern-bg"></div>
                                <div className="container">
                                    <div className="about-modern__wrapper">
                                        <div className="about-modern__grid">
                                            <div className="about-modern__image-side">
                                                <div className="about-modern__image-container">
                                                    <img
                                                        src="/generalpics/338_131123.jpg"
                                                        alt="MIND BODY Lifestyle"
                                                        className="about-modern__image"
                                                    />
                                                    <div className="about-modern__image-overlay"></div>
                                                    <div className="about-modern__floating-badge">
                                                        <span className="about-modern__badge-text">
                                                            Est. 2024
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="about-modern__content-side">
                                                <div className="about-modern__header">
                                                    <span className="about-modern__tagline">
                                                        Про бренд
                                                    </span>
                                                    <h2 className="about-modern__title">
                                                        Подаруй собі <span>комфорт</span>
                                                    </h2>
                                                </div>
                                                <div className="about-modern__text-block">
                                                    <p className="about-modern__description">
                                                        MIND BODY &mdash; це більше, ніж просто
                                                        одяг. Це філософія гармонії між тілом та
                                                        розумом.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* --- CONTROL BUTTON --- */}
                        {!managerOpen && (
                            <button
                                onClick={() => setManagerOpen(true)}
                                style={{
                                    position: "absolute",
                                    top: "75vh",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    zIndex: 100,
                                    background: "var(--accent-primary)",
                                    color: "#000",
                                    border: "none",
                                    padding: "16px 32px",
                                    borderRadius: "40px",
                                    fontWeight: "bold",
                                    boxShadow: "0 8px 40px rgba(94, 234, 212, 0.5)",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    fontSize: "16px",
                                    transition: "all 0.3s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform =
                                        "translate(-50%, -50%) scale(1.05)";
                                    e.currentTarget.style.boxShadow =
                                        "0 12px 50px rgba(94, 234, 212, 0.6)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform =
                                        "translate(-50%, -50%) scale(1)";
                                    e.currentTarget.style.boxShadow =
                                        "0 8px 40px rgba(94, 234, 212, 0.5)";
                                }}
                            >
                                <svg
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Керування слайдами
                            </button>
                        )}

                        {/* --- CATEGORIES CONTROL BUTTON --- */}
                        {!categoriesOpen && (
                            <button
                                onClick={() => setCategoriesOpen(true)}
                                style={{
                                    position: "absolute",
                                    top: "1100px", // Positioning it above the categories section
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 100,
                                    background: "var(--accent-primary)",
                                    color: "#000",
                                    border: "none",
                                    padding: "12px 24px",
                                    borderRadius: "30px",
                                    fontWeight: "bold",
                                    boxShadow: "0 4px 20px rgba(94, 234, 212, 0.4)",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    fontSize: "14px",
                                    transition: "all 0.3s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform =
                                        "translateX(-50%) scale(1.05)";
                                    e.currentTarget.style.boxShadow =
                                        "0 10px 30px rgba(94, 234, 212, 0.6)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateX(-50%) scale(1)";
                                    e.currentTarget.style.boxShadow =
                                        "0 4px 20px rgba(94, 234, 212, 0.4)";
                                }}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Редагувати блоки категорій
                            </button>
                        )}

                        {/* --- CATEGORY MANAGER PANEL --- */}
                        {categoriesOpen && (
                            <CategoryManagerPanel
                                categories={categories}
                                fetcher={fetcher}
                                onClose={() => setCategoriesOpen(false)}
                            />
                        )}

                        {/* --- SLIDE MANAGER PANEL --- */}
                        {managerOpen && (
                            <SlideManagerPanel
                                slides={slides}
                                fetcher={fetcher}
                                onClose={() => setManagerOpen(false)}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* --- SHOP BACKGROUND EDITOR MODAL --- */}
            {editingShopPageSlug && (
                <ShopBgEditorModal
                    key={editingShopPageSlug}
                    slug={editingShopPageSlug}
                    shopPage={(shopPages || []).find((p) => p.slug === editingShopPageSlug)}
                    fetcher={fetcher}
                    onClose={closeShopEditor}
                />
            )}

            {/* --- FILTER CONFIG EDITOR MODAL --- */}
            {filtersOpen && (
                <FilterEditorModal
                    isOpen={filtersOpen}
                    onClose={() => setFiltersOpen(false)}
                    filterConfigs={filterConfigs}
                    shopPages={shopPages}
                    fetcher={fetcher}
                />
            )}

            {/* --- ABOUT SLIDES EDITOR MODAL --- */}
            {aboutSlidesOpen && (
                <AboutSlidesModal
                    isOpen={aboutSlidesOpen}
                    onClose={() => setAboutSlidesOpen(false)}
                    slides={aboutSlides}
                    fetcher={fetcher}
                />
            )}
        </div>
    );
}
