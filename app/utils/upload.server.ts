import path from "path";
import fs from "fs";
import sharp from "sharp";
import { generateUploadVariants } from "./image-variants.server";

// Raster formats we accept, by Sharp's detected `metadata().format`. SVG is
// deliberately excluded: an uploaded SVG served as a document executes embedded
// <script>/event handlers on our origin (stored XSS), and product/hero/category
// images are photos anyway. Everything that passes is re-encoded to WebP, so the
// file we persist is always a clean raster (any embedded payload/EXIF stripped).
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "tiff"]);

/**
 * Upload a file to the server's public/uploads directory.
 * Automatically resizes and converts most images to WebP via Sharp for SEO.
 * Returns the URL path (e.g., "/uploads/upload_1234.webp").
 *
 * NEVER falls back to base64 — this prevents multi-MB strings
 * from being stored in the database, which kills query performance.
 */
export async function uploadFile(file: FormDataEntryValue | null): Promise<string | null> {
    if (!file || (file instanceof File && file.size === 0)) return null;
    if (!(file instanceof Blob)) return null;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate: max 10MB
        if (buffer.length > 10 * 1024 * 1024) {
            console.error("❌ File too large:", (buffer.length / 1024 / 1024).toFixed(1), "MB");
            return null;
        }

        // Validate by CONTENT, not the client-supplied MIME (which is spoofable):
        // Sharp decodes the buffer and reports the real format. This rejects
        // non-images (Sharp throws / no format) AND SVG (format "svg").
        let format: string | undefined;
        try {
            format = (await sharp(buffer).metadata()).format;
        } catch {
            format = undefined; // not a decodable image
        }
        if (!format || !ALLOWED_INPUT_FORMATS.has(format)) {
            console.error("❌ Rejected upload: unsupported/unsafe format:", format ?? "unknown");
            return null;
        }

        const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, filename);

        // Re-encode to WebP — the persisted file is always a clean raster.
        await sharp(buffer)
            // Максимально возможное разрешение для 4K/Retina (3500px). Площадь до 12 Мегапикселей.
            // Apple iOS безопасно рендерит WebP только до 16.7 Мегапикселей. Это сохраняет 100% визуального качества.
            .resize({ width: 3500, height: 3500, withoutEnlargement: true, fit: "inside" })
            .webp({ quality: 95, effort: 4 }) // Ultra-high HQ
            .toFile(filePath);

        const publicUrl = `/uploads/${filename}`;

        // Responsive variants + LQIP, synchronously before returning the
        // URL: srcset helpers (buildWebpSrcset/buildAvifSrcset) emit
        // -400w/-800w/… URLs the moment this image lands in a product, so
        // the variants must exist before anything can render it. Costs
        // ~1-3 s of admin upload time per photo — the buyers' bandwidth
        // is worth more than the admin's wait. Failure inside is logged
        // and non-fatal (master alone still works).
        await generateUploadVariants(filePath, publicUrl);

        const sizeKB = (buffer.length / 1024).toFixed(0);
        console.log(`✅ Uploaded: ${publicUrl} (${sizeKB} KB)`);

        return publicUrl;
    } catch (e) {
        console.error("❌ Upload failed:", e);
        // DO NOT fall back to base64! Return null instead.
        return null;
    }
}

export type UploadOutcome =
    | { status: "empty" }
    | { status: "ok"; path: string }
    | { status: "error"; reason: string };

/**
 * Like uploadFile, but distinguishes "no file was provided" (status:"empty" —
 * keep the existing value) from "a file WAS provided but failed to process"
 * (status:"error" — abort the save). uploadFile returns null for BOTH cases,
 * which let callers silently persist a record with a missing image.
 */
export async function uploadFileChecked(file: FormDataEntryValue | null): Promise<UploadOutcome> {
    if (!file || (file instanceof File && file.size === 0)) return { status: "empty" };
    const path = await uploadFile(file);
    return path
        ? { status: "ok", path }
        : {
              status: "error",
              reason: "Підтримуються лише зображення JPG, PNG, WebP, AVIF, GIF (до 10 МБ)",
          };
}

/**
 * Check if a string is a base64 data URL.
 * Used to filter out accidentally stored base64 images from DB queries.
 */
export function isBase64DataUrl(str: string | null | undefined): boolean {
    if (!str) return false;
    return str.startsWith("data:");
}

/**
 * Sanitize an image URL — replaces base64 data URLs with a placeholder.
 * Use this in loaders to prevent sending multi-MB base64 strings to the client.
 */
export function sanitizeImageUrl(
    url: string | null | undefined,
    fallback: string = "/brand-sun.png",
): string {
    if (!url) return fallback;
    if (isBase64DataUrl(url)) return fallback;
    return url;
}
