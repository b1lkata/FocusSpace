"""Regenerate Windows icon assets from the geometry in build/icon.svg.

Optional maintainer command: python scripts/generate-icons.py (requires Pillow).
Generated PNG/ICO files are checked in; ordinary npm builds need no Python.
"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent / 'build'
scale = 4
size = 256 * scale
image = Image.new('RGBA', (size, size))
gradient = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(gradient)
start, end = (183, 167, 255), (104, 86, 203)
for y in range(size):
    for x in range(size):
        t = (x + y) / (2 * (size - 1))
        draw.point((x, y), fill=tuple(round(a + (b - a) * t) for a, b in zip(start, end)) + (255,))
mask = Image.new('L', (size, size))
ImageDraw.Draw(mask).rounded_rectangle(tuple(v * scale for v in (24, 16, 232, 240)), 48 * scale, fill=255)
image.paste(gradient, (0, 0), mask)
layer = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(layer)
draw.rounded_rectangle(tuple(v * scale for v in (57, 43, 199, 213)), 20 * scale,
                       fill=(255, 255, 255, 15), outline=(255, 255, 255, 64), width=3 * scale)
image = Image.alpha_composite(image, layer)
ImageDraw.Draw(image).polygon([(x * scale, y * scale) for x, y in
                              [(82, 67), (180, 67), (180, 94), (113, 94), (113, 125),
                               (170, 125), (170, 152), (113, 152), (113, 191), (82, 191)]],
                             fill='white')
image.resize((512, 512), Image.Resampling.LANCZOS).save(root / 'icon.png')
image.save(root / 'icon.ico', sizes=[(s, s) for s in [16, 20, 24, 32, 40, 48, 64, 128, 256]])
print('Generated build/icon.png and build/icon.ico')
