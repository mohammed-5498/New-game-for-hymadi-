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

# ---------- النموذج فقط (يُستبدل في المراحل التالية) ----------
const PROTO_UNITS_PER_HOME := 3
const PROTO_WALK_SPEED := 2.2
