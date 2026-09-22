extends SceneTree
# فحص طابور طلبات المسار وحقل التدفق — القسم 14
#   godot --headless --path godot --script tests/test_paths.gd

var failures := 0

# خريطة وهمية تعدّ كم مرة سُئلت عن مسار A*، وتعرف حقل التدفق
class CountMap:
	extends RefCounted
	var calls := 0
	var flows := 0
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

	func build_flow(goals: Array) -> PackedInt32Array:
		flows += 1
		var tiles: Array = []
		for g in goals:
			tiles.append(Vector2i(clampi(int(round(g.x)), 0, n - 1), clampi(int(round(g.y)), 0, n - 1)))
		return FlowField.build(n, walk, tiles)

	func flow_path(from: Vector2, field: PackedInt32Array) -> Array:
		return FlowField.path(n, walk, from, field, GC.FLOW_MAX_STEPS)

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
	_t_flow_distances()
	_t_flow_path_reaches_goal()
	_t_flow_no_corner_cut()
	_t_flow_unreachable()
	_t_group_order_uses_one_flow()
	_t_group_spreads()
	if failures == 0:
		print("نجح فحص المسارات وحقل التدفق: لا أخطاء.")
	else:
		printerr("فشل الفحص: %d خطأ." % failures)
	quit(0 if failures == 0 else 1)

# ---------- الأرقام كما في القسم 14 ----------
func _t_numbers() -> void:
	check(GC.PATH_PER_STEP == 20, "سقف عمليات A* في التحديث ليس 20")
	check(GC.FLOW_MIN_GROUP == 10, "حد المجموعة الكبيرة ليس 10 وحدات")

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

# ---------- الحقل: صفر عند الوجهة ويزيد خطوةً خطوة ----------
func _t_flow_distances() -> void:
	var m := CountMap.new()
	var f := FlowField.build(m.n, m.walk, [Vector2i(5, 5)])
	check(f.size() == m.n * m.n, "حجم الحقل غير مطابق للخريطة")
	check(f[5 * m.n + 5] == 0, "بُعد الوجهة عن نفسها ليس صفراً")
	check(f[5 * m.n + 6] == 1, "الجار المباشر ليس على بُعد خطوة")
	check(f[6 * m.n + 6] == 1, "الجار القطري ليس على بُعد خطوة")
	check(f[5 * m.n + 9] == 4, "أربعة مربعات أفقياً ليست أربع خطوات")
	# وجهتان: كل مربع يتبع أقربهما
	var f2 := FlowField.build(m.n, m.walk, [Vector2i(2, 2), Vector2i(20, 20)])
	check(f2[2 * m.n + 2] == 0 and f2[20 * m.n + 20] == 0, "إحدى الوجهتين ليست صفراً")
	check(f2[19 * m.n + 19] == 1, "المربع بجوار الوجهة الثانية لم يتبعها")

# ---------- مسار النزول يصل فعلاً ولا يمر بمبنى ----------
func _t_flow_path_reaches_goal() -> void:
	var m := CountMap.new()
	# جدار عمودي بفجوة واحدة: الطريق الوحيد يمر بها
	for j in range(0, 20):
		m.block(10, j)
	var f := FlowField.build(m.n, m.walk, [Vector2i(18, 5)])
	var p := FlowField.path(m.n, m.walk, Vector2(3, 5), f, GC.FLOW_MAX_STEPS)
	check(not p.is_empty(), "لم يخرج مسار رغم وجود طريق")
	check(Vector2(p[-1]) == Vector2(18, 5), "المسار لا ينتهي عند الوجهة")
	for step in p:
		check(m.walkable(int(step.x), int(step.y)), "المسار مرّ بمربع مبنى")
	# كل خطوة مجاورة لسابقتها
	var prev := Vector2(3, 5)
	for step in p:
		var d: Vector2 = Vector2(step) - prev
		check(absf(d.x) <= 1.0 and absf(d.y) <= 1.0 and d != Vector2.ZERO, "قفزة في المسار")
		prev = Vector2(step)

