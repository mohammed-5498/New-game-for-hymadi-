// واجهة المباراة (js/ui/hud.js وpower.js وempireMenu.js وgroups.js): النقاط ودخلها، وشريط القوة، والإشعار،
// وأزرار التحديد والقاعدة والإيقاف، ومجموعات التحكم، وقائمة الحي (الإنتاج والترقيات والبناء والتحصين)، وشاشة النهاية.
// تُعاد بناؤها أربع مرات في الثانية (hud) لا مع كل إطار
import 'package:flutter/material.dart';

import '../core/cfg.dart';
import '../data/cities.dart';
import '../data/js_config.dart';
import '../game/empire.dart';
import '../game/spawn.dart';
import '../game/state.dart';
import '../game/victory.dart';
import '../map/sizes.dart';
import 'match_screen.dart';

const gold = Color(0xFFE2B55A), panel = Color(0xE6261E17), ink = Color(0xFFF2E6CF), dim = Color(0xFF9C8F7A);
Color colorOf(String hex) => Color(0xFF000000 | int.parse(hex.substring(1, 7), radix: 16));
String clock(double seconds) { final s = seconds.floor(); return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}'; }

class MatchHud extends StatelessWidget {
  final MatchScreenState screen;
  const MatchHud({super.key, required this.screen});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<int>(
    valueListenable: screen.hud,
    builder: (context, _, __) {
      final s = screen.state!;
      final me = s.humanId >= 0 ? s.players[s.humanId] : null;
      final selected = s.units.where((u) => u.selected && u.state != 'dead').length;
      return Stack(children: [
        // أعلى اليسار: الزمن والنقاط ودخلها
        Positioned(top: 8, left: 8, child: Row(children: [
          _Box(child: Text('${clock(s.time)} • ${CITY_THEMES[s.map.city]?.name ?? s.map.city}', style: const TextStyle(color: ink, fontSize: 13))),
          if (me != null && s.empire != null) ...[
            const SizedBox(width: 6),
            _Box(child: Row(children: [
              const Icon(Icons.toll, size: 15, color: gold), const SizedBox(width: 4),
              Text(s.empire!.points[me.id].floor().toString(), style: const TextStyle(color: gold, fontSize: 14, fontWeight: FontWeight.w700)),
              Text('  +${incomeOf(s, me.id).toStringAsFixed(1)}/ث', style: const TextStyle(color: dim, fontSize: 12)),
            ])),
          ],
          if (selected > 0) ...[const SizedBox(width: 6), _Box(child: Text('المحدد: $selected', style: const TextStyle(color: ink, fontSize: 13)))],
        ])),
        // الإشعار أعلى الوسط
        if (s.notice != null) Positioned(top: 48, left: 0, right: 0, child: Center(child: _Box(
            child: Text(s.notice!.text, style: TextStyle(color: s.notice!.mine ? gold : ink, fontSize: 14, fontWeight: FontWeight.w600))))),
        // شريط القوة يساراً
        Positioned(top: 48, left: 8, child: _Power(s)),
        // أزرار أعلى اليمين
        Positioned(top: 8, right: 8, child: Row(children: [
          _Btn(icon: Icons.highlight_alt, on: screen.selectMode, tip: 'تحديد', onTap: () { screen.selectMode = !screen.selectMode; screen.hud.value++; }),
          _Btn(icon: Icons.groups, tip: 'كل جنودك', onTap: () {
            for (final u in s.units) { u.selected = u.playerId == s.humanId && u.state != 'dead'; }
            screen.hud.value++;
          }),
          _Btn(icon: Icons.fort, tip: 'القاعدة', onTap: () => _nextHq(s)),
          _Btn(icon: screen.paused ? Icons.play_arrow : Icons.pause, tip: 'إيقاف', onTap: () { screen.paused = !screen.paused; screen.hud.value++; }),
        ])),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
      child: SizedBox(width: 44, height: 44, child: Icon(icon, color: on ? Colors.black : gold, semanticLabel: tip)))),
  );
}

// شريط القوة: لكل عصابة لونها وأحياؤها وجنودها ونقاطها
class _Power extends StatelessWidget {
  final MatchState s;
  const _Power(this.s);
  @override
  Widget build(BuildContext context) => _Box(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    for (final p in s.players) if (!p.neutral) Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Opacity(opacity: isPlayerAlive(s, p.id) ? 1 : 0.4, child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: colorOf(p.color), shape: BoxShape.circle)),
        const SizedBox(width: 6),
        SizedBox(width: 88, child: Text(p.isHuman ? 'أنت' : p.gangName, overflow: TextOverflow.ellipsis,
            style: TextStyle(color: p.isHuman ? gold : ink, fontSize: 12))),
        Text('${ownedDistricts(s, p.id).length}', style: const TextStyle(color: ink, fontSize: 12)),
        const Icon(Icons.flag, size: 12, color: dim),
        const SizedBox(width: 6),
        Text('${countUnits(s, p.id)}', style: const TextStyle(color: ink, fontSize: 12)),
        const Icon(Icons.person, size: 12, color: dim),
      ])),
    ),
  ]));
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

