// شخصيات الأمم المقطّعة أجزاءً منفصلة (scripts/import_rigged.py، lib/data/rig_sprites.dart): البديلة بتحسينات خفيفة
// (base) ومظهر النخبة الأسود والذهبي (elite) والأزياء الجديدة (outfit، 2.15.0: برسم النخبة وما زادته حزمتها). تُرسم على هيكل اللعبة ووضعياتها نفسها، ومواضع الأجزاء وترتيبها كما في
// riggedCharacters.js لكل حزمة: اليد الأمامية وسلاحها أمام الجسد، والخلفية وعتادها خلفه. والقوس يتبع زاوية الرمي في
// اللعبة (الحزمة تثبته)، والأقدام فوق الأرض والحوض ينزل حتى تصلها (النخبة)
import 'dart:math' as math;

import '../config.dart' show RIG_ART, RIG_TWEAKS;
import '../core/cfg.dart';
import '../data/rig_sprites.dart';
import 'batch.dart';
import 'pose.dart';

class Rig {
  final String sheet, style;   // base البديلة، elite النخبة، outfit الأزياء الجديدة، r3 الأرجنتين والمكسيك والبرازيل المحسّنة (2.16.0)
  final J def, meta;
  final Map<String, List<double>> parts;
  Rig(this.sheet, this.style, this.def, this.meta, this.parts);
  bool get elite => style != 'base';                     // رسم حزمة النخبة (والحزم بعدها)
  bool get outfit => style == 'outfit' || style == 'r3';  // وما زادته حزمة الأزياء
  bool get r3 => style == 'r3';                           // وما صححته حزمة R3
  double d(String k, double or) => (def[k] as num?)?.toDouble() ?? or;
  String get weapon => def['weapon'] as String? ?? 'fists';
  bool get twoH => def['twoH'] == true;
  (double, double)? pair(String k) {
    final v = def[k] as List?;
    return v == null ? null : ((v[0] as num).toDouble(), (v[1] as num).toDouble());
  }
  double m(String part, String k, double or) => ((meta[part] as J?)?[k] as num?)?.toDouble() ?? or;
  bool tipDown(String part) => (meta[part] as J?)?['tipDown'] == true;
}

// صورة كل وحدة: لوح أمتها بمظهرها ('<أمة>_<مظهر>')، وإلا اللوح البديل، وإلا null (الصور القديمة: الأرجنتين والبرازيل والمكسيك)
final _rigs = <String, Rig?>{};
Rig? rigFor(String key, String? skin) {
  final base = key.endsWith('_away') ? key.substring(0, key.length - 5) : key;
  return _rigs.putIfAbsent('$base@$skin', () {
    final nation = base.split('_').first;
    for (final sheet in [if (skin != null) '${nation}_$skin', '${nation}_rig']) {
      final u = ((RIG_SHEETS[sheet] as J?)?['units'] as J?)?[base] as J?;
      if (u == null) continue;
      final raw = u['def'] as J, tweak = RIG_TWEAKS[sheet]?[base], def = tweak == null ? raw : <String, Object?>{...raw, ...tweak};
      return Rig(sheet, (RIG_SHEETS[sheet] as J)['style'] as String, def, (def['parts'] as J?) ?? const {},
          {for (final e in (u['parts'] as J).entries) e.key: [for (final x in e.value as List) (x as num).toDouble()]});
    }
    return null;
  });
}

// المفاصل بعد الرسم (لآثار القتال: طرف السلاح ونجمة الضربة وومضة الإصابة)
class RigJoints {
  double hipX = 0, hipY = 0, midX = 0, midY = 0, chestX = 0, chestY = 0, headX = 0, headY = 0, a2 = 0, pl = 0;
  double sbX = 0, sbY = 0, sfX = 0, sfY = 0, hbX = 0, hbY = 0, hfX = 0, hfY = 0, efX = 0, efY = 0, ebX = 0, ebY = 0;
}

const _ankle = -1.2;   // motion.js: مركز الكاحل فوق الأرض
(double, double) _rot(double x, double y, double a) => (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a));
double _ang(double ax, double ay, double bx, double by) => math.atan2(by - ay, bx - ax);

