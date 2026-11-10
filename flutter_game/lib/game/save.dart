// حفظ المباراة الجارية والعودة إليها (js/matchSave.js، خانة واحدة): الخريطة تُعاد من بذرتها وإعدادها (المولّد نفسه
// يعطي الخريطة نفسها)، ثم يُكتب فوقها ما تغيّر: الوحدات بكل حقولها والأحياء والنقاط والطوابير والبوتات والمؤقتات.
// الإشارات (هدف الوحدة...) بأرقام الوحدات. والمتابعة لا تطابق المباراة الأصلية بالبت (كالحالية): مولّد كل وحدة يُبذر من جديد
import 'dart:convert';

import '../ai/empire_bot.dart' show BotMemo, botMemos;
import '../ai/squads.dart';
import '../core/fmath.dart';
import '../map/pathfinding.dart';
import 'empire.dart';
import 'match.dart';
import 'modes.dart';
import 'police.dart';
import 'realism.dart';
import 'state.dart';

typedef _F<T> = (T Function(Unit), void Function(Unit, T));

// حقول الوحدة البسيطة بأسمائها (ما لا يُذكر هنا يُحسب من جديد أو للرسم وحده)
final Map<String, _F<double>> _ud = {
  'x': ((u) => u.x, (u, v) => u.x = v), 'y': ((u) => u.y, (u, v) => u.y = v),
  'hp': ((u) => u.hp, (u, v) => u.hp = v), 'maxHp': ((u) => u.maxHp, (u, v) => u.maxHp = v),
  'attackCooldown': ((u) => u.attackCooldown, (u, v) => u.attackCooldown = v),
  'attackRate': ((u) => u.attackRate, (u, v) => u.attackRate = v),
  'repathTimer': ((u) => u.repathTimer, (u, v) => u.repathTimer = v),
  'deathTimer': ((u) => u.deathTimer, (u, v) => u.deathTimer = v),
  'comboTime': ((u) => u.comboTime, (u, v) => u.comboTime = v),
  'ultCharge': ((u) => u.ultCharge, (u, v) => u.ultCharge = v),
  'whistleAt': ((u) => u.whistleAt, (u, v) => u.whistleAt = v),
  'ultRate': ((u) => u.ultRate, (u, v) => u.ultRate = v),
  'damageTaken': ((u) => u.damageTaken, (u, v) => u.damageTaken = v),
  'invulnUntil': ((u) => u.invulnUntil, (u, v) => u.invulnUntil = v),
  'buffUntil': ((u) => u.buffUntil, (u, v) => u.buffUntil = v),
  'buffDamage': ((u) => u.buffDamage, (u, v) => u.buffDamage = v),
  'buffAttackSpeed': ((u) => u.buffAttackSpeed, (u, v) => u.buffAttackSpeed = v),
  'slowUntil': ((u) => u.slowUntil, (u, v) => u.slowUntil = v),
  'slowFactor': ((u) => u.slowFactor, (u, v) => u.slowFactor = v),
  'steadyUntil': ((u) => u.steadyUntil, (u, v) => u.steadyUntil = v),
  'awayUntil': ((u) => u.awayUntil, (u, v) => u.awayUntil = v),
  'lastSwingAt': ((u) => u.lastSwingAt, (u, v) => u.lastSwingAt = v),
  'holdUntil': ((u) => u.holdUntil, (u, v) => u.holdUntil = v),
  'bribedUntil': ((u) => u.bribedUntil, (u, v) => u.bribedUntil = v),
  'hasteUntil': ((u) => u.hasteUntil, (u, v) => u.hasteUntil = v),
  'rallyUntil': ((u) => u.rallyUntil, (u, v) => u.rallyUntil = v),
  'hasteFactor': ((u) => u.hasteFactor, (u, v) => u.hasteFactor = v),
  'leash': ((u) => u.leash, (u, v) => u.leash = v),
  'barY': ((u) => u.barY, (u, v) => u.barY = v),
  'expireAt': ((u) => u.expireAt, (u, v) => u.expireAt = v),
  'trampleAt': ((u) => u.trampleAt, (u, v) => u.trampleAt = v),
  'vanishAt': ((u) => u.vanishAt, (u, v) => u.vanishAt = v),
  'takenMul': ((u) => u.takenMul, (u, v) => u.takenMul = v),
  'damageMultiplier': ((u) => u.damageMultiplier, (u, v) => u.damageMultiplier = v),
  'kiteAt': ((u) => u.kiteAt, (u, v) => u.kiteAt = v),
  'ultHeldSince': ((u) => u.ultHeldSince, (u, v) => u.ultHeldSince = v),
  'fadeAt': ((u) => u.fadeAt, (u, v) => u.fadeAt = v),
  'waveFactor': ((u) => u.waveFactor, (u, v) => u.waveFactor = v),
  'faceAngle': ((u) => u.faceAngle, (u, v) => u.faceAngle = v),
  'cTimer': ((u) => u.cTimer, (u, v) => u.cTimer = v),
  'cMoveT': ((u) => u.cMoveT, (u, v) => u.cMoveT = v),
  'stamina': ((u) => u.stamina, (u, v) => u.stamina = v),
  'dodgeCd': ((u) => u.dodgeCd, (u, v) => u.dodgeCd = v),
  'vx': ((u) => u.vx, (u, v) => u.vx = v), 'vy': ((u) => u.vy, (u, v) => u.vy = v),
  'dvx': ((u) => u.dvx, (u, v) => u.dvx = v), 'dvy': ((u) => u.dvy, (u, v) => u.dvy = v),
  'bumpCd': ((u) => u.bumpCd, (u, v) => u.bumpCd = v),
  'flinch': ((u) => u.flinch, (u, v) => u.flinch = v),
  'chainAt': ((u) => u.chainAt, (u, v) => u.chainAt = v),
  'approachAt': ((u) => u.approachAt, (u, v) => u.approachAt = v),
  'approachSince': ((u) => u.approachSince, (u, v) => u.approachSince = v),
};
final Map<String, _F<int>> _ui = {
  'facing': ((u) => u.facing, (u, v) => u.facing = v), 'orderSeq': ((u) => u.orderSeq, (u, v) => u.orderSeq = v),
  'comboStacks': ((u) => u.comboStacks, (u, v) => u.comboStacks = v), 'brothers': ((u) => u.brothers, (u, v) => u.brothers = v),
  'bribedBy': ((u) => u.bribedBy, (u, v) => u.bribedBy = v), 'stationId': ((u) => u.stationId, (u, v) => u.stationId = v),
  'villageId': ((u) => u.villageId, (u, v) => u.villageId = v), 'garrisonOf': ((u) => u.garrisonOf, (u, v) => u.garrisonOf = v),
  'raidFrom': ((u) => u.raidFrom, (u, v) => u.raidFrom = v), 'gatherRally': ((u) => u.gatherRally, (u, v) => u.gatherRally = v),
  'lastHitBy': ((u) => u.lastHitBy, (u, v) => u.lastHitBy = v), 'wave': ((u) => u.wave, (u, v) => u.wave = v),
  'group': ((u) => u.group, (u, v) => u.group = v),
};
final Map<String, _F<bool>> _ub = {
  'selected': ((u) => u.selected, (u, v) => u.selected = v), 'awaitingPath': ((u) => u.awaitingPath, (u, v) => u.awaitingPath = v),
  'commandedTarget': ((u) => u.commandedTarget, (u, v) => u.commandedTarget = v),
  'ultAnnounced': ((u) => u.ultAnnounced, (u, v) => u.ultAnnounced = v), 'harmless': ((u) => u.harmless, (u, v) => u.harmless = v),
  'cargo': ((u) => u.cargo, (u, v) => u.cargo = v), 'hardened': ((u) => u.hardened, (u, v) => u.hardened = v),
  'leaderPaid': ((u) => u.leaderPaid, (u, v) => u.leaderPaid = v), 'riot': ((u) => u.riot, (u, v) => u.riot = v),
  'boss': ((u) => u.boss, (u, v) => u.boss = v), 'alwaysBlock': ((u) => u.alwaysBlock, (u, v) => u.alwaysBlock = v),
  'focusHeroes': ((u) => u.focusHeroes, (u, v) => u.focusHeroes = v), 'flinchBack': ((u) => u.flinchBack, (u, v) => u.flinchBack = v),
  'combo': ((u) => u.combo, (u, v) => u.combo = v), 'rolling': ((u) => u.rolling, (u, v) => u.rolling = v),
  'deathFront': ((u) => u.deathFront, (u, v) => u.deathFront = v),
};
final Map<String, _F<String?>> _us = {
  'state': ((u) => u.state, (u, v) => u.state = v!), 'recruitKind': ((u) => u.recruitKind, (u, v) => u.recruitKind = v),
  'lookKind': ((u) => u.lookKind, (u, v) => u.lookKind = v), 'creature': ((u) => u.creature, (u, v) => u.creature = v),
  'artColor': ((u) => u.artColor, (u, v) => u.artColor = v), 'cState': ((u) => u.cState, (u, v) => u.cState = v),
  'cMove': ((u) => u.cMove, (u, v) => u.cMove = v), 'dodgeType': ((u) => u.dodgeType, (u, v) => u.dodgeType = v!),
  'lod': ((u) => u.lod, (u, v) => u.lod = v!), 'cNode': ((u) => u.cNode, (u, v) => u.cNode = v),
};

