// إنشاء المباراة وتحديثها (js/state.js createMatch وjs/game/loop.js updateMatch وjs/ai/botBattle.js)
import '../ai/bot.dart';
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import 'abilities.dart';
import 'alerts.dart';
import 'capture.dart';
import 'combat.dart';
import 'features.dart';
import 'modes.dart';
import 'nations.dart';
import 'police.dart';
import 'spatial.dart';
import 'spawn.dart';
import 'story.dart';
import 'state.dart';
import 'units.dart';
import 'victory.dart';

String _colorHex(String? id, int index) {
  for (final c in PLAYER_COLORS) { if ((c as J)['id'] == id) return c.s('hex'); }
  return (PLAYER_COLORS[index] as J).s('hex');
}

MatchState createMatch(J settings) {
  final list = settings.l('players').cast<J>();
  final players = <Player>[
    for (var k = 0; k < list.length; k++)
      Player(id: k, name: list[k].s('name'), gang: list[k].s('gang'),
          nation: nationOf(list[k].ss('nation')) != null ? list[k].ss('nation') : null,
          gangName: list[k].ss('gangName') ?? sideName(list[k].s('gang'), list[k].ss('nation')),
          color: _colorHex(list[k].ss('color'), k), isHuman: list[k].b('isHuman'),
          team: (list[k]['team'] as num?)?.toInt() ?? 0, difficulty: list[k].ss('difficulty') ?? 'medium'),
  ];
  final economy = economyOf(settings);
  final map = createMap(settings.ss('mapSize') ?? 'medium', players, settings.ss('city') ?? 'random', simRng, specials: !economy, features: economy);
  if (map == null) throw StateError('تعذر توليد خريطة صالحة');
  final feature = economy ? cityFeature(map.city) : null;
  // الشرطة طرف محايد بعد الأحياء المنزلية، ثم طرف الميزة إن احتاجته
  players.add(createPolicePlayer(players));
  final featurePlayer = createFeaturePlayer(players, feature, map.city);
  if (featurePlayer != null) players.add(featurePlayer);
  players.addAll(createStoryPlayers(settings, players));
  final weather = settings.ss('weather');
  final state = MatchState(settings: settings, map: map, players: players,
      humanId: players.indexWhere((p) => p.isHuman),
      weather: weather != null && WEATHER.has(weather) ? weather : 'day',
      maxUnits: (settings['maxUnits'] as num).toInt(),
      combatSeed: ((random() * 4294967295).floor()) & 0xFFFFFFFF);
  state.camera.z = CAMERA.d('startZoom');
  state.feature = feature;
  state.stats = MatchStats(players.length);
  initMode(state);
  buildCaptureZones(state);
  buildTerritory(map);
  snapDistrictTints(state);
  _spawnStartingUnits(state);
  prepareModeUnits(state);
  initSpawnTimers(state);
  initPolice(state);
  initFeatures(state);
  initStory(state);
  initBots(state);
  centerCameraOnHome(state);
  return state;
}

void _spawnStartingUnits(MatchState state) {
  for (final player in state.players.toList()) {
    if (player.homeDistrictId < 0 || player.homeDistrictId >= state.map.districts.length) continue;
    final home = state.map.districts[player.homeDistrictId];
    final cap = home.capture;
    if (cap == null) continue;
    for (final (i, j) in findFreeTiles(state.map, cap.i, cap.j, UNITS.i('startUnits'))) {
      state.units.add(createUnit(state, player, i, j));
    }
    spawnChampion(state, player, home);
  }
}

void centerCameraOnHome(MatchState state) {
  final player = state.humanId >= 0 ? state.players[state.humanId] : state.players[0];
  final hd = player.homeDistrictId;
  final cap = hd >= 0 && hd < state.map.districts.length ? state.map.districts[hd].capture : null;
  final pi = cap != null ? cap.i.toDouble() : state.map.n / 2, pj = cap != null ? cap.j.toDouble() : state.map.n / 2;
  state.camera.x = (pi - pj) * TILE_HALF_W;
  state.camera.y = (pi + pj) * TILE_HALF_H;
  state.camera.z = CAMERA.d('startZoom');
}

