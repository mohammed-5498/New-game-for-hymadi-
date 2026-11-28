# صور الجرعات (2.21.1، GAME_SPEC 18.25): من صور كانفا (200×200، القارورة على خلفية فاتحة أو شفافة) إلى
# flutter_game/assets/potions/<id>.webp: القارورة وحدها بخلفية شفافة، والدائرة الداكنة بلون الندرة يرسمها PotionBadge (wallet.dart).
# التشغيل: python3 -I scripts/import_potions.py <مجلد الصور> — فيه <id>.png لكل جرعة (strength.png، iron.png...)
# الخلفية تُزال بالملء من الحواف (لونها من أركان الصورة)، ولافتة الاسم التي يكتبها كانفا تحت القارورة تُقص بسطر CUT،
# ويبقى أكبر جزء متصل (القارورة)، ثم تُقص الحواف وتوضع في مربع شفاف.
import os
import sys
from collections import deque

from PIL import Image, ImageFilter

IDS = ['strength', 'iron', 'swift', 'heal', 'pouch', 'rush', 'income', 'banner', 'bribe', 'warcry', 'reinforce', 'rocket', 'shield']
CUT = {'strength': 158}   # السطر الذي تبدأ منه لافتة الاسم الملاصقة للقارورة (بنقاط الصورة 200)
TOL = 60                  # مجموع فروق الألوان الثلاثة: ما دونه من لون الخلفية خلفية
SIZE, BOX = 176, 160      # الصورة الناتجة، وأطول ضلع للقارورة فيها
OUT = os.path.join(os.path.dirname(__file__), '..', 'flutter_game', 'assets', 'potions')


def cutout(path, cut=None):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[x, y] for x, y in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)) if px[x, y][3] > 40]
    bg = tuple(sorted(c[i] for c in corners)[len(corners) // 2] for i in range(3)) if corners else (255, 255, 255)

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a < 40 or (y >= cut if cut else False) or abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < TOL

    seen = [[False] * w for _ in range(h)]
    q = deque((x, y) for x in range(w) for y in (0, h - 1)) + deque((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x] or not is_bg(x, y):
            continue
        seen[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    if cut:   # ما تحت السطر خلفية ولو لم يصله الملء
        for y in range(cut, h):
            seen[y] = [True] * w

    # أكبر جزء متصل من غير الخلفية: القارورة (وما انفصل عنها من كتابة أو بريق يسقط)
    comp = [[-1] * w for _ in range(h)]
    sizes = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or comp[y0][x0] >= 0:
                continue
            k, n, q = len(sizes), 0, deque([(x0, y0)])
            comp[y0][x0] = k
            while q:
                x, y = q.popleft()
                n += 1
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and comp[ny][nx] < 0:
                            comp[ny][nx] = k
                            q.append((nx, ny))
            sizes.append(n)
    keep = sizes.index(max(sizes))
    mask = Image.new('L', (w, h), 0)
    m = mask.load()
    for y in range(h):
        for x in range(w):
            if comp[y][x] == keep:
                m[x, y] = px[x, y][3]
    # حافة بلا أثر الخلفية الفاتحة: نقطة أضيق ثم تنعيم خفيف
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(mask)
    box = mask.point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box)
    s = BOX / max(im.size)
    im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(im, ((SIZE - im.size[0]) // 2, (SIZE - im.size[1]) // 2), im)
    return out


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for pid in IDS:
        path = os.path.join(src, pid + '.png')
        if not os.path.exists(path):
            print('ناقصة:', pid)
            continue
        dst = os.path.join(OUT, pid + '.webp')
        cutout(path, CUT.get(pid)).save(dst, 'WEBP', lossless=True, quality=100, method=6)
        print(pid, os.path.getsize(dst), 'بايت')


if __name__ == '__main__':
    main()
