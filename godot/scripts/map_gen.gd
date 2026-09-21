class_name MapGen
extends RefCounted
# توليد الخريطة — الأقسام 3.2 إلى 3.8 من docs/GAME_SPEC.md
# الاستعمال: MapGen.new().generate("small", 4, seed)

const DIR4 := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const DIR8 := [
	Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
	Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1),
]

var n: int = 26
var rng := RandomNumberGenerator.new()
var road: Array = []        # bool لكل مربع
var kind: Array = []        # رمز المبنى لكل مربع
var region: Array = []      # مفتاح لون الأرض لكل مربع
var owner_dist: Array = []  # رقم الحي لكل مربع (-1 للشارع)
var decor: Array = []       # زينة الشارع لكل مربع: "" أو "B" برميل نار أو "L" عمود إنارة
var dash: Array = []        # علامة منتصف الشارع: 0 بلا، 1 أفقية، 2 رأسية
var districts: Array = []   # كل حي: {id, tiles, cx, cy, size, flavor, type, gang, special, cap, center}
var warnings: Array = []

# ============================ نقطة الدخول ============================
func generate(size_key: String, player_count: int, seed_value: int = 0, gangs: Array = []) -> Dictionary:
	var info: Dictionary = GC.MAP_SIZES.get(size_key, GC.MAP_SIZES["small"])
	n = int(info["n"])
	var players: int = clampi(player_count, 2, int(info["max_players"]))
	rng.seed = seed_value if seed_value != 0 else randi()
	warnings = []

	for attempt in GC.GEN_MAX_TRIES:
		_reset()
		_gen_roads()
		if _roads_connected():
			break
		if attempt == GC.GEN_MAX_TRIES - 1:
			warnings.append("تعذّر توليد شوارع متصلة بعد %d محاولة" % GC.GEN_MAX_TRIES)

	_build_districts()
	_assign_homes(players, gangs)
	_assign_specials(int(info["special"]))
	_assign_police(int(info["police"]))
	_fill_buildings()
	_place_caps()
	_place_landmarks()
	_fix_isolated()
	_place_decor()

	return {
		"n": n, "size_key": size_key, "players": players,
		"road": road, "kind": kind, "region": region, "decor": decor, "dash": dash,
		"owner_dist": owner_dist, "districts": districts,
		"warnings": warnings,
	}

func _reset() -> void:
	road = []
	kind = []
	region = []
	owner_dist = []
	districts = []
	decor = []
	dash = []
	for i in n * n:
		road.append(false)
		kind.append(".")
		region.append("neutral")
		owner_dist.append(-1)
		decor.append("")
		dash.append(0)

# ============================ أدوات الشبكة ============================
func id(i: int, j: int) -> int:
	return j * n + i

func inb(i: int, j: int) -> bool:
	return i >= 0 and j >= 0 and i < n and j < n

func walkable(i: int, j: int) -> bool:
	if not inb(i, j):
		return false
	var t := id(i, j)
	return road[t] or kind[t] == "." or kind[t] == "P"

func _set_road(i: int, j: int) -> void:
	if inb(i, j):
		road[id(i, j)] = true

# ============================ 3.3 توليد الشوارع ============================
func _gen_roads() -> void:
	var cols := _lines()
	var rows := _lines()
	for c in cols:
		var cc: int = c
		for j in n:
			if not _near(rows, j) and rng.randf() < GC.ROAD_JITTER:
				_set_road(cc, j)
				cc = clampi(cc + (1 if rng.randf() < 0.5 else -1), 1, n - 2)
			_set_road(cc, j)
	for r in rows:
		var rr: int = r
		for i in n:
			if not _near(cols, i) and rng.randf() < GC.ROAD_JITTER:
				_set_road(i, rr)
				rr = clampi(rr + (1 if rng.randf() < 0.5 else -1), 1, n - 2)
			_set_road(i, rr)
	# أزقة قصيرة تخرج من شوارع عشوائية
	var alleys := int(round(float(n * n) / GC.ALLEY_PER_TILES))
	for k in alleys:
		var i2 := rng.randi_range(0, n - 1)
		var j2 := rng.randi_range(0, n - 1)
		if not road[id(i2, j2)]:
			continue
		var d: Vector2i = DIR4[rng.randi_range(0, 3)]
		for s in range(1, GC.ALLEY_LEN + 1):
			_set_road(i2 + d.x * s, j2 + d.y * s)

