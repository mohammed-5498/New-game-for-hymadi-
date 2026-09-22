class_name Bot
extends RefCounted
# بوت لاعب واحد — القسم 11 من docs/GAME_SPEC.md
# الأولويات بالترتيب: الدفاع ثم التوسع ثم الهجوم. ويحترم التحالفات.

var player := 1
var difficulty := GC.BOT_DIFFICULTY_DEFAULT
var think_t := 0.0
var last_goal := {}      # رقم الوحدة -> وجهتها الحالية، لتفادي إعادة إصدار الأمر كل دورة

func setup(p: int, diff: String) -> void:
	player = p
	difficulty = diff if GC.DIFFICULTIES.has(diff) else GC.BOT_DIFFICULTY_DEFAULT
	think_t = randf() * think_every()   # توزيع تفكير البوتات على الزمن
	last_goal = {}

func think_every() -> float:
	return float(GC.BOT_THINK.get(difficulty, 2.0))

func group_size() -> int:
	return int(GC.BOT_GROUP.get(difficulty, 4))

func attack_min() -> int:
	return int(GC.BOT_ATTACK_MIN.get(difficulty, 7))

func police_min_army() -> int:
	return int(GC.BOT_POLICE_MIN_ARMY.get(difficulty, 8))

# ============================ الدورة ============================
func step(delta: float, combat: Combat, ds: Districts, districts: Array) -> void:
	think_t -= delta
	if think_t > 0.0:
		return
	think_t = think_every()
	_think(combat, ds, districts)

func _think(combat: Combat, ds: Districts, districts: Array) -> void:
	var army := _my_units(combat)
	if army.is_empty():
		return

	# الصعب يسحب المصابين إلى المستشفى إن امتلكه
	var free := army
	if difficulty == "hard":
		free = _retreat_wounded(combat, districts, army)

	# 1. الدفاع: حي مملوك مهدَّد
	var threat := _threatened_district(combat, ds, districts)
	if threat.x != INF:
		var defenders := _closest(free, threat, group_size())
		_send(combat, defenders, threat, true)
		free = _without(free, defenders)

	# 2. التوسع: أقرب حي محايد، والمميز له أولوية
	var neutral := _best_neutral(combat, ds, districts, free, army.size())
	if neutral.x != INF and not free.is_empty():
		var takers := _closest(free, neutral, group_size())
		_send(combat, takers, neutral, true)
		free = _without(free, takers)

	# 3. الهجوم: عندما يصبح الجيش كافياً
	if army.size() >= attack_min() and not free.is_empty():
		var target := _attack_target(combat, ds, districts, free)
		if target.x != INF:
			var force: Array = free if difficulty == "hard" else _closest(free, target, group_size())
			_send(combat, force, target, true)

# ============================ الأهداف ============================
# حي مملوك فيه عدو قريب من ساحته
func _threatened_district(combat: Combat, ds: Districts, districts: Array) -> Vector2:
	var best := Vector2.INF
	var bd := 1e9
	for d in districts:
		if int(d["owner"]) != player or Vector2i(d["cap"]).x < 0:
			continue
		var cap := Vector2(d["cap"])
		for u in combat.units:
			if u["state"] == "dead" or not _enemy_of_me(combat, u):
				continue
			var dist: float = Vector2(u["pos"]).distance_to(cap)
			if dist <= GC.BOT_DEFEND_RADIUS and dist < bd:
				bd = dist
				best = cap
	return best

# أقرب حي محايد، والمميز أولاً، مع احترام قاعدة الشرطة حسب الصعوبة
func _best_neutral(combat: Combat, _ds: Districts, districts: Array, free: Array, army: int) -> Vector2:
	var home := _center_of(free)
	if home == Vector2.INF:
		return Vector2.INF
	var best := Vector2.INF
	var best_score := -1e9
	for d in districts:
		if int(d["owner"]) >= 0 or Vector2i(d["cap"]).x < 0:
			continue
		if not _police_ok(d, army):
			continue
		var cap := Vector2(d["cap"])
		var score: float = -cap.distance_to(home)
		if String(d["special"]) != "":
			score += 12.0          # الأحياء المميزة لها أولوية
		if String(d["type"]) == "police" and difficulty == "hard":
			score += 16.0          # الصعب يستهدف مراكز الشرطة مبكراً لمكافأة الدرع
		if score > best_score:
			best_score = score
			best = cap
	return best

# هدف الهجوم: المتصدر إن تحققت قاعدة القسم 9، وإلا الأقرب والأضعف
func _attack_target(combat: Combat, ds: Districts, districts: Array, free: Array) -> Vector2:
	var home := _center_of(free)
	if home == Vector2.INF:
		return Vector2.INF
	# قاعدة القسم 9: من ملك 40% من الأحياء يصير الهدف الأول، لا مجرد أفضلية
	var leader: int = ds.leader()
	if leader >= 0 and _enemy_player(combat, leader):
		var on_leader := _best_enemy_cap(combat, districts, home, leader)
		if on_leader != Vector2.INF:
			return on_leader
	return _best_enemy_cap(combat, districts, home, -1)

