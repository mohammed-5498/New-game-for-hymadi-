extends SceneTree
# فحص محرك القتال بلا شاشة — الأقسام 5.1 و 5.2 و 5.3
#   godot --headless --path godot --script tests/test_combat.gd

var failures := 0

# خريطة وهمية: كل المربعات قابلة للمشي، والمسار خط مستقيم
class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func run(c: Combat, seconds: float, dt: float = 1.0 / 30.0) -> void:
	var steps := int(seconds / dt)
	for i in steps:
		c.step(dt)

func new_combat() -> Combat:
	return Combat.new(FlatMap.new())

# تعطيل ردود الأفعال الدفاعية (5.4.3) عند قياس شيء آخر:
# رد فعل أبطأ من أي استعداد يعني أن الوحدة لا ترى الضربة أصلاً.
func no_react(u: Dictionary) -> void:
	u["react"] = 99.0

func _initialize() -> void:
	_t_basic_kill()
	_t_no_friendly_fire()
	_t_armor()
	_t_hit_timing()
	_t_chase_limit()
	_t_moving_does_not_retaliate()
	_t_target_stickiness()
	_t_projectile()
	_t_melee_switch()
	_t_death_cleanup()
	_t_attack_order_ignores_chase_limit()
	_t_attack_move_engages()
	if failures == 0:
		print("نجح فحص القتال: لا أخطاء.")
	else:
		printerr("فشل فحص القتال: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# عدوان متلاصقان: يجب أن يقتل أحدهما الآخر
func _t_basic_kill() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.5, 5))
	run(c, 14.0)
	check(a["hp"] < a["max_hp"] or b["hp"] < b["max_hp"], "لم يقع أي ضرر بين عدوين متلاصقين")
	check(b["state"] == "dead" or a["state"] == "dead", "لم يمت أحد بعد 14 ثانية من القتال")

# لا ضرر على وحدات نفس اللاعب ولا على الحلفاء
func _t_no_friendly_fire() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("crow_common", 0, 0, Vector2(5.4, 5))
	run(c, 6.0)
	check(a["hp"] == a["max_hp"] and b["hp"] == b["max_hp"], "وحدتان لنفس اللاعب تضاربتا")

	var c2 := new_combat()
	var x := c2.spawn("crow_common", 0, 7, Vector2(5, 5))
	var y := c2.spawn("hammer_common", 1, 7, Vector2(5.4, 5))   # نفس الفريق
	run(c2, 6.0)
	check(x["hp"] == x["max_hp"] and y["hp"] == y["max_hp"], "حليفان في نفس الفريق تضاربا")

# الدرع يخفّض الضرر بنسبته
func _t_armor() -> void:
	var c := new_combat()
	var src := c.spawn("crow_common", 0, 0, Vector2(0, 0))
	var plain := c.spawn("scorp_common", 1, 1, Vector2(9, 9))     # درع 0%
	var armored := c.spawn("hammer_shield", 1, 1, Vector2(9, 9))  # درع 50%
	# ضربة من الأمام تماماً: قاعدة الزاوية (5.4.3) لها فحصها المستقل، والمقصود هنا الدرع
	var face: Vector2 = (Vector2(src["pos"]) - Vector2(9, 9)).normalized()
	plain["face"] = face
	armored["face"] = face
	c.damage(plain, 100.0, src, false)
	c.damage(armored, 100.0, src, false)
	check(is_equal_approx(float(plain["hp"]), float(plain["max_hp"]) - 100.0), "الدرع 0% لم يطبَّق صحيحاً")
	check(is_equal_approx(float(armored["hp"]), float(armored["max_hp"]) - 50.0), "الدرع 50% لم يخفّض الضرر للنصف")

