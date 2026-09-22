class_name Combat
extends RefCounted
# محرك القتال الأساسي — الأقسام 5.1 و 5.2 و 5.3 من docs/GAME_SPEC.md
# لا يرسم شيئاً؛ الرسم كله في game.gd. الأرقام كلها في config.gd.
#
# حالات الوحدة (5.1):
#   idle       انتظار، ترصد الأعداء
#   moving     أمر حركة عادي — لا ترد على من يضربها
#   attackMove تتقدم وترصد مثل idle، ومتى خلا الطريق تواصل التقدم
#   attacking  تهاجم هدفاً
#   dead       تسقط وتختفي خلال ثانية

var units: Array = []          # كل الوحدات الحية والساقطة
var projectiles: Array = []    # {pos, from, target, t, dur, dmg, player, kind}
var next_id := 1
var _by_id := {}
var map = null                 # مرجع game.gd لسؤاله عن المشي والمسارات
var fires: Array = []          # بقع نار: {pos, radius, dur, dps, player, t}
var player_dmg_mult := {}      # مخزن السلاح: +10% ضرر لكل وحدات المالك (3.7)
var player_heal := {}          # المستشفى: علاج مستمر لكل وحدات المالك (3.7)
var heal_zones: Array = []     # منطقة استيلاء المستشفى: {pos, player, dps}
var player_armor_bonus := {}   # مراكز الشرطة: درع إضافي للمالك (3.8)
var teams := {}                # رقم اللاعب -> فريقه (التحالفات، 11)
var weather := "day"           # طقس المباراة، يضبطه game.gd مرة واحدة (10)
# شبكة مكانية بخلايا 2 × 2 مربع (14): البحث عن الأعداء كان يمر على كل الوحدات
# لكل وحدة، فيصير O(n²). الآن يمر على الخلايا المجاورة وحدها.
var _grid := {}
var _grid_t := 0.0

# استدعاءات للخارج: (وحدة مصابة، ضرر، هل من ضربة مميزة)
var on_hit := Callable()
var on_death := Callable()   # (الوحدة الميتة، قاتلها أو null)

func _init(map_node) -> void:
	map = map_node

# ============================ إنشاء الوحدات ============================
func spawn(key: String, player: int, team: int, tile: Vector2) -> Dictionary:
	var hp: float = GC.stat(key, "hp")
	var u := {
		"id": next_id, "key": key, "player": player, "team": team,
		"seed": randi(),                  # بذرة الشخصية الثابتة (5.4.1)
		"pos": tile, "hp": hp, "max_hp": hp,
		"state": "idle", "path": [] as Array,
		"target": -1, "cmd_target": -1,   # cmd_target = أمر هجوم من اللاعب (بلا حد مطاردة)
		"swing": 0.0, "hit_done": false,
		"scan_t": randf() * GC.SCAN_EVERY, "repath_t": 0.0,
		"chase_from": tile, "dir": 1,
		"flash": 0.0, "hurt_t": 99.0, "dead_t": 0.0,
		"anim_t": randf() * 3.0, "sel": false,
		"last_attacker": -1,
		# القدرات والضربات المميزة (6.2 – 6.7)
		"charge": 0.0, "dmg_acc": 0.0, "ulting": false, "ult_swing": 0.0, "ult_done": false,
		"combo": 0, "combo_target": -1, "combo_t": 99.0,
		"buff_dmg": 0.0, "buff_rate": 0.0, "buff_t": 0.0,
		"invuln_t": 0.0, "slow": 0.0, "slow_t": 0.0,
		"aura_dmg": 0.0, "volley": 0, "volley_t": 0.0, "volley_tgt": -1,
		# الشرطة (3.8): مرساة حد المطاردة، والمركز التابع له، وحالة الرجوع
		"anchor": Vector2.INF, "station": -1, "returning": false,
		# القتال الواقعي (5.4): الحركة الحالية ودورتها، والترنّح
		# move_lock فارغ في اللعب، وتضبطه الفحوص لتثبيت حركة بعينها
		"move": "quick", "cycle": 0.0, "stagger_t": 0.0, "move_lock": "",
		# ردود الأفعال الدفاعية (5.4.3)
		"face": Vector2(1, 0),      # اتجاه نظر الوحدة، تُحسب منه قاعدة الزاوية
		"stamina": GC.STAMINA_MAX, "dodge_t": 0.0, "dodge_cool": 0.0, "block_t": 0.0,
		"react_t": -1.0, "react_from": -1, "react_kind": "",
	}
	u.merge(_traits(u["seed"]))
	next_id += 1
	units.append(u)
	_by_id[u["id"]] = u
	_grid_add(u)     # حتى تجدها عمليات البحث قبل أول خطوة زمنية
	return u

# صفات الفرد تُشتق من بذرته وحدها: نفس البذرة تعطي نفس الشخصية دائماً (5.4.1)
static func _traits(unit_seed: int) -> Dictionary:
	var rg := RandomNumberGenerator.new()
	rg.seed = unit_seed
	return {
		"bold": rg.randf_range(GC.TRAIT_BOLD[0], GC.TRAIT_BOLD[1]),
		"dodge_skill": rg.randf_range(GC.TRAIT_DODGE[0], GC.TRAIT_DODGE[1]),
		"react": rg.randf_range(GC.TRAIT_REACT[0], GC.TRAIT_REACT[1]),
		"spd_var": 1.0 + rg.randf_range(-GC.TRAIT_SPEED_VAR, GC.TRAIT_SPEED_VAR),
		"size": 1.0 + rg.randf_range(-GC.TRAIT_SIZE_VAR, GC.TRAIT_SIZE_VAR),
	}

func team_of_player(p: int) -> int:
	return int(teams.get(p, p))

# ============================ الطقس (10) ============================
# ليل: مدى الرصد × 0.75 — ثلج: السرعة × 0.85 — مطر: الهجمات البعيدة تصيب 80%
func detect_of(u: Dictionary) -> float:
	return float(GC.stat(u["key"], "detect")) * float(GC.WEATHER_DETECT.get(weather, 1.0))

func speed_of(u: Dictionary) -> float:
	# تنويع ±7% من بذرة الشخصية حتى لا يمشي الجيش كأنه نسخة واحدة (5.4.1)
	return float(GC.stat(u["key"], "speed")) * float(GC.WEATHER_SPEED.get(weather, 1.0)) \
		* float(u.get("spd_var", 1.0))

func ranged_hit_chance() -> float:
	return float(GC.WEATHER_RANGED_HIT.get(weather, 1.0))

func get_unit(id: int) -> Variant:
	return _by_id.get(id, null)

func alive(u) -> bool:
	return u != null and u["state"] != "dead"

func clear() -> void:
	_grid.clear()
	units.clear()
	projectiles.clear()
	_by_id.clear()
	next_id = 1

