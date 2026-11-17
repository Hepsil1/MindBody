"""Interaction masks for /hero-lab slides, aligned 1:1 with the v4 desktop master.

  python scratch/build_hero_lab_masks.py s1_duo

Writes public/hero/lab/<sid>/ :
  m<i>.png    model silhouette (white, alpha = matte, lightly feathered)
  inv<i>.png  everything except model i with a soft light falloff (spotlight dim)
  rim<i>.png  thin inner edge + soft outer halo (rim light)
  g<i>.png    garment only (model pixels whose Lab b* is not skin/hair yellow)
  hit.png     320x180 hit map: R = model 0, G = model 1 (dilated for easy taps)
  meta.json   per model: bbox centre / feet in canvas fractions
Models are ordered left → right.
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OW, OH = 1920, 1080


def rgba(alpha):
    a = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
    a = cv2.resize(a, (OW, OH), interpolation=cv2.INTER_AREA)
    out = np.dstack([np.full_like(a, 255)] * 3 + [a])
    return Image.fromarray(out, "RGBA")


def main(sid):
    matte = np.asarray(Image.open(f"{ROOT}/scratch/hero_v4_base/{sid}_matte.png")).astype(np.float32) / 255
    rgb = np.asarray(Image.open(f"{ROOT}/public/hero/masters/v4_{sid}.webp").convert("RGB"))
    H, W = matte.shape
    lab_img = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    bstar = lab_img[..., 2] - 128

    n, lab, st, _ = cv2.connectedComponentsWithStats((matte > 0.5).astype(np.uint8))
    comps = [i for i in range(1, n) if st[i, 4] > 20000]
    comps.sort(key=lambda i: st[i, 0])
    out_dir = f"{ROOT}/public/hero/lab/{sid}"
    os.makedirs(out_dir, exist_ok=True)
    hit = np.zeros((180, 320, 3), np.uint8)
    meta = []
    for k, ci in enumerate(comps):
        region = cv2.dilate((lab == ci).astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
        m = np.where(region, matte, 0).astype(np.float32)
        m = cv2.GaussianBlur(m, (0, 0), 1.2)
        rgba(m).save(f"{out_dir}/m{k}.png", optimize=True)

        halo = cv2.GaussianBlur(m, (0, 0), 70)
        halo = halo / max(halo.max(), 1e-6)
        rgba(1 - np.maximum(m, halo * 0.85)).save(f"{out_dir}/inv{k}.png", optimize=True)

        # back-light: the wall right behind the model glows (wide, soft), plus a
        # faint edge on the body — a tight outline reads as a sticker.
        hard = (m > 0.5).astype(np.uint8)
        inner = hard - cv2.erode(hard, np.ones((7, 7), np.uint8))
        inner = cv2.GaussianBlur(inner.astype(np.float32), (0, 0), 1.5)
        bloom = cv2.GaussianBlur(m, (0, 0), 55)
        bloom = np.clip(bloom / max(bloom.max(), 1e-6) * 1.15, 0, 1) * (1 - m)
        rgba(np.clip(bloom + inner * 0.35, 0, 1)).save(f"{out_dir}/rim{k}.png", optimize=True)

        g = ((m > 0.5) & (bstar < 8)).astype(np.uint8)
        g = cv2.morphologyEx(g, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        g = cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        gn, gl, gs, _ = cv2.connectedComponentsWithStats(g)
        keep = [j for j in range(1, gn) if gs[j, 4] > 3000]
        g = np.isin(gl, keep).astype(np.float32) * m
        rgba(cv2.GaussianBlur(g, (0, 0), 1.0)).save(f"{out_dir}/g{k}.png", optimize=True)

        small = cv2.resize(cv2.dilate(hard, np.ones((31, 31), np.uint8)) * 255, (320, 180), interpolation=cv2.INTER_AREA)
        hit[..., k] = np.maximum(hit[..., k], (small > 60) * 255)

        x, y, w, h = st[ci, :4]
        meta.append({"cx": round((x + w / 2) / W, 4), "top": round(y / H, 4), "feet": round((y + h) / H, 4), "w": round(w / W, 4)})
        print(sid, k, "bbox", x, y, w, h, flush=True)
    Image.fromarray(hit, "RGB").save(f"{out_dir}/hit.png", optimize=True)
    json.dump({"models": meta}, open(f"{out_dir}/meta.json", "w"), indent=1)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
