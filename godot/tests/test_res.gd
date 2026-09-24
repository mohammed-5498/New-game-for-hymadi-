extends SceneTree
# فحص دقة العرض حسب التقريب — القسم 14
#   godot --headless --path godot --script tests/test_res.gd
#
# الخطر الحقيقي هنا ليس الأداء بل **اللمس**: لو اختلّت مطابقة إحداثيات الشاشة
# بعد تغيير دقة العرض لصار اللاعب يلمس مكاناً وتذهب وحداته إلى غيره. فأهم
# مجموعة في هذا الملف هي التي تتأكد أن اللمسة تعطي نفس المربع في كل الخطوات.

var failures := 0

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	_t_numbers()
	await _t_ui_scale()
	await _t_in_game()
	if failures == 0:
		print("نجح فحص دقة العرض: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

func _t_numbers() -> void:
	check(GC.RES_STEPS.size() >= 2, "لا خطوات دقة")
	check(float(GC.RES_STEPS[0]) == 1.0, "أعلى خطوة ليست الدقة الكاملة")
	for i in range(1, GC.RES_STEPS.size()):
		check(float(GC.RES_STEPS[i]) < float(GC.RES_STEPS[i - 1]),
			"خطوات الدقة ليست متناقصة")
		check(float(GC.RES_STEPS[i]) >= 0.5, "خطوة دقة أقل من النصف: ستظهر مشوّهة")
	check(GC.RES_ZOOM_AT.size() == GC.RES_STEPS.size() - 1,
		"عدد حدود التقريب لا يطابق عدد الخطوات")
	for i in range(1, GC.RES_ZOOM_AT.size()):
		check(float(GC.RES_ZOOM_AT[i]) < float(GC.RES_ZOOM_AT[i - 1]),
			"حدود التقريب ليست متناقصة")
	check(GC.RES_HYST > 0.0, "بلا هامش تبديل سيتذبذب عند الحدّ")

# ---------- حجم الواجهة لا يتغير: المرجع هو دقة المشروع لا دقة الجهاز ----------
# **هذا الفحص موجود بسبب خطأ وقع فعلاً:** كان مرجع نظام التمدد يُؤخذ من حجم
# نافذة الجهاز، فصار على الجوال عالي الدقة مساوياً له، فسقط تكبير الواجهة من
# نحو ١٫٩× إلى ١٫٠ — وصغرت الكتابة. والفحص يجري على نافذة أكبر من دقة المشروع
# عمداً، وإلا لما ظهر الفرق أصلاً.
func _t_ui_scale() -> void:
	var proj := Vector2i(
		int(ProjectSettings.get_setting("display/window/size/viewport_width", 1280)),
		int(ProjectSettings.get_setting("display/window/size/viewport_height", 720)))
	var win := get_root()
	var before: Vector2i = win.content_scale_size
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 20:
		await process_frame
	# كامل التقريب: يجب أن يكون المرجع دقة المشروع بالضبط
	g.cam.zoom = Vector2(GC.ZOOM_MAX, GC.ZOOM_MAX)
	for i in 4:
		await process_frame
	check(win.content_scale_size == proj,
		"مرجع التمدد %s وليس دقة المشروع %s: ستصغر الكتابة على الأجهزة عالية الدقة"
		% [win.content_scale_size, proj])
	check(is_equal_approx(win.content_scale_factor, 1.0),
		"معامل المحتوى ليس 1 عند الدقة الكاملة")
	# وبعد الإبعاد والرجوع يبقى المرجع كما هو
	g.cam.zoom = Vector2(GC.ZOOM_MIN, GC.ZOOM_MIN)
	for i in 5:
		await process_frame
	var small: Vector2i = win.content_scale_size
	check(small.x < proj.x, "الإبعاد لم يخفّض دقة العرض")
	check(is_equal_approx(float(small.x) / float(proj.x), win.content_scale_factor),
		"المعامل لا يطابق نسبة التصغير، فالفضاء المنطقي سيختل")
	g.cam.zoom = Vector2(GC.ZOOM_MAX, GC.ZOOM_MAX)
	for i in 5:
		await process_frame
	check(win.content_scale_size == proj,
		"بعد الإبعاد والرجوع صار المرجع %s بدل %s" % [win.content_scale_size, proj])
	g.queue_free()
	await process_frame
	check(win.content_scale_size == proj or win.content_scale_size == before,
		"لم يُعَد المرجع بعد مغادرة المشهد")

func _t_in_game() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 20:
		await process_frame

	# ---- 1. التقريب الكامل = الدقة الكاملة، والإبعاد ينزل بها ----
	g.cam.zoom = Vector2(GC.ZOOM_MAX, GC.ZOOM_MAX)
	await _settle(g)
	check(g.res_step == 0, "أقصى تقريب لم يعطِ الدقة الكاملة (خطوة %d)" % g.res_step)
	g.cam.zoom = Vector2(GC.ZOOM_MIN, GC.ZOOM_MIN)
	await _settle(g)
	check(g.res_step == GC.RES_STEPS.size() - 1,
		"أقصى إبعاد لم يعطِ أدنى خطوة (خطوة %d)" % g.res_step)

	# ---- 2. وهي متدرجة لا قافزة: كل خطوة تُزار في الطريق ----
	var seen := {}
	var z := GC.ZOOM_MAX
	while z > GC.ZOOM_MIN:
		g.cam.zoom = Vector2(z, z)
		await _settle(g)
		seen[g.res_step] = true
		z -= 0.1
	check(seen.size() == GC.RES_STEPS.size(),
		"زُرن %d خطوة من %d أثناء الإبعاد" % [seen.size(), GC.RES_STEPS.size()])

	# ---- 3. لا تذبذب عند الحدّ: ذهاب وإياب حول الحدّ لا يبدّل كل مرة ----
	var edge: float = float(GC.RES_ZOOM_AT[0])
	var flips := 0
	var last: int = g.res_step
	for i in 12:
		g.cam.zoom = Vector2(edge + 0.02, edge + 0.02) if i % 2 == 0 \
			else Vector2(edge - 0.02, edge - 0.02)
		await _settle(g)
		if g.res_step != last:
			flips += 1
			last = g.res_step
	check(flips <= 1, "تبدّلت الدقة %d مرة عند الحدّ: الهامش لا يمنع التذبذب" % flips)

	# ---- 4. الأهم: اللمسة الواحدة تعطي نفس المربع مهما تغيّرت الدقة ----
	# اللعبة تستقبل إحداثيات **العرض** لا النافذة: المحرك يحوّل موضع اللمسة
	# الفيزيائي بـ get_final_transform قبل أن يصل إلى `_input`. فالفحص يمرّ بنفس
	# التحويل، وإلا فحص شيئاً لا يحدث في اللعبة.
	g.cam.zoom = Vector2(GC.ZOOM_START, GC.ZOOM_START)
	await _settle(g)
	# نوقف معالجة اللعبة: وإلا أعاد `_refresh_res` حساب الخطوة من التقريب في كل
	# إطار فألغى ما نضبطه، وصار الفحص يقيس حالة غير التي يظن
	g.set_process(false)
	var probes := [Vector2(40, 40), Vector2(300, 200), Vector2(640, 360), Vector2(900, 500)]
	var want := []
	for step in GC.RES_STEPS.size():
		g.res_step = step
		g._apply_res()
		for i in 3:
			await process_frame
		var inv: Transform2D = get_root().get_final_transform().affine_inverse()
		for k in probes.size():
			var got: Vector2i = g._tile_at(inv * probes[k])
			if step == 0:
				want.append(got)
			else:
				check(got == want[k],
					"لمسة %s أعطت المربع %s عند خطوة الدقة %d و %s عند الدقة الكاملة"
					% [probes[k], got, step, want[k]])

	# ---- 4ب. ومساحة العالم المرئية لا تتغير: الدقة تقلّ لا الرؤية ----
	var views := []
	g.set_process(false)
	for step in GC.RES_STEPS.size():
		g.res_step = step
		g._apply_res()
		for i in 3:
			await process_frame
		views.append(g._visible_rect().size)
	for k in range(1, views.size()):
		var d: Vector2 = Vector2(views[k]) - Vector2(views[0])
		check(d.length() < 4.0,
			"خطوة الدقة %d غيّرت مساحة الرؤية من %s إلى %s" % [k, views[0], views[k]])

	g.set_process(true)

	# ---- 5. الخروج من المشهد يرجع الدقة الكاملة ----
	g.queue_free()
	await process_frame
	await process_frame
	check(get_root().content_scale_mode == Window.CONTENT_SCALE_MODE_CANVAS_ITEMS,
		"لم ترجع الدقة الكاملة بعد مغادرة المشهد")
	check(is_equal_approx(get_root().content_scale_factor, 1.0),
		"لم يرجع معامل المحتوى بعد مغادرة المشهد")

func _settle(g) -> void:
	for i in 3:
		await process_frame
