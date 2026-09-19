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
		_step_unit(u, delta)
	_step_projectiles(delta)
	_reap()

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

	if tgt != null:
		_fight(u, tgt, delta)
	else:
		if u["state"] == "attacking":
			u["state"] = "idle"
			u["swing"] = 0.0
		_advance(u, delta)

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

func _land_attack(u: Dictionary, tgt: Dictionary, melee_now: bool) -> void:
	var key := String(u["key"])
	var dmg: float = float(GC.stat(key, "melee_dmg")) if melee_now else float(GC.stat(key, "dmg"))
	if bool(GC.stat(key, "ranged")) and not melee_now:
		var shots: int = int(GC.stat(key, "shots")) if GC.UNIT_STATS.get(key, {}).has("shots") else 1
		for i in maxi(1, shots):
			_fire(u, tgt, dmg, String(GC.stat(key, "proj")), float(i - (shots - 1) * 0.5) * 0.18)
		return
	damage(tgt, dmg, u, false)

# مقذوف يطير 0.3 – 0.5 ثانية (5.3)
func _fire(u: Dictionary, tgt: Dictionary, dmg: float, kind: String, spread: float) -> void:
	var d: float = _dist(u, tgt)
	projectiles.append({
		"pos": u["pos"], "from": u["pos"], "target": int(tgt["id"]),
		"t": 0.0, "dur": clampf(d / GC.PROJ_SPEED, GC.PROJ_MIN_TIME, GC.PROJ_MAX_TIME),
		"dmg": dmg, "player": int(u["player"]), "owner": int(u["id"]),
		"kind": kind, "spread": spread, "spin": randf() * TAU,
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
		if alive(tgt):
			damage(tgt, float(p["dmg"]), get_unit(int(p["owner"])), false)
	projectiles = keep

# الضرر يمر من هنا دائماً: يطبّق الدرع، ويشعل الوميض، ويبلّغ الخارج
func damage(tgt: Dictionary, amount: float, src, is_ult: bool) -> void:
	if not alive(tgt):
		return
	if src != null and not _hostile(src, tgt):
		return   # لا ضرر على الحلفاء ولا على وحدات نفس اللاعب (5.2)
	var armor: float = GC.stat(tgt["key"], "armor")
	var dealt: float = amount * (1.0 - armor)
	tgt["hp"] -= dealt
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
	var speed: float = GC.stat(u["key"], "speed")
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
	if float(u["hurt_t"]) < GC.UNIT_HURT_DUR:
		return float(u["hurt_t"])
	if u["state"] == "attacking" and u["path"].is_empty():
		return float(u["swing"])
	return float(u["anim_t"])

func draw_rate(u: Dictionary) -> float:
	var key := String(u["key"])
	var tgt = get_unit(int(u["target"]))
	if bool(GC.stat(key, "ranged")) and tgt != null and _dist(u, tgt) <= GC.MELEE_SWITCH_RANGE:
		return maxf(0.05, float(GC.stat(key, "melee_rate")))
	return maxf(0.05, float(GC.stat(key, "rate")))
