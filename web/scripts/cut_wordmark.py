"""Cut the v2 wordmark out of its white background.

    python web/scripts/cut_wordmark.py

The artwork in web-assets/v2/kx_text.png is the gradient wordmark on solid
white with no transparency. Thresholding the white away would leave a pale
fringe on every edge, which shows badly on the night canvas. This removes the
white mathematically instead ("colour to alpha"): each pixel is treated as the
true colour composited over white, and both are recovered --

    alpha  = how far the pixel is from white, on its furthest channel
    colour = (pixel - white * (1 - alpha)) / alpha

-- so an anti-aliased edge pixel becomes the letter's own colour at partial
opacity, and the letters composite cleanly onto anything.

Writes, into web/public/brand/v2/:
  kx-wordmark.png        the gradient wordmark, transparent (for light grounds)
  kx-wordmark-white.png  the same shape in white (for the night canvas, where
                         the wordmark's ultramarine end vanishes into navy)
Both are trimmed to the letters with a small even margin.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "web-assets" / "v2" / "kx_text.png"
OUT = ROOT / "web" / "public" / "brand" / "v2"
MARGIN = 8

rgb = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float64) / 255.0

alpha = (1.0 - rgb).max(axis=2)                       # 0 on pure white, 1 on full ink
safe = np.where(alpha > 0, alpha, 1.0)[..., None]
colour = np.clip((rgb - (1.0 - alpha[..., None])) / safe, 0.0, 1.0)
alpha[alpha < 1.5 / 255] = 0.0                        # JPEG-free source, but kill stray near-whites

ys, xs = np.nonzero(alpha)
top, bottom = max(ys.min() - MARGIN, 0), min(ys.max() + MARGIN + 1, alpha.shape[0])
left, right = max(xs.min() - MARGIN, 0), min(xs.max() + MARGIN + 1, alpha.shape[1])
colour, alpha = colour[top:bottom, left:right], alpha[top:bottom, left:right]

a8 = (alpha * 255).round().astype(np.uint8)
OUT.mkdir(parents=True, exist_ok=True)

gradient = np.dstack([(colour * 255).round().astype(np.uint8), a8])
Image.fromarray(gradient, "RGBA").save(OUT / "kx-wordmark.png", optimize=True)

white = np.dstack([np.full(a8.shape + (3,), 255, np.uint8), a8])
Image.fromarray(white, "RGBA").save(OUT / "kx-wordmark-white.png", optimize=True)

# Self-check: composite the cut back over white; it must reproduce the source.
back = colour * alpha[..., None] + (1.0 - alpha[..., None])
src_crop = rgb[top:bottom, left:right]
err = np.abs(back - src_crop).max() * 255
print(f"cut {right - left}x{bottom - top}px; worst round-trip error {err:.2f}/255")
assert err < 2.0, "the cut does not reproduce the original on white"
