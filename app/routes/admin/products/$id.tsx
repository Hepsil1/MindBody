import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate, useParams, Link } from "react-router";
import { useState, useEffect } from "react";
import { prisma } from "../../../db.server";
import crypto from "crypto";

// --- Types ---
interface FilterConfigData {
    categories: Record<string, string>; // slug -> label
    colors: Record<string, string>; // slug -> label
    sizes: string[];
}

interface ProductForm {
    name: string;
    description: string;
    price: string;
    comparePrice: string;
    sku: string;
    status: "active" | "draft" | "archived";
    stock: string; // Total stock (calculated or manual)
    category: string;
    shopPageSlug: string;
    images: string[];
    colors: string[];
    sizes: string[];
    inventory: Record<string, number>; // "color_size" -> quantity
}

const emptyForm: ProductForm = {
    name: "",
    description: "",
    price: "",
    comparePrice: "",
    sku: "",
    status: "draft",
    stock: "0",
    category: "",
    shopPageSlug: "women", // Default
    images: [],
    colors: [],
    sizes: [],
    inventory: {}
};

// --- Loader ---
export async function loader({ params }: LoaderFunctionArgs) {
    const isNew = params.id === "new" || !params.id;
    let product = null;
    let filterConfig: FilterConfigData | null = null;
    let shopPages: { slug: string; title: string }[] = [];

    try {
        // 1. Fetch FilterConfig (Raw SQL)
        const configResult: any[] = await prisma.$queryRawUnsafe(`SELECT config FROM "FilterConfig" WHERE id = 'global' LIMIT 1`);
        if (configResult[0]?.config) {
            filterConfig = JSON.parse(configResult[0].config);
        }

        // 2. Fetch ShopPages (Raw SQL)
        const pagesResult: any[] = await prisma.$queryRawUnsafe(`SELECT slug, title FROM "ShopPage"`);
        shopPages = pagesResult.map((p: any) => ({ slug: p.slug, title: p.title }));

        // 3. Fetch Product if not new (Raw SQL)
        if (!isNew) {
            const productResult: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Product" WHERE id = $1`, params.id);
            if (productResult[0]) {
                const p = productResult[0];
                const parseJson = (str: string, fallback: any) => {
                    try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
                };

                const inventoryList = parseJson(p.inventory, []);
                // Convert list back to map
                const inventoryMap: Record<string, number> = {};
                if (Array.isArray(inventoryList)) {
                    inventoryList.forEach((item: any) => {
                        inventoryMap[`${item.color}_${item.size}`] = item.stock;
                    });
                }

                product = {
                    ...p,
                    price: String(p.price),
                    comparePrice: p.comparePrice ? String(p.comparePrice) : "",
                    stock: String(p.stock),
                    images: parseJson(p.images, []),
                    colors: parseJson(p.colors, []),
                    sizes: parseJson(p.sizes, []),
                    inventory: inventoryMap
                };
            }
        }
    } catch (e) {
        console.error("Loader failed:", e);
    }

    return { product, filterConfig, shopPages, isNew };
}