# ============================ الخطوة الزمنية ============================
func step(delta: float) -> void:
	# الشبكة والتباعد عشر مرات في الثانية: بناء الشبكة في كل إطار يكلّف أكثر مما يوفّر،
	# والبحث عن الأهداف أصلاً كل ربع ثانية (14)
	_grid_t -= delta
	if _grid_t <= 0.0:
		_rebuild_grid()
		_separate(GC.GRID_REBUILD + absf(_grid_t))
		_grid_t = GC.GRID_REBUILD
	for u in units:
		u["anim_t"] += delta
		u["flash"] = maxf(0.0, u["flash"] - delta)
		u["hurt_t"] += delta
		if u["state"] == "dead":
			u["dead_t"] += delta
			continue
		_step_timers(u, delta)
		_step_unit(u, delta)
	_step_auras(delta)
	_step_projectiles(delta)
	_step_fires(delta)
	_reap()

# مؤقتات القدرات: الشحن، التعزيزات، التصلّب، الإبطاء، وتسارع الاشتباك
func _step_timers(u: Dictionary, delta: float) -> void:
	var key := String(u["key"])
	u["invuln_t"] = maxf(0.0, float(u["invuln_t"]) - delta)
	u["stagger_t"] = maxf(0.0, float(u["stagger_t"]) - delta)
	u["dodge_t"] = maxf(0.0, float(u["dodge_t"]) - delta)
	u["block_t"] = maxf(0.0, float(u["block_t"]) - delta)
	u["dodge_cool"] = maxf(0.0, float(u["dodge_cool"]) - delta)
	u["stamina"] = minf(GC.STAMINA_MAX, float(u["stamina"]) + GC.STAMINA_REGEN * delta)
	# رأت ضربة قادمة وتتصرف بعد زمن رد فعلها (5.4.3)
	if float(u["react_t"]) >= 0.0:
		u["react_t"] = float(u["react_t"]) - delta
		if float(u["react_t"]) <= 0.0:
			u["react_t"] = -1.0
			_do_react(u)
	u["slow_t"] = maxf(0.0, float(u["slow_t"]) - delta)
	if float(u["slow_t"]) <= 0.0:
		u["slow"] = 0.0
	u["buff_t"] = maxf(0.0, float(u["buff_t"]) - delta)
	if float(u["buff_t"]) <= 0.0:
		u["buff_dmg"] = 0.0
		u["buff_rate"] = 0.0
	# تسارع الاشتباك يرجع للأصل بعد توقف الضرب (6.2 و 6.6)
	u["combo_t"] = float(u["combo_t"]) + delta
	var reset: float = float(GC.stat(key, "combo_reset"))
	if reset > 0.0 and float(u["combo_t"]) > reset:
		u["combo"] = 0
		u["combo_target"] = -1
	# العلاج المستمر: المستشفى عالمياً، ومنطقته، والطبيب، وهالة بطل العقارب
	var heal: float = float(player_heal.get(int(u["player"]), 0.0))
	for z in heal_zones:
		if int(z["player"]) == int(u["player"]) and Vector2(u["pos"]).distance_to(Vector2(z["pos"])) <= GC.CAPTURE_RADIUS:
			heal += float(z["dps"])
	if heal > 0.0:
		u["hp"] = minf(float(u["max_hp"]), float(u["hp"]) + heal * delta)
	if has_ult(key):
		var per_sec: float = GC.HERO_CHARGE_PER_SEC if bool(GC.stat(key, "hero")) else GC.CHARGE_PER_SEC
		u["charge"] = minf(GC.CHARGE_FULL, float(u["charge"]) + per_sec * delta)

# ============================ الشبكة المكانية (14) ============================
func _rebuild_grid() -> void:
	_grid.clear()
	for u in units:
		if u["state"] == "dead":
			continue
		_grid_add(u)

func _grid_add(u: Dictionary) -> void:
	var key := _cell_of(Vector2(u["pos"]))
	if _grid.has(key):
		_grid[key].append(u)
	else:
		_grid[key] = [u]

func _cell_of(p: Vector2) -> Vector2i:
	return Vector2i(int(floor(p.x / GC.GRID_CELL)), int(floor(p.y / GC.GRID_CELL)))

# كل الوحدات داخل نصف قطر، من الخلايا التي يمسّها فقط
func _near_units(center: Vector2, radius: float) -> Array:
	var out := []
	# دائرة خلايا زائدة: الشبكة قد تكون متأخرة جزءاً من الثانية فتكون الوحدة انتقلت
	var r := int(ceil(radius / GC.GRID_CELL)) + 1
	var mid := _cell_of(center)
	for cx in range(mid.x - r, mid.x + r + 1):
		for cy in range(mid.y - r, mid.y + r + 1):
			var cell = _grid.get(Vector2i(cx, cy), null)
			if cell != null:
				out.append_array(cell)
	return out

# قوة تباعد خفيفة بين المتلاصقين، ولا تدفع أحداً داخل مبنى (4.3)
func _separate(delta: float) -> void:
	for u in units:
		if u["state"] == "dead":
			continue
		var push := Vector2.ZERO
		var mid := _cell_of(Vector2(u["pos"]))
		for cx in range(mid.x - 1, mid.x + 2):
			for cy in range(mid.y - 1, mid.y + 2):
				var cell = _grid.get(Vector2i(cx, cy), null)
				if cell == null:
					continue
				for o in cell:
					if int(o["id"]) == int(u["id"]) or o["state"] == "dead":
						continue
					var away: Vector2 = Vector2(u["pos"]) - Vector2(o["pos"])
					var d: float = away.length()
					if d < 0.001:
						away = Vector2(randf() - 0.5, randf() - 0.5)
						d = 0.5
					if d < GC.SEPARATE_DIST:
						push += away / d * (GC.SEPARATE_DIST - d) / GC.SEPARATE_DIST
		if push == Vector2.ZERO:
			continue
		var to: Vector2 = Vector2(u["pos"]) + push.limit_length(1.0) * GC.SEPARATE_PUSH * delta
		if _walkable_at(to):
			u["pos"] = to

func _reap() -> void:
	var keep := []
	for u in units:
		if u["state"] == "dead" and u["dead_t"] >= GC.UNIT_DEATH_DUR:
			_by_id.erase(u["id"])
			continue
		keep.append(u)
	units = keep