func _lines() -> Array:
	var a := []
	var p := 1 + rng.randi_range(0, 1)
	while p < n - 1:
		a.append(p)
		p += rng.randi_range(GC.ROAD_GAP_MIN, GC.ROAD_GAP_MAX)
	return a

func _near(arr: Array, v: int) -> bool:
	for x in arr:
		if absi(int(x) - v) <= 1:
			return true
	return false

# 3.3 بند 4: كل مربعات الشوارع يجب أن تكون متصلة
func _roads_connected() -> bool:
	var start := -1
	var total := 0
	for t in n * n:
		if road[t]:
			total += 1
			if start < 0:
				start = t
	if start < 0:
		return false
	var seen := {start: true}
	var q: Array[int] = [start]
	var head := 0
	while head < q.size():
		var cur: int = q[head]
		head += 1
		var ci: int = cur % n
		var cj: int = cur / n
		for d in DIR4:
			var nx: int = ci + d.x
			var ny: int = cj + d.y
			if inb(nx, ny) and road[id(nx, ny)] and not seen.has(id(nx, ny)):
				seen[id(nx, ny)] = true
				q.append(id(nx, ny))
	return seen.size() == total

# ============================ 3.4 الأحياء ============================
func _build_districts() -> void:
	for j in n:
		for i in n:
			if road[id(i, j)] or owner_dist[id(i, j)] >= 0:
				continue
			var idx := districts.size()
			var tiles: Array[Vector2i] = []
			var stack: Array[Vector2i] = [Vector2i(i, j)]
			owner_dist[id(i, j)] = idx
			while stack.size() > 0:
				var cur: Vector2i = stack.pop_back()
				tiles.append(cur)
				for d in DIR4:
					var nx: int = cur.x + d.x
					var ny: int = cur.y + d.y
					if inb(nx, ny) and not road[id(nx, ny)] and owner_dist[id(nx, ny)] < 0:
						owner_dist[id(nx, ny)] = idx
						stack.append(Vector2i(nx, ny))
			var cx := 0.0
			var cy := 0.0
			for t in tiles:
				cx += float(t.x)
				cy += float(t.y)
			districts.append({
				"id": idx, "tiles": tiles, "size": tiles.size(),
				"cx": cx / float(tiles.size()), "cy": cy / float(tiles.size()),
				"flavor": "neutral", "type": "plain", "gang": "",
				"special": "", "cap": Vector2i(-1, -1), "center": Vector2i(-1, -1),
			})

# ============================ 3.5 الأحياء المنزلية ============================
func _assign_homes(players: int, gangs: Array = []) -> void:
	var mid := float(n - 1) * 0.5
	var radius := float(n) * GC.HOME_RING
	for p in players:
		var ang := TAU * float(p) / float(players) - PI * 0.25
		var target := Vector2(mid + cos(ang) * radius, mid + sin(ang) * radius)
		var best := -1
		var bd := 1e9
		for d in districts:
			if d["type"] != "plain" or int(d["size"]) < GC.HOME_MIN_TILES:
				continue
			var dist: float = Vector2(float(d["cx"]), float(d["cy"])).distance_to(target)
			if dist < bd:
				bd = dist
				best = int(d["id"])
		if best < 0:
			warnings.append("لا يوجد حي كبير كافٍ للاعب %d" % (p + 1))
			continue
		# عصابة اللاعب من قائمة الإعداد إن وُجدت، وإلا بالتناوب
		var gang: String = String(gangs[p]) if p < gangs.size() else GC.GANGS[p % GC.GANGS.size()]
		districts[best]["type"] = "home"
		districts[best]["gang"] = gang
		districts[best]["flavor"] = gang

