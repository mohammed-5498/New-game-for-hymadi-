extends Node2D
# نموذج "مدينة العصابات" على Godot 4.x — المراحل 1 و 3 و 4
# الخريطة والتحكم منقولان من docs/prototype.html، والتوليد في scripts/map_gen.gd.
# الأرقام كلها في scripts/config.gd (GC).

var n: int = 26
var size_key: String = "small"
var player_count: int = 4

var road: Array = []
var kind: Array = []
var region: Array = []
var owner_dist: Array = []
var districts: Array = []
var caps: Array = []       # {tile, gang, type, special, district}

var art := UnitsArt.new()
var combat: Combat
var districts_state := Districts.new()
var spawner := Spawner.new()
var police := Police.new()
var bots: Array = []           # بوت لكل لاعب غير بشري (11)
var difficulty := GC.BOT_DIFFICULTY_DEFAULT
var setup: MatchSetup          # إعداد المباراة من قائمة الإعداد (12.2)
var color_of := {}             # رقم اللاعب -> رقم لونه
var unit_limit := GC.UNIT_LIMIT_DEFAULT
var weather := "day"
var stats := {}                # إحصائيات شاشة النهاية (12.5)
var match_time := 0.0
var gang_of := {}          # رقم اللاعب -> عصابته
var team_of := {}          # رقم اللاعب -> فريقه (بلا تحالفات بعد: الفريق = اللاعب)
var alerts: Array = []     # تنبيهات الحافة (12.3)
var toasts: Array = []     # إشعارات قصيرة
var match_over := -1       # رقم الفريق الفائز، أو -1 إذا لم تنتهِ
var hud = null
var overlay = null
var wx = null
# لوحات الرسم (14): الخريطة ثابتة لا تُعاد في كل إطار، والوحدات وحدها تتحرك
var _ci: CanvasItem = null       # اللوحة الجارية الآن
var fire_layer: DrawLayer = null
var top_layer: DrawLayer = null
var map_bands: Array = []        # (لم يعد يُستعمل، بقي للتوافق مع الفحوص)
var map_segs: Array = []         # قطع المباني الثابتة، كل واحدة تُخفى وحدها (14)
var band_segs: Array = []        # قطع كل قطر
var seg_rect: Array = []         # حدود كل قطعة في العالم (للفحص والتوثيق)
var unit_bands: Array = []       # لوحة وحدات متحركة لكل قطر
var band_units: Array = []       # وحدات كل قطر، تُوزَّع مرة في الإطار (14)
var band_prev: Array = []        # أي قطر كان فيه وحدات في الإطار الماضي
var live_tiles: Array = []       # مبانٍ فيها جزء متحرك: الساعة والشرطة والأعلام
var dist_bands: Array = []       # أول وآخر قطر يمر به كل حي (14)
var _view := Rect2()             # ما تراه الكاميرا الآن، يُحسب مرة كل إطار (14)
var _lod_t := 0.0                # مؤقت إعادة حساب مستويات التفصيل (5.4.5)
var map_draws := 0               # كم مرة أُعيد رسم الخريطة الثابتة (للفحص)
var unit_draws := 0              # وكم وحدة رُسمت في الإطار الأخير (للفحص)
var show_fps := false            # يظهر بثلاث لمسات على شريط المعلومات (14)
var _fps_taps := 0
var _fps_tap_t := 0.0
var _fps_t := 0.0              # عقدة الطقس (10)
var decor: Array = []      # زينة الشوارع: براميل نار وأعمدة إنارة
var dash: Array = []       # علامات منتصف الشوارع
var lights: Array = []     # مصادر الإضاءة الليلية، تُبنى مرة مع الخريطة (10)
var me := 0                # رقم اللاعب البشري
var shake_t := 0.0
var shake_cool := 0.0
var cam_home := Vector2.ZERO
var astar := AStarGrid2D.new()
var cam: Camera2D
var mode_btn: Button
var size_btn: Button
var info: Label
var select_mode := false
var marker := {"pos": Vector2.ZERO, "t": 99.0}

var touches := {}
var drag_start := Vector2.ZERO
var drag_cam := Vector2.ZERO
var dragging := false
var moved := false
var pinch_dist := 0.0
var pinch_zoom := 1.0
var sel_box_a := Vector2.ZERO
var sel_box_b := Vector2.ZERO
var box_active := false
var press_t := 0.0         # لقياس الضغطة المطوّلة (4.2)
var long_fired := false
var last_tap_t := -99.0    # زمن آخر لمسة على وحدة، للنقر المزدوج (4.2)
var last_tap_unit := -1
var cam_bounds := Rect2()  # حدود الخريطة، لا تخرج عنها الكاميرا (4.2)

func _ready() -> void:
	setup = MatchSetup.load_saved()
	if setup.validate() != "":
		setup.reset()          # إعداد محفوظ غير صالح: نرجع للافتراضي بدل الانهيار
	size_key = setup.size_key
	unit_limit = setup.unit_limit
	weather = _roll_weather(setup.weather)
	_apply_player_count()
	combat = Combat.new(self)
	combat.on_hit = _on_hit
	combat.on_death = _on_death
	cam = $Cam
	mode_btn = $UI/ModeBtn
	size_btn = $UI/SizeBtn
	info = $UI/Info
	info.mouse_filter = Control.MOUSE_FILTER_STOP
	info.gui_input.connect(_info_tapped)
	cam.zoom = Vector2.ONE * GC.ZOOM_START
	mode_btn.pressed.connect(_toggle_mode)
	size_btn.pressed.connect(_cycle_size)
	$UI/SelAllBtn.pressed.connect(_select_all)
	$UI/NewMapBtn.pressed.connect(generate_map)
	$UI/DemoBtn.pressed.connect(func(): get_tree().change_scene_to_file("res://units_demo.tscn"))
	$UI/FightBtn.pressed.connect(_test_battle)
	$UI/DiffBtn.pressed.connect(_cycle_difficulty)
	wx = $Weather
	wx.set_kind(weather)
	hud = $UI/Hud
	hud.game = self
	hud.load_pref()
	overlay = $Overlay
	overlay.resume_pressed.connect(func(): overlay.hide_menu())
	overlay.restart_pressed.connect(_restart)
	$UI/PauseBtn.pressed.connect(func(): overlay.show_pause())
	$UI/ClearBtn.pressed.connect(_clear_selection)
	generate_map()

# "عشوائي" يُحسم مرة واحدة عند بدء المباراة ويبقى ثابتاً طوالها (10)
func _roll_weather(w: String) -> String:
	if w != "random":
		return w
	var pool := GC.WEATHERS.filter(func(k): return k != "random")
	return String(pool[randi() % pool.size()])

# ثلاث لمسات متتالية على شريط المعلومات تُظهر عدّاد الإطارات (14)
func _info_tapped(event: InputEvent) -> void:
	var down: bool = (event is InputEventScreenTouch and event.pressed) \
		or (event is InputEventMouseButton and event.pressed)
	if not down:
		return
	var now: float = float(Time.get_ticks_msec()) / 1000.0
	_fps_taps = (_fps_taps + 1) if now - _fps_tap_t < GC.FPS_TAP_GAP else 1
	_fps_tap_t = now
	if _fps_taps >= 3:
		_fps_taps = 0
		show_fps = not show_fps
		_refresh_info()

# إعادة المباراة بنفس الإعدادات (12.4)
func _restart() -> void:
	overlay.hide_menu()
	generate_map()

func _clear_selection() -> void:
	for u in combat.units:
		u["sel"] = false
	_refresh_info()

func _process(delta: float) -> void:
	if match_over < 0:
		match_time += delta
	combat.step(delta)
	districts_state.step(delta, combat.units)
	police.step(delta, districts)
	if match_over < 0:
		for b in bots:
			b.step(delta, combat, districts_state, districts)
	_handle_district_events()
	if match_over < 0:
		for spawn in spawner.step(delta, player_count, districts_state, combat.units):
			combat.spawn(String(spawn["key"]), int(spawn["player"]), int(team_of.get(int(spawn["player"]), int(spawn["player"]))), Vector2(spawn["pos"]))
		stats["max_districts"] = maxi(int(stats.get("max_districts", 0)), districts_state.owned_by(me))
		match_over = districts_state.winner_team(combat.units)
		if match_over >= 0:
			# شاشة النهاية (12.5)
			overlay.show_end(match_over == int(team_of.get(me, me)), match_time, stats)
	_age_alerts(delta)
	marker["t"] += delta
	if dragging and not moved and not long_fired:
		press_t += delta
		if press_t >= GC.LONG_PRESS:
			long_fired = true
			_command(_tile_at(drag_start), true)
	# ارتجاج الكاميرا عند الضربات المميزة فقط (5.2)
	shake_cool = maxf(0.0, shake_cool - delta)
	if shake_t > 0.0:
		shake_t = maxf(0.0, shake_t - delta)
		var k: float = shake_t / GC.SHAKE_DUR
		cam.offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * GC.SHAKE_PIXELS * k
	elif cam.offset != Vector2.ZERO:
		cam.offset = Vector2.ZERO
	_clamp_cam()
	_refresh_layers()
	_refresh_lod(delta)
	if show_fps:
		_fps_t += delta
		if _fps_t >= GC.FPS_UPDATE:
			_fps_t = 0.0
			_refresh_info()

