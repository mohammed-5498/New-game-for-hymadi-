extends Node2D
# نموذج "مدينة العصابات" على Godot 4.x
# منقول من docs/prototype.html: توليد الخريطة، الرسم المائل، اللمس، التحديد، والحركة حول المباني.

const N := 26
const TW := 18.0   # نصف عرض المربع
const TH := 9.0    # نصف ارتفاع المربع

var road: Array = []
var kind: Array = []      # نوع ما في المربع: "." فارغ، H بيت، A عمارة، R أطلال، W مستودع، T شجرة، P ساحة علم، Q مقر
var region: Array = []    # crow / hammer / viper / scorp / neutral / road
var caps: Array = []      # ساحات الأعلام
var units: Array = []     # {pos:Vector2(tile floats), gang:String, own:bool, sel:bool, path:Array}

var astar := AStarGrid2D.new()
var cam: Camera2D
var mode_btn: Button
var info: Label
var select_mode := false
var marker := {"pos": Vector2.ZERO, "t": 99.0}

var touches := {}          # index -> position
var drag_start := Vector2.ZERO
var drag_cam := Vector2.ZERO
var dragging := false
var moved := false
var pinch_dist := 0.0
var pinch_zoom := 1.0
var sel_box_a := Vector2.ZERO
var sel_box_b := Vector2.ZERO
var box_active := false

const GANG_COLORS := {
	"crow": Color("8a5cc7"), "hammer": Color("d9463b"),
	"viper": Color("3fa34d"), "scorp": Color("e0b030")
}
const GROUND := {
	"crow": Color("7a7090"), "hammer": Color("8d6a60"), "viper": Color("6d7d5a"),
	"scorp": Color("a08a66"), "neutral": Color("948d7f"), "road": Color("5a554e")
}

func _ready() -> void:
	cam = $Cam
	mode_btn = $UI/ModeBtn
	info = $UI/Info
	mode_btn.pressed.connect(_toggle_mode)
	$UI/SelAllBtn.pressed.connect(_select_all)
	$UI/NewMapBtn.pressed.connect(generate_map)
	generate_map()

func _process(delta: float) -> void:
	for u in units:
		if u["path"].size() > 0:
			var target: Vector2 = u["path"][0]
			var sp: float = (2.6 if u["gang"] == "crow" else 2.2) * delta
			var d: Vector2 = target - u["pos"]
			if d.length() <= sp:
				u["pos"] = target
				u["path"].remove_at(0)
			else:
				u["pos"] += d.normalized() * sp
	marker["t"] += delta
	queue_redraw()

# ============ توليد الخريطة ============
func generate_map() -> void:
	road = []
	kind = []
	region = []
	caps = []
	for i in N * N:
		road.append(false)
		kind.append(".")
		region.append("neutral")

	var cols := _lines()
	var rows := _lines()
	for c in cols:
		var cc: int = c
		for j in N:
			if not _near(rows, j) and randf() < 0.1:
				_set_road(cc, j)
				cc = clampi(cc + (1 if randf() < 0.5 else -1), 1, N - 2)
			_set_road(cc, j)
	for rr in rows:
		var r2: int = rr
		for i in N:
			if not _near(cols, i) and randf() < 0.1:
				_set_road(i, r2)
				r2 = clampi(r2 + (1 if randf() < 0.5 else -1), 1, N - 2)
			_set_road(i, r2)
	# أزقة قصيرة
	for k in 40:
		var i2 := randi() % N
		var j2 := randi() % N
		if not road[_id(i2, j2)]:
			continue
		var d := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)][randi() % 4]
		for s in range(1, 3):
			_set_road(i2 + d.x * s, j2 + d.y * s)

	_build_blocks()
	_fix_isolated()      # إصلاح الفراغات المعزولة (القسم 3.4.1 في الوصف)
	_build_astar()
	_spawn_units()

func _lines() -> Array:
	var a := []
	var p := 1 + randi() % 2
	while p < N - 1:
		a.append(p)
		p += 4 + randi() % 3
	return a

func _near(arr: Array, v: int) -> bool:
	for x in arr:
		if abs(int(x) - v) <= 1:
			return true
	return false

func _id(i: int, j: int) -> int:
	return j * N + i

func _inb(i: int, j: int) -> bool:
	return i >= 0 and j >= 0 and i < N and j < N

func _set_road(i: int, j: int) -> void:
	if _inb(i, j):
		road[_id(i, j)] = true
		region[_id(i, j)] = "road"

