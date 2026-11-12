// واجهة المباراة (js/ui/hud.js وpower.js وempireMenu.js وgroups.js): النقاط ودخلها، وشريط القوة، والإشعار،
// وأزرار التحديد والقاعدة والإيقاف، ومجموعات التحكم، وقائمة الحي (الإنتاج والترقيات والبناء والتحصين)، وشاشة النهاية.
// تُعاد بناؤها أربع مرات في الثانية (hud) لا مع كل إطار
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/empire.dart';
import '../game/features.dart';
import '../game/modes.dart';
import '../game/story.dart';
import '../game/spawn.dart';
import '../game/state.dart';
import '../game/victory.dart';
import '../map/generator.dart' show District;
import '../map/sizes.dart';
import 'match_screen.dart';
import 'menus.dart' show cityShort;
import 'prefs.dart';
import 'widgets.dart';


class MatchHud extends StatelessWidget {
  final MatchScreenState screen;
  const MatchHud({super.key, required this.screen});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<int>(
    valueListenable: screen.hud,
    builder: (context, _, _) {
      final s = screen.state!;
      final me = s.humanId >= 0 ? s.players[s.humanId] : null;
      final bar = modeBar(s);
      return Stack(children: [
        // الصف الأعلى: الزمن والمدينة والنقاط يساراً، والأزرار يميناً، وشريط الطور في المساحة بينهما وحدها (يصغر ولا يتداخل)
        Positioned(top: 6, left: 6, right: 6, child: Row(textDirection: TextDirection.ltr, crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Box(child: Text('${clock(s.time)} • ${cityShort(s.map.city)}', style: const TextStyle(color: ink, fontSize: 12))),
          if (me != null && s.empire != null) ...[
            const SizedBox(width: 4),
            _Box(child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.toll, size: 14, color: gold), const SizedBox(width: 3),
              Text(s.empire!.points[me.id].floor().toString(), style: const TextStyle(color: gold, fontSize: 13, fontWeight: FontWeight.w700)),
              Text('  +${incomeOf(s, me.id).toStringAsFixed(1)}/ث', style: const TextStyle(color: dim, fontSize: 11)),
            ])),
          ],
          Expanded(child: Center(child: bar != null ? FittedBox(fit: BoxFit.scaleDown, child: _ModeBarBox(bar)) : const SizedBox())),
          _Btn(icon: Icons.highlight_alt, on: screen.selectMode, tip: 'تحديد', onTap: () { screen.selectMode = !screen.selectMode; screen.hud.value++; }),
          _Btn(icon: Icons.groups, tip: 'كل جنودك', onTap: () {
            for (final u in s.units) { u.selected = u.playerId == s.humanId && u.state != 'dead'; }
            screen.hud.value++;
          }),
          _Btn(icon: Icons.fort, tip: 'القاعدة', onTap: () => _nextHq(s)),
          _Btn(icon: screen.paused ? Icons.play_arrow : Icons.pause, tip: 'إيقاف', onTap: () => screen.paused ? screen.closePause() : screen.openPause()),
        ])),
        // أسهم الحافة: زعماء الأعداء ذهبية، والتنبيهات حمراء (جنودك يُضربون خارج الشاشة، وزعيمك)
        Positioned.fill(child: IgnorePointer(child: RepaintBoundary(child: CustomPaint(painter: _EdgeArrows(screen))))),
        // اللعب المحلي: المضيف أوقف المباراة، أو لا يصل دور جديد منه
        if (screen.lanText case final t?) Positioned(top: 84, left: 0, right: 0, child: IgnorePointer(child: Center(child: _Box(
            child: Text(t, style: const TextStyle(color: gold, fontSize: 13, fontWeight: FontWeight.w700)))))),
        // الإشعار تحت الصف الأعلى في الوسط، صغيراً ولا يلتقط اللمس
        if (s.notice != null) Positioned(top: 46, left: 200, right: 200, child: IgnorePointer(child: Center(child: _Box(
            child: Text(s.notice!.text, textAlign: TextAlign.center, maxLines: 2,
                style: TextStyle(color: s.notice!.mine ? gold : ink, fontSize: 12, fontWeight: FontWeight.w600)))))),
        // شريط القوة يساراً: لمسة تطويه إلى سطرك وحدك
        Positioned(top: 44, left: 6, child: _Power(s)),
        // مجموعات التحكم على الحافة اليمنى
        Positioned(right: 8, top: 0, bottom: 0, child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (var g = 1; g <= 5; g++) _Group(screen, g),
        ]))),
        if (screen.menuDistrict != null) Positioned(left: 0, right: 0, bottom: 8, child: Center(child: _EmpireMenu(screen, screen.menuDistrict!))),
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

class _Box extends StatelessWidget {
  final Widget child;
  const _Box({required this.child});
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(9), border: Border.all(color: const Color(0x55E2B55A))),
      child: child);
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
    return _Box(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (final p in s.players) if (!p.neutral && (!powerFolded || p.id == s.humanId)) Padding(
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
      ),
    ]));
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

