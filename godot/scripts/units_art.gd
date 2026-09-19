class_name UnitsArt
extends RefCounted
# رسم الوحدات بأسلوب Stickman — نقل مباشر من docs/units-art.js
# نظام محلي: القدمان عند (0,0)، الطول ~26 وحدة، y السالب للأعلى.

const SKIN := Color("d9a77a")
const WOOD := Color("8a6a45")
const STEEL := Color("b9bec5")
const TAU2 := 6.2831853

# ---------- أدوات رسم ----------
static func dk(c: Color, a: float) -> Color:
	return Color(c.r * (1.0 - a), c.g * (1.0 - a), c.b * (1.0 - a), c.a)

static func lt(c: Color, a: float) -> Color:
	return Color(c.r + (1.0 - c.r) * a, c.g + (1.0 - c.g) * a, c.b + (1.0 - c.b) * a, c.a)

static func limb(ci: CanvasItem, a: Vector2, b: Vector2, w: float, col: Color) -> void:
	ci.draw_line(a, b, col, w, true)
	ci.draw_circle(a, w * 0.5, col)
	ci.draw_circle(b, w * 0.5, col)

static func bone(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, w: float, col: Color) -> void:
	limb(ci, a, b, w, col)
	limb(ci, b, c, w, col)

static func ellipse(ci: CanvasItem, center: Vector2, rx: float, ry: float, col: Color, seg: int = 18) -> void:
	var pts := PackedVector2Array()
	for i in seg:
		var ang := TAU2 * float(i) / float(seg)
		pts.push_back(center + Vector2(cos(ang) * rx, sin(ang) * ry))
	ci.draw_colored_polygon(pts, col)

static func tri(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, col: Color) -> void:
	ci.draw_colored_polygon(PackedVector2Array([a, b, c]), col)

static func rrect(ci: CanvasItem, x: float, y: float, w: float, h: float, col: Color) -> void:
	ci.draw_rect(Rect2(x, y, w, h), col)

# طرف من قطعتين: الزوايا من العمودي لأسفل، الموجب للأمام
static func seg2(ci: CanvasItem, o: Vector2, a1: float, l1: float, a2: float, l2: float, w: float, col: Color) -> Vector2:
	var p1 := o + Vector2(sin(a1) * l1, cos(a1) * l1)
	var p2 := p1 + Vector2(sin(a2) * l2, cos(a2) * l2)
	bone(ci, o, p1, p2, w, col)
	return p2

# ---------- الهيكل الحركي ----------
static func make_rig(t: float, state: String, spd: float, rate: float) -> Dictionary:
	var r := {
		"st": state, "t": t, "p": 0.0, "bounce": 0.0, "lean": 0.05,
		"air": 0.0, "arm_ph": 0.0, "s": 0.0, "lunge": 0.0, "a": 0.0,
		"thigh_amp": 0.0, "mode": state
	}
	if state == "walk":
		var p: float = t * 2.55 * spd * TAU2
		r["p"] = p
		r["bounce"] = -cos(p * 2.0) * 1.5 - 0.6
		r["lean"] = 0.30
		r["air"] = max(0.0, sin(p * 2.0)) * 0.55
		r["arm_ph"] = p
	elif state == "attack":
		var a: float = fmod(t / rate, 1.0)
		r["a"] = a
		var s := 0.0
		var lunge := 0.0
		if a < 0.34:
			var k: float = 1.0 - pow(1.0 - a / 0.34, 3.0)
			s = -k
			lunge = -1.1 * k
		elif a < 0.44:
			var k2: float = (a - 0.34) / 0.10
			k2 = k2 * k2 * (3.0 - 2.0 * k2)
			s = -1.0 + 2.0 * k2
			lunge = -1.1 + 4.4 * k2
		elif a < 0.53:
			s = 1.0
			lunge = 3.3
		else:
			var k3: float = (a - 0.53) / 0.47
			k3 = k3 * k3 * (3.0 - 2.0 * k3)
			s = 1.0 - 1.28 * k3
			lunge = 3.3 - 3.3 * k3
		r["s"] = s
		r["lunge"] = lunge
		r["bounce"] = -abs(s) * 0.5
		r["lean"] = 0.14 + s * 0.30
	else:
		var p2: float = t * 1.25 * spd
		r["p"] = p2
		r["bounce"] = sin(p2 * TAU2 / 2.0) * 0.32
		r["arm_ph"] = p2 * 2.2
	r["hip_y"] = -11.0 + float(r["bounce"])
	r["hip_x"] = float(r["lunge"]) * 0.55
	return r

