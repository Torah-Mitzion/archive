"""The link preview: the landing map, reduced, with the Torah MiTzion mark
floating over it. 1200x630, the size every messenger crops least.

    node scripts/og-geometry.mjs > og.json && python scripts/og-image.py og.json

Drawn from the same geometry as the page (land.js, map.js, the communities
in the database), so it is the map, not a picture of it."""
import json, math, sys, os, io
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
g = json.load(open(sys.argv[1], encoding='utf-8'))
W, H = g['W'], g['H']
SS = 2  # supersample
w, h = W * SS, H * SS

img = Image.new('RGB', (w, h), (7, 11, 22))
# a faint glow around Jerusalem, like the page's zion-glow
glow = Image.new('RGB', (w, h), (7, 11, 22))
gd = ImageDraw.Draw(glow)
jx, jy = g['jx'] * SS, g['jy'] * SS
for r, a in ((520, 18), (360, 26), (220, 36)):
    gd.ellipse([jx - r, jy - r, jx + r, jy + r], fill=(7 + a // 3, 11 + a // 2, 22 + a))
glow = glow.filter(ImageFilter.GaussianBlur(140))
img = Image.blend(img, glow, 0.9)

d = ImageDraw.Draw(img, 'RGBA')
# land stipple
for x, y in g['dots']:
    X, Y = x * SS, y * SS
    d.ellipse([X - 1.6 * SS, Y - 1.6 * SS, X + 1.6 * SS, Y + 1.6 * SS], fill=(51, 81, 138, 255))

# arcs from Jerusalem, bulging north, as on the page
def arc_pts(x, y):
    dx, dy = x - jx, y - jy
    ln = math.hypot(dx, dy) or 1
    sg = -1 if dx >= 0 else 1
    b = ln * 0.17
    qx = (jx + x) / 2 + sg * (-dy / ln) * b
    qy = (jy + y) / 2 + sg * (dx / ln) * b
    return [((1 - t) ** 2 * jx + 2 * (1 - t) * t * qx + t * t * x,
             (1 - t) ** 2 * jy + 2 * (1 - t) * t * qy + t * t * y) for t in [i / 40 for i in range(41)]]
for p in g['points']:
    d.line(arc_pts(p['x'] * SS, p['y'] * SS), fill=(232, 200, 125, 60), width=1 * SS)
for p in g['points']:
    X, Y = p['x'] * SS, p['y'] * SS
    if p['open']:
        d.ellipse([X - 9 * SS, Y - 9 * SS, X + 9 * SS, Y + 9 * SS], fill=(232, 200, 125, 40))
        d.ellipse([X - 4 * SS, Y - 4 * SS, X + 4 * SS, Y + 4 * SS], fill=(232, 200, 125, 255))
    else:
        d.ellipse([X - 3.5 * SS, Y - 3.5 * SS, X + 3.5 * SS, Y + 3.5 * SS], outline=(90, 112, 150, 255), width=SS)
# the star over Jerusalem
R = 17 * SS
star = [(jx, jy - R), (jx + R * 0.18, jy - R * 0.18), (jx + R, jy), (jx + R * 0.18, jy + R * 0.18),
        (jx, jy + R), (jx - R * 0.18, jy + R * 0.18), (jx - R, jy), (jx - R * 0.18, jy - R * 0.18)]
d.polygon(star, fill=(251, 239, 207, 255))

# a dark band behind the mark and the words, so they float rather than compete
band = Image.new('RGBA', (w, h), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
bd.rounded_rectangle([w * 0.30, h * 0.20, w * 0.70, h * 0.80], radius=28 * SS, fill=(7, 11, 22, 200))
band = band.filter(ImageFilter.GaussianBlur(30))
img.paste(band, (0, 0), band)

# the mark
mark = Image.open(os.path.join(ROOT, 'docs/tmz-mark.png')).convert('RGBA')
mw = int(w * 0.16)
mark = mark.resize((mw, int(mark.height * mw / mark.width)), Image.LANCZOS)
img.paste(mark, (w // 2 - mw // 2, int(h * 0.22)), mark)

# words, in the site's serif when it can be read
def font(size, family='FrankRuhlLibre-400', fallback_bold=False):
    path = os.path.join(ROOT, 'docs/fonts')
    for cand in (f'{family}-hebrew.ttf', f'{family}-latin.ttf'):
        p = os.path.join(path, cand)
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    try: return ImageFont.truetype('arial.ttf', size)
    except Exception: return ImageFont.load_default()

def woff2_to_ttf(name):
    src = os.path.join(ROOT, 'docs/fonts', name + '.woff2'); dst = os.path.join(ROOT, 'docs/fonts', name + '.ttf')
    if os.path.exists(dst) or not os.path.exists(src): return
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(src); f.flavor = None; f.save(dst)
    except Exception as e:
        print('font conversion skipped:', e)
for n in ('FrankRuhlLibre-400-hebrew', 'FrankRuhlLibre-400-latin', 'FrankRuhlLibre-300-latin', 'Heebo-400-hebrew', 'Heebo-500-latin'):
    woff2_to_ttf(n)

def centred(text, y, f, fill):
    bb = d.textbbox((0, 0), text, font=f)
    d.text(((w - (bb[2] - bb[0])) / 2 - bb[0], y), text, font=f, fill=fill)

d = ImageDraw.Draw(img, 'RGBA')
# PIL lays text out left to right with no bidi pass, so the Hebrew is handed
# over already in visual order (and without vowel points, which reversal would
# detach from their letters).
centred('כי מציון תצא תורה'[::-1], int(h * 0.55), font(int(32 * SS), 'FrankRuhlLibre-400'), (240, 237, 228, 255))
centred('Torah MiTzion  ·  30 years in photographs  ·  1996–2026', int(h * 0.66), font(int(17 * SS), 'Heebo-500'), (232, 200, 125, 255))

out = img.resize((W, H), Image.LANCZOS)
dst = os.path.join(ROOT, 'docs/og-image.jpg')
out.save(dst, quality=88, optimize=True)
print(dst, os.path.getsize(dst) // 1024, 'KB')