// مجموعة تحكم: ضغطة مطوّلة تحفظ المحدد، ولمسة تحدده، ولمستان تنقلان الكاميرا إليه
class _Group extends StatelessWidget {
  final MatchScreenState screen;
  final int g;
  const _Group(this.screen, this.g);
  @override
  Widget build(BuildContext context) {
    final s = screen.state!;
    final n = s.units.where((u) => u.group == g && u.state != 'dead').length;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Material(color: n > 0 ? panel : const Color(0x88261E17), borderRadius: BorderRadius.circular(9), child: InkWell(
        borderRadius: BorderRadius.circular(9),
        onLongPress: () {
          for (final u in s.units) { if (u.group == g) u.group = 0; if (u.selected) u.group = g; }
          screen.hud.value++;
        },
        onTap: () {
          for (final u in s.units) { u.selected = u.group == g && u.state != 'dead'; }
          screen.hud.value++;
        },
        onDoubleTap: () {
          final list = s.units.where((u) => u.group == g && u.state != 'dead').toList();
          if (list.isEmpty) return;
          screen.centerOn(list.map((u) => u.x).reduce((a, b) => a + b) / list.length, list.map((u) => u.y).reduce((a, b) => a + b) / list.length);
        },
        child: SizedBox(width: 40, height: 36, child: Center(child: Text(n > 0 ? '$g·$n' : '$g',
            style: TextStyle(color: n > 0 ? gold : dim, fontSize: 13, fontWeight: FontWeight.w700)))),
      )),
    );
  }
}

// قائمة الحي (empireMenu.js): خانات صغيرة برمزها وسعرها ونقاط مستواها وما تعطيه بأرقامه (رقائق)، وسطر حجم الحي وقدرة
// مبناه، والطابور بشريط تقدمه
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
  return [('coin', '+${_num(EMPIRE.m('income').d('hq') * _DS.m('income').d(size))}/ث'), ('people', '')];
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

Widget _chips(List<_Chip> list, {double size = 9.5, Color color = dim, Color icon = dim}) => Wrap(
  spacing: 4, runSpacing: 0, alignment: WrapAlignment.center,
  children: [
    for (final (k, t) in list) Row(mainAxisSize: MainAxisSize.min, textDirection: TextDirection.ltr, children: [
      Icon(_chipIcon[k], size: size + 1, color: icon),
      if (t.isNotEmpty) Text(t, textDirection: TextDirection.ltr, style: TextStyle(color: color, fontSize: size)),
    ]),
  ],
);

class _EmpireMenu extends StatelessWidget {
  final MatchScreenState screen;
  final int did;
  const _EmpireMenu(this.screen, this.did);

  @override
  Widget build(BuildContext context) {
    final s = screen.state!, d = s.map.districts[did], pid = s.humanId;
    if (d.owner != pid) return const SizedBox.shrink();
    final me = s.players[pid], e = s.empire!;
    final slots = <Widget>[];
    int next(int level, int max) => math.min(level + 1, max);
    void slot(String label, int? cost, Result check, VoidCallback act,
        {int count = 0, IconData icon = Icons.circle, int level = 0, int max = 0, List<_Chip> perks = const [], String? note}) =>
        slots.add(_Slot(label: label, icon: icon, cost: cost, check: check, count: count, level: level, max: max, perks: perks, note: note,
            affordable: cost == null || e.points[pid] >= cost, onTap: check.ok ? () { act(); screen.hud.value++; } : null));
    final queue = e.queues[did] ?? const [];
    var hasQueue = false;
    // مبنى ميزة المدينة (القسم 3.11): ما يعطيه، وخانات التجنيد والترياد والصاروخ والأجراس
    String? info;
    if (d.featureTile != null && d.feature != null) {
      info = CITY_FEATURES.m('desc').ss(d.feature!);
      for (final kind in recruitsAt(d) ?? const <String>[]) {
        final R = CITY_FEATURES.m('recruits').m(kind);
        hasQueue = true;
        slot(R.ss('name') ?? kind, unitPrice(s, pid, kind), canQueue(s, pid, d, kind), () => screen.empire('queue', did, kind),
            icon: Icons.person_add, count: queue.where((x) => x.kind == kind).length);
      }
      final F = CITY_FEATURES;
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
    if (d.building == 'hq') {
      hasQueue = true;
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
      for (final key in b.m('upgrades').l('order').cast<String>()) {
        final next0 = nextBuildingUpgrade(d, key, s), max = b.m('upgrades').m(key).l('costs').length, lv = d.blv[key] ?? 0;
        slot(b.m('upgrades').m(key).s('name'), next0?.cost, canUpgradeBuilding(s, pid, d, key), () => screen.empire('improve', did, key),
            icon: _upgradeIcon['${d.building}.$key'] ?? Icons.upgrade, level: lv, max: max, perks: _upgradePerks(d.building!, key, next(lv, max)));
      }
    }
    if (d.building == 'hq') {
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
      for (final type in EMPIRE.m('buildings').l('order').cast<String>()) {
        slot(EMPIRE.m('buildings').m(type).s('name'), buildCost(s, type), canBuild(s, pid, d, type), () => screen.empire('build', did, type),
            icon: _buildIcon[type] ?? Icons.home_work, perks: _buildPerks(d, type));
      }
    }
    final fort = nextFort(d, s, pid), fmax = EMPIRE.m('fortify').l('costs').length;
    slot('سور', fort?.cost, canFortify(s, pid, d), () => screen.empire('fortify', did, null), icon: Icons.fort, level: d.fort, max: fmax,
        perks: [('castle', '+${_pct(EMPIRE.m('fortify').l('capture')[next(d.fort, fmax) - 1] as num)}')]);
    final stats = _statsChips(s, d);
    final item = queue.isEmpty ? null : queue.first;
    final done = item == null ? 0.0 : math.min(1.0, item.t / productionTime(s, d, item.kind));
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: (MediaQuery.sizeOf(context).width * 0.64).clamp(340.0, 600.0)),
      child: _Box(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: const TextStyle(color: gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(width: 8),
          const Icon(Icons.toll, size: 12, color: gold),
          Text(' ${e.points[pid].floor()}', style: const TextStyle(color: gold, fontSize: 12)),
          const SizedBox(width: 4),
          InkWell(onTap: () { screen.menuDistrict = null; screen.hud.value++; },
              child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.close, color: dim, size: 16))),
        ]),
        // حجم الحي وتحصينه، وقدرة البرج أو المستشفى الآن
        _chips([..._sizeChips(d), ...?stats], size: 10, color: ink, icon: gold),
        if (info != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(info, textAlign: TextAlign.center, maxLines: 2,
            overflow: TextOverflow.ellipsis, style: const TextStyle(color: ink, fontSize: 10.5))),
        if (hasQueue) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(item == null ? 'الطابور فارغ' : 'الطابور ${queue.length}/${EMPIRE.i('queueMax')}', style: const TextStyle(color: ink, fontSize: 10.5)),
          const SizedBox(width: 6),
          SizedBox(width: 90, height: 5, child: ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(
              value: done, color: const Color(0xFFE8C45A), backgroundColor: const Color(0x55000000)))),
        ])),
        const SizedBox(height: 2),
        Wrap(spacing: 4, runSpacing: 4, alignment: WrapAlignment.center, children: slots),
      ])),
    );
  }
}

