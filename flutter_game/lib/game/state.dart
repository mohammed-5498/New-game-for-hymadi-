// حالة المباراة: اللاعبون والوحدات والمقذوفات وما يحمله القتال، بأسماء حقول js/state.js وjs/game/units.js نفسها
// (كائنات JavaScript صنوف هنا). والعشوائية من مولّد واحد ببذرة (random): كل سحب بترتيبه في اللعبة الحالية
import 'dart:collection';

import '../ai/squads.dart' show Brain;
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import 'empire.dart' show EmpireState;
import 'victory.dart' show MatchResult;
import 'police.dart' show PoliceTimer;

// مولّد المنطق كله (الخريطة والمباراة): Math.random في اللعبة الحالية، ببذرة المباراة هنا
Rng simRng = Rng(1);
double random() => simRng();

class Player extends MapPlayer {
  final int id;
  final String name;
  final String? nation;
  final String gangName;
  final String color;
  final bool isHuman;
  final String difficulty;
  bool neutral = false;      // الشرطة: خارج الفوز والبوتات
  bool fallen = false;       // حماية الزعيم: سقط زعيمه
  bool passive = false;      // أهل القرى (القسم 3.11): لا عدو لأحد
  bool captures = false, ownOnly = false;   // أطراف المزايا التي تستولي (ن8)
  int? friendOf;             // الشرطة صديقة لصاحب مركزها الرئيسي
  String? feature;           // طرف ميزة المدينة
  String? battleSide;        // معركة البوتات: 'a' أو 'b'
  Player({required this.id, required this.name, required String gang, this.nation, required this.gangName,
      required this.color, this.isHuman = false, int team = 0, this.difficulty = 'medium'})
      : super(gang, team);
}

class Phases {
  final double wind, strike, hold, rec, total;
  Phases(this.wind, this.strike, this.hold, this.rec, this.total);
}

class Traits {
  final double aggr, skill, react, spd, size;
  Traits(this.aggr, this.skill, this.react, this.spd, this.size);
}

class FightStyleInfo {
  final double turn, flank;
  final List<String> moves;
  final bool block;
  final String? primary;
  FightStyleInfo(this.turn, this.flank, this.moves, this.block, this.primary);
}

class Sight {
  final double at;
  final Unit from;
  final bool ranged;
  Sight(this.at, this.from, this.ranged);
}

class PendingHit {
  final Unit target;
  final String? move;
  final double range;
  final double damage;
  final bool ranged;
  final double at;
  PendingHit({required this.target, this.move, this.range = 0, required this.damage, required this.ranged, required this.at});
}

class PendingUlt {
  final Unit target;
  final double at;
  PendingUlt(this.target, this.at);
}

class Flurry {
  final Unit? target;
  int left;
  final double damage, interval;
  double next;
  final double radius;
  Flurry(this.target, this.left, this.damage, this.interval, this.next, this.radius);
}

// مهمة وحدة البوت (ai/bot.dart وai/squads.dart)
class BotTask {
  final String type;
  final int squadId, districtId;
  final double until;
  final Unit? leader;
  final Point2? point;
  const BotTask(this.type, {this.squadId = -1, this.districtId = -1, this.until = 0, this.leader, this.point});
}

class Point2 {
  double x, y;
  Point2(this.x, this.y);
}

class Unit {
  final int id;
  int playerId;
  String gang;
  String? nation;
  String color;
  String? hero;
  bool champion;
  String name;
  double x, y, prevX, prevY;
  J stats;
  double hp, maxHp;
  String state = 'idle';           // idle | moving | attackMove | attacking | dead
  int facing = 1;
  List<(int, int)> path = [];
  bool selected = false;
  bool isSource = false;           // نار الأرض: مصدر ضرر بلا وحدة (attacker.stats غائب في JavaScript)

  // الحركة
  FlowField? flow;
  bool awaitingPath = false;
  int orderSeq = 0;
  ({int i, int j})? attackMove;

  // القتال
  Unit? target;
  bool commandedTarget = false;
  Point2 chaseOrigin;
  double attackCooldown = 0;
  double? attackStart;
  double attackRate = 0;
  PendingHit? pendingHit;
  double repathTimer = 0, hitFlash = 0, hurtTimer = 0, deathTimer = 0;
  int comboStacks = 0;
  double comboTime = -99;
  Unit? comboTarget;

