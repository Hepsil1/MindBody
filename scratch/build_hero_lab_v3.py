"""Hero-lab v3 — assets for the 12 concepts of /hero-lab/best (HeroLabStage2).

  python scratch/build_hero_lab_v3.py s1_duo:match u21_palette:match n3_red360:match u15_fuchsia u05_forest_set:match

Same rule as v2: nothing is faked with CSS blends over the finished photo.
Every state is rendered here from the lossless build with real matting
(I = a*F + (1-a)*B), so hair and body edges stay clean.

Adds to public/hero/lab/<sid>/ (per model k):
  cut<k>.webp     the model alone (un-mixed foreground, RGBA crop)
  erase<k>.webp   the backdrop behind her (RGBA crop) - goes under a moving cut
  mono<k>.webp    the studio in black & white, she stays in colour
  focus<k>.webp   everything but her out of focus
  column<k>.webp  a column of her outfit's colour on the wall behind her
  flash<k>.webp   on-camera flash: her hard shadow on the wall
  window<k>.webp  window light falling on the wall behind her
  meta3.json      rects of all of the above + geometry (bbox, contour path, anchors)
QA sheets: scratch/audit_shots/lab3_<sid>_<kind>.jpg
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_hero_lab_v2 as V

ROOT = V.ROOT
blur, smooth, lab, unlab = V.blur, V.smooth, V.lab, V.unlab


def save_rgba(rgb, alpha, path, pad=6):
    """RGBA crop around alpha>0; returns rect as canvas fractions."""
    H, W = alpha.shape
    ys, xs = np.where(alpha > 0.004)
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
    rgb8 = np.clip(rgb[y0:y1, x0:x1] + 0.5, 0, 255).astype(np.uint8)
    a8 = (np.clip(alpha[y0:y1, x0:x1], 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, a8]), "RGBA").save(path, quality=V.Q, method=6, exact=True)
    return [round(x0 / W, 5), round(y0 / H, 5), round((x1 - x0) / W, 5), round((y1 - y0) / H, 5)]


def save_full(frame, path):
    """Whole-frame state (mono / focus): plain RGB, no alpha channel to pay for."""
    Image.fromarray(np.clip(frame + 0.5, 0, 255).astype(np.uint8)).save(path, quality=90, method=6)
    return [0, 0, 1, 1]


def contour_path(a, feet_y, W, H):
    """Open outline that hugs the model ~14 px out, from the floor on her left,
    over the head, back to the floor on her right. viewBox 1600x900."""
    s = blur((a > 0.5).astype(np.float32), 12)
    m = (s > 0.12).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    # periodic smoothing of the polyline
    k = 41
    g = cv2.getGaussianKernel(k, 9).ravel()
    ext = np.concatenate([c[-k:], c, c[:k]])
    sm = np.stack([np.convolve(ext[:, i], g, mode="same") for i in range(2)], 1)[k:-k]
    # open it along the floor: drop everything below the feet line
    keep = sm[:, 1] < feet_y - 0.004 * H
    # rotate so the kept run is contiguous, starting at the left end
    idx = np.where(~keep)[0]
    if len(idx):
        start = idx[-1] + 1 if keep[0] and not keep[-1] else None
        # find the longest contiguous kept run on the ring
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
    old = json.load(open(f"{out_dir}/meta.json"))["models"]

    n, cl, st, _ = cv2.connectedComponentsWithStats((matte > 0.5).astype(np.uint8))
    comps = sorted([i for i in range(1, n) if st[i, 4] > 20000], key=lambda i: st[i, 0])
    B = V.bg_estimate(rgb, matte)
    dist_bg = np.linalg.norm(lab(rgb) - lab(B), axis=2)
    yy = np.arange(H, dtype=np.float32)[:, None]
    xx = np.arange(W, dtype=np.float32)[None, :]

    # --- per-model alpha (same foot-zone fix as v2) ---
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
    Ball = np.where(A_all[..., None] < 0.02, rgb, B)  # backdrop with nobody in it
    LBall = lab(Ball)

    def over(Bnew):
        """Change the backdrop only; every model stays in front, exactly."""
        return rgb + (1 - A_all[..., None]) * (Bnew - Ball)

    meta = []
    sheets = {}
    for k, (a, (x, y, w, h)) in enumerate(zip(alphas, boxes)):
        a3 = a[..., None]
        F = np.where(a3 > 0.02, (rgb - (1 - a3) * B) / np.maximum(a3, 0.02), rgb)
        F = np.clip(F, 0, 255)
        cxp, feet = x + w / 2, y + h
        without = np.where(a3 > 0.02, B, rgb)  # the picture with her taken out
        r = {}

        # cut + erase
        r["cut"] = save_rgba(F, a, f"{out_dir}/cut{k}.webp")
        e = cv2.dilate((a > 0).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
        r["erase"] = save_rgba(without, e, f"{out_dir}/erase{k}.webp")

        # mono: the studio (and everyone else) in black & white
        Lw = lab(without)
        Lw[..., 1] = 0
        Lw[..., 2] = 1.5
        mono = a3 * F + (1 - a3) * unlab(Lw)
        r["mono"] = save_full(mono, f"{out_dir}/mono{k}.webp")

        # focus: everything else out of focus (the floor right at her feet stays put)
        soft = blur(without, 15)
        band = np.exp(-(((xx - cxp) / (0.075 * W)) ** 2 + ((yy - feet) / (0.03 * H)) ** 2))
        wgt = (1 - 0.9 * band)[..., None]
        focus = a3 * F + (1 - a3) * (without * (1 - wgt) + soft * wgt)
        r["focus"] = save_full(focus, f"{out_dir}/focus{k}.webp")

        # garment colour (Lab) from v2's tone + actual lightness
        LF = lab(F)
        body = (a > 0.6) & (yy > y + h * 0.3) & (yy < y + h * 0.8)
        skin = (LF[..., 0] > 32) & (LF[..., 1] > 5) & (LF[..., 1] < 30) & (LF[..., 2] > 7) & (LF[..., 2] < 38)
        gz = body & ~skin
        gL, ga, gb = (float(np.median(LF[..., i][gz])) for i in range(3))
        chroma = float(np.hypot(ga, gb))

        # column of colour on the wall behind her
        half = max(0.62 * w, 0.06 * W)
        cx0, cx1 = cxp - half, cxp + half
        box = np.clip(np.minimum(xx - cx0, cx1 - xx) + 0.5, 0, 1) * np.ones((H, 1), np.float32)
        hz = feet - 0.20 * H
        t = smooth(yy, hz - 0.04 * H, hz + 0.04 * H)  # 0 wall -> 1 floor
        strength = (1 - t) + t * (0.42 - 0.3 * smooth(yy, hz, H))
        mcol = (box * (1 - t) + blur(box, 12) * t) * strength
        # truthful hue: brown stays brown, black stays charcoal; only a mild lift
        sc = float(np.clip(chroma * 1.5, chroma, 46)) / chroma if chroma > 6 else 0.0
        Lt = float(np.clip(gL + 16, 30, 66))
        Lc = LBall.copy()
        Lc[..., 0] = LBall[..., 0] * (1 - 0.74 * mcol) + Lt * 0.74 * mcol
        Lc[..., 1] = LBall[..., 1] * (1 - mcol) + ga * sc * mcol
        Lc[..., 2] = LBall[..., 2] * (1 - mcol) + gb * sc * mcol
        # the column stands a finger off the wall: thin shadow along its right edge
        sh = blur(np.roll(box, 9, axis=1), 8) * (1 - box) * (1 - t) * 0.16
        Lc[..., 0] *= 1 - sh
        column = over(np.where((mcol + sh)[..., None] > 0.003, unlab(Lc), Ball))
        r["column"] = V.save_frame(column, rgb, f"{out_dir}/column{k}.webp")
        col_L = float(np.median(Lc[..., 0][(box > 0.9) & (yy < y)])) if y > 4 else Lt

        # flash: hard shadow of her on the wall, up-right, a touch bigger
        M = np.float32([[1.035, 0, cxp * (1 - 1.035) + 0.020 * W], [0, 1.035, feet * (1 - 1.035) - 0.004 * H]])
        shd = cv2.warpAffine((a > 0.5).astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)
        shd = blur(shd, 4.5) * (1 - smooth(yy, feet - 0.17 * H, feet - 0.07 * H))
        fall = np.clip(np.hypot((xx - cxp) / W, (yy - (y + h / 2)) / W) / 0.55, 0, 1) ** 1.5
        Bfl = Ball * (1 - 0.33 * shd[..., None]) * (1 - 0.08 * fall[..., None])
        r["flash"] = V.save_frame(over(Bfl), rgb, f"{out_dir}/flash{k}.webp")

        # window light on the wall: 2 x 3 slanted panes, upper-left of her
        pw, ph, gap, skew = 0.062 * W, 0.105 * H, 0.011 * W, 0.42
        wx0, wy0 = cxp - 0.150 * W, y - 0.035 * H
        u = (xx - wx0) - skew * (yy - wy0)
        v = (yy - wy0) * np.ones((1, W), np.float32)
        pane = np.zeros((H, W), np.float32)
        for i in range(2):
            for j in range(3):
                px0, py0 = i * (pw + gap), j * (ph + gap * 0.9)
                pane = np.maximum(pane, ((u > px0) & (u < px0 + pw) & (v > py0) & (v < py0 + ph)).astype(np.float32))
        pane = blur(pane, 5.5) * (1 - 0.35 * smooth(v, 0, 3 * ph))
        Lwn = LBall.copy()
        Lwn[..., 0] = LBall[..., 0] + pane * (100 - LBall[..., 0]) * 0.44
        Lwn[..., 2] = LBall[..., 2] + pane * 5
        Lwn[..., 0] *= 1 - 0.05 * (1 - pane) * smooth(blur(pane, 90), 0.02, 0.3)
        win = over(np.where(blur(pane, 90)[..., None] > 0.002, unlab(Lwn), Ball))
        r["window"] = V.save_frame(win, rgb, f"{out_dir}/window{k}.webp")

        # geometry
        rows = (a[int(y + h * 0.28):int(y + h * 0.38)] > 0.3).any(axis=0)
        cols = np.where(rows)[0]
        torso = (a[int(y + h * 0.30):int(y + h * 0.36)] > 0.6)
        tx = np.where(torso.any(axis=0))[0]
        # torso centre = the widest contiguous solid run in that band
        runs = np.split(tx, np.where(np.diff(tx) > 1)[0] + 1)
        run = max(runs, key=len)
        left_free = (x - (boxes[k - 1][0] + boxes[k - 1][2])) if k > 0 else x
        right_free = (boxes[k + 1][0] - (x + w)) if k + 1 < len(boxes) else W - (x + w)
        m = dict(old[k])
        m.update({
            "r": r, "x0": round(x / W, 4), "x1": round((x + w) / W, 4),
            "row": [round(cols.min() / W, 4), round(cols.max() / W, 4)],
            "gx": round(float(run.mean()) / W, 4), "gy": round((y + h * 0.33) / H, 4),
            "side": -1 if left_free > right_free else 1,
            "col": [round(cx0 / W, 4), round(cx1 / W, 4)], "colDark": col_L < 62,
            "win": [round(wx0 / W, 4), round(wy0 / H, 4)],
            "path": contour_path(a, feet, W, H),
        })
        m.pop("frames", None)
        meta.append(m)
        for name, img in (("mono", mono), ("focus", focus), ("column", column), ("flash", over(Bfl)), ("window", win)):
            sheets.setdefault(name, []).append(cv2.resize(np.clip(img, 0, 255).astype(np.uint8), (1280, 720), interpolation=cv2.INTER_AREA))
        print(sid, k, "garment Lab %.0f %.0f %.0f" % (gL, ga, gb), "side", m["side"], flush=True)

    json.dump({"models": meta}, open(f"{out_dir}/meta3.json", "w"))
    for name, ims in sheets.items():
        Image.fromarray(np.vstack(ims[:2])).save(f"{ROOT}/scratch/audit_shots/lab3_{sid}_{name}.jpg", quality=88)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
