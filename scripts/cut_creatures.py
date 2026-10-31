#!/usr/bin/env python3
"""ترول الجبل والفيل الحربي بصورتي المستخدم (القسم 3.11): تقطيع كل صورة إلى أجزاء تتحرك في creatureArt.js.

الاستعمال (من جذر المشروع):  python3 scripts/cut_creatures.py
يحتاج: Pillow وnumpy وscipy. الصورتان خارج المستودع (.gitignore) في docs/characters/creatures/ (troll.png وelephant.png).
تكتب: أطلساً لكل مخلوق assets/units/creature_<الاسم>.webp (أجزاؤه متجاورة، وللفيل قناع ما يأخذ لون مالكه تحتها)
وjs/render/creatureSpritesData.js.

الترول: الساعد الأمامي (بسواره وقبضته) قطعة تدور حول المرفق والهراوة في قبضته، وفي الجسد مكانه نهاية عضد
مدوّرة (تظهر حين يرتفع الساعد)، والساعد الخلفي يبقى في الجسد. والساقان لا تُقطعان: يُرسم أسفل الجسد بشبكة
مثلثات (mesh) أعمدتها xs في الفراغ بين الساقين، فتتحرك كل ساق بما حولها كتلة واحدة ويتمدد ما بينهما فيمشي بلا
فجوات. الفيل: الرأس (الخوذة والأذن والوجه والنابان والخرطوم) قطعة تومئ حول الرقبة، وما خلف الأذن من الجسد مملوء
بألوان ما حوله، والساقان بالشبكة نفسها، والقماش الأحمر يأخذ لون مالكه.
كل الإحداثيات في البيانات بإحداثيات الصورة الأصلية (بكسل)، وk وحدة رسم لكل بكسل منها.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from slice_units import shrink, hsv   # noqa: E402  نفس التصغير والألوان

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'characters', 'creatures')
OUT_JS = os.path.join(ROOT, 'js', 'render', 'creatureSpritesData.js')
SCALE = 0.6          # الأطلس 60% من الصورة الأصلية: يكفي أقصى تقريب
CLOTH = 0.88         # كسوة الفيل بلون مالكه أغمق بهذا القدر
PAD = 3


def poly(shape, pts):
    im = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=1)
    return np.array(im, bool)


def disc(shape, c, r):
    ys, xs = np.ogrid[:shape[0], :shape[1]]
    return (xs - c[0]) ** 2 + (ys - c[1]) ** 2 <= r * r


def cap_under(img, c, r, color, edge=7):
    """نهاية عضد مدوّرة عند المرفق تحت ما في الصورة: تظهر حيث كان الساعد فقط، وحدّ العضد الأسود عندها يصير جلداً"""
    inner = disc(img.shape, c, r - edge)
    empty = img[..., 3] < 128
    near = ndimage.binary_dilation(empty & inner, iterations=8)
    seam = inner & near & (np.abs(img[..., :3].astype(int) - color).sum(-1) > 40)
    img[seam] = (*color, 255)
    cap = np.zeros_like(img)
    cap[disc(img.shape, c, r)] = (12, 12, 14, 255)
    cap[inner] = (*color, 255)
    img[empty] = cap[empty]


def fill_with(img, hole, keep, width, color):
    """ما خلف القطعة المتحركة من الجسد: لون الجلد في شريط بعرض width داخل hole يلي الجسد (keep)، فلا يظهر فراغ
    حين تتحرك القطعة"""
    band = hole & (ndimage.distance_transform_edt(~keep) <= width)
    img[band] = (*color, 255)


def grade(img, gamma, gain, gray):
    """أغمق وأقتم (بطلب المستخدم): منحنى gamma يعتّم الألوان المتوسطة أكثر من الفاتحة، ثم gain، ثم مزج gray
    نحو الرمادي (تشبع أقل)"""
    c = (img[..., :3] / 255.0) ** gamma * gain
    c += (c.mean(-1, keepdims=True) - c) * gray
    img[..., :3] = np.clip(c * 255 + 0.5, 0, 255).astype(np.uint8)


def crop(img):
    ys, xs = np.where(img[..., 3] > 0)
    x0, y0 = int(xs.min()), int(ys.min())
    return img[y0:ys.max() + 1, x0:xs.max() + 1], (x0, y0)


def troll(img):
    a = img[..., 3] > 20
    lab, _ = ndimage.label(a)
    club = lab == lab[900, 1300]                       # الهراوة ملقاة على الأرض يميناً: قطعة منفصلة
    # الجلد الأزرق الموصول بالعضد يبقى في الجسد ولو دخل حدود الساعد
    blue = (img[..., 2].astype(int) > img[..., 0].astype(int) + 40) & a
    blab, _ = ndimage.label(blue)
    body_blue = (blab == blab[470, 830]) & ~poly(img.shape, [(866, 505), (905, 460), (940, 455), (905, 525)])
    # الساعد الأمامي: من رؤوس فراء سواره تحت العضد إلى القبضة، والحد مع الساق في الفراغ بينهما. والخلفي يبقى في الجسد
    fore = poly(img.shape, [(760, 590), (775, 590), (800, 560), (845, 528), (880, 500), (905, 470), (930, 462),
                            (960, 470), (1032, 520), (1036, 862), (822, 862), (820, 800), (812, 700), (790, 668),
                            (779, 650), (768, 630), (760, 612)]) & a & ~club & ~body_blue
    flab, _ = ndimage.label(fore)
    fore = flab == np.argmax(np.bincount(flab[fore]))           # بلا فتات من حدود الساق
    grade(img, 1.7, 0.74, 0.3)                                  # أغمق (بطلب المستخدم)، بعد قياس الأقنعة بألوان الأصل
    base = img.copy()
    base[fore | club] = 0
    sel = blue[300:520, 230:870] & (img[300:520, 230:870, 3] > 200)
    skin = tuple(int(v) for v in np.median(img[300:520, 230:870][sel][:, :3], 0))      # أزرق الجلد
    elbow = (832, 540)
    cap_under(base, elbow, 60, skin)

    ys, xs = np.where(club)
    pts = np.stack([xs, ys], 1).astype(float)
    mean = pts.mean(0)
    v = np.linalg.eigh(np.cov((pts - mean).T))[1][:, -1]
    t = (pts - mean) @ v
    if v[0] < 0:
        v, t = -v, -t
    hand = mean + v * (t.min() + 0.09 * (t.max() - t.min()))     # المقبض قرب طرف العصا الأيسر
    parts = {
        'base': base,
        'fore': np.where(fore[..., None], img, 0).astype(np.uint8),
        'club': np.where(club[..., None], img, 0).astype(np.uint8),
    }
    data = {
        'origin': [515, 1062], 'height': 980,
        'elbow': list(elbow), 'fist': [928, 762],
        'clubGrip': [round(float(hand[0]), 1), round(float(hand[1]), 1)],
        'clubAngle': round(math.atan2(v[1], v[0]), 4),
        # أسفل الجسد بالشبكة: من y0 إلى y1 بـ ny صفاً، والأعمدة: الحافة، ثم الفراغ بين الساقين، ثم الحافة
        'mesh': {'y0': 640, 'y1': 1072, 'xs': [60, 450, 575, 965], 'ny': 4},
    }
    return parts, data, None


def elephant(img):
    a = img[..., 3] > 20
    h, s, v = hsv(img[..., :3] / 255.0)
    # الرأس: الخوذة والوجه والنابان والخرطوم يمين الرقبة، والأذن بحدها الأسود (تُملأ من داخلها فلا تأخذ القماش خلفها)
    area = poly(img.shape, [(840, 400), (900, 345), (990, 330), (998, 290), (1070, 130), (1250, 130), (1335, 300),
                            (1350, 520), (1446, 760), (1446, 842), (1352, 932), (1150, 932), (1150, 760), (1110, 690),
                            (1060, 662), (840, 662)]) & a
    xs = np.arange(img.shape[1])[None, :]
    ys = np.arange(img.shape[0])[:, None]
    lab, _ = ndimage.label(area & (s < 0.25) & (v > 0.3))
    ear = ndimage.binary_dilation(lab == lab[470, 960], iterations=12) & area & ((v < 0.3) | (s < 0.25))
    head = (area & ((xs >= 1060) | (ys < 345))) | ear
    # طرف الخرطوم الملتف يتمايل وحده، والذيل يتأرجح حول أصله
    trunk = poly(img.shape, [(1150, 812), (1275, 812), (1290, 840), (1290, 935), (1150, 935)]) & head
    tail = poly(img.shape, [(100, 690), (300, 650), (340, 650), (318, 690), (300, 760), (245, 840), (200, 900),
                            (100, 900)]) & a & ~head
    grade(img, 1.6, 0.72, 0.15)                                 # أغمق (بطلب المستخدم)، بعد قياس الأقنعة بألوان الأصل
    belly = img[700:760, 400:800][(s[700:760, 400:800] < 0.2) & a[700:760, 400:800]]
    skin = tuple(int(c) for c in np.median(belly[:, :3], 0))    # رمادي الجلد
    body = img.copy()
    body[head | tail] = 0
    keep = a & ~head & ~tail
    fill_with(body, head, keep, 34, skin)                       # الرقبة خلف الأذن والرأس
    fill_with(body, tail, keep, 12, skin)                       # أصل الذيل
    cut = lambda m: np.where(m[..., None], img, 0).astype(np.uint8)
    face = head & ~ear & ~trunk
    head_img = cut(face)
    fill_with(head_img, ear | trunk, face, 18, skin)            # تحت الأذن وعند أصل طرف الخرطوم
    parts = {
        'tail': cut(tail),
        'body': body,
        'trunk': cut(trunk),
        'head': head_img,
        'ear': cut(ear),
    }
    data = {
        'origin': [688, 1040], 'height': 815,
        # محاور: الرقبة، وأعلى الأذن عند الوجه، وأعلى طرف الخرطوم، وأصل الذيل، والقدمان على الأرض
        'neck': [1060, 540], 'ear': [1092, 440], 'trunk': [1270, 815], 'tail': [322, 668],
        'rearFoot': [335, 1040], 'frontFoot': [1035, 1040],
        'mesh': {'y0': 690, 'y1': 1046, 'xs': [120, 530, 850, 1186], 'ny': 4},
    }
    gem = disc(img.shape, (1268, 414), 34)               # الجوهرة الحمراء على الخوذة تبقى حمراء

    def cloth(part):
        """القماش الأحمر (وما مُلئ من لونه خلف الأذن) بتدرج: ما يأخذ لون المالك"""
        ph, ps, pv = hsv(part[..., :3] / 255.0)
        red = ((ph < 12) | (ph > 345)) & (pv > 0.1) & (part[..., 3] > 0) & ~gem     # لا خشب الهودج البني
        return (red * np.clip((ps - 0.4) / 0.2, 0, 1)).astype(np.float32)
    sel = cloth(img) > 0.99
    _, gs, gv = hsv(img[..., :3] / 255.0)
    # القماش بلون مالكه أغمق قليلاً (CLOTH) كبقية الفيل
    return parts, data, (cloth, (float(np.median(gs[sel])), float(np.median(gv[sel])) / CLOTH))


def main():
    out = {}
    for name, fn in (('troll', troll), ('elephant', elephant)):
        img = np.array(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
        parts, data, tint = fn(img)
        cells, x = [], PAD
        data['parts'] = {}
        for pname, pimg in parts.items():
            cimg, (x0, y0) = crop(pimg)
            m = tint[0](pimg)[y0:y0 + cimg.shape[0], x0:x0 + cimg.shape[1]] if tint else None
            small, ms = shrink(cimg, SCALE, m)
            cells.append((small, ms, x))
            data['parts'][pname] = [x, PAD, small.shape[1], small.shape[0], x0, y0]   # مكانه في الأطلس، وأصله في الصورة
            x += small.shape[1] + PAD
        h = max(c[0].shape[0] for c in cells) + 2 * PAD
        atlas = np.zeros((h * (2 if tint else 1), x, 4), np.uint8)
        for small, ms, xx in cells:
            hh, ww = small.shape[:2]
            atlas[PAD:PAD + hh, xx:xx + ww] = small
            if tint:
                atlas[h + PAD:h + PAD + hh, xx:xx + ww, :3] = 255
                atlas[h + PAD:h + PAD + hh, xx:xx + ww, 3] = ms
        src = 'assets/units/creature_' + name + '.webp'
        Image.fromarray(atlas, 'RGBA').save(os.path.join(ROOT, src), 'WEBP', quality=90, method=6, alpha_quality=100)
        print(name, 'atlas', atlas.shape[1], 'x', atlas.shape[0], os.path.getsize(os.path.join(ROOT, src)) // 1024, 'KB')
        out[name] = {'src': src, 'h': h, **data}
        if tint:
            out[name]['tint'] = {'sat': round(tint[1][0], 3), 'val': round(tint[1][1], 3)}
    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write('// مولَّد بالأداة scripts/cut_creatures.py من صورتي الترول والفيل — لا تعدّله يدوياً\n')
        fh.write('// parts: [x, y, عرض, ارتفاع في الأطلس، ثم أصله x0, y0 في الصورة الأصلية]. scale: الأطلس من الأصل،\n')
        fh.write('// وh ارتفاع الألوان في الأطلس (وقناع الصبغ تحتها في الفيل، tint تشبع لونه الأصلي وإضاءته)\n')
        fh.write('export const CREATURE_SPRITES = ' + json.dumps(
            {'scale': SCALE, **out}, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    sys.exit(main())
