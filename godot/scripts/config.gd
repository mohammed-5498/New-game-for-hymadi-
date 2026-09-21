class_name GC
extends RefCounted
# كل الأرقام القابلة للموازنة في مكان واحد (قاعدة CLAUDE.md).
# الأرقام مأخوذة من docs/GAME_SPEC.md. لا تكتب رقماً في منطق اللعبة مباشرة.

# ---------- الإحداثيات (3.1) ----------
const TW := 18.0        # نصف عرض المربع
const TH := 9.0         # نصف ارتفاع المربع

# ---------- أحجام الخريطة (3.2) ----------
const SIZE_ORDER := ["small", "medium", "large"]
const MAP_SIZES := {
	"small":  {"n": 26, "max_players": 4, "special": 2, "police": 2, "label": "صغيرة"},
	"medium": {"n": 34, "max_players": 6, "special": 3, "police": 3, "label": "متوسطة"},
	"large":  {"n": 42, "max_players": 8, "special": 4, "police": 4, "label": "كبيرة"},
}

# ---------- توليد الشوارع (3.3) ----------
const ROAD_GAP_MIN := 4              # أقل مسافة بين خطي شارع
const ROAD_GAP_MAX := 6              # أكبر مسافة بين خطي شارع
const ROAD_JITTER := 0.10            # احتمال انحراف الشارع مربعاً واحداً
const ALLEY_PER_TILES := 17.0        # زقاق قصير لكل هذا العدد من المربعات
const ALLEY_LEN := 2                 # طول الزقاق
const GEN_MAX_TRIES := 20            # محاولات إعادة التوليد لو الشوارع غير متصلة

# ---------- الأحياء (3.4) ----------
const DISTRICT_MIN_TILES := 4        # أقل من هذا لا يُعتبر حياً قابلاً للاستيلاء
const CAPTURE_RADIUS := 1.5          # نصف قطر منطقة الاستيلاء بالمربعات
const FIX_ISOLATED_PASSES := 3       # محاولات إصلاح الفراغات المعزولة (3.4.1)

# ---------- المقرات (3.5) ----------
const HOME_RING := 0.40              # نصف قطر دائرة توزيع الأحياء المنزلية (نسبة من حجم الخريطة)
const HOME_MIN_TILES := 6            # أقل حجم حي صالح ليكون منزلياً

# ---------- الأحياء المميزة (3.7) ----------
const SPECIAL_KINDS := ["hospital", "armory", "clock"]
const SPECIAL_CENTER_RING := 0.34    # تُختار من الأحياء داخل هذه النسبة من مركز الخريطة
const SPECIAL_LABELS := {"hospital": "المستشفى", "armory": "مخزن السلاح", "clock": "برج الساعة"}
const HOSPITAL_HEAL_IN_ZONE := 5.0   # دم/ث داخل منطقة استيلاء المستشفى
const HOSPITAL_HEAL_GLOBAL := 0.5    # دم/ث لكل وحدات المالك
const ARMORY_DAMAGE_BONUS := 0.10    # +10% ضرر
const CLOCK_SPAWN_FACTOR := 0.85     # أزمنة الظهور × 0.85

# ---------- مراكز الشرطة (3.8) ----------
const POLICE_MIN_DIST_HOME := 6      # أقل مسافة عن أي حي منزلي بالمربعات
const POLICE_SPAWN_EVERY := 10.0     # شرطي كل 10 ثوانٍ
const POLICE_MAX_ALIVE := 6          # بحد أقصى 6 شرطة لكل مركز
const POLICE_CAPTAIN_RESPAWN := 40.0 # الضابط يعود بعد موته بـ 40 ثانية
const POLICE_CHASE_LIMIT := 6.0      # حد المطاردة بالمربعات
const POLICE_CLEAR_AFTER_CAPTURE := 5.0
const POLICE_ARMOR_BONUS := 0.10     # +10% درع لمالك المركز
const POLICE_ARMOR_BONUS_MAX := 0.20 # بحد أقصى +20%

