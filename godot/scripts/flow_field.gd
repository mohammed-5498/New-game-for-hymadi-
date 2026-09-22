class_name FlowField
extends RefCounted
# حقل التدفق للمجموعات الكبيرة — القسم 14.
#
# أمر حركة لمئة وحدة كان مئة عملية A*، وهذا ما يجمّد الإطار على الجوال. الحل في
# الوصف: بحث عرضي (BFS) واحد من كل مربعات الوجهة معاً، يعطي لكل مربع بعدَه عن
# أقرب وجهة. بعده يصير مسار أي وحدة مجرد نزول دائم إلى الجار الأقل بعداً، وهو
# رخيص جداً. فتكلفة الأمر تصير بحثاً واحداً مهما كثرت الوحدات.
#
# الشبكة تُمرَّر كمصفوفة بايتات (1 = يُمشى عليه) حتى يبقى الملف مستقلاً عن الخريطة
# ويمكن فحصه وحده.

const FAR := 0x7fffffff          # مربع لا طريق منه إلى أي وجهة
const DIRS := [
	Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
	Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1),
]

static func _ok(n: int, walk: PackedByteArray, c: Vector2i, p: Vector2i) -> bool:
	if p.x < 0 or p.y < 0 or p.x >= n or p.y >= n:
		return false
	if walk[p.y * n + p.x] == 0:
		return false
	# القطري ممنوع إذا كان أحد المربعين الجانبيين مبنى، تماماً كما في A* (4.3)
	if p.x != c.x and p.y != c.y:
		return walk[c.y * n + p.x] != 0 and walk[p.y * n + c.x] != 0
	return true

# goals مربعات صحيحة قابلة للمشي. المخرج: بعد كل مربع بالخطوات عن أقربها.
static func build(n: int, walk: PackedByteArray, goals: Array) -> PackedInt32Array:
	var dist := PackedInt32Array()
	if n <= 0 or walk.size() != n * n:
		return dist
	dist.resize(n * n)
	dist.fill(FAR)
	var q: Array[Vector2i] = []
	for g in goals:
		var t := Vector2i(g)
		if t.x < 0 or t.y < 0 or t.x >= n or t.y >= n:
			continue
		var idx: int = t.y * n + t.x
		if walk[idx] == 0 or dist[idx] == 0:
			continue
		dist[idx] = 0
		q.append(t)
	var head := 0
	while head < q.size():
		var c: Vector2i = q[head]
		head += 1
		var d: int = dist[c.y * n + c.x] + 1
		for s in DIRS:
			var p: Vector2i = c + s
			if not _ok(n, walk, c, p):
				continue
			var k: int = p.y * n + p.x
			if dist[k] <= d:
				continue
			dist[k] = d
			q.append(p)
	return dist

# مسار وحدة واحدة: نزول دائم إلى الجار الأقل بعداً حتى تصل الوجهة
static func path(n: int, walk: PackedByteArray, from: Vector2,
		field: PackedInt32Array, max_steps: int) -> Array:
	var out := []
	if n <= 0 or field.size() != n * n or walk.size() != n * n:
		return out
	var c := Vector2i(clampi(int(round(from.x)), 0, n - 1), clampi(int(round(from.y)), 0, n - 1))
	if walk[c.y * n + c.x] == 0:
		return out
	var d: int = field[c.y * n + c.x]
	if d == FAR:
		return out           # لا طريق إلى الوجهة: تبقى الوحدة مكانها
	var guard := 0
	while d > 0 and guard < max_steps:
		guard += 1
		var best: Vector2i = c
		var best_d: int = d
		for s in DIRS:
			var p: Vector2i = c + s
			if not _ok(n, walk, c, p):
				continue
			var k: int = field[p.y * n + p.x]
			if k < best_d:
				best_d = k
				best = p
		if best == c:
			break
		c = best
		d = best_d
		out.append(Vector2(float(c.x), float(c.y)))
	return out