func _step_unit(u: Dictionary, delta: float) -> void:
	u["scan_t"] -= delta
	u["repath_t"] -= delta

	var tgt = get_unit(int(u["cmd_target"]))
	if tgt != null and not alive(tgt):
		u["cmd_target"] = -1
		tgt = null
	if tgt == null:
		tgt = get_unit(int(u["target"]))
		if tgt != null and not alive(tgt):
			u["target"] = -1
			tgt = null

	# البحث عن هدف: في idle و attackMove فقط. في moving لا ترد الوحدة على من يضربها (5.1)
	if tgt == null and u["state"] != "moving" and u["scan_t"] <= 0.0:
		u["scan_t"] = GC.SCAN_EVERY
		var found = _nearest_enemy(u, detect_of(u))
		if found != null:
			u["target"] = int(found["id"])
			u["chase_from"] = _fresh_origin(u)
			u["returning"] = false
			tgt = found

	# أثناء رجوع الشرطة إلى مركزها لا تهاجم إلا من يعترضها مباشرة (3.8).
	# هذه قاعدة خاصة بالشرطة وحدها: وحدات اللاعبين ترجع لمكانها بلا قتال (5.2).
	if tgt == null and bool(u["returning"]) and is_guard(u):
		var blocker = _nearest_enemy(u, float(GC.stat(u["key"], "range")))
		if blocker != null:
			u["target"] = int(blocker["id"])
			u["chase_from"] = _fresh_origin(u)
			tgt = blocker

	# ثبات الهدف (5.2): لا تبدّل الهدف إلا إذا هاجمك عدو أقرب من هدفك الحالي
	if tgt != null and int(u["cmd_target"]) < 0:
		var att = get_unit(int(u["last_attacker"]))
		if alive(att) and _hostile(u, att):
			if _dist(u, att) < _dist(u, tgt):
				u["target"] = int(att["id"])
				tgt = att
	u["last_attacker"] = -1

	# وابل المزدوج: ضربات متتالية بعد إطلاق الضربة المميزة (6.7.1)
	if int(u["volley"]) > 0:
		u["volley_t"] = float(u["volley_t"]) - delta
		if float(u["volley_t"]) <= 0.0:
			var vt = get_unit(int(u["volley_tgt"]))
			if alive(vt):
				damage(vt, float(GC.ULTS[String(u["key"])]["dmg"]), u, true)
			u["volley"] = int(u["volley"]) - 1
			u["volley_t"] = float(GC.ULTS[String(u["key"])]["gap"])

	if bool(u["ulting"]):
		_step_ult(u, tgt, delta)
		if tgt != null:
			_face(u, tgt["pos"])
		return
	if _ult_ready(u, tgt):
		_start_ult(u)
		return

	if tgt != null:
		_fight(u, tgt, delta)
	else:
		if u["state"] == "attacking":
			u["state"] = "idle"
			u["swing"] = 0.0
			u["cycle"] = 0.0
		_advance(u, delta)

# هالات الزعيم وبطل العقارب، وعلاج الطبيب. لا تتجمع هالتان: يؤخذ الأقوى فقط (6.6)
func _step_auras(delta: float) -> void:
	for u in units:
		u["aura_dmg"] = 0.0
	for src in units:
		if src["state"] == "dead":
			continue
		var key := String(src["key"])
		var radius: float = float(GC.stat(key, "aura"))
		if radius > 0.0:
			var bonus: float = float(GC.stat(key, "aura_dmg"))
			for o in units:
				if o["state"] == "dead" or not _friendly(src, o):
					continue
				if _dist(src, o) <= radius:
					o["aura_dmg"] = maxf(float(o["aura_dmg"]), bonus)
		# علاج بطل العقارب المستمر داخل هالته
		var hr: float = float(GC.stat(key, "heal_range"))
		var hrate: float = float(GC.stat(key, "heal_rate"))
		if hr > 0.0 and hrate > 0.0:
			if key == "scorp_medic":
				_medic_heal(src, hr, hrate, delta)
			else:
				for o in units:
					if o["state"] == "dead" or not _friendly(src, o) or _dist(src, o) > hr:
						continue
					o["hp"] = minf(float(o["max_hp"]), float(o["hp"]) + hrate * delta)

# الطبيب يعالج أكثر حليف متضرر داخل مداه، ولا يعالج نفسه (6.5)
func _medic_heal(src: Dictionary, radius: float, rate: float, delta: float) -> void:
	var worst = null
	var worst_missing := 0.0
	for o in units:
		if o["state"] == "dead" or int(o["id"]) == int(src["id"]) or not _friendly(src, o):
			continue
		if _dist(src, o) > radius:
			continue
		var missing: float = float(o["max_hp"]) - float(o["hp"])
		if missing > worst_missing:
			worst_missing = missing
			worst = o
	if worst != null:
		worst["hp"] = minf(float(worst["max_hp"]), float(worst["hp"]) + rate * delta)

func _step_fires(delta: float) -> void:
	var keep := []
	for f in fires:
		f["t"] = float(f["t"]) + delta
		for u in units:
			if u["state"] == "dead" or int(u["player"]) == int(f["player"]):
				continue
			if int(teams_of(u)) == int(f["team"]):
				continue
			if Vector2(u["pos"]).distance_to(Vector2(f["pos"])) <= float(f["radius"]):
				damage(u, float(f["dps"]) * delta, null, false)
		if float(f["t"]) < float(f["dur"]):
			keep.append(f)
	fires = keep

func teams_of(u: Dictionary) -> int:
	return int(u["team"])

func add_fire(pos: Vector2, radius: float, dur: float, dps: float, owner: Dictionary) -> void:
	fires.append({"pos": pos, "radius": radius, "dur": dur, "dps": dps,
		"player": int(owner["player"]), "team": int(owner["team"]), "t": 0.0})

# ============================ القتال ============================
func _fight(u: Dictionary, tgt: Dictionary, delta: float) -> void:
	var key := String(u["key"])
	var d := _dist(u, tgt)

	# الرامي يقاتل بالأيدي عند الاقتراب (5.3)
	var melee_now: bool = bool(GC.stat(key, "ranged")) and d <= GC.MELEE_SWITCH_RANGE
	var reach: float = GC.MELEE_SWITCH_RANGE if melee_now else float(GC.stat(key, "range"))

	# حد المطاردة (5.2) — لا يُطبَّق على أمر هجوم صريح من اللاعب،
	# ولا على وحدة راجعة يعترضها عدو داخل مدى ضربتها مباشرة (3.8)
	var blocked_on_way: bool = bool(u["returning"]) and is_guard(u) and d <= reach
	if int(u["cmd_target"]) < 0 and not blocked_on_way:
		var detect: float = detect_of(u)
		if d > detect * GC.CHASE_DETECT_FACTOR or Vector2(u["pos"]).distance_to(Vector2(u["chase_from"])) > GC.CHASE_MAX_TILES:
			u["target"] = -1
			u["state"] = "moving"
			u["returning"] = true
			u["swing"] = 0.0
			u["cycle"] = 0.0
			_path_to(u, Vector2(u["chase_from"]))
			return
	var rate: float = float(GC.stat(key, "melee_rate")) if melee_now else float(GC.stat(key, "rate"))
	if rate <= 0.0:
		rate = 1.0
	rate *= rate_mult(u)
	var floor_rate: float = float(GC.stat(key, "combo_min_rate"))
	if floor_rate > 0.0:
		rate = maxf(rate, floor_rate)

	if d > reach:
		# اقترب من الهدف
		u["state"] = "moving" if u["state"] == "moving" else "attacking"
		u["swing"] = 0.0
		u["cycle"] = 0.0
		u["hit_done"] = false
		if u["repath_t"] <= 0.0:
			u["repath_t"] = GC.REPATH_EVERY
			_path_to(u, tgt["pos"])
		_advance(u, delta)
		u["state"] = "attacking"
		return

	# داخل المدى: اضرب
	u["state"] = "attacking"
	_face(u, tgt["pos"])
	# مترنّحة: لا تهاجم ولا تتقدم حتى ينتهي الترنّح (5.4.3)
	if float(u["stagger_t"]) > 0.0:
		u["path"] = []
		u["swing"] = 0.0
		u["cycle"] = 0.0
		u["hit_done"] = false
		return

	# الجرأة تحدد مسافة الاقتحام (5.4.1): خطوة اقتراب أثناء التعافي وحده،
	# فلا تُفقد الوحدة ضربة، ويصير لكل فرد مسافته المفضلة في الاشتباك.
	var want: float = reach * close_frac(u)
	if bool(u["hit_done"]) and d > want:
		_creep(u, Vector2(tgt["pos"]), d - want, delta)
	else:
		u["path"] = []

	# الرماية من بعيد تبقى بإيقاعها القديم (5.3)؛ نظام الحركات للالتحام (5.4.2)
	if not uses_moves(u, melee_now):
		u["swing"] += delta
		if not u["hit_done"] and u["swing"] >= rate * GC.UNIT_HIT_AT:
			u["hit_done"] = true
			_land_attack(u, tgt, melee_now)
		if u["swing"] >= rate:
			u["swing"] -= rate
			u["hit_done"] = false
		return

	if float(u["cycle"]) <= 0.0:
		_start_move(u, tgt, d, reach, rate)
	var spec: Dictionary = GC.MOVES[String(u["move"])]
	var cycle: float = float(u["cycle"])
	var hit_at: float = cycle * float(spec["wind"]) / (float(spec["wind"]) + float(spec["recover"]))
	u["swing"] += delta
	if not u["hit_done"] and u["swing"] >= hit_at:
		u["hit_done"] = true
		_land_attack(u, tgt, melee_now)
	if u["swing"] >= cycle:
		u["swing"] = 0.0
		u["cycle"] = 0.0        # الدورة التالية تختار حركتها من جديد
		u["hit_done"] = false

