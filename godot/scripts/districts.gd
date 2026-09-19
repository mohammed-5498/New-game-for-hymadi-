class_name Districts
extends RefCounted
# ملكية الأحياء والاستيلاء عليها — القسم 8، والفوز والخسارة من القسم 1.
# لا يرسم شيئاً؛ الرسم في game.gd و hud.gd.

var list: Array = []          # مصفوفة الأحياء من MapGen (مرجع مباشر)
var caps: Array = []          # فهرس الأحياء التي لها ساحة علم: {i, tile, pos}
var teams: Dictionary = {}    # رقم اللاعب -> رقم الفريق
var player_count := 0
var events: Array = []        # إشعارات: {"kind": "captured"/"losing", "district": i, "player": p}
var _acc := 0.0

# ============================ التهيئة ============================
func setup(districts: Array, players: int, team_of: Dictionary) -> void:
	list = districts
	player_count = players
	teams = team_of
	caps = []
	events = []
	for d in list:
		var cap: Vector2i = d["cap"]
		d["owner"] = -1            # -1 محايد
		d["value"] = 0.0           # 0..100
		d["claimer"] = -1          # من يملأ التقدم الآن
		d["frozen"] = false
		d["tint_col"] = Color(0, 0, 0, 0)
		d["tint_amt"] = 0.0
		d["want_col"] = Color(0, 0, 0, 0)
		d["want_amt"] = 0.0
		if cap.x < 0:
			continue
		caps.append({"i": int(d["id"]), "tile": cap, "pos": Vector2(cap)})

func claim_home(dist_id: int, player: int) -> void:
	var d: Dictionary = list[dist_id]
	d["owner"] = player
	d["value"] = GC.CAPTURE_MAX
	d["claimer"] = player
	_set_tint(d, player, true)

func _set_tint(d: Dictionary, player: int, instant: bool) -> void:
	if player < 0:
		d["want_col"] = Color(0, 0, 0, 0)
		d["want_amt"] = 0.0
	else:
		d["want_col"] = GC.PLAYER_COLORS[player % GC.PLAYER_COLORS.size()]
		d["want_amt"] = 1.0
	if instant:
		d["tint_col"] = d["want_col"]
		d["tint_amt"] = d["want_amt"]

# ============================ الخطوة الزمنية ============================
func step(delta: float, units: Array) -> void:
	# الانتقال اللوني خلال نصف ثانية لا دفعة واحدة (8)
	var k: float = clampf(delta / GC.TINT_TIME, 0.0, 1.0)
	for d in list:
		if float(d["tint_amt"]) != float(d["want_amt"]) or Color(d["tint_col"]) != Color(d["want_col"]):
			d["tint_amt"] = lerpf(float(d["tint_amt"]), float(d["want_amt"]), k)
			d["tint_col"] = Color(d["tint_col"]).lerp(Color(d["want_col"]), k)

	_acc += delta
	if _acc < GC.CAPTURE_TICK:
		return
	var dt := _acc
	_acc = 0.0
	_capture_step(dt, units)

func _capture_step(dt: float, units: Array) -> void:
	# قوة كل لاعب داخل كل منطقة استيلاء
	var power := {}    # dist_id -> {player -> power}
	for u in units:
		if u["state"] == "dead":
			continue
		var p: Vector2 = u["pos"]
		for c in caps:
			if p.distance_to(Vector2(c["pos"])) > GC.CAPTURE_RADIUS:
				continue
			var di: int = int(c["i"])
			if not power.has(di):
				power[di] = {}
			var pl: int = int(u["player"])
			power[di][pl] = float(power[di].get(pl, 0.0)) + float(GC.stat(u["key"], "capture"))
			break

	for c in caps:
		var di: int = int(c["i"])
		var d: Dictionary = list[di]
		var inside: Dictionary = power.get(di, {})
		_district_step(d, inside, dt)

