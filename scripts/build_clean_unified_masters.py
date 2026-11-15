import cv2
import numpy as np
import os

W, H = 2560, 1440
horizon_canvas = 980
target_sole_y = 1390
target_h = 1180

def create_unified_studio_plate():
    """
    Creates ONE single, continuous 2560x1440 luxury studio cyclorama background plate
    from authentic studio photography (IMG_5221.JPG).
    Uses clean left flank (x=50..850) which strictly avoids the studio wooden podium (at x>=914).
    """
    raw = cv2.imread('public/pics2cloths/IMG_5221.JPG')
    if raw is None:
        raise ValueError("Cannot read public/pics2cloths/IMG_5221.JPG")

    flank = raw[:, 50:850].astype(np.float32)
    horizon_raw = 4150

    wall_raw = flank[:horizon_raw, :]
    floor_raw = flank[horizon_raw:, :]

    wall_canvas = cv2.resize(wall_raw, (W, horizon_canvas), interpolation=cv2.INTER_LINEAR)
    yy, xx = np.mgrid[0:horizon_canvas, 0:W].astype(np.float32)
    dist_norm = ((xx - W * 0.5) / (W * 0.6)) ** 2 + ((yy - horizon_canvas * 0.35) / (horizon_canvas * 0.65)) ** 2
    falloff = np.clip(1.0 - 0.05 * dist_norm, 0.90, 1.0)[..., None]
    wall_canvas = wall_canvas * falloff

    floor_canvas = cv2.resize(floor_raw, (W, H - horizon_canvas), interpolation=cv2.INTER_LINEAR)
    unified_bg = np.vstack([wall_canvas, floor_canvas])

    seam_y = horizon_canvas
    blur_strip = cv2.GaussianBlur(unified_bg[seam_y-10:seam_y+10, :], (1, 15), 5)
    unified_bg[seam_y-10:seam_y+10, :] = blur_strip

    return unified_bg

def prepare_grounded_model(raw_path, cut_path, is_barefoot=False):
    """
    Integrates the model with authentic floor contact:
    - Above floor line: clean cutout from background wall
    - At floor contact: preserves genuine micro-shadows & reflections from raw photo
    """
    raw = cv2.imread(raw_path)
    cut = cv2.imread(cut_path, cv2.IMREAD_UNCHANGED)
    if raw is None or cut is None:
        raise ValueError(f"Cannot read {raw_path} or {cut_path}")

    h_c, w_c = cut.shape[:2]
    raw_aligned = cv2.resize(raw, (w_c, h_c)).astype(np.float32)
    alpha = (cut[:, :, 3].astype(np.float32) / 255.0)

    body_rows = np.where(alpha > 0.3)[0]
    soles_y = body_rows.max()

    if is_barefoot:
        # Barefoot on shiny foil: preserve 65px of real studio floor reflection
        floor_depth = 65
        for y in range(soles_y - 15, min(h_c, soles_y + floor_depth)):
            dist_down = max(0, y - soles_y)
            fade = (1.0 - dist_down / float(floor_depth)) ** 1.3
            alpha[y, :] = np.maximum(alpha[y, :], alpha[soles_y - 20, :] * fade)
    else:
        # Boots on foil: preserve 32px of genuine tread contact & shadow
        floor_depth = 32
        footprint = np.max(alpha[soles_y-12:soles_y+1, :], axis=0)
        for y in range(soles_y, min(h_c, soles_y + floor_depth)):
            fade = (1.0 - (y - soles_y) / float(floor_depth)) ** 1.5
            alpha[y, :] = np.maximum(alpha[y, :], footprint * fade)

    rows = np.where(alpha > 0.05)[0]
    cols = np.where(alpha > 0.05)[1]
    y1, y2 = rows.min(), rows.max()
    x1, x2 = cols.min(), cols.max()

    tight_rgb = raw_aligned[y1:y2+1, x1:x2+1]
    tight_m = alpha[y1:y2+1, x1:x2+1, None]
    return tight_rgb, tight_m

