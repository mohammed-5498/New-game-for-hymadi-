// علامات الاقتصاد والأعلام فوق المدينة (js/render/empireArt.js وdrawFlagArrows في renderer.js):
// - هالة ذهبية حول كل قاعدة تقوى بتطورها، وحلقة علاج خضراء حول المستشفى المرقّى مداه (على الأرض)
// - سهام أبراج الرماية من أعلى البرج إلى هدفها
// - شارة كل مبنى على سارية فوق سطحه: تاج للقاعدة، وقوس وسهم للبرج، وهلال أو صليب للمستشفى، بحلقة بلون صاحبه
// - شريط الإنتاج ونقطة لكل طلب فوق مبانيك التي في طابورها طلبات، ودائرة مدى المبنى المفتوحة قائمته، وراية مكان الإنتاج
// - سهم ذهبي يلمع ويتمايل فوق كل علم حي
import 'dart:math' as math;

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/empire.dart';
import '../game/features.dart';
import '../game/modes.dart' show modeOf;
import '../game/state.dart';
import '../map/generator.dart';
import '../map/sizes.dart';
import 'batch.dart';
import 'city_art.dart';

final J _E = EMPIRE;
const _sqrt2 = 1.4142135623730951;
(double, double) _w(num i, num j) => ((i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H);
int _rgb(String s) => hexRgb(s.startsWith('#') ? s : '#000000');
int _rgbList(String s) { final p = s.split(',').map((v) => int.parse(v.trim())).toList(); return (p[0] << 16) | (p[1] << 8) | p[2]; }

// مستوى تطور القاعدة: إنتاجها وترقيات جنود مالكها (hqTier في empireBuildings.js)
int hqTier(MatchState s, District d) {
  final e = s.empire;
  if (e == null || d.owner == null) return 0;
  final V = _E.m('evolve'), lv = e.levels[d.owner!];
  final score = (d.blv['production'] ?? 0) + V.d('gangWeight') * (lv['hp'] + lv['damage'] + lv['armor'] + lv['speed']);
  return V.l('hqTiers').where((t) => score >= (t as num)).length;
}

// --- على الأرض قبل الجنود ---
void drawEmpireHalos(TriBatch b, MatchState s, double time) {
  if (!s.economy) return;
  final H = _E.m('baseHalo'), V = _E.m('evolve'), A = V.m('aura');
  final pulse = 1 - H.d('pulse') + H.d('pulse') * (0.5 + 0.5 * math.sin(time * H.d('speed')));
  final rx = H.d('radius') * TILE_HALF_W * _sqrt2, ry = H.d('radius') * TILE_HALF_H * _sqrt2;
  for (final d in s.map.districts) {
    final bt = d.buildTile;
    if (bt == null || d.building == null) continue;
    final (x, y) = _w(bt % s.map.n, bt ~/ s.map.n);
    if (d.building == 'hospital' && (d.blv['radius'] ?? 0) > 0) {
      final r = hospitalStats(d).radius, beat = 1 - A.d('pulse') + A.d('pulse') * (0.5 + 0.5 * math.sin(time * A.d('speed')));
      b.ring(x, y, r * TILE_HALF_W * _sqrt2, r * TILE_HALF_H * _sqrt2, A.d('width'), _rgbList(A.s('color')),
          math.min(1, A.d('alpha') * d.blv['radius']! * beat), 40);
      continue;
    }
    if (d.building != 'hq') continue;
    final grow = 1 + V.d('haloGrow') * hqTier(s, d);
    b.ring(x, y, rx, ry, H.d('glow') * grow, 0xffc846, math.min(1, H.d('glowAlpha') * pulse * grow), 40);
    b.ring(x, y, rx, ry, H.d('width') * grow, 0xffda69, math.min(1, H.d('alpha') * pulse * grow), 40);
  }
}

// --- سهام الأبراج ---
void drawEmpireShots(TriBatch b, MatchState s, double alpha, [bool Function(Unit)? show]) {
  final e = s.empire;
  if (e == null || e.shots.isEmpty) return;
  for (final shot in e.shots) {
    if (show != null && !show(shot.target)) continue;   // ضباب الحرب
    final t = math.min(1.0, (shot.prevT + (shot.t - shot.prevT) * alpha) / shot.duration);
    final (fx, fy0) = _w(shot.i, shot.j);
    final fy = fy0 - (shot.top != 0 ? shot.top : _E.m('arrow').d('top'));
    final u = shot.target, ti = u.prevX + (u.x - u.prevX) * alpha, tj = u.prevY + (u.y - u.prevY) * alpha;
    final (tx, ty0) = _w(ti, tj);
    final ty = ty0 - 8, arc = math.sin(t * math.pi) * 6;
    final x = fx + (tx - fx) * t, y = fy + (ty - fy) * t - arc;
    var vx = tx - fx, vy = ty - fy - math.cos(t * math.pi) * math.pi * 6;
    final n = math.sqrt(vx * vx + vy * vy);
    vx = vx / (n == 0 ? 1 : n) * 3; vy = vy / (n == 0 ? 1 : n) * 3;
    b.line(x - vx, y - vy, x + vx, y + vy, 1, 0x3b2a18);
  }
}

// --- الأعلام: سهم ذهبي فوق كل علم (لا التلة) ---
void drawFlagArrows(TriBatch b, MatchState s, double time, double left, double right, double top, double bottom,
    [bool Function(double, double)? known]) {
  final M = CAPTURE.m('flagMark'), A = M.m('arrow');
  final pulse = M.d('pulseMin') + (1 - M.d('pulseMin')) * (0.5 + 0.5 * math.sin(time * M.d('pulseSpeed')));
  final hill = s.mode == 'king' && s.modeState != null ? modeOf(s).hillId : -1;
  final half = math.max(A.d('half'), A.d('minScreen') / s.camera.z), bob = math.sin(time * A.d('bobSpeed')) * A.d('bob');
  final glow = _rgbList(M.s('glow')), core = _rgb(M.s('color'));
  for (final d in s.map.districts) {
    final c = d.capture;
    if (c == null || d.id == hill || (known != null && !known(c.i.toDouble(), c.j.toDouble()))) continue;
    final (x, y) = _w(c.i, c.j);
    if (x < left || x > right || y < top || y > bottom) continue;
    final tip0 = y - A.d('lift') + bob, cy = tip0 - half * 1.15;
    void arrow(double k, int rgb, double al) {
      final ks = half * k, tip = cy + (tip0 - cy) * k, neck = tip - ks * 1.1, end = tip - ks * 2.3, w = ks * 0.38;
      b.tri(x, tip, x + ks, neck, x - ks, neck, rgb, al);
      b.quad(x - w, neck, x + w, neck, x + w, end, x - w, end, rgb, al);
    }
    arrow(A.d('glowScale'), glow, A.d('glowAlpha') * pulse);
    arrow(A.d('edgeScale'), 0x462d08, 0.85);
    arrow(1, core, 1);
  }
}

// --- الشارات والطابور والمدى والراية: فوق طبقة الليل لتُقرأ دائماً ---
// أعلى سطح المبنى في العالم (من صورته في الأطلس)
double _roofTop(MatchState s, CityArt art, District d, double y) {
  final sp = art.economy(d.building!, sizeOf(d));
  return sp == null ? y - 30 : y - sp.ay / art.px;
}

// مكان الشارة: (x، أعلى السطح، مركز القرص، نصف قطره)
(double, double, double, double) badgeOf(MatchState s, CityArt art, District d) {
  final B = _E.m('badge');
  final (x, y) = _w(d.buildTile! % s.map.n, d.buildTile! ~/ s.map.n);
  final top = _roofTop(s, art, d, y), r = math.max(B.d('radius'), B.d('minScreen') / s.camera.z);
  return (x, top, top - B.d('pole') - r, r);
}

const _medicRed = 0xd0322a, _medicWhite = 0xfbf8f1;
const _crescent = ['arab', 'yamamah', 'diriyah', 'shibam', 'cairo', 'kano', 'meroe'];   // MEDIC.crescent

void _icon(TriBatch b, String kind, double x, double y, double s, String city) {
  if (kind == 'hq') {                          // تاج ذهبي بثلاث شُرَف وجواهر
    b.rect(x - s, y + s * 0.1, s * 2, s * 0.5, 0xffd34d);
    b.tri(x - s, y + s * 0.1, x - s, y - s * 0.35, x - s * 0.5, y + s * 0.1, 0xffd34d);
    b.tri(x - s * 0.5, y + s * 0.1, x, y - s * 0.7, x + s * 0.5, y + s * 0.1, 0xffd34d);
    b.tri(x + s * 0.5, y + s * 0.1, x + s, y - s * 0.35, x + s, y + s * 0.1, 0xffd34d);
    for (final (dx, dy) in const [(-1.0, -0.35), (0.0, -0.7), (1.0, -0.35)]) { b.ellipse(x + dx * s, y + dy * s, s * 0.17, s * 0.17, 0xc0392b, 1, 8); }
    b.rect(x - s, y + s * 0.3, s * 2, s * 0.3, 0x78500a, 0.55);
  } else if (kind == 'tower') {                // قوس مشدود وسهم
    final cx = x - s * 0.55, R = s * 1.05;
    b.ring(cx, y, R, R, s * 0.24, 0xe0b04a, 1, 10, -1.1, 1.1);
    final bx = cx + math.cos(1.1) * R, by = math.sin(1.1) * R;
    b.line(bx, y - by, cx, y, s * 0.09, 0xf3ece0);
    b.line(cx, y, bx, y + by, s * 0.09, 0xf3ece0);
    b.line(x - s * 0.75, y, x + s * 0.75, y, s * 0.13, 0xf3ece0);
    b.tri(x + s * 1.05, y, x + s * 0.6, y - s * 0.28, x + s * 0.6, y + s * 0.28, 0xf3ece0);
  } else {                                     // الهلال الأحمر أو الصليب الأحمر حسب المدينة
    final r = s * 1.2;
    b.ellipse(x, y, r, r, _medicWhite, 1, 16);
    b.ring(x, y, r, r, r * 0.16, _medicRed, 1, 16);
    if (_crescent.contains(city)) {
      b.ellipse(x - r * 0.08, y, r * 0.62, r * 0.62, _medicRed, 1, 14);
      b.ellipse(x + r * 0.18, y - r * 0.08, r * 0.5, r * 0.5, _medicWhite, 1, 14);
    } else {
      b.rect(x - r * 0.18, y - r * 0.6, r * 0.36, r * 1.2, _medicRed);
      b.rect(x - r * 0.6, y - r * 0.18, r * 1.2, r * 0.36, _medicRed);
    }
    b.ring(x, y, s * 0.98, s * 0.98, s * 0.14, 0xffffff, 0.75, 6, 3.6, 4.9);
  }
}

// مدى المبنى المفتوحة قائمته: (i، j، المدى، يرمي؟) أو null
(double, double, double, bool)? _rangeOf(MatchState s, District d) {
  if ((d.building == 'tower' || d.building == 'hospital') && d.buildTile != null) {
    final i = (d.buildTile! % s.map.n).toDouble(), j = (d.buildTile! ~/ s.map.n).toDouble();
    return d.building == 'tower' ? (i, j, towerStats(d, s).range, true) : (i, j, hospitalStats(d).radius, false);
  }
  if (d.featureTile == null) return null;
  final (ci, cj) = featureCenter(s.map, d);
  if (d.feature == 'fortress' || d.feature == 'khartoum') return (ci, cj, featureTowerStats(d, s).range, true);
  if (d.feature == 'clinic') return (ci, cj, clinicStats(d).radius, false);
  if (d.feature == 'pyramid') return (ci, cj, CITY_FEATURES.m('pyramid').d('radius'), false);
  return null;
}

void drawEmpireMarks(TriBatch b, MatchState s, CityArt art, int? openDistrict, double left, double right, double top, double bottom,
    [bool Function(double, double)? known]) {
  final e = s.empire;
  if (!s.economy || e == null) return;
  final z = s.camera.z, B = _E.m('badge'), n = s.map.n;
  bool seen(double x, double y) => x > left && x < right && y > top && y < bottom + 60;
  // الشارات لكل مبنى ظاهر في كل الأحياء (لك ولخصومك)
  for (final d in s.map.districts) {
    if (d.building == null || d.buildTile == null) continue;
    if (known != null && !known((d.buildTile! % n).toDouble(), (d.buildTile! ~/ n).toDouble())) continue;   // ضباب الحرب
    final (x, roof, cy, r) = badgeOf(s, art, d);
    if (!seen(x, roof)) continue;
    b.line(x, roof + 1, x, cy + r, math.max(1.1, 1.6 / z), 0x2b2825);
    b.ellipse(x, cy, r, r, 0x20170d, 0.9, 18);
    b.ring(x, cy, r, r, r * 0.24, d.owner != null ? hexRgb(s.players[d.owner!].color) : _rgb(B.s('neutral')), 1, 18);
    _icon(b, d.building!, x, cy, r * 0.6, s.map.city);
  }
  // شريط الإنتاج ونقاط الطابور فوق مبانيك (والتجنيد في المباني المميزة فوقها)
  e.queues.forEach((id, queue) {
    final d = s.map.districts[id];
    if (queue.isEmpty || d.owner != s.humanId) return;
    double x, barTop;
    if (d.building != null && d.buildTile != null) {
      final (bx, _, cy, r) = badgeOf(s, art, d);
      x = bx; barTop = cy - r - 4;
    } else if (d.featureTile != null && d.feature != null) {
      final (fx, fy0) = _w(d.featureTile! % n, d.featureTile! ~/ n);
      final sp = art.find('feature', d.feature!), k = d.featureBig ? 1.0 : 0.55;
      x = fx; barTop = (sp == null ? fy0 - 40 : fy0 + (d.featureBig ? 0 : TILE_HALF_H * k) - sp.ay / art.px * k) - 6;
    } else {
      return;
    }
    if (!seen(x, barTop)) return;
    final h = math.max(2.2, 3 / z), y0 = barTop - h, w = 22.0;
    final item = queue.first, done = math.min(1.0, item.t / productionTime(s, d, item.kind));
    b.rect(x - w / 2 - 0.6, y0 - 0.6, w + 1.2, h + 1.2, 0x140e08, 0.75);
    b.rect(x - w / 2, y0, w * done, h, 0xe8c45a);
    final r = math.max(1.2, 1.6 / z * 1.4);
    for (var k = 0; k < queue.length; k++) {
      final row = k ~/ 5, inRow = math.min(5, queue.length - row * 5);
      b.ellipse(x - (inRow - 1) * r * 1.4 + (k % 5) * r * 2.8, y0 - r * 2 - row * r * 2.6, r, r, 0xe8c45a, k == 0 ? 1 : 0.55, 10);
    }
  });
  // مدى المبنى المفتوحة قائمته (متقطعاً)
  final open = openDistrict != null ? s.map.districts[openDistrict] : null;
  final ranged = open == null ? null : _rangeOf(s, open);
  if (ranged != null) {
    final (x, y) = _w(ranged.$1, ranged.$2);
    final r = ranged.$3;
    b.ring(x, y, r * TILE_HALF_W * _sqrt2, r * TILE_HALF_H * _sqrt2, 1.4 / z * 1.6, ranged.$4 ? 0xe8c45a : 0x78dc8c, 0.85, 64, 0, 2 * math.pi, 2);
  }
  // مكان إنتاج قواعدك: راية بلونك، وخط متقطع إليها من القاعدة المفتوحة قائمتها
  final me = s.humanId >= 0 ? hexRgb(s.players[s.humanId].color) : 0xffffff;
  for (final d in s.map.districts) {
    final rally = d.building == 'hq' && d.owner == s.humanId && d.rally != null && d.rally!.owner == s.humanId ? d.rally : null;
    if (rally == null) continue;
    final (tx, ty) = _w(rally.k % n, rally.k ~/ n);
    if (identical(d, open) && d.buildTile != null) {
      final (fx, fy) = _w(d.buildTile! % n, d.buildTile! ~/ n);
      final len = math.sqrt((tx - fx) * (tx - fx) + (ty - fy) * (ty - fy)), steps = (len / 6).floor();
      for (var k = 0; k < steps; k += 2) {
        final a = k / steps, c = math.min(1.0, (k + 1) / steps);
        b.line(fx + (tx - fx) * a, fy + (ty - fy) * a, fx + (tx - fx) * c, fy + (ty - fy) * c, 1.4 / z * 1.6, 0xe8c45a, 0.8);
      }
    }
    if (!seen(tx, ty)) continue;
    final k = math.max(1.0, 1.6 / z);
    b.ellipse(tx, ty, 5 * k, 2.5 * k, 0x140e08, 0.45, 12);
    b.line(tx, ty, tx, ty - 16 * k, 1.4 * k, 0x3a2a1a);
    b.tri(tx, ty - 16 * k, tx + 9 * k, ty - 13 * k, tx, ty - 10 * k, me);
  }
}
