extends SceneTree
# فحص القتال الواقعي — الدفعة أ: بذرة الشخصية والحركات (5.4.1 و 5.4.2)
#   godot --headless --path godot --script tests/test_moves.gd

var failures := 0

# خريطة وهمية: كل المربعات قابلة للمشي، والمسار خط مستقيم
class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]
	func walkable(_i: int, _j: int) -> bool:
		return true

# خريطة مغلقة: لا مربع قابل للمشي، لفحص أن الدفع لا يُدخل الوحدة في مبنى
class WallMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]
	func walkable(_i: int, _j: int) -> bool:
		return false

# رسم كل مفتاح في كل حركة، للتأكد أن لا مسار رسم ينهار
class Probe:
	extends Node2D
	var art := UnitsArt.new()
	var calls := 0
	func _draw() -> void:
		var x := 0.0
		for key in GC.UNIT_KEYS:
			for mv in GC.MOVE_ORDER:
				for t in [0.05, 0.3, 0.55, 0.9]:
					art.draw_unit(self, key, Vector2(x, 0), t, "attack",
						Color("8a5cc7"), 1, 0.62, 1.0, mv)
					calls += 1
					x += 0.01

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func new_combat(m = null) -> Combat:
	return Combat.new(FlatMap.new() if m == null else m)

# تعطيل ردود الأفعال الدفاعية (5.4.3) عند قياس الحركات وحدها
func no_react(u: Dictionary) -> void:
	u["react"] = 99.0

func run(c: Combat, seconds: float, dt: float = 1.0 / 30.0) -> void:
	for i in int(seconds / dt):
		c.step(dt)