# ---------- طابع الأحياء (3.6) ----------
# مفاتيح المباني: . فارغ | H بيت | A عمارة | R أطلال | W مستودع | T شجرة
#                 P ساحة علم | Q مقر | M مستشفى | K مخزن سلاح | C برج ساعة | F نافورة | S مركز شرطة
# الرموز: H بيت، A عمارة، R أطلال، W مستودع، T شجرة، Y مصنع، G خزان ماء،
# X سيارة محطمة، Z أكشاك سوق، B برميل نار، "." فراغ يُمشى فيه.
# النسب من prototype.html كما يفرض القسم 3.6.
const BUILDING_MIX := {
	"crow":    [["A", 0.40], ["H", 0.62], ["R", 0.76], ["T", 0.82], [".", 1.00]],
	"hammer":  [["Y", 0.18], ["W", 0.50], ["G", 0.58], ["R", 0.72], ["X", 0.80], [".", 1.00]],
	"viper":   [["T", 0.38], ["H", 0.66], ["R", 0.78], [".", 1.00]],
	"scorp":   [["H", 0.50], ["Z", 0.60], ["B", 0.70], ["R", 0.82], [".", 1.00]],
	"neutral": [["H", 0.30], ["A", 0.44], ["R", 0.64], ["W", 0.74], ["T", 0.84], ["X", 0.89], [".", 1.00]],
}

# ---------- العصابات (6) ----------
const GANGS := ["crow", "hammer", "viper", "scorp"]
const GANG_NAMES := {"crow": "الغربان", "hammer": "المطارق", "viper": "الأفاعي", "scorp": "العقارب"}
const GANG_COLORS := {
	"crow": Color("8a5cc7"), "hammer": Color("d9463b"),
	"viper": Color("3fa34d"), "scorp": Color("e0b030"),
}
const POLICE_COLOR := Color("3a5a86")

# ألوان اللاعبين الثمانية كما في 12.2 — منفصلة عن العصابة، ولا يتكرر اللون بين لاعبين
const PLAYER_COLORS := [
	Color("3b7dd8"), Color("d9463b"), Color("3fa34d"), Color("e0b030"),
	Color("2fb5c0"), Color("8a5cc7"), Color("8c8c8c"), Color("e07b2e"),
]
const PLAYER_COLOR_NAMES := [
	"أزرق", "أحمر", "أخضر", "أصفر", "سماوي", "بنفسجي", "رمادي", "برتقالي",
]

# ---------- رسم الوحدات (13.1) ----------
const UNIT_SCALE := 0.62           # حجم رسم الوحدة العادية داخل مربع 36×18
const UNIT_SCALE_SPECIAL := 0.713  # الشخصيات المميزة أكبر بـ 15%
const UNIT_HURT_DUR := 0.35        # زمن عرض حالة hurt
const UNIT_DEATH_DUR := 1.0        # زمن عرض حالة death قبل حذف الوحدة
const UNIT_HIT_AT := 0.47          # لحظة الارتطام كنسبة من زمن الضربة

# كل مفاتيح الرسم بالترتيب (16 وحدة + وحدتا شرطة)
const UNIT_KEYS := [
	"crow_common", "crow_spear", "crow_dual", "crow_hero",
	"hammer_common", "hammer_shield", "hammer_breaker", "hammer_hero",
	"viper_common", "viper_sniper", "viper_firebomber", "viper_hero",
	"scorp_common", "scorp_boss", "scorp_medic", "scorp_hero",
	"police_common", "police_captain",
]
const UNIT_NAMES := {
	"crow_common": "غراب", "crow_spear": "حامل الرمح", "crow_dual": "المزدوج", "crow_hero": "بطل الغربان",
	"hammer_common": "مطرقة", "hammer_shield": "المصفّح", "hammer_breaker": "المحطّم", "hammer_hero": "بطل المطارق",
	"viper_common": "أفعى", "viper_sniper": "القنّاص", "viper_firebomber": "رامي النار", "viper_hero": "بطل الأفاعي",
	"scorp_common": "عقرب", "scorp_boss": "الزعيم", "scorp_medic": "الطبيب", "scorp_hero": "بطل العقارب",
	"police_common": "شرطي", "police_captain": "ضابط",
}
const UNIT_STATES := ["idle", "walk", "attack", "ult", "hurt", "death"]
const UNIT_STATE_NAMES := {
	"idle": "وقوف", "walk": "جري", "attack": "قتال",
	"ult": "ضربة مميزة", "hurt": "إصابة", "death": "موت",
}
# عصابة كل مفتاح، لاختيار اللون
const UNIT_GANG := {
	"crow_common": "crow", "crow_spear": "crow", "crow_dual": "crow", "crow_hero": "crow",
	"hammer_common": "hammer", "hammer_shield": "hammer", "hammer_breaker": "hammer", "hammer_hero": "hammer",
	"viper_common": "viper", "viper_sniper": "viper", "viper_firebomber": "viper", "viper_hero": "viper",
	"scorp_common": "scorp", "scorp_boss": "scorp", "scorp_medic": "scorp", "scorp_hero": "scorp",
	"police_common": "police", "police_captain": "police",
}

