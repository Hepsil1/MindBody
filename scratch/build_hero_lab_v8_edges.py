"""Hero-lab v8 - clean the edges of every cut-out (public/hero/lab/*/cut<k>.webp).

  python scratch/build_hero_lab_v8_edges.py            all slides
  python scratch/build_hero_lab_v8_edges.py s1_duo__c  one folder

What showed the cut:
  * a light fringe along arms, shoulders and legs - the pale wall left in the
    edge pixels. Invisible on the photo's own wall, but the moment anything
    darker sits behind her (shadow, spotlight, colour wall) it lights up.
  * stair-stepped alpha on smooth body contours.
  * tiny grey specks and half-transparent scraps round the feet.

Fix, per cut (same size and rect, so fab/sil stay aligned):
  1. alpha: a light anti-alias + a gentle choke on the body; the hair (top of
     her) keeps its soft matte, the feet get a firmer choke.
  2. colour: edge pixels take the colour of her interior next to them
     (normalised blur from the solid part outward) - no wall colour left.
  3. specks: alpha islands far from her body are dropped.

Originals are kept in scratch/cut_orig/<folder>/ and always used as the source,
so running this again is safe. QA sheet: scratch/audit_shots/v8_<folder>_<k>.png
(before | after, on a dark backdrop).
"""
import os, sys, glob, shutil
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAB = f"{ROOT}/public/hero/lab"
ORIG = f"{ROOT}/scratch/cut_orig"


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def gblur(x, s):
    return cv2.GaussianBlur(x, (0, 0), s, borderType=cv2.BORDER_REPLICATE)


def clean(rgba):
    F = rgba[..., :3].astype(np.float32)
    a = rgba[..., 3].astype(np.float32) / 255
    H, W = a.shape
    rows = np.where((a > 0.5).any(axis=1))[0]
    top, bot = rows.min(), rows.max()
    hh = bot - top
    yy = np.arange(H, dtype=np.float32)[:, None] * np.ones((1, W), np.float32)
    # 1 in the hair (top ~20 % of her), 0 below the shoulders
    hair = 1 - smoothstep(top + 0.17 * hh, top + 0.24 * hh, yy)
    feet = smoothstep(top + 0.93 * hh, top + 0.97 * hh, yy)

    # ---- 1. alpha ----
    a_s = gblur(a, 0.65)
    body_a = smoothstep(0.1, 0.92, a_s)
    feet_a = smoothstep(0.28, 0.95, a_s)
    a_body = body_a * (1 - feet) + feet_a * feet
    # hair: keep the matte, only knock off the faintest haze
    a_hair = a * smoothstep(0.03, 0.12, a)
    a_new = a_hair * hair + a_body * (1 - hair)

    # ---- 3. specks: keep only what is connected to her body ----
    solid = (a_new > 0.5).astype(np.uint8)
    n, lab_, st, _ = cv2.connectedComponentsWithStats(solid)
    if n > 1:
        big = 1 + int(np.argmax(st[1:, 4]))
        keep = (lab_ == big).astype(np.uint8)
        # small bits of her (fingers, hair curls) touching the body zone stay
        for i in range(1, n):
            if i != big and st[i, 4] > 400:
                keep[lab_ == i] = 1
        near = cv2.dilate(keep, np.ones((25, 25), np.uint8)) > 0
        a_new = np.where(near, a_new, 0)

    # ---- 2. colour: pull her interior colour out into the edge ----
    w = (a > 0.96).astype(np.float32)
    num = np.zeros_like(F)
    den = np.zeros_like(a)
    for s in (1.2, 2.5, 5, 10, 20):
        wb = gblur(w, s)
        fb = gblur(F * w[..., None], s)
        take = (den < 0.02) & (wb > 0.02)
        num[take] = fb[take] / wb[take, None]
        den[take] = 1
    Fint = np.where(den[..., None] > 0, num, F)
    # body: edge pixels go most of the way to her own colour; hair a little less
    t_body = smoothstep(0.55, 0.98, a)
    t_hair = smoothstep(0.2, 0.8, a)
    t = t_hair * hair + t_body * (1 - hair)
    F_new = F * t[..., None] + Fint * (1 - t[..., None])

    out = np.dstack([np.clip(F_new + 0.5, 0, 255), np.clip(a_new * 255 + 0.5, 0, 255)]).astype(np.uint8)
    return out


def sheet(before, after, path):
    bg = np.array([62, 54, 72], np.float32)

    def comp(x):
        a = x[..., 3:4].astype(np.float32) / 255
        return (x[..., :3] * a + bg * (1 - a)).astype(np.uint8)

    Image.fromarray(np.hstack([comp(before), comp(after)])).save(path)


def run(folder):
    src_dir = f"{LAB}/{folder}"
    bak = f"{ORIG}/{folder}"
    os.makedirs(bak, exist_ok=True)
    for p in sorted(glob.glob(f"{src_dir}/cut[0-9]*.webp")):
        name = os.path.basename(p)
        if not os.path.exists(f"{bak}/{name}"):
            shutil.copy2(p, f"{bak}/{name}")
        before = np.asarray(Image.open(f"{bak}/{name}").convert("RGBA"))
        after = clean(before)
        Image.fromarray(after, "RGBA").save(p, quality=93, method=6, exact=True)
        sheet(before, after, f"{ROOT}/scratch/audit_shots/v8_{folder}_{name[:-5]}.png")
        print(folder, name, "ok", flush=True)


if __name__ == "__main__":
    folders = sys.argv[1:] or sorted(os.path.basename(d) for d in glob.glob(f"{LAB}/*") if glob.glob(f"{d}/cut0.webp"))
    for f in folders:
        run(f)
