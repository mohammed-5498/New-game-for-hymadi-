class_name UnitMesh
extends RefCounted
# مخزن أشكال الوحدات كمثلثات جاهزة — القسم 14.
#
# المشكلة المقيسة: رسم وحدة واحدة = 43 أمر رسم، وتُعاد كلها في كل إطار لأن الوحدة
# تتحرك. ستون وحدة على الشاشة = 2580 أمراً في الإطار الواحد، وهذا هو البطء الباقي
# بعد أن صارت الخريطة لوحات ثابتة.
#
# الحل: شكل الوحدة لا يعتمد على موضعها، إنما على (المفتاح، الحالة، الحركة، طور
# الأنميشن، اللون). وكل حالة رسم لها **طور واحد فقط** (فُحص في `_rig`)، فعدد
# الأشكال الممكنة محدود. فنحوّل الشكل مرة واحدة إلى مصفوفة مثلثات ونخزّنها، ثم
# نرسم الوحدة بأمر واحد (`draw_mesh`) مع تحويل الموضع والحجم.
#
# لماذا مثلثات لا صور جاهزة؟
#   - لا ضبابية: المثلثات تكبر مع التقريب بلا فقد دقة، بخلاف الصورة المخزّنة بحجم ثابت.
#   - ذاكرة أقل: الشكل رؤوس لا بكسلات.
#   - تُبنى بالحساب لا بالرسم على الشاشة، فتعمل وتُفحص بلا شاشة (CI).

# ---------- المُسجِّل: يقلّد واجهة CanvasItem ويجمع المثلثات بدل أن يرسم ----------
# الرؤوس مفهرسة: الشكل الواحد كان 1418 رأساً بلا فهرسة لأن كل مثلث يكرر رؤوسه،
# وكل خط كان ثلاثة أشكال (مستطيل + دائرتان للنهايتين). بالفهرسة وبرسم الخط
# ككبسولة واحدة نزل العدد إلى الخُمس تقريباً (14).
class Recorder:
	extends RefCounted
	var pts := PackedVector2Array()
	var cols := PackedColorArray()
	var idx := PackedInt32Array()
	var xf := Transform2D()

	func draw_set_transform_matrix(m: Transform2D) -> void:
		xf = m

	# يضيف مروحة مثلثات حول الرأس الأول من قائمة نقاط بلون واحد
	func _fan(poly: PackedVector2Array, col: Color) -> void:
		var base: int = pts.size()
		for p in poly:
			pts.push_back(xf * p)
			cols.push_back(col)
		for i in range(1, poly.size() - 1):
			idx.push_back(base)
			idx.push_back(base + i)
			idx.push_back(base + i + 1)

	# خط بنهايتين دائريتين = مضلع واحد مغلق (كبسولة)، بدل مستطيل ودائرتين
	func draw_line(a: Vector2, b: Vector2, col: Color, w: float = 1.0, _aa: bool = false) -> void:
		var d: Vector2 = b - a
		var ln: float = d.length()
		var rad: float = maxf(w, 0.01) * 0.5
		if ln < 0.00001:
			_fan(_ring(a, rad, rad, CAP_SEG * 2), col)
			return
		var ang: float = atan2(d.y, d.x)
		var poly := PackedVector2Array()
		# نصف دائرة عند b ثم نصف دائرة عند a
		for i in CAP_SEG + 1:
			var t: float = ang - PI * 0.5 + PI * float(i) / float(CAP_SEG)
			poly.push_back(b + Vector2(cos(t), sin(t)) * rad)
		for i in CAP_SEG + 1:
			var t2: float = ang + PI * 0.5 + PI * float(i) / float(CAP_SEG)
			poly.push_back(a + Vector2(cos(t2), sin(t2)) * rad)
		_fan(poly, col)

	static func _ring(c: Vector2, rx: float, ry: float, seg: int) -> PackedVector2Array:
		var out := PackedVector2Array()
		for i in seg:
			var ang: float = TAU * float(i) / float(seg)
			out.push_back(c + Vector2(cos(ang) * rx, sin(ang) * ry))
		return out

	func draw_circle(c: Vector2, rad: float, col: Color, _f: bool = true,
			_w: float = -1.0, _aa: bool = false) -> void:
		_fan(_ring(c, rad, rad, CAP_SEG * 2), col)

	func draw_rect(r: Rect2, col: Color, _f: bool = true, _w: float = -1.0,
			_aa: bool = false) -> void:
		_fan(PackedVector2Array([
			r.position, r.position + Vector2(r.size.x, 0),
			r.position + r.size, r.position + Vector2(0, r.size.y)]), col)

	func draw_arc(c: Vector2, rad: float, from_ang: float, to_ang: float, n: int,
			col: Color, w: float = 1.0, _aa: bool = false) -> void:
		var steps: int = maxi(2, n)
		var prev := c + Vector2(cos(from_ang) * rad, sin(from_ang) * rad)
		for i in range(1, steps + 1):
			var ang: float = from_ang + (to_ang - from_ang) * float(i) / float(steps)
			var cur := c + Vector2(cos(ang) * rad, sin(ang) * rad)
			draw_line(prev, cur, col, w)
			prev = cur

	func draw_colored_polygon(poly: PackedVector2Array, col: Color,
			_uv: PackedVector2Array = PackedVector2Array(), _t: Texture2D = null) -> void:
		var k: int = poly.size()
		if k < 3:
			return
		if k <= 4:
			_fan(poly, col)
			return
		# أشكال السلاح قد تكون مقعّرة، فنستعمل مثلّث المحرك ونرجع إلى المروحة إن فشل
		var tri := Geometry2D.triangulate_polygon(poly)
		if tri.size() < 3:
			_fan(poly, col)
			return
		var base: int = pts.size()
		for p in poly:
			pts.push_back(xf * p)
			cols.push_back(col)
		for i in tri.size():
			idx.push_back(base + tri[i])

