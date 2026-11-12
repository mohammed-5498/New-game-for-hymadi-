// ضباب الحرب (بطلب المستخدم، 2026-11-12، مثل Age of Empires II): ما لم يُستكشف أسود، وما استُكشف ولا يُرى الآن
// معتم يخفي مبانيه وأعداؤه مخفيون، وما يرصده جنودك وأحياؤك (وحلفاؤك) واضح بحافة ناعمة مستديرة.
// الرسم: طبقة واحدة فوق المدينة، فيها لكل مربع على الشاشة شكله مرفوعاً بارتفاع ما عليه وعرضه (CityLayer.lift وwide)،
// من الخلف إلى الأمام بنمط src: الأمامي يحل محل ما خلفه فلا يتراكم الضباب بقعاً، والمبنى الظاهر أمام الضباب واضح كله
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import '../config.dart' show FOG;
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/state.dart';

class Fog {
  final int n, me;
  final Uint8List seen, now;            // لكل مربع: المستكشف، وما يُرى الآن
  final Float32List vis, dark;          // لكل ركن بين المربعات ((n+1)²): الرؤية (0-1) والعتمة المرسومة
  Float32List lift, wide;               // ارتفاع ما على كل مربع ونصف عرضه (من CityLayer، ويتبدلان معها)
  double _at = -1;
  Float32List _pos = Float32List(0);
  Int32List _col = Int32List(0);
  static final _src = ui.Paint()..blendMode = ui.BlendMode.src;
  static final _layer = ui.Paint()..imageFilter = ui.ImageFilter.blur(sigmaX: FOG.blur, sigmaY: FOG.blur);
  Fog(this.n, this.me, this.lift, this.wide)
      : seen = Uint8List(n * n), now = Uint8List(n * n), vis = Float32List((n + 1) * (n + 1)), dark = Float32List((n + 1) * (n + 1));

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
    final m = n + 1, soft = FOG.soft;
    vis.fillRange(0, vis.length, 0);
    // رصد الجنود: دائرة حول كل جندي، وحافتها تتدرج على soft (الركن (a, b) في الموضع (a − ½, b − ½))
    for (final u in s.units) {
      if (u.state == 'dead' || !friendly(s, u.playerId)) continue;
      final r = math.max(FOG.unitSight, u.stats.dz('visionRange')), reach = r + soft / 2;
      final b0 = math.max(0, (u.y + 0.5 - reach).floor()), b1 = math.min(n, (u.y + 0.5 + reach).ceil());
      final a0 = math.max(0, (u.x + 0.5 - reach).floor()), a1 = math.min(n, (u.x + 0.5 + reach).ceil());
      for (var b = b0; b <= b1; b++) {
        final dy = b - 0.5 - u.y;
        for (var a = a0; a <= a1; a++) {
          final dx = a - 0.5 - u.x, d = math.sqrt(dx * dx + dy * dy);
          final v = ((r - d) / soft + 0.5).clamp(0.0, 1.0), c = b * m + a;
          if (v > vis[c]) vis[c] = v;
        }
      }
    }
    // أحياؤك وأحياء حلفائك بمناطقها (مربعاتها والشوارع الأقرب إليها)
    final area = s.map.areaAt;
    if (area != null) {
      for (var k = 0; k < area.length; k++) {
        final id = area[k];
        if (id < 0) continue;
        final owner = s.map.districts[id].owner;
        if (owner == null || !friendly(s, owner)) continue;
        final i = k % n, j = k ~/ n;
        vis[j * m + i] = vis[j * m + i + 1] = vis[(j + 1) * m + i] = vis[(j + 1) * m + i + 1] = 1;
      }
    }
    // المربع يُرى إن كان متوسط أركانه نصفاً فأكثر، ويُستكشف معه
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        final k = j * n + i, v = vis[j * m + i] + vis[j * m + i + 1] + vis[(j + 1) * m + i] + vis[(j + 1) * m + i + 1];
        now[k] = v >= 2 ? 1 : 0;
        if (now[k] == 1) seen[k] = 1;
      }
    }
    // عتمة الركن: لا شيء فيما يُرى، وexplored فيما استُكشف، وسواد فيما لم يُستكشف، وتتدرج بين الثلاثة
    final dim = FOG.explored;
    for (var b = 0; b <= n; b++) {
      for (var a = 0; a <= n; a++) {
        var known = 0, all = 0;
        for (final (i, j) in [(a - 1, b - 1), (a, b - 1), (a - 1, b), (a, b)]) {
          if (i < 0 || j < 0 || i >= n || j >= n) continue;
          all++;
          known += seen[j * n + i];
        }
        final c = b * m + a, base = all == 0 ? 1.0 : dim + (1 - dim) * (1 - known / all);
        dark[c] = (1 - vis[c]) * base;
      }
    }
  }

  // الطبقة كلها بين حدود الشاشة (بوحدات العالم)، من الصف الخلفي إلى الأمامي
  void paint(ui.Canvas canvas, double left0, double right0, double top0, double bottom0) {
    const hw = TILE_HALF_W, hh = TILE_HALF_H;
    final m = n + 1, minLift = FOG.minLift, pad = 3 * FOG.blur + hw;   // ما يسحبه التنعيم من خارج الشاشة
    final left = left0 - pad, right = right0 + pad, top = top0 - pad, bottom = bottom0 + pad;
    final d0 = ((top - hh) / hh).floor(), d1 = ((bottom + 160) / hh).ceil();
    var v = 0, any = false;
    void grow(int more) {
      if (v + more <= _col.length) return;
      final cap = math.max(_col.length * 2, v + more + 1024);
      _pos = Float32List(cap * 2)..setRange(0, v * 2, _pos);
      _col = Int32List(cap)..setRange(0, v, _col);
    }
    int argb(double a) => ((a.clamp(0.0, 1.0) * 255).round() << 24).toSigned(32);
    void tri(double x1, double y1, double a1, double x2, double y2, double a2, double x3, double y3, double a3) {
      final o = v * 2;
      _pos[o] = x1; _pos[o + 1] = y1; _pos[o + 2] = x2; _pos[o + 3] = y2; _pos[o + 4] = x3; _pos[o + 5] = y3;
      _col[v] = argb(a1); _col[v + 1] = argb(a2); _col[v + 2] = argb(a3);
      v += 3;
    }
    // ومعها حلقة سوداء خارج الخريطة (out مربعات) حتى لا يسحب التنعيم ضوء حافتها إلى الضباب
    const out = 3;
    for (var d = d0; d <= d1; d++) {
      final y = d * hh;
      for (var i = math.max(-out, d - n + 1 - out); i <= math.min(d + out, n - 1 + out); i++) {
        final j = d - i, x = (i - j) * hw;
        if (j < -out || j > n - 1 + out) continue;
        final inside = i >= 0 && j >= 0 && i < n && j < n, k = inside ? j * n + i : -1, w = inside ? wide[k] : hw;
        if (x + w < left || x - w > right) continue;
        final aT = inside ? dark[j * m + i] : 1.0, aR = inside ? dark[j * m + i + 1] : 1.0;
        final aB = inside ? dark[(j + 1) * m + i + 1] : 1.0, aL = inside ? dark[(j + 1) * m + i] : 1.0;
        if (inside && aT + aR + aB + aL > 0) any = true;
        final t = y - hh - (inside ? math.max(lift[k], minLift) : minLift);
        grow(9);
        // أرض المربع، ثم ما فوقه مستطيل بعرض صورته حتى أعلاها (المداخن وأطراف السطح والمبنى الأعرض من مربعه)
        tri(x - hw, y, aL, x, y + hh, aB, x + hw, y, aR);
        tri(x - w, y, aL, x + w, y, aR, x + w, t, aR);
        tri(x - w, y, aL, x + w, t, aR, x - w, t, aL);
      }
    }
    if (!any || v == 0) return;   // كل ما على الشاشة ظاهر
    final verts = ui.Vertices.raw(ui.VertexMode.triangles, Float32List.sublistView(_pos, 0, v * 2), colors: Int32List.sublistView(_col, 0, v));
    // والطبقة تُنعَّم كلها (blur بوحدات العالم) فتختفي حواف المربعات وتصير الحافة ضباباً
    canvas.saveLayer(ui.Rect.fromLTRB(left - hw, top - 200, right + hw, bottom + 200), _layer);
    canvas.drawVertices(verts, ui.BlendMode.dst, _src);
    canvas.restore();
    verts.dispose();
  }
}