static func thigh_of(r: Dictionary, back: bool) -> float:
	var q: float = PI if back else 0.0
	if r["st"] == "walk":
		return 0.95 * sin(float(r["p"]) + q)
	elif r["st"] == "attack":
		var s: float = float(r["s"])
		return (0.62 if not back else -0.70) + s * (0.42 if not back else -0.30)
	return 0.13 if not back else -0.13

static func flex_of(r: Dictionary, back: bool) -> float:
	var q: float = PI if back else 0.0
	if r["st"] == "walk":
		return 1.55 * pow(0.5 + 0.5 * cos(float(r["p"]) + q - 4.12), 2.2) + 0.18
	elif r["st"] == "attack":
		return (0.42 if not back else 0.78) - float(r["s"]) * 0.12
	return 0.16

# ---------- لبنات الجسد ----------
static func draw_legs(ci: CanvasItem, r: Dictionary, col: Color, w: float) -> void:
	for back in [true, false]:
		var th := thigh_of(r, back)
		var fl := flex_of(r, back)
		var cc: Color = dk(col, 0.32) if back else col
		var hip := Vector2(float(r["hip_x"]) + (-1.2 if back else 1.2), float(r["hip_y"]))
		var foot := seg2(ci, hip, th, 5.8, th - fl, 6.0, w, cc)
		limb(ci, foot, foot + Vector2(sin(th - fl + 1.1) * 2.0, cos(th - fl + 1.1) * 0.9), w, cc)

static func draw_back_arm(ci: CanvasItem, r: Dictionary, col: Color, w: float) -> void:
	var k := 0.0
	if r["st"] == "walk":
		k = sin(float(r["arm_ph"]) + PI)
	elif r["st"] == "idle":
		k = sin(float(r["arm_ph"])) * 0.25
	else:
		k = -0.15
	var a1 := -k * 0.95
	var a2: float = a1 - (1.45 if r["st"] == "walk" else 0.35)
	seg2(ci, Vector2(-0.8, -8.0), a1, 3.6, a2, 3.4, w, dk(col, 0.32))

static func draw_arm_to(ci: CanvasItem, col: Color, hx: float, hy: float, w: float) -> void:
	var sh := Vector2(0.8, -8.2)
	var mid := Vector2((sh.x + hx) * 0.5 + 0.8, (sh.y + hy) * 0.5 + 0.6)
	bone(ci, sh, mid, Vector2(hx, hy), w, col)

static func draw_head(ci: CanvasItem, col: Color, rad: float) -> void:
	ci.draw_circle(Vector2(0.5, -12.6), rad, col)

static func draw_spine(ci: CanvasItem, col: Color, w: float) -> void:
	limb(ci, Vector2(0.0, 0.4), Vector2(0.4, -8.4), w + 0.5, col)

static func hand_at(base: float, rng: float, r: Dictionary, reach: float) -> Dictionary:
	var A: float = base + float(r["s"]) * rng
	return {"A": A, "x": 0.8 + sin(A + 1.2) * reach, "y": -8.2 + cos(A + 1.2) * (reach * 0.86)}

# ---------- الوحدات ----------
# key: crow_common | hammer_common | viper_common | scorp_common
static func unit_scale(key: String) -> Vector2:
	match key:
		"crow_common": return Vector2(0.90, 1.08)
		"hammer_common": return Vector2(1.20, 0.93)
		"viper_common": return Vector2(0.93, 0.96)
		_: return Vector2(1.03, 0.99)

