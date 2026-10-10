#!/usr/bin/env python3
"""Generate PWA icons for the 'Traty' app (gradient + white coin + ruble mark)."""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public")
ICONS = os.path.join(OUT, "icons")
os.makedirs(ICONS, exist_ok=True)

C1 = (124, 124, 255)  # #7C7CFF
C2 = (75, 75, 224)    # #4B4BE0
MARK = (91, 91, 240)  # #5B5BF0


def gradient(size):
    """Diagonal linear gradient from C1 (top-left) to C2 (bottom-right)."""
    w, h = size, size
    base = Image.new("RGB", (w, h))
    px = base.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (2 * (size - 1))
            r = int(C1[0] + (C2[0] - C1[0]) * t)
            g = int(C1[1] + (C2[1] - C1[1]) * t)
            b = int(C1[2] + (C2[2] - C1[2]) * t)
            px[x, y] = (r, g, b)
    return base


def draw_mark(draw, cx, cy, r, color, width):
    """Draw a stylised ruble sign (P + horizontal bar) centred at (cx, cy)."""
    stem_left = cx - 0.34 * r
    stem_right = cx - 0.18 * r
    top = cy - 0.44 * r
    bottom = cy + 0.44 * r
    # vertical stem
    draw.rectangle([stem_left, top, stem_right, bottom], fill=color)
    # bowl (right half-circle)
    box = [stem_left, top, cx + 0.34 * r, cy + 0.06 * r]
    draw.arc(box, start=270, end=90, fill=color, width=int(width))
    # horizontal bar through the stem
    bar_y = cy + 0.16 * r
    draw.rectangle([cx - 0.44 * r, bar_y, cx + 0.30 * r, bar_y + width], fill=color)


def make_icon(size, rounded, maskable=False):
    img = gradient(size)
    draw = ImageDraw.Draw(img)
    # glyph safe zone (80% for maskable, ~86% otherwise)
    zone = 0.80 if maskable else 0.86
    r = size * 0.40 * zone / 0.86
    cx = cy = size / 2
    # white coin
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255))
    # inner ring
    ring_w = max(1, int(r * 0.05))
    draw.ellipse(
        [cx - r + ring_w * 1.2, cy - r + ring_w * 1.2, cx + r - ring_w * 1.2, cy + r - ring_w * 1.2],
        outline=(232, 232, 255), width=ring_w,
    )
    draw_mark(draw, cx, cy, r, MARK, max(1, int(r * 0.16)))

    if rounded:
        # apply rounded-rect alpha mask
        mask = Image.new("L", (size, size), 0)
        md = ImageDraw.Draw(mask)
        rad = int(size * 0.225)
        md.rounded_rectangle([0, 0, size - 1, size - 1], radius=rad, fill=255)
        img.putalpha(mask)
    return img


for s in (192, 512):
    make_icon(s, rounded=True).save(os.path.join(ICONS, f"icon-{s}.png"))
make_icon(512, rounded=False, maskable=True).save(os.path.join(ICONS, "icon-maskable-512.png"))
make_icon(180, rounded=False).save(os.path.join(OUT, "apple-touch-icon.png"))
make_icon(32, rounded=True).save(os.path.join(OUT, "favicon-32.png"))

# favicon.svg
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#7C7CFF"/><stop offset="1" stop-color="#4B4BE0"/></linearGradient></defs>
<rect width="100" height="100" rx="22.5" fill="url(#g)"/>
<circle cx="50" cy="50" r="38" fill="#fff"/>
<circle cx="50" cy="50" r="33" fill="none" stroke="#E8E8FF" stroke-width="2"/>
<g fill="#5B5BF0">
<rect x="37" y="34" width="6" height="32" rx="2"/>
<path d="M43 34h5a13 13 0 0 1 0 26h-5z" fill="none" stroke="#5B5BF0" stroke-width="6"/>
<rect x="32" y="56" width="28" height="6" rx="2"/>
</g>
</svg>'''
with open(os.path.join(OUT, "favicon.svg"), "w") as f:
    f.write(svg)
print("icons generated in", OUT)