# ============================ 3.7 الأحياء المميزة ============================
func _assign_specials(count: int) -> void:
	if count <= 0:
		return
	var mid := Vector2(float(n - 1) * 0.5, float(n - 1) * 0.5)
	var pool := []
	for d in districts:
		if d["type"] != "plain" or int(d["size"]) < GC.DISTRICT_MIN_TILES:
			continue
		var dist: float = Vector2(float(d["cx"]), float(d["cy"])).distance_to(mid)
		pool.append({"id": int(d["id"]), "dist": dist})
	if pool.is_empty():
		warnings.append("لا توجد أحياء صالحة للأحياء المميزة")
		return
	# المرشحون في وسط الخريطة أولاً، وإن لم يكفوا نوسّع الدائرة
	pool.sort_custom(func(a, b): return float(a["dist"]) < float(b["dist"]))
	var ring := float(n) * GC.SPECIAL_CENTER_RING
	var candidates := []
	for c in pool:
		if float(c["dist"]) <= ring:
			candidates.append(int(c["id"]))
	while candidates.size() < count and candidates.size() < pool.size():
		candidates.append(int(pool[candidates.size()]["id"]))
	candidates.shuffle()

	# الأنواع: لا يتكرر النوع إلا إذا زاد العدد على 3
	var bag: Array = GC.SPECIAL_KINDS.duplicate()
	bag.shuffle()
	for k in min(count, candidates.size()):
		if bag.is_empty():
			bag = GC.SPECIAL_KINDS.duplicate()
			bag.shuffle()
		var did: int = candidates[k]
		districts[did]["type"] = "special"
		districts[did]["special"] = bag.pop_back()

# ============================ 3.8 مراكز الشرطة (أماكن فقط) ============================
func _assign_police(count: int) -> void:
	if count <= 0:
		return
	var homes := []
	for d in districts:
		if d["type"] == "home":
			homes.append(Vector2(float(d["cx"]), float(d["cy"])))
	var pool := []
	for d in districts:
		if d["type"] != "plain" or int(d["size"]) < GC.DISTRICT_MIN_TILES:
			continue
		var c := Vector2(float(d["cx"]), float(d["cy"]))
		var near_home := 1e9
		for h in homes:
			near_home = min(near_home, c.distance_to(h))
		if near_home < GC.POLICE_MIN_DIST_HOME:
			continue
		pool.append({"id": int(d["id"]), "c": c})
	if pool.is_empty():
		warnings.append("لا توجد أحياء بعيدة بما يكفي لمراكز الشرطة")
		return
	# توزيع متباعد: كل مرة نختار الأبعد عمّا اختير سابقاً
	var picked := []
	pool.shuffle()
	picked.append(pool.pop_back())
	while picked.size() < count and pool.size() > 0:
		var best := -1
		var best_d := -1.0
		for k in pool.size():
			var min_d := 1e9
			for p in picked:
				min_d = min(min_d, Vector2(pool[k]["c"]).distance_to(Vector2(p["c"])))
			if min_d > best_d:
				best_d = min_d
				best = k
		picked.append(pool[best])
		pool.remove_at(best)
	for p in picked:
		var did: int = int(p["id"])
		districts[did]["type"] = "police"

# ============================ 3.6 طابع الأحياء ============================
func _fill_buildings() -> void:
	for j in n:
		for i in n:
			if road[id(i, j)]:
				region[id(i, j)] = "road"
	for d in districts:
		var reg := "neutral"
		match String(d["type"]):
			"home": reg = String(d["gang"])
			"special": reg = "special"
			"police": reg = "police"
		var flavor: String = String(d["flavor"])
		var tiny: bool = int(d["size"]) < GC.DISTRICT_MIN_TILES
		for t in d["tiles"]:
			region[id(t.x, t.y)] = reg
			# الحي الصغير جداً: أشجار أو أرض فارغة فقط (3.4)
			kind[id(t.x, t.y)] = (("T" if rng.randf() < 0.5 else ".") if tiny else _pick_kind(flavor))

