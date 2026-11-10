# مدينة العصابات بـ Flutter

النسخة الجديدة بلا WebView (القسم 18 في `docs/GAME_SPEC.md`): تُنقل على مراحل ن1-ن12، والنسخة الحالية (JavaScript)
تبقى تعمل ومرجع الفحص. اكتمل: **ن1-ن9** (المدن وزينتها، والمباراة الكاملة، والقوائم والحفظ، والأطوار الخمسة والأمم الـ15، ومزايا المدن وأحداثها، وطور القصة).

## الملفات
| الملف | ما فيه |
|---|---|
| `lib/config.dart` | الأرقام بأسماء `js/config.js` (تُنقل أقسامه مع المراحل) |
| `lib/core/fmath.dart` | رياضيات ثابتة بين الأجهزة: fdlibm للجيب وجيب التمام، وhypot وround كـ JavaScript، ومولّد ببذرة، وترتيب ثابت |
| `lib/map/generator.dart` | مولّد الخريطة منقولاً سطراً بسطر من `js/map/generator.js` |
| `lib/data/cities.dart` | ما يحتاجه المولّد من طوابع المدن، **مولّد** بـ `scripts/export_flutter_data.mjs` |
| `lib/core/cfg.dart` و`lib/data/js_config.dart` | كل `js/config.js` (**مولّد**) وأدوات قراءته: `COMBAT.d('meleeRange')`... |
| `lib/game/` و`lib/ai/` | منطق المباراة والبوتات منقولاً سطراً بسطر من `js/game/` و`js/ai/` (match.dart: الإنشاء والتحديث ومعركة البوتات) |
| `lib/render/` | أطلس المدينة وطبقتها (`city_art.dart` و`city_layer.dart` بالصبغ)، وزينتها (`decor.dart`)، والجنود (`unit_art.dart` و`pose.dart` و`unit_atlas.dart`)، والآثار (`fx_art.dart`)، ودفعة المثلثات (`batch.dart`) |
| `lib/data/poses.dart` و`unit_sprites.dart` | جداول الوضعيات وأجزاء صور الشخصيات، **مولّدة** بـ `scripts/export_flutter_poses.mjs` |
| `lib/ui/` | شاشة المباراة (`match_screen.dart`: الحلقة والكاميرا واللمس والرسم) وواجهتها (`hud.dart`) |
| `assets/units/` | صور الشخصيات المقطّعة (الكلاسيكية والشرطة) |
| `assets/map/` | حزمة الصور (README هناك) وأطالسها `atlas/` (وحدها تدخل التطبيق) |
| `test/` | مطابقة الخرائط والجيب وجيب التمام (`export_flutter_data.mjs`)، ومباريات البوتات ببصمة كل ثانية (`export_sim_parity.mjs`) |

## الأوامر (أدوات Flutter خارج المستودع)
- الفحص: `flutter test` (والبصمات تُعاد بعد أي تعديل في مولّد اللعبة الحالية: `node scripts/export_flutter_data.mjs`)
- التطبيق: `flutter build apk --release --target-platform android-arm64` (المعرّف `com.gangcity.port`، بمفتاح التجربة نفسه)
- نسخة المتصفح للفحص: `flutter build web --release --no-web-resources-cdn`، ثم مباراة مباشرة: `?match=1&city=hk&size=small&bots=3&ff=60&watch=1&spectate=1&zoom=3`
- بعد أي تعديل في منطق اللعبة الحالية: `node scripts/export_sim_parity.mjs > flutter_game/test/sim_parity.json` ثم `flutter test`
