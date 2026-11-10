# مدينة العصابات بـ Flutter

النسخة الجديدة بلا WebView (القسم 18 في `docs/GAME_SPEC.md`): تُنقل على مراحل ن1-ن12، والنسخة الحالية (JavaScript)
تبقى تعمل ومرجع الفحص. المرحلة الحالية: **ن1، عارض المدن الـ24**.

## الملفات
| الملف | ما فيه |
|---|---|
| `lib/config.dart` | الأرقام بأسماء `js/config.js` (تُنقل أقسامه مع المراحل) |
| `lib/core/fmath.dart` | رياضيات ثابتة بين الأجهزة: fdlibm للجيب وجيب التمام، وhypot وround كـ JavaScript، ومولّد ببذرة، وترتيب ثابت |
| `lib/map/generator.dart` | مولّد الخريطة منقولاً سطراً بسطر من `js/map/generator.js` |
| `lib/data/cities.dart` | ما يحتاجه المولّد من طوابع المدن، **مولّد** بـ `scripts/export_flutter_data.mjs` |
| `lib/render/` | أطلس المدينة (`city_art.dart`)، وطبقتها الثابتة: الأرض والمباني (`city_layer.dart`)، والألوان (`colors.dart`) |
| `assets/map/` | حزمة الصور (README هناك) وأطالسها `atlas/` (وحدها تدخل التطبيق) |
| `test/` | مطابقة الخرائط والجيب وجيب التمام للنسخة الحالية (البصمات من `scripts/export_flutter_data.mjs`) |

## الأوامر (أدوات Flutter خارج المستودع)
- الفحص: `flutter test` (والبصمات تُعاد بعد أي تعديل في مولّد اللعبة الحالية: `node scripts/export_flutter_data.mjs`)
- التطبيق: `flutter build apk --release --target-platform android-arm64` (المعرّف `com.gangcity.port`، بمفتاح التجربة نفسه)
- نسخة المتصفح للفحص: `flutter build web --release --no-web-resources-cdn`، ثم `?city=hk&size=large&zoom=0.8`