double? _n(Object? v) => (v as num?)?.toDouble();
List<double> _pt(Point2 p) => [p.x, p.y];
Point2? _p(Object? v) => v == null ? null : Point2(_n((v as List)[0])!, _n(v[1])!);

Map<String, Object?> _unit(Unit u) => {
  'id': u.id, 'pid': u.playerId, 'gang': u.gang, 'nation': u.nation, 'color': u.color, 'hero': u.hero, 'champion': u.champion,
  'name': u.name, 'stats': u.stats,
  for (final e in _ud.entries) e.key: e.value.$1(u),
  for (final e in _ui.entries) e.key: e.value.$1(u),
  for (final e in _ub.entries) e.key: e.value.$1(u),
  for (final e in _us.entries) e.key: e.value.$1(u),
  'path': [for (final (i, j) in u.path) [i, j]],
  'flow': u.flow == null ? null : [u.flow!.target.$1, u.flow!.target.$2],
  'attackMove': u.attackMove == null ? null : [u.attackMove!.i, u.attackMove!.j],
  'target': u.target?.id, 'comboTarget': u.comboTarget?.id, 'healingTarget': u.healingTarget?.id,
  'chaseOrigin': _pt(u.chaseOrigin), 'homePost': u.homePost == null ? null : _pt(u.homePost!),
  'attackStart': u.attackStart, 'ultStart': u.ultStart, 'artScale': u.artScale,
  'pendingHit': u.pendingHit == null ? null : {'t': u.pendingHit!.target.id, 'm': u.pendingHit!.move, 'r': u.pendingHit!.range,
    'd': u.pendingHit!.damage, 'g': u.pendingHit!.ranged, 'a': u.pendingHit!.at},
  'pendingUlt': u.pendingUlt == null ? null : {'t': u.pendingUlt!.target.id, 'a': u.pendingUlt!.at},
  'flurry': u.flurry == null ? null : [u.flurry!.target?.id, u.flurry!.left, u.flurry!.damage, u.flurry!.interval, u.flurry!.next, u.flurry!.radius],
  'phases': u.cPhases == null ? null : [u.cPhases!.wind, u.cPhases!.strike, u.cPhases!.hold, u.cPhases!.rec, u.cPhases!.total],
  'traits': [u.traits.aggr, u.traits.skill, u.traits.react, u.traits.spd, u.traits.size],
  'feat': [u.patrol, u.blackKnight, u.fan, _exit(u.dancer), _exit(u.lair), _exit(u.caravanExit)],
  'task': u.botTask == null ? null : [u.botTask!.type, u.botTask!.squadId, u.botTask!.districtId, u.botTask!.until,
    u.botTask!.leader?.id, u.botTask!.point?.x, u.botTask!.point?.y],
};

