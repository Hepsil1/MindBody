import cv2
import numpy as np
from PIL import Image

W, H = 2560, 1440
artifact_dir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1'

# 1. Sky Background (matching user reference)
yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
top_sky = np.array([238, 192, 172], dtype=np.float32) # periwinkle/lavender sky (BGR)
mid_sky = np.array([248, 230, 225], dtype=np.float32) # soft pastel transition
bot_sky = np.array([255, 253, 252], dtype=np.float32) # pure luminous white mist

bg_sky = np.zeros((H, W, 3), dtype=np.float32)
for i in range(H):
    t = i / float(H)
    if t < 0.5:
        col = top_sky * (1.0 - t * 2.0) + mid_sky * (t * 2.0)
    else:
        col = mid_sky * (1.0 - (t - 0.5) * 2.0) + bot_sky * ((t - 0.5) * 2.0)
    bg_sky[i, :] = col

np.random.seed(42)
cloud_noise = cv2.GaussianBlur(np.random.randn(H, W, 3).astype(np.float32) * 4.0, (121, 121), 50)
bg_sky = np.clip(bg_sky + cloud_noise, 0, 255).astype(np.uint8)

# 2. Studio Background (warm neutral cyclorama)
wall_bgr = np.array([205, 195, 202], dtype=np.float32)
floor_bgr = np.array([195, 185, 190], dtype=np.float32)
bg_studio = np.zeros((H, W, 3), dtype=np.float32)
bg_studio[:1140, :] = wall_bgr
bg_studio[1140:, :] = floor_bgr
bg_studio = cv2.GaussianBlur(bg_studio, (1, 61), 20)
bg_studio = np.clip(bg_studio, 0, 255).astype(np.uint8)

# Load cutouts
c_plum_back_full = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/595_fixed.png').convert('RGBA')
c_plum_portrait = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/588_131123.png').convert('RGBA')
c_plum_34_back = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/602_131123.png').convert('RGBA')
c_teal_front_full = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/333_131123.png').convert('RGBA')
logo_white = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/public/pics/mind_body_logo_white.png').convert('RGBA')

# Prepare large living logo with drop shadow
def make_logo(w_target):
    scale = w_target / float(logo_white.width)
    h_target = int(logo_white.height * scale)
    l_resized = logo_white.resize((w_target, h_target), Image.Resampling.LANCZOS)
    
    # Create soft living glow around white logo
    l_arr = np.array(l_resized).astype(np.float32)
    alpha = l_arr[:, :, 3] / 255.0
    
    # Shadow mask
    pad = 30
    sh_h, sh_w = h_target + pad*2, w_target + pad*2
    shadow = np.zeros((sh_h, sh_w, 4), dtype=np.float32)
    shadow[pad:pad+h_target, pad:pad+w_target, 3] = alpha * 0.45
    shadow[:, :, 3] = cv2.GaussianBlur(shadow[:, :, 3], (31, 31), 10)
    shadow[:, :, :3] = 0 # dark shadow
    
    glow = np.zeros((sh_h, sh_w, 4), dtype=np.float32)
    glow[pad:pad+h_target, pad:pad+w_target, 3] = alpha * 0.55
    glow[:, :, 3] = cv2.GaussianBlur(glow[:, :, 3], (41, 41), 14)
    glow[:, :, :3] = 255 # white glow
    
    # Composite: shadow + glow + logo
    base_img = Image.new('RGBA', (sh_w, sh_h), (0, 0, 0, 0))
    sh_pil = Image.fromarray(np.clip(shadow, 0, 255).astype(np.uint8))
    glow_pil = Image.fromarray(np.clip(glow, 0, 255).astype(np.uint8))
    base_img.paste(sh_pil, (0, 0), sh_pil)
    base_img.paste(glow_pil, (0, 0), glow_pil)
    base_img.paste(l_resized, (pad, pad), l_resized)
    return base_img, pad