// ik2 في anim.js (flip): المرفق واليد
(double, double, double, double) _ik2(double ox, double oy, double tx, double ty) {
  const l = 3.7;
  final dx = tx - ox, dy = ty - oy;
  var d = math.sqrt(dx * dx + dy * dy);
  if (d == 0) d = 0.001;
  final cl = math.max(0.05, math.min(d, 2 * l - 0.05));
  final ex = ox + dx / d * cl, ey = oy + dy / d * cl, a = math.atan2(ey - oy, ex - ox);
  final g = a + math.acos(math.max(-1, math.min(1, (l * l + cl * cl - l * l) / (2 * l * cl))));
  return (ox + math.cos(g) * l, oy + math.sin(g) * l, ex, ey);
}

class _Draw {
  final TriBatch b;
  final Rig r;
  final double ox, oy;
  _Draw(this.b, this.r, this.ox, this.oy);
  // sprite في الحزمتين: الجزء بارتفاعه (وحدات) ونسبته الأصلية، حول نقطة ارتكازه (نسبة من عرضه وارتفاعه)
  void sprite(String n, double x, double y, double height, double ang, [double px = 0.5, double py = 0.5]) {
    final q = r.parts[n];
    if (q == null || q[3] <= 0) return;
    b.imageAt(q[0] + ox, q[1] + oy, q[2], q[3], q[2] * px, q[3] * py, x, y, ang, height / q[3]);
  }
  void segment(String n, double ax, double ay, double bx, double by, double height) =>
      sprite(n, (ax + bx) / 2, (ay + by) / 2, height, _ang(ax, ay, bx, by) - math.pi / 2);
  // ساق حزمة R3: تنتهي فوق القدم بمقدار الكُمّ (cuff) فلا تغطي الحذاء
  void shin(String n, double ax, double ay, double bx, double by, double height, double len) {
    const cuff = 0.75;
    final t = 0.5 - cuff / len;
    sprite(n, ax + (bx - ax) * t, ay + (by - ay) * t, height - cuff, _ang(ax, ay, bx, by) - math.pi / 2);
  }
  double ratio(String n) { final q = r.parts[n]; return q == null || q[2] == 0 ? 1 : q[3] / q[2]; }
}

// العصا والسيف والرمح في اليد (weaponAt في الحزمة البديلة)
void _weaponAt(_Draw k, double hx, double hy, double angle) {
  final r = k.r, w = r.weapon;
  if (r.parts['weapon'] == null) return;
  final height = r.d('weaponLength', 12), down = ['blade', 'dual', 'dagger'].contains(w) && r.tipDown('weapon');
  final g = r.pair('grip') ?? (w == 'banner' ? (r.m('weapon', 'pole', 0.5), 0.6) : down ? (0.5, 0.18) : (0.5, 0.82));
  k.sprite('weapon', hx, hy, height, angle + (down ? -math.pi / 2 : math.pi / 2), g.$1, g.$2);
}

// القوس ووتره وسهمه بزاوية الرمي، وحول مقبضه (center/gripX) وطرفاه (top/bottom أو topX/bottomX)
void _bow(_Draw k, RigJoints j, Pose p, double height) {
  final r = k.r, q = r.parts['weapon'];
  if (q == null) return;
  final pull = p.pull.isNaN ? 0.0 : p.pull, aim = p.pull.isNaN ? p[WA] * 0.4 : p[WA];
  final width = height * q[2] / q[3];
  final c = r.elite ? r.m('weapon', 'gripX', 0.5) : r.m('weapon', 'center', 0.5);
  final top = r.elite ? r.m('weapon', 'topX', 0.1) : r.m('weapon', 'top', 0.1), bot = r.elite ? r.m('weapon', 'bottomX', 0.1) : r.m('weapon', 'bottom', 0.1);
  k.sprite('weapon', j.hfX, j.hfY, height, aim, c, 0.5);
  final fire = r.def['offhand'] == 'firearrow';   // سهم النار في اليد الخلفية بدل السهم المرسوم (الأزياء الجديدة)
  final (t1, t2) = _rot((top - c) * width, -height * 0.465, aim);
  final (b1, b2) = _rot((bot - c) * width, height * 0.465, aim);
  final tx = j.hfX + t1, ty = j.hfY + t2, bx = j.hfX + b1, by = j.hfY + b2;
  final nx = pull > 0.05 ? j.hbX : (tx + bx) / 2, ny = pull > 0.05 ? j.hbY : (ty + by) / 2;
  k.b.line(tx, ty, nx, ny, 0.12, 0xe9dcc6);
  k.b.line(nx, ny, bx, by, 0.12, 0xe9dcc6);
  if (fire && !(pull < 0.02 && !p.pull.isNaN)) k.sprite('offhand', nx, ny, 17, aim + math.pi / 2, 0.5, 0.94);
  if (pull > 0.1 && !fire) {
    final (a1, a2) = _rot(5, 0, aim);
    final px = j.hfX + a1;
    final py = j.hfY + a2;
    k.b.line(nx, ny, px, py, 0.18, 0xc59e61);
    final (h1x, h1y) = _rot(0.5, 0, aim);
    final (h2x, h2y) = _rot(-0.6, -0.45, aim);
    final (h3x, h3y) = _rot(-0.6, 0.45, aim);
    k.b.tri(px + h1x, py + h1y, px + h2x, py + h2y, px + h3x, py + h3y, 0xd5e2e7);
  }
}