// --- الحفظ ---
// ارفعه إذا تغيّر شكل الحفظ (كـ UI.matchVersion في اللعبة الحالية)
const saveVersion = 3;
String encodeMatch(MatchState s) {
  final e = s.empire;
  return jsonEncode({
    'v': saveVersion, 'seed': s.seed, 'settings': s.settings, 'rng': simRng.state,
    'time': s.time, 'nextUnitId': s.nextUnitId, 'combatSeed': s.combatSeed, 'rolling': s.rollingCorpses,
    'events': s.combatEvents, 'kills': s.stats.kills, 'losses': s.stats.losses, 'maxDistricts': s.stats.maxDistricts,
    'spawn': s.spawnTimers, 'hero': s.heroTimers, 'heroTurn': s.heroTurn, 'champ': s.championTimers, 'bot': s.botTimers,
    'police': {for (final e in s.policeTimers.entries) '${e.key}': [e.value.produce, e.value.captain]},
    'camera': [s.camera.x, s.camera.y, s.camera.z], 'empireHinted': s.empireHinted,
    'players': [for (final p in s.players) [p.friendOf, p.fallen]],
    'districts': [for (final d in s.map.districts) {
      'o': d.owner, 'p': d.progress, 'po': d.progressOwner, 'tc': d.tintColor, 'tm': d.tintMix, 'f': d.fort, 'b': d.building,
      'bt': d.buildTile, 'blv': d.blv, 'cool': d.cool, 'rally': d.rally == null ? null : [d.rally!.k, d.rally!.owner],
      'pd': d.policeDisabled,
      'fx': [d.taxed, d.readyAt, d.mineSince, d.mineRate, d.vault, d.nextAt, d.rangAt, d.mineOwner, d.bankOwner, d.produced,
        d.villageJoined, d.garrisonOff, d.cool],
    }],
    'units': [for (final u in s.units) _unit(u)],
    'shots': [for (final p in s.projectiles) {
      'k': p.kind, 'a': p.attacker.id, 't': p.target?.id, 'd': p.damage, 'dg': p.dodgeable, 'fi': p.fire, 'h': p.hits,
      'mx': p.missX, 'my': p.missY, 'sx': p.startX, 'sy': p.startY, 'x': p.x, 'y': p.y, 'tt': p.t, 'du': p.duration,
      'r': p.returns, 'b': p.back, 'ar': p.area,
    }],
    'fires': [for (final f in s.fires) [f.playerId, f.x, f.y, f.radius, f.damagePerSecond, f.life]],
    'zones': [for (final z in s.zones) [z.kind, z.x, z.y, z.radius, z.until, z.playerId, z.color]],
    'queue': [for (final r in s.pathQueue) [r.unit.id, r.i, r.j, r.seq]],
    'empire': e == null ? null : {
      'points': e.points, 'earned': e.earned, 'bounties': e.bounties,
      'levels': [for (final l in e.levels) [l.hp, l.damage, l.armor, l.speed]],
      'queues': {for (final q in e.queues.entries) '${q.key}': [for (final it in q.value) [it.kind, it.payer, it.t]]},
      'shots': [for (final t in e.shots) [t.owner, t.target.id, t.i, t.j, t.t, t.duration, t.damage, t.top]],
      'incomeMul': e.incomeMul,
      'memo': {for (final m in botMemos(e).entries) '${m.key}': [m.value.turn, m.value.units, m.value.tech]},
    },
    'mode': _modeJson(modeOf(s)),
    'hints': [s.featureHinted, s.buildingHinted, s.eventHinted],
    'fireworks': [for (final f in s.fireworks) [f.x, f.y, f.at, f.done, f.owner]],
    'event': _eventJson(s.cityEvent),
    'brains': {for (final b in s.botBrains.entries) '${b.key}': {
      'n': b.value.nextId, 'r': b.value.rallyId,
      's': [for (final q in b.value.squads) {'id': q.id, 'ty': q.type, 'u': q.units, 't': q.targetId, 'p': q.power, 'ph': q.phase,
        'st': q.stage == null ? null : _pt(q.stage!), 'sa': q.stagedAt}],
    }},
  });
}

