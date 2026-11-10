# أطلس لكل مدينة للنسخة الجديدة (القسم 18.1): صور الحزمة (flutter_game/assets/map/cities/) في صورة واحدة،
# فيحمّل الجوال صورة واحدة لكل مدينة، ويرسمها كرت الشاشة بأمر واحد بمستويات تصغير (mipmaps) فلا تتلألأ عند الإبعاد.
# بعد استبدال أي صورة في الحزمة (أو إعادة تصديرها): python3 scripts/pack_atlases.py
# المخرجات: flutter_game/assets/map/atlas/<المدينة>.webp و.json (مستطيل كل صورة في الأطلس ونقطة ارتكازها ونوعها)
import json
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'map')
OUT = os.path.join(ROOT, 'atlas')
WIDTH = 2048      # عرض الأطلس (والحد 4096 للضلع: كل الجوالات تقبله)
PAD = 6           # فراغ شفاف حول كل صورة: لا تختلط الجارتان في مستويات التصغير
META = ('group', 'kind', 'variant', 'size', 'level', 'footprint')

man = json.load(open(os.path.join(ROOT, 'manifest.json')))
os.makedirs(OUT, exist_ok=True)
for city, entry in man['cities'].items():
    recs = sorted(entry['images'], key=lambda r: -r['h'])
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
        im = Image.open(os.path.join(ROOT, r['file'])).convert('RGBA')
        atlas.paste(im, r['_at'])
        key = r['file'].split('/', 2)[2].rsplit('.', 1)[0]
        sprites.append({'key': key, **{k: r[k] for k in META if k in r},
                        'r': [r['_at'][0], r['_at'][1], r['w'], r['h'], r['ax'], r['ay']]})
    atlas.save(os.path.join(OUT, city + '.webp'), 'WEBP', quality=92, method=6)
    json.dump({'name': entry['name'], 'scale': entry['scale'], 'colors': entry['colors'], 'pxPerUnit': man['pxPerUnit'],
               'size': [WIDTH, height], 'sprites': sprites},
              open(os.path.join(OUT, city + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(city, len(sprites), f'{WIDTH}x{height}', os.path.getsize(os.path.join(OUT, city + '.webp')) // 1024, 'KB')
