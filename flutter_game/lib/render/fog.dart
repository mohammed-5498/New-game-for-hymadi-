// ضباب الحرب (بطلب المستخدم، 2026-11-12، مثل Age of Empires II): ما لم يُستكشف أسود، وما استُكشف ولا يُرى الآن
// أغمق وأعداؤه مخفيون، وما يراه جنودك وأحياؤك (وحلفاؤك) واضح. للرسم وحده: المحاكاة والبوتات لا تراه، فالتطابق كما هو.
// يُرسم مع كل صف عمق بعد ما عليه (الأرض والزينة والمباني والجنود): مربعه مرفوعاً بارتفاع ما عليه (CityLayer.lift)،
// وعتمة كل ركن متوسط المربعات الأربعة حوله فتنعم الحافة
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import '../config.dart' show FOG;
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/state.dart';
import 'batch.dart';

class Fog {
  final int n, me;
  final Uint8List seen, now;            // المستكشف، وما يُرى الآن
  Float32List lift, wide;               // ارتفاع ما على كل مربع ونصف عرضه (من CityLayer، ويتبدلان معها)
  final Float32List corner;             // عتمة كل ركن بين المربعات ((n+1)²)
  double _at = -1;
  Fog(this.n, this.me, this.lift, this.wide) : seen = Uint8List(n * n), now = Uint8List(n * n), corner = Float32List((n + 1) * (n + 1));

  bool friendly(MatchState s, int pid) {
    if (pid == me) return true;
    final a = s.players[pid].team;
    return a != 0 && a == s.players[me].team;
  }

  // هل يُرى الموضع (بإحداثيات المربعات) الآن؟ وهل استُكشف؟
  bool sees(double i, double j) {
    final a = jsRound(i), b = jsRound(j);
    return a >= 0 && b >= 0 && a < n && b < n && now[b * n + a] == 1;
  }
  bool known(double i, double j) {
    final a = jsRound(i), b = jsRound(j);
    return a >= 0 && b >= 0 && a < n && b < n && seen[b * n + a] == 1;
  }

  // المستكشف من مباراة محفوظة
  void restore(String? text) {
    if (text == null) return;
    try {
      final bytes = base64Decode(text);
      if (bytes.length == seen.length) seen.setAll(0, bytes);
    } catch (_) {}
  }
  String save() => base64Encode(seen);

  void update(MatchState s, {bool force = false}) {
    if (!force && s.time - _at < FOG.every && s.time >= _at) return;
    _at = s.time;
    now.fillRange(0, now.length, 0);
    // أحياؤك وأحياء حلفائك بمناطقها (مربعاتها والشوارع الأقرب إليها)
    final area = s.map.areaAt;
    if (area != null) {
      for (var k = 0; k < area.length; k++) {
        final id = area[k];
        if (id < 0) continue;
        final owner = s.map.districts[id].owner;
        if (owner != null && friendly(s, owner)) now[k] = 1;
      }
    }
    // رصد الجنود
    for (final u in s.units) {
      if (u.state == 'dead' || !friendly(s, u.playerId)) continue;
      final r = math.max(FOG.unitSight, u.stats.dz('visionRange')), r2 = r * r;
      final j0 = math.max(0, (u.y - r).floor()), j1 = math.min(n - 1, (u.y + r).ceil());
      final i0 = math.max(0, (u.x - r).floor()), i1 = math.min(n - 1, (u.x + r).ceil());
      for (var j = j0; j <= j1; j++) {
        final dj = j - u.y;
        for (var i = i0; i <= i1; i++) {
          final di = i - u.x;
          if (di * di + dj * dj <= r2) now[j * n + i] = 1;
        }
      }
    }
    for (var k = 0; k < now.length; k++) { if (now[k] == 1) seen[k] = 1; }
    final dim = FOG.explored, m = n + 1;
    double tile(int i, int j) { final k = j * n + i; return now[k] == 1 ? 0 : seen[k] == 1 ? dim : 1; }
    for (var b = 0; b <= n; b++) {
      for (var a = 0; a <= n; a++) {
        var sum = 0.0, c = 0;
        if (a > 0 && b > 0) { sum += tile(a - 1, b - 1); c++; }
        if (a < n && b > 0) { sum += tile(a, b - 1); c++; }
        if (a > 0 && b < n) { sum += tile(a - 1, b); c++; }
        if (a < n && b < n) { sum += tile(a, b); c++; }
        corner[b * m + a] = sum / c;
      }
    }
  }

  // ضباب صف العمق d (i + j = d) بين left وright من العالم
  void drawRow(TriBatch b, int d, double left, double right) {
    final i0 = math.max(0, d - n + 1), i1 = math.min(d, n - 1), m = n + 1;
    const hw = TILE_HALF_W, hh = TILE_HALF_H;
    for (var i = i0; i <= i1; i++) {
      final j = d - i, x = (i - j) * hw;
      if (x < left - hw || x > right + hw) continue;
      final aT = corner[j * m + i], aR = corner[j * m + i + 1], aB = corner[(j + 1) * m + i + 1], aL = corner[(j + 1) * m + i];
      if (aT + aR + aB + aL == 0) continue;
      final y = (i + j) * hh, h = lift[j * n + i], w = wide[j * n + i];
      b.triA(x - hw, y, aL, x, y + hh, aB, x + hw, y, aR, 0);
      if (h <= 0) { b.triA(x - hw, y, aL, x + hw, y, aR, x, y - hh, aT, 0); continue; }
      // ما فوق المربع مستطيل بعرض صورته حتى أعلاها (المداخن وأطراف السطح، والمبنى الأعرض من مربعه)
      final t = y - hh - h;
      b.triA(x - w, y, aL, x + w, y, aR, x + w, t, aR, 0);
      b.triA(x - w, y, aL, x + w, t, aR, x - w, t, aL, 0);
    }
  }
}
