extends SceneTree
# فحص أن الوحدات تظهر فعلاً على الشاشة — القسم 14
#   godot --headless --path godot --script tests/test_cull.gd
#   (يحتاج شاشة: يُشغَّل تحت Xvfb في CI)
#
# **لماذا هذا الفحص موجود:** كانت الوحدات تختفي بالكامل عند تحريك الكاميرا أو
# تقريبها. السبب أن المحرك يقصّ اللوحة إن وقعت حدودها خارج الشاشة، وهو **لا
# يحسب موضع أمر `draw_mesh`** بل يأخذ حدود الشبكة حول أصلها. فكانت حدود لوحات
# الوحدات تبقى عند أصل الخريطة وتُقصّ كلها.
# وفحوص الأداء السابقة كانت تعدّ "كم وحدة أُرسلت للرسم" لا "كم ظهرت"، فمرّ الخطأ.
# هذا الفحص يعدّ البكسلات الملوّنة على الشاشة، فلا يمكن أن يمرّ مثله ثانية.
#
# ملاحظة مهمة: المرجع هنا هو **عدد الوحدات داخل الرؤية** لا `unit_draws`. فحين
# تُقصّ اللوحة لا يُستدعى `_draw` أصلاً ولا يزيد `unit_draws`، فلو جعلناه المرجع
# لعطّل الفحص نفسه في اللحظة التي يقع فيها الخطأ بالضبط.

var failures := 0

# مساحة الوحدة على الشاشة تتناسب مع **مربع** التقريب، فكذلك العتبة.
# مقيس على أحد عشر مستوى تقريب: بعد الإصلاح نحو 6.25 × z²، وقبله أقل من 10 دائماً
# مهما زاد التقريب (لأن اللوحة تُقصّ فلا تُرسم أصلاً). فعتبة 2.8 × z² تفصل بوضوح:
#   تقريب 2.28 → العتبة 14.6 | بعد الإصلاح 26.5 | قبله 2.0
#   تقريب 4.50 → العتبة 56.7 | بعد الإصلاح 95.5 | قبله 9.9
# وعند أقصى تصغير (0.80) تظهر الخريطة كلها فيدخل أصلها في الرؤية ولا يقع الخطأ
# أصلاً، ولذلك تتقارب القيمتان هناك — والعتبة المتناسبة تقبل الحالتين بحق.
const PX_PER_UNIT_K := 2.8

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	await _run()
	if failures == 0:
		print("نجح فحص ظهور الوحدات: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

func _run() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 30:
		await process_frame

	# **بعيداً عن أصل الخريطة عن قصد.** موضع أصل الخريطة في العالم هو (0,0)، وظهور
	# الخطأ من عدمه كان يعتمد على ما إذا صادف أن الأصل داخل الشاشة — ولهذا كان
	# يظهر "أحياناً". نجبر الشرط هنا: زاوية الخريطة البعيدة، حيث y = (i+j) × 9.
	g.combat.clear()
	var far_tile := Vector2i(g.n - 5, g.n - 5)
	var spots: Array = g._free_near(far_tile, 60)
	check(spots.size() > 0, "لا مربعات حرة في زاوية الخريطة")
	g.cam.position = g.tile_to_world(Vector2(float(spots[0].x), float(spots[0].y)))
	g.cam.zoom = Vector2(GC.ZOOM_START, GC.ZOOM_START)
	var origin_dist: float = g.cam.position.distance_to(Vector2.ZERO)
	check(origin_dist > 200.0,
		"الكاميرا قريبة من أصل الخريطة (%.0f) فلن يظهر الخطأ أصلاً" % origin_dist)
	check(spots.size() > 20, "لم أجد مربعات حرة كافية")
	var placed := 0
	for k in mini(24, spots.size()):
		var t: Vector2i = spots[k]
		var u: Dictionary = g.combat.spawn("crow_common", g.me, 0, Vector2(float(t.x), float(t.y)))
		u["hp"] = 1.0e9
		u["max_hp"] = 1.0e9
		placed += 1
	check(placed > 12, "لم تُنشأ وحدات كافية")

	# مسح تقريب/إبعاد كامل: في كل خطوة يجب أن تُرسم وحدات **وتظهر بكسلاتها**
	var worst_z := 0.0
	var bad := 0
	var checked := 0
	for i in 11:
		var z: float = GC.ZOOM_MIN + (GC.ZOOM_MAX - GC.ZOOM_MIN) * float(i) / 10.0
		g.cam.zoom = Vector2(z, z)
		g.cam.position = g.tile_to_world(Vector2(float(spots[0].x), float(spots[0].y)))
		for f in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		var px := _unit_pixels(get_root().get_texture().get_image(), g)
		checked += 1
		# المقياس: بكسلات لكل وحدة داخل الرؤية. مع القصّ الخاطئ تنجو وحدة أو
		# وحدتان فقط (قِيس: 1.1 بكسل لكل وحدة مقابل 27 بعد الإصلاح).
		var seen: int = _in_view(g)
		if seen > 0 and float(px) / float(seen) < PX_PER_UNIT_K * z * z:
			bad += 1
			worst_z = z
	check(checked == 11, "لم يكتمل المسح")
	check(bad == 0, "عند %d مستوى تقريب من 11 وحداتٌ داخل الرؤية ولم تظهر (آخرها تقريب %.2f)" % [bad, worst_z])
	check(_in_view(g) > 0, "لا وحدة داخل الرؤية أصلاً: الفحص لم يقِس شيئاً")

	# ومع تحريك الكاميرا بعيداً عن أصل الخريطة
	g.cam.zoom = Vector2(GC.ZOOM_START, GC.ZOOM_START)
	var moved_bad := 0
	for step in 6:
		g.cam.position = g.tile_to_world(Vector2(
			float(spots[0].x) + float(step) * 1.5, float(spots[0].y) + float(step) * 1.5))
		for f in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		var seen2: int = _in_view(g)
		var px2: int = _unit_pixels(get_root().get_texture().get_image(), g)
		var zc: float = g.cam.zoom.x
		if seen2 > 0 and float(px2) / float(seen2) < PX_PER_UNIT_K * zc * zc:
			moved_bad += 1
	check(moved_bad == 0, "عند %d موضع كاميرا وحداتٌ داخل الرؤية ولم تظهر" % moved_bad)

	g.queue_free()
	await process_frame

# كم وحدة داخل ما تراه الكاميرا الآن (هذا هو ما يجب أن يظهر)
func _in_view(g) -> int:
	var n := 0
	for b in g.band_units:
		n += b.size()
	return n

# بكسلات بلون اللاعب: مشبعة، بخلاف الأرض والمباني الباهتة
func _unit_pixels(img: Image, g) -> int:
	var want: Color = g._owner_color(g.me)
	var n := 0
	for y in range(0, img.get_height(), 2):
		for x in range(0, img.get_width(), 2):
			var c := img.get_pixel(x, y)
			# قريب من لون اللاعب أو من تظليله الداكن
			if absf(c.r - want.r) < 0.14 and absf(c.g - want.g) < 0.14 and absf(c.b - want.b) < 0.14:
				n += 1
	return n