# زينة الشوارع: براميل نار وأعمدة إنارة (7). لا تمنع المرور، وهي مصادر ضوء ليلاً (10).
# ومعها علامات منتصف الشارع: أفقية للشارع الممتد يميناً ويساراً ورأسية لغيره،
# تماماً كما في prototype.html.
func _place_decor() -> void:
	for j in n:
		for i in n:
			var t := id(i, j)
			if not road[t]:
				continue
			var horiz: bool = (inb(i - 1, j) and road[id(i - 1, j)]) or (inb(i + 1, j) and road[id(i + 1, j)])
			var vert: bool = (inb(i, j - 1) and road[id(i, j - 1)]) or (inb(i, j + 1) and road[id(i, j + 1)])
			dash[t] = 1 if (horiz and not vert) else (2 if (vert and not horiz) else 0)
			var q := rng.randf()
			if q < GC.DECOR_BARREL_P:
				decor[t] = "B"
			elif q < GC.DECOR_LAMP_P and dash[t] != 0:
				decor[t] = "L"   # الأعمدة على الشوارع الممتدة فقط، كما في النموذج

func _pick_kind(flavor: String) -> String:
	var table: Array = GC.BUILDING_MIX.get(flavor, GC.BUILDING_MIX["neutral"])
	var roll := rng.randf()
	for entry in table:
		if roll < float(entry[1]):
			return String(entry[0])
	return "."

# ============================ 3.4 ساحات الأعلام ============================
func _place_caps() -> void:
	for d in districts:
		if int(d["size"]) < GC.DISTRICT_MIN_TILES:
			continue
		var cp := Vector2i(-1, -1)
		var cd := 1e9
		for t in d["tiles"]:
			var touching := false
			for dd in DIR4:
				if inb(t.x + dd.x, t.y + dd.y) and road[id(t.x + dd.x, t.y + dd.y)]:
					touching = true
					break
			if not touching:
				continue
			var dist: float = Vector2(float(t.x) - float(d["cx"]), float(t.y) - float(d["cy"])).length()
			if dist < cd:
				cd = dist
				cp = t
		if cp.x < 0:
			continue
		d["cap"] = cp
		kind[id(cp.x, cp.y)] = "P"

# ============ المعالم: المقر والمستشفى ومخزن السلاح وبرج الساعة ومركز الشرطة ============
func _place_landmarks() -> void:
	for d in districts:
		var mark := ""
		match String(d["type"]):
			"home": mark = "Q"
			"police": mark = "S"
			"special":
				match String(d["special"]):
					"hospital": mark = "M"
					"armory": mark = "K"
					"clock": mark = "C"
		if mark == "":
			continue
		var spot := _center_tile(d)
		if spot.x < 0:
			continue
		kind[id(spot.x, spot.y)] = mark
		d["center"] = spot
		# برج الساعة يرافقه نافورة (3.7)
		if mark == "C":
			for dd in DIR4:
				var nx: int = spot.x + dd.x
				var ny: int = spot.y + dd.y
				if inb(nx, ny) and owner_dist[id(nx, ny)] == int(d["id"]) and kind[id(nx, ny)] != "P":
					kind[id(nx, ny)] = "F"
					break

# أقرب مربع لمركز الحي وليس ساحة العلم
func _center_tile(d: Dictionary) -> Vector2i:
	var best := Vector2i(-1, -1)
	var bd := 1e9
	var cap: Vector2i = d["cap"]
	for t in d["tiles"]:
		if t == cap:
			continue
		var dist: float = Vector2(float(t.x) - float(d["cx"]), float(t.y) - float(d["cy"])).length()
		if dist < bd:
			bd = dist
			best = t
	return best

# ============================ 3.4.1 إصلاح الفراغات المعزولة ============================
func _fix_isolated() -> void:
	for pass_i in GC.FIX_ISOLATED_PASSES:
		var seen := _flood_from_roads()
		var stuck := _isolated_tiles(seen)
		if stuck.is_empty():
			break
		for t in stuck:
			if not _open_barrier(t, seen):
				kind[id(t.x, t.y)] = "R"   # فراغ ميت لا أمل فيه: يصير أطلالاً

	# 3.4.1 بند 5: ساحة علم كل حي يجب أن تصل لشبكة الشوارع
	var seen2 := _flood_from_roads()
	for d in districts:
		var cap: Vector2i = d["cap"]
		if cap.x < 0 or seen2.has(id(cap.x, cap.y)):
			continue
		_carve_to_network(cap, seen2)
		seen2 = _flood_from_roads()

	# فحص أخير: لا يبقى أي مربع معزول
	var seen3 := _flood_from_roads()
	var left := _isolated_tiles(seen3)
	for t in left:
		kind[id(t.x, t.y)] = "R"
	if left.size() > 0:
		warnings.append("بقي %d مربع معزول بعد الإصلاح وحُوِّل إلى مبانٍ" % left.size())

