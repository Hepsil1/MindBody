"""Hero-lab v6 - extra outline paths for HeroLabLive, from the cut-outs already
built by build_hero_lab_v6.py (fast: no matting is redone).

  python scratch/build_hero_lab_v6_paths.py s1_duo u21_palette ...

Adds to each model in public/hero/lab/<sid>/meta6.json:
  paths   outlines at growing distance from her body (viewBox 1600x900):
          [0] ~14 px (the contour), [1] ~30, [2] ~50, [3] ~74
  ground  wall colour round her, darkened - the colour her shadow takes
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_hero_lab_v5 import contour_path
import build_hero_lab_v2 as V

ROOT = V.ROOT
W, H = 2560, 1440


def main(sid):
    d = f"{ROOT}/public/hero/lab/{sid}"
    meta = json.load(open(f"{d}/meta6.json"))
    plate = np.asarray(Image.open(f"{d}/plate.webp").convert("RGB")).astype(np.float32)
    PH, PW = plate.shape[:2]
    for k, m in enumerate(meta["models"]):
        cut = np.asarray(Image.open(f"{d}/cut{k}.webp").convert("RGBA")).astype(np.float32) / 255
        x, y, w, h = m["r"]["cut"]
        a = np.zeros((H, W), np.float32)
        X0, Y0 = int(round(x * W)), int(round(y * H))
        ch, cw = cut.shape[:2]
        a[Y0:Y0 + ch, X0:X0 + cw] = cut[..., 3][: H - Y0, : W - X0]
        feet = m["feet"] * H
        m["paths"] = [contour_path(a, feet, W, H, grow=g) for g in (12.0, 26.0, 44.0, 66.0)]
        # the wall round her, a good way above the floor
        x0, x1 = int(m["x0"] * PW), int(m["x1"] * PW)
        y0, y1 = int(m["head"] * PH), int((m["head"] + (m["feet"] - m["head"]) * 0.6) * PH)
        pad = int(0.05 * PW)
        wall = np.concatenate([plate[y0:y1, max(0, x0 - pad):x0].reshape(-1, 3), plate[y0:y1, x1:x1 + pad].reshape(-1, 3)])
        c = np.median(wall, axis=0)
        # a shadow keeps the wall's hue, at about a third of its light
        m["ground"] = "#%02x%02x%02x" % tuple(int(v) for v in np.clip(c * 0.36, 0, 255))
        print(sid, k, m["ground"], flush=True)
    json.dump(meta, open(f"{d}/meta6.json", "w"))


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s.partition(":")[0])
