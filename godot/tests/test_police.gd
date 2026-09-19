extends SceneTree
# فحص سلوك مراكز الشرطة — القسم 3.8
#   godot --headless --path godot --script tests/test_police.gd

var failures := 0

class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]
	func _free_near(start: Vector2i, _n: int) -> Array:
		return [start]

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func make_districts(count: int) -> Array:
	var out := []
	for i in count:
		out.append({
			"id": i, "tiles": [], "size": 9, "cx": float(i) * 30.0, "cy": 0.0,
			"flavor": "neutral", "type": "plain", "gang": "", "special": "",
			"cap": Vector2i(int(i) * 30, 0), "center": Vector2i(int(i) * 30, 0),
		})
	return out

func run(c: Combat, p: Police, dl: Array, seconds: float, dt: float = 0.1) -> void:
	for i in int(seconds / dt):
		c.step(dt)
		p.step(dt, dl)

func _initialize() -> void:
	_t_hostile_to_everyone()
	_t_production()
	_t_captain()
	_t_no_capture()
	_t_chase_limit_from_station()
	_t_returning_only_hits_blockers()
	_t_capture_stops_production_forever()
	_t_armor_bonus_caps()
	if failures == 0:
		print("نجح فحص الشرطة: لا أخطاء.")
	else:
		printerr("فشل فحص الشرطة: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# تهاجم أي لاعب ولا تفرّق، والشرطيان صديقان لبعضهما
func _t_hostile_to_everyone() -> void:
	var c := Combat.new(FlatMap.new())
	var p1 := c.spawn("police_common", -1, -1, Vector2(0, 0))
	var p2 := c.spawn("police_common", -1, -1, Vector2(0.4, 0))
	var a := c.spawn("crow_common", 0, 0, Vector2(0.6, 0))
	var b := c.spawn("hammer_common", 1, 1, Vector2(0.8, 0))
	check(not c._hostile(p1, p2), "شرطيان اعتُبرا عدوين")
	check(c._hostile(p1, a) and c._hostile(p1, b), "الشرطة لا تعادي كل اللاعبين")
	check(c._hostile(a, p1), "اللاعب لا يعادي الشرطة")
	run(c, Police.new(), [], 6.0)
	check(float(a["hp"]) < float(a["max_hp"]) or float(b["hp"]) < float(b["max_hp"]),
		"الشرطة لم تهاجم أحداً")
	# شرطي لا يؤذي شرطياً حتى لو وُجِّه الضرر مباشرة
	var hp_before := float(p2["hp"])
	c.damage(p2, 50.0, p1, false)
	check(absf(float(p2["hp"]) - hp_before) < 0.01, "شرطي أوقع ضرراً على شرطي")

# شرطي كل 10 ثوانٍ بحد أقصى 6
func _t_production() -> void:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(1)
	dl[0]["type"] = "police"
	var d := Districts.new()
	d.setup(dl, 1, {0: 0})
	var p := Police.new()
	p.setup(dl, c, FlatMap.new())
	check(p.stations.size() == 1, "لم يُكتشف مركز الشرطة")
	run(c, p, dl, 9.0)
	check(p.count_of(p.stations[0], "police_common") == 0, "ظهر شرطي قبل 10 ثوانٍ")
	run(c, p, dl, 2.0)
	check(p.count_of(p.stations[0], "police_common") == 1, "لم يظهر شرطي بعد 10 ثوانٍ")
	run(c, p, dl, 120.0)
	check(p.count_of(p.stations[0], "police_common") == GC.POLICE_MAX_ALIVE,
		"تجاوز عدد الشرطة الحد الأقصى 6 أو لم يبلغه")
	# يستأنف الإنتاج كلما نقص العدد
	for u in c.units:
		if String(u["key"]) == "police_common":
			c._kill(u)
			break
	run(c, p, dl, 12.0)
	check(p.count_of(p.stations[0], "police_common") == GC.POLICE_MAX_ALIVE,
		"لم يستأنف الإنتاج بعد نقص العدد")

# ضابط واحد يظهر مع البداية ولا يتكرر إلا بعد موته بـ 40 ثانية
func _t_captain() -> void:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(1)
	dl[0]["type"] = "police"
	var p := Police.new()
	p.setup(dl, c, FlatMap.new())
	p.spawn_initial()
	check(p.count_of(p.stations[0], "police_captain") == 1, "لم يظهر الضابط مع بداية المباراة")
	run(c, p, dl, 60.0)
	check(p.count_of(p.stations[0], "police_captain") == 1, "ظهر ضابط ثانٍ والأول حي")
	for u in c.units:
		if String(u["key"]) == "police_captain":
			c._kill(u)
			break
	run(c, p, dl, 38.0)
	check(p.count_of(p.stations[0], "police_captain") == 0, "عاد الضابط قبل 40 ثانية")
	run(c, p, dl, 4.0)
	check(p.count_of(p.stations[0], "police_captain") == 1, "لم يعد الضابط بعد 40 ثانية")

# الشرطة لا تستولي على أي حي ولا تجمّد التقدم
func _t_no_capture() -> void:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(1)
	var d := Districts.new()
	d.setup(dl, 1, {0: 0})
	var cop := c.spawn("police_common", -1, -1, Vector2(0, 0))
	cop["state"] = "moving"
	for i in 200:
		c.step(0.1)
		d.step(0.1, c.units)
	check(int(dl[0]["owner"]) < 0, "الشرطة استولت على حي")
	check(float(dl[0]["value"]) <= 0.01, "الشرطة راكمت تقدم استيلاء")
	check(not bool(dl[0]["frozen"]), "وجود الشرطة جمّد تقدم الاستيلاء")

# تطارد حتى 6 مربعات من مركزها ثم ترجع
func _t_chase_limit_from_station() -> void:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(1)
	dl[0]["type"] = "police"
	var p := Police.new()
	p.setup(dl, c, FlatMap.new())
	var cop := p._spawn(p.stations[0], "police_common")
	var bait := c.spawn("crow_common", 0, 0, Vector2(3, 0))
	bait["state"] = "moving"
	cop["scan_t"] = 0.0
	run(c, p, dl, 0.5)
	check(int(cop["target"]) == int(bait["id"]), "الشرطي لم يرصد من دخل مداه")
	# الطُعم يهرب بعيداً: يجب أن يتوقف الشرطي ويرجع للمركز
	bait["pos"] = Vector2(30, 0)
	cop["pos"] = Vector2(8, 0)
	run(c, p, dl, 1.0)
	check(int(cop["target"]) < 0, "الشرطي تجاوز حد المطاردة 6 مربعات من مركزه")
	check(bool(cop["returning"]), "الشرطي لم يدخل حالة الرجوع")

# أثناء الرجوع لا تهاجم إلا من يعترضها مباشرة
func _t_returning_only_hits_blockers() -> void:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(1)
	dl[0]["type"] = "police"
	var p := Police.new()
	p.setup(dl, c, FlatMap.new())
	var cop := p._spawn(p.stations[0], "police_common")
	cop["pos"] = Vector2(8, 0)
	cop["returning"] = true
	cop["state"] = "moving"
	cop["path"] = [Vector2(0, 0)]
	# عدو في مدى الرصد لكن ليس معترضاً: يُتجاهل
	var far := c.spawn("crow_common", 0, 0, Vector2(11, 0))
	far["state"] = "moving"
	cop["scan_t"] = 0.0
	c.step(0.05)
	check(int(cop["target"]) < 0, "الشرطي الراجع هاجم عدواً بعيداً غير معترض")
	# عدو ملاصق يعترض الطريق: يُهاجَم
	var blocker := c.spawn("crow_common", 0, 0, Vector2(8.5, 0))
	blocker["state"] = "moving"
	cop["scan_t"] = 0.0
	c.step(0.05)
	check(int(cop["target"]) == int(blocker["id"]), "الشرطي الراجع لم يرد على من اعترضه")

# الاستيلاء يوقف الإنتاج إلى الأبد، وتختفي الشرطة خلال 5 ثوانٍ
func _t_capture_stops_production_forever() -> void:
	var c := Combat.new(FlatMap.new())
	var dl := make_districts(1)
	dl[0]["type"] = "police"
	dl[0]["owner"] = -1
	var p := Police.new()
	p.setup(dl, c, FlatMap.new())
	p.spawn_initial()
	run(c, p, dl, 25.0)
	var before := p.alive_count()
	check(before > 1, "لم تُنتج الشرطة قبل الاستيلاء")

	dl[0]["owner"] = 0          # استولى عليه لاعب
	run(c, p, dl, 4.0)
	check(p.alive_count() == before, "اختفت الشرطة قبل مرور 5 ثوانٍ")
	run(c, p, dl, 2.0)
	check(p.alive_count() == 0, "لم تختفِ الشرطة بعد 5 ثوانٍ من الاستيلاء")

	run(c, p, dl, 120.0)
	check(p.alive_count() == 0, "عاد المركز للإنتاج بعد الاستيلاء")
	dl[0]["owner"] = -1         # حتى لو عاد محايداً لا يُنتج أبداً
	run(c, p, dl, 120.0)
	check(p.alive_count() == 0, "أنتج المركز بعد أن عاد محايداً، والقاعدة أنه لا يعود أبداً")

# مكافأة الدرع تتجمع بحد أقصى +20% (3.8)
func _t_armor_bonus_caps() -> void:
	check(absf(minf(GC.POLICE_ARMOR_BONUS_MAX, 1.0 * GC.POLICE_ARMOR_BONUS) - 0.10) < 0.001,
		"مركز واحد لا يعطي +10% درع")
	check(absf(minf(GC.POLICE_ARMOR_BONUS_MAX, 2.0 * GC.POLICE_ARMOR_BONUS) - 0.20) < 0.001,
		"مركزان لا يعطيان +20% درع")
	check(absf(minf(GC.POLICE_ARMOR_BONUS_MAX, 4.0 * GC.POLICE_ARMOR_BONUS) - 0.20) < 0.001,
		"أربعة مراكز تجاوزت سقف +20%")

	var c := Combat.new(FlatMap.new())
	var u := c.spawn("scorp_common", 0, 0, Vector2(0, 0))
	var src := c.spawn("crow_common", 1, 1, Vector2(9, 9))
	c.player_armor_bonus[0] = 0.20
	c.damage(u, 100.0, src, false)
	check(absf(float(u["hp"]) - (float(u["max_hp"]) - 80.0)) < 0.01,
		"درع مركز الشرطة لم يخفّض الضرر 20%")
