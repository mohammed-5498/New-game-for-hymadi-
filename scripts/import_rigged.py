# شخصيات الأمم المقطّعة أجزاءً منفصلة (حزمتا المستخدم، 2026-11-15) إلى أطالس التطبيق flutter_game/assets/units/<أمة>_rig.webp
# و<أمة>_elite.webp وبياناتها lib/data/rig_sprites.dart. الرسم على هيكل اللعبة نفسه ووضعياتها (lib/render/rig_art.dart)،
# وحركات الحزمتين لا تُستعمل.
#   base:  البديلة بتحسينات خفيفة (48 شخصية من 12 أمة): GangCity-Rigged (js/characters.js وjs/render/rigPartsData.js
#          وrigExtras.js) وألواحها وassets/extras
#   elite: المظاهر السوداء والذهبية "نخبة <الأمة>" (60 شخصية): GangCity-BlackGold-Rigged/rigs/*.json وألواحها
# الاستعمال (كل مسار مجلد مفكوك):
#   python3 -I scripts/import_rigged.py <base_rig> <extras> <base_sheets...> -- <elite_rig> <elite_sheets...>
#   ثم صور القوائم: OUT=<مجلد> flutter test tool/export_rig_thumbs_test.dart (في flutter_game)
#   و python3 -I scripts/import_rigged.py --thumbs <المجلد>
#   ومظهر آخر لكل أمة (2.15.0، الأزياء الجديدة GangCity-New-Outfits-Rigged): يضيف ألواح <أمة>_<مظهر> وحدها ويُبقي الموجود كما هو
#   python3 -I scripts/import_rigged.py --outfit <مظهر> <rig> <sheets...>   (ATLAS_OUT=<مجلد> للتجربة خارج المستودع)
#   والأرجنتين والمكسيك والبرازيل المحسّنة (2.16.0، حزمة R3): RIG_STYLE=r3 ... --outfit rig <rig> <rig>/assets/sheets
# كل جزء يُصغَّر بمعامل واحد لشخصيته (الفخذ ~52 بكسلاً، كدقة أطالس الشخصيات الحالية)، وقناع لون اللاعب من لون الجسد
# (اليدان لون الجسد خالصاً): درجته ±16 بحواف ناعمة، كـ tint_mask_n في slice_units.py
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('ATLAS_OUT') or os.path.join(ROOT, 'flutter_game', 'assets', 'units')
DART = os.path.join(ROOT, 'flutter_game', 'lib', 'data', 'rig_sprites.dart')
UPP = 19.6 / (570.0 * 0.27)     # وحدة رسم لكل بكسل (كأطالس slice_units.py)
THIGH_PX = 6.6 / UPP            # ارتفاع الفخذ المرسوم (5.8 + تراكب) بالبكسل
WIDTH, PAD, HUE_HALF = 1024, 2, 16
# أدوار الحزمتين التي تختلف عن مفاتيح اللعبة (الاسم العربي نفسه): gangCitySkin.js وأسماء nations في config.js
ROLE = {'germany_spear': 'armored', 'germany_dual': 'smasher', 'brazil_musician': 'spear', 'brazil_acrobat': 'dual',
        'argentina_gaucho': 'spear', 'argentina_duelist': 'dual', 'mexico_archer': 'sniper', 'mexico_thrower': 'firebomber'}
DEF_KEYS = ('weapon', 'twoH', 'weaponLength', 'grip', 'hem', 'skirtWidth', 'skirt', 'offhand', 'offhandSize', 'offhandLength',
            'offhandGrip', 'heldGrip', 'headHeight', 'headPivot', 'scabbard', 'backcloth', 'backclothLength', 'torsoFill')
PART_KEYS = ('tipDown', 'center', 'top', 'bottom', 'pole', 'gripX', 'topX', 'bottomX', 'handleX')
FLIP_KEYS = ('gripX', 'topX', 'bottomX', 'handleX')   # القطعة المعكوسة (mirrorX) تُعكس في اللوح، ونقاطها 1 - x


def js_value(path, marker):
    text = open(path, encoding='utf-8').read()
    i = text.index(marker) + len(marker)
    return json.JSONDecoder().raw_decode(text[i:].lstrip())[0]


def find(dirs, name):
    for d in dirs:
        for root, _, files in os.walk(d):
            if name in files: return os.path.join(root, name)
    raise SystemExit('missing ' + name)


def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-9
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, (mx - mn) / (mx + 1e-9), mx