# نسبة من المدى تقف عندها الوحدة في الاشتباك، من جرأتها (5.4.1)
func close_frac(u: Dictionary) -> float:
	var lo: float = GC.TRAIT_BOLD[0]
	var hi: float = GC.TRAIT_BOLD[1]
	var k: float = clampf((float(u.get("bold", 1.0)) - lo) / maxf(0.0001, hi - lo), 0.0, 1.0)
	return 1.0 - k * GC.CLOSE_SPAN

# خطوة صغيرة نحو الهدف بلا مسار: لا تتجاوز المسافة المطلوبة ولا تدخل مبنى
func _creep(u: Dictionary, goal: Vector2, most: float, delta: float) -> void:
	u["path"] = []
	var to: Vector2 = goal - Vector2(u["pos"])
	if to.length() < 0.01 or most <= 0.0:
		return
	var span: float = minf(speed_of(u) * (1.0 - float(u["slow"])) * delta, most)
	var step: Vector2 = Vector2(u["pos"]) + to.normalized() * span
	if _walkable_at(step):
		u["pos"] = step

# نظام الحركات للالتحام فقط: الرامي وهو يرمي من بعيد يبقى على إيقاعه (5.3)
func uses_moves(u: Dictionary, melee_now: bool) -> bool:
	return melee_now or not bool(GC.stat(u["key"], "ranged"))

# بداية دورة ضرب: تُختار الحركة ويُحسب طولها الزمني (5.4.2)
func _start_move(u: Dictionary, tgt: Dictionary, d: float, reach: float, rate: float) -> void:
	u["move"] = pick_move(u, tgt, d, reach)
	var spec: Dictionary = GC.MOVES[String(u["move"])]
	u["cycle"] = (float(spec["wind"]) + float(spec["recover"])) * rate * GC.MOVE_CYCLE_SCALE
	u["hit_done"] = false
	# الهدف يرى الاستعداد فيستعد للرد (5.4.3)
	var wind: float = float(u["cycle"]) * float(spec["wind"]) / (float(spec["wind"]) + float(spec["recover"]))
	_warn(tgt, u, wind)

# ============================ ردود الأفعال الدفاعية (5.4.3) ============================
# الوحدة ترى الضربة القادمة إذا كان المهاجم داخل قوس 120 درجة أمامها وبدأ استعداده،
# ثم تتصرف بعد زمن رد فعلها. إن كان استعداد الضربة أقصر من رد فعلها فاتتها.
func _warn(victim: Dictionary, attacker: Dictionary, wind: float) -> void:
	if not alive(victim) or float(victim["react_t"]) >= 0.0:
		return
	var side := hit_side(victim, Vector2(attacker["pos"]))
	if side_react(side) <= 0.0:
		return                      # من الخلف لا تُرى الضربة أصلاً
	var react: float = float(victim.get("react", 0.2))
	if react >= wind:
		return                      # رد فعلها أبطأ من الضربة
	victim["react_t"] = react
	victim["react_from"] = int(attacker["id"])
	victim["react_kind"] = "block" if GC.SHIELD_UNITS.has(String(victim["key"])) else "dodge"

# حان وقت الرد: تُحسب فرصته الآن من الزاوية والمهارة والتحمّل
func _do_react(u: Dictionary) -> void:
	var src = get_unit(int(u["react_from"]))
	u["react_from"] = -1
	if not alive(u) or not alive(src):
		return
	# المترنّحة أو التي في زمن تعافيها لا تتفادى (5.4.3)
	if float(u["stagger_t"]) > 0.0 or in_recover(u):
		return
	var side := hit_side(u, Vector2(src["pos"]))
	var factor: float = side_react(side)
	if factor <= 0.0:
		return
	var blocking: bool = String(u["react_kind"]) == "block"
	var cost: float = GC.STAMINA_BLOCK if blocking else GC.STAMINA_DODGE
	if float(u["stamina"]) < cost:
		return                      # نفد تحمّلها فتتلقى الضربة
	if not blocking and float(u["dodge_cool"]) > 0.0:
		return                      # ما زالت في تبريد التفادي
	var chance: float = GC.DODGE_CHANCE * float(u.get("dodge_skill", 1.0)) * factor
	if blocking:
		chance = factor             # صاحب الدرع يصدّ متى رأى الضربة
	if randf() > chance:
		return
	u["stamina"] = float(u["stamina"]) - cost
	if blocking:
		u["block_t"] = GC.DODGE_DUR
	else:
		u["dodge_t"] = GC.DODGE_DUR
		u["dodge_cool"] = GC.DODGE_COOLDOWN
		_jump_away(u, Vector2(src["pos"]))

# قفزة التفادي: للخلف أو للجانب، ولا تقفز داخل مبنى
func _jump_away(u: Dictionary, from: Vector2) -> void:
	var away: Vector2 = Vector2(u["pos"]) - from
	if away.length() < 0.001:
		away = Vector2(1, 0)
	away = away.normalized()
	for dir in [away, away.rotated(PI * 0.5), away.rotated(-PI * 0.5)]:
		var to: Vector2 = Vector2(u["pos"]) + dir * GC.DODGE_DIST
		if _walkable_at(to):
			u["pos"] = to
			# المسار لا يُمسح: وحدة تنفّذ أمر حركة تبقى عليه بعد القفزة، وإلا
			# صارت idle فردّت على من يضربها، وهذا يكسر قاعدة 5.1
			return

