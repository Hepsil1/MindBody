import cv2
import numpy as np
from PIL import Image

W, H = 2560, 1440

# 1. Sky Background (inspired by user reference)
yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
top_sky = np.array([238, 192, 172], dtype=np.float32) # periwinkle/lavender sky (BGR)
mid_sky = np.array([248, 230, 225], dtype=np.float32) # soft pastel transition
bot_sky = np.array([255, 253, 252], dtype=np.float32) # pure luminous white mist

bg_sky = np.zeros((H, W, 3), dtype=np.float32)
# Gradient with 3 stops
m1 = (yy < 0.5)
bg_sky[yy[:,:,0] < 0.5] = (top_sky * (1.0 - yy[m1]*2.0) + mid_sky * (yy[m1]*2.0))
bg_sky[yy[:,:,0] >= 0.5] = (mid_sky * (1.0 - (yy[~m1]-0.5)*2.0) + bot_sky * ((yy[~m1]-0.5)*2.0))

np.random.seed(42)
cloud_noise = cv2.GaussianBlur(np.random.randn(H, W, 3).astype(np.float32) * 5.0, (121, 121), 50)
bg_sky = np.clip(bg_sky + cloud_noise, 0, 255).astype(np.uint8)

# Load assets
c_plum_back_full = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/595_fixed.png').convert('RGBA')
c_plum_portrait = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/588_131123.png').convert('RGBA')
c_plum_34_back = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/602_131123.png').convert('RGBA')
c_teal_front_full = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/scratch/cutouts/333_131123.png').convert('RGBA')
logo_white = Image.open('C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody/public/pics/mind_body_logo_white.png').convert('RGBA')

# Prepare large living logo
logo_w = 340 # Big living logo on 2560 canvas (corresponds to ~190-210px on 1440)
logo_scale = logo_w / float(logo_white.width)
logo_h = int(logo_white.height * logo_scale)
logo_large = logo_white.resize((logo_w, logo_h), Image.Resampling.LANCZOS)

# Helper to draw UI overlay (Header mockup + CTA button)
def draw_ui(img_pil):
    out = img_pil.copy()
    arr = cv2.cvtColor(np.array(out), cv2.COLOR_RGB2BGR)
    
    # CTA button
    bx1, bx2 = W//2 - 180, W//2 + 180
    by1, by2 = 1260, 1330
    btn_col = (104, 90, 42) # Teal #2A5A68 in BGR
    cv2.rectangle(arr, (bx1+30, by1), (bx2-30, by2), btn_col, -1)
    cv2.rectangle(arr, (bx1, by1+30), (bx2, by2-30), btn_col, -1)
    cv2.circle(arr, (bx1+30, by1+30), 30, btn_col, -1)
    cv2.circle(arr, (bx2-30, by1+30), 30, btn_col, -1)
    cv2.circle(arr, (bx1+30, by2-30), 30, btn_col, -1)
    cv2.circle(arr, (bx2-30, by2-30), 30, btn_col, -1)
    cv2.putText(arr, "PEREHLIANUTY KOLEKTSIIU", (W//2 - 150, by1 + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (255, 255, 255), 2, cv2.LINE_AA)
    
    # Header mock
    cv2.putText(arr, "MIND BODY", (90, 95), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2, cv2.LINE_AA)
    # Nav pill
    px1, px2 = W//2 - 280, W//2 + 280
    py1, py2 = 60, 110
    cv2.rectangle(arr, (px1+25, py1), (px2-25, py2), (70, 65, 75), -1)
    cv2.putText(arr, "YOGA   SPORT   DANCE   CASUAL   KIDS", (px1 + 40, py1 + 34), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (230, 230, 235), 2, cv2.LINE_AA)
    
    return Image.fromarray(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB))

print("Assets loaded, generating 3 flagship design variants...")