# أقرب وأضعف حي عدو. only_player >= 0 يحصر البحث في أحياء لاعب بعينه
func _best_enemy_cap(combat: Combat, districts: Array, home: Vector2, only_player: int) -> Vector2:
	var best := Vector2.INF
	var best_score := -1e9
	for d in districts:
		var owner: int = int(d["owner"])
		if owner < 0 or Vector2i(d["cap"]).x < 0:
			continue
		if only_player >= 0 and owner != only_player:
			continue
		if not _enemy_player(combat, owner):
			continue           # البوتات تحترم التحالفات
		var cap := Vector2(d["cap"])
		var score: float = -cap.distance_to(home) - float(_defenders_near(combat, cap)) * 3.0
		if score > best_score:
			best_score = score
			best = cap
	return best

func _defenders_near(combat: Combat, cap: Vector2) -> int:
	var c := 0
	for u in combat.units:
		if u["state"] == "dead" or int(u["player"]) < 0:
			continue
		if not _enemy_of_me(combat, u):
			continue
		if Vector2(u["pos"]).distance_to(cap) <= GC.BOT_DEFEND_RADIUS:
			c += 1
	return c

# السهل يتجنب أحياء الشرطة تماماً، والمتوسط من 8 وحدات، والصعب دائماً
func _police_ok(d: Dictionary, army: int) -> bool:
	if String(d["type"]) != "police":
		return true
	return army >= police_min_army()

# ============================ الأوامر ============================
func _send(combat: Combat, units: Array, goal: Vector2, attack_move: bool) -> void:
	for u in units:
		var id: int = int(u["id"])
		var prev: Vector2 = last_goal.get(id, Vector2.INF)
		var busy: bool = String(u["state"]) == "attacking"
		# لا نقاطع وحدة تقاتل، ولا نكرر نفس الأمر كل دورة
		if busy:
			continue
		if prev != Vector2.INF and prev.distance_to(goal) < GC.BOT_REORDER_DIST and not u["path"].is_empty():
			continue
		var dest := goal
		# الصعب يضع القناص والرماة خلف المقاتلين
		if difficulty == "hard" and bool(GC.stat(u["key"], "ranged")):
			var back: Vector2 = (Vector2(u["pos"]) - goal).normalized() * GC.BOT_BACKLINE
			dest = goal + back
		last_goal[id] = goal
		combat.order_move([u], dest, attack_move)

# الصعب يسحب المصابين إلى المستشفى إن امتلكه، ويرجع بقية الوحدات
func _retreat_wounded(combat: Combat, districts: Array, army: Array) -> Array:
	var hospital := Vector2.INF
	for d in districts:
		if String(d["special"]) == "hospital" and int(d["owner"]) == player and Vector2i(d["cap"]).x >= 0:
			hospital = Vector2(d["cap"])
			break
	if hospital == Vector2.INF:
		return army
	var rest := []
	for u in army:
		if float(u["hp"]) / maxf(1.0, float(u["max_hp"])) < GC.BOT_RETREAT_HP:
			_send(combat, [u], hospital, false)
		else:
			rest.append(u)
	return rest

# ============================ أدوات ============================
func _my_units(combat: Combat) -> Array:
	var out := []
	for u in combat.units:
		if u["state"] != "dead" and int(u["player"]) == player:
			out.append(u)
	return out

func _enemy_of_me(combat: Combat, u: Dictionary) -> bool:
	if int(u["player"]) < 0:
		return true    # الشرطة معادية للجميع
	return _enemy_player(combat, int(u["player"]))

func _enemy_player(combat: Combat, other: int) -> bool:
	if other == player:
		return false
	return int(combat.team_of_player(other)) != int(combat.team_of_player(player))

func _center_of(units: Array) -> Vector2:
	if units.is_empty():
		return Vector2.INF
	var sum := Vector2.ZERO
	for u in units:
		sum += Vector2(u["pos"])
	return sum / float(units.size())

func _closest(units: Array, goal: Vector2, count: int) -> Array:
	var sorted := units.duplicate()
	sorted.sort_custom(func(a, b):
		return Vector2(a["pos"]).distance_to(goal) < Vector2(b["pos"]).distance_to(goal))
	var out := []
	for i in mini(count, sorted.size()):
		out.append(sorted[i])
	return out

func _without(units: Array, taken: Array) -> Array:
	var ids := {}
	for t in taken:
		ids[int(t["id"])] = true
	var out := []
	for u in units:
		if not ids.has(int(u["id"])):
			out.append(u)
	return out
