// آثار القتال في العالم (js/render/units.js وcombatArt.js وrenderer.js): المقذوفات، ونار الأرض، وشرر التصادم،
// وأثر الارتطام بلغة السلاح، وهالة الزعيم، وحلقة أمر الحركة، وآثار ضربات الأبطال. في دفعة الأطلس نفسها
import 'dart:math' as math;

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/state.dart';
import 'batch.dart';
import 'pose.dart' show impactKind;

final J _CR = COMBAT_REALISM;
const _projColors = {'stone': 0x9a948c, 'arrow': 0xc8b68a, 'bottle': 0xe8893a};
final _arc = COMBAT.d('projectileArc');

void drawProjectile(TriBatch b, Projectile shot, double alpha) {
  final i = shot.prevX + (shot.x - shot.prevX) * alpha, j = shot.prevY + (shot.y - shot.prevY) * alpha;
  final t = shot.prevT + (shot.t - shot.prevT) * alpha;
  final x = (i - j) * TILE_HALF_W, progress = math.max(0.0, math.min(1.0, t / shot.duration));
  final ground = (i + j) * TILE_HALF_H;
  final y = ground - 6 - math.sin(progress * math.pi) * _arc;
  final color = _projColors[shot.kind] ?? _projColors['stone']!;
  if (shot.kind == 'falcon') { _falcon(b, shot, x, ground, progress, t); return; }
  if (shot.area > 0) {
    final arc = nations.m('fx').d('rainArc');
    _aimed(b, shot, x, ground - 6 - math.sin(progress * math.pi) * arc, progress, arc, color);
    return;
  }
  // رامي النار الكلاسيكي بصورته يطلق سهماً مشتعلاً (spriteShotLook)
  if (shot.attacker.nation == null && shot.attacker.hero == 'firebomber') {
    final (hx, hy) = _aimed(b, shot, x, y, progress, _arc, _projColors['arrow']!);
    b.ellipse(hx, hy, 1.2, 1.5, 0xf0902a);
    b.ellipse(hx, hy - 0.4, 0.6, 0.9, 0xffd45a);
    return;
  }
  if (shot.kind == 'arrow') {
    b.line(x - 2, y + 1, x + 2, y - 1, 0.9, color);
  } else {
    b.ellipse(x, y, 1.9, 1.9, 0x2b2825, 0.8, 10);
    b.ellipse(x, y, 1.4, 1.4, color, 1, 10);
  }
}

(double, double) _aimed(TriBatch b, Projectile shot, double x, double y, double progress, double arc, int color) {
  final dI = shot.x - shot.prevX, dJ = shot.y - shot.prevY, dp = (shot.t - shot.prevT) / shot.duration;
  var vx = (dI - dJ) * TILE_HALF_W, vy = (dI + dJ) * TILE_HALF_H - arc * math.pi * math.cos(progress * math.pi) * dp;
  final n = math.sqrt(vx * vx + vy * vy);
  if (n > 1e-6) { vx = vx / n * 2; vy = vy / n * 2; } else { vx = 2; vy = -1; }
  b.line(x - vx, y - vy, x + vx, y + vy, 0.9, color);
  return (x + vx, y + vy);
}

void _falcon(TriBatch b, Projectile shot, double x, double ground, double progress, double t) {
  final back = shot.back;
  final h = back ? 8 + 6 * progress + math.sin(progress * math.pi) * 14 : 14 - 6 * progress + math.sin(math.min(1, progress / 0.8) * math.pi) * 18;
  final y = ground - h, dir = (shot.x - shot.y) >= (shot.startX - shot.startY) ? 1.0 : -1.0;
  final dive = !back && progress > 0.62, flap = dive ? 0.45 : 1.2 + 1.5 * (0.5 + 0.5 * math.sin(t * 30));
  b.ellipse(x, ground, 2.4, 1, 0x000000, 0.25);
  b.save();
  b.translate(x, y);
  b.scale(dir * 1.5, 1.5);
  if (dive) b.rotate(0.75);
  b.tri(-0.4, 0, -1.4, -flap * 0.85, 1.2, -0.3, 0x5a3e28);
  b.tri(-2, -0.2, -3.8, -0.9, -3.6, 0.9, 0x5a3e28);
  b.ellipse(0, 0, 2.3, 1.1, 0x7a5a3e);
  b.ellipse(2.1, -0.5, 0.95, 0.95, 0x5a3e28);
  b.tri(2.8, -0.8, 3.8, -0.3, 2.8, -0.1, 0xe0b24a);
  b.tri(0.2, 0, -0.9, -flap, 1.6, -0.2, 0x8e6a4a);
  b.restore();
}