// رموز الخانات (ICON في empireMenu.js): الجنود، وترقيات العصابة والمباني، والبناء
const _unitIcon = {'common': Icons.person, 'strong': Icons.shield, 'elite': Icons.star, 'leader': Icons.military_tech};
const _upgradeIcon = {'hp': Icons.favorite, 'damage': Icons.sports_martial_arts, 'armor': Icons.shield, 'speed': Icons.double_arrow,
  'hq.production': Icons.settings, 'tower.damage': Icons.sports_martial_arts, 'tower.rate': Icons.schedule,
  'hospital.radius': Icons.gps_fixed, 'hospital.rate': Icons.favorite};
const _buildIcon = {'tower': Icons.cell_tower, 'hospital': Icons.local_hospital, 'hq': Icons.fort};

// خانة صغيرة: رمزها واسمها، ثم سعرها دائماً (أحمر حين لا تكفي النقاط)، ونقاط المستوى، وسبب المنع القصير إن لم يكن النقاط
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
    final on = onTap != null;
    return Material(
      color: on ? const Color(0xFF3A2E22) : const Color(0xFF241D16),
      borderRadius: BorderRadius.circular(7),
      child: InkWell(borderRadius: BorderRadius.circular(7), onTap: onTap, child: Container(
        width: 70,
        padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 3),
        child: Opacity(opacity: on || maxed ? 1 : 0.7, child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 14, color: on ? gold : dim),
            if (count > 0) Text('×$count', style: const TextStyle(color: gold, fontSize: 10, fontWeight: FontWeight.w700)),
          ]),
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: on ? ink : dim, fontSize: 10.5, fontWeight: FontWeight.w600)),
          if (perks.isNotEmpty) _chips(perks),
          if (max > 0) Padding(padding: const EdgeInsets.symmetric(vertical: 1), child: Row(mainAxisSize: MainAxisSize.min, children: [
            for (var k = 0; k < max; k++) Container(width: 5, height: 5, margin: const EdgeInsets.symmetric(horizontal: 1),
                decoration: BoxDecoration(shape: BoxShape.circle, color: k < level ? gold : const Color(0x55E2B55A))),
          ])),
          if (cost != null) Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.toll, size: 10, color: affordable ? gold : const Color(0xFFD07A6A)),
            Text(' $cost', style: TextStyle(color: affordable ? gold : const Color(0xFFD07A6A), fontSize: 11, fontWeight: FontWeight.w700)),
          ])
          else Text(note ?? (maxed ? 'الأعلى' : check.ok ? 'جاهز' : check.reason), maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: dim, fontSize: 9.5)),
          if (why.isNotEmpty) Text(why, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFD08A6A), fontSize: 9)),
        ])),
      )),
    );
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
    ],
    const SizedBox(height: 8),
    SizedBox(width: 560, child: Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
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

