class_name UnitsArt
extends RefCounted
# رسم الوحدات بأسلوب Stickman + الأنميشن — نقل كامل من docs/units-art.js (المرجع الإلزامي، القسم 13).
# لا تغيّر أي رقم هنا. عدّل المرجع أولاً ثم أعد النقل.
#
# الاستعمال:
#   var art := UnitsArt.new()
#   art.draw_unit(canvas_item, "crow_spear", pos, t, "attack", color, dir, scale, rate)
#
# نظام محلي: القدمان عند (0,0)، الطول ~26 وحدة، y السالب للأعلى.
# الحالات: idle | walk | attack | ult | hurt | death
# في حالتي hurt و death يكون t هو الزمن المنقضي داخل الحالة، لا وقت اللعبة.

const TAU2 := 6.2831853
const WOOD := Color("8a6a45")
const STEEL := Color("b9bec5")
const DARKW := Color("5f646b")
const POLICE := Color("3a5a86")
const GOLD := Color("f0c04a")
const ULT_GOLD := Color("ffd66e")
const ULT_PALE := Color("fff3c9")
const HEAL := Color("7fd48a")
const CROSS := Color("c0392b")
const LINEN := Color("efe6d2")

const HURT_DUR := 0.35
const DODGE_DUR := 0.25     # مدة التفادي والصدّ (5.4.3)
const STAGGER_DUR := 0.4    # مدة الترنّح (5.4.2)
const DEATH_DUR := 1.0
const HIT_AT := 0.47   # لحظة الارتطام كنسبة من زمن الضربة (13.1)

# تنعيم الحواف مطفأ عمداً: draw_line المنعّم في Godot يضيف هامشاً بمقدار بكسل على كل
# جانب، فتصير الأطراف أعرض من المرجع بمرتين تقريباً. الإطفاء يعطي العرض الصحيح بالضبط.
const AA := false

# أصغر نصف قطر بالبكسل تستحق عنده نهاية الطرف أن تُرسم (14)
const CAP_MIN_PX := 1.5

# جداول الدائرة محسوبة مرة واحدة: بناء بيضاوي من 20 ضلعاً كان يستدعي sin و cos
# أربعين مرة لكل وحدة في كل إطار (14)
const RING20 := [
	Vector2(1, 0), Vector2(0.95105654, 0.30901699), Vector2(0.80901699, 0.58778525),
	Vector2(0.58778525, 0.80901699), Vector2(0.30901699, 0.95105654), Vector2(0, 1),
	Vector2(-0.30901699, 0.95105654), Vector2(-0.58778525, 0.80901699),
	Vector2(-0.80901699, 0.58778525), Vector2(-0.95105654, 0.30901699), Vector2(-1, 0),
	Vector2(-0.95105654, -0.30901699), Vector2(-0.80901699, -0.58778525),
	Vector2(-0.58778525, -0.80901699), Vector2(-0.30901699, -0.95105654), Vector2(0, -1),
	Vector2(0.30901699, -0.95105654), Vector2(0.58778525, -0.80901699),
	Vector2(0.80901699, -0.58778525), Vector2(0.95105654, -0.30901699),
]
# وللبيضاويات الصغيرة على الشاشة ثمانية أضلاع تكفي: الفرق لا يُرى وعدد الرؤوس ينزل
# إلى أقل من النصف (14)
const RING8 := [
	Vector2(1, 0), Vector2(0.70710678, 0.70710678), Vector2(0, 1),
	Vector2(-0.70710678, 0.70710678), Vector2(-1, 0), Vector2(-0.70710678, -0.70710678),
	Vector2(0, -1), Vector2(0.70710678, -0.70710678),
]

# شكل الحركات الأربع (5.4.2): sw سعة القوس، lg عمق الاندفاع.
# هذه أرقام رسم فقط؛ أزمنة الحركات وأضرارها كلها في config.gd.
const MOVE_ART := {
	"quick":  {"sw": 0.75, "lg": 0.80},
	"heavy":  {"sw": 1.25, "lg": 1.15},
	"thrust": {"sw": 0.55, "lg": 1.50},
	"spin":   {"sw": 1.15, "lg": 0.40},
}

# جدول الوحدات: sx/sy تشويه الجسم، spd سرعة الأنميشن، hero بطل، neutral لون ثابت
const UNITS := {
	"crow_common":      {"sx": 0.90, "sy": 1.08, "spd": 1.00},
	"crow_spear":       {"sx": 0.94, "sy": 1.08, "spd": 0.90},
	"crow_dual":        {"sx": 0.90, "sy": 1.06, "spd": 1.15},
	"crow_hero":        {"sx": 1.00, "sy": 1.14, "spd": 0.95, "hero": true},
	"hammer_common":    {"sx": 1.20, "sy": 0.93, "spd": 1.00},
	"hammer_shield":    {"sx": 1.26, "sy": 0.92, "spd": 0.72},
	"hammer_breaker":   {"sx": 1.24, "sy": 0.93, "spd": 0.62},
	"hammer_hero":      {"sx": 1.42, "sy": 1.12, "spd": 0.70, "hero": true, "shadow_w": 5.0},
	"viper_common":     {"sx": 0.93, "sy": 0.96, "spd": 1.00},
	"viper_sniper":     {"sx": 0.90, "sy": 1.00, "spd": 0.80},
	"viper_firebomber": {"sx": 0.94, "sy": 0.96, "spd": 1.00},
	"viper_hero":       {"sx": 1.06, "sy": 1.12, "spd": 0.85, "hero": true},
	"scorp_common":     {"sx": 1.03, "sy": 0.99, "spd": 1.00},
	"scorp_boss":       {"sx": 1.10, "sy": 1.05, "spd": 0.85},
	"scorp_medic":      {"sx": 1.01, "sy": 0.99, "spd": 1.00},
	"scorp_hero":       {"sx": 1.14, "sy": 1.10, "spd": 0.88, "hero": true},
	"police_common":    {"sx": 1.05, "sy": 1.00, "spd": 1.00, "neutral": true},
	"police_captain":   {"sx": 1.14, "sy": 1.04, "spd": 0.92, "neutral": true},
}

# حالة الرسم (تقابل ctx في Canvas): الهدف، الشفافية العامة، ومكدّس التحويلات.
# ci بلا نوع عن قصد: قد يكون CanvasItem حقيقياً، أو مُسجِّل مثلثات من `unit_mesh.gd`
# يقلّد نفس الواجهة فيلتقط الشكل بدل رسمه (14).
var ci = null
var ga := 1.0                       # globalAlpha
var _px := 0.0                      # بكسل الشاشة لكل وحدة رسم محلية (0 = كل التفاصيل)
var _xf := Transform2D()
var _stack: Array[Transform2D] = []

# ============================ أدوات اللون ============================
static func dk(c: Color, amount: float) -> Color:
	return Color(c.r * (1.0 - amount), c.g * (1.0 - amount), c.b * (1.0 - amount), c.a)

static func lt(c: Color, amount: float) -> Color:
	return Color(c.r + (1.0 - c.r) * amount, c.g + (1.0 - c.g) * amount, c.b + (1.0 - c.b) * amount, c.a)

func _a(c: Color) -> Color:
	if ga >= 1.0:
		return c          # الحالة الغالبة: لا شفافية عامة، فلا داعي للنسخ (14)
	return Color(c.r, c.g, c.b, c.a * ga)

static func _ease(x: float) -> float:
	var v := clampf(x, 0.0, 1.0)
	return v * v * (3.0 - 2.0 * v)

static func _ease_out(x: float) -> float:
	var v := clampf(x, 0.0, 1.0)
	return 1.0 - pow(1.0 - v, 3.0)

# ============================ مكدّس التحويلات ============================
func _save() -> void:
	_stack.push_back(_xf)

func _restore() -> void:
	_xf = _stack.pop_back()
	ci.draw_set_transform_matrix(_xf)

func _translate(v: Vector2) -> void:
	_xf = _xf * Transform2D(0.0, v)
	ci.draw_set_transform_matrix(_xf)

func _rotate(ang: float) -> void:
	_xf = _xf * Transform2D(ang, Vector2.ZERO)
	ci.draw_set_transform_matrix(_xf)

func _scale(v: Vector2) -> void:
	_xf = _xf * Transform2D(Vector2(v.x, 0), Vector2(0, v.y), Vector2.ZERO)
	ci.draw_set_transform_matrix(_xf)

# ============================ أدوات الرسم ============================
# خط بنهايات دائرية (lineCap = round).
# النهايتان دائرتان صغيرتان: إن كان نصف قطرهما أقل من بكسل ونصف على الشاشة فلا
# تُرسمان، لأنهما لا تظهران أصلاً وتكلّفان ثلثي أوامر رسم الوحدة (14).
func limb(p1: Vector2, p2: Vector2, w: float, col: Color) -> void:
	var c := _a(col)
	ci.draw_line(p1, p2, c, w, AA)
	if _px > 0.0 and w * 0.5 * _px < CAP_MIN_PX:
		return
	ci.draw_circle(p1, w * 0.5, c)
	ci.draw_circle(p2, w * 0.5, c)

func bone(p1: Vector2, p2: Vector2, p3: Vector2, w: float, col: Color) -> void:
	limb(p1, p2, w, col)
	limb(p2, p3, w, col)

# كم ضلعاً يستحق بيضاوي بهذا النصف على الشاشة؟ ثمانية للصغير وعشرون للكبير (14).
# منفصلة عن الرسم حتى تُفحص وحدها.
func ellipse_segments(rx: float) -> int:
	if _px > 0.0 and absf(rx) * _px < GC.DRAW_COARSE_PX:
		return 8
	return 20