# ---------- لا قطع للزوايا بين مبنيين (4.3) ----------
func _t_flow_no_corner_cut() -> void:
	var m := CountMap.new()
	m.block(6, 5)
	m.block(5, 6)
	var f := FlowField.build(m.n, m.walk, [Vector2i(6, 6)])
	# (5,5) لا يصل (6,6) قطرياً لأن جانبيه مبنيان، فبُعده أكبر من خطوة
	check(f[5 * m.n + 5] > 1, "الحقل قطع الزاوية بين مبنيين")
	var p := FlowField.path(m.n, m.walk, Vector2(5, 5), f, GC.FLOW_MAX_STEPS)
	check(not p.is_empty(), "لم يخرج مسار حول الزاوية")
	check(Vector2(p[0]) != Vector2(6, 6), "أول خطوة قطعت الزاوية")

# ---------- وجهة محاصرة: لا مسار، ولا دوران بلا نهاية ----------
func _t_flow_unreachable() -> void:
	var m := CountMap.new()
	for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
			Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]:
		m.block(15 + d.x, 15 + d.y)
	var f := FlowField.build(m.n, m.walk, [Vector2i(15, 15)])
	check(f[3 * m.n + 3] == FlowField.FAR, "مربع لا طريق له لم يُعلَّم بعيداً")
	var p := FlowField.path(m.n, m.walk, Vector2(3, 3), f, GC.FLOW_MAX_STEPS)
	check(p.is_empty(), "خرج مسار إلى وجهة محاصرة")

# ---------- أمر لمجموعة كبيرة: بحث واحد وصفر عمليات A* ----------
func _t_group_order_uses_one_flow() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	for i in 60:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2 + (i % 6) * 0.3, 2 + (i / 6) * 0.3)))
	var dests: Array = []
	for i in 12:
		dests.append(Vector2(18 + (i % 4), 18 + (i / 4)))
	c.order_move_flow(sel, dests, false)
	check(m.flows == 1, "بُني %d حقلاً والمطلوب واحد" % m.flows)
	check(m.calls == 0, "استُعملت %d عملية A* مع حقل التدفق" % m.calls)
	check(c.path_pending() == 0, "حقل التدفق ترك طلبات في الطابور")
	var moving := 0
	for u in sel:
		if not u["path"].is_empty() and String(u["state"]) == "moving":
			moving += 1
	check(moving == 60, "%d وحدة فقط من 60 نالت مساراً من الحقل" % moving)

# ---------- المجموعة تتوزع على الوجهات ولا تتكدس في مربع واحد (4.3) ----------
func _t_group_spreads() -> void:
	var m := CountMap.new()
	var c := new_combat(m)
	var sel: Array = []
	for i in 40:
		sel.append(c.spawn("crow_common", 0, 0, Vector2(2 + (i % 5) * 0.4, 2 + (i / 5) * 0.4)))
	var dests: Array = []
	for i in 16:
		dests.append(Vector2(18 + (i % 4), 18 + (i / 4)))
	c.order_move_flow(sel, dests, false)
	var ends := {}
	var with_path := 0
	for u in sel:
		if u["path"].is_empty():
			continue
		with_path += 1
		ends[Vector2(u["path"][-1])] = true
	check(with_path == 40, "%d وحدة فقط نالت مساراً" % with_path)
	# لكل وحدة مربعها: لا مربعين لوحدتين
	check(ends.size() == with_path, "%d وحدة تقاسمت %d مربعاً فقط" % [with_path, ends.size()])
	# ومن سبق نال مربع وجهة فعلياً، والباقون اصطفوا خلفه
	var on_dest := 0
	for e in ends:
		if dests.has(Vector2(e)):
			on_dest += 1
	check(on_dest > 0, "لم تصل أي وحدة إلى مربعات الوجهة")
	# وكل مربع نهاية على طريق سالك
	for e in ends:
		check(m.walkable(int(e.x), int(e.y)), "مربع نهاية داخل مبنى")
