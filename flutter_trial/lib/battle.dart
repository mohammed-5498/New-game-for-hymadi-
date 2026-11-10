// المعركة: محاكاة بسيطة بإيقاع ثابت 20 مرة/ث (الرسم ينعّم بينها)، وشبكة مربعات للبحث عن الجيران
// بدل مقارنة كل جندي بكل جندي، وحقل مسافات لكل فريق (BFS) يمشي به الجنود حول المباني نحو أقرب عدو.
import 'dart:math' as math;
import 'dart:typed_data';

const double tickSec = 0.05;
const double speed = 1.6;        // مربع/ث
const double reach = 0.8;        // مدى الضربة بالمربعات
const double sight = 5;          // يرى العدو داخل 5 مربعات
const double hpMax = 100, damage = 16, swingTime = 1.0, hitMoment = 0.47;
const double bodyRadius = 0.3;   // للتباعد بين الجنود
const double deathTime = 1.0;
const int capacity = 1024;
const int far = 32767;

class Unit {
  final int team;
  final double phase;            // إزاحة دورة المشي حتى لا يخطو الجميع معاً
  double x, y, px, py;           // الموقع بالمربعات، والسابق للتنعيم
  double hp = hpMax;
  bool dead = false, hitPending = false;
  double swing = -9, deadAt = 0;
  int facing = 1;                // 1 يمين الشاشة، -1 يسارها
  bool moving = false;
  Unit? target;
  Unit(this.team, this.x, this.y, this.phase) : px = x, py = y;
}

class Battle {
  final int n;
  final Uint8List walk;
  final List<List<int>> homes;
  final rnd = math.Random(7);
  List<Unit> units = [];
  double time = 0;
  int ticks = 0, count = 200;
  double? endedAt;
  late final Int32List head = Int32List(n * n);
  final Int32List next = Int32List(capacity);
  late final List<Int16List> flow = [Int16List(n * n), Int16List(n * n)];
  late final Int32List queue = Int32List(n * n);

  Battle(this.n, this.walk, this.homes) { spawn(count); }

  bool open(int i, int j) => i >= 0 && j >= 0 && i < n && j < n && walk[j * n + i] == 1;
  bool openAt(double x, double y) => open(x.round(), y.round());
  int alive(int team) => units.where((u) => u.team == team && !u.dead).length;

  // المسافة بالخطوات من مصادر عدة (8 اتجاهات، والقطر فقط إن كان الجانبان مفتوحين)
  void bfs(Iterable<int> sources, Int16List dist) {
    dist.fillRange(0, dist.length, far);
    var qh = 0, qt = 0;
    for (final k in sources) { if (dist[k] != 0) { dist[k] = 0; queue[qt++] = k; } }
    while (qh < qt) {
      final k = queue[qh++], i = k % n, j = k ~/ n, d = dist[k] + 1;
      for (var dj = -1; dj <= 1; dj++) {
        for (var di = -1; di <= 1; di++) {
          if ((di == 0 && dj == 0) || !open(i + di, j + dj)) continue;
          if (di != 0 && dj != 0 && !(open(i + di, j) && open(i, j + dj))) continue;
          final m = (j + dj) * n + i + di;
          if (dist[m] > d) { dist[m] = d; queue[qt++] = m; }
        }
      }
    }
  }

  // جيشان على جانبي منتصف ما بين القاعدتين، فيلتقيان بعد ثوانٍ
  void spawn(int total) {
    count = total;
    units = [];
    endedAt = null;
    final a = homes[0], b = homes[1];
    var mid = 0, best = double.infinity;
    final cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    for (var k = 0; k < n * n; k++) {
      if (walk[k] == 0) continue;
      final d = math.pow(k % n - cx, 2) + math.pow(k ~/ n - cy, 2);
      if (d < best) { best = d.toDouble(); mid = k; }
    }
    bfs([mid], flow[0]);
    for (var team = 0; team < 2; team++) {
      final h = homes[team], o = homes[1 - team];
      final tiles = <int>[];
      for (var k = 0; k < n * n; k++) {
        final d = flow[0][k], i = k % n, j = k ~/ n;
        if (d < 5 || d == far) continue;
        final toHome = math.pow(i - h[0], 2) + math.pow(j - h[1], 2), toOther = math.pow(i - o[0], 2) + math.pow(j - o[1], 2);
        if (toHome < toOther) tiles.add(k);
      }
      tiles.sort((p, q) => flow[0][p] - flow[0][q]);
      for (var u = 0; u < total ~/ 2; u++) {
        final k = tiles[(u ~/ 2) % tiles.length];
        units.add(Unit(team, k % n + (rnd.nextDouble() - 0.5) * 0.6, k ~/ n + (rnd.nextDouble() - 0.5) * 0.6, rnd.nextDouble() * 5));
      }
    }
    for (var t = 0; t < 2; t++) { updateFlow(t); }
  }

  // حقل فريق: المسافة إلى أقرب جندي عدو حي
  void updateFlow(int team) {
    bfs(units.where((u) => u.team != team && !u.dead).map((u) => u.y.round().clamp(0, n - 1) * n + u.x.round().clamp(0, n - 1))
        .where((k) => walk[k] == 1), flow[team]);
  }

  int cellOf(Unit u) => u.y.round().clamp(0, n - 1) * n + u.x.round().clamp(0, n - 1);