// معلومات خانة المتابعة في القائمة الرئيسية (بلا فك الحفظ كله)
Map<String, Object?> saveInfo(MatchState s) => {'city': s.map.city, 'time': s.time, 'mode': s.mode, 'size': s.settings['mapSize']};

// --- المتابعة ---
MatchState decodeMatch(String text) {
  final j = (jsonDecode(text) as Map).cast<String, Object?>();
  if (j['v'] != saveVersion) throw const FormatException('حفظ بنسخة أخرى');
  simRng = Rng(j['seed'] as int);
  final s = createMatch((j['settings'] as Map).cast<String, Object?>())..seed = j['seed'] as int;
  simRng.state = j['rng'] as int;
  s.time = _n(j['time'])!;
  s.nextUnitId = j['nextUnitId'] as int;
  s.combatSeed = j['combatSeed'] as int;
  s.rollingCorpses = j['rolling'] as int;
  (j['events'] as Map).forEach((k, v) => s.combatEvents['$k'] = v as int);
  for (var k = 0; k < s.players.length; k++) {
    s.stats.kills[k] = (j['kills'] as List)[k] as int;
    s.stats.losses[k] = (j['losses'] as List)[k] as int;
    final p = (j['players'] as List)[k] as List;
    s.players[k].friendOf = p[0] as int?;
    s.players[k].fallen = p[1] == true;
  }
  s.stats.maxDistricts = j['maxDistricts'] as int;
  s.spawnTimers = [for (final v in j['spawn'] as List) _n(v)!];
  s.heroTimers = [for (final v in j['hero'] as List) _n(v)!];
  s.heroTurn = [for (final v in j['heroTurn'] as List) v as int];
  s.championTimers = [for (final v in j['champ'] as List) _n(v)];
  s.botTimers = [for (final v in j['bot'] as List) _n(v)!];
  s.policeTimers.clear();
  (j['police'] as Map).forEach((k, v) => s.policeTimers[int.parse('$k')] = PoliceTimer(_n((v as List)[0])!, _n(v[1])!));
  final cam = j['camera'] as List;
  s.camera..x = _n(cam[0])!..y = _n(cam[1])!..z = _n(cam[2])!;
  s.empireHinted = j['empireHinted'] == true;
  final dl = j['districts'] as List;
  for (var k = 0; k < s.map.districts.length; k++) {
    final d = s.map.districts[k], x = (dl[k] as Map).cast<String, Object?>();
    d.owner = x['o'] as int?; d.progress = _n(x['p'])!; d.progressOwner = x['po'] as int?;
    d.tintColor = x['tc'] as String?; d.tintMix = _n(x['tm'])!; d.fort = x['f'] as int; d.building = x['b'] as String?;
    d.buildTile = x['bt'] as int?; d.blv = (x['blv'] as Map).cast<String, int>(); d.cool = _n(x['cool'])!;
    final r = x['rally'] as List?;
    d.rally = r == null ? null : (k: r[0] as int, owner: r[1] as int);
    d.policeDisabled = x['pd'] == true;
    final fx = x['fx'] as List;
    d..taxed = _n(fx[0])!..readyAt = _n(fx[1])!..mineSince = _n(fx[2])!..mineRate = _n(fx[3])!..vault = _n(fx[4])!..nextAt = _n(fx[5])!
      ..rangAt = _n(fx[6])!..mineOwner = (fx[7] as int?)..bankOwner = (fx[8] as int?)..produced = fx[9] as int..villageJoined = fx[10] == true
      ..garrisonOff = fx[11] == true..cool = _n(fx[12])!;
    // المباني التي بُنيت أثناء المباراة: حرفها في الخريطة (القواعد المنزلية من المولّد نفسه)
    if (d.building != null && d.buildTile != null) s.map.type[d.buildTile!] = BUILDING_TILE[d.building]!;
  }
  // الوحدات: كائنات جديدة، ثم الإشارات بأرقامها
  final byId = <int, Unit>{}, raw = <Unit, Map<String, Object?>>{};
  final flows = <String, FlowField?>{};
  s.units = [];
  for (final o in j['units'] as List) {
    final x = (o as Map).cast<String, Object?>();
    final u = Unit(id: x['id'] as int, playerId: x['pid'] as int, gang: x['gang'] as String, nation: x['nation'] as String?,
        color: x['color'] as String, hero: x['hero'] as String?, champion: x['champion'] == true, name: x['name'] as String,
        x: _n(x['x'])!, y: _n(x['y'])!, stats: (x['stats'] as Map).cast<String, Object?>());
    _ud.forEach((k, f) => f.$2(u, _n(x[k])!));
    _ui.forEach((k, f) => f.$2(u, x[k] as int));
    _ub.forEach((k, f) => f.$2(u, x[k] == true));
    _us.forEach((k, f) => f.$2(u, x[k] as String?));
    u.prevX = u.x; u.prevY = u.y;
    u.path = [for (final p in x['path'] as List) ((p as List)[0] as int, p[1] as int)];
    final fl = x['flow'] as List?;
    if (fl != null) u.flow = flows['${fl[0]},${fl[1]}'] ??= buildFlowField(s.map, fl[0] as int, fl[1] as int);
    final am = x['attackMove'] as List?;
    u.attackMove = am == null ? null : (i: am[0] as int, j: am[1] as int);
    u.chaseOrigin = _p(x['chaseOrigin'])!;
    u.homePost = _p(x['homePost']);
    u.attackStart = _n(x['attackStart']); u.ultStart = _n(x['ultStart']); u.artScale = _n(x['artScale']);
    final ph = x['phases'] as List?;
    u.cPhases = ph == null ? null : Phases(_n(ph[0])!, _n(ph[1])!, _n(ph[2])!, _n(ph[3])!, _n(ph[4])!);
    final t = x['traits'] as List;
    restoreRealism(s, u, Traits(_n(t[0])!, _n(t[1])!, _n(t[2])!, _n(t[3])!, _n(t[4])!));
    final ft = x['feat'] as List;
    u..patrol = ft[0] == true..blackKnight = ft[1] == true..fan = ft[2] == true..dancer = _exitBack(ft[3])..lair = _exitBack(ft[4])
      ..caravanExit = _exitBack(ft[5]);
    if (u.riot) { final st = u.style; u.style = FightStyleInfo(st.turn, st.flank, st.moves, true, st.primary); }
    byId[u.id] = u;
    raw[u] = x;
    s.units.add(u);
  }
  for (final u in s.units) {
    final x = raw[u]!;
    u.target = byId[x['target']];
    u.comboTarget = byId[x['comboTarget']];
    u.healingTarget = byId[x['healingTarget']];
    final h = x['pendingHit'] as Map?;
    if (h != null && byId[h['t']] != null) {
      u.pendingHit = PendingHit(target: byId[h['t']]!, move: h['m'] as String?, range: _n(h['r'])!, damage: _n(h['d'])!,
          ranged: h['g'] == true, at: _n(h['a'])!);
    }
    final pu = x['pendingUlt'] as Map?;
    if (pu != null && byId[pu['t']] != null) u.pendingUlt = PendingUlt(byId[pu['t']]!, _n(pu['a'])!);
    final task = x['task'] as List?;
    u.botTask = task == null ? null : BotTask(task[0] as String, squadId: task[1] as int, districtId: task[2] as int, until: _n(task[3])!,
        leader: task.length > 4 ? byId[task[4]] : null, point: task.length > 6 && task[5] != null ? Point2(_n(task[5])!, _n(task[6])!) : null);
    final f = x['flurry'] as List?;
    if (f != null) u.flurry = Flurry(byId[f[0]], f[1] as int, _n(f[2])!, _n(f[3])!, _n(f[4])!, _n(f[5])!);
  }
  s.projectiles = [
    for (final o in j['shots'] as List)
      if (byId[(o as Map)['a']] != null)
        Projectile(kind: o['k'] as String?, attacker: byId[o['a']]!, target: byId[o['t']], damage: _n(o['d'])!, dodgeable: o['dg'] == true,
            fire: (o['fi'] as Map?)?.cast<String, Object?>(), hits: o['h'] == true, missX: _n(o['mx'])!, missY: _n(o['my'])!,
            startX: _n(o['sx'])!, startY: _n(o['sy'])!, duration: _n(o['du'])!, returns: o['r'] == true, back: o['b'] == true, area: _n(o['ar'])!)
          ..x = _n(o['x'])!..y = _n(o['y'])!..prevX = _n(o['x'])!..prevY = _n(o['y'])!..t = _n(o['tt'])!..prevT = _n(o['tt'])!,
  ];
  s.fires = [for (final f in j['fires'] as List) Fire((f as List)[0] as int, _n(f[1])!, _n(f[2])!, _n(f[3])!, _n(f[4])!, _n(f[5])!)];
  s.zones = [for (final z in j['zones'] as List) Zone((z as List)[0] as String, _n(z[1])!, _n(z[2])!, _n(z[3])!, _n(z[4])!, z[5] as int, z[6] as String)];
  s.pathQueue = [for (final r in j['queue'] as List) if (byId[(r as List)[0]] != null) PathRequest(byId[r[0]]!, r[1] as int, r[2] as int, r[3] as int)];
  final em = (j['empire'] as Map?)?.cast<String, Object?>(), e = s.empire;
  if (em != null && e != null) {
    for (var k = 0; k < e.points.length; k++) {
      e.points[k] = _n((em['points'] as List)[k])!;
      e.earned[k] = _n((em['earned'] as List)[k])!;
      e.bounties[k] = (em['bounties'] as List)[k] as int;
      final l = (em['levels'] as List)[k] as List;
      e.levels[k]..hp = l[0] as int..damage = l[1] as int..armor = l[2] as int..speed = l[3] as int;
    }
    e.queues.clear();
    (em['queues'] as Map).forEach((k, v) => e.queues[int.parse('$k')] = [for (final it in v as List) QueueItem((it as List)[0] as String, it[1] as int)..t = _n(it[2])!]);
    e.shots = [for (final t in em['shots'] as List) if (byId[(t as List)[1]] != null) TowerShot(t[0] as int, byId[t[1]]!, _n(t[2])!, _n(t[3])!, _n(t[5])!, _n(t[6])!, t.length > 7 ? _n(t[7])! : 0)..t = _n(t[4])!];
    e.incomeMul = _n(em['incomeMul'])!;
    final memos = botMemos(e);
    (em['memo'] as Map).forEach((k, v) => memos[int.parse('$k')] = BotMemo()..turn = (v as List)[0] as int..units = _n(v[1])!..tech = _n(v[2])!);
  }
  s.botBrains.clear();
  (j['brains'] as Map).forEach((k, v) {
    final b = Brain(int.parse('$k'))..nextId = (v as Map)['n'] as int..rallyId = v['r'] as int;
    b.squads = [for (final q in v['s'] as List) Squad((q as Map)['id'] as int, q['ty'] as String, [for (final x in q['u'] as List) x as int], q['t'] as int)
      ..power = _n(q['p'])!..phase = (q['ph'] as String?)..stage = _p(q['st'])..stagedAt = _n(q['sa'])!];
    s.botBrains[b.playerId] = b;
  });
  _modeBack(modeOf(s), (j['mode'] as Map).cast<String, Object?>());
  final h = j['hints'] as List;
  s..featureHinted = h[0] == true..buildingHinted = h[1] == true..eventHinted = h[2] == true;
  s.fireworks = [for (final f in j['fireworks'] as List) Firework(_n((f as List)[0])!, _n(f[1])!, f[2] as int, f[4] as int?)..done = f[3] == true];
  s.cityEvent = _eventBack(j['event'] as Map?);
  s.mapVersion++;
  return s;
}

