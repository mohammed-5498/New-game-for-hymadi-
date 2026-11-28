// واجهة المباراة (js/ui/hud.js وpower.js وempireMenu.js وgroups.js): النقاط ودخلها، وشريط القوة، والإشعار،
// وأزرار التحديد والقاعدة والإيقاف، ومجموعات التحكم، وقائمة الحي (الإنتاج والترقيات والبناء والتحصين)، وشاشة النهاية.
// تُعاد بناؤها أربع مرات في الثانية (hud) لا مع كل إطار
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;

import '../i18n/tr.dart';
import '../config.dart' show GROUPS, POTIONS;
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/empire.dart';
import '../game/features.dart';
import '../game/modes.dart';
import '../game/potions.dart' show POTION_NAMES, potionDesc;
import '../game/story.dart';
import '../game/spawn.dart';
import '../game/state.dart';
import '../game/victory.dart';
import '../map/generator.dart' show District;
import '../map/parks.dart' show fortifiable;
import '../map/sizes.dart';
import 'achievements.dart';
import 'match_screen.dart';
import 'prefs.dart';
import 'wallet.dart' show Wallet, PotionBadge;
import 'widgets.dart';


class MatchHud extends StatelessWidget {
  final MatchScreenState screen;
  const MatchHud({super.key, required this.screen});

  // كل جزء من الواجهة (_Memo) يُبنى ويُرسم من جديد حين يتغير ما يعرضه وحده: كانت الواجهة كلها تُبنى مرتين في الثانية
  // (الأزرار والمجموعات وشريط القوة...) فيتأخر إطار في القتال. وكل جزء لا يتحرك كل إطار صورة جاهزة (Snap، 2.8.0): كرت
  // الشاشة كان يرسمه كله من أوله في كل إطار
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<int>(
    valueListenable: screen.hud,
    builder: (context, _, _) {
      final s = screen.state!;
      final me = s.humanId >= 0 ? s.players[s.humanId] : null;
      final bar = modeBar(s), groups = _groups(s);
      return Stack(children: [
        // الصف الأعلى: الزمن والمدينة والنقاط يساراً، والأزرار يميناً، وشريط الطور في المساحة بينهما وحدها (يصغر ولا يتداخل).
        // الزمن والنقاط يتحدث كل منهما وحده (clockText وpointsText)، وثلاث لمسات على الزمن تفتح عدّاد الأداء
        Positioned(top: 6, left: 6, right: 6, child: Row(textDirection: TextDirection.ltr, crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Memo('clock', 0, () => GestureDetector(onTap: screen.tapClock, child: Snap(child: ValueListenableBuilder<String>(
              valueListenable: screen.clockText,
              builder: (_, t, _) => _Box(child: Text(t, style: const TextStyle(color: ink, fontSize: 12))))))),
          if (me != null && s.empire != null) ...[
            const SizedBox(width: 4),
            _Memo('points', 0, () => Snap(child: ValueListenableBuilder<(int, String)?>(
                valueListenable: screen.pointsText,
                builder: (_, p, _) => _Box(child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.toll, size: 14, color: gold), const SizedBox(width: 3),
                  Text('${p?.$1 ?? 0}', style: const TextStyle(color: gold, fontSize: 13, fontWeight: FontWeight.w700)),
                  Text('  +${p?.$2 ?? '0'}/ث', style: const TextStyle(color: dim, fontSize: 11)),
                ]))))),
          ],
          Expanded(child: _Memo('bar', bar == null ? '' : '${bar.text}|${bar.alarm}|${[for (final (c, r, m) in bar.bars) '$c${(r * 150).round()}$m'].join()}',
              () => Center(child: bar != null ? Snap(child: FittedBox(fit: BoxFit.scaleDown, child: _ModeBarBox(bar))) : const SizedBox()))),
          _Memo('buttons', '${screen.selectMode}|${screen.paused}', () => Snap(child: Row(mainAxisSize: MainAxisSize.min, textDirection: TextDirection.ltr, children: [
            _Btn(icon: Icons.highlight_alt, on: screen.selectMode, tip: 'تحديد', onTap: () { screen.selectMode = !screen.selectMode; screen.hud.value++; }),
            _Btn(icon: Icons.groups, tip: 'كل جنودك', onTap: () {
              for (final u in s.units) { u.selected = u.playerId == s.humanId && u.state != 'dead'; }
              screen.hud.value++;
            }),
            _Btn(icon: Icons.fort, tip: 'القاعدة', onTap: () => _nextHq(s)),
            _Btn(icon: screen.paused ? Icons.play_arrow : Icons.pause, tip: 'إيقاف', onTap: () => screen.paused ? screen.closePause() : screen.openPause()),
          ]))),
        ])),
        // أسهم الحافة: زعماء الأعداء ذهبية، والتنبيهات حمراء (جنودك يُضربون خارج الشاشة، وزعيمك). ترسم نفسها كل إطار
        _Memo('arrows', 0, () => Positioned.fill(child: IgnorePointer(child: RepaintBoundary(child: CustomPaint(painter: _EdgeArrows(screen)))))),
        // اللعب المحلي: المضيف أوقف المباراة، أو لا يصل دور جديد منه
        if (screen.lanText case final t?) _Memo('lan', t, () => Positioned(top: 84, left: 0, right: 0, child: IgnorePointer(child: Center(child: Snap(child: _Box(
            child: Text(t, style: const TextStyle(color: gold, fontSize: 13, fontWeight: FontWeight.w700)))))))),
        // شريط القوة يساراً: لمسة تطويه إلى سطرك وحدك
        _Memo('power', _powerSig(s), () => Positioned(top: 44, left: 6, child: Snap(child: _Power(s)))),
        // الجرعات يساراً تحت شريط القوة (2.21.0، بطلب المستخدم: "في يسار الشاشه وبحجم صغير"): خانات اللاعب، وحول كل زر حلقة
        // تنقص حتى ينتهي أثره، ولمسة مطولة تكتب ما تفعله
        if (me != null && s.economy && screen.potionSlots.any((p) => p != null))
          _Memo('potions', _potionSig(screen, s), () => Positioned(left: 6, top: 0, bottom: 0, child: Align(alignment: const Alignment(0, 0.2), child: Snap(
              child: Column(mainAxisSize: MainAxisSize.min, children: [for (final id in screen.potionSlots) if (id != null) _PotionButton(screen, id)]))))),
        // مجموعات التحكم على الحافة اليمنى (GROUPS.count خانات)، والمحددة الآن بإطار ذهبي
        _Memo('groups', groups.join(), () => Positioned(right: 6, top: 0, bottom: 0, child: Align(alignment: const Alignment(0, -0.3), child: Snap(child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (var g = 1; g <= groups.length; g++) _Group(screen, g, groups[g - 1].$1, groups[g - 1].$2),
        ]))))),
        // عدّاد الأداء: يتحدث وحده مرة في الثانية
        _Memo('meter', 0, () => Positioned(left: 6, bottom: 6, child: ValueListenableBuilder<String?>(valueListenable: screen.meter,
            builder: (_, t, _) => t == null ? const SizedBox.shrink() : Snap(child: _Meter(screen, t))))),
        // أسفل الوسط: الإشعار سطراً صغيراً شفافاً لا يلتقط اللمس، وقائمة الحي تحته إن كانت مفتوحة (2.16.0، بطلب المستخدم: "في بعض
        // الاطوار الرساله تغطي على الهدف و التنبيهات مزعجه": كان الإشعار أعلى الوسط فوق شريط الطور)
        Positioned(left: 6, right: 6, bottom: 6, child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (s.notice case final n?) _Memo('notice', '${n.text}|${n.mine}', () => IgnorePointer(child: Snap(child: _NoticeLine(n)))),
          if (screen.menuDistrict != null) ...[
            const SizedBox(height: 4),
            Snap(margin: 12, child: _EmpireMenu(screen, screen.menuDistrict!)),
          ],
        ])),
        if (screen.paused && s.matchResult == null) Positioned.fill(child: _Pause(screen)),
        if (s.matchResult != null) Positioned.fill(child: _End(screen, s.matchResult!)),
      ]);
    },
  );

  void _nextHq(MatchState s) {
    final hqs = s.map.districts.where((d) => d.owner == s.humanId && d.building == 'hq').toList();
    if (hqs.isEmpty) return;
    final at = hqs.indexWhere((d) => d.id == screen.menuDistrict);
    final d = hqs[(at + 1) % hqs.length];
    screen.centerOn(d.capture!.i.toDouble(), d.capture!.j.toDouble());
    for (final u in s.units) { u.selected = false; }
    screen.menuDistrict = d.id;
    screen.hud.value++;
  }
}

