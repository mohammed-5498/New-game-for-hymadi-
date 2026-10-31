#!/usr/bin/env python3
"""تقطيع صور الشخصيات (وضعية T) إلى أجزاء تتحرك على هيكل anim.js: العصابات الكلاسيكية والأمم الـ15 والشرطة.

الاستعمال (من جذر المشروع):  python3 scripts/slice_units.py
يحتاج: Pillow وnumpy وscipy.

الصور الأصلية ليست في المستودع بطلب المستخدم (.gitignore): ضعها أولاً في docs/characters/
(classic/ لصور "Gang_City_Classic_Gangs_16_R3_TPose_Transparent"، ومجلدات الأمم والشرطة كما في NATIONS).
تكتب الأداة:
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
from PIL import Image, ImageDraw
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


# ================================================================ الأمم والشرطة
# صور الأمم (لون جسد لكل أمة، وأثواب وعباءات وأكمام) والشرطة على قوالب مختلفة، فتُقاس بطريقة أعم:
#   الذراعان: أطول مقطع أفقي متصل (من يد إلى يد) يحدد المركز، ثم كل صف يمتد بعيداً يميناً ويساراً معاً (والأكمام معه)
#   القدم: أعرض صف أسفل الجسد، وأعلاها حيث يضيق مقطعها (ساق) أو يلتحم بالثوب أو بالساق الأخرى
#   الساق الظاهرة: من فوق القدم صعوداً ما دام الصف يشبه نفسه (السروال)؛ والثوب الطويل بلا ساق ظاهرة
#   الجذع حتى الحوض، وما تحته (ثوب، معطف، تنورة، حزام) "إزار" يتمايل مع الساقين في اللعبة
# وما يختلف في صورة بعينها يُكتب لها في opts.
NSRC = os.path.join(ROOT, 'docs', 'characters')


def I(name, use, comp=None, region=None, circle=None, kind='pole', tip='up', grip=0.2, length=6.0, axis=None):
    """قطعة ليست من الجسد (سلاح أو أداة). use كيف تُرسم في اللعبة:
      hand في اليد الأمامية على زاوية السلاح، pair في اليد الخلفية (السيف الثاني)، bow قوس، shield درع أمام اليد،
      side درع على اليد الخلفية (خلفه، وأمامه عند الصدّ)، hang معلّقة من اليد، upright قائمة في اليد،
      fist على القبضة، falcon على الساعد، back على الظهر، belt على الخصر، none تُحذف ولا تُرسم.
    comp ترتيبها بين القطع المنفصلة عن الجسد من اليسار (أو مجموعة تُدمج)، أو region (x0, y0, x1, y1)
    أو circle (cx, cy, r) تُقتطع من الصورة بلا بكسلات لون الجسد.
    kind: pole عصا أو نصل (tip طرفه أعلى أم أسفل، grip موضع القبضة من المؤخرة، axis='v' محوره رأسي)،
    bow قوس، round درع، blob شكل حر (grip = (x, y) نسبة من مربعه). length طولها كله بوحدات الرسم
    (ارتفاعها لغير pole)، قريب من أسلحة مظاهر الأمم بالكود حتى يبقى الشرر عند رأس السلاح."""
    return dict(name=name, use=use, comp=comp, region=region, circle=circle, kind=kind, tip=tip, grip=grip,
                length=length, axis=axis)


# الأمة: (مجلدها، درجة لون جسدها، وحداتها) — الوحدة: (الملف، القطع، opts)
# opts: arm='left' تُقلب الصورة فتؤخذ الذراع اليسرى (اليمنى يغطيها شيء)، legref='arm' ساق بلون الجسد (ثوب حتى القدمين)،
#   legs='touch' ساقان متلاصقتان ظاهرتان (لا فراغ بينهما فوق القدمين)، legs='pants' الساق من الحوض ولو انغلقت الفجوة
#   تحت معطف، legx=(x0, x1) عرض الساقين،
#   yv/fy0 بداية الساق الظاهرة وأعلى القدم، headx مناطق تتبع الرأس، torsox مناطق تتبع الجذع (بلا لون الجسد)، drop مناطق تُحذف (إلا الأحمر)، fill ثقوب تُملأ
#   من الجهة المقابلة، pair السلاح في اليدين، twoH باليدين، arrows عدد سهام القوس، fire سهام مشتعلة،
#   legimg الرجل من الصورة نفسها بدرعها وحذائها لا كبسولة (build_leg_img)
NATIONS = {
    'yemen': ('yemen', 2, {
        'champion': ('01_Queen_of_Saba', [I('scepter', 'hand', 0, grip=0.2, length=8)], {}),
        'medic': ('02_Al_Attaar', [I('lantern', 'hang', region=(835, 612, 968, 892), kind='blob', grip=(0.5, 0.0), length=4.6)],
                  {'arm': 'left'}),
        'boss': ('03_Sheikh_Al_Janbiya', [I('jambiya', 'hand', region=[(897, 470, 1024, 645), (878, 645, 1024, 820)], tip='down', grip=0.22, length=6.4)],
                 {'arm': 'left'}),
        'common': ('04_Al_Janbiya_Fighter', [I('jambiya', 'hand', 0, tip='down', grip=0.22, length=5.6)], {}),
    }),
    'saudi': ('saudi/02_Game_Ready_800px_PNG', 212, {
        'champion': ('01_Al_Saqqar_الصقار', [I('falcon', 'falcon', 0, kind='blob', grip=(0.6, 0.66), length=7)], {}),
        'firebomber': ('02_Al_Naffat_النفاط', [I('pot', 'upright', 0, kind='blob', grip=(0.5, 0.55), length=4.2)], {}),
        'sniper': ('03_Al_Qawwas_القواس_Updated_Bow', [I('bow', 'bow', 0, kind='bow', length=14)], {}),
        'common': ('04_Rami_Al_Miqla_رامي_المقلاع', [I('sling', 'hand', 0, grip=0.12, length=4.6)], {'legref': 'arm'}),
    }),
    'egypt': ('egypt/Characters', 150, {
        # القدمان متلاصقتان تحت حافة الجلابية (بينهما بطانتها): أعلاهما يدوياً
        'champion': ('01_Leader_كبير_الفتوات', [I('cane', 'hand', 0, grip=0.12, length=8)], {'fy0': 712}),
        'smasher': ('02_Heavy_Club_صاحب_النبوت', [I('club', 'hand', 0, grip=0.12, length=13)], {'twoH': True, 'fy0': 712}),
        'armored': ('03_Shield_Bearer_حامل_الدرع', [I('shield', 'shield', circle=(400, 412, 146), kind='round', length=10.5)],
                    {'arm': 'left', 'fill': [(400, 412, 150)], 'fy0': 712}),
        'common': ('04_Fighter_الفتوة', [I('club', 'hand', 0, grip=0.12, length=9)], {'fy0': 712}),
    }),
    'china': ('china_japan_korea/China', 212, {
        'champion': ('01_China_01_Liangshan_Leader_زعيم ليانغشان', [I('spear', 'hand', 0, grip=0.3, length=17.6)],
                     {'twoH': True, 'headx': [(40, 25, 305, 292)]}),
        'medic': ('02_China_02_Traveling_Doctor_الطبيب الجوال', [I('staff', 'hand', 0, grip=0.3, length=9)], {}),
        'boss': ('03_China_03_Staff_Elder_شيخ العصا', [I('club', 'hand', 0, grip=0.3, length=12)], {'twoH': True}),
        'common': ('04_China_04_Mountain_Boy_فتى الجبل', [I('dao', 'hand', 0, tip='down', grip=0.16, length=6.6)], {}),
    }),
    'japan': ('china_japan_korea/Japan', 2, {
        'champion': ('05_Japan_01_Kabukimono_Leader_زعيم الكابوكيمونو', [I('sword', 'hand', 0, tip='down', grip=0.12, length=10)], {}),
        'dual': ('06_Japan_02_Dual_Swordsman_مبارز السيفين', [I('sword', 'hand', 0, tip='down', grip=0.14, length=7.6)], {'pair': True}),
        'spear': ('07_Japan_03_Flail_Bearer_حامل الفليون', [I('pipe', 'hand', 0, grip=0.2, length=15)], {'twoH': True}),
        'common': ('08_Japan_04_Kabukimono_كابوكيمونو', [I('sword', 'hand', 0, tip='down', grip=0.14, length=8)], {}),
        # ساموراي دوجو إيدو (القسم 3.11، بطلب المستخدم): شكل حراس الدوجو (unit.lookKind)، بالكاتانا
        # رجلاه من الصورة (واقي الركبة ودرع الساق والحذاء): الأمامية كاملة، وحذاؤها يغطي عقب الخلفية فلا تُؤخذ هي.
        # والكاتانا باليدين معاً كوقفة الساموراي، وبضعف طولها (بطلب المستخدم)
        'samurai': ('09_Japan_Samurai_ساموراي', [I('katana', 'hand', 0, tip='down', grip=0.14, length=19)],
                    {'yv': 585, 'legx': (185, 450), 'twoH': True,
                     'legimg': dict(x=(185, 345), hem=585, knee=655, ref=598, axis=258, r=40,
                                    poly=[(185, 585), (302, 585), (302, 742), (318, 750), (330, 758), (336, 770),
                                          (338, 795), (336, 820), (185, 820)])}),
    }),
    'korea': ('china_japan_korea/Korea', 142, {
        'champion': ('09_Korea_01_Hwarang_Leader_قائد الهوارانغ',
                     [I('quiver', 'back', region=[(700, 430, 870, 780), (778, 150, 870, 430)], kind='round', length=9),
                      I('bow', 'bow', 0, kind='bow', length=16), I('bit', 'none', 1)], {'arrows': 3}),
        'firebomber': ('10_Korea_02_Fire_Arrow_Archer_رامي السهام المشتعلة',
                       [I('lantern', 'belt', region=(845, 290, 955, 575), kind='blob', grip=(0.5, 0.05), length=4.2),
                        I('bow', 'bow', 0, kind='bow', length=14)], {'fire': True}),
        'sniper': ('11_Korea_03_Precision_Archer_الرامي الدقيق', [I('bow', 'bow', 0, kind='bow', length=14)], {}),
        'common': ('12_Korea_04_Hwarang_Youth_فتى الهوارانغ', [I('sword', 'hand', 0, tip='down', grip=0.14, length=7)], {}),
    }),
    'france': ('france_britain_germany/Gang_City_France_Britain_Germany', 212, {
        'champion': ('01_France_King_of_Apaches', [I('cane', 'hand', 0, tip='down', grip=0.12, length=7.5)],
                     {'legs': 'touch', 'legx': (285, 565)}),
        'dual': ('02_France_Fighting_Dancer', [I('knife', 'hand', 0, tip='down', grip=0.18, length=5.4)], {'pair': True}),
        'spear': ('03_France_Staff_Fighter', [I('staff', 'hand', 0, grip=0.25, length=11)], {}),
        'common': ('04_France_Apache', [I('knife', 'hand', 0, tip='down', grip=0.18, length=5.6)], {}),
    }),
    'britain': ('france_britain_germany/Gang_City_France_Britain_Germany', 2, {
        'champion': ('05_Britain_Neighborhood_Boss', [I('cane', 'hand', 0, grip=0.12, length=9)], {}),
        'smasher': ('06_Britain_Knuckle_Fighter', [I('fist', 'fist', 0, kind='blob', grip=(0.5, 0.58), length=3.4)], {'legs': 'pants'}),
        'armored': ('07_Britain_Barrel_Lid_Shield', [I('shield', 'shield', 0, kind='round', length=9.5)], {'legs': 'pants'}),
        'common': ('08_Britain_Small_Heath', [I('hammer', 'hand', 0, grip=0.12, length=7)], {'legs': 'pants'}),
    }),
    'germany': ('france_britain_germany/Gang_City_France_Britain_Germany', 149, {
        'champion': ('09_Germany_Banner_Bearer', [I('banner', 'hand', 0, grip=0.3, length=17, axis='v')],
                     {'drop': [(60, 90, 153, 320)]}),
        'smasher': ('10_Germany_Dual_Swordsman', [I('sword', 'hand', 1, tip='down', grip=0.14, length=7.4),
                                                  I('sword2', 'pair', 0, tip='down', grip=0.14, length=7.4)], {}),
        'armored': ('11_Germany_Long_Spear_Bearer', [I('pike', 'hand', 0, grip=0.25, length=21)], {'twoH': True}),
        'common': ('12_Germany_Landsknecht', [I('knife', 'hand', 0, tip='down', grip=0.18, length=7.4)], {}),
    }),
    'ethiopia': ('ethiopia_nigeria_sudan/Ethiopia', 2, {
        'champion': ('01_Adwa_Leader_Al_Ras', [I('spear', 'hand', 0, grip=0.3, length=15)], {'torsox': [(345, 485, 525, 850)]}),
        'medic': ('02_Healer_Al_Mualij', [I('horn', 'hand', 0, grip=0.2, length=4.4)], {}),
        'boss': ('03_Drummer_Qari_Al_Naqqara', [I('stick', 'hand', 0, grip=0.15, length=5)], {'torsox': [(605, 515, 820, 705)]}),
        'common': ('04_Adwa_Warrior', [I('shotel', 'hand', 0, tip='down', grip=0.16, length=7)], {'torsox': [(550, 440, 645, 760)]}),
    }),
    'nigeria': ('ethiopia_nigeria_sudan/Nigeria', 145, {
        'champion': ('01_Dambe_Champion', [], {}),
        'smasher': ('02_Heavy_Boxer', [], {}),
        'armored': ('03_Wall_Guard', [I('shield', 'shield', 0, kind='round', length=9.5)], {}),
        'common': ('04_Dambe_Fighter', [], {}),
    }),
    'sudan': ('ethiopia_nigeria_sudan/Sudan', 218, {
        'champion': ('01_Kandaka', [I('bow', 'bow', 0, kind='bow', length=16)], {'arrows': 3, 'legs': 'touch'}),
        'firebomber': ('02_Flame_Archer', [I('lantern', 'hang', 0, kind='blob', grip=(0.5, 0.04), length=4.8)], {}),
        'sniper': ('03_Longbow_Archer', [I('bow', 'bow', 0, kind='bow', length=17)], {}),
        'common': ('04_Nubian_Boy', [], {}),
    }),
    'argentina': ('argentina_mexico_brazil', 2, {
        'champion': ('01_Argentina_Mafioso_Champion', [I('knife', 'hand', 0, grip=0.16, length=7)], {}),
        'dual': ('02_Argentina_Shawl_Duelist', [I('knife', 'hand', 0, grip=0.16, length=5.8)], {'legs': 'touch'}),
        'spear': ('03_Argentina_Boleadoras_Gaucho', [I('bolas', 'hand', (0, 1), grip=0.1, length=6.5)], {'legs': 'touch'}),
        'common': ('04_Argentina_Compadrito', [I('knife', 'hand', 0, grip=0.16, length=6.2)], {}),
    }),
    'mexico': ('argentina_mexico_brazil', 148, {
        'champion': ('05_Mexico_Eagle_Leader', [I('bow', 'bow', region=(735, 500, 960, 905), kind='bow', length=16)],
                     {'arrows': 3, 'legs': 'touch', 'torsox': [(340, 420, 470, 730)]}),
        'firebomber': ('06_Mexico_Atlatl_Thrower', [I('torch', 'upright', 0, kind='blob', grip=(0.5, 0.77), length=5.4)], {}),
        'sniper': ('07_Mexico_Jaguar_Archer', [I('bow', 'bow', region=(688, 500, 940, 830), kind='bow', length=15)],
                   {'legs': 'touch', 'torsox': [(345, 440, 480, 735)]}),
        'common': ('08_Mexico_Chinampa_Fighter', [I('mace', 'hand', 0, grip=0.12, length=6.4)], {'torsox': [(210, 495, 390, 800)]}),
    }),
    'brazil': ('argentina_mexico_brazil', 212, {
        'champion': ('09_Brazil_Master', [I('berimbau', 'hand', 0, grip=0.18, length=13)], {'legs': 'pants'}),
        'dual': ('10_Brazil_Acrobat', [], {'legs': 'pants'}),
        'spear': ('11_Brazil_Berimbau_Player', [I('stick', 'hand', 0, grip=0.15, length=7.5)], {'legs': 'touch'}),
        'common': ('12_Brazil_Street_Capoeira', [I('cane', 'hand', region=(800, 470, 1010, 835), grip=0.15, length=7)], {}),
    }),
    'police': ('police', 222, {
        'captain': ('01_Officer_الضابط', [I('shield', 'side', 0, kind='round', length=10.5),
                                          I('baton', 'hand', 1, grip=0.22, length=5.6)], {}),
        'common': ('02_Police_الشرطي', [I('shield', 'side', 0, kind='round', length=10),
                                        I('baton', 'hand', 1, grip=0.22, length=5.2)], {}),
    }),
}
SHADOWED = {'argentina_mexico_brazil'}      # صور بظل أرض رمادي معتم تحت القدمين
HUE_HALF = 16                               # نصف عرض نافذة لون الجسد


def tint_mask_n(rgba, hue):
    """قناع الأمم: لون الجسد بحواف ناعمة في الدرجة والتشبع، فالأثواب الفاتحة بلونه تأخذ لون اللاعب خفيفاً"""
    h, s, _ = hsv(rgba[..., :3] / 255.0)
    dh = np.abs((h - hue + 180) % 360 - 180)
    w = np.clip((HUE_HALF + 4 - dh) / 8, 0, 1) * np.clip((s - 0.08) / 0.12, 0, 1)
    return (w * (rgba[..., 3] / 255.0)).astype(np.float32)


def runs(row):
    idx = np.where(row)[0]
    if not len(idx):
        return []
    cut = np.where(np.diff(idx) > 1)[0]
    return list(zip(np.r_[idx[0], idx[cut + 1]], np.r_[idx[cut], idx[-1]]))


def shadow_off(rgba):
    """ظل الأرض (رمادي فاتح معتم) يُحذف: كل منطقة رمادية فاتحة متصلة تلمس أسفل الصورة أو تقع كلها في أسفلها"""
    a = rgba[..., 3]
    ys = np.where(a.any(1))[0]
    _, s, v = hsv(rgba[..., :3] / 255.0)
    lab, n = ndimage.label((a > 0) & (s < 0.25) & (v > 0.45) & (v < 0.97))
    low = ys.max() - 0.12 * (ys.max() - ys.min())
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl[0].stop - 1 >= ys.max() - 3 or sl[0].start > low:
            rgba[sl][lab[sl] == i] = 0


def region_mask(shape, region=None, circle=None):
    """مربع (x0, y0, x1, y1) أو قائمة مربعات، أو دائرة (cx, cy, r)"""
    ys, xs = np.mgrid[0:shape[0], 0:shape[1]]
    if circle:
        return (xs - circle[0]) ** 2 + (ys - circle[1]) ** 2 <= circle[2] ** 2
    out = np.zeros(shape[:2], bool)
    for x0, y0, x1, y1 in (region if isinstance(region[0], tuple) else [region]):
        out |= (xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1)
    return out


def mirror_fill(rgba, body, cx, mask):
    """ثقب في الجسد خلف شيء اقتُطع منه (درع): ما داخل حدود الجسد (حدّه السليم منعكساً) يُملأ من الجهة المقابلة
    للمركز، وما بقي (وسط الجسد) من أقرب بكسل سليم"""
    h, w = body.shape
    has = body.any(1)
    half = np.maximum(cx - np.where(has, body.argmax(1), w), np.where(has, w - 1 - body[:, ::-1].argmax(1), -1) - cx)
    inside = mask & ~body & (np.abs(np.arange(w)[None, :] - cx) <= half[:, None])
    ys, xs = np.where(inside)
    mx = np.clip(np.round(2 * cx - xs).astype(int), 0, w - 1)
    ok = body[ys, mx]
    rgba[ys[ok], xs[ok]] = rgba[ys[ok], mx[ok]]
    body[ys[ok], xs[ok]] = True
    rest = inside & ~body
    if rest.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~body, return_indices=True)
        rgba[rest] = rgba[iy[rest], ix[rest]]
        body[rest] = True


def arm_line(body):
    """خط الذراعين: أطول مقطع أفقي متصل (من يد إلى يد). يعيد صفه وطرفيه"""
    longest = np.zeros((body.shape[0], 3), int)
    for y in np.where(body.any(1))[0]:
        a, b = max(runs(body[y]), key=lambda r: r[1] - r[0])
        longest[y] = (b - a + 1, a, b)
    y0 = int(longest[:, 0].argmax())
    a = b = y0
    while longest[a - 1, 0] >= 0.9 * longest[y0, 0]:
        a -= 1
    while longest[b + 1, 0] >= 0.9 * longest[y0, 0]:
        b += 1
    return y0, longest[a:b + 1, 1].min(), longest[a:b + 1, 2].max()


def measure_n(rgba, body, o, tm):
    H, Wd = body.shape
    has = body.any(1)
    # خط الذراعين ثم الصفوف الممتدة يميناً ويساراً معاً (والأكمام الواسعة معها)
    y0, xl, xr = arm_line(body)
    cx, A = (xl + xr) / 2, (xr - xl) / 2
    L = np.where(has, body.argmax(1), Wd)
    R = np.where(has, Wd - 1 - body[:, ::-1].argmax(1), -1)
    arm = has & (L < cx - 0.6 * A) & (R > cx + 0.6 * A)
    ar0 = ar1 = y0
    while arm[ar0 - 1]:
        ar0 -= 1
    while arm[ar1 + 1]:
        ar1 += 1
    ar0, ar1 = o.get('arms', (ar0, ar1))
    # اليد: سُمك طرف الذراع قرب نهايته، ومركزه خط الذراع (الأكمام الواسعة تتدلى تحته)
    col = np.where(body[ar0:ar1 + 1, int(xr - 0.05 * A)])[0] + ar0
    ya, rt = (col.min() + col.max()) / 2, (col.max() - col.min()) / 2
    sole = int(np.where(has)[0].max())
    span = sole - ya
    s, k = span / REF_SPAN, SHOULDER / span
    # حدّ الجذع تحت الإبط: العريض بكل ما عليه (وشاح، عباءة)، واللب بلون الجسد وحده؛ بينهما في صفوف الذراعين
    # يُحذف لون الجسد (جذر الذراع) ويبقى ما سواه
    yb = int(ar1 + 0.05 * span)
    _, t1w = run_at(body[yb], int(cx))
    if tm[yb, int(cx)]:
        t1 = run_at(body[yb] & tm[yb], int(cx))[1]
    else:                                           # من اليد على خط الذراع ما دام بلون الجسد (حتى الوشاح)
        t1 = int(xr - rt)
        while t1 > cx and tm[int(ya), t1]:
            t1 -= 1
    t1 = min(t1, t1w)
    t0, t0w = 2 * cx - t1, 2 * cx - t1w
    width = body.sum(1)
    rng = np.arange(int(sole - HEAD / k), int(ar0) - 1)
    neck = int(rng[np.argmin(width[rng])]) if len(rng) else int(ar0) - 2

    # القدم اليمنى: أعرض مقطع يمين المركز في أسفل الجسد، وأعلاها حيث يضيق أو يلتحم
    c = int(round(cx))
    best = (0, 0, 0, 0)
    for y in range(int(sole - 0.25 * span), sole + 1):
        for fa, fb in runs(body[y]):
            if fb > c and fb - max(fa, c) > best[0]:
                best = (fb - max(fa, c), y, max(fa, c), fb)
    fw, yw, fa, fb = best
    xf = (fa + fb) / 2
    # أعلى القدم: القدم بيضاوية ارتفاعها نحو 0.72 من عرضها، إلا أن يغطي ثوبٌ أعلاها (مقطع يعبر المركز كثيراً)
    fy0 = yw
    while fy0 > sole - 0.4 * span:
        rr = [(ra, rb) for ra, rb in runs(body[fy0 - 1]) if rb > c]
        if not rr:
            break
        ra, rb = max(rr, key=lambda r: min(r[1], fb) - max(r[0], fa))
        if ra < c - 0.25 * (rb - c):
            break
        fy0 -= 1
    fy0 = max(int(sole - 0.72 * fw), fy0)
    fy0 = o.get('fy0', fy0)
    # الساق الظاهرة فوق القدم (السروال أو الساق العارية)، أو لا ساق ظاهرة (ثوب حتى القدمين)
    # (المقطع الأكثر تداخلاً مع القدم يمين المركز: الساق أضيق من القدم وقد لا تمر بمركزها)
    yl = int(fy0 - 0.03 * span)
    la = lb = None
    over = [(min(rb, fb) - max(ra, c, fa), max(ra, c), rb) for ra, rb in runs(body[yl]) if rb > c]
    if over and max(over)[0] > 0:
        _, la, lb = max(over)
    gap = la is not None and not body[yl, c - 2:c + 3].any()
    visible = o.get('legref') != 'arm' and (gap or o.get('legs') == 'touch' or (la is not None and lb - la < 0.8 * fw))
    # الساق الظاهرة تبدأ من الحوض (السروال)، إلا أن تنغلق الفجوة بين الساقين تحت حافة ثوب أعرض منهما (إزار، تنورة)
    top = int(sole - HIP / k + 0.03 * span)
    yv, ysep = top, int(yl - 0.05 * span)          # ysep: أعلى صف تُقاس فيه الساقان منفصلتين
    if visible and gap:
        y = yl
        while y > top and not body[y - 1, c - 2:c + 3].any():
            y -= 1
        ysep = y
        # حافة ثوب لا فخذان متلاصقان: لون ما يغلق الفجوة يختلف عن لون الساق
        leg = rgba[yl, int(la + 4):int(lb - 3), :3].reshape(-1, 3).astype(float).mean(0)
        hem = rgba[max(y - 4, 0):y, c - 3:c + 4, :3].reshape(-1, 3).astype(float).mean(0)
        if y > top and o.get('legs') != 'pants' and np.abs(hem - leg).mean() > 40:
            yv = y
    if not visible or yv > fy0 - 0.04 * span:       # لا ساق ظاهرة، أو حافة ثوب فوق القدم مباشرة
        visible, la, lb, yv = False, fa + 0.15 * fw, fb - 0.15 * fw, fy0
    yv = o.get('yv', yv)
    # حدود الساقين والقدمين (للحذف من الجذع والإزار): في كل صف مقطع الساق اليمنى والمقطع الذي على يساره مباشرة
    # (الساق اليسرى؛ قد لا تتناظر الساقان حول مركز الذراعين). عباءة ملتصقة بالساق اليسرى تُحسب معها
    def reach(y0, y1, a, b):
        lo, hi = a, b
        for y in range(int(y0), int(y1)):
            rr = runs(body[y])
            i = next((i for i, (ra, rb) in enumerate(rr) if rb >= a and ra <= b), None)
            if i is None:
                continue
            left = rr[i - 1][0] if i > 0 and rr[i][0] > c else rr[i][0]
            lo, hi = min(lo, left), max(hi, rr[i][1])
        return lo, hi
    if 'legx' in o:
        la, lb = cx, o['legx'][1]
    lx0, lx1 = o.get('legx') or reach(max(ysep, yv + 1), fy0, la, lb)
    fx0, fx1 = reach(fy0, sole + 1, fa, fb)
    # ...إلا ما تجاوز مقابل اليمنى كثيراً (طرف عباءة طويلة ملتصق بالقدم اليسرى يبقى)
    lx0, fx0 = max(lx0, 2 * cx - lx1 - 0.8 * (lb - la)), max(fx0, 2 * cx - fx1 - 0.45 * fw)
    return dict(sole=sole, ar0=ar0, ar1=ar1, ya=ya, rt=rt, xr=xr, s=s, k=k, span=span, cx=cx, t0=t0, t1=t1,
                t0w=t0w, t1w=t1w, ysep=ysep,
                neck=neck, yv=yv, fy0=fy0, la=la, lb=lb, xf=xf, fw=fw, visible=visible,
                lx0=lx0 - 3, lx1=lx1 + 3, fx0=fx0 - 3, fx1=fx1 + 3,
                hip=sole - HIP / k, chest=sole - CHEST / k, head=sole - HEAD / k)


def build_body_n(rgba, body, m, o, tm):
    """الرأس والجذع والإزار (ما تحت الحوض) بعد حذف الذراعين والساقين والقدمين"""
    h, w = body.shape
    ys, xs = np.mgrid[0:h, 0:w]
    out = rgba.copy()
    out[~body] = 0
    headx = np.zeros(body.shape, bool)
    for r in o.get('headx', ()):
        headx |= region_mask(body.shape, r)
    torsox = np.zeros(body.shape, bool)               # يتبع الجذع وإن نزل تحت الحوض (درع، طبل، سلاح على الظهر)
    for r in o.get('torsox', ()):
        torsox |= region_mask(body.shape, r)
    torsox &= ~tm
    r0, r1 = int(m['ar0'] - 4), int(m['ar1'] + 5)
    band = (ys >= r0) & (ys < r1)
    arms = band & ((xs > m['t1w'] + 1) | (xs < m['t0w'] - 1))
    roots = band & ((xs > m['t1'] + 1) | (xs < m['t0'] - 1)) & tm
    legs = (ys > m['yv']) & (xs >= m['lx0']) & (xs <= m['lx1'])
    if m['visible']:
        # الساق الظاهرة: يُحذف ما بلون الساق وحده (من الساقين تحت ملتقاهما)، فيبقى ما أمامها (مئزر، حزام، شرابة)
        ref = rgba[int(m['ysep']):int(m['fy0'])][legs[int(m['ysep']):int(m['fy0'])] & body[int(m['ysep']):int(m['fy0'])]]
        q = ref[ref[:, 3] > 200, :3] // 16
        pal = np.zeros((16, 16, 16), bool)
        idx, cnt = np.unique(q, axis=0, return_counts=True)
        pal[tuple(idx[cnt >= 3].T)] = True
        pal = ndimage.binary_dilation(pal, iterations=1)
        qq = rgba[..., :3] // 16
        legs &= pal[qq[..., 0], qq[..., 1], qq[..., 2]] | (ys >= m['ysep'])
    feet = (ys >= m['fy0'] - 4) & (xs >= m['fx0']) & (xs <= m['fx1'])
    out[(arms | roots | (legs & ~torsox) | feet) & ~headx] = 0
    head = out.copy()
    head[(ys >= m['neck']) & ~headx] = 0
    rest = out
    rest[(ys < m['neck'] - 4) | headx] = 0         # تداخل صغير يغطيه الرأس
    torso, skirt = rest.copy(), rest.copy()
    torso[(ys >= m['hip'] + 2) & ~torsox] = 0
    skirt[(ys < m['hip'] - 0.05 * m['span']) | torsox] = 0     # يمتد تحت الجذع فلا تظهر فجوة عند التمايل
    for part in (head, torso, skirt):              # فتات منفصل بعد القص (طرف وتر، حافة سلاح) لا يُرسم
        lab, n = ndimage.label(part[..., 3] > 40)
        if n > 1:
            sizes = np.bincount(lab.ravel())
            sizes[0] = 0
            part[(lab > 0) & (sizes[lab] < max(150, 0.01 * sizes.max()))] = 0
    return head, torso, skirt


def build_arm_n(rgba, m):
    """مثل build_arm بخط الذراع عند مركز اليد وبنصف قطر طرفها (الأكمام الواسعة أعرض من اليد)"""
    return build_arm(rgba, dict(m, ah=m['rt'], ac=m['ya'], t1=m['t1w']))


def build_leg_n(rgba, body, m):
    """فخذ وساق بقدم: الساق كبسولة من مقطع الساق الظاهرة، أو من مقطع العضد (ثوب حتى القدمين)"""
    k = m['k']
    if m['visible'] and m['fy0'] - max(m['ysep'], m['yv']) > 0.03 * m['span']:
        ylr = int((max(m['ysep'], m['yv']) + m['fy0']) / 2)
        c0, c1 = int(m['la']) - 3, int(m['lb']) + 4
        ref = rgba[ylr, c0:c1]
        rcx = (m['la'] + m['lb']) / 2
    else:                                           # مقطع اليد بلون الجسد (الكُم قد يغطي العضد)
        col = rgba[:, int(m['xr'] - m['rt'])]
        y0, y1 = int(m['ya'] - m['rt'] * 1.3), int(m['ya'] + m['rt'] * 1.3)
        on = np.where(col[y0:y1, 3] > 0)[0] + y0
        ref = col[on.min():on.max() + 1]
        rcx = m['xf']
        c0 = int(rcx - len(ref) / 2)
        c1 = c0 + len(ref)
    r = (c1 - c0) / 2
    th, sn = THIGH / k, SHIN / k
    thigh = capsule(ref, th, r)
    sole_y = r + sn - SOLE / k
    dy = sole_y - m['sole']
    rx = (m['fw'] / 2)
    fwd = int(round(0.25 * rx))                     # إزاحة صحيحة: نصف بكسل يُقرَّب للزوجي فتسقط أعمدة
    xf = m['xf']
    fx0 = int(min(xf - (c1 - c0) / 2, xf - rx - 3 + fwd)) - 2
    fx1 = int(max(xf + (c1 - c0) / 2, xf + rx + 4 + fwd)) + 2
    tube = capsule(ref, m['fy0'] + 6 + dy - r, r)
    sh = np.zeros((int(sole_y) + 3, fx1 - fx0, 4), np.uint8)
    tx0 = int(rcx - r) - fx0 + int(xf - rcx)
    sh[:tube.shape[0], tx0:tx0 + tube.shape[1]] = tube[:sh.shape[0]]
    h, w = body.shape
    ys, xs = np.mgrid[0:h, 0:w]
    foot = body & (ys >= m['fy0'] - 4) & (xs > m['cx']) & (xs <= m['fx1'])
    for y, x in zip(*np.where(foot)):
        tx, ty = x + fwd - fx0, int(np.floor(y + dy + 0.5))
        if 0 <= tx < sh.shape[1] and 0 <= ty < sh.shape[0]:
            sh[ty, tx] = rgba[y, x]
    return (thigh, (r, r), (r, r + th)), (sh, (xf - fx0, r), (xf - fx0, r + sn))


def build_leg_img(rgba, m, L):
    """رجل الصورة نفسها (لا كبسولة): ما داخل poly من حافة الثوب hem إلى النعل، وفوق الحافة صف السروال ref مكرراً
    حتى الحوض. وصفوفها تُمد خطياً فتقع ركبة الصورة knee على ركبة الهيكل، وطرفا الفخذ والساق مدوّران حول المفصل"""
    k = m['k']
    hip, sole = m['hip'], m['sole']
    knee = hip + THIGH / k
    x0, x1 = L['x']
    im = Image.new('L', (rgba.shape[1], rgba.shape[0]), 0)
    ImageDraw.Draw(im).polygon(L['poly'], fill=1)
    leg = np.where(np.array(im, bool)[..., None], rgba, 0).astype(np.uint8)[:, x0:x1]
    ref = leg[L['ref']].copy()
    ax, r = L['axis'] - x0, L['r']

    def rows(ya, yb):
        ys = np.arange(int(math.floor(ya)), int(math.ceil(yb)) + 1)
        src = np.where(ys <= knee, hip + (ys - hip) * (L['knee'] - hip) / (knee - hip),
                       L['knee'] + (ys - knee) * (sole - L['knee']) / (sole - knee))
        out = leg[np.clip(np.round(src).astype(int), 0, leg.shape[0] - 1)].copy()
        out[src < L['hem']] = ref
        return ys, out

    def cap(part, ys, cy, above):
        d = ys[:, None] - cy
        far = (d < 0) if above else (d > 0)
        part[far & ((np.arange(part.shape[1]) - ax)[None, :] ** 2 + d ** 2 > r * r)] = 0

    ys, thigh = rows(hip - r, knee + r)
    cap(thigh, ys, hip, True)
    cap(thigh, ys, knee, False)
    ys2, shin = rows(knee - r, sole + 3)
    cap(shin, ys2, knee, True)
    return ((thigh, (ax, hip - ys[0]), (ax, knee - ys[0])),
            (shin, (ax, knee - ys2[0]), (ax, knee + SHIN / k - ys2[0])))


def item_part(img, spec, k):
    """مقبض القطعة وطرفها ومقياسها (بنفس قواعد weapon_parts)"""
    ys, xs = np.where(img[..., 3] > 40)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    pts = np.stack([xs, ys], 1).astype(float)
    mean = pts.mean(0)
    kind = spec['kind']
    reach = butt = 0.0
    if kind == 'bow':
        # يتحدّب للأمام (يميناً) والوتر خلفه: القوس المتحدب يساراً يُقلب
        mid = np.abs(ys - mean[1]) <= 0.08 * (y1 - y0)
        ends = np.abs(ys - mean[1]) >= 0.4 * (y1 - y0)
        if xs[mid].mean() < xs[ends].mean():
            img = np.flip(img, 1).copy()
            xs = img.shape[1] - 1 - xs
            x0, x1 = img.shape[1] - x1, img.shape[1] - x0
            mid = np.abs(ys - mean[1]) <= 0.08 * (y1 - y0)
        grip = np.array([xs[mid].max() - 0.08 * (x1 - x0), mean[1]])
        tip = np.array([grip[0], y0])
        length = y1 - y0
    elif kind in ('round', 'blob'):
        g = spec['grip'] if kind == 'blob' else (0.5, 0.5)
        grip = np.array([x0 + g[0] * (x1 - x0), y0 + g[1] * (y1 - y0)]) if kind == 'blob' else mean
        tip = grip + (0, -10)
        length = y1 - y0
    else:
        v = np.array([0.0, 1.0]) if spec['axis'] == 'v' else np.linalg.eigh(np.cov((pts - mean).T))[1][:, -1]
        t = (pts - mean) @ v
        e1, e2 = mean + v * t.min(), mean + v * t.max()
        upper, lower = (e1, e2) if e1[1] < e2[1] else (e2, e1)
        tip, bt = (upper, lower) if spec['tip'] == 'up' else (lower, upper)
        grip = bt + (tip - bt) * spec['grip']
        length = t.max() - t.min()
    scale = spec['length'] / (length * k)
    if kind == 'pole':
        reach = math.dist(grip, tip) * k * scale
        butt = spec['grip'] * spec['length']
    return dict(img=img[y0:y1, x0:x1], a=(grip[0] - x0, grip[1] - y0), b=(tip[0] - x0, tip[1] - y0),
                scale=scale, reach=reach, butt=butt)


def nation_units(nation):
    """قطع وحدات أمة (أو الشرطة): [(مفتاح الوحدة، اسم الجزء، الصورة، المفصل، الطرف، ملوّن؟، داكن؟، إضافات)]، ووصف رسمها"""
    folder, hue, units = NATIONS[nation]
    out, arts, refs = [], {}, []
    for kind, (fname, items, o) in units.items():
        key = nation + '_' + kind
        rgba = np.array(Image.open(os.path.join(NSRC, folder, fname + '.png')).convert('RGBA'))
        if folder in SHADOWED:
            shadow_off(rgba)
        tm = tint_mask_n(rgba, hue) > 0.5
        got = {}
        for it in items:                             # القطع المقتطعة من الصورة نفسها (ملتصقة بالجسد)
            if it['region'] or it['circle']:
                mm = region_mask(rgba.shape, it['region'], it['circle']) & (rgba[..., 3] > 0) & ~tm
                got[it['name']] = np.where(mm[..., None], rgba, 0).astype(np.uint8)
                rgba[mm] = 0
        for r in o.get('drop', ()):
            hh, ss, _ = hsv(rgba[..., :3] / 255.0)
            red = ((hh < 25) | (hh > 335)) & (ss > 0.4)
            rgba[region_mask(rgba.shape, r) & ~red] = 0
        lab, n = ndimage.label(rgba[..., 3] > 40)
        sizes = np.bincount(lab.ravel())
        sizes[0] = 0
        bi = sizes.argmax()
        comps = sorted((np.where(lab == i)[1].min(), i) for i in range(1, n + 1) if i != bi and sizes[i] > 300)
        for it in items:
            if it['comp'] is not None:
                ids = it['comp'] if isinstance(it['comp'], tuple) else (it['comp'],)
                mm = np.isin(lab, [comps[j][1] for j in ids])
                got[it['name']] = np.where(mm[..., None], rgba, 0).astype(np.uint8)
        body = lab == bi
        rgba = np.where(body[..., None], rgba, 0).astype(np.uint8)
        if o.get('arm') == 'left':                   # الذراع اليمنى مغطاة: الصورة كلها مقلوبة
            rgba, body = np.flip(rgba, 1).copy(), np.flip(body, 1).copy()
        for f in o.get('fill', ()):                  # الثقب خلف الدرع المقتطع
            _, xl, xr = arm_line(body)
            fx = f[0] if o.get('arm') != 'left' else rgba.shape[1] - 1 - f[0]
            mirror_fill(rgba, body, (xl + xr) / 2, region_mask(rgba.shape, circle=(fx, f[1], f[2])))
        tmask = tint_mask_n(rgba, hue)
        m = measure_n(rgba, body, o, tmask > 0.5)
        f = ATLAS_SCALE / m['s']
        arm_px = (tmask > 0.5) & (np.arange(rgba.shape[0])[:, None] >= m['ar0']) & (np.arange(rgba.shape[0])[:, None] <= m['ar1'])
        _, s_, v_ = hsv(rgba[..., :3] / 255.0)
        sel = arm_px & (s_ > 0.35)
        refs.append((np.median(s_[sel]), np.median(v_[sel])))

        def add(name, img, a, b, tinted=True, dark=False, extra=(), scale=1.0):
            im = img.copy()
            if dark:
                im[..., :3] = (im[..., :3].astype(float) * DARK).astype(np.uint8)
            small, ms = shrink(im, f * scale, tint_mask_n(img, hue) if tinted else None)
            out.append(dict(unit=key, name=name, img=small, mask=ms, extra=extra,
                            a=(a[0] * f * scale, a[1] * f * scale), ang=math.atan2(b[1] - a[1], b[0] - a[0])))

        head, torso, skirt = build_body_n(rgba, body, m, o, tmask > 0.5)
        img, (x0, y0) = crop(torso)
        add('torso', img, (m['cx'] - x0, m['hip'] - y0), (m['cx'] - x0, m['chest'] - y0))
        img, (x0, y0) = crop(head)
        add('head', img, (m['cx'] - x0, m['head'] - y0), (m['cx'] - x0, m['head'] - y0 - 10))
        ys, xs = np.where(skirt[..., 3] > 40)
        mid = (xs > m['t0']) & (xs < m['t1'])
        hem = ys[mid].max() if mid.any() else m['hip'] + 0.1 * m['span']
        drop = max(hem - m['hip'], 0.06 * m['span'])
        img, (x0, y0) = crop(skirt)
        add('skirt', img, (m['cx'] - x0, m['hip'] - y0), (m['cx'] - x0, m['hip'] + drop - y0),
            extra=(1.0, round(drop * m['k'], 2), 0.0))
        upper, lower = build_arm_n(rgba, m)
        thigh, shin = build_leg_img(rgba, m, o['legimg']) if 'legimg' in o else build_leg_n(rgba, body, m)
        for nm, (im, a, b) in (('ua', upper), ('la', lower), ('th', thigh), ('sn', shin)):
            add(nm, im, a, b)
            add(nm + 'D', im, a, b, dark=True)
        uses = {}
        for it in items:
            if it['use'] == 'none':
                continue
            img = got[it['name']]
            if o.get('arm') == 'left':
                img = np.flip(img, 1).copy()
            p = item_part(img, it, m['k'])
            # القطعة مصغّرة بحجمها في اللعبة مباشرة (أوضح من تصغيرها وقت الرسم)، فمقياسها في البيانات 1
            add(it['name'], p['img'], p['a'], p['b'], tinted=False, scale=p['scale'],
                extra=(1.0, round(p['reach'], 2), round(p['butt'], 2)))
            uses[it['name']] = it['use']
        arts[key] = dict(uses=uses, **{x: o[x] for x in ('twoH', 'pair', 'arrows', 'fire') if x in o})
    return out, arts, refs


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


def write_atlas(name, parts, units, refs, fmt='png'):
    """يعبّئ الأجزاء في أطلس واحد (الألوان فوق والقناع تحت) ويعيد وصفه للبيانات.
    webp لصور الأمم والشرطة (نقوشها كثيرة فالـ png ثلاثة أضعافه): الألوان بجودة 90 والشفافية (القناع) بلا فقد"""
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
    used = max(p['at'][0] + p['img'].shape[1] for p in parts) + PAD
    out = Image.fromarray(atlas[:, :used], 'RGBA')
    if fmt == 'webp':
        out.save(os.path.join(OUT_PNG, name + '.webp'), 'WEBP', quality=90, method=6, alpha_quality=100)
    else:
        out.save(os.path.join(OUT_PNG, name + '.png'), optimize=True)
    print(name, 'atlas', used, 'x', height * 2, 'parts', len(parts))
    return {'src': f'assets/units/{name}.{fmt}', 'h': height,
            'sat': round(float(np.median([r[0] for r in refs])), 3),
            'val': round(float(np.median([r[1] for r in refs])), 3), 'units': units}


def main():
    if not os.path.isdir(SRC):
        sys.exit('ضع صور العصابات الكلاسيكية في ' + SRC)
    data = {'upp': UPP, 'gangs': {}}
    os.makedirs(OUT_PNG, exist_ok=True)
    for gang, g in GANGS.items():
        parts, units, refs = [], {}, []
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
            refs.append((np.median(s_[tm]), np.median(v_[tm])))
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

        data['gangs'][gang] = write_atlas(gang, parts, units, refs)
        # فحص ذاتي: كل وحدة بكل أجزائها، وإلا فصورة خرجت عن القالب
        for key, u in units.items():
            need = {'torso', 'head', 'ua', 'la', 'th', 'sn', 'uaD', 'laD', 'thD', 'snD'} | {w['name'] for w in UNITS[key][1]}
            assert need <= u.keys(), (key, need - u.keys())
    for nation in NATIONS:
        parts, arts, refs = nation_units(nation)
        units = {key: {'_': art} for key, art in arts.items()}
        data['gangs'][nation] = write_atlas(nation, parts, units, refs, 'webp')
        for key, u in units.items():
            need = {'torso', 'head', 'skirt', 'ua', 'la', 'th', 'sn', 'uaD', 'laD', 'thD', 'snD'} | set(u['_']['uses'])
            assert need <= u.keys(), (key, need - u.keys())

    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write('// مولَّد بالأداة scripts/slice_units.py من صور الشخصيات (الكلاسيكية والأمم والشرطة) — لا تعدّله يدوياً\n')
        fh.write('// كل جزء: [x, y, عرض, ارتفاع, مفصلX, مفصلY, زاوية محوره في الصورة، ثم للسلاح: مقياسه, بُعد طرفه, مؤخرته]\n')
        fh.write('// (والإزار skirt: بُعد حاشيته عن الحوض). ولوحدات الأمم والشرطة "_": كيف تُحمل قطعها (uses) وما يخصها\n')
        fh.write('export const SPRITES = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    sys.exit(main())