void drawFire(TriBatch b, Fire fire, double time) {
  final x = (fire.x - fire.y) * TILE_HALF_W, y = (fire.x + fire.y) * TILE_HALF_H;
  final fade = math.min(1.0, fire.life / 1), rx = fire.radius * TILE_HALF_W, ry = fire.radius * TILE_HALF_H;
  b.ellipse(x, y, rx, ry, 0x8c3a16, 0.45 * fade, 20);
  for (var k = 0; k < 5; k++) {
    final angle = k * 1.257 + fire.x, flicker = 0.6 + 0.4 * math.sin(time * 9 + k * 2.1);
    final fx = x + math.cos(angle) * rx * 0.55, fy = y + math.sin(angle) * ry * 0.55, h = (3 + k % 2 * 2) * flicker * fade;
    b.tri(fx - 1.6, fy, fx, fy - h - 3, fx + 1.6, fy, 0xe8893a);
    b.tri(fx - 0.8, fy, fx, fy - h - 1, fx + 0.8, fy, 0xf2c14e);
  }
}

void drawClash(TriBatch b, double x, double y, double t) {
  final g = 1 - t / _CR.d('clashFxSeconds');
  if (g <= 0) return;
  for (var i = 0; i < 8; i++) {
    final an = i * 0.785, r2 = 3 + (1 - g) * 5;
    b.line(x + math.cos(an) * 1.4, y + math.sin(an) * 1.4, x + math.cos(an) * r2, y + math.sin(an) * r2, 0.9, 0xfff3c0, g);
  }
  b.ellipse(x, y, 1 + (1 - g) * 2, 1 + (1 - g) * 2, 0xfff0be, g * 0.7);
}

void _burst(TriBatch b, double x, double y, double g, bool big, double sc) {
  final R = (big ? 10 : 6.5) * sc * (0.6 + g * 0.8), n = big ? 10 : 8, al = math.max(0.0, 1 - g);
  final pts = <double>[];
  for (var i = 0; i < n * 2; i++) {
    final an = i * math.pi / n + 0.2, r = i.isOdd ? R * 0.45 : R;
    pts..add(x + math.cos(an) * r)..add(y + math.sin(an) * r);
  }
  for (var i = 0; i < n * 2; i++) {
    final i2 = (i + 1) % (n * 2);
    b.tri(x, y, pts[i * 2], pts[i * 2 + 1], pts[i2 * 2], pts[i2 * 2 + 1], 0xfffdf2, al);
    b.line(pts[i * 2], pts[i * 2 + 1], pts[i2 * 2], pts[i2 * 2 + 1], math.max(0.35, 0.7 * sc), 0xffb02e, al);
  }
}

