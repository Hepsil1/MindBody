import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { uploadFile } from "../../app/utils/upload.server";

// uploadFile writes into public/uploads; track + clean up anything we create.
const created: string[] = [];
afterEach(() => {
    for (const p of created) {
        try {
            fs.unlinkSync(p);
        } catch {
            /* ignore */
        }
    }
    created.length = 0;
});
const abs = (urlPath: string) => path.join(process.cwd(), "public", urlPath);

describe("uploadFile security hardening", () => {
    it("accepts a real raster image and re-encodes it to .webp", async () => {
        const png = await sharp({
            create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
        })
            .png()
            .toBuffer();
        const file = new File([new Uint8Array(png)], "photo.png", { type: "image/png" });
        const url = await uploadFile(file);
        expect(url).toMatch(/^\/uploads\/upload_.*\.webp$/);
        if (url) {
            created.push(abs(url));
            expect(fs.existsSync(abs(url))).toBe(true);
        }
    });

    it("rejects an SVG even when it claims an image/* type (stored-XSS vector)", async () => {
        const svg = Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        );
        const file = new File([new Uint8Array(svg)], "evil.svg", { type: "image/svg+xml" });
        expect(await uploadFile(file)).toBeNull();
    });

    it("rejects a non-image whose client MIME is spoofed to image/png", async () => {
        const file = new File(
            [new Uint8Array(Buffer.from("this is definitely not an image"))],
            "fake.png",
            { type: "image/png" },
        );
        expect(await uploadFile(file)).toBeNull();
    });
});
