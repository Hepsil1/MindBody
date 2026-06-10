import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import {
    useLoaderData,
    useFetcher,
    useNavigate,
    useBlocker,
    Link,
    isRouteErrorResponse,
} from "react-router";
import { useState, useEffect, useMemo } from "react";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { uploadFile } from "../../../utils/upload.server";
import { parseAndMergeFilterConfig } from "../../../utils/filters";
import {
    ALLOWED_CATEGORY_SLUGS,
    isValidSubcategory,
    slugToLabel,
} from "../../../utils/categoryMap";
import {
    fabricsFor,
    sleevesFor,
    fabricLabel,
    sleeveLabel,
    SHOP_SLUGS,
    subcategoriesFor,
} from "../../../utils/taxonomy";
import { slugify } from "../../../utils/slugify";
import { getColorHex, getColorLabel } from "../../../utils/colors";
import { publishChecklist, publishBlockers } from "../../../utils/productQuality";
import productEditStyles from "../../../styles/admin-product-edit.css?url";

export function links() {
    return [{ rel: "stylesheet", href: productEditStyles }];
}

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
    fabric: string; // sport | cotton | "" — see taxonomy.ts
    sleeve: string; // long | short | sleeveless | velo | ""
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
    fabric: "",
    sleeve: "",
    shopPageSlug: SHOP_SLUGS[0], // Default — first real shop (yoga)
    images: [],
    colors: [],
    sizes: [],
    inventory: {},
};