func _initialize() -> void:
	_t_numbers()
	_t_seed_traits()
	_t_cycle_length()
	_t_dps_matches_spec()
	_t_pick_situations()
	_t_pick_boldness()
	_t_pick_variety()
	_t_spin_limited()
	_t_stagger_and_push()
	_t_spin_hits_around()
	_t_thrust_reach()
	_t_ranged_untouched()
	await _t_draw_moves()
	if failures == 0:
		print("نجح فحص القتال الواقعي (الدفعة أ): لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الأرقام كما في جدولي 5.4.1 و 5.4.2 ----------
func _t_numbers() -> void:
	check(GC.TRAIT_BOLD == [0.7, 1.3], "مدى الجرأة ليس 0.7 – 1.3")
	check(GC.TRAIT_DODGE == [0.7, 1.3], "مدى مهارة التفادي ليس 0.7 – 1.3")
	check(GC.TRAIT_REACT == [0.10, 0.35], "مدى زمن رد الفعل ليس 0.10 – 0.35")
	check(GC.TRAIT_SPEED_VAR == 0.07, "تنويع السرعة ليس ±7%")
	check(GC.TRAIT_SIZE_VAR == 0.04, "تنويع الحجم ليس ±4%")
	var want := {
		"quick":  [0.18, 0.25, 0.7],
		"heavy":  [0.45, 0.55, 1.6],
		"thrust": [0.30, 0.35, 1.0],
		"spin":   [0.50, 0.60, 0.8],
	}
	for k in want:
		var m: Dictionary = GC.MOVES[k]
		check(is_equal_approx(float(m["wind"]), float(want[k][0])), "استعداد %s خطأ" % k)
		check(is_equal_approx(float(m["recover"]), float(want[k][1])), "تعافي %s خطأ" % k)
		check(is_equal_approx(float(m["dmg"]), float(want[k][2])), "ضرر %s خطأ" % k)
	check(is_equal_approx(float(GC.MOVES["thrust"]["reach"]), 0.6), "الطعنة لا تزيد المدى 0.6")
	check(is_equal_approx(float(GC.MOVES["heavy"]["stagger"]), 0.4), "القوية لا تُرنّح 0.4 ث")
	check(is_equal_approx(float(GC.MOVES["heavy"]["push"]), 0.5), "القوية لا تدفع نصف مربع")
	check(bool(GC.MOVES["spin"]["around"]), "الدائرية لا تصيب ما حول الوحدة")
	check(GC.MOVE_RANDOM == 0.15, "العشوائية على النقاط ليست 15%")

# ---------- البذرة: نفس البذرة = نفس الشخصية، وبذرتان مختلفتان = شخصيتان ----------
func _t_seed_traits() -> void:
	var a: Dictionary = Combat._traits(12345)
	var b: Dictionary = Combat._traits(12345)
	var c: Dictionary = Combat._traits(999)
	check(a == b, "نفس البذرة أعطت شخصيتين مختلفتين")
	check(a != c, "بذرتان مختلفتان أعطتا نفس الشخصية بالضبط")
	var cb := new_combat()
	var seen_bold := {}
	for i in 200:
		var u := cb.spawn("crow_common", 0, 0, Vector2.ZERO)
		var bold: float = float(u["bold"])
		check(bold >= GC.TRAIT_BOLD[0] and bold <= GC.TRAIT_BOLD[1], "الجرأة خارج مداها")
		check(float(u["dodge_skill"]) >= GC.TRAIT_DODGE[0] and float(u["dodge_skill"]) <= GC.TRAIT_DODGE[1],
			"مهارة التفادي خارج مداها")
		check(float(u["react"]) >= GC.TRAIT_REACT[0] and float(u["react"]) <= GC.TRAIT_REACT[1],
			"زمن رد الفعل خارج مداه")
		check(absf(float(u["spd_var"]) - 1.0) <= GC.TRAIT_SPEED_VAR + 0.0001, "تنويع السرعة تجاوز ±7%")
		check(absf(float(u["size"]) - 1.0) <= GC.TRAIT_SIZE_VAR + 0.0001, "تنويع الحجم تجاوز ±4%")
		seen_bold[snappedf(bold, 0.05)] = true
	check(seen_bold.size() > 5, "الجرأة لا تتنوع بين الأفراد")
	# التنويع يصل فعلاً إلى سرعة المشي
	var u1 := cb.spawn("crow_common", 0, 0, Vector2.ZERO)
	u1["spd_var"] = 1.07
	var u2 := cb.spawn("crow_common", 0, 0, Vector2.ZERO)
	u2["spd_var"] = 0.93
	check(cb.speed_of(u1) > cb.speed_of(u2), "تنويع السرعة لا يؤثر في الحركة")

# ---------- طول الدورة = (استعداد + تعافٍ) × زمن ضربة الوحدة × 1.6 ----------
func _t_cycle_length() -> void:
	for mv in ["quick", "heavy", "thrust"]:
		var c := new_combat()
		var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))   # زمن ضربة 1.0
		var b := c.spawn("scorp_common", 1, 1, Vector2(5.5, 5))
		b["hp"] = 100000.0
		b["max_hp"] = 100000.0
		a["move_lock"] = mv
		a["scan_t"] = 0.0
		no_react(a)
		no_react(b)
		run(c, 0.2, 0.01)
		var spec: Dictionary = GC.MOVES[mv]
		var want: float = (float(spec["wind"]) + float(spec["recover"])) * GC.MOVE_CYCLE_SCALE
		check(absf(float(a["cycle"]) - want) < 0.001,
			"دورة %s هي %.3f والمطلوب %.3f" % [mv, float(a["cycle"]), want])
		check(is_equal_approx(c.draw_rate(a), float(a["cycle"])), "زمن الرسم لا يطابق دورة الحركة")