# هل الوحدة الآن في زمن التعافي بعد ضربتها؟ (فرصة للضربة القوية)
func in_recover(u: Dictionary) -> bool:
	return String(u["state"]) == "attacking" and float(u["cycle"]) > 0.0 \
		and bool(u["hit_done"]) and float(u["swing"]) < float(u["cycle"])

# اختيار الحركة بنظام نقاط لا بعشوائية محضة (5.4.2)
func pick_move(u: Dictionary, tgt: Dictionary, d: float, reach: float) -> String:
	var lock := String(u.get("move_lock", ""))
	if lock != "" and GC.MOVES.has(lock):
		return lock
	var spin_ok: bool = GC.SPIN_UNITS.has(String(u["key"]))
	var bold: float = float(u.get("bold", 1.0))
	var low_hp: bool = float(u["hp"]) / maxf(1.0, float(u["max_hp"])) < GC.MOVE_LOW_HP
	var far: bool = d > reach * GC.MOVE_FAR_FRAC
	var tgt_recover: bool = in_recover(tgt)
	var crowd := 0
	if spin_ok:
		crowd = _enemies_within(u, Vector2(u["pos"]), reach).size()
	var best := "quick"
	var best_score := -INF
	for m in GC.MOVE_ORDER:
		if m == "spin" and not spin_ok:
			continue
		var sc: float = float(GC.MOVE_BASE[m])
		match m:
			"heavy":
				if tgt_recover:
					sc += GC.MOVE_RECOVER_BONUS      # استغلال الفرصة
				sc += (bold - 1.0) * GC.MOVE_BOLD_W  # الجريء يميل للقوية
			"thrust":
				if far:
					sc += GC.MOVE_FAR_BONUS
			"spin":
				if crowd >= GC.MOVE_CROWD:
					sc += GC.MOVE_CROWD_BONUS
				sc += (bold - 1.0) * GC.MOVE_BOLD_W
			"quick":
				if low_hp:
					sc += GC.MOVE_LOW_HP_BONUS       # حذر
		sc *= randf_range(1.0 - GC.MOVE_RANDOM, 1.0 + GC.MOVE_RANDOM)
		if sc > best_score:
			best_score = sc
			best = m
	return best

# مضاعف الضرر الصادر: هالة الزعيم + تعزيز الضربة المميزة + مخزن السلاح (6.5، 6.7، 3.7)
func out_mult(u: Dictionary) -> float:
	return (1.0 + float(u["aura_dmg"]) + float(u["buff_dmg"])) * float(player_dmg_mult.get(int(u["player"]), 1.0))

# مضاعف زمن الضربة: تعزيز سرعة الضرب + تسارع الاشتباك (6.2، 6.6، 6.7)
func rate_mult(u: Dictionary) -> float:
	var key := String(u["key"])
	var m: float = 1.0 / (1.0 + float(u["buff_rate"]))
	var step: float = float(GC.stat(key, "combo_step"))
	if step > 0.0 and int(u["combo"]) > 0:
		var cap: float = float(GC.stat(key, "combo_cap"))
		var hits: int = int(u["combo"])
		var max_hits: float = float(GC.stat(key, "combo_max"))
		if max_hits > 0.0:
			hits = mini(hits, int(max_hits))
		var cut: float = step * float(hits)
		if cap > 0.0:
			cut = minf(cut, cap)
		m *= (1.0 - cut)
	return m

func _land_attack(u: Dictionary, tgt: Dictionary, melee_now: bool) -> void:
	var key := String(u["key"])
	var dmg: float = float(GC.stat(key, "melee_dmg")) if melee_now else float(GC.stat(key, "dmg"))
	dmg *= out_mult(u)

	# ---- الحركة الحالية وأثرها (5.4.2) ----
	var moves: bool = uses_moves(u, melee_now)
	var spec: Dictionary = GC.MOVES.get(String(u["move"]), {}) if moves else {}
	var around: bool = bool(spec.get("around", false))
	if moves:
		dmg *= float(spec["dmg"])
		var reach: float = (GC.MELEE_SWITCH_RANGE if melee_now else float(GC.stat(key, "range"))) \
			+ float(spec["reach"])
		# الهدف ابتعد أثناء الاستعداد: تمر الضربة في الهواء بلا ضرر ولا شحن
		if not around and _dist(u, tgt) > reach + GC.MOVE_WHIFF_SLACK:
			return

	# تسارع الاشتباك: كل ضربة متتالية على نفس الهدف (6.2 و 6.6)
	if int(u["combo_target"]) == int(tgt["id"]):
		u["combo"] = int(u["combo"]) + 1
	else:
		u["combo_target"] = int(tgt["id"])
		u["combo"] = 1
	u["combo_t"] = 0.0
	# شحن الضربة المميزة عن كل ضربة تُصيب (6.7)
	if has_ult(key):
		var per_hit: float = GC.HERO_CHARGE_PER_HIT if bool(GC.stat(key, "hero")) else GC.CHARGE_PER_HIT
		u["charge"] = minf(GC.CHARGE_FULL, float(u["charge"]) + per_hit)
	if bool(GC.stat(key, "ranged")) and not melee_now:
		var shots: int = int(GC.stat(key, "shots")) if GC.UNIT_STATS.get(key, {}).has("shots") else 1
		for i in maxi(1, shots):
			_fire(u, tgt, dmg, String(GC.stat(key, "proj")), float(i - (shots - 1) * 0.5) * 0.18)
		return

	# الحركة الدائرية: كل الأعداء حول الوحدة (5.4.2)
	if around:
		var radius: float = (GC.MELEE_SWITCH_RANGE if melee_now else float(GC.stat(key, "range"))) \
			+ float(spec["reach"])
		for o in _enemies_within(u, Vector2(u["pos"]), radius):
			damage(o, dmg, u, false)
		return

	damage(tgt, dmg, u, false)
	var splash: float = float(GC.stat(key, "splash"))
	if splash > 0.0:
		for o in _enemies_within(u, Vector2(tgt["pos"]), splash):
			if int(o["id"]) != int(tgt["id"]):
				damage(o, dmg, u, false)
	# الضربة القوية تُرنّح الهدف وتدفعه مربعاً (5.4.2)
	if moves and alive(tgt):
		_stagger(tgt, float(spec["stagger"]))
		_push(tgt, Vector2(u["pos"]), float(spec["push"]))

# ترنّح: لا تهاجم الوحدة خلاله وتُلغى دورة ضربها (5.4.3)
func _stagger(u: Dictionary, dur: float) -> void:
	if dur <= 0.0:
		return
	u["stagger_t"] = maxf(float(u["stagger_t"]), dur)
	u["swing"] = 0.0
	u["cycle"] = 0.0
	u["hit_done"] = false

