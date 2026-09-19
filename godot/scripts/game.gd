extends Node2D
# نموذج "مدينة العصابات" على Godot 4.x — المراحل 1 و 3 و 4
# الخريطة والتحكم منقولان من docs/prototype.html، والتوليد في scripts/map_gen.gd.
# الأرقام كلها في scripts/config.gd (GC).

var n: int = 26
var size_key: String = "small"
var player_count: int = 4

var road: Array = []
var kind: Array = []
var region: Array = []
var owner_dist: Array = []
var districts: Array = []
var caps: Array = []       # {tile, gang, type, special, district}

var art := UnitsArt.new()
var combat: Combat
var me := 0                # رقم اللاعب البشري
var shake_t := 0.0
var shake_cool := 0.0
var cam_home := Vector2.ZERO
var astar := AStarGrid2D.new()
var cam: Camera2D
var mode_btn: Button
var size_btn: Button
var info: Label
var select_mode := false
var marker := {"pos": Vector2.ZERO, "t": 99.0}

var touches := {}
var drag_start := Vector2.ZERO
var drag_cam := Vector2.ZERO
var dragging := false
var moved := false
var pinch_dist := 0.0
var pinch_zoom := 1.0
var sel_box_a := Vector2.ZERO
var sel_box_b := Vector2.ZERO
var box_active := false
var press_t := 0.0         # لقياس الضغطة المطوّلة (4.3)
var long_fired := false

func _ready() -> void:
	combat = Combat.new(self)
	combat.on_hit = _on_hit
	cam = $Cam
	mode_btn = $UI/ModeBtn
	size_btn = $UI/SizeBtn
	info = $UI/Info
	cam.zoom = Vector2.ONE * GC.ZOOM_START
	mode_btn.pressed.connect(_toggle_mode)
	size_btn.pressed.connect(_cycle_size)
	$UI/SelAllBtn.pressed.connect(_select_all)
	$UI/NewMapBtn.pressed.connect(generate_map)
	$UI/DemoBtn.pressed.connect(func(): get_tree().change_scene_to_file("res://units_demo.tscn"))
	$UI/FightBtn.pressed.connect(_test_battle)
	generate_map()

func _process(delta: float) -> void:
	combat.step(delta)
	marker["t"] += delta
	if dragging and not moved and not long_fired:
		press_t += delta
		if press_t >= GC.LONG_PRESS:
			long_fired = true
			_command(_tile_at(drag_start), true)
	# ارتجاج الكاميرا عند الضربات المميزة فقط (5.2)
	shake_cool = maxf(0.0, shake_cool - delta)
	if shake_t > 0.0:
		shake_t = maxf(0.0, shake_t - delta)
		var k: float = shake_t / GC.SHAKE_DUR
		cam.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * GC.SHAKE_PIXELS * k
	elif cam.offset != Vector2.ZERO:
		cam.offset = Vector2.ZERO
	queue_redraw()

func _on_hit(_victim: Dictionary, _dealt: float, is_ult: bool) -> void:
	if is_ult and shake_cool <= 0.0:
		shake_t = GC.SHAKE_DUR
		shake_cool = GC.SHAKE_COOLDOWN

# ============ توليد الخريطة ============
func generate_map() -> void:
	var gen := MapGen.new()
	var m := gen.generate(size_key, player_count)
	n = int(m["n"])
	road = m["road"]
	kind = m["kind"]
	region = m["region"]
	owner_dist = m["owner_dist"]
	districts = m["districts"]

	caps = []
	for d in districts:
		var cap: Vector2i = d["cap"]
		if cap.x < 0:
			continue
		caps.append({
			"tile": cap, "gang": String(d["gang"]), "type": String(d["type"]),
			"special": String(d["special"]), "district": int(d["id"]),
		})
	for w in m["warnings"]:
		push_warning("[خريطة] %s" % w)

	_build_astar()
	_spawn_units()
	_refresh_info()