func _build_blocks() -> void:
	var owner_of := []
	for i in N * N:
		owner_of.append(-1)
	var blocks := []
	for j in N:
		for i in N:
			if road[_id(i, j)] or owner_of[_id(i, j)] >= 0:
				continue
			var tiles := []
			var stack := [Vector2i(i, j)]
			owner_of[_id(i, j)] = blocks.size()
			while stack.size() > 0:
				var cur: Vector2i = stack.pop_back()
				tiles.append(cur)
				for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
					var nx: int = cur.x + d.x
					var ny: int = cur.y + d.y
					if _inb(nx, ny) and not road[_id(nx, ny)] and owner_of[_id(nx, ny)] < 0:
						owner_of[_id(nx, ny)] = blocks.size()
						stack.append(Vector2i(nx, ny))
			var cx := 0.0
			var cy := 0.0
			for tpos in tiles:
				cx += float(tpos.x)
				cy += float(tpos.y)
			blocks.append({"tiles": tiles, "cx": cx / tiles.size(), "cy": cy / tiles.size(), "reg": "neutral"})

	# أحياء العصابات في الزوايا
	var corners := [["crow", 0, 0], ["hammer", N - 1, 0], ["viper", 0, N - 1], ["scorp", N - 1, N - 1]]
	for corner in corners:
		var best := -1
		var bd := 1e9
		for bi in blocks.size():
			var b = blocks[bi]
			if b["reg"] != "neutral" or b["tiles"].size() < 6:
				continue
			var dist: float = Vector2(b["cx"] - float(corner[1]), b["cy"] - float(corner[2])).length()
			if dist < bd:
				bd = dist
				best = bi
		if best >= 0:
			blocks[best]["reg"] = corner[0]

	for b in blocks:
		for tpos in b["tiles"]:
			region[_id(tpos.x, tpos.y)] = b["reg"]
			kind[_id(tpos.x, tpos.y)] = _pick_kind(b["reg"])
		if b["tiles"].size() < 4:
			continue
		# ساحة العلم: أقرب مربع لشارع من مركز الحي
		var cp := Vector2i(-1, -1)
		var cd := 1e9
		for tpos in b["tiles"]:
			var touching := false
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				if _inb(tpos.x + d.x, tpos.y + d.y) and road[_id(tpos.x + d.x, tpos.y + d.y)]:
					touching = true
			if not touching:
				continue
			var dd: float = Vector2(float(tpos.x) - b["cx"], float(tpos.y) - b["cy"]).length()
			if dd < cd:
				cd = dd
				cp = tpos
		if cp.x < 0:
			continue
		kind[_id(cp.x, cp.y)] = "P"
		caps.append({"tile": cp, "reg": b["reg"]})
		# المقر داخل الحي المنزلي
		if b["reg"] != "neutral":
			for tpos in b["tiles"]:
				if tpos != cp:
					kind[_id(tpos.x, tpos.y)] = "Q"
					break

func _pick_kind(reg: String) -> String:
	var roll := randf()
	match reg:
		"crow":
			return "A" if roll < 0.45 else ("H" if roll < 0.7 else ("R" if roll < 0.85 else "."))
		"hammer":
			return "W" if roll < 0.45 else ("R" if roll < 0.65 else ("H" if roll < 0.82 else "."))
		"viper":
			return "T" if roll < 0.45 else ("H" if roll < 0.75 else ("R" if roll < 0.85 else "."))
		"scorp":
			return "H" if roll < 0.55 else ("R" if roll < 0.7 else ("T" if roll < 0.82 else "."))
		_:
			return "H" if roll < 0.32 else ("A" if roll < 0.46 else ("R" if roll < 0.66 else ("W" if roll < 0.76 else ("T" if roll < 0.88 else "."))))

func walkable(i: int, j: int) -> bool:
	if not _inb(i, j):
		return false
	return road[_id(i, j)] or kind[_id(i, j)] == "." or kind[_id(i, j)] == "P"

# إصلاح الفراغات المحاصرة: أي مربع فارغ لا يصل للشوارع يصير مبنى
func _fix_isolated() -> void:
	var seen := {}
	var q := []
	for j in N:
		for i in N:
			if road[_id(i, j)]:
				seen[_id(i, j)] = true
				q.append(Vector2i(i, j))
	while q.size() > 0:
		var cur: Vector2i = q.pop_front()
		for dx in [-1, 0, 1]:
			for dy in [-1, 0, 1]:
				if dx == 0 and dy == 0:
					continue
				var nx: int = cur.x + dx
				var ny: int = cur.y + dy
				if not walkable(nx, ny) or seen.has(_id(nx, ny)):
					continue
				if dx != 0 and dy != 0:
					if not walkable(cur.x + dx, cur.y) or not walkable(cur.x, cur.y + dy):
						continue
				seen[_id(nx, ny)] = true
				q.append(Vector2i(nx, ny))
	for j in N:
		for i in N:
			if walkable(i, j) and not seen.has(_id(i, j)):
				kind[_id(i, j)] = "R"   # يصير أطلالاً بدل فراغ ميت

