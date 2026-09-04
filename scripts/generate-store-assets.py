"""Regenerate every image asset the Chrome Web Store submission needs.

Sources of truth (checked in):
    src/assets/icon.png   1024x1024 master icon
    screenshots/*.png     raw captures of the palette, any size

Outputs (checked in, regenerate rather than hand-edit):
    public/icons/icon-{16,32,48,128}.png   manifest icons, copied into dist/ by Vite
    store-assets/store-icon-128.png        the listing icon, uploaded separately
    store-assets/screenshots/*.png         1280x800, the only size the store accepts
                                           besides 640x400

Image processing is delegated to PixelFit (a sibling checkout), so resampling
stays consistent with the rest of the toolchain instead of being reimplemented
here. Run it as:

    cd ../PixelFit && PYTHONPATH=. uv run python ../steroid/scripts/generate-store-assets.py

Screenshots are centre-cropped, never letterboxed: at the 2:1-ish ratio these
captures come in at, cover-scaling lands the height on 800 exactly, so the crop
only trims horizontal margin and the centred palette survives intact. If a
future capture is narrower than 1.6:1 the crop would start eating the palette —
check the output before assuming it is fine.
"""

from pathlib import Path

from PIL import Image

from pixelfit import BackgroundFill, change_aspect_ratio, resize_image

REPO = Path(__file__).resolve().parent.parent

MASTER_ICON = REPO / "src" / "assets" / "icon.png"
MANIFEST_ICON_DIR = REPO / "public" / "icons"
STORE_DIR = REPO / "store-assets"
SCREENSHOT_SRC_DIR = REPO / "screenshots"

ICON_SIZES = (16, 32, 48, 128)
STORE_ICON_SIZE = 128
SCREENSHOT_W, SCREENSHOT_H = 1280, 800


def _report(kind: str, path: Path, width: int, height: int) -> None:
    size_kb = path.stat().st_size / 1024
    print(f"{kind:<7} {path.relative_to(REPO)}  {width}x{height}  {size_kb:.1f} KB")


def generate_manifest_icons() -> None:
    """Emit the four icon sizes declared in public/manifest.json."""
    MANIFEST_ICON_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(MASTER_ICON) as master:
        master.load()
        for size in ICON_SIZES:
            icon = resize_image(master, width=size, height=size, maintain_aspect_ratio=True)
            dest = MANIFEST_ICON_DIR / f"icon-{size}.png"
            icon.save(dest, format="PNG", optimize=True)
            _report("icon", dest, *icon.size)


def generate_store_icon() -> None:
    """Emit the 128x128 listing icon, which is uploaded separately from the manifest icons."""
    STORE_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(MASTER_ICON) as master:
        master.load()
        icon = resize_image(
            master, width=STORE_ICON_SIZE, height=STORE_ICON_SIZE, maintain_aspect_ratio=True
        )
        dest = STORE_DIR / "store-icon-128.png"
        icon.save(dest, format="PNG", optimize=True)
        _report("store", dest, *icon.size)


def generate_screenshots() -> None:
    """Centre-crop every raw capture to the store's 1280x800 requirement."""
    out_dir = STORE_DIR / "screenshots"
    out_dir.mkdir(parents=True, exist_ok=True)

    sources = sorted(p for p in SCREENSHOT_SRC_DIR.glob("*.png") if not p.name.startswith("."))
    if not sources:
        print(f"no screenshots found in {SCREENSHOT_SRC_DIR.relative_to(REPO)}")
        return

    for index, src in enumerate(sources, start=1):
        with Image.open(src) as capture:
            capture.load()
            shot = change_aspect_ratio(
                capture, SCREENSHOT_W, SCREENSHOT_H, fill=BackgroundFill.CROP
            )
            # The store rejects alpha channels on screenshots.
            if shot.mode != "RGB":
                shot = shot.convert("RGB")
            dest = out_dir / f"screenshot-{index}.png"
            shot.save(dest, format="PNG", optimize=True)
            _report("screen", dest, *shot.size)


if __name__ == "__main__":
    generate_manifest_icons()
    generate_store_icon()
    generate_screenshots()
