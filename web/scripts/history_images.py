"""Web-size the history photos for the "thirty years of colour" post.

    python web/scripts/history_images.py

Reads web-assets/v2/history/<year>.jpg|jpeg|png (1988, 1996, 2004, 2011) and
writes web/public/v2/history/<year>-1280.webp and <year>-2000.webp, never
upscaling: a photo narrower than a size keeps its own width for it.

To swap a photo -- say, 2004 with its fuselage logo repainted -- replace the
file in web-assets/v2/history under the same year and run this again. The
post refers to the year, not the file, so nothing else changes.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "web-assets" / "v2" / "history"
OUT = ROOT / "web" / "public" / "v2" / "history"
WIDTHS = (1280, 2000)

OUT.mkdir(parents=True, exist_ok=True)
for path in sorted(p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}):
    year = path.stem
    im = Image.open(path).convert("RGB")
    for w in WIDTHS:
        target = min(w, im.width)
        out = OUT / f"{year}-{w}.webp"
        im.resize((target, round(im.height * target / im.width)), Image.LANCZOS).save(
            out, "WEBP", quality=82, method=6)
    print(f"{year}: {im.width}x{im.height} -> {', '.join(f'{year}-{w}.webp' for w in WIDTHS)}")