final _burstSeconds = _CR.d('burstSeconds'), _quakeSeconds = FIGHT.m('quake').d('seconds');
// أثر الارتطام بلغة سلاح الضارب (drawImpact): gx, gy على الأرض، sc مقياس الوحدة، t عمره
void drawImpact(TriBatch b, Fx fx, double gx, double gy, double sc, double t) {
  final kind = impactKind(fx.style, fx.node, fx.bigA, fx.echo), hy = gy - fx.h * sc, B = _burstSeconds;
  if (kind == 'star') { if (t < B) _burst(b, gx, hy, t / B, fx.big, sc); return; }
  var vx = (fx.dx - fx.dy) * TILE_HALF_W, vy = (fx.dx + fx.dy) * TILE_HALF_H;
  var v = math.sqrt(vx * vx + vy * vy);
  if (v == 0) v = 1;
  vx /= v; vy /= v;
  if (kind == 'slash' || kind == 'pierce') {
    final g = t / 0.16;
    if (g < 1) {
      if (kind == 'slash') {
        final R = 7 * sc * (0.8 + 0.5 * g), an = math.atan2(vy, vx);
        b.ring(gx - vx * R * 0.6, hy - vy * R * 0.6, R, R, 2.6 * sc * (1 - g) + 0.3, 0xffffff, 1 - g, 10, an - 0.9, an + 0.9);
      } else {
        final L = 15 * sc, nx = -vy * 2.2 * sc, ny = vx * 2.2 * sc;
        b.line(gx - vx * L, hy - vy * L, gx + vx * L * 0.5, hy + vy * L * 0.5, 2 * sc * (1 - g) + 0.3, 0xffffff, 1 - g);
        b.line(gx - vx * L * 0.9 + nx, hy - vy * L * 0.9 + ny, gx - vx * L * 0.2 + nx, hy - vy * L * 0.2 + ny, 0.7 * sc, 0xffffff, 1 - g);
        b.line(gx - vx * L * 0.8 - nx, hy - vy * L * 0.8 - ny, gx - vx * L * 0.1 - nx, hy - vy * L * 0.1 - ny, 0.7 * sc, 0xffffff, 1 - g);
      }
    }
    if (t < B * 0.7) _burst(b, gx, hy, t / (B * 0.7), false, sc * 0.6);
    return;
  }
  final quake = kind == 'quake', life = quake ? _quakeSeconds : B, g = t / life;
  if (g < 1) {
    if (quake) {
      final R = (5 + 20 * g) * sc;
      b.ring(gx, gy, R, R * 0.45, 2.4 * sc * (1 - g) + 0.4, 0xd8c39a, 0.75 * (1 - g), 24);
      for (var i = 0; i < 5; i++) {
        final an = i * 1.256 + 0.4, r1 = 2.4 * sc, r2 = (5 + 4 * (i % 2)) * sc * math.min(1, g * 4);
        b.line(gx + math.cos(an) * r1, gy + math.sin(an) * r1 * 0.45, gx + math.cos(an) * r2, gy + math.sin(an) * r2 * 0.45, 0.9 * sc, 0x5a4a36, 0.75 * (1 - g));
      }
    }
    for (var i = 0; i < (quake ? 5 : 3); i++) {
      final an = i * 2.4 + 0.5, d = (3 + g * (quake ? 12 : 6)) * sc;
      b.ellipse(gx + math.cos(an) * d, gy - 1.5 * sc - g * 4 * sc + math.sin(an) * d * 0.3, (2.4 + g * 3) * sc, (1.3 + g * 1.5) * sc, 0xcdbb98, 0.6 * (1 - g));
    }
  }
  if (t < B) _burst(b, gx, hy, t / B, fx.big || quake, quake ? sc * 1.35 : sc);
}

