class_name Spawner
extends RefCounted
# ظهور الأفراد — القسم 7 من docs/GAME_SPEC.md
# الأفراد العاديون:   كل max(4, 14 − (D−1) × 1) ثانية
# الشخصيات المميزة:  كل max(30, 75 − (D−1) × 3) ثانية، بالتناوب بين شخصيتي العصابة
# البطل لا يدخل هذه الدورة إطلاقاً (قواعده في 6.6).

var gang_of := {}         # رقم اللاعب -> عصابته
var common_t := {}        # مؤقت العاديين
var special_t := {}       # مؤقت المميزين
var special_i := {}       # أي الشخصيتين دورها
var unit_limit := GC.UNIT_LIMIT_DEFAULT
var clock_bonus := {}     # رقم اللاعب -> true إذا ملك برج الساعة (3.7)
var hero_t := {}          # مؤقت عودة البطل بعد موته (6.6)

func setup(players: int, gangs: Dictionary, limit: int) -> void:
	gang_of = gangs
	unit_limit = limit
	common_t = {}
	special_t = {}
	special_i = {}
	clock_bonus = {}
	hero_t = {}
	for p in players:
		common_t[p] = common_every(p, 1)
		special_t[p] = special_every(p, 1)
		special_i[p] = 0
		hero_t[p] = GC.HERO_RESPAWN

# المعدلات: العقارب × 0.8 للعاديين، برج الساعة × 0.85 للكل (7)
func _factor(player: int, commons: bool) -> float:
	var f := 1.0
	if commons and String(gang_of.get(player, "")) == "scorp":
		f *= GC.SCORP_SPAWN_FACTOR
	if bool(clock_bonus.get(player, false)):
		f *= GC.CLOCK_SPAWN_FACTOR
	return f

func common_every(player: int, districts: int) -> float:
	var d: float = maxf(1.0, float(districts))
	return maxf(GC.SPAWN_COMMON_MIN, GC.SPAWN_COMMON_BASE - (d - 1.0) * GC.SPAWN_COMMON_STEP) * _factor(player, true)

func special_every(player: int, districts: int) -> float:
	var d: float = maxf(1.0, float(districts))
	return maxf(GC.SPAWN_SPECIAL_MIN, GC.SPAWN_SPECIAL_BASE - (d - 1.0) * GC.SPAWN_SPECIAL_STEP) * _factor(player, false)

# لا يوجد أكثر من بطل واحد حي للاعب في أي وقت (6.6)
func hero_alive(player: int, units: Array) -> bool:
	for u in units:
		if int(u["player"]) == player and u["state"] != "dead" and bool(GC.stat(u["key"], "hero")):
			return true
	return false

func alive_of(player: int, units: Array) -> int:
	var c := 0
	for u in units:
		if int(u["player"]) == player and u["state"] != "dead":
			c += 1
	return c

# يرجع قائمة بما يجب إنزاله: {player, key, pos}
func step(delta: float, players: int, districts: Districts, units: Array) -> Array:
	var out := []
	for p in players:
		var owned: int = districts.owned_by(p)
		if owned == 0:
			continue   # بلا أحياء لا ظهور
		var spots: Array = districts.spawn_spots(p, units)
		if spots.is_empty():
			continue
		# البطل لا يدخل دورة الظهور العادية؛ يعود بعد 60 ث وبشرط 5 أحياء (6.6)
		if not hero_alive(p, units):
			if owned >= GC.HERO_RESPAWN_MIN_DISTRICTS:
				hero_t[p] = float(hero_t[p]) - delta
				if float(hero_t[p]) <= 0.0:
					hero_t[p] = GC.HERO_RESPAWN
					out.append({"player": p, "key": String(GC.GANG_HERO.get(String(gang_of.get(p, "crow")), "crow_hero")),
						"pos": spots[randi() % spots.size()]})
			# إذا نقصت أحياؤه عن 5 يتوقف المؤقت حتى ترجع إلى 5
		else:
			hero_t[p] = GC.HERO_RESPAWN

		# عند الوصول للحد الأقصى تتوقف المؤقتات وتستأنف عندما يقل العدد (7)
		if alive_of(p, units) >= unit_limit:
			continue

		common_t[p] = float(common_t[p]) - delta
		if float(common_t[p]) <= 0.0:
			common_t[p] = common_every(p, owned)
			out.append({"player": p, "key": String(gang_of.get(p, "crow")) + "_common",
				"pos": spots[randi() % spots.size()]})

		special_t[p] = float(special_t[p]) - delta
		if float(special_t[p]) <= 0.0:
			special_t[p] = special_every(p, owned)
			var pair: Array = GC.GANG_SPECIALS.get(String(gang_of.get(p, "crow")), [])
			if not pair.is_empty():
				var idx: int = int(special_i[p]) % pair.size()
				special_i[p] = idx + 1
				out.append({"player": p, "key": String(pair[idx]),
					"pos": spots[randi() % spots.size()]})
	return out