// قائمة الحي (empireMenu.js): خانات بأسعارها، والمعطلة بسببها
class _EmpireMenu extends StatelessWidget {
  final MatchScreenState screen;
  final int did;
  const _EmpireMenu(this.screen, this.did);

  @override
  Widget build(BuildContext context) {
    final s = screen.state!, d = s.map.districts[did], pid = s.humanId;
    if (d.owner != pid) return const SizedBox.shrink();
    final me = s.players[pid];
    final slots = <Widget>[];
    void slot(String label, int? cost, Result check, VoidCallback act, {int count = 0}) => slots.add(_Slot(
        label: label, cost: cost, reason: check.ok ? '' : check.reason, count: count,
        onTap: check.ok ? () { act(); screen.hud.value++; } : null));
    final title = d.building == 'hq' ? 'القاعدة الرئيسية' : d.building == 'tower' ? 'برج رماية' : d.building == 'hospital' ? 'مستشفى' : 'حي';
    final size = {'small': 'صغير', 'medium': 'متوسط', 'large': 'كبير'}[sizeOf(d)];
    if (d.building == 'hq') {
      final q = s.empire!.queues[did] ?? const [];
      for (final kind in EMPIRE.m('units').l('order').cast<String>()) {
        final hero = heroFor(me, kind);
        final name = kind == 'leader' ? CHAMPIONS.m(me.gang).s('name') : hero != null ? HEROES.m(hero).s('name') : 'فرد';
        slot(name, unitPrice(s, pid, kind), canQueue(s, pid, d, kind), () => queueUnit(s, pid, did, kind),
            count: q.where((x) => x.kind == kind).length);
      }
    }
    final b = d.building == null ? null : EMPIRE.m('buildings').mm(d.building!);
    if (b != null) {
      for (final key in b.m('upgrades').l('order').cast<String>()) {
        final next = nextBuildingUpgrade(d, key, s);
        slot('${b.m('upgrades').m(key).s('name')} ${next != null ? next.level : 'الأعلى'}', next?.cost,
            canUpgradeBuilding(s, pid, d, key), () => upgradeBuilding(s, pid, did, key));
      }
    }
    if (d.building == 'hq') {
      for (final key in EMPIRE.m('upgrades').l('order').cast<String>()) {
        final next = nextUpgrade(s, pid, key);
        slot('${EMPIRE.m('upgrades').m(key).s('name')} ${next != null ? next.level : 'الأعلى'}', next?.cost,
            canUpgrade(s, pid, key), () => buyUpgrade(s, pid, key));
      }
    }
    if (d.building == null) {
      for (final type in EMPIRE.m('buildings').l('order').cast<String>()) {
        slot(EMPIRE.m('buildings').m(type).s('name'), buildCost(s, type), canBuild(s, pid, d, type), () => buildDistrict(s, pid, did, type));
      }
    }
    final fort = nextFort(d, s, pid);
    slot('سور ${fort != null ? fort.level : 'الأعلى'}', fort?.cost, canFortify(s, pid, d), () => fortifyDistrict(s, pid, did));
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 120),
      child: _Box(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          Text('$title • $size', style: const TextStyle(color: gold, fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(width: 10),
          Text('${s.empire!.points[pid].floor()} نقطة', style: const TextStyle(color: dim, fontSize: 12)),
          const SizedBox(width: 6),
          IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.close, color: dim, size: 18),
              onPressed: () { screen.menuDistrict = null; screen.hud.value++; }),
        ]),
        Wrap(spacing: 6, runSpacing: 6, alignment: WrapAlignment.center, children: slots),
      ])),
    );
  }
}

