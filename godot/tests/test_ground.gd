extends SceneTree
# فحص أرض الخريطة في MultiMesh — القسم 14 (الأداء)
#   godot --headless --path godot --script tests/test_ground.gd
#   (يحتاج شاشة: يُشغَّل تحت Xvfb في CI، لأنه يعدّ البكسلات ويقيس أوامر الرسم)
#
# **لماذا هذا الفحص موجود:** استبدال ألف وستمئة أمر رسم بأمرَين مكسبٌ كبير،
# لكنه يمسّ أكثر شيء يراه اللاعب: أرض الخريطة كلها. وثلاثة أشياء قد تنكسر
# بصمت ولا يكشفها أي فحص منطقي:
#   1. **فراغ بين المربعات.** الطريقة القديمة كانت تتبع كل معيّن بخط بلونه
#      يسدّ الفراغ. هنا كبّرنا المعيّن بدل الخط — فإن أخطأنا الحساب ظهرت
#      خطوط الخلفية بين المربعات. يُفحص بلون خلفية صارخ وعدّ بكسلاته.
#   2. **لون خاطئ**، أو لون حي لا يتحدّث عند الاستيلاء عليه.
#   3. **ترتيب خاطئ**: الأرض يجب أن تبقى تحت النار والمباني والوحدات.
# ولذلك يقيس هذا الفحص ما يظهر على الشاشة، لا ما أرسله الكود للرسم.

