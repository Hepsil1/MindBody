import cv2
import numpy as np
import os

base = 'C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody'
artifact_dir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1'

W, H = 1600, 2844
horizon_y = 2280
wall_h = horizon_y
floor_h = H - horizon_y

target_model_h = 2150.0
target_sole_y = 2550
cx = 800

slides = [
    {
        "id": "slide1_trio_mobile",
        "name": "Spokusa Black Mobile",
        "photo": "public/pics1cloths/IMG_6201.JPG",
        "cutout": "scratch/cutouts/IMG_6201.png",
        "is_barefoot": False,
    },
    {
        "id": "slide2_cocoa_mobile",
        "name": "Chinchilla Cocoa Mobile",
        "photo": "public/pics2cloths/IMG_5221.JPG",
        "cutout": "scratch/cutouts/IMG_5221.png",
        "is_barefoot": False,
    },
    {
        "id": "slide3_harmony_mobile",
        "name": "Wings Teal Mobile",
        "photo": "public/generalpics/333_131123.jpg",
        "cutout": "scratch/cutouts/333_131123.png",
        "is_barefoot": True,
    },
    {
        "id": "slide4_black_mobile",
        "name": "Hypnose Black Mobile",
        "photo": "public/pics2cloths/IMG_4971.JPG",
        "cutout": "scratch/cutouts/IMG_4971.png",
        "is_barefoot": False,
    },
]

