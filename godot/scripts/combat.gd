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

# استدعاءات للخارج: (وحدة مصابة، ضرر، هل من ضربة مميزة)
var on_hit := Callable()

func _init(map_node) -> void:
	map = map_node

# ============================ إنشاء الوحدات ============================
func spawn(key: String, player: int, team: int, tile: Vector2) -> Dictionary:
	var hp: float = GC.stat(key, "hp")
	var u := {
		"id": next_id, "key": key, "player": player, "team": team,
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
	}
	next_id += 1
	units.append(u)
	_by_id[u["id"]] = u
	return u

func get_unit(id: int) -> Variant:
	return _by_id.get(id, null)

func alive(u) -> bool:
	return u != null and u["state"] != "dead"

func clear() -> void:
	units.clear()
	projectiles.clear()
	_by_id.clear()
	next_id = 1

# ============================ الخطوة الزمنية ============================
func step(delta: float) -> void:
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
		var found = _nearest_enemy(u, float(GC.stat(u["key"], "detect")))
		if found != null:
			u["target"] = int(found["id"])
			u["chase_from"] = u["pos"]
			tgt = found

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

	# حد المطاردة (5.2) — لا يُطبَّق على أمر هجوم صريح من اللاعب
	if int(u["cmd_target"]) < 0:
		var detect: float = GC.stat(key, "detect")
		if d > detect * GC.CHASE_DETECT_FACTOR or u["pos"].distance_to(u["chase_from"]) > GC.CHASE_MAX_TILES:
			u["target"] = -1
			u["state"] = "moving"
			u["swing"] = 0.0
			_path_to(u, u["chase_from"])
			return

	# الرامي يقاتل بالأيدي عند الاقتراب (5.3)
	var melee_now: bool = bool(GC.stat(key, "ranged")) and d <= GC.MELEE_SWITCH_RANGE
	var reach: float = GC.MELEE_SWITCH_RANGE if melee_now else float(GC.stat(key, "range"))
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
		u["hit_done"] = false
		if u["repath_t"] <= 0.0:
			u["repath_t"] = GC.REPATH_EVERY
			_path_to(u, tgt["pos"])
		_advance(u, delta)
		u["state"] = "attacking"
		return

	# داخل المدى: اضرب
	u["path"] = []
	u["state"] = "attacking"
	_face(u, tgt["pos"])
	u["swing"] += delta
	if not u["hit_done"] and u["swing"] >= rate * GC.UNIT_HIT_AT:
		u["hit_done"] = true
		_land_attack(u, tgt, melee_now)
	if u["swing"] >= rate:
		u["swing"] -= rate
		u["hit_done"] = false

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
	damage(tgt, dmg, u, false)
	var splash: float = float(GC.stat(key, "splash"))
	if splash > 0.0:
		for o in _enemies_within(u, Vector2(tgt["pos"]), splash):
			if int(o["id"]) != int(tgt["id"]):
				damage(o, dmg, u, false)

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
	projectiles.append({
		"pos": u["pos"], "from": u["pos"], "target": int(tgt["id"]),
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
		var goal: Vector2 = tgt["pos"] if tgt != null else p["pos"]
		var k: float = clampf(p["t"] / p["dur"], 0.0, 1.0)
		p["pos"] = Vector2(p["from"]).lerp(goal, k)
		if k < 1.0:
			keep.append(p)
			continue
		var owner = get_unit(int(p["owner"]))
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
	var speed: float = float(GC.stat(u["key"], "speed")) * (1.0 - float(u["slow"]))
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

func _face(u: Dictionary, to: Vector2) -> void:
	# الاتجاه على الشاشة: محور x المائل هو (i - j)
	var d: Vector2 = to - u["pos"]
	var sx: float = d.x - d.y
	if absf(sx) > 0.01:
		u["dir"] = 1 if sx >= 0.0 else -1

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
		u["state"] = "attackMove" if attack_move else "moving"
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
			return _nearest_enemy(u, float(GC.stat(key, "detect"))) != null
		"ally":
			return _damaged_ally_near(u, float(spec.get("radius", 3.0)))
	return false

func _start_ult(u: Dictionary) -> void:
	u["ulting"] = true
	u["ult_swing"] = 0.0
	u["ult_done"] = false
	u["swing"] = 0.0
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

func _push(u: Dictionary, from: Vector2, tiles: float) -> void:
	var d: Vector2 = Vector2(u["pos"]) - from
	if d.length() < 0.01:
		return
	var goal: Vector2 = Vector2(u["pos"]) + d.normalized() * tiles
	u["pos"] = goal

func _enemies_within(u: Dictionary, center: Vector2, radius: float) -> Array:
	var out := []
	for o in units:
		if o["state"] == "dead" or not _hostile(u, o):
			continue
		if Vector2(o["pos"]).distance_to(center) <= radius:
			out.append(o)
	return out

func _allies_within(u: Dictionary, radius: float) -> Array:
	var out := []
	for o in units:
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
	for o in units:
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
	if float(u["hurt_t"]) < GC.UNIT_HURT_DUR:
		return float(u["hurt_t"])
	if u["state"] == "attacking" and u["path"].is_empty():
		return float(u["swing"])
	return float(u["anim_t"])

func draw_rate(u: Dictionary) -> float:
	var key := String(u["key"])
	if bool(u["ulting"]):
		return maxf(0.05, float(GC.stat(key, "rate")))
	var tgt = get_unit(int(u["target"]))
	if bool(GC.stat(key, "ranged")) and tgt != null and _dist(u, tgt) <= GC.MELEE_SWITCH_RANGE:
		return maxf(0.05, float(GC.stat(key, "melee_rate")))
	return maxf(0.05, float(GC.stat(key, "rate")))
