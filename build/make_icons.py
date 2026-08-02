# -*- coding: utf-8 -*-
"""Draw the Mílù app icons with PIL.

Run:  python3 build/make_icons.py
Writes PNGs into ../icons/. Everything is drawn at 4x and downsampled so the
curves come out smooth.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(os.path.dirname(HERE), "icons")
os.makedirs(ICONS, exist_ok=True)

SS = 4                      # supersampling factor
BASE = 512                  # design canvas
C = BASE * SS

FUR       = (233, 168, 104)
FUR_DARK  = (216, 145,  78)
CREAM     = (251, 231, 206)
ANTLER    = (192, 128,  72)
INK       = ( 59,  42,  33)
BLUSH     = (255, 158, 142)
WHITE     = (255, 255, 255)
BG_TOP    = (255, 244, 230)
BG_BOTTOM = (255, 221, 186)


def gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        f = y / max(1, size - 1)
        d.point((0, y), fill=(
            round(top[0] + (bottom[0] - top[0]) * f),
            round(top[1] + (bottom[1] - top[1]) * f),
            round(top[2] + (bottom[2] - top[2]) * f)))
    return img.resize((size, size))


def rotated_ellipse(canvas, box, angle, fill, centre):
    """PIL can't rotate an ellipse in place, so draw it on its own layer."""
    x0, y0, x1, y1 = box
    w, h = int(x1 - x0), int(y1 - y0)
    pad = int(max(w, h) * 0.6)
    layer = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([pad, pad, pad + w, pad + h], fill=fill)
    layer = layer.rotate(angle, resample=Image.BICUBIC, center=(pad + w / 2, pad + h / 2))
    canvas.alpha_composite(layer, (int(centre[0] - (w / 2 + pad)),
                                   int(centre[1] - (h / 2 + pad))))


def thick_curve(draw, points, width, fill):
    """A polyline with genuinely round joints and caps — PIL's `joint="curve"`
    still leaves notches on tight bends, so stamp a disc at every vertex."""
    draw.line(points, fill=fill, width=width)
    r = width / 2
    for (x, y) in points:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def bezier(p0, p1, p2, steps=26):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append((u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]))
    return out


def draw_deer(canvas, scale):
    """Draw the deer on an RGBA canvas of size C, centred on its real extent.

    In the 120-unit mascot box the figure runs from y≈10 (antler tips) to y≈93
    (chin), so anchoring on the head centre at y=62 leaves it sitting high.
    Offsetting by half that difference puts the whole animal in the middle."""
    d = ImageDraw.Draw(canvas)
    cx = C / 2
    S = C * scale / 120.0          # the SVG mascot uses a 120-unit box
    cy = C / 2 + 10.5 * S

    def P(x, y):
        return (cx + (x - 60) * S, cy + (y - 62) * S)

    aw = max(2, int(5.4 * S))

    # antlers
    for pts in (((45, 32), (41, 20), (37, 10)),
                ((41.5, 21), (34, 18.5), (28, 13)),
                ((75, 32), (79, 20), (83, 10)),
                ((78.5, 21), (86, 18.5), (92, 13))):
        curve = [P(*p) for p in bezier(*pts)]
        thick_curve(d, curve, aw, ANTLER)

    # ears
    rotated_ellipse(canvas, [0, 0, 19 * S, 27 * S], 24, FUR_DARK, P(26, 52))
    rotated_ellipse(canvas, [0, 0, 10 * S, 17 * S], 24, CREAM,    P(27, 52))
    rotated_ellipse(canvas, [0, 0, 19 * S, 27 * S], -24, FUR_DARK, P(94, 52))
    rotated_ellipse(canvas, [0, 0, 10 * S, 17 * S], -24, CREAM,    P(93, 52))

    d = ImageDraw.Draw(canvas)

    def ell(x, y, rx, ry, fill):
        a, b = P(x - rx, y - ry)
        c_, e = P(x + rx, y + ry)
        d.ellipse([a, b, c_, e], fill=fill)

    # head
    ell(60, 62, 33, 31, FUR)

    # forehead spots
    for (x, y, rx, ry) in ((49, 41, 3.4, 2.6), (60, 37, 2.8, 2.2), (71, 41, 3.4, 2.6)):
        ell(x, y, rx, ry, (247, 220, 190))

    # muzzle + nose
    ell(60, 76, 18, 14, CREAM)
    ell(60, 70, 5.4, 4.0, INK)

    # blush
    ell(36, 70, 6.5, 4.2, (255, 197, 186))
    ell(84, 70, 6.5, 4.2, (255, 197, 186))

    # happy closed eyes  ^  ^
    ew = max(2, int(3.6 * S))
    for x in (47, 73):
        curve = [P(*p) for p in bezier((x - 6, 59), (x, 51), (x + 6, 59))]
        thick_curve(d, curve, ew, INK)

    # smile
    curve = [P(*p) for p in bezier((53, 79), (60, 87), (67, 79))]
    thick_curve(d, curve, max(2, int(3.0 * S)), INK)


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius, fill=255)
    return m


def build(scale, bg=True, radius=None):
    canvas = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    if bg:
        canvas.paste(gradient(C, BG_TOP, BG_BOTTOM).convert("RGBA"), (0, 0))
    draw_deer(canvas, scale)
    img = canvas.resize((BASE, BASE), Image.LANCZOS)
    if radius:
        img.putalpha(rounded_mask(BASE, radius))
    return img


def main():
    # Standard icon: deer fills most of the square (iOS rounds it itself).
    icon = build(scale=1.16)

    # Maskable: must survive a circular crop at 80% diameter, so keep the
    # figure's diagonal comfortably inside that.
    maskable = build(scale=0.78)

    outputs = [
        ("icon-1024.png", icon, 1024),
        ("icon-512.png",  icon, 512),
        ("icon-192.png",  icon, 192),
        ("icon-180.png",  icon, 180),
        ("icon-152.png",  icon, 152),
        ("icon-120.png",  icon, 120),
        ("favicon-64.png", icon, 64),
        ("icon-maskable-512.png", maskable, 512),
        ("icon-maskable-192.png", maskable, 192),
    ]
    for name, src, size in outputs:
        out = src.resize((size, size), Image.LANCZOS).convert("RGB")
        path = os.path.join(ICONS, name)
        out.save(path, "PNG", optimize=True)
        print(f"   {name:26} {size}×{size}  {os.path.getsize(path)/1024:.0f} KB")

    # Transparent version for use inside the app if ever needed.
    trans = build(scale=1.16, bg=False).resize((512, 512), Image.LANCZOS)
    trans.save(os.path.join(ICONS, "deer-512.png"), "PNG", optimize=True)
    print("   deer-512.png (transparent)")


if __name__ == "__main__":
    main()