  Unit? nearestEnemy(Unit u) {
    Unit? best;
    var bestD = sight * sight;
    final ci = u.x.round(), cj = u.y.round(), r = sight.ceil();
    for (var j = math.max(0, cj - r); j <= math.min(n - 1, cj + r); j++) {
      for (var i = math.max(0, ci - r); i <= math.min(n - 1, ci + r); i++) {
        for (var v = head[j * n + i]; v >= 0; v = next[v]) {
          final e = units[v];
          if (e.team == u.team) continue;
          final d = (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y);
          if (d < bestD) { bestD = d; best = e; }
        }
      }
    }
    return best;
  }

  void moveBy(Unit u, double vx, double vy) {
    final nx = u.x + vx, ny = u.y + vy;
    if (openAt(nx, ny)) { u.x = nx; u.y = ny; }
    else if (openAt(nx, u.y)) { u.x = nx; }
    else if (openAt(u.x, ny)) { u.y = ny; }
  }

  void step() {
    time += tickSec;
    ticks++;
    if (ticks % 10 == 0) updateFlow(ticks ~/ 10 % 2);
    if (ticks % 20 == 0) units.removeWhere((u) => u.dead && time - u.deadAt > deathTime + 0.5);
    // الشبكة: قائمة مرتبطة لكل مربع بالأحياء فيه
    head.fillRange(0, head.length, -1);
    for (var k = 0; k < units.length; k++) {
      final u = units[k];
      u.px = u.x; u.py = u.y;
      if (u.dead) continue;
      final c = cellOf(u);
      next[k] = head[c];
      head[c] = k;
    }
    final stepLen = speed * tickSec;
    for (var k = 0; k < units.length; k++) {
      final u = units[k];
      if (u.dead) continue;
      u.moving = false;
      var t = u.target;
      if (u.hitPending && time - u.swing >= swingTime * hitMoment) {
        u.hitPending = false;
        if (t != null && !t.dead && math.sqrt((t.x - u.x) * (t.x - u.x) + (t.y - u.y) * (t.y - u.y)) < reach + 0.3) {
          t.hp -= damage * (0.7 + 0.6 * rnd.nextDouble());
          if (t.hp <= 0) { t.dead = true; t.deadAt = time; t.target = null; }
        }
      }
      if (time - u.swing < swingTime) continue;               // يكمل ضربته واقفاً
      if (t == null || t.dead || (ticks + k) % 10 == 0) t = u.target = nearestEnemy(u);
      if (t != null) {
        final dx = t.x - u.x, dy = t.y - u.y, d = math.sqrt(dx * dx + dy * dy);
        u.facing = dx - dy >= 0 ? 1 : -1;                      // اتجاه الشاشة: x = (i - j) × 18
        if (d <= reach) { u.swing = time; u.hitPending = true; continue; }
        if (d < 2.5) { moveBy(u, dx / d * stepLen, dy / d * stepLen); u.moving = true; continue; }
      }
      // أبعد: حقل المسافات حول المباني
      final f = flow[u.team], ci = u.x.round(), cj = u.y.round();
      var bi = ci, bj = cj, bd = open(ci, cj) ? f[cj * n + ci] : far;
      for (var dj = -1; dj <= 1; dj++) {
        for (var di = -1; di <= 1; di++) {
          if (!open(ci + di, cj + dj) || (di != 0 && dj != 0 && !(open(ci + di, cj) && open(ci, cj + dj)))) continue;
          final d = f[(cj + dj) * n + ci + di];
          if (d < bd) { bd = d; bi = ci + di; bj = cj + dj; }
        }
      }
      if (bd == far || (bi == ci && bj == cj && bd == 0)) continue;
      final vx = bi - u.x, vy = bj - u.y, l = math.sqrt(vx * vx + vy * vy);
      if (l < 1e-3) continue;
      moveBy(u, vx / l * stepLen, vy / l * stepLen);
      u.moving = true;
      u.facing = vx - vy >= 0 ? 1 : -1;
    }
    // التباعد: كل جندي يبتعد عمن يلاصقه في مربعه والمربعات حوله
    const minD = bodyRadius * 2;
    for (var k = 0; k < units.length; k++) {
      final u = units[k];
      if (u.dead) continue;
      var sx = 0.0, sy = 0.0;
      final ci = u.x.round(), cj = u.y.round();
      for (var j = math.max(0, cj - 1); j <= math.min(n - 1, cj + 1); j++) {
        for (var i = math.max(0, ci - 1); i <= math.min(n - 1, ci + 1); i++) {
          for (var v = head[j * n + i]; v >= 0; v = next[v]) {
            if (v == k) continue;
            final e = units[v], dx = u.x - e.x, dy = u.y - e.y, d2 = dx * dx + dy * dy;
            if (d2 >= minD * minD) continue;
            final d = math.sqrt(d2) + 1e-4, push = (minD - d) * 0.5;
            sx += dx / d * push; sy += dy / d * push;
          }
        }
      }
      if (sx != 0 || sy != 0) moveBy(u, sx.clamp(-0.1, 0.1), sy.clamp(-0.1, 0.1));
    }
    // فريق انتهى: معركة جديدة بعد ثانيتين
    if (alive(0) == 0 || alive(1) == 0) {
      endedAt ??= time;
      if (time - endedAt! > 2) spawn(count);
    }
  }
}
