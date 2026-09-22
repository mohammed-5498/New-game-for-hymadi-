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
	_t_separation_cells()
	_t_police_counts()
	_t_capture_index()
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

# ---------- التباعد يمسح الخلايا التي تلمسها دائرته فقط ----------
# مدى التباعد نصف مربع وخلية الشبكة 2×2: مسح تسع خلايا كان يمسح 6×6 مربعات لجوار
# نصف مربع. الفحص: وحدة بعيدة بمقدار خلية كاملة لا تؤثر، وملاصقة تؤثر.
func _t_separation_cells() -> void:
	var c := new_combat()
	var a := c.spawn("crow_common", 0, 0, Vector2(10, 10))
	# جار خارج المدى بكثير لكنه داخل الخلايا التسع القديمة
	c.spawn("crow_common", 0, 0, Vector2(12.4, 10))
	var p0: Vector2 = Vector2(a["pos"])
	for i in 60:
		c.step(1.0 / 60.0)
	check(Vector2(a["pos"]).distance_to(p0) < 0.001,
		"جار على بعد 2.4 مربع دفع الوحدة والمدى %.2f" % GC.SEPARATE_DIST)
	# وجار ملاصق يدفع فعلاً
	var c2 := new_combat()
	var a2 := c2.spawn("crow_common", 0, 0, Vector2(10, 10))
	c2.spawn("crow_common", 0, 0, Vector2(10.2, 10))
	var q0: Vector2 = Vector2(a2["pos"])
	for i in 60:
		c2.step(1.0 / 60.0)
	check(Vector2(a2["pos"]).distance_to(q0) > 0.01, "جار ملاصق لم يدفع الوحدة")
	# ومَن على حافة المدى بالضبط من الجهة الأخرى للخلية: لا يُفقد بسبب تضييق المسح
	var c3 := new_combat()
	var a3 := c3.spawn("crow_common", 0, 0, Vector2(11.98, 10))   # قرب حدّ الخلية
	c3.spawn("crow_common", 0, 0, Vector2(12.3, 10))              # الخلية التالية
	var r0: Vector2 = Vector2(a3["pos"])
	for i in 60:
		c3.step(1.0 / 60.0)
	check(Vector2(a3["pos"]).distance_to(r0) > 0.01,
		"جار في الخلية المجاورة وداخل المدى لم يُحسب: المسح ضُيِّق أكثر من اللازم")

# ---------- عدّاد الشرطة يُحسب في مرور واحد ويبقى صحيحاً ----------
func _t_police_counts() -> void:
	var c := new_combat()
	var p := Police.new()
	var districts := [
		{"id": 0, "type": "police", "center": Vector2i(10, 10), "cap": Vector2i(10, 10),
		 "owner": -1, "size": 30},
	]
	p.setup(districts, c, FlatMap.new())
	check(p.stations.size() == 1, "لم يُبنَ مركز الشرطة")
	check(p.count_of(p.stations[0], "police_common") == 0, "العدّاد لا يبدأ من صفر")
	for i in int(30.0 / 0.1):
		c.step(0.1)
		p.step(0.1, districts)
	var live := 0
	for u in c.units:
		if u["state"] != "dead" and String(u["key"]) == "police_common":
			live += 1
	# والعدّاد يعكس الظهور فوراً، لا في الخطوة التالية
	var before: int = p.count_of(p.stations[0], "police_common")
	p._spawn(p.stations[0], "police_common")
	check(p.count_of(p.stations[0], "police_common") == before + 1,
		"العدّاد لم يتحدث فور ظهور شرطي")
	live += 1
	check(p.count_of(p.stations[0], "police_common") == live,
		"العدّاد يقول %d والحقيقة %d" % [p.count_of(p.stations[0], "police_common"), live])
	check(live > 0 and live <= GC.POLICE_MAX_ALIVE, "عدد الشرطة %d خارج الحد" % live)

# ---------- فهرس ساحات العلم يعطي نفس نتيجة المسح الكامل ----------
func _t_capture_index() -> void:
	var c := new_combat()
	var d := Districts.new()
	var districts := [
		{"id": 0, "type": "normal", "gang": "crow", "special": "", "size": 30,
		 "cap": Vector2i(10, 10), "center": Vector2i(10, 10), "tiles": []},
		{"id": 1, "type": "normal", "gang": "crow", "special": "", "size": 30,
		 "cap": Vector2i(30, 30), "center": Vector2i(30, 30), "tiles": []},
	]
	d.setup(districts, 2, {0: 0, 1: 1})
	# وحدة داخل الساحة تُحسب، وأخرى خارجها بقليل لا تُحسب
	# ليست في مربع الساحة نفسه بل في مربع مجاور وما زالت داخل نصف القطر:
	# هذا ما يكشف فهرساً أضيق مما يجب
	var inside := c.spawn("crow_common", 0, 0, Vector2(11.1, 10.4))
	var outside := c.spawn("crow_common", 1, 1, Vector2(10.0 + GC.CAPTURE_RADIUS + 0.3, 10.0))
	for i in 30:
		d.step(0.1, c.units)
	check(int(districts[0]["claimer"]) == 0,
		"الوحدة داخل الساحة لم تُحسب (claimer=%d)" % int(districts[0]["claimer"]))
	check(float(districts[0]["value"]) > 0.0, "لم يتقدم الاستيلاء أصلاً")
	# وأبعِد الداخلة: يتوقف التقدم
	inside["pos"] = Vector2(40, 40)
	outside["pos"] = Vector2(41, 41)
	var v0: float = float(districts[0]["value"])
	for i in 20:
		d.step(0.1, c.units)
	check(float(districts[0]["value"]) <= v0 + 0.01,
		"استمر الاستيلاء بلا وحدة داخل الساحة")
	# والحي البعيد لم يتأثر
	check(float(districts[1]["value"]) == 0.0, "تقدم استيلاء حي لا وحدة فيه")

func _closest(us: Array) -> float:
	var best := 9999.0
	for i in us.size():
		for j in range(i + 1, us.size()):
			best = minf(best, Vector2(us[i]["pos"]).distance_to(Vector2(us[j]["pos"])))
	return best
