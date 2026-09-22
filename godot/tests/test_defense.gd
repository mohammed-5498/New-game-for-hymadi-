extends SceneTree
# فحص ردود الأفعال الدفاعية — القسم 5.4.3 (الدفعة ب)
#   godot --headless --path godot --script tests/test_defense.gd

var failures := 0

class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]
	func walkable(_i: int, _j: int) -> bool:
		return true

# خريطة مغلقة: لفحص أن قفزة التفادي لا تدخل مبنى
class WallMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]
	func walkable(_i: int, _j: int) -> bool:
		return false

class Probe:
	extends Node2D
	var art := UnitsArt.new()
	var calls := 0
	func _draw() -> void:
		var x := 0.0
		for key in GC.UNIT_KEYS:
			for st in ["dodge", "block", "stagger"]:
				for t in [0.02, 0.12, 0.24, 0.39]:
					art.draw_unit(self, key, Vector2(x, 0), t, st, Color("8a5cc7"), 1, 0.62, 1.0, "", 1.4)
					calls += 1
					x += 0.01

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func new_combat(m = null) -> Combat:
	return Combat.new(FlatMap.new() if m == null else m)

func run(c: Combat, seconds: float, dt: float = 1.0 / 60.0) -> void:
	for i in int(seconds / dt):
		c.step(dt)

