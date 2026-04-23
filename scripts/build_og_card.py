"""
Generate OG share card image(s) for tenanttriage.nyc.

Renders a 1200x630 PNG from the source illustration + wordmark overlay.
Parameters live at the top; edit and re-run to tweak font, colors, position,
or wordmark text without touching the rendering logic.

Usage:
    python3 scripts/build_og_card.py

Output: images/og-card.png, images/og-card-shadow.png, images/og-card-centered.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = PROJECT_ROOT / "images"

SOURCE_IMAGE = IMAGES_DIR / "putra-arif-munazar-nHylGvOf3Cg-unsplash.jpg"
FONT_PATH = IMAGES_DIR / "fonts" / "InterDisplay-Black.ttf"

TARGET_WIDTH = 1200
TARGET_HEIGHT = 630

# Crop tuning: the source is square and the target is 1.9:1, so cropping is unavoidable.
# We render the source at TARGET_WIDTH and then take a 630-tall slice.
# Choose a slice that preserves ~SKY_IN_OUTPUT px of sky above the tallest building,
# at the cost of cutting building bottoms (less iconic than roofs).
SKY_IN_OUTPUT = 200
# Measured: at 1200-wide scale, tallest building top sits at y=464 in the source.
BUILDING_TOP_Y = 464

# Wordmark text and colors
WORDMARK_MAIN = "tenanttriage"
WORDMARK_ACCENT = ".nyc"
COLOR_MAIN = (17, 17, 17)         # #111111
COLOR_ACCENT = (250, 112, 112)    # #fa7070

# Typography
FONT_SIZE = 96
LETTER_SPACING_PX = -2            # tiny tightening for display weight

# Default wordmark placement (upper-left)
PADDING_TOP = 40
PADDING_LEFT = 50

# Drop shadow (for the shadow variant)
SHADOW_COLOR = (0, 0, 0, 55)      # 55/255 alpha ~ 21%
SHADOW_OFFSET = (2, 3)
SHADOW_BLUR = 4


# ---------------------------------------------------------------------------
# Base image: crop to 1200x630 preserving buildings at full width
# ---------------------------------------------------------------------------

def build_base_image() -> Image.Image:
    """Load the source illustration, scale to 1200 wide, crop to a slice
    that preserves SKY_IN_OUTPUT px of sky above the tallest building."""
    src = Image.open(SOURCE_IMAGE).convert("RGB")
    scale = TARGET_WIDTH / src.width
    scaled_height = int(round(src.height * scale))
    src = src.resize((TARGET_WIDTH, scaled_height), Image.LANCZOS)
    # Crop window: start above the building tops by SKY_IN_OUTPUT, go down 630px
    top = max(0, BUILDING_TOP_Y - SKY_IN_OUTPUT)
    bottom = min(scaled_height, top + TARGET_HEIGHT)
    return src.crop((0, top, TARGET_WIDTH, bottom))


# ---------------------------------------------------------------------------
# Wordmark rendering
# ---------------------------------------------------------------------------

def _draw_text_with_spacing(draw: ImageDraw.ImageDraw, xy, text, font, fill, spacing_px: int):
    """Draw text character-by-character with extra tracking. Returns x after last glyph."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        bbox = font.getbbox(char)
        advance = bbox[2] - bbox[0] if bbox else 0
        x += advance + spacing_px
    return x


def _measure_wordmark(font, main: str, accent: str, spacing_px: int) -> tuple[int, int]:
    """Measure the full wordmark width and cap height."""
    full = main + accent
    total_w = 0
    for char in full:
        bbox = font.getbbox(char)
        total_w += (bbox[2] - bbox[0]) + spacing_px
    total_w -= spacing_px  # no trailing
    # Height: use ascent from font metrics
    ascent, _ = font.getmetrics()
    return total_w, ascent


def render_wordmark(base: Image.Image, origin: tuple[int, int], drop_shadow: bool = False) -> Image.Image:
    """Composite the wordmark onto the base image at `origin` (top-left of text)."""
    font = ImageFont.truetype(str(FONT_PATH), FONT_SIZE)
    canvas = base.convert("RGBA")

    if drop_shadow:
        shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        sx, sy = origin[0] + SHADOW_OFFSET[0], origin[1] + SHADOW_OFFSET[1]
        cur_x = _draw_text_with_spacing(shadow_draw, (sx, sy), WORDMARK_MAIN, font, SHADOW_COLOR, LETTER_SPACING_PX)
        _draw_text_with_spacing(shadow_draw, (cur_x, sy), WORDMARK_ACCENT, font, SHADOW_COLOR, LETTER_SPACING_PX)
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
        canvas = Image.alpha_composite(canvas, shadow_layer)

    text_draw = ImageDraw.Draw(canvas)
    cur_x = _draw_text_with_spacing(text_draw, origin, WORDMARK_MAIN, font, COLOR_MAIN, LETTER_SPACING_PX)
    _draw_text_with_spacing(text_draw, (cur_x, origin[1]), WORDMARK_ACCENT, font, COLOR_ACCENT, LETTER_SPACING_PX)

    return canvas.convert("RGB")


# ---------------------------------------------------------------------------
# Variant generation
# ---------------------------------------------------------------------------

def main():
    if not SOURCE_IMAGE.exists():
        raise SystemExit(f"Source image not found: {SOURCE_IMAGE}")
    if not FONT_PATH.exists():
        raise SystemExit(f"Font not found: {FONT_PATH}")

    base = build_base_image()
    font = ImageFont.truetype(str(FONT_PATH), FONT_SIZE)
    text_w, _ = _measure_wordmark(font, WORDMARK_MAIN, WORDMARK_ACCENT, LETTER_SPACING_PX)
    center_x = (TARGET_WIDTH - text_w) // 2

    variants = [
        ("og-card.png", (PADDING_LEFT, PADDING_TOP), False),
        ("og-card-shadow.png", (PADDING_LEFT, PADDING_TOP), True),
        ("og-card-centered.png", (center_x, PADDING_TOP), False),
    ]

    for filename, origin, shadow in variants:
        out = render_wordmark(base.copy(), origin, drop_shadow=shadow)
        out_path = IMAGES_DIR / filename
        out.save(out_path, "PNG", optimize=True)
        print(f"  wrote {out_path.relative_to(PROJECT_ROOT)} ({out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