# ---------- الشبكة المكانية وقوة التباعد (14 و 4.3) ----------
const GRID_CELL := 2.0       # خلية الشبكة المكانية: 2 × 2 مربع كما يفرض القسم 14
const GRID_REBUILD := 0.1    # تُبنى عشر مرات في الثانية لا في كل إطار: بناؤها نفسه كلفة
# طول قطعة القطر بالمربعات: القطر كله شريط مائل يعبر الخريطة، فحدوده المستطيلة
# تغطيها كلها ولا يمكن إخفاؤه. تقطيعه يعطي كل قطعة حدوداً ضيقة تُخفى وحدها (14).
const BAND_SEG := 4
const SEPARATE_DIST := 0.55  # أقرب من هذا تتدافع الوحدتان برفق (4.3)
const SEPARATE_PUSH := 1.2   # شدة التباعد (مربع/ث)

# ---------- القتال (5.1 – 5.3) ----------
const SCAN_EVERY := 0.25         # كل وحدة idle تبحث عن عدو كل ربع ثانية
const REPATH_EVERY := 0.5        # إعادة حساب المسار أثناء المطاردة
const CHASE_DETECT_FACTOR := 1.5 # يفلت الهدف إذا تجاوز مدى الرصد × 1.5
const CHASE_MAX_TILES := 6.0     # أو إذا ابتعدت الوحدة 6 مربعات عن مكان بدء المطاردة
const HIT_FLASH := 0.1           # وميض أبيض على المُصاب
const SHAKE_PIXELS := 3.0        # ارتجاج الكاميرا عند الضربات المميزة فقط
const SHAKE_DUR := 0.15
const SHAKE_COOLDOWN := 1.0      # لا يتكرر أكثر من مرة في الثانية
const MELEE_SWITCH_RANGE := 1.5  # الرامي يقاتل بالأيدي إذا اقترب العدو لهذا الحد (5.3)
const PROJ_MIN_TIME := 0.3       # زمن طيران المقذوف
const PROJ_MAX_TIME := 0.5
const PROJ_SPEED := 9.0          # مربع/ث، ويُقصّ بين الحدين أعلاه
const ARRIVE_EPS := 0.05         # اعتبار الوحدة وصلت نقطة المسار
const HP_BAR_W := 11.0           # عرض شريط الدم فوق الرأس
const HP_BAR_H := 1.6
const HP_BAR_Y := -20.0

# ---------- القتال الواقعي: بذرة الشخصية (5.4.1) ----------
# كل وحدة تأخذ رقماً عشوائياً ثابتاً عند ظهورها، وتُشتق منه هذه الصفات.
# القيم تُولَّد من البذرة ولا تُكتب يدوياً لأي وحدة.
const TRAIT_BOLD := [0.7, 1.3]       # الجرأة: متى تقتحم وميلها للضربات القوية
const TRAIT_DODGE := [0.7, 1.3]      # مهارة التفادي (تُستعمل في دفعة ردود الأفعال)
const TRAIT_REACT := [0.10, 0.35]    # زمن رد الفعل بالثواني (نفس الدفعة)
const TRAIT_SPEED_VAR := 0.07        # ±7% على سرعة المشي
const TRAIT_SIZE_VAR := 0.04         # ±4% على حجم الرسم

# ---------- القتال الواقعي: الحركات (5.4.2) ----------
# wind الاستعداد، recover التعافي، dmg معامل الضرر، reach زيادة المدى،
# arc قوس الإصابة بالدرجات، stagger ترنّح الهدف، push دفعه بالمربعات.
const MOVES := {
	"quick":  {"wind": 0.18, "recover": 0.25, "dmg": 0.7, "reach": 0.0, "arc": 120.0,
			   "stagger": 0.0, "push": 0.0, "around": false},
	"heavy":  {"wind": 0.45, "recover": 0.55, "dmg": 1.6, "reach": 0.0, "arc": 100.0,
			   "stagger": 0.4, "push": 1.0, "around": false},
	"thrust": {"wind": 0.30, "recover": 0.35, "dmg": 1.0, "reach": 0.6, "arc": 45.0,
			   "stagger": 0.0, "push": 0.0, "around": false},
	"spin":   {"wind": 0.50, "recover": 0.60, "dmg": 0.8, "reach": 0.0, "arc": 360.0,
			   "stagger": 0.0, "push": 0.0, "around": true},
}
const MOVE_ORDER := ["quick", "heavy", "thrust", "spin"]
# الحركة الدائرية للمحطِّم والأبطال فقط (5.4.2)
const SPIN_UNITS := ["hammer_breaker", "crow_hero", "hammer_hero", "viper_hero", "scorp_hero"]
# أزمنة الجدول أعلاه نسبية: تُضرب في زمن ضربة الوحدة (rate) من القسم 6 حتى تبقى
# الفروق بين الوحدات كما هي، وفي 1.6 (= معامل ضرر القوية) حتى يبقى معدل الضرر
# في الثانية مطابقاً لأرقام القسم 6 تماماً قبل التفادي والصدّ.
const MOVE_CYCLE_SCALE := 1.6