def _px(imgs):
    px = np.concatenate([a.reshape(-1, 4) for a in imgs]).astype(np.float32) / 255
    h, s, v = hsv(px[:, :3])
    return h, s, v, (px[:, 3] > 0.5) & (s > 0.35) & (v > 0.15)


def nation_hue(imgs):
    """لون جسد الأمة: أكثر درجة في اليدين والرأس لكل شخصياتها، بلا مدى الذهبي (أطراف النخبة وما لُفّ من الأيدي)"""
    h, _, _, sel = _px(imgs)
    sel &= (h < 25) | (h > 75)
    hist = np.bincount(np.round(h[sel]).astype(int) % 360, minlength=360).astype(np.float32)
    hist = np.convolve(np.r_[hist[-8:], hist, hist[:8]], np.ones(17), 'same')[8:-8]
    return float(np.argmax(hist))


def body_ref(imgs, hue):
    """تشبع لون الجسد وإضاءته الوسيطان في اليدين والرأس، داخل نافذة درجته"""
    h, s, v, sel = _px(imgs)
    sel &= np.abs((h - hue + 180) % 360 - 180) <= HUE_HALF
    return (float(np.median(s[sel])), float(np.median(v[sel]))) if sel.any() else (0.7, 0.7)


def tint_mask(rgba, hue):
    h, s, v = hsv(rgba[..., :3].astype(np.float32) / 255)
    dh = np.abs((h - hue + 180) % 360 - 180)
    # والداكن جداً خارجه: الخطوط السوداء حول القطع فيها مسحة من لون الجسد
    w = np.clip((HUE_HALF + 4 - dh) / 8, 0, 1) * np.clip((s - 0.08) / 0.12, 0, 1) * np.clip((v - 0.16) / 0.12, 0, 1)
    return (w * rgba[..., 3]).astype(np.uint8)


def crop_rect(sheet, q):
    return sheet[q['y']:q['y'] + q['h'], q['x']:q['x'] + q['w']]


def character(sheet_path, parts, extras_dir, extra):
    """أجزاء شخصية مصغّرة بمعامل واحد: {الاسم: مصفوفة RGBA}"""
    sheet = np.asarray(Image.open(sheet_path).convert('RGBA'))
    f = THIGH_PX / parts['thighF']['h']
    out = {}
    for name, q in parts.items():
        if not isinstance(q, dict) or 'x' not in q or name == 'hands': continue
        img = crop_rect(sheet, q)
        if name in extra:   # صور إضافية (الثوب المصحح والدرعان المنفصلان)
            e = extra[name]
            img = crop_rect(np.asarray(Image.open(os.path.join(extras_dir, os.path.basename(e['file']))).convert('RGBA')), e)
        w, h = max(1, round(img.shape[1] * f)), max(1, round(img.shape[0] * f))
        out[name] = np.asarray(Image.fromarray(img).resize((w, h), Image.LANCZOS))
    return out


def pack(sheet_name, chars):
    """أطلس واحد لأمة: الأجزاء صفوفاً، والقناع تحتها بالارتفاع نفسه (كأطالس slice_units.py)"""
    items = [(key, name, img) for key, (parts, _, _) in chars.items() for name, img in parts.items()]
    items.sort(key=lambda t: -t[2].shape[0])
    x = y = row = 0
    at = []
    for key, name, img in items:
        h, w = img.shape[:2]
        if x + w + PAD > WIDTH: x, y, row = 0, y + row + PAD, 0
        at.append((key, name, img, x, y))
        x += w + PAD
        row = max(row, h)
    height = y + row + PAD
    atlas = np.zeros((height * 2, WIDTH, 4), np.uint8)
    rects, refs = {}, []
    for key, (parts, hue, ref) in chars.items():
        refs.append(ref)
    for key, name, img, x, y in at:
        h, w = img.shape[:2]
        hue = chars[key][1]
        atlas[y:y + h, x:x + w] = img
        atlas[height + y:height + y + h, x:x + w, :3] = 255
        atlas[height + y:height + y + h, x:x + w, 3] = tint_mask(img, hue)
        rects.setdefault(key, {})[name] = [x, y, w, h]
    Image.fromarray(atlas, 'RGBA').save(os.path.join(OUT, sheet_name + '.webp'), 'WEBP', quality=90, method=6, alpha_quality=100)
    return height, rects, (round(float(np.median([r[0] for r in refs])), 3), round(float(np.median([r[1] for r in refs])), 3))


