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

	# ---- 3. الشيدر لا يُطفأ ولا يُشغَّل من تلقاء نفسه أثناء اللعب ----
	# كانت جودة تلقائية تُطفئه عند هبوط الإطارات وتُرجعه، فكانت الهالة السوداء
	# تختفي وتعود أمام اللاعب. شيء يظهر ويختفي أسوأ من بضعة بالمئة من الأداء.
	for i in 40:
		await process_frame
	check(g.wx.light_shader_on(), "انطفأ الشيدر من تلقاء نفسه أثناء اللعب")
	check(g.wx.material != null, "فُقدت مادة الشيدر أثناء اللعب")

	g.queue_free()
	await process_frame
