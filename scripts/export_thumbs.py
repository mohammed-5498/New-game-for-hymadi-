# صور القوائم إلى webp (بعد scripts/export_thumbs.cjs)، وحذف الأصل png
import os
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flutter_game', 'assets', 'thumbs')
for f in sorted(os.listdir(os.path.join(D, 'png'))):
    im = Image.open(os.path.join(D, 'png', f)).convert('RGBA')
    im.save(os.path.join(D, f[:-4] + '.webp'), 'WEBP', quality=88, method=6)
    os.remove(os.path.join(D, 'png', f))
os.rmdir(os.path.join(D, 'png'))
print(len(os.listdir(D)), 'webp')
