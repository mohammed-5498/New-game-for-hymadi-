extends SceneTree
# فحص العصابات والأبطال والضربات المميزة — الأقسام 6.1 – 6.7
#   godot --headless --path godot --script tests/test_abilities.gd

var failures := 0

class FlatMap:
	extends RefCounted
	func find_path(_from: Vector2, to: Vector2) -> Array:
		return [to]

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func run(c: Combat, seconds: float, dt: float = 1.0 / 30.0) -> void:
	for i in int(seconds / dt):
		c.step(dt)

func new_combat() -> Combat:
	return Combat.new(FlatMap.new())

# وحدة ساكنة لا تبحث ولا تهاجم، لنقيس أثراً واحداً فقط
func idle_dummy(c: Combat, key: String, player: int, pos: Vector2) -> Dictionary:
	var u := c.spawn(key, player, player, pos)
	u["state"] = "moving"
	u["path"] = []
	return u

func _initialize() -> void:
	_t_ult_keys_match_art()
	_t_charge_rules()
	_t_invuln()
	_t_breaker_splash_and_ult()
	_t_medic()
	_t_boss_aura()
	_t_hero_aura_takes_strongest()
	_t_combo_acceleration()
	_t_firebomber_fire()
	_t_pierce_and_arc()
	_t_district_bonuses()
	_t_hero_respawn()
	if failures == 0:
		print("نجح فحص القدرات والضربات المميزة: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# كل وحدة لها ضربة مميزة يجب أن تملك مفتاح رسم، والأفراد العاديون بلا ضربة (6.7)
func _t_ult_keys_match_art() -> void:
	for key in GC.ULTS.keys():
		check(UnitsArt.UNITS.has(key), "مفتاح الضربة %s ليس له رسم" % key)
		check(not String(key).ends_with("_common") or String(key).begins_with("police"),
			"فرد عادي %s يملك ضربة مميزة" % key)
	for key in GC.UNIT_KEYS:
		if String(key).ends_with("_common") and not String(key).begins_with("police"):
			check(not Combat.has_ult(key), "الفرد العادي %s يجب ألا يملك ضربة" % key)

# قواعد الشحن (6.7): 3/ث للعادي و 2/ث للبطل، و 8 و 6 لكل ضربة، و 5 لكل 50 ضرراً
func _t_charge_rules() -> void:
	var c := new_combat()
	var special := idle_dummy(c, "crow_spear", 0, Vector2(0, 0))
	var hero := idle_dummy(c, "crow_hero", 0, Vector2(1, 0))
	var plain := idle_dummy(c, "crow_common", 0, Vector2(2, 0))
	run(c, 2.0)
	check(absf(float(special["charge"]) - 6.0) < 0.5, "شحن الشخصية المميزة ليس 3/ث")
	check(absf(float(hero["charge"]) - 4.0) < 0.5, "شحن البطل ليس 2/ث")
	check(float(plain["charge"]) == 0.0, "فرد عادي يشحن ضربة مميزة")

	var c2 := new_combat()
	var v := idle_dummy(c2, "crow_spear", 1, Vector2(0, 0))
	var src := idle_dummy(c2, "scorp_common", 0, Vector2(9, 9))
	c2.damage(v, 100.0, src, false)     # 100 ضرر = خطوتان × 5 نقاط
	check(absf(float(v["charge"]) - 10.0) < 0.01, "الشحن من الضرر المستلم ليس 5 لكل 50")

# تصلّب المصفّح: لا يتلقى أي ضرر لمدة 3 ثوانٍ (6.7.1)
func _t_invuln() -> void:
	var c := new_combat()
	var u := idle_dummy(c, "hammer_shield", 0, Vector2(0, 0))
	var src := idle_dummy(c, "scorp_common", 1, Vector2(9, 9))
	u["invuln_t"] = 3.0
	c.damage(u, 500.0, src, false)
	check(float(u["hp"]) == float(u["max_hp"]), "تلقى ضرراً أثناء التصلّب")
	run(c, 3.2)
	c.damage(u, 50.0, src, false)
	check(float(u["hp"]) < float(u["max_hp"]), "بقي محصناً بعد انتهاء التصلّب")

# ضربة المحطِّم العادية تصيب دائرة حول الهدف، وضربته المميزة 60 لكل عدو داخل 2.5 (6.3 و 6.7.1)
func _t_breaker_splash_and_ult() -> void:
	var c := new_combat()
	var a := c.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	var b1 := idle_dummy(c, "scorp_common", 1, Vector2(5.8, 5))
	var b2 := idle_dummy(c, "scorp_common", 1, Vector2(6.3, 5))   # داخل دائرة 1 حول الهدف
	a["charge"] = 0.0
	a["scan_t"] = 0.0
	run(c, 1.6, 0.01)
	check(float(b1["hp"]) < float(b1["max_hp"]), "المحطِّم لم يصب هدفه")
	check(float(b2["hp"]) < float(b2["max_hp"]), "ضربة المحطِّم لم تصب من حول الهدف")

	var c2 := new_combat()
	var u := c2.spawn("hammer_breaker", 0, 0, Vector2(5, 5))
	var far := idle_dummy(c2, "hammer_shield", 1, Vector2(6.0, 5))
	u["charge"] = GC.CHARGE_FULL
	u["scan_t"] = 0.0
	var before := float(far["hp"])
	run(c2, 2.5, 0.01)
	check(float(far["hp"]) < before - 20.0, "ضربة المحطِّم المميزة لم توقع ضرراً كبيراً")
	check(float(far["slow"]) >= 0.29, "الضربة المميزة لم تبطئ العدو 30%")
	check(float(far["slow_t"]) > 0.0, "الإبطاء بلا مدة")
	check(float(u["charge"]) < GC.CHARGE_FULL, "لم يرجع شريط الشحن إلى الصفر بعد الضربة")

# الطبيب يعالج أكثر حليف متضرر داخل 3 مربعات ولا يعالج نفسه (6.5)
func _t_medic() -> void:
	var c := new_combat()
	var medic := idle_dummy(c, "scorp_medic", 0, Vector2(0, 0))
	var hurt_a := idle_dummy(c, "scorp_common", 0, Vector2(1, 0))
	var hurt_b := idle_dummy(c, "scorp_common", 0, Vector2(2, 0))
	medic["hp"] = 50.0
	hurt_a["hp"] = 90.0
	hurt_b["hp"] = 40.0        # الأكثر تضرراً
	run(c, 1.0)
	check(float(hurt_b["hp"]) > 45.0, "الطبيب لم يعالج أكثر الحلفاء تضرراً")
	check(absf(float(hurt_a["hp"]) - 90.0) < 0.01, "الطبيب عالج غير الأكثر تضرراً")
	check(absf(float(medic["hp"]) - 50.0) < 0.01, "الطبيب عالج نفسه")

# هالة الزعيم: +20% ضرر للحلفاء داخل 3 مربعات، ولا تتجمع هالتان (6.5)
func _t_boss_aura() -> void:
	var c := new_combat()
	var boss := idle_dummy(c, "scorp_boss", 0, Vector2(0, 0))
	var near := idle_dummy(c, "scorp_common", 0, Vector2(2, 0))
	var far := idle_dummy(c, "scorp_common", 0, Vector2(9, 0))
	run(c, 0.2)
	check(absf(float(near["aura_dmg"]) - 0.20) < 0.001, "هالة الزعيم لم تعط +20% للحليف القريب")
	check(float(far["aura_dmg"]) == 0.0, "هالة الزعيم وصلت لحليف خارج مداها")
	check(absf(c.out_mult(near) - 1.20) < 0.001, "مضاعف الضرر مع الهالة ليس 1.20")

	var boss2 := idle_dummy(c, "scorp_boss", 0, Vector2(1, 0))
	run(c, 0.2)
	check(absf(float(near["aura_dmg"]) - 0.20) < 0.001, "تجمعت هالتان للزعيم")

# هالة بطل العقارب أقوى، ويؤخذ الأقوى فقط (6.6)
func _t_hero_aura_takes_strongest() -> void:
	var c := new_combat()
	idle_dummy(c, "scorp_boss", 0, Vector2(0, 0))
	idle_dummy(c, "scorp_hero", 0, Vector2(0.5, 0))
	var ally := idle_dummy(c, "scorp_common", 0, Vector2(1.5, 0))
	ally["hp"] = 50.0
	run(c, 1.0)
	check(absf(float(ally["aura_dmg"]) - 0.25) < 0.001, "لم تُؤخذ الهالة الأقوى (بطل العقارب 25%)")
	check(float(ally["hp"]) > 53.0, "هالة بطل العقارب لم تعالج الحلفاء 4 دم/ث")

# تسارع الاشتباك للمزدوج ولبطل الغربان (6.2 و 6.6)
func _t_combo_acceleration() -> void:
	var c := new_combat()
	var u := idle_dummy(c, "crow_dual", 0, Vector2(0, 0))
	check(absf(c.rate_mult(u) - 1.0) < 0.001, "زمن الضربة تغيّر بلا ضربات متتالية")
	u["combo"] = 2
	check(absf(c.rate_mult(u) - 0.76) < 0.001, "تسارع المزدوج ليس 12% لكل ضربة")
	u["combo"] = 9
	check(absf(c.rate_mult(u) - 0.52) < 0.001, "تسارع المزدوج تجاوز حد الأربع ضربات")
	u["combo_t"] = 99.0
	c.step(0.1)
	check(int(u["combo"]) == 0, "لم يرجع التسارع للأصل بعد التوقف عن الضرب")

	var h := idle_dummy(c, "crow_hero", 0, Vector2(3, 0))
	h["combo"] = 4
	check(absf(c.rate_mult(h) - 0.68) < 0.001, "تسارع بطل الغربان ليس 8% لكل ضربة")
	h["combo"] = 20
	check(absf(c.rate_mult(h) - 0.50) < 0.001, "تسارع بطل الغربان تجاوز سقف 50%")

# زجاجة رامي النار تشعل الأرض وتحرق الأعداء داخلها (6.4)
func _t_firebomber_fire() -> void:
	var c := new_combat()
	var a := c.spawn("viper_firebomber", 0, 0, Vector2(5, 5))
	var b := idle_dummy(c, "hammer_shield", 1, Vector2(8, 5))
	a["charge"] = 0.0
	a["scan_t"] = 0.0
	var before := float(b["hp"])
	run(c, 6.0, 0.02)
	check(c.fires.size() > 0 or float(b["hp"]) < before, "لم تُشعل الزجاجة أي نار")
	run(c, 2.0, 0.02)
	check(float(b["hp"]) < before, "النار لم تحرق العدو داخلها")

# طعنة حامل الرمح تخترق عدوين، وضربة بطل الغربان تصيب كل من في القوس (6.7)
func _t_pierce_and_arc() -> void:
	var c := new_combat()
	var u := c.spawn("crow_spear", 0, 0, Vector2(5, 5))
	var e1 := idle_dummy(c, "hammer_shield", 1, Vector2(6.2, 5))
	var e2 := idle_dummy(c, "hammer_shield", 1, Vector2(7.0, 5))
	var e3 := idle_dummy(c, "hammer_shield", 1, Vector2(9.5, 5))
	u["charge"] = GC.CHARGE_FULL
	u["scan_t"] = 0.0
	run(c, 2.0, 0.01)
	check(float(e1["hp"]) < float(e1["max_hp"]), "الطعنة القاضية لم تصب العدو الأول")
	check(float(e2["hp"]) < float(e2["max_hp"]), "الطعنة القاضية لم تخترق العدو الثاني")
	check(absf(float(e3["hp"]) - float(e3["max_hp"])) < 0.01, "الطعنة أصابت عدواً خارج مداها")

	var c2 := new_combat()
	var h := c2.spawn("crow_hero", 0, 0, Vector2(5, 5))
	var a1 := idle_dummy(c2, "hammer_shield", 1, Vector2(6.5, 5))
	var a2 := idle_dummy(c2, "hammer_shield", 1, Vector2(5, 6.5))
	h["charge"] = GC.CHARGE_FULL
	h["scan_t"] = 0.0
	run(c2, 2.0, 0.01)
	check(float(a1["hp"]) < float(a1["max_hp"]) and float(a2["hp"]) < float(a2["max_hp"]),
		"ضربة بطل الغربان لم تصب كل من في القوس")

# مكافآت الأحياء المميزة: مخزن السلاح والمستشفى (3.7)
func _t_district_bonuses() -> void:
	var c := new_combat()
	c.player_dmg_mult[0] = 1.10
	var u := idle_dummy(c, "crow_common", 0, Vector2(0, 0))
	check(absf(c.out_mult(u) - 1.10) < 0.001, "مخزن السلاح لم يعط +10% ضرر")

	c.player_heal[0] = 0.5
	u["hp"] = 50.0
	run(c, 2.0)
	check(float(u["hp"]) > 50.5, "المستشفى لم يعالج وحدات المالك 0.5 دم/ث")

	c.heal_zones = [{"pos": Vector2(0, 0), "player": 0, "dps": 4.5}]
	var before := float(u["hp"])
	run(c, 1.0)
	check(float(u["hp"]) > before + 4.0, "منطقة المستشفى لم تعالج 5 دم/ث")

# عودة البطل: لا تبدأ إلا بامتلاك 5 أحياء، وبطل واحد حي فقط (6.6)
func _t_hero_respawn() -> void:
	var sp := Spawner.new()
	sp.setup(1, {0: "crow"}, 100)
	var c := new_combat()
	check(not sp.hero_alive(0, c.units), "اعتُبر البطل حياً بلا وحدات")
	var hero := c.spawn("crow_hero", 0, 0, Vector2(0, 0))
	check(sp.hero_alive(0, c.units), "لم يُكتشف البطل الحي")

	# بطل ميت + 4 أحياء: المؤقت متوقف، فلا يعود
	var d := Districts.new()
	var dl := []
	for i in 10:
		dl.append({"id": i, "tiles": [], "size": 9, "cx": float(i) * 20.0, "cy": 0.0,
			"flavor": "neutral", "type": "plain", "gang": "", "special": "",
			"cap": Vector2i(int(i) * 20, 0), "center": Vector2i(int(i) * 20 + 1, 0)})
	d.setup(dl, 1, {0: 0})
	for i in 4:
		d.claim_home(i, 0)
	hero["state"] = "dead"
	sp.setup(1, {0: "crow"}, 100)
	var got := sp.step(120.0, 1, d, c.units)
	var has_hero := false
	for g in got:
		if bool(GC.stat(String(g["key"]), "hero")):
			has_hero = true
	check(not has_hero, "عاد البطل رغم امتلاك 4 أحياء فقط")

	# بخمسة أحياء يعود بعد 60 ثانية
	d.claim_home(4, 0)
	sp.setup(1, {0: "crow"}, 100)
	got = sp.step(59.0, 1, d, c.units)
	has_hero = false
	for g in got:
		if bool(GC.stat(String(g["key"]), "hero")):
			has_hero = true
	check(not has_hero, "عاد البطل قبل انقضاء 60 ثانية")
	got = sp.step(2.0, 1, d, c.units)
	has_hero = false
	for g in got:
		if bool(GC.stat(String(g["key"]), "hero")):
			has_hero = true
	check(has_hero, "لم يعد البطل بعد 60 ثانية وبامتلاك 5 أحياء")

	# ولا يعود بطل ثانٍ ما دام الأول حياً
	c.spawn("crow_hero", 0, 0, Vector2(0, 0))
	sp.setup(1, {0: "crow"}, 100)
	got = sp.step(120.0, 1, d, c.units)
	has_hero = false
	for g in got:
		if bool(GC.stat(String(g["key"]), "hero")):
			has_hero = true
	check(not has_hero, "ظهر بطل ثانٍ للاعب وبطله الأول حي")
