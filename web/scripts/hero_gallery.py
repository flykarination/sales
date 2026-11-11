"""Turn web-assets/v2/scroll into the home page's hero gallery.

    python web/scripts/hero_gallery.py

For every photo in web-assets/v2/scroll (jpg, jpeg, png, webp):
  * writes web/public/v2/hero/<slug>-1280.webp and <slug>-2400.webp
    (never upscaled: a smaller original keeps its own width), and
  * lists it in web/src/data/hero-gallery.json.

Editing the gallery is editing that JSON. Each entry's alt, caption, fit and
position are yours: re-running the script keeps them, adds new photos at the
end with placeholder text to fill in, and drops entries whose source photo
was deleted. Reorder the entries to reorder the gallery.

  fit       "cover" fills the frame and crops; "contain" shows the whole
            photo over a blurred copy of itself -- for panoramas whose
            subject runs edge to edge, such as an aircraft side-on.
  position  where a cover crop is centred, as CSS object-position
            ("50% 50%" is the middle, "30% 60%" left of and below it).

Also refreshes the two v2 artworks the hero uses: the A321XLR livery and the
fluoro streak.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "web-assets" / "v2" / "scroll"
OUT = ROOT / "web" / "public" / "v2" / "hero"
MANIFEST = ROOT / "web" / "src" / "data" / "hero-gallery.json"
WIDTHS = (1280, 2400)


def slug_for(path: Path) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
    # generator suffixes ("_f83b82db_2k", "_rw4ngr...") are noise in a URL
    s = re.sub(r"(-[0-9a-f]{8})?(-2k|-4k)?$", "", s)
    return s[:48].rstrip("-") or "photo"


def write_sizes(src: Path, slug: str) -> tuple[int, int]:
    im = Image.open(src).convert("RGB")
    for w in WIDTHS:
        target = min(w, im.width)
        h = round(im.height * target / im.width)
        out = OUT / f"{slug}-{w}.webp"
        im.resize((target, h), Image.LANCZOS).save(out, "WEBP", quality=82, method=6)
    return im.width, im.height


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    old = {e["source"]: e for e in json.loads(MANIFEST.read_text("utf-8"))} if MANIFEST.exists() else {}
    photos = sorted(p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})

    entries, taken = [], set()
    # keep the order the JSON already has, then append anything new
    ordered = [p for name in old for p in photos if p.name == name] + [p for p in photos if p.name not in old]
    for p in ordered:
        slug = slug_for(p)
        while slug in taken:
            slug += "-2"
        taken.add(slug)
        w, h = write_sizes(p, slug)
        e = old.get(p.name, {})
        entries.append({
            "source": p.name,
            "src": f"/v2/hero/{slug}-2400.webp",
            "srcSmall": f"/v2/hero/{slug}-1280.webp",
            "width": w,
            "height": h,
            "alt": e.get("alt", "TODO: describe this photo for screen readers"),
            "caption": e.get("caption", "TODO: caption"),
            "fit": e.get("fit", "contain" if w / h > 2.4 else "cover"),
            "position": e.get("position", "50% 50%"),
        })
        print(f"  {'kept' if p.name in old else 'NEW '} {slug}  {w}x{h}  fit={entries[-1]['fit']}")

    for name in set(old) - {p.name for p in photos}:
        print(f"  gone {name} (removed from the gallery)")

    MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", "utf-8")

    art = ROOT / "web" / "public" / "v2"
    Image.open(ROOT / "web-assets" / "v2" / "kx_livery_v2.jpeg").convert("RGB").save(
        art / "livery-a321xlr.webp", "WEBP", quality=90, method=6)
    Image.open(ROOT / "web-assets" / "v2" / "fluoro.png").convert("RGB").save(
        art / "fluoro.webp", "WEBP", quality=86, method=6)
    print(f"{len(entries)} photos in {MANIFEST.relative_to(ROOT)}; artworks refreshed")


if __name__ == "__main__":
    main()
