# زينة المدن والأرضيات صوراً (GAME_SPEC 18.6) من حزمة المستخدم إلى flutter_game/assets/map/ وmanifest.json، ثم:
#   python3 scripts/pack_atlases.py
# الاستعمال: python3 -I scripts/import_decor.py <مجلد الحزمة المفكوك (فيه Assets)>
# الصور على لوحة 259×302 ونقطة الارتكاز (وسط المربع) عند (129.5، 216)، وحلقة الدوار على 432×713 وارتكازها (216، 594)،
# بمقياس الحزمة نفسه (5.4 بكسل لكل وحدة). تُقص إلى ما فيها وتُحفظ webp. ما في "0-عام لكل المدن" يدخل كل أطلس
# (manifest.common) إلا ما للمدينة صورة منه. والأشجار والقطع الكبيرة (1-...) تحل محل صورها في الحزمة بنسخها كلها.
# "4-زينة إضافية مقترحة" للمرحلة التالية (18.6ب): لا تُستورد الآن
import json
import os
import re
import sys

from PIL import Image

SRC = os.path.join(sys.argv[1], 'Assets')
MAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'map')
SMALL, LARGE = (259, 302, 129.5, 216), (432, 713, 216, 594)
Q = 92

# الأرضيات والعلامات العامة (3-...) والزينة العامة (2-...) بأسمائها في الحزمة الأولية (scripts/decor_drafts/catalog.js)
MARKS = {'رصيف الضلع الأيمن الأمامي': 'side_i1', 'رصيف الضلع الأيسر الأمامي': 'side_j1', 'رصيف الضلع الأيسر الخلفي': 'side_i0',
         'رصيف الضلع الأيمن الخلفي': 'side_j0', 'ممر مشاة باتجاه i': 'cross_i', 'ممر مشاة باتجاه j': 'cross_j',
         'خط منتصف الشارع (1)': 'dash1', 'خط منتصف الشارع (2)': 'dash2', 'خط بين حارتين (3)': 'dash3', 'خط بين حارتين (4)': 'dash4',
         'شق في الشارع': 'crack', 'ممر مرصوف بين المباني (i)': 'lane_i', 'ممر مرصوف بين المباني (j)': 'lane_j',
         'رصف ساحة المبنى المميز': 'fplaza', 'خصل عشب على أرض الحي': 'grass', 'حصى على أرض الحي (المدن الجافة)': 'gravel',
         'حلقة الدوار المتقطعة': 'ring'}
STREET = {'عمود إنارة الممرات': 'lamp', 'حوض زهور': 'planter', 'مقعد': 'bench', 'شجرة رصيف': 'stree', 'نخلة رصيف': 'spalm',
          'سيارة محطمة': 'car', 'برميل نار (يضيء ليلاً)': 'barrel', 'بقعة زيت': 'oil', 'ركام': 'rubble', 'أكياس رمل': 'sandbags'}
GROUNDS = {'أرض الشارع': 'road', 'أرض الشارع (المربع المجاور)': 'road2', 'أرض الحي': 'ground', 'أرض الساحة': 'plaza', 'الماء': 'water'}
LOCAL = ('طاولة مقهى على الممر', 'بسطة سوق', 'كشك جرائد')


def city_street(name):
    """زينة شارع المدينة (2-...): نوعها بالاسم، وما سوى ذلك زينة شارعها (roadProp) بترتيبها"""
    if name.startswith('قارب'): return 'boat'
    if name.startswith('زينة ركن ساحة'): return 'fcorner'
    if name.startswith('سيارة محطمة'): return 'car'
    if name == 'جزيرة الدوار': return 'island'
    if name == 'شجرة رصيف': return 'stree'
    if name.startswith('عمود إنارة الممرات'): return 'lamp'
    if name in LOCAL: return 'local'
    return 'roadprop'


