import path from "path";
import fs from "fs";
import sharp from "sharp";

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

        const mimeType = file instanceof File ? file.type || "image/jpeg" : "image/jpeg";
        const isSvg = mimeType.includes("svg");
        const isImage = mimeType.startsWith("image/");

        // Define extension (webp for converted images, svg for icons, else fallback)
        const ext = isSvg ? "svg" : isImage ? "webp" : "jpg";
        const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filePath = path.join(uploadsDir, filename);

        // Compress and convert Raster Images to WebP using sharp
        if (isImage && !isSvg) {
            await sharp(buffer)
                // Максимально возможное разрешение для 4K/Retina (3500px). Площадь до 12 Мегапикселей.
                // Apple iOS безопасно рендерит WebP только до 16.7 Мегапикселей. Это сохраняет 100% визуального качества.
                .resize({ width: 3500, height: 3500, withoutEnlargement: true, fit: "inside" })
                .webp({ quality: 95, effort: 4 }) // Ultra-high HQ
                .toFile(filePath);
        } else {
            // SVGs or other files saved directly
            fs.writeFileSync(filePath, buffer);
        }

        const sizeKB = (buffer.length / 1024).toFixed(0);
        console.log(`✅ Uploaded: /uploads/${filename} (${sizeKB} KB)`);

        return `/uploads/${filename}`;
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
        : { status: "error", reason: "Не вдалося обробити зображення" };
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