# ---------- الضرر في الثانية يبقى مطابقاً لأرقام القسم 6 ----------
func _t_dps_matches_spec() -> void:
	var base := 10.0 / 1.0          # crow_common: ضرر 10، زمن ضربة 1.0
	for mv in ["quick", "heavy", "thrust"]:
		var c := new_combat()
		var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
		b["hp"] = 1000000.0
		b["max_hp"] = 1000000.0
		a["move_lock"] = mv
		a["scan_t"] = 0.0
		no_react(a)                         # قفزة التفادي تُبعد المهاجم فتضيع ضربته
		no_react(b)                         # القياس للإيقاع، والتفادي له فحصه (5.4.3)
		b["move_lock"] = "quick"            # حتى لا يدفع المهاجم ولا يُرنّحه فيختل القياس
		var dt := 1.0 / 60.0
		for i in int(60.0 / dt):
			c.step(dt)
			# الموقعان ثابتان حتى يكون القياس للإيقاع وحده لا للحركة
			a["pos"] = Vector2(5, 5)
			b["pos"] = Vector2(5.4, 5)
			b["path"] = []
			a["path"] = []
			a["hp"] = float(a["max_hp"])
			a["stagger_t"] = 0.0
		var dps: float = (1000000.0 - float(b["hp"])) / 60.0
		check(absf(dps / base - 1.0) < 0.06,
			"الحركة %s تعطي %.2f ضرر/ث والمطلوب نحو %.2f" % [mv, dps, base])

# ---------- نظام النقاط: كل موقف يرجّح حركته ----------
func _t_pick_situations() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.5, 5))
	a["bold"] = 1.0
	var reach: float = float(GC.stat("crow_common", "range"))

	# هدف في زمن تعافٍ: القوية هي الغالبة
	b["state"] = "attacking"
	b["cycle"] = 1.0
	b["hit_done"] = true
	b["swing"] = 0.5
	check(c.in_recover(b), "لم تُحتسب حالة التعافي للهدف")
	check(_share(c, a, b, 0.4, reach, "heavy") > 0.9, "لم تُرجَّح القوية على هدف في تعافيه")

	# هدف غير متعافٍ وقريب: القوية والسريعة متقاربتان ولا تسيطر الطعنة
	b["hit_done"] = false
	b["cycle"] = 0.0
	b["state"] = "idle"
	check(_share(c, a, b, 0.4, reach, "thrust") < 0.2, "الطعنة تُختار لهدف قريب")

	# هدف عند حافة المدى: الطعنة
	check(_share(c, a, b, reach * 0.95, reach, "thrust") > 0.8, "لم تُرجَّح الطعنة لهدف بعيد قليلاً")

	# دم منخفض: السريعة
	a["hp"] = float(a["max_hp"]) * 0.2
	check(_share(c, a, b, 0.4, reach, "quick") > 0.8, "لم تُرجَّح السريعة عند الدم المنخفض")
	a["hp"] = float(a["max_hp"])

	# ثلاثة أعداء حول محطِّم: الدائرية
	var c2 := new_combat()
	var br := c2.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	br["bold"] = 1.0
	var t0 := c2.spawn("scorp_common", 1, 1, Vector2(5.6, 5))
	c2.spawn("scorp_common", 1, 1, Vector2(4.4, 5))
	c2.spawn("scorp_common", 1, 1, Vector2(5.0, 5.6))
	var rb: float = float(GC.stat("hammer_breaker", "range"))
	check(_share(c2, br, t0, 0.6, rb, "spin") > 0.8, "لم تُرجَّح الدائرية مع ثلاثة أعداء")

# نسبة اختيار حركة بعينها في موقف ثابت
func _share(c: Combat, u: Dictionary, tgt: Dictionary, d: float, reach: float, mv: String) -> float:
	var hits := 0
	for i in 400:
		if c.pick_move(u, tgt, d, reach) == mv:
			hits += 1
	return float(hits) / 400.0

# ---------- الجرأة ترفع نصيب القوية ----------
func _t_pick_boldness() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
	var reach: float = float(GC.stat("crow_common", "range"))
	a["bold"] = GC.TRAIT_BOLD[1]
	var bold_share := _share(c, a, b, 0.4, reach, "heavy")
	a["bold"] = GC.TRAIT_BOLD[0]
	var shy_share := _share(c, a, b, 0.4, reach, "heavy")
	check(bold_share > shy_share + 0.3,
		"الجرأة لم ترفع نصيب القوية (%.2f مقابل %.2f)" % [bold_share, shy_share])