# ---------- اختيار الحركة بنظام نقاط (5.4.2) ----------
const MOVE_BASE := {"quick": 1.0, "heavy": 1.0, "thrust": 0.8, "spin": 0.6}
const MOVE_RECOVER_BONUS := 2.0   # الهدف في زمن تعافٍ: فرصة للقوية
const MOVE_FAR_FRAC := 0.90       # "بعيد قليلاً" = على حافة المدى (أبعد من 90% منه)
const MOVE_FAR_BONUS := 1.5       # للطعنة
const MOVE_CROWD := 3             # ثلاثة أعداء أو أكثر حول الوحدة
const MOVE_CROWD_BONUS := 2.0     # للدائرية
const MOVE_LOW_HP := 0.30         # دم أقل من 30%: حذر
const MOVE_LOW_HP_BONUS := 1.5    # للسريعة
const MOVE_BOLD_W := 3.0          # وزن (الجرأة − 1) على القوية والدائرية
# الجرأة تحدد أيضاً "المسافة التي يقتحم عندها" (5.4.1): الجريء يلتصق بالعدو فيضرب
# ضربات قريبة، والحذر يبقى على مدى ذراعه فتكثر منه الطعنات. هذا ما يخلط الحركات
# في المعركة بدل أن تسيطر حركة واحدة لأن الجميع يقف على نفس المسافة.
const CLOSE_SPAN := 0.5           # أجرأ وحدة تقترب إلى 50% من مداها، وأحذرها تبقى على مداها
const MOVE_RANDOM := 0.15         # عشوائية ±15% على النتيجة النهائية
# سماحية صغيرة عند لحظة الضرر: إن ابتعد الهدف أكثر منها أثناء الاستعداد مرّت الضربة
# في الهواء. ليست رقماً من الوصف بل حاجة تقنية حتى لا تصيب ضربة هدفاً هارباً.
const MOVE_WHIFF_SLACK := 0.15

# ---------- أرقام الوحدات (6.1 – 6.6 و 3.8) ----------
# الوحدة المرجعية (6.1): دم 100، درع 0، ضرر 10، زمن 1.0، مدى 1.0، رصد 4، سرعة 2.2، استيلاء 1
# الحقول الاختيارية: ranged/proj/melee_dmg/melee_rate تُستعمل في 5.3،
# و splash/aura/heal/fire مذكورة للمرحلة 6 ولا يقرأها القتال الأساسي.
const UNIT_BASE := {
	"hp": 100.0, "armor": 0.0, "dmg": 10.0, "rate": 1.0,
	"range": 1.0, "detect": 4.0, "speed": 2.2, "capture": 1.0,
}
const UNIT_STATS := {
	# الغربان (6.2)
	"crow_common":      {"speed": 2.5, "capture": 1.25},
	"crow_spear":       {"hp": 150.0, "dmg": 12.0, "rate": 1.3, "range": 1.8, "detect": 4.5, "speed": 2.2},
	"crow_dual":        {"hp": 95.0, "dmg": 7.0, "rate": 0.8, "speed": 2.6,
						 "combo_step": 0.12, "combo_max": 4, "combo_min_rate": 0.5, "combo_reset": 2.0},
	"crow_hero":        {"hp": 260.0, "armor": 0.10, "dmg": 18.0, "rate": 1.2, "range": 2.2, "speed": 2.5, "hero": true,
						 "combo_step": 0.08, "combo_cap": 0.50, "combo_reset": 3.0},
	# المطارق (6.3)
	"hammer_common":    {"hp": 120.0, "armor": 0.15},
	"hammer_shield":    {"hp": 320.0, "armor": 0.50, "dmg": 8.0, "rate": 1.2, "speed": 1.6},
	"hammer_breaker":   {"hp": 200.0, "armor": 0.20, "dmg": 28.0, "rate": 2.2, "range": 1.2, "speed": 1.8, "splash": 1.0},
	"hammer_hero":      {"hp": 420.0, "armor": 0.40, "dmg": 26.0, "rate": 1.8, "range": 1.2, "speed": 1.7, "hero": true},
	# الأفاعي (6.4)
	"viper_common":     {"dmg": 7.0, "rate": 1.4, "range": 3.5, "detect": 4.5,
						 "ranged": true, "proj": "stone", "melee_dmg": 8.0, "melee_rate": 1.0},
	"viper_sniper":     {"hp": 80.0, "dmg": 26.0, "rate": 2.5, "range": 7.0, "detect": 7.5, "speed": 2.0,
						 "ranged": true, "proj": "arrow", "melee_dmg": 4.0, "melee_rate": 1.0},
	"viper_firebomber": {"hp": 90.0, "dmg": 0.0, "rate": 5.0, "range": 4.0, "detect": 4.5, "speed": 2.1,
						 "ranged": true, "proj": "bottle", "melee_dmg": 5.0, "melee_rate": 1.0,
						 "fire_radius": 1.2, "fire_dur": 4.0, "fire_dps": 6.0},
	"viper_hero":       {"hp": 240.0, "dmg": 12.0, "shots": 3, "rate": 2.2, "range": 6.5, "speed": 2.0,
						 "ranged": true, "proj": "arrow", "melee_dmg": 6.0, "melee_rate": 1.0, "hero": true},
	# العقارب (6.5)
	"scorp_common":     {"spawn_factor": 0.8},
	"scorp_boss":       {"hp": 160.0, "armor": 0.10, "dmg": 12.0, "speed": 2.0, "aura": 3.0, "aura_dmg": 0.20},
	"scorp_medic":      {"hp": 100.0, "dmg": 5.0, "speed": 2.2, "heal_range": 3.0, "heal_rate": 10.0},
	"scorp_hero":       {"hp": 280.0, "armor": 0.15, "dmg": 16.0, "rate": 1.3, "speed": 2.1,
						 "aura": 3.5, "aura_dmg": 0.25, "heal_range": 3.5, "heal_rate": 4.0, "hero": true},
	# الشرطة (3.8)
	"police_common":    {"hp": 130.0, "armor": 0.10, "dmg": 12.0, "rate": 1.0, "detect": 4.5, "speed": 2.3},
	"police_captain":   {"hp": 210.0, "armor": 0.20, "dmg": 16.0, "rate": 1.1, "detect": 5.0, "speed": 2.1},
}