void drawAura(TriBatch b, Unit unit, double alpha) {
  final i = unit.prevX + (unit.x - unit.prevX) * alpha, j = unit.prevY + (unit.y - unit.prevY) * alpha;
  final r = unit.stats.m('aura').d('radius');
  b.ring((i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H, r * TILE_HALF_W, r * TILE_HALF_H, 1, 0xf0b64a, 0.75, 40, 0, 2 * math.pi, 1);
}

void drawMoveMarker(TriBatch b, MoveMarker m) {
  final x = (m.i - m.j) * TILE_HALF_W * 1.0, y = (m.i + m.j) * TILE_HALF_H * 1.0, g = m.t / 0.8;
  b.ring(x, y, 7 + g * 5, 3.5 + g * 2.5, 1.4, m.attack ? 0xe0503c : 0xf3ead6, 1 - g, 24);
}

// آثار ضربات الأبطال: حلقة تتسع أو غبار
void drawUltFx(TriBatch b, Fx fx) {
  final x = (fx.x - fx.y) * TILE_HALF_W, y = (fx.x + fx.y) * TILE_HALF_H;
  final life = nations.m('fx').d('${fx.kind}Seconds'), g = fx.t / life;
  final col = hexRgb(fx.color.isEmpty ? '#e6c25a' : fx.color);
  if (fx.kind == 'ring') {
    final R = fx.r * (0.4 + 0.6 * g);
    b.ring(x, y, R * TILE_HALF_W, R * TILE_HALF_H, 1.6, col, 1 - g, 32);
  } else {
    for (var i = 0; i < 4; i++) {
      final an = i * 1.6 + 0.4, d = 2 + g * 6;
      b.ellipse(x + math.cos(an) * d, y - 2 - g * 3 + math.sin(an) * d * 0.4, 2.4 + g * 2.6, 1.3 + g * 1.4, 0xcdbb98, 0.6 * (1 - g));
    }
  }
}

// الراية المغروسة (drawZone في units.js): دائرة متقطعة بلون صاحبها وسارية براية تتموج
void drawZone(TriBatch b, Zone zone, double time) {
  final x = (zone.x - zone.y) * TILE_HALF_W, y = (zone.x + zone.y) * TILE_HALF_H;
  final fade = (zone.until - time).clamp(0.0, 1.0);
  if (fade <= 0) return;
  final col = hexRgb(zone.color);
  b.ring(x, y, zone.radius * TILE_HALF_W, zone.radius * TILE_HALF_H, 1.2, col, 0.85 * fade, 40, 0, 2 * math.pi, 1);
  b.line(x, y, x, y - 30, 1.2, 0x5a4632, fade);
  for (var k = 0; k < 5; k++) {
    final y0 = y - 29 + k * 2.4, wv = math.sin(time * 4 + k * 0.9) * 0.9;
    b.quad(x, y0, x - 13, y0 + wv, x - 13, y0 + 2.4 + wv, x, y0 + 2.4, k.isOdd ? 0xd9a83a : col, fade);
  }
  b.ellipse(x, y - 30, 1, 1, 0xc9a04a, fade, 6);
}

// تاج التلة في ملك الحي فوق علمها (ponytail: علامة بدل معلم التلة في الطبقة الثابتة، والمعلم مع التلميع في ن12)
void drawHillCrown(TriBatch b, double x, double y, double time, bool blocked) {
  final bob = math.sin(time * 2.2) * 0.8, yy = y - 34 + bob;
  b.ring(x, y, 16, 8, 1.4, blocked ? 0xe07060 : 0xffd34d, 0.75, 32, 0, 2 * math.pi, 1);
  b.quad(x - 6, yy, x + 6, yy, x + 6, yy - 3, x - 6, yy - 3, 0xf0c04a);
  b.tri(x - 6, yy - 3, x - 4, yy - 8, x - 2, yy - 3, 0xf0c04a);
  b.tri(x - 2, yy - 3, x, yy - 9.5, x + 2, yy - 3, 0xffd34d);
  b.tri(x + 2, yy - 3, x + 4, yy - 8, x + 6, yy - 3, 0xf0c04a);
  b.ellipse(x, yy - 1.5, 1, 1, 0xe05050, 1, 6);
}

// --- أحداث المدن ومزاياها (featureArt.js، مبسّطة): ما على الأرض تحت الجنود، وما فوقهم ---
// ponytail: علامات بأشكال بسيطة بدل رسم featureArt.js كله، والمخلوقات بشكل جندي مكبّر حتى تصل صورها المتحركة
const _cloudHues = [0xff4fa3, 0xffc23a, 0x4fd3ff, 0x8cff5a, 0xb36bff];
(double, double) _iso(double i, double j) => ((i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H);

void drawFeatureGround(TriBatch b, MatchState s, double time) {
  final ce = s.cityEvent, F = CITY_FEATURES;
  if (ce == null) return;
  final band = ce.band;
  if (band != null) {
    final w = F.m('flood').d('width') / 2, n = s.map.n.toDouble();
    final (ax, ay) = band.axis == 'i' ? _iso(band.c - w, 0) : _iso(0, band.c - w);
    final (bx, by) = band.axis == 'i' ? _iso(band.c + w, 0) : _iso(0, band.c + w);
    final (cx, cy) = band.axis == 'i' ? _iso(band.c + w, n) : _iso(n, band.c + w);
    final (dx, dy) = band.axis == 'i' ? _iso(band.c - w, n) : _iso(n, band.c - w);
    b.quad(ax, ay, bx, by, cx, cy, dx, dy, 0x3f8fd8, band.on ? 0.38 : 0.16);
  }
  for (final (cl, gray) in [(ce.clouds, false), (ce.ash, true)]) {
    if (cl == null) continue;
    for (final c in cl.list) {
      final (x, y) = _iso(c.x, c.y);
      b.ellipse(x, y, c.r * TILE_HALF_W, c.r * TILE_HALF_H, gray ? 0x5a5550 : _cloudHues[c.hue % _cloudHues.length], cl.on ? 0.32 : 0.14, 24);
    }
  }
  final fire = ce.fire;
  if (fire != null) {
    for (final id in fire.burning) {
      final d = s.map.districts[id];
      for (final (i, j) in d.tiles.take(6)) {
        final (x, y) = _iso(i.toDouble(), j.toDouble());
        final fl = 1 + 0.25 * math.sin(time * 9 + i * 1.7 + j);
        b.tri(x - 3 * fl, y, x, y - 9 * fl, x + 3 * fl, y, 0xf0702a, 0.85);
        b.tri(x - 1.5, y, x, y - 5 * fl, x + 1.5, y, 0xffd45a, 0.9);
      }
    }
  }
}

void drawFeatureOver(TriBatch b, MatchState s, double time) {
  final F = CITY_FEATURES, tick = (s.time / TICK_SEC).round();
  final fr = F.m('fireworks').d('radius');
  for (final f in s.fireworks) {
    final (x, y) = _iso(f.x, f.y);
    if (!f.done) {
      final pulse = 0.6 + 0.4 * math.sin(time * 8);
      b.ring(x, y, fr * TILE_HALF_W, fr * TILE_HALF_H, 1.4, 0xe03a2a, 0.9 * pulse, 40, 0, 2 * math.pi, 1);
    } else {
      final g = ((tick - f.at) * TICK_SEC / F.m('fireworks').d('fade')).clamp(0.0, 1.0);
      for (var k = 0; k < 10; k++) {
        final a = k * math.pi / 5, r = 6 + 22 * g;
        b.ellipse(x + math.cos(a) * r, y - 14 + math.sin(a) * r * 0.6, 1.6, 1.6, k.isEven ? 0xffd45a : 0xff5a8a, 1 - g, 6);
      }
    }
  }
  final ce = s.cityEvent;
  if (ce == null) return;
  final lr = F.m('lightning').d('radius');
  for (final bolt in ce.bolts) {
    final (x, y) = _iso(bolt.x, bolt.y);
    if (!bolt.done) {
      b.ring(x, y, lr * TILE_HALF_W, lr * TILE_HALF_H, 1.2, 0x7ab8ff, 0.85, 32, 0, 2 * math.pi, 1);
    } else {
      final g = ((tick - bolt.at) * TICK_SEC / F.m('lightning').d('fade')).clamp(0.0, 1.0);
      b.line(x + 4, y - 70, x - 3, y - 35, 2, 0xe8f2ff, 1 - g);
      b.line(x - 3, y - 35, x, y, 2, 0xe8f2ff, 1 - g);
    }
  }
  final q = ce.quake;
  if (q != null) {
    final (x, y) = _iso(q.x, q.y);
    final qr = F.m('quake').d('radius');
    b.ring(x, y, qr * TILE_HALF_W, qr * TILE_HALF_H, 1.4, 0xe03a2a, q.on ? 0.5 : 0.9, 36, 0, 2 * math.pi, 1);
  }
  final c = ce.chest;
  if (c != null) {
    final (x, y) = _iso(c.i.toDouble(), c.j.toDouble());
    b.quad(x - 5, y - 2, x + 5, y - 2, x + 5, y - 9, x - 5, y - 9, 0xb07a22);
    b.quad(x - 5, y - 9, x + 5, y - 9, x + 4, y - 12, x - 4, y - 12, 0xe2b55a);
    b.ellipse(x, y - 14 + math.sin(time * 4), 1.4, 1.4, 0xffffff, 0.9, 6);
    if (c.holder >= 0) b.ring(x, y, 9, 4.5, 1.6, 0xffd34d, 1, 32, -math.pi / 2, -math.pi / 2 + 2 * math.pi * c.since / F.m('treasure').d('hold'));
  }
  final sv = ce.silver;
  if (sv != null) {
    for (final (i, j) in sv.pieces) {
      final (x, y) = _iso(i.toDouble(), j.toDouble());
      final yy = y - 6 + math.sin(time * 3 + i) * 1.5;
      b.quad(x, yy - 4, x + 3, yy, x, yy + 4, x - 3, yy, 0xdfe6ee);
    }
  }
}

// علامة مكان مهمة القصة (storyArt.js): حلقة ذهبية نابضة وسهم فوقها
void drawStoryMarker(TriBatch b, double i, double j, double r, double time) {
  final (x, y) = _iso(i, j);
  final k = 1 + 0.06 * math.sin(time * 3);
  b.ring(x, y, r * TILE_HALF_W * k, r * TILE_HALF_H * k, 1.6, 0xffd34d, 0.85, 40, 0, 2 * math.pi, 1);
  final yy = y - 30 + math.sin(time * 4) * 2;
  b.tri(x - 4, yy - 6, x + 4, yy - 6, x, yy, 0xffd34d);
  b.quad(x - 1.5, yy - 12, x + 1.5, yy - 12, x + 1.5, yy - 6, x - 1.5, yy - 6, 0xffd34d);
}

// هالة المبنى المميز بلون ميزته ونجوم تدور عليها (drawFeatureHalo في featureArt.js)، على الأرض تحت المبنى فيغطي
// المبنى ما خلفه منها
void drawFeatureHalos(TriBatch b, MatchState s, double time) {
  final F = CITY_FEATURES, H = F.m('halo'), n = s.map.n;
  for (final d in s.map.districts) {
    final t = d.featureTile, f = d.feature;
    if (t == null || f == null) continue;
    final col = F.m('colors').ss(f);
    if (col == null) continue;
    final p = col.split(',').map(int.parse).toList(), rgb = (p[0] << 16) | (p[1] << 8) | p[2];
    final (x, y0) = _iso((t % n).toDouble(), (t ~/ n).toDouble());
    final k = d.featureBig ? 1.0 : 0.55, y = d.featureBig ? y0 - TILE_HALF_H : y0;
    final rx = H.d('radius') * TILE_HALF_W * k, ry = H.d('radius') * TILE_HALF_H * k;
    final pulse = 1 - H.d('pulse') + H.d('pulse') * (0.5 + 0.5 * math.sin(time * H.d('speed') + d.id));
    b.ellipse(x, y, rx, ry, rgb, 0.08 * pulse, 32);
    b.ring(x, y, rx, ry, H.d('glow'), rgb, H.d('glowAlpha') * pulse, 40);
    b.ring(x, y, rx, ry, H.d('width'), rgb, H.d('alpha') * pulse, 40);
    final r = H.d('sparkleR');
    for (var m = 0; m < H.i('sparkles'); m++) {
      final a = time * H.d('sparkleSpeed') + m * 2 * math.pi / H.i('sparkles') + d.id;
      final sx = x + math.cos(a) * rx, sy = y + math.sin(a) * ry;
      b.quad(sx, sy - r * 2, sx + r * 0.5, sy, sx, sy + r * 2, sx - r * 0.5, sy, 0xfff8e1, 0.6 + 0.4 * pulse);
      b.quad(sx - r * 2, sy, sx, sy - r * 0.5, sx + r * 2, sy, sx, sy + r * 0.5, 0xfff8e1, 0.6 + 0.4 * pulse);
    }
  }
}

// صرة التاجر فوق رأسه (cargo في featureArt.js): قماش مربوط بحبل
void drawCargo(TriBatch b, double x, double y) {
  b.ellipse(x, y - 25, 4.2, 3.2, 0xb88a4a, 1, 14);
  b.ellipse(x - 1, y - 26, 2.4, 1.6, 0xd4a868, 1, 10);
  b.line(x - 1.2, y - 28.5, x + 1.2, y - 28.5, 1, 0x6a4a2e);
}
