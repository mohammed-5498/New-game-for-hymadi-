extends SceneTree
# فحص طابور طلبات المسار — القسم 14
#   godot --headless --path godot --script tests/test_paths.gd

var failures := 0

# خريطة وهمية تعدّ كم مرة سُئلت عن مسار A*
class CountMap:
	extends RefCounted
	var calls := 0
	var n := 24
	var walk := PackedByteArray()

	func _init() -> void:
		walk.resize(n * n)
		walk.fill(1)

	func block(i: int, j: int) -> void:
		walk[j * n + i] = 0

	func walkable(i: int, j: int) -> bool:
		if i < 0 or j < 0 or i >= n or j >= n:
			return false
		return walk[j * n + i] != 0

	func find_path(_from: Vector2, to: Vector2) -> Array:
		calls += 1
		return [to]

func check(cond: bool, msg: String) -> void:
	if not cond:
		printerr("فشل: " + msg)
		failures += 1

func new_combat(m: CountMap) -> Combat:
	return Combat.new(m)

func _initialize() -> void:
	_t_numbers()
	_t_budget_caps_astar()
	_t_queue_drains()
	_t_waiting_unit_is_not_idle()
	_t_newest_request_wins()
	_t_stop_cancels_request()
	if failures == 0:
		print("نجح فحص طابور المسارات: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الأرقام كما في القسم 14 ----------
func _t_numbers() -> void:
	check(GC.PATH_PER_STEP == 20, "سقف عمليات A* في التحديث ليس 20")

# ---------- أمر لخمسين وحدة لا يحسب خمسين مساراً في تحديث واحد ----------
func _t_budget_caps_astar() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	for i in 50:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2, 2 + i * 0.01)))
	# أمر بحجم يتجاوز الميزانية: نستعمل order_move لكل وحدة كما يفعل أمر صغير
	for u in sel:
		c.order_move([u], Vector2(20, 20), false)
	check(m.calls == GC.PATH_PER_STEP,
		"حُسب %d مساراً في دفعة واحدة والسقف %d" % [m.calls, GC.PATH_PER_STEP])
	check(c.path_pending() == 50 - GC.PATH_PER_STEP,
		"عدد المنتظرين %d والمتوقع %d" % [c.path_pending(), 50 - GC.PATH_PER_STEP])

# ---------- والباقي ينال مساره في التحديثات التالية ----------
func _t_queue_drains() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	for i in 50:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2, 2 + i * 0.01)))
	for u in sel:
		c.order_move([u], Vector2(20, 20), false)
	var before := m.calls
	c.step(1.0 / 60.0)
	check(m.calls > before, "التحديث لم يخدم الطابور أصلاً")
	for i in 5:
		c.step(1.0 / 60.0)
	check(c.path_pending() == 0, "بقي %d طلباً بعد ستة تحديثات" % c.path_pending())
	var with_path := 0
	for u in sel:
		if not u["path"].is_empty() or Vector2(u["pos"]).distance_to(Vector2(2, 2)) > 0.05:
			with_path += 1
	check(with_path == 50, "%d وحدة فقط من 50 نالت مسارها" % with_path)

# ---------- الوحدة المنتظرة لا تُحسب "واصلة" ----------
func _t_waiting_unit_is_not_idle() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	# ثلاثة أضعاف الميزانية: بعد أول تحديث يبقى ثلثٌ في الطابور، وهم من يمرّون
	# على حلقة الحركة بمسار فارغ. لو عُدّوا "واصلين" لضاع أمرهم.
	var count: int = GC.PATH_PER_STEP * 3
	for i in count:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2, 2 + i * 0.01)))
	for u in sel:
		c.order_move([u], Vector2(20, 20), false)
	c.step(1.0 / 60.0)
	var waiting: Array = []
	for u in sel:
		if bool(u["path_wait"]):
			waiting.append(u)
	check(not waiting.is_empty(), "لم يبق أحد في الطابور بعد تحديث واحد")
	for u in waiting:
		check(String(u["state"]) == "moving", "المنتظرة صارت %s فضاع أمرها" % u["state"])
	# ثم تصل مساراتهم فعلاً
	for i in 4:
		c.step(1.0 / 60.0)
	for u in waiting:
		check(not bool(u["path_wait"]), "بقيت وحدة تنتظر بعد خمسة تحديثات")

# ---------- طلبان لنفس الوحدة: يُحسب الأخير فقط ----------
func _t_newest_request_wins() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	for i in 30:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2, 2 + i * 0.01)))
	for u in sel:
		c.order_move([u], Vector2(20, 20), false)
	var waiting: Dictionary = {}
	for u in sel:
		if bool(u["path_wait"]):
			waiting = u
			break
	check(not waiting.is_empty(), "لم تدخل أي وحدة الطابور")
	var pending := c.path_pending()
	c.order_move([waiting], Vector2(5, 5), false)     # أمر جديد لنفس الوحدة
	check(c.path_pending() == pending, "الأمر الجديد أضاف طلباً ثانياً لنفس الوحدة")
	for i in 4:
		c.step(1.0 / 60.0)
	check(Vector2(waiting["path"][-1]) == Vector2(5, 5), "الوحدة نالت الوجهة القديمة لا الجديدة")

# ---------- إيقاف الوحدة يلغي طلبها المعلّق ----------
func _t_stop_cancels_request() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	for i in 30:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2, 2 + i * 0.01)))
	for u in sel:
		c.order_move([u], Vector2(20, 20), false)
	var waiting: Dictionary = {}
	for u in sel:
		if bool(u["path_wait"]):
			waiting = u
			break
	c._clear_path(waiting)
	check(not bool(waiting["path_wait"]), "الوحدة الموقوفة ما زالت تنتظر مساراً")
	for i in 4:
		c.step(1.0 / 60.0)
	check(waiting["path"].is_empty(), "وصل مسار إلى وحدة أُلغي أمرها")
