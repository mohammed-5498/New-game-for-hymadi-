// الجرعات (2.21.0، بطلب المستخدم، GAME_SPEC 18.25): أثر الجرعة في المباراة. تُستعمل بأمر 'potion' من الاقتصاد (empireCommand)
// فيُنفذ في التحديث نفسه عند كل الأجهزة في اللعب المحلي، والأثر من state.time وحده (بلا عشوائية). وكل لاعب يستعمل الجرعة الواحدة
// مرة في المباراة. الأرقام في POTIONS (lib/config.dart)، والمحفظة والخانات في lib/ui/wallet.dart، والمتجر في menus.dart
import 'dart:math' as math;

import '../config.dart' show POTIONS, Potion;
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../map/generator.dart' show District;
import '../map/pathfinding.dart' show findFreeTiles;
import '../audio/sound.dart' show soundAt;
import 'empire.dart' show Result, applyUpgrades, heroFor;
import 'features.dart' show addRocket, expireTemporary, updateRockets;
import 'realism.dart' show addUltFx;
import 'state.dart';
import 'ults.dart' show hasUlt;
import 'units.dart' show createUnit;

const POTION_NAMES = {
  'strength': 'جرعة القوة', 'iron': 'جرعة الصلابة', 'swift': 'جرعة الخفة', 'heal': 'جرعة العلاج', 'pouch': 'كيس النقاط',
  'rush': 'الإنتاج السريع', 'income': 'الدخل المضاعف', 'banner': 'راية الاستيلاء', 'bribe': 'رشوة الشرطة',
  'warcry': 'صيحة الحرب', 'reinforce': 'التعزيزات', 'rocket': 'الضربة الصاروخية', 'shield': 'الدرع الذهبي',
};

// ما تفعله الجرعة بأرقامها (في المتجر وإشعار استعمالها)
String potionDesc(String id) {
  final p = POTIONS.list[id]!, pct = (p.value * 100).round(), s = p.seconds.round(), v = p.value.round();
  return switch (id) {
    'strength' => 'ضرر كل جنودك +$pct% لمدة $s ثانية',
    'iron' => 'الضرر الذي يصيب جنودك أقل $pct% لمدة $s ثانية',
    'swift' => 'مشي جنودك أسرع $pct% لمدة $s ثانية',
    'heal' => 'كل جنودك يستعيدون $pct% من دمهم فوراً',
    'pouch' => '+$v نقطة فوراً',
    'rush' => 'قواعدك تنتج الجنود أسرع ${v}x لمدة $s ثانية',
    'income' => 'دخل أحيائك من النقاط ×$v لمدة $s ثانية',
    'banner' => 'جنودك يستولون على الأحياء أسرع ${v}x لمدة $s ثانية',
    'bribe' => 'الشرطة لا تهاجم جنودك لمدة $s ثانية',
    'warcry' => 'تمتلئ الضربة الخاصة لكل أبطالك ومميزيك فوراً، وجنودك +$pct% ضرراً $s ثوانٍ',
    'reinforce' => '$v مقاتلين من عصابتك يظهرون عند قاعدتك ويقاتلون معك $s ثانية ثم يرحلون',
    'rocket' => 'تلمس حياً فيسقط عليه صاروخ بعد $s ثوانٍ يصيب كل عدو حوله بـ $v ضرراً',
    'shield' => 'جنودك لا يتلقون أي ضرر لمدة $s ثوانٍ',
    _ => '',
  };
}

class PotionState {
  final List<Map<String, double>> until;   // لكل لاعب: الجرعة ← نهاية أثرها
  final List<Set<String>> used;            // لكل لاعب: ما استعمله في هذه المباراة
  bool temporary = false;                  // في المباراة مقاتلو تعزيزات يرحلون (expireAt)
  PotionState(int players)
      : until = [for (var k = 0; k < players; k++) <String, double>{}], used = [for (var k = 0; k < players; k++) <String>{}];
  bool on(int pid, String id, double time) => pid >= 0 && pid < until.length && (until[pid][id] ?? -1) > time;
  double left(int pid, String id, double time) => pid >= 0 && pid < until.length ? math.max(0, (until[pid][id] ?? 0) - time) : 0;

  Map<String, Object?> toJson() => {'until': until, 'used': [for (final u in used) u.toList()], 'temporary': temporary};
  static PotionState? fromJson(Object? j, int players) {
    if (j is! Map) return null;
    final st = PotionState(players)..temporary = j['temporary'] == true;
    final u = j['until'], d = j['used'];
    for (var k = 0; k < players; k++) {
      if (u is List && k < u.length && u[k] is Map) {
        for (final e in (u[k] as Map).entries) { if (e.value is num) st.until[k]['${e.key}'] = (e.value as num).toDouble(); }
      }
      if (d is List && k < d.length && d[k] is List) st.used[k].addAll((d[k] as List).whereType<String>());
    }
    return st;
  }
}

double _v(String id) => POTIONS.list[id]!.value;

