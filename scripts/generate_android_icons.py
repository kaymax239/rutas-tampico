#!/usr/bin/env python3
"""Genera ic_launcher / round / foreground desde public/icon-512.png"""
from pathlib import Path
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Instala Pillow: py -m pip install pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "icon-512.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
NAVY = (15, 45, 92, 255)

if not SRC.exists():
    print("No esta", SRC)
    sys.exit(1)

base = Image.open(SRC).convert("RGBA")

def square(size, pad=0.08):
    canvas = Image.new("RGBA", (size, size), NAVY)
    inner = int(size * (1 - 2 * pad))
    logo = base.resize((inner, inner), Image.Resampling.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(logo, (off, off), logo)
    return canvas

def circle(im):
    s = im.size[0]
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).ellipse((1, 1, s - 2, s - 2), fill=255)
    out = im.copy()
    out.putalpha(m)
    return out

def foreground(size):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.66)
    logo = base.resize((inner, inner), Image.Resampling.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(logo, (off, off), logo)
    return canvas

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FG = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

for dens, px in SIZES.items():
    d = RES / f"mipmap-{dens}"
    d.mkdir(parents=True, exist_ok=True)
    ic = square(px)
    ic.save(d / "ic_launcher.png")
    circle(ic).save(d / "ic_launcher_round.png")
    print("ok", d / "ic_launcher.png")

for dens, px in FG.items():
    d = RES / f"mipmap-{dens}"
    foreground(px).save(d / "ic_launcher_foreground.png")
    print("ok", d / "ic_launcher_foreground.png")

print("Listo. Revisa un PNG en android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png")
