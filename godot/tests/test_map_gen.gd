extends SceneTree
# فحص توليد الخريطة بلا واجهة:
#   godot --headless --path godot --script tests/test_map_gen.gd
# يتأكد من: اتصال الشوارع، عدم بقاء فراغ معزول، وصول ساحات الأعلام،
# وصحة أعداد الأحياء المنزلية والمميزة ومراكز الشرطة.

const RUNS := 40

func _initialize() -> void:
	var failures := 0
	for size_key in GC.SIZE_ORDER:
		var info: Dictionary = GC.MAP_SIZES[size_key]
		var players: int = int(info["max_players"])
		var worst_police := 999
		var worst_special := 999
		var warn_count := 0
		for run in RUNS:
			var gen := MapGen.new()
			var m := gen.generate(size_key, players, run + 1)
			var n: int = int(m["n"])
			warn_count += m["warnings"].size()

			if not gen._roads_connected():
				printerr("[%s #%d] الشوارع غير متصلة" % [size_key, run])
				failures += 1

			var seen := gen._flood_from_roads()
			var stuck := gen._isolated_tiles(seen)
			if stuck.size() > 0:
				printerr("[%s #%d] بقي %d مربع معزول" % [size_key, run, stuck.size()])
				failures += 1

			var homes := 0
			var specials := 0
			var police := 0
			var special_kinds := {}
			for d in m["districts"]:
				match String(d["type"]):
					"home": homes += 1
					"special":
						specials += 1
						special_kinds[String(d["special"])] = true
					"police": police += 1
				var cap: Vector2i = d["cap"]
				if cap.x >= 0 and not seen.has(cap.y * n + cap.x):
					printerr("[%s #%d] ساحة علم غير موصولة عند %s" % [size_key, run, cap])
					failures += 1
				if int(d["size"]) >= GC.DISTRICT_MIN_TILES and cap.x < 0:
					printerr("[%s #%d] حي بحجم %d بلا ساحة علم" % [size_key, run, int(d["size"])])
					failures += 1

			# 3.8: مركز الشرطة بعيد عن الأحياء المنزلية بـ 6 مربعات على الأقل
			var home_centers := []
			for d in m["districts"]:
				if String(d["type"]) == "home":
					home_centers.append(Vector2(float(d["cx"]), float(d["cy"])))
			for d in m["districts"]:
				if String(d["type"]) != "police":
					continue
				var pc := Vector2(float(d["cx"]), float(d["cy"]))
				for h in home_centers:
					if pc.distance_to(h) < GC.POLICE_MIN_DIST_HOME:
						printerr("[%s #%d] مركز شرطة قريب جداً من حي منزلي" % [size_key, run])
						failures += 1

			if homes != players:
				printerr("[%s #%d] أحياء منزلية %d والمطلوب %d" % [size_key, run, homes, players])
				failures += 1
			if specials != int(info["special"]):
				printerr("[%s #%d] أحياء مميزة %d والمطلوب %d" % [size_key, run, specials, int(info["special"])])
				failures += 1
			if specials <= GC.SPECIAL_KINDS.size() and special_kinds.size() != specials:
				printerr("[%s #%d] تكرر نوع حي مميز بلا داعٍ" % [size_key, run])
				failures += 1
			worst_special = mini(worst_special, specials)
			worst_police = mini(worst_police, police)

		print("[%s] %d تشغيلة | أقل مميزة %d | أقل مراكز شرطة %d (المطلوب %d) | تحذيرات %d" % [
			size_key, RUNS, worst_special, worst_police, int(info["police"]), warn_count])

	if failures == 0:
		print("نجح الفحص: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)
