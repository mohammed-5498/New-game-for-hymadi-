extends Control
# شريط القوة وتنبيهات الحافة — القسم 12.3
# يرسم فوق كل شيء داخل CanvasLayer، فلا تتأثر بالكاميرا.

const PAD := 8.0
const DOT := 5.0

var game: Node2D = null
var rows: Array = []          # يُعاد بناؤها كل ثانية لا كل إطار
var _acc := 99.0
var collapsed := false
var panel_rect := Rect2()

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(true)

func _process(delta: float) -> void:
	_acc += delta
	if _acc >= GC.POWER_UPDATE:
		_acc = 0.0
		_rebuild()
	queue_redraw()

func _rebuild() -> void:
	if game == null or game.districts_state == null:
		return
	rows = []
	for p in game.player_count:
		var gang := String(game.gang_of.get(p, ""))
		rows.append({
			"player": p,
			"name": String(GC.GANG_NAMES.get(gang, "لاعب %d" % (p + 1))),
			"team": int(game.team_of.get(p, p)),
			"districts": game.districts_state.owned_by(p),
			"units": _alive(p),
			"dead": game.districts_state.defeated(p, game.combat.units),
		})
	# مرتبة تنازلياً حسب عدد الأحياء، والمهزوم في الأسفل
	rows.sort_custom(func(a, b):
		if bool(a["dead"]) != bool(b["dead"]):
			return not bool(a["dead"])
		return int(a["districts"]) > int(b["districts"]))

func _alive(p: int) -> int:
	var c := 0
	for u in game.combat.units:
		if int(u["player"]) == p and u["state"] != "dead":
			c += 1
	return c

# لمسة على رأس اللوحة تطويها (12.3)
func toggle_at(pos: Vector2) -> bool:
	if panel_rect.has_point(pos):
		collapsed = not collapsed
		_save_pref()
		return true
	return false

func _save_pref() -> void:
	var cf := ConfigFile.new()
	cf.load("user://settings.cfg")
	cf.set_value("hud", "power_collapsed", collapsed)
	cf.save("user://settings.cfg")

func load_pref() -> void:
	var cf := ConfigFile.new()
	if cf.load("user://settings.cfg") == OK:
		collapsed = bool(cf.get_value("hud", "power_collapsed", false))

func _draw() -> void:
	if game == null:
		return
	_draw_power_panel()
	_draw_edge_alerts()
	_draw_toasts()