def place_grounded(dst, rgb_src, mask_src, cx):
    scale = target_h / float(rgb_src.shape[0])
    nw = int(rgb_src.shape[1] * scale)
    nh = target_h

    res_rgb = cv2.resize(rgb_src, (nw, nh), interpolation=cv2.INTER_AREA)
    res_m = cv2.resize(mask_src, (nw, nh), interpolation=cv2.INTER_LINEAR)[..., None]

    y_off = target_sole_y - nh + 1
    x_off = cx - nw // 2

    my1, my2 = max(0, y_off), min(H, y_off + nh)
    mx1, mx2 = max(0, x_off), min(W, x_off + nw)
    sy1, sy2 = my1 - y_off, (my1 - y_off) + (my2 - my1)
    sx1, sx2 = mx1 - x_off, (mx1 - x_off) + (mx2 - mx1)

    sub_rgb = res_rgb[sy1:sy2, sx1:sx2].copy()
    sub_a = res_m[sy1:sy2, sx1:sx2]

    # Subtle ambient light bleed on upper silhouette rim
    eroded = cv2.erode(sub_a[:, :, 0], np.ones((3, 3), np.uint8), iterations=2)[..., None]
    rim = np.clip(sub_a - eroded, 0, 1)
    wall_col = np.array([210, 204, 208], dtype=np.float32)
    sub_rgb = sub_rgb * (1.0 - 0.08 * rim) + wall_col * (0.08 * rim)

    dst[my1:my2, mx1:mx2] = dst[my1:my2, mx1:mx2] * (1.0 - sub_a) + sub_rgb * sub_a

slides_config = [
    # 1. Spokusa Black (Slide 1)
    {
        "id": "slide1_trio",
        "models": [
            {"raw": "public/pics1cloths/IMG_6201.JPG", "cut": "scratch/cutouts/IMG_6201.png", "cx": 760, "barefoot": False},
            {"raw": "public/pics1cloths/IMG_6203.JPG", "cut": "scratch/test_IMG_6203_cutout.png", "cx": 1800, "barefoot": False},
        ],
    },
    # 2. Chinchilla Cocoa (Slide 2)
    {
        "id": "slide2_cocoa",
        "models": [
            {"raw": "public/pics2cloths/IMG_5221.JPG", "cut": "scratch/cutouts/IMG_5221.png", "cx": 760, "barefoot": False},
            {"raw": "public/pics2cloths/IMG_5228.JPG", "cut": "scratch/cutouts/IMG_5228.png", "cx": 1800, "barefoot": False},
        ],
    },
    # 3. Wings Nordic Teal & Plum (Slide 3)
    {
        "id": "slide3_harmony",
        "models": [
            {"raw": "public/generalpics/333_131123.jpg", "cut": "scratch/cutouts/333_131123.png", "cx": 760, "barefoot": True},
            {"raw": "public/generalpics/595_131123.jpg", "cut": "scratch/cutouts/595_131123.png", "cx": 1800, "barefoot": True},
        ],
    },
    # 4. Hypnose Black (Slide 4)
    {
        "id": "slide4_black",
        "models": [
            {"raw": "public/pics2cloths/IMG_4971.JPG", "cut": "scratch/cutouts/IMG_4971.png", "cx": 760, "barefoot": False},
            {"raw": "public/pics2cloths/IMG_4976.JPG", "cut": "scratch/cutouts/IMG_4976.png", "cx": 1800, "barefoot": False},
        ],
    },
]

if __name__ == "__main__":
    os.makedirs("public/hero/masters", exist_ok=True)
    unified_plate = create_unified_studio_plate()
    for cfg in slides_config:
        out_png = f"public/hero/masters/{cfg['id']}_master.png"
        print(f"Building grounded slide: {out_png}")
        canvas = unified_plate.copy()
        for m in cfg['models']:
            rgb, a = prepare_grounded_model(m['raw'], m['cut'], is_barefoot=m['barefoot'])
            place_grounded(canvas, rgb, a, m['cx'])
        res = np.clip(canvas, 0, 255).astype(np.uint8)
        cv2.imwrite(out_png, res)
        print(f"✓ Saved master: {out_png}")
    print("All 4 slides built on ONE UNIFIED BACKGROUND with zero floating!")
