"""Generate PWA icons (192, 512, 180) from a programmatic design.

Requires Pillow:  pip install pillow

Output (all inside okr/icons/):
  icon-192.png         — general-purpose manifest icon
  icon-512.png         — general-purpose manifest icon (also maskable)
  apple-touch-icon.png — 180x180, iOS home screen

Design matches icons/icon.svg: gradient rounded square + white concentric target.
"""

import math
import os
from PIL import Image, ImageDraw

# ---------- Palette ----------
BG_TOP = (10, 132, 255)      # #0a84ff
BG_BOTTOM = (88, 86, 214)    # #5856d6
WHITE = (255, 255, 255, 255)


def make_master(size: int = 512) -> Image.Image:
    """Draw the icon on a transparent RGBA canvas at `size` px."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Rounded-square background (Apple-style ~23% radius)
    radius = int(size * 0.23)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255
    )

    # Diagonal gradient canvas
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gp = grad.load()
    top = BG_TOP + (255,)
    bottom = BG_BOTTOM + (255,)
    for y in range(size):
        # Blend vertically with a slight diagonal bias
        ty = y / max(1, size - 1)
        for x in range(size):
            tx = x / max(1, size - 1)
            t = (ty * 0.7 + tx * 0.3)
            r = int(top[0] * (1 - t) + bottom[0] * t)
            g = int(top[1] * (1 - t) + bottom[1] * t)
            b = int(top[2] * (1 - t) + bottom[2] * t)
            gp[x, y] = (r, g, b, 255)

    img.paste(grad, (0, 0), mask)

    # Concentric target rings
    draw = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    stroke = max(2, int(size * 0.043))
    outer_r = size * 0.293      # 150/512
    mid_r = size * 0.168       # 86/512
    dot_r = size * 0.055        # 28/512

    draw.ellipse(
        [cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r],
        outline=WHITE, width=stroke,
    )
    draw.ellipse(
        [cx - mid_r, cy - mid_r, cx + mid_r, cy + mid_r],
        outline=WHITE, width=stroke,
    )
    draw.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=WHITE,
    )

    return img


def resize_keep_rounded(master: Image.Image, size: int) -> Image.Image:
    """Downscale with high quality; keeps transparency."""
    return master.resize((size, size), Image.LANCZOS)


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(os.path.dirname(here), "icons")
    os.makedirs(out_dir, exist_ok=True)

    master = make_master(512)

    outputs = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,  # square, no rounded corners (iOS applies its own mask)
    }

    for name, target in outputs.items():
        img = resize_keep_rounded(master, target)
        # Apple touch icons must be a full square (no transparent corners) —
        # fill the corners with the top-left gradient color so they read cleanly
        # after iOS applies its own squircle mask.
        if "apple-touch" in name:
            flat = Image.new("RGBA", img.size, BG_TOP + (255,))
            flat.paste(img, (0, 0), img)
            img = flat

        path = os.path.join(out_dir, name)
        img.save(path, "PNG", optimize=True)
        print(f"wrote  {path}  ({img.size[0]}x{img.size[1]})")

    print("\nDone. Icons in:", out_dir)


if __name__ == "__main__":
    main()