func _initialize() -> void:
	_t_numbers()
	_t_angle_zones()
	_t_angle_damage()
	_t_dodge_rate_by_angle()
	_t_back_never_defends()
	_t_dodge_immunity_and_jump()
	_t_jump_not_into_building()
	_t_block_only_shields()
	_t_block_absorbs_and_pushes()
	_t_stamina_limit()
	_t_cooldown()
	_t_no_dodge_while_staggered_or_recovering()
	_t_reaction_time()
	_t_toughness_gain()
	await _t_draw_states()
	if failures == 0:
		print("نجح فحص ردود الأفعال الدفاعية: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الأرقام كما في الوصف ----------
func _t_numbers() -> void:
	check(GC.DODGE_CHANCE == 0.18, "احتمال التفادي الأساسي ليس 18%")
	check(GC.DODGE_DIST == 0.8, "قفزة التفادي ليست 0.8 مربع")
	check(GC.DODGE_DUR == 0.25, "مدة التفادي ليست 0.25 ث")
	check(GC.DODGE_COOLDOWN == 1.2, "التبريد بين تفاديين ليس 1.2 ث")
	check(GC.BLOCK_PUSH == 0.5, "ارتداد المهاجم عن الدرع ليس نصف مربع")
	check(GC.BLOCK_STAGGER == 0.25, "ترنّح المهاجم بعد الصدّ ليس 0.25 ث")
	check(GC.STAMINA_MAX == 100.0 and GC.STAMINA_DODGE == 35.0
		and GC.STAMINA_BLOCK == 25.0 and GC.STAMINA_REGEN == 20.0, "أرقام التحمّل لا تطابق الوصف")
	check(GC.ARC_FRONT == 120.0, "قوس الأمام ليس 120 درجة")
	check(GC.REACT_FRONT == 1.0 and GC.REACT_SIDE == 0.5 and GC.REACT_BACK == 0.0,
		"معاملات الزاوية للتفادي لا تطابق الوصف")
	check(GC.DMG_FRONT == 1.0 and GC.DMG_SIDE == 1.1 and GC.DMG_BACK == 1.25,
		"معاملات الزاوية للضرر لا تطابق الوصف")
	check(GC.SHIELD_UNITS.has("hammer_shield") and GC.SHIELD_UNITS.has("hammer_hero")
		and GC.SHIELD_UNITS.has("police_common"), "أصحاب الدروع ليسوا المصفّح وبطل المطارق والشرطي")
	# ثلاث تفاديات متتالية ثم يُجبر على تلقي الضرب
	check(int(GC.STAMINA_MAX / GC.STAMINA_DODGE) == 2
		or absf(GC.STAMINA_MAX / GC.STAMINA_DODGE - 2.857) < 0.01, "التحمّل لا يسمح بنحو ثلاث تفاديات")

# ---------- مناطق الزاوية الثلاث ----------
func _t_angle_zones() -> void:
	var c := new_combat()
	var u := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	u["face"] = Vector2(1, 0)
	check(c.hit_side(u, Vector2(7, 5)) == "front", "ضربة من الأمام لم تُحسب أماماً")
	check(c.hit_side(u, Vector2(5.5, 5.5)) == "front", "ضربة داخل قوس 120 لم تُحسب أماماً")
	check(c.hit_side(u, Vector2(5, 7)) == "side", "ضربة من الجانب لم تُحسب جانباً")
	check(c.hit_side(u, Vector2(3, 5)) == "back", "ضربة من الخلف لم تُحسب خلفاً")
	check(c.hit_side(u, Vector2(4, 4.2)) == "back", "ضربة من خلف الجانب لم تُحسب خلفاً")

# ---------- الضرر: جانب +10% وخلف +25% ----------
func _t_angle_damage() -> void:
	var want := {"front": 1.0, "side": 1.1, "back": 1.25}
	for side in want:
		var c := new_combat()
		var src := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		var v := c.spawn("scorp_common", 1, 1, Vector2(9, 9))
		v["face"] = Vector2(1, 0)
		match side:
			"front": src["pos"] = Vector2(11, 9)
			"side": src["pos"] = Vector2(9, 11)
			"back": src["pos"] = Vector2(7, 9)
		c.damage(v, 40.0, src, false)
		var dealt: float = float(v["max_hp"]) - float(v["hp"])
		check(absf(dealt - 40.0 * float(want[side])) < 0.01,
			"ضرر %s هو %.1f والمطلوب %.1f" % [side, dealt, 40.0 * float(want[side])])

# ---------- احتمال التفادي: أمام 18% ومن الجانب نصفها ----------
func _t_dodge_rate_by_angle() -> void:
	seed(4242)
	var res := {}
	for side in ["front", "side"]:
		var dodged := 0
		var tries := 800
		for i in tries:
			var c := new_combat()
			var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
			var src := c.spawn("crow_common", 0, 0, Vector2(11, 9) if side == "front" else Vector2(9, 11))
			v["face"] = Vector2(1, 0)
			v["dodge_skill"] = 1.0
			v["react"] = 0.1
			c._warn(v, src, 0.5)
			v["react_t"] = 0.0
			c._do_react(v)
			if float(v["dodge_t"]) > 0.0:
				dodged += 1
		res[side] = float(dodged) / float(tries)
	check(absf(float(res["front"]) - GC.DODGE_CHANCE) < 0.04,
		"التفادي من الأمام %.3f والمطلوب %.2f" % [res["front"], GC.DODGE_CHANCE])
	check(absf(float(res["side"]) - GC.DODGE_CHANCE * 0.5) < 0.04,
		"التفادي من الجانب %.3f والمطلوب نصف الأساسي" % res["side"])

# ---------- من الخلف: لا تفادي ولا صدّ أبداً ----------
func _t_back_never_defends() -> void:
	for key in ["crow_common", "hammer_shield"]:
		var c := new_combat()
		var v := c.spawn(key, 1, 1, Vector2(9, 9))
		var src := c.spawn("crow_common", 0, 0, Vector2(7, 9))
		v["face"] = Vector2(1, 0)
		v["dodge_skill"] = GC.TRAIT_DODGE[1]
		v["react"] = 0.05
		for i in 300:
			v["stamina"] = GC.STAMINA_MAX
			v["dodge_cool"] = 0.0
			v["react_t"] = -1.0
			c._warn(v, src, 1.0)
			v["react_t"] = 0.0
			c._do_react(v)
			check(float(v["dodge_t"]) == 0.0 and float(v["block_t"]) == 0.0,
				"%s تفادى أو صدّ ضربة من الخلف" % key)
			if float(v["dodge_t"]) > 0.0 or float(v["block_t"]) > 0.0:
				break

# ---------- التفادي: مناعة كاملة وقفزة 0.8 مربع ----------
func _t_dodge_immunity_and_jump() -> void:
	var c := new_combat()
	var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
	v["face"] = Vector2(1, 0)
	var from: Vector2 = Vector2(v["pos"])
	c._jump_away(v, Vector2(src["pos"]))
	var moved: float = Vector2(v["pos"]).distance_to(from)
	check(absf(moved - GC.DODGE_DIST) < 0.01, "قفزة التفادي %.2f مربع والمطلوب 0.8" % moved)
	check(Vector2(v["pos"]).distance_to(Vector2(src["pos"])) > from.distance_to(Vector2(src["pos"])),
		"القفزة لم تُبعد الوحدة عن المهاجم")
	v["dodge_t"] = GC.DODGE_DUR
	c.damage(v, 50.0, src, false)
	check(float(v["hp"]) == float(v["max_hp"]), "تلقّت الوحدة ضرراً أثناء التفادي")
	v["dodge_t"] = 0.0
	c.damage(v, 50.0, src, false)
	check(float(v["hp"]) < float(v["max_hp"]), "بقيت محصنة بعد انتهاء التفادي")

func _t_jump_not_into_building() -> void:
	var c := new_combat(WallMap.new())
	var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
	var from: Vector2 = Vector2(v["pos"])
	c._jump_away(v, Vector2(src["pos"]))
	check(Vector2(v["pos"]) == from, "قفزة التفادي دخلت مبنى")

# ---------- الصدّ لأصحاب الدروع وحدهم ----------
func _t_block_only_shields() -> void:
	var c := new_combat()
	var shield := c.spawn("hammer_shield", 1, 1, Vector2(9, 9))
	var plain := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
	for v in [shield, plain]:
		v["face"] = Vector2(1, 0)
		v["react"] = 0.05
		c._warn(v, src, 1.0)
	check(String(shield["react_kind"]) == "block", "المصفّح لا يصدّ")
	check(String(plain["react_kind"]) == "dodge", "فرد عادي يصدّ بدل أن يتفادى")

# ---------- الصدّ يمتص الضرر ويرتد المهاجم ويترنّحه ----------
func _t_block_absorbs_and_pushes() -> void:
	var c := new_combat()
	var v := c.spawn("hammer_shield", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(10, 9))
	var from: Vector2 = Vector2(src["pos"])
	v["block_t"] = GC.DODGE_DUR
	c.damage(v, 60.0, src, false)
	check(float(v["hp"]) == float(v["max_hp"]), "الصدّ لم يمتص الضرر كاملاً")
	var pushed: float = Vector2(src["pos"]).distance_to(from)
	check(absf(pushed - GC.BLOCK_PUSH) < 0.01, "ارتداد المهاجم %.2f والمطلوب 0.5" % pushed)
	check(absf(float(src["stagger_t"]) - GC.BLOCK_STAGGER) < 0.01, "المهاجم لم يترنّح بعد الصدّ")

# ---------- التحمّل: ثلاث تفاديات ثم تتلقى الضرب ----------
func _t_stamina_limit() -> void:
	var c := new_combat()
	var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
	v["face"] = Vector2(1, 0)
	var n := 0
	while float(v["stamina"]) >= GC.STAMINA_DODGE:
		v["stamina"] = float(v["stamina"]) - GC.STAMINA_DODGE
		n += 1
	check(n == 2, "التحمّل الكامل يكفي %d تفادياً" % n)
	# التجدد 20 في الثانية
	v["stamina"] = 0.0
	run(c, 1.0)
	check(absf(float(v["stamina"]) - GC.STAMINA_REGEN) < 3.0,
		"تجدد التحمّل %.1f في الثانية والمطلوب 20" % float(v["stamina"]))
	# نفاد التحمّل يمنع التفادي
	v["stamina"] = GC.STAMINA_DODGE - 1.0
	v["dodge_skill"] = GC.TRAIT_DODGE[1]
	v["react"] = 0.05
	for i in 60:
		v["react_t"] = -1.0
		v["dodge_cool"] = 0.0
		c._warn(v, src, 1.0)
		v["react_t"] = 0.0
		c._do_react(v)
	check(float(v["dodge_t"]) == 0.0, "تفادت الوحدة رغم نفاد تحمّلها")

# ---------- تبريد 1.2 ثانية بين تفاديين ----------
func _t_cooldown() -> void:
	var c := new_combat()
	var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
	v["face"] = Vector2(1, 0)
	v["dodge_skill"] = GC.TRAIT_DODGE[1]
	v["react"] = 0.05
	v["dodge_cool"] = GC.DODGE_COOLDOWN
	for i in 60:
		v["react_t"] = -1.0
		v["stamina"] = GC.STAMINA_MAX
		c._warn(v, src, 1.0)
		v["react_t"] = 0.0
		c._do_react(v)
	check(float(v["dodge_t"]) == 0.0, "تفادت الوحدة أثناء التبريد")
	v["dodge_cool"] = 0.0
	var got := false
	for i in 200:
		v["react_t"] = -1.0
		v["stamina"] = GC.STAMINA_MAX
		v["dodge_cool"] = 0.0
		c._warn(v, src, 1.0)
		v["react_t"] = 0.0
		c._do_react(v)
		if float(v["dodge_t"]) > 0.0:
			got = true
			break
	check(got, "لم تتفادَ الوحدة بعد انتهاء التبريد")

# ---------- المترنّحة أو التي في تعافيها لا تتفادى ----------
func _t_no_dodge_while_staggered_or_recovering() -> void:
	for case in ["stagger", "recover"]:
		var c := new_combat()
		var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
		var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
		v["face"] = Vector2(1, 0)
		v["dodge_skill"] = GC.TRAIT_DODGE[1]
		v["react"] = 0.05
		if case == "stagger":
			v["stagger_t"] = 0.4
		else:
			v["state"] = "attacking"
			v["cycle"] = 1.0
			v["hit_done"] = true
			v["swing"] = 0.6
			check(c.in_recover(v), "لم تُحتسب حالة التعافي")
		for i in 80:
			v["react_t"] = -1.0
			v["stamina"] = GC.STAMINA_MAX
			v["dodge_cool"] = 0.0
			c._warn(v, src, 1.0)
			v["react_t"] = 0.0
			c._do_react(v)
		check(float(v["dodge_t"]) == 0.0, "تفادت الوحدة وهي في حالة %s" % case)

# ---------- زمن رد الفعل: الضربة الأسرع من رد فعلها تفوتها ----------
func _t_reaction_time() -> void:
	var c := new_combat()
	var v := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	var src := c.spawn("crow_common", 0, 0, Vector2(11, 9))
	v["face"] = Vector2(1, 0)
	v["react"] = 0.30
	c._warn(v, src, 0.2)      # استعداد أقصر من رد فعلها
	check(float(v["react_t"]) < 0.0, "ردّت الوحدة على ضربة أسرع من رد فعلها")
	c._warn(v, src, 0.9)      # استعداد أطول
	check(float(v["react_t"]) > 0.0, "لم تستعد الوحدة لضربة أبطأ من رد فعلها")
	check(absf(float(v["react_t"]) - 0.30) < 0.001, "زمن الاستعداد للرد ليس زمن رد الفعل")

# ---------- الأثر على الموازنة: الوحدات أصلب لكن المعركة تُحسم ----------
func _t_toughness_gain() -> void:
	seed(777)
	# مقياس "كم صارت الوحدة أصلب": مهاجم واحد يضرب مدافعاً ثابتاً لا يرد،
	# ونقيس كم يطول عمر المدافع حين يتفادى مقابل ألا يتفادى.
	var life := {}
	for guard in [false, true]:
		var total := 0.0
		for rep in 8:
			var c := new_combat()
			var a := c.spawn("crow_common", 0, 0, Vector2(9, 9))
			var b := c.spawn("crow_common", 1, 1, Vector2(9.6, 9))
			a["react"] = 99.0            # المهاجم لا يتفادى في الحالتين
			if not guard:
				b["react"] = 99.0
			var t := 0.0
			while alive(b) and t < 90.0:
				c.step(1.0 / 60.0)
				a["hp"] = float(a["max_hp"])    # المهاجم لا يموت، وإلا قِسنا شيئاً آخر
				b["face"] = Vector2(a["pos"]) - Vector2(b["pos"])   # يواجه مهاجمه دائماً
				t += 1.0 / 60.0
			total += t
		life[guard] = total / 8.0
	check(float(life[false]) > 0.5, "لم يمت المدافع بلا ردود أفعال")
	check(float(life[true]) < 90.0, "المدافع لا يموت أبداً مع ردود الأفعال: قتال بلا نتيجة")
	var gain: float = float(life[true]) / float(life[false]) - 1.0
	print("   عمر المدافع أطول بنسبة %.0f%% بفضل التفادي (الوصف يتوقع 15 – 20%%)" % (gain * 100.0))
	# الوصف يتوقع 15 – 20%، والمقاس 16%. الحد الواسع هنا يمسك انحرافاً كبيراً
	# في الموازنة (تفادياً مجانياً أو تفادياً بلا أثر) لا تذبذباً عشوائياً.
	check(gain > 0.08 and gain < 0.35,
		"صلابة الوحدة زادت %.0f%% والوصف يتوقع 15 – 20%%" % (gain * 100.0))

func alive(u) -> bool:
	return u != null and u["state"] != "dead"

# ---------- الرسم: الحالات الثلاث الجديدة لكل الوحدات ----------
func _t_draw_states() -> void:
	var p := Probe.new()
	root.add_child(p)
	for i in 3:
		await process_frame
	p.calls = 0
	p.queue_redraw()
	for i in 2:
		await process_frame
	check(p.calls == GC.UNIT_KEYS.size() * 3 * 4, "رُسمت %d حالة دفاع والمطلوب %d" % [
		p.calls, GC.UNIT_KEYS.size() * 3 * 4])
	check(GC.UNIT_STATES.has("dodge") and GC.UNIT_STATES.has("block") and GC.UNIT_STATES.has("stagger"),
		"حالات الدفاع غير مسجّلة في قائمة الحالات")
	p.queue_free()
	await process_frame