// ما يعرضه شريط القوة ومجموعات التحكم، لمعرفة هل تغيّر
String _powerSig(MatchState s) {
  final col = powerColumn(s), b = StringBuffer('$powerFolded');
  if (col != null) { for (final (l, v) in col.summary) { b..write(l)..write(v); } }
  for (final p in s.players) {
    if (p.neutral) continue;
    b..write('|')..write(isPlayerAlive(s, p.id))..write(ownedDistricts(s, p.id).length)..write(',')..write(countUnits(s, p.id));
    if (col != null) b..write(',')..write(col.show(col.value(p.id)));
    if (col?.bar case final bar?) b..write(',')..write((bar(p.id) * 34).round());
  }
  return b.toString();
}

// عدد كل مجموعة، وهل هي المحدد وحده الآن
List<(int, bool)> _groups(MatchState s) {
  final c = GROUPS.count, n = List.filled(c + 1, 0), sel = List.filled(c + 1, 0);
  var all = 0;
  for (final u in s.units) {
    if (u.state == 'dead') continue;
    if (u.selected) all++;
    if (u.group > 0 && u.group <= c) { n[u.group]++; if (u.selected) sel[u.group]++; }
  }
  return [for (var g = 1; g <= c; g++) (n[g], n[g] > 0 && sel[g] == n[g] && all == n[g])];
}

// جزء من الواجهة يعيد ما بناه نفسه ما دام مفتاحه sig كما هو، فلا يُبنى ما تحته ولا يُرسم (وطبقته وحدها حين يتغير).
// الاسم مفتاحه بين إخوته، فلا يأخذ جزء ما بناه غيره إن ظهر إشعار أو اختفى
class _Memo extends StatefulWidget {
  final Object sig;
  final Widget Function() make;
  _Memo(String name, this.sig, this.make) : super(key: ValueKey(name));
  @override
  State<_Memo> createState() => _MemoState();
}

class _MemoState extends State<_Memo> {
  Object? _sig;
  Widget? _built;
  @override
  Widget build(BuildContext context) {
    if (_built == null || _sig != widget.sig) {
      _sig = widget.sig;
      _built = widget.make();
    }
    return _built!;
  }
}

class _Box extends StatelessWidget {
  final Widget child;
  const _Box({required this.child});
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(9), border: Border.all(color: const Color(0x55E2B55A))),
      child: child);
}

// الإشعار: سطر صغير شفاف أسفل الوسط، بلون ذهبي خافت لما يخصك
class _NoticeLine extends StatelessWidget {
  final Notice n;
  const _NoticeLine(this.n);
  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: BoxConstraints(maxWidth: math.min(460.0, MediaQuery.sizeOf(context).width * 0.62)),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: const Color(0xA0120E0A), borderRadius: BorderRadius.circular(12)),
      child: Text(n.text, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
          style: TextStyle(color: n.mine ? const Color(0xFFEBD08E) : ink, fontSize: 11, height: 1.25))),
  );
}

class _Btn extends StatelessWidget {
  final IconData icon;
  final String tip;
  final bool on;
  final VoidCallback onTap;
  const _Btn({required this.icon, required this.tip, this.on = false, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 6),
    child: Material(color: on ? gold : panel, borderRadius: BorderRadius.circular(10), child: InkWell(
      borderRadius: BorderRadius.circular(10), onTap: onTap,
      child: SizedBox(width: 40, height: 40, child: Icon(icon, size: 21, color: on ? Colors.black : gold, semanticLabel: tip)))),
  );
}

// شريط القوة: لكل عصابة لونها وأحياؤها وجنودها، وعمود الطور (النقاط، الزمن على التلة، دم الزعيم)
bool powerFolded = Prefs.raw('gangcity.powerFold') == '1';   // يتذكر آخر طيّ (كـ gangcity.power في اللعبة الحالية)