# مستويات التفصيل الثلاثة (5.4.5): الأقرب للكاميرا كامل، وباقي ما على الشاشة مبسّط،
# وما خارجها إحصائي. يُعاد الحساب كل نصف ثانية لا كل إطار.
func _refresh_lod(delta: float) -> void:
	_lod_t -= delta
	if _lod_t > 0.0:
		return
	_lod_t = GC.LOD_EVERY
	var center: Vector2 = _view.position + _view.size * 0.5
	var near := []
	for u in combat.units:
		if u["state"] == "dead":
			continue
		var p := tile_to_world(u["pos"])
		if _view.has_point(p):
			u["lod"] = GC.LOD_SIMPLE
			near.append([p.distance_squared_to(center), u])
		else:
			u["lod"] = GC.LOD_STAT
	# أقرب 60 وحدة للكاميرا كاملة، و 30 فقط إذا تجاوزت المباراة 800 وحدة
	var cap: int = GC.LOD_NEAR_CROWDED if combat.units.size() > GC.LOD_CROWD else GC.LOD_NEAR
	if near.size() > cap:
		near.sort_custom(func(a, b): return float(a[0]) < float(b[0]))
	for i in mini(cap, near.size()):
		near[i][1]["lod"] = GC.LOD_FULL

# لا يُعاد رسم إلا ما تحرّك فعلاً (14)
func _clamp_cam() -> void:
	if cam_bounds.size.x <= 0.0:
		return
	cam.position = Vector2(
		clampf(cam.position.x, cam_bounds.position.x, cam_bounds.end.x),
		clampf(cam.position.y, cam_bounds.position.y, cam_bounds.end.y))

func _refresh_layers() -> void:
	if top_layer == null:
		return
	_view = _visible_rect()   # "رسم ما يظهر في الشاشة فقط" (14)
	unit_draws = 0
	top_layer.queue_redraw()
	fire_layer.queue_redraw()
	# توزيع الوحدات على الأقطار مرة واحدة، وداخل الشاشة فقط (14)
	for s in band_units.size():
		band_prev[s] = not band_units[s].is_empty()
		band_units[s].clear()
	for u in combat.units:
		if not _view.has_point(tile_to_world(u["pos"])):
			continue
		var s: int = int(round(u["pos"].x + u["pos"].y))
		if s >= 0 and s < band_units.size():
			band_units[s].append(u)
	for s in band_units.size():
		if band_prev[s] or not band_units[s].is_empty():
			unit_bands[s].queue_redraw()
	# تلوين حي تغيّر: الخريطة الثابتة تحتاج رسمة واحدة جديدة (8)
	if districts_state.tint_dirty:
		districts_state.tint_dirty = false
		var ids: Array = districts_state.tint_dirty_ids.duplicate()
		districts_state.tint_dirty_ids.clear()
		if ids.is_empty():
			redraw_map()
		else:
			for d in ids:
				redraw_district(int(d))

func _on_death(victim: Dictionary, killer) -> void:
	if int(victim["player"]) == me:
		stats["losses"] = int(stats.get("losses", 0)) + 1
	elif killer != null and int(killer["player"]) == me:
		stats["kills"] = int(stats.get("kills", 0)) + 1

func _on_hit(victim: Dictionary, _dealt: float, is_ult: bool) -> void:
	if is_ult and shake_cool <= 0.0:
		shake_t = GC.SHAKE_DUR
		shake_cool = GC.SHAKE_COOLDOWN
	# سهم أحمر إذا تضررت وحدة لي خارج حدود الشاشة (12.3)
	if int(victim["player"]) == me:
		_add_alert(Vector2(victim["pos"]), "attack")

# ============ التنبيهات والإشعارات (12.3) ============
func _add_alert(tile: Vector2, kind: String) -> void:
	if _visible_rect().has_point(tile_to_world(tile)):
		return
	for a in alerts:
		if String(a["kind"]) == kind and Vector2(a["pos"]).distance_to(tile) <= GC.ALERT_AREA:
			a["t"] = 0.0   # نفس المنطقة: نجدّد العمر ولا نضيف سهماً جديداً
			return
	if alerts.size() >= GC.ALERT_MAX:
		alerts.sort_custom(func(x, y): return float(x["t"]) > float(y["t"]))
		alerts.remove_at(0)
	alerts.append({"pos": tile, "kind": kind, "t": 0.0, "cool": GC.ALERT_REPEAT})

func _age_alerts(delta: float) -> void:
	var keep := []
	for a in alerts:
		a["t"] = float(a["t"]) + delta
		if float(a["t"]) < GC.ALERT_LIFE:
			keep.append(a)
	alerts = keep
	var tk := []
	for t in toasts:
		t["t"] = float(t["t"]) + delta
		if float(t["t"]) < GC.TOAST_LIFE:
			tk.append(t)
	toasts = tk

func _toast(text: String) -> void:
	toasts.append({"text": text, "t": 0.0})
	if toasts.size() > 3:
		toasts.pop_front()

func _handle_district_events() -> void:
	for e in districts_state.take_events():
		var d: Dictionary = districts[int(e["district"])]
		var pl: int = int(e["player"])
		if String(e["kind"]) == "captured":
			_refresh_clock_bonus()   # مكافأة برج الساعة تنتقل مع ملكيته (3.7)
			if pl == me:
				_toast("سيطرت على حي")
			elif int(e.get("owner", -1)) == me:
				_toast("خسرت حياً")
		elif String(e["kind"]) == "losing" and int(e.get("owner", -1)) == me:
			# سهم برتقالي عندما يبدأ عدو بالاستيلاء على حي تملكه (12.3)
			_add_alert(Vector2(d["cap"]), "capture")
			_toast("عدو يستولي على حيك")

# ============ توليد الخريطة ============
# عدد اللاعبين من قائمة الإعداد، مقصوصاً على حد حجم الخريطة (3.2)
func _apply_player_count() -> void:
	player_count = clampi(setup.active_slots().size(), 2, int(GC.MAP_SIZES[size_key]["max_players"]))

func generate_map() -> void:
	var gen := MapGen.new()
	# عصابات اللاعبين تُمرَّر للتوليد حتى يأخذ كل حي منزلي طابع عصابة صاحبه (3.6)
	var want_gangs := []
	for w in setup.players():
		want_gangs.append(String(w["gang"]))
	var m := gen.generate(size_key, player_count, 0, want_gangs)
	n = int(m["n"])
	road = m["road"]
	kind = m["kind"]
	region = m["region"]
	decor = m["decor"]
	dash = m["dash"]
	owner_dist = m["owner_dist"]
	districts = m["districts"]

	caps = []
	for d in districts:
		var cap: Vector2i = d["cap"]
		if cap.x < 0:
			continue
		caps.append({
			"tile": cap, "gang": String(d["gang"]), "type": String(d["type"]),
			"special": String(d["special"]), "district": int(d["id"]),
		})
	for w in m["warnings"]:
		push_warning("[خريطة] %s" % w)

	_build_astar()
	_build_lights()
	_build_layers()
	_setup_match()
	_refresh_info()

# مصادر الإضاءة الليلية: نوافذ العمارات وبراميل النار وأعمدة الإنارة وساحات الأعلام (10).
# تُبنى مرة واحدة مع الخريطة لأنها ثابتة، ولا تُحسب كل إطار.
func _build_lights() -> void:
	lights = []
	for j in n:
		for i in n:
			var t := j * n + i
			var c := tile_to_world(Vector2(i, j))
			match String(kind[t]):
				"A":
					var h: float = 32.0 + float((i + j) % 2) * 8.0
					_add_light(c + Vector2(0, -h * 0.5), GC.LIGHT_WINDOW)
				"P":
					_add_light(c + Vector2(0, -4), GC.LIGHT_FLAG)
				"B":
					_add_light(c + Vector2(0, -7), GC.LIGHT_BARREL)
			match String(decor[t]):
				"B":
					_add_light(c + Vector2(0, -7), GC.LIGHT_BARREL)
				"L":
					_add_light(c + Vector2(6, -17), GC.LIGHT_LAMP)
					_add_light(c + Vector2(6, 1), GC.LIGHT_LAMP_POOL)
	if wx != null:
		wx.lights = lights

func _add_light(pos: Vector2, spec: Dictionary) -> void:
	lights.append({"pos": pos, "r": float(spec["r"]), "c": Color(spec["c"]), "a": float(spec["a"])})

func walkable(i: int, j: int) -> bool:
	if i < 0 or j < 0 or i >= n or j >= n:
		return false
	var t := j * n + i
	return road[t] or kind[t] == "." or kind[t] == "P"