# flood fill بثمانية اتجاهات من شبكة الشوارع، بقاعدة منع قطع الزوايا
func _flood_from_roads() -> Dictionary:
	var seen := {}
	var q: Array[Vector2i] = []
	for j in n:
		for i in n:
			if road[id(i, j)]:
				seen[id(i, j)] = true
				q.append(Vector2i(i, j))
	var head := 0
	while head < q.size():
		var cur: Vector2i = q[head]
		head += 1
		for d in DIR8:
			var nx: int = cur.x + d.x
			var ny: int = cur.y + d.y
			if not walkable(nx, ny) or seen.has(id(nx, ny)):
				continue
			if d.x != 0 and d.y != 0:
				if not walkable(cur.x + d.x, cur.y) or not walkable(cur.x, cur.y + d.y):
					continue
			seen[id(nx, ny)] = true
			q.append(Vector2i(nx, ny))
	return seen

func _isolated_tiles(seen: Dictionary) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for j in n:
		for i in n:
			if walkable(i, j) and not seen.has(id(i, j)):
				out.append(Vector2i(i, j))
	return out

# يحاول فتح حاجز بين المربع المعزول وأقرب مربع موصول. يرجع true إن نجح.
func _open_barrier(t: Vector2i, seen: Dictionary) -> bool:
	# الحالة الأولى: جار قطري موصول لكن الزاوية مقطوعة — نفتح أحد الجانبين
	for d in [Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]:
		var nx: int = t.x + d.x
		var ny: int = t.y + d.y
		if not inb(nx, ny) or not seen.has(id(nx, ny)):
			continue
		for side in [Vector2i(d.x, 0), Vector2i(0, d.y)]:
			var sx: int = t.x + side.x
			var sy: int = t.y + side.y
			if inb(sx, sy) and not walkable(sx, sy) and kind[id(sx, sy)] != "Q":
				kind[id(sx, sy)] = "."
				return true
	# الحالة الثانية: مبنى واحد يفصلنا عن مربع موصول
	for d in DIR4:
		var mx: int = t.x + d.x
		var my: int = t.y + d.y
		var fx: int = t.x + d.x * 2
		var fy: int = t.y + d.y * 2
		if not inb(fx, fy) or not seen.has(id(fx, fy)):
			continue
		if inb(mx, my) and not walkable(mx, my) and kind[id(mx, my)] != "Q":
			kind[id(mx, my)] = "."
			return true
	return false

# يشق ممراً من نقطة إلى أقرب مربع موصول بشبكة الشوارع
func _carve_to_network(from: Vector2i, seen: Dictionary) -> void:
	var prev := {}
	var q: Array[Vector2i] = [from]
	var visited := {id(from.x, from.y): true}
	var head := 0
	var goal := Vector2i(-1, -1)
	while head < q.size():
		var cur: Vector2i = q[head]
		head += 1
		if seen.has(id(cur.x, cur.y)) and cur != from:
			goal = cur
			break
		for d in DIR4:
			var nx: int = cur.x + d.x
			var ny: int = cur.y + d.y
			if not inb(nx, ny) or visited.has(id(nx, ny)):
				continue
			if kind[id(nx, ny)] == "Q":
				continue
			visited[id(nx, ny)] = true
			prev[id(nx, ny)] = cur
			q.append(Vector2i(nx, ny))
	if goal.x < 0:
		warnings.append("تعذّر وصل ساحة العلم عند (%d, %d) بالشوارع" % [from.x, from.y])
		return
	var walk := goal
	while prev.has(id(walk.x, walk.y)):
		if kind[id(walk.x, walk.y)] != "P":
			kind[id(walk.x, walk.y)] = "."
		walk = prev[id(walk.x, walk.y)]
