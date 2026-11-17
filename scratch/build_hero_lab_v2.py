"""Hero-lab v2 — pre-rendered light states + interaction masks for a v4 slide.

  python scratch/build_hero_lab_v2.py <sid>[:variant] ...     e.g. s1_duo:match u15_fuchsia

Light is NOT faked with CSS blends over the finished picture (that left halos
round hair, lit the skin near the lacing and the floor under the heels).
Instead every state is rendered here with real matting:
    I = a*F + (1-a)*B   ->   I' = a*F' + (1-a)*B'
B is estimated from the surrounding backdrop, F is un-mixed, so hair strands
and body edges stay clean. Only the garment (never skin/hair/floor) is lit.

Writes public/hero/lab/<sid>/ :
  base.webp     the slide itself, high quality, from the lossless build
  lit<k>.webp   RGBA crop (only what changes): model k's garment lit
  back<k>.webp  + white back-light on the wall behind her + light pool at the feet
  aura<k>.webp  + wall behind her tinted in the garment's colour
  g<k>.png      garment mask (scan line)      out<k>.png  everything but model k
  outall.png    everything but all models (type behind the group)
  inv<k>.png    spotlight dim mask            hit.png     R = (k+1)*50 label map
  meta.json     per model: cx / head / feet (canvas fractions), tone
  _qa.jpg       mask overlay for eyeballing (not shipped)
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OW, OH = 1920, 1080


def blur(x, s):
    return cv2.GaussianBlur(x, (0, 0), s)


def bg_estimate(rgb, a):
    """Backdrop behind the model: normalized convolution of pure-background pixels."""
    w = (a < 0.02).astype(np.float32)
    out = rgb.copy()
    filled = w > 0.5
    for s in (5, 15, 45, 140):
        den = blur(w, s)
        num = blur(rgb * w[..., None], s)
        ok = (~filled) & (den > 0.04)
        out[ok] = (num / np.maximum(den, 1e-4)[..., None])[ok]
        filled |= ok
    return out


def lab(rgb):
    x = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    x[..., 0] *= 100 / 255.0
    x[..., 1:] -= 128
    return x


def unlab(x):
    y = x.copy()
    y[..., 0] = np.clip(y[..., 0], 0, 100) * 255 / 100.0
    y[..., 1:] = np.clip(y[..., 1:] + 128, 0, 255)
    return cv2.cvtColor(np.clip(y, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def save_mask(alpha, path, size=(OW, OH)):
    a = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
    a = cv2.resize(a, size, interpolation=cv2.INTER_AREA)
    Image.fromarray(np.dstack([np.full_like(a, 255)] * 3 + [a]), "RGBA").save(path, optimize=True)


Q = 93  # the shipped hero masters are ~120 KB for 2560 px: knit and hair turn to wax


def save_frame(frame, base, path):
    """Save only what differs from the base, full resolution, as an RGBA crop.

    Untouched pixels stay transparent, so the base is never encoded twice and a
    light state can't soften the rest of the picture. Returns the crop rect as
    canvas fractions [x, y, w, h].
    """
    H, W = base.shape[:2]
    diff = np.abs(frame - base).max(axis=2)
    alpha = smooth(blur(diff, 1.2), 0.35, 2.2)
    alpha = np.maximum(alpha, smooth(blur(cv2.dilate(alpha, np.ones((5, 5), np.uint8)), 2.0), 0.05, 0.6))
    ys, xs = np.where(alpha > 0.004)
    if len(xs) == 0:
        x0, y0, x1, y1 = 0, 0, 8, 8
    else:
        pad = 8
        x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
        y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
    rgb8 = np.clip(frame[y0:y1, x0:x1] + 0.5, 0, 255).astype(np.uint8)
    a8 = (np.clip(alpha[y0:y1, x0:x1], 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, a8]), "RGBA").save(path, quality=Q, method=6, exact=True)
    return [round(x0 / W, 5), round(y0 / H, 5), round((x1 - x0) / W, 5), round((y1 - y0) / H, 5)]


def lossless_slide(sid, variant):
    """The slide exactly as shipped, but from the lossless build (no webp/avif pass)."""
    sys.path.insert(0, os.path.join(ROOT, "scratch"))
    os.environ.setdefault("HERO_LIGHT", "0.35")
    import recolor_hero_bg as R
    rgb = np.asarray(Image.open(f"{R.BASE}/{sid}.png").convert("RGB"))
    if variant == "match":
        import export_u_slides as E
        matte = np.asarray(Image.open(f"{R.BASE}/{sid}_matte.png")).astype(np.float32) / 255
        rgb = R.recolor(rgb, matte, R.PALETTE[E.MATCH[sid]], refine=not sid.startswith("u"))
    elif variant:
        raise SystemExit(f"unknown variant {variant}")
    return np.asarray(rgb).astype(np.float32)


def main(spec):
    sid, _, variant = spec.partition(":")
    name = f"v4_{sid}__{variant}" if variant else f"v4_{sid}"
    rgb = lossless_slide(sid, variant)
    matte = np.asarray(Image.open(f"{ROOT}/scratch/hero_v4_base/{sid}_matte.png")).astype(np.float32) / 255
    H, W = matte.shape
    out_dir = f"{ROOT}/public/hero/lab/{sid}"
    os.makedirs(out_dir, exist_ok=True)
    # the lab shows its own high-quality base, not the over-compressed master
    Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8)).save(f"{out_dir}/base.webp", quality=Q, method=6)
    Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8)).resize((1600, 900), Image.Resampling.LANCZOS).save(
        f"{out_dir}/base-1600.webp", quality=Q, method=6)

    n, cl, st, _ = cv2.connectedComponentsWithStats((matte > 0.5).astype(np.uint8))
    comps = sorted([i for i in range(1, n) if st[i, 4] > 20000], key=lambda i: st[i, 0])

    B = bg_estimate(rgb, matte)
    LI, LB = lab(rgb), lab(B)
    dist_bg = np.linalg.norm(LI - LB, axis=2)

    hit = np.zeros((180, 320), np.uint8)
    qa = rgb.copy()
    meta = []
    for k, ci in enumerate(comps):
        x, y, w, h = st[ci, :4]
        region = cv2.dilate((cl == ci).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
        a = np.where(region, matte, 0).astype(np.float32)

        # the matte keeps a patch of floor under the heels: drop whatever in the
        # foot zone is just floor-coloured
        yy = np.arange(H, dtype=np.float32)[:, None]
        foot_zone = smooth(yy, y + h * 0.93, y + h * 0.955) * np.ones((1, W), np.float32)
        a = a * (1 - foot_zone * (1 - smooth(dist_bg, 7, 16)))
        a = np.where(a < 0.02, 0, a)

        F = np.where(a[..., None] > 0.02, (rgb - (1 - a[..., None]) * B) / np.maximum(a[..., None], 0.02), rgb)
        F = np.clip(F, 0, 255)
        LF = lab(F)
        L, A_, B_ = LF[..., 0], LF[..., 1], LF[..., 2]

        # --- garment = model pixels that are not skin / hair / head ---
        body = a > 0.6
        skin = (L > 32) & (A_ > 5) & (A_ < 30) & (B_ > 7) & (B_ < 38) & (B_ > 0.35 * A_)
        head = yy < (y + h * 0.125)
        cand = body & ~skin & ~head
        # colour model from the torso/legs: up to 2 clusters in (L/2, a, b)
        zone = cand & (yy > y + h * 0.2) & (yy < y + h * 0.85)
        feats = np.stack([L[zone] * 0.5, A_[zone], B_[zone]], 1).astype(np.float32)
        K = 2
        _, lbl, cen = cv2.kmeans(feats[:: max(1, len(feats) // 40000)], K, None,
                                 (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
        cnt = np.bincount(lbl.ravel(), minlength=K) / len(lbl)
        fe = np.stack([L * 0.5, A_, B_], 2)
        dmin = np.full((H, W), 1e9, np.float32)
        for j in range(K):
            if cnt[j] > 0.12:
                # saturated fabrics swing a lot in chroma with shading: widen with chroma
                thr = 15 + 0.4 * float(np.linalg.norm(cen[j][1:]))
                dmin = np.minimum(dmin, np.linalg.norm(fe - cen[j], axis=2) * (15 / thr))
        g = (cand & (dmin < 15)).astype(np.uint8)
        g = cv2.medianBlur(g, 3)
        # fill pin-holes (heather knit speckle) but never bridge skin: only holes < 60 px
        nh, hl, hs, _ = cv2.connectedComponentsWithStats(1 - g, connectivity=4)
        small = np.isin(hl, [j for j in range(1, nh) if hs[j, 4] < 60]) & body & ~skin
        g = (g > 0) | small
        ng, gl, gs, _ = cv2.connectedComponentsWithStats(g.astype(np.uint8))
        g = np.isin(gl, [j for j in range(1, ng) if gs[j, 4] > 3000])
        gsoft = np.minimum(blur(g.astype(np.float32), 0.9), a)

        # --- tone: garment hue at a fixed, pleasant chroma ---
        gm = g & (yy > y + h * 0.2)
        ab = np.array([np.median(A_[gm]), np.median(B_[gm])]) if gm.any() else np.zeros(2)
        chroma = float(np.linalg.norm(ab))
        # below ~12 the hue is noise (brown, black, grey) -> neutral white light instead
        tone_ab = ab / max(chroma, 1e-3) * 44 if chroma > 12 else None

        # --- F' : lit garment = more EXPOSURE, in linear light. A plain lift in
        # Lab flattened the folds (shadows rose more than highlights) and the
        # fabric went plastic; multiplying linear light keeps every shading ratio,
        # hue and saturation — exactly what a brighter lamp does.
        vivid = smooth(np.hypot(A_, B_), 30, 60)
        light = smooth(L, 48, 72)  # mesh inserts / white piping: leave almost alone
        gain = 1 + gsoft * 0.5 * (1 - 0.3 * vivid) * (1 - 0.9 * light)
        lin = (F / 255.0) ** 2.2 * gain[..., None]
        # soft shoulder on the brightest channel so saturated reds don't clip to neon
        mx = lin.max(axis=2)
        knee = 0.72
        mx2 = np.where(mx > knee, knee + (1 - knee) * np.tanh((mx - knee) / (1 - knee)), mx)
        lin = lin * (mx2 / np.maximum(mx, 1e-6))[..., None]
        Flit = np.clip(lin, 0, 1) ** (1 / 2.2) * 255.0
        Flit = np.where(gsoft[..., None] > 0.004, Flit, F)

        solid = (a > 0.5).astype(np.float32)
        near = blur(solid, 60)
        near = np.clip(near / max(near.max(), 1e-6) * 1.25, 0, 1)
        wide = blur(solid, 150)
        wide = np.clip(wide / max(wide.max(), 1e-6) * 1.35, 0, 1)
        cxp, feet = x + w / 2, y + h
        xx = np.arange(W, dtype=np.float32)[None, :]
        pool = np.exp(-(((xx - cxp) / (0.085 * W)) ** 2 + ((yy - (feet - 0.004 * H)) / (0.022 * H)) ** 2))

        def compose(Fx, Bx):
            return a[..., None] * Fx + (1 - a[..., None]) * Bx

        Bfull = np.where(a[..., None] < 0.02, rgb, B)
        LBf = lab(Bfull)

        # back-light: wall glows white behind her + pool of light at the feet
        Lb = LBf.copy()
        glow = np.clip(near * 0.9 + pool * 0.7, 0, 1)
        Lb[..., 0] = LBf[..., 0] + glow * (100 - LBf[..., 0]) * 0.42
        Lb[..., 1:] = LBf[..., 1:] * (1 - 0.35 * glow[..., None])
        Bback = np.where(glow[..., None] > 0.004, unlab(Lb), Bfull)

        # aura: wall takes the garment's colour (falls back to back-light for black/grey)
        if tone_ab is not None:
            La = LBf.copy()
            ww = wide * 0.9
            La[..., 1] = LBf[..., 1] * (1 - ww) + tone_ab[0] * ww
            La[..., 2] = LBf[..., 2] * (1 - ww) + tone_ab[1] * ww
            La[..., 0] = LBf[..., 0] + wide * 3
            Baura = np.where(wide[..., None] > 0.004, unlab(La), Bfull)
        else:
            Baura = Bback

        rects = {
            "lit": save_frame(compose(Flit, Bfull), rgb, f"{out_dir}/lit{k}.webp"),
            "back": save_frame(compose(Flit, Bback), rgb, f"{out_dir}/back{k}.webp"),
            "aura": save_frame(compose(Flit, Baura), rgb, f"{out_dir}/aura{k}.webp"),
        }

        save_mask(gsoft, f"{out_dir}/g{k}.png")
        save_mask(1 - a, f"{out_dir}/out{k}.png")
        halo = blur(a, 70)
        halo = halo / max(halo.max(), 1e-6)
        save_mask(1 - np.maximum(a, halo * 0.85), f"{out_dir}/inv{k}.png")
        small = cv2.resize(cv2.dilate((a > 0.5).astype(np.uint8), np.ones((31, 31), np.uint8)) * 255, (320, 180), interpolation=cv2.INTER_AREA)
        hit[small > 60] = (k + 1) * 50

        tone_rgb = unlab(np.array([[[62, tone_ab[0], tone_ab[1]]]], np.float32))[0, 0] if tone_ab is not None else np.array([255, 246, 234])
        meta.append({"cx": round(float(cxp) / W, 4), "head": round(y / H, 4), "feet": round((y + h) / H, 4), "frames": rects,
                     "tone": "#%02x%02x%02x" % tuple(int(v) for v in tone_rgb), "colourful": tone_ab is not None})

        qa = qa * (1 - 0.55 * gsoft[..., None]) + np.array([0, 255, 0]) * 0.55 * gsoft[..., None]
        edge = (cv2.dilate((a > 0.5).astype(np.uint8), np.ones((3, 3), np.uint8)) - (a > 0.5)).astype(bool)
        qa[edge] = [255, 0, 0]
        print(sid, k, "bbox", x, y, w, h, "chroma %.0f" % chroma, meta[-1]["tone"], flush=True)

    # everything except ALL models (big type that sits behind the whole group)
    outs = [np.asarray(Image.open(f"{out_dir}/out{k}.png"))[..., 3] for k in range(len(comps))]
    oa = np.minimum.reduce(outs)
    Image.fromarray(np.dstack([np.full_like(oa, 255)] * 3 + [oa]), "RGBA").save(f"{out_dir}/outall.png", optimize=True)
    Image.fromarray(hit, "L").save(f"{out_dir}/hit.png", optimize=True)
    json.dump({"slide": name, "models": meta}, open(f"{out_dir}/meta.json", "w"), indent=1)
    Image.fromarray(np.clip(qa, 0, 255).astype(np.uint8)).save(f"{ROOT}/scratch/audit_shots/labqa_{sid}.jpg", quality=92)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