class _Power extends StatefulWidget {
  final MatchState s;
  const _Power(this.s);
  @override
  State<_Power> createState() => _PowerState();
}

class _PowerState extends State<_Power> {
  void _fold() {
    setState(() => powerFolded = !powerFolded);
    Prefs.writeRaw('gangcity.powerFold', powerFolded ? '1' : '0');
  }

  @override
  Widget build(BuildContext context) => GestureDetector(behavior: HitTestBehavior.opaque, onTap: _fold, child: _body());

  Widget _body() {
    final s = widget.s;
    final col = powerColumn(s);
    if (col != null && col.summary.isNotEmpty) {
      return _Box(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final (l, v) in powerFolded ? col.summary.take(1) : col.summary) Text('$l: $v', style: const TextStyle(color: ink, fontSize: 11.5)),
      ]));
    }
    // كل سطر يُبنى حين يتغير ما يعرضه وحده (2.1.2)
    return _Box(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (final p in s.players) if (!p.neutral && (!powerFolded || p.id == s.humanId)) _Memo('row${p.id}',
        '${isPlayerAlive(s, p.id)}|${ownedDistricts(s, p.id).length}|${countUnits(s, p.id)}|${col == null ? '' : col.show(col.value(p.id))}|'
        '${col?.bar == null ? '' : (col!.bar!(p.id) * 34).round()}|${s.mode}', () => Padding(
        padding: const EdgeInsets.symmetric(vertical: 1),
        child: Opacity(opacity: isPlayerAlive(s, p.id) ? 1 : 0.4, child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: colorOf(p.color), shape: BoxShape.circle)),
          const SizedBox(width: 5),
          SizedBox(width: 64, child: Text(p.id == s.humanId ? 'أنت' : p.gangName, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: p.id == s.humanId ? gold : ink, fontSize: 11))),
          Text('${ownedDistricts(s, p.id).length}', style: const TextStyle(color: ink, fontSize: 11)),
          const Icon(Icons.flag, size: 11, color: dim),
          const SizedBox(width: 4),
          Text('${countUnits(s, p.id)}', style: const TextStyle(color: ink, fontSize: 11)),
          const Icon(Icons.person, size: 11, color: dim),
          if (col != null && s.mode != 'regicide') ...[
            const SizedBox(width: 4),
            Text(col.show(col.value(p.id)), style: const TextStyle(color: gold, fontSize: 11)),
          ],
          if (col?.bar case final bar?) ...[
            const SizedBox(width: 6),
            SizedBox(width: 34, height: 5, child: LinearProgressIndicator(value: bar(p.id).clamp(0.0, 1.0), color: const Color(0xFFE07060),
                backgroundColor: const Color(0x55000000))),
          ],
        ])),
      )),
    ]));
  }
}

// عدّاد الأداء (2.1.2): أرقامه، ومفاتيح تخفي طبقة واحدة لمعرفة الثقيل منها على هذا الجوال
class _Meter extends StatefulWidget {
  final MatchScreenState screen;
  final String text;
  const _Meter(this.screen, this.text);
  @override
  State<_Meter> createState() => _MeterState();
}

class _MeterState extends State<_Meter> {
  Widget _sw(String label, bool hidden, VoidCallback flip) => GestureDetector(
      onTap: () => setState(flip),
      child: Container(margin: const EdgeInsets.only(left: 4), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(color: hidden ? const Color(0xFF5A2A22) : const Color(0xFF3A2E22), borderRadius: BorderRadius.circular(6)),
          child: Text(hidden ? 'بلا $label' : label, style: TextStyle(color: hidden ? const Color(0xFFFFB0A0) : ink, fontSize: 10.5))));

  @override
  Widget build(BuildContext context) {
    final v = widget.screen;
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(color: const Color(0xD0120E0A), borderRadius: BorderRadius.circular(8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text(widget.text, style: const TextStyle(color: ink, fontSize: 10.5, height: 1.35)),
        const SizedBox(height: 4),
        Row(mainAxisSize: MainAxisSize.min, children: [
          _sw('المدينة', v.hideCity, () => v.hideCity = !v.hideCity),
          _sw('الجنود', v.hideUnits, () => v.hideUnits = !v.hideUnits),
          _sw('الضباب', v.hideFog, () => v.hideFog = !v.hideFog),
          _sw('الطقس', v.hideWeather, () => v.hideWeather = !v.hideWeather),
        ]),
      ]),
    );
  }
}

// شريط الطور: النص، وأشرطة تقدم الجوانب في ملك الحي
class _ModeBarBox extends StatelessWidget {
  final ModeBar bar;
  const _ModeBarBox(this.bar);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: bar.alarm ? const Color(0xE6501A14) : panel, borderRadius: BorderRadius.circular(9),
        border: Border.all(color: bar.alarm ? danger : const Color(0x55E2B55A))),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(bar.text, style: TextStyle(color: bar.alarm ? const Color(0xFFFFC0B0) : gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
      for (final (c, r, me) in bar.bars) Padding(padding: const EdgeInsets.only(top: 2), child: SizedBox(width: 150, height: me ? 5 : 3,
          child: LinearProgressIndicator(value: r.clamp(0.0, 1.0), color: colorOf(c), backgroundColor: const Color(0x55000000)))),
    ]),
  );
}