# قيمة صفة لوحدة: من جدولها وإلا من الوحدة المرجعية
static func stat(key: String, field: String) -> Variant:
	var s: Dictionary = UNIT_STATS.get(key, {})
	if s.has(field):
		return s[field]
	return UNIT_BASE.get(field, 0.0)

# ---------- الضربات المميزة والشحن (6.7) ----------
const CHARGE_FULL := 100.0
const CHARGE_PER_SEC := 3.0        # شحن تلقائي
const CHARGE_PER_HIT := 8.0        # عن كل ضربة تُصيب
const CHARGE_PER_DAMAGE := 5.0     # عن كل 50 ضرراً تتلقاه
const CHARGE_DAMAGE_STEP := 50.0
const HERO_CHARGE_PER_SEC := 2.0   # الأبطال أبطأ
const HERO_CHARGE_PER_HIT := 6.0

# نوع الضربة وشرط إطلاقها:
#   enemy = عدو داخل المدى | foe_near = عدو داخل مدى الرصد | ally = حليف متضرر قريب
const ULTS := {
	"hammer_shield":    {"kind": "invuln", "need": "foe_near", "dur": 3.0},
	"hammer_breaker":   {"kind": "aoe", "need": "enemy", "radius": 2.5, "dmg": 60.0,
						 "slow": 0.30, "slow_dur": 2.0},
	"viper_sniper":     {"kind": "shot", "need": "enemy", "range": 10.0, "dmg": 55.0},
	"viper_firebomber": {"kind": "fire", "need": "enemy", "radius": 2.5, "dur": 7.0, "dps": 12.0},
	"scorp_boss":       {"kind": "buff", "need": "foe_near", "radius": 3.0,
						 "dmg": 0.50, "rate": 0.20, "dur": 5.0},
	"scorp_medic":      {"kind": "heal_burst", "need": "ally", "radius": 2.5, "hp": 60.0},
	"crow_spear":       {"kind": "pierce", "need": "enemy", "dmg": 24.0, "targets": 2},
	"crow_dual":        {"kind": "volley", "need": "enemy", "hits": 4, "dmg": 7.0, "gap": 0.25},
	"hammer_hero":      {"kind": "invuln_aoe", "need": "enemy", "dur": 3.0, "radius": 3.0, "dmg": 70.0},
	"viper_hero":       {"kind": "fire_arrows", "need": "enemy", "arrows": 3, "dmg": 20.0,
						 "fire_radius": 1.0, "fire_dur": 4.0, "fire_dps": 8.0},
	"scorp_hero":       {"kind": "buff_heal", "need": "foe_near", "radius": 3.5,
						 "dmg": 0.50, "dur": 5.0, "hp": 60.0},
	"crow_hero":        {"kind": "arc", "need": "enemy", "radius": 2.5, "dmg": 36.0},
	"police_common":    {"kind": "bash", "need": "enemy", "dmg": 18.0, "push": 1.0,
						 "slow": 0.40, "slow_dur": 1.5},
	"police_captain":   {"kind": "rally", "need": "foe_near", "radius": 3.0, "dmg": 0.30, "dur": 5.0},
}
const ULT_HEAL_SELF := true        # العلاج الجماعي يشمل صاحبه، بخلاف علاج الطبيب المستمر