class _Slot extends StatelessWidget {
  final String label, reason;
  final int? cost;
  final int count;
  final VoidCallback? onTap;
  const _Slot({required this.label, required this.cost, required this.reason, required this.onTap, this.count = 0});
  @override
  Widget build(BuildContext context) => Material(
    color: onTap != null ? const Color(0xFF3A2E22) : const Color(0xFF241D16),
    borderRadius: BorderRadius.circular(8),
    child: InkWell(borderRadius: BorderRadius.circular(8), onTap: onTap, child: Container(
      constraints: const BoxConstraints(minWidth: 86, minHeight: 44),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(count > 0 ? '$label ×$count' : label, style: TextStyle(color: onTap != null ? ink : dim, fontSize: 12.5, fontWeight: FontWeight.w600)),
        Text(reason.isNotEmpty ? reason : cost != null ? '$cost نقطة' : '', style: TextStyle(color: reason.isNotEmpty ? const Color(0xFFD08A6A) : gold, fontSize: 11)),
      ]),
    )),
  );
}

class _Pause extends StatelessWidget {
  final MatchScreenState screen;
  const _Pause(this.screen);
  @override
  Widget build(BuildContext context) => Container(color: const Color(0x99000000), child: Center(child: _Box(child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Text('إيقاف مؤقت', style: TextStyle(color: gold, fontSize: 18, fontWeight: FontWeight.w700)),
    const SizedBox(height: 10),
    _Wide('متابعة', () { screen.paused = false; screen.hud.value++; }),
    _Wide('مباراة جديدة', screen.restart),
    _Wide('القائمة الرئيسية', () => Navigator.of(context).pop()),
  ]))));
}

class _Wide extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _Wide(this.label, this.onTap);
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: SizedBox(width: 220, height: 46,
      child: FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF3A2E22), foregroundColor: ink), onPressed: onTap,
          child: Text(label, style: const TextStyle(fontSize: 15)))));
}

class _End extends StatelessWidget {
  final MatchScreenState screen;
  final MatchResult r;
  const _End(this.screen, this.r);
  @override
  Widget build(BuildContext context) => Container(color: const Color(0xAA000000), child: Center(child: _Box(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Text(r.won ? 'انتصار!' : 'هزيمة', style: TextStyle(color: r.won ? gold : const Color(0xFFE07060), fontSize: 26, fontWeight: FontWeight.w800)),
    const SizedBox(height: 6),
    Text(r.reason, style: const TextStyle(color: ink, fontSize: 14)),
    const SizedBox(height: 6),
    Text('المدة ${clock(r.duration)} • أكبر عدد أحياء ${r.maxDistricts} • أسقطت ${r.kills} • خسرت ${r.losses}',
        style: const TextStyle(color: dim, fontSize: 12)),
    const SizedBox(height: 10),
    _Wide('مباراة جديدة', screen.restart),
    _Wide('القائمة الرئيسية', () => Navigator.of(context).pop()),
  ]))));
}