Map<String, Object?> _modeJson(ModeState m) => {
  'du': m.duration, 'fa': m.finalAnnounced, 'hi': m.hillId, 'ta': m.target, 'he': m.held, 'wa': m.warned.toList(), 'bl': m.blocked,
  'lk': m.leaderKills, 'lh': m.lastHp, 'aa': m.alertAt, 'lv': m.level, 'wv': m.wave, 'nw': m.nextWaveAt, 'rt': m.retargetAt,
};

void _modeBack(ModeState m, Map<String, Object?> j) {
  m..duration = _n(j['du'])!..finalAnnounced = j['fa'] == true..hillId = j['hi'] as int..target = _n(j['ta'])!
    ..held = [for (final v in j['he'] as List) _n(v)!]..warned = {for (final v in j['wa'] as List) v as String}..blocked = j['bl'] == true
    ..leaderKills = j['lk'] as int..lastHp = _n(j['lh'])..alertAt = _n(j['aa'])!..level = j['lv'] as String..wave = j['wv'] as int
    ..nextWaveAt = _n(j['nw'])!..retargetAt = _n(j['rt'])!;
}

List<double>? _exit(Exit? e) => e == null ? null : [e.i, e.j, e.until];
Exit? _exitBack(Object? v) => v == null ? null : Exit(_n((v as List)[0])!, _n(v[1])!, _n(v[2])!);

