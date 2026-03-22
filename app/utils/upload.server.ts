import path from "path";
import fs from "fs";

/**
 * Upload a file to the server's public/uploads directory.
 * Returns the URL path (e.g., "/uploads/slide_1234.jpg").
 * 
 * NEVER falls back to base64 — this prevents multi-MB strings
 * from being stored in the database, which kills query performance.
 */
export async function uploadFile(file: any): Promise<string | null> {
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

        // Determine extension from MIME type
        const mimeType = (file as File).type || "image/jpeg";
        const ext = mimeType
            .replace("image/", "")
            .replace("jpeg", "jpg")
            .replace("svg+xml", "svg")
            .replace("webp", "webp")
            .replace("png", "png");

        const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // Save to public/uploads/
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);

        const sizeKB = (buffer.length / 1024).toFixed(0);
        console.log(`✅ Uploaded: /uploads/${filename} (${sizeKB} KB)`);

        return `/uploads/${filename}`;
    } catch (e) {
        console.error("❌ Upload failed:", e);
        // DO NOT fall back to base64! Return null instead.
        return null;
    }
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
export function sanitizeImageUrl(url: string | null | undefined, fallback: string = "/brand-sun.png"): string {
    if (!url) return fallback;
    if (isBase64DataUrl(url)) return fallback;
    return url;
}
