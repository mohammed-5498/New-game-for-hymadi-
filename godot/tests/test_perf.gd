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
	check(g.band_segs.size() == 2 * g.n - 1, "قطع المباني لا تغطي كل أقطار الخريطة")
	check(g.unit_bands.size() == 2 * g.n - 1, "عدد لوحات الوحدات لا يطابق أقطار الخريطة")
	check(g.map_segs.size() > g.band_segs.size(), "الأقطار لم تُقطَّع إلى قطع أصغر")
	check(g.top_layer != null and g.fire_layer != null, "الطبقة العليا أو طبقة النار غير موجودة")
	check(g.dist_bands.size() == g.districts.size(), "مدى أقطار الأحياء غير محسوب")

	# ---- 2. الخريطة الثابتة لا تُعاد في كل إطار ----
	g.map_draws = 0
	for i in 30:
		await process_frame
	check(g.map_draws == 0, "أُعيد رسم الخريطة الثابتة %d مرة في 30 إطاراً بلا سبب" % g.map_draws)

	# ---- 3. ولا حتى عند تحريك الكاميرا أو تقريبها ----
	g.map_draws = 0
	for i in 20:
		g.cam.position += Vector2(8, 5)
		g.cam.zoom = Vector2.ONE * (2.0 + float(i) * 0.05)
		await process_frame
	check(g.map_draws == 0, "تحريك الكاميرا أعاد رسم الخريطة الثابتة %d مرة" % g.map_draws)

	# ---- 4. تغيّر تلوين حي يعيد رسمها ----
	g.map_draws = 0
	g.districts_state.tint_dirty = true
	for i in 3:
		await process_frame
	check(g.map_draws > 0, "تغيّر التلوين لم يُعد رسم الخريطة الثابتة")

	# ---- 4ب. وينتهي الانتقال اللوني فيتوقف الرسم ----
	# الانتقال كان بـ lerp متدرج لا يصل هدفه أبداً، فتبقى الخريطة تُرسم كل إطار
	# إلى الأبد بعد أول استيلاء. هذا الفحص يمسك ذلك.
	var d: Dictionary = g.districts[0]
	g.districts_state._set_tint(d, 0, false)
	# الانتقال محسوب بالزمن لا بعدد الإطارات، وسرعة الإطارات بلا شاشة غير ثابتة،
	# فننتظر انتهاءه فعلاً بسقف أمان بدل عدد إطارات ثابت.
	var guard := 0
	while float(d["tint_t"]) < 1.0 and guard < 3000:
		guard += 1
		await process_frame
	check(guard < 3000, "لم ينتهِ الانتقال اللوني أبداً")
	check(float(d["tint_amt"]) == float(d["want_amt"]), "لم تصل شدة التلوين إلى هدفها")
	check(Color(d["tint_col"]) == Color(d["want_col"]), "لم يصل لون التلوين إلى هدفه")
	g.map_draws = 0
	for i in 40:
		await process_frame
	check(g.map_draws == 0, "بقيت الخريطة تُرسم (%d مرة) بعد انتهاء الانتقال اللوني" % g.map_draws)

	# ---- 4ج. تغيّر لون حي لا يعيد رسم الخريطة كلها ----
	var small: int = 0
	for k in g.districts.size():
		if int(g.districts[k]["size"]) < 20:
			small = k
			break
	var rng: Vector2i = g.dist_bands[small]
	var span: int = rng.y - rng.x + 1
	check(span < g.band_segs.size(), "مدى أقطار الحي يغطي الخريطة كلها")
	g.map_draws = 0
	g.districts_state._set_tint(g.districts[small], 0, false)
	var g2 := 0
	while float(g.districts[small]["tint_t"]) < 1.0 and g2 < 3000:
		g2 += 1
		await process_frame
	for i in 5:
		await process_frame
	# خطوات الانتقال × أقطار الحي، لا أقطار الخريطة × كل إطار
	# قطع القطر الواحد قد تكون عدة، فالسقف يُحسب بعددها الفعلي
	var segs := 0
	for b in range(rng.x, rng.y + 1):
		segs += g.band_segs[b].size()
	check(g.map_draws <= segs * (GC.TINT_STEPS + 2),
		"رسم %d قطعة لتغيّر لون حي واحد قطعه %d" % [g.map_draws, segs])

	# ---- 5. خريطة جديدة تبني اللوحات من جديد ----
	g.map_draws = 0
	g.generate_map()
	for i in 3:
		await process_frame
	check(g.map_draws > 0, "خريطة جديدة لم تُرسم")
	check(g.band_segs.size() == 2 * g.n - 1, "قطع الخريطة الجديدة لا تطابق حجمها")

	# ---- 5ب. القطع صغيرة الحدود حتى يقصّها المحرك وحده ----
	# القطر كله شريط مائل يعبر الخريطة: حدوده تغطيها كلها فلا يُقصّ. القطعة الصغيرة
	# حدودها ضيقة، وهذا وحده ما جعل محرك الرسم يتجاهل ما هو خارج الشاشة.
	var widest := 0.0
	for r2 in g.seg_rect:
		widest = maxf(widest, r2.size.x)
	var map_w: float = float(g.n) * GC.TW * 2.0
	check(widest < map_w * 0.5, "حدود القطعة %.0f بكسل من خريطة عرضها %.0f: واسعة جداً" % [widest, map_w])

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