// ما يُمسك بلا توجيه (الصقر والجرة والقنينة والبوق والطبل والمقلاع والقبضات): ارتفاعه ونقطة مسكه
const _held = {'falcon': (8.0, 0.5, 0.85), 'firepot': (5.0, 0.5, 0.6), 'bottle': (4.0, 0.5, 0.6), 'horn': (7.0, 0.5, 0.6),
  'drum': (6.0, 0.5, 0.5), 'sling': (6.0, 0.5, 0.6), 'knuckles': (2.8, 0.5, 0.5), 'lantern': (5.0, 0.5, 0.08), 'torch': (10.0, 0.5, 0.75),
  'bolas': (7.0, 0.5, 0.05), 'shield': (9.0, 0.5, 0.5)};

void drawRig(TriBatch b, double ox, double oy, Pose p, Rig r, bool ground, bool away, RigJoints j) {
  final k = _Draw(b, r, ox, oy);
  if (r.elite) { _elite(k, p, ground, away, j); } else { _base(k, p, away, j); }
}

// --- الحزمة البديلة (riggedCharacters.js في GangCity-Rigged) ---
void _base(_Draw k, Pose p, bool away, RigJoints j) {
  final r = k.r, w = r.weapon;
  final hx = p[PX], hy = p[PY], pl = p[PL], a2 = pl + p[CB], tw = p.tw;
  final (m1, m2) = _rot(0, -4.6, pl);
  final mx = hx + m1;
  final my = hy + m2;
  final (c1, c2) = _rot(0, -4.6, a2);
  final cx = mx + c1;
  final cy = my + c2;
  final (n1, n2) = _rot(0, -1.3, a2);
  final nx = cx + n1;
  final ny = cy + n2;
  final ha = a2 + p[HT];
  final (e1, e2) = _rot(0, -3.1, ha);
  final headX = nx + e1 + p[HDX];
  final headY = ny + e2 + p[HDY];
  final (sb1, sb2) = _rot(-0.9 + 1.5 * tw, 0.7, a2);
  final (sf1, sf2) = _rot(0.9 - 0.9 * tw, 0.5, a2);
  final sbx = cx + sb1, sby = cy + sb2, sfx = cx + sf1, sfy = cy + sf2;
  var fx = p[FHX], fy = p[FHY], bx = p[BHX], by = p[BHY];
  if (r.twoH) {
    final (d1, d2) = _rot(3.2, 0, p[WA]);
    for (var i = 0; i < 24; i++) {
      for (final (ccx, ccy) in [(sfx, sfy), (sbx + d1, sby + d2)]) {
        final dx = fx - ccx, dy = fy - ccy, len = math.sqrt(dx * dx + dy * dy);
        if (len > 7.34) { fx = ccx + dx * 7.34 / len; fy = ccy + dy * 7.34 / len; }
      }
    }
    bx = fx - d1; by = fy - d2;
  }
  final (bjx, bjy, bex, bey) = _ik2(sbx, sby, bx, by);
  final (fjx, fjy, fex, fey) = _ik2(sfx, sfy, fx, fy);
  j..hipX = hx..hipY = hy..midX = mx..midY = my..chestX = cx..chestY = cy..headX = headX..headY = headY..a2 = a2..pl = pl
    ..sbX = sbx..sbY = sby..sfX = sfx..sfY = sfy..hbX = bex..hbY = bey..hfX = fex..hfY = fey..efX = fjx..efY = fjy..ebX = bjx..ebY = bjy;
  // الساقان: الخلفية ثم الأمامية، والقدم المرفوعة تميل مع الساق
  final legs = <(double, double, double, double, double, double, String)>[];
  for (final (x, t, kk, s) in [(hx - 1.2, p[TB], p[KB], 'B'), (hx + 1.2, p[TF], p[KF], 'F')]) {
    final kx = x + math.sin(t) * 5.8, ky = hy + math.cos(t) * 5.8;
    legs.add((x, hy, kx, ky, kx + math.sin(t - kk) * 6, ky + math.cos(t - kk) * 6, s));
  }
  final lowest = math.max(legs[0].$6, legs[1].$6);
  for (final (lx, ly, kx, ky, fx2, fy2, s) in legs) {
    k.segment('shin$s', kx, ky, fx2, fy2, 6 + 1.4);
    k.segment('thigh$s', lx, ly, kx, ky, 5.8 + 1.6);
    final tilt = _ang(kx, ky, fx2, fy2) - math.pi / 2, lift = ((lowest - fy2 - 0.6) / 3).clamp(0.0, 1.0);
    k.sprite('foot$s', fx2, fy2, 2.4, tilt.clamp(-1.1, 1.1) * 0.7 * lift, 0.4, 0.5);
  }
  void arm(double sx, double sy, double ex, double ey, double hx2, double hy2, String s) {
    k.segment('fore$s', ex, ey, hx2, hy2, 3.7 + 1.3);
    k.segment('upper$s', sx, sy, ex, ey, 3.7 + 1.5);
  }
  void hand(double x, double y, String s, double ang, bool grip) => k.sprite('hand$s', x, y, 2.1, ang, grip ? (s == 'F' ? 0.8 : 0.2) : 0.5, 0.5);
  final shieldB = r.def['offhand'] == 'shield' && r.parts['shieldB'] != null, shieldFront = bex >= cx - 1;
  void offShield() => k.sprite('shieldB', bex, bey, r.d('offhandSize', 10), _ang(bjx, bjy, bex, bey) + math.pi / 2);
  arm(sbx, sby, bjx, bjy, bex, bey, 'B');
  if (w == 'dual') _weaponAt(k, bex, bey, _ang(sbx, sby, bex, bey) - 0.9);
  if (!r.twoH) hand(bex, bey, 'B', _ang(bjx, bjy, bex, bey), w == 'dual');
  if (shieldB && !shieldFront) offShield();
  // الثوب من الحوض نحو منتصف الركبتين بميل محدود
  if (r.def['skirt'] != false && r.parts['skirt'] != null) {
    final (t1, t2) = _rot(0, -1, pl);
    final tx = hx + t1;
    final ty = hy + t2;
    final ccx = (legs[0].$3 + legs[1].$3) / 2, ccy = (legs[0].$4 + legs[1].$4) / 2;
    final tilt = math.atan2(ccx - tx, ccy - ty).clamp(-0.35, 0.35);
    k.sprite('skirt', tx, ty, r.d('hem', 11), pl * 0.7 + tilt * 0.3, 0.5, 0);
  }
  final (q1, q2) = _rot(0, -0.9, a2);
  k.sprite('chest', cx + q1, cy + q2, 6.4 * k.ratio('chest'), a2, 0.5, 0);
  final (w1, w2) = _rot(0, -1, pl);
  k.sprite('pelvis', hx + w1, hy + w2, math.min(6.2, 6.1 * k.ratio('pelvis')), pl, 0.5, 0.75);
  k.sprite('head', headX, headY, 8.1, ha);
  if (shieldB && shieldFront) offShield();
  arm(sfx, sfy, fjx, fjy, fex, fey, 'F');
  if (w == 'shield') {
    final a = _ang(fjx, fjy, fex, fey) + math.pi / 2;
    hand(fex, fey, 'F', a, true);
    k.sprite('weapon', fex, fey, 10, a);
  } else if (w == 'bow') {
    _bow(k, j, p, r.d('weaponLength', 15));
    final aim = p.pull.isNaN ? p[WA] * 0.4 : p[WA];
    hand(fex, fey, 'F', aim, true);
    hand(bex, bey, 'B', aim, true);
  } else if (_held.containsKey(w) && w != 'shield' && w != 'torch' && w != 'lantern' && w != 'bolas') {
    final thrown = p.thrown || away;
    if (!thrown) {
      final (h, gx, gy) = _held[w]!;
      final g = r.pair('heldGrip');
      k.sprite('weapon', fex, fey, h, 0, g?.$1 ?? gx, g?.$2 ?? gy);
    }
    if (w != 'knuckles' || thrown) hand(fex, fey, 'F', 0, !thrown);
  } else {
    if (w != 'fists') _weaponAt(k, fex, fey, p[WA]);
    hand(fex, fey, 'F', p[WA] + math.pi / 2, w != 'fists');
    if (r.twoH) hand(bex, bey, 'B', p[WA] + math.pi / 2, true);
  }
}