// أسهم على حافة الشاشة نحو من هو خارجها (alerts.js وenemyLeaders)
class _EdgeArrows extends CustomPainter {
  final MatchScreenState v;
  _EdgeArrows(this.v) : super(repaint: v.frame);
  @override
  void paint(Canvas canvas, Size size) {
    final s = v.state;
    if (s == null) return;
    final targets = <(double, double, Color)>[
      for (final (u, c) in enemyLeaders(s)) (u.x, u.y, colorOf(c)),
      for (final a in s.alerts) (a.i.toDouble(), a.j.toDouble(), danger),   // جنودك يُضربون خارج الشاشة، أو زعيمك
      if (targetPoint(s) case final tp?) (tp.$1, tp.$2, gold),   // مكان مهمة القصة
    ];
    const m = 26.0;
    for (final (i, j, c) in targets) {
      final p = v.toScreen(s, (i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H, size);
      if (p.dx > 0 && p.dy > 0 && p.dx < size.width && p.dy < size.height) continue;
      final cx = size.width / 2, cy = size.height / 2, dx = p.dx - cx, dy = p.dy - cy;
      final k = [(cx - m) / dx.abs(), (cy - m) / dy.abs()].reduce((a, b) => a < b ? a : b);
      final x = cx + dx * k, y = cy + dy * k, an = Offset(dx, dy).direction;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(an);
      final path = Path()..moveTo(12, 0)..lineTo(-8, -9)..lineTo(-4, 0)..lineTo(-8, 9)..close();
      canvas.drawPath(path, Paint()..color = const Color(0xCC000000)..style = PaintingStyle.stroke..strokeWidth = 3);
      canvas.drawPath(path, Paint()..color = c);
      canvas.restore();
    }
  }
  @override
  bool shouldRepaint(_EdgeArrows old) => true;
}

// مجموعة تحكم: ضغطة مطوّلة تحفظ المحدد، ولمسة تحدده فوراً، والثانية خلال doubleTapMs تنقل الكاميرا إليه أيضاً. كان InkWell
// بلمستين ينتظر الثانية 300 ملي ث قبل أن يحدد (2.16.0، بطلب المستخدم: "الضغط متأخر وليس سلس وكأنه لا يستجيب")
// ما يتغير في أزرار الجرعات: المستعمل منها، وما تملكه، وحلقة أثر كل جرعة بعشرين درجة
String _potionSig(MatchScreenState screen, MatchState s) {
  final p = s.potions, me = s.humanId;
  final used = p == null ? '' : p.used[me].join(',');
  final rings = [for (final e in POTIONS.list.entries) if (e.value.seconds > 0) ((p?.left(me, e.key, s.time) ?? 0) / e.value.seconds * 20).ceil()].join();
  return '$used|${screen.potionSent}|${Wallet.potions}|$rings';
}

class _PotionButton extends StatelessWidget {
  final MatchScreenState screen;
  final String id;
  const _PotionButton(this.screen, this.id);
  @override
  Widget build(BuildContext context) {
    final s = screen.state!, used = screen.potionUsed(id), n = Wallet.potionCount(id), seconds = POTIONS.list[id]!.seconds;
    final left = s.potions?.left(s.humanId, id, s.time) ?? 0, active = seconds > 0 && left > 0;
    return Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: GestureDetector(
      onTap: () => screen.usePotion(id),
      onLongPress: () { s.notice = Notice('${POTION_NAMES[id]} — ${potionDesc(id)}', true, 3.5); screen.hud.value++; },
      child: SizedBox(width: 38, height: 38, child: Stack(clipBehavior: Clip.none, children: [
        PotionBadge(id, size: 38, dim: !active && (used || n == 0)),
        if (active) Positioned.fill(child: CircularProgressIndicator(value: left / seconds, strokeWidth: 3, color: gold)),
        if (used && !active) const Center(child: Icon(Icons.check_rounded, size: 20, color: Color(0xFFCFC6B6))),
        if (!used) Positioned(right: -5, bottom: -4, child: Container(   // جهة وسط الشاشة لا حافتها
            padding: const EdgeInsets.symmetric(horizontal: 4), decoration: BoxDecoration(color: const Color(0xE6261E17), borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0x80E2B55A))),
            child: Text('$n', style: TextStyle(color: n > 0 ? gold : danger, fontSize: 10, fontWeight: FontWeight.w700)))),
      ]))));
  }
}

class _Group extends StatelessWidget {
  final MatchScreenState screen;
  final int g, n;
  final bool on;
  const _Group(this.screen, this.g, this.n, this.on);
  static final _last = <int, int>{};   // آخر لمسة لكل خانة (ملي ثانية)

  void _tap() {
    final s = screen.state!, now = DateTime.now().millisecondsSinceEpoch;
    final twice = now - (_last[g] ?? 0) < controlGroups.i('doubleTapMs');
    _last[g] = twice ? 0 : now;
    var x = 0.0, y = 0.0, k = 0;
    for (final u in s.units) {
      u.selected = u.group == g && u.state != 'dead';
      if (u.selected) { x += u.x; y += u.y; k++; }
    }
    if (twice && k > 0) screen.centerOn(x / k, y / k);
    screen.hud.value++;
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2.5),
    child: Material(color: on ? cardOn : n > 0 ? panel : const Color(0x88261E17),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: on ? const BorderSide(color: gold, width: 1.5) : BorderSide.none),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onLongPress: () {
          for (final u in screen.state!.units) { if (u.group == g) u.group = 0; if (u.selected) u.group = g; }
          screen.hud.value++;
        },
        onTap: _tap,
        child: SizedBox(width: 34, height: 30, child: Center(child: FittedBox(fit: BoxFit.scaleDown, child: Text(n > 0 ? '$g·$n' : '$g',
            style: TextStyle(color: n > 0 ? gold : dim, fontSize: 12, fontWeight: FontWeight.w700))))),
      )),
  );
}

// رقائق قائمة الحي (empireMenu.js): ما تعطيه كل خانة بأرقامه، وحجم الحي وقدرة مبناه
const _chipIcon = {'coin': Icons.toll, 'shield': Icons.shield, 'castle': Icons.fort, 'sword': Icons.sports_martial_arts,
  'range': Icons.gps_fixed, 'clock': Icons.schedule, 'heart': Icons.favorite, 'boot': Icons.double_arrow, 'gear': Icons.settings,
  'people': Icons.groups, 'block': Icons.crop_square};
typedef _Chip = (String, String);
String _pct(num v) => '${(v * 100).round()}%';
String _sec(num v) => '${(v * 10).round() / 10}ث';
String _num(num v) => '${(v * 10).round() / 10}'.replaceAll(RegExp(r'\.0$'), '');
final J _DS = DISTRICT_SIZES;

