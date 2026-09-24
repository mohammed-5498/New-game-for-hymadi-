class_name GroundMesh
extends Node2D
# أرض الخريطة كلها بأمرَي رسم بدل ألف وستمئة (14 — الأداء).
#
# كل مربعات الأرض شكل واحد: معيّن بنفس المقاس، لا يختلف إلا لونه وموضعه.
# وهذا هو بالضبط ما صُنع له MultiMesh: نسخ كثيرة من شكل واحد تُرسل إلى بطاقة
# الرسم دفعة واحدة. فبدل `draw_colored_polygon` لكل مربع (ومعه خطّ حدّه) صارت
# الأرض كلها نسخاً في مخزن واحد.
#
# المقيس على الخريطة الكبيرة 42×42 عند التقريب الافتراضي، ثلاث إعادات:
#   الأرض بالطريقة القديمة : 1487 – 1645 أمر رسم
#   الأرض بـ MultiMesh     : 2 (التعبئة وعلامات الشوارع)
#   أوامر الإطار كله       : 4038 – 4424  ->  2554  (أقل بـ 37%)
#   زمن الإطار             : 41.3 / 43.8 / 42.5 ms  ->  32.8 / 33.6 / 33.2
# (القياس على راسم برمجي لا على جوال، فنسبة زمن الإطار قد تختلف على الجهاز؛
#  أما عدد أوامر الرسم فرقم لا يتأثر بالبيئة.)
#
# لماذا الأرض ولا تصلح للوحدات: المعيّن شكل واحد لكل المربعات، والأرض تحت كل
# شيء فلا يهم ترتيبها مع المباني. الوحدات بعكسه: لكل وحدة شكل يختلف بنوعها
# وحالتها وإطار حركتها، وترتيبها مع المباني قطراً بقطر شرطُ صحة المنظر المائل.
# وهي أصلاً أمر رسم واحد لكل وحدة بفضل `unit_mesh.gd`، فلا شيء ليُوفَّر.
#
# حدّ المربع: الطريقة القديمة كانت تتبع المعيّن بخط بنفس لونه عرضه GC.GROUND_EDGE،
# فيكبر المربع قليلاً ويتداخل مع جيرانه. نكبّر المعيّن هنا بنصف عرض ذلك الخط
# قياساً على العمود النازل من مركزه إلى ضلعه، فيخرج المنظر كما كان بالضبط.
# **قياس صادق:** المعيّنات متجاورة تماماً، فحتى بلا هذا التكبير لا يظهر فراغ
# (فُحص: صفر بكسل فراغ عند f = 1.0 على أربعة مستويات تقريب). التكبير للمطابقة
# البصرية وهامش أمان على أجهزة قد تقرّب الحواف بطريقة أخرى، لا لسدّ فراغ قائم.
# أما تصغير المعيّن فيفتح فراغاً فعلاً (فُحص: نحو 7000 بكسل عند تصغير 10%).

var fill: MultiMeshInstance2D = null      # تعبئة كل المربعات
var dashes: MultiMeshInstance2D = null    # علامات منتصف الشوارع
var dist_tiles: Array = []                # مربعات كل حي، لتحديث لونه وحده
var _n := 0

# ---- بناء الشكلين ----

# معيّن المربع، مكبَّراً بقدر نصف عرض حدّ المربع القديم
static func _diamond() -> ArrayMesh:
	var half: float = GC.GROUND_EDGE * 0.5
	var f: float = 1.0 + half * sqrt(GC.TW * GC.TW + GC.TH * GC.TH) / (GC.TW * GC.TH)
	var w: float = GC.TW * f
	var h: float = GC.TH * f
	return _quad(PackedVector2Array([
		Vector2(-w, 0.0), Vector2(0.0, -h), Vector2(w, 0.0), Vector2(0.0, h)]))

# مستطيل رفيع بطول علامة الشارع، يُدار لكل مربع حسب اتجاه علامته
static func _dash() -> ArrayMesh:
	var l: float = sqrt(GC.DASH_DX * GC.DASH_DX + GC.DASH_DY * GC.DASH_DY)
	var t: float = GC.DASH_W * 0.5
	return _quad(PackedVector2Array([
		Vector2(-l, -t), Vector2(l, -t), Vector2(l, t), Vector2(-l, t)]))

# أربع نقاط -> مثلثان، بلون أبيض حتى يصير لون النسخة هو اللون الظاهر
static func _quad(v: PackedVector2Array) -> ArrayMesh:
	var a := []
	a.resize(Mesh.ARRAY_MAX)
	a[Mesh.ARRAY_VERTEX] = v
	a[Mesh.ARRAY_COLOR] = PackedColorArray([Color.WHITE, Color.WHITE, Color.WHITE, Color.WHITE])
	a[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2, 0, 2, 3])
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a)
	return m

static func _mmi(mesh: ArrayMesh, count: int) -> MultiMeshInstance2D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_2D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = count
	var node := MultiMeshInstance2D.new()
	node.multimesh = mm
	return node

# ---- ربطها بالخريطة ----

# تُستدعى مرة مع كل خريطة جديدة. المواضع ثابتة فلا تُحسب إلا هنا.
func build(game) -> void:
	_n = game.n
	var total: int = _n * _n
	fill = _mmi(_diamond(), total)
	dashes = _mmi(_dash(), 0)
	add_child(fill)
	add_child(dashes)

	dist_tiles = []
	for d in game.districts.size():
		dist_tiles.append(PackedInt32Array())

	var ang: float = atan2(GC.DASH_DY, GC.DASH_DX)
	var marks: Array = []
	for j in _n:
		for i in _n:
			var k: int = j * _n + i
			var c: Vector2 = game.tile_to_world(Vector2(float(i), float(j)))
			fill.multimesh.set_instance_transform_2d(k, Transform2D(0.0, c))
			var d: int = int(game.owner_dist[k])
			if d >= 0 and d < dist_tiles.size():
				dist_tiles[d].append(k)
			var dm: int = int(game.dash[k])
			if dm == 1:
				marks.append([c, ang])
			elif dm == 2:
				marks.append([c, -ang])
	dashes.multimesh.instance_count = marks.size()
	for m in marks.size():
		var mk: Array = marks[m]
		dashes.multimesh.set_instance_transform_2d(m, Transform2D(float(mk[1]), mk[0] as Vector2))
		dashes.multimesh.set_instance_color(m, GC.DASH_COL)
	refresh(game)

# كل الألوان: عند خريطة جديدة أو تغيّر الطقس
func refresh(game) -> void:
	if fill == null:
		return
	for k in _n * _n:
		fill.multimesh.set_instance_color(k, game.ground_color(k))

# لون حي واحد: عند الاستيلاء عليه، فلا نمر على الخريطة كلها
func refresh_district(game, d: int) -> void:
	if fill == null:
		return
	if d < 0 or d >= dist_tiles.size():
		refresh(game)
		return
	for k in dist_tiles[d]:
		fill.multimesh.set_instance_color(k, game.ground_color(k))