# ---------- الأبطال (6.6) ----------
const HERO_RESPAWN := 60.0         # بعد الموت، ولا يبدأ إلا بامتلاك 5 أحياء
const HERO_RESPAWN_MIN_DISTRICTS := 5

# ---------- الظهور (7) ----------
const START_COMMONS := 3            # كل لاعب يبدأ بـ 3 أفراد عاديين + بطله
const SPAWN_COMMON_BASE := 14.0     # max(4, 14 − (D−1) × 1)
const SPAWN_COMMON_STEP := 1.0
const SPAWN_COMMON_MIN := 4.0
const SPAWN_SPECIAL_BASE := 75.0    # max(30, 75 − (D−1) × 3)
const SPAWN_SPECIAL_STEP := 3.0
const SPAWN_SPECIAL_MIN := 30.0
const UNIT_LIMIT_DEFAULT := 60      # يُختار في قائمة الإعداد (المرحلة 9)
const SCORP_SPAWN_FACTOR := 0.8     # العقارب: العاديون × 0.8
const GANG_SPECIALS := {
	"crow": ["crow_spear", "crow_dual"],
	"hammer": ["hammer_shield", "hammer_breaker"],
	"viper": ["viper_sniper", "viper_firebomber"],
	"scorp": ["scorp_boss", "scorp_medic"],
}
const GANG_HERO := {
	"crow": "crow_hero", "hammer": "hammer_hero",
	"viper": "viper_hero", "scorp": "scorp_hero",
}

# ---------- الاستيلاء (8) ----------
const CAPTURE_MAX := 100.0
const CAPTURE_RATE := 8.0           # نقطة/ث لكل وحدة قوة استيلاء
const CAPTURE_POWER_MAX := 6.0      # سقف قوة الاستيلاء داخل المنطقة
const CAPTURE_DECAY := 5.0          # رجوع التقدم عند خلو المنطقة
const CAPTURE_TICK := 0.2           # دورة حساب الاستيلاء (توفيراً للأداء)
const TINT_GROUND := 0.30           # خلط أرض الحي بلون المالك
const TINT_ROOF := 0.45             # الأسطح والأجزاء العلوية
const TINT_WALL := 0.20             # الجدران، أقل حتى تبقى قراءة المباني واضحة
const TINT_TIME := 0.5              # زمن الانتقال اللوني
const TINT_STEPS := 5               # كم خطوة يُعاد فيها رسم الخريطة أثناء الانتقال (14)
# لا تُصبغ: الأطلال والأشجار والفراغ — ليست ملكاً لأحد
const NO_TINT := ["R", "T", "X", "B", "."]

# ---------- منع الاكتساح (9) ----------
const LEADER_SHARE := 0.40          # من يملك 40% من الأحياء يصير هدف البوتات الأول

# ---------- شريط القوة وتنبيهات الحافة (12.3) ----------
const POWER_ROW_H := 18.0
const POWER_UPDATE := 1.0           # تتحدث كل ثانية لا كل إطار
const POWER_MAX_SCREEN := 0.34      # لا تغطي أكثر من ثلث ارتفاع الشاشة
const POWER_DEAD_ALPHA := 0.4       # وضوح سطر اللاعب المهزوم
const ALERT_MAX := 2                # لا أكثر من سهمين في وقت واحد
const ALERT_REPEAT := 5.0           # لا يتكرر التنبيه لنفس المنطقة إلا كل 5 ثوانٍ
const ALERT_AREA := 6.0             # مربعات تُعتبر نفس المنطقة
const ALERT_LIFE := 3.0
const ALERT_ATTACK_COLOR := Color("d94a3a")   # سهم أحمر: وحداتك تتعرض للهجوم
const ALERT_CAPTURE_COLOR := Color("e08a2a")  # سهم برتقالي: عدو يستولي على حيك
const TOAST_LIFE := 2.5

