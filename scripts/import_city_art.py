# صور المستخدم المحسّنة للمدن الـ24 (2.0.7) إلى حزمة الصور flutter_game/assets/map/ وmanifest.json، ثم: python3 scripts/pack_atlases.py
# الاستعمال: python3 -I scripts/import_city_art.py <مجلد الصور المفكوك>
# الصور على لوحة 432×713 ونقطة الارتكاز (وسط المربع) عند (216، 594)، وقطع السور على 259×302 وارتكازها (129.5، 216).
# تُقص إلى ما فيها وتُحفظ webp، والمبنى العادي صورة واحدة لنسخه الثلاث. وترقيات البرج والمستشفى ومستويات القاعدة
# بحقل up، وساحة التدريب (عامة) لكل مدينة. وقناع -owner لكل مبنى اقتصاد وقطعة سور وساحة: رايات الأزرق الملكي
# رمادية بإضاءتها، فيضرب فيها المحرك لون المالك (رقع زرقاء ممتلئة، لا خطوط الواجهات ولا نوافذها الزرقاء)
import json
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
MAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'map')
ANCHOR, WALL_ANCHOR = (216, 594), (129.5, 216)
SIZES = {'حي صغير': 'small', 'حي متوسط': 'medium', 'حي كبير': 'large'}
WALLS = {'ضلع الوجه الأيسر': 'left', 'ضلع الوجه الأيمن': 'right', 'بوابة الوجه الأيسر': 'gate_left',
         'بوابة الوجه الأيمن': 'gate_right', 'برج الركن': 'tower'}
UPS = {'السرعة': 'rate', 'الضرر': 'damage', 'المدى': 'radius'}
Q = 92   # الحزمة مصدر الأطلس (والأطلس 85)


def up_of(name):
    if name == 'كل الترقيات': return 'all'
    m = re.match(r'(?:ترقية (\S+)|مستوى) (\d)', name)
    if not m: return None
    return (UPS[m.group(1)] if m.group(1) else 'tier') + m.group(2)


