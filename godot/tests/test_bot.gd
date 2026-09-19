extends SceneTree
# فحص البوتات والتحالفات — القسم 11
#   godot --headless --path godot --script tests/test_bot.gd

var failures := 0

class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func make_districts(count: int) -> Array:
	var out := []
	for i in count:
		out.append({
			"id": i, "tiles": [], "size": 9, "cx": float(i) * 12.0, "cy": 0.0,
			"flavor": "neutral", "type": "plain", "gang": "", "special": "",
			"cap": Vector2i(int(i) * 12, 0), "center": Vector2i(int(i) * 12, 0),
		})
	return out

func new_world(dcount: int, teams: Dictionary) -> Dictionary:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(dcount)
	var d := Districts.new()
	d.setup(dl, 4, teams)
	c.teams = teams
	return {"c": c, "d": d, "dl": dl}

# وحدة ساكنة لا تبحث عن أعداء، لنقيس أمر البوت وحده
func park(c: Combat, key: String, player: int, team: int, pos: Vector2) -> Dictionary:
	var u := c.spawn(key, player, team, pos)
	u["state"] = "moving"
	u["scan_t"] = 999.0
	return u

func _initialize() -> void:
	_t_think_intervals()
	_t_defend_first()
	_t_expand_prefers_special()
	_t_police_rules_by_difficulty()
	_t_attack_needs_army()
	_t_attack_targets_leader()
	_t_respects_alliances()
	_t_hard_retreats_wounded()
	_t_hard_puts_ranged_behind()
	if failures == 0:
		print("نجح فحص البوتات والتحالفات: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# سهل 4 ث، متوسط 2 ث، صعب 1 ث (11)
func _t_think_intervals() -> void:
	for pair in [["easy", 4.0], ["medium", 2.0], ["hard", 1.0]]:
		var b := Bot.new()
		b.setup(1, String(pair[0]))
		check(is_equal_approx(b.think_every(), float(pair[1])),
			"دورة تفكير %s ليست %.0f ث" % [String(pair[0]), float(pair[1])])
	var bad := Bot.new()
	bad.setup(1, "لا_يوجد")
	check(bad.difficulty == GC.BOT_DIFFICULTY_DEFAULT, "صعوبة غير معروفة لم ترجع للافتراضي")

# الأولوية الأولى: الدفاع عن حي مملوك مهدَّد
func _t_defend_first() -> void:
	var w := new_world(3, {0: 0, 1: 1})
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	dl[0]["owner"] = 1                       # حي البوت المهدَّد
	dl[2]["owner"] = -1                      # حي محايد بعيد للتوسع
	var mine := []
	for i in 4:
		mine.append(park(c, "crow_common", 1, 1, Vector2(20.0 + float(i) * 0.3, 0)))
	park(c, "crow_common", 0, 0, Vector2(2, 0))   # عدو قرب حي البوت

	var b := Bot.new()
	b.setup(1, "medium")
	b.step(99.0, c, w["d"], dl)
	var went := 0
	for u in mine:
		if not u["path"].is_empty() and Vector2(u["path"][0]).distance_to(Vector2(0, 0)) < 2.0:
			went += 1
	check(went >= 1, "البوت لم يدافع عن حيه المهدَّد")

# التوسع يفضّل الأحياء المميزة
func _t_expand_prefers_special() -> void:
	var w := new_world(3, {0: 0, 1: 1})
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	dl[1]["special"] = "armory"              # مميز لكنه أبعد قليلاً
	var mine := []
	for i in 4:
		mine.append(park(c, "crow_common", 1, 1, Vector2(float(i) * 0.3, 0)))
	var b := Bot.new()
	b.setup(1, "medium")
	b.step(99.0, c, w["d"], dl)
	var to_special := 0
	for u in mine:
		if not u["path"].is_empty() and Vector2(u["path"][0]).distance_to(Vector2(12, 0)) < 2.0:
			to_special += 1
	check(to_special >= 1, "البوت لم يفضّل الحي المميز في التوسع")

# السهل يتجنب أحياء الشرطة، والمتوسط من 8 وحدات، والصعب يستهدفها
func _t_police_rules_by_difficulty() -> void:
	for case in [["easy", 4, false], ["easy", 20, false], ["medium", 4, false],
			["medium", 9, true], ["hard", 2, true]]:
		var w := new_world(1, {0: 0, 1: 1})
		var c: Combat = w["c"]
		var dl: Array = w["dl"]
		dl[0]["type"] = "police"
		var mine := []
		for i in int(case[1]):
			mine.append(park(c, "crow_common", 1, 1, Vector2(20.0 + float(i) * 0.2, 0)))
		var b := Bot.new()
		b.setup(1, String(case[0]))
		b.step(99.0, c, w["d"], dl)
		var went := false
		for u in mine:
			if not u["path"].is_empty() and Vector2(u["path"][0]).distance_to(Vector2(0, 0)) < 3.0:
				went = true
		check(went == bool(case[2]),
			"سلوك %s تجاه حي الشرطة بجيش %d غير مطابق للوصف" % [String(case[0]), int(case[1])])

# لا يهاجم قبل أن يصير الجيش كافياً
func _t_attack_needs_army() -> void:
	var w := new_world(2, {0: 0, 1: 1})
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	dl[0]["owner"] = 0        # حي العدو
	dl[1]["owner"] = 1        # حي البوت، فلا يوجد حي محايد للتوسع
	var mine := []
	for i in 3:
		mine.append(park(c, "crow_common", 1, 1, Vector2(12.0 + float(i) * 0.3, 0)))
	var b := Bot.new()
	b.setup(1, "medium")       # يحتاج 7 وحدات
	b.step(99.0, c, w["d"], dl)
	var attacked := false
	for u in mine:
		if not u["path"].is_empty() and Vector2(u["path"][0]).distance_to(Vector2(0, 0)) < 2.0:
			attacked = true
	check(not attacked, "البوت هاجم بجيش أقل من الحد")

	for i in 6:
		mine.append(park(c, "crow_common", 1, 1, Vector2(12.0 + float(i) * 0.3, 0.5)))
	b.last_goal = {}
	b.step(99.0, c, w["d"], dl)
	attacked = false
	for u in mine:
		if not u["path"].is_empty() and Vector2(u["path"][0]).distance_to(Vector2(0, 0)) < 2.0:
			attacked = true
	check(attacked, "البوت لم يهاجم رغم بلوغ الجيش الحد")

# الهدف الأول هو المتصدر إذا ملك 40% من الأحياء (القسم 9)
func _t_attack_targets_leader() -> void:
	var w := new_world(10, {0: 0, 1: 1, 2: 2})
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	var d: Districts = w["d"]
	for i in 5:
		dl[i]["owner"] = 2           # المتصدر (50%) وأحياؤه بعيدة
	dl[9]["owner"] = 0               # عدو قريب لكنه ليس متصدراً
	check(d.leader() == 2, "لم يُكتشف المتصدر")
	var mine := []
	for i in 9:
		mine.append(park(c, "crow_common", 1, 1, Vector2(108.0 + float(i) * 0.3, 0)))
	var b := Bot.new()
	b.setup(1, "medium")
	b.step(99.0, c, w["d"], dl)
	var to_leader := 0
	for u in mine:
		if u["path"].is_empty():
			continue
		var g := Vector2(u["path"][0])
		if g.x <= 50.0:
			to_leader += 1
	check(to_leader >= 1, "البوت لم يجعل المتصدر هدفه الأول")

# البوتات تحترم التحالفات
func _t_respects_alliances() -> void:
	var w := new_world(2, {0: 5, 1: 5, 2: 2})   # اللاعب 0 والبوت 1 في نفس الفريق
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	dl[0]["owner"] = 0        # حي الحليف
	dl[1]["owner"] = 1
	var mine := []
	for i in 9:
		mine.append(park(c, "crow_common", 1, 1, Vector2(12.0 + float(i) * 0.3, 0)))
	var b := Bot.new()
	b.setup(1, "medium")
	b.step(99.0, c, w["d"], dl)
	var attacked_ally := false
	for u in mine:
		if not u["path"].is_empty() and Vector2(u["path"][0]).distance_to(Vector2(0, 0)) < 2.0:
			attacked_ally = true
	check(not attacked_ally, "البوت هاجم حي حليفه")

# الصعب يسحب المصابين إلى المستشفى إن امتلكه
func _t_hard_retreats_wounded() -> void:
	var w := new_world(2, {0: 0, 1: 1})
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	dl[1]["special"] = "hospital"
	dl[1]["owner"] = 1
	var hurt := park(c, "crow_common", 1, 1, Vector2(40, 0))
	hurt["hp"] = float(hurt["max_hp"]) * 0.2
	var fine := park(c, "crow_common", 1, 1, Vector2(40.5, 0))
	var b := Bot.new()
	b.setup(1, "hard")
	b.step(99.0, c, w["d"], dl)
	check(not hurt["path"].is_empty() and Vector2(hurt["path"][0]).distance_to(Vector2(12, 0)) < 2.0,
		"الصعب لم يسحب المصاب إلى المستشفى")
	check(fine["path"].is_empty() or Vector2(fine["path"][0]).distance_to(Vector2(12, 0)) > 1.0,
		"الصعب سحب وحدة سليمة إلى المستشفى")

# الصعب يضع القناص والرماة خلف المقاتلين
func _t_hard_puts_ranged_behind() -> void:
	var w := new_world(2, {0: 0, 1: 1})
	var c: Combat = w["c"]
	var dl: Array = w["dl"]
	var melee := park(c, "crow_common", 1, 1, Vector2(30, 0))
	var sniper := park(c, "viper_sniper", 1, 1, Vector2(30, 0))
	var b := Bot.new()
	b.setup(1, "hard")
	b.step(99.0, c, w["d"], dl)
	check(not melee["path"].is_empty() and not sniper["path"].is_empty(), "لم تصدر أوامر للوحدتين")
	var goal := Vector2(melee["path"][0])
	var sgoal := Vector2(sniper["path"][0])
	check(sgoal.distance_to(Vector2(30, 0)) < goal.distance_to(Vector2(30, 0)),
		"القناص لم يوضع خلف المقاتل")