# ---------- القوائم والحفظ (12) ----------
const GAME_TITLE := "مدينة العصابات"
const SAVE_PATH := "user://settings.cfg"
const MAX_SLOTS := 8
const UNIT_LIMITS := [30, 50, 100, 150, 200, 250]
const UNIT_LIMIT_DEFAULT_INDEX := 2          # الافتراضي 100
const WEATHERS := ["day", "night", "snow", "rain", "random"]
const WEATHER_NAMES := {
	"day": "نهار", "night": "ليل", "snow": "ثلج", "rain": "مطر خفيف", "random": "عشوائي",
}
const WEATHER_ICONS := {
	"day": "☀", "night": "☾", "snow": "❄", "rain": "☂", "random": "?",
}
const SLOT_KINDS := ["human", "bot", "closed"]
const SLOT_KIND_NAMES := {"human": "أنت", "bot": "بوت", "closed": "مغلقة"}
const GANG_CHOICES := ["random", "crow", "hammer", "viper", "scorp"]
const GANG_CHOICE_NAMES := {
	"random": "عشوائي", "crow": "الغربان", "hammer": "المطارق",
	"viper": "الأفاعي", "scorp": "العقارب",
}
const TEAM_NAMES := ["بدون", "فريق 1", "فريق 2", "فريق 3", "فريق 4"]

# ---------- البوتات والتحالفات (11) ----------
const DIFFICULTIES := ["easy", "medium", "hard"]
const DIFFICULTY_NAMES := {"easy": "سهل", "medium": "متوسط", "hard": "صعب"}
const BOT_DIFFICULTY_DEFAULT := "medium"
# تتخذ قراراتها كل: سهل 4 ث، متوسط 2 ث، صعب 1 ث
const BOT_THINK := {"easy": 4.0, "medium": 2.0, "hard": 1.0}
# حجم المجموعة المرسلة: سهل مجموعات صغيرة، وصعب يركز
const BOT_GROUP := {"easy": 3, "medium": 4, "hard": 6}
# جيش كافٍ لبدء الهجوم: سهل يهاجم متأخراً
const BOT_ATTACK_MIN := {"easy": 12, "medium": 7, "hard": 5}
# مع الشرطة: السهل يتجنبها، والمتوسط من 8 وحدات، والصعب يستهدفها مبكراً
const BOT_POLICE_MIN_ARMY := {"easy": 9999, "medium": 8, "hard": 0}
const BOT_DEFEND_RADIUS := 5.0     # عدو داخل هذا المدى من حي مملوك = هجوم يستدعي الدفاع
const BOT_RETREAT_HP := 0.4        # الصعب يسحب المصاب دون هذه النسبة إلى المستشفى
const BOT_REORDER_DIST := 1.5      # لا يُعاد إصدار الأمر إلا إذا تغيّر الهدف بهذا القدر
const BOT_BACKLINE := 1.6          # الصعب يضع الرماة خلف المقاتلين بهذه المسافة

