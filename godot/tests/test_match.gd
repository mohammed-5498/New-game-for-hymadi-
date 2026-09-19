extends SceneTree
# فحص الأحياء والظهور والفوز — الأقسام 7 و 8 و 9
#   godot --headless --path godot --script tests/test_match.gd

var failures := 0

class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

# حيّان وهميان بساحتي علم متباعدتين
func make_districts(count: int) -> Array:
	var out := []
	for i in count:
		out.append({
			"id": i, "tiles": [], "size": 9, "cx": float(i) * 20.0, "cy": 0.0,
			"flavor": "neutral", "type": "plain", "gang": "", "special": "",
			"cap": Vector2i(int(i) * 20, 0), "center": Vector2i(int(i) * 20 + 1, 0),
		})
	return out

func run(d: Districts, c: Combat, seconds: float, dt: float = 0.1) -> void:
	for i in int(seconds / dt):
		c.step(dt)
		d.step(dt, c.units)

func _initialize() -> void:
	_t_capture_speed()
	_t_capture_power_cap()
	_t_freeze_on_contest()
	_t_enemy_district_goes_neutral_first()
	_t_allies_do_not_capture()
	_t_decay_when_empty()
	_t_spawn_interval_formula()
	_t_spawn_needs_district_and_limit()
	_t_leader_and_defeat()
	if failures == 0:
		print("نجح فحص الأحياء والظهور: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# فرد عادي واحد يحتاج قرابة 12.5 ثانية لحي محايد (8)
func _t_capture_speed() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 2, {0: 0, 1: 1})
	var u := c.spawn("scorp_common", 0, 0, Vector2(0, 0))   # قوة استيلاء 1
	u["state"] = "moving"                                    # حتى لا يبحث عن أعداء
	run(d, c, 12.0)
	check(int(d.list[0]["owner"]) < 0, "اكتمل الاستيلاء قبل 12.5 ثانية")
	run(d, c, 1.5)
	check(int(d.list[0]["owner"]) == 0, "لم يكتمل الاستيلاء بعد 13.5 ثانية بفرد عادي")

# سقف قوة الاستيلاء 6 مهما زاد العدد
func _t_capture_power_cap() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 2, {0: 0, 1: 1})
	for i in 12:
		var u := c.spawn("scorp_common", 0, 0, Vector2(0, 0))
		u["state"] = "moving"
	# بسقف 6 يحتاج 100 / (8 × 6) ≈ 2.08 ثانية
	run(d, c, 1.6)
	check(int(d.list[0]["owner"]) < 0, "تجاوز الاستيلاء سقف القوة 6")
	run(d, c, 1.0)
	check(int(d.list[0]["owner"]) == 0, "لم يكتمل الاستيلاء بـ 12 وحدة في ~2 ثانية")

# جانبان غير متحالفين: يتجمد التقدم
func _t_freeze_on_contest() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 2, {0: 0, 1: 1})
	var a := c.spawn("scorp_common", 0, 0, Vector2(0, 0))
	var b := c.spawn("scorp_common", 1, 1, Vector2(0.2, 0))
	a["state"] = "moving"
	b["state"] = "moving"
	run(d, c, 3.0)
	check(bool(d.list[0]["frozen"]), "لم يتجمد التقدم رغم وجود جانبين")
	check(float(d.list[0]["value"]) < 1.0, "تقدّم الاستيلاء رغم التجمد")

# حي يملكه عدو: ينزل إلى 0 فيصير محايداً ثم يُملأ للمستولي
func _t_enemy_district_goes_neutral_first() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 2, {0: 0, 1: 1})
	d.claim_home(0, 1)
	check(int(d.list[0]["owner"]) == 1, "لم يُسجَّل المالك الابتدائي")
	var u := c.spawn("scorp_common", 0, 0, Vector2(0, 0))
	u["state"] = "moving"
	run(d, c, 13.0)
	check(int(d.list[0]["owner"]) < 0, "لم يصر الحي محايداً بعد إنزال تقدم العدو")
	run(d, c, 13.0)
	check(int(d.list[0]["owner"]) == 0, "لم يُملأ الحي لصالح المستولي بعد أن صار محايداً")

# الحلفاء لا يستولون على أحياء بعضهم
func _t_allies_do_not_capture() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 2, {0: 5, 1: 5})   # نفس الفريق
	d.claim_home(0, 1)
	var u := c.spawn("scorp_common", 0, 0, Vector2(0, 0))
	u["state"] = "moving"
	run(d, c, 6.0)
	check(int(d.list[0]["owner"]) == 1, "حليف استولى على حي حليفه")
	check(float(d.list[0]["value"]) >= GC.CAPTURE_MAX - 0.01, "نقص تقدم الحي بوجود حليف")

