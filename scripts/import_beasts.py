# الترول الثلجي والفارس الأسود (حزمتا المستخدم، 2.2.1) إلى صور أطلس الجنود وإطارات حركاتها:
#   python3 -I scripts/import_beasts.py <مجلد GangCity-Ice-Troll-Rigged> <مجلد Black-Knight-Animations>
# المخرجات: flutter_game/assets/units/ice_troll.png وblack_knight.png (القطع مصغّرة إلى ما يُرسم به وأغمق بطلبه، وتحتها
# نصف شفاف مكان قناع الصبغ: لا تُصبغ بلون اللاعب)، وflutter_game/lib/data/beast_frames.dart (لكل حركة إطاراتها:
# مكان مفصل كل قطعة وزاويتها، بترتيب رسمها). الترول من إطاراته الجاهزة، والفارس من knight.js (scripts/knight_frames.cjs)
import json
import math
import os
import subprocess
import sys

from PIL import Image

TROLL, KNIGHT = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
UNITS = os.path.join(ROOT, 'flutter_game', 'assets', 'units')
FPS = 15
# بكسل الأطلس لكل وحدة رسم (الترول بوحدات هيكله، والفارس ببكسل رسمه الأصلي)، وغمق الألوان (ضرب في اللون)،
# وارتفاع الشخصية في العالم (الترول بارتفاعه القديم، وشريط دمه عند −44؛ والفارس زعيم أطول من الجندي)
SPEC = {'ice_troll': {'px': 12, 'dark': 0.65, 'height': 42}, 'black_knight': {'px': 0.3, 'dark': 0.78, 'height': 21}}


def darken(im, k):
    r, g, b, a = im.split()
    return Image.merge('RGBA', [c.point(lambda v: round(v * k)) for c in (r, g, b)] + [a])


def pack(images, width=1024, pad=3):
    """رفوف بسيطة: مكان كل صورة في اللوح، وارتفاعه"""
    order = sorted(range(len(images)), key=lambda k: -images[k].height)
    at, x, y, row = [None] * len(images), pad, pad, 0
    for k in order:
        im = images[k]
        if x + im.width + pad > width: x, y, row = pad, y + row + pad, 0
        at[k] = (x, y)
        x += im.width + pad
        row = max(row, im.height)
    return at, y + row + pad


def sheet(name, images):
    """لوح القطع ونصفه الأسفل شفاف (قناع صبغ فارغ، كألواح الشخصيات في unit_atlas.dart)"""
    at, h = pack(images)
    out = Image.new('RGBA', (1024, 2 * h), (0, 0, 0, 0))
    for im, p in zip(images, at): out.paste(im, p)
    out.save(os.path.join(UNITS, name + '.png'), optimize=True)
    return at, h


def troll():
    s = SPEC['ice_troll']
    rig = json.load(open(os.path.join(TROLL, 'rigs', 'ice_troll.json')))
    anim = json.load(open(os.path.join(TROLL, 'animations', 'ice_troll.json')))
    src = Image.open(os.path.join(TROLL, 'assets', 'sheets', 'ice_troll.png')).convert('RGBA')
    first = anim['clips']['idle']['frames'][0]['sprites']
    names = [p['name'] for p in first]                       # ترتيب الرسم
    size = {p['name']: (p['width'], p['height'], p['pivot']) for p in first}
    imgs = []
    for n in names:
        q = rig['parts'][n]
        w, h, _ = size[n]
        part = src.crop((q['x'], q['y'], q['x'] + q['w'], q['y'] + q['h']))
        imgs.append(darken(part.resize((max(1, round(w * s['px'])), max(1, round(h * s['px']))), Image.LANCZOS), s['dark']))
    at, sh = sheet('ice_troll', imgs)
    parts = [[at[k][0], at[k][1], imgs[k].width, imgs[k].height, size[n][2][0] * imgs[k].width, size[n][2][1] * imgs[k].height]
             for k, n in enumerate(names)]
    clips, top = {}, 0
    for cid, c in anim['clips'].items():
        rate, frames = c['sampleRate'], c['frames']
        n = round(c['duration'] * FPS)
        data = []
        for f in range(n if c['loop'] else n + 1):
            fr = frames[min(len(frames) - 1, round(f / FPS * rate))]
            ra, fo = fr['rootRotation'], fr['floorOffset']
            by = {p['name']: p for p in fr['sprites']}
            for nm in names:
                p = by[nm]
                x, y = p['position']
                X, Y = x * math.cos(ra) - y * math.sin(ra), x * math.sin(ra) + y * math.cos(ra) + fo
                data += [round(X, 3), round(Y, 3), round(p['angle'] + ra, 4)]
                if cid == 'idle': top = min(top, Y - size[nm][1])
        clips[cid] = (c['duration'], c['loop'], data)
    return {'sheet': 'ice_troll', 'h': sh, 'unit': 1 / s['px'], 'world': s['height'] / -top, 'parts': parts, 'clips': clips}