// ما يعطيه المبنى إن بُني هنا (بحجم الحي)
List<_Chip> _buildPerks(District d, String type) {
  final size = sizeOf(d), B = EMPIRE.m('buildings');
  if (type == 'tower') return [('sword', '${(B.m('tower').d('damage') * _DS.m('power').d(size)).round()}'), ('range', _num(B.m('tower').d('range') * _DS.m('reach').d(size)))];
  if (type == 'hospital') return [('heart', '${_num(B.m('hospital').d('perSecond') * _DS.m('power').d(size))}/ث')];
  return [('coin', '+${_num(EMPIRE.m('income').d('mul') * EMPIRE.m('income').d('hq') * _DS.m('income').d(size))}/ث'), ('people', '')];
}

// ترقية مبنى بمستواها التالي: سرعة إنتاج القاعدة، وضرر البرج وسرعته، ومدى المستشفى وعلاجه
List<_Chip> _upgradePerks(String building, String key, int level) {
  final U = EMPIRE.m('buildings').m(building).m('upgrades').m(key);
  if (building == 'hq') return [('gear', '−${_pct(1 - (U.l('times')[level] as num))}')];
  if (building == 'tower') return key == 'damage' ? [('sword', '+${_pct(U.d('per') * level)}')] : [('clock', '−${_pct(U.d('per') * level)}')];
  return key == 'radius' ? [('range', '+${_num(U.d('per') * level)}')] : [('heart', '+${_pct(U.d('per') * level)}')];
}

const _gangIcon = {'hp': 'heart', 'damage': 'sword', 'armor': 'shield', 'speed': 'boot'};

// سطر حجم الحي وتحصينه: الدخل، وصعوبة احتلاله، وقوة مبانيه ومداها، وسرعة الإنتاج فيه
List<_Chip> _sizeChips(District d) {
  final size = sizeOf(d), list = <_Chip>[('block', 'حي ${_DS.m('names').s(size)}')];
  String signed(num v) => '${v >= 0 ? '+' : '−'}${_pct(v.abs())}';
  if (size != 'medium') {
    list.addAll([('coin', signed(_DS.m('income').d(size) - 1)), ('shield', signed(1 / _DS.m('capture').d(size) - 1)),
      ('sword', signed(_DS.m('power').d(size) - 1)), ('range', signed(_DS.m('reach').d(size) - 1))]);
    if (d.building == 'hq' || recruitsAt(d) != null) list.add(('gear', signed(1 - _DS.m('production').d(size))));
  }
  if (d.fort > 0) list.add(('castle', '+${_pct(EMPIRE.m('fortify').l('capture')[d.fort - 1] as num)}'));
  return list;
}

// قدرة البرج والمستشفى الآن
List<_Chip>? _statsChips(MatchState s, District d) {
  if (d.building == 'tower') {
    final t = towerStats(d, s);
    return [('sword', '${t.damage.round()}'), ('clock', _sec(t.attackTime)), ('range', _num(t.range))];
  }
  if (d.building == 'hospital') {
    final h = hospitalStats(d);
    return [('heart', '${_num(h.perSecond)}/ث'), ('range', _num(h.radius))];
  }
  return null;
}

// رقائق ما تعطيه الخانة بأرقامها في سطر واحد
Widget _chips(List<_Chip> list, {double size = 9, Color color = dim, Color icon = dim}) => Row(
  mainAxisSize: MainAxisSize.min, textDirection: TextDirection.ltr,
  children: [
    for (final (n, (k, t)) in list.indexed) ...[
      if (n > 0) const SizedBox(width: 4),
      Icon(_chipIcon[k], size: size + 1, color: icon),
      if (t.isNotEmpty) Text(t, textDirection: TextDirection.ltr, style: TextStyle(color: color, fontSize: size)),
    ],
  ],
);

// قائمة الحي (2.16.0، بطلب المستخدم: "قائمه التطويرات تحتاج تحسين وتجميل وترتيب افضل"): شريط أسفل الشاشة بأقسام معنونة في صف
// واحد (الجنود، والمبنى، وترقيات العصابة، والبناء، والسور) يُمرَّر إن لم يتسع، وفوقها اسم المبنى وحجم الحي والطابور والنقاط
class _EmpireMenu extends StatelessWidget {
  final MatchScreenState screen;
  final int did;
  const _EmpireMenu(this.screen, this.did);