# يسأله محرك القتال عن مسار بين نقطتين بإحداثيات المربعات العشرية
func find_path(from: Vector2, to: Vector2) -> Array:
	var a := Vector2i(clampi(int(round(from.x)), 0, n - 1), clampi(int(round(from.y)), 0, n - 1))
	var b := Vector2i(clampi(int(round(to.x)), 0, n - 1), clampi(int(round(to.y)), 0, n - 1))
	if not walkable(a.x, a.y):
		return []
	if not walkable(b.x, b.y):
		var near := _free_near(b, 1)
		if near.is_empty():
			return []
		b = near[0]
	var ids := astar.get_id_path(a, b)
	var out := []
	for i in ids.size():
		if i == 0 and ids.size() > 1:
			continue   # نتجاهل المربع الذي نقف فيه حتى لا ترجع الوحدة للخلف
		out.append(Vector2(float(ids[i].x), float(ids[i].y)))
	return out

# ============ حقل التدفق للمجموعات الكبيرة (14) ============
# المنطق كله في scripts/flow_field.gd حتى يُفحص وحده. هنا ربطه بالخريطة فقط.
var _walk_grid := PackedByteArray()   # شبكة المشي، تُبنى مع الخريطة ولا تتغير بعدها

func _build_walk_grid() -> void:
	_walk_grid.resize(n * n)
	for j2 in n:
		for i2 in n:
			_walk_grid[j2 * n + i2] = 1 if walkable(i2, j2) else 0

func build_flow(goals: Array) -> PackedInt32Array:
	if _walk_grid.size() != n * n:
		_build_walk_grid()
	# وجهة داخل مبنى تُزحزح إلى أقرب مربع حر، كما يفعل A* تماماً
	var tiles: Array = []
	for g in goals:
		var t := Vector2i(clampi(int(round(g.x)), 0, n - 1), clampi(int(round(g.y)), 0, n - 1))
		if not walkable(t.x, t.y):
			var near := _free_near(t, 1)
			if near.is_empty():
				continue
			t = near[0]
		tiles.append(t)
	return FlowField.build(n, _walk_grid, tiles)

func flow_path(from: Vector2, field: PackedInt32Array) -> Array:
	if _walk_grid.size() != n * n:
		_build_walk_grid()
	return FlowField.path(n, _walk_grid, from, field, GC.FLOW_MAX_STEPS)

func _build_astar() -> void:
	_walk_grid = PackedByteArray()   # تُعاد مع كل خريطة جديدة
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, n, n)
	astar.cell_size = Vector2.ONE
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.update()
	for j in n:
		for i in n:
			astar.set_point_solid(Vector2i(i, j), not walkable(i, j))

func _setup_match() -> void:
	combat.clear()
	alerts = []
	toasts = []
	match_over = -1
	gang_of = {}
	team_of = {}

	# اللاعبون من قائمة الإعداد (12.2): الخانة البشرية أولاً فيكون رقمها 0.
	# العصابة تُقرأ من الحي المنزلي لأن التوليد حسم "العشوائي" فعلاً.
	var wanted: Array = setup.players()
	var homes := []
	for d in districts:
		if String(d["type"]) == "home":
			homes.append(d)
	player_count = mini(homes.size(), wanted.size())
	color_of = {}
	for p in player_count:
		var w: Dictionary = wanted[p]
		gang_of[p] = String(homes[p]["gang"])
		team_of[p] = int(w["team_id"])
		color_of[p] = int(w["color"])

	combat.weather = weather
	districts_state.color_of = color_of
	districts_state.setup(districts, player_count, team_of)
	combat.teams = team_of
	bots = []
	for p in player_count:
		if p == me:
			continue
		var b := Bot.new()
		b.setup(p, String(wanted[p]["difficulty"]))
		bots.append(b)
	stats = {"kills": 0, "losses": 0, "max_districts": 1}
	match_time = 0.0
	for p in homes.size():
		districts_state.claim_home(int(homes[p]["id"]), p)
	spawner.setup(player_count, gang_of, unit_limit)
	police.setup(districts, combat, self)
	police.spawn_initial()
	_refresh_clock_bonus()

	# البداية: 3 أفراد عاديين + البطل عند ساحة علم الحي المنزلي (7)
	for p in homes.size():
		var cap: Vector2i = homes[p]["cap"]
		if cap.x < 0:
			continue
		var gang := String(gang_of[p])
		var spots := _free_near(cap, GC.START_COMMONS + 1)
		for i in spots.size():
			var t := Vector2(float(spots[i].x), float(spots[i].y))
			var key := gang + "_common"
			if i == spots.size() - 1:
				key = String(GC.GANG_HERO.get(gang, gang + "_common"))
			combat.spawn(key, p, int(team_of[p]), t)
		if p == me:
			cam.position = tile_to_world(Vector2(cap))
			cam_home = cam.position

# مكافآت الأحياء المميزة ومراكز الشرطة (3.7 و 3.8) تنتقل مع الملكية
func _refresh_clock_bonus() -> void:
	spawner.clock_bonus = {}
	combat.player_dmg_mult = {}
	combat.player_heal = {}
	combat.player_armor_bonus = {}
	combat.heal_zones = []
	var police_count := {}
	for d in districts:
		var o: int = int(d["owner"])
		if o < 0:
			continue
		match String(d["special"]):
			"clock":
				spawner.clock_bonus[o] = true
			"armory":
				combat.player_dmg_mult[o] = float(combat.player_dmg_mult.get(o, 1.0)) + GC.ARMORY_DAMAGE_BONUS
			"hospital":
				combat.player_heal[o] = float(combat.player_heal.get(o, 0.0)) + GC.HOSPITAL_HEAL_GLOBAL
				if Vector2i(d["cap"]).x >= 0:
					combat.heal_zones.append({"pos": Vector2(d["cap"]), "player": o,
						"dps": GC.HOSPITAL_HEAL_IN_ZONE - GC.HOSPITAL_HEAL_GLOBAL})
		if String(d["type"]) == "police":
			police_count[o] = int(police_count.get(o, 0)) + 1
	# درع مراكز الشرطة يتجمع بحد أقصى +20% (3.8)
	for o in police_count.keys():
		combat.player_armor_bonus[o] = minf(GC.POLICE_ARMOR_BONUS_MAX,
			float(police_count[o]) * GC.POLICE_ARMOR_BONUS)

# معركة تجريبية: فريقان متقابلان قرب مركز الشاشة لتجربة القتال فوراً
func _test_battle() -> void:
	var center := world_to_tile(cam.position)
	var mid := Vector2i(clampi(int(round(center.x)), 2, n - 3), clampi(int(round(center.y)), 2, n - 3))
	var spots := _free_near(mid, 16)
	if spots.size() < 4:
		return
	var keys_a := ["crow_common", "crow_spear", "crow_dual", "crow_common"]
	var keys_b := ["viper_common", "hammer_shield", "viper_sniper", "hammer_common"]
	for i in spots.size():
		var t := Vector2(float(spots[i].x), float(spots[i].y))
		if i % 2 == 0:
			combat.spawn(keys_a[(i / 2) % keys_a.size()], me, me, t)
		else:
			combat.spawn(keys_b[(i / 2) % keys_b.size()], 1, 1, t)
	_refresh_info()

func _free_near(start: Vector2i, count: int) -> Array:
	var out := []
	var seen := {start: true}
	var q: Array[Vector2i] = [start]
	var head := 0
	while head < q.size() and out.size() < count:
		var cur: Vector2i = q[head]
		head += 1
		if walkable(cur.x, cur.y):
			out.append(cur)
		for dx in [-1, 0, 1]:
			for dy in [-1, 0, 1]:
				var nx: int = cur.x + dx
				var ny: int = cur.y + dy
				if nx < 0 or ny < 0 or nx >= n or ny >= n:
					continue
				if seen.has(Vector2i(nx, ny)):
					continue
				if absi(nx - start.x) > 8 or absi(ny - start.y) > 8:
					continue
				seen[Vector2i(nx, ny)] = true
				q.append(Vector2i(nx, ny))
	return out

# ============ التحويل بين المربعات والعالم ============
func tile_to_world(t: Vector2) -> Vector2:
	return Vector2((t.x - t.y) * GC.TW, (t.x + t.y) * GC.TH)

func world_to_tile(w: Vector2) -> Vector2:
	return Vector2((w.x / GC.TW + w.y / GC.TH) * 0.5, (w.y / GC.TH - w.x / GC.TW) * 0.5)

func screen_to_world(p: Vector2) -> Vector2:
	return get_canvas_transform().affine_inverse() * p

func world_to_screen(p: Vector2) -> Vector2:
	return get_canvas_transform() * p

# ============ الرسم ============
func _visible_rect() -> Rect2:
	var inv := get_canvas_transform().affine_inverse()
	var vp := get_viewport_rect().size
	var pts := [inv * Vector2.ZERO, inv * Vector2(vp.x, 0), inv * Vector2(0, vp.y), inv * vp]
	var r := Rect2(pts[0], Vector2.ZERO)
	for p in pts:
		r = r.expand(p)
	return r.grow(64.0)