# لحظة الضرر في الالتحام = نهاية استعداد الحركة المختارة (5.4.2)،
# وفي الرماية من بعيد تبقى عند 47% من زمن الضربة (5.2)
func _t_hit_timing() -> void:
	for mv in ["quick", "heavy", "thrust"]:
		var c := new_combat()
		var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))   # زمن ضربة 1.0 ث
		var b := c.spawn("scorp_common", 1, 1, Vector2(5.5, 5))
		a["move_lock"] = mv
		# المقصود هنا لحظة الضرر وحدها. التفادي والصدّ (5.4.3) يشوّشان القياس:
		# القفزة تُبعد الهدف، والضربة القوية المصدودة تُرنّح المهاجم فتُلغي دورته.
		no_react(a)
		no_react(b)
		# البحث عن الأهداف موزّع عشوائياً على ربع ثانية، فنصفّره ليكون القياس دقيقاً
		a["scan_t"] = 0.0
		b["scan_t"] = 0.0
		var spec: Dictionary = GC.MOVES[mv]
		var cycle: float = (float(spec["wind"]) + float(spec["recover"])) * GC.MOVE_CYCLE_SCALE
		var hit_at: float = cycle * float(spec["wind"]) / (float(spec["wind"]) + float(spec["recover"]))
		var before := float(b["hp"])
		run(c, hit_at - 0.03, 0.01)
		check(float(b["hp"]) == before, "الحركة %s: وقع ضرر قبل نهاية الاستعداد" % mv)
		run(c, 0.06, 0.01)
		check(float(b["hp"]) < before, "الحركة %s: لم يقع ضرر عند نهاية الاستعداد" % mv)

	# الرامي من بعيد: 47% من زمن ضربته كما كان
	var cr := new_combat()
	var s := cr.spawn("viper_sniper", 0, 0, Vector2(5, 5))     # زمن ضربة 2.5 ث، مدى 7
	var t := cr.spawn("scorp_common", 1, 1, Vector2(10, 5))
	s["scan_t"] = 0.0
	t["scan_t"] = 0.0
	run(cr, 2.5 * GC.UNIT_HIT_AT - 0.05, 0.01)
	check(cr.projectiles.is_empty(), "الرامي أطلق قبل 47% من زمن ضربته")
	run(cr, 0.1, 0.01)
	check(not cr.projectiles.is_empty(), "الرامي لم يطلق عند 47% من زمن ضربته")
	check(String(s["state"]) == "attacking", "المهاجم ليس في حالة attacking")

# حد المطاردة: هدف بعيد جداً يُترك وترجع الوحدة لمكانها
func _t_chase_limit() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(7, 5))
	run(c, 0.5)
	check(int(a["target"]) == int(b["id"]), "لم ترصد الوحدة عدواً داخل مدى الرصد")
	b["pos"] = Vector2(40, 5)      # قفز الهدف بعيداً
	run(c, 1.0)
	check(int(a["target"]) < 0, "لم تتخلَّ الوحدة عن هدف تجاوز حد المطاردة")

	# ابتعاد الوحدة نفسها 6 مربعات عن مكان بدء المطاردة
	var c2 := new_combat()
	var x := c2.spawn("crow_common", 0, 0, Vector2(5, 5))
	var y := c2.spawn("scorp_common", 1, 1, Vector2(8, 5))
	run(c2, 0.5)
	check(int(x["target"]) == int(y["id"]), "لم ترصد الوحدة الهدف")
	x["pos"] = Vector2(13, 5)      # صارت بعيدة عن chase_from
	y["pos"] = Vector2(14, 5)
	run(c2, 0.4)
	check(int(x["target"]) < 0, "لم تتوقف المطاردة عند تجاوز 6 مربعات من نقطة البداية")

# في moving لا ترد الوحدة على من يضربها (5.1)
func _t_moving_does_not_retaliate() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.5, 5))
	c.order_move([a], Vector2(5.2, 5), false)
	a["path"] = [Vector2(500, 500)]      # مسار طويل يبقيها في moving
	run(c, 2.0)
	check(int(a["target"]) < 0, "وحدة في حالة moving ردّت على من يضربها")
	check(b["hp"] == b["max_hp"], "وحدة في حالة moving ضربت عدواً")

# ثبات الهدف: لا تُبدَّل لمجرد أن عدواً آخر صار أقرب
func _t_target_stickiness() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var first := c.spawn("scorp_common", 1, 1, Vector2(6.0, 5))
	run(c, 0.5)
	check(int(a["target"]) == int(first["id"]), "لم تُختَر أقرب وحدة كهدف أول")
	# عدو أقرب لكنه لا يهاجم (حالة moving) — الوحدة يجب أن تبقى على هدفها الأول
	var closer := c.spawn("scorp_common", 1, 1, Vector2(5.2, 5))
	for i in 30:
		closer["state"] = "moving"
		closer["path"] = [Vector2(5.2, 5.0)]
		c.step(1.0 / 30.0)
	check(int(a["target"]) == int(first["id"]), "بدّلت الوحدة هدفها لمجرد أن عدواً صار أقرب")
	# لكن إذا هاجمها الأقرب فعلاً، تتحول إليه
	c.damage(a, 1.0, closer, false)
	c.step(0.05)
	check(int(a["target"]) == int(closer["id"]), "لم تتحول الوحدة لمهاجم أقرب من هدفها")

