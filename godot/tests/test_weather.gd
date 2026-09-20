extends SceneTree
# فحص الطقس وتأثيراته — القسم 10
#   godot --headless --path godot --script tests/test_weather.gd

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

func new_combat(w: String) -> Combat:
	var c := Combat.new(FlatMap.new())
	c.weather = w
	return c

# بذرة الشخصية تعطي كل فرد ±7% سرعة (5.4.1)، فنثبّتها عند قياس السرعة بالأرقام
func _fixed(u: Dictionary) -> void:
	u["spd_var"] = 1.0

func run(c: Combat, seconds: float, dt: float = 1.0 / 30.0) -> void:
	for i in int(seconds / dt):
		c.step(dt)

func _initialize() -> void:
	_t_numbers()
	_t_night_detect()
	_t_snow_speed()
	_t_rain_hit_ratio()
	_t_rain_miss_is_harmless()
	_t_rain_spares_melee_and_ults()
	_t_rain_damage_over_time()
	await _t_particles()
	_t_colors()
	_t_random_resolves()
	await _t_scene_draws()
	if failures == 0:
		print("نجح فحص الطقس: لا أخطاء.")
	else:
		printerr("فشل فحص الطقس: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الأرقام كما في الوصف ----------
func _t_numbers() -> void:
	check(float(GC.WEATHER_DETECT["night"]) == 0.75, "مدى الرصد ليلاً ليس 0.75")
	check(float(GC.WEATHER_SPEED["snow"]) == 0.85, "سرعة الحركة في الثلج ليست 0.85")
	check(float(GC.WEATHER_RANGED_HIT["rain"]) == 0.80, "نسبة الإصابة البعيدة في المطر ليست 0.80")
	var c := new_combat("day")
	var u := c.spawn("crow_common", 0, 0, Vector2.ZERO)
	_fixed(u)
	check(c.detect_of(u) == float(GC.stat("crow_common", "detect")), "النهار غيّر مدى الرصد")
	check(c.speed_of(u) == float(GC.stat("crow_common", "speed")), "النهار غيّر السرعة")
	check(c.ranged_hit_chance() == 1.0, "النهار غيّر نسبة الإصابة")
	# كل طقس يغيّر تأثيره وحده
	var night := new_combat("night")
	var nu := night.spawn("crow_common", 0, 0, Vector2.ZERO)
	_fixed(nu)
	check(is_equal_approx(night.detect_of(nu), float(GC.stat("crow_common", "detect")) * 0.75), "الليل لم يقصّر مدى الرصد")
	check(night.speed_of(nu) == float(GC.stat("crow_common", "speed")), "الليل غيّر السرعة بلا سبب")
	var snow := new_combat("snow")
	var su := snow.spawn("crow_common", 0, 0, Vector2.ZERO)
	_fixed(su)
	check(is_equal_approx(snow.speed_of(su), float(GC.stat("crow_common", "speed")) * 0.85), "الثلج لم يبطئ الحركة")
	check(snow.detect_of(su) == float(GC.stat("crow_common", "detect")), "الثلج غيّر مدى الرصد بلا سبب")
	var rain := new_combat("rain")
	var ru := rain.spawn("crow_common", 0, 0, Vector2.ZERO)
	_fixed(ru)
	check(rain.detect_of(ru) == float(GC.stat("crow_common", "detect")), "المطر غيّر مدى الرصد بلا سبب")
	check(rain.speed_of(ru) == float(GC.stat("crow_common", "speed")), "المطر غيّر السرعة بلا سبب")

# ---------- ليل: عدو على مسافة بين 0.75×المدى والمدى لا يُرصد ----------
func _t_night_detect() -> void:
	var detect: float = float(GC.stat("crow_common", "detect"))
	var d: float = detect * 0.88            # داخل المدى نهاراً، خارجه ليلاً
	for w in ["day", "night"]:
		var c := new_combat(w)
		var a := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		c.spawn("scorp_common", 1, 1, Vector2(5.0 + d, 5))
		run(c, 1.0)
		if w == "day":
			check(int(a["target"]) > 0, "نهاراً: لم تُرصد وحدة داخل المدى")
		else:
			check(int(a["target"]) < 0, "ليلاً: رُصدت وحدة خارج 0.75 من المدى")

# ---------- ثلج: مسافة مقطوعة في زمن ثابت = 0.85 من مسافة النهار ----------
func _t_snow_speed() -> void:
	var moved := {}
	for w in ["day", "snow"]:
		var c := new_combat(w)
		var u := c.spawn("crow_common", 0, 0, Vector2(5, 5))
		_fixed(u)
		u["path"] = [Vector2(60, 5)]        # هدف بعيد: لا يصل خلال الفحص
		u["state"] = "moving"
		run(c, 2.0)
		moved[w] = float(u["pos"].x) - 5.0
	check(float(moved["day"]) > 1.0, "الوحدة لم تتحرك أصلاً نهاراً")
	var ratio: float = float(moved["snow"]) / float(moved["day"])
	check(absf(ratio - 0.85) < 0.02, "نسبة السرعة في الثلج %.3f والمطلوب 0.85" % ratio)

# ---------- مطر: نحو 80% من الهجمات البعيدة تصيب ----------
func _t_rain_hit_ratio() -> void:
	seed(20251)
	var shots := 600
	for w in ["day", "rain"]:
		var c := new_combat(w)
		var a := c.spawn("viper_sniper", 0, 0, Vector2(5, 5))
		var b := c.spawn("scorp_common", 1, 1, Vector2(9, 5))
		var hits := 0
		for i in shots:
			c.projectiles = []
			c._fire(a, b, 5.0, "arrow", 0.0)
			if Vector2(c.projectiles[0]["miss"]) == Vector2.ZERO:
				hits += 1
		var ratio: float = float(hits) / float(shots)
		if w == "day":
			check(ratio == 1.0, "نهاراً: أخطأت بعض الهجمات البعيدة")
		else:
			check(absf(ratio - 0.80) < 0.05, "في المطر أصابت %.2f من الهجمات والمطلوب 0.80" % ratio)

# ---------- الضربة الخاطئة تسقط قرب الهدف بلا ضرر ولا إشعال ----------
func _t_rain_miss_is_harmless() -> void:
	var c := new_combat("rain")
	# متباعدان جداً حتى لا يشتبكا وحدهما: نحن نصنع المقذوف يدوياً
	var a := c.spawn("viper_firebomber", 0, 0, Vector2(5, 5))
	var b := c.spawn("scorp_common", 1, 1, Vector2(40, 5))
	b["hp"] = 1000.0
	b["max_hp"] = 1000.0
	# زجاجة مخطئة: نفرضها يدوياً حتى لا نعتمد على الحظ
	c._fire(a, b, 20.0, "bottle", 0.0)
	var p: Dictionary = c.projectiles[0]
	p["miss"] = Vector2(GC.WEATHER_MISS_SPREAD, 0.0)
	run(c, 1.5)
	check(float(b["hp"]) == 1000.0, "الضربة الخاطئة سبّبت ضرراً")
	check(c.fires.is_empty(), "الزجاجة الخاطئة أشعلت الأرض")
	check(c.projectiles.is_empty(), "المقذوف الخاطئ لم يُزَل بعد سقوطه")
	# وضربة مصيبة في نفس الطقس تعمل كالمعتاد
	c._fire(a, b, 20.0, "bottle", 0.0)
	c.projectiles[0]["miss"] = Vector2.ZERO
	run(c, 1.5)
	check(float(b["hp"]) < 1000.0, "الضربة المصيبة في المطر لم تسبب ضرراً")
	check(not c.fires.is_empty(), "الزجاجة المصيبة لم تشعل الأرض")

# ---------- المطر لا يمس الالتحام ولا الضربات المميزة ----------
func _t_rain_spares_melee_and_ults() -> void:
	var dmg := {}
	for w in ["day", "rain"]:
		var c := new_combat(w)
		var a := c.spawn("hammer_common", 0, 0, Vector2(5, 5))
		var b := c.spawn("scorp_common", 1, 1, Vector2(5.4, 5))
		b["hp"] = 5000.0
		b["max_hp"] = 5000.0
		a["charge"] = 0.0
		run(c, 6.0)
		dmg[w] = 5000.0 - float(b["hp"])
	check(float(dmg["day"]) > 0.0, "لم يقع ضرر التحام أصلاً")
	check(is_equal_approx(float(dmg["day"]), float(dmg["rain"])), "المطر غيّر ضرر الالتحام")
	# مقذوف الضربة المميزة لا يخطئ أبداً
	seed(7)
	var c2 := new_combat("rain")
	var s := c2.spawn("viper_sniper", 0, 0, Vector2(5, 5))
	var t := c2.spawn("scorp_common", 1, 1, Vector2(9, 5))
	var ult_misses := 0
	for i in 200:
		c2.projectiles = []
		c2._fire(s, t, 5.0, "arrow", 0.0, true)
		if Vector2(c2.projectiles[0]["miss"]) != Vector2.ZERO:
			ult_misses += 1
	check(ult_misses == 0, "مقذوف ضربة مميزة أخطأ في المطر")

# ---------- المطر: الضرر البعيد على مدى دقيقة = نحو 80% من ضرر النهار ----------
# فحص سلوكي كامل: الرامي يهاجم وحده، ونثبّت الهدف مكانه حتى نقيس الضرر لا الحركة.
func _t_rain_damage_over_time() -> void:
	seed(9091)
	var dealt := {"day": 0.0, "rain": 0.0}
	for rep in 3:                          # ثلاث تشغيلات: عينة أكبر فلا يتأرجح بالحظ
		for w in ["day", "rain"]:
			var c := new_combat(w)
			var a := c.spawn("viper_common", 0, 0, Vector2(5, 5))   # يرمي كل 1.4 ث
			var b := c.spawn("scorp_common", 1, 1, Vector2(8, 5))
			b["hp"] = 100000.0
			b["max_hp"] = 100000.0
			var dt := 1.0 / 30.0
			for i in int(60.0 / dt):
				c.step(dt)
				b["pos"] = Vector2(8, 5)      # هدف ثابت: لا يقترب ولا يهرب
				b["path"] = []
				a["hp"] = float(a["max_hp"])  # ولا يقتل الرامي فينقطع القياس
			dealt[w] = float(dealt[w]) + (100000.0 - float(b["hp"]))
	check(float(dealt["day"]) > 100.0, "الرامي لم يسبب ضرراً نهاراً")
	check(float(dealt["rain"]) > 0.0, "الرامي توقف تماماً في المطر")
	var ratio: float = float(dealt["rain"]) / float(dealt["day"])
	check(absf(ratio - 0.80) < 0.10, "ضرر المطر %.2f من ضرر النهار والمطلوب نحو 0.80" % ratio)

# ---------- الندف: العدد والحركة والالتفاف ----------
func _t_particles() -> void:
	var w := Weather.new()
	root.add_child(w)
	await process_frame
	for pair in [["day", 0], ["night", 0], ["snow", GC.SNOW_COUNT], ["rain", GC.RAIN_COUNT]]:
		w.set_kind(String(pair[0]))
		check(w._parts.size() == int(pair[1]),
			"عدد ندف %s هو %d والمطلوب %d" % [pair[0], w._parts.size(), int(pair[1])])
	w.set_kind("rain")
	var before: float = float(w._parts[0]["y"])
	w.step(0.1)
	check(float(w._parts[0]["y"]) > before, "قطرة المطر لم تسقط")
	# ندفة تحت الشاشة ترجع لأعلاها بدل أن تضيع
	w.set_kind("snow")
	w._parts[0]["y"] = 99999.0
	w.step(0.016)
	check(float(w._parts[0]["y"]) < 0.0, "الندفة الهاربة لم ترجع لأعلى الشاشة")
	# طقس غير معروف يرجع للنهار بدل الانهيار
	w.set_kind("لا_يوجد")
	check(w.kind == "day", "طقس غير معروف لم يرجع للنهار")
	w.queue_free()

# ---------- ألوان الأرض والأسطح ----------
func _t_colors() -> void:
	var g := Color("948d7f")
	check(Weather.ground(g, false, "day") == g, "النهار غيّر لون الأرض")
	var s: Color = Weather.ground(g, false, "snow")
	var sr: Color = Weather.ground(g, true, "snow")
	check(s.r > g.r and s.g > g.g and s.b > g.b, "أرض الثلج ليست أفتح")
	check(sr.r < s.r, "الشارع تحت الثلج أبيض مثل الأرض (المطلوب أقل)")
	var r: Color = Weather.ground(g, false, "rain")
	check(r.r < g.r and r.g < g.g, "أرض المطر ليست أغمق")
	var roof := Color("cdb391")
	check(Weather.snow(roof, GC.SNOW_TOP, "rain") == roof, "المطر بيّض الأسطح")
	check(Weather.snow(roof, GC.SNOW_TOP, "snow").b > roof.b, "الثلج لم يتراكم على السطح")

# ---------- "عشوائي" يُحسم إلى طقس حقيقي ثابت ----------
func _t_random_resolves() -> void:
	var w := Weather.new()
	w.set_kind("random")
	check(w.kind == "day", "عقدة الطقس قبلت 'عشوائي' بلا حسم")
	w.queue_free()
	check(GC.WEATHERS.size() == 5 and GC.WEATHERS.has("random"), "قائمة خيارات الطقس تغيّرت")

# ---------- مشهد اللعبة يرسم في كل طقس بلا انهيار ----------
func _t_scene_draws() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 3:
		await process_frame
	check(g.decor.size() == g.n * g.n, "مصفوفة الزينة لا تطابق حجم الخريطة")
	var barrels := 0
	var lamps := 0
	for t in g.decor.size():
		if String(g.decor[t]) == "":
			continue
		check(bool(g.road[t]), "زينة شارع وُضعت خارج الشوارع")
		if String(g.decor[t]) == "B":
			barrels += 1
		else:
			lamps += 1
	check(barrels + lamps > 0, "لم تُوضع أي زينة شوارع")
	check(g.lights.size() > 0, "لم يُبنَ أي مصدر ضوء ليلي")
	for w in ["day", "night", "snow", "rain"]:
		g.weather = w
		g.wx.set_kind(w)
		g.combat.weather = w
		g.queue_redraw()
		for i in 3:
			await process_frame
		check(g.wx.kind == w, "عقدة الطقس لم تستقبل %s" % w)
	g.queue_free()
	await process_frame