func walkable(i: int, j: int) -> bool:
	if i < 0 or j < 0 or i >= n or j >= n:
		return false
	var t := j * n + i
	return road[t] or kind[t] == "." or kind[t] == "P"

# يسأله محرك القتال عن مسار بين نقطتين بإحداثيات المربعات العشرية
func find_path(from: Vector2, to: Vector2) -> Array:
	var a := Vector2i(clampi(int(round(from.x)), 0, n - 1), clampi(int(round(from.y)), 0, n - 1))
	var b := Vector2i(clampi(int(round(to.x)), 0, n - 1), clampi(int(round(to.y)), 0, n - 1))
	if not walkable(a.x, a.y):
		return []
	if not walkable(b.x, b.y):
		var near := _free_near(b, 1)
		if near.is_empty():
			return []
		b = near[0]
	var ids := astar.get_id_path(a, b)
	var out := []
	for i in ids.size():
		if i == 0 and ids.size() > 1:
			continue   # نتجاهل المربع الذي نقف فيه حتى لا ترجع الوحدة للخلف
		out.append(Vector2(float(ids[i].x), float(ids[i].y)))
	return out

func _build_astar() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, n, n)
	astar.cell_size = Vector2.ONE
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.update()
	for j in n:
		for i in n:
			astar.set_point_solid(Vector2i(i, j), not walkable(i, j))

func _spawn_units() -> void:
	combat.clear()
	var p := 0
	for c in caps:
		if String(c["type"]) != "home":
			continue
		var gang := String(c["gang"])
		for spot in _free_near(c["tile"], GC.PROTO_UNITS_PER_HOME):
			combat.spawn(gang + "_common", p, p, Vector2(float(spot.x), float(spot.y)))
		if p == me:
			cam.position = tile_to_world(Vector2(float(c["tile"].x), float(c["tile"].y)))
			cam_home = cam.position
		p += 1

# معركة تجريبية: فريقان متقابلان قرب مركز الشاشة لتجربة القتال فوراً
func _test_battle() -> void:
	var center := world_to_tile(cam.position)
	var mid := Vector2i(clampi(int(round(center.x)), 2, n - 3), clampi(int(round(center.y)), 2, n - 3))
	var spots := _free_near(mid, 16)
	if spots.size() < 4:
		return
	var keys_a := ["crow_common", "crow_spear", "crow_dual", "crow_common"]
	var keys_b := ["viper_common", "hammer_shield", "viper_sniper", "hammer_common"]
	for i in spots.size():
		var t := Vector2(float(spots[i].x), float(spots[i].y))
		if i % 2 == 0:
			combat.spawn(keys_a[(i / 2) % keys_a.size()], me, me, t)
		else:
			combat.spawn(keys_b[(i / 2) % keys_b.size()], 1, 1, t)
	_refresh_info()

func _free_near(start: Vector2i, count: int) -> Array:
	var out := []
	var seen := {start: true}
	var q: Array[Vector2i] = [start]
	var head := 0
	while head < q.size() and out.size() < count:
		var cur: Vector2i = q[head]
		head += 1
		if walkable(cur.x, cur.y):
			out.append(cur)
		for dx in [-1, 0, 1]:
			for dy in [-1, 0, 1]:
				var nx: int = cur.x + dx
				var ny: int = cur.y + dy
				if nx < 0 or ny < 0 or nx >= n or ny >= n:
					continue
				if seen.has(Vector2i(nx, ny)):
					continue
				if absi(nx - start.x) > 8 or absi(ny - start.y) > 8:
					continue
				seen[Vector2i(nx, ny)] = true
				q.append(Vector2i(nx, ny))
	return out

# ============ التحويل بين المربعات والعالم ============
func tile_to_world(t: Vector2) -> Vector2:
	return Vector2((t.x - t.y) * GC.TW, (t.x + t.y) * GC.TH)