# أضلاع نصف دائرة النهاية: أربعة تكفي لنهاية قطرها بضعة بكسلات
const CAP_SEG := 3

# ---------- عدد الأطوار المخزّنة لكل حالة ----------
# كلما زاد العدد نعم الأنميشن وزادت الذاكرة. القيم هنا من التجربة: المشي والقتال
# يحتاجان تفصيلاً، والحالات القصيرة تكفيها أطوار قليلة.
const FRAMES := {
	"idle": 8, "walk": 10, "attack": 10, "hurt": 5,
	"death": 10, "dodge": 5, "block": 5, "stagger": 6,
}
# حالة غير مذكورة هنا (مثل ult) تُرسم بالطريقة القديمة: نادرة ولها توهّج متغيّر

var _cache := {}          # المفتاح النصّي -> ArrayMesh
var _verts := 0           # مجموع الرؤوس المخزّنة (لحساب الذاكرة)
var _idxs := 0            # ومجموع الفهارس
var builds := 0           # كم شكلاً بُني (للفحص)
var hits := 0             # وكم مرة استُعمل مخزَّن جاهز
var full := 0             # وكم مرة رُفض البناء لبلوغ سقف الذاكرة

func clear() -> void:
	_cache.clear()
	_verts = 0
	_idxs = 0
	builds = 0
	hits = 0
	full = 0

func bytes() -> int:
	# رأس واحد = موضع (8 بايت) + لون (16 بايت)، وكل فهرس 4 بايت
	return _verts * 24 + _idxs * 4

func size() -> int:
	return _cache.size()

# هل لهذه الحالة أشكال مخزّنة أصلاً؟
static func supports(state: String) -> bool:
	return FRAMES.has(state)

# طور الأنميشن من 0 إلى 1: لكل حالة طور واحد، وهذا هو ما يجعل التخزين ممكناً.
# الدوري (وقوف ومشي وقتال) يلتف، والقصير (إصابة وموت وتفادٍ...) يتوقف عند النهاية.
static func phase_of(state: String, t: float, spd: float, rate: float) -> float:
	match state:
		"walk":
			return fposmod(t * 2.55 * spd, 1.0)
		"attack":
			return fposmod(t / maxf(0.0001, rate), 1.0)
		"idle":
			return fposmod(t * 1.25 * spd * 0.5, 1.0)
		"hurt":
			return clampf(t / UnitsArt.HURT_DUR, 0.0, 1.0)
		"death":
			return clampf(t / UnitsArt.DEATH_DUR, 0.0, 1.0)
		"dodge", "block":
			return clampf(t / UnitsArt.DODGE_DUR, 0.0, 1.0)
		"stagger":
			return clampf(t / UnitsArt.STAGGER_DUR, 0.0, 1.0)
	return 0.0

