"""
Build All 4 Flagship Campaign Masters (Retina 8K)
Slide 1: Grand Campaign Trio (3 models: Black front + Teal seated + Plum back)
Slide 2: Editorial Asymmetric Lookbook (1 solitary high-fashion model with pure negative space)
Slide 3: Studio Standing Duo (2 models: Black front + Cocoa laced back)
Slide 4: Dynamic Studio Quartet (4 models: Cocoa + Black + Teal seated + Plum back)

Outputs 3840x2160 (Desktop) and 2160x2700 (Mobile) for all 4 variants.
"""
import os
import cv2
import numpy as np
from PIL import Image

OUT_DIR = r"C:\Users\tgmbo\.gemini\antigravity\scratch\MindBody\scratch\masterpiece_masters"
os.makedirs(OUT_DIR, exist_ok=True)

RAW_BLACK = r"C:\Users\tgmbo\.gemini\antigravity\scratch\MindBody\public\pics1cloths\IMG_6201.JPG"
RAW_TEAL = r"C:\Users\tgmbo\.gemini\antigravity\scratch\MindBody\public\generalpics\374_131123.jpg"
RAW_PLUM = r"C:\Users\tgmbo\Downloads\Telegram Desktop\ChatExport_2026-11-11 (1)\files\IMG_0658.JPG"
RAW_COCOA_BACK = r"C:\Users\tgmbo\.gemini\antigravity\scratch\MindBody\public\pics2cloths\IMG_4971.JPG"
RAW_COCOA_FRONT = r"C:\Users\tgmbo\Downloads\Telegram Desktop\ChatExport_2026-11-11 (1)\files\IMG_0650.JPG"

