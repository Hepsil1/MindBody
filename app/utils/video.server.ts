import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileP = promisify(execFile);

// Brand videos are portrait fashion clips shown large on the home "Brand World"
// frame. We NEVER serve the raw upload — every file is re-encoded through ffmpeg
// to a clean, web-tuned H.264 (below), which also strips any hostile container
// payload. Input cap is generous (phone 4K clips are big) but bounded so a
// single admin request can't exhaust memory.
const MAX_INPUT_BYTES = 200 * 1024 * 1024; // 200 MB

export type VideoOutcome =
    | { status: "empty" }
    | { status: "ok"; video: string; poster: string }
    | { status: "error"; reason: string };

/**
 * Take an admin-uploaded video and produce a web-optimized copy plus a poster
 * still, both under public/uploads. Returns the public paths.
 *
 * The encode is deliberately quality-first (this runs rarely, only when the
 * owner replaces a clip):
 *  - libx264 CRF 19  → visually near-lossless for this short portrait content
 *  - preset "slow"   → best compression at a given quality (owner waits once;
 *                      every visitor downloads the result forever)
 *  - source FPS kept → if the owner records 60fps, the site plays 60fps. We do
 *                      NOT synthesize frames (motion interpolation warps fabric
 *                      and faces) — smoothness comes from preserving the real
 *                      cadence at full quality + faststart, not faking it.
 *  - scale ≤1080 wide, even dims, yuv420p → universal decode, no upscaling
 *  - audio stripped, +faststart (moov atom first) → instant start, seamless loop
 *
 * A fresh randomized filename is minted every upload on purpose: the Cloudflare
 * edge caches /uploads paths for days (stale-while-revalidate), so reusing a
 * name would keep serving the OLD clip. New name = new URL = instant swap.
 */
export async function processBrandVideo(file: FormDataEntryValue | null): Promise<VideoOutcome> {
    if (!file || (file instanceof File && file.size === 0)) return { status: "empty" };
    if (!(file instanceof Blob)) return { status: "empty" };

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tmpInput = path.join(os.tmpdir(), `brandvid_${stamp}.src`);
    const tmpPoster = path.join(os.tmpdir(), `brandvid_${stamp}.png`);
    const outName = `brand_${stamp}.mp4`;
    const posterName = `brand_${stamp}-poster.webp`;
    const outPath = path.join(uploadsDir, outName);
    const posterPath = path.join(uploadsDir, posterName);

    const cleanup = () => {
        for (const p of [tmpInput, tmpPoster]) {
            try {
                if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch {
                /* best-effort */
            }
        }
    };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.length > MAX_INPUT_BYTES) {
            return {
                status: "error",
                reason: `Відео завелике (${(buffer.length / 1024 / 1024).toFixed(0)} МБ). Максимум 200 МБ.`,
            };
        }
        fs.writeFileSync(tmpInput, buffer);

        // Confirm it's really a video (a video stream exists). ffprobe throws on
        // a non-media file → caught below as a clean "unsupported" error. Since
        // we only ever serve the re-encoded output, a malicious container can't
        // reach a visitor even if it probed OK.
        let probe: { stdout: string };
        try {
            probe = await execFileP(
                "ffprobe",
                [
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=codec_type",
                    "-of",
                    "default=nk=1:nw=1",
                    tmpInput,
                ],
                { timeout: 60_000 },
            );
        } catch {
            cleanup();
            return {
                status: "error",
                reason: "Не вдалося прочитати відео. Підтримуються файли MP4/MOV/WebM.",
            };
        }
        if (!probe.stdout.includes("video")) {
            cleanup();
            return { status: "error", reason: "Файл не містить відео-доріжки." };
        }

        // Transcode: quality-first, web-tuned H.264 (see the doc comment above).
        // Filter comma is backslash-escaped because execFile passes args with no
        // shell — the filtergraph parser would otherwise split min(1080,iw) into
        // two filters at the comma.
        await execFileP(
            "ffmpeg",
            [
                "-y",
                "-i",
                tmpInput,
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-crf",
                "19",
                "-pix_fmt",
                "yuv420p",
                "-profile:v",
                "high",
                "-vf",
                "scale=min(1080\\,iw):-2",
                "-movflags",
                "+faststart",
                outPath,
            ],
            { timeout: 8 * 60_000, maxBuffer: 1024 * 1024 * 16 },
        );

        // Poster still: a frame ~0.5s in (skips a possible black lead frame),
        // run through Sharp to a tidy WebP — matches the existing -1200w.webp
        // poster convention and keeps the still crisp but light.
        try {
            await execFileP(
                "ffmpeg",
                ["-y", "-ss", "0.5", "-i", outPath, "-frames:v", "1", tmpPoster],
                { timeout: 60_000 },
            );
            await sharp(tmpPoster)
                .resize({ width: 1080, withoutEnlargement: true })
                .webp({ quality: 82 })
                .toFile(posterPath);
        } catch (e) {
            // A missing poster is non-fatal — the video still plays; the frame
            // just shows its own first painted frame instead of a preloaded
            // still. Log and continue with an empty poster.
            console.error("⚠️ Brand video poster generation failed:", e);
        }

        cleanup();
        const posterUrl = fs.existsSync(posterPath) ? `/uploads/${posterName}` : "";
        console.log(`✅ Brand video processed: /uploads/${outName}`);
        return { status: "ok", video: `/uploads/${outName}`, poster: posterUrl };
    } catch (e) {
        cleanup();
        try {
            if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        } catch {
            /* best-effort */
        }
        console.error("❌ Brand video processing failed:", e);
        return {
            status: "error",
            reason: "Не вдалося обробити відео. Спробуйте інший файл (MP4/MOV).",
        };
    }
}