  @override
  Widget build(BuildContext context) {
    final s = screen.state!, d = s.map.districts[did], pid = s.humanId;
    if (d.owner != pid) return const SizedBox.shrink();
    final me = s.players[pid], e = s.empire!;
    final sections = <(String, List<Widget>)>[];
    void section(String name) => sections.add((name, <Widget>[]));
    // بصمة ما تعرضه الخانات: تُبنى من جديد حين يتغير شيء منها وحده
    final sig = StringBuffer('$did');
    int next(int level, int max) => math.min(level + 1, max);
    void slot(String label, int? cost, Result check, VoidCallback act,
        {int count = 0, IconData icon = Icons.circle, int level = 0, int max = 0, List<_Chip> perks = const [], String? note}) {
      final affordable = cost == null || e.points[pid] >= cost;
      sig.write('|$label,$cost,${check.ok},${check.reason},$count,$level,$max,$affordable,$note');
      sections.last.$2.add(_Slot(label: label, icon: icon, cost: cost, check: check, count: count, level: level, max: max, perks: perks,
          note: note, affordable: affordable, onTap: check.ok ? () { act(); screen.hud.value++; } : null));
    }
    final queue = e.queues[did] ?? const [];
    var hasQueue = false;
    // مبنى ميزة المدينة (القسم 3.11): ما يعطيه، وخانات التجنيد، والترياد والصاروخ والأجراس
    String? info;
    if ((d.featureTile != null || d.merc) && d.feature != null) {
      info = FEATURES.m('desc').ss(d.feature!);
      final kinds = recruitsAt(d) ?? const <String>[];
      if (kinds.isNotEmpty) section('التجنيد');
      for (final kind in kinds) {
        final R = FEATURES.m('recruits').m(kind);
        hasQueue = true;
        slot(R.ss('name') ?? kind, unitPrice(s, pid, kind), canQueue(s, pid, d, kind), () => screen.empire('queue', did, kind),
            icon: Icons.person_add, count: queue.where((x) => x.kind == kind).length);
      }
      final F = FEATURES;
      if (const ['triads', 'powder', 'cathedral'].contains(d.feature)) section('المبنى');
      if (d.feature == 'triads') {
        slot('هجوم الترياد', F.m('triads').i('cost'), canCallTriads(s, pid, d),
            () => screen.startPick('triads', did, 'المس حياً لعدوك ليهجم عليه الترياد'), icon: Icons.groups,
            perks: [('people', '${F.m('triads').l('heroes').length}'), ('clock', _sec(F.m('triads').d('seconds')))]);
      }
      if (d.feature == 'powder') {
        slot('صاروخ البارود', F.m('powder').i('cost'), canRocket(s, pid, d),
            () => screen.startPick('rocket', did, 'المس حياً ليس لك ليسقط عليه الصاروخ'), icon: Icons.rocket_launch,
            perks: [('sword', '${F.m('powder').i('damage')}'), ('clock', _sec(F.m('powder').d('delay')))]);
      }
      if (d.feature == 'cathedral') {
        final C = F.m('cathedral');
        slot('اقرع الأجراس', null, canRingBells(s, pid, d), () => screen.empire('bells', did, null), icon: Icons.notifications_active,
            perks: [('boot', '+${_pct(C.d('speed'))}'), ('sword', '+${_pct(C.d('damage'))}'), ('clock', _sec(C.d('seconds')))]);
      }
    }
    final title = d.featureTile != null && d.feature != null ? 'مبنى المدينة'
        : d.building == 'hq' ? 'القاعدة الرئيسية' : d.building == 'tower' ? 'برج رماية' : d.building == 'hospital' ? 'مستشفى' : 'حي';
    final titleIcon = d.featureTile != null && d.feature != null ? Icons.account_balance
        : d.building == null ? Icons.crop_square : _buildIcon[d.building] ?? Icons.home_work;
    if (d.building == 'hq') {
      hasQueue = true;
      section('الجنود');
      for (final kind in EMPIRE.m('units').l('order').cast<String>()) {
        final hero = heroFor(me, kind);
        final name = kind == 'leader' ? CHAMPIONS.m(me.gang).s('name') : hero != null ? HEROES.m(hero).s('name') : 'فرد';
        slot(name, unitPrice(s, pid, kind), canQueue(s, pid, d, kind), () => screen.empire('queue', did, kind),
            icon: _unitIcon[kind] ?? Icons.person, count: queue.where((x) => x.kind == kind).length);
      }
      // مكان الإنتاج: لمسة على الخريطة بعد الخانة، ولمسة على القاعدة نفسها تلغيه
      final set = d.rally != null && d.rally!.owner == pid;
      slot('مكان الإنتاج', null, canRally(s, pid, d),
          () => screen.startPick('rally', did, 'المس مكان تجمع الجنود الجدد، أو القاعدة نفسها لإلغائه'), icon: Icons.flag,
          note: set ? 'محدد' : 'غير محدد');
    }
    final b = d.building == null ? null : EMPIRE.m('buildings').mm(d.building!);
    if (b != null) {
      section(d.building == 'hq' ? 'القاعدة' : d.building == 'tower' ? 'البرج' : 'المستشفى');
      for (final key in b.m('upgrades').l('order').cast<String>()) {
        final next0 = nextBuildingUpgrade(d, key, s), max = b.m('upgrades').m(key).l('costs').length, lv = d.blv[key] ?? 0;
        slot(b.m('upgrades').m(key).s('name'), next0?.cost, canUpgradeBuilding(s, pid, d, key), () => screen.empire('improve', did, key),
            icon: _upgradeIcon['${d.building}.$key'] ?? Icons.upgrade, level: lv, max: max, perks: _upgradePerks(d.building!, key, next(lv, max)));
      }
    }
    if (d.building == 'hq') {
      section('ترقيات العصابة');
      for (final key in EMPIRE.m('upgrades').l('order').cast<String>()) {
        final U = EMPIRE.m('upgrades').m(key), max = U.l('costs').length, lv = e.levels[pid][key], n = next(lv, max);
        // الخانة الرابعة بفئة العصابة (2026-11-12): الضربة المحيطية للصامد، والمدى والاختراق للرامي، وسرعة الاحتلال للحشد
        final C = key == 'speed' ? U.m('classes').mm(s.players[pid].gang) : null;
        slot((C ?? U).s('name'), nextUpgrade(s, pid, key)?.cost, canUpgrade(s, pid, key), () => screen.empire('upgrade', did, key),
            icon: C == null ? _upgradeIcon[key] ?? Icons.upgrade : C.has('chance') ? Icons.flare : C.has('range') ? Icons.gps_fixed : Icons.flag,
            level: lv, max: max,
            perks: C == null ? [(_gangIcon[key]!, '+${_pct(U.d('per') * n)}'), if (U.dn('evade') != null) ('shield', '${_pct(U.d('evade') * n)} تفادٍ')]
                : C.has('chance') ? [('sword', '${_pct(C.l('chance')[n - 1] as num)} فرصة'), ('people', '${_pct(C.d('splash'))} حوله')]
                : C.has('range') ? [('range', '+${_num(C.d('range') * n)}'), ('shield', '${_pct(C.d('pierce') * n)} خرق')]
                : [('castle', '+${_pct(C.d('capture') * n)}')]);
      }
    }
    if (d.building == null && d.featureTile == null) {
      section('بناء');
      for (final type in EMPIRE.m('buildings').l('order').cast<String>()) {
        slot(EMPIRE.m('buildings').m(type).s('name'), buildCost(s, type), canBuild(s, pid, d, type), () => screen.empire('build', did, type),
            icon: _buildIcon[type] ?? Icons.home_work, perks: _buildPerks(d, type));
      }
    }
    final fort = nextFort(d, s, pid), fmax = EMPIRE.m('fortify').l('costs').length;
    // لا خانة سور للمعبد والمرتزقة والحدائق (2.4.1)
    if (fortifiable(s.map, d)) {
      section('السور');
      slot('سور', fort?.cost, canFortify(s, pid, d), () => screen.empire('fortify', did, null), icon: Icons.fort, level: d.fort, max: fmax,
          perks: [('castle', '+${_pct(EMPIRE.m('fortify').l('capture')[next(d.fort, fmax) - 1] as num)}')]);
    }
    final shown = [for (final x in sections) if (x.$2.isNotEmpty) x];
    final stats = _statsChips(s, d);
    final item = queue.isEmpty ? null : queue.first;
    final done = item == null ? 0.0 : math.min(1.0, item.t / productionTime(s, d, item.kind));
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 12),
      child: IntrinsicWidth(child: Container(
        padding: const EdgeInsets.fromLTRB(8, 5, 8, 7),
        decoration: BoxDecoration(
          gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF2332619), Color(0xF217120D)]),
          borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0x80E2B55A)),
          boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 10, offset: Offset(0, 3))]),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // اسم المبنى وحجم الحي وقدرته، والطابور، والنقاط، والإغلاق
          Row(children: [
            Container(width: 22, height: 22, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: goldGrad),
                child: Icon(titleIcon, size: 14, color: const Color(0xFF2A1A08))),
            const SizedBox(width: 6),
            Text(title, style: const TextStyle(color: gold, fontSize: 13, fontWeight: FontWeight.w800)),
            const SizedBox(width: 8),
            Flexible(child: FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart,
                child: _chips([..._sizeChips(d), ...?stats], size: 9.5, color: ink, icon: gold))),
            const Spacer(),
            if (hasQueue) ...[
              Text(item == null ? 'الطابور فارغ' : 'الطابور ${queue.length}/${EMPIRE.i('queueMax')}', style: const TextStyle(color: dim, fontSize: 10)),
              const SizedBox(width: 5),
              SizedBox(width: 56, height: 5, child: ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(
                  value: done, color: const Color(0xFFE8C45A), backgroundColor: const Color(0x55000000)))),
              const SizedBox(width: 10),
            ],
            const Icon(Icons.toll, size: 13, color: gold),
            Text(' ${e.points[pid].floor()}', style: const TextStyle(color: gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
            const SizedBox(width: 6),
            InkWell(onTap: () { screen.menuDistrict = null; screen.hud.value++; }, customBorder: const CircleBorder(),
                child: Container(width: 22, height: 22, decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0x33000000),
                    border: Border.all(color: const Color(0x55E2B55A))), child: const Icon(Icons.close, color: dim, size: 14))),
          ]),
          if (info != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(info, textAlign: TextAlign.center, maxLines: 2,
              overflow: TextOverflow.ellipsis, style: const TextStyle(color: ink, fontSize: 10.5))),
          const SizedBox(height: 4),
          _Memo('slots', sig.toString(), () => SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(
            mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final (n, (name, list)) in shown.indexed) ...[
                if (n > 0) Container(width: 1, height: _slotH - 6, margin: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
                    color: const Color(0x40E2B55A)),
                Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(padding: const EdgeInsets.only(bottom: 3, right: 2, left: 2), child: Text(name,
                      style: const TextStyle(color: Color(0xFFBFA77A), fontSize: 9.5, fontWeight: FontWeight.w700))),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    for (final (k, w) in list.indexed) ...[if (k > 0) const SizedBox(width: 4), w],
                  ]),
                ]),
              ],
            ],
          ))),
        ]),
      )),
    );
  }
}