# ---------- العشوائية 15%: نفس الموقف لا يعطي نفس الحركة دائماً ----------
func _t_pick_variety() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
	a["bold"] = 1.0
	var seen := {}
	for i in 400:
		seen[c.pick_move(a, b, 0.4, 1.0)] = true
	check(seen.size() >= 2, "الاختيار آلي مكشوف: حركة واحدة في موقف متعادل")

# ---------- الدائرية للمحطِّم والأبطال فقط ----------
func _t_spin_limited() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
	c.spawn("scorp_common", 1, 1, Vector2(4.6, 5))
	c.spawn("scorp_common", 1, 1, Vector2(5.0, 5.5))
	a["bold"] = GC.TRAIT_BOLD[1]
	check(_share(c, a, b, 0.4, 1.0, "spin") == 0.0, "فرد عادي اختار الحركة الدائرية")
	for k in GC.SPIN_UNITS:
		check(GC.UNIT_STATS.has(k), "وحدة الدائرية %s غير موجودة" % k)
	check(GC.SPIN_UNITS.size() == 5, "الدائرية ليست للمحطِّم والأبطال الأربعة فقط")

# ---------- القوية تُرنّح وتدفع، والمترنّح لا يضرب ----------
func _t_stagger_and_push() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("hammer_shield", 1, 1, Vector2(5.6, 5))   # دم كبير فلا يموت
	a["move_lock"] = "heavy"
	a["scan_t"] = 0.0
	no_react(a)
	no_react(b)                # المصفّح صاحب درع: صدّه له فحصه في test_defense
	b["move_lock"] = "quick"
	# القوية لـ crow_common: دورة 1.6 ث والضرر عند 0.72 ث، فنفحص بعدها بقليل.
	# نقيس قفزة الدفع نفسها لا الإزاحة الكلية: الهدف يزحف نحو مهاجمه قبل الضربة
	# (مسافة الاقتحام، 5.4.1) فتبتلع الإزاحةُ الكلية جزءاً من الدفع ويصير القياس
	# معتمداً على جرأة الهدف العشوائية.
	var push: float = float(GC.MOVES["heavy"]["push"])
	var jump := 0.0
	var prev: float = float(b["pos"].x)
	for i in 80:
		run(c, 0.01, 0.01)
		jump = maxf(jump, float(b["pos"].x) - prev)
		prev = float(b["pos"].x)
	check(float(b["stagger_t"]) > 0.0, "الضربة القوية لم تُرنّح الهدف")
	check(jump > push * 0.9, "الضربة القوية دفعت الهدف %.2f والمطلوب %.2f" % [jump, push])
	# المترنّح لا يبدأ دورة ضرب
	b["stagger_t"] = 0.4
	b["swing"] = 0.0
	b["cycle"] = 0.0
	var hp0: float = float(a["hp"])
	run(c, 0.3, 0.01)
	check(float(a["hp"]) == hp0, "وحدة مترنّحة ضربت رغم الترنّح")
	# الدفع لا يُدخل الوحدة في مبنى
	var w := new_combat(WallMap.new())
	var wa := w.spawn("crow_common", 0, 0, Vector2(5, 5))
	var wb := w.spawn("hammer_shield", 1, 1, Vector2(5.6, 5))
	wa["move_lock"] = "heavy"
	wa["scan_t"] = 0.0
	no_react(wa)
	no_react(wb)
	var wx: Vector2 = Vector2(wb["pos"])
	run(w, 0.8, 0.01)
	check(Vector2(wb["pos"]) == wx, "الدفع أدخل الوحدة في مبنى")
	check(float(wb["stagger_t"]) > 0.0, "الترنّح لم يقع رغم أن الدفع ممنوع")