# مقذوف يطير 0.3 – 0.5 ثانية (5.3)
func _fire(u: Dictionary, tgt: Dictionary, dmg: float, kind: String, spread: float,
		is_ult: bool = false, fire: Dictionary = {}) -> void:
	var d: float = _dist(u, tgt)
	# زجاجة رامي النار تشعل الأرض عند سقوطها (6.4)
	var payload := fire
	if payload.is_empty() and kind == "bottle":
		payload = {"radius": float(GC.stat(u["key"], "fire_radius")),
			"dur": float(GC.stat(u["key"], "fire_dur")),
			"dps": float(GC.stat(u["key"], "fire_dps"))}
	# المطر الخفيف: 20% من الهجمات البعيدة العادية تسقط قرب الهدف بلا ضرر (10).
	# الضربات المميزة لا تخطئ — الوصف يذكر الهجمات البعيدة وحدها.
	var miss := Vector2.ZERO
	if not is_ult and randf() >= ranged_hit_chance():
		var ang := randf() * TAU
		miss = Vector2(cos(ang), sin(ang)) * GC.WEATHER_MISS_SPREAD
	projectiles.append({
		"pos": u["pos"], "from": u["pos"], "target": int(tgt["id"]), "miss": miss,
		"t": 0.0, "dur": clampf(d / GC.PROJ_SPEED, GC.PROJ_MIN_TIME, GC.PROJ_MAX_TIME),
		"dmg": dmg, "player": int(u["player"]), "owner": int(u["id"]),
		"kind": kind, "spread": spread, "spin": randf() * TAU,
		"is_ult": is_ult, "fire": payload,
	})

func _step_projectiles(delta: float) -> void:
	var keep := []
	for p in projectiles:
		p["t"] += delta
		var tgt = get_unit(int(p["target"]))
		var off: Vector2 = p.get("miss", Vector2.ZERO)
		var goal: Vector2 = Vector2(tgt["pos"]) + off if tgt != null else Vector2(p["pos"])
		var k: float = clampf(p["t"] / p["dur"], 0.0, 1.0)
		p["pos"] = Vector2(p["from"]).lerp(goal, k)
		if k < 1.0:
			keep.append(p)
			continue
		var owner = get_unit(int(p["owner"]))
		if off != Vector2.ZERO:
			continue     # سقطت قرب الهدف: لا ضرر ولا إشعال (10)
		var payload: Dictionary = p.get("fire", {})
		if not payload.is_empty() and owner != null:
			add_fire(Vector2(p["pos"]), float(payload["radius"]), float(payload["dur"]),
				float(payload["dps"]), owner)
		if alive(tgt) and float(p["dmg"]) > 0.0:
			damage(tgt, float(p["dmg"]), owner, bool(p.get("is_ult", false)))
	projectiles = keep

# الضرر يمر من هنا دائماً: يطبّق الدرع، ويشعل الوميض، ويبلّغ الخارج
func damage(tgt: Dictionary, amount: float, src, is_ult: bool) -> void:
	if not alive(tgt):
		return
	if src != null and not _hostile(src, tgt):
		return   # لا ضرر على الحلفاء ولا على وحدات نفس اللاعب (5.2)
	if float(tgt["invuln_t"]) > 0.0:
		return   # تصلّب: لا يتلقى أي ضرر (6.7.1)
	# الضربة المتفاداة أو المصدودة تبقى "هجوماً" تعرفه الوحدة: ثبات الهدف (5.2)
	# يعتمد على من هاجمها لا على من أدماها.
	if src != null and (float(tgt["dodge_t"]) > 0.0 or float(tgt["block_t"]) > 0.0):
		tgt["last_attacker"] = int(src["id"])
	if float(tgt["dodge_t"]) > 0.0:
		return   # تفادٍ: مناعة كاملة أثناء القفزة (5.4.3)
	# الصدّ: يمتص الضرر كاملاً، ويرتد المهاجم نصف مربع ويترنّح (5.4.3)
	if float(tgt["block_t"]) > 0.0:
		if src != null:
			_push(src, Vector2(tgt["pos"]), GC.BLOCK_PUSH)
			_stagger(src, GC.BLOCK_STAGGER)
		tgt["flash"] = GC.HIT_FLASH
		return
	# قاعدة الزاوية: الضربة من الجانب +10% ومن الخلف +25% (5.4.3)
	if src != null:
		amount *= side_damage(hit_side(tgt, Vector2(src["pos"])))
	var armor: float = float(GC.stat(tgt["key"], "armor")) + float(player_armor_bonus.get(int(tgt["player"]), 0.0))
	var dealt: float = amount * (1.0 - clampf(armor, 0.0, 0.95))
	tgt["hp"] -= dealt
	# شحن عن كل 50 ضرراً تتلقاه (6.7)
	if has_ult(String(tgt["key"])):
		tgt["dmg_acc"] = float(tgt["dmg_acc"]) + dealt
		while float(tgt["dmg_acc"]) >= GC.CHARGE_DAMAGE_STEP:
			tgt["dmg_acc"] = float(tgt["dmg_acc"]) - GC.CHARGE_DAMAGE_STEP
			tgt["charge"] = minf(GC.CHARGE_FULL, float(tgt["charge"]) + GC.CHARGE_PER_DAMAGE)
	tgt["flash"] = GC.HIT_FLASH
	tgt["hurt_t"] = 0.0
	if src != null:
		tgt["last_attacker"] = int(src["id"])
	if on_hit.is_valid():
		on_hit.call(tgt, dealt, is_ult)
	if tgt["hp"] <= 0.0:
		if on_death.is_valid():
			on_death.call(tgt, src)
		_kill(tgt)

func _kill(u: Dictionary) -> void:
	u["hp"] = 0.0
	u["state"] = "dead"
	u["dead_t"] = 0.0
	u["path"] = []
	u["sel"] = false
	# من كان يقاتله يبحث فوراً عن هدف آخر (5.2)
	for other in units:
		if int(other["target"]) == int(u["id"]):
			other["target"] = -1
			other["scan_t"] = 0.0
		if int(other["cmd_target"]) == int(u["id"]):
			other["cmd_target"] = -1

# ============================ الحركة ============================
func _advance(u: Dictionary, delta: float) -> void:
	var path: Array = u["path"]
	if path.is_empty():
		if u["state"] == "moving" or u["state"] == "attackMove":
			u["state"] = "idle"
		return
	var speed: float = speed_of(u) * (1.0 - float(u["slow"]))
	var left: float = speed * delta
	while left > 0.0 and not path.is_empty():
		var goal: Vector2 = path[0]
		var to_goal: Vector2 = goal - u["pos"]
		var dist := to_goal.length()
		if dist <= maxf(left, GC.ARRIVE_EPS):
			u["pos"] = goal
			path.remove_at(0)
			left -= dist
		else:
			u["pos"] += to_goal / dist * left
			_face(u, goal)
			left = 0.0
	if path.is_empty() and (u["state"] == "moving" or u["state"] == "attackMove"):
		u["state"] = "idle"
		u["returning"] = false

# وحدة حارسة لها مرساة ثابتة (الشرطة)، بخلاف وحدات اللاعبين
func is_guard(u: Dictionary) -> bool:
	return Vector2(u["anchor"]).x != INF

