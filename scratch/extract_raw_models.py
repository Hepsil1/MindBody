import os
import cv2
import numpy as np
from PIL import Image
import rembg

os.makedirs("scratch/retina_masters", exist_ok=True)

session = rembg.new_session("u2net")

sources = {
    "teal_seated": "public/generalpics/374_131123.webp",
    "black_stand": "public/pics1cloths/IMG_6201.webp",
    "cocoa_stand": "public/pics2cloths/IMG_4971.webp"
}

for name, path in sources.items():
    out_path = f"scratch/retina_masters/{name}_raw_cutout.png"
    if not os.path.exists(out_path):
        print(f"Extracting {name} from {path}...")
        img = Image.open(path).convert("RGBA")
        cutout = rembg.remove(img, session=session, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10)
        cutout.save(out_path, "PNG")
        print(f"Saved {out_path} ({cutout.size})")
    else:
        print(f"{name} already extracted.")

print("All cutouts ready.")