// --- Action ---
export async function action({ request, params }: ActionFunctionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "upload_image") {
        const file = formData.get("file") as File;
        if (!file || file.size === 0) return { error: "No file selected" };

        try {
            const buffer = await file.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const mimeType = file.type || "image/jpeg";
            const dataUrl = `data:${mimeType};base64,${base64}`;

            return { imageUrl: dataUrl };
        } catch (e) {
            console.error("Upload failed:", e);
            return { error: "Failed to process image" };
        }
    }

    if (intent === "save_product") {
        const id = params.id === "new" ? crypto.randomUUID() : params.id;

        // Basic Fields
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const price = parseFloat(formData.get("price") as string) || 0;
        const comparePrice = parseFloat(formData.get("comparePrice") as string) || null;
        const sku = formData.get("sku") as string;
        const status = formData.get("status") as string;
        const stock = parseInt(formData.get("stock") as string) || 0;

        // Complex Fields
        const category = formData.get("category") as string;
        const shopPageSlug = formData.get("shopPageSlug") as string;
        const images = formData.get("images") as string;
        const colors = formData.get("colors") as string;
        const sizes = formData.get("sizes") as string;
        const inventory = formData.get("inventory") as string;

        try {
            const now = new Date().toISOString();

            // Remove lazy migration (not needed for Postgres, schema managed by Prisma)

            // Upsert Product (PostgreSQL syntax) using CURRENT_TIMESTAMP
            await prisma.$executeRawUnsafe(`
                INSERT INTO "Product" (id, name, description, price, "comparePrice", sku, status, stock, category, "shopPageSlug", images, colors, sizes, inventory, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    name=EXCLUDED.name,
                    description=EXCLUDED.description,
                    price=EXCLUDED.price,
                    "comparePrice"=EXCLUDED."comparePrice",
                    sku=EXCLUDED.sku,
                    status=EXCLUDED.status,
                    stock=EXCLUDED.stock,
                    category=EXCLUDED.category,
                    "shopPageSlug"=EXCLUDED."shopPageSlug",
                    images=EXCLUDED.images,
                    colors=EXCLUDED.colors,
                    sizes=EXCLUDED.sizes,
                    inventory=EXCLUDED.inventory,
                    "updatedAt"=CURRENT_TIMESTAMP
            `, id, name, description, price, comparePrice, sku, status, stock, category, shopPageSlug, images, colors, sizes, inventory);

            return { success: true };
        } catch (e) {
            console.error("Save failed:", e);
            return { error: "Failed to save product" };
        }
    }

    return null;
}

// --- Icons ---
const UploadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

const ArrowLeftIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

