extends SceneTree
# فحص مخزن أشكال الوحدات — القسم 14
#   godot --headless --path godot --script tests/test_mesh.gd

var failures := 0

class Probe:
	extends Node2D
	var art := UnitsArt.new()
	var um := UnitMesh.new()
	var owner_ref = null
	func _draw() -> void:
		owner_ref._run(self)

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	_t_phase_math()
	_t_frame_math()
	await _t_in_draw()
	if failures == 0:
		print("نجح فحص مخزن الأشكال: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الطور: دوري يلتف، وقصير يتوقف عند النهاية ----------
func _t_phase_math() -> void:
	# المشي دوري: زمن ضعف الدورة يعطي نفس الطور
	var per: float = 1.0 / (2.55 * 1.0)
	check(absf(UnitMesh.phase_of("walk", 0.0, 1.0, 1.0)) < 0.001, "طور المشي عند الصفر ليس صفراً")
	check(absf(UnitMesh.phase_of("walk", per, 1.0, 1.0)) < 0.001, "طور المشي لا يلتف بعد دورة")
	check(absf(UnitMesh.phase_of("walk", per * 3.0, 1.0, 1.0)) < 0.001, "طور المشي لا يلتف بعد ثلاث دورات")
	check(absf(UnitMesh.phase_of("walk", per * 0.5, 1.0, 1.0) - 0.5) < 0.001, "منتصف دورة المشي ليس 0.5")
	# سرعة الوحدة تدخل في الطور، فوحدتان بسرعتين مختلفتين لا تتطابقان
	check(UnitMesh.phase_of("walk", 0.2, 1.0, 1.0) != UnitMesh.phase_of("walk", 0.2, 1.3, 1.0),
		"سرعة الوحدة لا تؤثر في طور المشي")
	# القتال دوري بزمن الضربة
	check(absf(UnitMesh.phase_of("attack", 1.4, 1.0, 1.4) ) < 0.001, "طور القتال لا يلتف بزمن الضربة")
	check(absf(UnitMesh.phase_of("attack", 0.7, 1.0, 1.4) - 0.5) < 0.001, "منتصف دورة الضربة ليس 0.5")
	# القصير يتوقف عند 1 ولا يلتف: الجثة لا ترجع لبداية سقوطها
	check(UnitMesh.phase_of("death", UnitsArt.DEATH_DUR * 5.0, 1.0, 1.0) == 1.0, "طور الموت التف بدل أن يقف")
	check(UnitMesh.phase_of("hurt", UnitsArt.HURT_DUR * 9.0, 1.0, 1.0) == 1.0, "طور الإصابة التف")
	check(UnitMesh.phase_of("stagger", UnitsArt.STAGGER_DUR, 1.0, 1.0) == 1.0, "طور الترنّح لا يبلغ نهايته")
	check(absf(UnitMesh.phase_of("dodge", UnitsArt.DODGE_DUR * 0.5, 1.0, 1.0) - 0.5) < 0.001,
		"منتصف التفادي ليس 0.5")

# ---------- الطور -> رقم الشكل: داخل المدى دائماً، ومتدرج ----------
func _t_frame_math() -> void:
	for st in UnitMesh.FRAMES.keys():
		var n: int = int(UnitMesh.FRAMES[st])
		check(n >= 4, "عدد أطوار %s أقل من أربعة: الأنميشن سيتقطّع" % st)
		var seen := {}
		for i in 400:
			var ph: float = float(i) / 399.0
			var f: int = UnitMesh.frame_of(st, ph)
			check(f >= 0 and f < n, "شكل %s خارج المدى عند طور %.3f" % [st, ph])
			seen[f] = true
		check(seen.size() == n, "حالة %s تستعمل %d شكلاً من %d المخزّنة" % [st, seen.size(), n])
	# الدوري يلتف عند 1.0 إلى الشكل الأول، والقصير يقف عند الأخير
	check(UnitMesh.frame_of("walk", 0.0) == UnitMesh.frame_of("walk", 1.0), "المشي لا يلتف بين الطور 1 و 0")
	check(UnitMesh.frame_of("death", 1.0) == int(UnitMesh.FRAMES["death"]) - 1, "الموت لا ينتهي عند آخر شكل")
	check(not UnitMesh.supports("ult"), "الضربة المميزة يجب ألا تُخزَّن: توهّجها متغيّر")
	check(UnitMesh.supports("walk") and UnitMesh.supports("attack"), "المشي والقتال غير مخزّنين")

func _t_in_draw() -> void:
	var p := Probe.new()
	p.owner_ref = self
	root.add_child(p)
	for i in 4:
		await process_frame
	p.queue_free()
	await process_frame

# يعمل داخل _draw لأن draw_mesh لا يُستدعى إلا هناك
func _run(p) -> void:
	var art: UnitsArt = p.art
	var um: UnitMesh = p.um

	# ---- 1. كل حالة وكل طور تُبنى بلا فشل وبمثلثات صحيحة ----
	# أربعة مفاتيح تكفي للتغطية وتبقى تحت سقف الذاكرة، والسقف له فحصه وحده
	var bad := 0
	var empty := 0
	var want := 0
	for key in ["crow_common", "hammer_shield", "viper_sniper", "scorp_hero"]:
		for st in UnitMesh.FRAMES.keys():
			var moves: Array = ([""] + GC.MOVE_ORDER) if st == "attack" else [""]
			for mv in moves:
				for f in int(UnitMesh.FRAMES[st]):
					want += 1
					var m := um.mesh_for(art, key, st, mv, f, Color("8a5cc7"))
					if m == null:
						bad += 1
						continue
					if m.get_surface_count() != 1:
						empty += 1
	check(bad == 0, "%d شكل من %d لم يُبنَ" % [bad, want])
	check(empty == 0, "%d شكل بلا سطح رسم" % empty)
	check(um.full == 0, "بلغ المخزن سقفه في أربعة مفاتيح فقط")
	check(um.size() == want, "عدد الأشكال %d والمطلوب %d" % [um.size(), want])
	print("   مفتاح واحد بكل حالاته = %.2f ميجا" % (float(um.bytes()) / 1048576.0 / 4.0))

	# ---- 2. المسجّل يعطي مثلثات صحيحة: فهارس داخل المدى وعدد يقبل القسمة على 3 ----
	var rec := UnitMesh.Recorder.new()
	art.draw_unit(rec, "crow_common", Vector2.ZERO, 0.3, "walk", Color("8a5cc7"), 1, 1.0, 1.0, "", 0.0)
	check(rec.pts.size() > 50, "المسجّل لم يلتقط شكلاً")
	check(rec.pts.size() == rec.cols.size(), "عدد الألوان لا يطابق عدد الرؤوس")
	check(rec.idx.size() % 3 == 0, "عدد الفهارس لا يقبل القسمة على 3")
	var out_of_range := 0
	for i in rec.idx:
		if i < 0 or i >= rec.pts.size():
			out_of_range += 1
	check(out_of_range == 0, "%d فهرس خارج مدى الرؤوس" % out_of_range)
	# وشكل الوحدة في مكانه: حول نقطة الأصل وبارتفاع معقول
	var lo := Vector2(9999, 9999)
	var hi := Vector2(-9999, -9999)
	for v in rec.pts:
		lo = Vector2(minf(lo.x, v.x), minf(lo.y, v.y))
		hi = Vector2(maxf(hi.x, v.x), maxf(hi.y, v.y))
	check(hi.y > -3.0 and hi.y < 6.0, "قدما الوحدة ليستا عند الأصل (%.1f)" % hi.y)
	check(lo.y < -18.0 and lo.y > -45.0, "طول الوحدة غير معقول (%.1f)" % lo.y)
	check(hi.x - lo.x > 8.0 and hi.x - lo.x < 60.0, "عرض الوحدة غير معقول")

	# ---- 3. نفس الطلب مرتين = بناء واحد واستعمال مخزَّن ----
	var before := um.builds
	var h0 := um.hits
	for i in 50:
		um.mesh_for(art, "crow_common", "walk", "", 2, Color("8a5cc7"))
	check(um.builds == before, "أُعيد بناء شكل مخزَّن")
	check(um.hits == h0 + 50, "لم تُحسب استعمالات المخزَّن")

	# ---- 4. لون مختلف = شكل مختلف (ألوان اللاعبين لا تختلط) ----
	var b2 := um.builds
	var m_a := um.mesh_for(art, "crow_common", "walk", "", 2, Color("2ea8a0"))
	check(um.builds == b2 + 1, "لونان مختلفان تقاسما نفس الشكل")
	check(m_a != um.mesh_for(art, "crow_common", "walk", "", 2, Color("8a5cc7")),
		"اللونان أعطيا نفس الشكل بعينه")
	# وحركة مختلفة كذلك: قوس الضربة يختلف بين الحركات (5.4.2)
	var fresh := Color("c7a03a")     # لون لم يُبنَ به شيء بعد
	var b3 := um.builds
	var m_h := um.mesh_for(art, "crow_common", "attack", "heavy", 3, fresh)
	var m_t := um.mesh_for(art, "crow_common", "attack", "thrust", 3, fresh)
	check(um.builds == b3 + 2, "حركتان مختلفتان تقاسمتا نفس الشكل")
	check(m_h != m_t, "الحركتان أعطتا نفس الشكل بعينه")

	# ---- 5. الرسم نفسه: يرجع true للحالات المخزّنة و false لغيرها ----
	check(um.draw(p, art, "crow_common", Vector2(10, 10), 0.3, "walk",
		Color("8a5cc7"), 1, 0.62, 1.0, ""), "الرسم من المخزن فشل لحالة مدعومة")
	check(not um.draw(p, art, "crow_common", Vector2(10, 10), 0.3, "ult",
		Color("8a5cc7"), 1, 0.62, 1.0, ""), "الضربة المميزة رُسمت من المخزن")
	check(not um.draw(p, art, "لا_يوجد", Vector2(10, 10), 0.3, "walk",
		Color("8a5cc7"), 1, 0.62, 1.0, ""), "مفتاح غير موجود لم يُرفض")

	# ---- 6. سقف الذاكرة يُحترم ولا ينهار بعده ----
	var small := UnitMesh.new()
	var cap: float = GC.MESH_CACHE_MB * 1048576.0
	var n := 0
	for key in GC.UNIT_KEYS:
		for st in UnitMesh.FRAMES.keys():
			for c in 40:
				small.mesh_for(art, key, st, "", 0, Color(float(c) / 40.0, 0.3, 0.7))
				n += 1
				if small.full > 0:
					break
			if small.full > 0:
				break
		if small.full > 0:
			break
	if small.full > 0:
		check(float(small.bytes()) <= cap * 1.05, "تجاوز المخزن سقفه: %.1f من %.1f ميجا" % [
			float(small.bytes()) / 1048576.0, GC.MESH_CACHE_MB])
		check(not small.draw(p, art, "crow_common", Vector2.ZERO, 0.3, "death",
			Color(0.11, 0.22, 0.33), 1, 0.62, 1.0, ""), "بعد بلوغ السقف لم يُرفض شكل جديد")
	else:
		check(float(small.bytes()) < cap, "لم يُبلغ السقف ومع ذلك تجاوزته الذاكرة")

	# ---- 7. المباراة الفعلية لا تقترب من السقف ----
	# لاعب واحد يستعمل عصابة واحدة: أربعة مفاتيح. وهذا ما قِيس في مباراة حقيقية.
	var mb: float = float(um.bytes()) / 1048576.0
	print("   أربعة مفاتيح بكل الحالات والحركات = %.1f ميجا (السقف %.0f)" % [mb, GC.MESH_CACHE_MB])
	check(mb < GC.MESH_CACHE_MB * 0.5, "عصابة واحدة وحدها تجاوزت نصف السقف")