# وهل يستحق ظل أو غبار بهذا النصف أن يُرسم أصلاً؟ (14)
func draws_puff(rx: float) -> bool:
	return _px <= 0.0 or absf(rx) * _px >= GC.DRAW_SHADOW_PX

func ellipse(center: Vector2, rx: float, ry: float, col: Color, seg: int = 20) -> void:
	var pts := PackedVector2Array()
	if seg == 20 and ellipse_segments(rx) == 8:
		pts.resize(8)
		for i in 8:
			var u8: Vector2 = RING8[i]
			pts[i] = center + Vector2(u8.x * rx, u8.y * ry)
		ci.draw_colored_polygon(pts, _a(col))
		return
	if seg == 20:
		pts.resize(20)
		for i in 20:
			var u: Vector2 = RING20[i]
			pts[i] = center + Vector2(u.x * rx, u.y * ry)
	else:
		for i in seg:
			var ang := TAU2 * float(i) / float(seg)
			pts.push_back(center + Vector2(cos(ang) * rx, sin(ang) * ry))
	ci.draw_colored_polygon(pts, _a(col))

# ملاحظة: draw_polyline في Godot يرسم أعرض بكثير من المطلوب عند العروض الصغيرة،
# فنرسم كل قطعة بـ draw_line وهو الوحيد الذي يحترم العرض بدقة.
func polyline(pts: PackedVector2Array, col: Color, w: float) -> void:
	var c := _a(col)
	for i in range(1, pts.size()):
		ci.draw_line(pts[i - 1], pts[i], c, w, AA)

func ellipse_stroke(center: Vector2, rx: float, ry: float, col: Color, w: float, seg: int = 24) -> void:
	var pts := PackedVector2Array()
	for i in seg + 1:
		var ang := TAU2 * float(i) / float(seg)
		pts.push_back(center + Vector2(cos(ang) * rx, sin(ang) * ry))
	polyline(pts, col, w)

# بديل setLineDash: قِطَع متقطعة على محيط بيضاوي
func ellipse_dashed(center: Vector2, rx: float, ry: float, col: Color, w: float, seg: int = 36) -> void:
	var c := _a(col)
	for i in seg:
		if i % 2 == 1:
			continue
		var a1 := TAU2 * float(i) / float(seg)
		var a2 := TAU2 * float(i + 1) / float(seg)
		ci.draw_line(center + Vector2(cos(a1) * rx, sin(a1) * ry),
			center + Vector2(cos(a2) * rx, sin(a2) * ry), c, w, AA)

func circle_stroke(center: Vector2, rad: float, col: Color, w: float) -> void:
	ci.draw_arc(center, rad, 0.0, TAU2, 20, _a(col), w, AA)

func arc_stroke(center: Vector2, rad: float, from_ang: float, to_ang: float, col: Color, w: float) -> void:
	ci.draw_arc(center, rad, from_ang, to_ang, 16, _a(col), w, AA)

func tri(p1: Vector2, p2: Vector2, p3: Vector2, col: Color) -> void:
	ci.draw_colored_polygon(PackedVector2Array([p1, p2, p3]), _a(col))

# مستطيل بزوايا دائرية (بديل roundRect)
func rrect(x: float, y: float, w: float, h: float, rad: float, col: Color) -> void:
	var r: float = minf(rad, minf(absf(w), absf(h)) * 0.5)
	if r <= 0.05:
		ci.draw_rect(Rect2(x, y, w, h), _a(col))
		return
	var pts := PackedVector2Array()
	var corners := [
		[Vector2(x + w - r, y + h - r), 0.0],
		[Vector2(x + r, y + h - r), PI * 0.5],
		[Vector2(x + r, y + r), PI],
		[Vector2(x + w - r, y + r), PI * 1.5],
	]
	for corner in corners:
		var c: Vector2 = corner[0]
		var base: float = corner[1]
		for k in 5:
			var ang: float = base + PI * 0.5 * float(k) / 4.0
			pts.push_back(c + Vector2(cos(ang) * r, sin(ang) * r))
	ci.draw_colored_polygon(pts, _a(col))

# منحنى تربيعي (بديل quadraticCurveTo)
static func _quad_points(p0: Vector2, cp: Vector2, p1: Vector2, seg: int = 10) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in seg + 1:
		var u := float(i) / float(seg)
		var v := 1.0 - u
		pts.push_back(p0 * (v * v) + cp * (2.0 * v * u) + p1 * (u * u))
	return pts

func quad_stroke(p0: Vector2, cp: Vector2, p1: Vector2, col: Color, w: float) -> void:
	polyline(_quad_points(p0, cp, p1), col, w)

func quad_fill(p0: Vector2, cp: Vector2, p1: Vector2, col: Color) -> void:
	ci.draw_colored_polygon(_quad_points(p0, cp, p1), _a(col))

# طرف من قطعتين: الزوايا من العمودي لأسفل، الموجب للأمام
func seg2(o: Vector2, a1: float, l1: float, a2: float, l2: float, w: float, col: Color) -> Vector2:
	var p1 := o + Vector2(sin(a1) * l1, cos(a1) * l1)
	var p2 := p1 + Vector2(sin(a2) * l2, cos(a2) * l2)
	bone(o, p1, p2, w, col)
	return p2

# ============================ الهيكل الحركي (rig) ============================
# يبني قاموس الحركة لكل إطار. مطابق لدالة rig في المرجع.
func _rig(t: float, state: String, spd: float, rate: float, move: String = "") -> Dictionary:
	var st := state
	var is_ult := st == "ult"
	if is_ult:
		st = "attack"
	var r := {
		"st": st, "t": t, "ult": is_ult,
		"p": 0.0, "bounce": 0.0, "lean": 0.05, "air": 0.0, "arm_ph": 0.0,
		"s": 0.0, "lunge": 0.0, "a": 0.0, "hit": false, "fx": 0.0,
		"flinch": 0.0, "death": -1.0,
	}
	if st == "walk":
		var p: float = t * 2.55 * spd * TAU2
		r["p"] = p
		r["bounce"] = -cos(p * 2.0) * 1.5 - 0.6
		r["lean"] = 0.30
		r["air"] = maxf(0.0, sin(p * 2.0)) * 0.55
		r["arm_ph"] = p
	elif st == "attack":
		var a: float = fmod(t / maxf(0.0001, rate), 1.0)
		r["a"] = a
		r["p"] = t * 1.1 * TAU2
		var s := 0.0
		var lunge := 0.0
		if a < 0.34:
			var k := _ease_out(a / 0.34)
			s = -k
			lunge = -1.1 * k
		elif a < 0.44:
			var k2 := _ease((a - 0.34) / 0.10)
			s = -1.0 + 2.0 * k2
			lunge = -1.1 + 4.4 * k2
		elif a < 0.53:
			s = 1.0
			lunge = 3.3
		else:
			var k3 := _ease((a - 0.53) / 0.47)
			s = 1.0 - 1.28 * k3
			lunge = 3.3 - 3.3 * k3
		# نوع الحركة يغيّر سعة القوس وعمق الاندفاع من نفس الهيكل (5.4.6)
		var art: Dictionary = MOVE_ART.get(move, {})
		s *= float(art.get("sw", 1.0))
		lunge *= float(art.get("lg", 1.0))
		r["s"] = s
		r["lunge"] = lunge
		r["hit"] = a >= 0.44 and a < 0.53
		r["fx"] = (1.0 - (a - 0.42) / 0.18) if (a >= 0.42 and a < 0.60) else 0.0
		r["bounce"] = -absf(s) * 0.5 + (0.7 if r["hit"] else 0.0)
		r["lean"] = 0.14 + s * 0.30
	elif st == "hurt":
		var a2: float = minf(1.0, t / HURT_DUR)
		var f: float = sin(a2 * PI)
		r["a"] = a2
		r["flinch"] = f
		r["bounce"] = -f * 0.5
		r["lean"] = 0.05 - f * 0.55
		r["s"] = -f * 0.4
		r["lunge"] = -f * 1.8
	elif st == "dodge":
		# قفزة للخلف: ميل عكسي وارتفاع عن الأرض ثم هبوط (5.4.3)
		var ad: float = clampf(t / DODGE_DUR, 0.0, 1.0)
		var hop: float = sin(ad * PI)
		r["a"] = ad
		r["air"] = hop * 0.9
		r["bounce"] = -hop * 2.6
		r["lean"] = 0.05 - hop * 0.75
		r["s"] = -hop * 0.85
		r["lunge"] = -hop * 3.4
		r["arm_ph"] = 1.4
	elif st == "block":
		# انكفاء خلف الدرع: انخفاض وميل للأمام وثبات (5.4.3)
		var ab: float = clampf(t / DODGE_DUR, 0.0, 1.0)
		var br: float = sin(ab * PI)
		r["a"] = ab
		r["bounce"] = br * 1.3
		r["lean"] = 0.05 + br * 0.5
		r["s"] = -0.25 - br * 0.2
		r["lunge"] = -br * 0.8
	elif st == "stagger":
		# ترنّح: تمايل للخلف مرتين قبل استعادة التوازن (5.4.3)
		var ag: float = clampf(t / STAGGER_DUR, 0.0, 1.0)
		var sw: float = sin(ag * PI) * cos(ag * 9.0)
		r["a"] = ag
		r["bounce"] = -absf(sw) * 1.1
		r["lean"] = 0.05 - sw * 0.6
		r["s"] = -sw * 0.5
		r["lunge"] = -sw * 2.2
		r["arm_ph"] = ag * 6.0
	elif st == "death":
		var a3: float = minf(1.0, t / DEATH_DUR)
		r["a"] = a3
		r["death"] = a3
		r["bounce"] = -sin(minf(1.0, a3 * 1.6) * PI) * 1.2
		r["lean"] = 0.1
		r["s"] = -0.5 + a3 * 0.3
	else:
		var p2: float = t * 1.25 * spd
		r["p"] = p2
		r["bounce"] = sin(p2 * TAU2 / 2.0) * 0.32
		r["arm_ph"] = p2 * 2.2
	r["hip_y"] = -11.0 + float(r["bounce"])
	r["hip_x"] = float(r["lunge"]) * 0.55
	return r

