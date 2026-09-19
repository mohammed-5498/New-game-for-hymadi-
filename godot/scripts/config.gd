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
const BUILDING_MIX := {
	"crow":    [["A", 0.45], ["H", 0.70], ["R", 0.85], [".", 1.00]],
	"hammer":  [["W", 0.45], ["R", 0.65], ["H", 0.82], [".", 1.00]],
	"viper":   [["T", 0.45], ["H", 0.75], ["R", 0.85], [".", 1.00]],
	"scorp":   [["H", 0.55], ["R", 0.70], ["T", 0.82], [".", 1.00]],
	"neutral": [["H", 0.32], ["A", 0.46], ["R", 0.66], ["W", 0.76], ["T", 0.88], [".", 1.00]],
}

# ---------- العصابات (6) ----------
const GANGS := ["crow", "hammer", "viper", "scorp"]
const GANG_NAMES := {"crow": "الغربان", "hammer": "المطارق", "viper": "الأفاعي", "scorp": "العقارب"}
const GANG_COLORS := {
	"crow": Color("8a5cc7"), "hammer": Color("d9463b"),
	"viper": Color("3fa34d"), "scorp": Color("e0b030"),
}
const POLICE_COLOR := Color("3a5a86")

# ألوان اللاعبين الثمانية (12.2) — منفصلة عن العصابة، والوحدات والأعلام تأخذها
const PLAYER_COLORS := [
	Color("8a5cc7"), Color("d9463b"), Color("3fa34d"), Color("e0b030"),
	Color("2f8fc7"), Color("d96fa8"), Color("c96a2a"), Color("7f8c8d"),
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
	"crow_dual":        {"hp": 95.0, "dmg": 7.0, "rate": 0.8, "speed": 2.6},
	"crow_hero":        {"hp": 260.0, "armor": 0.10, "dmg": 18.0, "rate": 1.2, "range": 2.2, "speed": 2.5, "hero": true},
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
# لا تُصبغ: الأطلال والأشجار والفراغ — ليست ملكاً لأحد
const NO_TINT := ["R", "T", "."]

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

# ---------- ألوان الأرض ----------
const GROUND := {
	"crow": Color("7a7090"), "hammer": Color("8d6a60"), "viper": Color("6d7d5a"),
	"scorp": Color("a08a66"), "neutral": Color("948d7f"), "road": Color("5a554e"),
	"special": Color("b39a4a"),   # أرض ذهبية للأحياء المميزة (3.7)
	"police": Color("6b7683"),    # رمادي مزرق لأحياء مراكز الشرطة (3.8)
}

# ---------- الكاميرا والتحكم (4) ----------
const ZOOM_MIN := 0.8
const ZOOM_MAX := 5.0
const ZOOM_START := 2.2
const TAP_SLOP := 8.0        # بكسل قبل اعتبار اللمسة سحباً
const TAP_RADIUS := 26.0     # نصف قطر اختيار الوحدة باللمس
const LONG_PRESS := 0.45     # ضغطة مطوّلة = أمر هجوم متحرك (4.3)

# ---------- النموذج فقط (يُستبدل في المراحل التالية) ----------
const PROTO_UNITS_PER_HOME := 3
const PROTO_WALK_SPEED := 2.2