# ---- بناء اللوحات: مرة مع كل خريطة جديدة (14) ----
func _build_layers() -> void:
	for node in [fire_layer, top_layer]:
		if node != null:
			node.queue_free()
	for node in map_bands + unit_bands:
		node.queue_free()
	for seg in map_segs:
		seg.queue_free()
	map_bands = []
	map_segs = []
	band_segs = []
	unit_bands = []
	fire_layer = _new_layer("fires", 0)
	# لكل قطر: قطع مباني ثابتة (بحدود ضيقة تُخفى وحدها) ثم لوحة وحداته المتحركة
	for s in range(0, 2 * n - 1):
		var lo := maxi(0, s - n + 1)
		var hi := mini(n - 1, s)
		var mine := []
		var a := lo
		while a <= hi:
			var b: int = mini(hi, a + GC.BAND_SEG - 1)
			var seg := _new_layer("band", s)
			seg.from_i = a
			seg.to_i = b
			map_segs.append(seg)
			mine.append(seg)
			a = b + 1
		band_segs.append(mine)
		unit_bands.append(_new_layer("units", s))
	top_layer = _new_layer("top", 0)
	band_units = []
	band_prev = []
	seg_rect = []
	for seg in map_segs:
		seg_rect.append(_seg_bounds(seg.band, seg.from_i, seg.to_i))
	for s in range(0, 2 * n - 1):
		band_units.append([])
		band_prev.append(false)
	# الطقس فوق الجميع، والواجهة فوقه
	if wx != null:
		move_child(wx, get_child_count() - 1)
	_collect_live_tiles()
	_measure_districts()
	# حدود الخريطة في العالم: من أقصى يسار إلى أقصى يمين ومن أعلى إلى أسفل (4.2)
	cam_bounds = Rect2(Vector2(-float(n) * GC.TW, 0.0), Vector2(float(n) * GC.TW * 2.0, float(n) * GC.TH * 2.0))
	cam_bounds = cam_bounds.grow(GC.CAM_MARGIN)
	redraw_map()

# حدود قطعة من قطر في إحداثيات العالم. الارتفاع من أعلى مبنى فيها فعلاً، لا هامش
# واحد كبير للجميع: كلما ضاقت الحدود أمكن إخفاء القطعة أبكر (14)
func _seg_bounds(s: int, a: int, b: int) -> Rect2:
	var p1 := tile_to_world(Vector2(a, s - a))
	var p2 := tile_to_world(Vector2(b, s - b))
	var r := Rect2(p1, Vector2.ZERO).expand(p2)
	var high := 0.0
	for i in range(a, b + 1):
		var j := s - i
		var k: String = kind[j * n + i]
		high = maxf(high, float(GC.KIND_HEIGHT.get(k, GC.KIND_HEIGHT_DEFAULT)))
		if String(decor[j * n + i]) != "":
			high = maxf(high, 22.0)
	return Rect2(r.position - Vector2(GC.TW, high), r.size + Vector2(GC.TW * 2.0, high + GC.TH))

func _new_layer(what: String, band: int) -> DrawLayer:
	var l := DrawLayer.new()
	l.game = self
	l.what = what
	l.band = band
	add_child(l)
	return l

# المباني التي فيها جزء يتحرك كل إطار: عقارب الساعة، ومصباح الشرطة،
# وأعلام الأحياء وأشرطة الاستيلاء. تُرسم هذه فوق الخريطة الثابتة.
# أول وآخر قطر (i + j) يمر به كل حي، حتى نعيد رسم ما يخصه وحده عند تغيّر لونه
func _measure_districts() -> void:
	dist_bands = []
	for d in districts:
		var lo := 99999
		var hi := -1
		for t in d["tiles"]:
			var s: int = int(t.x) + int(t.y)
			lo = mini(lo, s)
			hi = maxi(hi, s)
		# المباني العالية ترتفع فوق مربعها، فنوسّع المدى قليلاً
		dist_bands.append(Vector2i(maxi(0, lo - 1), hi + 1))

func _collect_live_tiles() -> void:
	live_tiles = []
	for j in n:
		for i in n:
			var k: String = kind[j * n + i]
			if k == "C" or k == "S" or k == "P" or k == "Q":
				live_tiles.append({"i": i, "j": j, "k": k})

# تُستدعى عند أي تغيّر يمس شكل الخريطة الثابت (استيلاء، طقس، خريطة جديدة)
func redraw_map() -> void:
	for seg in map_segs:
		seg.queue_redraw()

# لا يُعاد رسم إلا الأقطار التي يمر بها الحي الذي تغيّر لونه (14)
func redraw_district(d: int) -> void:
	if d < 0 or d >= dist_bands.size():
		redraw_map()
		return
	var rng: Vector2i = dist_bands[d]
	for s in range(rng.x, rng.y + 1):
		if s >= 0 and s < band_segs.size():
			for seg in band_segs[s]:
				seg.queue_redraw()

func draw_layer(ci: CanvasItem, what: String, band: int, from_i: int = 0, to_i: int = 0) -> void:
	_ci = ci
	match what:
		"fires":
			for f in combat.fires:
				if _view.has_point(tile_to_world(Vector2(f["pos"]))):
					_draw_fire(f)
		"band":
			map_draws += 1
			_draw_band(band, from_i, to_i)
		"units":
			_draw_unit_band(band)
		"top":
			_draw_top()
	_ci = self

# أرض قطر واحد: تُرسم قبل مبانيه، وكل مربع داخل معيّنه فلا يتداخل مع جاره
func _draw_ground_band(s: int, a: int, b: int) -> void:
	for i in range(a, b + 1):
		var j := s - i
		var c := tile_to_world(Vector2(i, j))
		var key: String = region[j * n + i]
		var col: Color = GC.GROUND[key] if GC.GROUND.has(key) else GC.GROUND["neutral"]
		col = _tinted(col, owner_dist[j * n + i], GC.TINT_GROUND)
		col = Weather.ground(col, bool(road[j * n + i]), weather)   # ثلج أبيض أو مطر أغمق (10)
		var quad := PackedVector2Array([
			c + Vector2(-GC.TW, 0), c + Vector2(0, -GC.TH),
			c + Vector2(GC.TW, 0), c + Vector2(0, GC.TH)])
		_ci.draw_colored_polygon(quad, col)
		# حدّ رفيع بنفس اللون يمنع خطوط الفراغ بين المربعات (كما في النموذج)
		_ci.draw_polyline(quad + PackedVector2Array([quad[0]]), col, 0.6)
		# علامة منتصف الشارع
		var dm: int = int(dash[j * n + i])
		if dm == 1:
			_ci.draw_line(c + Vector2(-4, -2), c + Vector2(4, 2), Color("c9bd85"), 1.0)
		elif dm == 2:
			_ci.draw_line(c + Vector2(4, -2), c + Vector2(-4, 2), Color("c9bd85"), 1.0)

# قطر واحد (i + j = s): أرضه ثم مبانيه، بترتيب العمق كما كان
# مربعات القطر الواحد لا يغطي بعضها بعضاً (متجاورة أفقياً)، فترتيبها داخل القطعة حر
func _draw_band(s: int, a: int, b: int) -> void:
	_draw_ground_band(s, a, b)
	for i in range(a, b + 1):
		var j := s - i
		var c := tile_to_world(Vector2(i, j))
		_draw_object(kind[j * n + i], c, region[j * n + i], i, j, 0.0, owner_dist[j * n + i])
		if String(decor[j * n + i]) != "":
			_draw_decor(String(decor[j * n + i]), c)

func _draw_unit_band(s: int) -> void:
	for u in band_units[s]:
		unit_draws += 1
		_draw_unit(u)

# كل ما يتحرك فوق الخريطة: الأجزاء الحية من المباني، والمقذوفات، وأشرطة الدم
func _draw_top() -> void:
	var t := float(Time.get_ticks_msec()) / 1000.0
	for e in live_tiles:
		var c := tile_to_world(Vector2(int(e["i"]), int(e["j"])))
		if not _view.has_point(c):
			continue
		_draw_live(String(e["k"]), c, t, owner_dist[int(e["j"]) * n + int(e["i"])],
			region[int(e["j"]) * n + int(e["i"])])

	for pr in combat.projectiles:
		if _view.has_point(tile_to_world(pr["pos"])):
			_draw_projectile(pr)

	for u in combat.units:
		if u["state"] == "dead":
			continue
		var p := tile_to_world(u["pos"])
		if not _view.has_point(p):
			continue
		if u["sel"]:
			_ci.draw_arc(p, 5.5, 0, TAU, 20, Color(0.95, 0.93, 0.89), 1.0, true)
		_draw_hp_bar(u, p)
		# نجمة ذهبية فوق الوحدة الجاهزة لضربتها المميزة (6.7)
		if Combat.has_ult(String(u["key"])) and float(u["charge"]) >= GC.CHARGE_FULL and not bool(u["ulting"]):
			var sc: float = GC.UNIT_SCALE_SPECIAL if not String(u["key"]).ends_with("_common") else GC.UNIT_SCALE
			art.draw_ready_mark(_ci, p, sc)

	# علامة نقطة الهدف
	if marker["t"] < 0.8:
		var g: float = marker["t"] / 0.8
		var mcol: Color = Color(0.85, 0.22, 0.18, 1.0 - g) if marker.get("attack", false) else Color(0.95, 0.93, 0.89, 1.0 - g)
		_ci.draw_arc(tile_to_world(marker["pos"]), 6.0 + g * 14.0, 0, TAU, 24, mcol, 1.2, true)