Map<String, Object?>? _eventJson(CityEventState? e) => e == null ? null : {
  'band': e.band == null ? null : [e.band!.axis, e.band!.c, e.band!.dir, e.band!.on],
  'chest': e.chest == null ? null : [e.chest!.i, e.chest!.j, e.chest!.until, e.chest!.holder, e.chest!.since],
  'bolts': [for (final b in e.bolts) [b.x, b.y, b.at, b.done]],
  'quake': e.quake == null ? null : [e.quake!.x, e.quake!.y, e.quake!.on],
  'wind': e.wind == null ? null : [e.wind!.dx, e.wind!.dy, e.wind!.on],
  'clouds': _cloudsJson(e.clouds), 'ash': _cloudsJson(e.ash),
  'silver': e.silver == null ? null : [[for (final p in e.silver!.pieces) [p.$1, p.$2]], e.silver!.until],
  'dancers': e.dancers == null ? null : [for (final d in e.dancers!) [d.$1, d.$2]],
  'derby': e.derby == null ? null : [e.derby!.x, e.derby!.y, e.derby!.on],
  'fire': e.fire?.burning,
};
Object? _cloudsJson(Clouds? c) => c == null ? null : [[for (final x in c.list) [x.x, x.y, x.r, x.hue]], c.on];
Clouds? _cloudsBack(Object? v) => v == null ? null
    : (Clouds([for (final x in (v as List)[0] as List) Cloud(_n((x as List)[0])!, _n(x[1])!, _n(x[2])!, x[3] as int)])..on = v[1] == true);