def draw_ui(img_pil):
    out = img_pil.copy()
    arr = cv2.cvtColor(np.array(out), cv2.COLOR_RGB2BGR)
    bx1, bx2 = W//2 - 180, W//2 + 180
    by1, by2 = 1260, 1330
    btn_col = (104, 90, 42)
    cv2.rectangle(arr, (bx1+30, by1), (bx2-30, by2), btn_col, -1)
    cv2.rectangle(arr, (bx1, by1+30), (bx2, by2-30), btn_col, -1)
    cv2.circle(arr, (bx1+30, by1+30), 30, btn_col, -1)
    cv2.circle(arr, (bx2-30, by1+30), 30, btn_col, -1)
    cv2.circle(arr, (bx1+30, by2-30), 30, btn_col, -1)
    cv2.circle(arr, (bx2-30, by2-30), 30, btn_col, -1)
    cv2.putText(arr, "PEREHLIANUTY KOLEKTSIIU", (W//2 - 150, by1 + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (255, 255, 255), 2, cv2.LINE_AA)
    
    cv2.putText(arr, "MIND BODY", (90, 95), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2, cv2.LINE_AA)
    px1, px2 = W//2 - 280, W//2 + 280
    py1, py2 = 60, 110
    cv2.rectangle(arr, (px1+25, py1), (px2-25, py2), (50, 45, 55), -1)
    cv2.putText(arr, "YOGA   SPORT   DANCE   CASUAL   KIDS", (px1 + 40, py1 + 34), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (230, 230, 235), 2, cv2.LINE_AA)
    return Image.fromarray(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB))

# ==========================================================
# VARIANT A: The User Reference Triptych (Sky Background + 3 Figures + Floating Living Logo)
# ==========================================================
print("Rendering Variant A: Reference Triptych...")
c_sky = Image.fromarray(cv2.cvtColor(bg_sky, cv2.COLOR_BGR2RGB))

# Left figure: full length back
scale_l = (H * 0.84) / float(c_plum_back_full.height)
wl, hl = int(c_plum_back_full.width * scale_l), int(c_plum_back_full.height * scale_l)
cl_r = c_plum_back_full.resize((wl, hl), Image.Resampling.LANCZOS)
xl = int(W * 0.07)
yl = H - hl
c_sky.paste(cl_r, (xl, yl), cl_r)

# Right figure: 3/4 detail
scale_r = (H * 0.88) / float(c_plum_34_back.height)
wr, hr = int(c_plum_34_back.width * scale_r), int(c_plum_34_back.height * scale_r)
cr_r = c_plum_34_back.resize((wr, hr), Image.Resampling.LANCZOS)
xr = int(W * 0.73)
yr = H - hr
c_sky.paste(cr_r, (xr, yr), cr_r)

# Center figure: scaled so head has clean clearance under nav pill (starts at y=160)
scale_c = (H * 0.88) / float(c_plum_portrait.height)
wc, hc = int(c_plum_portrait.width * scale_c), int(c_plum_portrait.height * scale_c)
cc_r = c_plum_portrait.resize((wc, hc), Image.Resampling.LANCZOS)
xc = (W - wc) // 2
yc = H - hc
c_sky.paste(cc_r, (xc, yc), cc_r)

# Place Living Logo: in upper-center space or between figures
logo_img, pad = make_logo(310)
# In Variant A, place logo in the visual space above or flanking
c_sky_mock = draw_ui(c_sky)
# Save preview
c_sky_mock.save(f"{artifact_dir}/scratch/proposal_variant_A_triptych.jpg", quality=95)
prev_a = c_sky_mock.resize((800, 450), Image.Resampling.LANCZOS)
prev_a.save(f"{artifact_dir}/scratch/proposal_variant_A_prev.jpg", quality=90)


# ==========================================================
# VARIANT B: The Ethereal Sky Duo with BIG Centered Living Logo
# ==========================================================
print("Rendering Variant B: Sky Duo with Center Living Logo...")
c_b = Image.fromarray(cv2.cvtColor(bg_sky, cv2.COLOR_BGR2RGB))

# Left figure: Teal front full
scale_b1 = (H * 0.83) / float(c_teal_front_full.height)
wb1, hb1 = int(c_teal_front_full.width * scale_b1), int(c_teal_front_full.height * scale_b1)
cb1_r = c_teal_front_full.resize((wb1, hb1), Image.Resampling.LANCZOS)
xb1 = int(W * 0.16)
yb1 = H - hb1 - 30
c_b.paste(cb1_r, (xb1, yb1), cb1_r)

# Right figure: Plum back full
scale_b2 = (H * 0.83) / float(c_plum_back_full.height)
wb2, hb2 = int(c_plum_back_full.width * scale_b2), int(c_plum_back_full.height * scale_b2)
cb2_r = c_plum_back_full.resize((wb2, hb2), Image.Resampling.LANCZOS)
xb2 = int(W * 0.65)
yb2 = H - hb2 - 30
c_b.paste(cb2_r, (xb2, yb2), cb2_r)

# Center BIG Living Logo (width 360px on 2560 canvas = majestic!)
logo_big_b, pad_b = make_logo(380)
x_logo_b = (W - logo_big_b.width) // 2
y_logo_b = 320 # beautifully centered between models' shoulders/chests
c_b.paste(logo_big_b, (x_logo_b, y_logo_b), logo_big_b)

c_b_mock = draw_ui(c_b)
c_b_mock.save(f"{artifact_dir}/scratch/proposal_variant_B_sky_duo.jpg", quality=95)
prev_b = c_b_mock.resize((800, 450), Image.Resampling.LANCZOS)
prev_b.save(f"{artifact_dir}/scratch/proposal_variant_B_prev.jpg", quality=90)


# ==========================================================
# VARIANT C: The Studio Cyclorama Duo with BIG Living Logo
# ==========================================================
print("Rendering Variant C: Studio Cyclorama Duo with Big Living Logo...")
c_c = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/public/hero/masters/slide3_harmony.webp').convert('RGB')
logo_big_c, pad_c = make_logo(380)
x_logo_c = (W - logo_big_c.width) // 2
y_logo_c = 340
c_c_pil = c_c.copy()
c_c_pil.paste(logo_big_c, (x_logo_c, y_logo_c), logo_big_c)

c_c_mock = draw_ui(c_c_pil)
c_c_mock.save(f"{artifact_dir}/scratch/proposal_variant_C_studio_duo.jpg", quality=95)
prev_c = c_c_mock.resize((800, 450), Image.Resampling.LANCZOS)
prev_c.save(f"{artifact_dir}/scratch/proposal_variant_C_prev.jpg", quality=90)


# ==========================================================
# VARIANT D: The Asymmetric Fashion Editorial (Left Full + Right Medium Crop + Center Living Logo)
# ==========================================================
print("Rendering Variant D: Asymmetric Editorial...")
c_d = Image.fromarray(cv2.cvtColor(bg_sky, cv2.COLOR_BGR2RGB))

# Left figure: Teal full length standing
scale_d1 = (H * 0.83) / float(c_teal_front_full.height)
wd1, hd1 = int(c_teal_front_full.width * scale_d1), int(c_teal_front_full.height * scale_d1)
cd1_r = c_teal_front_full.resize((wd1, hd1), Image.Resampling.LANCZOS)
xd1 = int(W * 0.12)
yd1 = H - hd1 - 20
c_d.paste(cd1_r, (xd1, yd1), cd1_r)

# Right figure: Plum close-up portrait looking at camera (right of center)
scale_d2 = (H * 0.95) / float(c_plum_portrait.height)
wd2, hd2 = int(c_plum_portrait.width * scale_d2), int(c_plum_portrait.height * scale_d2)
cd2_r = c_plum_portrait.resize((wd2, hd2), Image.Resampling.LANCZOS)
xd2 = int(W * 0.62)
yd2 = H - hd2
c_d.paste(cd2_r, (xd2, yd2), cd2_r)

# Center Logo: majestic, between full silhouette and intimate portrait
logo_big_d, pad_d = make_logo(360)
x_logo_d = int(W * 0.40) - (logo_big_d.width // 2)
y_logo_d = 360
c_d.paste(logo_big_d, (x_logo_d, y_logo_d), logo_big_d)

c_d_mock = draw_ui(c_d)
c_d_mock.save(f"{artifact_dir}/scratch/proposal_variant_D_asym.jpg", quality=95)
prev_d = c_d_mock.resize((800, 450), Image.Resampling.LANCZOS)
prev_d.save(f"{artifact_dir}/scratch/proposal_variant_D_prev.jpg", quality=90)

print("All 4 flagship proposals rendered successfully!")