# زاوية الفخذ وانثناء الركبة. back = الرجل الخلفية.
static func thigh_of(r: Dictionary, back: bool) -> float:
	match String(r["st"]):
		"walk":
			return 0.95 * sin(float(r["p"]) + (PI if back else 0.0))
		"attack":
			var s: float = float(r["s"])
			return (-0.70 if back else 0.62) + s * (-0.30 if back else 0.42)
		"hurt":
			return (-0.3 if back else 0.2) - float(r["flinch"]) * 0.25
		"death":
			return (-0.55 if back else 0.5) + float(r["a"]) * 0.5
	return -0.13 if back else 0.13

static func flex_of(r: Dictionary, back: bool) -> float:
	match String(r["st"]):
		"walk":
			return 1.55 * pow(0.5 + 0.5 * cos(float(r["p"]) + (PI if back else 0.0) - 4.12), 2.2) + 0.18
		"attack":
			return (0.78 if back else 0.42) - float(r["s"]) * 0.12
		"hurt":
			return 0.3 + float(r["flinch"]) * 0.25
		"death":
			return 0.55 + float(r["a"]) * 0.5
	return 0.16

# ============================ لبنات الـ stickman ============================
# فضاء الجسد: الأصل عند الورك مع الميلان (يقابل body() في المرجع)
func _body_begin(r: Dictionary) -> void:
	_save()
	_translate(Vector2(float(r["hip_x"]), float(r["hip_y"])))
	_rotate(-float(r["lean"]))

func _body_end() -> void:
	_restore()

func shadow(r: Dictionary, w: float) -> void:
	var s: float = 1.0 - float(r["air"]) * 0.35
	var rx: float = (w if w > 0.0 else 3.8) * s
	# عند التصغير يصير الظل بضعة بكسلات باهتة لا تُرى، وهو مضلع كامل لكل وحدة (14)
	if not draws_puff(rx):
		return
	ellipse(Vector2(0, 0.6), rx, 1.6 * s, Color(0, 0, 0, 0.3 * s))

func _dust(r: Dictionary) -> void:
	# وكذلك غبار الخطوة والضربة (14)
	if not draws_puff(3.0):
		return
	var st := String(r["st"])
	if st == "attack" and float(r["a"]) > 0.34 and float(r["a"]) < 0.62:
		var g: float = (float(r["a"]) - 0.34) / 0.28
		var keep := ga
		ga = keep * (1.0 - g) * 0.45
		ellipse(Vector2(-4.0 - g * 5.0, 0.2), 2.2 + g * 3.0, 1.0 + g * 0.7, Color("b9b0a2"))
		ga = keep
	if st == "walk" and sin(float(r["p"]) * 2.0) < -0.85:
		var keep2 := ga
		ga = keep2 * 0.3
		ellipse(Vector2(-5, 0.4), 2.4, 0.9, Color("b9b0a2"))
		ga = keep2

# أثر السلاح خلف الضربة: يستدعي cb ثلاث مرات بزوايا سابقة
func _trail(r: Dictionary, cb: Callable) -> void:
	if not (String(r["st"]) == "attack" and float(r["a"]) >= 0.34 and float(r["a"]) < 0.53):
		return
	var keep := ga
	for i in range(1, 4):
		var b: float = float(r["s"]) - float(i) * 0.32
		if b < -1.05:
			continue
		ga = keep * 0.2 * float(4 - i) / 3.0
		cb.call(b)
	ga = keep

func _spark(p: Vector2, r: Dictionary) -> void:
	var g: float = float(r["fx"])
	if g <= 0.0:
		return
	var keep := ga
	ga = keep * g * 0.9
	for i in 5:
		var ang: float = float(i) * 1.256 + 0.4
		limb(p, p + Vector2(cos(ang), sin(ang)) * (2.0 + g * 3.6), 0.9, Color("ffe08a"))
	ellipse(p, 1.2 + g * 2.0, 1.2 + g * 2.0, Color(1.0, 0.925, 0.667, g * 0.7))
	ga = keep

# خطوط سرعة خلف الجاري (غير مستعملة في drawUnit، محفوظة كما في المرجع)
func speed_lines(r: Dictionary) -> void:
	if String(r["st"]) != "walk":
		return
	var keep := ga
	ga = keep * 0.28
	for i in 3:
		var y: float = -6.0 - float(i) * 4.5
		var l: float = 4.0 + fmod(float(r["p"]) * 4.0 + float(i), 3.0) * 2.4
		limb(Vector2(-7.0 - l, y), Vector2(-7, y), 0.8, Color("b9b0a2"))
	ga = keep

# أرجل عصوية: ورك ← ركبة ← كاحل ← قدم
func _legs(r: Dictionary, col: Color, w: float) -> void:
	for back in [true, false]:
		var th := thigh_of(r, back)
		var fl := flex_of(r, back)
		var cc: Color = dk(col, 0.32) if back else col
		var hip := Vector2(float(r["hip_x"]) + (-1.2 if back else 1.2), float(r["hip_y"]))
		var foot := seg2(hip, th, 5.8, th - fl, 6.0, w, cc)
		limb(foot, foot + Vector2(sin(th - fl + 1.1) * 2.0, cos(th - fl + 1.1) * 0.9), w, cc)

func _back_arm(r: Dictionary, col: Color, w: float) -> void:
	var st := String(r["st"])
	var k := -0.15
	if st == "walk":
		k = sin(float(r["arm_ph"]) + PI)
	elif st == "idle":
		k = sin(float(r["arm_ph"])) * 0.25
	var a1 := -k * 0.95
	var a2: float = a1 - (1.45 if st == "walk" else 0.35)
	seg2(Vector2(-0.8, -8.0), a1, 3.6, a2, 3.4, w, dk(col, 0.32))

# ذراع أمامية تمسك السلاح
func _arm_to(col: Color, h: Vector2, w: float) -> void:
	var sh := Vector2(0.8, -8.2)
	var mid := Vector2((sh.x + h.x) * 0.5 + 0.8, (sh.y + h.y) * 0.5 + 0.6)
	bone(sh, mid, h, w, col)

func _head_ball(col: Color, rad: float) -> void:
	ci.draw_circle(Vector2(0.5, -12.6), rad, _a(col))
	circle_stroke(Vector2(0.5, -12.6), rad, dk(col, 0.4), 0.7)

func _spine(col: Color, w: float) -> void:
	limb(Vector2(0.0, 0.4), Vector2(0.4, -8.4), w + 0.5, col)
	limb(Vector2(0.4, -8.4), Vector2(0.5, -9.8), w * 0.8, col)

# زاوية السلاح وموضع اليد
static func _w_ang(r: Dictionary, base: float, rng: float) -> float:
	return base + float(r["s"]) * rng

static func hand(base: float, rng: float, r: Dictionary, reach: float, off: float = 1.2) -> Dictionary:
	var A := _w_ang(r, base, rng)
	return {"A": A, "p": Vector2(0.8 + sin(A + off) * reach, -8.2 + cos(A + off) * (reach * 0.86))}

# الهيكل الجاهز: أرجل + ذراع خلفية + عمود + رأس، ثم إضافات الوحدة
func _stick(r: Dictionary, col: Color, lw: float, head_r: float,
		back: Callable, chest: Callable, head: Callable, arm: Callable) -> void:
	_legs(r, col, lw)
	_body_begin(r)
	_back_arm(r, col, lw - 0.1)
	if back.is_valid():
		back.call(r, col)
	_spine(col, lw)
	if chest.is_valid():
		chest.call(r, col)
	_head_ball(col, head_r)
	if head.is_valid():
		head.call(r, col)
	if arm.is_valid():
		arm.call(r, col, lw)
	_body_end()
	_dust(r)

# ============================ أغطية الرأس والعلامات ============================
func _hood(col: Color) -> void:
	quad_fill(Vector2(-2.7, -11.9), Vector2(0.5, -17.4), Vector2(3.7, -11.9), dk(col, 0.45))

func _helm(col: Color) -> void:
	_dome(Vector2(0.5, -12.9), 3.4, dk(col, 0.5))
	rrect(-2.9, -13.3, 6.8, 1.2, 0.3, dk(col, 0.5))