CityEventState? _eventBack(Map? j) {
  if (j == null) return null;
  final e = CityEventState();
  final b = j['band'] as List?;
  if (b != null) e.band = Band(b[0] as String, _n(b[1])!, b[2] as int)..on = b[3] == true;
  final c = j['chest'] as List?;
  if (c != null) e.chest = Chest(c[0] as int, c[1] as int, _n(c[2])!)..holder = c[3] as int..since = _n(c[4])!;
  e.bolts = [for (final x in j['bolts'] as List) Bolt(_n((x as List)[0])!, _n(x[1])!, x[2] as int)..done = x[3] == true];
  final q = j['quake'] as List?;
  if (q != null) e.quake = Spot(_n(q[0])!, _n(q[1])!)..on = q[2] == true;
  final w = j['wind'] as List?;
  if (w != null) e.wind = Wind(w[0] as int, w[1] as int)..on = w[2] == true;
  e.clouds = _cloudsBack(j['clouds']);
  e.ash = _cloudsBack(j['ash']);
  final sv = j['silver'] as List?;
  if (sv != null) e.silver = Silver([for (final p in sv[0] as List) ((p as List)[0] as int, p[1] as int)], _n(sv[1])!);
  final dn = j['dancers'] as List?;
  if (dn != null) e.dancers = [for (final p in dn) (_n((p as List)[0])!, _n(p[1])!)];
  final dy = j['derby'] as List?;
  if (dy != null) e.derby = Derby(_n(dy[0])!, _n(dy[1])!)..on = dy[2] == true;
  final f = j['fire'] as List?;
  if (f != null) e.fire = CityFire([for (final x in f) x as int]);
  return e;
}