// Defensive JSON parser that preserves the fallback's type.
function parseJsonAdmin<T>(str: string | null | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

interface InventoryEntry {
    color?: string;
    size?: string;
    stock: number;
}

// --- Loader ---
export async function loader({ params }: LoaderFunctionArgs) {
    const isNew = params.id === "new" || !params.id;
    let product = null;
    const filterConfigs: Record<string, FilterConfigData> = {};
    let shopPages: { slug: string; title: string }[] = [];

    try {
        // 1. Fetch FilterConfigs
        const configResult = await prisma.filterConfig.findMany({
            select: { id: true, config: true },
        });
        for (const row of configResult) {
            filterConfigs[row.id] = parseAndMergeFilterConfig(row.config);
        }
        if (!filterConfigs["global"]) {
            filterConfigs["global"] = parseAndMergeFilterConfig(null);
        }

        // 2. Fetch ShopPages
        const pagesResult = await prisma.shopPage.findMany({
            select: { slug: true, title: true },
        });
        shopPages = pagesResult.map((p) => ({ slug: p.slug, title: p.title }));

        // 3. Fetch Product if not new
        if (!isNew && params.id) {
            const p = await prisma.product.findUnique({ where: { id: params.id } });
            if (p) {
                const inventoryList = parseJsonAdmin<InventoryEntry[]>(p.inventory, []);
                // Convert list back to map
                const inventoryMap: Record<string, number> = {};
                if (Array.isArray(inventoryList)) {
                    inventoryList.forEach((item) => {
                        inventoryMap[`${item.color}_${item.size}`] = item.stock;
                    });
                }

                // ProductForm requires non-null strings for several fields where
                // Prisma exposes them as `string | null`. Coerce here so the
                // contract is enforced at the boundary.
                const status: ProductForm["status"] =
                    p.status === "active" || p.status === "draft" || p.status === "archived"
                        ? p.status
                        : "draft";

                product = {
                    ...p,
                    name: p.name,
                    description: p.description ?? "",
                    sku: p.sku ?? "",
                    category: p.category ?? "",
                    fabric: p.fabric ?? "",
                    sleeve: p.sleeve ?? "",
                    shopPageSlug: p.shopPageSlug ?? "",
                    status,
                    price: String(p.price),
                    comparePrice: p.comparePrice ? String(p.comparePrice) : "",
                    stock: String(p.stock),
                    images: parseJsonAdmin<string[]>(p.images, []),
                    colors: parseJsonAdmin<string[]>(p.colors, []),
                    sizes: parseJsonAdmin<string[]>(p.sizes, []),
                    inventory: inventoryMap,
                };
            }
        }
    } catch (e) {
        console.error("Loader failed:", e);
    }

    // Don't silently render the blank "new" form for an existing id whose load
    // failed or returned nothing — saving that would overwrite the real product
    // with defaults. Surface a 404 (handled by the ErrorBoundary) instead.
    if (!isNew && !product) {
        throw new Response("Product not found", { status: 404 });
    }
    return { product, filterConfigs, shopPages, isNew };
}

// --- Action ---
export async function action({ request, params }: ActionFunctionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        const formData = await request.formData();
        const intent = formData.get("intent");

        if (intent === "upload_image") {
            const file = formData.get("file");
            if (!file) return { error: "No file selected" };

            try {
                const uploadedUrl = await uploadFile(file);
                if (!uploadedUrl) return { error: "Failed to process image" };

                return { imageUrl: uploadedUrl };
            } catch (e) {
                console.error("Upload failed:", e);
                return { error: "Failed to process image" };
            }
        }

        if (intent === "save_product") {
            const isNew = params.id === "new" || !params.id;
            const id = isNew ? generateUUID() : (params.id as string);

            // --- Parse raw fields ---
            const name = ((formData.get("name") as string) || "").trim();
            const description = ((formData.get("description") as string) || "").trim() || null;
            const priceNum = Number(formData.get("price"));
            const comparePriceStr = ((formData.get("comparePrice") as string) || "").trim();
            const comparePriceNum = comparePriceStr ? Number(comparePriceStr) : NaN;
            const sku = ((formData.get("sku") as string) || "").trim() || null;
            const statusRaw = (formData.get("status") as string) || "draft";
            const category = (formData.get("category") as string) || null;
            const shopPageSlug = (formData.get("shopPageSlug") as string) || null;

            // Arrays (defensive parse — never trust the client blob).
            const imagesArr = parseJsonAdmin<string[]>(formData.get("images") as string, []);
            const colorsArr = parseJsonAdmin<string[]>(formData.get("colors") as string, []);
            const sizesArr = parseJsonAdmin<string[]>(formData.get("sizes") as string, []);
            const cleanImages = Array.isArray(imagesArr)
                ? imagesArr.filter((x) => typeof x === "string" && x.length > 0)
                : [];
            const cleanColors = Array.isArray(colorsArr)
                ? colorsArr.filter((x) => typeof x === "string")
                : [];
            const cleanSizes = Array.isArray(sizesArr)
                ? sizesArr.filter((x) => typeof x === "string")
                : [];

            // --- Validate: never let an admin save a broken/invisible product.
            // Each silent default the form used to apply (₴0 price, blank name,
            // no shop/category/images) produced a row that renders wrong or is
            // invisible on the storefront (loadShopData filters by shopPageSlug
            // + status='active'). Block the save with a clear message instead.
            const PRODUCT_STATUSES = ["active", "draft", "archived"];
            const problems: string[] = [];
            if (!name) problems.push("вкажіть назву");
            if (!Number.isFinite(priceNum) || priceNum <= 0)
                problems.push("ціна має бути більшою за 0");
            if (!shopPageSlug || !SHOP_SLUGS.includes(shopPageSlug))
                problems.push("оберіть розділ магазину");
            if (!category) problems.push("оберіть категорію");
            if (cleanImages.length === 0) problems.push("додайте хоча б одне зображення");

            // Category must be a known slug (no Cyrillic labels) AND valid for
            // the chosen shop — the (shop, category) pair gate the fabric/sleeve
            // logic below already applies, now enforced for the category too.
            if (category && !ALLOWED_CATEGORY_SLUGS.has(category)) {
                return {
                    error: `Невідома категорія "${category}". Оберіть значення зі списку — у БД зберігається slug (longsleeve, tops…), не український ярлик.`,
                };
            }
            if (category && shopPageSlug && !isValidSubcategory(shopPageSlug, category)) {
                problems.push("обрана категорія недоступна для цього розділу");
            }
            if (problems.length > 0) {
                return { error: `Не вдалося зберегти: ${problems.join(", ")}.` };
            }

            const status = PRODUCT_STATUSES.includes(statusRaw) ? statusRaw : "draft";
            const price = priceNum;
            // "Стара ціна" is only a real sale when strictly greater than price;
            // otherwise null so the storefront doesn't show a phantom discount.
            const comparePrice =
                Number.isFinite(comparePriceNum) && comparePriceNum > priceNum
                    ? comparePriceNum
                    : null;

            // Deeper taxonomy (Level 3/4). Only persist a value valid for the
            // chosen (shop, subcategory) per TAXONOMY; else null.
            const fabricRaw = (formData.get("fabric") as string) || "";
            const sleeveRaw = (formData.get("sleeve") as string) || "";
            const fabric =
                shopPageSlug &&
                category &&
                (fabricsFor(shopPageSlug, category) as string[]).includes(fabricRaw)
                    ? fabricRaw
                    : null;
            const sleeve =
                shopPageSlug &&
                category &&
                (sleevesFor(shopPageSlug, category) as string[]).includes(sleeveRaw)
                    ? sleeveRaw
                    : null;

            // --- Reconcile inventory with the submitted colors/sizes so a
            // deselected color/size can't leave an orphan variant. The PDP
            // rebuilds buyable colors/sizes from in-stock variants and ignores
            // Product.colors/sizes when any variant exists, so an orphan would
            // resurrect a "removed" option as buyable on the live store.
            const inventoryArr = parseJsonAdmin<InventoryEntry[]>(
                formData.get("inventory") as string,
                [],
            );
            const cleanInventory = (Array.isArray(inventoryArr) ? inventoryArr : []).filter(
                (v) =>
                    (!v.color || cleanColors.includes(v.color)) &&
                    (!v.size || cleanSizes.includes(v.size)),
            );
            const hasVariants = cleanInventory.length > 0;
            const variantStock = cleanInventory.reduce((n, v) => n + (Number(v.stock) || 0), 0);
            // Stock derives from variants when they exist (single source of
            // truth); otherwise the manual field (variant-less simple products).
            const stock = hasVariants
                ? variantStock
                : parseInt(formData.get("stock") as string) || 0;

            // Publication quality gate — a product can only go LIVE when it's
            // complete (stock, and fabric/sleeve when the category offers them).
            // Drafts/archived may be incomplete. Server is the source of truth;
            // the form mirrors this to disable the button + show a checklist.
            if (status === "active") {
                const blockers = publishBlockers({
                    price,
                    imagesCount: cleanImages.length,
                    category: category ?? "",
                    shopPageSlug: shopPageSlug ?? "",
                    stock,
                    fabric: fabric ?? "",
                    sleeve: sleeve ?? "",
                });
                if (blockers.length > 0) {
                    return {
                        error: `Не можна опублікувати: ${blockers.join(", ")}. Збережіть як чернетку або заповніть ці поля.`,
                    };
                }
            }

            // Re-serialize the cleaned arrays so the DB matches what we validated.
            const images = JSON.stringify(cleanImages);
            const colors = JSON.stringify(cleanColors);
            const sizes = JSON.stringify(cleanSizes);
            const inventory = JSON.stringify(cleanInventory);

            // SEO slug — auto-generate from the name (preserve any existing one
            // via COALESCE in the UPSERT) so /p/<slug> and the sitemap work.
            const slug = await ensureUniqueSlug(name, id as string);

            try {
                // slug is assigned once and preserved across later edits (stable
                // SEO URL); a legacy/null slug gets the freshly generated value.
                const existing = await prisma.product.findUnique({
                    where: { id },
                    select: { slug: true },
                });
                const fields = {
                    name,
                    description,
                    price,
                    comparePrice,
                    sku,
                    status,
                    stock,
                    category,
                    shopPageSlug,
                    images,
                    colors,
                    sizes,
                    inventory,
                    fabric,
                    sleeve,
                };
                await prisma.product.upsert({
                    where: { id },
                    create: { id, ...fields, slug },
                    update: { ...fields, slug: existing?.slug ?? slug },
                });

                return { success: true };
            } catch (e) {
                console.error("Save failed:", e);
                return { error: "Не вдалося зберегти товар. Спробуйте ще раз." };
            } finally {
                // Invalidate caches so storefront shows fresh data
                const { invalidateAll } = await import("../../../utils/cache.server");
                invalidateAll();
            }
        }

        return null;
    } catch (e) {
        console.error("Action error:", e);
        // Don't leak raw error/stack to the client.
        return { error: "Сталася серверна помилка. Спробуйте ще раз." };
    }
}

