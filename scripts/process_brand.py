"""
Process Birdy brand PNGs:
  1. Paint over the Gemini ✦ watermark in the bottom-right corner.
  2. Remove the solid background (white for light variants, black for dark
     variants) by making it transparent. The purple "badge" keeps its rounded
     purple square — only the outer white margin becomes transparent.
"""

from pathlib import Path
from PIL import Image

BRAND_DIR = Path(__file__).resolve().parent.parent / "public" / "brand"

# filename -> (bg_mode, bg_color, tolerance)
#   bg_mode = "white" | "black" | "outer_white"
#   outer_white: flood-fill from the corners so only the outer white becomes
#                transparent (keeps any enclosed whites like the inside of the bird).
FILES = {
    "icon-light.png":     ("white", (255, 255, 255), 20),
    "icon-dark.png":      ("black", (0, 0, 0), 20),
    "icon-badge.png":     ("outer_white", (255, 255, 255), 20),
    "logo-light.png":     ("white", (255, 255, 255), 20),
    "logo-dark.png":      ("black", (0, 0, 0), 20),
    "wordmark-light.png": ("white", (255, 255, 255), 20),
    "wordmark-dark.png":  ("black", (0, 0, 0), 20),
}


def erase_watermark(img):
    """Erase the bottom-right Gemini sparkle by making that area transparent."""
    img = img.convert("RGBA")
    w, h = img.size
    patch_w = int(w * 0.08)
    patch_h = int(h * 0.10)
    x0 = w - patch_w
    y0 = h - patch_h
    px = img.load()
    for x in range(x0, w):
        for y in range(y0, h):
            px[x, y] = (0, 0, 0, 0)
    return img


def close_to(px, target, tol):
    return all(abs(px[i] - target[i]) <= tol for i in range(3))


def remove_solid_bg(img, target_color, tol):
    """Replace all pixels close to target_color with transparent."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if close_to(p, target_color, tol):
                px[x, y] = (0, 0, 0, 0)
    return img


def flood_outer(img, target_color, tol):
    """Flood-fill from the 4 corners, only turning pixels that match target
    color into transparent. Preserves interior regions of the same color."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = [[False] * h for _ in range(w)]
    stack = []

    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if close_to(px[corner], target_color, tol):
            stack.append(corner)

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if visited[x][y]:
            continue
        visited[x][y] = True
        if not close_to(px[x, y], target_color, tol):
            continue
        px[x, y] = (0, 0, 0, 0)
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return img


def process(filename, mode, color, tol):
    src = BRAND_DIR / filename
    if not src.exists():
        print(f"[skip] {filename} not found")
        return

    img = Image.open(src).convert("RGBA")

    # Step 1: remove bg
    if mode == "outer_white":
        img = flood_outer(img, color, tol)
    else:
        img = remove_solid_bg(img, color, tol)

    # Step 2: erase watermark corner to transparent
    img = erase_watermark(img)

    img.save(src, "PNG")
    print(f"[ok]   {filename}")


if __name__ == "__main__":
    for fname, (mode, color, tol) in FILES.items():
        process(fname, mode, color, tol)
    print("\nDone.")