# الطور -> رقم الشكل المخزّن، ثم منه -> الزمن الذي يُبنى به الشكل
static func frame_of(state: String, phase: float) -> int:
	var n: int = int(FRAMES.get(state, 1))
	var cyclic: bool = state == "walk" or state == "attack" or state == "idle"
	if cyclic:
		return posmod(int(floor(phase * float(n))), n)
	return clampi(int(round(phase * float(n - 1))), 0, n - 1)

static func _time_of(state: String, frame: int, spd: float, rate: float) -> float:
	var n: int = int(FRAMES.get(state, 1))
	var cyclic: bool = state == "walk" or state == "attack" or state == "idle"
	# منتصف الشريحة للدوري حتى لا يقع الشكل على حافة الحركة
	var ph: float = (float(frame) + 0.5) / float(n) if cyclic else float(frame) / float(maxi(1, n - 1))
	match state:
		"walk":
			return ph / maxf(0.0001, 2.55 * spd)
		"attack":
			return ph * rate
		"idle":
			return ph / maxf(0.0001, 1.25 * spd * 0.5)
		"hurt":
			return ph * UnitsArt.HURT_DUR
		"death":
			return ph * UnitsArt.DEATH_DUR
		"dodge", "block":
			return ph * UnitsArt.DODGE_DUR
		"stagger":
			return ph * UnitsArt.STAGGER_DUR
	return 0.0

# الشكل المخزّن لهذه الحالة، يُبنى عند أول طلب ثم يُعاد استعماله
func mesh_for(art: UnitsArt, key: String, state: String, move: String,
		frame: int, col: Color) -> ArrayMesh:
	var id := "%s|%s|%s|%d|%d" % [key, state, move, frame, col.to_rgba32()]
	var got = _cache.get(id)
	if got != null:
		hits += 1
		return got
	# سقف الذاكرة: ما بعده لا يُخزَّن ويُرسم بالطريقة القديمة. الحد الأقصى النظري
	# ثمانية لاعبين بأربع عصابات، وهو أضعاف ما تستعمله مباراة فعلية (14).
	if float(bytes()) >= GC.MESH_CACHE_MB * 1048576.0:
		full += 1
		return null
	var u: Dictionary = UnitsArt.UNITS.get(key, {})
	if u.is_empty():
		return null
	var spd: float = float(u.get("spd", 1.0))
	# المخزون يُبنى بزمن ضربة = 1 دائماً، والطور هو ما يُطابَق عليه وقت الرسم
	var t: float = _time_of(state, frame, spd, 1.0)
	var rec := Recorder.new()
	# بلا موضع ولا حجم ولا اتجاه: هذه كلها تحويل يُطبَّق وقت الرسم
	art.draw_unit(rec, key, Vector2.ZERO, t, state, col, 1, 1.0, 1.0, move, 0.0)
	if rec.pts.size() < 3:
		return null
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	var v3 := PackedVector3Array()
	v3.resize(rec.pts.size())
	for i in rec.pts.size():
		v3[i] = Vector3(rec.pts[i].x, rec.pts[i].y, 0.0)
	arrays[Mesh.ARRAY_VERTEX] = v3
	arrays[Mesh.ARRAY_COLOR] = rec.cols
	arrays[Mesh.ARRAY_INDEX] = rec.idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	_cache[id] = m
	_verts += rec.pts.size()
	_idxs += rec.idx.size()
	builds += 1
	return m

# رسم وحدة بأمر واحد. يرجع false إن لم يكن لهذه الحالة شكل مخزَّن.
func draw(ci: CanvasItem, art: UnitsArt, key: String, pos: Vector2, t: float,
		state: String, col: Color, dir: int, sc: float, rate: float, move: String) -> bool:
	if not FRAMES.has(state):
		return false
	var u: Dictionary = UnitsArt.UNITS.get(key, {})
	if u.is_empty():
		return false
	var spd: float = float(u.get("spd", 1.0))
	var ph: float = phase_of(state, t, spd, rate)
	var m := mesh_for(art, key, state, move, frame_of(state, ph), col)
	if m == null:
		return false
	# نسب المفتاح (sx و sy) مخزَّنة في الشكل نفسه لأنها ثابتة، فلا تُطبَّق ثانية هنا.
	# الباقي وحده هو ما يتغير بين وحدة وأخرى: الموضع والحجم والاتجاه.
	ci.draw_mesh(m, null, Transform2D(Vector2(sc * float(dir), 0), Vector2(0, sc), pos))
	return true