var failures := 0

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	await _run()
	if failures == 0:
		print("نجح فحص أرض MultiMesh: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# لون صارخ لا يشبه أي لون أرض: كل بكسل بهذا اللون = فراغ لم تغطه الأرض
const VOID := Color(1, 0, 1)

func _void_pixels(img: Image, r: Rect2i) -> int:
	var c := 0
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			var p: Color = img.get_pixel(x, y)
			if p.r > 0.85 and p.g < 0.15 and p.b > 0.85:
				c += 1
	return c

func _avg_calls(n: int) -> float:
	var d := 0.0
	for i in n:
		await process_frame
		d += Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	return d / float(n)

func _run() -> void:
	var ms := MatchSetup.load_saved()
	var old_size: String = ms.size_key
	ms.size_key = "large"     # الخريطة الكبيرة: أكثر ما يظهر فيه المكسب
	ms.save()
	RenderingServer.set_default_clear_color(VOID)
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 40:
		await process_frame
	g.combat.clear()

	# 1) المخزن موجود وفيه نسخة لكل مربع
	check(GC.GROUND_MM, "GC.GROUND_MM مطفأ: الفحص لن يقيس شيئاً")
	check(g.ground_mm != null, "لم تُبنَ عقدة الأرض")
	if g.ground_mm == null:
		return
	var total: int = g.n * g.n
	check(g.ground_mm.fill.multimesh.instance_count == total,
		"عدد نسخ الأرض %d والمربعات %d" % [g.ground_mm.fill.multimesh.instance_count, total])

	# 2) علامات الشوارع: نسخة لكل مربع فيه علامة، ولا واحدة زائدة
	var want_dash := 0
	for k in total:
		if int(g.dash[k]) != 0:
			want_dash += 1
	check(g.ground_mm.dashes.multimesh.instance_count == want_dash,
		"علامات الشوارع %d والمتوقع %d" % [g.ground_mm.dashes.multimesh.instance_count, want_dash])
	check(want_dash > 0, "لا علامات شوارع في هذه الخريطة: البند لم يُفحص")

	# 3) لون كل نسخة = لون المربع كما تحسبه اللعبة.
	# المخزن يحفظ اللون بدقة نصفية، فالفرق المقبول 0.005 لا صفر (المقيس ~0.0003).
	var wrong := 0
	var worst := 0.0
	for k in total:
		var got: Color = g.ground_mm.fill.multimesh.get_instance_color(k)
		var want: Color = g.ground_color(k)
		var e: float = maxf(maxf(absf(got.r - want.r), absf(got.g - want.g)), absf(got.b - want.b))
		worst = maxf(worst, e)
		if e > 0.005:
			wrong += 1
	check(wrong == 0, "%d مربع لونه لا يطابق ground_color (أسوأ فرق %.4f)" % [wrong, worst])

	# 4) تلوين حي واحد عند الاستيلاء عليه: يتغيّر هو ولا يتغيّر غيره
	var d := -1
	for i in g.districts.size():
		if g.ground_mm.dist_tiles[i].size() > 4:
			d = i
			break
	check(d >= 0, "لا حي فيه مربعات كافية للفحص")
	if d >= 0:
		var before: Array = []
		for k in total:
			before.append(g.ground_mm.fill.multimesh.get_instance_color(k))
		var dd: Dictionary = g.districts[d]
		var old_amt: float = float(dd.get("tint_amt", 0.0))
		dd["tint_amt"] = 1.0 if old_amt < 0.5 else 0.0
		g.redraw_district(d)
		var changed := 0
		var leaked := 0
		for k in total:
			var now: Color = g.ground_mm.fill.multimesh.get_instance_color(k)
			var was: Color = before[k]
			var same: bool = maxf(maxf(absf(now.r - was.r), absf(now.g - was.g)),
				absf(now.b - was.b)) <= 0.005
			if int(g.owner_dist[k]) == d:
				if not same:
					changed += 1
			elif not same:
				leaked += 1
		check(changed > 0, "لون الحي لم يتغيّر عند الاستيلاء عليه")
		check(leaked == 0, "%d مربع خارج الحي تغيّر لونه" % leaked)
		dd["tint_amt"] = old_amt
		g.redraw_district(d)

	# 5) الأرض أول الأبناء، فتبقى تحت النار والمباني والوحدات والطقس والواجهة
	check(g.get_child(0) == g.ground_mm,
		"عقدة الأرض ليست أول الأبناء، فقد ترتفع فوق ما يجب أن يعلوها")

	# 6) لا فراغ بين المربعات. الكاميرا في وسط الخريطة، ولون الخلفية صارخ،
	# فكل بكسل منه داخل الخريطة فراغٌ تركته الأرض.
	# **النافذة مهمة:** أول محاولة كانت مربعاً صغيراً في وسط الشاشة، فوقع على
	# شجرة فلم يقِس الفحص أرضاً أصلاً ونجح وهو لا يحرس شيئاً. والشاشة كلها لا
	# تصلح أيضاً: عند التصغير تصغر الخريطة عن الشاشة فتظهر الخلفية حولها بحق.
	# فالنافذة هنا أكبر مساحة تبقى داخل معيّن الخريطة حتى عند أقصى تصغير:
	# ‏280×140 حول المركز، وشرطها w/(n·TW·z) + h/(n·TH·z) < 1 عند ZOOM_MIN.
	var mid := Vector2(float(g.n) * 0.5, float(g.n) * 0.5)
	var win: Vector2i = Vector2i(get_root().size)
	var box := Rect2i(win / 2 - Vector2i(280, 140), Vector2i(560, 280))
	for z in [GC.ZOOM_MAX, GC.ZOOM_START, 1.0, GC.ZOOM_MIN]:
		g.cam.zoom = Vector2(z, z)
		g.cam.position = g.tile_to_world(mid)
		for f in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		var holes: int = _void_pixels(get_root().get_texture().get_image(), box)
		# المقيس: صفر بالكود الصحيح، ونحو 7000 لو صغر المعيّن 10%
		check(holes == 0, "عند تقريب %.2f ظهر %d بكسل فراغ بين مربعات الأرض" % [z, holes])

	# 7) المكسب الحقيقي: أوامر الرسم مع المخزن أقل بكثير منها بدونه، نفس الخريطة
	g.cam.zoom = Vector2(GC.ZOOM_START, GC.ZOOM_START)
	for f in 20:
		await process_frame
	var with_mm: float = await _avg_calls(60)
	var node = g.ground_mm
	g.ground_mm = null
	node.queue_free()
	g.redraw_map()
	for f in 20:
		await process_frame
	var without: float = await _avg_calls(60)
	# المقيس على خريطة 42×42: نحو 3785 بلا المخزن مقابل 2277 معه (أقل بـ 40%).
	# العتبة 25% تترك هامشاً واسعاً لاختلاف الخرائط العشوائية.
	var gain: float = (without - with_mm) / maxf(1.0, without) * 100.0
	check(gain > 25.0,
		"أوامر الرسم: %.0f بلا المخزن مقابل %.0f معه (وفر %.0f%% فقط)" % [without, with_mm, gain])
	print("  أوامر الرسم: %.0f -> %.0f (وفر %.0f%%)" % [without, with_mm, gain])

	g.queue_free()
	await process_frame
	ms.size_key = old_size    # لا نترك أثراً على الإعداد المحفوظ لبقية الفحوص
	ms.save()