func _build_astar() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, N, N)
	astar.cell_size = Vector2(1, 1)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.update()
	for j in N:
		for i in N:
			astar.set_point_solid(Vector2i(i, j), not walkable(i, j))

func _spawn_units() -> void:
	units = []
	for c in caps:
		if c["reg"] == "neutral":
			continue
		var spots := _free_near(c["tile"], 3)
		for s in spots:
			units.append({
				"pos": Vector2(float(s.x), float(s.y)),
				"gang": c["reg"], "own": c["reg"] == "crow",
				"sel": false, "path": []
			})
		if c["reg"] == "crow":
			cam.position = tile_to_world(Vector2(float(c["tile"].x), float(c["tile"].y)))

func _free_near(start: Vector2i, n: int) -> Array:
	var out := []
	var seen := {start: true}
	var q := [start]
	while q.size() > 0 and out.size() < n:
		var cur: Vector2i = q.pop_front()
		if walkable(cur.x, cur.y):
			out.append(cur)
		for dx in [-1, 0, 1]:
			for dy in [-1, 0, 1]:
				var nx: int = cur.x + dx
				var ny: int = cur.y + dy
				if _inb(nx, ny) and not seen.has(Vector2i(nx, ny)) and abs(nx - start.x) <= 8 and abs(ny - start.y) <= 8:
					seen[Vector2i(nx, ny)] = true
					q.append(Vector2i(nx, ny))
	return out

# ============ التحويل بين المربعات والعالم ============
func tile_to_world(t: Vector2) -> Vector2:
	return Vector2((t.x - t.y) * TW, (t.x + t.y) * TH)

func world_to_tile(w: Vector2) -> Vector2:
	return Vector2((w.x / TW + w.y / TH) * 0.5, (w.y / TH - w.x / TW) * 0.5)

func screen_to_world(p: Vector2) -> Vector2:
	return get_canvas_transform().affine_inverse() * p

func world_to_screen(p: Vector2) -> Vector2:
	return get_canvas_transform() * p

# ============ الرسم ============
func _draw() -> void:
	# الأرض
	for j in N:
		for i in N:
			var c := tile_to_world(Vector2(i, j))
			var col: Color = GROUND[region[_id(i, j)]] if GROUND.has(region[_id(i, j)]) else GROUND["neutral"]
			draw_colored_polygon(PackedVector2Array([
				c + Vector2(-TW, 0), c + Vector2(0, -TH), c + Vector2(TW, 0), c + Vector2(0, TH)]), col)

	# المباني والوحدات بترتيب العمق
	var t := float(Time.get_ticks_msec()) / 1000.0
	for s in range(0, 2 * N - 1):
		for i in range(max(0, s - N + 1), min(N - 1, s) + 1):
			var j := s - i
			var c := tile_to_world(Vector2(i, j))
			_draw_object(kind[_id(i, j)], c, region[_id(i, j)], i, j)
		for u in units:
			if int(round(u["pos"].x + u["pos"].y)) == s:
				var state: String = "walk" if u["path"].size() > 0 else "idle"
				var col: Color = GANG_COLORS[u["gang"]]
				UnitsArt.draw_unit(self, u["gang"] + "_common", tile_to_world(u["pos"]), t, state, col, 1, 1.0)

	# دوائر التحديد فوق كل شيء
	for u in units:
		if u["sel"]:
			var p := tile_to_world(u["pos"])
			draw_arc(p, 5.5, 0, TAU, 20, Color(0.95, 0.93, 0.89), 1.0, true)

	# علامة نقطة الهدف
	if marker["t"] < 0.8:
		var g: float = marker["t"] / 0.8
		draw_arc(tile_to_world(marker["pos"]), 6.0 + g * 14.0, 0, TAU, 24, Color(0.95, 0.93, 0.89, 1.0 - g), 1.2, true)