# الأجزاء المتحركة من المباني الثابتة (14)
func _draw_live(k: String, c: Vector2, t: float, dist: int, reg: String) -> void:
	match k:
		"C":
			_clock_hands(c, t)
		"S":
			_police_light(c, t)
		"P":
			_tri(c + Vector2(0, -22), c + Vector2(10, -19), c + Vector2(0, -16), _owner_flag(dist, reg))
			_capture_bar(c, dist)
		"Q":
			_tri(c + Vector2(0, -46), c + Vector2(12, -42), c + Vector2(0, -38), _owner_flag(dist, reg))

func _owner_color(player: int) -> Color:
	if player < 0:
		return GC.POLICE_COLOR
	var ci: int = int(color_of.get(player, player))
	return GC.PLAYER_COLORS[ci % GC.PLAYER_COLORS.size()]

func _draw_unit(u: Dictionary) -> void:
	var col: Color = _owner_color(int(u["player"]))
	if float(u["flash"]) > 0.0:
		# وميض أبيض خفيف عند الإصابة (5.2)
		col = col.lerp(Color(1, 1, 1), 0.55 * float(u["flash"]) / GC.HIT_FLASH)
	var sc: float = GC.UNIT_SCALE_SPECIAL if not String(u["key"]).ends_with("_common") else GC.UNIT_SCALE
	sc *= float(u.get("size", 1.0))   # تنويع ±4% من بذرة الشخصية (5.4.1)
	# نوع الحركة يُمرَّر للرسم ليتغير القوس والاندفاع أثناء الالتحام فقط (5.4.2)
	var mv: String = String(u["move"]) if combat.draw_state(u) == "attack" and float(u["cycle"]) > 0.0 else ""
	art.draw_unit(_ci, String(u["key"]), tile_to_world(u["pos"]),
		combat.draw_time(u), combat.draw_state(u), col, int(u["dir"]), sc, combat.draw_rate(u), mv,
		sc * cam.zoom.x)

# شريط الدم: فوق المحدد أو ناقص الدم فقط، بلون مالك الوحدة (5.2)
# بقعة نار مشتعلة: دائرة برتقالية نابضة مع ألسنة
func _draw_fire(f: Dictionary) -> void:
	var c := tile_to_world(Vector2(f["pos"]))
	var left: float = 1.0 - clampf(float(f["t"]) / float(f["dur"]), 0.0, 1.0)
	var r: float = float(f["radius"])
	var t := float(Time.get_ticks_msec()) / 1000.0
	var pulse: float = 0.9 + sin(t * 6.0) * 0.1
	_ellipse(c, GC.TW * r * pulse, GC.TH * r * pulse, Color(0.91, 0.45, 0.16, 0.30 * left))
	_ellipse(c, GC.TW * r * 0.6, GC.TH * r * 0.6, Color(0.97, 0.75, 0.25, 0.30 * left))
	for i in 5:
		var ang: float = t * 1.6 + float(i) * 1.257
		var p := c + Vector2(cos(ang) * GC.TW * r * 0.65, sin(ang) * GC.TH * r * 0.65)
		var h: float = 4.0 + sin(t * 7.0 + float(i)) * 2.0
		_tri(p + Vector2(-2, 0), p + Vector2(0, -h), p + Vector2(2, 0),
			Color(0.97, 0.83, 0.33, 0.75 * left))

func _draw_hp_bar(u: Dictionary, p: Vector2) -> void:
	var frac: float = clampf(float(u["hp"]) / maxf(1.0, float(u["max_hp"])), 0.0, 1.0)
	var always: bool = bool(GC.stat(u["key"], "hero"))
	if not u["sel"] and not always and frac >= 0.999:
		return
	var w := GC.HP_BAR_W
	var x := p.x - w * 0.5
	var y := p.y + GC.HP_BAR_Y
	_ci.draw_rect(Rect2(x - 0.5, y - 0.5, w + 1.0, GC.HP_BAR_H + 1.0), Color(0, 0, 0, 0.55))
	_ci.draw_rect(Rect2(x, y, w * frac, GC.HP_BAR_H), _owner_color(int(u["player"])))
	_draw_charge(u, x, y, w)

# شريط الشحن الذهبي تحت شريط الدم، ونجمة فوق الرأس عند الجاهزية (6.7)
func _draw_charge(u: Dictionary, x: float, y: float, w: float) -> void:
	if not Combat.has_ult(String(u["key"])):
		return
	var ch: float = float(u["charge"]) / GC.CHARGE_FULL
	var ready: bool = ch >= 1.0
	if not u["sel"] and not ready:
		return
	var cy: float = y + GC.HP_BAR_H + 1.0
	_ci.draw_rect(Rect2(x - 0.5, cy - 0.5, w + 1.0, 2.2), Color(0, 0, 0, 0.5))
	_ci.draw_rect(Rect2(x, cy, w * ch, 1.2), Color("ffd66e"))

func _draw_projectile(pr: Dictionary) -> void:
	var p := tile_to_world(pr["pos"])
	# قوس بسيط يرتفع في منتصف الطيران
	var k: float = clampf(float(pr["t"]) / float(pr["dur"]), 0.0, 1.0)
	p.y -= sin(k * PI) * 5.0
	match String(pr["kind"]):
		"arrow":
			var d: Vector2 = (tile_to_world(pr["pos"]) - tile_to_world(pr["from"])).normalized()
			if d == Vector2.ZERO:
				d = Vector2.RIGHT
			_ci.draw_line(p - d * 3.0, p + d * 3.0, Color("d9d3c6"), 1.0)
		"bottle":
			var ang: float = float(pr["spin"]) + k * 12.0
			_ci.draw_circle(p, 2.0, Color("5a8a6a"))
			_ci.draw_circle(p + Vector2(cos(ang), sin(ang)) * 2.2, 1.3, Color("e8893a"))
		_:
			_ci.draw_circle(p, 1.8, Color("9a948c"))

# خلط لون المالك مع لون أصلي بنسبة معطاة (8)
func _tinted(base: Color, dist: int, amount: float) -> Color:
	if dist < 0 or dist >= districts.size():
		return base
	var d: Dictionary = districts[dist]
	var a: float = float(d.get("tint_amt", 0.0))
	if a <= 0.001:
		return base
	return base.lerp(Color(d["tint_col"]), amount * a)

# ألوان ثابتة من prototype.html — لا تُبدَّل، المرجع هو الملف نفسه
const DKW := Color("3d3a36")      # نافذة مطفأة
const LTW := Color("e3c06a")      # نافذة مضاءة
const CRT := [Color("8a6a4a"), Color("a07e5a"), Color("b89470")]   # خشب الأكشاك
const HOUSE_WALLS := [
	[Color("b59a78"), Color("cdb391")],
	[Color("a88f7a"), Color("c4ab95")],
	[Color("9f9a86"), Color("bab5a0")],
]

# نافذة على الوجه الأيسر من صندوق، بإحداثيات نسبية كما في النموذج (wL)
func _win_l(c: Vector2, w: float, d: float, u: float, v: float, du: float, dv: float, col: Color) -> void:
	_ci.draw_colored_polygon(PackedVector2Array([
		c + Vector2(-w + u * w, u * d - v),
		c + Vector2(-w + (u + du) * w, (u + du) * d - v),
		c + Vector2(-w + (u + du) * w, (u + du) * d - v - dv),
		c + Vector2(-w + u * w, u * d - v - dv)]), col)

# ونافذة على الوجه الأيمن (wR)
func _win_r(c: Vector2, w: float, d: float, u: float, v: float, du: float, dv: float, col: Color) -> void:
	_ci.draw_colored_polygon(PackedVector2Array([
		c + Vector2(u * w, d - u * d - v),
		c + Vector2((u + du) * w, d - (u + du) * d - v),
		c + Vector2((u + du) * w, d - (u + du) * d - v - dv),
		c + Vector2(u * w, d - u * d - v - dv)]), col)

func _poly(pts: Array, col: Color) -> void:
	var out := PackedVector2Array()
	for pt in pts:
		out.push_back(pt)
	_ci.draw_colored_polygon(out, col)