func world_to_tile(w: Vector2) -> Vector2:
	return Vector2((w.x / GC.TW + w.y / GC.TH) * 0.5, (w.y / GC.TH - w.x / GC.TW) * 0.5)

func screen_to_world(p: Vector2) -> Vector2:
	return get_canvas_transform().affine_inverse() * p

func world_to_screen(p: Vector2) -> Vector2:
	return get_canvas_transform() * p

# ============ الرسم ============
func _visible_rect() -> Rect2:
	var inv := get_canvas_transform().affine_inverse()
	var vp := get_viewport_rect().size
	var pts := [inv * Vector2.ZERO, inv * Vector2(vp.x, 0), inv * Vector2(0, vp.y), inv * vp]
	var r := Rect2(pts[0], Vector2.ZERO)
	for p in pts:
		r = r.expand(p)
	return r.grow(64.0)

func _draw() -> void:
	var view := _visible_rect()
	# الأرض
	for j in n:
		for i in n:
			var c := tile_to_world(Vector2(i, j))
			if not view.has_point(c):
				continue
			var key: String = region[j * n + i]
			var col: Color = GC.GROUND[key] if GC.GROUND.has(key) else GC.GROUND["neutral"]
			draw_colored_polygon(PackedVector2Array([
				c + Vector2(-GC.TW, 0), c + Vector2(0, -GC.TH),
				c + Vector2(GC.TW, 0), c + Vector2(0, GC.TH)]), col)

	# المباني والوحدات بترتيب العمق (painter's algorithm)
	var t := float(Time.get_ticks_msec()) / 1000.0
	for s in range(0, 2 * n - 1):
		for i in range(max(0, s - n + 1), min(n - 1, s) + 1):
			var j := s - i
			var c := tile_to_world(Vector2(i, j))
			if not view.has_point(c):
				continue
			_draw_object(kind[j * n + i], c, region[j * n + i], i, j, t)
		for u in combat.units:
			if int(round(u["pos"].x + u["pos"].y)) == s:
				_draw_unit(u)

	# المقذوفات (5.3)
	for pr in combat.projectiles:
		_draw_projectile(pr)

	# فوق كل شيء: دوائر التحديد وأشرطة الدم
	for u in combat.units:
		if u["state"] == "dead":
			continue
		var p := tile_to_world(u["pos"])
		if u["sel"]:
			draw_arc(p, 5.5, 0, TAU, 20, Color(0.95, 0.93, 0.89), 1.0, true)
		_draw_hp_bar(u, p)

	# علامة نقطة الهدف
	if marker["t"] < 0.8:
		var g: float = marker["t"] / 0.8
		var mcol: Color = Color(0.95, 0.5, 0.35, 1.0 - g) if marker.get("attack", false) else Color(0.95, 0.93, 0.89, 1.0 - g)
		draw_arc(tile_to_world(marker["pos"]), 6.0 + g * 14.0, 0, TAU, 24, mcol, 1.2, true)

func _draw_unit(u: Dictionary) -> void:
	var col: Color = GC.PLAYER_COLORS[int(u["player"]) % GC.PLAYER_COLORS.size()]
	if float(u["flash"]) > 0.0:
		# وميض أبيض خفيف عند الإصابة (5.2)
		col = col.lerp(Color(1, 1, 1), 0.55 * float(u["flash"]) / GC.HIT_FLASH)
	var sc: float = GC.UNIT_SCALE_SPECIAL if not String(u["key"]).ends_with("_common") else GC.UNIT_SCALE
	art.draw_unit(self, String(u["key"]), tile_to_world(u["pos"]),
		combat.draw_time(u), combat.draw_state(u), col, int(u["dir"]), sc, combat.draw_rate(u))

