// عرض الشخصيات حية في المتجر (2.6.0، بطلب المستخدم: "تجميل المتجر وطريقة عرض المظاهر"): الفرد العادي والمميزان والبطل
// برسم اللعبة نفسها (drawOne بأطلس مصبوغ بلون المتجر)، البطل في الوسط أكبر، والبقية ينظرون إليه ويضربون بالتناوب
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/scheduler.dart' show Ticker;

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/state.dart';
import '../game/units.dart' show unitStats;
import '../render/batch.dart';
import '../render/unit_art.dart';
import '../render/unit_atlas.dart';
import 'widgets.dart';

// أطالس العرض الأخيرة: التنقل بين العصابات لا يصبغها من جديد (كل أطلس بضعة ميغابايت، فأربعة على الأكثر)
final _cache = <String, UnitAtlas>{};
Future<UnitAtlas> _atlas(List<(String, String)> pairs) async {
  final key = pairs.map((p) => '${p.$1}|${p.$2}').join(',');
  final hit = _cache.remove(key);
  if (hit != null) return _cache[key] = hit;
  final a = await buildUnitAtlas(pairs);
  _cache[key] = a;
  while (_cache.length > 4) { _cache.remove(_cache.keys.first)!.image.dispose(); }
  return a;
}

// شخصيات العرض بترتيبها على المسرح (الفرد العادي، مميز، البطل في الوسط، مميز) بلون المتجر، ولون المتجر
(List<Unit>, String) showcaseCast(String gang, String? nation, bool elite) {
  final hex = [for (final c in PLAYER_COLORS) c as J].firstWhere((c) => c['id'] == STORE.s('previewColor')).s('hex');
  final heroes = nation != null
      ? [for (final k in nations.m(nation).m('names').keys) if (k != 'common' && k != 'champion') k]
      : GANGS.m(gang).l('heroes').cast<String>();
  final kinds = ['common', if (heroes.isNotEmpty) heroes.first, 'champion', ...heroes.skip(1)];
  String? hero(String kind) => kind == 'common' || kind == 'champion' ? null : kind;
  final cast = [
    for (var k = 0; k < kinds.length; k++)
      Unit(id: k, playerId: -1, gang: gang, nation: nation, color: hex, hero: hero(kinds[k]), champion: kinds[k] == 'champion', name: '',
          x: 0, y: 0, stats: unitStats(gang, hero(kinds[k]), kinds[k] == 'champion', nation))
        ..state = 'idle'..attackRate = 0.55,
  ];
  for (final u in cast) { previewSkin[u] = elite ? 'elite' : null; }
  return (cast, hex);
}

class CharacterShowcase extends StatefulWidget {
  final String gang;       // نمط العصابة الكلاسيكي (crows...)
  final String? nation;    // أمتها إن كانت
  final bool elite;        // مظهر النخبة
  const CharacterShowcase({super.key, required this.gang, this.nation, this.elite = false});
  @override
  State<CharacterShowcase> createState() => _CharacterShowcaseState();
}

class _CharacterShowcaseState extends State<CharacterShowcase> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  Timer? _rest;
  final _time = ValueNotifier(0.0);
  UnitAtlas? atlas;
  List<Unit> units = const [];
  String color = '#3b82f6';

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((e) {
      _time.value = e.inMicroseconds / 1e6;
      _rest = restTicker(_ticker, 30, context);   // 30 إطاراً تكفي العرض، والبطارية أهم
    })..start();
    _load();
  }

  @override
  void didUpdateWidget(CharacterShowcase old) {
    super.didUpdateWidget(old);
    if (old.gang != widget.gang || old.nation != widget.nation || old.elite != widget.elite) _load();
  }

  Future<void> _load() async {
    final (cast, hex) = showcaseCast(widget.gang, widget.nation, widget.elite);
    final a = await _atlas([for (final s in {for (final u in cast) sheetOf(u, previewSkin[u])}.whereType<String>()) (s, hex)]);
    if (!mounted) return;
    setState(() { atlas = a; units = cast; color = hex; });
  }

  @override
  void dispose() { _rest?.cancel(); _ticker.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => atlas == null
      ? const Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(color: gold, strokeWidth: 2.5)))
      : CustomPaint(painter: _ShowcasePainter(this), size: Size.infinite);
}

class _ShowcasePainter extends CustomPainter {
  final _CharacterShowcaseState v;
  _ShowcasePainter(this.v) : super(repaint: v._time);
  @override
  void paint(Canvas canvas, Size size) {
    final a = v.atlas, us = v.units;
    if (a == null || us.isEmpty) return;
    final t = v._time.value, big = UNIT_ART.d('championScale'), hero = UNIT_ART.d('heroScale');
    // الوحدة قرابة 43 من قامتها (38 فوق القدم و5 تحتها): البطل بثلاثة أرباع المسرح
    final sc = math.min(size.height * 0.78 / (43 * big), size.width / (us.length * 26 * hero)), y = size.height * 0.84;
    final mid = us.indexWhere((u) => u.champion);
    final b = TriBatch()..whiteU = 1.5..whiteV = 1.5;
    final order = [for (var k = 0; k < us.length; k++) k]..sort((p, q) => (p == mid ? 1 : 0) - (q == mid ? 1 : 0));   // البطل أمامهم
    for (final k in order) {
      final u = us[k];
      // البطل في الوسط والأكبر، ومن حوله بقدر أحجامهم (أربعة في العصابات كلها)
      final x = size.width * (us.length == 4 ? const [0.13, 0.31, 0.52, 0.78][k] : (k + 0.5) / us.length);
      u.facing = k < mid ? 1 : -1;
      // ضربة كل 2.6 ث، كل واحد في دوره
      const period = 2.6;
      final off = k * 0.65, n = ((t - off) / period).floorToDouble();
      u.attackStart = n < 0 ? null : off + n * period;
      final s = sc * (u.champion ? big : u.hero != null ? hero : 1);
      drawOne(b, a, u, artKey(u, t), x, y, s, v.color, t, false, 0, 1, 0);
    }
    b.flush(canvas, a.image);
  }
  @override
  bool shouldRepaint(_ShowcasePainter old) => true;
}

// المسرح: إضاءة دافئة وأرضية متوهجة والشخصيات عليها (المتجر ولوحة اختيار العصابة في الإعداد، 2.7.0)
class ShowcaseStage extends StatelessWidget {
  final String gang;
  final String? nation;
  final bool elite;
  const ShowcaseStage({super.key, required this.gang, this.nation, this.elite = false});
  @override
  Widget build(BuildContext context) => Stack(fit: StackFit.expand, children: [
    const DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(0, -0.1), radius: 0.95,
        colors: [Color(0xFF5E4628), Color(0xFF1A140E)]))),
    Align(alignment: const Alignment(0, 0.72), child: FractionallySizedBox(widthFactor: 0.92, child: Container(height: 30,
        decoration: const BoxDecoration(borderRadius: BorderRadius.all(Radius.elliptical(160, 15)),
            gradient: RadialGradient(colors: [Color(0x80FFD27A), Color(0x00FFD27A)]))))),
    CharacterShowcase(gang: gang, nation: nation, elite: elite),
  ]);
}
