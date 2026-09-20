extends SceneTree
# فحص قائمة الإعداد والحفظ — القسم 12
#   godot --headless --path godot --script tests/test_menu.gd

var failures := 0

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func _initialize() -> void:
	_t_defaults()
	_t_validation()
	_t_colors_unique()
	_t_players_order_and_teams()
	_t_save_load_roundtrip()
	_t_load_repairs_bad_file()
	_t_unit_limits_and_weathers()
	if failures == 0:
		print("نجح فحص القوائم والحفظ: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

func _t_defaults() -> void:
	var ms := MatchSetup.new()
	check(ms.unit_limit == 100, "الحد الأقصى الافتراضي للوحدات ليس 100")
	check(String(ms.slots[0]["kind"]) == "human", "الخانة الأولى ليست للاعب البشري")
	check(ms.active_slots().size() == 4, "الإعداد الافتراضي ليس أربعة لاعبين")
	check(ms.validate() == "", "الإعداد الافتراضي غير صالح: " + ms.validate())

# زر ابدأ يتحقق: لاعبان على الأقل، وجانبان متعاديان، وحد حجم الخريطة (12.2)
func _t_validation() -> void:
	var ms := MatchSetup.new()
	for i in range(1, GC.MAX_SLOTS):
		ms.slots[i]["kind"] = "closed"
	check(ms.validate() != "", "قُبل إعداد بلاعب واحد")

	ms.slots[1]["kind"] = "bot"
	check(ms.validate() == "", "رُفض إعداد بلاعبَين متعاديين")

	# كلهم في فريق واحد: لا يوجد خصم
	ms.slots[0]["team"] = 1
	ms.slots[1]["team"] = 1
	check(ms.validate() != "", "قُبل إعداد كل لاعبيه في فريق واحد")
	ms.slots[1]["team"] = 2
	check(ms.validate() == "", "رُفض إعداد بفريقين متعاديين")

	# "بدون فريق" = عدو للجميع
	ms.slots[0]["team"] = 0
	ms.slots[1]["team"] = 0
	check(ms.validate() == "", "رُفض لاعبان بلا فريق وهما عدوان للجميع")

	# تجاوز حد حجم الخريطة
	ms.size_key = "small"        # حتى 4 لاعبين
	for i in GC.MAX_SLOTS:
		ms.slots[i]["kind"] = "human" if i == 0 else "bot"
		ms.slots[i]["team"] = 0
	check(ms.validate() != "", "قُبل 8 لاعبين على خريطة صغيرة")
	ms.size_key = "large"        # حتى 8
	ms.fix_colors()
	check(ms.validate() == "", "رُفض 8 لاعبين على خريطة كبيرة: " + ms.validate())

# لا يتكرر اللون بين لاعبين، واللمس ينتقل لأول لون غير مستخدم
func _t_colors_unique() -> void:
	var ms := MatchSetup.new()
	for i in GC.MAX_SLOTS:
		ms.slots[i]["kind"] = "human" if i == 0 else "bot"
		ms.slots[i]["color"] = 0          # كلهم بنفس اللون عمداً
	ms.fix_colors()
	var seen := {}
	for i in GC.MAX_SLOTS:
		var c: int = int(ms.slots[i]["color"])
		check(not seen.has(c), "تكرر اللون %d بين لاعبين" % c)
		seen[c] = true

	var before: int = int(ms.slots[2]["color"])
	var nxt: int = ms.next_free_color(2)
	check(nxt == before, "بُدِّل لون خانة وكل الألوان مستعملة")

	ms.slots[7]["kind"] = "closed"
	var freed: int = int(ms.slots[7]["color"])
	check(ms.next_free_color(2) == freed, "لم ينتقل اللون إلى أول لون غير مستخدم")

# الخانة البشرية تصير اللاعب 0، و"بدون فريق" يعطي فريقاً خاصاً
func _t_players_order_and_teams() -> void:
	var ms := MatchSetup.new()
	ms.slots[0]["kind"] = "human"
	ms.slots[0]["team"] = 0
	ms.slots[1]["kind"] = "bot"
	ms.slots[1]["team"] = 0
	ms.slots[2]["kind"] = "bot"
	ms.slots[2]["team"] = 2
	ms.slots[3]["kind"] = "bot"
	ms.slots[3]["team"] = 2
	var ps := ms.players()
	check(ps.size() == 4, "عدد اللاعبين الفعليين خطأ")
	check(String(ps[0]["kind"]) == "human", "اللاعب رقم 0 ليس البشري")
	check(int(ps[0]["team_id"]) != int(ps[1]["team_id"]),
		"لاعبان بلا فريق صارا حليفين")
	check(int(ps[2]["team_id"]) == int(ps[3]["team_id"]),
		"لاعبان في الفريق 2 لم يصيرا حليفين")
	# العصابة العشوائية تُحسم إلى عصابة حقيقية
	for p in ps:
		check(GC.GANGS.has(String(p["gang"])), "عصابة غير محسومة: " + String(p["gang"]))

func _t_save_load_roundtrip() -> void:
	var ms := MatchSetup.new()
	ms.size_key = "large"
	ms.unit_limit = 250
	ms.weather = "snow"
	ms.slots[1]["gang"] = "viper"
	ms.slots[1]["difficulty"] = "hard"
	ms.slots[1]["team"] = 3
	ms.slots[5]["kind"] = "bot"
	ms.fix_colors()
	ms.save()

	var back := MatchSetup.load_saved()
	check(back.size_key == "large", "حجم الخريطة لم يُحفظ")
	check(back.unit_limit == 250, "الحد الأقصى للوحدات لم يُحفظ")
	check(back.weather == "snow", "الطقس لم يُحفظ")
	check(String(back.slots[1]["gang"]) == "viper", "عصابة الخانة لم تُحفظ")
	check(String(back.slots[1]["difficulty"]) == "hard", "صعوبة الخانة لم تُحفظ")
	check(int(back.slots[1]["team"]) == 3, "فريق الخانة لم يُحفظ")
	check(String(back.slots[5]["kind"]) == "bot", "نوع الخانة لم يُحفظ")

# ملف محفوظ تالف لا ينهار: تُصحَّح القيم
func _t_load_repairs_bad_file() -> void:
	var cf := ConfigFile.new()
	cf.set_value("match", "size_key", "حجم_غريب")
	cf.set_value("match", "unit_limit", 7777)
	cf.set_value("match", "weather", "إعصار")
	cf.set_value("slot_0", "kind", "bot")
	cf.set_value("slot_3", "kind", "human")     # خانة بشرية ثانية
	cf.set_value("slot_2", "gang", "تنانين")
	cf.set_value("slot_2", "color", 99)
	cf.set_value("slot_2", "team", -5)
	cf.set_value("slot_2", "difficulty", "مستحيل")
	cf.save(GC.SAVE_PATH)

	var ms := MatchSetup.load_saved()
	check(GC.MAP_SIZES.has(ms.size_key), "حجم خريطة غير معروف لم يُصحَّح")
	check(GC.UNIT_LIMITS.has(ms.unit_limit), "حد وحدات غير معروف لم يُصحَّح")
	check(GC.WEATHERS.has(ms.weather), "طقس غير معروف لم يُصحَّح")
	check(String(ms.slots[0]["kind"]) == "human", "الخانة الأولى لم تُعَد للاعب البشري")
	check(String(ms.slots[3]["kind"]) != "human", "بقيت خانة بشرية ثانية")
	check(GC.GANG_CHOICES.has(String(ms.slots[2]["gang"])), "عصابة غير معروفة لم تُصحَّح")
	check(int(ms.slots[2]["color"]) >= 0 and int(ms.slots[2]["color"]) < GC.PLAYER_COLORS.size(),
		"رقم لون خارج المدى لم يُصحَّح")
	check(int(ms.slots[2]["team"]) >= 0, "رقم فريق سالب لم يُصحَّح")
	check(GC.DIFFICULTIES.has(String(ms.slots[2]["difficulty"])), "صعوبة غير معروفة لم تُصحَّح")
	check(ms.validate() == "", "الإعداد المُصحَّح غير صالح: " + ms.validate())
	DirAccess.remove_absolute(GC.SAVE_PATH)

func _t_unit_limits_and_weathers() -> void:
	check(GC.UNIT_LIMITS == [30, 50, 100, 150, 200, 250], "قائمة حدود الوحدات لا تطابق الوصف")
	check(GC.WEATHERS.size() == 5, "أنواع الطقس ليست خمسة")
	check(GC.PLAYER_COLORS.size() == 8, "ألوان اللاعبين ليست ثمانية")
	var seen := {}
	for c in GC.PLAYER_COLORS:
		check(not seen.has(c.to_html()), "لون مكرر في جدول الألوان")
		seen[c.to_html()] = true