def knight():
    s = SPEC['black_knight']
    raw = json.loads(subprocess.run(['node', os.path.join(ROOT, 'scripts', 'knight_frames.cjs'), KNIGHT, str(FPS)],
                                    capture_output=True, check=True, text=True).stdout)
    rig = raw['rig']
    names = list(raw['clips']['idle']['frames'][0].keys())  # ترتيب الرسم (order في knight.js)
    imgs = []
    for n in names:
        im = Image.open(os.path.join(KNIGHT, 'parts', n + '.png')).convert('RGBA')
        imgs.append(darken(im.resize((max(1, round(im.width * s['px'])), max(1, round(im.height * s['px']))), Image.LANCZOS), s['dark']))
    at, sh = sheet('black_knight', imgs)
    parts = [[at[k][0], at[k][1], imgs[k].width, imgs[k].height, rig[n][0] * s['px'], rig[n][1] * s['px']] for k, n in enumerate(names)]
    clips, top = {}, 0
    for cid in ('idle', 'walk', 'attack', 'death', 'block', 'stagger'):
        c = raw['clips'][cid]
        data = []
        for fr in c['frames']:
            for n in names:
                (x, y), a = fr[n]
                data += [round(x, 1), round(y, 1), round(math.radians(a), 4)]
        clips[cid] = (c['duration'], c['loop'], data)
    for n in names:   # أعلى نقطة في الوقوف: قمة الخوذة وريشتها
        (x, y), a = raw['clips']['idle']['frames'][0][n]
        top = min(top, y - rig[n][1])
    return {'sheet': 'black_knight', 'h': sh, 'unit': 1 / s['px'], 'world': s['height'] / -top, 'parts': parts, 'clips': clips}


def dart(beasts):
    lines = ['// مولّد من scripts/import_beasts.py (حزمتا الترول الثلجي والفارس الأسود): لا تعدّله باليد.',
             '// لكل شخصية: لوحها في أطلس الجنود (src وارتفاع نصفه h)، وقطعها بترتيب الرسم [x, y, w, h, مفصلها x, y] في اللوح،',
             '// ووحدة الرسم لكل بكسل لوح (unit)، والعالم لكل وحدة رسم (world)، ولكل حركة: مدتها وتكرارها وإطاراتها',
             '// (15 في الثانية) لكل قطعة: x وy بوحدة الرسم (الأرض 0 والأعلى سالب) وزاويتها بالراديان',
             "import '../core/cfg.dart';", '', 'const BEAST_FPS = 15;', 'const J BEAST_SHEETS = <String, Object?>{']
    for b in beasts:
        lines.append(f"  '{b['sheet']}': <String, Object?>{{'src': 'assets/units/{b['sheet']}.png', 'h': {b['h']}, 'sat': 1, 'val': 1}},")
    lines += ['};', '', 'class Beast {', '  final List<List<double>> parts;', '  final double unit, world;',
              '  final Map<String, (double, bool, List<double>)> clips;', '  const Beast(this.parts, this.unit, this.world, this.clips);', '}', '',
              'const BEASTS = <String, Beast>{']
    for b in beasts:
        lines.append(f"  '{b['sheet']}': Beast(<List<double>>[")
        for p in b['parts']: lines.append('    [' + ', '.join(f'{v:g}' if isinstance(v, int) else f'{v:.2f}' for v in p) + '],')
        lines.append(f"  ], {b['unit']:.5f}, {b['world']:.5f}, <String, (double, bool, List<double>)>{{")
        for cid, (dur, loop, data) in b['clips'].items():
            lines.append(f"    '{cid}': ({dur}, {'true' if loop else 'false'}, <double>[{', '.join(f'{v:g}' for v in data)}]),")
        lines.append('  }),')
    lines.append('};')
    open(os.path.join(ROOT, 'flutter_game', 'lib', 'data', 'beast_frames.dart'), 'w').write('\n'.join(lines) + '\n')


bs = [troll(), knight()]
dart(bs)
for b in bs: print(b['sheet'], 'parts', len(b['parts']), 'sheet h', b['h'], 'world/unit', round(b['world'], 4), {k: len(v[2]) // (3 * len(b['parts'])) for k, v in b['clips'].items()})
