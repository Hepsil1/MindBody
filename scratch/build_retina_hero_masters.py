import os
import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import rembg

os.makedirs("scratch/retina_masters", exist_ok=True)

# 1. Background Canvas Generator (3840x2160 Desktop & 2160x2700 Mobile)
def create_luminous_cyclorama(w, h, horizon_ratio=0.64):
    """
    Creates a luxury luminous warm studio cyclorama:
    - Top Wall: #FAF6F0 (250, 246, 240) -> #EDE5DC (237, 229, 220)
    - Horizon: smooth curve at horizon_ratio
    - Floor: #E5DDD2 (229, 221, 210) -> #DDD4C6 (221, 212, 198) with gentle center bounce
    """
    canvas = np.zeros((h, w, 3), dtype=np.float32)
    horizon_y = int(h * horizon_ratio)
    
    # Vertical gradient wall
    wall_top = np.array([240, 246, 250], dtype=np.float32) # BGR
    wall_bot = np.array([220, 229, 237], dtype=np.float32) # BGR
    floor_top = np.array([210, 221, 229], dtype=np.float32) # BGR
    floor_bot = np.array([200, 212, 222], dtype=np.float32) # BGR
    
    for y in range(h):
        if y < horizon_y:
            t = y / float(horizon_y)
            # Smooth ease
            t = t * t * (3.0 - 2.0 * t)
            col = wall_top * (1.0 - t) + wall_bot * t
        else:
            t = (y - horizon_y) / float(h - horizon_y)
            t = t * t * (3.0 - 2.0 * t)
            col = floor_top * (1.0 - t) + floor_bot * t
        canvas[y, :] = col
        
    # Add subtle radial center softbox glow
    cx, cy = w // 2, int(h * 0.55)
    Y, X = np.ogrid[:h, :w]
    dist_sq = ((X - cx) / float(w * 0.5))**2 + ((Y - cy) / float(h * 0.45))**2
    glow = np.clip(1.0 - np.sqrt(dist_sq), 0.0, 1.0)
    glow = glow * glow * (3.0 - 2.0 * glow) * 12.0 # +12 intensity in center
    
    for c in range(3):
        canvas[:, :, c] = np.clip(canvas[:, :, c] + glow, 0, 255)
        
    # Dithering (1% Gaussian noise) to prevent 8-bit banding
    noise = np.random.normal(0.0, 0.85, (h, w, 3)).astype(np.float32)
    canvas = np.clip(canvas + noise, 0, 255).astype(np.uint8)
    return canvas

# 2. Extract and refine model cutouts with RAW texture preservation
print("Creating background canvases...")
bg_desktop = create_luminous_cyclorama(3840, 2160, 0.65)
bg_mobile = create_luminous_cyclorama(2160, 2700, 0.65)

cv2.imwrite("scratch/retina_masters/bg_desktop.png", bg_desktop)
cv2.imwrite("scratch/retina_masters/bg_mobile.png", bg_mobile)
print("Canvases generated.")