func _draw_object(k: String, c: Vector2, reg: String, i: int, j: int, t: float, dist: int) -> void:
	# الأطلال والأشجار والسيارات المحطمة والبراميل لا تُصبغ — ليست ملكاً لأحد (8)
	var roof := dist
	var wall := dist
	if GC.NO_TINT.has(k):
		roof = -1
		wall = -1
	var k3: int = (i * 7 + j * 3) % 3        # اختلاف ألوان البيوت كما في النموذج
	match k:
		"H":
			# بيت بسقف مائل ونافذتين وباب
			var wc: Array = HOUSE_WALLS[k3]
			var b := c + Vector2(0, 1)
			_box(b, 14, 7, 14, _w(wc[0], wall), _w(wc[1], wall), Color("00000000"))
			_roof(b, 14, 7, 14, 12, _r(_gang_dark(reg), roof), _r(_gang_light(reg), roof))
			_win_l(b, 14, 7, 0.2, 5, 0.25, 4, DKW)
			_win_r(b, 14, 7, 0.6, 5, 0.22, 4, DKW)
			_win_r(b, 14, 7, 0.15, 0, 0.2, 8, Color("5b4636"))
		"A":
			# عمارة بصفوف نوافذ، بعضها مضاء
			var h: float = 32.0 + float((i + j) % 2) * 8.0
			_box(c, 15, 7.5, h, _w(Color("8f8c85"), wall), _w(Color("aaa69e"), wall), _r(Color("77736c"), roof))
			var v := 6
			while float(v) < h - 4.0:
				for n in 2:
					var u: float = 0.15 if n == 0 else 0.55
					_win_l(c, 15, 7.5, u, float(v), 0.25, 4, LTW if (i + j + v + n) % 4 == 0 else DKW)
					_win_r(c, 15, 7.5, u, float(v), 0.25, 4, LTW if (i + 2 * j + v + n) % 5 == 0 else DKW)
				v += 7
			_box(c + Vector2(-4, -h), 3, 1.5, 5, Color("6b6861"), Color("7f7c75"), Color("5e5b55"))
		"R":
			# أطلال مهدمة بجدران مكسورة وركام على الأرض
			var rw := 14.0
			var rd := 7.0
			_poly([c + Vector2(-rw, -12), c + Vector2(0, -rd - 10), c + Vector2(rw, -5), c + Vector2(0, rd - 9)], Color("5e574d"))
			_poly([c + Vector2(-rw, 0), c + Vector2(0, rd), c + Vector2(0, rd - 9),
				c + Vector2(-rw * 0.5, rd * 0.5 - 17), c + Vector2(-rw, -12)], Color("8a8074"))
			_poly([c + Vector2(0, rd), c + Vector2(rw, 0), c + Vector2(rw, -5),
				c + Vector2(rw * 0.55, rd * 0.45 - 13), c + Vector2(0, rd - 9)], Color("a39888"))
			_win_l(c, rw, rd, 0.3, 4, 0.22, 4, DKW)
			_poly([c + Vector2(5, 7), c + Vector2(9, 4), c + Vector2(14, 7), c + Vector2(9, 9)], Color("6e665b"))
			_poly([c + Vector2(-12, 4), c + Vector2(-8, 2), c + Vector2(-4, 5), c + Vector2(-8, 7)], Color("7d7466"))
		"Y":
			# مصنع بمدخنة ودخان (3.6)
			_box(c, 16, 8, 18, _w(Color("7a5040"), wall), _w(Color("945f4b"), wall), _r(Color("5e4035"), roof))
			for u in [0.1, 0.4, 0.7]:
				_win_l(c, 16, 8, u, 7, 0.18, 6, DKW)
			_win_r(c, 16, 8, 0.35, 0, 0.3, 10, Color("4a3b32"))
			_box(c + Vector2(6, -19), 3, 1.5, 22, Color("5d4a3f"), Color("6e584b"), Color("4a3b32"))
			_ci.draw_circle(c + Vector2(7, -46), 4.0, Color(0.639, 0.616, 0.584, 0.7))
			_ci.draw_circle(c + Vector2(11, -52), 5.0, Color(0.639, 0.616, 0.584, 0.55))
			_ci.draw_circle(c + Vector2(16, -59), 6.0, Color(0.639, 0.616, 0.584, 0.4))
		"W":
			_box(c, 17, 8.5, 12, _w(Color("7f7a70"), wall), _w(Color("99938a"), wall), _r(Color("6c675f"), roof))
			_win_r(c, 17, 8.5, 0.3, 0, 0.35, 8, Color("4a453f"))      # باب المستودع الكبير
		"T":
			var o: float = float((i + j) % 2) * 3.0 - 1.5
			_ci.draw_rect(Rect2(c.x - 1.0 + o, c.y - 8.0, 2.0, 8.0), Color("5b4636"))
			_ci.draw_circle(c + Vector2(o, -13), 7.0, Weather.snow(Color("4f7a3c"), GC.SNOW_TREE, weather))
			_ci.draw_circle(c + Vector2(-3 + o, -15), 5.0, Weather.snow(Color("5f8f48"), GC.SNOW_TREE_TOP, weather))
			_ci.draw_circle(c + Vector2(3 + o, -11), 4.0, Weather.snow(Color("5f8f48"), GC.SNOW_TREE, weather))
		"Z":
			# أكشاك سوق بمظلات ملونة (3.6)
			_box(c + Vector2(2, -5), 3, 1.5, 3, CRT[0], CRT[1], CRT[2])
			for st in [[Vector2(-7, 0), Color("c24f3e")], [Vector2(6, 3), Color("3e6fa0")]]:
				var sp: Vector2 = c + st[0]
				_box(sp, 6, 3, 5, Color("8a6a4a"), Color("a07e5a"), Color("00000000"))
				_roof(sp, 7, 3.5, 5, 4, st[1], Color("e8e0d0"))
		"X":
			# سيارة محطمة
			_box(c + Vector2(0, 2), 8, 4, 4, Color("6b4f3a"), Color("85624a"), Color("57402f"))
			_box(c + Vector2(1, -2), 4, 2, 3, Color("3d3a36"), Color("555049"), Color("4a4540"))
		"G":
			# خزان ماء على أعمدة
			_ci.draw_line(c + Vector2(-7, 2), c + Vector2(-5, -20), Color("5d4a3f"), 1.5)
			_ci.draw_line(c + Vector2(7, 2), c + Vector2(5, -20), Color("5d4a3f"), 1.5)
			_ci.draw_line(c + Vector2(0, 5), c + Vector2(0, -20), Color("5d4a3f"), 1.5)
			_ellipse(c + Vector2(0, -20), 8.0, 3.0, Color("7a6552"))
			_ci.draw_rect(Rect2(c.x - 8.0, c.y - 32.0, 16.0, 12.0), _w(Color("8c7560"), wall))
			_ellipse(c + Vector2(0, -32), 8.0, 3.0, _r(Color("a08a74"), roof))
			_tri(c + Vector2(-8, -32), c + Vector2(0, -41), c + Vector2(8, -32), _r(Color("6e584b"), roof))
		"B":
			_draw_barrel(c)
		"Q":
			# مقر العصابة: نوافذ وسارية، والعلم في الطبقة العليا لأن لونه يتغير (14)
			_box(c, 16, 8, 26, _w(_gang_dark(reg), wall), _w(_gang_light(reg), wall), _r(Color("3a3632"), roof))
			for pw in [[0.2, 8.0], [0.6, 8.0], [0.2, 17.0], [0.6, 17.0]]:
				_win_l(c, 16, 8, pw[0], pw[1], 0.2, 5, Color("2b2825"))
				_win_r(c, 16, 8, pw[0], pw[1], 0.2, 5, Color("2b2825"))
			_ci.draw_line(c + Vector2(0, -26), c + Vector2(0, -46), Color("2b2825"), 1.2)
		"P":
			# الساحة والسارية ثابتتان، والعلم وشريط الاستيلاء في الطبقة العليا (14)
			_ci.draw_colored_polygon(PackedVector2Array([
				c + Vector2(-12, 0), c + Vector2(0, -6), c + Vector2(12, 0), c + Vector2(0, 6)]), Color("b3aa98"))
			_ellipse_dashed(c, 15.0, 7.5, Color(1, 1, 1, 0.55), 0.8)
			_ci.draw_line(c, c + Vector2(0, -22), Color("2b2825"), 1.2)
		"M":
			_hospital(c, wall, roof)
		"K":
			_armory(c, wall, roof)
		"C":
			_clock_tower(c, t, wall)
		"F":
			_fountain(c)
		"S":
			_police_station(c, t, wall, roof)

# بيضاوي متقطع (بديل setLineDash في النموذج)
func _ellipse_dashed(center: Vector2, rx: float, ry: float, col: Color, w: float) -> void:
	var seg := 36
	for e in seg:
		if e % 2 == 1:
			continue
		var a1: float = TAU * float(e) / float(seg)
		var a2: float = TAU * float(e + 1) / float(seg)
		_ci.draw_line(center + Vector2(cos(a1) * rx, sin(a1) * ry),
			center + Vector2(cos(a2) * rx, sin(a2) * ry), col, w)

# زينة الشوارع (7): برميل نار وعمود إنارة — منقولة من prototype.html
func _draw_barrel(c: Vector2) -> void:
	_ci.draw_rect(Rect2(c.x - 2.5, c.y - 5.0, 5.0, 6.0), Color("4f4337"))
	_tri(c + Vector2(-3, -5), c + Vector2(0, -13), c + Vector2(3, -5), Color("e8893a"))
	_tri(c + Vector2(-1.5, -5), c + Vector2(0, -9), c + Vector2(1.5, -5), Color("f2c14e"))