# ---------- الدائرية تصيب كل من حول الوحدة ----------
func _t_spin_hits_around() -> void:
	var c := new_combat()
	var a := c.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	a["move_lock"] = "spin"
	a["scan_t"] = 0.0
	no_react(a)
	var front := c.spawn("hammer_shield", 1, 1, Vector2(5.9, 5))
	var back := c.spawn("hammer_shield", 1, 1, Vector2(4.1, 5))
	no_react(front)
	no_react(back)
	run(c, 2.2, 0.01)
	check(float(front["hp"]) < float(front["max_hp"]), "الدائرية لم تصب الهدف أمامها")
	check(float(back["hp"]) < float(back["max_hp"]), "الدائرية لم تصب العدو خلفها")

	# الحليف لا يُصاب. نستدعي الضربة وحدها حتى لا يضربه عدو آخر فيختلط السبب.
	var c2 := new_combat()
	var sp := c2.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	sp["move"] = "spin"
	sp["cycle"] = 1.0
	var mate := c2.spawn("hammer_shield", 0, 0, Vector2(5, 5.5))
	var foe := c2.spawn("hammer_shield", 1, 1, Vector2(5.5, 5))
	c2._land_attack(sp, foe, false)
	check(float(mate["hp"]) == float(mate["max_hp"]), "الدائرية أصابت حليفاً")
	check(float(foe["hp"]) < float(foe["max_hp"]), "الدائرية لم تصب العدو الملاصق")

# ---------- الطعنة تصل أبعد بـ 0.6 مربع ----------
func _t_thrust_reach() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("hammer_shield", 1, 1, Vector2(6.5, 5))   # خارج المدى 1.0 وداخل 1.6
	no_react(a)
	no_react(b)
	a["move_lock"] = "thrust"
	a["scan_t"] = 0.0
	a["cycle"] = 1.0                       # دورة جاهزة حتى لا يتحرك أولاً
	a["move"] = "thrust"
	a["hit_done"] = false
	a["swing"] = 0.0
	var before := float(b["hp"])
	c._land_attack(a, b, false)
	check(float(b["hp"]) < before, "الطعنة لم تصل هدفاً على 1.5 مربع")
	# نفس المسافة بالحركة السريعة: تمر في الهواء
	var b2 := c.spawn("hammer_shield", 1, 1, Vector2(6.5, 5))
	no_react(b2)
	a["move"] = "quick"
	var before2 := float(b2["hp"])
	c._land_attack(a, b2, false)
	check(float(b2["hp"]) == before2, "السريعة أصابت هدفاً خارج مداها")

# ---------- الرماية من بعيد لم تتغير ----------
func _t_ranged_untouched() -> void:
	var c := new_combat()
	var a := c.spawn("viper_sniper", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(10, 5))
	b["hp"] = 100000.0
	b["max_hp"] = 100000.0
	a["scan_t"] = 0.0
	check(not c.uses_moves(a, false), "الرامي من بعيد دخل نظام حركات الالتحام")
	check(c.uses_moves(a, true), "الرامي في الالتحام لم يدخل نظام الحركات")
	var shots := 0
	var dt := 1.0 / 30.0
	for i in int(20.0 / dt):
		c.step(dt)
		b["pos"] = Vector2(10, 5)
		shots += c.projectiles.size()
	check(float(a["cycle"]) == 0.0, "الرامي من بعيد بدأ دورة حركة التحام")
	check(shots > 0, "الرامي لم يطلق شيئاً")

# ---------- الرسم: كل وحدة في كل حركة ----------
func _t_draw_moves() -> void:
	var p := Probe.new()
	root.add_child(p)
	for i in 3:
		await process_frame
	p.calls = 0
	p.queue_redraw()
	for i in 2:
		await process_frame
	var expected: int = GC.UNIT_KEYS.size() * GC.MOVE_ORDER.size() * 4
	check(p.calls == expected, "رُسمت %d حالة حركة والمطلوب %d" % [p.calls, expected])
	p.queue_free()
	await process_frame
