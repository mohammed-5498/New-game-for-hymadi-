extends SceneTree
# فحص شيدر الإضاءة والجودة التلقائية — القسم 10 و 14
#   godot --headless --path godot --script tests/test_light.gd

var failures := 0

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	_t_shader_file()
	await _t_in_game()
	if failures == 0:
		print("نجح فحص الإضاءة والجودة التلقائية: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الشيدر موجود ويُحمَّل، وثوابته في config ----------
func _t_shader_file() -> void:
	var sh = load("res://shaders/lighting.gdshader")
	check(sh != null, "لم يُحمَّل ملف الشيدر")
	if sh == null:
		return
	var m := ShaderMaterial.new()
	m.shader = sh
	# الأسماء التي يعتمد عليها weather.gd يجب أن تكون موجودة فعلاً في الشيدر
	var names := {}
	for p in sh.get_shader_uniform_list():
		names[String(p["name"])] = true
	for want in ["tint", "vignette", "vignette_from", "floor_shade", "aspect"]:
		check(names.has(want), "الشيدر ينقصه المتغير %s" % want)
	check(GC.VIGNETTE > 0.0 and GC.VIGNETTE < 1.0, "شدة حفّة الأطراف خارج المعقول")
	check(GC.VIGNETTE_NIGHT >= GC.VIGNETTE, "الليل ليس أقوى حفّة من النهار")
	check(GC.QUALITY_LOW_FPS < GC.QUALITY_BACK_FPS,
		"عتبة الإطفاء ليست أقل من عتبة الرجوع: سيتذبذب")

func _t_in_game() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 20:
		await process_frame

	# ---- 1. الشيدر يعمل، وأمر رسم الطبقة واحد لا أكثر ----
	check(g.wx.light_shader_on(), "الشيدر غير مفعّل في اللعبة")
	check(g.wx.material != null, "لم تُربط مادة الشيدر بطبقة الطقس")

	# ---- 2. لكل طقس ثوابته ----
	for w in ["day", "night", "rain", "snow"]:
		g.wx.set_kind(w)
		await process_frame
		var mat: ShaderMaterial = g.wx.material
		var tint: Color = mat.get_shader_parameter("tint")
		var want: Color = GC.WEATHER_OVERLAY.get(w, Color(0, 0, 0, 0))
		check(tint.is_equal_approx(want), "لون طبقة %s لم يصل الشيدر" % w)
		var vig: float = float(mat.get_shader_parameter("vignette"))
		check(is_equal_approx(vig, GC.VIGNETTE_NIGHT if w == "night" else GC.VIGNETTE),
			"شدة الحفّة في %s خطأ" % w)
	g.wx.set_kind("day")

	# ---- 3. الجودة التلقائية: أداء ضعيف يُطفئ الشيدر ----
	check(not g.light_auto_off, "الجودة التلقائية تبدأ مطفئة")
	_feed(g, 1.0 / 12.0)      # 12 إطاراً/ث
	check(g.light_auto_off, "لم يُطفأ الشيدر رغم ضعف الأداء")
	check(not g.wx.light_shader_on(), "الشيدر ما زال يعمل بعد قرار الإطفاء")
	check(g.wx.material == null, "المادة ما زالت مربوطة بعد الإطفاء")

	# ---- 4. ولا يرجع بمراجعة واحدة جيدة: منعاً للتذبذب ----
	_feed(g, 1.0 / 60.0)
	check(g.light_auto_off, "رجع الشيدر من أول مراجعة جيدة")
	# مراجعة سيئة تُصفّر العدّاد
	_feed(g, 1.0 / 12.0)
	_feed(g, 1.0 / 60.0)
	_feed(g, 1.0 / 60.0)
	check(g.light_auto_off, "رجع الشيدر رغم تصفير العدّاد بمراجعة سيئة")

	# ---- 5. ويرجع بعد مراجعات جيدة متتالية ----
	for i in GC.QUALITY_BACK_TIMES:
		_feed(g, 1.0 / 60.0)
	check(not g.light_auto_off, "لم يرجع الشيدر رغم تحسن الأداء")
	check(g.wx.light_shader_on(), "الشيدر لم يُعَد تفعيله")
	check(g.wx.material != null, "لم تُعَد مادة الشيدر بعد الرجوع")

	# ---- 6. وإطفاء الشيدر لا يكسر الرسم: الطبقة ترجع مسطّحة كما كانت ----
	g.wx.set_light_shader(false)
	g.wx.set_kind("night")
	for i in 3:
		await process_frame
	check(true, "")
	g.wx.set_light_shader(true)
	g.queue_free()
	await process_frame

# مراجعة واحدة بالضبط بمعدل إطارات ثابت. تُصفَّر المتراكمات أولاً حتى لا تختلط
# بإطارات اللعبة الحقيقية السريعة (بلا شاشة) فيصير القياس على عيّنة مخلوطة.
func _feed(g, dt: float, _secs: float = 0.0) -> void:
	g._q_t = 0.0
	g._q_sum = 0.0
	g._q_n = 0
	var t := 0.0
	while t <= GC.QUALITY_CHECK:
		g._auto_quality(dt)
		t += dt
