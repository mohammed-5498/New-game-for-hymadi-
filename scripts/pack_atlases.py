# أطلس لكل مدينة للنسخة الجديدة (القسم 18.1): صور الحزمة (flutter_game/assets/map/cities/) في صورة واحدة،
# فيحمّل الجوال صورة واحدة لكل مدينة، ويرسمها كرت الشاشة بأمر واحد بمستويات تصغير (mipmaps) فلا تتلألأ عند الإبعاد.
# بعد استبدال أي صورة في الحزمة (أو إعادة تصديرها): python3 scripts/pack_atlases.py
# المخرجات: flutter_game/assets/map/atlas/<المدينة>.webp و.json (مستطيل كل صورة في الأطلس ونقطة ارتكازها ونوعها)
import json
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'map')
OUT = os.path.join(ROOT, 'atlas')
WIDTH = 2048      # عرض الأطلس (والحد 4096 للضلع: كل الجوالات تقبله)
PAD = 6           # فراغ شفاف حول كل صورة: لا تختلط الجارتان في مستويات التصغير
META = ('group', 'kind', 'variant', 'size', 'level', 'footprint', 'up')

man = json.load(open(os.path.join(ROOT, 'manifest.json')))
PX = man['pxPerUnit']
RELIEF = man.get('relief')


def relief(sidewalk, curb):
    """قطع الأرض البارزة (18.10أ) من صورتي الرصيف والحافة: شرائط الرصيف على أضلاع المربع الأربعة وأركانه الأربعة
    (من معيّن البلاط نفسه، فتتصل بلاطاته من مربع لآخر)، ووجوه الحافة المائلة لخُمس ضلع: face_i للوجه الأيمن الأمامي
    (أغمق، الضلع +i) وface_j للأيسر (الضلع +j)، كل منها خمس قطع متتالية من صورة الحافة. ارتكاز الشرائط وسط المربع،
    والوجه أعلى طرفه الأبعد (أول الضلع)، وكلها بفيض نصف بكسل فلا تظهر خطوط بين القطع"""
    sub, drop = RELIEF['sub'], RELIEF['drop']
    hw, hh, f = 18 * PX, 9 * PX, 1 / sub
    out = []
    ax, ay = sidewalk.width / 2, sidewalk.height / 2
    P = lambda u, v: (ax + (u - v) * hw, ay + (u + v - 1) * hh)
    for kind, (u0, u1, v0, v1) in {'top_a0': (0, f, 0, 1), 'top_a4': (1 - f, 1, 0, 1), 'top_b0': (0, 1, 0, f), 'top_b4': (0, 1, 1 - f, 1),
                                   'top_c00': (0, f, 0, f), 'top_c40': (1 - f, 1, 0, f), 'top_c04': (0, f, 1 - f, 1), 'top_c44': (1 - f, 1, 1 - f, 1)}.items():
        poly = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]
        x0, y0 = math.floor(min(p[0] for p in poly)) - 1, math.floor(min(p[1] for p in poly)) - 1
        x1, y1 = math.ceil(max(p[0] for p in poly)) + 1, math.ceil(max(p[1] for p in poly)) + 1
        big = 4                                                      # القناع بدقة أعلى ثم يُصغَّر: حواف ناعمة
        mask = Image.new('L', ((x1 - x0) * big, (y1 - y0) * big), 0)
        ImageDraw.Draw(mask).polygon([((x - x0) * big, (y - y0) * big) for x, y in poly], fill=255)
        mask = mask.filter(ImageFilter.MaxFilter(3)).resize((x1 - x0, y1 - y0), Image.LANCZOS)
        piece = sidewalk.crop((x0, y0, x1, y1))
        a = ImageChops.multiply(piece.split()[3], mask)
        piece.putalpha(a)
        out.append(({'group': 'relief', 'kind': kind, 'w': piece.width, 'h': piece.height, 'ax': ax - x0, 'ay': ay - y0}, piece))
    w, dh, H = f * hw, f * hh, drop * PX
    cw, ch = curb.size
    for side in ('i', 'j'):
        shade = 0.8 if side == 'i' else 1.0                           # الضوء من اليسار كصور المباني
        W, Ht = math.ceil(w) + 2, math.ceil(dh + H) + 2
        for s in range(sub):
            piece = Image.new('RGBA', (W, Ht), (0, 0, 0, 0))
            p0 = (1 + w, 1) if side == 'i' else (1, 1)                  # أول الضلع: الأيمن يمتد يساراً ونزولاً، والأيسر يميناً ونزولاً
            pix = piece.load()
            for py in range(Ht):
                for px_ in range(W):
                    acc = [0.0, 0.0, 0.0, 0.0]
                    for sy in (0.25, 0.75):
                        for sx in (0.25, 0.75):
                            X, Y = px_ + sx, py + sy
                            t = (p0[0] - X) / w if side == 'i' else (X - p0[0]) / w
                            z = Y - p0[1] - t * dh
                            if not (-0.06 <= t <= 1.06 and -0.6 <= z <= H): continue
                            tx = ((s + min(max(t, 0), 1)) / sub * cw) % cw
                            ty = min(ch - 1, max(0, z / H * ch))
                            c = curb.getpixel((min(cw - 1, int(tx)), min(ch - 1, int(ty))))
                            for q in range(3): acc[q] += c[q] * shade
                            acc[3] += c[3]
                    if acc[3] > 0:
                        n = acc[3] / 255
                        pix[px_, py] = (round(acc[0] / n), round(acc[1] / n), round(acc[2] / n), round(acc[3] / 4))
            out.append(({'group': 'relief', 'kind': f'face_{side}{s}', 'w': W, 'h': Ht, 'ax': p0[0], 'ay': p0[1]}, piece))
    return out


