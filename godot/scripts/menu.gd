extends Control
# القائمة الرئيسية وقائمة الإعداد — القسمان 12.1 و 12.2
# الواجهة تُبنى بالكود بدل ملف مشهد ضخم، والاتجاه RTL من إعدادات المشروع.

var setup: MatchSetup
var main_panel: VBoxContainer
var setup_panel: VBoxContainer
var error_label: Label
var size_btn: OptionButton
var limit_btn: OptionButton
var weather_btn: OptionButton
var slot_rows: Array = []

func _ready() -> void:
	setup = MatchSetup.load_saved()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_main()
	_build_setup()
	_show_main()

func _bg() -> void:
	var bg := ColorRect.new()
	bg.color = Color("14140f")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	move_child(bg, 0)

# ============================ 12.1 القائمة الرئيسية ============================
func _build_main() -> void:
	_bg()
	main_panel = VBoxContainer.new()
	main_panel.set_anchors_preset(Control.PRESET_CENTER)
	main_panel.anchor_left = 0.5
	main_panel.anchor_right = 0.5
	main_panel.anchor_top = 0.5
	main_panel.anchor_bottom = 0.5
	main_panel.offset_left = -170
	main_panel.offset_right = 170
	main_panel.offset_top = -120
	main_panel.offset_bottom = 120
	main_panel.add_theme_constant_override("separation", 14)
	add_child(main_panel)

	var title := Label.new()
	title.text = GC.GAME_TITLE
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 40)
	main_panel.add_child(title)

	var sub := Label.new()
	sub.text = "عصابات تتقاتل على أحياء مدينة قديمة"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_color_override("font_color", Color("9a948c"))
	main_panel.add_child(sub)

	main_panel.add_child(_spacer(18))
	var play := Button.new()
	play.text = "لعب"
	play.custom_minimum_size = Vector2(0, 58)
	play.add_theme_font_size_override("font_size", 24)
	play.pressed.connect(_show_setup)
	main_panel.add_child(play)

	var quit := Button.new()
	quit.text = "خروج"
	quit.custom_minimum_size = Vector2(0, 44)
	quit.pressed.connect(func(): get_tree().quit())
	main_panel.add_child(quit)

func _spacer(h: int) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h)
	return c

# ============================ 12.2 قائمة الإعداد ============================
func _build_setup() -> void:
	var scroll := ScrollContainer.new()
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.offset_left = 14
	scroll.offset_right = -14
	scroll.offset_top = 12
	scroll.offset_bottom = -12
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)

	setup_panel = VBoxContainer.new()
	setup_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	setup_panel.add_theme_constant_override("separation", 7)
	scroll.add_child(setup_panel)
	setup_panel.set("theme_override_constants/separation", 7)

	var head := Label.new()
	head.text = "إعداد المباراة"
	head.add_theme_font_size_override("font_size", 24)
	setup_panel.add_child(head)

	size_btn = _option_row("حجم الخريطة", [], func(i): _on_size(i))
	for key in GC.SIZE_ORDER:
		var info: Dictionary = GC.MAP_SIZES[key]
		size_btn.add_item("%s %d×%d (حتى %d لاعبين)" % [
			String(info["label"]), int(info["n"]), int(info["n"]), int(info["max_players"])])
	size_btn.selected = GC.SIZE_ORDER.find(setup.size_key)

	limit_btn = _option_row("الحد الأقصى للوحدات", [], func(i): setup.unit_limit = GC.UNIT_LIMITS[i])
	for v in GC.UNIT_LIMITS:
		limit_btn.add_item(str(v))
	limit_btn.selected = GC.UNIT_LIMITS.find(setup.unit_limit)

	weather_btn = _option_row("الطقس", [], func(i): setup.weather = GC.WEATHERS[i])
	for w in GC.WEATHERS:
		weather_btn.add_item(String(GC.WEATHER_NAMES[w]))
	weather_btn.selected = GC.WEATHERS.find(setup.weather)

	setup_panel.add_child(_spacer(6))
	var slots_head := Label.new()
	slots_head.text = "اللاعبون"
	slots_head.add_theme_font_size_override("font_size", 18)
	setup_panel.add_child(slots_head)

	slot_rows = []
	for i in GC.MAX_SLOTS:
		slot_rows.append(_build_slot_row(i))

	setup_panel.add_child(_spacer(8))
	error_label = Label.new()
	error_label.add_theme_color_override("font_color", Color("e0705a"))
	error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	setup_panel.add_child(error_label)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	setup_panel.add_child(row)

	var back := Button.new()
	back.text = "رجوع"
	back.custom_minimum_size = Vector2(120, 50)
	back.pressed.connect(_show_main)
	row.add_child(back)

	var start := Button.new()
	start.text = "ابدأ"
	start.custom_minimum_size = Vector2(0, 50)
	start.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	start.add_theme_font_size_override("font_size", 22)
	start.pressed.connect(_on_start)
	row.add_child(start)