# المقذوف يطير بين 0.3 و 0.5 ثانية ثم يوقع الضرر
func _t_projectile() -> void:
	var c := new_combat()
	var a := c.spawn("viper_sniper", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(9, 5))
	run(c, 2.0, 0.01)
	check(c.projectiles.size() > 0 or float(b["hp"]) < float(b["max_hp"]), "القنّاص لم يطلق مقذوفاً")
	for p in c.projectiles:
		check(float(p["dur"]) >= GC.PROJ_MIN_TIME - 0.001 and float(p["dur"]) <= GC.PROJ_MAX_TIME + 0.001,
			"زمن طيران المقذوف خارج 0.3 – 0.5 ثانية")
	run(c, 1.0, 0.01)
	check(float(b["hp"]) < float(b["max_hp"]), "المقذوف لم يوقع ضرراً")
	check(float(b["hp"]) > 0.0 or b["state"] == "dead", "حالة الهدف غير سليمة")

# الرامي يتحول للقتال القريب إذا اقترب العدو 1.5 مربع أو أقل (5.3)
func _t_melee_switch() -> void:
	var c := new_combat()
	var a := c.spawn("viper_sniper", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(6.0, 5))
	run(c, 1.5, 0.01)
	check(c.projectiles.is_empty(), "الرامي أطلق مقذوفاً على عدو ملاصق بدل القتال القريب")
	check(float(b["hp"]) < float(b["max_hp"]), "الرامي لم يضرب العدو الملاصق")
	# ضرر القتال القريب للقنّاص 4 لا 26
	check(float(b["max_hp"]) - float(b["hp"]) < 26.0, "استُعمل ضرر الرماية في القتال القريب")

# الموت: تبقى ثانية ثم تُحذف، ومن كان يقاتلها يبحث عن غيرها
func _t_death_cleanup() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(5.5, 5))
	c.damage(b, 9999.0, a, false)
	check(b["state"] == "dead", "الوحدة لم تمت بضرر ساحق")
	check(int(a["target"]) < 0, "المهاجم بقي متمسكاً بهدف ميت")
	check(c.units.size() == 2, "حُذفت الوحدة الميتة فوراً بدل البقاء ثانية")
	run(c, GC.UNIT_DEATH_DUR + 0.2)
	check(c.units.size() == 1, "الوحدة الميتة لم تُحذف بعد ثانية")

# في attackMove ترصد الوحدة الأعداء مثل idle، ومتى خلا الطريق تواصل التقدم (5.1)
func _t_attack_move_engages() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(6.5, 5))
	a["scan_t"] = 0.0
	no_react(a)
	no_react(b)      # المقصود هنا الهجوم المتحرك لا التفادي
	c.order_move([a], Vector2(20, 5), true)
	check(a["state"] == "attackMove", "أمر الهجوم المتحرك لم يضع الوحدة في حالة attackMove")
	# مهلة تكفي أبطأ الحركات: الاقتراب ثم استعداد الضربة القوية (5.4.2)
	run(c, 1.6)
	check(int(a["target"]) == int(b["id"]), "وحدة في attackMove لم ترصد عدواً في طريقها")
	check(float(b["hp"]) < float(b["max_hp"]), "وحدة في attackMove لم تهاجم العدو الذي رصدته")

# أمر الهجوم من اللاعب يطارد بلا حد
func _t_attack_order_ignores_chase_limit() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(30, 5))
	c.order_attack([a], b)
	run(c, 2.0)
	check(int(a["cmd_target"]) == int(b["id"]), "أمر الهجوم سقط رغم بُعد الهدف")
	check(Vector2(a["pos"]).distance_to(Vector2(5, 5)) > 1.0, "الوحدة لم تتقدم نحو هدف أمر الهجوم")