def platform(im):
    """سُمك منصة المبنى المميز (18.10، بطلب المستخدم: "تقص أرضيتها وتترك المبنى"): أسفل الصورة حافتا المنصة على
    شكل V، وفوقهما وجهاها الجانبيان ثم سطحها الأفتح. لكل عمود على الحافة: أول قفزة إضاءة صعوداً من أسفله، والسُمك
    وسيطها. يعيد (أسفل الصورة، عمود رأس V، السُمك) أو None بلا منصة واضحة"""
    w, h = im.size
    px = im.load()
    lum = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
    low = [max((y for y in range(h) if px[x, y][3] > 128), default=-1) for x in range(w)]
    bottom = max(low)
    cand = [x for x in range(w) if low[x] >= bottom - 1]
    cx = cand[len(cand) // 2]
    xs = [x for x in range(w) if low[x] >= 0]
    ds = []
    for x in list(range(xs[0] + 6, cx - 8, 2)) + list(range(cx + 8, xs[-1] - 6, 2)):
        y0 = low[x]
        if abs(y0 - (bottom - abs(x - cx) * 0.5)) > 4: continue      # حافة المنصة وحدها (ميلها نصف)
        best, at = 0, None
        for d in range(4, 34):
            y = y0 - d
            if y < 1 or px[x, y][3] < 200: break
            j = lum(px[x, y - 1]) - lum(px[x, y + 1])
            if j > best: best, at = j, d
        if at and best > 18: ds.append(at)
    if len(ds) < 6: return None
    t = sorted(ds)[len(ds) // 2]
    return None if t < 6 else (bottom, cx, min(t, FLAT_MAX))


FLAT_MAX = 18      # الأبراج الرفيعة تُقرأ أسمك من حقيقتها: لا يُقص أكثر من هذا


def flatten(im, cut):
    """يُمحى ما تحت حافتي سطح المنصة الأماميتين (وجهاها الجانبيان وظلها)، بحافة ناعمة بكسلاً"""
    bottom, cx, t = cut
    im = im.copy()
    px = im.load()
    for x in range(im.width):
        lim = bottom - t - abs(x - cx) * 0.5
        for y in range(max(0, int(lim)), im.height):
            k = min(1.0, max(0.0, y - lim))
            if k > 0:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, round(a * (1 - k)))
    return im


os.makedirs(OUT, exist_ok=True)
for city, entry in man['cities'].items():
    # الزينة والعلامات العامة (18.6، manifest.common) في كل أطلس، إلا ما للمدينة صورة منه
    own = {(r['group'], r['kind']) for r in entry['images']}
    images = entry['images'] + [r for r in man.get('common', {}).get('images', []) if (r['group'], r['kind']) not in own]
    # صورتا الرصيف والحافة لا تدخلان الأطلس: قطعهما (relief) تدخل مكانهما
    src = {r['kind']: Image.open(os.path.join(ROOT, r['file'])).convert('RGBA') for r in images
           if r['group'] == 'ground' and r['kind'] in ('sidewalk', 'curb')}
    images = [r for r in images if not (r['group'] == 'ground' and r['kind'] in ('sidewalk', 'curb'))]
    made = relief(src['sidewalk'], src['curb']) if RELIEF and len(src) == 2 else []
    images += [dict(r, file=f'relief/{r["kind"]}', _img=im) for r, im in made]
    # المباني المميزة (المعابد والمرتزقة ومباني المدن) بلا جانبي منصتها، وتنزل بسُمكها فيقع سطحها على الأرض
    for n, r in enumerate(images):
        if r['group'] != 'feature' or not RELIEF: continue
        im = Image.open(os.path.join(ROOT, r['file'])).convert('RGBA')
        cut = platform(im)
        if cut is None: continue
        r = images[n] = dict(r, _img=flatten(im, cut), ay=r['ay'] - cut[2])
        if r.get('owner'):
            images[n]['_owner'] = flatten(Image.open(os.path.join(ROOT, r['owner'])).convert('RGBA'), cut)
    # قناع رايات المالك (owner) صورة بجانب صورته في الأطلس، بمقاسها نفسه
    recs = images + [{'file': r['owner'], 'w': r['w'], 'h': r['h'], '_of': r, **({'_img': r['_owner']} if '_owner' in r else {})}
                     for r in images if r.get('owner')]
    recs = sorted(recs, key=lambda r: -r['h'])
    x, y, row = PAD, PAD, 0
    for r in recs:
        if x + r['w'] + PAD > WIDTH:
            x, y, row = PAD, y + row + PAD, 0
        r['_at'] = (x, y)
        x += r['w'] + PAD
        row = max(row, r['h'])
    height = y + row + PAD
    assert height <= 4096, f'{city}: الأطلس أعلى من 4096'
    atlas = Image.new('RGBA', (WIDTH, height), (0, 0, 0, 0))
    sprites = []
    for r in recs:
        im = r['_img'] if '_img' in r else Image.open(os.path.join(ROOT, r['file'])).convert('RGBA')
        atlas.paste(im, r['_at'])
    for r in recs:
        if '_of' in r: continue
        key = r['file'] if r['file'].startswith('relief/') else r['file'].split('/', 2)[2].rsplit('.', 1)[0]
        s = {'key': key, **{k: r[k] for k in META if k in r}, 'r': [r['_at'][0], r['_at'][1], r['w'], r['h'], r['ax'], r['ay']]}
        m = next((o['_at'] for o in recs if o.get('_of') is r), None)
        if m: s['m'] = list(m)
        sprites.append(s)
    atlas.save(os.path.join(OUT, city + '.webp'), 'WEBP', quality=85, method=6)
    json.dump({'name': entry['name'], 'scale': entry['scale'], 'colors': entry['colors'], 'pxPerUnit': man['pxPerUnit'],
               'relief': RELIEF['drop'] if made else 0, 'size': [WIDTH, height], 'sprites': sprites},
              open(os.path.join(OUT, city + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(city, len(sprites), f'{WIDTH}x{height}', os.path.getsize(os.path.join(OUT, city + '.webp')) // 1024, 'KB')
