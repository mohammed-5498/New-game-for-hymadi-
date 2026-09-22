extends SceneTree
# فحص توزيع العمل على الإطارات — القسم 14
#   godot --headless --path godot --script tests/test_sched.gd
#
# ثلاثة أشياء كانت تُعمل دفعةً واحدة فتصنع نتوءاً يُحَسّ تقطيعاً مع كثرة الوحدات:
# تحديث كل وحدة في كل إطار، وبناء الشبكة المكانية، وقوة التباعد.

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

func _initialize() -> void:
	_t_numbers()
	_t_on_screen_every_frame()
	_t_off_screen_throttled()
	_t_off_screen_same_result()
	_t_off_screen_fights_the_same()
	_t_grid_never_partial()
	_t_separation_spread()
	_t_separation_same_effect()
	if failures == 0:
		print("نجح فحص توزيع العمل على الإطارات: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

func _t_numbers() -> void:
	check(GC.STAT_EVERY >= 2 and GC.STAT_EVERY <= 8,
		"دورية تحديث ما خارج الشاشة %d خارج المعقول" % GC.STAT_EVERY)
	check(GC.GRID_REBUILD > 0.0, "دورية الشبكة المكانية صفر")

# ---------- ما على الشاشة يُحدَّث في كل إطار: وإلا تقطّعت حركته أمام العين ----------
func _t_on_screen_every_frame() -> void:
	var c := new_combat()
	var u := c.spawn("crow_common", 0, 0, Vector2(5, 5))
	u["on_screen"] = true
	u["state"] = "moving"
	u["path"] = [Vector2(60, 5)]
	var last: float = float(u["pos"].x)
	var still := 0
	for i in 30:
		c.step(1.0 / 60.0)
		u["on_screen"] = true
		if absf(float(u["pos"].x) - last) < 0.0001:
			still += 1
		last = float(u["pos"].x)
	check(still == 0, "وحدة على الشاشة توقفت في %d إطاراً من 30" % still)

# ---------- وما خارجها يُحدَّث مرة كل STAT_EVERY، وليس كلها في نفس الإطار ----------
func _t_off_screen_throttled() -> void:
	var c := new_combat()
	var us: Array = []
	for i in 40:
		var u := c.spawn("crow_common", 0, 0, Vector2(5, 5 + float(i) * 3.0))
		u["on_screen"] = false
		u["state"] = "moving"
		u["path"] = [Vector2(60, 5 + float(i) * 3.0)]
		us.append(u)
	var moved_per_frame: Array = []
	for i in 24:
		var before: Array = []
		for u in us:
			before.append(Vector2(u["pos"]))
		c.step(1.0 / 60.0)
		var moved := 0
		for k in us.size():
			if Vector2(us[k]["pos"]).distance_to(before[k]) > 0.0001:
				moved += 1
		moved_per_frame.append(moved)
	# لا إطار يحرّك الكل: العمل موزَّع
	var worst := 0
	for m in moved_per_frame:
		worst = maxi(worst, m)
	check(worst < 40, "إطار واحد حدّث %d وحدة من 40: العمل غير موزَّع" % worst)
	check(worst <= 40 / GC.STAT_EVERY + 4,
		"أسوأ إطار حدّث %d والمتوقع نحو %d" % [worst, 40 / GC.STAT_EVERY])
	# ومع ذلك تتحرك كلها
	var never := 0
	for u in us:
		if float(u["pos"].x) <= 5.0001:
			never += 1
	check(never == 0, "%d وحدة خارج الشاشة لم تتحرك إطلاقاً" % never)

# ---------- والأهم: النتيجة نفسها. الزمن يتراكم فلا يضيع ----------
func _t_off_screen_same_result() -> void:
	var dist := {}
	for off in [false, true]:
		var c := new_combat()
		var u := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		u["spd_var"] = 1.0
		u["on_screen"] = not off
		u["state"] = "moving"
		u["path"] = [Vector2(500, 5)]
		for i in 120:
			c.step(1.0 / 60.0)
			u["on_screen"] = not off
		dist[off] = float(u["pos"].x) - 5.0
	check(float(dist[false]) > 1.0, "الوحدة لم تقطع مسافة أصلاً")
	var ratio: float = float(dist[true]) / float(dist[false])
	check(absf(ratio - 1.0) < 0.03,
		"وحدة خارج الشاشة قطعت %.3f من مسافة التي على الشاشة" % ratio)

# ---------- وتقاتل بنفس المعدل: الزمن المتراكم يعطي نفس الضرر ----------
func _t_off_screen_fights_the_same() -> void:
	var dmg := {}
	for off in [false, true]:
		seed(31337)
		var c := new_combat()
		var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
		b["hp"] = 1000000.0
		b["max_hp"] = 1000000.0
		# المستوى ثابت في الحالتين عن قصد: المقيس هنا أثر توزيع التحديث وحده.
		# (فرق المستوى الإحصائي عن الكامل شيء آخر، مذكور للمستخدم في CLAUDE.md)
		for u in [a, b]:
			u["on_screen"] = not off
			u["lod"] = GC.LOD_FULL
		for i in int(20.0 * 60.0):
			c.step(1.0 / 60.0)
			a["pos"] = Vector2(5, 5)
			b["pos"] = Vector2(5.4, 5)
			a["hp"] = float(a["max_hp"])
			for u in [a, b]:
				u["on_screen"] = not off
				u["lod"] = GC.LOD_FULL
		dmg[off] = 1000000.0 - float(b["hp"])
	check(float(dmg[false]) > 0.0, "لم يقع ضرر أصلاً")
	var r: float = float(dmg[true]) / float(dmg[false])
	check(absf(r - 1.0) < 0.02,
		"ضرر عشرين ثانية خارج الشاشة %.0f وداخلها %.0f (نسبة %.2f)" % [dmg[true], dmg[false], r])

# ---------- الشبكة لا تُستعمل ناقصة أبداً وهي تُبنى على مهل ----------
# أزواج متباعدة: لكل وحدة جار واحد فقط، فلو غاب من الشبكة لحظةً ظهر الخلل.
# (بوحدات متكدسة لا يُكتشف النقص: الجيران كثيرون فيكفي بعضهم)
func _t_grid_never_partial() -> void:
	var c := new_combat()
	var us: Array = []
	for i in 40:
		var bx: float = 5.0 + float(i % 8) * 9.0
		var by: float = 5.0 + float(i / 8) * 9.0
		us.append(c.spawn("crow_common", 0, 0, Vector2(bx, by)))
		us.append(c.spawn("crow_common", 0, 0, Vector2(bx + 0.35, by)))
	var bad := 0
	var worst_frame := -1
	for i in 60:
		c.step(1.0 / 60.0)
		for u in us:
			if c._near_units(Vector2(u["pos"]), 1.0).size() < 2:
				bad += 1
				if worst_frame < 0:
					worst_frame = i
	check(bad == 0, "وحدة لم تجد جارها الملاصق %d مرة (أول مرة في الإطار %d)" % [bad, worst_frame])

# ---------- التباعد موزَّع: لا إطار يزحزح الكل ----------
func _t_separation_spread() -> void:
	var c := new_combat()
	var us: Array = []
	for i in 60:
		us.append(c.spawn("crow_common", 0, 0, Vector2(10.0 + float(i % 10) * 0.3,
			10.0 + float(i / 10) * 0.3)))
	for i in 10:
		c.step(1.0 / 60.0)
	var worst := 0
	for i in 20:
		var before: Array = []
		for u in us:
			before.append(Vector2(u["pos"]))
		c.step(1.0 / 60.0)
		var moved := 0
		for k in us.size():
			if Vector2(us[k]["pos"]).distance_to(before[k]) > 0.00001:
				moved += 1
		worst = maxi(worst, moved)
	check(worst < 60, "إطار واحد زحزح %d وحدة من 60: التباعد غير موزَّع" % worst)

# ---------- ومع ذلك يفرّق المتكدسين بنفس القوة ----------
func _t_separation_same_effect() -> void:
	var c := new_combat()
	var us: Array = []
	for i in 25:
		us.append(c.spawn("crow_common", 0, 0, Vector2(10.0 + randf() * 0.1, 10.0 + randf() * 0.1)))
	var before := _closest(us)
	for i in 120:
		c.step(1.0 / 60.0)
	var after := _closest(us)
	check(after > before, "التباعد لم يفرّق الوحدات المتكدسة (%.3f -> %.3f)" % [before, after])
	check(after > GC.SEPARATE_DIST * 0.45,
		"بقيت الوحدات متلاصقة بعد ثانيتين: أقرب مسافة %.3f" % after)

func _closest(us: Array) -> float:
	var best := 9999.0
	for i in us.size():
		for j in range(i + 1, us.size()):
			best = minf(best, Vector2(us[i]["pos"]).distance_to(Vector2(us[j]["pos"])))
	return best
