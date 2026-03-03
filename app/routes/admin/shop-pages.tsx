
import { Form, useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { useState, useEffect, useRef } from "react";
import { prisma } from "../../db.server";
import { Buffer } from "buffer";

// --- Types ---
type ShopPageSettings = {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    heroImage: string;
    heroImagePos: string;
    prefixLabel: string | null;
};

// --- Icons ---
const CameraIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

// --- Loader ---
export async function loader() {
    const pages = await prisma.shopPage.findMany();
    // Use fallback minimal data if DB is empty
    if (!pages || pages.length === 0) {
        return {
            pages: [
                {
                    id: "temp-women", slug: "women", title: "Жіноча", subtitle: "колекція",
                    heroImage: "", heroImagePos: "50% 50% 1", prefixLabel: "For active life"
                },
                {
                    id: "temp-kids", slug: "kids", title: "Діти", subtitle: "колекція",
                    heroImage: "", heroImagePos: "50% 50% 1", prefixLabel: "For little stars"
                }
            ] as ShopPageSettings[]
        };
    }
    return { pages: pages as ShopPageSettings[] };
}

// --- Action ---
export async function action({ request }: { request: Request }) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "update_page") {
        const id = formData.get("id") as string;
        const title = formData.get("title") as string;
        const prefixLabel = formData.get("prefixLabel") as string;
        const heroImagePos = formData.get("heroImagePos") as string;

        let heroImage = formData.get("currentHeroImage") as string;
        const file = formData.get("heroImageFile") as File;

        if (file && file.size > 0 && file.name) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                let base64 = "";
                if (typeof Buffer !== "undefined") {
                    base64 = Buffer.from(arrayBuffer).toString("base64");
                } else {
                    const bytes = new Uint8Array(arrayBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i += 8192) {
                        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
                    }
                    base64 = btoa(binary);
                }
                const mimeType = file.type || "image/jpeg";
                heroImage = `data:${mimeType};base64,${base64}`;
            } catch (e) {
                console.error("File upload failed:", e);
            }
        }

        // If ID is temp, create new record
        if (id.startsWith("temp-")) {
            const slug = id.replace("temp-", "");
            await prisma.shopPage.upsert({
                where: { slug: slug },
                update: { title, prefixLabel, heroImage, heroImagePos },
                create: { slug, title, prefixLabel, heroImage, heroImagePos, subtitle: "колекція" }
            });
        } else {
            await prisma.shopPage.update({
                where: { id },
                data: { title, prefixLabel, heroImage, heroImagePos }
            });
        }

        return { success: true };
    }

    return null;
}

// --- Components ---

