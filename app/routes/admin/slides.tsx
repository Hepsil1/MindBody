import type { Route } from "./+types/slides";
import { prisma } from "../../db.server";
import { useState, useRef, useEffect } from "react";
import { useLoaderData, useFetcher, Link, useSearchParams } from "react-router";
import HeroSlider, { type SlideData } from "../../components/HeroSlider";
import CategoryCard from "../../components/CategoryCard";
import { parseAndMergeFilterConfig, validateFilterConfig } from "../../utils/filters";
import { TrashIcon, ChevronDown, CloseIcon } from "../../components/admin/AdminIcons";
import { ImageCropSelector } from "../../components/admin/ImageCropSelector";
import { FilterEditorModal } from "../../components/admin/FilterEditorModal";
import { AboutSlidesModal } from "../../components/admin/AboutSlidesModal";
import { SHOP_SLUGS } from "../../utils/taxonomy";
import { SHOP_PAGE_OPTIONS, shopPageTitle, shopPageLabel } from "../../utils/shop-pages";
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
import { invalidateAll, invalidateCache } from "../../utils/cache.server";

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    // Clear home page cache on any admin change (slides, categories, filters)
    invalidateAll();
    // Resolve an uploaded image field: keep `current` when no file was chosen,
    // use the new path on success, and ABORT the save (throw → caught below,
    // returns { error }) when a chosen file fails to process. Previously a failed
    // upload was silently swallowed and the record saved with a stale/empty image.
    // `label` names the field in the error so the operator knows WHICH image
    // failed (e.g. a triptych has three — "Фото 2: …" beats a bare reason).
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
                return { error: `Невідома сторінка магазину "${slug}".` };
            }
            const heroImagePos = normalizePos(formData.get("heroImagePos"), "50% 50% 1");
            let heroImage = (formData.get("currentHeroImage") as string) || "";
            const file = formData.get("heroImageFile");

            heroImage = await resolveImage(file, heroImage, "Фонове зображення");
            if (!heroImage) {
                return { error: "Потрібне фонове зображення сторінки." };
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
            return { success: true };
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
                return { error: "Потрібне головне зображення (фото 1)." };
            }
            if (type === "triptych" && (!image2 || !image3)) {
                return { error: "Триптих потребує 3 зображення (додайте фото 2 і 3)." };
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
            return { success: true };
        }

        if (intent === "delete") {
            const id = formData.get("id") as string;
            try {
                await prisma.slide.delete({ where: { id } });
                return { success: true };
            } catch (error) {
                console.error("Failed to delete slide:", error);
                return { error: "Failed to delete" };
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
                return { error: "Потрібне зображення категорії." };
            }

            await prisma.category.update({
                where: { id },
                data: { title, subtitle, link, buttonText, image, imagePos, moodType },
            });

            // Bust the home loader cache so the new mood shows up on
            // the next page render instead of waiting 60 s.
            invalidateCache("home:categories");

            return { success: true };
        }

        if (intent === "update_filters") {
            const config = formData.get("config") as string;
            const pageSlug = (formData.get("pageSlug") as string) || "global";
            // Only "global" or a real shop slug may hold a filter config — never a
            // phantom row (the storefront merges per-slug configs).
            if (pageSlug !== "global" && !SHOP_SLUGS.includes(pageSlug)) {
                return { error: `Невідома сторінка "${pageSlug}".` };
            }
            // Reject malformed/invalid JSON before it silently rots in the DB
            // (the read path falls back to defaults, hiding the corruption).
            const valid = validateFilterConfig(config);
            if (!valid.ok) {
                return { error: valid.error };
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
                return { error: "Не вдалося зберегти фільтри" };
            }
            return { success: true };
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
                return { error: "Потрібне головне зображення (фото 1)." };
            }
            if (type === "triptych" && (!image2 || !image3)) {
                return { error: "Триптих потребує 3 зображення." };
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
            return { success: true };
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
                return { error: "Потрібне головне зображення (фото 1)." };
            }
            if (type === "triptych" && (!image2 || !image3)) {
                return { error: "Триптих потребує 3 зображення." };
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
            return { success: true };
        }

        if (intent === "delete_about_slide") {
            const id = formData.get("id") as string;
            await prisma.slide.delete({ where: { id } });
            return { success: true };
        }

        return { error: "Unknown intent" };
    } catch (e) {
        console.error("Action error:", e);
        return { error: e instanceof Error ? e.message : "Сталася серверна помилка" };
    }
}

