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
import '../game/features.dart' show templeOwner, templeNumber;
import '../game/state.dart';

class Fog {
  final int n, me;
  final Uint8List seen, now;            // لكل مربع: المستكشف، وما يُرى الآن
  final Float32List vis, dark;          // لكل ركن بين المربعات ((n+1)²): الرؤية (0-1) والعتمة المرسومة
  Float32List lift, wide;               // ارتفاع ما على كل مربع ونصف عرضه (من CityLayer، ويتبدلان معها)
  double _at = -1;
  static final _src = ui.Paint()..blendMode = ui.BlendMode.src;
  static final _layer = ui.Paint()..imageFilter = ui.ImageFilter.blur(sigmaX: FOG.blur, sigmaY: FOG.blur);
  Fog(this.n, this.me, this.lift, this.wide)
      : seen = Uint8List(n * n), now = Uint8List(n * n), vis = Float32List((n + 1) * (n + 1)), dark = Float32List((n + 1) * (n + 1));

  // لا تُدمج هذه الثلاث في من يستدعيها (2.2.2): مترجم Dart كان يرفع قراءة n وseen وطول seen من داخل الحلقة إلى قبلها،
  // قبل فحص fog != null، فإذا كان الضباب مطفأً (fog = null) قرأ عنواناً عشوائياً وأُغلقت اللعبة في أول إطار
  @pragma('vm:never-inline')
  bool friendly(MatchState s, int pid) {
    if (pid == me) return true;
    final a = s.players[pid].team;
    return a != 0 && a == s.players[me].team;
  }

  // هل يُرى الموضع (بإحداثيات المربعات) الآن؟ وهل استُكشف؟
  @pragma('vm:never-inline')
  bool sees(double i, double j) {
    final a = jsRound(i), b = jsRound(j);
    return a >= 0 && b >= 0 && a < n && b < n && now[b * n + a] == 1;
  }
  @pragma('vm:never-inline')
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
      final r = math.max(FOG.unitSight, u.stats.dz('visionRange')) + (templeOwner(s, 'hawa') == u.playerId ? templeNumber('hawa', 'sight') : 0),
          reach = r + soft / 2;   // هوا محل (3.14): جنود مالكه يرون أبعد
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

  // الضباب صورة جاهزة للخريطة كلها (بنصف الدقة ومنعّمة) تُرسم من جديد حين تتغير عتمته أو ارتفاعات مبانيها (كل حساب
  // على الأكثر، أي 10 مرات في الثانية)، وكل إطار يعرضها كما هي: لا حساب ولا تنعيم على كرت الشاشة مع كل إطار
  ui.Image? _img;
  ui.Rect _rect = ui.Rect.zero;
  Float32List? _shown;                 // العتمة التي في الصورة الآن
  Float32List? _liftShown;
  static final _imgPaint = ui.Paint()..filterQuality = ui.FilterQuality.low;

  void paint(ui.Canvas canvas, double left, double right, double top, double bottom) {
    if (_img == null || !_same(_shown, dark) || !_same(_liftShown, lift)) _bake();
    final img = _img;
    if (img == null) return;
    canvas.drawImageRect(img, ui.Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()), _rect, _imgPaint);
  }

  static bool _same(Float32List? a, Float32List b) {
    if (a == null || a.length != b.length) return false;
    for (var k = 0; k < b.length; k++) { if (a[k] != b[k]) return false; }
    return true;
  }

  // شكل الضباب (مثلثات كل مربع وما فوقه حتى أعلى صورته) يُبنى مرة ويُعاد حين تتغير ارتفاعات المباني وحدها،
  // ولكل رأس ركنه من مصفوفة العتمة (−1 خارج الخريطة: أسود)، فإعادة الصورة تلوين الرؤوس وحده
  Float32List _gpos = Float32List(0);
  Int32List _corner = Int32List(0), _gcol = Int32List(0);

  void _shape() {
    const hw = TILE_HALF_W, hh = TILE_HALF_H, out = 3;   // وحلقة سوداء خارج الخريطة حتى لا يسحب التنعيم ضوء حافتها
    final m = n + 1, minLift = FOG.minLift;
    final pos = <double>[], corner = <int>[];
    var top = double.infinity;
    for (var d = -2 * out; d <= 2 * (n - 1 + out); d++) {
      final y = d * hh;
      for (var i = math.max(-out, d - n + 1 - out); i <= math.min(d + out, n - 1 + out); i++) {
        final j = d - i, x = (i - j) * hw;
        if (j < -out || j > n - 1 + out) continue;
        final inside = i >= 0 && j >= 0 && i < n && j < n, kk = inside ? j * n + i : -1, w = inside ? wide[kk] : hw;
        final cR = inside ? j * m + i + 1 : -1, cB = inside ? (j + 1) * m + i + 1 : -1, cL = inside ? (j + 1) * m + i : -1;
        final t = y - hh - (inside ? math.max(lift[kk], minLift) : minLift);
        top = math.min(top, t);
        // أرض المربع، ثم ما فوقه مستطيل بعرض صورته حتى أعلاها (المداخن وأطراف السطح والمبنى الأعرض من مربعه)
        pos.addAll([x - hw, y, x, y + hh, x + hw, y, x - w, y, x + w, y, x + w, t, x - w, y, x + w, t, x - w, t]);
        corner.addAll([cL, cB, cR, cL, cR, cR, cL, cR, cL]);
      }
    }
    final pad = 3 * FOG.blur, half = (n - 1 + 2 * out) * hw + 2 * hw;
    _rect = ui.Rect.fromLTRB(-half - pad, top - pad, half + pad, (2 * (n - 1 + out)) * hh + hh + pad);
    _gpos = Float32List.fromList(pos);
    _corner = Int32List.fromList(corner);
    _gcol = Int32List(corner.length);
    _liftShown = Float32List.fromList(lift);
  }

  static int bakes = 0;   // صور الضباب الجديدة منذ آخر قراءة (عدّاد الأداء)
  void _bake() {
    bakes++;
    if (!_same(_liftShown, lift) || _gpos.isEmpty) _shape();
    final k = FOG.bake, col = _gcol, corner = _corner, d = dark;
    for (var v = 0; v < col.length; v++) {
      final c = corner[v], a = c < 0 ? 1.0 : d[c];
      col[v] = ((a.clamp(0.0, 1.0) * 255).round() << 24).toSigned(32);
    }
    final verts = ui.Vertices.raw(ui.VertexMode.triangles, _gpos, colors: col);
    final rec = ui.PictureRecorder(), c = ui.Canvas(rec);
    c.scale(k);
    c.translate(-_rect.left, -_rect.top);
    // والطبقة تُنعَّم كلها (blur بوحدات العالم) فتختفي حواف المربعات وتصير الحافة ضباباً
    c.saveLayer(_rect, _layer);
    c.drawVertices(verts, ui.BlendMode.dst, _src);
    c.restore();
    _img?.dispose();
    _img = rec.endRecording().toImageSync((_rect.width * k).ceil(), (_rect.height * k).ceil());
    verts.dispose();
    _shown = Float32List.fromList(dark);
  }

  void dispose() { _img?.dispose(); _img = null; }
}
