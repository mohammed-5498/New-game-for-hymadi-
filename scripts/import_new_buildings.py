# المعابد ومباني المرتزقة الجديدة من المستخدم (GAME_SPEC 3.14) إلى حزمة الصور وmanifest.json، ثم: python3 scripts/pack_atlases.py
# الاستعمال: python3 -I scripts/import_new_buildings.py <مجلد الصور المفكوك: المعابد/ والمرتزقة/>
# الصور على إطار الصور الأولية نفسه (scripts/building_drafts: 8 بكسل لكل وحدة، والمربع الأمامي للكتلة 2×2 عند (304، الارتفاع − 111))،
# فتُصغَّر إلى دقة اللعبة 5.4 وتُقص، ونقطة الارتكاز مركز المربع الأمامي كالمباني المميزة
import json, os, re, sys
from PIL import Image

SRC = sys.argv[1]
MAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'map')
K = 5.4 / 8
CITY = {'edo': 'japan'}
KEYS = {   # المدينة ← (المعبد، المرتزقة) كما في TEMPLES بـ config.dart
    'shibam': ('awwam', None), 'japan': ('sensoji', None), 'china': ('heaven', 'kungfu'), 'hk': ('manmo', None), 'jaipur': ('hawa', None),
    'kaifeng': ('pagoda', None), 'norway': ('stave', None), 'gondar': ('debre', None), 'meroe': ('amun', 'nubian'),
    'mexico': ('catedral', 'vaquero'), 'laboca': ('sanjuan', None), 'tenoch': ('mayor', 'eagles'), 'yamamah': (None, 'bedouin'),
    'arab': (None, 'swords'), 'diriyah': (None, 'knights'), 'cairo': (None, 'futuwwa'), 'gyeongju': (None, 'koreanCamp'),
    'europe': (None, 'inn'), 'paris': (None, 'apache'), 'birmingham': (None, 'boys'), 'rothenburg': (None, 'watchinn'),
    'kano': (None, 'kanoCamp'), 'chicago': (None, 'speakeasy'), 'rio': (None, 'capoeira'),
}
man = json.load(open(os.path.join(MAP, 'manifest.json')))
n = 0
for root, _, files in os.walk(SRC):
    for f in sorted(files):
        m = re.match(r'(temple|mercs)_([a-z]+)_', f)
        if not m: continue
        city = CITY.get(m.group(2), m.group(2))
        key = KEYS[city][0 if m.group(1) == 'temple' else 1]
        im = Image.open(os.path.join(root, f)).convert('RGBA')
        W, H = im.size
        box = im.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox()
        im = im.crop(box)
        out = im.resize((round(im.width * K), round(im.height * K)), Image.LANCZOS)
        rel = f'cities/{city}/feature/{key}.webp'
        out.save(os.path.join(MAP, rel), 'WEBP', quality=92, method=6)
        imgs = man['cities'][city]['images']
        imgs[:] = [r for r in imgs if not (r['group'] == 'feature' and r['kind'] == key)]
        imgs.append({'file': rel, 'group': 'feature', 'kind': key, 'w': out.width, 'h': out.height,
                     'ax': round((304 - box[0]) * K, 1), 'ay': round((H - 111 - box[1]) * K, 1), 'footprint': 2})
        n += 1
json.dump(man, open(os.path.join(MAP, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
print(n, 'صورة')