static func draw_unit(ci: CanvasItem, key: String, pos: Vector2, t: float, state: String, col: Color, dir: int, sc: float) -> void:
	var us := unit_scale(key)
	var r := make_rig(t, state, 1.0, 1.15)
	var base := Transform2D(0.0, pos) * Transform2D().scaled(Vector2(sc * float(dir) * us.x, sc * us.y))
	ci.draw_set_transform_matrix(base)

	# الظل
	var sh_s: float = 1.0 - float(r["air"]) * 0.35
	ellipse(ci, Vector2(0, 0.6), 3.8 * sh_s, 1.6 * sh_s, Color(0, 0, 0, 0.3 * sh_s))

	var lw := 2.0
	var head_r := 3.0
	if key == "hammer_common":
		lw = 2.6
		head_r = 3.1
	elif key == "viper_common":
		lw = 1.9
		head_r = 2.9
	elif key == "crow_common":
		lw = 1.9
		head_r = 2.9
	elif key == "scorp_common":
		lw = 2.1

	draw_legs(ci, r, col, lw)

	# فضاء الجسد: الأصل عند الورك مع الميلان
	var body_x := base * Transform2D(-float(r["lean"]), Vector2(float(r["hip_x"]), float(r["hip_y"])))
	ci.draw_set_transform_matrix(body_x)

	draw_back_arm(ci, r, col, lw - 0.1)

	# إضافات خلفية
	if key == "crow_common":
		var sway: float = (sin(float(r["p"])) * 2.4) if r["st"] == "walk" else 0.0
		tri(ci, Vector2(-1.4, -8.6), Vector2(-6.6 - sway, -1.6), Vector2(-1.4, -0.6), dk(col, 0.25))

	draw_spine(ci, col, lw)

	if key == "hammer_common":
		limb(ci, Vector2(-4.2, -9.4), Vector2(4.6, -9.4), 2.4, dk(col, 0.2))

	draw_head(ci, col, head_r)

	# غطاء الرأس حسب العصابة
	match key:
		"crow_common":
			tri(ci, Vector2(-2.7, -11.9), Vector2(0.5, -16.6), Vector2(3.7, -11.9), dk(col, 0.45))
		"hammer_common":
			rrect(ci, -2.9, -13.3, 6.8, 1.2, dk(col, 0.5))
			ellipse(ci, Vector2(0.5, -13.4), 3.4, 2.0, dk(col, 0.5))
		"viper_common":
			rrect(ci, -2.7, -13.4, 6.4, 1.8, dk(col, 0.55))
		"scorp_common":
			rrect(ci, -2.8, -14.4, 6.6, 1.8, dk(col, 0.5))
			limb(ci, Vector2(-2.6, -13.6), Vector2(-5.0, -11.2), 0.9, dk(col, 0.5))

	# الذراع الأمامية والسلاح
	match key:
		"crow_common":
			var h := hand_at(-0.35, 1.5, r, 6.0)
			draw_arm_to(ci, col, h["x"], h["y"], lw)
			var tipc := Vector2(h["x"] + sin(float(h["A"]) + 1.9) * 3.4, h["y"] + cos(float(h["A"]) + 1.9) * 3.0)
			limb(ci, Vector2(h["x"], h["y"]), tipc, 1.4, STEEL)
		"hammer_common":
			var h2 := hand_at(-0.55, 1.6, r, 5.4)
			draw_arm_to(ci, col, h2["x"], h2["y"], lw)
			var e2 := Vector2(h2["x"] + sin(float(h2["A"]) + 1.7) * 4.2, h2["y"] + cos(float(h2["A"]) + 1.7) * 3.8)
			limb(ci, Vector2(h2["x"], h2["y"]), e2, 1.5, WOOD)
			ci.draw_circle(e2, 2.0, STEEL)
		"viper_common":
			var h3 := hand_at(-0.15, 1.7, r, 5.6)
			draw_arm_to(ci, col, h3["x"], h3["y"], lw)
			ci.draw_circle(Vector2(h3["x"] + 0.8, h3["y"] - 0.4), 1.5, Color("9a948c"))
		_:
			var h4 := hand_at(-0.45, 1.65, r, 5.4)
			draw_arm_to(ci, col, h4["x"], h4["y"], lw)
			var t4 := Vector2(h4["x"] + sin(float(h4["A"]) + 1.75) * 4.4, h4["y"] + cos(float(h4["A"]) + 1.75) * 4.0)
			limb(ci, Vector2(h4["x"], h4["y"]), t4, 1.5, Color("8e8880"))

	ci.draw_set_transform_matrix(Transform2D())
