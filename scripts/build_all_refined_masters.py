import cv2
import numpy as np
import os
import subprocess

base = 'C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody'
artifact_dir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1'

W, H = 2560, 1440
horizon_y = 1140 # Low horizon at ankles, keeping hips/thighs clean against wall!
wall_h = horizon_y
floor_h = H - horizon_y

target_model_h = 1180.0
target_sole_y = 1380

# Duo centers: natural editorial pairing (37% and 63%)
cx1 = 940
cx2 = 1620

slides = [
    {
        "id": "slide1_trio",
        "name": "Spokusa Black",
        "p1": "public/pics1cloths/IMG_6201.JPG",
        "p2": "public/pics1cloths/IMG_6203.JPG",
        "c1": "scratch/cutouts/IMG_6201.png",
        "c2": "scratch/test_IMG_6203_cutout.png",
        "is_barefoot": False,
    },
    {
        "id": "slide2_cocoa",
        "name": "Chinchilla Cocoa",
        "p1": "public/pics2cloths/IMG_5221.JPG",
        "p2": "public/pics2cloths/IMG_5228.JPG",
        "c1": "scratch/cutouts/IMG_5221.png",
        "c2": "scratch/cutouts/IMG_5228.png",
        "is_barefoot": False,
    },
    {
        "id": "slide3_harmony",
        "name": "Wings Teal & Plum",
        "p1": "public/generalpics/333_131123.jpg",
        "p2": "public/generalpics/595_131123.jpg",
        "c1": "scratch/cutouts/333_131123.png",
        "c2": "scratch/cutouts/595_131123.png",
        "is_barefoot": True,
    },
    {
        "id": "slide4_black",
        "name": "Hypnose Black",
        "p1": "public/pics2cloths/IMG_4971.JPG",
        "p2": "public/pics2cloths/IMG_4976.JPG",
        "c1": "scratch/cutouts/IMG_4971.png",
        "c2": "scratch/cutouts/IMG_4976.png",
        "is_barefoot": False,
    },
]

