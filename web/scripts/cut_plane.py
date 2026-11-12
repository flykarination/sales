"""Cut the v2 A321XLR out of its navy backdrop.

    python web/scripts/cut_plane.py

web-assets/v2/kx_livery_v2.jpeg is the aircraft on solid navy. Blending it
onto the night sky left a faint rectangle on some screens -- the backdrop is
a JPEG, so it is never quite one colour. This removes it instead.

The backdrop is found by flooding inward from the image's edges through
every pixel close to the backdrop colour. Flooding (rather than keying out
every navy pixel) matters because the tail is black and starry: a plain
colour key would also eat any dark pixel that happens to sit inside the
aircraft. The mask is then cleaned of JPEG speckle, eroded by a pixel to
drop the navy fringe, and feathered so the edge is soft at screen size.

Writes web/public/v2/livery-a321xlr-cut.webp (and a .png for checking).
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "web-assets" / "v2" / "kx_livery_v2.jpeg"
OUT = ROOT / "web" / "public" / "v2"

im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.int32)
h, w, _ = im.shape

# the backdrop: the median of the border pixels
border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
bg = np.median(border, axis=0)
dist = np.sqrt(((im - bg) ** 2).sum(axis=2))
TOL = 24                     # JPEG noise on the navy stays well inside this
near = dist < TOL

# flood fill from every edge pixel through "near backdrop" pixels
mask = np.zeros((h, w), bool)
q = deque((y, x) for y in range(h) for x in (0, w - 1))
q.extend((y, x) for x in range(w) for y in (0, h - 1))
while q:
    y, x = q.popleft()
    if mask[y, x] or not near[y, x]:
        continue
    mask[y, x] = True
    if y > 0: q.append((y - 1, x))
    if y < h - 1: q.append((y + 1, x))
    if x > 0: q.append((y, x - 1))
    if x < w - 1: q.append((y, x + 1))

alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8))
# clean speckle (small islands of "plane" in the sky and vice versa)
alpha = alpha.filter(ImageFilter.MedianFilter(5))
# shave the navy fringe, then soften the edge
alpha = alpha.filter(ImageFilter.MinFilter(3))
alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))

# keep only the largest connected shape: the aircraft (drops stray specks)
a = np.asarray(alpha) > 128
seen = np.zeros_like(a)
best = None
for sy, sx in zip(*np.nonzero(a)):
    if seen[sy, sx]:
        continue
    comp, dq = [], deque([(sy, sx)])
    seen[sy, sx] = True
    while dq:
        y, x = dq.popleft(); comp.append((y, x))
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; dq.append((ny, nx))
    if best is None or len(comp) > len(best):
        best = comp
keep = np.zeros_like(a)
for y, x in best:
    keep[y, x] = True
keep_img = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
final_alpha = np.minimum(np.asarray(alpha), np.asarray(keep_img))

rgba = np.dstack([im.astype(np.uint8), final_alpha.astype(np.uint8)])
out = Image.fromarray(rgba, "RGBA")
# trim to the aircraft with a small margin
ys, xs = np.nonzero(final_alpha > 8)
box = (max(xs.min() - 6, 0), max(ys.min() - 6, 0), min(xs.max() + 7, w), min(ys.max() + 7, h))
out = out.crop(box)
out.save(OUT / "livery-a321xlr-cut.png", optimize=True)
out.save(OUT / "livery-a321xlr-cut.webp", "WEBP", quality=92, method=6)
print(f"backdrop {bg.astype(int).tolist()}, cut {out.size[0]}x{out.size[1]}, "
      f"aircraft {len(best)} px, crop box {box}")
