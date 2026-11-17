"""Hero-lab v4 - assets for /hero-lab (HeroLabStage2: column / contour / flash
and their combinations).

  python scratch/build_hero_lab_v4.py s1_duo:match u21_palette:match n3_red360:match u15_fuchsia u05_forest_set:match

Same rule as v2/v3: every state is rendered from the lossless build with real
matting (I = a*F + (1-a)*B); CSS only reveals it.

Per model k in public/hero/lab/<sid>/:
  column<k>.webp    a column of her outfit's colour on the wall behind her
  flash<k>.webp     on-camera flash: hard shadow on the wall, light falloff,
                    she is lit a touch brighter
  colflash<k>.webp  the same flash with the colour column standing behind her
  meta4.json        rects + geometry + outline path
QA sheets: scratch/audit_shots/lab4_<sid>_<kind>.jpg
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_hero_lab_v2 as V
from build_hero_lab_v3 import contour_path

ROOT = V.ROOT
blur, smooth, lab, unlab = V.blur, V.smooth, V.lab, V.unlab


def main(spec):
    sid, _, variant = spec.partition(":")
    rgb = V.lossless_slide(sid, variant)
    matte = np.asarray(Image.open(f"{ROOT}/scratch/hero_v4_base/{sid}_matte.png")).astype(np.float32) / 255
    H, W = matte.shape
    out_dir = f"{ROOT}/public/hero/lab/{sid}"
    old = json.load(open(f"{out_dir}/meta.json"))["models"]

    n, cl, st, _ = cv2.connectedComponentsWithStats((matte > 0.5).astype(np.uint8))
    comps = sorted([i for i in range(1, n) if st[i, 4] > 20000], key=lambda i: st[i, 0])
    B = V.bg_estimate(rgb, matte)
    dist_bg = np.linalg.norm(lab(rgb) - lab(B), axis=2)
    yy = np.arange(H, dtype=np.float32)[:, None]
    xx = np.arange(W, dtype=np.float32)[None, :]

    alphas, boxes = [], []
    for ci in comps:
        x, y, w, h = st[ci, :4]
        region = cv2.dilate((cl == ci).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
        a = np.where(region, matte, 0).astype(np.float32)
        foot_zone = smooth(yy, y + h * 0.93, y + h * 0.955) * np.ones((1, W), np.float32)
        a = a * (1 - foot_zone * (1 - smooth(dist_bg, 7, 16)))
        a = np.where(a < 0.02, 0, a)
        alphas.append(a)
        boxes.append((x, y, w, h))
    A_all = np.clip(np.maximum.reduce(alphas), 0, 1)
    Ball = np.where(A_all[..., None] < 0.02, rgb, B)
    LBall = lab(Ball)

    def over(Bnew):
        return rgb + (1 - A_all[..., None]) * (Bnew - Ball)

    meta, sheets = [], {}
    for k, (a, (x, y, w, h)) in enumerate(zip(alphas, boxes)):
        a3 = a[..., None]
        F = np.clip(np.where(a3 > 0.02, (rgb - (1 - a3) * B) / np.maximum(a3, 0.02), rgb), 0, 255)
        cxp, feet = x + w / 2, y + h
        r = {}

        LF = lab(F)
        body = (a > 0.6) & (yy > y + h * 0.3) & (yy < y + h * 0.8)
        skin = (LF[..., 0] > 32) & (LF[..., 1] > 5) & (LF[..., 1] < 30) & (LF[..., 2] > 7) & (LF[..., 2] < 38)
        gz = body & ~skin
        gL, ga, gb = (float(np.median(LF[..., i][gz])) for i in range(3))
        chroma = float(np.hypot(ga, gb))

        # ---- column of colour (as v3) ----
        half = max(0.62 * w, 0.06 * W, 0.5 * w + 0.03 * W)  # wide enough to carry the outline and its text
        cx0, cx1 = cxp - half, cxp + half
        box = np.clip(np.minimum(xx - cx0, cx1 - xx) + 0.5, 0, 1) * np.ones((H, 1), np.float32)
        hz = feet - 0.20 * H
        t = smooth(yy, hz - 0.04 * H, hz + 0.04 * H)
        strength = (1 - t) + t * (0.42 - 0.3 * smooth(yy, hz, H))
        mcol = (box * (1 - t) + blur(box, 12) * t) * strength
        sc = float(np.clip(chroma * 1.5, chroma, 46)) / chroma if chroma > 6 else 0.0
        Lt = float(np.clip(gL + 16, 30, 66))
        Lc = LBall.copy()
        Lc[..., 0] = LBall[..., 0] * (1 - 0.74 * mcol) + Lt * 0.74 * mcol
        Lc[..., 1] = LBall[..., 1] * (1 - mcol) + ga * sc * mcol
        Lc[..., 2] = LBall[..., 2] * (1 - mcol) + gb * sc * mcol
        sh = blur(np.roll(box, 9, axis=1), 8) * (1 - box) * (1 - t) * 0.16
        Lc[..., 0] *= 1 - sh
        Bcol = np.where((mcol + sh)[..., None] > 0.003, unlab(Lc), Ball)
        column = over(Bcol)
        r["column"] = V.save_frame(column, rgb, f"{out_dir}/column{k}.webp")
        col_L = float(np.median(Lc[..., 0][(box > 0.9) & (yy < y)])) if y > 4 else Lt

        # ---- flash ----
        M = np.float32([[1.035, 0, cxp * (1 - 1.035) + 0.020 * W], [0, 1.035, feet * (1 - 1.035) - 0.004 * H]])
        shd = cv2.warpAffine((a > 0.5).astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)
        shd = blur(shd, 4.0) * (1 - smooth(yy, feet - 0.17 * H, feet - 0.07 * H))
        fall = np.clip(np.hypot((xx - cxp) / W, (yy - (y + h / 2)) / W) / 0.55, 0, 1) ** 1.5
        # the flash reaches her first: she comes out a touch brighter and crisper
        LFl = LF.copy()
        LFl[..., 0] = np.clip(50 + (LF[..., 0] - 50) * 1.05 + 2.6, 0, 99)
        Ffl = unlab(LFl)

        def flashed(Bg):
            Bn = Bg * (1 - 0.36 * shd[..., None]) * (1 - 0.13 * fall[..., None])
            return over(Bn) + a3 * (Ffl - F)

        fl = flashed(Ball)
        r["flash"] = V.save_frame(fl, rgb, f"{out_dir}/flash{k}.webp")
        cf = flashed(Bcol)
        r["colflash"] = V.save_frame(cf, rgb, f"{out_dir}/colflash{k}.webp")

        # wall lightness round her (for the outline's ink)
        ring = (cv2.dilate((a > 0.5).astype(np.uint8), np.ones((61, 61), np.uint8)) > 0) & (A_all < 0.02) & (yy < feet - 0.2 * H)
        wall_L = float(np.median(LBall[..., 0][ring]))

        left_free = (x - (boxes[k - 1][0] + boxes[k - 1][2])) if k > 0 else x
        right_free = (boxes[k + 1][0] - (x + w)) if k + 1 < len(boxes) else W - (x + w)
        m = dict(old[k])
        m.pop("frames", None)
        m.update({
            "r": r, "x0": round(x / W, 4), "x1": round((x + w) / W, 4),
            "side": -1 if left_free > right_free else 1,
            "col": [round(cx0 / W, 4), round(cx1 / W, 4)], "colDark": col_L < 62,
            "wallL": round(wall_L, 1), "colL": round(col_L, 1),
            "path": contour_path(a, feet, W, H),
        })
        meta.append(m)
        for name, img in (("column", column), ("flash", fl), ("colflash", cf)):
            sheets.setdefault(name, []).append(cv2.resize(np.clip(img, 0, 255).astype(np.uint8), (1280, 720), interpolation=cv2.INTER_AREA))
        print(sid, k, "wallL %.0f colL %.0f" % (wall_L, col_L), r, flush=True)

    json.dump({"models": meta}, open(f"{out_dir}/meta4.json", "w"))
    for name, ims in sheets.items():
        Image.fromarray(np.vstack(ims[:2])).save(f"{ROOT}/scratch/audit_shots/lab4_{sid}_{name}.jpg", quality=88)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