// Simplified copy of ImageCropSelector
const HeroCropSelector = ({
    currentImageUrl,
    value,
    onChange,
    onFileSelect
}: {
    currentImageUrl: string,
    value: string,
    onChange: (val: string) => void,
    onFileSelect: (file: File) => void
}) => {
    const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const parsePos = (pos: string) => {
        const parts = pos.split(' ');
        return {
            x: parseInt(parts[0]) || 50,
            y: parseInt(parts[1]) || 50,
            scale: parseFloat(parts[2]) || 1
        };
    };

    const [pos, setPos] = useState(parsePos(value));

    // Update internal state when props change
    useEffect(() => {
        setPos(parsePos(value));
    }, [value]);

    // Update preview url when props change
    useEffect(() => {
        setPreviewUrl(currentImageUrl);
    }, [currentImageUrl]);


    const emitChange = (newPos: { x: number, y: number, scale: number }) => {
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
            onFileSelect(file);
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

    const handleMouseUp = () => { setIsDragging(false); };
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

    // Aspect ratio for Hero is roughly 1440x600 (2.4:1) but responsive. 
    // We'll use a wide box to simulate.
    const aspectRatio = "16/6";

    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
                <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8'
                }}>
                    <CameraIcon /> Змінити фото обкладинки
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
            </div>

            {previewUrl && (
                <div>
                    <div style={{
                        marginBottom: '10px', fontSize: '11px', color: 'var(--accent-primary)',
                        background: 'rgba(94, 234, 212, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(94, 234, 212, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span>✛</span> Перетягуйте фото + колесо миші для масштабу
                    </div>

                    <div
                        ref={containerRef}
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
                        style={{
                            position: 'relative', width: '100%', aspectRatio: aspectRatio,
                            background: '#f0f0f0', borderRadius: '8px', overflow: 'hidden',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            userSelect: 'none'
                        }}
                    >
                        <img
                            src={previewUrl} alt="Preview" draggable={false}
                            style={{
                                position: 'absolute', inset: 0, width: '100%', height: '100%',
                                objectFit: 'cover',
                                objectPosition: `${pos.x}% ${pos.y}%`,
                                transform: `scale(${pos.scale})`,
                                transformOrigin: `${pos.x}% ${pos.y}%`,
                                pointerEvents: 'none'
                            }}
                        />
                        {/* Overlay matching site */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }}></div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '300px' }}>
                        <span style={{ fontSize: '14px' }}>🔍</span>
                        <input type="range" min="1" max="2.5" step="0.05" value={pos.scale} onChange={handleScaleChange}
                            style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '6px' }} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{Math.round(pos.scale * 100)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function AdminPages() {
    const { pages } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const navigation = useNavigation();

    const [selectedPageId, setSelectedPageId] = useState<string>(pages[0]?.id || "");
    const selectedPage = pages.find(p => p.id === selectedPageId) || pages[0];

    // Local state for editing
    const [title, setTitle] = useState(selectedPage?.title || "");
    const [prefixLabel, setPrefixLabel] = useState(selectedPage?.prefixLabel || "");
    const [heroImage, setHeroImage] = useState(selectedPage?.heroImage || "");
    const [heroImagePos, setHeroImagePos] = useState(selectedPage?.heroImagePos || "50% 50% 1");
    const [file, setFile] = useState<File | null>(null);

    // Update state when page changes
    useEffect(() => {
        if (selectedPage) {
            setTitle(selectedPage.title);
            setPrefixLabel(selectedPage.prefixLabel || "");
            setHeroImage(selectedPage.heroImage);
            setHeroImagePos(selectedPage.heroImagePos);
            setFile(null);
        }
    }, [selectedPage]);

    const handleSave = () => {
        if (!selectedPage) return;
        const formData = new FormData();
        formData.append("intent", "update_page");
        formData.append("id", selectedPage.id);
        formData.append("title", title);
        formData.append("prefixLabel", prefixLabel);
        formData.append("heroImagePos", heroImagePos);
        formData.append("currentHeroImage", heroImage);
        if (file) {
            formData.append("heroImageFile", file);
        }
        submit(formData, { method: "post", encType: "multipart/form-data" });
    };

    const isSaving = navigation.state === "submitting";

    // Preview Logic: mimicking shop.$category.tsx structure
    // Parse position for inline style in preview
    const parsePosForStyle = (posStr: string) => {
        const parts = posStr.split(' ');
        const x = parts[0] || "50%";
        const y = parts[1] || "50%";
        const scale = parseFloat(parts[2]) || 1;
        return { objectPosition: `${x} ${y}`, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: `${x} ${y}` };
    };

    const imageStyle = parsePosForStyle(heroImagePos);

    return (
        <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Редактор сторінок</h1>

                {/* Page Selector */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {pages.map(page => (
                        <button
                            key={page.id}
                            onClick={() => setSelectedPageId(page.id)}
                            style={{
                                padding: '8px 16px', borderRadius: '8px',
                                background: selectedPageId === page.id ? 'var(--accent-primary)' : '#1e293b',
                                color: selectedPageId === page.id ? '#000' : '#fff',
                                border: 'none', cursor: 'pointer', fontWeight: 600
                            }}
                        >
                            {page.slug === 'women' ? 'Жіноча' : page.slug === 'kids' ? 'Діти' : page.slug}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '32px' }}>

                {/* Sidebar Controls */}
                <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', height: 'fit-content' }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                        Налаштування
                    </h2>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>Верхній надпис (Prefix)</label>
                        <input
                            type="text"
                            value={prefixLabel}
                            onChange={(e) => setPrefixLabel(e.target.value)}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '8px',
                                background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>Головний заголовок</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '8px',
                                background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '12px', fontSize: '12px', color: '#94a3b8' }}>Налаштування фону</label>
                        <HeroCropSelector
                            currentImageUrl={heroImage || "https://placehold.co/1200x600/1e293b/FFF?text=No+Image"} // Fallback
                            value={heroImagePos}
                            onChange={setHeroImagePos}
                            onFileSelect={setFile}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '8px',
                            background: 'var(--accent-primary)', color: '#000',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold',
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        {isSaving ? "Збереження..." : "Зберегти зміни"}
                    </button>

                </div>

                {/* Live Preview */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '18px' }}>Попередній перегляд на сайті</h2>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Масштаб 1:1</span>
                    </div>

                    {/* Preview Box - Mimics Shop Page Hero */}
                    <div style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative',
                        // Styles mimicking .shop-hero-luxe from CSS
                        height: '600px', // Fixed height for preview
                        width: '100%',
                        background: '#000'
                    }}>
                        {/* Background Image Container */}
                        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                            {heroImage ? (
                                <img
                                    src={file ? URL.createObjectURL(file) : heroImage}
                                    style={{
                                        width: '100%', height: '100%', objectFit: 'cover',
                                        ...imageStyle // Apply user position & scale
                                    }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No Image</div>
                            )}
                            {/* Overlay if needed - check CSS later */}
                            {/* Drift effect div placeholder */}
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)' }}></div>
                        </div>

                        {/* Background Text Layer */}
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                            fontFamily: 'Agency FB, sans-serif', fontSize: '20vh', color: 'transparent',
                            WebkitTextStroke: '1px rgba(255,255,255,0.1)'
                        }}>
                            MIND BODY
                        </div>

                        {/* Content Container */}
                        <div className="container" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 40px' }}>

                                {/* Left Side: Title */}
                                <div>
                                    {/* Breadcrumb mock */}
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px', textTransform: 'uppercase' }}>
                                        <span>Головна</span> / <span>Магазин</span>
                                    </div>

                                    <h1 style={{ display: 'flex', flexDirection: 'column', color: '#fff', lineHeight: 0.9 }}>
                                        <span style={{ fontSize: '80px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-2px' }}>{title}</span>
                                        <span style={{ fontSize: '32px', fontWeight: 300, textTransform: 'uppercase', letterSpacing: '8px', marginLeft: '4px' }}>колекція</span>
                                    </h1>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                                        <span style={{ width: '40px', height: '1px', background: 'var(--accent-primary)' }}></span>
                                        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>mind body</span>
                                    </div>
                                </div>

                                {/* Right Side: Tagline */}
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', transform: 'rotate(-90deg)', transformOrigin: 'right bottom' }}>
                                        <span style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.5)' }}></span>
                                        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', whiteSpace: 'nowrap' }}>{prefixLabel}</span>
                                        <span style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.5)' }}></span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