// رموز الخانات (ICON في empireMenu.js): الجنود، وترقيات العصابة والمباني، والبناء
const _unitIcon = {'common': Icons.person, 'strong': Icons.shield, 'elite': Icons.star, 'leader': Icons.military_tech};
const _upgradeIcon = {'hp': Icons.favorite, 'damage': Icons.sports_martial_arts, 'armor': Icons.shield, 'speed': Icons.double_arrow,
  'hq.production': Icons.settings, 'tower.damage': Icons.sports_martial_arts, 'tower.rate': Icons.schedule,
  'hospital.radius': Icons.gps_fixed, 'hospital.rate': Icons.favorite};
const _buildIcon = {'tower': Icons.cell_tower, 'hospital': Icons.local_hospital, 'hq': Icons.fort};
const _slotW = 52.0, _slotH = 78.0;   // والإطار يأخذ نقطة من كل جهة

// خانة: شريط المستوى أعلاها، ورمزها وعدد ما في الطابور منها، واسمها في سطرين، وما تعطيه أو سبب المنع، وسعرها (أحمر حين لا
// تكفي النقاط) أو حالتها
class _Slot extends StatelessWidget {
  final String label;
  final IconData icon;
  final int? cost;
  final Result check;
  final int count, level, max;
  final bool affordable;
  final VoidCallback? onTap;
  final List<_Chip> perks;
  final String? note;            // حالة الخانة مكان السعر (مكان الإنتاج)
  const _Slot({required this.label, required this.icon, required this.cost, required this.check, required this.onTap,
      required this.affordable, this.count = 0, this.level = 0, this.max = 0, this.perks = const [], this.note});
  @override
  Widget build(BuildContext context) {
    final maxed = check.reason == 'أعلى مستوى';
    final why = !check.ok && !maxed && check.reason != 'النقاط لا تكفي' ? check.reason : '';
    final on = onTap != null, lit = on || maxed;
    const red = Color(0xFFD07A6A);
    return SizedBox(width: _slotW, height: _slotH, child: Material(type: MaterialType.transparency, child: Ink(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(9),
          border: Border.all(color: maxed ? const Color(0xB3E2B55A) : on ? const Color(0x8CE2B55A) : const Color(0x2EE2B55A)),
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: on ? const [Color(0xFF4B3A27), Color(0xFF2A2018)] : const [Color(0xFF2A221A), Color(0xFF1B1611)])),
      child: InkWell(borderRadius: BorderRadius.circular(9), onTap: onTap, child: Opacity(opacity: lit ? 1 : 0.6, child: Padding(
        padding: const EdgeInsets.fromLTRB(3, 3, 3, 3),
        child: Column(children: [
          // شريط المستوى
          SizedBox(height: 3, child: max == 0 ? null : Row(children: [
            for (var k = 0; k < max; k++) Expanded(child: Container(margin: const EdgeInsets.symmetric(horizontal: 1),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: k < level ? gold : const Color(0x40E2B55A)))),
          ])),
          const SizedBox(height: 2),
          // كل جزء بارتفاع ثابت يصغر ما فيه ليتسع، فلا تخرج الخانة عن حجمها بأي خط
          SizedBox(height: 16, child: FittedBox(fit: BoxFit.scaleDown, child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 16, color: lit ? gold : dim),
            if (count > 0) Text(' ×$count', style: const TextStyle(color: gold, fontSize: 10, height: 1.2, fontWeight: FontWeight.w800)),
          ]))),
          SizedBox(height: 22, child: Center(child: Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: on ? ink : dim, fontSize: 10, height: 1.1, fontWeight: FontWeight.w600)))),
          SizedBox(height: 11, child: Center(child: why.isNotEmpty
              ? Text(why, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: red, fontSize: 9, height: 1.2))
              : perks.isEmpty ? null : FittedBox(fit: BoxFit.scaleDown, child: _chips(perks)))),
          const Spacer(),
          SizedBox(height: 15, child: Center(child: cost != null ? Container(
            padding: const EdgeInsets.symmetric(horizontal: 5),
            decoration: BoxDecoration(color: const Color(0x55000000), borderRadius: BorderRadius.circular(6)),
            child: FittedBox(fit: BoxFit.scaleDown, child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.toll, size: 10, color: affordable ? gold : red),
              Text(' $cost', style: TextStyle(color: affordable ? gold : red, fontSize: 10.5, height: 1.2, fontWeight: FontWeight.w700)),
            ])))
          : Text(note ?? (maxed ? 'الأعلى' : check.ok ? 'جاهز' : check.reason), maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: maxed ? gold : dim, fontSize: 9.5, height: 1.2, fontWeight: maxed ? FontWeight.w700 : FontWeight.w400)))),
        ]),
      ))),
    )));
  }
}