# لا أحد في المنطقة: يرجع التقدم تدريجياً
func _t_decay_when_empty() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 2, {0: 0, 1: 1})
	d.list[0]["owner"] = -1
	d.list[0]["claimer"] = 0
	d.list[0]["value"] = 50.0
	run(d, c, 4.0)
	check(float(d.list[0]["value"]) < 35.0, "لم يرجع التقدم عند خلو المنطقة")

	d.list[0]["owner"] = 0
	d.list[0]["value"] = 50.0
	run(d, c, 4.0)
	check(float(d.list[0]["value"]) > 65.0, "لم يرمّم المالك تقدم حيه عند خلو المنطقة")

# صيغة أزمنة الظهور (7)
func _t_spawn_interval_formula() -> void:
	var sp := Spawner.new()
	sp.setup(2, {0: "crow", 1: "scorp"}, 100)
	check(is_equal_approx(sp.common_every(0, 1), 14.0), "زمن العاديين عند حي واحد ليس 14 ث")
	check(is_equal_approx(sp.common_every(0, 5), 10.0), "زمن العاديين عند 5 أحياء ليس 10 ث")
	check(is_equal_approx(sp.common_every(0, 20), 4.0), "زمن العاديين لم يتوقف عند الحد الأدنى 4 ث")
	check(is_equal_approx(sp.special_every(0, 1), 75.0), "زمن المميزين عند حي واحد ليس 75 ث")
	check(is_equal_approx(sp.special_every(0, 11), 45.0), "زمن المميزين عند 11 حياً ليس 45 ث")
	check(is_equal_approx(sp.special_every(0, 40), 30.0), "زمن المميزين لم يتوقف عند الحد الأدنى 30 ث")
	# العقارب أسرع في العاديين × 0.8، ولا أثر على المميزين
	check(is_equal_approx(sp.common_every(1, 1), 14.0 * 0.8), "لم يُطبَّق معامل العقارب 0.8")
	check(is_equal_approx(sp.special_every(1, 1), 75.0), "طُبِّق معامل العقارب على المميزين خطأً")
	# برج الساعة × 0.85 للكل
	sp.clock_bonus[0] = true
	check(is_equal_approx(sp.common_every(0, 1), 14.0 * 0.85), "لم يُطبَّق معامل برج الساعة")

# بلا أحياء لا ظهور، وعند الحد الأقصى تتوقف المؤقتات
func _t_spawn_needs_district_and_limit() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(1), 1, {0: 0})
	var sp := Spawner.new()
	sp.setup(1, {0: "crow"}, 100)
	var got := sp.step(30.0, 1, d, c.units)
	check(got.is_empty(), "ظهرت وحدة للاعب لا يملك أحياءً")

	d.claim_home(0, 0)
	sp.setup(1, {0: "crow"}, 100)
	got = sp.step(20.0, 1, d, c.units)
	check(got.size() >= 1, "لم تظهر وحدة رغم امتلاك حي ومرور 20 ثانية")

	sp.setup(1, {0: "crow"}, 2)
	for i in 3:
		c.spawn("crow_common", 0, 0, Vector2(0, 0))
	got = sp.step(30.0, 1, d, c.units)
	check(got.is_empty(), "استمر الظهور بعد بلوغ الحد الأقصى للوحدات")

# المتصدر (9) والهزيمة والفوز (القسم 1)
func _t_leader_and_defeat() -> void:
	var d := Districts.new()
	var c := Combat.new(FlatMap.new())
	d.setup(make_districts(10), 2, {0: 0, 1: 1})
	for i in 3:
		d.claim_home(i, 0)
	check(d.leader() < 0, "اعتُبر لاعب متصدراً بأقل من 40% من الأحياء")
	d.claim_home(3, 0)
	check(d.leader() == 0, "لم يُكتشف المتصدر عند بلوغ 40% من الأحياء")

	d.claim_home(9, 1)
	var u := c.spawn("crow_common", 1, 1, Vector2(0, 0))
	check(not d.defeated(1, c.units), "اعتُبر لاعب مهزوماً وهو يملك حياً ووحدة")
	check(d.winner_team(c.units) < 0, "أُعلن فوز والمباراة لم تنتهِ")
	d.list[9]["owner"] = -1
	check(not d.defeated(1, c.units), "اعتُبر مهزوماً رغم بقاء وحدة حية")
	u["state"] = "dead"
	check(d.defeated(1, c.units), "لم يُعتبر مهزوماً بعد فقد كل أحيائه ووحداته")
	check(d.winner_team(c.units) == 0, "لم يُعلن فوز آخر فريق باقٍ")