def save(path, rel):
    """تقص الصورة إلى ما فيها وتحفظها في الحزمة، وتعيد مقاسها ونقطة ارتكازها فيها (اللوحة من مقاسها)"""
    im = Image.open(path).convert('RGBA')
    w, h, ax, ay = next(c for c in (SMALL, LARGE) if im.size == c[:2])
    box = im.getchannel('A').point(lambda a: 255 if a > 2 else 0).getbbox()
    im = im.crop(box)
    out = os.path.join(MAP, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, 'WEBP', quality=Q, method=6)
    return {'file': rel, 'w': im.width, 'h': im.height, 'ax': round(ax - box[0], 1), 'ay': round(ay - box[1], 1)}


def items(folder):
    """(الرقم، الاسم، المسار) لكل صورة في مجلد، بترتيب أرقامها"""
    out = []
    for f in sorted(os.listdir(folder)):
        m = re.match(r'(\d+)-(.+)\.png$', f)
        if m: out.append((int(m.group(1)), m.group(2), os.path.join(folder, f)))
    return out


man = json.load(open(os.path.join(MAP, 'manifest.json')))
common, count = [], 0
for top in sorted(os.listdir(SRC)):
    tdir = os.path.join(SRC, top)
    if top.startswith('0-'):
        for cat in sorted(os.listdir(tdir)):
            for _, name, path in items(os.path.join(tdir, cat)):
                if cat.startswith('3-'):
                    kind = MARKS[name]
                    r = save(path, f'cities/_common/mark/{kind}.webp')
                    common.append({**r, 'group': 'mark', 'kind': kind})
                elif cat.startswith('2-'):
                    kind = STREET[name]
                    common.append({**save(path, f'cities/_common/decor/{kind}.webp'), 'group': 'decor', 'kind': kind})
                count += 1
        continue
    for cdir in sorted(os.listdir(tdir)):
        city = re.search(r'\((\w+)\)', cdir).group(1)
        entry = man['cities'][city]
        imgs = entry['images']
        for cat in sorted(os.listdir(os.path.join(tdir, cdir))):
            folder = os.path.join(tdir, cdir, cat)
            if cat.startswith('3-'):
                for _, name, path in items(folder):
                    kind = GROUNDS[name]
                    r = save(path, f'cities/{city}/ground/{kind}.webp')
                    imgs[:] = [o for o in imgs if not (o['group'] == 'ground' and o['kind'] == kind)] + [{**r, 'group': 'ground', 'kind': kind}]
                    count += 1
            elif cat.startswith('2-'):
                seen = {}
                # زينة أركان ساحة المبنى المميز: لأول مبنى مميز كبير في المدينة (كما رسمتها الحزمة الأولية)
                corner = 'corner_' + next(o['kind'] for o in imgs if o['group'] == 'feature' and (o.get('footprint') or 2) >= 2)
                for _, name, path in items(folder):
                    kind = city_street(name)
                    if kind == 'fcorner': kind = corner
                    v = seen[kind] = seen.get(kind, 0) + 1
                    r = save(path, f'cities/{city}/decor/{kind}_{v}.webp')
                    imgs[:] = [o for o in imgs if not (o['group'] == 'decor' and o['kind'] == kind and o.get('variant', 1) == v)] + \
                        [{**r, 'group': 'decor', 'kind': kind, 'variant': v}]
                    count += 1
            elif cat.startswith('1-'):
                # بترتيب أنواع القطع في الحزمة (نسختها الأولى)، كما رقّمتها الحزمة الأولية: صورتها الجديدة لنسخها كلها
                kinds = [o['kind'] for o in imgs if o['group'] == 'prop' and o.get('variant', 1) == 1]
                for num, name, path in items(folder):
                    kind = kinds[num - 1]
                    for o in [o for o in imgs if o['group'] == 'prop' and o['kind'] == kind]:
                        r = save(path, o['file'])
                        o.update({k: r[k] for k in ('w', 'h', 'ax', 'ay')})
                    print(city, name, '→', kind)
                    count += 1
man['common'] = {'images': common}
json.dump(man, open(os.path.join(MAP, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
print(count, 'images')