func _draw_power_panel() -> void:
	var font := ThemeDB.fallback_font
	var w := 168.0
	var head := 17.0
	var vis := rows.size()
	var max_h: float = size.y * GC.POWER_MAX_SCREEN
	if not collapsed:
		vis = mini(vis, int((max_h - head) / GC.POWER_ROW_H))
	var h: float = head + (0.0 if collapsed else float(vis) * GC.POWER_ROW_H)
	# الأزرار تنعكس إلى يسار الشاشة مع اتجاه الواجهة RTL، فاللوحة تجلس يميناً
	var x: float = size.x - w - PAD
	var y := 46.0
	panel_rect = Rect2(x, y, w, head)
	draw_rect(Rect2(x, y, w, h), Color(0.07, 0.07, 0.08, 0.72))
	draw_rect(Rect2(x, y, w, head), Color(1, 1, 1, 0.06))

	var mine_d: int = 0
	for r in rows:
		if int(r["player"]) == game.me:
			mine_d = int(r["districts"])
	var title: String = "أحيائي: %d" % mine_d if collapsed else "اللاعبون"
	draw_string(font, Vector2(x + 18, y + 12), title, HORIZONTAL_ALIGNMENT_RIGHT, w - 24, 10, Color("ded8cc"))
	draw_string(font, Vector2(x + 5, y + 12), "▾" if collapsed else "▴",
		HORIZONTAL_ALIGNMENT_LEFT, 12.0, 10, Color("9a948c"))
	if collapsed:
		return

	for i in vis:
		var r: Dictionary = rows[i]
		var ry: float = y + head + float(i) * GC.POWER_ROW_H
		var col: Color = GC.PLAYER_COLORS[int(r["player"]) % GC.PLAYER_COLORS.size()]
		var a: float = GC.POWER_DEAD_ALPHA if bool(r["dead"]) else 1.0
		# سطر اللاعب نفسه مميز بإطار خفيف
		if int(r["player"]) == game.me:
			draw_rect(Rect2(x + 2, ry + 1, w - 4, GC.POWER_ROW_H - 2), Color(1, 1, 1, 0.10), false, 1.0)
		# ترتيب السطر من اليمين: نقطة اللون، الاسم، عدد الأحياء، عدد الوحدات
		draw_circle(Vector2(x + w - 11.0, ry + GC.POWER_ROW_H * 0.5), DOT, Color(col.r, col.g, col.b, a))
		var label := String(r["name"])
		if game.player_count > GC.GANGS.size():
			label += " (%d)" % (int(r["team"]) + 1)
		draw_string(font, Vector2(x + 66.0, ry + 12), label,
			HORIZONTAL_ALIGNMENT_RIGHT, 74.0, 10, Color(0.87, 0.85, 0.80, a))
		draw_string(font, Vector2(x + 26.0, ry + 12), "%d حي" % int(r["districts"]),
			HORIZONTAL_ALIGNMENT_RIGHT, 38.0, 10, Color(0.87, 0.85, 0.80, a))
		draw_string(font, Vector2(x + 5.0, ry + 12), "%d" % int(r["units"]),
			HORIZONTAL_ALIGNMENT_LEFT, 20.0, 10, Color(0.70, 0.68, 0.64, a))
		# المهزوم يُشطب اسمه بخط فوقه
		if bool(r["dead"]):
			draw_line(Vector2(x + 24, ry + 9), Vector2(x + w - 20, ry + 9), Color(0.9, 0.85, 0.8, a), 1.0)

# سهم على حافة الشاشة باتجاه المعركة، ولمسة عليه تنقل الكاميرا (12.3)
func _draw_edge_alerts() -> void:
	for a in game.alerts:
		var p := _edge_point(Vector2(a["pos"]))
		var col: Color = GC.ALERT_ATTACK_COLOR if String(a["kind"]) == "attack" else GC.ALERT_CAPTURE_COLOR
		var fade: float = 1.0 - float(a["t"]) / GC.ALERT_LIFE
		col.a = clampf(fade, 0.0, 1.0)
		var dir: Vector2 = (Vector2(game.world_to_screen(game.tile_to_world(Vector2(a["pos"])))) - p).normalized()
		if dir == Vector2.ZERO:
			dir = Vector2.RIGHT
		var side := dir.orthogonal()
		draw_colored_polygon(PackedVector2Array([
			p + dir * 10.0, p - dir * 6.0 + side * 7.0, p - dir * 6.0 - side * 7.0]), col)
		draw_arc(p, 13.0, 0, TAU, 16, Color(col.r, col.g, col.b, col.a * 0.5), 1.5, true)

func alert_at(pos: Vector2):
	for a in game.alerts:
		if _edge_point(Vector2(a["pos"])).distance_to(pos) < 22.0:
			return a
	return null

func _edge_point(tile: Vector2) -> Vector2:
	var sp: Vector2 = game.world_to_screen(game.tile_to_world(tile))
	var m := 24.0
	return Vector2(clampf(sp.x, m, size.x - m), clampf(sp.y, m, size.y - m))

func _draw_toasts() -> void:
	var font := ThemeDB.fallback_font
	for i in game.toasts.size():
		var t: Dictionary = game.toasts[i]
		var fade: float = clampf(1.0 - float(t["t"]) / GC.TOAST_LIFE, 0.0, 1.0)
		draw_string(font, Vector2(0, size.y * 0.5 - float(i) * 20.0), String(t["text"]),
			HORIZONTAL_ALIGNMENT_CENTER, size.x, 12, Color(0.95, 0.92, 0.85, fade))