# نصف دائرة علوية (بديل arc(x,y,R,PI,0) المملوء)
func _dome(center: Vector2, rad: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 13:
		var ang: float = PI + PI * float(i) / 12.0
		pts.push_back(center + Vector2(cos(ang) * rad, sin(ang) * rad))
	ci.draw_colored_polygon(pts, _a(col))

func _mask(col: Color) -> void:
	rrect(-2.7, -13.4, 6.4, 1.8, 0.4, dk(col, 0.55))

func _band(col: Color) -> void:
	rrect(-2.8, -14.4, 6.6, 1.8, 0.5, dk(col, 0.5))
	limb(Vector2(-2.6, -13.6), Vector2(-5, -11.2), 0.9, dk(col, 0.5))

func _cap(col: Color) -> void:
	rrect(-2.8, -16.2, 6.6, 2.6, 0.8, dk(col, 0.35))
	rrect(-2.9, -14.0, 7.6, 1.2, 0.3, dk(col, 0.55))
	rrect(-1.0, -15.9, 2.2, 1.4, 0.3, Color("e8d47a"))

func _crown(_col: Color) -> void:
	tri(Vector2(-2.2, -16.3), Vector2(0.6, -19.8), Vector2(3.4, -16.3), GOLD)
	rrect(-2.4, -16.5, 5.8, 1.1, 0.3, GOLD)

func _hero_ring() -> void:
	ellipse_stroke(Vector2(0, 0.6), 6.4, 2.6, Color(0.941, 0.753, 0.290, 0.8), 0.9)

# نجمة فوق الرأس تدل أن الضربة المميزة جاهزة (القسم 6.7) — تُرسم من منطق اللعبة
func draw_ready_mark(canvas, pos: Vector2, sc: float = 1.0) -> void:
	ci = canvas
	ga = 1.0
	_xf = Transform2D(0.0, pos) * Transform2D(Vector2(sc, 0), Vector2(0, sc), Vector2.ZERO)
	_stack.clear()
	ci.draw_set_transform_matrix(_xf)
	tri(Vector2(-1.6, -21), Vector2(0.6, -24.4), Vector2(2.8, -21), ULT_GOLD)
	ci.draw_set_transform_matrix(Transform2D())

# ============================ الغربان ============================
func _crow_common_back(r: Dictionary, col: Color) -> void:
	var sway: float = sin(float(r["p"])) * 2.4 if String(r["st"]) == "walk" else 0.0
	tri(Vector2(-1.4, -8.6), Vector2(-6.6 - sway, -1.6 - float(r["air"]) * 3.0), Vector2(-1.4, -0.6), dk(col, 0.25))

func _crow_common_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.35, 1.5, r, 6.0)
	_trail(r, func(s: float):
		var A: float = -0.35 + s * 1.5
		var p := Vector2(0.8 + sin(A + 1.2) * 6.0, -8.2 + cos(A + 1.2) * 5.2)
		limb(p, p + Vector2(sin(A + 1.9) * 3.4, cos(A + 1.9) * 3.0), 1.3, Color("e6e2d6")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var tip: Vector2 = Vector2(h["p"]) + Vector2(sin(A2 + 1.9) * 3.4, cos(A2 + 1.9) * 3.0)
	limb(h["p"], tip, 1.4, STEEL)
	_spark(tip, r)

func _crow_spear_arm(r: Dictionary, col: Color, w: float) -> void:
	var ext: float = float(r["s"]) * 4.2
	var hx: float = 2.0 + ext * 0.55
	var hy := -8.4
	var tip := Vector2.ZERO
	var pole := func(x: float) -> Vector2:
		limb(Vector2(x - 7.6, hy + 2.4), Vector2(x + 13.4, hy - 1.2), 1.5, WOOD)
		var t2 := Vector2(x + 13.4, hy - 1.2)
		tri(t2 + Vector2(-1.8, 2.0), t2 + Vector2(4.8, -0.4), t2 + Vector2(-1.8, -2.6), STEEL)
		limb(t2 + Vector2(-2.6, 0.5), t2 + Vector2(-1.4, 0.3), 1.8, Color("cdd2d8"))
		return t2 + Vector2(4, 0)
	if String(r["st"]) == "attack" and float(r["a"]) >= 0.34 and float(r["a"]) < 0.53:
		var keep := ga
		for i in range(1, 3):
			var back: float = float(r["s"]) - float(i) * 0.4
			if back < -1.0:
				continue
			ga = keep * 0.2 * float(3 - i) / 2.0
			pole.call(2.0 + back * 4.2 * 0.55)
		ga = keep
	tip = pole.call(hx)
	_arm_to(col, Vector2(hx, hy), w)
	limb(Vector2(hx - 4.4, hy + 1.4), Vector2(hx - 2.0, hy + 0.8), 1.8, dk(col, 0.32))
	_spark(tip, r)

func _crow_dual_back(r: Dictionary, col: Color) -> void:
	var s2: float = -float(r["s"])
	var A: float = -0.45 + s2 * 1.55
	var p := Vector2(-0.4 + sin(A + 1.2) * 5.0, -8.0 + cos(A + 1.2) * 4.3)
	limb(Vector2(-0.8, -8.0), p, 1.8, dk(col, 0.32))
	var b := p + Vector2(sin(A + 1.75) * 5.2, cos(A + 1.75) * 4.6)
	limb(p, b, 2.0, Color("a8845a"))
	limb(b - (b - p) * 0.22, b, 2.2, Color("8e949c"))

func _crow_dual_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.45, 1.55, r, 5.2)
	_trail(r, func(s: float):
		var A: float = -0.45 + s * 1.55
		var p := Vector2(0.8 + sin(A + 1.2) * 5.2, -8.2 + cos(A + 1.2) * 4.5)
		limb(p, p + Vector2(sin(A + 1.75) * 5.4, cos(A + 1.75) * 4.8), 1.8, Color("e6e2d6")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var t2 := hp + Vector2(sin(A2 + 1.75) * 5.4, cos(A2 + 1.75) * 4.8)
	limb(hp, t2, 2.1, Color("c8a06a"))
	limb(t2 - (t2 - hp) * 0.22, t2, 2.3, Color("b9bec5"))
	_spark(t2, r)

func _crow_hero_back(r: Dictionary, col: Color) -> void:
	var sway: float = sin(float(r["p"])) * 2.6 if String(r["st"]) == "walk" else 0.0
	tri(Vector2(-1.6, -9.6), Vector2(-7.4 - sway, -1.4 - float(r["air"]) * 3.0), Vector2(-1.6, 0.4), dk(col, 0.22))

func _crow_hero_head(_r: Dictionary, col: Color) -> void:
	_hood(col)
	_crown(col)

func _crow_hero_arm(r: Dictionary, col: Color, _w: float) -> void:
	var A: float = -2.2 + float(r["s"]) * 2.7
	var L := 12.5
	var staff := func(a2: float) -> Vector2:
		var e := Vector2(0.8 + sin(a2 + 1.5) * L, -8.6 + cos(a2 + 1.5) * L)
		var b := Vector2(0.8 - sin(a2 + 1.5) * 5.0, -8.6 - cos(a2 + 1.5) * 5.0)
		limb(b, e, 1.4, WOOD)
		_save()
		_translate(e)
		_rotate(-(a2 + 1.5))
		tri(Vector2(-1.3, 1.4), Vector2(3.8, 0), Vector2(-1.3, -1.4), STEEL)
		_restore()
		return e
	if String(r["st"]) == "attack" and float(r["a"]) >= 0.34 and float(r["a"]) < 0.53:
		var keep := ga
		for i in range(1, 4):
			var b2: float = float(r["s"]) - float(i) * 0.34
			if b2 < -1.05:
				continue
			ga = keep * 0.2 * float(4 - i) / 3.0
			staff.call(-2.2 + b2 * 2.7)
		ga = keep
	var e2: Vector2 = staff.call(A)
	limb(Vector2(0.8, -8.2), Vector2(0.8 + sin(A + 1.5) * 3.4, -8.6 + cos(A + 1.5) * 3.4), 2.1, col)
	limb(Vector2(-0.8, -8.0), Vector2(0.8 - sin(A + 1.5) * 2.4, -8.6 - cos(A + 1.5) * 2.4), 2.0, dk(col, 0.32))
	_spark(e2, r)

# ============================ المطارق ============================
func _hammer_chest(_r: Dictionary, col: Color) -> void:
	limb(Vector2(-4.2, -9.4), Vector2(4.6, -9.4), 2.4, dk(col, 0.2))

func _hammer_chest_wide(_r: Dictionary, col: Color) -> void:
	limb(Vector2(-4.8, -9.6), Vector2(5.0, -9.6), 2.8, dk(col, 0.2))

func _hammer_common_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.55, 1.6, r, 5.4, 1.15)
	_trail(r, func(s: float):
		var A: float = -0.55 + s * 1.6
		var p := Vector2(0.8 + sin(A + 1.15) * 5.4, -8.2 + cos(A + 1.15) * 4.6)
		limb(p, p + Vector2(sin(A + 1.7) * 4.2, cos(A + 1.7) * 3.8), 1.6, Color("c8b49a")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var e := hp + Vector2(sin(A2 + 1.7) * 4.2, cos(A2 + 1.7) * 3.8)
	limb(hp, e, 1.5, WOOD)
	_save()
	_translate(e)
	_rotate(-(A2 + 1.7))
	rrect(-1.5, -2, 3, 4, 0.7, STEEL)
	_restore()
	_spark(e, r)

func _hammer_shield_arm(r: Dictionary, col: Color, _w: float) -> void:
	var push: float = maxf(0.0, float(r["s"])) * 3.2 if String(r["st"]) == "attack" else 0.0
	limb(Vector2(0.8, -8.2), Vector2(4.8 + (1.2 if r["hit"] else 0.0), -5.2), 2.6, col)
	_save()
	_translate(Vector2(-5.8 - push * 0.9, -6.2 + (sin(float(r["p"])) * 0.6 if String(r["st"]) == "walk" else 0.0)))
	_rotate(-push * 0.16)
	rrect(-2.6, -7.6, 5.6, 15.2, 1.8, lt(col, 0.25))
	rrect(-1.4, -6.0, 3.2, 12.0, 1.0, dk(col, 0.15))
	ellipse(Vector2(0.4, 0), 1.4, 1.4, lt(col, 0.55))
	_restore()
	_spark(Vector2(-9, -6.2), r)

func _hammer_breaker_head(_r: Dictionary, col: Color) -> void:
	rrect(-2.9, -14.6, 6.8, 2.0, 0.5, dk(col, 0.5))

func _hammer_breaker_arm(r: Dictionary, col: Color, _w: float) -> void:
	var base := -2.5
	var A: float = base + float(r["s"]) * 2.9
	var L := 13.0
	var sledge := func(a2: float, wc: Color, hc: Color) -> Vector2:
		var e := Vector2(0.6 + sin(a2 + 1.5) * L, -8.6 + cos(a2 + 1.5) * L)
		limb(Vector2(0.6, -8.6), e, 1.8, wc)
		_save()
		_translate(e)
		_rotate(-(a2 + 1.5))
		rrect(-2.6, -3.4, 5.6, 6.8, 1.1, hc)
		rrect(-2.6, -3.4, 2.0, 6.8, 0.9, lt(hc, 0.3))
		_restore()
		limb(Vector2(-0.8, -8.2), Vector2(0.6 * 0.4 + e.x * 0.3, -8.6 * 0.4 + e.y * 0.3), 2.6, dk(col, 0.32))
		limb(Vector2(0.8, -8.4), Vector2(0.6 * 0.6 + e.x * 0.2, -8.6 * 0.6 + e.y * 0.2), 2.6, col)
		return e
	_trail(r, func(s: float): sledge.call(base + s * 2.9, Color("c8b49a"), Color("cdd2d8")))
	var e2: Vector2 = sledge.call(A, WOOD, DARKW)
	var fx: float = float(r["fx"])
	if fx > 0.0:
		_spark(e2, r)
		var keep := ga
		ga = keep * fx * 0.5
		ellipse_stroke(e2 + Vector2(0, 1), 7.0 + (1.0 - fx) * 7.0, 3.0 + (1.0 - fx) * 3.0, Color("ffe08a"), 1.4)
		ga = keep

func _hammer_hero_chest(_r: Dictionary, col: Color) -> void:
	limb(Vector2(-5.2, -9.8), Vector2(5.4, -9.8), 3.0, dk(col, 0.2))

func _hammer_hero_head(_r: Dictionary, col: Color) -> void:
	_dome(Vector2(0.5, -12.9), 3.6, dk(col, 0.5))
	rrect(-3.1, -13.3, 7.2, 1.3, 0.3, dk(col, 0.5))
	tri(Vector2(-0.4, -16), Vector2(0.6, -19.4), Vector2(1.6, -16), GOLD)
	_crown(col)

func _hammer_hero_arm(r: Dictionary, col: Color, w: float) -> void:
	var push: float = maxf(0.0, float(r["s"])) * 1.6 if String(r["st"]) == "attack" else 0.0
	_save()
	_translate(Vector2(-6.4 - push * 0.7, -6.4 + (sin(float(r["p"])) * 0.6 if String(r["st"]) == "walk" else 0.0)))
	_rotate(-push * 0.12)
	rrect(-3.0, -8.8, 6.4, 17.6, 2.0, lt(col, 0.25))
	rrect(-1.6, -7.0, 3.6, 14.0, 1.0, dk(col, 0.15))
	ellipse(Vector2(0.4, 0), 1.6, 1.6, GOLD)
	_restore()
	var h := hand(-0.6, 1.7, r, 5.8, 1.15)
	_trail(r, func(s: float):
		var A: float = -0.6 + s * 1.7
		var p := Vector2(0.8 + sin(A + 1.15) * 5.8, -8.2 + cos(A + 1.15) * 5.0)
		limb(p, p + Vector2(sin(A + 1.7) * 4.6, cos(A + 1.7) * 4.2), 1.7, Color("c8b49a")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var e := hp + Vector2(sin(A2 + 1.7) * 4.6, cos(A2 + 1.7) * 4.2)
	limb(hp, e, 1.7, WOOD)
	_save()
	_translate(e)
	_rotate(-(A2 + 1.7))
	rrect(-2.0, -2.8, 4.2, 5.6, 0.9, DARKW)
	rrect(-2.0, -2.8, 1.5, 5.6, 0.7, STEEL)
	_restore()
	var fx: float = float(r["fx"])
	if fx > 0.0:
		_spark(e, r)
		var keep := ga
		ga = keep * fx * 0.5
		ellipse_stroke(e + Vector2(0, 1), 6.0 + (1.0 - fx) * 6.0, 2.6 + (1.0 - fx) * 2.6, Color("ffe08a"), 1.3)
		ga = keep

# ============================ الأفاعي ============================
func _viper_common_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.15, 1.7, r, 5.6, 1.25)
	_arm_to(col, h["p"], w)
	var hp: Vector2 = h["p"]
	var thrown: bool = String(r["st"]) == "attack" and float(r["a"]) >= 0.44
	if not thrown:
		ellipse(hp + Vector2(0.8, -0.4), 1.5, 1.4, Color("9a948c"))
	else:
		var g: float = (float(r["a"]) - 0.44) / 0.56
		ellipse(Vector2(hp.x + 3.0 + g * 22.0, hp.y - 3.0 - sin(g * PI) * 6.0), 1.5, 1.4, Color("9a948c"))

func _viper_sniper_back(_r: Dictionary, col: Color) -> void:
	limb(Vector2(-2.6, -9.2), Vector2(-4.2, -3.0), 2.2, dk(col, 0.45))
	for d in [0.0, 1.2, 2.4]:
		limb(Vector2(-2.9 - d * 0.2, -9.6 - d), Vector2(-3.5 - d * 0.2, -12.2 - d), 0.6, Color("d9d3c6"))

func _viper_sniper_arm(r: Dictionary, col: Color, _w: float) -> void:
	var is_atk := String(r["st"]) == "attack"
	var a: float = float(r["a"]) if is_atk else 0.0
	var pull := 0.0
	if is_atk:
		pull = 3.8 * _ease_out(a / 0.4) if a < 0.4 else (3.8 if a < 0.47 else 0.0)
	var bx := 5.4
	var by := -8.2
	var fired: bool = is_atk and a >= 0.47
	var bend: float = 1.0 + (pull / 3.8) * 0.55
	quad_stroke(Vector2(bx, by - 7.6), Vector2(bx + 4.6 * bend, by), Vector2(bx, by + 7.6), WOOD, 1.4)
	polyline(PackedVector2Array([
		Vector2(bx, by - 7.6), Vector2(bx - pull, by), Vector2(bx, by + 7.6)]), Color("d9d3c6"), 0.6)
	if not fired and pull > 0.5:
		limb(Vector2(bx - pull, by), Vector2(bx + 3.6, by), 0.9, Color("d9d3c6"))
	limb(Vector2(0.8, -8.2), Vector2(bx - 0.8, by), 2.0, col)
	limb(Vector2(-0.8, -8.0), Vector2(bx - pull - 1.0, by + 0.4), 1.9, dk(col, 0.32))
	if fired:
		var g: float = (a - 0.47) / 0.53
		var keep := ga
		ga = keep * maxf(0.0, 1.0 - g * 1.4)
		limb(Vector2(bx + 4.0 + g * 30.0, by), Vector2(bx + 10.0 + g * 30.0, by), 0.9, Color("d9d3c6"))
		ga = keep

func _viper_fire_chest(_r: Dictionary, _col: Color) -> void:
	rrect(-2.6, -5.0, 2.0, 3.4, 0.6, Color("5a8a6a"))
	rrect(0.0, -5.0, 2.0, 3.4, 0.6, Color("5a8a6a"))

func _bottle(p: Vector2) -> void:
	rrect(p.x - 1.1, p.y - 2.4, 2.2, 4.0, 0.8, Color("5a8a6a"))
	tri(p + Vector2(-1.1, -2.4), p + Vector2(0, -5.2), p + Vector2(1.1, -2.4), Color("e8893a"))
	tri(p + Vector2(-0.5, -2.6), p + Vector2(0, -4.0), p + Vector2(0.5, -2.6), Color("f2c14e"))

func _viper_fire_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-1.35, 2.3, r, 6.0)
	_arm_to(col, h["p"], w)
	var hp: Vector2 = h["p"]
	var thrown: bool = String(r["st"]) == "attack" and float(r["a"]) >= 0.44
	if not thrown:
		_bottle(hp)
	else:
		var g: float = (float(r["a"]) - 0.44) / 0.56
		_save()
		_translate(Vector2(hp.x + 4.0 + g * 24.0, hp.y - 4.0 - sin(g * PI) * 7.0))
		_rotate(g * 9.0)
		_bottle(Vector2.ZERO)
		_restore()

func _viper_hero_back(_r: Dictionary, col: Color) -> void:
	limb(Vector2(-2.8, -9.6), Vector2(-4.6, -3.0), 2.6, dk(col, 0.45))
	for d in [0.0, 1.2, 2.4, 3.6]:
		limb(Vector2(-3.1 - d * 0.2, -10.0 - d), Vector2(-3.7 - d * 0.2, -12.8 - d), 0.6, Color("d9d3c6"))

func _viper_hero_head(_r: Dictionary, col: Color) -> void:
	_mask(col)
	_crown(col)

func _viper_hero_arm(r: Dictionary, col: Color, _w: float) -> void:
	var is_atk := String(r["st"]) == "attack"
	var a: float = float(r["a"]) if is_atk else 0.0
	var pull := 0.0
	if is_atk:
		pull = 4.2 * _ease_out(a / 0.4) if a < 0.4 else (4.2 if a < 0.47 else 0.0)
	var bx := 5.8
	var by := -8.4
	var fired: bool = is_atk and a >= 0.47
	var bend: float = 1.0 + (pull / 4.2) * 0.6
	quad_stroke(Vector2(bx, by - 9.0), Vector2(bx + 5.4 * bend, by), Vector2(bx, by + 9.0), WOOD, 1.6)
	polyline(PackedVector2Array([
		Vector2(bx, by - 9.0), Vector2(bx - pull, by), Vector2(bx, by + 9.0)]), Color("d9d3c6"), 0.7)
	if not fired and pull > 0.5:
		for o in [-1.8, 0.0, 1.8]:
			limb(Vector2(bx - pull, by + o * 0.5), Vector2(bx + 3.8, by + o), 0.8, Color("d9d3c6"))
	limb(Vector2(0.8, -8.4), Vector2(bx - 0.8, by), 2.2, col)
	limb(Vector2(-0.8, -8.2), Vector2(bx - pull - 1.2, by + 0.4), 2.1, dk(col, 0.32))
	if fired:
		var g: float = (a - 0.47) / 0.53
		var keep := ga
		ga = keep * maxf(0.0, 1.0 - g * 1.4)
		for o in [-3.2, 0.0, 3.2]:
			limb(Vector2(bx + 4.0 + g * 30.0, by + o * (0.4 + g)),
				Vector2(bx + 10.0 + g * 30.0, by + o * (0.55 + g * 1.2)), 0.9, Color("d9d3c6"))
		ga = keep

# ============================ العقارب ============================
func _scorp_common_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.45, 1.65, r, 5.4)
	_trail(r, func(s: float):
		var A: float = -0.45 + s * 1.65
		var p := Vector2(0.8 + sin(A + 1.2) * 5.4, -8.2 + cos(A + 1.2) * 4.6)
		limb(p, p + Vector2(sin(A + 1.75) * 4.4, cos(A + 1.75) * 4.0), 1.4, Color("b0aaa2")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var t2 := hp + Vector2(sin(A2 + 1.75) * 4.4, cos(A2 + 1.75) * 4.0)
	limb(hp, t2, 1.5, Color("8e8880"))
	_spark(t2, r)

func _scorp_boss_back(r: Dictionary, col: Color) -> void:
	var fl: float = (sin(float(r["p"])) * 1.4 if String(r["st"]) == "walk" else 0.0) + float(r["lunge"]) * 0.4
	tri(Vector2(-2.2, -9.4), Vector2(-5.4 - fl, 2.4), Vector2(1.6, -9.4), dk(col, 0.28))
	tri(Vector2(1.6, -9.4), Vector2(4.6 - fl, 2.4), Vector2(-2.2, -9.4), dk(col, 0.12))

func _scorp_boss_head(_r: Dictionary, col: Color) -> void:
	ellipse(Vector2(0.5, -15.1), 5.6, 1.3, dk(col, 0.55))
	rrect(-2.4, -18.6, 6.0, 3.8, 1.2, dk(col, 0.55))
	rrect(-2.4, -16.1, 6.0, 1.0, 0.3, col)

func _scorp_boss_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.4, 1.6, r, 5.4)
	_trail(r, func(s: float):
		var A: float = -0.4 + s * 1.6
		var p := Vector2(0.8 + sin(A + 1.2) * 5.4, -8.2 + cos(A + 1.2) * 4.6)
		limb(p, p + Vector2(sin(A + 1.8) * 3.4, cos(A + 1.8) * 3.0), 1.3, Color("dcd7cd")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var t2 := hp + Vector2(sin(A2 + 1.8) * 3.4, cos(A2 + 1.8) * 3.0)
	limb(hp, t2, 1.3, STEEL)
	_spark(t2, r)

func _medic_kit(x: float, y: float, w: float, h: float) -> void:
	rrect(x, y, w, h, 0.6, LINEN)

func _scorp_medic_back(_r: Dictionary, _col: Color) -> void:
	limb(Vector2(-2.8, -9.4), Vector2(2.8, -4.0), 0.9, Color("8a6a4a"))
	rrect(-5.6, -4.6, 3.2, 2.8, 0.6, LINEN)
	rrect(-4.4, -4.4, 0.8, 2.4, 0.0, CROSS)
	rrect(-5.2, -3.5, 2.4, 0.7, 0.0, CROSS)

func _scorp_medic_head(_r: Dictionary, _col: Color) -> void:
	rrect(-2.8, -15.0, 6.6, 1.8, 0.4, LINEN)
	rrect(-0.1, -15.0, 1.1, 1.8, 0.0, CROSS)

func _scorp_medic_arm(r: Dictionary, col: Color, w: float) -> void:
	var is_atk := String(r["st"]) == "attack"
	var a: float = float(r["a"]) if is_atk else 0.0
	var lift := 0.0
	if is_atk:
		if a < 0.4:
			lift = -4.2 * _ease_out(a / 0.4)
		elif a < 0.6:
			lift = -4.2
		else:
			lift = -4.2 + 4.2 * _ease((a - 0.6) / 0.4)
	_arm_to(col, Vector2(4.4, -5.8 + lift), w)
	rrect(3.2, -7.4 + lift, 3.0, 2.2, 0.5, LINEN)
	rrect(4.2, -7.2 + lift, 0.9, 1.8, 0.0, CROSS)
	rrect(3.4, -6.5 + lift, 2.6, 0.7, 0.0, CROSS)
	if is_atk and a > 0.35 and a < 0.9:
		var g: float = (a - 0.35) / 0.55
		var keep := ga
		ga = keep * sin(g * PI) * 0.95
		for i in 3:
			var o: float = fmod(g + float(i) * 0.33, 1.0)
			tri(Vector2(3.0 + float(i) * 1.6, -9.0 - o * 11.0),
				Vector2(4.6 + float(i) * 1.6, -11.0 - o * 11.0),
				Vector2(1.4 + float(i) * 1.6, -11.0 - o * 11.0), HEAL)
		ga = keep

func _scorp_hero_back(r: Dictionary, col: Color) -> void:
	var fl: float = (sin(float(r["p"])) * 1.4 if String(r["st"]) == "walk" else 0.0) + float(r["lunge"]) * 0.4
	tri(Vector2(-2.4, -9.6), Vector2(-5.8 - fl, 2.6), Vector2(1.8, -9.6), dk(col, 0.28))
	tri(Vector2(1.8, -9.6), Vector2(4.8 - fl, 2.6), Vector2(-2.4, -9.6), dk(col, 0.12))
	rrect(-6.0, -4.8, 3.4, 3.0, 0.6, LINEN)
	rrect(-4.7, -4.6, 0.9, 2.6, 0.0, CROSS)
	rrect(-5.6, -3.6, 2.6, 0.8, 0.0, CROSS)

func _scorp_hero_head(_r: Dictionary, col: Color) -> void:
	ellipse(Vector2(0.5, -15.3), 5.8, 1.4, dk(col, 0.55))
	rrect(-2.5, -18.9, 6.2, 3.9, 1.2, dk(col, 0.55))
	rrect(-2.5, -16.3, 6.2, 1.0, 0.3, LINEN)
	rrect(0.0, -16.3, 1.0, 1.0, 0.0, CROSS)
	_crown(col)

func _scorp_hero_arm(r: Dictionary, col: Color, w: float) -> void:
	var h := hand(-0.45, 1.65, r, 5.6)
	_trail(r, func(s: float):
		var A: float = -0.45 + s * 1.65
		var p := Vector2(0.8 + sin(A + 1.2) * 5.6, -8.2 + cos(A + 1.2) * 4.8)
		limb(p, p + Vector2(sin(A + 1.8) * 3.8, cos(A + 1.8) * 3.4), 1.3, Color("dcd7cd")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var t2 := hp + Vector2(sin(A2 + 1.8) * 3.8, cos(A2 + 1.8) * 3.4)
	limb(hp, t2, 1.4, STEEL)
	_spark(t2, r)
	var g: float = fmod(float(r["t"]) * 0.6, 1.0)
	var keep := ga
	ga = keep * sin(g * PI) * 0.7
	tri(Vector2(-4.6, -11.0 - g * 6.0), Vector2(-3.0, -13.0 - g * 6.0), Vector2(-6.2, -13.0 - g * 6.0), HEAL)
	ga = keep

# ============================ الشرطة (لون ثابت لا يتبع أي لاعب) ============================
func _police_chest(_r: Dictionary, col: Color) -> void:
	limb(Vector2(-3.6, -6.4), Vector2(4.0, -5.8), 1.2, dk(col, 0.3))

func _police_common_arm(r: Dictionary, col: Color, w: float) -> void:
	_save()
	_translate(Vector2(-5.2, -6.4 + (sin(float(r["p"])) * 0.5 if String(r["st"]) == "walk" else 0.0)))
	rrect(-2.0, -5.2, 4.4, 10.4, 1.2, lt(col, 0.3))
	rrect(-1.1, -4.0, 2.4, 8.0, 0.8, dk(col, 0.1))
	_restore()
	var h := hand(-0.5, 1.6, r, 5.2)
	_trail(r, func(s: float):
		var A: float = -0.5 + s * 1.6
		var p := Vector2(0.8 + sin(A + 1.2) * 5.2, -8.2 + cos(A + 1.2) * 4.5)
		limb(p, p + Vector2(sin(A + 1.75) * 4.0, cos(A + 1.75) * 3.6), 1.5, Color("dcd7cd")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var t2 := hp + Vector2(sin(A2 + 1.75) * 4.0, cos(A2 + 1.75) * 3.6)
	limb(hp, t2, 1.7, Color("2b2825"))
	_spark(t2, r)

func _police_captain_chest(_r: Dictionary, col: Color) -> void:
	rrect(-3.6, -8.2, 7.4, 5.4, 1.0, dk(col, 0.25))
	limb(Vector2(-3.8, -9.2), Vector2(4.2, -9.2), 2.4, dk(col, 0.15))
	rrect(2.0, -8.6, 1.6, 1.6, 0.3, Color("e8d47a"))

func _police_captain_head(_r: Dictionary, col: Color) -> void:
	_cap(col)
	rrect(-2.9, -19.0, 6.8, 1.0, 0.3, Color("e8d47a"))

func _police_captain_arm(r: Dictionary, col: Color, w: float) -> void:
	_save()
	_translate(Vector2(-5.6, -6.6 + (sin(float(r["p"])) * 0.5 if String(r["st"]) == "walk" else 0.0)))
	rrect(-2.2, -6.0, 4.8, 12.0, 1.4, lt(col, 0.3))
	rrect(-1.2, -4.6, 2.6, 9.2, 0.8, dk(col, 0.1))
	ellipse(Vector2(0.2, 0), 1.3, 1.3, Color("e8d47a"))
	_restore()
	var h := hand(-0.55, 1.65, r, 5.6)
	_trail(r, func(s: float):
		var A: float = -0.55 + s * 1.65
		var p := Vector2(0.8 + sin(A + 1.2) * 5.6, -8.2 + cos(A + 1.2) * 4.8)
		limb(p, p + Vector2(sin(A + 1.78) * 4.4, cos(A + 1.78) * 4.0), 1.6, Color("dcd7cd")))
	_arm_to(col, h["p"], w)
	var A2: float = h["A"]
	var hp: Vector2 = h["p"]
	var t2 := hp + Vector2(sin(A2 + 1.78) * 4.4, cos(A2 + 1.78) * 4.0)
	limb(hp, t2, 1.8, Color("2b2825"))
	limb(t2 - (t2 - hp) * 0.2, t2, 2.0, Color("9aa0a8"))
	_spark(t2, r)

# ============================ الضربة المميزة (ult) — القسم 6.7 ============================
# وهج ذهبي يكبر أثناء الاستعداد ثم ينفجر
func _ult_glow(r: Dictionary) -> void:
	var a: float = float(r["a"])
	var g: float = a / 0.44 if a < 0.44 else maxf(0.0, 1.0 - (a - 0.44) / 0.3)
	var keep := ga
	ga = keep * 0.35 * g
	ellipse(Vector2(0, -11), 9.0 + g * 4.0, 13.0 + g * 5.0, Color(1.0, 0.839, 0.431, 0.55))
	ga = keep * 0.8 * g
	ellipse_stroke(Vector2(0, 0.6), 7.0 + g * 4.0, 2.8 + g * 1.6, Color(1.0, 0.839, 0.431, 0.95), 1.1)
	ga = keep

# موجة أرضية عند الارتطام
func _shock_ring(r: Dictionary, p: Vector2, rad: float, col: Color) -> void:
	if float(r["a"]) < 0.44:
		return
	var g: float = minf(1.0, (float(r["a"]) - 0.44) / 0.34)
	var keep := ga
	ga = keep * (1.0 - g) * 0.9
	ellipse_stroke(p, rad * g, rad * g * 0.42, col, 2.2 - g)
	ellipse_stroke(p, rad * g * 0.6, rad * g * 0.26, col, 1.2)
	ga = keep

# درع تصلّب حول الجسم
func _barrier() -> void:
	var keep := ga
	ga = keep * 0.28
	ellipse(Vector2(0, -11), 8.5, 12.5, Color("bfe2ff"))
	ga = keep * 0.9
	ellipse_stroke(Vector2(0, -11), 8.5, 12.5, Color("8fd0ff"), 1.0)
	ga = keep

# هالة تتمدد (توحش أو علاج)
func _aura_burst(r: Dictionary, rad: float, col: Color) -> void:
	if float(r["a"]) < 0.4:
		return
	var g: float = minf(1.0, (float(r["a"]) - 0.4) / 0.4)
	var keep := ga
	ga = keep * (1.0 - g) * 0.85
	ellipse_stroke(Vector2(0, 0.5), rad * g, rad * g * 0.4, col, 1.8)
	ga = keep

func _heal_cross(p: Vector2, s: float) -> void:
	rrect(p.x - 1.4 * s, p.y - 0.5 * s, 2.8 * s, 1.0 * s, 0.0, HEAL)
	rrect(p.x - 0.5 * s, p.y - 1.4 * s, 1.0 * s, 2.8 * s, 0.0, HEAL)

func _draw_ult(key: String, r: Dictionary, col: Color) -> void:
	var a: float = float(r["a"])
	match key:
		"hammer_breaker":
			_shock_ring(r, Vector2(7, 0.4), 15.0, ULT_GOLD)
			if a >= 0.44 and a < 0.6:
				var keep := ga
				ga = keep * 0.5
				for p in [Vector2(5, 1), Vector2(9, -0.4), Vector2(12, 1.4)]:
					limb(p, p + Vector2(2.4, -1.6), 0.9, Color("7a6a52"))
				ga = keep
		"hammer_shield":
			_body_begin(r)
			_barrier()
			_body_end()
		"hammer_hero":
			_body_begin(r)
			_barrier()
			_body_end()
			_shock_ring(r, Vector2(7, 0.4), 19.0, ULT_GOLD)
			if a >= 0.44 and a < 0.62:
				var keep2 := ga
				ga = keep2 * 0.55
				for p in [Vector2(5, 1), Vector2(10, -0.6), Vector2(14, 1.6), Vector2(17, -0.2)]:
					limb(p, p + Vector2(3, -2), 1.0, Color("7a6a52"))
				ga = keep2
		"viper_sniper":
			_body_begin(r)
			if a >= 0.47:
				var g: float = (a - 0.47) / 0.53
				var keep3 := ga
				ga = keep3 * maxf(0.0, 1.0 - g * 1.1)
				limb(Vector2(9.8 + g * 46.0, -8.2), Vector2(20.0 + g * 46.0, -8.2), 1.6, ULT_GOLD)
				limb(Vector2(9.8 + g * 46.0, -8.2), Vector2(26.0 + g * 46.0, -8.2), 0.7, ULT_PALE)
				ga = keep3
			_body_end()
		"viper_firebomber":
			_body_begin(r)
			if a >= 0.44:
				var g2: float = (a - 0.44) / 0.56
				var p2 := Vector2(6.0 + 4.0 + g2 * 24.0, -12.4 - sin(g2 * PI) * 7.0)
				var keep4 := ga
				ga = keep4 * 0.85
				ellipse(p2, 2.6 + g2 * 2.0, 2.6 + g2 * 2.0, Color("e8893a"))
				ellipse(p2, 1.4 + g2 * 1.2, 1.4 + g2 * 1.2, Color("f7d354"))
				ga = keep4
			_body_end()
			if a >= 0.62:
				var g3: float = (a - 0.62) / 0.38
				var keep5 := ga
				ga = keep5 * (1.0 - g3) * 0.8
				ellipse(Vector2(26, 0.6), 6.0 + g3 * 10.0, 2.4 + g3 * 4.0, Color(0.910, 0.537, 0.227, 0.65))
				for i in 5:
					var o: float = fmod(float(i) / 5.0 + g3, 1.0)
					tri(Vector2(20.0 + float(i) * 3.0, 0.4 - o * 7.0),
						Vector2(22.0 + float(i) * 3.0, -3.0 - o * 7.0),
						Vector2(18.0 + float(i) * 3.0, -3.0 - o * 7.0), Color("f7d354"))
				ga = keep5
		"viper_hero":
			_body_begin(r)
			if a >= 0.47:
				var g4: float = (a - 0.47) / 0.53
				var keep6 := ga
				ga = keep6 * maxf(0.0, 1.0 - g4 * 1.1)
				for o in [-3.6, 0.0, 3.6]:
					var y: float = -8.4 + o * (0.5 + g4 * 1.4)
					limb(Vector2(9.8 + g4 * 40.0, y), Vector2(20.0 + g4 * 40.0, y), 1.5, Color("e8893a"))
					limb(Vector2(9.8 + g4 * 40.0, y), Vector2(24.0 + g4 * 40.0, y), 0.7, Color("f7d354"))
					ellipse(Vector2(20.0 + g4 * 40.0, y), 1.8, 1.6, Color(0.969, 0.827, 0.329, 0.8))
				ga = keep6
			_body_end()
		"scorp_boss":
			_aura_burst(r, 13.0, Color("e0553f"))
			_body_begin(r)
			if a >= 0.4:
				var g5: float = (a - 0.4) / 0.6
				var keep7 := ga
				ga = keep7 * (1.0 - g5) * 0.6
				ellipse(Vector2(0.5, -12.6), 4.4, 4.6, Color("e0553f"))
				ga = keep7
			_body_end()
		"scorp_medic":
			_aura_burst(r, 11.0, HEAL)
			if a >= 0.4:
				var g6: float = (a - 0.4) / 0.6
				var keep8 := ga
				ga = keep8 * (1.0 - g6) * 0.9
				for i in 5:
					var ang: float = float(i) * 1.256 + 0.3
					var d: float = 3.0 + g6 * 9.0
					_heal_cross(Vector2(cos(ang) * d, -6.0 + sin(ang) * d * 0.5 - g6 * 5.0), 1.0)
				ga = keep8
		"scorp_hero":
			_aura_burst(r, 14.0, Color("e0553f"))
			if a >= 0.45:
				var g7: float = minf(1.0, (a - 0.45) / 0.4)
				var keep9 := ga
				ga = keep9 * (1.0 - g7) * 0.85
				ellipse_stroke(Vector2(0, 0.5), 11.0 * g7, 11.0 * g7 * 0.4, HEAL, 1.8)
				for i in 4:
					var ang2: float = float(i) * 1.57 + 0.4
					var d2: float = 3.0 + g7 * 8.0
					_heal_cross(Vector2(cos(ang2) * d2, -6.0 + sin(ang2) * d2 * 0.5 - g7 * 5.0), 0.93)
				ga = keep9
		"crow_spear":
			_body_begin(r)
			if a >= 0.4 and a < 0.62:
				var g8: float = (a - 0.4) / 0.22
				var keepA := ga
				ga = keepA * (1.0 - g8) * 0.85
				limb(Vector2(8, -9.6), Vector2(20.0 + g8 * 6.0, -9.6), 2.4, ULT_GOLD)
				tri(Vector2(20.0 + g8 * 6.0, -7.4), Vector2(26.0 + g8 * 6.0, -9.6),
					Vector2(20.0 + g8 * 6.0, -11.8), ULT_PALE)
				ga = keepA
			_body_end()
		"crow_dual":
			_body_begin(r)
			if a >= 0.38 and a < 0.68:
				var g9: float = (a - 0.38) / 0.3
				var keepB := ga
				ga = keepB * (1.0 - g9) * 0.75
				var offs := [-2.4, -0.6, 1.2, 3.0]
				for i in offs.size():
					var o: float = offs[i]
					var d3: float = 6.0 + float(i) * 1.4 + g9 * 4.0
					limb(Vector2(3, -9.0 + o), Vector2(3.0 + d3, -9.0 + o - 1.6), 1.5,
						ULT_GOLD if i % 2 == 1 else ULT_PALE)
				ga = keepB
			_body_end()
		"crow_hero":
			_body_begin(r)
			if a >= 0.38 and a < 0.72:
				var gA: float = (a - 0.38) / 0.34
				var keepC := ga
				ga = keepC * (1.0 - gA) * 0.8
				for i in 4:
					var ang3: float = -1.1 + float(i) * 0.55
					var p1 := Vector2(2.0 + sin(ang3) * 5.0, -9.0 + cos(ang3) * 5.0)
					var p3 := Vector2(2.0 + sin(ang3) * (13.0 + gA * 4.0), -9.0 + cos(ang3) * (13.0 + gA * 4.0))
					limb(p1, p3, 1.7, ULT_GOLD if i % 2 == 1 else ULT_PALE)
				ga = keepC
			_body_end()
			_shock_ring(r, Vector2(8, 0.4), 12.0, Color(1.0, 0.839, 0.431, 0.8))
		"police_common":
			_body_begin(r)
			if a >= 0.44:
				var gB: float = (a - 0.44) / 0.4
				var keepD := ga
				ga = keepD * maxf(0.0, 1.0 - gB) * 0.8
				arc_stroke(Vector2(6, -8.6), 3.0 + gB * 5.0, -0.9, 0.9, Color("bfe2ff"), 1.4)
				ga = keepD
			_body_end()
		"police_captain":
			_aura_burst(r, 12.0, Color("7fb0e6"))
			_body_begin(r)
			if a >= 0.4:
				var gC: float = (a - 0.4) / 0.6
				var keepE := ga
				ga = keepE * (1.0 - gC) * 0.6
				ellipse(Vector2(0.5, -12.6), 4.4, 4.6, Color("7fb0e6"))
				ga = keepE
			_body_end()

# ============================ رسم الوحدة ============================
func _draw_figure(key: String, r: Dictionary, col: Color) -> void:
	match key:
		"crow_common":
			_stick(r, col, 1.9, 2.9, _crow_common_back, Callable(),
				func(_rr, cl): _hood(cl), _crow_common_arm)
		"crow_spear":
			_stick(r, col, 2.1, 3.0, Callable(), Callable(),
				func(_rr, cl): _hood(cl), _crow_spear_arm)
		"crow_dual":
			_stick(r, col, 1.9, 2.9, _crow_dual_back, Callable(),
				func(_rr, cl): _hood(cl), _crow_dual_arm)
		"crow_hero":
			_hero_ring()
			_stick(r, col, 2.3, 3.1, _crow_hero_back, Callable(), _crow_hero_head, _crow_hero_arm)
		"hammer_common":
			_stick(r, col, 2.6, 3.1, Callable(), _hammer_chest,
				func(_rr, cl): _helm(cl), _hammer_common_arm)
		"hammer_shield":
			_stick(r, col, 3.0, 3.2, Callable(), _hammer_chest_wide,
				func(_rr, cl): _helm(cl), _hammer_shield_arm)
		"hammer_breaker":
			_stick(r, col, 3.0, 3.2, Callable(), _hammer_chest_wide,
				_hammer_breaker_head, _hammer_breaker_arm)
		"hammer_hero":
			_hero_ring()
			_stick(r, col, 3.2, 3.3, Callable(), _hammer_hero_chest, _hammer_hero_head, _hammer_hero_arm)
		"viper_common":
			_stick(r, col, 1.9, 2.9, Callable(), Callable(),
				func(_rr, cl): _mask(cl), _viper_common_arm)
		"viper_sniper":
			_stick(r, col, 1.9, 2.9, _viper_sniper_back, Callable(),
				func(_rr, cl): _mask(cl), _viper_sniper_arm)
		"viper_firebomber":
			_stick(r, col, 1.9, 2.9, Callable(), _viper_fire_chest,
				func(_rr, cl): _mask(cl), _viper_fire_arm)
		"viper_hero":
			_hero_ring()
			_stick(r, col, 2.3, 3.1, _viper_hero_back, Callable(), _viper_hero_head, _viper_hero_arm)
		"scorp_common":
			_stick(r, col, 2.1, 3.0, Callable(), Callable(),
				func(_rr, cl): _band(cl), _scorp_common_arm)
		"scorp_boss":
			var pulse: float = 1.0 + sin(float(r["t"]) * 2.4) * 0.05
			ellipse_dashed(Vector2(0, 0.5), 10.5 * pulse, 4.2 * pulse, Color(0.941, 0.714, 0.290, 0.9), 1.0)
			_stick(r, col, 2.3, 3.1, _scorp_boss_back, Callable(), _scorp_boss_head, _scorp_boss_arm)
		"scorp_medic":
			_stick(r, col, 2.0, 3.0, _scorp_medic_back, Callable(), _scorp_medic_head, _scorp_medic_arm)
		"scorp_hero":
			var pulse2: float = 1.0 + sin(float(r["t"]) * 2.4) * 0.06
			ellipse_dashed(Vector2(0, 0.5), 11.5 * pulse2, 4.6 * pulse2, Color(0.941, 0.714, 0.290, 0.9), 1.0)
			ellipse_dashed(Vector2(0, 0.5), 8.4 * pulse2, 3.4 * pulse2, Color(0.498, 0.831, 0.541, 0.8), 1.0)
			_stick(r, col, 2.4, 3.2, _scorp_hero_back, Callable(), _scorp_hero_head, _scorp_hero_arm)
		"police_common":
			_stick(r, col, 2.2, 3.0, Callable(), _police_chest,
				func(_rr, cl): _cap(cl), _police_common_arm)
		"police_captain":
			ellipse_dashed(Vector2(0, 0.5), 8.6, 3.4, Color(0.471, 0.667, 0.902, 0.75), 0.9)
			_stick(r, col, 2.6, 3.1, Callable(), _police_captain_chest,
				_police_captain_head, _police_captain_arm)

# الواجهة الرئيسية — تقابل drawUnit في المرجع.
# state: idle | walk | attack | ult | hurt | death
# في hurt و death مرّر t = الزمن المنقضي داخل الحالة.
# px = كم بكسل على الشاشة تساوي وحدة واحدة من نظام الرسم المحلي (المقياس × تقريب
# الكاميرا). صفر يعني ارسم كل التفاصيل (الفحوص والمعرض).
func draw_unit(canvas, key: String, pos: Vector2, t: float, state: String,
		col: Color, dir: int = 1, sc: float = 1.0, rate: float = 1.0, move: String = "",
		px: float = 0.0) -> void:
	var u: Dictionary = UNITS.get(key, {})
	if u.is_empty():
		return
	ci = canvas
	ga = 1.0
	_px = px
	_stack.clear()

	var color: Color = POLICE if u.get("neutral", false) else col
	var r := _rig(t, state, float(u.get("spd", 1.0)), rate, move)

	var sx: float = sc * float(dir) * float(u.get("sx", 1.0))
	var sy: float = sc * float(u.get("sy", 1.0))
	_xf = Transform2D(0.0, pos) * Transform2D(Vector2(sx, 0), Vector2(0, sy), Vector2.ZERO)
	ci.draw_set_transform_matrix(_xf)

	if r["ult"]:
		_ult_glow(r)

	var shadow_w: float = float(u.get("shadow_w", 3.8))
	if float(r["death"]) >= 0.0:
		var d: float = float(r["death"])
		var k: float = _ease(minf(1.0, d * 1.25))
		ga = 1.0 if d <= 0.72 else maxf(0.0, 1.0 - (d - 0.72) / 0.28)
		shadow(r, shadow_w * (1.0 + k * 0.5))
		_translate(Vector2(-k * 3.4, 0))
		_rotate(-k * 1.5708)
	else:
		shadow(r, shadow_w)

	_draw_figure(key, r, color)
	if r["ult"]:
		_draw_ult(key, r, color)

	# الحركة الدائرية: حلقة تتسع حول القدمين لحظة الضرب (5.4.2)
	if move == "spin" and String(r["st"]) == "attack" and float(r["fx"]) > 0.0:
		var g: float = 1.0 - float(r["fx"])
		ga = float(r["fx"]) * 0.9
		ellipse_dashed(Vector2(0, 0.5), 7.0 + g * 9.0, 2.8 + g * 3.6, STEEL, 1.0)
		ga = 1.0

	var flinch: float = float(r["flinch"])
	if flinch > 0.0:
		ga = flinch * 0.6
		for i in 4:
			var ang: float = float(i) * 1.57 + 0.6
			limb(Vector2(2, -12), Vector2(2.0 + cos(ang) * (3.0 + flinch * 4.0),
				-12.0 + sin(ang) * (3.0 + flinch * 4.0)), 1.0, Color("e05a4a"))

	ga = 1.0
	ci.draw_set_transform_matrix(Transform2D())