func _draw_decor(d: String, c: Vector2) -> void:
	if d == "B":
		_draw_barrel(c)
	elif d == "L":
		_ci.draw_line(c + Vector2(10, 3), c + Vector2(10, -18), Color("2b2825"), 1.2)
		_ci.draw_line(c + Vector2(10, -18), c + Vector2(6, -19), Color("2b2825"), 1.0)
		_ci.draw_circle(c + Vector2(6, -18.5), 1.6, Color("f2e3a8"))

# ---- مباني الأحياء المميزة ومركز الشرطة ----
func _hospital(c: Vector2, wall: int, roof: int) -> void:
	_box(c, 17, 8.5, 24, _w(Color("a9a59b"), wall), _w(Color("c2bdb1"), wall), _r(Color("8e8a81"), roof))
	# صليب باهت على الواجهة
	var cross := Color("b8543f")
	_ci.draw_rect(Rect2(c.x + 5.0, c.y - 19.0, 6.0, 2.2), cross)
	_ci.draw_rect(Rect2(c.x + 6.9, c.y - 21.0, 2.2, 6.0), cross)
	# نوافذ مكسورة
	for k in 3:
		_ci.draw_rect(Rect2(c.x - 13.0 + float(k) * 4.5, c.y - 17.0 + float(k) * 2.2, 3.0, 4.0), Color("50524f"))

func _armory(c: Vector2, wall: int, roof: int) -> void:
	_box(c, 17, 8.5, 13, _w(Color("7f7a70"), wall), _w(Color("99938a"), wall), _r(Color("6c675f"), roof))
	# صناديق ذخيرة أمام المستودع
	_box(c + Vector2(-7, 6), 4, 2, 5, Color("6d5a3c"), Color("856e4a"), Color("57482f"))
	_box(c + Vector2(2, 7), 4.5, 2.2, 4, Color("6d5a3c"), Color("856e4a"), Color("57482f"))
	_box(c + Vector2(-2, 3), 3.5, 1.8, 7, Color("5f5137"), Color("796445"), Color("4a3f2a"))

func _clock_tower(c: Vector2, _t: float, wall: int) -> void:
	_box(c, 9, 4.5, 44, _w(Color("9c9488"), wall), _w(Color("b5ac9e"), wall), Color("00000000"))
	# وجه الساعة (العقارب في الطبقة العليا لأنها تدور)
	var face := c + Vector2(0, -38)
	_ci.draw_circle(face, 6.0, Color("e4dcc9"))
	_ci.draw_arc(face, 6.0, 0, TAU, 20, Color("4a443c"), 1.0, true)
	# سقف هرمي
	_tri(c + Vector2(-9, -44), c + Vector2(0, -56), c + Vector2(9, -44), Color("6b5a44"))

func _clock_hands(c: Vector2, t: float) -> void:
	var face := c + Vector2(0, -38)
	var mins := fmod(t * 0.6, 1.0) * TAU
	_ci.draw_line(face, face + Vector2(sin(mins), -cos(mins)) * 4.6, Color("32302b"), 1.0)
	_ci.draw_line(face, face + Vector2(sin(mins * 0.08), -cos(mins * 0.08)) * 3.0, Color("32302b"), 1.3)

func _fountain(c: Vector2) -> void:
	_ellipse(c, 11.0, 5.5, Color("8f8a80"))
	_ellipse(c, 8.5, 4.2, Color("4d6f82"))
	_ci.draw_rect(Rect2(c.x - 1.0, c.y - 9.0, 2.0, 9.0), Color("9c9488"))
	_ellipse(c + Vector2(0, -10), 3.0, 1.5, Color("b7b0a4"))

func _police_station(c: Vector2, _t: float, wall: int, roof: int) -> void:
	_box(c, 16, 8, 22, _w(Color("6f7a86"), wall), _w(Color("8794a1"), wall), _r(Color("5b646e"), roof))
	# شريط أزرق على الواجهة (المصباح الوامض في الطبقة العليا)
	_ci.draw_rect(Rect2(c.x - 14.0, c.y - 12.0, 13.0, 2.4), GC.POLICE_COLOR)

func _police_light(c: Vector2, t: float) -> void:
	var blink: float = 0.45 + 0.55 * absf(sin(t * 3.0))
	_ci.draw_circle(c + Vector2(0, -25), 2.6, Color(0.35, 0.6, 1.0, blink))
	_ci.draw_circle(c + Vector2(0, -25), 4.6, Color(0.35, 0.6, 1.0, blink * 0.28))

# لون العلم = لون مالك الحي، وإلا اللون المحايد (8)
func _owner_flag(dist: int, reg: String) -> Color:
	if dist >= 0 and dist < districts.size():
		var o: int = int(districts[dist].get("owner", -1))
		if o >= 0:
			return UnitsArt.lt(_owner_color(o), 0.25)
	return _flag_color(reg)

# شريط تقدم الاستيلاء فوق العلم بلون المستولي (8)
func _capture_bar(c: Vector2, dist: int) -> void:
	if dist < 0 or dist >= districts.size():
		return
	var d: Dictionary = districts[dist]
	var v: float = float(d.get("value", 0.0))
	var owner: int = int(d.get("owner", -1))
	var claimer: int = int(d.get("claimer", -1))
	# لا يُعرض الشريط لحي مستقر بيد مالكه ولا لحي محايد فارغ
	if (owner >= 0 and v >= GC.CAPTURE_MAX) or (owner < 0 and v <= 0.0):
		return
	var w := 16.0
	var y := c.y - 28.0
	var x := c.x - w * 0.5
	_ci.draw_rect(Rect2(x - 0.5, y - 0.5, w + 1.0, 3.0), Color(0, 0, 0, 0.55))
	var who: int = claimer if claimer >= 0 else owner
	var col: Color = _owner_color(who) if who >= 0 else Color("cfc8b8")
	if bool(d.get("frozen", false)):
		col = col.lerp(Color(0.6, 0.6, 0.6), 0.5)   # متجمد: جانبان داخل المنطقة
	_ci.draw_rect(Rect2(x, y, w * (v / GC.CAPTURE_MAX), 2.0), col)

func _w(base: Color, dist: int) -> Color:
	return _tinted(base, dist, GC.TINT_WALL)

func _r(base: Color, dist: int) -> Color:
	return _tinted(base, dist, GC.TINT_ROOF)

func _gang_dark(reg: String) -> Color:
	if GC.GANG_COLORS.has(reg):
		return UnitsArt.dk(GC.GANG_COLORS[reg], 0.45)
	return Color("7d4f3c")

func _gang_light(reg: String) -> Color:
	if GC.GANG_COLORS.has(reg):
		return UnitsArt.dk(GC.GANG_COLORS[reg], 0.2)
	return Color("9c6349")

func _flag_color(reg: String) -> Color:
	if GC.GANG_COLORS.has(reg):
		return UnitsArt.lt(GC.GANG_COLORS[reg], 0.35)
	return Color("e8e2d6")

func _tri(a: Vector2, b: Vector2, c: Vector2, col: Color) -> void:
	_ci.draw_colored_polygon(PackedVector2Array([a, b, c]), col)

func _ellipse(center: Vector2, rx: float, ry: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 20:
		var ang := TAU * float(i) / 20.0
		pts.push_back(center + Vector2(cos(ang) * rx, sin(ang) * ry))
	_ci.draw_colored_polygon(pts, col)

func _box(c: Vector2, w: float, d: float, h: float, left: Color, right: Color, top: Color) -> void:
	_ci.draw_colored_polygon(PackedVector2Array([
		c + Vector2(-w, 0), c + Vector2(0, d), c + Vector2(0, d - h), c + Vector2(-w, -h)]), left)
	_ci.draw_colored_polygon(PackedVector2Array([
		c + Vector2(0, d), c + Vector2(w, 0), c + Vector2(w, -h), c + Vector2(0, d - h)]), right)
	if top.a > 0.0:
		# الثلج يتراكم على الوجه العلوي (10)
		_ci.draw_colored_polygon(PackedVector2Array([
			c + Vector2(-w, -h), c + Vector2(0, -d - h), c + Vector2(w, -h), c + Vector2(0, d - h)]),
			Weather.snow(top, GC.SNOW_TOP, weather))

func _roof(c: Vector2, w: float, d: float, h: float, rh: float, left: Color, right: Color) -> void:
	var apex := c + Vector2(0, -h - rh)
	_ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-w, -h), apex, c + Vector2(w, -h)]), UnitsArt.dk(left, 0.3))
	_ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-w, -h), c + Vector2(0, d - h), apex]),
		Weather.snow(left, GC.SNOW_ROOF_L, weather))
	_ci.draw_colored_polygon(PackedVector2Array([c + Vector2(0, d - h), c + Vector2(w, -h), apex]),
		Weather.snow(right, GC.SNOW_ROOF_R, weather))

