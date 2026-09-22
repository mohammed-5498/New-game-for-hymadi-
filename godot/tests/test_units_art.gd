extends SceneTree
# يستدعي رسم كل مفتاح في كل حالة وعند أزمنة مختلفة، للتأكد أن لا مسار رسم ينهار.
#   godot --headless --path godot --script tests/test_units_art.gd

class Probe:
	extends Node2D
	var art := UnitsArt.new()
	var calls := 0
	var times := [0.0, 0.12, 0.33, 0.45, 0.52, 0.7, 0.95, 1.4, 2.6]
	func _draw() -> void:
		var x := 0.0
		for key in GC.UNIT_KEYS:
			for state in GC.UNIT_STATES:
				for t in times:
					for dir in [1, -1]:
						art.draw_unit(self, key, Vector2(x, 0), t, state,
							Color("8a5cc7"), dir, 0.62, 1.15)
						calls += 1
						x += 0.01
		# وبأحجام شاشة مختلفة حتى تُسلك مسارات تفصيل الرسم كلها (14)
		for px in [0.0, 0.5, 1.36, 2.79]:
			for key in GC.UNIT_KEYS:
				art.draw_unit(self, key, Vector2(x, 0), 0.3, "walk",
					Color("8a5cc7"), 1, 0.62, 1.0, "", px)
				x += 0.01
		# مفتاح غير موجود يجب أن يُتجاهل بلا انهيار
		art.draw_unit(self, "لا_يوجد", Vector2.ZERO, 1.0, "idle", Color.WHITE, 1, 1.0, 1.0)
		art.draw_ready_mark(self, Vector2.ZERO, 0.62)

func _initialize() -> void:
	var p := Probe.new()
	root.add_child(p)
	_run(p)

func _run(p) -> void:
	for i in 4:
		await process_frame
	p.calls = 0          # نتجاهل رسم الإطار الأول ونقيس دورة واحدة بالضبط
	p.queue_redraw()
	for i in 2:
		await process_frame

	var expected: int = GC.UNIT_KEYS.size() * GC.UNIT_STATES.size() * 9 * 2
	var ok := true
	if GC.UNIT_KEYS.size() != 18:
		printerr("عدد مفاتيح الرسم %d والمطلوب 18" % GC.UNIT_KEYS.size())
		ok = false
	for key in GC.UNIT_KEYS:
		if not UnitsArt.UNITS.has(key):
			printerr("مفتاح %s غير معرّف في UnitsArt" % key)
			ok = false
		if not GC.UNIT_NAMES.has(key) or not GC.UNIT_GANG.has(key):
			printerr("مفتاح %s ناقص اسم أو عصابة في config" % key)
			ok = false
	for key in UnitsArt.UNITS.keys():
		if not GC.UNIT_KEYS.has(key):
			printerr("مفتاح %s في UnitsArt وغير مذكور في config" % key)
			ok = false
	if p.calls == 0:
		print("تنبيه: _draw لم يُستدعَ في الوضع بلا شاشة، فحص المفاتيح فقط.")
	elif p.calls != expected:
		printerr("عدد استدعاءات الرسم %d والمتوقع %d" % [p.calls, expected])
		ok = false
	else:
		print("رُسمت %d حالة بلا أخطاء (18 وحدة × %d حالات × %d أزمنة × اتجاهين)" % [
			p.calls, GC.UNIT_STATES.size(), p.times.size()])

	# ---- تفصيل الرسم حسب الحجم على الشاشة (14) ----
	var art := UnitsArt.new()
	art._px = 0.0
	if art.ellipse_segments(3.8) != 20 or not art.draws_puff(3.8):
		printerr("بلا حجم معروف يجب أن يُرسم كل التفصيل")
		ok = false
	# حجم افتراضي (تقريب 2.2 × 0.62): البيضاويات الصغيرة تُخشَّن والظل يبقى
	art._px = GC.UNIT_SCALE * GC.ZOOM_START
	if art.ellipse_segments(3.8) != 8:
		printerr("بيضاوي صغير لم يُخشَّن عند التقريب الافتراضي")
		ok = false
	if not art.draws_puff(3.8):
		printerr("اختفى الظل عند التقريب الافتراضي وهو ما زال ظاهراً")
		ok = false
	# أقصى تصغير: الظل بضعة بكسلات فلا يُرسم
	art._px = GC.UNIT_SCALE * GC.ZOOM_MIN
	if art.draws_puff(3.8):
		printerr("رُسم الظل عند أقصى تصغير وهو أصغر من %.1f بكسل" % GC.DRAW_SHADOW_PX)
		ok = false
	# أقصى تقريب: كل التفصيل يرجع
	art._px = GC.UNIT_SCALE_SPECIAL * GC.ZOOM_MAX
	if art.ellipse_segments(3.8) != 20 or not art.draws_puff(3.8):
		printerr("نقص التفصيل عند أقصى تقريب")
		ok = false

	if ok:
		print("نجح فحص رسم الوحدات.")
	else:
		printerr("فشل فحص رسم الوحدات.")
	quit(0 if ok else 1)