def add_ui(img):
    out = img.copy()
    bx1, bx2 = W//2 - 170, W//2 + 170
    by1, by2 = 1220, 1285
    btn_col = (104, 90, 42)
    cv2.rectangle(out, (bx1+25, by1), (bx2-25, by2), btn_col, -1)
    cv2.rectangle(out, (bx1, by1+25), (bx2, by2-25), btn_col, -1)
    cv2.circle(out, (bx1+25, by1+25), 25, btn_col, -1)
    cv2.circle(out, (bx2-25, by1+25), 25, btn_col, -1)
    cv2.circle(out, (bx1+25, by2-25), 25, btn_col, -1)
    cv2.circle(out, (bx2-25, by2-25), 25, btn_col, -1)
    cv2.putText(out, "PEREHLIANUTY KOLEKTSIIU", (W//2 - 145, by1 + 42), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(out, "MIND BODY", (70, 75), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2, cv2.LINE_AA)
    return out

for s_cfg in slides:
    sid = s_cfg['id']
    print(f"Rendering {s_cfg['name']} ({sid})...")
    img1 = cv2.imread(f"{base}/{s_cfg['p1']}")
    img2 = cv2.imread(f"{base}/{s_cfg['p2']}")
    c1 = cv2.imread(f"{base}/{s_cfg['c1']}", cv2.IMREAD_UNCHANGED)
    c2 = cv2.imread(f"{base}/{s_cfg['c2']}", cv2.IMREAD_UNCHANGED)
    
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    
    c1 = cv2.resize(c1, (w1, h1), interpolation=cv2.INTER_AREA)
    c2 = cv2.resize(c2, (w2, h2), interpolation=cv2.INTER_AREA)
    
    a1 = c1[:, :, 3].astype(np.float32) / 255.0
    a2 = c2[:, :, 3].astype(np.float32) / 255.0
    
    ys1 = np.where(a1.max(1) > 0.4)[0]
    ys2 = np.where(a2.max(1) > 0.4)[0]
    t1, b1 = ys1.min(), ys1.max()
    t2, b2 = ys2.min(), ys2.max()
    
    scale = target_model_h / (((b1 - t1) + (b2 - t2)) / 2.0)
    nw1, nh1 = int(w1 * scale), int(h1 * scale)
    nw2, nh2 = int(w2 * scale), int(h2 * scale)
    
    # 1. Studio Wall
    wall_sample = img1[int(h1*0.25):int(h1*0.45), int(w1*0.05):int(w1*0.2)].astype(np.float32).mean(axis=(0,1))
    wall = np.zeros((wall_h, W, 3), dtype=np.float32)
    yy_w, xx_w = np.mgrid[0:wall_h, 0:W].astype(np.float32)
    r_sq = ((xx_w - W * 0.5) / (W * 0.45)) ** 2 + ((yy_w - wall_h * 0.45) / (wall_h * 0.65)) ** 2
    softbox = np.exp(-0.30 * r_sq)[..., None]
    v_grad = (1.0 - 0.05 * (yy_w / wall_h))[..., None]
    wall = (wall_sample[None, None, :] * 0.95 + 16.0 * softbox) * v_grad
    
    # 2. Studio Floor
    floor = np.zeros((floor_h, W, 3), dtype=np.float32)
    yy_f, xx_f = np.mgrid[0:floor_h, 0:W].astype(np.float32)
    floor_sample = img1[int(h1*0.80):int(h1*0.95), 100:600].astype(np.float32).mean(axis=(0,1))
    floor_base = floor_sample * 0.92
    
    horiz_bounce = np.exp(-((yy_f) / (floor_h * 0.40)) ** 1.5)[..., None]
    center_sheen = np.exp(-((xx_f - W * 0.5) / (W * 0.45)) ** 2)[..., None]
    persp = (1.0 - 0.04 * (yy_f / floor_h))[..., None]
    floor = floor_base[None, None, :] * persp + 22.0 * horiz_bounce * center_sheen
    
    master_bg = np.vstack([wall, floor])
    seam = master_bg[horizon_y - 25 : horizon_y + 25, :]
    master_bg[horizon_y - 25 : horizon_y + 25, :] = cv2.GaussianBlur(seam, (1, 41), 12)
    
    canvas = master_bg.copy()
    
    def paste_model(dst, img_raw, a_raw, nw, nh, target_cx, is_barefoot):
        s = cv2.resize(img_raw, (nw, nh), interpolation=cv2.INTER_AREA)
        a = cv2.resize(a_raw, (nw, nh), interpolation=cv2.INTER_AREA)
        a_clean = cv2.GaussianBlur(a, (0, 0), 0.5)
        a_clean = np.clip((a_clean - 0.04) / 0.92, 0, 1)
        
        ys = np.where(a_clean.max(1) > 0.4)[0]
        xs = np.where(a_clean.max(0) > 0.4)[0]
        sole_y = ys.max()
        fig_cx = (xs.min() + xs.max()) // 2
        
        y_off = target_sole_y - sole_y
        x_off = target_cx - fig_cx
        
        dy1, dy2 = max(0, y_off), min(H, y_off + nh)
        dx1, dx2 = max(0, x_off), min(W, x_off + nw)
        sy1, sy2 = dy1 - y_off, (dy1 - y_off) + (dy2 - dy1)
        sx1, sx2 = dx1 - x_off, (dx1 - x_off) + (dx2 - dx1)
        
        sub_rgb = s[sy1:sy2, sx1:sx2].astype(np.float32)
        sub_a = a_clean[sy1:sy2, sx1:sx2, None]
        sole_canvas_y = sole_y + y_off
        
        # Ground Contact Shadow
        sh_mask = np.zeros((H, W), dtype=np.float32)
        footprint = a_clean[sole_y - 12:sole_y + 1, :].max(axis=0)
        fx = np.where(footprint > 0.3)[0]
        if len(fx):
            x0, x1_ = fx.min() + x_off, fx.max() + x_off
            sh_depth = 6 if is_barefoot else 8
            cv2.ellipse(sh_mask, ((x0 + x1_) // 2, min(H - 1, sole_canvas_y + 3)),
                        ((x1_ - x0) // 2 + 18, sh_depth), 0, 0, 360, 0.70, -1)
        sh_mask = cv2.GaussianBlur(sh_mask, (0, 0), 10)
        dst *= (1.0 - sh_mask[..., None] * 0.60)
        
        # Ground Reflection
        refl_depth = int(0.18 * nh)
        refl_slice = s[sole_y - refl_depth:sole_y + 1, :][::-1]
        refl_alpha = a_clean[sole_y - refl_depth:sole_y + 1, :][::-1]
        rn = refl_slice.shape[0]
        refl_str = 0.42 if is_barefoot else 0.35
        fade = ((1.0 - np.linspace(0, 1, rn) ** 1.3) * refl_str)[:, None, None]
        
        ry1 = sole_canvas_y + 1
        ry2 = min(H, ry1 + rn)
        rk = ry2 - ry1
        rx1, rx2 = max(0, x_off), min(W, x_off + nw)
        rsx1, rsx2 = rx1 - x_off, rx2 - x_off
        
        refl_rgb_sub = refl_slice[:rk, rsx1:rsx2].astype(np.float32)
        refl_a_sub = (refl_alpha[:rk, rsx1:rsx2, None] * fade[:rk])
        refl_a_sub = cv2.GaussianBlur(refl_a_sub, (0, 0), 1.2)[..., None]
        dst[ry1:ry2, rx1:rx2] = dst[ry1:ry2, rx1:rx2] * (1.0 - refl_a_sub) + refl_rgb_sub * refl_a_sub
        
        # Light wrap
        eroded = cv2.erode(sub_a[:, :, 0], np.ones((3, 3), np.uint8), iterations=2)[..., None]
        rim = np.clip(sub_a - eroded, 0, 1)
        wall_col = np.array([215, 210, 214], dtype=np.float32)
        sub_rgb = sub_rgb * (1.0 - 0.08 * rim) + wall_col * (0.08 * rim)
        
        dst[dy1:dy2, dx1:dx2] = dst[dy1:dy2, dx1:dx2] * (1.0 - sub_a) + sub_rgb * sub_a

    paste_model(canvas, img1, a1, nw1, nh1, cx1, s_cfg['is_barefoot'])
    paste_model(canvas, img2, a2, nw2, nh2, cx2, s_cfg['is_barefoot'])
    
    final_img = np.clip(canvas, 0, 255).astype(np.uint8)
    
    master_path = f"{artifact_dir}/master_refined_{sid}.jpg"
    mockup_path = f"{artifact_dir}/mockup_refined_{sid}.jpg"
    cv2.imwrite(master_path, final_img, [cv2.IMWRITE_JPEG_QUALITY, 96])
    cv2.imwrite(mockup_path, cv2.resize(add_ui(final_img), (1440, 810)))
    print(f"✓ Saved master and mockup for {sid}")

print("All refined masters generated!")
