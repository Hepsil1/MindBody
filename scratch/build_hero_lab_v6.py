"""Hero-lab v6 - a LAYERED scene for /hero-lab (HeroLabLive).

  python scratch/build_hero_lab_v6.py s1_duo:match u21_palette:match ...

Until now every effect was a finished frame (base + one pre-rendered state).
That cannot move. v6 splits the slide the way it is matted:

    picture = a * F + (1 - a) * B

  plate.webp        B  - the studio with nobody in it
  cut<k>.webp       F,a - model k, un-mixed foreground with her alpha
  sil<k>.webp       her matte alone (alpha only) - the shape of her shadow
  colbg<k>.webp     the paper column behind her, as a change to the plate
  thumb.webp, hit.png, meta6.json (geometry + outline path)

The browser stacks plate -> anything behind her (shadow, colour) -> the cuts,
so whatever is put behind her is composited with the same equation the photo
was made with: hair and body edges stay exact, and the things behind her can
follow the pointer in real time.

Prints the largest difference between plate+cuts and the original picture.
QA: scratch/audit_shots/lab6_<sid>.jpg (recomposite | original | difference x8)
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_hero_lab_v2 as V
from build_hero_lab_v5 import contour_path, save_frame

ROOT = V.ROOT
blur, smooth, lab, unlab = V.blur, V.smooth, V.lab, V.unlab


def save_rgba(rgb, alpha, path, pad=6, q=93):
    """RGBA crop around alpha>0 -> rect as canvas fractions."""
    H, W = alpha.shape
    ys, xs = np.where(alpha > 0.004)
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
    rgb8 = np.clip(rgb[y0:y1, x0:x1] + 0.5, 0, 255).astype(np.uint8)
    a8 = (np.clip(alpha[y0:y1, x0:x1], 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, a8]), "RGBA").save(path, quality=q, method=6, exact=True)
    return [round(x0 / W, 5), round(y0 / H, 5), round((x1 - x0) / W, 5), round((y1 - y0) / H, 5)]


def main(spec):
    sid, _, variant = spec.partition(":")
    rgb = V.lossless_slide(sid, variant)
    matte = np.asarray(Image.open(f"{ROOT}/scratch/hero_v4_base/{sid}_matte.png")).astype(np.float32) / 255
    H, W = matte.shape
    out_dir = f"{ROOT}/public/hero/lab/{sid}"
    os.makedirs(out_dir, exist_ok=True)

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
    Ball = np.where(A_all[..., None] < 0.02, rgb, B)  # the studio with nobody in it
    LBall = lab(Ball)

    plate8 = np.clip(Ball + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(plate8).save(f"{out_dir}/plate.webp", quality=V.Q, method=6)
    Image.fromarray(plate8).resize((1600, 900), Image.Resampling.LANCZOS).save(f"{out_dir}/plate-1600.webp", quality=V.Q, method=6)
    Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8)).resize((224, 126), Image.Resampling.LANCZOS).save(f"{out_dir}/thumb.webp", quality=82, method=6)
    Image.fromarray(hit, "L").save(f"{out_dir}/hit.png", optimize=True)

    meta = []
    recomposed = Ball.copy()
    for k, (a, (x, y, w, h)) in enumerate(zip(alphas, boxes)):
        # Un-mix her from the backdrop. Where the matte is too thin to explain the
        # pixel (F would leave 0..255) raise the alpha just enough, so that
        # a*F + (1-a)*B gives the photograph back exactly.
        need = np.where(rgb > B, (rgb - B) / np.maximum(255 - B, 1), (B - rgb) / np.maximum(B, 1)).max(axis=2)
        a = np.where(a > 0.02, np.clip(np.maximum(a, need + 0.004), 0, 1), 0).astype(np.float32)
        alphas[k] = a
        a3 = a[..., None]
        F = np.clip(np.where(a3 > 0.02, (rgb - (1 - a3) * B) / np.maximum(a3, 0.02), rgb), 0, 255)
        cxp, feet = x + w / 2, y + h
        left_free = (x - (boxes[k - 1][0] + boxes[k - 1][2])) if k > 0 else x
        right_free = (boxes[k + 1][0] - (x + w)) if k + 1 < len(boxes) else W - (x + w)
        side = -1 if left_free > right_free else 1
        r = {}

        # ---- the model herself ----
        r["cut"] = save_rgba(F, a, f"{out_dir}/cut{k}.webp")
        recomposed = a3 * F + (1 - a3) * recomposed

        # ---- her matte alone: what her shadow is cut from (half size is plenty) ----
        ys, xs = np.where(a > 0.004)
        pad = 24
        sx0, sx1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
        sy0, sy1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
        sm = blur(a, 1.6)[sy0:sy1, sx0:sx1]
        sm = cv2.resize(sm, ((sx1 - sx0) // 2, (sy1 - sy0) // 2), interpolation=cv2.INTER_AREA)
        s8 = (np.clip(sm, 0, 1) * 255 + 0.5).astype(np.uint8)
        Image.fromarray(np.dstack([np.full_like(s8, 255)] * 3 + [s8]), "RGBA").save(f"{out_dir}/sil{k}.webp", lossless=True, method=6)
        r["sil"] = [round(sx0 / W, 5), round(sy0 / H, 5), round((sx1 - sx0) / W, 5), round((sy1 - sy0) / H, 5)]

        # ---- garment colour ----
        LF = lab(F)
        body = (a > 0.6) & (yy > y + h * 0.3) & (yy < y + h * 0.8)
        skin = (LF[..., 0] > 32) & (LF[..., 1] > 5) & (LF[..., 1] < 30) & (LF[..., 2] > 7) & (LF[..., 2] < 38)
        gz = body & ~skin
        if gz.sum() < 2000:
            gz = body
        gL, ga, gb = (float(np.median(LF[..., i][gz])) for i in range(3))
        chroma = float(np.hypot(ga, gb))
        sc = float(np.clip(chroma * 1.5, chroma, 46)) / chroma if chroma > 6 else 0.0
        ring = (cv2.dilate((a > 0.5).astype(np.uint8), np.ones((61, 61), np.uint8)) > 0) & (A_all < 0.02) & (yy < feet - 0.2 * H)
        wall_L = float(np.median(LBall[..., 0][ring]))
        # a pale outfit on a pale wall would give a colour nobody sees: keep her hue, go deeper
        Lt = min(float(np.clip(gL + 16, 30, 66)), wall_L - 24)

        # ---- the paper column behind her, as a change to the plate ----
        hz = feet - 0.20 * H
        t = smooth(yy, hz - 0.04 * H, hz + 0.04 * H) * ones  # 0 wall -> 1 floor
        floor_k = 0.42 - 0.3 * smooth(yy, hz, H)
        half = max(0.62 * w, 0.06 * W, 0.5 * w + 0.03 * W)
        cx0, cx1 = cxp - half, cxp + half
        box = np.clip(np.minimum(xx - cx0, cx1 - xx) + 0.5, 0, 1) * ones
        m = (box * (1 - t) + blur(box, 12) * t) * ((1 - t) + t * floor_k)
        Lc = LBall.copy()
        Lc[..., 0] = LBall[..., 0] * (1 - 0.74 * m) + Lt * 0.74 * m
        Lc[..., 1] = LBall[..., 1] * (1 - m) + ga * sc * m
        Lc[..., 2] = LBall[..., 2] * (1 - m) + gb * sc * m
        on = box * (1 - t)
        v = np.clip(yy / max(hz, 1), 0, 1) * ones
        Lc[..., 0] += on * 3.4 * (0.5 - v)  # paper lit from above
        Lc[..., 0] += 4.5 * np.clip(box - np.roll(box, 3, axis=1), 0, 1) * (1 - t)  # its left edge catches the light
        sh = blur(np.roll(np.roll(box, 9, axis=1), 5, axis=0), 8) * (1 - box) * (1 - t) * 0.16
        Lc[..., 0] *= 1 - sh  # it stands a finger off the wall
        Bcol = np.where((m + sh)[..., None] > 0.003, unlab(Lc), Ball)
        r["colbg"] = save_frame(Bcol, Ball, f"{out_dir}/colbg{k}.webp")
        Lcol = lab(Bcol)[..., 0]
        col_L = float(np.median(Lcol[(box > 0.9) & (yy < y) & (yy > 0.1 * H)])) if y > 0.12 * H else Lt

        def hexof(L, a_, b_):
            return "#%02x%02x%02x" % tuple(int(v_) for v_ in unlab(np.array([[[L, a_, b_]]], np.float32))[0, 0])

        meta.append({
            "cx": round(cxp / W, 4), "head": round(y / H, 4), "feet": round(feet / H, 4),
            "x0": round(x / W, 4), "x1": round((x + w) / W, 4), "side": side,
            "col": [round(cx0 / W, 4), round(cx1 / W, 4)], "colDark": col_L < 62,
            "wallL": round(wall_L, 1),
            # her colour as a shadow would carry it, and a lighter second tone
            "hex": hexof(Lt, ga * sc, gb * sc), "hex2": hexof(min(Lt + 20, 82), ga * sc * 0.8, gb * sc * 0.8),
            "path": contour_path(a, feet, W, H),
            "r": r,
        })
        print(sid, k, "side", side, "wallL %.0f" % wall_L, meta[-1]["hex"], meta[-1]["hex2"], flush=True)

    diff = np.abs(recomposed - rgb).max(axis=2)
    print(sid, "plate+cuts vs picture: max %.1f, mean %.3f, >3: %d px" % (diff.max(), diff.mean(), int((diff > 3).sum())), flush=True)
    qa = np.hstack([cv2.resize(np.clip(im, 0, 255).astype(np.uint8), (854, 480), interpolation=cv2.INTER_AREA)
                    for im in (recomposed, rgb, np.dstack([diff * 8] * 3))])
    Image.fromarray(qa).save(f"{ROOT}/scratch/audit_shots/lab6_{sid}.jpg", quality=88)
    json.dump({"models": meta}, open(f"{out_dir}/meta6.json", "w"))


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