def dart(v):
    if isinstance(v, bool): return 'true' if v else 'false'
    if v is None: return 'null'
    if isinstance(v, (int, float)): return repr(round(v, 4) if isinstance(v, float) else v)
    if isinstance(v, str): return "'" + v.replace("'", "\\'") + "'"
    if isinstance(v, list): return '[' + ', '.join(dart(x) for x in v) + ']'
    return '<String, Object?>{' + ', '.join(f"'{k}': {dart(x)}" for k, x in v.items()) + '}'


def outfit(variant, rig_dir, sheet_dirs):
    """مظهر جديد لكل أمة من حزمة كحزمة النخبة (rigs/*.json وألواحها): ألواح <أمة>_<مظهر> وأسطرها في rig_sprites.dart،
    ولون الجسد من الحزمة نفسها، والألواح الأخرى كما هي"""
    chars = {}
    for f in sorted(os.listdir(os.path.join(rig_dir, 'rigs'))):
        r = json.load(open(os.path.join(rig_dir, 'rigs', f), encoding='utf-8'))
        d, cid = r['definition'], r['definition']['id']
        nation = d['nationId']
        parts = {}
        for k, q in r['parts'].items():
            if not q: continue
            if q.get('mirrorX'): q = {**q, **{x: round(1 - q[x], 6) for x in FLIP_KEYS if x in q}}
            parts[k] = q
        imgs = character(find(sheet_dirs, cid + '.png'), parts, None, {})
        for k, q in parts.items():
            if q.get('mirrorX') and k in imgs: imgs[k] = np.ascontiguousarray(imgs[k][:, ::-1])
        info = {k: d[k] for k in DEF_KEYS if k in d}
        info['parts'] = {n: {k: q[k] for k in PART_KEYS if k in q} for n, q in parts.items() if any(k in q for k in PART_KEYS)}
        info['id'] = cid
        role = ROLE.get(cid, d.get('role') or cid.split('_', 1)[1])
        chars.setdefault(nation, {})[f'{nation}_{role}'] = [imgs, nation, None, info]
    lines = {}
    for nation, cs in sorted(chars.items()):
        hue = nation_hue([im for c in cs.values() for im in (c[0]['handF'], c[0]['handB'], c[0]['head'])])
        for c in cs.values():
            c[1], c[2] = hue, body_ref([c[0]['handF'], c[0]['handB'], c[0]['head']], hue)
        name = f'{nation}_{variant}'
        height, rect, (sat, val) = pack(name, {k: (v[0], v[1], v[2]) for k, v in cs.items()})
        units = {k: {'def': v[3], 'parts': rect[k]} for k, v in cs.items()}
        style = os.environ.get('RIG_STYLE', 'outfit')   # r3: الأرجنتين والمكسيك والبرازيل المحسّنة (2.16.0) برسم حزمتها الأحدث
        lines[name] = f"  '{name}': {dart({'src': f'assets/units/{name}.webp', 'h': height, 'sat': sat, 'val': val, 'style': style, 'units': units})},"
        print(f'{name:18s} {len(cs)} شخصيات، أطلس {WIDTH}x{height * 2}، الجسد {hue:.0f}°، تشبع {sat} إضاءة {val}')
    if os.environ.get('ATLAS_OUT'): return   # تجربة: الألواح وحدها
    text = open(DART, encoding='utf-8').read().split('\n')
    head = [l for l in text if not l.startswith("  '")]
    keep = [l for l in text if l.startswith("  '") and l[3:l.index("'", 3)] not in lines]
    body = sorted(keep + list(lines.values()), key=lambda l: l[3:l.index("'", 3)])
    end = head.index('};')
    with open(DART, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(head[:end] + body + head[end:]))


def thumbs(folder):
    """صور القوائم من أداة flutter_game/tool/export_rig_thumbs_test.dart (PNG) إلى assets/thumbs/side_*.webp"""
    dst = os.path.join(ROOT, 'flutter_game', 'assets', 'thumbs')
    for f in sorted(os.listdir(folder)):
        if f.startswith('side_') and f.endswith('.png'):
            Image.open(os.path.join(folder, f)).save(os.path.join(dst, f[:-4] + '.webp'), 'WEBP', quality=90, method=6)
            print('thumb', f[:-4])