# نقطة بدء المطاردة عند رصد هدف جديد:
# الشرطة تقيس دائماً من مركزها، وبقية الوحدات من مكانها لحظة الرصد (5.2 و 3.8)
func _fresh_origin(u: Dictionary) -> Vector2:
	return Vector2(u["anchor"]) if is_guard(u) else Vector2(u["pos"])

func _face(u: Dictionary, to: Vector2) -> void:
	# الاتجاه على الشاشة: محور x المائل هو (i - j)
	var d: Vector2 = to - u["pos"]
	var sx: float = d.x - d.y
	if absf(sx) > 0.01:
		u["dir"] = 1 if sx >= 0.0 else -1
	# واتجاه النظر الحقيقي على الشبكة، تُحسب منه قاعدة الزاوية (5.4.3)
	if d.length() > 0.01:
		u["face"] = d.normalized()

# من أين جاءت الضربة: "front" أو "side" أو "back" (5.4.3)
func hit_side(victim: Dictionary, from: Vector2) -> String:
	var to_attacker: Vector2 = from - Vector2(victim["pos"])
	if to_attacker.length() < 0.001:
		return "front"
	var face: Vector2 = Vector2(victim.get("face", Vector2(1, 0)))
	if face.length() < 0.001:
		face = Vector2(1, 0)
	var ang: float = rad_to_deg(absf(face.angle_to(to_attacker)))
	if ang <= GC.ARC_FRONT * 0.5:
		return "front"
	if ang <= GC.ARC_SIDE * 0.5:
		return "side"
	return "back"

func side_react(side: String) -> float:
	match side:
		"front": return GC.REACT_FRONT
		"side": return GC.REACT_SIDE
	return GC.REACT_BACK

func side_damage(side: String) -> float:
	match side:
		"front": return GC.DMG_FRONT
		"side": return GC.DMG_SIDE
	return GC.DMG_BACK

func _path_to(u: Dictionary, goal: Vector2) -> void:
	u["path"] = map.find_path(u["pos"], goal)

# ============================ أوامر اللاعب ============================
func order_move(sel: Array, goal: Vector2, attack_move: bool) -> void:
	for u in sel:
		if not alive(u):
			continue
		u["target"] = -1
		u["cmd_target"] = -1
		u["swing"] = 0.0
		u["cycle"] = 0.0
		u["state"] = "attackMove" if attack_move else "moving"
		u["returning"] = false
		u["chase_from"] = goal
		_path_to(u, goal)

func order_attack(sel: Array, tgt: Dictionary) -> void:
	for u in sel:
		if not alive(u) or not _hostile(u, tgt):
			continue
		u["cmd_target"] = int(tgt["id"])
		u["target"] = int(tgt["id"])
		u["chase_from"] = u["pos"]
		u["state"] = "attacking"
		u["swing"] = 0.0
		u["cycle"] = 0.0
		u["hit_done"] = false
		u["repath_t"] = 0.0

# ============================ الضربات المميزة (6.7) ============================
# الأفراد العاديون لا يملكون ضربة مميزة
static func has_ult(key: String) -> bool:
	return GC.ULTS.has(key)

func _friendly(a, b) -> bool:
	if a == null or b == null:
		return false
	return int(a["team"]) == int(b["team"])

func _damaged_ally_near(u: Dictionary, radius: float) -> bool:
	for o in units:
		if o["state"] == "dead" or not _friendly(u, o):
			continue
		if int(o["id"]) == int(u["id"]) and not GC.ULT_HEAL_SELF:
			continue
		if float(o["hp"]) < float(o["max_hp"]) and _dist(u, o) <= radius:
			return true
	return false

# هل تحقق شرط إطلاق الضربة الآن؟ (6.7)
func _ult_ready(u: Dictionary, tgt) -> bool:
	var key := String(u["key"])
	if not has_ult(key) or float(u["charge"]) < GC.CHARGE_FULL or bool(u["ulting"]):
		return false
	var spec: Dictionary = GC.ULTS[key]
	match String(spec["need"]):
		"enemy":
			return tgt != null and _dist(u, tgt) <= float(spec.get("range", GC.stat(key, "range")))
		"foe_near":
			return _nearest_enemy(u, detect_of(u)) != null
		"ally":
			return _damaged_ally_near(u, float(spec.get("radius", 3.0)))
	return false

func _start_ult(u: Dictionary) -> void:
	u["ulting"] = true
	u["ult_swing"] = 0.0
	u["ult_done"] = false
	u["swing"] = 0.0
	u["cycle"] = 0.0
	u["hit_done"] = true      # الضربة العادية لا تقع أثناء الضربة المميزة

func _step_ult(u: Dictionary, tgt, delta: float) -> void:
	var rate: float = maxf(0.05, float(GC.stat(u["key"], "rate")))
	u["ult_swing"] = float(u["ult_swing"]) + delta
	if not bool(u["ult_done"]) and float(u["ult_swing"]) >= rate * GC.UNIT_HIT_AT:
		u["ult_done"] = true
		_fire_ult(u, tgt)
		u["charge"] = 0.0
	if float(u["ult_swing"]) >= rate:
		u["ulting"] = false
		u["ult_swing"] = 0.0
		u["hit_done"] = false

func _fire_ult(u: Dictionary, tgt) -> void:
	var key := String(u["key"])
	var spec: Dictionary = GC.ULTS[key]
	var here: Vector2 = u["pos"]
	match String(spec["kind"]):
		"invuln":
			u["invuln_t"] = float(spec["dur"])
		"aoe":
			for o in _enemies_within(u, Vector2(tgt["pos"]) if tgt != null else here, float(spec["radius"])):
				damage(o, float(spec["dmg"]), u, true)
				_slow(o, float(spec["slow"]), float(spec["slow_dur"]))
		"invuln_aoe":
			u["invuln_t"] = float(spec["dur"])
			for o in _enemies_within(u, here, float(spec["radius"])):
				damage(o, float(spec["dmg"]), u, true)
		"shot":
			if tgt != null:
				_fire(u, tgt, float(spec["dmg"]), "arrow", 0.0, true)
		"pierce":
			# تخترق أول عدوين في خط الطعنة
			var line := _enemies_in_line(u, tgt, int(spec["targets"]))
			for o in line:
				damage(o, float(spec["dmg"]), u, true)
		"arc":
			# كل الأعداء داخل قوس أمامه
			for o in _enemies_within(u, here, float(spec["radius"])):
				damage(o, float(spec["dmg"]), u, true)
		"volley":
			u["volley"] = int(spec["hits"])
			u["volley_t"] = 0.0
			u["volley_tgt"] = int(tgt["id"]) if tgt != null else -1
		"fire":
			var at: Vector2 = Vector2(tgt["pos"]) if tgt != null else here
			add_fire(at, float(spec["radius"]), float(spec["dur"]), float(spec["dps"]), u)
		"fire_arrows":
			for i in int(spec["arrows"]):
				if tgt != null:
					_fire(u, tgt, float(spec["dmg"]), "arrow", float(i - 1) * 0.2, true, {
						"radius": float(spec["fire_radius"]), "dur": float(spec["fire_dur"]),
						"dps": float(spec["fire_dps"])})
		"buff", "rally":
			for o in _allies_within(u, float(spec["radius"])):
				o["buff_dmg"] = maxf(float(o["buff_dmg"]), float(spec["dmg"]))
				o["buff_rate"] = maxf(float(o["buff_rate"]), float(spec.get("rate", 0.0)))
				o["buff_t"] = maxf(float(o["buff_t"]), float(spec["dur"]))
		"buff_heal":
			for o in _allies_within(u, float(spec["radius"])):
				o["buff_dmg"] = maxf(float(o["buff_dmg"]), float(spec["dmg"]))
				o["buff_t"] = maxf(float(o["buff_t"]), float(spec["dur"]))
				o["hp"] = minf(float(o["max_hp"]), float(o["hp"]) + float(spec["hp"]))
		"heal_burst":
			for o in _allies_within(u, float(spec["radius"])):
				o["hp"] = minf(float(o["max_hp"]), float(o["hp"]) + float(spec["hp"]))
		"bash":
			if tgt != null:
				damage(tgt, float(spec["dmg"]), u, true)
				_slow(tgt, float(spec["slow"]), float(spec["slow_dur"]))
				_push(tgt, here, float(spec["push"]))