# شريط الدم: فوق المحدد أو ناقص الدم فقط، بلون مالك الوحدة (5.2)
func _draw_hp_bar(u: Dictionary, p: Vector2) -> void:
	var frac: float = clampf(float(u["hp"]) / maxf(1.0, float(u["max_hp"])), 0.0, 1.0)
	var always: bool = bool(GC.stat(u["key"], "hero"))
	if not u["sel"] and not always and frac >= 0.999:
		return
	var w := GC.HP_BAR_W
	var x := p.x - w * 0.5
	var y := p.y + GC.HP_BAR_Y
	draw_rect(Rect2(x - 0.5, y - 0.5, w + 1.0, GC.HP_BAR_H + 1.0), Color(0, 0, 0, 0.55))
	draw_rect(Rect2(x, y, w * frac, GC.HP_BAR_H),
		GC.PLAYER_COLORS[int(u["player"]) % GC.PLAYER_COLORS.size()])

func _draw_projectile(pr: Dictionary) -> void:
	var p := tile_to_world(pr["pos"])
	# قوس بسيط يرتفع في منتصف الطيران
	var k: float = clampf(float(pr["t"]) / float(pr["dur"]), 0.0, 1.0)
	p.y -= sin(k * PI) * 5.0
	match String(pr["kind"]):
		"arrow":
			var d: Vector2 = (tile_to_world(pr["pos"]) - tile_to_world(pr["from"])).normalized()
			if d == Vector2.ZERO:
				d = Vector2.RIGHT
			draw_line(p - d * 3.0, p + d * 3.0, Color("d9d3c6"), 1.0)
		"bottle":
			var ang: float = float(pr["spin"]) + k * 12.0
			draw_circle(p, 2.0, Color("5a8a6a"))
			draw_circle(p + Vector2(cos(ang), sin(ang)) * 2.2, 1.3, Color("e8893a"))
		_:
			draw_circle(p, 1.8, Color("9a948c"))

func _draw_object(k: String, c: Vector2, reg: String, i: int, j: int, t: float) -> void:
	match k:
		"H":
			_box(c + Vector2(0, 1), 14, 7, 14, Color("b59a78"), Color("cdb391"), Color("00000000"))
			_roof(c + Vector2(0, 1), 14, 7, 14, 12, _gang_dark(reg), _gang_light(reg))
		"A":
			var h: float = 32.0 + float((i + j) % 2) * 8.0
			_box(c, 15, 7.5, h, Color("8f8c85"), Color("aaa69e"), Color("77736c"))
		"R":
			_box(c, 13, 6.5, 9, Color("8a8074"), Color("a39888"), Color("5e574d"))
		"W":
			_box(c, 17, 8.5, 12, Color("7f7a70"), Color("99938a"), Color("6c675f"))
		"T":
			draw_rect(Rect2(c.x - 1, c.y - 8, 2, 8), Color("5b4636"))
			draw_circle(c + Vector2(0, -13), 7, Color("4f7a3c"))
			draw_circle(c + Vector2(-3, -15), 5, Color("5f8f48"))
		"Q":
			_box(c, 16, 8, 26, _gang_dark(reg), _gang_light(reg), Color("3a3632"))
			draw_line(c + Vector2(0, -26), c + Vector2(0, -46), Color("2b2825"), 1.2)
			_tri(c + Vector2(0, -46), c + Vector2(12, -42), c + Vector2(0, -38), _flag_color(reg))
		"P":
			draw_colored_polygon(PackedVector2Array([
				c + Vector2(-12, 0), c + Vector2(0, -6), c + Vector2(12, 0), c + Vector2(0, 6)]), Color("b3aa98"))
			draw_line(c, c + Vector2(0, -22), Color("2b2825"), 1.2)
			_tri(c + Vector2(0, -22), c + Vector2(10, -19), c + Vector2(0, -16), _flag_color(reg))
		"M":
			_hospital(c)
		"K":
			_armory(c)
		"C":
			_clock_tower(c, t)
		"F":
			_fountain(c)
		"S":
			_police_station(c, t)