// --- النخبة (riggedCharacters.js في GangCity-BlackGold-Rigged) ---
void _elite(_Draw k, Pose p, bool ground, bool away, RigJoints j) {
  final r = k.r;
  var hx = p[PX], hy = p[PY], fx = p[FHX], fy = p[FHY], bx = p[BHX], by = p[BHY];
  final pl = p[PL], a2 = pl + p[CB], tw = p.tw;
  // القدمان من الوضعية ولا تنزلان تحت الأرض، والحوض ينزل إن لم تبلغهما الساقان
  final feet = <List<double>>[];
  for (final (x, t, kk) in [(hx + 1.2, p[TF], p[KF]), (hx - 1.2, p[TB], p[KB])]) {
    final kx = x + math.sin(t) * 5.8, ky = hy + math.cos(t) * 5.8;
    feet.add([kx + math.sin(t - kk) * 6, ky + math.cos(t - kk) * 6]);
  }
  var dy = 0.0;
  if (ground) {
    for (final f in feet) { f[1] = math.min(_ankle, f[1]); }
    for (final (f, off) in [(feet[0], 1.2), (feet[1], -1.2)]) {
      final dx = f[0] - (hx + off);
      if (dx.abs() < 11.72) dy = math.max(dy, f[1] - math.sqrt(11.72 * 11.72 - dx * dx) - hy);
    }
  }
  hy += dy; fy += dy; by += dy;
  for (final (f, off) in [(feet[0], 1.2), (feet[1], -1.2)]) {
    final dx = f[0] - (hx + off), dz = f[1] - hy, len = math.sqrt(dx * dx + dz * dz);
    if (len > 11.78) { f[0] = hx + off + dx * 11.78 / len; f[1] = hy + dz * 11.78 / len; }
  }
  final (m1, m2) = _rot(0, -4.6, pl);
  final mx = hx + m1;
  final my = hy + m2;
  final (c1, c2) = _rot(0, -4.6, a2);
  final cx = mx + c1;
  final cy = my + c2;
  final (n1, n2) = _rot(0, -1.3, a2);
  final nx = cx + n1;
  final ny = cy + n2;
  final ha = a2 + p[HT];
  final (sb1, sb2) = _rot(-1.6 + 0.7 * tw, 0.7, a2);
  final (sf1, sf2) = _rot(1.6 - 0.7 * tw, 0.5, a2);
  final sbx = cx + sb1, sby = cy + sb2, sfx = cx + sf1, sfy = cy + sf2;
  if (r.twoH) {
    final (d1, d2) = _rot(3.2, 0, p[WA]);
    for (var i = 0; i < 32; i++) {
      for (final (ccx, ccy) in [(sfx, sfy), (sbx + d1, sby + d2)]) {
        final dx = fx - ccx, dz = fy - ccy, n = math.sqrt(dx * dx + dz * dz);
        if (n > 7.34) { fx = ccx + dx * 7.34 / n; fy = ccy + dz * 7.34 / n; }
      }
    }
    bx = fx - d1; by = fy - d2;
  }
  final (fjx, fjy, fex, fey) = _ik2(sfx, sfy, fx, fy);
  final (bjx, bjy, bex, bey) = _ik2(sbx, sby, bx, by);
  final (e1, e2) = _rot(0, -3.1, ha);
  final headX = nx + e1 + p[HDX];
  final headY = ny + e2 + p[HDY];
  j..hipX = hx..hipY = hy..midX = mx..midY = my..chestX = cx..chestY = cy..headX = headX..headY = headY..a2 = a2..pl = pl
    ..sbX = sbx..sbY = sby..sfX = sfx..sfY = sfy..hbX = bex..hbY = bey..hfX = fex..hfY = fey..efX = fjx..efY = fjy..ebX = bjx..ebY = bjy;
  // الركبة من الحوض والقدم (legIK)
  (double, double) knee(double lx, double ly, List<double> f) {
    final dx = f[0] - lx, dz = f[1] - ly, d = math.sqrt(dx * dx + dz * dz).clamp(0.2, 11.799);
    final a = math.atan2(dx, dz) + math.acos(((5.8 * 5.8 + d * d - 36) / (2 * 5.8 * d)).clamp(-1.0, 1.0));
    return (lx + 5.8 * math.sin(a), ly + 5.8 * math.cos(a));
  }
  void leg(double lx, List<double> f, String s) {
    final (kx, ky) = knee(lx, hy, f);
    if (r.r3) { k.shin('shin$s', kx, ky, f[0], f[1], 6.8, 6); } else { k.segment('shin$s', kx, ky, f[0], f[1], 6.8); }
    k.segment('thigh$s', lx, hy, kx, ky, 6.6);
    final lift = math.max(0.0, _ankle - f[1]), q = r.parts['foot$s'];
    if (q == null) return;
    final halfW = 1.2 * q[2] / q[3];
    var a = lift > 0.2 ? (_ang(kx, ky, f[0], f[1]) - math.pi / 2).clamp(-0.65, 0.65) * 0.5 : 0.0;
    for (var i = 0; i < 16 && math.cos(a).abs() * 1.2 + math.sin(a).abs() * halfW > 1.2 + lift; i++) { a *= 0.5; }
    k.sprite('foot$s', f[0], f[1], 2.4, a);
  }
  void arm(double sx, double sy, double ex, double ey, double hx2, double hy2, String s) {
    k.segment('fore$s', ex, ey, hx2, hy2, 4.5);
    k.segment('upper$s', sx, sy, ex, ey, 4.5);
  }
  // العتاد في يد (equipment)
  void gear(bool back) {
    final type = back ? r.def['offhand'] as String? : r.weapon, name = back ? 'offhand' : 'weapon';
    final hxx = back ? bex : fex, hyy = back ? bey : fey;
    if (type == null || type == 'fists' || r.parts[name] == null || type == 'firearrow') return;   // سهم النار مع القوس
    if (!back && (p.thrown || away) && ['firepot', 'torch', 'bolas', 'falcon'].contains(type)) return;
    if (!back && (type == 'bow' || type == 'berimbau')) {
      if (type == 'bow') { _bow(k, j, p, 18); return; }
    }
    var height = back ? r.d('offhandLength', 12) : r.d('weaponLength', 12);
    var g = (back ? r.pair('offhandGrip') : r.pair('grip')) ?? (0.5, 0.8);
    var a = back ? _ang(bjx, bjy, hxx, hyy) + math.pi / 2 : p[WA] + math.pi / 2;
    if (_held.containsKey(type)) {
      final (h, gx, gy) = _held[type]!;
      a = type == 'shield' ? (back ? _ang(bjx, bjy, hxx, hyy) : _ang(fjx, fjy, hxx, hyy)) + math.pi / 2 : 0;
      height = type == 'falcon' ? 7 : type == 'firepot' ? 4.5 : type == 'drum' ? 5.5 : type == 'horn' ? 8 : type == 'knuckles' ? 2.5 : type == 'sling' ? 7 : h;
      g = (gx, type == 'falcon' ? 0.88 : type == 'shield' || type == 'drum' || type == 'knuckles' ? 0.5 : gy);
    } else if (type == 'berimbau') {
      a = r.r3 ? 0.20 : 0; height = 18; g = (r.m(name, 'gripX', 0.5), 0.5);
    } else if (type == 'slingPouch') {
      a = 0; height = 1.0; g = (0.5, 0.5);
    }
    if (r.outfit && type == 'lantern') { g = r.pair('grip') ?? g; height = r.d('weaponLength', height); }
    if (r.outfit && type == 'banner') g = (r.m(name, 'handleX', 0.1), g.$2);
    if (r.r3 && const ['blade', 'dual', 'dagger', 'club', 'stick', 'staff', 'spear', 'torch', 'atlatl'].contains(type)) g = (r.m(name, 'handleX', g.$1), g.$2);
    if (r.tipDown(name) && ['blade', 'dual', 'dagger', 'club', 'stick', 'staff', 'spear'].contains(type)) { a -= math.pi; g = (g.$1, 1 - g.$2); }
    k.sprite(name, hxx, hyy, height, a, g.$1, g.$2);
  }
  if (r.parts['accessory'] != null) {
    final sc = r.def['scabbard'] == true;
    if (r.def['backcloth'] == true) {   // الوشاح خلف الكتفين يتدلى من الصدر (موضع حزمة R3 وطولها، 2.16.0)
      final (w1, w2) = _rot(-3.3, -0.4, a2);
      k.sprite('accessory', cx + w1, cy + w2, math.min(r.d('backclothLength', RIG_ART.backclothMax), RIG_ART.backclothMax), -0.10 + a2 * 0.35, 0.5, 0);
    } else {
      k.sprite('accessory', sc ? hx - 2 : cx - 3, sc ? hy - 1 : cy + 1, sc ? 12 : 10, sc ? 0.45 : -0.25);
    }
  }
  arm(sbx, sby, bjx, bjy, bex, bey, 'B');
  gear(true);
  // المقلاع: حبلان من طرفي إطاره في اليد الأمامية إلى الكيس في الخلفية، وحجره حتى يُرمى (الأزياء الجديدة)
  final sling = r.parts['weapon'];
  if (r.weapon == 'sling' && r.def['offhand'] == 'slingPouch' && sling != null && !away) {
    final w = 7 * sling[2] / sling[3], top = fey - 7 * 0.52;
    for (final side in [-1.0, 1.0]) { k.b.line(fex + side * w * 0.34, top, bex, bey, 0.16, 0xead9aa); }
    if (!p.thrown && !(p.pull < 0.02 && !p.pull.isNaN)) k.b.ellipse(bex, bey - 0.3, 0.55, 0.3, 0xa5aaa7, 1, 10);
  }
  k.sprite('handB', bex, bey, 2.0, 0, 0.55, 0.5);
  leg(hx - 1.2, feet[1], 'B');
  leg(hx + 1.2, feet[0], 'F');
  // البطن المتصل تحت الصدر والحزام المتحركين
  final fill = r.def['torsoFill'] as String?;   // لون البطن بلون ثياب الشخصية (الأزياء الجديدة)
  for (final (wd, col) in [(5.8, 0x090d0e), (5.0, fill != null ? int.parse(fill.substring(1), radix: 16) : 0x1b1c1d)]) {
    k.b.line(hx, hy, cx, cy, wd, col);
    k.b.ellipse(hx, hy, wd / 2, wd / 2, col, 1, 10);
    k.b.ellipse(cx, cy, wd / 2, wd / 2, col, 1, 10);
  }
  final (q1, q2) = _rot(0, -1, a2);
  k.sprite('chest', cx + q1, cy + q2, math.min(10.0, 7 * k.ratio('chest')), a2, 0.5, 0);
  if (r.def['skirt'] != false) {
    final (t1, t2) = _rot(0, -1, pl);
    k.sprite('skirt', hx + t1, hy + t2, r.d('hem', 8), pl * 0.35, 0.5, 0);
  }
  k.sprite('pelvis', hx, hy, math.min(4.0, 6.4 * k.ratio('pelvis')), pl, 0.5, 0.6);
  k.sprite('handB', cx + (nx - cx) * 0.6, cy + (ny - cy) * 0.6, 1.7, a2);   // الرقبة بلون الجسد
  final hp = r.pair('headPivot') ?? (0.5, 0.9);
  k.sprite('head', nx + p[HDX], ny + p[HDY], r.d('headHeight', 8.1), ha, hp.$1, hp.$2);
  arm(sfx, sfy, fjx, fjy, fex, fey, 'F');
  gear(false);
  k.sprite('handF', fex, fey, 2.0, 0, 0.55, 0.5);
}
