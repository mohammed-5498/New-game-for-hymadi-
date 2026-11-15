# ألوان كل مدينة من صور مبانيها (صور المستخدم في الحزمة): ستة ألوان غالبة من الأغمق للأفتح، تُرسم بها الزينة المقترحة
# فتتناسق مع المباني، وتظهر في بطاقة كل مدينة. الاستعمال: python3 scripts/decor_drafts/palette.py <ملف الإخراج.json>
import json, os, sys
import numpy as np
from PIL import Image

MAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'flutter_game', 'assets', 'map')
man = json.load(open(os.path.join(MAP, 'manifest.json')))
out = {}
for city, e in man['cities'].items():
    px = []
    for r in e['images']:
        if r['group'] in ('building', 'monument') or (r['group'] == 'economy' and r.get('size') == 'medium' and not r.get('up')):
            a = np.asarray(Image.open(os.path.join(MAP, r['file'])).convert('RGBA'))
            px.append(a[a[..., 3] > 200][:, :3])
    im = Image.fromarray(np.concatenate(px)[None, :, :].astype(np.uint8), 'RGB')
    q = im.quantize(colors=10, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:30]
    counts = sorted(q.getcolors(), reverse=True)
    cols = [tuple(pal[i * 3:i * 3 + 3]) for _, i in counts]
    cols = [c for c in cols if 28 < sum(c) / 3 < 245][:6]
    cols.sort(key=lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])
    out[city] = ['#%02x%02x%02x' % c for c in cols]
json.dump(out, open(sys.argv[1], 'w'), indent=1)
print(len(out), 'مدينة')