class _Pause extends StatelessWidget {
  final MatchScreenState screen;
  const _Pause(this.screen);
  @override
  Widget build(BuildContext context) => Container(color: const Color(0x99000000), child: Center(child: Panel(padding: const EdgeInsets.all(14),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
    // اللعب المحلي: المضيف يوقفها عند الجميع، والمنضم يفتح القائمة واللعب مستمر، والمغادرة نهائية
    Text(screen.lanRole == 'client' ? 'القائمة • المباراة مستمرة' : 'إيقاف مؤقت', style: const TextStyle(color: gold, fontSize: 18, fontWeight: FontWeight.w700)),
    const SizedBox(height: 8),
    WideButton('متابعة', screen.closePause, primary: true),
    WideButton('الإعدادات', screen.openSettings),
    if (screen.lanRole == null) WideButton('إعادة المباراة', screen.restart),
    WideButton(screen.lanRole != null ? 'مغادرة المباراة' : 'القائمة الرئيسية', screen.leaveToMain,
        note: screen.lanRole == 'host' ? 'تنتهي عند الجميع' : screen.lanRole == 'client' ? 'يقود جيشك بوت' : 'تُحفظ المباراة للمتابعة'),
  ]))));
}

class _End extends StatelessWidget {
  final MatchScreenState screen;
  final MatchResult r;
  const _End(this.screen, this.r);
  @override
  Widget build(BuildContext context) => Container(color: const Color(0xAA000000), child: Center(child: SingleChildScrollView(child: Panel(
      padding: const EdgeInsets.all(14), child: Column(mainAxisSize: MainAxisSize.min, children: [
    Text(screen.storyResult?.title ?? (r.won ? 'انتصار!' : 'هزيمة'), style: TextStyle(color: r.won ? gold : danger, fontSize: 26, fontWeight: FontWeight.w800)),
    const SizedBox(height: 4),
    Text(r.reason, style: const TextStyle(color: ink, fontSize: 14)),
    if (screen.storyResult case final sr?) ...[
      for (final (who, line) in sr.lines) SizedBox(width: 520, child: Text.rich(TextSpan(children: [
        TextSpan(text: '$who: ', style: const TextStyle(color: gold, fontWeight: FontWeight.w700)), TextSpan(text: line)]),
          style: const TextStyle(color: ink, fontSize: 12.5))),
      if (sr.reward.isNotEmpty) Text(sr.reward, style: const TextStyle(color: gold, fontSize: 13)),
      if (sr.ending.isNotEmpty) SizedBox(width: 520, child: Text(sr.ending, style: const TextStyle(color: gold, fontSize: 13))),
      if (sr.gift.isNotEmpty) SizedBox(width: 520, child: Text(sr.gift, style: const TextStyle(color: gold, fontSize: 14, fontWeight: FontWeight.w700))),
    ],
    if (screen.goldNote.isNotEmpty) Text(screen.goldNote, style: const TextStyle(color: dim, fontSize: 12.5)),
    if (screen.newAch.isNotEmpty) ...[
      const SizedBox(height: 6),
      const Text('🏆 إنجازات جديدة', style: TextStyle(color: gold, fontSize: 14, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      SizedBox(width: 560, child: Wrap(spacing: 6, runSpacing: 6, alignment: WrapAlignment.center, children: [for (final a in screen.newAch) AchChip(a)])),
    ],
    const SizedBox(height: 8),
    SizedBox(width: 560, child: Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
      if (screen.goldEarned > 0) StatCard('ذهب ربحته', '+${screen.goldEarned}${screen.goldDoubled ? ' (×2)' : ''}'),
      StatCard('مدة المباراة', clock(r.duration)),
      StatCard('أكبر عدد أحياء', '${r.maxDistricts}'),
      StatCard('أعداء قتلتهم', '${r.kills}'),
      StatCard('وحداتك التي ماتت', '${r.losses}'),
      for (final (l, v) in modeExtras(screen.state!)) StatCard(l, v),
    ])),
    const SizedBox(height: 8),
    if (screen.storyResult case final sr?) WideButton(sr.next, screen.storyNext, primary: true)
    else if (screen.lanRole == 'host') WideButton('غرفة الانتظار', screen.lanBackToLobby, primary: true, note: 'مباراة جديدة مع الأصدقاء')
    else if (screen.lanRole == 'client') const Text('المضيف يبدأ المباراة التالية', style: TextStyle(color: dim, fontSize: 13))
    else WideButton('مباراة جديدة', screen.restart, primary: true),
    WideButton(screen.storyResult != null ? 'قائمة القصة' : screen.lanRole != null ? 'مغادرة' : 'القائمة الرئيسية',
        screen.lanRole != null ? screen.leaveToMain : () => Navigator.of(context).pop()),
  ])))));
}