def main():
    args = sys.argv[1:]
    if args[0] == '--thumbs': return thumbs(args[1])
    if args[0] == '--outfit': return outfit(args[1], args[2], args[3:])
    cut = args.index('--')
    base_rig, extras_dir, base_sheets = args[0], args[1], args[2:cut]
    elite_rig, elite_sheets = args[cut + 1], args[cut + 2:]
    sheets = {}

    def add(variant, cid, nation, parts, d, extra, sheet_dirs, extras):
        role = ROLE.get(cid, d.get('role') or cid.split('_', 1)[1])
        key = f'{nation}_{role}'
        parts = dict(parts)
        if variant == 'base' and nation == 'egypt':   # rigPartsData: جلد مكشوف بلا لفائف للساعد والساقين
            for k in ('foreF', 'thighF', 'shinF'): parts[k] = parts['upperF']
            for k in ('foreB', 'thighB', 'shinB'): parts[k] = parts['upperB']
        if d.get('headTrim'): parts['head'] = {**parts['head'], 'h': round(parts['head']['h'] * (1 - d['headTrim']))}
        imgs = character(find(sheet_dirs, cid + '.png'), parts, extras, extra)
        info = {k: d[k] for k in DEF_KEYS if k in d}
        info['parts'] = {n: {k: q[k] for k in PART_KEYS if k in q} for n, q in parts.items()
                         if isinstance(q, dict) and any(k in q for k in PART_KEYS)}
        info['id'] = cid
        sheets.setdefault(f'{nation}_{variant}', {})[key] = [imgs, nation, None, info]

    defs = js_value(os.path.join(base_rig, 'js', 'characters.js'), 'export const CHARACTERS=')
    rects = js_value(os.path.join(base_rig, 'js', 'render', 'rigPartsData.js'), 'export const PARTS=')
    extras = js_value(os.path.join(base_rig, 'js', 'render', 'rigExtras.js'), 'export const EXTRA_PARTS=')
    for d in defs:
        add('rig', d['id'], d['nationId'], rects[d['id']], d, extras.get(d['id'], {}), base_sheets, extras_dir)
    for f in sorted(os.listdir(os.path.join(elite_rig, 'rigs'))):
        r = json.load(open(os.path.join(elite_rig, 'rigs', f), encoding='utf-8'))
        d = r['definition']
        parts = {k: v for k, v in r['parts'].items() if v}
        add('elite', d['id'], d['nationId'], parts, d, {}, elite_sheets, extras_dir)

    # لون جسد كل أمة من نسختيها معاً، ثم مرجع التشبع والإضاءة لكل شخصية
    hues = {}
    for chars in sheets.values():
        for imgs, nation, _, _ in chars.values(): hues.setdefault(nation, []).extend([imgs['handF'], imgs['handB'], imgs['head']])
    hues = {n: nation_hue(v) for n, v in hues.items()}
    for chars in sheets.values():
        for c in chars.values():
            c[2] = body_ref([c[0]['handF'], c[0]['handB'], c[0]['head']], hues[c[1]])
            c[1] = hues[c[1]]
    out = []
    for name, chars in sorted(sheets.items()):
        height, rect, (sat, val) = pack(name, {k: (v[0], v[1], v[2]) for k, v in chars.items()})
        units = {k: {'def': v[3], 'parts': rect[k]} for k, v in chars.items()}
        out.append(f"  '{name}': {dart({'src': f'assets/units/{name}.webp', 'h': height, 'sat': sat, 'val': val, 'style': 'elite' if name.endswith('_elite') else 'base', 'units': units})},")
        print(f'{name:18s} {len(chars)} شخصيات، أطلس {WIDTH}x{height * 2}، الجسد {next(iter(chars.values()))[1]:.0f}°، تشبع {sat} إضاءة {val}')
    with open(DART, 'w', encoding='utf-8') as fh:
        fh.write('// مولَّد بـ scripts/import_rigged.py من حزمتي الشخصيات المقطّعة (لا تعدّله باليد)\n')
        fh.write('// لكل لوح: صورته (الأجزاء فوق وقناع لون اللاعب تحتها)، ولكل شخصية بمفتاح اللعبة: def (السلاح والمسكات وأطوال الرسم)\n')
        fh.write('// وأجزاؤها [x, y, w, h] في اللوح. style: base للبديلة وelite لمظهر النخبة وoutfit للأزياء الجديدة (--outfit، 2.15.0)\n')
        fh.write('const Map<String, Object?> RIG_SHEETS = <String, Object?>{\n' + '\n'.join(out) + '\n};\n')


main()
