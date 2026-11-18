"""Hero-lab v7 - her OUTFIT as its own layer, for the effects that play on the
garment itself (not round her). Works from the v6 cut-outs, so it lines up
with them pixel for pixel and needs no matting.

  python scratch/build_hero_lab_v7_fabric.py s1_duo s1_duo__c u21_palette ...

Adds to public/hero/lab/<dir>/ :
  fab<k>.webp   RGBA, same rect as cut<k>: rgb = her outfit lit (more exposure,
                in linear light, so every fold keeps its shading), alpha = the
                garment only (never skin, hair or face)
and to meta6.json, per model:
  gpath   the garment's own outline (viewBox 1600x900) - neckline, cuffs, hem
  gdark   true for black / navy / dark outfits (they need a stronger light)
  fab     false where the garment could not be found well (a busy print):
          the page then leaves the fabric effects off for her
QA: scratch/audit_shots/fab_<dir>.jpg  (garment mask in red over her | lit)

The garment is found as in build_hero_lab_v2: colour clusters of the torso and
legs, skin and head left out.
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_hero_lab_v2 as V

ROOT = V.ROOT
W, H = 2560, 1440
blur, smooth, lab = V.blur, V.smooth, V.lab


def garment(F, a, top, h):
    """F, a: the cut (crop). top, h: her head line and height in crop pixels."""
    CH, CW = a.shape
    yy = np.arange(CH, dtype=np.float32)[:, None] * np.ones((1, CW), np.float32)
    LF = lab(F)
    L, A_, B_ = LF[..., 0], LF[..., 1], LF[..., 2]
    body = a > 0.6
    skin = (L > 32) & (A_ > 5) & (A_ < 30) & (B_ > 7) & (B_ < 38) & (B_ > 0.35 * A_)
    head = yy < top + h * 0.125
    cand = body & ~skin & ~head
    zone = cand & (yy > top + h * 0.2) & (yy < top + h * 0.85)
    feats = np.stack([L[zone] * 0.5, A_[zone], B_[zone]], 1).astype(np.float32)
    K = 2
    _, lbl, cen = cv2.kmeans(feats[:: max(1, len(feats) // 40000)], K, None,
                             (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    cnt = np.bincount(lbl.ravel(), minlength=K) / len(lbl)
    fe = np.stack([L * 0.5, A_, B_], 2)
    dmin = np.full(a.shape, 1e9, np.float32)
    for j in range(K):
        if cnt[j] > 0.12:
            thr = 15 + 0.4 * float(np.linalg.norm(cen[j][1:]))
            dmin = np.minimum(dmin, np.linalg.norm(fe - cen[j], axis=2) * (15 / thr))
    g = (cand & (dmin < 15)).astype(np.uint8)
    g = cv2.medianBlur(g, 3)
    nh, hl, hs, _ = cv2.connectedComponentsWithStats(1 - g, connectivity=4)
    small = np.isin(hl, [j for j in range(1, nh) if hs[j, 4] < 60]) & body & ~skin
    g = (g > 0) | small
    ng, gl, gs, _ = cv2.connectedComponentsWithStats(g.astype(np.uint8))
    g = np.isin(gl, [j for j in range(1, ng) if gs[j, 4] > 3000])
    # a clean edge: close tiny notches, then soften by a pixel
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    g = g & (a > 0.3)
    gsoft = np.minimum(blur(g.astype(np.float32), 0.9), a)
    Lg = float(np.median(L[g])) if g.any() else 50.0
    return g, gsoft, Lg


def lit(F, gsoft, Lg):
    """her outfit when the effect plays on it.
    mid tones: more exposure, in linear light (folds keep their shading);
    black / navy: lifted to charcoal so the folds show;
    pale (pink, sky, white): a lamp can't make them lighter, so the colour
    deepens and blooms instead"""
    LF = lab(F)
    vivid = smooth(np.hypot(LF[..., 1], LF[..., 2]), 30, 60)
    light = smooth(LF[..., 0], 48, 72)
    if Lg > 62:
        L2 = LF.copy()
        k = gsoft * (1 - 0.6 * smooth(LF[..., 0], 88, 97))  # pure white piping stays white
        L2[..., 0] = LF[..., 0] - 6 * k
        L2[..., 1] = LF[..., 1] * (1 + 0.45 * k)
        L2[..., 2] = LF[..., 2] * (1 + 0.45 * k)
        return np.clip(V.unlab(L2), 0, 255)
    dark = Lg < 30
    base = 1.6 if dark else 0.62
    gain = 1 + gsoft * base * (1 - 0.3 * vivid) * (1 - 0.85 * light)
    lin = (F / 255.0) ** 2.2 * gain[..., None]
    if dark:
        # black knit lifts to charcoal, folds and all
        lin = lin + (gsoft * (1 - light))[..., None] * 0.016
    mx = lin.max(axis=2)
    knee = 0.72
    mx2 = np.where(mx > knee, knee + (1 - knee) * np.tanh((mx - knee) / (1 - knee)), mx)
    lin = lin * (mx2 / np.maximum(mx, 1e-6))[..., None]
    return np.clip(lin, 0, 1) ** (1 / 2.2) * 255.0


# brown hair on a brown suit: the colour clusters take the hair too, and the
# fabric light must never touch hair
NO_FAB = {"s2_cocoa360"}


def band(g, top, h, x0, y0):
    """the widest unbroken row of fabric across her torso: [x left, x right, y]
    as canvas fractions - where a print can sit on her"""
    best, pick = -1.0, None
    for yy in range(int(top + h * 0.3), int(top + h * 0.62), 2):
        row = g[yy].astype(np.int8)
        if not row.any():
            continue
        d = np.diff(np.concatenate([[0], row, [0]]))
        st, en = np.where(d == 1)[0], np.where(d == -1)[0]
        j = int(np.argmax(en - st))
        run = en[j] - st[j]
        # prefer the waist (0.42 of her height) a little
        score = run * (1 - 0.8 * abs((yy - top) / h - 0.42))
        if score > best:
            best, pick = score, (st[j], en[j], yy)
    if pick is None:
        return None
    a, b, yy = pick
    return [round((a + x0) / W, 4), round((b + x0) / W, 4), round((yy + y0) / H, 4)]


def outline(g, x0, y0):
    """garment outline as a closed path, viewBox 1600x900"""
    cs, _ = cv2.findContours(g.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in sorted(cs, key=cv2.contourArea, reverse=True)[:2]:
        if cv2.contourArea(c) < 4000:
            continue
        c = c[:, 0, :].astype(np.float32)
        # smooth the pixel stairs, then thin out the points
        k = 7
        pad = np.concatenate([c[-k:], c, c[:k]])
        ker = np.ones(2 * k + 1, np.float32) / (2 * k + 1)
        sx = np.convolve(pad[:, 0], ker, "same")[k:-k]
        sy = np.convolve(pad[:, 1], ker, "same")[k:-k]
        pts = np.stack([sx, sy], 1)[::4]
        pts = [((p[0] + x0) / W * 1600, (p[1] + y0) / H * 900) for p in pts]
        out.append("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z")
    return " ".join(out)


def main(d):
    path = f"{ROOT}/public/hero/lab/{d}"
    meta = json.load(open(f"{path}/meta6.json"))
    qa = []
    for k, m in enumerate(meta["models"]):
        im = np.asarray(Image.open(f"{path}/cut{k}.webp").convert("RGBA")).astype(np.float32)
        F, a = im[..., :3], im[..., 3] / 255
        x, y, w, h = m["r"]["cut"]
        X0, Y0 = int(round(x * W)), int(round(y * H))
        top = m["head"] * H - Y0
        hh = (m["feet"] - m["head"]) * H
        g, gsoft, Lg = garment(F, a, top, hh)
        dark = Lg < 30
        Fl = lit(F, gsoft, Lg)
        rgb8 = np.clip(Fl + 0.5, 0, 255).astype(np.uint8)
        a8 = (np.clip(gsoft, 0, 1) * 255 + 0.5).astype(np.uint8)
        Image.fromarray(np.dstack([rgb8, a8]), "RGBA").save(f"{path}/fab{k}.webp", quality=92, method=6, exact=True)
        m["gpath"] = outline(g, X0, Y0)
        m["gdark"] = bool(dark)
        cover = float(g.sum() / max((a > 0.6).sum(), 1))
        # a print the colour clusters can't hold (leopard): no fabric effects on her
        m["fab"] = cover > 0.4 and d.partition("__")[0] not in NO_FAB
        m["band"] = band(g, top, hh, X0, Y0)
        print(d, k, "garment %.0f%% of her" % (cover * 100), "L %.0f" % Lg, "dark" if dark else "", flush=True)
        # QA: mask in red over her | her lit
        ov = F.copy()
        ov[g] = ov[g] * 0.45 + np.array([255, 30, 30]) * 0.55
        comp = lambda c: c * a[..., None] + 235 * (1 - a[..., None])
        tile = np.hstack([comp(ov), comp(Fl * gsoft[..., None] + F * (1 - gsoft[..., None]))])
        s = 520 / tile.shape[0]
        qa.append(cv2.resize(np.clip(tile, 0, 255).astype(np.uint8), (int(tile.shape[1] * s), 520), interpolation=cv2.INTER_AREA))
    json.dump(meta, open(f"{path}/meta6.json", "w"))
    Image.fromarray(np.hstack(qa)).save(f"{ROOT}/scratch/audit_shots/fab_{d}.jpg", quality=86)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s.partition(":")[0])