# ---------- الطقس (10) ----------
# يُختار في قائمة الإعداد ويبقى ثابتاً طوال المباراة.
const WEATHER_DETECT := {"night": 0.75}      # مدى الرصد ليلاً × 0.75
const WEATHER_SPEED := {"snow": 0.85}        # سرعة الحركة في الثلج × 0.85
const WEATHER_RANGED_HIT := {"rain": 0.80}   # الهجمات البعيدة تصيب 80% في المطر
const WEATHER_MISS_SPREAD := 0.55            # كم تبتعد الضربة الخاطئة عن الهدف (مربعات)
# الطبقة التي تُرسم فوق المشهد كله (مطابقة لـ prototype.html)
const WEATHER_OVERLAY := {
	"night": Color(0.039, 0.063, 0.165, 0.62),
	"rain": Color(0.176, 0.235, 0.314, 0.30),
	"snow": Color(0.882, 0.922, 0.961, 0.12),
}
# الثلج: لون أبيض يُخلط بالأرض والأسطح والأشجار بنسب مختلفة
const SNOW_TINT := Color("eef2f5")
const SNOW_GROUND := 0.72
const SNOW_ROAD := 0.45
const SNOW_TOP := 0.75          # وجه علوي للصندوق
const SNOW_ROOF_L := 0.55       # سقف مائل: الجهة اليسرى
const SNOW_ROOF_R := 0.65       # سقف مائل: الجهة اليمنى
const SNOW_TREE := 0.30         # جذع الشجرة وورقها الأساسي
const SNOW_TREE_TOP := 0.55     # الورق العلوي أكثر بياضاً
# المطر: الأرض أغمق
const RAIN_GROUND_TINT := Color("2a2f36")
const RAIN_GROUND := 0.20
# ندف الثلج (إحداثيات الشاشة، مستقلة عن الكاميرا)
const SNOW_COUNT := 110
const SNOW_VY := [18.0, 40.0]       # سرعة السقوط: من، إلى
const SNOW_VX := [-4.0, 4.0]
const SNOW_R := [0.8, 2.4]
const SNOW_SWAY := 12.0             # تمايل جانبي
const SNOW_PART_COLOR := Color(1, 1, 1, 0.85)
# خطوط المطر
const RAIN_COUNT := 150
const RAIN_VY := [420.0, 540.0]
const RAIN_VX := -70.0
const RAIN_LEN := [9.0, 15.0]
const RAIN_SLANT := -2.5            # ميل الخط أفقياً
const RAIN_PART_COLOR := Color(0.784, 0.843, 0.922, 0.45)
const RAIN_PART_W := 1.0
# مصادر الإضاءة الليلية: {r نصف القطر, c اللون, a الشدة}
const LIGHT_WINDOW := {"r": 20.0, "c": Color(1.0, 0.804, 0.471), "a": 0.30}   # نوافذ العمارات
const LIGHT_BARREL := {"r": 34.0, "c": Color(1.0, 0.588, 0.235), "a": 0.65}   # برميل نار
const LIGHT_LAMP := {"r": 12.0, "c": Color(1.0, 0.882, 0.627), "a": 0.60}     # مصباح عمود الإنارة
const LIGHT_LAMP_POOL := {"r": 24.0, "c": Color(1.0, 0.843, 0.549), "a": 0.28} # بركة ضوئه على الأرض
const LIGHT_FLAG := {"r": 18.0, "c": Color(1.0, 0.922, 0.745), "a": 0.25}     # ساحة العلم

# ---------- زينة الشوارع (7) ----------
# عتبتان على رمية واحدة لكل مربع شارع: أقل من الأولى برميل، وما بينهما عمود إنارة
const DECOR_BARREL_P := 0.015       # 1.5% براميل نار
const DECOR_LAMP_P := 0.050         # و 3.5% أعمدة إنارة

# ---------- ألوان الأرض ----------
const GROUND := {
	"crow": Color("7a7090"), "hammer": Color("8d6a60"), "viper": Color("6d7d5a"),
	"scorp": Color("a08a66"), "neutral": Color("948d7f"), "road": Color("5a554e"),
	"special": Color("b39a4a"),   # أرض ذهبية للأحياء المميزة (3.7)
	"police": Color("6b7683"),    # رمادي مزرق لأحياء مراكز الشرطة (3.8)
}

# ---------- الأداء (14) ----------
const FPS_TAP_GAP := 0.6     # أقصى فاصل بين لمستين ليُحسبا متتاليتين
const FPS_UPDATE := 0.5      # تحديث رقم الإطارات كل نصف ثانية

# ---------- الكاميرا والتحكم (4) ----------
const ZOOM_MIN := 0.8
const ZOOM_MAX := 4.5
const ZOOM_START := 2.2
const TAP_SLOP := 8.0        # بكسل قبل اعتبار اللمسة سحباً
const TAP_RADIUS := 26.0     # نصف قطر اختيار الوحدة باللمس
const LONG_PRESS := 0.5      # ضغطة مطوّلة = أمر هجوم متحرك (4.2)
const DOUBLE_TAP := 0.3      # نقرتان خلال هذه المدة = تحديد المجموعة (4.2)
const DOUBLE_TAP_RADIUS := 5.0   # نصف قطر تحديد المجموعة بالمربعات (4.2)
const WHEEL_ZOOM := 1.12     # خطوة عجلة الماوس على الكمبيوتر
const CAM_MARGIN := 120.0    # كم بكسل يُسمح للكاميرا بتجاوز حافة الخريطة
# ارتفاع كل نوع مبنى بالبكسل، لحساب حدود القطعة بدقة بدل هامش واحد كبير (14)
const KIND_HEIGHT := {
	"A": 44.0, "C": 60.0, "Q": 50.0, "M": 28.0, "S": 30.0, "K": 20.0, "G": 42.0,
	"H": 28.0, "W": 16.0, "Y": 64.0, "T": 22.0, "R": 14.0, "Z": 12.0, "X": 8.0,
	"B": 14.0, "F": 12.0, "P": 26.0,
}
const KIND_HEIGHT_DEFAULT := 24.0

# ---------- النموذج فقط (يُستبدل في المراحل التالية) ----------
const PROTO_UNITS_PER_HOME := 3
const PROTO_WALK_SPEED := 2.2
