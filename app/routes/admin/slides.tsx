import type { Route } from "./+types/slides";
import { prisma } from "../../db.server";
import { useState, useRef, useEffect } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import HeroSlider, { type SlideData } from "../../components/HeroSlider";
import CategoryCard from "../../components/CategoryCard";
import { parseAndMergeFilterConfig } from "../../utils/filters";

export async function loader({ request }: Route.LoaderArgs) {
    try {
        // Run all queries in parallel for speed
        const [allSlidesRaw, categoriesResult, shopPages, filterConfigResult] = await Promise.all([
            prisma.$queryRaw`SELECT id, name, type, link, image1, image2, image3, "image1Pos", "image2Pos", "image3Pos", page, "order", "isActive" FROM "Slide" ORDER BY "order" ASC` as Promise<any[]>,
            prisma.$queryRawUnsafe(`SELECT id, title, subtitle, image, "imagePos", link, "buttonText", "order" FROM "Category" ORDER BY "order" ASC`) as Promise<any[]>,
            prisma.shopPage.findMany(),
            prisma.$queryRawUnsafe(`SELECT * FROM "FilterConfig"`) as Promise<any[]>
        ]);

        const slides = allSlidesRaw.filter((s: any) => !s.page || s.page === "home");
        const aboutSlides = allSlidesRaw.filter((s: any) => s.page === "about");
        const categories = categoriesResult || [];
        const filterConfigs = filterConfigResult || [];

        return { slides, categories, shopPages, filterConfigs, aboutSlides };
    } catch (error) {
        console.error("Loader error:", error);
        return { slides: [], categories: [], shopPages: [], filterConfigs: [], aboutSlides: [] };
    }
}

import { uploadFile } from "../../utils/upload.server";