# ---- مباني الأحياء المميزة ومركز الشرطة ----
func _hospital(c: Vector2) -> void:
	_box(c, 17, 8.5, 24, Color("a9a59b"), Color("c2bdb1"), Color("8e8a81"))
	# صليب باهت على الواجهة
	var cross := Color("b8543f")
	draw_rect(Rect2(c.x + 5.0, c.y - 19.0, 6.0, 2.2), cross)
	draw_rect(Rect2(c.x + 6.9, c.y - 21.0, 2.2, 6.0), cross)
	# نوافذ مكسورة
	for k in 3:
		draw_rect(Rect2(c.x - 13.0 + float(k) * 4.5, c.y - 17.0 + float(k) * 2.2, 3.0, 4.0), Color("50524f"))

func _armory(c: Vector2) -> void:
	_box(c, 17, 8.5, 13, Color("7f7a70"), Color("99938a"), Color("6c675f"))
	# صناديق ذخيرة أمام المستودع
	_box(c + Vector2(-7, 6), 4, 2, 5, Color("6d5a3c"), Color("856e4a"), Color("57482f"))
	_box(c + Vector2(2, 7), 4.5, 2.2, 4, Color("6d5a3c"), Color("856e4a"), Color("57482f"))
	_box(c + Vector2(-2, 3), 3.5, 1.8, 7, Color("5f5137"), Color("796445"), Color("4a3f2a"))

func _clock_tower(c: Vector2, t: float) -> void:
	_box(c, 9, 4.5, 44, Color("9c9488"), Color("b5ac9e"), Color("00000000"))
	# وجه الساعة
	var face := c + Vector2(0, -38)
	draw_circle(face, 6.0, Color("e4dcc9"))
	draw_arc(face, 6.0, 0, TAU, 20, Color("4a443c"), 1.0, true)
	var mins := fmod(t * 0.6, 1.0) * TAU
	draw_line(face, face + Vector2(sin(mins), -cos(mins)) * 4.6, Color("32302b"), 1.0)
	draw_line(face, face + Vector2(sin(mins * 0.08), -cos(mins * 0.08)) * 3.0, Color("32302b"), 1.3)
	# سقف هرمي
	_tri(c + Vector2(-9, -44), c + Vector2(0, -56), c + Vector2(9, -44), Color("6b5a44"))

func _fountain(c: Vector2) -> void:
	_ellipse(c, 11.0, 5.5, Color("8f8a80"))
	_ellipse(c, 8.5, 4.2, Color("4d6f82"))
	draw_rect(Rect2(c.x - 1.0, c.y - 9.0, 2.0, 9.0), Color("9c9488"))
	_ellipse(c + Vector2(0, -10), 3.0, 1.5, Color("b7b0a4"))

func _police_station(c: Vector2, t: float) -> void:
	_box(c, 16, 8, 22, Color("6f7a86"), Color("8794a1"), Color("5b646e"))
	# شريط أزرق على الواجهة
	draw_rect(Rect2(c.x - 14.0, c.y - 12.0, 13.0, 2.4), GC.POLICE_COLOR)
	# مصباح أزرق وامض فوق السطح
	var blink: float = 0.45 + 0.55 * absf(sin(t * 3.0))
	draw_circle(c + Vector2(0, -25), 2.6, Color(0.35, 0.6, 1.0, blink))
	draw_circle(c + Vector2(0, -25), 4.6, Color(0.35, 0.6, 1.0, blink * 0.28))

func _gang_dark(reg: String) -> Color:
	if GC.GANG_COLORS.has(reg):
		return UnitsArt.dk(GC.GANG_COLORS[reg], 0.45)
	return Color("7d4f3c")

func _gang_light(reg: String) -> Color:
	if GC.GANG_COLORS.has(reg):
		return UnitsArt.dk(GC.GANG_COLORS[reg], 0.2)
	return Color("9c6349")

