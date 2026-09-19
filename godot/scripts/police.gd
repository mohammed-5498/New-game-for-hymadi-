class_name Police
extends RefCounted
# سلوك مراكز الشرطة — القسم 3.8 من docs/GAME_SPEC.md
# الشرطة طرف محايد معادٍ للجميع: رقم لاعبها -1 وفريقها -1، ولا تستولي على أي حي.

const PLAYER := -1     # لا تنتمي لأي لاعب
const TEAM := -1

var stations: Array = []   # {district, pos, spawn_t, captain_t, captured, clear_t}
var combat: Combat = null
var map = null             # game.gd لسؤاله عن المربعات القابلة للمشي

func setup(districts: Array, c: Combat, map_node) -> void:
	combat = c
	map = map_node
	stations = []
	for d in districts:
		if String(d["type"]) != "police":
			continue
		var tile: Vector2i = d["center"] if Vector2i(d["center"]).x >= 0 else d["cap"]
		if tile.x < 0:
			continue
		stations.append({
			"district": int(d["id"]), "pos": Vector2(tile),
			"spawn_t": GC.POLICE_SPAWN_EVERY, "captain_t": 0.0,
			"captured": false, "clear_t": -1.0,
		})

# الضابط يظهر مع بداية المباراة (3.8)
func spawn_initial() -> void:
	for st in stations:
		_spawn(st, "police_captain")

func _free_spot(st: Dictionary) -> Vector2:
	var base := Vector2i(st["pos"])
	if map != null:
		var spots: Array = map._free_near(base, 3)
		if not spots.is_empty():
			var s: Vector2i = spots[randi() % spots.size()]
			return Vector2(s)
	return Vector2(base)

func _spawn(st: Dictionary, key: String) -> Dictionary:
	var u := combat.spawn(key, PLAYER, TEAM, _free_spot(st))
	u["station"] = int(st["district"])
	u["anchor"] = Vector2(st["pos"])    # حد المطاردة يُقاس من المركز لا من مكان الرصد
	return u

func count_of(st: Dictionary, key: String) -> int:
	var c := 0
	for u in combat.units:
		if u["state"] == "dead" or int(u.get("station", -1)) != int(st["district"]):
			continue
		if String(u["key"]) == key:
			c += 1
	return c

func step(delta: float, districts: Array) -> void:
	for st in stations:
		var d: Dictionary = districts[int(st["district"])]
		# أول استيلاء يوقف الإنتاج إلى الأبد (3.8)
		if int(d.get("owner", -1)) >= 0 and not bool(st["captured"]):
			st["captured"] = true
			st["clear_t"] = GC.POLICE_CLEAR_AFTER_CAPTURE

		if float(st["clear_t"]) >= 0.0:
			st["clear_t"] = float(st["clear_t"]) - delta
			if float(st["clear_t"]) <= 0.0:
				st["clear_t"] = -1.0
				_clear(st)      # تختفي الشرطة الأحياء التابعة له خلال 5 ثوانٍ
			continue

		if bool(st["captured"]):
			continue

		# شرطي كل 10 ثوانٍ بحد أقصى 6، ويستأنف كلما نقص العدد
		if count_of(st, "police_common") < GC.POLICE_MAX_ALIVE:
			st["spawn_t"] = float(st["spawn_t"]) - delta
			if float(st["spawn_t"]) <= 0.0:
				st["spawn_t"] = GC.POLICE_SPAWN_EVERY
				_spawn(st, "police_common")
		else:
			st["spawn_t"] = GC.POLICE_SPAWN_EVERY

		# ضابط واحد، ولا يتكرر إلا بعد موته بـ 40 ثانية
		if count_of(st, "police_captain") == 0:
			st["captain_t"] = float(st["captain_t"]) - delta
			if float(st["captain_t"]) <= 0.0:
				st["captain_t"] = GC.POLICE_CAPTAIN_RESPAWN
				_spawn(st, "police_captain")
		else:
			st["captain_t"] = GC.POLICE_CAPTAIN_RESPAWN

func _clear(st: Dictionary) -> void:
	for u in combat.units:
		if u["state"] == "dead" or int(u.get("station", -1)) != int(st["district"]):
			continue
		u["hp"] = 0.0
		combat._kill(u)

func alive_count() -> int:
	var c := 0
	for u in combat.units:
		if u["state"] != "dead" and int(u["player"]) == PLAYER:
			c += 1
	return c
