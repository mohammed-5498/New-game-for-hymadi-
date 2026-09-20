class_name MatchSetup
extends RefCounted
# إعداد المباراة وحفظه — القسم 12.2، ويُحفظ في user:// بـ ConfigFile

var size_key := "small"
var unit_limit := 100
var weather := "day"
var slots: Array = []        # {kind, gang, color, team, difficulty}

func _init() -> void:
	reset()

func reset() -> void:
	size_key = "small"
	unit_limit = GC.UNIT_LIMITS[GC.UNIT_LIMIT_DEFAULT_INDEX]
	weather = "day"
	slots = []
	for i in GC.MAX_SLOTS:
		slots.append({
			"kind": "human" if i == 0 else ("bot" if i < 4 else "closed"),
			"gang": "random", "color": i, "team": 0,
			"difficulty": GC.BOT_DIFFICULTY_DEFAULT,
		})

func max_players() -> int:
	return int(GC.MAP_SIZES[size_key]["max_players"])

func active_slots() -> Array:
	var out := []
	for i in slots.size():
		if String(slots[i]["kind"]) != "closed":
			out.append(i)
	return out

# اللمس على اللون ينتقل لأول لون غير مستخدم (12.2)
func next_free_color(slot: int) -> int:
	var used := {}
	for i in slots.size():
		if i != slot and String(slots[i]["kind"]) != "closed":
			used[int(slots[i]["color"])] = true
	var start: int = int(slots[slot]["color"])
	for step in range(1, GC.PLAYER_COLORS.size() + 1):
		var c: int = (start + step) % GC.PLAYER_COLORS.size()
		if not used.has(c):
			return c
	return start

func fix_colors() -> void:
	var used := {}
	for i in slots.size():
		if String(slots[i]["kind"]) == "closed":
			continue
		var c: int = int(slots[i]["color"])
		if used.has(c):
			c = next_free_color(i)
			slots[i]["color"] = c
		used[c] = true

# زر "ابدأ" يتحقق قبل البدء (12.2). يرجع رسالة خطأ، أو نصاً فارغاً إذا كان الإعداد سليماً
func validate() -> String:
	var active := active_slots()
	if active.size() < 2:
		return "تحتاج لاعبَين على الأقل."
	if active.size() > max_players():
		return "حجم الخريطة %s يتسع لـ %d لاعبين فقط." % [
			String(GC.MAP_SIZES[size_key]["label"]), max_players()]
	var humans := 0
	for i in active:
		if String(slots[i]["kind"]) == "human":
			humans += 1
	if humans != 1:
		return "لا بد من خانة واحدة لك بالضبط."
	# جانبان متعاديان على الأقل: "بدون فريق" يعني عدو للجميع
	var hostile := false
	for a in active:
		for b in active:
			if a == b:
				continue
			if _enemy(a, b):
				hostile = true
	if not hostile:
		return "كل اللاعبين في فريق واحد، فلا يوجد خصم."
	return ""

func _enemy(a: int, b: int) -> bool:
	var ta: int = int(slots[a]["team"])
	var tb: int = int(slots[b]["team"])
	if ta == 0 or tb == 0:
		return true          # بدون فريق = عدو للجميع
	return ta != tb

# ترتيب اللاعبين الفعليين: الخانة البشرية أولاً ليكون رقمها 0
func players() -> Array:
	var out := []
	for i in active_slots():
		if String(slots[i]["kind"]) == "human":
			out.append(_player_of(i))
	for i in active_slots():
		if String(slots[i]["kind"]) != "human":
			out.append(_player_of(i))
	# الفريق: "بدون" يجعل اللاعب في فريق خاص به لا يشاركه أحد
	for p in out.size():
		var t: int = int(out[p]["team"])
		out[p]["team_id"] = (1000 + p) if t == 0 else t
	return out

func _player_of(slot: int) -> Dictionary:
	var g := String(slots[slot]["gang"])
	if g == "random":
		g = GC.GANGS[randi() % GC.GANGS.size()]
	return {
		"slot": slot, "kind": String(slots[slot]["kind"]), "gang": g,
		"color": int(slots[slot]["color"]), "team": int(slots[slot]["team"]),
		"difficulty": String(slots[slot]["difficulty"]),
	}

# ============================ الحفظ ============================
func save() -> void:
	var cf := ConfigFile.new()
	cf.load(GC.SAVE_PATH)
	cf.set_value("match", "size_key", size_key)
	cf.set_value("match", "unit_limit", unit_limit)
	cf.set_value("match", "weather", weather)
	for i in slots.size():
		cf.set_value("slot_%d" % i, "kind", String(slots[i]["kind"]))
		cf.set_value("slot_%d" % i, "gang", String(slots[i]["gang"]))
		cf.set_value("slot_%d" % i, "color", int(slots[i]["color"]))
		cf.set_value("slot_%d" % i, "team", int(slots[i]["team"]))
		cf.set_value("slot_%d" % i, "difficulty", String(slots[i]["difficulty"]))
	cf.save(GC.SAVE_PATH)

static func load_saved() -> MatchSetup:
	var ms := MatchSetup.new()
	var cf := ConfigFile.new()
	if cf.load(GC.SAVE_PATH) != OK:
		return ms
	ms.size_key = String(cf.get_value("match", "size_key", ms.size_key))
	if not GC.MAP_SIZES.has(ms.size_key):
		ms.size_key = "small"
	ms.unit_limit = int(cf.get_value("match", "unit_limit", ms.unit_limit))
	if not GC.UNIT_LIMITS.has(ms.unit_limit):
		ms.unit_limit = GC.UNIT_LIMITS[GC.UNIT_LIMIT_DEFAULT_INDEX]
	ms.weather = String(cf.get_value("match", "weather", ms.weather))
	if not GC.WEATHERS.has(ms.weather):
		ms.weather = "day"
	for i in ms.slots.size():
		var sec := "slot_%d" % i
		if not cf.has_section(sec):
			continue
		var kind := String(cf.get_value(sec, "kind", String(ms.slots[i]["kind"])))
		ms.slots[i]["kind"] = kind if GC.SLOT_KINDS.has(kind) else "closed"
		var gang := String(cf.get_value(sec, "gang", "random"))
		ms.slots[i]["gang"] = gang if GC.GANG_CHOICES.has(gang) else "random"
		ms.slots[i]["color"] = clampi(int(cf.get_value(sec, "color", i)), 0, GC.PLAYER_COLORS.size() - 1)
		ms.slots[i]["team"] = clampi(int(cf.get_value(sec, "team", 0)), 0, GC.TEAM_NAMES.size() - 1)
		var diff := String(cf.get_value(sec, "difficulty", GC.BOT_DIFFICULTY_DEFAULT))
		ms.slots[i]["difficulty"] = diff if GC.DIFFICULTIES.has(diff) else GC.BOT_DIFFICULTY_DEFAULT
	# خانة اللاعب البشري لا بد أن تكون الأولى دائماً (12.2)
	ms.slots[0]["kind"] = "human"
	for i in range(1, ms.slots.size()):
		if String(ms.slots[i]["kind"]) == "human":
			ms.slots[i]["kind"] = "bot"
	ms.fix_colors()
	return ms
