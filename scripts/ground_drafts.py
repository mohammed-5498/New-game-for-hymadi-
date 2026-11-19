# مسودات الرصيف والحافة لكل مدينة (GAME_SPEC 18.10أ): صورتان في حزمة كل مدينة يحسّنهما المستخدم بعدها:
#   cities/<المدينة>/ground/sidewalk.webp  بلاط الرصيف: معيّن مربع كامل بمقاس صور الأرض (197×98، الارتكاز وسطه)
#   cities/<المدينة>/ground/curb.webp      وجه الحافة القائم كما يُرى من الأمام: عرضه ضلع مربع واحد وارتفاعه ارتفاع الرصيف
# المسودة من صور المدينة نفسها: الرصيف من بلاط ساحتها (plaza) أفتح ببلاطات أصغر، والحافة حجارة من لونه أغمق.
# pack_atlases.py يقطّع الصورتين قطعاً (شرائط الرصيف وأركانه، ووجوه الحافة المائلة) في أطلس المدينة.
#   python3 scripts/ground_drafts.py            المدن كلها، ولا يكتب فوق صورة موجودة
#   python3 scripts/ground_drafts.py --force cairo rothenburg
import json
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'map')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
force = '--force' in sys.argv
man = json.load(open(os.path.join(ROOT, 'manifest.json')))
px, drop = man['pxPerUnit'], man['relief']['drop']
EDGE = round(math.hypot(18, 9) * px)          # طول ضلع المربع بالبكسل (وجه الحافة لمربع واحد)
HIGH = round(drop * px)                       # ارتفاع الحافة بالبكسل


def avg(im):
    a = im.split()[3]
    rgb = Image.new('RGB', im.size)
    rgb.paste(im.convert('RGB'), mask=a)
    n = max(1, sum(1 for v in a.getdata() if v > 128))
    s = [0, 0, 0]
    for (r, g, b), al in zip(rgb.getdata(), a.getdata()):
        if al > 128: s[0] += r; s[1] += g; s[2] += b
    return tuple(c / n for c in s)


def sidewalk(plaza):
    """بلاط الساحة أفتح قليلاً، وفوقه مفاصل بلاطات (خمس على كل ضلع) بخط داكن ولمعة فاتحة تحته"""
    im = plaza.convert('RGBA')
    w, h = im.size
    r, g, b, a = im.split()
    lift = lambda v: min(255, round(v * 1.06 + 10))
    im = Image.merge('RGBA', [r.point(lift), g.point(lift), b.point(lift), a])
    ax, ay, hw, hh = w / 2, h / 2, 18 * px, 9 * px
    P = lambda u, v: (ax + (u - v) * hw, ay + (u + v - 1) * hh)
    lines = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lines)
    for k in range(1, 5):
        t = k / 5
        d.line([P(t, 0), P(t, 1)], fill=(0, 0, 0, 52), width=1)
        d.line([P(0, t), P(1, t)], fill=(0, 0, 0, 52), width=1)
        d.line([(x, y + 1) for x, y in (P(t, 0), P(t, 1))], fill=(255, 255, 255, 26), width=1)
        d.line([(x, y + 1) for x, y in (P(0, t), P(1, t))], fill=(255, 255, 255, 26), width=1)
    out = Image.alpha_composite(im, lines)
    out.putalpha(a)
    return out


def curb(base, seed):
    """حجارة حافة بلون الرصيف أغمق: غطاء فاتح أعلاها، ومفصل بين الحجارة كل خُمس ضلع، وظل أسفلها"""
    rnd = random.Random(seed)
    stone = tuple(round(c * 0.66) for c in base)
    im = Image.new('RGBA', (EDGE, HIGH), stone + (255,))
    d = ImageDraw.Draw(im)
    for y in range(HIGH):
        k = 1.0 + (0.22 if y < 3 else 0) - max(0, y - HIGH + 4) * 0.07
        d.line([(0, y), (EDGE, y)], fill=tuple(min(255, round(c * k)) for c in stone) + (255,))
    for x in range(EDGE):                      # حبيبات الحجر
        for y in range(3, HIGH):
            if rnd.random() < 0.18:
                v = im.getpixel((x, y))
                j = rnd.choice((-10, -6, 6, 9))
                im.putpixel((x, y), tuple(max(0, min(255, c + j)) for c in v[:3]) + (255,))
    for k in range(5):
        x = round(k * EDGE / 5)
        d.line([(x, 3), (x, HIGH)], fill=tuple(round(c * 0.62) for c in stone) + (255,))
        d.line([(x + 1, 3), (x + 1, HIGH)], fill=tuple(min(255, round(c * 1.12)) for c in stone) + (255,))
    d.line([(0, 2), (EDGE, 2)], fill=tuple(min(255, round(c * 1.35)) for c in stone) + (255,))
    return im.filter(ImageFilter.SMOOTH)


for city, entry in man['cities'].items():
    if args and city not in args: continue
    folder = os.path.join(ROOT, 'cities', city, 'ground')
    plaza = next((r for r in entry['images'] if r['group'] == 'ground' and r['kind'] == 'plaza'), None)
    if plaza is None: print(city, 'بلا صورة ساحة: تُركت'); continue
    src = Image.open(os.path.join(ROOT, plaza['file']))
    for kind, make in (('sidewalk', lambda: sidewalk(src)), ('curb', lambda: curb(avg(sidewalk(src)), city))):
        path = os.path.join(folder, kind + '.webp')
        rel = os.path.relpath(path, ROOT)
        if force or not os.path.exists(path):
            make().save(path, 'WEBP', lossless=True)
        im = Image.open(path)
        rec = {'file': rel, 'w': im.width, 'h': im.height, 'ax': im.width / 2 if kind == 'sidewalk' else 0,
               'ay': im.height / 2 if kind == 'sidewalk' else 0, 'group': 'ground', 'kind': kind}
        entry['images'] = [r for r in entry['images'] if r['file'] != rel] + [rec]
    print(city, 'sidewalk + curb')
json.dump(man, open(os.path.join(ROOT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