func _district_step(d: Dictionary, inside: Dictionary, dt: float) -> void:
	var owner: int = int(d["owner"])

	# من الموجودون، ومن أي الجوانب؟
	var sides := {}          # رقم الفريق -> {player, power}
	for pl in inside.keys():
		var tm: int = int(teams.get(pl, pl))
		var cur: Dictionary = sides.get(tm, {"player": pl, "power": 0.0})
		cur["power"] = float(cur["power"]) + float(inside[pl])
		# صاحب أكبر قوة في الفريق هو من يُنسب له الاستيلاء
		if float(inside[pl]) >= float(inside.get(cur["player"], 0.0)):
			cur["player"] = pl
		sides[tm] = cur

	d["frozen"] = false

	# جانبان غير متحالفين داخل المنطقة: يتجمد التقدم (8)
	if sides.size() > 1:
		d["frozen"] = true
		return

	if sides.is_empty():
		# لا أحد: يرجع التقدم تدريجياً لحالة المالك
		if owner >= 0:
			d["value"] = minf(GC.CAPTURE_MAX, float(d["value"]) + GC.CAPTURE_DECAY * dt)
			d["claimer"] = owner
		else:
			d["value"] = maxf(0.0, float(d["value"]) - GC.CAPTURE_DECAY * dt)
			if float(d["value"]) <= 0.0:
				d["claimer"] = -1
		return

	var side: Dictionary = sides.values()[0]
	var actor: int = int(side["player"])
	var actor_team: int = int(teams.get(actor, actor))
	var gain: float = minf(float(side["power"]), GC.CAPTURE_POWER_MAX) * GC.CAPTURE_RATE * dt

	# الحلفاء لا يستولون على أحياء بعضهم، والمالك يرمّم حيه فقط
	if owner >= 0 and int(teams.get(owner, owner)) == actor_team:
		d["value"] = minf(GC.CAPTURE_MAX, float(d["value"]) + gain)
		d["claimer"] = owner
		return

	# حي يملكه عدو: يُنزل تقدمه أولاً إلى 0 فيصبح محايداً (8)
	if owner >= 0:
		if float(d["value"]) == GC.CAPTURE_MAX:
			events.append({"kind": "losing", "district": int(d["id"]), "player": actor, "owner": owner})
		d["value"] = maxf(0.0, float(d["value"]) - gain)
		d["claimer"] = owner
		if float(d["value"]) <= 0.0:
			d["owner"] = -1
			d["claimer"] = -1
			_set_tint(d, -1, false)
		return

	# محايد: يُملأ لصالح المستولي
	if int(d["claimer"]) != actor:
		d["claimer"] = actor
		d["value"] = maxf(0.0, float(d["value"]))
	d["value"] = minf(GC.CAPTURE_MAX, float(d["value"]) + gain)
	if float(d["value"]) >= GC.CAPTURE_MAX:
		d["owner"] = actor
		_set_tint(d, actor, false)
		events.append({"kind": "captured", "district": int(d["id"]), "player": actor})

# ============================ استعلامات ============================
func owned_by(player: int) -> int:
	var c := 0
	for d in list:
		if int(d["owner"]) == player:
			c += 1
	return c

func capturable_count() -> int:
	return caps.size()

# ساحات أعلام يملكها اللاعب، مع تفضيل الخالية من الأعداء (7)
func spawn_spots(player: int, units: Array) -> Array:
	var safe := []
	var risky := []
	for c in caps:
		var d: Dictionary = list[int(c["i"])]
		if int(d["owner"]) != player:
			continue
		var enemy := false
		for u in units:
			if u["state"] == "dead" or int(teams.get(int(u["player"]), int(u["player"]))) == int(teams.get(player, player)):
				continue
			if Vector2(u["pos"]).distance_to(Vector2(c["pos"])) <= GC.CAPTURE_RADIUS * 2.0:
				enemy = true
				break
		if enemy:
			risky.append(Vector2(c["pos"]))
		else:
			safe.append(Vector2(c["pos"]))
	return safe if not safe.is_empty() else risky

# اللاعب المتصدر إذا ملك 40% من الأحياء فأكثر (9) — تستعمله البوتات في المرحلة 8
func leader() -> int:
	var total := caps.size()
	if total == 0:
		return -1
	for p in player_count:
		if float(owned_by(p)) / float(total) >= GC.LEADER_SHARE:
			return p
	return -1

# يخسر اللاعب عندما يموت كل أفراده وتُحتل كل أحيائه (القسم 1)
func defeated(player: int, units: Array) -> bool:
	if owned_by(player) > 0:
		return false
	for u in units:
		if int(u["player"]) == player and u["state"] != "dead":
			return false
	return true

# آخر فريق باقٍ يفوز. يرجع رقم الفريق الفائز أو -1 إذا لم تنتهِ المباراة
func winner_team(units: Array) -> int:
	var alive_teams := {}
	for p in player_count:
		if not defeated(p, units):
			alive_teams[int(teams.get(p, p))] = true
	if alive_teams.size() == 1:
		return int(alive_teams.keys()[0])
	return -1

func take_events() -> Array:
	var e := events
	events = []
	return e