func _flag_color(reg: String) -> Color:
	if GC.GANG_COLORS.has(reg):
		return UnitsArt.lt(GC.GANG_COLORS[reg], 0.35)
	return Color("e8e2d6")

func _tri(a: Vector2, b: Vector2, c: Vector2, col: Color) -> void:
	draw_colored_polygon(PackedVector2Array([a, b, c]), col)

func _ellipse(center: Vector2, rx: float, ry: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 20:
		var ang := TAU * float(i) / 20.0
		pts.push_back(center + Vector2(cos(ang) * rx, sin(ang) * ry))
	draw_colored_polygon(pts, col)

func _box(c: Vector2, w: float, d: float, h: float, left: Color, right: Color, top: Color) -> void:
	draw_colored_polygon(PackedVector2Array([
		c + Vector2(-w, 0), c + Vector2(0, d), c + Vector2(0, d - h), c + Vector2(-w, -h)]), left)
	draw_colored_polygon(PackedVector2Array([
		c + Vector2(0, d), c + Vector2(w, 0), c + Vector2(w, -h), c + Vector2(0, d - h)]), right)
	if top.a > 0.0:
		draw_colored_polygon(PackedVector2Array([
			c + Vector2(-w, -h), c + Vector2(0, -d - h), c + Vector2(w, -h), c + Vector2(0, d - h)]), top)

func _roof(c: Vector2, w: float, d: float, h: float, rh: float, left: Color, right: Color) -> void:
	var apex := c + Vector2(0, -h - rh)
	draw_colored_polygon(PackedVector2Array([c + Vector2(-w, -h), apex, c + Vector2(w, -h)]), UnitsArt.dk(left, 0.3))
	draw_colored_polygon(PackedVector2Array([c + Vector2(-w, -h), c + Vector2(0, d - h), apex]), left)
	draw_colored_polygon(PackedVector2Array([c + Vector2(0, d - h), c + Vector2(w, -h), apex]), right)

# ============ اللمس ============
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			touches[event.index] = event.position
			if touches.size() == 1:
				drag_start = event.position
				drag_cam = cam.position
				dragging = true
				moved = false
				box_active = false
				press_t = 0.0
				long_fired = false
			elif touches.size() == 2:
				var v: Array = touches.values()
				pinch_dist = maxf(1.0, (Vector2(v[0]) - Vector2(v[1])).length())
				pinch_zoom = cam.zoom.x
				dragging = false
				box_active = false
		else:
			var was: Vector2 = touches.get(event.index, event.position)
			touches.erase(event.index)
			if touches.size() == 0:
				if dragging and not moved and not long_fired:
					_tap(was)
				elif box_active:
					_apply_box()
				dragging = false
				box_active = false
	elif event is InputEventScreenDrag:
		touches[event.index] = event.position
		if touches.size() >= 2:
			var v: Array = touches.values()
			var d: float = maxf(1.0, (Vector2(v[0]) - Vector2(v[1])).length())
			cam.zoom = Vector2.ONE * clampf(pinch_zoom * d / pinch_dist, GC.ZOOM_MIN, GC.ZOOM_MAX)
			return
		if not dragging:
			return
		if (event.position - drag_start).length() > GC.TAP_SLOP:
			moved = true
		if not moved:
			return
		if select_mode:
			box_active = true
			sel_box_a = drag_start
			sel_box_b = event.position
		else:
			cam.position = drag_cam - (event.position - drag_start) / cam.zoom.x

func _tile_at(screen_pos: Vector2) -> Vector2i:
	var t := world_to_tile(screen_to_world(screen_pos))
	return Vector2i(int(round(t.x)), int(round(t.y)))

func _unit_at(screen_pos: Vector2, mine: bool):
	var best = null
	var bd := GC.TAP_RADIUS
	for u in combat.units:
		if u["state"] == "dead":
			continue
		if mine and int(u["player"]) != me:
			continue
		if not mine and int(u["player"]) == me:
			continue
		var d: float = (world_to_screen(tile_to_world(u["pos"]) + Vector2(0, -5)) - screen_pos).length()
		if d < bd:
			bd = d
			best = u
	return best

func _selected() -> Array:
	var sel := []
	for u in combat.units:
		if u["sel"] and u["state"] != "dead":
			sel.append(u)
	return sel

func _tap(screen_pos: Vector2) -> void:
	# لمسة على وحدة من وحداتي = تحديدها
	var mine = _unit_at(screen_pos, true)
	if mine != null:
		for v in combat.units:
			v["sel"] = false
		mine["sel"] = true
		_refresh_info()
		return
	# لمسة على عدو ومعي وحدات محددة = أمر هجوم (بلا حد مطاردة، 5.2)
	var sel := _selected()
	var foe = _unit_at(screen_pos, false)
	if foe != null and not sel.is_empty():
		combat.order_attack(sel, foe)
		marker["pos"] = Vector2(foe["pos"])
		marker["t"] = 0.0
		marker["attack"] = true
		return
	_command(_tile_at(screen_pos), false)

func _command(target: Vector2i, attack_move: bool) -> void:
	var sel := _selected()
	if sel.is_empty():
		return
	var goal := Vector2i(clampi(target.x, 0, n - 1), clampi(target.y, 0, n - 1))
	var spots := _free_near(goal, sel.size() * 2)
	var k := 0
	for u in sel:
		var dest := goal
		if k < spots.size():
			dest = spots[k]
		k += 1
		combat.order_move([u], Vector2(float(dest.x), float(dest.y)), attack_move)
	marker["pos"] = Vector2(float(goal.x), float(goal.y))
	marker["t"] = 0.0
	marker["attack"] = attack_move

func _apply_box() -> void:
	var r := Rect2(sel_box_a, sel_box_b - sel_box_a).abs()
	for u in combat.units:
		if int(u["player"]) != me or u["state"] == "dead":
			continue
		u["sel"] = r.has_point(world_to_screen(tile_to_world(u["pos"])))
	box_active = false
	_refresh_info()
	if select_mode:
		_toggle_mode()   # رجوع تلقائي لوضع تحريك الخريطة

func _toggle_mode() -> void:
	select_mode = not select_mode
	mode_btn.text = "تحديد الجنود" if select_mode else "تحريك الخريطة"

func _cycle_size() -> void:
	var idx: int = GC.SIZE_ORDER.find(size_key)
	size_key = GC.SIZE_ORDER[(idx + 1) % GC.SIZE_ORDER.size()]
	var info_d: Dictionary = GC.MAP_SIZES[size_key]
	player_count = mini(player_count, int(info_d["max_players"]))
	generate_map()

func _select_all() -> void:
	for u in combat.units:
		u["sel"] = int(u["player"]) == me and u["state"] != "dead"
	_refresh_info()

func _refresh_info() -> void:
	var sel := 0
	var mine := 0
	var foes := 0
	for u in combat.units:
		if u["state"] == "dead":
			continue
		if u["sel"]:
			sel += 1
		if int(u["player"]) == me:
			mine += 1
		else:
			foes += 1
	var specials := 0
	var police := 0
	var homes := 0
	var capturable := 0
	for d in districts:
		match String(d["type"]):
			"special": specials += 1
			"police": police += 1
			"home": homes += 1
		if Vector2i(d["cap"]).x >= 0:
			capturable += 1
	var label: String = String(GC.MAP_SIZES[size_key]["label"])
	size_btn.text = "الحجم: %s" % label
	info.text = "%s %d×%d | أحياء %d | مميزة %d | شرطة %d | جنودي %d | أعداء %d | محدد %d" % [
		label, n, n, capturable, specials, police, mine, foes, sel]