def banners(a, band=False):
    """قناع رايات الأزرق الملكي: رمادي بإضاءة الراية، وشفافية الصورة. band: قطعة سور، فشريط أعلاه الرفيع من القناع أيضاً"""
    f = a.astype(np.float32) / 255
    rgb = f[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    c = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(c, 1e-6)
    hue = np.where(c > 0, np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60, 0)
    sat = np.where(mx > 0, c / np.maximum(mx, 1e-6), 0)
    seen = f[..., 3] > 0.1
    # السور: شريطه وظله ورايات صغيرة تحته بمدى أوسع، والمباني: الأزرق الملكي وحده
    core = seen & ((hue >= 210) & (hue <= 238) & (sat > 0.55) if band else (hue >= 218) & (hue <= 234) & (sat > 0.7)) & (mx > 0.2)
    lab, _ = ndimage.label(core, np.ones((3, 3)))
    keep = np.zeros_like(core)
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == k
        if (band and m.sum() >= 8) or (m.sum() >= 40 and m.mean() >= 0.4): keep[sl] |= m
    if not keep.any(): return None
    # حافة الراية الناعمة: الجيران الزرقاء حولها
    keep = ndimage.binary_dilation(keep, iterations=1) & seen & (hue >= 200) & (hue <= 250) & (sat > 0.25)
    out = np.zeros_like(a)
    v = (np.clip(mx / 0.8, 0, 1) * 255).astype(np.uint8)
    out[..., 0] = out[..., 1] = out[..., 2] = v
    out[..., 3] = np.where(keep, a[..., 3], 0)
    return out


man = json.load(open(os.path.join(MAP, 'manifest.json')))


def save(im, rel):
    path = os.path.join(MAP, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=Q, method=6)


def place(path, rel, meta, anchor=ANCHOR, mask=False, band=False):
    """يقص الصورة ويحفظها ويعيد مدخل manifest"""
    im = Image.open(path).convert('RGBA')
    box = im.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox()
    im = im.crop(box)
    save(im, rel)
    e = {'file': rel, **meta, 'w': im.size[0], 'h': im.size[1], 'ax': anchor[0] - box[0], 'ay': anchor[1] - box[1]}
    if mask:
        m = banners(np.asarray(im), band)
        if m is not None:
            e['owner'] = rel[:-5] + '-owner.webp'
            save(Image.fromarray(m), e['owner'])
    return e


def drop(entry, keep):
    for k in ('file', 'roof', 'owner'):
        p = entry.get(k)
        if p and p not in keep and os.path.exists(os.path.join(MAP, p)): os.remove(os.path.join(MAP, p))


# ساحة التدريب: عامة، صورة لكل مستوى تُرص في أطلس كل مدينة
general = os.path.join(SRC, '0-عام لكل المدن')
yard = [place(os.path.join(general, f'ساحة التدريب في حي القاعدة - مستوى {n}.png'), f'cities/_common/yard_{n}.webp',
              {'group': 'yard', 'kind': 'yard', 'level': n}, mask=True) for n in (1, 2, 3)]

done = []
for region in sorted(os.listdir(SRC)):
    if region.startswith('0-'): continue
    for cd in sorted(os.listdir(os.path.join(SRC, region))):
        city = re.search(r'\(([a-z]+)\)', cd).group(1)
        base, root = f'cities/{city}', os.path.join(SRC, region, cd)
        old = man['cities'][city]['images']
        new = []
        replaced = set()          # (group, kind) القديمة التي حلت محلها صور جديدة

        def sub(name):
            d = os.path.join(root, name)
            return [(f[:-4], os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.endswith('.png')] if os.path.isdir(d) else []

        for name, p in sub('1-المباني العادية'):
            kind = re.search(r'\(([A-Za-z0-9_]+)\)', name).group(1)
            if kind == 'ruin':
                group, rel = 'ruin', f'{base}/ruins/ruin_1.webp'
            else:
                group = next((r['group'] for r in old if r['kind'] == kind and r['group'] in ('building', 'prop')), 'building')
                rel = f'{base}/{"props" if group == "prop" else "buildings"}/{kind}.webp'
            replaced.add((group, kind))
            new.append(place(p, rel, {'group': group, 'kind': kind, 'variant': 1}))
        for name, p in sub('2-معلم المدينة'):
            replaced.add(('monument', 'monument'))
            new.append(place(p, f'{base}/monument.webp', {'group': 'monument', 'kind': 'monument'}))
        for name, p in sub('3-المبنى المميز'):
            kind = re.search(r'\(([A-Za-z0-9_]+)\)', name).group(1)
            o = next(r for r in old if r['group'] == 'feature' and r['kind'] == kind)
            replaced.add(('feature', kind))
            new.append(place(p, f'{base}/feature/{kind}.webp', {'group': 'feature', 'kind': kind, 'footprint': o.get('footprint', 2)}))
        for folder, kind in (('4-برج الرماية', 'tower'), ('5-المستشفى', 'hospital'), ('6-القاعدة', 'hq')):
            for name, p in sub(folder):
                replaced.add(('economy', kind))
                if name in SIZES:
                    new.append(place(p, f'{base}/economy/{kind}_{SIZES[name]}.webp', {'group': 'economy', 'kind': kind, 'size': SIZES[name]}, mask=True))
                else:
                    up = up_of(name)
                    assert up, (city, folder, name)
                    new.append(place(p, f'{base}/economy/{kind}_{up}.webp', {'group': 'economy', 'kind': kind, 'up': up}, mask=True))
        for name, p in sub('7-مركز الشرطة'):
            replaced.add(('economy', 'police'))
            new.append(place(p, f'{base}/economy/police.webp', {'group': 'economy', 'kind': 'police', 'size': 'medium'}))
        for name, p in sub('8-الأسوار'):
            m = re.match(r'مستوى (\d) - (.*)', name)
            if m.group(2) not in WALLS: continue        # "حي محصن كامل": معاينة فقط
            kind = WALLS[m.group(2)]
            replaced.add(('wall', kind))
            new.append(place(p, f'{base}/walls/level{m.group(1)}_{kind}.webp', {'group': 'wall', 'kind': kind, 'level': int(m.group(1))},
                             anchor=WALL_ANCHOR, mask=True, band=True))
        keep = []
        for r in old:
            if (r['group'], r['kind']) in replaced or r['group'] == 'yard':
                drop(r, {e[k] for e in new + yard for k in ('file', 'owner') if k in e})
            else:
                keep.append(r)
        man['cities'][city]['images'] = keep + new + yard
        done.append((city, len(new), len(old) - len(keep)))

man['note'] = ('ax, ay: نقطة الارتكاز بالبكسل داخل الصورة (وسط المربع). owner: قناع رايات المالك (رمادي بإضاءتها، يُضرب فيه لون المالك). '
               'up: ترقية البرج والمستشفى (rate1 وrate2 وdamage1 وdamage2 وradius1 وradius2 وall) ومستوى القاعدة (tier1-3)')
json.dump(man, open(os.path.join(MAP, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
for city, n, gone in done: print(f'{city:11s} {n:3d} صورة جديدة، حُذف {gone} مدخلاً قديماً')
