extends CanvasLayer
# قائمة الإيقاف وشاشة النهاية — القسمان 12.4 و 12.5
# تعمل أثناء التوقف الكامل للعبة، فوضعها PROCESS_MODE_ALWAYS.

signal resume_pressed
signal restart_pressed

var panel: VBoxContainer
var title: Label
var body: Label
var buttons: VBoxContainer
var dim: ColorRect

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 10
	visible = false

	dim = ColorRect.new()
	dim.color = Color(0, 0, 0, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.anchor_right = 1.0
	dim.anchor_bottom = 1.0
	add_child(dim)

	panel = VBoxContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -170
	panel.offset_right = 170
	panel.offset_top = -160
	panel.offset_bottom = 160
	panel.add_theme_constant_override("separation", 10)
	dim.add_child(panel)

	title = Label.new()
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 32)
	panel.add_child(title)

	body = Label.new()
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.add_theme_color_override("font_color", Color("cfc8b8"))
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(body)

	buttons = VBoxContainer.new()
	buttons.add_theme_constant_override("separation", 8)
	panel.add_child(buttons)

func _clear_buttons() -> void:
	for c in buttons.get_children():
		c.queue_free()

func _add_button(text: String, on_press: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 48)
	b.pressed.connect(on_press)
	buttons.add_child(b)

# ============================ 12.4 قائمة الإيقاف ============================
func show_pause() -> void:
	title.text = "إيقاف مؤقت"
	body.text = ""
	_clear_buttons()
	_add_button("متابعة", func(): resume_pressed.emit())
	_add_button("إعادة المباراة", func(): restart_pressed.emit())
	_add_button("القائمة الرئيسية", _to_menu)
	visible = true
	get_tree().paused = true

func hide_menu() -> void:
	visible = false
	get_tree().paused = false

# ============================ 12.5 شاشة النهاية ============================
func show_end(won: bool, seconds: float, stats: Dictionary) -> void:
	title.text = "فزت" if won else "خسرت"
	title.add_theme_color_override("font_color", Color("e0c04a") if won else Color("d9614a"))
	body.text = "مدة المباراة: %s\nأكبر عدد أحياء: %d\nقتلت: %d\nخسرت من وحداتك: %d" % [
		_mmss(seconds), int(stats.get("max_districts", 0)),
		int(stats.get("kills", 0)), int(stats.get("losses", 0))]
	_clear_buttons()
	_add_button("مباراة جديدة", func(): restart_pressed.emit())
	_add_button("القائمة الرئيسية", _to_menu)
	visible = true
	get_tree().paused = true

static func _mmss(seconds: float) -> String:
	var t := int(seconds)
	return "%d:%02d" % [t / 60, t % 60]

func _to_menu() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file("res://menu.tscn")
