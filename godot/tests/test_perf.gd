extends SceneTree
# فحص الأداء — القسم 14
#   godot --headless --path godot --script tests/test_perf.gd
#
# لا يقيس زمناً (يختلف من جهاز لآخر) بل يثبّت القواعد التي جعلت اللعبة سريعة:
#   1. الخريطة الثابتة لا يُعاد رسمها في كل إطار، ولا حتى عند تحريك الكاميرا.
#   2. يُعاد رسمها فعلاً عند تغيّر تلوين حي أو عند خريطة جديدة.
#   3. لا تُرسم وحدة خارج الشاشة.

var failures := 0

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	await _run()
	if failures == 0:
		print("نجح فحص الأداء: لا أخطاء.")
	else:
		printerr("فشل فحص الأداء: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

func _run() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 20:
		await process_frame

	# ---- 1. اللوحات موجودة بعدد الأقطار ----
	check(g.map_bands.size() == 2 * g.n - 1, "عدد لوحات المباني لا يطابق أقطار الخريطة")
	check(g.unit_bands.size() == 2 * g.n - 1, "عدد لوحات الوحدات لا يطابق أقطار الخريطة")
	check(g.ground_layer != null and g.top_layer != null, "لوحة الأرض أو الطبقة العليا غير موجودة")

	# ---- 2. الخريطة الثابتة لا تُعاد في كل إطار ----
	g.map_draws = 0
	for i in 30:
		await process_frame
	check(g.map_draws == 0, "أُعيد رسم الخريطة الثابتة %d مرة في 30 إطاراً بلا سبب" % g.map_draws)

	# ---- 3. ولا حتى عند تحريك الكاميرا أو تقريبها ----
	g.map_draws = 0
	for i in 20:
		g.cam.position += Vector2(6, 4)
		g.cam.zoom = Vector2.ONE * (2.0 + float(i) * 0.05)
		await process_frame
	check(g.map_draws == 0, "تحريك الكاميرا أعاد رسم الخريطة الثابتة %d مرة" % g.map_draws)

	# ---- 4. تغيّر تلوين حي يعيد رسمها ----
	g.map_draws = 0
	g.districts_state.tint_dirty = true
	for i in 3:
		await process_frame
	check(g.map_draws > 0, "تغيّر التلوين لم يُعد رسم الخريطة الثابتة")

	# ---- 5. خريطة جديدة تبني اللوحات من جديد ----
	g.map_draws = 0
	g.generate_map()
	for i in 3:
		await process_frame
	check(g.map_draws > 0, "خريطة جديدة لم تُرسم")
	check(g.map_bands.size() == 2 * g.n - 1, "لوحات الخريطة الجديدة لا تطابق حجمها")

	# ---- 6. الوحدات خارج الشاشة لا تُرسم ----
	g.combat.clear()
	var far: Vector2 = g.world_to_tile(g.cam.position) + Vector2(60, 60)
	for k in 12:
		g.combat.spawn("crow_common", 0, 0, far + Vector2(k * 0.5, 0))
	for i in 4:
		await process_frame
	check(g.unit_draws == 0, "رُسمت %d وحدة خارج الشاشة" % g.unit_draws)

	# ---- 7. والوحدات داخل الشاشة تُرسم ----
	var near: Vector2 = g.world_to_tile(g.cam.position)
	for k in 6:
		g.combat.spawn("crow_common", 0, 0, near + Vector2(float(k) * 0.4 - 1.0, 0))
	for i in 4:
		await process_frame
	check(g.unit_draws >= 6, "لم تُرسم الوحدات التي أمام الكاميرا (%d)" % g.unit_draws)

	# ---- 8. مؤشر الإطارات يعمل (14) ----
	check(not g.show_fps, "مؤشر الإطارات يبدأ ظاهراً")
	g.show_fps = true
	g._refresh_info()
	check(g.info.text.contains("إطار/ث"), "مؤشر الإطارات لا يظهر في شريط المعلومات")
	g.show_fps = false
	g._refresh_info()
	check(not g.info.text.contains("إطار/ث"), "مؤشر الإطارات لا ينطفئ")
	g.queue_free()
	await process_frame