// --- ما يغيّره أثرها (null في المباراة التي لم تُستعمل فيها جرعة، فلا كلفة) ---
double potionDamage(MatchState s, int pid) {   // يُضاف إلى مضاعف الضرر (abilities.dart)
  final p = s.potions;
  if (p == null) return 0;
  return (p.on(pid, 'strength', s.time) ? _v('strength') : 0) + (p.on(pid, 'warcry', s.time) ? _v('warcry') : 0);
}
double potionTaken(MatchState s, int pid) => s.potions?.on(pid, 'iron', s.time) == true ? 1 - _v('iron') : 1;
double potionSpeed(MatchState s, int pid) => s.potions?.on(pid, 'swift', s.time) == true ? 1 + _v('swift') : 1;
double potionRush(MatchState s, int pid) => s.potions?.on(pid, 'rush', s.time) == true ? _v('rush') : 1;   // زمن الإنتاج ÷
double potionIncome(MatchState s, int pid) => s.potions?.on(pid, 'income', s.time) == true ? _v('income') : 1;
double potionCapture(MatchState s, int pid) => s.potions?.on(pid, 'banner', s.time) == true ? _v('banner') : 1;
// رشوة الشرطة: الشرطة وصاحب الجرعة لا يتقاتلان (isEnemyId)
bool potionTruce(MatchState s, Player a, Player b) {
  final p = s.potions;
  if (p == null) return false;
  return (a.gang == 'police' && p.on(b.id, 'bribe', s.time)) || (b.gang == 'police' && p.on(a.id, 'bribe', s.time));
}

// لماذا لا تُستعمل الآن (null: تُستعمل)، وtarget الحي للصاروخ
String? potionBlocked(MatchState s, int pid, String id, [int target = -1]) {
  if (!s.economy || POTIONS.list[id] == null || pid < 0 || pid >= s.players.length) return '';
  if (s.potions?.used[pid].contains(id) ?? false) return 'استعملتها في هذه المباراة';
  if (id == 'rocket' && (target < 0 || target >= s.map.districts.length || s.map.districts[target].capture == null)) return 'المس حياً على الخريطة';
  return null;
}

Result usePotion(MatchState s, int pid, String id, int target) {
  final why = potionBlocked(s, pid, id, target);
  if (why != null) return Result(false, why);
  final P = POTIONS.list[id]!, st = s.potions ??= PotionState(s.players.length), t = s.time, player = s.players[pid];
  st.used[pid].add(id);
  if (P.seconds > 0) st.until[pid][id] = t + P.seconds;
  final mine = [for (final u in s.units) if (u.playerId == pid && u.state != 'dead' && u.hp > 0) u];
  switch (id) {
    case 'heal': for (final u in mine) { u.hp = math.min(u.maxHp, u.hp + u.maxHp * P.value); }
    case 'pouch': s.empire!.points[pid] += P.value;
    case 'warcry': for (final u in mine) { if (hasUlt(u)) u.ultCharge = ULT.d('max'); }
    case 'shield': for (final u in mine) { u.invulnUntil = math.max(u.invulnUntil, t + P.seconds); }
    case 'reinforce': _reinforce(s, player, P);
    case 'rocket': addRocket(s, pid, s.map.districts[target], P.seconds, P.value);
  }
  final c = _center(s, pid);
  if (c != null) soundAt(s, 'ult_cast', c.$1, c.$2);
  s.notice = pid == s.humanId
      ? Notice('${POTION_NAMES[id]} — ${potionDesc(id)}', true, 3)
      : Notice('${player.gangName} استعملوا ${POTION_NAMES[id]}', false, 3);
  return const Result(true, '');
}

// قاعدة اللاعب (أول قاعدة يملكها، أو حي بدايته)
(double, double)? _center(MatchState s, int pid) {
  District? hq;
  for (final d in s.map.districts) { if (d.owner == pid && d.building == 'hq' && d.capture != null) { hq = d; break; } }
  final home = s.players[pid].homeDistrictId;
  hq ??= home >= 0 && home < s.map.districts.length ? s.map.districts[home] : null;
  final c = hq?.capture;
  return c == null ? null : (c.i.toDouble(), c.j.toDouble());
}

// التعزيزات: نخبة عصابتك ومميزاها وفردان (POTIONS.reinforce) عند قاعدتك، يرحلون بعد seconds
void _reinforce(MatchState s, Player player, Potion P) {
  final c = _center(s, player.id);
  if (c == null) return;
  final kinds = POTIONS.reinforce.take(P.value.round()).toList();
  final spots = findFreeTiles(s.map, c.$1.round(), c.$2.round(), kinds.length);
  for (var k = 0; k < spots.length; k++) {
    final kind = kinds[k];
    final unit = createUnit(s, player, spots[k].$1, spots[k].$2, kind == null ? null : heroFor(player, kind));
    unit.expireAt = s.time + P.seconds;
    s.units.add(unit);
    applyUpgrades(s, unit);
  }
  s.potions!.temporary = true;
  addUltFx(s, 'dust', c.$1, c.$2);
}

// كل تحديث بعد أول جرعة: رحيل مقاتلي التعزيزات في موعدهم، وانفجار الصاروخ في كل مدينة
void updatePotions(MatchState s) {
  final st = s.potions!;
  if (st.temporary) expireTemporary(s);
  updateRockets(s);
}