  // الضربة المميزة
  double ultCharge = 0;
  bool ultAnnounced = false;
  double whistleAt = -99;
  double? ultStart;
  double ultRate = 0;
  PendingUlt? pendingUlt;
  double damageTaken = 0;
  Flurry? flurry;
  double invulnUntil = 0, buffUntil = 0, buffDamage = 0, buffAttackSpeed = 0, slowUntil = 0, slowFactor = 0;
  double steadyUntil = 0, awayUntil = 0, lastSwingAt = -99;
  int brothers = 0;
  double holdUntil = 0, bribedUntil = 0;
  int bribedBy = -1;
  double hasteUntil = 0, rallyUntil = 0, hasteFactor = 0;

  // الشرطة والمزايا
  int stationId = -1, villageId = -1, garrisonOf = -1;
  String? recruitKind;
  int raidFrom = -1;
  double leash = 0;
  String? lookKind;
  double auraSpeed = 0;
  bool harmless = false, cargo = false;
  Object? caravanExit;
  String? creature;
  double barY = 0, expireAt = -1, trampleAt = 0;
  Object? lair;
  Point2? homePost;
  double vanishAt = -1;

  double armorBonus = 0, takenMul = 1, damageMultiplier = 1;
  bool aura = false;
  double auraBonus = 0, auraHeal = 0;

  bool hardened = false, leaderPaid = false;
  BotTask? botTask;
  int gatherRally = -1;            // نقطة تجمع الفرقة (رقم حيها، ai/squads.dart)
  double kiteAt = -99, ultHeldSince = -1;
  int lastHitBy = -1;
  double fadeAt = -1;
  int wave = 0;
  double waveFactor = 0;
  bool riot = false, boss = false, alwaysBlock = false, focusHeroes = false;
  String? artColor;
  double? artScale;
  Unit? healingTarget;
  int group = 0;                   // مجموعة التحكم (القسم 4.4)

  // القتال الواقعي (initRealism)
  late FightStyleInfo style;
  late double Function() rng;
  late Traits traits;
  double faceAngle = 0;
  String? cState;
  double cTimer = 0;
  String? cMove;
  double cMoveT = 0;
  Phases? cPhases;
  Sight? sight;
  double stamina = 0, dodgeCd = 0, vx = 0, vy = 0, dvx = 0, dvy = 0, bumpCd = 0, blockFlash = 0;
  String dodgeType = 'leap';
  double flinch = 0;
  bool flinchBack = false, combo = false, rolling = false;
  String lod = 'full';
  double lodAt = 0;
  // للرسم وحده (أنميشن القتال حسب السلاح)
  String? cNode;
  double chainAt = -1e9, approachAt = -1e9, approachSince = -1e9, landAt = -1e9, hitDoneAt = -1e9, hitAt = -1e9, hitStop = 0;
  String hitStyle = '', hitNode = '';
  bool deathFront = false;

  Unit({required this.id, required this.playerId, required this.gang, this.nation, required this.color, this.hero,
      this.champion = false, required this.name, required this.x, required this.y, required this.stats})
      : prevX = x, prevY = y,
        hp = (stats['hp'] as num).toDouble(), maxHp = (stats['hp'] as num).toDouble(),
        chaseOrigin = Point2(x, y);

  // مصدر ضرر ليس وحدة (نار الأرض: { playerId } في JavaScript)
  Unit.source(int playerId)
      : id = -1, playerId = playerId, gang = '', color = '', champion = false, name = '', x = 0, y = 0, prevX = 0, prevY = 0,
        stats = const {}, hp = 0, maxHp = 0, chaseOrigin = Point2(0, 0), isSource = true;
}

class Projectile {
  final String? kind;
  final Unit attacker;
  final Unit? target;
  final double damage;
  final bool dodgeable;
  final J? fire;
  final bool hits;
  final double missX, missY, startX, startY;
  double x, y, prevX, prevY, t = 0, prevT = 0;
  final double duration;
  final bool returns, back;
  final double area;
  Projectile({required this.kind, required this.attacker, required this.target, required this.damage, required this.dodgeable,
      required this.fire, required this.hits, required this.missX, required this.missY, required this.startX, required this.startY,
      required this.duration, this.returns = false, this.back = false, this.area = 0})
      : x = startX, y = startY, prevX = startX, prevY = startY;
}