func _option_row(label: String, items: Array, on_pick: Callable) -> OptionButton:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	setup_panel.add_child(row)
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(150, 0)
	row.add_child(l)
	var ob := OptionButton.new()
	ob.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ob.custom_minimum_size = Vector2(0, 40)
	for it in items:
		ob.add_item(String(it))
	ob.item_selected.connect(on_pick)
	row.add_child(ob)
	return ob

func _build_slot_row(i: int) -> Dictionary:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	setup_panel.add_child(row)

	var num := Label.new()
	num.text = "%d" % (i + 1)
	num.custom_minimum_size = Vector2(18, 0)
	row.add_child(num)

	var kind := OptionButton.new()
	kind.custom_minimum_size = Vector2(86, 38)
	for k in GC.SLOT_KINDS:
		kind.add_item(String(GC.SLOT_KIND_NAMES[k]))
	kind.selected = GC.SLOT_KINDS.find(String(setup.slots[i]["kind"]))
	kind.disabled = (i == 0)          # الخانة 1 = أنت دائماً
	kind.item_selected.connect(func(idx): _on_kind(i, idx))
	row.add_child(kind)

	var gang := OptionButton.new()
	gang.custom_minimum_size = Vector2(96, 38)
	for g in GC.GANG_CHOICES:
		gang.add_item(String(GC.GANG_CHOICE_NAMES[g]))
	gang.selected = GC.GANG_CHOICES.find(String(setup.slots[i]["gang"]))
	gang.item_selected.connect(func(idx): setup.slots[i]["gang"] = GC.GANG_CHOICES[idx])
	row.add_child(gang)

	var color := Button.new()
	color.custom_minimum_size = Vector2(56, 38)
	color.pressed.connect(func(): _on_color(i))
	row.add_child(color)

	var team := OptionButton.new()
	team.custom_minimum_size = Vector2(84, 38)
	for t in GC.TEAM_NAMES:
		team.add_item(String(t))
	team.selected = int(setup.slots[i]["team"])
	team.item_selected.connect(func(idx): setup.slots[i]["team"] = idx)
	row.add_child(team)

	var diff := OptionButton.new()
	diff.custom_minimum_size = Vector2(84, 38)
	for d in GC.DIFFICULTIES:
		diff.add_item(String(GC.DIFFICULTY_NAMES[d]))
	diff.selected = GC.DIFFICULTIES.find(String(setup.slots[i]["difficulty"]))
	diff.item_selected.connect(func(idx): setup.slots[i]["difficulty"] = GC.DIFFICULTIES[idx])
	row.add_child(diff)

	var r := {"row": row, "kind": kind, "gang": gang, "color": color, "team": team, "diff": diff}
	_refresh_slot(i, r)
	return r

func _refresh_slot(i: int, r: Dictionary) -> void:
	var closed: bool = String(setup.slots[i]["kind"]) == "closed"
	var ci: int = int(setup.slots[i]["color"])
	var c: Color = GC.PLAYER_COLORS[ci]
	var sb := StyleBoxFlat.new()
	sb.bg_color = c
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_left = 4
	sb.corner_radius_bottom_right = 4
	r["color"].add_theme_stylebox_override("normal", sb)
	r["color"].add_theme_stylebox_override("hover", sb)
	r["color"].add_theme_stylebox_override("pressed", sb)
	r["color"].tooltip_text = String(GC.PLAYER_COLOR_NAMES[ci])
	r["gang"].disabled = closed
	r["color"].disabled = closed
	r["team"].disabled = closed
	# الصعوبة للبوت فقط (12.2)
	r["diff"].visible = String(setup.slots[i]["kind"]) == "bot"
	r["row"].modulate = Color(1, 1, 1, 0.45 if closed else 1.0)

func _refresh_all_slots() -> void:
	for i in slot_rows.size():
		_refresh_slot(i, slot_rows[i])

func _on_size(idx: int) -> void:
	setup.size_key = GC.SIZE_ORDER[idx]
	_validate_hint()

func _on_kind(i: int, idx: int) -> void:
	setup.slots[i]["kind"] = GC.SLOT_KINDS[idx]
	setup.fix_colors()
	_refresh_all_slots()
	_validate_hint()

func _on_color(i: int) -> void:
	setup.slots[i]["color"] = setup.next_free_color(i)
	_refresh_all_slots()

func _validate_hint() -> void:
	error_label.text = setup.validate()

func _on_start() -> void:
	var err := setup.validate()
	error_label.text = err
	if err != "":
		return
	setup.save()
	get_tree().change_scene_to_file("res://main.tscn")

# ============================ التبديل بين اللوحتين ============================
func _show_main() -> void:
	main_panel.visible = true
	setup_panel.get_parent().visible = false

func _show_setup() -> void:
	main_panel.visible = false
	setup_panel.get_parent().visible = true
	_refresh_all_slots()
	_validate_hint()
