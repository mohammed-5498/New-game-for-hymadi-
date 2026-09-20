class_name Weather
extends Node2D
# الطقس وتأثيراته — القسم 10 من docs/GAME_SPEC.md
# الشكل منقول من docs/prototype.html: طبقة فوق المشهد، وإضاءة ليلية دافئة،
# وندف ثلج أو خطوط مطر. الأرقام كلها في config.gd.
#
# الرسم كله بإحداثيات الشاشة (كما في النموذج) حتى لا تتحرك الندف مع الكاميرا،
# ما عدا هالات الضوء الليلية فهي مثبتة على مبانيها في العالم.
#
# ترتيب الرسم: الخريطة والوحدات (game.gd) ← الطبقة الداكنة ← الأضواء (جمعية) ← الندف.

var kind := "day"          # day / night / snow / rain
var lights: Array = []     # {pos: إحداثي عالم, r, c: Color, a: float}

var _parts: Array = []     # {x, y, vy, vx, r} للثلج أو {x, y, vy, vx, l} للمطر
var _glow: Node2D          # عقدة الأضواء، مزجها جمعي (additive)
var _halo: GradientTexture2D   # تدرج دائري أبيض، يُلوَّن لكل مصدر ضوء
var _flakes: Node2D        # عقدة الندف، فوق كل شيء
var _size := Vector2(1152, 648)

func _ready() -> void:
	_halo = _make_halo()
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_glow = Node2D.new()
	_glow.material = mat
	_glow.draw.connect(_draw_lights)
	add_child(_glow)
	_flakes = Node2D.new()
	_flakes.draw.connect(_draw_parts)
	add_child(_flakes)
	set_kind(kind)

# هالة ضوء ناعمة: تدرج دائري من الأبيض الكامل إلى الشفاف
func _make_halo() -> GradientTexture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.42), Color(1, 1, 1, 0)])
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 64
	tex.height = 64
	return tex

# يُستدعى مرة عند بدء المباراة. "عشوائي" يُحسم في game.gd قبل الوصول إلى هنا.
func set_kind(w: String) -> void:
	kind = w if GC.WEATHER_NAMES.has(w) and w != "random" else "day"
	_reset_parts()
	queue_redraw()

func _reset_parts() -> void:
	_parts = []
	_size = _screen_size()
	var count: int = GC.SNOW_COUNT if kind == "snow" else (GC.RAIN_COUNT if kind == "rain" else 0)
	for i in count:
		if kind == "snow":
			_parts.append({
				"x": randf() * _size.x, "y": randf() * _size.y,
				"vy": randf_range(GC.SNOW_VY[0], GC.SNOW_VY[1]),
				"vx": randf_range(GC.SNOW_VX[0], GC.SNOW_VX[1]),
				"r": randf_range(GC.SNOW_R[0], GC.SNOW_R[1]),
			})
		else:
			_parts.append({
				"x": randf() * (_size.x + 40.0), "y": randf() * _size.y,
				"vy": randf_range(GC.RAIN_VY[0], GC.RAIN_VY[1]), "vx": GC.RAIN_VX,
				"l": randf_range(GC.RAIN_LEN[0], GC.RAIN_LEN[1]),
			})

# حجم الشاشة، مع قيمة احتياطية قبل دخول العقدة شجرة المشهد
func _screen_size() -> Vector2:
	if not is_inside_tree():
		return _size
	var vp := get_viewport_rect().size
	return vp if vp.x > 1.0 and vp.y > 1.0 else _size

func _process(delta: float) -> void:
	if kind == "day":
		return          # نهار: لا طبقة ولا أضواء ولا ندف
	_size = _screen_size()   # دوران الجوال: نبقي الندف داخل الشاشة الجديدة
	if not _parts.is_empty():
		step(delta)
	# الطبقة والأضواء مرسومة بإحداثيات الشاشة، فتتغير مع كل حركة كاميرا
	queue_redraw()
	_glow.queue_redraw()
	_flakes.queue_redraw()

# خطوة الندف (منفصلة عن _process حتى تُفحص بلا مشهد)
func step(delta: float) -> void:
	var sway: bool = kind == "snow"
	for p in _parts:
		p["y"] = float(p["y"]) + float(p["vy"]) * delta
		var dx: float = float(p["vx"]) * delta
		if sway:
			dx += sin(float(p["y"]) * 0.03) * GC.SNOW_SWAY * delta
		p["x"] = float(p["x"]) + dx
		if float(p["y"]) > _size.y + 10.0:
			p["y"] = -10.0
			p["x"] = randf() * (_size.x + 40.0)
		if float(p["x"]) < -20.0:
			p["x"] = _size.x + 10.0
		elif float(p["x"]) > _size.x + 20.0:
			p["x"] = -10.0

# ---------- تحويل إحداثيات الشاشة إلى مصفوفة رسم ----------
func _screen_matrix() -> Transform2D:
	return get_canvas_transform().affine_inverse()

func _draw() -> void:
	var col: Color = GC.WEATHER_OVERLAY.get(kind, Color(0, 0, 0, 0))
	if col.a <= 0.0:
		return
	draw_set_transform_matrix(_screen_matrix())
	draw_rect(Rect2(Vector2.ZERO, get_viewport_rect().size), col)

# هالة دافئة حول كل مصدر ضوء: حلقات متناقصة الشفافية، بمزج جمعي (10)
func _draw_lights() -> void:
	if kind != "night" or lights.is_empty():
		return
	var view: Rect2 = _world_view()
	for L in lights:
		var p: Vector2 = L["pos"]
		var r: float = float(L["r"])
		if not view.grow(r).has_point(p):
			continue
		var base: Color = L["c"]
		_glow.draw_texture_rect(_halo, Rect2(p - Vector2(r, r), Vector2(r, r) * 2.0), false,
			Color(base.r, base.g, base.b, float(L["a"])))

func _world_view() -> Rect2:
	var inv := get_canvas_transform().affine_inverse()
	var vp := get_viewport_rect().size
	var r := Rect2(inv * Vector2.ZERO, Vector2.ZERO)
	for q in [inv * Vector2(vp.x, 0), inv * Vector2(0, vp.y), inv * vp]:
		r = r.expand(q)
	return r

func _draw_parts() -> void:
	if _parts.is_empty():
		return
	_flakes.draw_set_transform_matrix(_screen_matrix())
	if kind == "snow":
		for p in _parts:
			_flakes.draw_circle(Vector2(p["x"], p["y"]), float(p["r"]), GC.SNOW_PART_COLOR)
	else:
		for p in _parts:
			var a := Vector2(p["x"], p["y"])
			_flakes.draw_line(a, a + Vector2(GC.RAIN_SLANT, float(p["l"])),
				GC.RAIN_PART_COLOR, GC.RAIN_PART_W)

# ---------- أدوات يستعملها game.gd في رسم الخريطة ----------
# خلط لون بالأبيض الثلجي (أو إعتامه في المطر)
static func snow(col: Color, amount: float, w: String) -> Color:
	return col.lerp(GC.SNOW_TINT, amount) if w == "snow" else col

static func ground(col: Color, is_road: bool, w: String) -> Color:
	match w:
		"snow":
			return col.lerp(GC.SNOW_TINT, GC.SNOW_ROAD if is_road else GC.SNOW_GROUND)
		"rain":
			return col.lerp(GC.RAIN_GROUND_TINT, GC.RAIN_GROUND)
	return col