func _slow(u: Dictionary, amount: float, dur: float) -> void:
	u["slow"] = maxf(float(u["slow"]), amount)
	u["slow_t"] = maxf(float(u["slow_t"]), dur)

# دفع وحدة بعيداً عن نقطة. لا تُدفع داخل مبنى (5.4.2 والضربات المميزة في 6.7)
func _push(u: Dictionary, from: Vector2, tiles: float) -> void:
	if tiles <= 0.0:
		return
	var d: Vector2 = Vector2(u["pos"]) - from
	if d.length() < 0.01:
		return
	var goal: Vector2 = Vector2(u["pos"]) + d.normalized() * tiles
	if _walkable_at(goal):
		u["pos"] = goal

func _walkable_at(p: Vector2) -> bool:
	if map == null or not map.has_method("walkable"):
		return true
	return bool(map.walkable(int(round(p.x)), int(round(p.y))))

func _enemies_within(u: Dictionary, center: Vector2, radius: float) -> Array:
	var out := []
	for o in _near_units(center, radius):
		if o["state"] == "dead" or not _hostile(u, o):
			continue
		if Vector2(o["pos"]).distance_to(center) <= radius:
			out.append(o)
	return out

func _allies_within(u: Dictionary, radius: float) -> Array:
	var out := []
	for o in _near_units(Vector2(u["pos"]), radius):
		if o["state"] == "dead" or not _friendly(u, o):
			continue
		if int(o["id"]) == int(u["id"]) and not GC.ULT_HEAL_SELF:
			continue
		if _dist(u, o) <= radius:
			out.append(o)
	return out

# أقرب عدوين على خط الطعنة أمام الوحدة
func _enemies_in_line(u: Dictionary, tgt, count: int) -> Array:
	if tgt == null:
		return []
	var dir: Vector2 = (Vector2(tgt["pos"]) - Vector2(u["pos"]))
	if dir.length() < 0.01:
		return [tgt]
	dir = dir.normalized()
	var reach: float = float(GC.stat(u["key"], "range")) + 1.5
	var found := []
	for o in units:
		if o["state"] == "dead" or not _hostile(u, o):
			continue
		var rel: Vector2 = Vector2(o["pos"]) - Vector2(u["pos"])
		var along: float = rel.dot(dir)
		if along < 0.0 or along > reach:
			continue
		if absf(rel.cross(dir)) > 0.8:      # قريب من خط الطعنة
			continue
		found.append({"u": o, "d": along})
	found.sort_custom(func(a, b): return float(a["d"]) < float(b["d"]))
	var out := []
	for i in mini(count, found.size()):
		out.append(found[i]["u"])
	return out

# ============================ أدوات ============================
func _hostile(a, b) -> bool:
	if a == null or b == null:
		return false
	if int(a["player"]) == int(b["player"]):
		return false
	return int(a["team"]) != int(b["team"]) or int(a["team"]) < 0

func _dist(a: Dictionary, b: Dictionary) -> float:
	return Vector2(a["pos"]).distance_to(Vector2(b["pos"]))

func _nearest_enemy(u: Dictionary, within: float):
	var best = null
	var bd := within
	for o in _near_units(Vector2(u["pos"]), within):
		if o["state"] == "dead" or not _hostile(u, o):
			continue
		var d := _dist(u, o)
		if d <= bd:
			bd = d
			best = o
	return best

# الحالة التي تُرسم بها الوحدة (13.1): hurt تعلو 0.35 ثانية ثم ترجع لحالتها
func draw_state(u: Dictionary) -> String:
	if u["state"] == "dead":
		return "death"
	if bool(u["ulting"]):
		return "ult"
	# ردود الأفعال الدفاعية تعلو على الإصابة (5.4.3 و 5.4.6)
	if float(u["dodge_t"]) > 0.0:
		return "dodge"
	if float(u["block_t"]) > 0.0:
		return "block"
	if float(u["stagger_t"]) > 0.0:
		return "stagger"
	if float(u["hurt_t"]) < GC.UNIT_HURT_DUR:
		return "hurt"
	if u["state"] == "attacking" and u["path"].is_empty():
		return "attack"
	if not u["path"].is_empty():
		return "walk"
	return "idle"

# الزمن الذي يُمرَّر للرسم حتى تتطابق لحظة الارتطام مع الضرر الفعلي (13.1)
func draw_time(u: Dictionary) -> float:
	if u["state"] == "dead":
		return float(u["dead_t"])
	if bool(u["ulting"]):
		return float(u["ult_swing"])
	if float(u["dodge_t"]) > 0.0:
		return GC.DODGE_DUR - float(u["dodge_t"])
	if float(u["block_t"]) > 0.0:
		return GC.DODGE_DUR - float(u["block_t"])
	if float(u["stagger_t"]) > 0.0:
		return float(GC.MOVES["heavy"]["stagger"]) - float(u["stagger_t"])
	if float(u["hurt_t"]) < GC.UNIT_HURT_DUR:
		return float(u["hurt_t"])
	if u["state"] == "attacking" and u["path"].is_empty():
		return float(u["swing"])
	return float(u["anim_t"])

func draw_rate(u: Dictionary) -> float:
	var key := String(u["key"])
	if bool(u["ulting"]):
		return maxf(0.05, float(GC.stat(key, "rate")))
	# أثناء حركة التحام: زمن الرسم هو طول دورة الحركة نفسها (5.4.2)
	if float(u["cycle"]) > 0.0 and String(u["state"]) == "attacking":
		return maxf(0.05, float(u["cycle"]))
	var tgt = get_unit(int(u["target"]))
	if bool(GC.stat(key, "ranged")) and tgt != null and _dist(u, tgt) <= GC.MELEE_SWITCH_RANGE:
		return maxf(0.05, float(GC.stat(key, "melee_rate")))
	return maxf(0.05, float(GC.stat(key, "rate")))
