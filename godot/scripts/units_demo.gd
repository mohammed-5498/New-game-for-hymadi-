extends Node2D
# معرض الوحدات: يرسم كل مفاتيح الرسم الثمانية عشر في كل حالاتها الست.
# الغرض التحقق البصري من نقل docs/units-art.js (القسم 13).

const COL_W := 62.0
const ROW_H := 62.0

var art := UnitsArt.new()
var cam: Camera2D
var t := 0.0
var paused := false
var scrub := 0.0        # تمرير يدوي للزمن عند الإيقاف

var touches := {}
var drag_start := Vector2.ZERO
var drag_cam := Vector2.ZERO
var dragging := false
var pinch_dist := 0.0
var pinch_zoom := 1.0

func _ready() -> void:
	cam = $Cam
	cam.zoom = Vector2.ONE * 2.0
	cam.position = Vector2(COL_W * 3.0, ROW_H * 8.0)
	$UI/BackBtn.pressed.connect(func(): get_tree().change_scene_to_file("res://main.tscn"))
	$UI/PauseBtn.pressed.connect(_toggle_pause)
	$UI/StepBtn.pressed.connect(func(): scrub += 0.05)

func _process(delta: float) -> void:
	if not paused:
		t += delta
	queue_redraw()

func _toggle_pause() -> void:
	paused = not paused
	$UI/PauseBtn.text = "تشغيل" if paused else "إيقاف"

func _anim_time(state: String) -> float:
	# hurt و death يأخذان زمناً محلياً يدور داخل مدة الحالة حتى تُرى الدورة كاملة
	var base := t + scrub
	match state:
		"hurt":
			return fmod(base, GC.UNIT_HURT_DUR + 0.25)
		"death":
			return fmod(base, GC.UNIT_DEATH_DUR + 0.5)
	return base

func _draw() -> void:
	var keys: Array = GC.UNIT_KEYS
	var states: Array = GC.UNIT_STATES
	var font := ThemeDB.fallback_font
	var head_col := Color("d8d2c6")

	for ci in states.size():
		var label: String = GC.UNIT_STATE_NAMES[states[ci]]
		draw_string(font, Vector2(float(ci) * COL_W - 26.0, -14.0), label,
			HORIZONTAL_ALIGNMENT_CENTER, 56.0, 9, head_col)

	for ri in keys.size():
		var key: String = keys[ri]
		var gang: String = GC.UNIT_GANG[key]
		var col: Color = GC.GANG_COLORS[gang] if GC.GANG_COLORS.has(gang) else GC.POLICE_COLOR
		var y: float = float(ri) * ROW_H + 28.0
		var is_special: bool = not key.ends_with("_common")
		var sc: float = GC.UNIT_SCALE_SPECIAL if is_special else GC.UNIT_SCALE

		draw_string(font, Vector2(-2.0 * COL_W, y - 12.0), GC.UNIT_NAMES[key],
			HORIZONTAL_ALIGNMENT_RIGHT, COL_W * 1.45, 9, head_col)

		for ci2 in states.size():
			var state: String = states[ci2]
			var p := Vector2(float(ci2) * COL_W, y)
			draw_line(p + Vector2(-16, 0.5), p + Vector2(16, 0.5), Color(1, 1, 1, 0.07), 1.0)
			art.draw_unit(self, key, p, _anim_time(state), state, col, 1, sc * 2.0, 1.15)

# ============ اللمس: سحب وتكبير فقط ============
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			touches[event.index] = event.position
			if touches.size() == 1:
				drag_start = event.position
				drag_cam = cam.position
				dragging = true
			elif touches.size() == 2:
				var v: Array = touches.values()
				pinch_dist = maxf(1.0, (Vector2(v[0]) - Vector2(v[1])).length())
				pinch_zoom = cam.zoom.x
				dragging = false
		else:
			touches.erase(event.index)
			if touches.size() == 0:
				dragging = false
	elif event is InputEventScreenDrag:
		touches[event.index] = event.position
		if touches.size() >= 2:
			var v2: Array = touches.values()
			var d: float = maxf(1.0, (Vector2(v2[0]) - Vector2(v2[1])).length())
			cam.zoom = Vector2.ONE * clampf(pinch_zoom * d / pinch_dist, 0.7, 8.0)
			return
		if dragging:
			cam.position = drag_cam - (event.position - drag_start) / cam.zoom.x