// تحديث منطقي واحد بالترتيب نفسه (loop.js)
void updateMatch(MatchState state) {
  state.time += TICK_SEC;
  buildUnitHash(state);
  updateAbilities(state);
  updateCombat(state);
  processPathQueue(state);
  updateUnits(state);
  removeDeadUnits(state);
  updateCapture(state);
  updateDistrictTints(state);
  updateSpawn(state);
  updatePolice(state);
  updateFeatures(state);
  updateBots(state);
  updateMode(state);
  updateFades(state);
  updateStory(state);
  updateVictory(state);
  updateNotice(state);
  updateAlerts(state);
  final mm = state.moveMarker;
  if (mm != null) {
    mm.t += TICK_SEC;
    if (mm.t > 0.8) state.moveMarker = null;
  }
}

// --- معركة البوتات (botBattle.js): للقياس واختبار المطابقة ---
List<T> _shuffle<T>(List<T> list) {
  for (var k = list.length - 1; k > 0; k--) {
    final r = (random() * (k + 1)).floor();
    final t = list[k]; list[k] = list[r]; list[r] = t;
  }
  return list;
}

MatchState createBattle({required String a, required String b, int perSide = 1, String? mapSize, int? maxUnits, bool mirror = true, bool teams = false}) {
  final gangs = _shuffle([for (final g in GANG_IDS) g as String]);
  if (mirror) gangs.fillRange(0, gangs.length, gangs[0]);
  final colors = _shuffle([for (final c in PLAYER_COLORS) (c as J).s('id')]);
  final sides = _shuffle([...List.filled(perSide, 'a'), ...List.filled(perSide, 'b')]);
  final players = [
    for (var k = 0; k < sides.length; k++)
      <String, Object?>{'name': '${sides[k] == 'a' ? 'أ' : 'ب'}${k + 1}', 'gang': gangs[k % gangs.length],
        'color': colors[k % colors.length], 'isHuman': false, 'team': teams ? (sides[k] == 'a' ? 1 : 2) : 0,
        'difficulty': sides[k] == 'a' ? a : b}
  ];
  final state = createMatch({'mapSize': mapSize ?? ai.m('battle').s('mapSize'), 'maxUnits': maxUnits ?? MATCH_DEFAULTS.i('maxUnits'),
    'weather': 'day', 'mode': 'conquest', 'players': players});
  for (var k = 0; k < sides.length; k++) { state.players[k].battleSide = sides[k]; }
  state.running = true;
  state.battleMaxSeconds = ai.m('battle').d('maxMinutes') * 60;
  return state;
}

bool stepBattle(MatchState state, int ticks) {
  for (var t = 0; t < ticks; t++) {
    if (state.matchResult != null || state.time >= state.battleMaxSeconds) return true;
    updateMatch(state);
  }
  return state.matchResult != null || state.time >= state.battleMaxSeconds;
}

String? battleWinner(MatchState state) {
  final alive = {'a': 0, 'b': 0}, districts = {'a': 0, 'b': 0}, units = {'a': 0, 'b': 0};
  for (final p in state.players) { if (p.battleSide != null && isPlayerAlive(state, p.id)) alive[p.battleSide!] = alive[p.battleSide!]! + 1; }
  for (final d in state.map.districts) {
    final side = d.owner != null ? state.players[d.owner!].battleSide : null;
    if (side != null) districts[side] = districts[side]! + 1;
  }
  for (final u in state.units) {
    final side = state.players[u.playerId].battleSide;
    if (u.state != 'dead' && side != null) units[side] = units[side]! + 1;
  }
  if (alive['a']! > 0 && alive['b'] == 0) return 'a';
  if (alive['b']! > 0 && alive['a'] == 0) return 'b';
  if (districts['a'] != districts['b']) return districts['a']! > districts['b']! ? 'a' : 'b';
  if (units['a'] != units['b']) return units['a']! > units['b']! ? 'a' : 'b';
  return null;
}