// --- Component ---
export default function AdminProductEdit() {
    const { product, filterConfig, shopPages, isNew } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const navigate = useNavigate();

    // Initial State
    const [formData, setFormData] = useState<ProductForm>(() => {
        if (product) return product;
        return {
            ...emptyForm,
            shopPageSlug: shopPages[0]?.slug || "women"
        };
    });

    // Upload Handler
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const fd = new FormData();
            fd.append("intent", "upload_image");
            fd.append("file", e.target.files[0]);
            fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
        }
    };

    // Listen for upload success
    useEffect(() => {
        if (fetcher.data?.imageUrl) {
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, fetcher.data.imageUrl]
            }));
        }
    }, [fetcher.data]);

    // Save Handler
    const handleSave = () => {
        const data = new FormData();
        data.append("intent", "save_product");

        // Append all simple fields
        Object.entries(formData).forEach(([key, value]) => {
            if (key === 'inventory') {
                // Convert Map to List for storage
                const inventoryList = Object.entries(value).map(([id, stock]) => {
                    const [color, size] = id.split('_');
                    return { color, size, stock };
                });
                data.append(key, JSON.stringify(inventoryList));
            } else if (Array.isArray(value)) {
                data.append(key, JSON.stringify(value));
            } else {
                data.append(key, String(value));
            }
        });

        fetcher.submit(data, { method: "post" });
    };

    // Redirect on success or show error
    useEffect(() => {
        if (fetcher.data?.success) {
            navigate("/admin/products");
        } else if (fetcher.data?.error) {
            alert("Помилка при збереженні: " + fetcher.data.error);
        }
    }, [fetcher.data, navigate]);

    // Helpers
    const toggleArrayItem = (field: 'colors' | 'sizes', item: string) => {
        setFormData(prev => {
            const current = prev[field];
            const newArray = current.includes(item)
                ? current.filter(i => i !== item)
                : [...current, item];
            return { ...prev, [field]: newArray };
        });
    };

    // Update stock when inventory changes
    useEffect(() => {
        const total = Object.values(formData.inventory).reduce((a, b) => a + b, 0);
        if (total > 0) {
            setFormData(p => ({ ...p, stock: String(total) }));
        }
    }, [formData.inventory]);

    const globalApplyStock = (qty: number) => {
        const newInventory = { ...formData.inventory };
        formData.colors.forEach(c => {
            formData.sizes.forEach(s => {
                newInventory[`${c}_${s}`] = qty;
            });
        });
        setFormData(p => ({ ...p, inventory: newInventory }));
    }

    return (
        <div className="admin-wrapper">
            <style>{`
                :root {
                    --ad-bg: #0f1115;
                    --ad-bg-card: #181b21;
                    --ad-bg-input: #232830;
                    --ad-border: rgba(255, 255, 255, 0.08);
                    --ad-text-main: #f1f5f9;
                    --ad-text-muted: #94a3b8;
                    --ad-primary: #5eead4; /* Teal */
                    --ad-primary-hover: #2dd4bf;
                    --ad-danger: #ef4444; 
                    --ad-radius: 12px;
                    --ad-radius-sm: 8px;
                }

                .admin-wrapper {
                    background-color: var(--ad-bg);
                    min-height: 100vh;
                    color: var(--ad-text-main);
                    font-family: 'DM Sans', sans-serif;
                    padding: 40px;
                }

                .admin-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                /* Header */
                .admin-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 40px;
                }
                .admin-back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--ad-text-muted);
                    text-decoration: none;
                    font-size: 14px;
                    margin-bottom: 12px;
                    transition: color 0.2s;
                }
                .admin-back-link:hover { color: var(--ad-text-main); }
                
                .page-title {
                    font-size: 32px;
                    font-family: var(--font-display);
                    font-weight: 400;
                    margin: 0;
                    line-height: 1.2;
                }
                .page-subtitle {
                    color: var(--ad-text-muted);
                    font-size: 14px;
                    margin-top: 4px;
                }

                /* Buttons */
                .btn-save {
                    background: var(--ad-primary);
                    color: #0f172a;
                    border: none;
                    padding: 12px 32px;
                    font-weight: 600;
                    border-radius: 100px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(94, 234, 212, 0.2);
                }
                .btn-save:hover {
                    background: var(--ad-primary-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(94, 234, 212, 0.3);
                }
                .btn-save:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                /* Layout Grid */
                .admin-layout-grid {
                    display: grid;
                    grid-template-columns: 1fr 380px;
                    gap: 32px;
                    align-items: start;
                }
                @media (max-width: 1000px) {
                    .admin-layout-grid { grid-template-columns: 1fr; }
                }

                /* Cards */
                .ad-card {
                    background: var(--ad-bg-card);
                    border: 1px solid var(--ad-border);
                    border-radius: var(--ad-radius);
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }
                .ad-card-title {
                    font-size: 18px;
                    font-weight: 500;
                    margin: 0 0 24px 0;
                    color: var(--ad-text-main);
                    border-bottom: 1px solid var(--ad-border);
                    padding-bottom: 16px;
                }

                /* Forms */
                .form-group { margin-bottom: 20px; }
                .form-label {
                    display: block;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--ad-text-muted);
                    margin-bottom: 8px;
                    font-weight: 600;
                }
                
                .form-input, .form-select, .form-textarea {
                    width: 100%;
                    background: var(--ad-bg-input);
                    border: 1px solid transparent;
                    border-radius: var(--ad-radius-sm);
                    color: var(--ad-text-main);
                    padding: 12px 16px;
                    font-family: inherit;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .form-input:focus, .form-select:focus, .form-textarea:focus {
                    outline: none;
                    background: #2a303a;
                    border-color: rgba(94, 234, 212, 0.3);
                    box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.1);
                }
                .form-textarea { resize: vertical; min-height: 120px; line-height: 1.6; }

                /* Colors Variants */
                .color-grid { display: flex; flex-wrap: wrap; gap: 10px; }
                .color-option {
                    width: 42px; height: 42px;
                    border-radius: 50%;
                    cursor: pointer;
                    position: relative;
                    border: 2px solid transparent;
                    transition: transform 0.2s;
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
                }
                .color-option:hover { transform: scale(1.1); }
                .color-option.active {
                    box-shadow: 0 0 0 2px var(--ad-bg-card), 0 0 0 4px var(--ad-primary);
                }
                .check-mark {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-size: 14px;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
                }

                /* Sizes Variants */
                .size-grid { display: flex; flex-wrap: wrap; gap: 8px; }
                .size-option {
                    padding: 8px 16px;
                    background: var(--ad-bg-input);
                    border: 1px solid var(--ad-border);
                    border-radius: 6px;
                    color: var(--ad-text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 13px;
                }
                .size-option:hover { background: #333; color: var(--ad-text-main); }
                .size-option.active {
                    background: rgba(94, 234, 212, 0.15);
                    border-color: var(--ad-primary);
                    color: var(--ad-primary);
                    font-weight: 600;
                }

                /* Image Grid */
                .image-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                .image-item {
                    aspect-ratio: 3/4;
                    border-radius: 8px;
                    overflow: hidden;
                    position: relative;
                    border: 1px solid var(--ad-border);
                    background: #000;
                }
                .image-item img {
                    width: 100%; height: 100%; object-fit: cover;
                    opacity: 0.8; transition: opacity 0.3s;
                }
                .image-item:hover img { opacity: 1; }
                .delete-btn {
                    position: absolute;
                    top: 6px; right: 6px;
                    background: rgba(0,0,0,0.6);
                    color: #fff;
                    width: 28px; height: 28px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 4px;
                    border: none; cursor: pointer;
                    transition: background 0.2s;
                }
                .delete-btn:hover { background: var(--ad-danger); }
                
                .upload-box {
                    aspect-ratio: 3/4;
                    border: 2px dashed var(--ad-border);
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: var(--ad-text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                    background: rgba(255,255,255,0.02);
                }
                .upload-box:hover {
                    border-color: var(--ad-primary);
                    color: var(--ad-primary);
                    background: rgba(94, 234, 212, 0.05);
                }

                /* Inventory Table */
                .inv-table-wrapper {
                    border: 1px solid var(--ad-border);
                    border-radius: 8px;
                    overflow: hidden;
                    margin-top: 20px;
                }
                .inv-header {
                    background: rgba(255,255,255,0.03);
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--ad-border);
                }
                .inv-table { width: 100%; border-collapse: collapse; }
                .inv-table tr { border-bottom: 1px solid var(--ad-border); }
                .inv-table tr:last-child { border-bottom: none; }
                .inv-table td { padding: 12px 16px; font-size: 13px; }
                .inv-input {
                    padding: 8px;
                    background: var(--ad-bg);
                    border: 1px solid var(--ad-border);
                    border-radius: 4px;
                    color: var(--ad-text-main);
                    width: 80px;
                    text-align: center;
                }
                .inv-input:focus { border-color: var(--ad-primary); outline: none; }

            `}</style>

            <div className="admin-container">
                {/* Header */}
                <div className="admin-header">
                    <div>
                        <Link to="/admin/products" className="admin-back-link">
                            <ArrowLeftIcon />
                            До списку товарів
                        </Link>
                        <h1 className="page-title">{isNew ? "Новий товар" : formData.name || "Редагування"}</h1>
                        <p className="page-subtitle">
                            {isNew ? "Створіть ідеальний товар для вашого магазину" : `SKU: ${formData.sku || '---'}`}
                        </p>
                    </div>
                    <div>
                        <button
                            className="btn-save"
                            onClick={handleSave}
                            disabled={fetcher.state !== "idle"}
                        >
                            {fetcher.state !== "idle" ? "Збереження..." : "Зберегти зміни"}
                        </button>
                    </div>
                </div>

                <div className="admin-layout-grid">
                    {/* Left Column: Main Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        <div className="ad-card">
                            <h3 className="ad-card-title">Загальна інформація</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Розділ магазину</label>
                                    <select
                                        className="form-select"
                                        value={formData.shopPageSlug}
                                        onChange={e => setFormData(p => ({ ...p, shopPageSlug: e.target.value }))}
                                    >
                                        {shopPages.map(page => (
                                            <option key={page.slug} value={page.slug}>{page.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Категорія</label>
                                    <select
                                        className="form-select"
                                        value={formData.category}
                                        onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                                    >
                                        <option value="">Оберіть категорію</option>
                                        {filterConfig?.categories && Object.entries(filterConfig.categories).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Назва товару</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Напр. Спортивний топ Aura"
                                    value={formData.name}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    style={{ fontSize: '16px', fontWeight: 500 }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Опис</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Детальний описи товару, склад, особливості..."
                                    value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="ad-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--ad-border)', paddingBottom: '16px' }}>
                                <h3 className="ad-card-title" style={{ margin: 0, padding: 0, border: 'none' }}>Варіанти та Склад</h3>
                                <div style={{ fontSize: '13px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', color: '#5eead4' }}>
                                    Загальна кількість: <b>{formData.stock} шт.</b>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Доступні кольори (оберіть всі)</label>
                                <div className="color-grid">
                                    {filterConfig?.colors && Object.entries(filterConfig.colors).map(([key, label]) => (
                                        <div
                                            key={key}
                                            onClick={() => toggleArrayItem('colors', key)}
                                            className={`color-option ${formData.colors.includes(key) ? 'active' : ''}`}
                                            style={{
                                                background: key === 'other' ? 'linear-gradient(45deg, #eee, #999)' : key
                                            }}
                                            title={label}
                                        >
                                            {formData.colors.includes(key) && <div className="check-mark">✓</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Доступні розміри</label>
                                <div className="size-grid">
                                    {(filterConfig?.sizes || []).map((size) => (
                                        <div
                                            key={size}
                                            onClick={() => toggleArrayItem('sizes', size)}
                                            className={`size-option ${formData.sizes.includes(size) ? 'active' : ''}`}
                                        >
                                            {size}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {formData.colors.length > 0 && formData.sizes.length > 0 ? (
                                <div className="inv-table-wrapper">
                                    <div className="inv-header">
                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Керування залишками</span>
                                        <button
                                            onClick={() => {
                                                const qty = prompt("Введіть кількість для всіх варіантів:", "10");
                                                if (qty) globalApplyStock(parseInt(qty));
                                            }}
                                            style={{ fontSize: '12px', color: 'var(--ad-primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ЗАПОВНИТИ ВСІ
                                        </button>
                                    </div>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        <table className="inv-table">
                                            <tbody>
                                                {formData.colors.map(color => (
                                                    formData.sizes.map(size => {
                                                        const key = `${color}_${size}`;
                                                        return (
                                                            <tr key={key}>
                                                                <td style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }}></div>
                                                                    <span style={{ fontWeight: 500 }}>{filterConfig?.colors[color] || color} / {size}</span>
                                                                </td>
                                                                <td style={{ width: '100px', textAlign: 'right' }}>
                                                                    <input
                                                                        type="number"
                                                                        className="inv-input"
                                                                        value={formData.inventory[key] || 0}
                                                                        onChange={(e) => setFormData(p => ({
                                                                            ...p,
                                                                            inventory: { ...p.inventory, [key]: parseInt(e.target.value) || 0 }
                                                                        }))}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        )
                                                    })
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginTop: '16px', fontSize: '14px', color: 'var(--ad-text-muted)' }}>
                                    Оберіть хоча б один колір та розмір, щоб налаштувати склад.
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        <div className="ad-card">
                            <h3 className="ad-card-title">Статус публікації</h3>
                            <div className="form-group">
                                <select
                                    className="form-select"
                                    value={formData.status}
                                    onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
                                    style={{
                                        color: formData.status === 'active' ? 'var(--ad-primary)' : 'inherit',
                                        fontWeight: formData.status === 'active' ? '600' : '400',
                                        border: formData.status === 'active' ? '1px solid rgba(94, 234, 212, 0.3)' : '1px solid transparent'
                                    }}
                                >
                                    <option value="active">🟢 Опубліковано (Active)</option>
                                    <option value="draft">🟡 Чернетка (Draft)</option>
                                    <option value="archived">🔴 Архів (Archived)</option>
                                </select>
                            </div>
                        </div>

                        <div className="ad-card">
                            <h3 className="ad-card-title">Фотографії</h3>
                            <div className="image-grid">
                                {formData.images.map((img, idx) => (
                                    <div key={idx} className="image-item">
                                        <img src={img} alt="" />
                                        <button className="delete-btn" onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))}>
                                            <TrashIcon />
                                        </button>
                                    </div>
                                ))}

                                <label className="upload-box">
                                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                                    {fetcher.state === "submitting" && fetcher.formData?.get("intent") === "upload_image" ? (
                                        <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                    ) : (
                                        <>
                                            <UploadIcon />
                                            <span style={{ fontSize: '12px', marginTop: '8px' }}>Додати</span>
                                        </>
                                    )}
                                </label>
                            </div>
                        </div>

                        <div className="ad-card">
                            <h3 className="ad-card-title">Ціноутворення</h3>
                            <div className="form-group">
                                <label className="form-label">Ціна (UAH)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--ad-primary)' }}
                                    value={formData.price}
                                    onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Стара ціна (акція)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="----"
                                    value={formData.comparePrice}
                                    onChange={e => setFormData(p => ({ ...p, comparePrice: e.target.value }))}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Артикул (SKU)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.sku}
                                    onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div >
    );
}
