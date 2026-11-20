# قياس معالج اللعبة بلا جوال (2.8.0)

اللعبة نفسها (`flutter_game/`) تُبنى نسخة لينكس بمحرك الرسم نفسه في الجوال (Impeller)، وتعمل على شاشة وهمية (Xvfb) برسم
برمجي (llvmpipe بدل كرت الشاشة)، ويُقرأ وقت كل خيط منها على المعالج من `/proc`. بها وُجد سبب رسالة "العناية بالجهاز" في 2.8.0،
وبها تُقارن نسختان في المشهد نفسه قبل أي تغيير في الرسم.

## التجهيز (مرة واحدة)
```
apt-get install -y clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev libstdc++-12-dev xvfb \
  libgl1-mesa-dri libegl1 libgles2 libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev imagemagick
flutter config --enable-linux-desktop
```

## الاستعمال
```
./make.sh /tmp/b_new              # نسخة من المجلد الحالي (خارج المستودع)
./make.sh /tmp/b_old HEAD~1       # ونسخة سابقة للمقارنة
Q="match=1&city=rio&size=medium&bots=3&ff=240&watch=1&zoom=2.2&seed=777&weather=night&level=hard&spectate=1"
APP=/tmp/b_new/build/linux/x64/release/bundle/gangcity SCALE=1 python3 bench.py battle 28 20 "$Q" shot
APP=... python3 bench.py menu 14 15 ""                 # القائمة الرئيسية
APP=... PAUSE=1 python3 bench.py paused 30 12 "$Q"     # الإيقاف بعد 8 ث
APP=... HIDE=city python3 bench.py nocity 28 15 "$Q"   # بلا طبقة (city وunits وfog وweather)، وNOHUD=1 بلا الواجهة، وBLANK=1 مشهد فارغ
```
`GC_Q` مثل رابط الفحص في المتصفح (`_testMatch` في main.dart). `SCALE=1` نقطة لكل وحدة (أسرع على الرسم البرمجي فيبلغ 30 إطاراً)،
و2 بدقة الجوال تقريباً. و`spectate=1` مباراة بوتات لا تنتهي بخسارتك.

## قراءة النتيجة
- `io.flutter.raster`: خيط الرسم (Impeller يحوّل الإطار إلى أوامر لكرت الشاشة). `raster CPU ms/frame` كلفة الإطار الواحد عليه.
- `gangcity` (الخيط الرئيسي): كود Dart (المنطق وتجهيز الإطار) ومعه تركيب نافذة لينكس (ليس في الجوال).
- `llvmpipe-*`: كرت الشاشة البرمجي، لا يُحسب (في الجوال على كرت الشاشة). ولهذا حارس المعالج لا يحكم هنا (`GC_NOGUARD`).
- الأرقام هنا للمقارنة بين نسختين لا لتقدير الجوال (معالج الخادم أسرع، والرسم البرمجي يضيف عملاً على خيط الرسم).

## أرقام 2.8.0 (معركة ريو ليلاً، SCALE=1، خيط الرسم لكل إطار)
| المشهد | ملي ث |
|---|---|
| إطار فارغ | 1.2 |
| الواجهة (قبل Snap) | 1.2 ← 0.3 |
| المدينة (أغلبها طبقات الأرض) | 2.4 |
| الأعلام والحدود والشارات | 1.6 |
| الإيقاف (المعالج كله) | 56% من نواة ← 2% |
| القائمة الرئيسية (خيوط اللعبة) | 30% من نواة ← 15% |