// Icons + ImageCropSelector now live in app/components/admin/. Keep this
// file focused on the loader/action and the visual editor's own logic.

export default function AdminVisualEditor() {
    const { slides, categories, shopPages, filterConfigs, aboutSlides } =
        useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    // UI State
    const [managerOpen, setManagerOpen] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [aboutSlidesOpen, setAboutSlidesOpen] = useState(false);

    const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
    const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
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

    // Focal Point State
    const [positions, setPositions] = useState<Record<string, string>>({});

    const updatePos = (id: string, field: string, value: string) => {
        setPositions((prev) => ({ ...prev, [`${id}_${field}`]: value }));
    };

    // --- Listener for Shop Page Edit ---
    const [editingShopPageSlug, setEditingShopPageSlug] = useState<string | null>(null);

    // Derived state for the active shop page being edited (needs shopPages from loader)
    // const { shopPages } = useLoaderData<typeof loader>(); // REMOVED redundant call
    const activeShopPage = (shopPages || []).find((p) => p.slug === editingShopPageSlug);

    // Temp state for editing
    const [shopBgPos, setShopBgPos] = useState("50% 50% 1");
    const [shopBgImage, setShopBgImage] = useState("");
    // Bumped after a successful save to force the preview iframe to reload.
    const [previewNonce, setPreviewNonce] = useState(0);

    useEffect(() => {
        if (activeShopPage) {
            setShopBgPos(activeShopPage.heroImagePos);
            setShopBgImage(activeShopPage.heroImage);
        } else {
            // Defaults
            setShopBgPos("50% 50% 1");
            setShopBgImage("");
        }
    }, [activeShopPage]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Only trust messages from our own storefront (same origin) — closes
            // the wildcard '*' gap.
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === "OPEN_SHOP_BG_EDITOR") {
                const slug = event.data.category;
                setEditingShopPageSlug(slug);
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    // Reload the preview iframe after any successful save so edits show at once.
    useEffect(() => {
        if ((fetcher.data as { success?: boolean } | undefined)?.success) {
            setPreviewNonce((n) => n + 1);
        }
    }, [fetcher.data]);

    const closeShopEditor = () => setEditingShopPageSlug(null);
    // Screenshot shows "ADD NEW SLIDE" as a section, so let's keep it visible at the bottom of the list.

    const [newSlideType, setNewSlideType] = useState<"triptych" | "single">("triptych");
    const [editingSlideType, setEditingSlideType] = useState<"triptych" | "single">("triptych");

    // Scroll Logic for "Visual" background
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

    // Toggle slide expansion
    const toggleSlide = (id: string, type: "triptych" | "single") => {
        if (expandedSlideId === id) {
            setExpandedSlideId(null);
        } else {
            setExpandedSlideId(id);
            setEditingSlideType(type);
        }
    };

    // Toast feedback on submit (replaces a blocking alert()).
    useEffect(() => {
        if (fetcher.state !== "idle" || !fetcher.data) return;
        if (fetcher.data.success) {
            (document.getElementById("create-slide-form") as HTMLFormElement)?.reset();
            void import("sonner").then(({ toast }) => toast.success("Збережено"));
        } else if (fetcher.data.error) {
            const msg = String(fetcher.data.error);
            void import("sonner").then(({ toast }) => toast.error(msg));
        }
    }, [fetcher.state, fetcher.data]);

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
                    <div style={{ width: "100%", height: "100%", position: "relative" }}>
                        {/* Top overlay: real-shop selector + actions */}
                        <div
                            style={{
                                position: "absolute",
                                top: "16px",
                                left: "16px",
                                right: "16px",
                                zIndex: 10,
                                display: "flex",
                                gap: "10px",
                                alignItems: "center",
                                flexWrap: "wrap",
                                pointerEvents: "auto",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    gap: "4px",
                                    flexWrap: "wrap",
                                    background: "rgba(15, 23, 42, 0.85)",
                                    backdropFilter: "blur(8px)",
                                    padding: "5px",
                                    borderRadius: "24px",
                                    border: "1px solid rgba(148, 163, 184, 0.2)",
                                }}
                            >
                                {SHOP_PAGE_OPTIONS.map((o) => (
                                    <button
                                        key={o.slug}
                                        onClick={() => setActiveShop(o.slug)}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: "18px",
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
                                        }}
                                    >
                                        {o.title}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setEditingShopPageSlug(activeShop)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 16px",
                                    background: "var(--accent-primary)",
                                    border: "none",
                                    borderRadius: "20px",
                                    color: "#000",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    boxShadow: "0 8px 20px rgba(94, 234, 212, 0.4)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                Змінити фон
                            </button>
                            <button
                                onClick={() => setFiltersOpen(true)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 16px",
                                    background: "rgba(15, 23, 42, 0.85)",
                                    backdropFilter: "blur(8px)",
                                    border: "1px solid rgba(148, 163, 184, 0.3)",
                                    borderRadius: "20px",
                                    color: "#e2e8f0",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                Редагувати фільтри
                            </button>
                        </div>

                        <iframe
                            key={`${activeShop}-${previewNonce}`}
                            src={`/shop/${activeShop}`}
                            style={{ width: "100%", height: "100%", border: "none" }}
                            title="Shop Preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>
                ) : currentView === "about" ? (
                    <div style={{ width: "100%", height: "100%", position: "relative" }}>
                        {/* Edit About Slides Button Overlay */}
                        <div
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 10,
                                pointerEvents: "auto",
                            }}
                        >
                            <button
                                onClick={() => setAboutSlidesOpen(true)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "12px 24px",
                                    background: "var(--accent-primary)",
                                    border: "none",
                                    borderRadius: "24px",
                                    color: "#000",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    boxShadow: "0 8px 32px rgba(94, 234, 212, 0.5)",
                                    transition: "all 0.2s",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                                onMouseOver={(e) =>
                                    (e.currentTarget.style.transform = "scale(1.05)")
                                }
                                onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Редагувати слайди
                            </button>
                        </div>

                        <iframe
                            key={`about-${previewNonce}`}
                            src="/about"
                            style={{ width: "100%", height: "100%", border: "none" }}
                            title="About Preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>
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
                        {/* --- VISUAL SITE BACKGROUND --- */}
                        <div
                            style={{
                                position: "relative",
                                opacity: managerOpen ? 0.4 : 1,
                                transition: "opacity 0.3s",
                                pointerEvents: managerOpen ? "none" : "auto",
                            }}
                        >
                            <HeroSlider slides={slides as any} />

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
                                        {categories.map((cat: any) => (
                                            <CategoryCard
                                                key={cat.id}
                                                title={cat.title}
                                                subtitle={cat.subtitle}
                                                image={cat.image}
                                                imagePos={cat.imagePos}
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

                        {/* --- CATEGORY MANAGER MODAL --- */}
                        {categoriesOpen && (
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
                                <div
                                    style={{
                                        padding: "20px 24px",
                                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <h2
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: 500,
                                            margin: 0,
                                            color: "#fff",
                                        }}
                                    >
                                        Редагування категорій
                                    </h2>
                                    <button
                                        onClick={() => setCategoriesOpen(false)}
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
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "16px",
                                        }}
                                    >
                                        {categories.map((cat: any) => (
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
                                                            expandedCategoryId === cat.id
                                                                ? null
                                                                : cat.id,
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
                                                            style={{
                                                                color: "#fff",
                                                                fontSize: "14px",
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            {cat.title}
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: "#64748b",
                                                                fontSize: "12px",
                                                            }}
                                                        >
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
                                                            borderTop:
                                                                "1px solid rgba(255,255,255,0.05)",
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
                                                            <input
                                                                type="hidden"
                                                                name="id"
                                                                value={cat.id}
                                                            />

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
                                                                    defaultValue={cat.subtitle}
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
                                                                    defaultValue={
                                                                        (
                                                                            cat as {
                                                                                moodType?:
                                                                                    | string
                                                                                    | null;
                                                                            }
                                                                        ).moodType || ""
                                                                    }
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
                                                                        Без mood (стандартний
                                                                        вигляд)
                                                                    </option>
                                                                    <option value="yoga">
                                                                        Yoga — calm teal, light
                                                                        Cormorant
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
                                                                    Yoga додає легкий теал-tint та
                                                                    витончений Cormorant — у дусі
                                                                    Sézane / Cuyana.
                                                                </small>
                                                            </div>

                                                            <ImageCropSelector
                                                                currentImageUrl={cat.image}
                                                                fileInputName="image_file"
                                                                value={
                                                                    positions[
                                                                        `${cat.id}_imagePos`
                                                                    ] ||
                                                                    (cat as any).imagePos ||
                                                                    "center center"
                                                                }
                                                                onChange={(val: string) =>
                                                                    updatePos(
                                                                        cat.id,
                                                                        "imagePos",
                                                                        val,
                                                                    )
                                                                }
                                                                aspectRatio="400/380"
                                                                overlay={
                                                                    <>
                                                                        <div
                                                                            className="category-card__overlay"
                                                                            style={{
                                                                                pointerEvents:
                                                                                    "none",
                                                                                position:
                                                                                    "absolute",
                                                                                inset: 0,
                                                                                zIndex: 2,
                                                                            }}
                                                                        ></div>
                                                                        <div
                                                                            className="category-card__content"
                                                                            style={{
                                                                                pointerEvents:
                                                                                    "none",
                                                                                position:
                                                                                    "absolute",
                                                                                inset: 0,
                                                                                zIndex: 3,
                                                                                display: "flex",
                                                                                flexDirection:
                                                                                    "column",
                                                                                justifyContent:
                                                                                    "flex-end",
                                                                                padding: "40px",
                                                                                textAlign: "left",
                                                                            }}
                                                                        >
                                                                            <p
                                                                                className="category-card__count"
                                                                                style={{
                                                                                    display: "flex",
                                                                                    alignItems:
                                                                                        "center",
                                                                                    gap: "12px",
                                                                                    fontSize:
                                                                                        "13px",
                                                                                    letterSpacing:
                                                                                        "0.2em",
                                                                                    textTransform:
                                                                                        "uppercase",
                                                                                    margin: 0,
                                                                                }}
                                                                            >
                                                                                {cat.subtitle ||
                                                                                    "ДЛЯ ВАС"}
                                                                            </p>
                                                                            <h3
                                                                                className="category-card__title"
                                                                                style={{
                                                                                    fontSize:
                                                                                        "32px",
                                                                                    marginBottom:
                                                                                        "8px",
                                                                                    textTransform:
                                                                                        "uppercase",
                                                                                    marginTop:
                                                                                        "8px",
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            >
                                                                                {cat.title}
                                                                            </h3>
                                                                            <div
                                                                                className="category-card__shop-now"
                                                                                style={{
                                                                                    marginTop:
                                                                                        "24px",
                                                                                    fontSize:
                                                                                        "11px",
                                                                                    fontWeight: 700,
                                                                                    textTransform:
                                                                                        "uppercase",
                                                                                    padding:
                                                                                        "12px 28px",
                                                                                    background:
                                                                                        "rgba(255, 255, 255, 0.15)",
                                                                                    backdropFilter:
                                                                                        "blur(12px)",
                                                                                    width: "fit-content",
                                                                                    borderRadius:
                                                                                        "30px",
                                                                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                                                                    opacity: 1,
                                                                                    transform:
                                                                                        "none",
                                                                                }}
                                                                            >
                                                                                {cat.buttonText ||
                                                                                    "Переглянути все"}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                }
                                                            />
                                                            <input
                                                                type="hidden"
                                                                name="image_url"
                                                                value={cat.image}
                                                            />
                                                            <input
                                                                type="hidden"
                                                                name="imagePos"
                                                                value={
                                                                    positions[
                                                                        `${cat.id}_imagePos`
                                                                    ] ||
                                                                    (cat as any).imagePos ||
                                                                    "center center"
                                                                }
                                                            />

                                                            <button
                                                                type="submit"
                                                                style={{
                                                                    width: "100%",
                                                                    padding: "10px",
                                                                    background:
                                                                        "var(--accent-primary)",
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
                        )}

                        {/* --- SLIDE MANAGER MODAL (Exact Request Design) --- */}
                        {managerOpen && (
                            <div
                                style={{
                                    position: "fixed",
                                    top: "24px",
                                    right: "24px",
                                    width: "420px",
                                    maxHeight: "calc(100vh - 48px)",
                                    background: "#0f1216", // Dark bg from screenshot
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
                                    <h2
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: 500,
                                            margin: 0,
                                            color: "#fff",
                                        }}
                                    >
                                        Управління слайдами
                                    </h2>
                                    <button
                                        onClick={() => setManagerOpen(false)}
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

                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "12px",
                                            }}
                                        >
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
                                                            <div
                                                                style={{
                                                                    color: "#64748b",
                                                                    fontSize: "12px",
                                                                }}
                                                            >
                                                                {slide.type === "triptych"
                                                                    ? "3 фото (триптих)"
                                                                    : "1 фото (full)"}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                onClick={() =>
                                                                    toggleSlide(
                                                                        slide.id,
                                                                        slide.type as
                                                                            | "triptych"
                                                                            | "single",
                                                                    )
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
                                                                    if (
                                                                        !confirm("Видалити слайд?")
                                                                    ) {
                                                                        e.preventDefault();
                                                                    }
                                                                }}
                                                            >
                                                                <input
                                                                    type="hidden"
                                                                    name="intent"
                                                                    value="delete"
                                                                />
                                                                <input
                                                                    type="hidden"
                                                                    name="id"
                                                                    value={slide.id}
                                                                />
                                                                <button
                                                                    type="submit"
                                                                    style={{
                                                                        width: 32,
                                                                        height: 32,
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        background:
                                                                            "rgba(255,80,80,0.1)",
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
                                                                borderTop:
                                                                    "1px solid rgba(255,255,255,0.05)",
                                                                marginTop: 4,
                                                            }}
                                                        >
                                                            <fetcher.Form
                                                                method="post"
                                                                encType="multipart/form-data"
                                                                style={{ padding: "16px 0 0 0" }}
                                                            >
                                                                <input
                                                                    type="hidden"
                                                                    name="intent"
                                                                    value="update"
                                                                />
                                                                <input
                                                                    type="hidden"
                                                                    name="id"
                                                                    value={slide.id}
                                                                />
                                                                <input
                                                                    type="hidden"
                                                                    name="type"
                                                                    value={slide.type}
                                                                />

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
                                                                        defaultValue={
                                                                            slide.link || ""
                                                                        }
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
                                                                        positions[
                                                                            `${slide.id}_image1Pos`
                                                                        ] ||
                                                                        (slide as any).image1Pos ||
                                                                        "center center"
                                                                    }
                                                                    onChange={(val: string) =>
                                                                        updatePos(
                                                                            slide.id,
                                                                            "image1Pos",
                                                                            val,
                                                                        )
                                                                    }
                                                                    aspectRatio={
                                                                        slide.type === "single"
                                                                            ? "16/9"
                                                                            : "9/16"
                                                                    }
                                                                    overlay={
                                                                        <div
                                                                            className="hero-slider__overlay"
                                                                            style={{
                                                                                background:
                                                                                    "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                                                position:
                                                                                    "absolute",
                                                                                inset: 0,
                                                                                pointerEvents:
                                                                                    "none",
                                                                                zIndex: 5,
                                                                            }}
                                                                        ></div>
                                                                    }
                                                                />
                                                                <input
                                                                    type="hidden"
                                                                    name="image1Pos"
                                                                    value={
                                                                        positions[
                                                                            `${slide.id}_image1Pos`
                                                                        ] ||
                                                                        (slide as any).image1Pos ||
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
                                                                            currentImageUrl={
                                                                                slide.image2 || ""
                                                                            }
                                                                            fileInputName="image2_file"
                                                                            value={
                                                                                positions[
                                                                                    `${slide.id}_image2Pos`
                                                                                ] ||
                                                                                (slide as any)
                                                                                    .image2Pos ||
                                                                                "center center"
                                                                            }
                                                                            onChange={(
                                                                                val: string,
                                                                            ) =>
                                                                                updatePos(
                                                                                    slide.id,
                                                                                    "image2Pos",
                                                                                    val,
                                                                                )
                                                                            }
                                                                            aspectRatio="9/16"
                                                                            overlay={
                                                                                <div
                                                                                    className="hero-slider__overlay"
                                                                                    style={{
                                                                                        background:
                                                                                            "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                                                        position:
                                                                                            "absolute",
                                                                                        inset: 0,
                                                                                        pointerEvents:
                                                                                            "none",
                                                                                        zIndex: 5,
                                                                                    }}
                                                                                ></div>
                                                                            }
                                                                        />
                                                                        <input
                                                                            type="hidden"
                                                                            name="image2Pos"
                                                                            value={
                                                                                positions[
                                                                                    `${slide.id}_image2Pos`
                                                                                ] ||
                                                                                (slide as any)
                                                                                    .image2Pos ||
                                                                                "center center"
                                                                            }
                                                                        />
                                                                        <input
                                                                            type="hidden"
                                                                            name="image2_url"
                                                                            value={
                                                                                slide.image2 || ""
                                                                            }
                                                                        />

                                                                        <ImageCropSelector
                                                                            currentImageUrl={
                                                                                slide.image3 || ""
                                                                            }
                                                                            fileInputName="image3_file"
                                                                            value={
                                                                                positions[
                                                                                    `${slide.id}_image3Pos`
                                                                                ] ||
                                                                                (slide as any)
                                                                                    .image3Pos ||
                                                                                "center center"
                                                                            }
                                                                            onChange={(
                                                                                val: string,
                                                                            ) =>
                                                                                updatePos(
                                                                                    slide.id,
                                                                                    "image3Pos",
                                                                                    val,
                                                                                )
                                                                            }
                                                                            aspectRatio="9/16"
                                                                            overlay={
                                                                                <div
                                                                                    className="hero-slider__overlay"
                                                                                    style={{
                                                                                        background:
                                                                                            "linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)",
                                                                                        position:
                                                                                            "absolute",
                                                                                        inset: 0,
                                                                                        pointerEvents:
                                                                                            "none",
                                                                                        zIndex: 5,
                                                                                    }}
                                                                                ></div>
                                                                            }
                                                                        />
                                                                        <input
                                                                            type="hidden"
                                                                            name="image3Pos"
                                                                            value={
                                                                                positions[
                                                                                    `${slide.id}_image3Pos`
                                                                                ] ||
                                                                                (slide as any)
                                                                                    .image3Pos ||
                                                                                "center center"
                                                                            }
                                                                        />
                                                                        <input
                                                                            type="hidden"
                                                                            name="image3_url"
                                                                            value={
                                                                                slide.image3 || ""
                                                                            }
                                                                        />
                                                                    </>
                                                                )}

                                                                <button
                                                                    type="submit"
                                                                    style={{
                                                                        width: "100%",
                                                                        padding: "10px",
                                                                        background:
                                                                            "var(--accent-primary)",
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
                                    <div
                                        style={{
                                            borderTop: "1px solid rgba(255,255,255,0.1)",
                                            paddingTop: "24px",
                                        }}
                                    >
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
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: "24px",
                                                    marginBottom: "24px",
                                                }}
                                            >
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
                                                        style={{
                                                            accentColor: "var(--accent-primary)",
                                                        }}
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
                                                        style={{
                                                            accentColor: "var(--accent-primary)",
                                                        }}
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
                                                {fetcher.state === "submitting"
                                                    ? "Створення..."
                                                    : "Створити слайд"}
                                            </button>
                                        </fetcher.Form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* --- SHOP BACKGROUND EDITOR MODAL (New) --- */}
            {editingShopPageSlug && (
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
                            <h3
                                style={{
                                    margin: 0,
                                    color: "#fff",
                                    fontSize: "16px",
                                    fontWeight: 600,
                                }}
                            >
                                Фон сторінки: {shopPageLabel(editingShopPageSlug).title}
                            </h3>
                            <button
                                onClick={closeShopEditor}
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
                                onSubmit={() => setTimeout(closeShopEditor, 500)}
                            >
                                <input type="hidden" name="intent" value="update_shop_page" />
                                <input type="hidden" name="slug" value={editingShopPageSlug} />
                                <input type="hidden" name="currentHeroImage" value={shopBgImage} />

                                <div
                                    style={{
                                        marginBottom: "12px",
                                        fontSize: "13px",
                                        color: "#94a3b8",
                                    }}
                                >
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
                                                {/* Main title */}
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
                                                    {shopPageLabel(
                                                        editingShopPageSlug,
                                                    ).title.toUpperCase()}
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
                                                    {shopPageLabel(editingShopPageSlug).tagline}
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
                                                {shopPageLabel(editingShopPageSlug).stroke}
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
            )}

            {/* --- FILTER CONFIG EDITOR MODAL (New) --- */}
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