// --- Icons ---
const UploadIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        width="24"
        height="24"
    >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const TrashIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="14"
        height="14"
    >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

const ArrowLeftIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="20"
        height="20"
    >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

// --- Custom UUID fallback ---
function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Build a unique Product.slug from the (Cyrillic) name, transliterated to
// Latin, appending -2/-3… on collision. Excludes the product's own id so
// re-saving an existing product doesn't collide with itself.
async function ensureUniqueSlug(name: string, id: string): Promise<string> {
    const base = slugify(name) || "tovar";
    let candidate = base;
    for (let n = 2; n < 200; n++) {
        const clash = await prisma.product.findFirst({
            where: { slug: candidate, id: { not: id } },
            select: { id: true },
        });
        if (!clash) return candidate;
        candidate = `${base}-${n}`;
    }
    return `${base}-${id.slice(0, 8)}`;
}

// --- Error Boundary ---
export function ErrorBoundary({ error }: { error: unknown }) {
    console.error("ErrorBoundary caught error in AdminProductEdit:", error);

    let errorDetails = "";
    if (isRouteErrorResponse(error)) {
        errorDetails = `HTTP Error ${error.status} ${error.statusText}\nData: ${JSON.stringify(error.data)}`;
    } else if (error instanceof Error) {
        errorDetails = `${error.message}\n${error.stack}`;
    } else if (typeof error === "object" && error !== null) {
        // Try to stringify safely, handling circular references or proxy objects
        try {
            const cache = new Set();
            errorDetails = JSON.stringify(
                error,
                (key, value) => {
                    if (typeof value === "object" && value !== null) {
                        if (cache.has(value)) {
                            return "[Circular]";
                        }
                        cache.add(value);
                    }
                    return value;
                },
                2,
            );
        } catch (e) {
            errorDetails = `Failed to stringify error object: ${String(e)}`;
        }
    } else {
        errorDetails = String(error);
    }

    return (
        <div
            style={{
                padding: "40px",
                background: "#0f1115",
                color: "white",
                minHeight: "100vh",
                fontFamily: "sans-serif",
            }}
        >
            <h1 style={{ color: "#ef4444" }}>Помилка на сторінці редагування товару</h1>
            <pre
                style={{
                    background: "#1c1f26",
                    padding: "20px",
                    borderRadius: "8px",
                    overflowX: "auto",
                    marginTop: "20px",
                    color: "#f1f5f9",
                    fontSize: "14px",
                }}
            >
                {errorDetails}
            </pre>
        </div>
    );
}

