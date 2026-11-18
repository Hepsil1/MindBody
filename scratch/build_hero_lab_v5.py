"""Hero-lab v5 - assets for the variants of /hero-lab (HeroLabStage2).

  python scratch/build_hero_lab_v5.py s1_duo:match u21_palette:match ...

Same rule as before: every picture state is rendered from the lossless build
with real matting (I = a*F + (1-a)*B), so hair and body edges stay clean; CSS
only reveals the state.

Per model k in public/hero/lab/<sid>/ (RGBA crops of what differs from base):
  colour on the wall, in the colour of her outfit
    column  arch  disc   painted like paper: lit from above, a lighter left
                         edge, a thin shadow off the wall, and her own soft
                         shadow falling on it
    silh                 her silhouette in her colour, twice, stepping aside
  light
    flash  colflash      on-camera flash, hard shadow (+ the colour column)
  meta5.json  rects + geometry + outline path
Also (for slides the lab has not seen yet): base.webp, base-1600.webp, hit.png,
outall.png.   QA sheets: scratch/audit_shots/lab5_<sid>_<k>.jpg
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_hero_lab_v2 as V

ROOT = V.ROOT
blur, smooth, lab, unlab = V.blur, V.smooth, V.lab, V.unlab
Q = 90


def save_frame(frame, base, path):
    """Only what differs from the base, full resolution, RGBA crop -> rect."""
    H, W = base.shape[:2]
    diff = np.abs(frame - base).max(axis=2)
    alpha = smooth(blur(diff, 1.2), 0.35, 2.2)
    alpha = np.maximum(alpha, smooth(blur(cv2.dilate(alpha, np.ones((5, 5), np.uint8)), 2.0), 0.05, 0.6))
    ys, xs = np.where(alpha > 0.004)
    pad = 8
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
    rgb8 = np.clip(frame[y0:y1, x0:x1] + 0.5, 0, 255).astype(np.uint8)
    a8 = (np.clip(alpha[y0:y1, x0:x1], 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, a8]), "RGBA").save(path, quality=Q, method=4, exact=True)
    return [round(x0 / W, 5), round(y0 / H, 5), round((x1 - x0) / W, 5), round((y1 - y0) / H, 5)]


def contour_path(a, feet_y, W, H, grow=12.0):
    """Open outline round the model (grow ~ how far out), from the floor on her
    left, over the head, to the floor on her right. viewBox 1600x900."""
    s = blur((a > 0.5).astype(np.float32), grow)
    m = (s > 0.12).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    k = 41
    g = cv2.getGaussianKernel(k, 9).ravel()
    ext = np.concatenate([c[-k:], c, c[:k]])
    sm = np.stack([np.convolve(ext[:, i], g, mode="same") for i in range(2)], 1)[k:-k]
    keep = sm[:, 1] < feet_y - 0.004 * H
    n = len(sm)
    best, cur, bs = 0, 0, 0
    for i in range(2 * n):
        if keep[i % n]:
            cur += 1
            if cur > best:
                best, bs = cur, i - cur + 1
        else:
            cur = 0
    best = min(best, n)
    sm = np.array([sm[(bs + i) % n] for i in range(best)])
    if sm[0, 0] > sm[-1, 0]:
        sm = sm[::-1]
    sm = sm[::5]
    pts = sm * np.array([1600 / W, 900 / H])
    return "M" + " L".join("%.1f %.1f" % (p[0], p[1]) for p in pts)


def main(spec):
    sid, _, variant = spec.partition(":")
    rgb = V.lossless_slide(sid, variant)
    matte = np.asarray(Image.open(f"{ROOT}/scratch/hero_v4_base/{sid}_matte.png")).astype(np.float32) / 255
    H, W = matte.shape
    out_dir = f"{ROOT}/public/hero/lab/{sid}"
    os.makedirs(out_dir, exist_ok=True)
    if not os.path.exists(f"{out_dir}/base.webp"):
        im = Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8))
        im.save(f"{out_dir}/base.webp", quality=V.Q, method=6)
        im.resize((1600, 900), Image.Resampling.LANCZOS).save(f"{out_dir}/base-1600.webp", quality=V.Q, method=6)

    n, cl, st, _ = cv2.connectedComponentsWithStats((matte > 0.5).astype(np.uint8))
    comps = sorted([i for i in range(1, n) if st[i, 4] > 20000], key=lambda i: st[i, 0])
    B = V.bg_estimate(rgb, matte)
    dist_bg = np.linalg.norm(lab(rgb) - lab(B), axis=2)
    yy = np.arange(H, dtype=np.float32)[:, None]
    xx = np.arange(W, dtype=np.float32)[None, :]
    ones = np.ones((H, W), np.float32)

    alphas, boxes = [], []
    hit = np.zeros((180, 320), np.uint8)
    for k, ci in enumerate(comps):
        x, y, w, h = st[ci, :4]
        region = cv2.dilate((cl == ci).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
        a = np.where(region, matte, 0).astype(np.float32)
        foot_zone = smooth(yy, y + h * 0.93, y + h * 0.955) * np.ones((1, W), np.float32)
        a = a * (1 - foot_zone * (1 - smooth(dist_bg, 7, 16)))
        a = np.where(a < 0.02, 0, a)
        alphas.append(a)
        boxes.append((x, y, w, h))
        small = cv2.resize(cv2.dilate((a > 0.5).astype(np.uint8), np.ones((31, 31), np.uint8)) * 255, (320, 180), interpolation=cv2.INTER_AREA)
        hit[small > 60] = (k + 1) * 50
    A_all = np.clip(np.maximum.reduce(alphas), 0, 1)
    Ball = np.where(A_all[..., None] < 0.02, rgb, B)
    LBall = lab(Ball)
    Image.fromarray(hit, "L").save(f"{out_dir}/hit.png", optimize=True)
    V.save_mask(1 - A_all, f"{out_dir}/outall.png")

    def over(Bnew):
        return rgb + (1 - A_all[..., None]) * (Bnew - Ball)

    meta = []
    for k, (a, (x, y, w, h)) in enumerate(zip(alphas, boxes)):
        a3 = a[..., None]
        F = np.clip(np.where(a3 > 0.02, (rgb - (1 - a3) * B) / np.maximum(a3, 0.02), rgb), 0, 255)
        cxp, feet = x + w / 2, y + h
        left_free = (x - (boxes[k - 1][0] + boxes[k - 1][2])) if k > 0 else x
        right_free = (boxes[k + 1][0] - (x + w)) if k + 1 < len(boxes) else W - (x + w)
        side = -1 if left_free > right_free else 1
        r = {}

        LF = lab(F)
        body = (a > 0.6) & (yy > y + h * 0.3) & (yy < y + h * 0.8)
        skin = (LF[..., 0] > 32) & (LF[..., 1] > 5) & (LF[..., 1] < 30) & (LF[..., 2] > 7) & (LF[..., 2] < 38)
        gz = body & ~skin
        if gz.sum() < 2000:
            gz = body
        gL, ga, gb = (float(np.median(LF[..., i][gz])) for i in range(3))
        chroma = float(np.hypot(ga, gb))
        sc = float(np.clip(chroma * 1.5, chroma, 46)) / chroma if chroma > 6 else 0.0
        Lt = float(np.clip(gL + 16, 30, 66))
        # a pale outfit on a pale wall would give a fill nobody sees: keep her hue
        # but go deep enough to stand off the wall
        ring = (cv2.dilate((a > 0.5).astype(np.uint8), np.ones((61, 61), np.uint8)) > 0) & (A_all < 0.02) & (yy < y + h - 0.2 * H)
        wall_L = float(np.median(LBall[..., 0][ring]))
        Lt = min(Lt, wall_L - 24)

        hz = feet - 0.20 * H
        t = smooth(yy, hz - 0.04 * H, hz + 0.04 * H) * ones  # 0 wall -> 1 floor
        floor_k = 0.42 - 0.3 * smooth(yy, hz, H)

        def to_floor(shape):
            """shape runs down the wall and dissolves into the mirror floor"""
            return (shape * (1 - t) + blur(shape, 12) * t) * ((1 - t) + t * floor_k)

        # her own soft shadow, a little down-right of her: it lands on the colour
        Mh = np.float32([[1.02, 0, cxp * (1 - 1.02) + 0.010 * W], [0, 1.02, feet * (1 - 1.02) + 0.003 * H]])
        amb = cv2.warpAffine((a > 0.5).astype(np.float32), Mh, (W, H), flags=cv2.INTER_LINEAR)
        amb = blur(amb, 17) * (1 - smooth(yy, feet - 0.13 * H, feet - 0.03 * H))

        def tint(m, dL=0.0, shadow=None, paper=None, soft=True):
            """m: how much colour; shadow: the shape, for the thin shadow it casts
            on the wall; paper=(shape, top, bottom): light it like a sheet of paper"""
            Lc = LBall.copy()
            Lc[..., 0] = LBall[..., 0] * (1 - 0.74 * m) + (Lt + dL) * 0.74 * m
            Lc[..., 1] = LBall[..., 1] * (1 - m) + ga * sc * m
            Lc[..., 2] = LBall[..., 2] * (1 - m) + gb * sc * m
            tot = m
            if paper is not None:
                shp, top, bot = paper
                v = np.clip((yy - top) / max(bot - top, 1), 0, 1) * ones
                on = np.clip(shp, 0, 1) * (1 - t)
                Lc[..., 0] += on * 3.4 * (0.5 - v)  # lit from above
                edge = np.clip(shp - np.roll(shp, 3, axis=1), 0, 1) * (1 - t)
                Lc[..., 0] += 4.5 * edge  # the sheet's left edge catches the light
                if soft:
                    Lc[..., 0] *= 1 - 0.17 * amb * on
            if shadow is not None:
                # the colour stands a finger off the wall: thin shadow down-right
                sh = blur(np.roll(np.roll(shadow, 9, axis=1), 5, axis=0), 8) * (1 - np.clip(shadow, 0, 1)) * (1 - t) * 0.16
                Lc[..., 0] *= 1 - sh
                tot = m + sh
            return np.where(tot[..., None] > 0.003, unlab(Lc), Ball)

        def put(name, Bnew):
            fr = over(Bnew)
            r[name] = save_frame(fr, rgb, f"{out_dir}/{name}{k}.webp")
            return fr

        qa = {}
        # ---- column ----
        half = max(0.62 * w, 0.06 * W, 0.5 * w + 0.03 * W)
        cx0, cx1 = cxp - half, cxp + half
        box = np.clip(np.minimum(xx - cx0, cx1 - xx) + 0.5, 0, 1) * ones
        Bcol = tint(to_floor(box), shadow=box, paper=(box, 0, hz))
        qa["column"] = put("column", Bcol)
        Bcol_flash = tint(to_floor(box), shadow=box, paper=(box, 0, hz), soft=False)
        Lcol = lab(Bcol)[..., 0]
        col_L = float(np.median(Lcol[(box > 0.9) & (yy < y) & (yy > 0.1 * H)])) if y > 0.12 * H else Lt

        # ---- arch: the column with a round head ----
        apex = max(y - 0.085 * H, 0.125 * H)
        cyc = apex + half
        circ = np.clip(half - np.hypot(xx - cxp, yy - cyc) + 0.5, 0, 1)
        arch = np.where(yy < cyc, circ, box)
        Barch = tint(to_floor(arch), shadow=arch, paper=(arch, apex, hz))
        qa["arch"] = put("arch", Barch)

        # ---- disc behind head and shoulders ----
        dR = 0.30 * h
        dcy = y + 0.27 * h
        disc = np.clip(dR - np.hypot(xx - cxp, yy - dcy) + 0.5, 0, 1)
        qa["disc"] = put("disc", tint(disc * (1 - t), shadow=disc, paper=(disc, dcy - dR, dcy + dR)))

        # ---- silh: her silhouette in her colour, twice, stepping aside ----
        def stepped(dx, grow):
            Ms = np.float32([[grow, 0, cxp * (1 - grow) + side * dx * W], [0, grow, feet * (1 - grow) - 0.006 * H]])
            sil = cv2.warpAffine((a > 0.5).astype(np.float32), Ms, (W, H), flags=cv2.INTER_LINEAR)
            return blur(sil, 1.3) * (1 - smooth(yy, feet - 0.15 * H, feet - 0.05 * H))

        s1, s2 = stepped(0.034, 1.03), stepped(0.068, 1.06)
        far = s2 * (1 - np.clip(s1, 0, 1))
        qa["silh"] = put("silh", tint(np.maximum(s1 * 0.94, far * 0.52), dL=-3.0 + 9.0 * far))

        # ---- flash ----
        M = np.float32([[1.035, 0, cxp * (1 - 1.035) + 0.020 * W], [0, 1.035, feet * (1 - 1.035) - 0.004 * H]])
        shd = cv2.warpAffine((a > 0.5).astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)
        shd = blur(shd, 4.0) * (1 - smooth(yy, feet - 0.17 * H, feet - 0.07 * H))
        LFl = LF.copy()
        LFl[..., 0] = np.clip(50 + (LF[..., 0] - 50) * 1.05 + 2.6, 0, 99)
        Ffl = unlab(LFl)

        def flashed(Bg):
            return over(Bg * (1 - 0.36 * shd[..., None])) + a3 * (Ffl - F)

        for name, Bg in (("flash", Ball), ("colflash", Bcol_flash)):
            fr = flashed(Bg)
            r[name] = save_frame(fr, rgb, f"{out_dir}/{name}{k}.webp")
            qa[name] = fr

        hexc = "#%02x%02x%02x" % tuple(int(v) for v in unlab(np.array([[[Lt, ga * sc, gb * sc]]], np.float32))[0, 0])
        meta.append({
            "cx": round(cxp / W, 4), "head": round(y / H, 4), "feet": round(feet / H, 4),
            "x0": round(x / W, 4), "x1": round((x + w) / W, 4), "side": side,
            "col": [round(cx0 / W, 4), round(cx1 / W, 4)], "colDark": col_L < 62,
            "wallL": round(wall_L, 1), "hex": hexc, "hz": round(hz / H, 4),
            "apex": round(apex / H, 4),
            "disc": [round(cxp / W, 4), round(dcy / H, 4), round(dR / W, 4)],
            "path": contour_path(a, feet, W, H),
            "r": r,
        })
        names = list(qa)
        tiles = [cv2.resize(np.clip(qa[nm], 0, 255).astype(np.uint8), (640, 360), interpolation=cv2.INTER_AREA) for nm in names]
        while len(tiles) % 4:
            tiles.append(np.zeros_like(tiles[0]))
        sheet = np.vstack([np.hstack(tiles[i:i + 4]) for i in range(0, len(tiles), 4)])
        Image.fromarray(sheet).save(f"{ROOT}/scratch/audit_shots/lab5_{sid}_{k}.jpg", quality=86)
        print(sid, k, "side", side, "wallL %.0f colL %.0f" % (wall_L, col_L), hexc, flush=True)

    json.dump({"models": meta}, open(f"{out_dir}/meta5.json", "w"))


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