export async function action({ request }: Route.ActionArgs) {
    const saveFile = uploadFile;
    try {
        const formData = await request.formData();

        const intent = formData.get("intent");

        if (intent === "update_shop_page") {
            const slug = formData.get("slug") as string;
            const heroImagePos = (formData.get("heroImagePos") as string) || "50% 50% 1";
            let heroImage = formData.get("currentHeroImage") as string;
            const file = formData.get("heroImageFile");

            const uploadedPath = await saveFile(file);
            if (uploadedPath) {
                heroImage = uploadedPath;
            }

            // Upsert logic for shop page
            await prisma.shopPage.upsert({
                where: { slug },
                update: { heroImage, heroImagePos },
                create: {
                    slug,
                    heroImage,
                    heroImagePos,
                    title: slug === 'women' ? 'Жіноча' : 'Діти', // Defaults 
                    subtitle: 'колекція'
                }
            });
            return { success: true };
        }

        if (intent === "create" || intent === "update") {
            const id = formData.get("id") as string;
            const name = (formData.get("name") as string) || "Без назви";
            const type = (formData.get("type") as string) || "triptych";
            const link = (formData.get("link") as string) || null;

            const image1Pos = (formData.get("image1Pos") as string) || "center center";
            const image2Pos = (formData.get("image2Pos") as string) || "center center";
            const image3Pos = (formData.get("image3Pos") as string) || "center center";

            let image1 = formData.get("image1_url") as string || "";
            let image2 = formData.get("image2_url") as string || "";
            let image3 = formData.get("image3_url") as string || "";

            const image1File = formData.get("image1_file");
            const image2File = formData.get("image2_file");
            const image3File = formData.get("image3_file");

            const u1 = await saveFile(image1File);
            const u2 = await saveFile(image2File);
            const u3 = await saveFile(image3File);

            if (u1) image1 = u1;
            if (u2) image2 = u2;
            if (u3) image3 = u3;

            if (intent === "create") {
                const maxOrderResult = await prisma.$queryRaw`SELECT MAX("order") as "maxOrder" FROM "Slide"` as any[];
                const newOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;
                const newId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

                // Create HOME slide (explicit page='home')
                await prisma.$executeRaw`
                INSERT INTO "Slide" (id, name, type, page, link, image1, "image1Pos", image2, "image2Pos", image3, "image3Pos", "order", "isActive", "createdAt", "updatedAt")
                VALUES (${newId}, ${name}, ${type}, 'home', ${link || null}, ${image1}, ${image1Pos}, ${type === 'single' ? null : (image2 || null)}, ${type === 'single' ? 'center center' : image2Pos}, ${type === 'single' ? null : (image3 || null)}, ${type === 'single' ? 'center center' : image3Pos}, ${newOrder}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            } else {
                // Update HOME slide
                await prisma.$executeRaw`
                UPDATE "Slide" 
                SET name=${name}, type=${type}, link=${link || null},
                    image1=${image1}, "image1Pos"=${image1Pos},
                    image2=${type === 'single' ? null : (image2 || null)}, "image2Pos"=${type === 'single' ? 'center center' : image2Pos},
                    image3=${type === 'single' ? null : (image3 || null)}, "image3Pos"=${type === 'single' ? 'center center' : image3Pos},
                    "updatedAt"=CURRENT_TIMESTAMP
                WHERE id=${id}
            `;
            }
            return { success: true };
        }

        if (intent === "delete") {
            const id = formData.get("id") as string;
            try {
                await prisma.$executeRaw`DELETE FROM "Slide" WHERE id=${id}`;
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
            const imagePos = (formData.get("imagePos") as string) || "center center";

            let image = (formData.get("image_url") as string) || "";
            const imageFile = formData.get("image_file");

            const uploaded = await saveFile(imageFile);
            if (uploaded) image = uploaded;

            await prisma.$executeRawUnsafe(
                `UPDATE "Category" SET title = $1, subtitle = $2, link = $3, "buttonText" = $4, image = $5, "imagePos" = $6, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $7`,
                title, subtitle, link, buttonText, image, imagePos, id
            );

            return { success: true };
        }

        if (intent === "update_filters") {
            const config = formData.get("config") as string;
            const pageSlug = (formData.get("pageSlug") as string) || 'global';
            try {
                // PostgreSQL UPSERT - always reliable
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "FilterConfig" (id, config, "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT(id) DO UPDATE SET config = $2, "updatedAt" = CURRENT_TIMESTAMP`,
                    pageSlug, config
                );
            } catch (e) {
                console.error("FilterConfig update failed:", e);
            }
            return { success: true };
        }

        // About Slides actions - use Slide model with page: "about"
        if (intent === "create_about_slide") {
            const name = formData.get("name") as string || "About Slide";
            const type = formData.get("type") as string || "triptych";

            let image1 = formData.get("image1_url") as string || "/pics1cloths/IMG_6201.JPG";
            let image2 = formData.get("image2_url") as string || "";
            let image3 = formData.get("image3_url") as string || "";

            const image1Pos = formData.get("image1Pos") as string || "center center";
            const image2Pos = formData.get("image2Pos") as string || "center center";
            const image3Pos = formData.get("image3Pos") as string || "center center";

            const image1File = formData.get("image1_file");
            const image2File = formData.get("image2_file");
            const image3File = formData.get("image3_file");

            const u1 = await saveFile(image1File);
            const u2 = await saveFile(image2File);
            const u3 = await saveFile(image3File);

            if (u1) image1 = u1;
            if (u2) image2 = u2;
            if (u3) image3 = u3;

            const maxOrder = await prisma.slide.aggregate({ _max: { order: true } });
            const newOrder = (maxOrder._max?.order || 0) + 1;
            const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            // Use Raw SQL to bypass client validation for 'page'
            await prisma.$executeRaw`
            INSERT INTO "Slide" (id, name, type, page, image1, "image1Pos", image2, "image2Pos", image3, "image3Pos", "order", "isActive", "createdAt", "updatedAt")
            VALUES (${id}, ${name}, ${type}, 'about', ${image1}, ${image1Pos}, ${image2 || null}, ${image2Pos}, ${image3 || null}, ${image3Pos}, ${newOrder}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
            return { success: true };
        }

        if (intent === "update_about_slide") {
            const id = formData.get("id") as string;
            const name = (formData.get("name") as string) || "About Slide";
            const type = (formData.get("type") as string) || "triptych";

            const image1Pos = (formData.get("image1Pos") as string) || "center center";
            const image2Pos = (formData.get("image2Pos") as string) || "center center";
            const image3Pos = (formData.get("image3Pos") as string) || "center center";

            let image1 = formData.get("image1_url") as string || "";
            let image2 = formData.get("image2_url") as string || "";
            let image3 = formData.get("image3_url") as string || "";

            const image1File = formData.get("image1_file");
            const image2File = formData.get("image2_file");
            const image3File = formData.get("image3_file");

            const u1 = await saveFile(image1File);
            const u2 = await saveFile(image2File);
            const u3 = await saveFile(image3File);

            if (u1) image1 = u1;
            if (u2) image2 = u2;
            if (u3) image3 = u3;

            // Use Raw SQL for update
            await prisma.$executeRaw`
            UPDATE "Slide" 
            SET name=${name}, type=${type}, 
                image1=${image1}, "image1Pos"=${image1Pos},
                image2=${image2 || null}, "image2Pos"=${image2Pos},
                image3=${image3 || null}, "image3Pos"=${image3Pos},
                "updatedAt"=CURRENT_TIMESTAMP
            WHERE id=${id}
        `;
            return { success: true };
        }

        if (intent === "delete_about_slide") {
            const id = formData.get("id") as string;
            await prisma.$executeRaw`DELETE FROM "Slide" WHERE id=${id}`;
            return { success: true };
        }

        return { error: "Unknown intent" };
    } catch (e: any) {
        console.error("Action error:", e);
        return { error: e.message || "Сталася серверна помилка" };
    }
}

// Icon Components
const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
    </svg>
);

const ChevronDown = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M6 9l6 6 6-6" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const CameraIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
    </svg>
);

// Image Crop Selector - Drag to position + zoom control
const ImageCropSelector = ({
    currentImageUrl,
    fileInputName,
    value,
    onChange,
    aspectRatio = "400/380",
    onFileSelect,
    overlay
}: {
    currentImageUrl: string,
    fileInputName: string,
    value: string,
    onChange: (val: string) => void,
    aspectRatio?: string,
    onFileSelect?: (file: File) => void,
    overlay?: React.ReactNode
}) => {
    const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse position value like "30% 20% 1.2" (x, y, scale)
    const parsePos = (pos: string) => {
        const parts = pos.split(' ');
        return {
            x: parseInt(parts[0]) || 50,
            y: parseInt(parts[1]) || 50,
            scale: parseFloat(parts[2]) || 1
        };
    };

    const [pos, setPos] = useState(parsePos(value));

    const emitChange = (newPos: { x: number, y: number, scale: number }) => {
        onChange(`${Math.round(newPos.x)}% ${Math.round(newPos.y)}% ${newPos.scale.toFixed(2)}`);
    };

    // Update preview when file is selected
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
        // Sensitivity adjusted for scale - more zoomed = more precise control
        const sensitivity = 100 / pos.scale;
        const deltaX = (e.clientX - dragStart.x) / rect.width * sensitivity;
        const deltaY = (e.clientY - dragStart.y) / rect.height * sensitivity;

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

    // Mouse wheel for zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newScale = Math.max(1, Math.min(2.5, pos.scale + delta));
        const newPos = { ...pos, scale: newScale };
        setPos(newPos);
        emitChange(newPos);
    };

    // Slider change for zoom
    const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newScale = parseFloat(e.target.value);
        const newPos = { ...pos, scale: newScale };
        setPos(newPos);
        emitChange(newPos);
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            {/* File Input with styled button */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#94a3b8',
                    transition: 'all 0.2s'
                }}>
                    <CameraIcon />
                    Обрати фото
                    <input
                        type="file"
                        name={fileInputName}
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </label>
                {previewUrl && (
                    <span style={{ marginLeft: '12px', fontSize: '11px', color: '#64748b' }}>
                        ✓ Фото завантажено
                    </span>
                )}
            </div>

            {/* Preview - Exact match to category card */}
            {previewUrl && (
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '10px',
                        padding: '8px 12px',
                        background: 'rgba(94, 234, 212, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(94, 234, 212, 0.2)'
                    }}>
                        <span style={{ fontSize: '14px' }}>✛</span>
                        <span style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>
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
                            position: 'relative',
                            width: '100%',
                            maxWidth: '100%', // Allow full width
                            aspectRatio: aspectRatio,
                            background: '#f0f0f0',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                            userSelect: 'none'
                        }}
                    >
                        {/* Image with scale */}
                        <img
                            src={previewUrl}
                            alt="Preview"
                            draggable={false}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: `${pos.x}% ${pos.y}%`,
                                transform: `scale(${pos.scale})`,
                                transformOrigin: `${pos.x}% ${pos.y}%`,
                                pointerEvents: 'none'
                            }}
                        />

                        {overlay ? overlay : (
                            <>
                                {/* Gradient overlay */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.6) 100%)',
                                    pointerEvents: 'none'
                                }}></div>

                                {/* Sample text overlay */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: '30px',
                                    color: '#fff',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>
                                        Колекція
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: 600, textTransform: 'uppercase' }}>
                                        Категорія
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Drag indicator */}
                        {isDragging && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,0.3)',
                                pointerEvents: 'none'
                            }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    border: '2px solid var(--accent-primary)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <span style={{ fontSize: '24px', color: 'var(--accent-primary)' }}>✛</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Zoom Slider */}
                    <div style={{ marginTop: '12px', maxWidth: '320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px' }}>🔍</span>
                            <input
                                type="range"
                                min="1"
                                max="2.5"
                                step="0.05"
                                value={pos.scale}
                                onChange={handleScaleChange}
                                style={{
                                    flex: 1,
                                    accentColor: 'var(--accent-primary)',
                                    height: '6px'
                                }}
                            />
                            <span style={{ fontSize: '11px', color: '#64748b', minWidth: '40px' }}>
                                {Math.round(pos.scale * 100)}%
                            </span>
                        </div>
                    </div>

                    {/* Position info */}
                    <div style={{ marginTop: '8px', fontSize: '10px', color: '#475569', display: 'flex', gap: '12px' }}>
                        <span>X: {Math.round(pos.x)}%</span>
                        <span>Y: {Math.round(pos.y)}%</span>
                        <span>Масштаб: {Math.round(pos.scale * 100)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
};


export default function AdminVisualEditor() {
    const { slides, categories, shopPages, filterConfigs, aboutSlides } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    // UI State
    const [managerOpen, setManagerOpen] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [aboutSlidesOpen, setAboutSlidesOpen] = useState(false);

    const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
    const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<'home' | 'shop' | 'about'>('home');

    // Focal Point State
    const [positions, setPositions] = useState<Record<string, string>>({});

    const updatePos = (id: string, field: string, value: string) => {
        setPositions(prev => ({ ...prev, [`${id}_${field}`]: value }));
    };

    // --- Listener for Shop Page Edit ---
    const [editingShopPageSlug, setEditingShopPageSlug] = useState<string | null>(null);

    // Derived state for the active shop page being edited (needs shopPages from loader)
    // const { shopPages } = useLoaderData<typeof loader>(); // REMOVED redundant call
    const activeShopPage = (shopPages || []).find(p => p.slug === editingShopPageSlug);

    // Temp state for editing
    const [shopBgPos, setShopBgPos] = useState("50% 50% 1");
    const [shopBgImage, setShopBgImage] = useState("");

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
            if (event.data?.type === 'OPEN_SHOP_BG_EDITOR') {
                const slug = event.data.category;
                setEditingShopPageSlug(slug);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

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
            const section = document.querySelector('.values-modern') as HTMLElement;
            const bgElement = document.querySelector('.values-modern .values-premium__bg-image') as HTMLElement;

            if (section && bgElement) {
                // Get rect relative to viewport. This works fine with internal scrolling.
                const rect = section.getBoundingClientRect();
                const sectionCenter = rect.top + rect.height / 2;
                const viewportCenter = window.innerHeight / 2;
                const offset = (sectionCenter - viewportCenter) * 0.4;
                bgElement.style.transform = `translateY(${offset}px)`;
            }
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
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

    // Close manager on successful submit
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            (document.getElementById("create-slide-form") as HTMLFormElement)?.reset();
        }

        if (fetcher.state === "idle" && fetcher.data?.error) {
            alert(`Помилка: ${fetcher.data.error}`);
        }
    }, [fetcher.state, fetcher.data]);

    return (
        <div style={{ background: '#000', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar - Fixed Position */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '240px',
                background: '#0f1216',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50
            }}>
                <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', fontWeight: 600 }}>
                        Редактор сайту
                    </div>
                </div>
                <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Link
                        to="/admin"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#94a3b8',
                            textDecoration: 'none',
                            fontSize: '13px',
                            fontWeight: 500,
                            marginBottom: '12px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                        В адмін-панель
                    </Link>

                    <button
                        onClick={() => setCurrentView('home')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: currentView === 'home' ? 'rgba(94, 234, 212, 0.1)' : 'transparent',
                            border: '1px solid',
                            borderColor: currentView === 'home' ? 'rgba(94, 234, 212, 0.2)' : 'transparent',
                            borderRadius: '8px',
                            color: currentView === 'home' ? 'var(--accent-primary)' : '#94a3b8',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                        Головна (Слайди)
                    </button>
                    <button
                        onClick={() => setCurrentView('shop')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: currentView === 'shop' ? 'rgba(94, 234, 212, 0.1)' : 'transparent',
                            border: '1px solid',
                            borderColor: currentView === 'shop' ? 'rgba(94, 234, 212, 0.2)' : 'transparent',
                            borderRadius: '8px',
                            color: currentView === 'shop' ? 'var(--accent-primary)' : '#94a3b8',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                        Магазин (Категорії)
                    </button>
                    <button
                        onClick={() => setCurrentView('about')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: currentView === 'about' ? 'rgba(94, 234, 212, 0.1)' : 'transparent',
                            border: '1px solid',
                            borderColor: currentView === 'about' ? 'rgba(94, 234, 212, 0.2)' : 'transparent',
                            borderRadius: '8px',
                            color: currentView === 'about' ? 'var(--accent-primary)' : '#94a3b8',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                        Про бренд
                    </button>
                    <button
                        onClick={() => window.open('/', '_blank')}
                        style={{
                            marginTop: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: '1px solid transparent',
                            borderRadius: '8px',
                            color: '#64748b',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        Відкрити сайт
                    </button>
                </div>
            </div>

            {/* Main Content Area - Identical Layout for both views */}
            <div style={{ position: 'fixed', top: 0, left: '240px', right: 0, bottom: 0, background: '#fff', overflow: 'hidden' }}>
                {currentView === 'shop' ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {/* Edit Filters Button Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '120px',
                            left: '210px',
                            zIndex: 10,
                            pointerEvents: 'auto'
                        }}>
                            <button
                                onClick={() => setFiltersOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: '20px',
                                    color: '#000',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 20px rgba(94, 234, 212, 0.4)',
                                    transition: 'all 0.2s',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                Редагувати фільтри
                            </button>
                        </div>

                        <iframe
                            src="/shop/women"
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            title="Shop Preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>
                ) : currentView === 'about' ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {/* Edit About Slides Button Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10,
                            pointerEvents: 'auto'
                        }}>
                            <button
                                onClick={() => setAboutSlidesOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 24px',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: '24px',
                                    color: '#000',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 32px rgba(94, 234, 212, 0.5)',
                                    transition: 'all 0.2s',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                Редагувати слайди
                            </button>
                        </div>

                        <iframe
                            src="/about"
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            title="About Preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>
                ) : (


                    <div
                        ref={contentScrollRef}
                        className="visual-editor-container"
                        style={{ background: 'var(--color-bg-cream)', height: '100%', width: '100%', overflowY: 'auto', position: 'relative' }}
                    >

                        {/* --- VISUAL SITE BACKGROUND --- */}
                        <div style={{ position: 'relative', opacity: managerOpen ? 0.4 : 1, transition: 'opacity 0.3s', pointerEvents: managerOpen ? 'none' : 'auto' }}>
                            <HeroSlider slides={slides as any} />

                            {/* Categories */}
                            <section className="categories section" id="shop">
                                <div className="container">
                                    <div className="section__header">
                                        <h2 className="section__title">Обирайте свій стиль</h2>
                                        <p className="section__subtitle">Колекції для активного способу життя</p>
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
                                            />
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* New Collections Preview */}
                            <section className="section section--alt new-arrivals" id="new-collections">
                                <div className="logo-pattern-bg"></div>
                                <div className="container">
                                    <div className="section__header section__header--center">
                                        <span className="section__badge">Новинки 2025</span>
                                        <h2 className="section__title">Нові надходження</h2>
                                        <p className="section__subtitle">Сезонні новинки колекції для всієї родини</p>
                                    </div>

                                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                                        [Product Grid Preview]
                                    </div>
                                </div>
                            </section>

                            {/* Values Section */}
                            <section className="section values-modern" id="values">
                                <div className="values-premium__bg-image" data-parallax="true"></div>
                                <div className="values-premium__overlay"></div>
                                <div className="logo-pattern-bg"></div>

                                <div className="container">
                                    <div className="values-modern__header">
                                        <span className="values-modern__signature" style={{ fontFamily: "'Great Vibes', cursive", fontSize: "3.2rem", color: "#ffffff", textShadow: "0 2px 15px rgba(0,0,0,0.25)", fontWeight: 400 }}>Motivate for active life</span>
                                        <h3 className="values-modern__title">Що робить нас особливими</h3>
                                    </div>

                                    <div className="values-modern__grid">
                                        <div className="value-item">
                                            <div className="value-item__icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            </div>
                                            <div className="value-item__content">
                                                <h4 className="value-item__title">Made with soul</h4>
                                                <p className="value-item__text">Українська дух у кожному шві</p>
                                            </div>
                                        </div>
                                        <div className="value-item">
                                            <div className="value-item__icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                            </div>
                                            <div className="value-item__content">
                                                <h4 className="value-item__title">Breathable</h4>
                                                <p className="value-item__text">Комфорт, що дихає разом з вами</p>
                                            </div>
                                        </div>
                                        <div className="value-item">
                                            <div className="value-item__icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                            </div>
                                            <div className="value-item__content">
                                                <h4 className="value-item__title">Eco-friendly</h4>
                                                <p className="value-item__text">Турбота про майбутнє планети</p>
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
                                                    <img src="/generalpics/338_131123.jpg" alt="MIND BODY Lifestyle" className="about-modern__image" />
                                                    <div className="about-modern__image-overlay"></div>
                                                    <div className="about-modern__floating-badge">
                                                        <span className="about-modern__badge-text">Est. 2024</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="about-modern__content-side">
                                                <div className="about-modern__header">
                                                    <span className="about-modern__tagline">Про бренд</span>
                                                    <h2 className="about-modern__title">
                                                        Подаруй собі <span>комфорт</span>
                                                    </h2>
                                                </div>
                                                <div className="about-modern__text-block">
                                                    <p className="about-modern__description">
                                                        MIND BODY &mdash; це більше, ніж просто одяг. Це філософія гармонії між тілом та розумом.
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
                                    position: 'absolute',
                                    top: '75vh',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 100,
                                    background: 'var(--accent-primary)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '16px 32px',
                                    borderRadius: '40px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 8px 40px rgba(94, 234, 212, 0.5)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '16px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 12px 50px rgba(94, 234, 212, 0.6)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                                    e.currentTarget.style.boxShadow = '0 8px 40px rgba(94, 234, 212, 0.5)';
                                }}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                    position: 'absolute',
                                    top: '1100px', // Positioning it above the categories section
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 100,
                                    background: 'var(--accent-primary)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '30px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 20px rgba(94, 234, 212, 0.4)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '14px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(94, 234, 212, 0.6)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(94, 234, 212, 0.4)';
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Редагувати блоки категорій
                            </button>
                        )}

                        {/* --- CATEGORY MANAGER MODAL --- */}
                        {categoriesOpen && (
                            <div style={{
                                position: 'fixed',
                                top: '24px',
                                right: '24px',
                                width: '420px',
                                maxHeight: 'calc(100vh - 48px)',
                                background: '#0f1216',
                                borderRadius: '16px',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                                zIndex: 2000,
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h2 style={{ fontSize: '16px', fontWeight: 500, margin: 0, color: '#fff' }}>Редагування категорій</h2>
                                    <button onClick={() => setCategoriesOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                                        <CloseIcon />
                                    </button>
                                </div>

                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {categories.map((cat: any) => (
                                            <div key={cat.id} style={{
                                                background: '#16191f',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '12px',
                                                overflow: 'hidden'
                                            }}>
                                                <div
                                                    onClick={() => setExpandedCategoryId(expandedCategoryId === cat.id ? null : cat.id)}
                                                    style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                                                >
                                                    <div style={{ width: 40, height: 40, borderRadius: 6, background: '#000', overflow: 'hidden', flexShrink: 0 }}>
                                                        <img src={cat.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{cat.title}</div>
                                                        <div style={{ color: '#64748b', fontSize: '12px' }}>{cat.subtitle}</div>
                                                    </div>
                                                    <div style={{ color: expandedCategoryId === cat.id ? 'var(--accent-primary)' : '#64748b', transform: expandedCategoryId === cat.id ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>
                                                        <ChevronDown />
                                                    </div>
                                                </div>

                                                {expandedCategoryId === cat.id && (
                                                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <fetcher.Form method="post" encType="multipart/form-data" style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            <input type="hidden" name="intent" value="update_category" />
                                                            <input type="hidden" name="id" value={cat.id} />

                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Назва (Головна)</label>
                                                                <input name="title" defaultValue={cat.title} style={{ width: '100%', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: '13px' }} />
                                                            </div>

                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Підзаголовок</label>
                                                                <input name="subtitle" defaultValue={cat.subtitle} style={{ width: '100%', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: '13px' }} />
                                                            </div>

                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Текст кнопки</label>
                                                                <input name="buttonText" defaultValue={cat.buttonText} style={{ width: '100%', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: '13px' }} />
                                                            </div>

                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Посилання</label>
                                                                <input name="link" defaultValue={cat.link} style={{ width: '100%', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: '13px' }} />
                                                            </div>

                                                            <ImageCropSelector
                                                                currentImageUrl={cat.image}
                                                                fileInputName="image_file"
                                                                value={positions[`${cat.id}_imagePos`] || (cat as any).imagePos || "center center"}
                                                                onChange={(val: string) => updatePos(cat.id, "imagePos", val)}
                                                                aspectRatio="400/380"
                                                                overlay={(
                                                                    <>
                                                                        <div className="category-card__overlay" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 2 }}></div>
                                                                        <div className="category-card__content" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '40px', textAlign: 'left' }}>
                                                                            <p className="category-card__count" style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>{cat.subtitle || 'ДЛЯ ВАС'}</p>
                                                                            <h3 className="category-card__title" style={{ fontSize: '32px', marginBottom: '8px', textTransform: 'uppercase', marginTop: '8px', fontWeight: 600 }}>{cat.title}</h3>
                                                                            <div className="category-card__shop-now" style={{ marginTop: '24px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '12px 28px', background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(12px)', width: 'fit-content', borderRadius: '30px', border: '1px solid rgba(255, 255, 255, 0.3)', opacity: 1, transform: 'none' }}>
                                                                                {cat.buttonText || 'Переглянути все'}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            />
                                                            <input type="hidden" name="image_url" value={cat.image} />
                                                            <input type="hidden" name="imagePos" value={positions[`${cat.id}_imagePos`] || (cat as any).imagePos || "center center"} />


                                                            <button type="submit" style={{ width: '100%', padding: '10px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                                                                {fetcher.state === 'submitting' ? 'Збереження...' : 'Зберегти зміни'}
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
                            <div style={{
                                position: 'fixed',
                                top: '24px',
                                right: '24px',
                                width: '420px',
                                maxHeight: 'calc(100vh - 48px)',
                                background: '#0f1216', // Dark bg from screenshot
                                borderRadius: '16px',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                                zIndex: 2000,
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}>
                                {/* Header */}
                                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h2 style={{ fontSize: '16px', fontWeight: 500, margin: 0, color: '#fff' }}>Управління слайдами</h2>
                                    <button onClick={() => setManagerOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                                        <CloseIcon />
                                    </button>
                                </div>

                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

                                    {/* Active Slides List */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '16px', fontWeight: 600 }}>
                                            Активні слайди ({slides.length})
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {slides.map(slide => (
                                                <div key={slide.id} style={{
                                                    background: '#16191f',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden'
                                                }}>
                                                    {/* Row Header */}
                                                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        <div style={{ width: 48, height: 48, borderRadius: 8, background: '#000', overflow: 'hidden', flexShrink: 0 }}>
                                                            <img src={slide.image1} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slide.name}</div>
                                                            <div style={{ color: '#64748b', fontSize: '12px' }}>{slide.type === 'triptych' ? '3 фото (триптих)' : '1 фото (full)'}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button
                                                                onClick={() => toggleSlide(slide.id, slide.type as "triptych" | "single")}
                                                                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: expandedSlideId === slide.id ? 'var(--accent-primary)' : '#64748b', cursor: 'pointer', transform: expandedSlideId === slide.id ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                                                            >
                                                                <ChevronDown />
                                                            </button>

                                                            <fetcher.Form
                                                                method="post"
                                                                onSubmit={(e) => {
                                                                    if (!confirm('Видалити слайд?')) {
                                                                        e.preventDefault();
                                                                    }
                                                                }}
                                                            >
                                                                <input type="hidden" name="intent" value="delete" />
                                                                <input type="hidden" name="id" value={slide.id} />
                                                                <button
                                                                    type="submit"
                                                                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,80,80,0.1)', border: 'none', borderRadius: 8, color: '#ff6b6b', cursor: 'pointer' }}
                                                                >
                                                                    <TrashIcon />
                                                                </button>
                                                            </fetcher.Form>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Edit Form */}
                                                    {expandedSlideId === slide.id && (
                                                        <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 4 }}>
                                                            <fetcher.Form method="post" encType="multipart/form-data" style={{ padding: '16px 0 0 0' }}>
                                                                <input type="hidden" name="intent" value="update" />
                                                                <input type="hidden" name="id" value={slide.id} />
                                                                <input type="hidden" name="type" value={slide.type} />

                                                                <div style={{ marginBottom: 12 }}>
                                                                    <input name="name" defaultValue={slide.name} placeholder="Назва слайду" style={{ width: '100%', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: '13px' }} />
                                                                </div>
                                                                <div style={{ marginBottom: 16 }}>
                                                                    <input name="link" defaultValue={slide.link || ""} placeholder="/shop/category" style={{ width: '100%', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: '13px' }} />
                                                                </div>

                                                                <ImageCropSelector
                                                                    currentImageUrl={slide.image1}
                                                                    fileInputName="image1_file"
                                                                    value={positions[`${slide.id}_image1Pos`] || (slide as any).image1Pos || "center center"}
                                                                    onChange={(val: string) => updatePos(slide.id, "image1Pos", val)}
                                                                    aspectRatio={slide.type === 'single' ? '16/9' : '9/16'}
                                                                    overlay={
                                                                        <div className="hero-slider__overlay" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}></div>
                                                                    }
                                                                />
                                                                <input type="hidden" name="image1Pos" value={positions[`${slide.id}_image1Pos`] || (slide as any).image1Pos || "center center"} />
                                                                <input type="hidden" name="image1_url" value={slide.image1} />

                                                                {slide.type === 'triptych' && (
                                                                    <>
                                                                        <ImageCropSelector
                                                                            currentImageUrl={slide.image2 || ""}
                                                                            fileInputName="image2_file"
                                                                            value={positions[`${slide.id}_image2Pos`] || (slide as any).image2Pos || "center center"}
                                                                            onChange={(val: string) => updatePos(slide.id, "image2Pos", val)}
                                                                            aspectRatio="9/16"
                                                                            overlay={<div className="hero-slider__overlay" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}></div>}
                                                                        />
                                                                        <input type="hidden" name="image2Pos" value={positions[`${slide.id}_image2Pos`] || (slide as any).image2Pos || "center center"} />
                                                                        <input type="hidden" name="image2_url" value={slide.image2 || ""} />

                                                                        <ImageCropSelector
                                                                            currentImageUrl={slide.image3 || ""}
                                                                            fileInputName="image3_file"
                                                                            value={positions[`${slide.id}_image3Pos`] || (slide as any).image3Pos || "center center"}
                                                                            onChange={(val: string) => updatePos(slide.id, "image3Pos", val)}
                                                                            aspectRatio="9/16"
                                                                            overlay={<div className="hero-slider__overlay" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}></div>}
                                                                        />
                                                                        <input type="hidden" name="image3Pos" value={positions[`${slide.id}_image3Pos`] || (slide as any).image3Pos || "center center"} />
                                                                        <input type="hidden" name="image3_url" value={slide.image3 || ""} />
                                                                    </>
                                                                )}


                                                                <button type="submit" style={{ width: '100%', padding: '10px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                                                    {fetcher.state === 'submitting' ? 'Збереження...' : 'Зберегти зміни'}
                                                                </button>
                                                            </fetcher.Form>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Add New Slide Section */}
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                                        <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-primary)', marginBottom: '20px', fontWeight: 600 }}>
                                            + Додати новий слайд
                                        </div>

                                        <fetcher.Form method="post" encType="multipart/form-data" id="create-slide-form">
                                            <input type="hidden" name="intent" value="create" />

                                            {/* Radio Type Toggle */}
                                            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff', fontSize: '14px' }}>
                                                    <input type="radio" name="type" value="triptych" checked={newSlideType === 'triptych'} onChange={() => setNewSlideType('triptych')} style={{ accentColor: 'var(--accent-primary)' }} />
                                                    Триптих (3 фото)
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff', fontSize: '14px' }}>
                                                    <input type="radio" name="type" value="single" checked={newSlideType === 'single'} onChange={() => setNewSlideType('single')} style={{ accentColor: 'var(--accent-primary)' }} />
                                                    Одне фото (Full)
                                                </label>
                                            </div>

                                            <div style={{ marginBottom: '16px' }}>
                                                <input name="name" required placeholder="Назва слайду (напр. Summer Sale)" style={{ width: '100%', background: '#16191f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: 8, fontSize: '14px' }} />
                                            </div>

                                            <div style={{ marginBottom: '24px' }}>
                                                <input name="link" placeholder="Посилання (напр. /shop/women)" style={{ width: '100%', background: '#16191f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: 8, fontSize: '14px' }} />
                                            </div>

                                            <div style={{ background: '#16191f', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                                <div style={{ marginBottom: '16px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Головне фото (обов'язково)</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input type="file" name="image1_file" accept="image/*" required style={{ width: '100%', fontSize: '12px', color: '#94a3b8' }} />
                                                    </div>
                                                </div>

                                                {newSlideType === 'triptych' && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Фото 2 (центр)</label>
                                                            <input type="file" name="image2_file" accept="image/*" required style={{ width: '100%', fontSize: '12px', color: '#94a3b8' }} />
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Фото 3 (праворуч)</label>
                                                            <input type="file" name="image3_file" accept="image/*" required style={{ width: '100%', fontSize: '12px', color: '#94a3b8' }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="submit"
                                                style={{
                                                    width: '100%',
                                                    padding: '16px',
                                                    background: 'var(--accent-primary)',
                                                    color: '#000',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontSize: '15px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 15px rgba(94, 234, 212, 0.2)'
                                                }}
                                            >
                                                {fetcher.state === 'submitting' ? 'Створення...' : 'Створити слайд'}
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
            {
                editingShopPageSlug && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '90%', maxWidth: '500px',
                            background: '#0f1216', borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 50px 100px rgba(0,0,0,0.5)',
                            animation: 'fadeIn 0.2s ease'
                        }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161b22', borderRadius: '16px 16px 0 0' }}>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                                    Фон сторінки: {editingShopPageSlug === 'women' ? 'Жіноча' : editingShopPageSlug === 'kids' ? 'Діти' : editingShopPageSlug}
                                </h3>
                                <button onClick={closeShopEditor} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            </div>
                            <div style={{ padding: '24px' }}>
                                <fetcher.Form method="post" encType="multipart/form-data" onSubmit={() => setTimeout(closeShopEditor, 500)}>
                                    <input type="hidden" name="intent" value="update_shop_page" />
                                    <input type="hidden" name="slug" value={editingShopPageSlug} />
                                    <input type="hidden" name="currentHeroImage" value={shopBgImage} />

                                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#94a3b8' }}>
                                        Завантажте фото та налаштуйте його відображення.
                                    </div>

                                    <ImageCropSelector
                                        currentImageUrl={shopBgImage || "https://placehold.co/1200x600/1e293b/FFF"}
                                        fileInputName="heroImageFile"
                                        value={shopBgPos}
                                        onChange={setShopBgPos}
                                        aspectRatio="16/5"
                                        overlay={
                                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                                                {/* Dark gradient overlay — exactly like the real page */}
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.5) 100%)'
                                                }} />

                                                {/* Grain texture */}
                                                <div style={{
                                                    position: 'absolute', inset: 0, opacity: 0.06,
                                                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
                                                    backgroundSize: '128px 128px'
                                                }} />

                                                {/* Breadcrumbs */}
                                                <div style={{
                                                    position: 'absolute', top: '16%', left: '8%',
                                                    display: 'flex', gap: '6px', alignItems: 'center',
                                                    fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
                                                    fontFamily: 'DM Sans, sans-serif'
                                                }}>
                                                    <span>Головна</span>
                                                    <span style={{ opacity: 0.4 }}>/</span>
                                                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>Магазин</span>
                                                </div>

                                                {/* Hero composition — title + signature */}
                                                <div style={{
                                                    position: 'absolute', bottom: '12%', left: '8%',
                                                    display: 'flex', flexDirection: 'column', gap: '6px'
                                                }}>
                                                    {/* Main title */}
                                                    <div style={{
                                                        fontSize: '28px', fontWeight: 300, color: '#fff',
                                                        textTransform: 'uppercase', letterSpacing: '0.12em',
                                                        fontFamily: 'Italiana, serif', lineHeight: 1.1
                                                    }}>
                                                        {editingShopPageSlug === 'women' ? 'ЖІНОЧА' : editingShopPageSlug === 'kids' ? 'ДИТЯЧА' : editingShopPageSlug?.toUpperCase()}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '10px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.45)',
                                                        textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif'
                                                    }}>
                                                        колекція
                                                    </div>

                                                    {/* Signature line */}
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px'
                                                    }}>
                                                        <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                                                        <span style={{
                                                            fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)',
                                                            textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif'
                                                        }}>mind body</span>
                                                    </div>
                                                </div>

                                                {/* Tagline accent - right side */}
                                                <div style={{
                                                    position: 'absolute', bottom: '20%', right: '8%',
                                                    display: 'flex', alignItems: 'center', gap: '8px'
                                                }}>
                                                    <div style={{ width: '16px', height: '1px', background: 'rgba(255,255,255,0.15)' }} />
                                                    <span style={{
                                                        fontSize: '8px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)',
                                                        textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif'
                                                    }}>
                                                        {editingShopPageSlug === 'women' ? 'для неї' : editingShopPageSlug === 'kids' ? 'для малечі' : ''}
                                                    </span>
                                                    <div style={{ width: '16px', height: '1px', background: 'rgba(255,255,255,0.15)' }} />
                                                </div>

                                                {/* Decorative stroke text — faint background */}
                                                <div style={{
                                                    position: 'absolute', top: '50%', left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    fontSize: '60px', fontWeight: 800, textTransform: 'uppercase',
                                                    fontFamily: 'Italiana, serif',
                                                    color: 'transparent',
                                                    WebkitTextStroke: '1px rgba(255,255,255,0.06)',
                                                    letterSpacing: '0.1em', whiteSpace: 'nowrap',
                                                    userSelect: 'none'
                                                }}>
                                                    {editingShopPageSlug === 'women' ? 'WOMEN' : editingShopPageSlug === 'kids' ? 'KIDS' : editingShopPageSlug?.toUpperCase()}
                                                </div>
                                            </div>
                                        }
                                    />

                                    <button type="submit" disabled={fetcher.state !== "idle"} style={{
                                        width: '100%', padding: '14px', borderRadius: '8px',
                                        background: 'var(--accent-primary)', color: '#000',
                                        border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
                                        marginTop: '16px'
                                    }}>
                                        {fetcher.state !== "idle" ? "Збереження..." : "Зберегти фон"}
                                    </button>
                                </fetcher.Form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- FILTER CONFIG EDITOR MODAL (New) --- */}
            {
                filtersOpen && (
                    <FilterEditorModal
                        isOpen={filtersOpen}
                        onClose={() => setFiltersOpen(false)}
                        filterConfigs={filterConfigs}
                        shopPages={shopPages}
                        fetcher={fetcher}
                    />
                )
            }

            {/* --- ABOUT SLIDES EDITOR MODAL --- */}
            {
                aboutSlidesOpen && (
                    <AboutSlidesModal
                        isOpen={aboutSlidesOpen}
                        onClose={() => setAboutSlidesOpen(false)}
                        slides={aboutSlides}
                        fetcher={fetcher}
                    />
                )
            }
        </div>
    );
}

// --- Filter Editor Modal Component ---
function FilterEditorModal({ isOpen, onClose, filterConfigs = [], shopPages = [], fetcher }: any) {
    const [selectedPage, setSelectedPage] = useState('global');

    const [data, setData] = useState(() => {
        const globalRow = filterConfigs.find((c: any) => c.id === 'global');
        return parseAndMergeFilterConfig(globalRow?.config);
    });

    useEffect(() => {
        const configRow = filterConfigs.find((c: any) => c.id === selectedPage);
        const globalRow = filterConfigs.find((c: any) => c.id === 'global');
        const fallbackConfig = parseAndMergeFilterConfig(globalRow?.config);
        
        if (!configRow?.config) {
            setData(fallbackConfig);
        } else {
            setData(parseAndMergeFilterConfig(configRow.config));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPage, filterConfigs]);

    const handleSave = () => {
        const formData = new FormData();
        formData.append("intent", "update_filters");
        formData.append("pageSlug", selectedPage);
        formData.append("config", JSON.stringify(data));
        fetcher.submit(formData, { method: "post" });
        // Don't close immediately so they see it saved, but for simplicity we close now:
        onClose();
    };

    // Category Logic
    const [newCatKey, setNewCatKey] = useState('');
    const [newCatLabel, setNewCatLabel] = useState('');
    const addCategory = () => {
        if (!newCatKey || !newCatLabel) return;
        setData((prev: any) => ({
            ...prev,
            categories: { ...prev.categories, [newCatKey]: newCatLabel }
        }));
        setNewCatKey(''); setNewCatLabel('');
    };
    const removeCategory = (key: string) => {
        const newCats = { ...data.categories };
        delete newCats[key];
        setData((prev: any) => ({ ...prev, categories: newCats }));
    };

    // Color Logic
    const [newColorKey, setNewColorKey] = useState('');
    const [newColorLabel, setNewColorLabel] = useState('');
    const addColor = () => {
        if (!newColorKey || !newColorLabel) return;
        setData((prev: any) => ({
            ...prev,
            colors: { ...prev.colors, [newColorKey]: newColorLabel }
        }));
        setNewColorKey(''); setNewColorLabel('');
    };
    const removeColor = (key: string) => {
        const newColors = { ...data.colors };
        delete newColors[key];
        setData((prev: any) => ({ ...prev, colors: newColors }));
    };

    // Size Logic
    const [newSize, setNewSize] = useState('');
    const addSize = () => {
        if (!newSize) return;
        setData((prev: any) => ({
            ...prev,
            sizes: [...(prev.sizes || []), newSize]
        }));
        setNewSize('');
    };

    // Price Logic
    const addPriceRange = () => {
        const newRange = { id: `range-${Date.now()}`, label: 'Новий діапазон', min: 0, max: 1000 };
        setData((prev: any) => ({
            ...prev,
            priceRanges: [...prev.priceRanges, newRange]
        }));
    };
    const removePriceRange = (idx: number) => {
        const newRanges = data.priceRanges.filter((_: any, i: number) => i !== idx);
        setData((prev: any) => ({ ...prev, priceRanges: newRanges }));
    };

    const updateLabel = (type: 'categories' | 'colors', key: string, val: string) => {
        setData((prev: any) => ({
            ...prev,
            [type]: { ...prev[type], [key]: val }
        }));
    };

    const updatePriceRange = (index: number, field: string, val: any) => {
        const newRanges = [...data.priceRanges];
        newRanges[index] = { ...newRanges[index], [field]: val };
        setData((prev: any) => ({ ...prev, priceRanges: newRanges }));
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
            <div style={{
                width: '100%', maxWidth: '900px', maxHeight: '90vh',
                background: '#0f1216', borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 50px 100px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161b22' }}>
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700 }}>Керування фільтрами</h3>
                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Повне налаштування категорій, кольорів та цін.</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Для сторінки:</span>
                            <select
                                value={selectedPage}
                                onChange={(e) => setSelectedPage(e.target.value)}
                                style={{
                                    background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                                    padding: '8px 12px', borderRadius: '8px', outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="global">Всі сторінки (Global)</option>
                                {(shopPages || []).map((p: any) => (
                                    <option key={p.slug} value={p.slug}>
                                        {p.title ? `${p.title} (${p.slug})` : p.slug}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '12px' }}>✕</button>
                </div>

                {/* Body */}
                <div className="admin-scroll-custom" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

                    {/* Categories */}
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ color: 'var(--accent-primary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, borderLeft: '3px solid var(--accent-primary)', paddingLeft: '12px' }}>КАТЕГОРІЇ</h4>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            {Object.entries(data.categories).map(([key, label]: any) => (
                                <div key={key} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                    <button
                                        onClick={() => removeCategory(key)}
                                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }}
                                    >✕</button>
                                    <div style={{ fontSize: '10px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>ID: {key}</div>
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={(e) => updateLabel('categories', key, e.target.value)}
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '8px 12px' }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ background: 'rgba(94, 234, 212, 0.05)', padding: '20px', borderRadius: '16px', border: '1px dashed rgba(94, 234, 212, 0.3)', display: 'flex', gap: '12px' }}>
                            <input
                                placeholder="ID (напр. jumpsuits)"
                                value={newCatKey}
                                onChange={(e) => setNewCatKey(e.target.value)}
                                style={{ flex: 1, background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}
                            />
                            <input
                                placeholder="Назва (напр. Комбінезони)"
                                value={newCatLabel}
                                onChange={(e) => setNewCatLabel(e.target.value)}
                                style={{ flex: 2, background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}
                            />
                            <button onClick={addCategory} style={{ padding: '0 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Додати</button>
                        </div>
                    </div>

                    {/* Colors */}
                    <div style={{ marginBottom: '48px' }}>
                        <h4 style={{ color: 'var(--accent-primary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '24px', borderLeft: '3px solid var(--accent-primary)', paddingLeft: '12px' }}>КОЛЬОР�?</h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            {Object.entries(data.colors).map(([key, label]: any) => (
                                <div key={key} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
                                    <button
                                        onClick={() => removeColor(key)}
                                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }}
                                    >✕</button>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: key === 'other' ? 'linear-gradient(45deg, red, blue)' : key, border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', flexShrink: 0 }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Key: {key}</div>
                                        <input
                                            type="text"
                                            value={label}
                                            onChange={(e) => updateLabel('colors', key, e.target.value)}
                                            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: 'rgba(94, 234, 212, 0.05)', padding: '20px', borderRadius: '16px', border: '1px dashed rgba(94, 234, 212, 0.3)', display: 'flex', gap: '12px' }}>
                            <input
                                placeholder="CSS колір (напр. #FF0000)"
                                value={newColorKey}
                                onChange={(e) => setNewColorKey(e.target.value)}
                                style={{ flex: 1, background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}
                            />
                            <input
                                placeholder="Назва (напр. Яскравий червоний)"
                                value={newColorLabel}
                                onChange={(e) => setNewColorLabel(e.target.value)}
                                style={{ flex: 2, background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}
                            />
                            <button onClick={addColor} style={{ padding: '0 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Додати</button>
                        </div>
                    </div>

                    {/* Price Ranges */}
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ color: 'var(--accent-primary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, borderLeft: '3px solid var(--accent-primary)', paddingLeft: '12px' }}>ДІАПАЗОН�? ЦІН</h4>
                            <button onClick={addPriceRange} style={{ padding: '6px 16px', background: 'rgba(94, 234, 212, 0.1)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>+ ДОДАТ�?</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {data.priceRanges.map((range: any, idx: number) => (
                                <div key={range.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '24px', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Назва діапазону</div>
                                        <input
                                            type="text"
                                            value={range.label}
                                            placeholder="Напр: Доступні ціни"
                                            onChange={(e) => updatePriceRange(idx, 'label', e.target.value)}
                                            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 600, outline: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Від (₴)</div>
                                        <input
                                            type="number"
                                            value={range.min}
                                            onChange={(e) => updatePriceRange(idx, 'min', parseInt(e.target.value) || 0)}
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '14px' }}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>До (₴)</div>
                                        <input
                                            type="number"
                                            value={range.max}
                                            onChange={(e) => updatePriceRange(idx, 'max', parseInt(e.target.value) || 0)}
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '14px' }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => removePriceRange(idx)}
                                        style={{ height: '40px', width: '40px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sizes Management */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ color: 'var(--accent-primary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, borderLeft: '3px solid var(--accent-primary)', paddingLeft: '12px' }}>РОЗМІР�?</h4>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                            {(data.sizes || []).map((size: string, idx: number) => (
                                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={size}
                                        onChange={(e) => {
                                            const newSizes = [...data.sizes];
                                            newSizes[idx] = e.target.value;
                                            setData((prev: any) => ({ ...prev, sizes: newSizes }));
                                        }}
                                        style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', textAlign: 'center', minWidth: '0' }}
                                    />
                                    <button
                                        onClick={() => {
                                            const newSizes = data.sizes.filter((_: any, i: number) => i !== idx);
                                            setData((prev: any) => ({ ...prev, sizes: newSizes }));
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', opacity: 0.5 }}
                                    >✕</button>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: 'rgba(94, 234, 212, 0.05)', padding: '16px', borderRadius: '16px', border: '1px dashed rgba(94, 234, 212, 0.3)', display: 'flex', gap: '12px' }}>
                            <input
                                placeholder="Новий розмір (напр. XXL або 44)"
                                value={newSize}
                                onChange={(e) => setNewSize(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addSize()}
                                style={{ flex: 1, background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}
                            />
                            <button onClick={addSize} style={{ padding: '0 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Додати</button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '24px 32px', background: '#161b22', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                    <button onClick={onClose} style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Скасувати</button>
                    <button onClick={handleSave} style={{ padding: '12px 32px', borderRadius: '12px', background: 'var(--accent-primary)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: '0 10px 20px rgba(94, 234, 212, 0.2)' }}>Зберегти зміни</button>
                </div>
            </div>
        </div>
    );
}

// --- About Slides Editor Modal Component ---

// --- About Slides Editor Modal Component ---
function AboutSlidesModal({ isOpen, onClose, slides, fetcher }: { isOpen: boolean, onClose: () => void, slides: any[], fetcher: any }) {
    const defaultSlideData = {
        name: "New Slide",
        type: "triptych",
        image1_url: "/pics1cloths/IMG_6201.JPG",
        image1Pos: "center center",
        image2_url: "/pics1cloths/IMG_6203.JPG",
        image2Pos: "center center",
        image3_url: "/pics1cloths/IMG_6204.JPG",
        image3Pos: "center center"
    };

    const [editingSlide, setEditingSlide] = useState<any>(null);
    const [creationData, setCreationData] = useState<any>(defaultSlideData);

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
            setFile1(null); setFile2(null); setFile3(null);
            setEditingSlide(null);
        }
    }, [isOpen]);

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

        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });

        // Reset creation state
        setCreationData(defaultSlideData);
        setFile1(null); setFile2(null); setFile3(null);
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

        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
        setEditingSlide(null);
        setEditFile1(null); setEditFile2(null); setEditFile3(null);
    };

    const handleDelete = (id: string) => {
        if (!confirm("Видалити цей слайд?")) return;
        const formData = new FormData();
        formData.append("intent", "delete_about_slide");
        formData.append("id", id);
        fetcher.submit(formData, { method: "post" });
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)'
        }}>
            <div style={{
                background: '#0f1216', borderRadius: '16px', width: '90%', maxWidth: '900px', maxHeight: '85vh',
                display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Слайди "Про бренд"</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Керуйте слайдами на сторінці About</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px' }}>
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
                    {/* Slides List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {slides.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                                <p>Немає слайдів. Додайте перший!</p>
                            </div>
                        ) : slides.map((slide: any) => (
                            <div key={slide.id} style={{
                                display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#161b22',
                                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)'
                            }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <img src={slide.image1} alt="1" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                                    {slide.type === 'triptych' && (
                                        <>
                                            <img src={slide.image2} alt="2" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                                            <img src={slide.image3} alt="3" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                                        </>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>{slide.name}</div>
                                    <div style={{ fontSize: '11px', color: '#5eead4', marginTop: '4px' }}>{slide.type}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setEditingSlide({ ...slide })}
                                        style={{
                                            padding: '8px 14px', borderRadius: '8px', background: 'rgba(94, 234, 212, 0.1)',
                                            border: '1px solid rgba(94, 234, 212, 0.2)', color: '#5eead4', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                                        }}
                                    >
                                        Редагувати
                                    </button>
                                    <button
                                        onClick={() => handleDelete(slide.id)}
                                        style={{
                                            padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer'
                                        }}
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* New Slide Form (Collapsible or just inline) */}
                    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ fontSize: '16px', color: '#f8fafc', marginBottom: '16px' }}>Додати новий слайд</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <input
                                type="text"
                                placeholder="Назва слайду"
                                value={creationData.name}
                                onChange={e => setCreationData({ ...creationData, name: e.target.value })}
                                style={{ background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', color: '#fff' }}
                            />
                            <select
                                value={creationData.type}
                                onChange={e => setCreationData({ ...creationData, type: e.target.value })}
                                style={{ background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', color: '#fff' }}
                            >
                                <option value="triptych">Триптих (3 фото)</option>
                                <option value="single">Одне фото</option>
                            </select>
                        </div>

                        {/* Image Inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {/* Image 1 */}
                            <div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Фото 1 (ліве/головне)</div>
                                <input type="file" onChange={e => setFile1(e.target.files?.[0] || null)} style={{ fontSize: '12px', color: '#fff' }} />
                                <input
                                    type="text"
                                    placeholder="URL зображення"
                                    value={creationData.image1_url}
                                    onChange={e => setCreationData({ ...creationData, image1_url: e.target.value })}
                                    style={{ width: '100%', marginTop: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                                />
                            </div>

                            {creationData.type === 'triptych' && (
                                <>
                                    {/* Image 2 */}
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Фото 2 (центр)</div>
                                        <input type="file" onChange={e => setFile2(e.target.files?.[0] || null)} style={{ fontSize: '12px', color: '#fff' }} />
                                        <input
                                            type="text"
                                            placeholder="URL зображення"
                                            value={creationData.image2_url}
                                            onChange={e => setCreationData({ ...creationData, image2_url: e.target.value })}
                                            style={{ width: '100%', marginTop: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                                        />
                                    </div>
                                    {/* Image 3 */}
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Фото 3 (праве)</div>
                                        <input type="file" onChange={e => setFile3(e.target.files?.[0] || null)} style={{ fontSize: '12px', color: '#fff' }} />
                                        <input
                                            type="text"
                                            placeholder="URL зображення"
                                            value={creationData.image3_url}
                                            onChange={e => setCreationData({ ...creationData, image3_url: e.target.value })}
                                            style={{ width: '100%', marginTop: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={handleCreate}
                            style={{ marginTop: '20px', width: '100%', padding: '12px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Додати слайд
                        </button>

                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                            <button
                                onClick={() => setCreationData({
                                    name: "MIND BODY Lifestyle",
                                    type: "single",
                                    image1_url: "/generalpics/338_131123.jpg",
                                    image1Pos: "center center",
                                    image2_url: "",
                                    image2Pos: "center center",
                                    image3_url: "",
                                    image3Pos: "center center"
                                })}
                                style={{
                                    background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)',
                                    padding: '8px 16px', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer'
                                }}
                            >
                                Імпортувати стандартний слайд (Default)
                            </button>
                        </div>
                    </div>

                    {/* Edit Form */}
                    {editingSlide && (
                        <div style={{ marginTop: '24px', padding: '24px', background: '#161b22', borderRadius: '12px', border: '1px solid rgba(94, 234, 212, 0.2)' }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: '#5eead4' }}>Редагування слайду</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>Назва</label>
                                    <input
                                        type="text"
                                        value={editingSlide.name}
                                        onChange={(e) => setEditingSlide({ ...editingSlide, name: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>Тип</label>
                                    <select
                                        value={editingSlide.type}
                                        onChange={(e) => setEditingSlide({ ...editingSlide, type: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                    >
                                        <option value="triptych">Триптих</option>
                                        <option value="single">Одне фото</option>
                                    </select>
                                </div>
                            </div>

                            {/* Edit Image Inputs */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Фото 1</div>
                                    <ImageCropSelector
                                        currentImageUrl={editingSlide.image1}
                                        fileInputName="image1_file"
                                        value={editingSlide.image1Pos || "center center"}
                                        onChange={(val: string) => setEditingSlide({ ...editingSlide, image1Pos: val })}
                                        onFileSelect={setEditFile1}
                                        aspectRatio={editingSlide.type === 'single' ? '16/9' : '9/16'}
                                        overlay={
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '-40px' }}>
                                                    <img src="/pics/mind_body_logo.png" alt="MIND BODY" style={{ maxWidth: '75vw', width: '250px', height: 'auto', filter: 'brightness(0) invert(1) drop-shadow(0 0 15px rgba(255,255,255,0.3))' }} />
                                                </div>
                                                <div style={{ position: 'absolute', left: '20px', bottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', opacity: 0.8 }}>
                                                    <p style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', color: '#fff', fontSize: '10px', fontFamily: "'Tenor Sans', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase', textShadow: '0 2px 4px rgba(0,0,0,0.5)', margin: 0, whiteSpace: 'nowrap' }}>
                                                        Одяг, який надихає тебе рухатись
                                                    </p>
                                                    <div style={{ width: '1px', height: '20px', background: '#fff' }}></div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <input
                                        type="text"
                                        value={editingSlide.image1}
                                        onChange={e => setEditingSlide({ ...editingSlide, image1: e.target.value })}
                                        style={{ width: '100%', marginTop: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                                    />
                                </div>
                                {editingSlide.type === 'triptych' && (
                                    <>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Фото 2</div>
                                            <ImageCropSelector
                                                currentImageUrl={editingSlide.image2 || ""}
                                                fileInputName="image2_file"
                                                value={editingSlide.image2Pos || "center center"}
                                                onChange={(val: string) => setEditingSlide({ ...editingSlide, image2Pos: val })}
                                                onFileSelect={setEditFile2}
                                                aspectRatio="9/16"
                                                overlay={
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)' }}>
                                                        <div style={{ position: 'absolute', left: '20px', bottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', opacity: 0.8 }}>
                                                            <p style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', color: '#fff', fontSize: '10px', fontFamily: "'Tenor Sans', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase', textShadow: '0 2px 4px rgba(0,0,0,0.5)', margin: 0, whiteSpace: 'nowrap' }}>
                                                                Одяг, який надихає тебе рухатись
                                                            </p>
                                                            <div style={{ width: '1px', height: '20px', background: '#fff' }}></div>
                                                        </div>
                                                    </div>
                                                }
                                            />
                                            <input
                                                type="text"
                                                value={editingSlide.image2 || ""}
                                                onChange={e => setEditingSlide({ ...editingSlide, image2: e.target.value })}
                                                style={{ width: '100%', marginTop: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Фото 3</div>
                                            <ImageCropSelector
                                                currentImageUrl={editingSlide.image3 || ""}
                                                fileInputName="image3_file"
                                                value={editingSlide.image3Pos || "center center"}
                                                onChange={(val: string) => setEditingSlide({ ...editingSlide, image3Pos: val })}
                                                onFileSelect={setEditFile3}
                                                aspectRatio="9/16"
                                                overlay={
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)' }}>
                                                        <div style={{ position: 'absolute', right: '20px', bottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', opacity: 0.8 }}>
                                                            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.4)', overflow: 'hidden' }}><div style={{ width: '100%', height: '100%', background: '#fff' }}></div></div>
                                                        </div>
                                                    </div>
                                                }
                                            />
                                            <input
                                                type="text"
                                                value={editingSlide.image3 || ""}
                                                onChange={e => setEditingSlide({ ...editingSlide, image3: e.target.value })}
                                                style={{ width: '100%', marginTop: '8px', background: '#0f1216', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                <button
                                    onClick={() => { setEditingSlide(null); setEditFile1(null); setEditFile2(null); setEditFile3(null); }}
                                    style={{ padding: '10px 20px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer' }}
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={handleUpdate}
                                    style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Зберегти зміни
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