// --- Component ---
export default function AdminProductEdit() {
    const { product, filterConfigs, shopPages, isNew } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const navigate = useNavigate();

    // Initial State
    const [formData, setFormData] = useState<ProductForm>(() => {
        if (product) return product;
        return {
            ...emptyForm,
            shopPageSlug: shopPages[0]?.slug || SHOP_SLUGS[0],
        };
    });

    const filterConfig = filterConfigs[formData.shopPageSlug] || filterConfigs["global"];
    // Quantity for the "fill all variants" helper (replaces a window.prompt).
    const [fillQty, setFillQty] = useState("10");

    // --- Unsaved-changes guard --------------------------------------------
    // Warn before the operator navigates away (sidebar / back / swipe-back) and
    // silently loses edits. `stock` is excluded from the dirty check — it's
    // derived from the variant grid by an effect, so a freshly-loaded product
    // would otherwise read as dirty.
    // Capture the initial form once via state (not a ref — reading a ref during
    // render is unsafe); it never updates, so it's a stable baseline.
    const [initialSnapshot] = useState(formData);
    const isDirty = useMemo(
        () =>
            JSON.stringify({ ...formData, stock: "" }) !==
            JSON.stringify({ ...initialSnapshot, stock: "" }),
        [formData, initialSnapshot],
    );
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            isDirty && !fetcher.data?.success && currentLocation.pathname !== nextLocation.pathname,
    );
    useEffect(() => {
        if (blocker.state !== "blocked") return;
        if (window.confirm("Є незбережені зміни. Залишити сторінку без збереження?")) {
            blocker.proceed();
        } else {
            blocker.reset();
        }
    }, [blocker]);

    // Upload Handler
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Clear the input so the SAME file can be re-picked after an error.
        e.target.value = "";
        if (!file) return;
        if (fetcher.state !== "idle") return; // one upload in flight at a time
        // Client-side pre-checks mirror the server limits for instant feedback.
        if (!file.type.startsWith("image/")) {
            void import("sonner").then(({ toast }) => toast.error("Підтримуються лише зображення"));
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            void import("sonner").then(({ toast }) => toast.error("Файл завеликий (макс. 10 МБ)"));
            return;
        }
        const fd = new FormData();
        fd.append("intent", "upload_image");
        fd.append("file", file);
        fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
    };

    // Append a freshly-uploaded image, de-duplicated (guards against React
    // strict-mode double-invoke and re-uploading an identical URL).
    useEffect(() => {
        const url = fetcher.data?.imageUrl;
        if (url) {
            setFormData((prev) =>
                prev.images.includes(url) ? prev : { ...prev, images: [...prev.images, url] },
            );
        }
    }, [fetcher.data]);

    // Save Handler
    // Client-side mirror of the server's required-field gate, so the Save
    // button can disable and explain why instead of a round-trip that just
    // bounces an error back. The server re-validates regardless (source of truth).
    const priceNum = Number(formData.price);
    const missingFields: string[] = [];
    if (!formData.name.trim()) missingFields.push("назву");
    if (!Number.isFinite(priceNum) || priceNum <= 0) missingFields.push("ціну більше 0");
    if (!formData.shopPageSlug) missingFields.push("розділ");
    if (!formData.category) missingFields.push("категорію");
    if (formData.images.length === 0) missingFields.push("фото");

    // Publish-readiness: a product can be saved as a draft incomplete, but going
    // LIVE (active) requires the full checklist (mirrors the server gate).
    const publishChecks = publishChecklist({
        price: priceNum,
        imagesCount: formData.images.length,
        category: formData.category,
        shopPageSlug: formData.shopPageSlug,
        stock: Number(formData.stock) || 0,
        fabric: formData.fabric,
        sleeve: formData.sleeve,
    });
    const publishIssues = publishChecks.filter((c) => !c.ok).map((c) => c.label);
    const wantsActive = formData.status === "active";
    const canSave = missingFields.length === 0 && (!wantsActive || publishIssues.length === 0);
    const saveBlockMessage = canSave
        ? undefined
        : missingFields.length > 0
          ? `Заповніть: ${missingFields.join(", ")}`
          : `Для публікації: ${publishIssues.join(", ").toLowerCase()}`;

    const handleSave = () => {
        if (!canSave) return;
        const data = new FormData();
        data.append("intent", "save_product");

        // Append all simple fields
        Object.entries(formData).forEach(([key, value]) => {
            if (key === "inventory") {
                // Convert Map to List for storage
                const inventoryList = Object.entries(value).map(([id, stock]) => {
                    const [color, size] = id.split("_");
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

    // Redirect on success or toast the error. sonner is imported lazily (the
    // codebase gotcha: a static import binds a different module instance and
    // toasts silently no-op).
    useEffect(() => {
        if (fetcher.data?.success) {
            void import("sonner").then(({ toast }) => toast.success("Товар збережено"));
            navigate("/admin/products");
        } else if (fetcher.data?.error) {
            void import("sonner").then(({ toast }) => toast.error(String(fetcher.data.error)));
        }
    }, [fetcher.data, navigate]);

    // Helpers
    const toggleArrayItem = (field: "colors" | "sizes", item: string) => {
        setFormData((prev) => {
            const current = prev[field];
            const removing = current.includes(item);
            const newArray = removing ? current.filter((i) => i !== item) : [...current, item];
            // Prune any inventory variants that reference the removed value so a
            // deselected color/size can't leave an orphan row (which the PDP
            // would otherwise resurrect as a buyable option).
            let inventory = prev.inventory;
            if (removing) {
                inventory = Object.fromEntries(
                    Object.entries(prev.inventory).filter(([key]) => {
                        const [color, size] = key.split("_");
                        return field === "colors" ? color !== item : size !== item;
                    }),
                );
            }
            return { ...prev, [field]: newArray, inventory };
        });
    };

    // Mirror total stock from the variant grid. Only when variants exist (so a
    // variant-less product keeps its manual stock), but with NO `> 0` guard so
    // zeroing every variant actually sets stock to 0 — "sold out" is reachable.
    const hasVariants = formData.colors.length > 0 && formData.sizes.length > 0;
    useEffect(() => {
        if (!hasVariants) return;
        const total = Object.values(formData.inventory).reduce((a, b) => a + b, 0);
        setFormData((p) => (String(total) === p.stock ? p : { ...p, stock: String(total) }));
    }, [formData.inventory, hasVariants]);

    const globalApplyStock = (qty: number) => {
        const newInventory = { ...formData.inventory };
        formData.colors.forEach((c) => {
            formData.sizes.forEach((s) => {
                newInventory[`${c}_${s}`] = qty;
            });
        });
        setFormData((p) => ({ ...p, inventory: newInventory }));
    };

    return (
        <div className="admin-wrapper">
            <div className="admin-container">
                {/* Header */}
                <div className="admin-header">
                    <div>
                        <Link to="/admin/products" className="admin-back-link">
                            <ArrowLeftIcon />
                            До списку товарів
                        </Link>
                        <h1 className="page-title">
                            {isNew ? "Новий товар" : formData.name || "Редагування"}
                        </h1>
                        <p className="page-subtitle">
                            {isNew
                                ? "Створіть ідеальний товар для вашого магазину"
                                : `SKU: ${formData.sku || "---"}`}
                        </p>
                        {!isNew && product?.id && (
                            <Link
                                to={`/admin/inventory?productId=${product.id}`}
                                style={{
                                    display: "inline-block",
                                    marginTop: "8px",
                                    fontSize: "13px",
                                    color: "var(--ad-primary)",
                                    textDecoration: "none",
                                }}
                            >
                                Історія складу →
                            </Link>
                        )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <button
                            className="btn-save"
                            onClick={handleSave}
                            disabled={fetcher.state !== "idle" || !canSave}
                            title={saveBlockMessage}
                        >
                            {fetcher.state !== "idle" ? "Збереження..." : "Зберегти зміни"}
                        </button>
                        {saveBlockMessage && (
                            <p
                                style={{
                                    margin: "8px 0 0",
                                    fontSize: "12px",
                                    color: "#f59e0b",
                                }}
                            >
                                {saveBlockMessage}
                            </p>
                        )}
                    </div>
                </div>

                <div className="admin-layout-grid">
                    {/* Left Column: Main Info */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div className="ad-card">
                            <h3 className="ad-card-title">Загальна інформація</h3>

                            <div className="ad-field-grid">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Розділ магазину</label>
                                    <select
                                        className="form-select"
                                        value={formData.shopPageSlug}
                                        onChange={(e) =>
                                            // Changing the shop invalidates the old
                                            // category/fabric/sleeve — reset them so the
                                            // visible state matches what will be saved.
                                            setFormData((p) => ({
                                                ...p,
                                                shopPageSlug: e.target.value,
                                                category: "",
                                                fabric: "",
                                                sleeve: "",
                                            }))
                                        }
                                    >
                                        {shopPages.map((page) => (
                                            <option key={page.slug} value={page.slug}>
                                                {page.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Категорія</label>
                                    <select
                                        className="form-select"
                                        value={formData.category}
                                        onChange={(e) =>
                                            // Reset deeper taxonomy when the category changes.
                                            setFormData((p) => ({
                                                ...p,
                                                category: e.target.value,
                                                fabric: "",
                                                sleeve: "",
                                            }))
                                        }
                                    >
                                        <option value="">Оберіть категорію</option>
                                        {/* Options come from the taxonomy for the chosen
                                            shop (single source of truth) — never a
                                            cross-shop FilterConfig blob. */}
                                        {(() => {
                                            const subs = subcategoriesFor(formData.shopPageSlug);
                                            const known = new Set(subs.map(([s]) => s));
                                            const opts = subs.map(([slug, def]) => (
                                                <option key={slug} value={slug}>
                                                    {def.label}
                                                </option>
                                            ));
                                            // Keep a saved legacy/orphan category visible so
                                            // the admin sees it and can re-file it.
                                            if (
                                                formData.category &&
                                                !known.has(formData.category)
                                            ) {
                                                opts.unshift(
                                                    <option
                                                        key={formData.category}
                                                        value={formData.category}
                                                    >
                                                        {slugToLabel(formData.category)} (поза
                                                        каталогом)
                                                    </option>,
                                                );
                                            }
                                            return opts;
                                        })()}
                                    </select>
                                </div>
                            </div>

                            {/* Deeper taxonomy: fabric (sport/cotton) + sleeve.
                                Shown only when the chosen category offers them
                                (see app/utils/taxonomy.ts). */}
                            {(() => {
                                const fabrics = fabricsFor(
                                    formData.shopPageSlug,
                                    formData.category,
                                );
                                const sleeves = sleevesFor(
                                    formData.shopPageSlug,
                                    formData.category,
                                );
                                if (!fabrics.length && !sleeves.length) return null;
                                return (
                                    <div className="ad-field-grid">
                                        {fabrics.length > 0 && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Тканина</label>
                                                <select
                                                    className="form-select"
                                                    value={formData.fabric}
                                                    onChange={(e) =>
                                                        setFormData((p) => ({
                                                            ...p,
                                                            fabric: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="">—</option>
                                                    {fabrics.map((f) => (
                                                        <option key={f} value={f}>
                                                            {fabricLabel(f)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {sleeves.length > 0 && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Рукав</label>
                                                <select
                                                    className="form-select"
                                                    value={formData.sleeve}
                                                    onChange={(e) =>
                                                        setFormData((p) => ({
                                                            ...p,
                                                            sleeve: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="">—</option>
                                                    {sleeves.map((s) => (
                                                        <option key={s} value={s}>
                                                            {sleeveLabel(s)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="form-group">
                                <label className="form-label">Назва товару</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Напр. Спортивний топ Aura"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, name: e.target.value }))
                                    }
                                    style={{ fontSize: "16px", fontWeight: 500 }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Опис</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Детальний описи товару, склад, особливості..."
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, description: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="ad-card">
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "24px",
                                    borderBottom: "1px solid var(--ad-border)",
                                    paddingBottom: "16px",
                                }}
                            >
                                <h3
                                    className="ad-card-title"
                                    style={{ margin: 0, padding: 0, border: "none" }}
                                >
                                    Варіанти та Склад
                                </h3>
                                <div
                                    style={{
                                        fontSize: "13px",
                                        padding: "6px 12px",
                                        background: "rgba(255,255,255,0.05)",
                                        borderRadius: "100px",
                                        color: "#5eead4",
                                    }}
                                >
                                    Загальна кількість: <b>{formData.stock} шт.</b>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Доступні кольори (оберіть всі)</label>
                                <div className="color-grid">
                                    {filterConfig?.colors &&
                                        Object.entries(filterConfig.colors).map(
                                            ([key, label]: [string, any]) => (
                                                <div
                                                    key={key}
                                                    onClick={() => toggleArrayItem("colors", key)}
                                                    className={`color-option ${formData.colors.includes(key) ? "active" : ""}`}
                                                    style={{
                                                        background:
                                                            key === "other"
                                                                ? "linear-gradient(45deg, #eee, #999)"
                                                                : key,
                                                    }}
                                                    title={label as string}
                                                >
                                                    {formData.colors.includes(key) && (
                                                        <div className="check-mark">✓</div>
                                                    )}
                                                </div>
                                            ),
                                        )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Доступні розміри</label>
                                <div className="size-grid">
                                    {(filterConfig?.sizes || []).map((size: string) => (
                                        <div
                                            key={size}
                                            onClick={() => toggleArrayItem("sizes", size)}
                                            className={`size-option ${formData.sizes.includes(size) ? "active" : ""}`}
                                        >
                                            {size}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {formData.colors.length > 0 && formData.sizes.length > 0 ? (
                                <div className="inv-table-wrapper">
                                    <div className="inv-header">
                                        <span style={{ fontSize: "13px", fontWeight: 600 }}>
                                            Керування залишками
                                        </span>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            <input
                                                type="number"
                                                min="0"
                                                value={fillQty}
                                                onChange={(e) => setFillQty(e.target.value)}
                                                aria-label="Кількість для всіх варіантів"
                                                className="inv-input"
                                                style={{ width: "64px" }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const n = parseInt(fillQty, 10);
                                                    if (!Number.isNaN(n)) globalApplyStock(n);
                                                }}
                                                style={{
                                                    fontSize: "12px",
                                                    color: "var(--ad-primary)",
                                                    background: "transparent",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                ЗАПОВНИТИ ВСІ
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                                        <table className="inv-table">
                                            <tbody>
                                                {formData.colors.map((color) =>
                                                    formData.sizes.map((size) => {
                                                        const key = `${color}_${size}`;
                                                        return (
                                                            <tr key={key}>
                                                                <td
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "10px",
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: "12px",
                                                                            height: "12px",
                                                                            borderRadius: "50%",
                                                                            background:
                                                                                getColorHex(color),
                                                                            border: "1px solid rgba(255,255,255,0.2)",
                                                                        }}
                                                                    ></div>
                                                                    <span
                                                                        style={{ fontWeight: 500 }}
                                                                    >
                                                                        {filterConfig?.colors?.[
                                                                            color
                                                                        ] ||
                                                                            getColorLabel(
                                                                                color,
                                                                            )}{" "}
                                                                        / {size}
                                                                    </span>
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        width: "100px",
                                                                        textAlign: "right",
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="number"
                                                                        className="inv-input"
                                                                        value={
                                                                            formData.inventory[
                                                                                key
                                                                            ] || 0
                                                                        }
                                                                        onChange={(e) =>
                                                                            setFormData((p) => ({
                                                                                ...p,
                                                                                inventory: {
                                                                                    ...p.inventory,
                                                                                    [key]:
                                                                                        parseInt(
                                                                                            e.target
                                                                                                .value,
                                                                                        ) || 0,
                                                                                },
                                                                            }))
                                                                        }
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    }),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        padding: "30px",
                                        textAlign: "center",
                                        background: "rgba(255,255,255,0.02)",
                                        borderRadius: "8px",
                                        marginTop: "16px",
                                        fontSize: "14px",
                                        color: "var(--ad-text-muted)",
                                    }}
                                >
                                    Оберіть хоча б один колір та розмір, щоб налаштувати склад.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div className="ad-card">
                            <h3 className="ad-card-title">Статус публікації</h3>
                            <div className="form-group">
                                <select
                                    className="form-select"
                                    value={formData.status}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            status: e.target.value as ProductForm["status"],
                                        }))
                                    }
                                    style={{
                                        color:
                                            formData.status === "active"
                                                ? "var(--ad-primary)"
                                                : "inherit",
                                        fontWeight: formData.status === "active" ? "600" : "400",
                                        border:
                                            formData.status === "active"
                                                ? "1px solid rgba(94, 234, 212, 0.3)"
                                                : "1px solid transparent",
                                    }}
                                >
                                    <option value="active">🟢 Опубліковано (Active)</option>
                                    <option value="draft">🟡 Чернетка (Draft)</option>
                                    <option value="archived">🔴 Архів (Archived)</option>
                                </select>
                            </div>
                            <div
                                style={{
                                    borderTop: "1px solid var(--ad-border)",
                                    paddingTop: "16px",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        color: "var(--ad-text-muted)",
                                        marginBottom: "10px",
                                    }}
                                >
                                    Готовність до публікації
                                </div>
                                <ul
                                    style={{
                                        listStyle: "none",
                                        margin: 0,
                                        padding: 0,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "6px",
                                    }}
                                >
                                    {publishChecks.map((c) => (
                                        <li
                                            key={c.label}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                fontSize: "13px",
                                                color: c.ok ? "var(--ad-text-main)" : "#f59e0b",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    color: c.ok ? "#10b981" : "#f59e0b",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {c.ok ? "✓" : "✗"}
                                            </span>
                                            {c.label}
                                        </li>
                                    ))}
                                </ul>
                                {wantsActive && publishIssues.length > 0 && (
                                    <p
                                        style={{
                                            margin: "12px 0 0",
                                            fontSize: "12px",
                                            color: "#f59e0b",
                                        }}
                                    >
                                        Заповніть пункти вище, щоб опублікувати, або збережіть як
                                        чернетку.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="ad-card">
                            <h3 className="ad-card-title">Фотографії</h3>
                            <p
                                style={{
                                    margin: "0 0 12px",
                                    fontSize: "12px",
                                    color: "var(--ad-text-muted, #8a94a6)",
                                }}
                            >
                                Перше фото — обкладинка (картка + головне фото товару).
                            </p>
                            <div className="image-grid">
                                {formData.images.map((img, idx) => (
                                    <div
                                        key={img}
                                        className="image-item"
                                        style={{ position: "relative" }}
                                    >
                                        <img src={img} alt="" />
                                        {idx === 0 ? (
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    top: 6,
                                                    left: 6,
                                                    background: "var(--ad-primary)",
                                                    color: "#06231f",
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: "2px 7px",
                                                    borderRadius: 6,
                                                    letterSpacing: ".04em",
                                                }}
                                            >
                                                ОБКЛАДИНКА
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                title="Зробити обкладинкою"
                                                onClick={() =>
                                                    setFormData((p) => ({
                                                        ...p,
                                                        images: [
                                                            img,
                                                            ...p.images.filter((x) => x !== img),
                                                        ],
                                                    }))
                                                }
                                                style={{
                                                    position: "absolute",
                                                    top: 6,
                                                    left: 6,
                                                    background: "rgba(0,0,0,0.6)",
                                                    color: "#fff",
                                                    border: "none",
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    padding: "3px 7px",
                                                    borderRadius: 6,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                ★ Обкладинка
                                            </button>
                                        )}
                                        <button
                                            className="delete-btn"
                                            onClick={() =>
                                                setFormData((p) => ({
                                                    ...p,
                                                    images: p.images.filter((_, i) => i !== idx),
                                                }))
                                            }
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                ))}

                                <label className="upload-box">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        disabled={fetcher.state !== "idle"}
                                        onChange={handleImageUpload}
                                    />
                                    {fetcher.state !== "idle" &&
                                    fetcher.formData?.get("intent") === "upload_image" ? (
                                        <div
                                            style={{
                                                width: "20px",
                                                height: "20px",
                                                border: "2px solid rgba(255,255,255,0.2)",
                                                borderTopColor: "#fff",
                                                borderRadius: "50%",
                                                animation: "spin 1s linear infinite",
                                            }}
                                        ></div>
                                    ) : (
                                        <>
                                            <UploadIcon />
                                            <span style={{ fontSize: "12px", marginTop: "8px" }}>
                                                Додати
                                            </span>
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
                                    style={{
                                        fontSize: "20px",
                                        fontWeight: "bold",
                                        color: "var(--ad-primary)",
                                    }}
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, price: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Стара ціна (акція)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="----"
                                    value={formData.comparePrice}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, comparePrice: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Артикул (SKU)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.sku}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, sku: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