class Fire {
  final int playerId;
  final double x, y, radius, damagePerSecond, maxLife;
  double life;
  Fire(this.playerId, this.x, this.y, this.radius, this.damagePerSecond, this.life) : maxLife = life;
}

class Alert {
  final String kind;
  int i, j;
  double life;
  Alert(this.kind, this.i, this.j, this.life);
}

class AlertSeen {
  final String kind;
  int i, j;
  double t;
  AlertSeen(this.kind, this.i, this.j, this.t);
}

class Pop {
  final double x, y;
  final String text;
  final String color;
  double t = 0;
  Pop(this.x, this.y, this.text, this.color);
}

// نجمة الارتطام وشرر التصادم وآثار الضربات (للرسم)
class Fx {
  final double x, y;
  double t = 0;
  final bool big, echo, bigA;
  final double h, life, dx, dy, r;
  final String style, node, kind, color;
  Fx({required this.x, required this.y, this.big = false, this.h = 16, this.style = '', this.node = '', this.bigA = false,
      this.life = 0, this.dx = 0, this.dy = 0, this.echo = false, this.kind = '', this.r = 1, this.color = ''});
}

class Zone {
  final String kind;
  final double x, y, radius, until;
  final int playerId;
  final String color;
  Zone(this.kind, this.x, this.y, this.radius, this.until, this.playerId, this.color);
}

class PathRequest {
  final Unit unit;
  final int i, j, seq;
  PathRequest(this.unit, this.i, this.j, this.seq);
}

class MatchStats {
  final List<int> kills, losses;
  int maxDistricts = 1;
  MatchStats(int n) : kills = List.filled(n, 0, growable: true), losses = List.filled(n, 0, growable: true);
}

class Notice {
  final String text;
  final bool mine, keep;
  double t;
  Notice(this.text, this.mine, this.t, [this.keep = false]);
}

class MoveMarker {
  final int i, j;
  final bool attack;
  double t = 0;
  MoveMarker(this.i, this.j, this.attack);
}

class Camera {
  double x = 0, y = 0, z = 2.2;
}

class MatchState {
  J settings;
  GameMap map;
  List<Player> players;
  List<Unit> units = [];
  List<Projectile> projectiles = [];
  List<PathRequest> pathQueue = [];
  int nextUnitId = 1;
  int seed = 0;                  // بذرة المولّد قبل createMatch (للحفظ: الخريطة تُعاد منها)
  int humanId;
  String weather;
  String? feature;
  Object? cityEvent;
  int maxUnits;
  final camera = Camera();
  double viewW = 1, viewH = 1;
  bool running = false, paused = false;
  Notice? notice;
  MatchResult? matchResult;
  List<double> spawnTimers = [], heroTimers = [], botTimers = [];
  List<int> heroTurn = [];
  List<double?> championTimers = [];
  final policeTimers = <int, PoliceTimer>{};
  List<Fire> fires = [];
  double time = 0;
  int combatSeed;
  int rollingCorpses = 0;
  double lodAt = 0;
  bool lodCrowded = false;
  final combatEvents = <String, int>{'dodge': 0, 'block': 0, 'stagger': 0, 'bump': 0, 'roll': 0, 'back': 0, 'side': 0,
    'hits': 0, 'clash': 0, 'down': 0, 'kick': 0, 'punch': 0, 'combo': 0};
  List<Pop> pops = [];
  List<Fx> clashes = [], fx = [], ultFx = [];
  List<Zone> zones = [];
  List<Alert> alerts = [];
  List<AlertSeen> alertSeen = [];
  double shakeAt = -99;
  late MatchStats stats;
  String mode = 'conquest';
  bool economy = true;
  dynamic modeState;
  EmpireState? empire;           // اقتصاد الإمبراطورية (empire.dart)
  bool empireHinted = false;
  int mapVersion = 0;            // يزيد مع كل مبنى أو ترقية أو تحصين: الرسم يعيد طبقة المدينة
  // الشبكة المكانية (spatial.dart)
  final unitHash = <int, List<Unit>>{};
  double unitHashTime = -1;
  MoveMarker? moveMarker;
  double battleMaxSeconds = 1e9;   // معركة البوتات (match.dart)
  final botBrains = SplayTreeMap<int, Brain>();   // عقل كل بوت (ai/squads.dart)، بترتيب أرقام اللاعبين

  MatchState({required this.settings, required this.map, required this.players, required this.humanId,
      required this.weather, required this.maxUnits, required this.combatSeed});
}