func _draw_object(k: String, c: Vector2, reg: String, i: int, j: int) -> void:
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
			UnitsArt.tri(self, c + Vector2(0, -46), c + Vector2(12, -42), c + Vector2(0, -38), _flag_color(reg))
		"P":
			draw_colored_polygon(PackedVector2Array([
				c + Vector2(-12, 0), c + Vector2(0, -6), c + Vector2(12, 0), c + Vector2(0, 6)]), Color("b3aa98"))
			draw_line(c, c + Vector2(0, -22), Color("2b2825"), 1.2)
			UnitsArt.tri(self, c + Vector2(0, -22), c + Vector2(10, -19), c + Vector2(0, -16), _flag_color(reg))

func _gang_dark(reg: String) -> Color:
	if GANG_COLORS.has(reg):
		return UnitsArt.dk(GANG_COLORS[reg], 0.45)
	return Color("7d4f3c")

func _gang_light(reg: String) -> Color:
	if GANG_COLORS.has(reg):
		return UnitsArt.dk(GANG_COLORS[reg], 0.2)
	return Color("9c6349")

func _flag_color(reg: String) -> Color:
	if GANG_COLORS.has(reg):
		return UnitsArt.lt(GANG_COLORS[reg], 0.35)
	return Color("e8e2d6")

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
			elif touches.size() == 2:
				var v: Array = touches.values()
				pinch_dist = max(1.0, (v[0] - v[1]).length())
				pinch_zoom = cam.zoom.x
				dragging = false
				box_active = false
		else:
			var was := touches.get(event.index, event.position)
			touches.erase(event.index)
			if touches.size() == 0:
				if dragging and not moved:
					_tap(was)
				elif box_active:
					_apply_box()
				dragging = false
				box_active = false
	elif event is InputEventScreenDrag:
		touches[event.index] = event.position
		if touches.size() >= 2:
			var v: Array = touches.values()
			var d: float = max(1.0, (v[0] - v[1]).length())
			cam.zoom = Vector2.ONE * clampf(pinch_zoom * d / pinch_dist, 0.8, 5.0)
			return
		if not dragging:
			return
		if (event.position - drag_start).length() > 8.0:
			moved = true
		if not moved:
			return
		if select_mode:
			box_active = true
			sel_box_a = drag_start
			sel_box_b = event.position
		else:
			cam.position = drag_cam - (event.position - drag_start) / cam.zoom.x

func _tap(screen_pos: Vector2) -> void:
	# لمسة على وحدة من وحداتي؟
	for u in units:
		if not u["own"]:
			continue
		var sp := world_to_screen(tile_to_world(u["pos"]) + Vector2(0, -5))
		if (sp - screen_pos).length() < 26.0:
			for v in units:
				v["sel"] = false
			u["sel"] = true
			_refresh_info()
			return
	# وإلا فهو أمر حركة
	var t := world_to_tile(screen_to_world(screen_pos))
	_command(Vector2i(int(round(t.x)), int(round(t.y))))

func _command(target: Vector2i) -> void:
	var sel := []
	for u in units:
		if u["sel"]:
			sel.append(u)
	if sel.size() == 0:
		return
	var spots := _free_near(Vector2i(clampi(target.x, 0, N - 1), clampi(target.y, 0, N - 1)), sel.size() * 2)
	var k := 0
	for u in sel:
		while k < spots.size():
			var dest: Vector2i = spots[k]
			k += 1
			var from := Vector2i(int(round(u["pos"].x)), int(round(u["pos"].y)))
			if not walkable(from.x, from.y) or not walkable(dest.x, dest.y):
				continue
			var path := astar.get_id_path(from, dest)
			if path.size() > 0:
				var arr := []
				for p in path:
					arr.append(Vector2(float(p.x), float(p.y)))
				u["path"] = arr
				break
	marker["pos"] = Vector2(float(target.x), float(target.y))
	marker["t"] = 0.0

func _apply_box() -> void:
	var r := Rect2(sel_box_a, sel_box_b - sel_box_a).abs()
	for u in units:
		if not u["own"]:
			continue
		u["sel"] = r.has_point(world_to_screen(tile_to_world(u["pos"])))
	box_active = false
	_refresh_info()
	if select_mode:
		_toggle_mode()   # رجوع تلقائي لوضع تحريك الخريطة

func _toggle_mode() -> void:
	select_mode = not select_mode
	mode_btn.text = "تحديد الجنود" if select_mode else "تحريك الخريطة"

func _select_all() -> void:
	for u in units:
		u["sel"] = u["own"]
	_refresh_info()

func _refresh_info() -> void:
	var n := 0
	for u in units:
		if u["sel"]:
			n += 1
	info.text = "محدد: %d" % n