for s_cfg in slides:
    sid = s_cfg['id']
    print(f"Building mobile master {s_cfg['name']} ({sid})...")
    img = cv2.imread(f"{base}/{s_cfg['photo']}")
    c = cv2.imread(f"{base}/{s_cfg['cutout']}", cv2.IMREAD_UNCHANGED)
    
    h_orig, w_orig = img.shape[:2]
    c = cv2.resize(c, (w_orig, h_orig), interpolation=cv2.INTER_AREA)
    a = c[:, :, 3].astype(np.float32) / 255.0
    
    ys = np.where(a.max(1) > 0.4)[0]
    t, b = ys.min(), ys.max()
    scale = target_model_h / float(b - t)
    nw, nh = int(w_orig * scale), int(h_orig * scale)
    
    # 1. Studio Wall Background
    wall_sample = img[int(h_orig*0.25):int(h_orig*0.45), int(w_orig*0.05):int(w_orig*0.2)].astype(np.float32).mean(axis=(0,1))
    yy_w, xx_w = np.mgrid[0:wall_h, 0:W].astype(np.float32)
    r_sq = ((xx_w - W * 0.5) / (W * 0.45)) ** 2 + ((yy_w - wall_h * 0.40) / (wall_h * 0.65)) ** 2
    softbox = np.exp(-0.30 * r_sq)[..., None]
    v_grad = (1.0 - 0.05 * (yy_w / wall_h))[..., None]
    wall = (wall_sample[None, None, :] * 0.95 + 16.0 * softbox) * v_grad
    
    # 2. Studio Floor
    floor_sample = img[int(h_orig*0.80):int(h_orig*0.95), int(w_orig*0.1):int(w_orig*0.35)].astype(np.float32).mean(axis=(0,1))
    floor_base = floor_sample * 0.92
    yy_f, xx_f = np.mgrid[0:floor_h, 0:W].astype(np.float32)
    horiz_bounce = np.exp(-((yy_f) / (floor_h * 0.40)) ** 1.5)[..., None]
    center_sheen = np.exp(-((xx_f - W * 0.5) / (W * 0.45)) ** 2)[..., None]
    persp = (1.0 - 0.04 * (yy_f / floor_h))[..., None]
    floor = floor_base[None, None, :] * persp + 22.0 * horiz_bounce * center_sheen
    
    master_bg = np.vstack([wall, floor])
    seam = master_bg[horizon_y - 35 : horizon_y + 35, :]
    master_bg[horizon_y - 35 : horizon_y + 35, :] = cv2.GaussianBlur(seam, (1, 61), 18)
    
    canvas = master_bg.copy()
    
    # Model placement
    s = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
    a_scaled = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA)
    a_clean = cv2.GaussianBlur(a_scaled, (0, 0), 0.5)
    a_clean = np.clip((a_clean - 0.04) / 0.92, 0, 1)
    
    ys_clean = np.where(a_clean.max(1) > 0.4)[0]
    xs_clean = np.where(a_clean.max(0) > 0.4)[0]
    sole_y = ys_clean.max()
    fig_cx = (xs_clean.min() + xs_clean.max()) // 2
    
    y_off = target_sole_y - sole_y
    x_off = cx - fig_cx
    
    dy1, dy2 = max(0, y_off), min(H, y_off + nh)
    dx1, dx2 = max(0, x_off), min(W, x_off + nw)
    sy1, sy2 = dy1 - y_off, (dy1 - y_off) + (dy2 - dy1)
    sx1, sx2 = dx1 - x_off, (dx1 - x_off) + (dx2 - dx1)
    
    sub_rgb = s[sy1:sy2, sx1:sx2].astype(np.float32)
    sub_a = a_clean[sy1:sy2, sx1:sx2, None]
    sole_canvas_y = sole_y + y_off
    
    # Contact shadow
    sh_mask = np.zeros((H, W), dtype=np.float32)
    footprint = a_clean[sole_y - 15:sole_y + 1, :].max(axis=0)
    fx = np.where(footprint > 0.3)[0]
    if len(fx):
        x0, x1_ = fx.min() + x_off, fx.max() + x_off
        sh_depth = 8 if s_cfg['is_barefoot'] else 12
        cv2.ellipse(sh_mask, ((x0 + x1_) // 2, min(H - 1, sole_canvas_y + 4)),
                    ((x1_ - x0) // 2 + 25, sh_depth), 0, 0, 360, 0.70, -1)
    sh_mask = cv2.GaussianBlur(sh_mask, (0, 0), 14)
    canvas *= (1.0 - sh_mask[..., None] * 0.60)
    
    # Floor Reflection
    refl_depth = int(0.18 * nh)
    refl_slice = s[sole_y - refl_depth:sole_y + 1, :][::-1]
    refl_alpha = a_clean[sole_y - refl_depth:sole_y + 1, :][::-1]
    rn = refl_slice.shape[0]
    refl_str = 0.42 if s_cfg['is_barefoot'] else 0.35
    fade = ((1.0 - np.linspace(0, 1, rn) ** 1.3) * refl_str)[:, None, None]
    
    ry1 = sole_canvas_y + 1
    ry2 = min(H, ry1 + rn)
    rk = ry2 - ry1
    rx1, rx2 = max(0, x_off), min(W, x_off + nw)
    rsx1, rsx2 = rx1 - x_off, rx2 - x_off
    
    refl_rgb_sub = refl_slice[:rk, rsx1:rsx2].astype(np.float32)
    refl_a_sub = (refl_alpha[:rk, rsx1:rsx2, None] * fade[:rk])
    refl_a_sub = cv2.GaussianBlur(refl_a_sub, (0, 0), 1.5)[..., None]
    canvas[ry1:ry2, rx1:rx2] = canvas[ry1:ry2, rx1:rx2] * (1.0 - refl_a_sub) + refl_rgb_sub * refl_a_sub
    
    # Composite Model
    canvas[dy1:dy2, dx1:dx2] = canvas[dy1:dy2, dx1:dx2] * (1.0 - sub_a) + sub_rgb * sub_a
    
    res = np.clip(canvas, 0, 255).astype(np.uint8)
    
    # Save master
    out_master_png = f"{artifact_dir}/scratch/{sid}_master.png"
    cv2.imwrite(out_master_png, res)
    
    # Save preview
    prev = cv2.resize(res, (400, int(400 * H / W)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f"{artifact_dir}/scratch/{sid}_refined_prev.png", prev)
    print(f"  -> Generated {out_master_png} and preview")

print("All mobile refined masters generated successfully!")
