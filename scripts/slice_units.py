#!/usr/bin/env python3
"""تقطيع صور شخصيات العصابات الكلاسيكية (وضعية T) إلى أجزاء تتحرك على هيكل anim.js.

الاستعمال (من جذر المشروع):  python3 scripts/slice_units.py
يحتاج: Pillow وnumpy وscipy.

الصور الأصلية ليست في المستودع بطلب المستخدم (.gitignore): ضعها أولاً في docs/characters/classic/
(صور "Gang_City_Classic_Gangs_16_R3_TPose_Transparent"). تكتب الأداة:
  assets/units/<gang>.png       نصفه العلوي الأجزاء بألوانها، ونصفه السفلي قناع ما يأخذ لون اللاعب
  js/render/unitSpritesData.js  مواقع الأجزاء ومفاصلها في الأطلس

الصور مرسومة على قالب واحد (لوحة 1250×1100، جسد بطول 800 بكسل والسلاح على اليمين)، فتُقاس آلياً.
ونسب القالب تطابق هيكل anim.js إذا وُضع خط الذراعين عند ارتفاع الكتف (19.6 وحدة)، فيُربط كل جزء
بمفاصل الهيكل نفسها: الجذع من الحوض إلى الصدر، والرأس على مركز الرأس، والعضد والساعد 3.7 لكل منهما،
والفخذ 5.8 والساق 6 (الساق تنتهي عند نقطة القدم في الهيكل، والنعل فوقها بـ 0.75 كما في الوقفة الأساسية).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'characters', 'classic')
OUT_PNG = os.path.join(ROOT, 'assets', 'units')
OUT_JS = os.path.join(ROOT, 'js', 'render', 'unitSpritesData.js')

# --- هيكل anim.js (drawBody) بوحدات الرسم، فوق الأرض في الوقفة الأساسية ---
SHOULDER = 19.6           # خط الذراعين في الصورة ← ارتفاع الكتف
HIP = 11.0                # الحوض
CHEST = 20.2              # أعلى العمود (الصدر C)
HEAD = 24.6               # مركز الرأس
ARM = 3.7                 # العضد والساعد (ik2 في drawBody)
THIGH, SHIN = 5.8, 6.0    # الفخذ والساق (leg في anim.js)
SOLE = 0.75               # النعل فوق نهاية الساق: نقطة القدم في الوقفة الأساسية تحت الأرض بهذا القدر

REF_SPAN = 570.0          # من خط الذراعين إلى النعل في القالب (بكسل)
ATLAS_SCALE = 0.27        # الجسد 800 بكسل يصير 216 بكسلاً: يكفي أقصى تكبير على شاشة 3x
UPP = SHOULDER / (REF_SPAN * ATLAS_SCALE)   # وحدة رسم لكل بكسل من الأطلس (ثابتة لكل الصور)
DARK = 0.72               # تعتيم الذراع والرجل البعيدتين
PAD = 2                   # فراغ حول كل جزء حتى لا تتسرب ألوان الجيران عند التنعيم

# لون العصابة في الصور: مركز درجة اللون ونصف عرض النافذة (ما بداخلها يأخذ لون اللاعب)
GANGS = {
    'crows':     {'prefix': '01_Crows',     'hue': (262, 14)},
    'hammers':   {'prefix': '02_Hammers',   'hue': (0, 13)},
    'vipers':    {'prefix': '03_Vipers',    'hue': (146, 22)},
    'scorpions': {'prefix': '04_Scorpions', 'hue': (28, 11)},
}


def W(name, comp, tip='up', grip=0.5, length=8.0, kind='pole', region=None):
    """سلاح: comp ترتيبه بين قطع السلاح من اليسار، tip طرفه الحاد أعلى أم أسفل،
    grip موضع القبضة من المؤخرة (0..1)، length طوله كله في اللعبة بوحدات الرسم،
    kind: pole عصا/نصل، bow قوس (يُقلب ليتحدب للأمام)، round درع أو جعبة، kit حقيبة بمقبض."""
    return dict(name=name, comp=comp, tip=tip, grip=grip, length=length, kind=kind, region=region)


# الأطوال قريبة من أسلحة bodies.js (wlen وtipLen وbutt) حتى يبقى الشرر والأثر عند رأس السلاح
UNITS = {
    'crow_common':      ('01_Crows_04_Ordinary_Crow',         [W('dagger', 0, 'down', 0.2, 6.2)]),
    'crow_spear':       ('01_Crows_03_Spear_Bearer',          [W('spear', 0, 'up', 0.3, 23.6)]),
    'crow_dual':        ('01_Crows_02_Double_Blades',         [W('blade', 0, 'down', 0.14, 6.3), W('blade2', 1, 'down', 0.14, 6.3)]),
    'crow_hero':        ('01_Crows_01_Crow_Champion',         [W('spear', 0, 'up', 0.235, 21.3)]),
    'hammer_common':    ('02_Hammers_04_Ordinary_Hammer',     [W('hammer', 0, 'up', 0.12, 7)]),
    'hammer_shield':    ('02_Hammers_03_Shield_Smith',        [W('shield', 0, kind='round', length=8.5)]),
    'hammer_breaker':   ('02_Hammers_02_Crusher',             [W('hammer', 0, 'up', 0.27, 13)]),
    'hammer_hero':      ('02_Hammers_01_Hammer_Champion',     [W('hammer', 0, 'up', 0.12, 7.5, region=(0, 700)),
                                                               W('shield', 0, kind='round', length=8, region=(700, 2000))]),
    'viper_common':     ('03_Vipers_04_Ordinary_Viper',       [W('dagger', 0, 'down', 0.2, 6)]),
    'viper_sniper':     ('03_Vipers_03_Sniper',               [W('bow', 0, kind='bow', length=15.2)]),
    'viper_firebomber': ('03_Vipers_02_Fire_Archer',          [W('bow', 0, kind='bow', length=15)]),
    'viper_hero':       ('03_Vipers_01_Viper_Champion',       [W('bow', 0, kind='bow', length=18), W('quiver', 1, kind='round', length=8)]),
    'scorp_common':     ('04_Scorpions_04_Ordinary_Scorpion', [W('club', 0, 'up', 0.12, 6.5)]),
    'scorp_boss':       ('04_Scorpions_03_Scorpion_Leader',   [W('club', 0, 'up', 0.12, 6.5)]),
    'scorp_medic':      ('04_Scorpions_02_Doctor',            [W('kit', 0, kind='kit', length=4)]),
    'scorp_hero':       ('04_Scorpions_01_Scorpion_Champion', [W('staff', 0, 'up', 0.35, 18), W('kit', 1, kind='kit', length=3.6)]),
}


# ---------------------------------------------------------------- أدوات
def hsv(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-9
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, (mx - mn) / (mx + 1e-9), mx


def tint_mask(rgba, hue):
    """قناع البكسلات التي تأخذ لون اللاعب: درجة لون العصابة وتشبع كافٍ."""
    h, s, _ = hsv(rgba[..., :3] / 255.0)
    dh = np.abs((h - hue[0] + 180) % 360 - 180)
    return ((dh <= hue[1]) & (s > 0.2)).astype(np.float32) * (rgba[..., 3] / 255.0)


def run_at(row, x):
    """المقطع المتصل في صف منطقي الذي يحوي العمود x: (بداية، نهاية)"""
    idx = np.where(row)[0]
    cut = np.where(np.diff(idx) > 1)[0]
    for a, b in zip(np.r_[idx[0], idx[cut + 1]], np.r_[idx[cut], idx[-1]]):
        if a <= x <= b:
            return a, b
    raise ValueError(f'no run at x={x}')


def capsule(ref, length, r):
    """كبسولة رأسية من صف مرجعي مكرر، بغطاءين نصف دائريين: المفصل الأول عند r والثاني عند r+length"""
    h = int(round(length + 2 * r))
    part = np.repeat(ref[None], h, 0).copy()
    w = part.shape[1]
    xs = np.arange(w) - (w - 1) / 2
    for y in range(h):
        d = max(r - y, y - (r + length), 0)
        part[y, np.abs(xs) > math.sqrt(max(0.0, r * r - d * d)), 3] = 0
    return part


# ---------------------------------------------------------------- القياس
def measure(rgba, body):
    width = body.sum(1)
    rows = np.where(width > 0)[0]
    sole = rows[-1]
    arm_rows = np.where(width > 0.7 * width.max())[0]
    ar0, ar1 = arm_rows.min(), arm_rows.max()
    ac, ah = (ar0 + ar1) / 2, (ar1 - ar0) / 2
    xr = np.where(body[ar0:ar1 + 1].any(0))[0].max()
    s = (sole - ac) / REF_SPAN
    k = SHOULDER / (sole - ac)              # وحدة رسم لكل بكسل من هذه الصورة
    leg_row = int(sole - 0.27 * (sole - ac))
    # المركز من النصف السفلي للرأس (القبعات وذيل العصابة أعلى منه)، فالمطارق أعرض جسداً
    cx = np.where(body[int(ar0 - 100 * s):int(ar0 - 40 * s)])[1].mean()
    _, l1 = run_at(body[leg_row], int(cx + 20 * s))
    _, t1 = run_at(body[int(ar1 + 25 * s)], int(cx))
    t0 = 2 * cx - t1
    # بداية الساق الظاهرة: نصعد من صف مرجعي ما دام الصف يشبهه
    cols = slice(int(cx + 6), int(l1 - 5))
    ref = rgba[leg_row, cols].astype(float)
    yv = int(ac)
    for y in range(leg_row, int(ac), -1):
        if np.abs(rgba[y, cols].astype(float) - ref).mean() > 18:
            yv = y + 1
            break
    # القدم اليمنى تبرز يميناً عن الساق؛ نقيس من الجهة اليمنى وحدها لأن العباءة على اليسار
    hi = int(cx + 2 * (l1 - cx))
    fy0 = next(y for y in range(leg_row, sole) if body[y, int(l1) + 4:hi].any())
    fr = np.where(body[fy0:sole + 1, int(cx):hi].any(0))[0].max() + int(cx)
    rcx = (cx + l1) / 2
    # الرقبة: أضيق صف بين الرأس والكتفين
    span = np.arange(int(ac - 140 * s), int(ar0 - 2))
    neck = span[np.argmin(width[span])]
    return dict(sole=sole, ar0=ar0, ar1=ar1, ac=ac, ah=ah, xr=xr, s=s, k=k, leg_row=leg_row,
                l1=l1, cx=cx, t0=t0, t1=t1, yv=yv, fy0=fy0, rcx=rcx, rx=fr - rcx, ry=(sole - fy0) / 2,
                neck=neck, hip=sole - HIP / k, chest=sole - CHEST / k, head=sole - HEAD / k)


# ---------------------------------------------------------------- بناء الأجزاء (بدقة الصورة الأصلية)
def crop(img):
    ys, xs = np.where(img[..., 3] > 0)
    y0, x0 = ys.min(), xs.min()
    return img[y0:ys.max() + 1, x0:xs.max() + 1], (x0, y0)


def build_torso_head(rgba, body, m):
    """الجذع (مع العباءة والمئزر) والرأس (مع غطائه) قطعتان: الرأس يميل وحده في الهيكل"""
    out = rgba.copy()
    out[~body] = 0
    h, w = body.shape
    ys, xs = np.mgrid[0:h, 0:w]
    r0, r1 = int(m['ar0'] - 4), int(m['ar1'] + 5)
    arms = (ys >= r0) & (ys < r1) & ((xs > m['t1'] + 1) | (xs < m['t0'] - 1))
    lx0, lx1 = min(m['t0'], 2 * m['cx'] - m['l1']) - 8, max(m['t1'], m['l1']) + 8   # سيقان المطارق أعرض من جذعها
    legs = (ys > m['yv']) & (xs >= lx0) & (xs <= lx1)
    feet = ys >= m['fy0'] - 4
    out[arms | legs | feet] = 0
    head = out.copy()
    head[ys >= m['neck']] = 0
    torso = out
    torso[ys < m['neck'] - 4] = 0                # تداخل صغير يغطيه الرأس فلا تظهر فجوة عند الميل
    return torso, head


def build_arm(rgba, m):
    """ذراع اللوحة اليمنى ← عضد كبسولي وساعد فيه الحلقة والطرف الأصلي، طول كل منهما ARM"""
    ah, xr, t1, ac, k = m['ah'], int(m['xr']), m['t1'], m['ac'], m['k']
    R0, R1 = int(m['ar0'] - 4), int(m['ar1'] + 5)
    L = ARM / k
    Hx = xr - ah                                  # مركز طرف الذراع المدوّر = اليد
    Ex = Hx - L                                   # المرفق
    c0 = int(Hx) - 1
    cap = rgba[R0:R1, c0:xr + 4].copy()           # الطرف المدوّر مع حدّه
    cw = cap.shape[1]
    ref = rgba[R0:R1, int(t1 + 12)]
    hgt = R1 - R0

    # العضد: كبسولة من العمود المرجعي بطول L وغطاءين من الطرف الأصلي (مركزاهما عند الكتف والمرفق)
    a, b = cw - 2, cw - 2 + L
    e = int(round(b)) - 1
    up = np.zeros((hgt, e + cw, 4), np.uint8)
    up[:, a:e + 1] = ref[:, None]
    up[:, :cw] = np.flip(cap, 1)
    up[:, e:e + cw] = cap
    upper = (up, (a, ac - R0), (b, ac - R0))

    # الساعد: أعمدة الصورة من المرفق إلى الطرف، وغطاء عند المرفق
    l0 = int(Ex) - cw + 1
    lo = np.zeros((hgt, xr + 4 - l0, 4), np.uint8)
    lo[:, int(Ex) - l0:] = rgba[R0:R1, int(Ex):xr + 4]
    lo[:, :cw] = np.where(lo[:, :cw, 3:] > 0, lo[:, :cw], np.flip(cap, 1))
    lower = (lo, (Ex - l0, ac - R0), (Hx - l0, ac - R0))
    return upper, lower


def build_leg(rgba, body, m):
    """الرجل اليمنى ← فخذ وساق بقدم بأطوال الهيكل (الساق كبسولة من صف مرجعي، والقدم من الصورة)."""
    k = m['k']
    c0, c1 = int(m['cx']) - 2, int(m['l1']) + 4
    ref = rgba[m['leg_row'], c0:c1]
    r = (c1 - c0) / 2
    th, sn = THIGH / k, SHIN / k

    thigh = capsule(ref, th, r)
    thigh_p = (thigh, (r, r), (r, r + th))

    # الساق: من الركبة إلى نقطة القدم (sn)، والنعل فوق نقطة القدم بـ SOLE، والقدم اليمنى للأمام قليلاً
    sole_y = r + sn - SOLE / k                    # النعل في إحداثيات قطعة الساق
    dy = sole_y - m['sole']                       # إزاحة صفوف القدم من الصورة إلى القطعة
    fwd = 0.25 * m['rx']
    fx0 = int(min(c0, m['rcx'] - m['rx'] - 3 + fwd))
    fx1 = int(max(c1, m['rcx'] + m['rx'] + 4 + fwd))
    tube = capsule(ref, m['fy0'] + 6 + dy - r, r)   # من الركبة حتى داخل القدم بقليل
    sh = np.zeros((int(sole_y) + 3, fx1 - fx0, 4), np.uint8)
    sh[:tube.shape[0], c0 - fx0:c1 - fx0] = tube[:sh.shape[0]]
    h, w = rgba.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    foot = (((xs - (m['rcx'])) / (m['rx'] + 2)) ** 2 + ((ys - (m['sole'] - m['ry'])) / (m['ry'] + 2)) ** 2 <= 1) & body
    for y, x in zip(*np.where(foot)):
        tx, ty = int(round(x + fwd)) - fx0, int(round(y + dy))
        if 0 <= tx < sh.shape[1] and 0 <= ty < sh.shape[0]:
            sh[ty, tx] = rgba[y, x]
    shin_p = (sh, (m['rcx'] - fx0, r), (m['rcx'] - fx0, r + sn))
    return thigh_p, shin_p


def weapon_parts(rgba, body, spec, k):
    """قطع السلاح: المكوّنات خارج الجسد، تُدمج القطع المتقاربة (رأس المطرقة ونتوؤها)."""
    other = (rgba[..., 3] > 40) & ~body
    lab, n = ndimage.label(ndimage.binary_dilation(other, iterations=8))
    comps = []
    for i in range(1, n + 1):
        mm = (lab == i) & other
        if mm.sum() > 300:
            comps.append((np.where(mm)[1].min(), mm))
    comps.sort(key=lambda c: c[0])
    out = []
    for w in spec:
        mm = comps[w['comp']][1].copy()
        if w['region']:
            ys = np.arange(mm.shape[0])[:, None]
            mm &= (ys >= w['region'][0]) & (ys < w['region'][1])
        img = rgba.copy()
        img[~mm] = 0
        ys, xs = np.where(mm)
        pts = np.stack([xs, ys], 1).astype(float)
        mean = pts.mean(0)
        if w['kind'] == 'bow':
            # القوس في الصورة يتحدّب لليسار: نقلبه ليتحدب للأمام، والقبضة قمة القوس عند منتصفه
            img = np.flip(img, 1).copy()
            xs = img.shape[1] - 1 - xs
            mid = np.abs(ys - mean[1]) <= 20
            grip = np.array([xs[mid].max() - 10, mean[1]])
            tip = np.array([grip[0], ys.min()])
            length = ys.max() - ys.min()
        elif w['kind'] in ('round', 'kit'):
            grip = mean if w['kind'] == 'round' else np.array([mean[0], ys.min() + 8.0])
            tip = grip + (0, -10 if w['kind'] == 'round' else 10)
            length = ys.max() - ys.min()
        else:
            v = np.linalg.eigh(np.cov((pts - mean).T))[1][:, -1]
            t = (pts - mean) @ v
            e1, e2 = mean + v * t.min(), mean + v * t.max()
            upper, lower = (e1, e2) if e1[1] < e2[1] else (e2, e1)
            tip, butt = (upper, lower) if w['tip'] == 'up' else (lower, upper)
            grip = butt + (tip - butt) * w['grip']
            length = t.max() - t.min()
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        scale = w['length'] / (length * k)
        reach = math.dist(grip, tip) * k * scale if w['kind'] == 'pole' else 0.0
        butt_len = w['grip'] * w['length'] if w['kind'] == 'pole' else 0.0
        out.append(dict(name=w['name'], img=img[y0:y1, x0:x1], a=(grip[0] - x0, grip[1] - y0),
                        b=(tip[0] - x0, tip[1] - y0), scale=scale, reach=reach, butt=butt_len))
    return out


# ---------------------------------------------------------------- تصغير وتعبئة
def shrink(img, f, mask=None):
    """تصغير بألوان مضروبة في الشفافية حتى لا تظهر حواف داكنة"""
    h, w = img.shape[:2]
    nw, nh = max(1, round(w * f)), max(1, round(h * f))
    small = np.array(Image.fromarray(img, 'RGBA').convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA'))
    if mask is None:
        return small, np.zeros((nh, nw), np.uint8)
    ms = np.array(Image.fromarray((mask * 255).astype(np.uint8), 'L').resize((nw, nh), Image.LANCZOS))
    return small, ms


def pack(parts, width=1024):
    """تعبئة رفوف بسيطة: الأطول أولاً"""
    order = sorted(range(len(parts)), key=lambda i: -parts[i]['img'].shape[0])
    x = y = shelf = 0
    for i in order:
        h, w = parts[i]['img'].shape[:2]
        if x + w + PAD > width:
            x, y, shelf = 0, y + shelf + PAD, 0
        parts[i]['at'] = (x + PAD, y + PAD)
        x += w + PAD
        shelf = max(shelf, h + PAD)
    return y + shelf + PAD


def main():
    if not os.path.isdir(SRC):
        sys.exit('ضع صور العصابات الكلاسيكية في ' + SRC)
    data = {'upp': UPP, 'gangs': {}}
    os.makedirs(OUT_PNG, exist_ok=True)
    for gang, g in GANGS.items():
        parts, units = [], {}
        srefs, vrefs = [], []
        for key, (fname, wspec) in UNITS.items():
            if not fname.startswith(g['prefix']):
                continue
            rgba = np.array(Image.open(os.path.join(SRC, fname + '.png')).convert('RGBA'))
            lab, _ = ndimage.label(rgba[..., 3] > 40)
            sizes = np.bincount(lab.ravel())
            sizes[0] = 0
            body = lab == sizes.argmax()
            m = measure(rgba, body)
            f = ATLAS_SCALE / m['s']           # كل الأجساد بنفس الحجم في اللعبة مهما كانت القبعة

            # مرجع التشبع والقيمة للون العصابة (لإعادة التلوين بلون اللاعب)
            _, s_, v_ = hsv(rgba[..., :3] / 255.0)
            tm = (tint_mask(rgba, g['hue']) > 0.5) & body
            srefs.append(np.median(s_[tm]))
            vrefs.append(np.median(v_[tm]))
            units[key] = {}

            def add(name, img, a, b, tinted=True, dark=False, extra=()):
                im = img.copy()
                if dark:
                    im[..., :3] = (im[..., :3].astype(float) * DARK).astype(np.uint8)
                small, ms = shrink(im, f, tint_mask(img, g['hue']) if tinted else None)
                parts.append(dict(unit=key, name=name, img=small, mask=ms, extra=extra,
                                  a=(a[0] * f, a[1] * f), ang=math.atan2(b[1] - a[1], b[0] - a[0])))

            torso, head = build_torso_head(rgba, body, m)
            img, (x0, y0) = crop(torso)
            add('torso', img, (m['cx'] - x0, m['hip'] - y0), (m['cx'] - x0, m['chest'] - y0))
            img, (x0, y0) = crop(head)
            add('head', img, (m['cx'] - x0, m['head'] - y0), (m['cx'] - x0, m['head'] - y0 - 10))

            upper, lower = build_arm(rgba, m)
            thigh, shin = build_leg(rgba, body, m)
            for nm, (im, a, b) in (('ua', upper), ('la', lower), ('th', thigh), ('sn', shin)):
                add(nm, im, a, b)
                add(nm + 'D', im, a, b, dark=True)

            for w in weapon_parts(rgba, body, wspec, m['k']):
                add(w['name'], w['img'], w['a'], w['b'], tinted=False,
                    extra=(round(w['scale'], 3), round(w['reach'], 2), round(w['butt'], 2)))

        height = pack(parts)
        atlas = np.zeros((height * 2, 1024, 4), np.uint8)
        for p in parts:
            x, y = p['at']
            h, w = p['img'].shape[:2]
            atlas[y:y + h, x:x + w] = p['img']
            atlas[height + y:height + y + h, x:x + w, :3] = 255
            atlas[height + y:height + y + h, x:x + w, 3] = p['mask']
            units[p['unit']][p['name']] = [x, y, w, h, round(p['a'][0], 1), round(p['a'][1], 1),
                                           round(p['ang'], 4), *p['extra']]
        # فحص ذاتي: كل وحدة بكل أجزائها، وإلا فصورة خرجت عن القالب
        for key, u in units.items():
            need = {'torso', 'head', 'ua', 'la', 'th', 'sn', 'uaD', 'laD', 'thD', 'snD'} | {w['name'] for w in UNITS[key][1]}
            assert need <= u.keys(), (key, need - u.keys())
        used = max(p['at'][0] + p['img'].shape[1] for p in parts) + PAD
        Image.fromarray(atlas[:, :used], 'RGBA').save(os.path.join(OUT_PNG, gang + '.png'), optimize=True)
        data['gangs'][gang] = {
            'src': f'assets/units/{gang}.png', 'h': height,
            'sat': round(float(np.median(srefs)), 3), 'val': round(float(np.median(vrefs)), 3),
            'units': units,
        }
        print(gang, 'atlas', used, 'x', height * 2, 'parts', len(parts))

    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write('// مولَّد بالأداة scripts/slice_units.py من صور العصابات الكلاسيكية — لا تعدّله يدوياً\n')
        fh.write('// كل جزء: [x, y, عرض, ارتفاع, مفصلX, مفصلY, زاوية محوره في الصورة، ثم للسلاح: مقياسه, بُعد طرفه, مؤخرته]\n')
        fh.write('export const SPRITES = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    sys.exit(main())