def extract_model_clean(image_path):
    """Extract model with high-precision sub-pixel alpha matting."""
    im = Image.open(image_path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3]
    
    h, w = arr.shape[:2]
    top_left = rgb[:int(h*0.08), :int(w*0.10)]
    top_right = rgb[:int(h*0.08), -int(w*0.10):]
    bg_mean = (np.mean(top_left, axis=(0,1)) + np.mean(top_right, axis=(0,1))) / 2.0
    
    diff = np.linalg.norm(rgb.astype(float) - bg_mean, axis=2)
    lum = 0.299 * rgb[:,:,0] + 0.587 * rgb[:,:,1] + 0.114 * rgb[:,:,2]
    bg_lum = 0.299 * bg_mean[0] + 0.587 * bg_mean[1] + 0.114 * bg_mean[2]
    lum_diff = np.abs(lum - bg_lum)
    
    dist = np.maximum(diff, lum_diff * 1.2)
    t_low = 14.0
    t_high = 32.0
    alpha = np.clip((dist - t_low) / (t_high - t_low), 0, 1)
    
    mask_uint = (alpha * 255).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask_closed = cv2.morphologyEx(mask_uint, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(mask_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        c = max(contours, key=cv2.contourArea)
        hull = np.zeros_like(mask_uint)
        cv2.drawContours(hull, [c], -1, 255, -1)
        hull_dilated = cv2.dilate(hull, kernel, iterations=3)
        alpha_final = np.where(hull_dilated > 0, alpha, 0.0)
    else:
        alpha_final = alpha
        
    alpha_final = cv2.GaussianBlur(alpha_final, (3, 3), 0.5)
    arr[:, :, 3] = (alpha_final * 255).astype(np.uint8)
    return Image.fromarray(arr)

def create_luminous_cyclorama(width, height):
    """Generate a luminous, champagne-silk studio cyclorama."""
    canvas = np.zeros((height, width, 3), dtype=np.float32)
    y_coords = np.linspace(0, 1, height)[:, None]
    x_coords = np.linspace(-1, 1, width)[None, :]
    
    curve_y = 0.68
    spotlight = np.exp(-1.5 * (x_coords ** 2 + ((y_coords - 0.45) * 1.5) ** 2))
    
    wall_r = 246 + 6 * spotlight - 12 * (y_coords / curve_y)
    wall_g = 240 + 6 * spotlight - 14 * (y_coords / curve_y)
    wall_b = 234 + 6 * spotlight - 16 * (y_coords / curve_y)
    
    floor_t = np.clip((y_coords - curve_y) / (1 - curve_y), 0, 1)
    floor_r = 236 - 12 * floor_t + 4 * spotlight
    floor_g = 227 - 14 * floor_t + 4 * spotlight
    floor_b = 217 - 18 * floor_t + 3 * spotlight
    
    blend = np.clip((y_coords - curve_y + 0.04) / 0.08, 0, 1)
    r = wall_r * (1 - blend) + floor_r * blend
    g = wall_g * (1 - blend) + floor_g * blend
    b = wall_b * (1 - blend) + floor_b * blend
    
    canvas[:, :, 0] = np.clip(r, 0, 255)
    canvas[:, :, 1] = np.clip(g, 0, 255)
    canvas[:, :, 2] = np.clip(b, 0, 255)
    
    dither = np.random.normal(0, 0.4, (height, width, 3))
    return Image.fromarray(np.clip(canvas + dither, 0, 255).astype(np.uint8), mode="RGB")

def add_floor_shadow(canvas, x_pos, y_pos, model_w, model_h):
    """Add contact occlusion shadow and soft ambient studio shadow under model feet."""
    arr_c = np.array(canvas, dtype=np.float32)
    cx = x_pos + model_w // 2
    cy = y_pos + model_h - int(model_h * 0.015)
    
    rx_contact = int(model_w * 0.36)
    ry_contact = int(model_h * 0.022)
    
    rx_ambient = int(model_w * 0.58)
    ry_ambient = int(model_h * 0.060)
    
    H, W = arr_c.shape[:2]
    y, x = np.ogrid[:H, :W]
    
    dist_contact = ((x - cx) / max(rx_contact, 1)) ** 2 + ((y - cy) / max(ry_contact, 1)) ** 2
    contact_mask = np.clip(1.0 - dist_contact, 0, 1) ** 2 * 0.45
    
    dist_ambient = ((x - cx) / max(rx_ambient, 1)) ** 2 + ((y - cy) / max(ry_ambient, 1)) ** 2
    ambient_mask = np.clip(1.0 - dist_ambient, 0, 1) ** 2 * 0.22
    
    total_shadow = np.maximum(contact_mask, ambient_mask)[:, :, None]
    shadow_color = np.array([58, 46, 40], dtype=np.float32)
    arr_c = arr_c * (1.0 - total_shadow) + shadow_color * total_shadow
    return Image.fromarray(np.clip(arr_c, 0, 255).astype(np.uint8))

def add_floor_reflection(canvas, model_res, x_pos, y_pos):
    """Add subtle specular floor reflection (epoxy studio floor effect)."""
    flipped = model_res.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    w, h = model_res.size
    fade_len = min(int(h * 0.15), 180)
    if fade_len <= 0:
        return canvas
    crop_refl = flipped.crop((0, 0, w, fade_len))
    arr_r = np.array(crop_refl, dtype=np.float32)
    fade = np.linspace(0.12, 0.0, fade_len)[:, None]
    fade = np.repeat(fade, w, axis=1)
    arr_r[:, :, 3] = arr_r[:, :, 3] * fade
    refl_img = Image.fromarray(np.clip(arr_r, 0, 255).astype(np.uint8))
    canvas.paste(refl_img, (x_pos, y_pos + h - int(h * 0.015)), refl_img)
    return canvas

print("Loading and extracting high-res studio assets...")
black_raw = extract_model_clean(RAW_BLACK)
teal_raw = extract_model_clean(RAW_TEAL)
plum_raw = extract_model_clean(RAW_PLUM)
cocoa_back_raw = extract_model_clean(RAW_COCOA_BACK)
cocoa_front_raw = extract_model_clean(RAW_COCOA_FRONT)
print("All 5 RAW models extracted!")

# =========================================================================
# V1 · Grand Campaign Trio (3 Models: Black + Teal + Plum)
# =========================================================================
def build_v1():
    print("--- Building V1 Grand Campaign Trio ---")
    W, H = 3840, 2160
    canvas = create_luminous_cyclorama(W, H)
    
    h_stand = int(H * 0.68)  # 1468 px
    h_seat = int(H * 0.38)   # 820 px -> head at y = 860px (clear air under logo)
    
    black = black_raw.resize((int(black_raw.width * (h_stand / black_raw.height)), h_stand), Image.Resampling.LANCZOS)
    plum = plum_raw.resize((int(plum_raw.width * (h_stand / plum_raw.height)), h_stand), Image.Resampling.LANCZOS)
    teal = teal_raw.resize((int(teal_raw.width * (h_seat / teal_raw.height)), h_seat), Image.Resampling.LANCZOS)
    
    y_floor = int(H * 0.777)
    
    x_b = int(W * 0.18)
    y_b = y_floor - h_stand
    
    x_p = int(W * 0.82) - plum.width
    y_p = y_floor - h_stand
    
    x_t = int(W * 0.50) - (teal.width // 2)
    y_t = y_floor - h_seat
    
    # Shadows
    canvas = add_floor_shadow(canvas, x_b, y_b, black.width, h_stand)
    canvas = add_floor_shadow(canvas, x_p, y_p, plum.width, h_stand)
    canvas = add_floor_shadow(canvas, x_t, y_t, teal.width, h_seat)
    
    # Reflections
    canvas = add_floor_reflection(canvas, black, x_b, y_b)
    canvas = add_floor_reflection(canvas, plum, x_p, y_p)
    canvas = add_floor_reflection(canvas, teal, x_t, y_t)
    
    # Paste models
    canvas.paste(black, (x_b, y_b), black)
    canvas.paste(plum, (x_p, y_p), plum)
    canvas.paste(teal, (x_t, y_t), teal)
    
    canvas.save(os.path.join(OUT_DIR, "master_v1_desktop_3840.png"), quality=100)
    print("V1 Desktop complete.")
    
    # Mobile V1
    mW, mH = 2160, 2700
    m_canvas = create_luminous_cyclorama(mW, mH)
    m_h_stand = int(mH * 0.60)
    m_h_seat = int(mH * 0.38)
    
    m_b = black_raw.resize((int(black_raw.width * (m_h_stand / black_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    m_p = plum_raw.resize((int(plum_raw.width * (m_h_stand / plum_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    m_t = teal_raw.resize((int(teal_raw.width * (m_h_seat / teal_raw.height)), m_h_seat), Image.Resampling.LANCZOS)
    
    m_y_floor = int(mH * 0.76)
    m_x_b = int(mW * 0.06)
    m_y_b = m_y_floor - m_h_stand
    m_x_p = int(mW * 0.94) - m_p.width
    m_y_p = m_y_floor - m_h_stand
    m_x_t = int(mW * 0.50) - (m_t.width // 2)
    m_y_t = m_y_floor - m_h_seat
    
    m_canvas = add_floor_shadow(m_canvas, m_x_b, m_y_b, m_b.width, m_h_stand)
    m_canvas = add_floor_shadow(m_canvas, m_x_p, m_y_p, m_p.width, m_h_stand)
    m_canvas = add_floor_shadow(m_canvas, m_x_t, m_y_t, m_t.width, m_h_seat)
    m_canvas = add_floor_reflection(m_canvas, m_b, m_x_b, m_y_b)
    m_canvas = add_floor_reflection(m_canvas, m_p, m_x_p, m_y_p)
    m_canvas = add_floor_reflection(m_canvas, m_t, m_x_t, m_y_t)
    
    m_canvas.paste(m_b, (m_x_b, m_y_b), m_b)
    m_canvas.paste(m_p, (m_x_p, m_y_p), m_p)
    m_canvas.paste(m_t, (m_x_t, m_y_t), m_t)
    m_canvas.save(os.path.join(OUT_DIR, "master_v1_mobile_2160.png"), quality=100)
    print("V1 Mobile complete.")

# =========================================================================
# V2 · Studio Standing Duo (2 Models: Black Front + Cocoa Laced Back)
# =========================================================================
def build_v2():
    print("--- Building V2 Studio Standing Duo ---")
    W, H = 3840, 2160
    canvas = create_luminous_cyclorama(W, H)
    
    h_stand = int(H * 0.70)
    y_floor = int(H * 0.777)
    
    black = black_raw.resize((int(black_raw.width * (h_stand / black_raw.height)), h_stand), Image.Resampling.LANCZOS)
    cocoa = cocoa_back_raw.resize((int(cocoa_back_raw.width * (h_stand / cocoa_back_raw.height)), h_stand), Image.Resampling.LANCZOS)
    
    x_b = int(W * 0.35) - (black.width // 2)
    y_b = y_floor - h_stand
    x_c = int(W * 0.65) - (cocoa.width // 2)
    y_c = y_floor - h_stand
    
    canvas = add_floor_shadow(canvas, x_b, y_b, black.width, h_stand)
    canvas = add_floor_shadow(canvas, x_c, y_c, cocoa.width, h_stand)
    canvas = add_floor_reflection(canvas, black, x_b, y_b)
    canvas = add_floor_reflection(canvas, cocoa, x_c, y_c)
    
    canvas.paste(black, (x_b, y_b), black)
    canvas.paste(cocoa, (x_c, y_c), cocoa)
    canvas.save(os.path.join(OUT_DIR, "master_v2_desktop_3840.png"), quality=100)
    print("V2 Desktop complete.")
    
    # Mobile V2
    mW, mH = 2160, 2700
    m_canvas = create_luminous_cyclorama(mW, mH)
    m_h_stand = int(mH * 0.65)
    m_y_floor = int(mH * 0.76)
    
    m_b = black_raw.resize((int(black_raw.width * (m_h_stand / black_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    m_c = cocoa_back_raw.resize((int(cocoa_back_raw.width * (m_h_stand / cocoa_back_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    
    m_x_b = int(mW * 0.30) - (m_b.width // 2)
    m_y_b = m_y_floor - m_h_stand
    m_x_c = int(mW * 0.70) - (m_c.width // 2)
    m_y_c = m_y_floor - m_h_stand
    
    m_canvas = add_floor_shadow(m_canvas, m_x_b, m_y_b, m_b.width, m_h_stand)
    m_canvas = add_floor_shadow(m_canvas, m_x_c, m_y_c, m_c.width, m_h_stand)
    m_canvas = add_floor_reflection(m_canvas, m_b, m_x_b, m_y_b)
    m_canvas = add_floor_reflection(m_canvas, m_c, m_x_c, m_y_c)
    
    m_canvas.paste(m_b, (m_x_b, m_y_b), m_b)
    m_canvas.paste(m_c, (m_x_c, m_y_c), m_c)
    m_canvas.save(os.path.join(OUT_DIR, "master_v2_mobile_2160.png"), quality=100)
    print("V2 Mobile complete.")

# =========================================================================
# V3 · Editorial Lookbook (1 Model: Plum Solitary High Fashion)
# =========================================================================
def build_v3():
    print("--- Building V3 Editorial Lookbook ---")
    W, H = 3840, 2160
    canvas = create_luminous_cyclorama(W, H)
    
    h_stand = int(H * 0.72)
    y_floor = int(H * 0.777)
    
    plum = plum_raw.resize((int(plum_raw.width * (h_stand / plum_raw.height)), h_stand), Image.Resampling.LANCZOS)
    
    x_p = int(W * 0.74) - (plum.width // 2)
    y_p = y_floor - h_stand
    
    canvas = add_floor_shadow(canvas, x_p, y_p, plum.width, h_stand)
    canvas = add_floor_reflection(canvas, plum, x_p, y_p)
    canvas.paste(plum, (x_p, y_p), plum)
    canvas.save(os.path.join(OUT_DIR, "master_v3_desktop_3840.png"), quality=100)
    print("V3 Desktop complete.")
    
    # Mobile V3
    mW, mH = 2160, 2700
    m_canvas = create_luminous_cyclorama(mW, mH)
    m_h_stand = int(mH * 0.68)
    m_y_floor = int(mH * 0.76)
    
    m_p = plum_raw.resize((int(plum_raw.width * (m_h_stand / plum_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    m_x_p = int(mW * 0.50) - (m_p.width // 2)
    m_y_p = m_y_floor - m_h_stand
    
    m_canvas = add_floor_shadow(m_canvas, m_x_p, m_y_p, m_p.width, m_h_stand)
    m_canvas = add_floor_reflection(m_canvas, m_p, m_x_p, m_y_p)
    m_canvas.paste(m_p, (m_x_p, m_y_p), m_p)
    m_canvas.save(os.path.join(OUT_DIR, "master_v3_mobile_2160.png"), quality=100)
    print("V3 Mobile complete.")

# =========================================================================
# V4 · Dynamic Studio Quartet (4 Models: Cocoa + Black + Teal + Plum)
# =========================================================================
def build_v4():
    print("--- Building V4 Dynamic Studio Quartet (4 Models) ---")
    W, H = 3840, 2160
    canvas = create_luminous_cyclorama(W, H)
    
    h_stand = int(H * 0.66)  # 1425 px
    h_seat = int(H * 0.38)   # 820 px
    y_floor = int(H * 0.777)
    
    cocoa = cocoa_front_raw.resize((int(cocoa_front_raw.width * (h_stand / cocoa_front_raw.height)), h_stand), Image.Resampling.LANCZOS)
    black = black_raw.resize((int(black_raw.width * (h_stand / black_raw.height)), h_stand), Image.Resampling.LANCZOS)
    teal = teal_raw.resize((int(teal_raw.width * (h_seat / teal_raw.height)), h_seat), Image.Resampling.LANCZOS)
    plum = plum_raw.resize((int(plum_raw.width * (h_stand / plum_raw.height)), h_stand), Image.Resampling.LANCZOS)
    
    # 4 models composition:
    # Model 1 (Cocoa): Left wing (x = 10%..24%)
    x_c = int(W * 0.12)
    y_c = y_floor - h_stand
    
    # Model 2 (Black): Center Left (x = 32%..46%)
    x_b = int(W * 0.36) - (black.width // 2)
    y_b = y_floor - h_stand
    
    # Model 3 (Teal seated): Center Right floor pose (x = 56%..70%)
    x_t = int(W * 0.62) - (teal.width // 2)
    y_t = y_floor - h_seat
    
    # Model 4 (Plum): Right wing back laced (x = 76%..90%)
    x_p = int(W * 0.88) - plum.width
    y_p = y_floor - h_stand
    
    # Shadows
    canvas = add_floor_shadow(canvas, x_c, y_c, cocoa.width, h_stand)
    canvas = add_floor_shadow(canvas, x_b, y_b, black.width, h_stand)
    canvas = add_floor_shadow(canvas, x_t, y_t, teal.width, h_seat)
    canvas = add_floor_shadow(canvas, x_p, y_p, plum.width, h_stand)
    
    # Reflections
    canvas = add_floor_reflection(canvas, cocoa, x_c, y_c)
    canvas = add_floor_reflection(canvas, black, x_b, y_b)
    canvas = add_floor_reflection(canvas, teal, x_t, y_t)
    canvas = add_floor_reflection(canvas, plum, x_p, y_p)
    
    # Paste models
    canvas.paste(cocoa, (x_c, y_c), cocoa)
    canvas.paste(black, (x_b, y_b), black)
    canvas.paste(teal, (x_t, y_t), teal)
    canvas.paste(plum, (x_p, y_p), plum)
    
    canvas.save(os.path.join(OUT_DIR, "master_v4_desktop_3840.png"), quality=100)
    print("V4 Desktop complete.")
    
    # Mobile V4 (4 models composed gracefully for portrait)
    mW, mH = 2160, 2700
    m_canvas = create_luminous_cyclorama(mW, mH)
    m_h_stand = int(mH * 0.54)
    m_h_seat = int(mH * 0.34)
    m_y_floor = int(mH * 0.76)
    
    m_c = cocoa_front_raw.resize((int(cocoa_front_raw.width * (m_h_stand / cocoa_front_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    m_b = black_raw.resize((int(black_raw.width * (m_h_stand / black_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    m_t = teal_raw.resize((int(teal_raw.width * (m_h_seat / teal_raw.height)), m_h_seat), Image.Resampling.LANCZOS)
    m_p = plum_raw.resize((int(plum_raw.width * (m_h_stand / plum_raw.height)), m_h_stand), Image.Resampling.LANCZOS)
    
    m_x_c = int(mW * 0.04)
    m_y_c = m_y_floor - m_h_stand
    
    m_x_b = int(mW * 0.33) - (m_b.width // 2)
    m_y_b = m_y_floor - m_h_stand
    
    m_x_t = int(mW * 0.65) - (m_t.width // 2)
    m_y_t = m_y_floor - m_h_seat
    
    m_x_p = int(mW * 0.96) - m_p.width
    m_y_p = m_y_floor - m_h_stand
    
    m_canvas = add_floor_shadow(m_canvas, m_x_c, m_y_c, m_c.width, m_h_stand)
    m_canvas = add_floor_shadow(m_canvas, m_x_b, m_y_b, m_b.width, m_h_stand)
    m_canvas = add_floor_shadow(m_canvas, m_x_t, m_y_t, m_t.width, m_h_seat)
    m_canvas = add_floor_shadow(m_canvas, m_x_p, m_y_p, m_p.width, m_h_stand)
    
    m_canvas = add_floor_reflection(m_canvas, m_c, m_x_c, m_y_c)
    m_canvas = add_floor_reflection(m_canvas, m_b, m_x_b, m_y_b)
    m_canvas = add_floor_reflection(m_canvas, m_t, m_x_t, m_y_t)
    m_canvas = add_floor_reflection(m_canvas, m_p, m_x_p, m_y_p)
    
    m_canvas.paste(m_c, (m_x_c, m_y_c), m_c)
    m_canvas.paste(m_b, (m_x_b, m_y_b), m_b)
    m_canvas.paste(m_t, (m_x_t, m_y_t), m_t)
    m_canvas.paste(m_p, (m_x_p, m_y_p), m_p)
    
    m_canvas.save(os.path.join(OUT_DIR, "master_v4_mobile_2160.png"), quality=100)
    print("V4 Mobile complete.")

if __name__ == "__main__":
    build_v1()
    build_v2()
    build_v3()
    build_v4()
    print("ALL 4 FLAGSHIP RETINA 8K MASTERS SUCCESSFULLY GENERATED!")