# ============ اللمس ============
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			touches[event.index] = event.position
			if touches.size() == 1:
				drag_start = event.position
				drag_cam = cam.position
				dragging = true
				moved = false
				box_active = false
				press_t = 0.0
				long_fired = false
			elif touches.size() == 2:
				var v: Array = touches.values()
				pinch_dist = maxf(1.0, (Vector2(v[0]) - Vector2(v[1])).length())
				pinch_zoom = cam.zoom.x
				dragging = false
				box_active = false
		else:
			var was: Vector2 = touches.get(event.index, event.position)
			touches.erase(event.index)
			if touches.size() == 0:
				if dragging and not moved and not long_fired:
					_tap(was)
				elif box_active:
					_apply_box()
				dragging = false
				box_active = false
	elif event is InputEventMouseButton and event.pressed:
		# عجلة الماوس على الكمبيوتر: تكبير وتصغير (4.2)
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom_at(clampf(cam.zoom.x * GC.WHEEL_ZOOM, GC.ZOOM_MIN, GC.ZOOM_MAX), event.position)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom_at(clampf(cam.zoom.x / GC.WHEEL_ZOOM, GC.ZOOM_MIN, GC.ZOOM_MAX), event.position)
	elif event is InputEventScreenDrag:
		touches[event.index] = event.position
		if touches.size() >= 2:
			var v: Array = touches.values()
			var d: float = maxf(1.0, (Vector2(v[0]) - Vector2(v[1])).length())
			var mid: Vector2 = (Vector2(v[0]) + Vector2(v[1])) * 0.5
			_zoom_at(clampf(pinch_zoom * d / pinch_dist, GC.ZOOM_MIN, GC.ZOOM_MAX), mid)
			return
		if not dragging:
			return
		if (event.position - drag_start).length() > GC.TAP_SLOP:
			moved = true
		if not moved:
			return
		if select_mode:
			box_active = true
			sel_box_a = drag_start
			sel_box_b = event.position
		else:
			cam.position = drag_cam - (event.position - drag_start) / cam.zoom.x

# تكبير يُبقي النقطة التي تحت الإصبعين (أو مؤشر الماوس) ثابتة مكانها (4.2)
func _zoom_at(z: float, screen_pos: Vector2) -> void:
	var before := screen_to_world(screen_pos)
	cam.zoom = Vector2.ONE * z
	var after := screen_to_world(screen_pos)
	cam.position += before - after
	_clamp_cam()

func _tile_at(screen_pos: Vector2) -> Vector2i:
	var t := world_to_tile(screen_to_world(screen_pos))
	return Vector2i(int(round(t.x)), int(round(t.y)))

func _unit_at(screen_pos: Vector2, mine: bool):
	var best = null
	var bd := GC.TAP_RADIUS
	for u in combat.units:
		if u["state"] == "dead":
			continue
		if mine and int(u["player"]) != me:
			continue
		if not mine and int(u["player"]) == me:
			continue
		var d: float = (world_to_screen(tile_to_world(u["pos"]) + Vector2(0, -5)) - screen_pos).length()
		if d < bd:
			bd = d
			best = u
	return best

func _selected() -> Array:
	var sel := []
	for u in combat.units:
		if u["sel"] and u["state"] != "dead":
			sel.append(u)
	return sel

func _tap(screen_pos: Vector2) -> void:
	# رأس لوحة القوة يطويها، وسهم التنبيه ينقل الكاميرا (12.3)
	if hud != null:
		if hud.toggle_at(screen_pos):
			return
		var a = hud.alert_at(screen_pos)
		if a != null:
			cam.position = tile_to_world(Vector2(a["pos"]))
			alerts.erase(a)
			return
	# لمسة على وحدة من وحداتي = تحديدها، ونقرتان سريعتان = تحديد مجموعتها (4.2)
	var mine = _unit_at(screen_pos, true)
	if mine != null:
		var now: float = float(Time.get_ticks_msec()) / 1000.0
		var again: bool = int(mine["id"]) == last_tap_unit and now - last_tap_t <= GC.DOUBLE_TAP
		last_tap_t = now
		last_tap_unit = int(mine["id"])
		for v in combat.units:
			v["sel"] = false
		if again:
			# كل وحداتي داخل 5 مربعات حول تلك الوحدة، أياً كان نوعها
			for v in combat.units:
				if int(v["player"]) == me and v["state"] != "dead" \
						and Vector2(v["pos"]).distance_to(Vector2(mine["pos"])) <= GC.DOUBLE_TAP_RADIUS:
					v["sel"] = true
		else:
			mine["sel"] = true
		_refresh_info()
		if select_mode:
			_toggle_mode()   # تحديد ناجح: رجوع تلقائي لوضع تحريك الخريطة (4.2)
		return
	last_tap_unit = -1
	# لمسة على عدو ومعي وحدات محددة = أمر هجوم (بلا حد مطاردة، 5.2)
	var sel := _selected()
	var foe = _unit_at(screen_pos, false)
	if foe != null and not sel.is_empty():
		combat.order_attack(sel, foe)
		marker["pos"] = Vector2(foe["pos"])
		marker["t"] = 0.0
		marker["attack"] = true
		return
	_command(_tile_at(screen_pos), false)

func _command(target: Vector2i, attack_move: bool) -> void:
	var sel := _selected()
	if sel.is_empty():
		return
	var goal := Vector2i(clampi(target.x, 0, n - 1), clampi(target.y, 0, n - 1))
	var spots := _free_near(goal, sel.size() * 2)
	if sel.size() > GC.FLOW_MIN_GROUP:
		# مجموعة كبيرة: حقل تدفق واحد من كل المربعات بدل A* لكل وحدة (14)
		var dests: Array = []
		for sp in spots:
			dests.append(Vector2(float(sp.x), float(sp.y)))
		if dests.is_empty():
			dests.append(Vector2(float(goal.x), float(goal.y)))
		combat.order_move_flow(sel, dests, attack_move)
	else:
		var k := 0
		for u in sel:
			var dest := goal
			if k < spots.size():
				dest = spots[k]
			k += 1
			combat.order_move([u], Vector2(float(dest.x), float(dest.y)), attack_move)
	marker["pos"] = Vector2(float(goal.x), float(goal.y))
	marker["t"] = 0.0
	marker["attack"] = attack_move

func _apply_box() -> void:
	var r := Rect2(sel_box_a, sel_box_b - sel_box_a).abs()
	var got := 0
	for u in combat.units:
		if int(u["player"]) != me or u["state"] == "dead":
			continue
		u["sel"] = r.has_point(world_to_screen(tile_to_world(u["pos"])))
		if u["sel"]:
			got += 1
	box_active = false
	_refresh_info()
	# الرجوع التلقائي لوضع التحريك بعد تحديد ناجح فقط؛ المربع الفارغ يبقيك
	# في وضع التحديد لتعيد المحاولة (4.2)
	if select_mode and got > 0:
		_toggle_mode()

func _toggle_mode() -> void:
	select_mode = not select_mode
	mode_btn.text = "تحديد الجنود" if select_mode else "تحريك الخريطة"

# تبديل صعوبة البوتات وإعادة بدء المباراة (قائمة الإعداد في المرحلة 9)
func _cycle_difficulty() -> void:
	var idx: int = GC.DIFFICULTIES.find(difficulty)
	difficulty = GC.DIFFICULTIES[(idx + 1) % GC.DIFFICULTIES.size()]
	$UI/DiffBtn.text = "الصعوبة: %s" % String(GC.DIFFICULTY_NAMES[difficulty])
	_setup_match()
	_refresh_info()

func _cycle_size() -> void:
	var idx: int = GC.SIZE_ORDER.find(size_key)
	size_key = GC.SIZE_ORDER[(idx + 1) % GC.SIZE_ORDER.size()]
	setup.size_key = size_key
	_apply_player_count()
	generate_map()

func _select_all() -> void:
	for u in combat.units:
		u["sel"] = int(u["player"]) == me and u["state"] != "dead"
	_refresh_info()

func _refresh_info() -> void:
	var sel := 0
	var mine := 0
	var foes := 0
	for u in combat.units:
		if u["state"] == "dead":
			continue
		if u["sel"]:
			sel += 1
		if int(u["player"]) == me:
			mine += 1
		elif int(u["player"]) >= 0:
			foes += 1
	var specials := 0
	var police_places := 0
	var homes := 0
	var capturable := 0
	for d in districts:
		match String(d["type"]):
			"special": specials += 1
			"police": police_places += 1
			"home": homes += 1
		if Vector2i(d["cap"]).x >= 0:
			capturable += 1
	var label: String = String(GC.MAP_SIZES[size_key]["label"])
	size_btn.text = "الحجم: %s" % label
	# شريط المعلومات (4.1): المحدد، الوحدات/الحد، الأحياء المملوكة، أيقونة الطقس
	info.text = "%s  محدد %d  |  وحدات %d/%d  |  أحيائي %d من %d  |  أعداء %d" % [
		String(GC.WEATHER_ICONS.get(weather, "")), sel, mine, unit_limit,
		districts_state.owned_by(me), capturable, foes]
	if show_fps:
		info.text = "%d إطار/ث  |  %s" % [int(Engine.get_frames_per_second()), info.text]
