extends SceneTree
# فحص المواقف الطريفة ومستويات التفصيل — 5.4.4 و 5.4.5 (الدفعة ج)
#   godot --headless --path godot --script tests/test_lod.gd

var failures := 0

class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]
	func walkable(_i: int, _j: int) -> bool:
		return true

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func new_combat() -> Combat:
	return Combat.new(FlatMap.new())

func run(c: Combat, seconds: float, dt: float = 1.0 / 60.0) -> void:
	for i in int(seconds / dt):
		c.step(dt)

func _initialize() -> void:
	_t_numbers()
	_t_corpse_roll()
	_t_corpse_roll_cap()
	_t_corpse_shoves()
	_t_push_into_ally()
	_t_spin_pushes_allies()
	await _t_lod_assignment()
	_t_lod_simple_one_move()
	_t_lod_no_reactions()
	_t_lod_stat_damage()
	await _t_lod_period()
	if failures == 0:
		print("نجح فحص المواقف ومستويات التفصيل: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الأرقام ----------
func _t_numbers() -> void:
	check(GC.SHOVE_ALLY_STAGGER == 0.3, "ترنّح الاصطدام بالحليف ليس 0.3 ث")
	check(GC.CORPSE_ROLLING_MAX == 20, "حد الجثث المتدحرجة ليس 20")
	check(GC.LOD_NEAR == 60, "حد المستوى الكامل ليس 60 وحدة")
	check(GC.LOD_NEAR_CROWDED == 30, "الحد المزدحم ليس 30")
	check(GC.LOD_CROWD == 800, "عتبة الازدحام ليست 800 وحدة")
	check(GC.LOD_EVERY == 0.5, "إعادة حساب المستوى ليست كل نصف ثانية")
	check(GC.LOD_STAT_DMG == 0.85, "ضرر المستوى الإحصائي ليس × 0.85")

# ---------- الجثة تتدحرج بقدر قوة الضربة القاتلة ----------
func _t_corpse_roll() -> void:
	var rolled := {}
	for blow in [10.0, 200.0]:
		var c := new_combat()
		var killer := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		var v := c.spawn("scorp_common", 1, 1, Vector2(6, 5))
		v["hp"] = 1.0
		var from: Vector2 = Vector2(v["pos"])
		c.damage(v, blow, killer, false)
		check(String(v["state"]) == "dead", "لم تمت الوحدة بالضربة")
		run(c, 0.9)
		rolled[blow] = Vector2(v["pos"]).distance_to(from)
	check(float(rolled[10.0]) > 0.01, "الجثة لم تتدحرج إطلاقاً")
	check(float(rolled[200.0]) > float(rolled[10.0]) * 2.0,
		"تدحرج الجثة لا يتناسب مع قوة الضربة (%.2f مقابل %.2f)" % [rolled[200.0], rolled[10.0]])
	check(float(rolled[200.0]) <= GC.CORPSE_ROLL_MAX + 0.2, "تدحرج الجثة تجاوز سقفه")

# ---------- عشرون جثة متدحرجة كحد أقصى، والأقدم يتوقف ----------
func _t_corpse_roll_cap() -> void:
	var c := new_combat()
	var killer := c.spawn("crow_common", 0, 0, Vector2(50, 50))
	for i in 30:
		var v := c.spawn("scorp_common", 1, 1, Vector2(float(i) * 3.0, 5))
		v["hp"] = 1.0
		c.damage(v, 120.0, killer, false)
	var rolling := 0
	for u in c.units:
		if u["state"] == "dead" and Vector2(u["roll"]).length() > 0.01:
			rolling += 1
	check(rolling <= GC.CORPSE_ROLLING_MAX, "%d جثة تتدحرج والحد 20" % rolling)
	check(rolling >= GC.CORPSE_ROLLING_MAX - 1, "توقفت جثث أكثر من اللازم (%d)" % rolling)

# ---------- الجثة تزحزح من في طريقها ----------
func _t_corpse_shoves() -> void:
	var c := new_combat()
	var killer := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var v := c.spawn("scorp_common", 1, 1, Vector2(6, 5))
	var bystander := c.spawn("scorp_common", 1, 1, Vector2(7.2, 5))
	bystander["react"] = 99.0
	var before: Vector2 = Vector2(bystander["pos"])
	v["hp"] = 1.0
	c.damage(v, 200.0, killer, false)
	run(c, 0.5)
	check(Vector2(bystander["pos"]).distance_to(before) > 0.02, "الجثة المتدحرجة لم تزحزح من في طريقها")

# ---------- الارتداد يدفع الوحدة على حليفها فيترنّح الاثنان ----------
func _t_push_into_ally() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var mate := c.spawn("crow_common", 0, 0, Vector2(5.9, 5))
	var src := c.spawn("scorp_common", 1, 1, Vector2(4, 5))
	c._push(a, Vector2(src["pos"]), 0.6)
	check(float(a["stagger_t"]) > 0.0 and float(mate["stagger_t"]) > 0.0,
		"الارتطام بالحليف لم يُرنّح الاثنين")
	check(absf(float(a["stagger_t"]) - GC.SHOVE_ALLY_STAGGER) < 0.001, "مدة الترنّح ليست 0.3 ث")
	# وبلا حليف قريب: لا ترنّح
	var c2 := new_combat()
	var b := c2.spawn("crow_common", 0, 0, Vector2(5, 5))
	var src2 := c2.spawn("scorp_common", 1, 1, Vector2(4, 5))
	c2._push(b, Vector2(src2["pos"]), 0.6)
	check(float(b["stagger_t"]) == 0.0, "ترنّحت الوحدة بلا حليف تصطدم به")

# ---------- الدائرية تدفع الحلفاء بلا ضرر ----------
func _t_spin_pushes_allies() -> void:
	var c := new_combat()
	var sp := c.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	sp["move"] = "spin"
	sp["cycle"] = 1.0
	var mate := c.spawn("hammer_common", 0, 0, Vector2(5.6, 5))
	var foe := c.spawn("scorp_common", 1, 1, Vector2(4.4, 5))
	foe["react"] = 99.0
	var mate_from: Vector2 = Vector2(mate["pos"])
	var mate_hp: float = float(mate["hp"])
	c._land_attack(sp, foe, false)
	check(float(mate["hp"]) == mate_hp, "الدائرية أصابت حليفاً بضرر")
	check(Vector2(mate["pos"]).distance_to(mate_from) > 0.1, "الدائرية لم تدفع الحليف")
	check(float(foe["hp"]) < float(foe["max_hp"]), "الدائرية لم تصب العدو")

# ---------- توزيع المستويات الثلاثة من الكاميرا ----------
func _t_lod_assignment() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 20:
		await process_frame
	g.combat.clear()
	var center: Vector2 = g.world_to_tile(g.cam.position)
	for k in 80:
		g.combat.spawn("crow_common", 0, 0, center + Vector2(float(k % 10) * 0.3 - 1.5, float(k / 10) * 0.3 - 1.0))
	for k in 10:
		g.combat.spawn("crow_common", 0, 0, center + Vector2(200.0 + float(k), 200.0))
	g._lod_t = 0.0
	for i in 3:
		await process_frame
	var full := 0
	var simple := 0
	var stat := 0
	for u in g.combat.units:
		match String(u["lod"]):
			GC.LOD_FULL: full += 1
			GC.LOD_SIMPLE: simple += 1
			GC.LOD_STAT: stat += 1
	check(full == GC.LOD_NEAR, "المستوى الكامل %d وحدة والمطلوب 60" % full)
	check(simple == 20, "المستوى المبسّط %d والمطلوب 20 (باقي ما على الشاشة)" % simple)
	check(stat == 10, "المستوى الإحصائي %d والمطلوب 10 (خارج الشاشة)" % stat)
	# الأقرب للكاميرا هي الكاملة
	var worst_full := 0.0
	var best_simple := 99999.0
	var cen: Vector2 = g._view.position + g._view.size * 0.5
	for u in g.combat.units:
		var d: float = g.tile_to_world(u["pos"]).distance_to(cen)
		if String(u["lod"]) == GC.LOD_FULL:
			worst_full = maxf(worst_full, d)
		elif String(u["lod"]) == GC.LOD_SIMPLE:
			best_simple = minf(best_simple, d)
	check(worst_full <= best_simple + 0.01, "وحدة مبسّطة أقرب للكاميرا من وحدة كاملة")
	g.queue_free()
	await process_frame

# ---------- المبسّط: حركة واحدة فقط ----------
func _t_lod_simple_one_move() -> void:
	var c := new_combat()
	var a := c.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
	c.spawn("scorp_common", 1, 1, Vector2(4.6, 5))
	c.spawn("scorp_common", 1, 1, Vector2(5.0, 5.5))
	a["bold"] = GC.TRAIT_BOLD[1]
	a["lod"] = GC.LOD_SIMPLE
	var seen := {}
	for i in 200:
		seen[c.pick_move(a, b, 0.4, 1.2)] = true
	check(seen.size() == 1 and seen.has("quick"), "المستوى المبسّط لا يقتصر على حركة واحدة")
	# للمقارنة: نفس الوحدة في المستوى الكامل، في موقف متعادل بلا حشد وبلا جرأة زائدة
	var c2 := new_combat()
	var a2 := c2.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b2 := c2.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
	a2["bold"] = 1.0
	a2["lod"] = GC.LOD_FULL
	var seen2 := {}
	for i in 200:
		seen2[c2.pick_move(a2, b2, 0.4, 1.0)] = true
	check(seen2.size() > 1, "المستوى الكامل فقد تنوّع الحركات")

# ---------- المبسّط والإحصائي: بلا تفادٍ، والترنّح يبقى ----------
func _t_lod_no_reactions() -> void:
	for lvl in [GC.LOD_SIMPLE, GC.LOD_STAT]:
		var c := new_combat()
		var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
		var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
		v["face"] = Vector2(1, 0)
		v["react"] = 0.05
		v["lod"] = lvl
		c._warn(v, src, 1.0)
		check(float(v["react_t"]) < 0.0, "وحدة في المستوى %s استعدت للتفادي" % lvl)
		# الترنّح يعمل في كل المستويات
		c._stagger(v, 0.4)
		check(float(v["stagger_t"]) > 0.0, "الترنّح لا يعمل في المستوى %s" % lvl)

# ---------- الإحصائي: ضرر × 0.85 وبلا دورة حركة ----------
func _t_lod_stat_damage() -> void:
	var dealt := {}
	for lvl in [GC.LOD_FULL, GC.LOD_STAT]:
		var c := new_combat()
		var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
		b["hp"] = 100000.0
		b["max_hp"] = 100000.0
		a["react"] = 99.0
		b["react"] = 99.0
		a["lod"] = lvl
		b["lod"] = lvl
		a["move_lock"] = "quick"
		a["scan_t"] = 0.0
		var dt := 1.0 / 60.0
		for i in int(30.0 / dt):
			c.step(dt)
			a["pos"] = Vector2(5, 5)
			b["pos"] = Vector2(5.4, 5)
			a["hp"] = float(a["max_hp"])
			a["lod"] = lvl
			b["lod"] = lvl
		dealt[lvl] = 100000.0 - float(b["hp"])
	check(float(dealt[GC.LOD_STAT]) > 0.0, "المستوى الإحصائي لا يتبادل ضرراً")
	var base := 10.0 / 1.0 * 30.0           # ضرر 10 كل ثانية لثلاثين ثانية
	var ratio: float = float(dealt[GC.LOD_STAT]) / base
	check(absf(ratio - GC.LOD_STAT_DMG) < 0.06,
		"ضرر المستوى الإحصائي %.2f من الأساس والمطلوب 0.85" % ratio)

# ---------- يُعاد الحساب كل نصف ثانية لا كل إطار ----------
func _t_lod_period() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 20:
		await process_frame
	g.combat.clear()
	var center: Vector2 = g.world_to_tile(g.cam.position)
	var u: Dictionary = g.combat.spawn("crow_common", 0, 0, center)
	g._lod_t = 0.0
	for i in 3:
		await process_frame
	check(String(u["lod"]) == GC.LOD_FULL, "الوحدة أمام الكاميرا ليست بالمستوى الكامل")
	# نزيحها خارج الشاشة: لا يتغير مستواها قبل نصف ثانية
	u["pos"] = center + Vector2(300, 300)
	g._lod_t = GC.LOD_EVERY
	for i in 2:
		await process_frame
	check(String(u["lod"]) == GC.LOD_FULL, "أُعيد حساب المستوى قبل موعده")
	g._lod_t = 0.0
	for i in 3:
		await process_frame
	check(String(u["lod"]) == GC.LOD_STAT, "لم يُعد حساب المستوى بعد الموعد")
	g.queue_free()
	await process_frame
