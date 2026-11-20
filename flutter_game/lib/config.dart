// ===================================================================
// كل الأرقام القابلة للموازنة في اللعبة هنا فقط، بأسماء js/config.js نفسها (القسم 18.1).
// تُنقل الأقسام مع مراحل النقل؛ وما يُعدَّل هنا أثناء النقل يُعدَّل في js/config.js أيضاً.
// ===================================================================

// قيمة لكل فئة حجم (الخريطة أو الحي): small وmedium وlarge
typedef PerSize<T> = ({T small, T medium, T large});

extension PerSizeOf<T> on PerSize<T> {
  T of(String key) => key == 'small' ? small : key == 'large' ? large : medium;
}

// --- حلقة اللعبة ---
const TICK_MS = 50;                 // 20 تحديثاً في الثانية
const TICK_SEC = TICK_MS / 1000;

// --- المربع في العالم (نسبة 2:1) ---
const double TILE_HALF_W = 18;
const double TILE_HALF_H = 9;

// --- أحجام الخريطة (القسم 3.12) ---
typedef MapSize = ({String key, String name, int n, int maxPlayers, int specialDistricts, int policeStations});
const MAP_SIZES = <String, MapSize>{
  'small':  (key: 'small',  name: 'صغيرة',  n: 32, maxPlayers: 4, specialDistricts: 2, policeStations: 2),
  'medium': (key: 'medium', name: 'متوسطة', n: 42, maxPlayers: 6, specialDistricts: 3, policeStations: 3),
  'large':  (key: 'large',  name: 'كبيرة',  n: 51, maxPlayers: 8, specialDistricts: 4, policeStations: 4),
};

// --- طوابع المدن (القسم 3.9) ---
typedef CityWater = ({int small, int medium, int large, bool huts});
typedef OpenCity = ({int street, List<int> spacing, String lanes, double scale, bool roadProp, double? roundabout});
const CITIES = (
  order: ['yamamah', 'arab', 'japan', 'china', 'europe', 'norway', 'hk', 'jaipur', 'mexico', 'chicago',
          'shibam', 'diriyah', 'cairo', 'kaifeng', 'gyeongju', 'paris', 'birmingham', 'rothenburg',
          'gondar', 'kano', 'meroe', 'rio', 'laboca', 'tenoch'],
  // ماء على حافة الخريطة بهذا العرض من المربعات (لا يُمشى عليه). huts: أكواخ على أعمدة (النرويجية وحدها)
  water: <String, CityWater>{
    'norway':     (small: 2, medium: 2, large: 3, huts: true),
    'kaifeng':    (small: 2, medium: 2, large: 3, huts: false),
    'birmingham': (small: 2, medium: 2, large: 3, huts: false),
    'meroe':      (small: 2, medium: 2, large: 3, huts: false),
    'laboca':     (small: 2, medium: 2, large: 3, huts: false),
    'tenoch':     (small: 2, medium: 2, large: 3, huts: false),
  },
  rorbuChance: 0.55,
  short: <String, String>{'yamamah': 'اليمامة', 'arab': 'عربية', 'japan': 'إيدو', 'china': 'صينية', 'europe': 'أوروبية',
    'norway': 'نرويجية', 'hk': 'هونغ كونغ', 'jaipur': 'جايبور', 'mexico': 'مكسيكية', 'chicago': 'شيكاغو',
    'shibam': 'شبام', 'diriyah': 'الدرعية', 'cairo': 'القاهرة', 'kaifeng': 'كايفنغ', 'gyeongju': 'غيونغجو',
    'paris': 'باريس', 'birmingham': 'برمنغهام', 'rothenburg': 'روتنبورغ', 'gondar': 'غوندر', 'kano': 'كانو',
    'meroe': 'مروي', 'rio': 'ريو', 'laboca': 'لا بوكا', 'tenoch': 'تينوتشتيتلان'},
  // سور صحراء اليمامة: برج كل towerEvery مربعاً، وقوس قديم فوق archChance من الشوارع الخارجة من الحافتين القريبتين
  walls: <String, ({int towerEvery, double archChance})>{'yamamah': (towerEvery: 6, archChance: 0.6)},
  // المدن المفتوحة: street عرض الشارع، spacing المسافات بين بدايتي شارعين، lanes ممرات الأحياء،
  // scale حجم المبنى العادي، roadProp علامات الطابع على الشارع، roundabout نصف قطر حلقة الدوار
  open: <String, OpenCity>{
    'chicago':    (street: 2, spacing: [5, 7], lanes: 'center', scale: 1, roadProp: false, roundabout: null),
    'hk':         (street: 2, spacing: [5, 7], lanes: 'center', scale: 1, roadProp: true, roundabout: 3),
    'europe':     (street: 2, spacing: [5, 6, 7], lanes: 'rows', scale: 0.86, roadProp: true, roundabout: null),
    'shibam':     (street: 2, spacing: [5, 7], lanes: 'center', scale: 1, roadProp: true, roundabout: null),
    'paris':      (street: 2, spacing: [5, 7], lanes: 'rows', scale: 0.86, roadProp: true, roundabout: 3),
    'rothenburg': (street: 2, spacing: [5, 7], lanes: 'rows', scale: 0.86, roadProp: true, roundabout: 3),
  },
);

// مناطق قائمة المدن (القسم 12.2)
// مدن خرجت من اللعبة (2.4.0، بطلب المستخدم: "حذف خريطة اليمامة... لم تعد لها أي قيمة"): لا تُختار ولا تظهر في القوائم والمتجر
// ولا يقع عليها العشوائي، وتبقى في المولّد لفحص التطابق مع نسخة المتصفح وللمباريات المحفوظة. وزينتها لمدن منطقتها
const RETIRED_CITIES = {'yamamah'};

const REGIONS = (
  order: ['arabic', 'asian', 'european', 'african', 'american'],
  names: <String, String>{'arabic': 'العربية', 'asian': 'الآسيوية', 'european': 'الأوروبية', 'african': 'الأفريقية',
    'american': 'الأمريكتان'},
  cities: <String, List<String>>{
    'arabic': ['shibam', 'diriyah', 'cairo', 'yamamah', 'arab'],
    'asian': ['kaifeng', 'japan', 'gyeongju', 'china', 'hk', 'jaipur'],
    'european': ['paris', 'birmingham', 'rothenburg', 'europe', 'norway'],
    'african': ['gondar', 'kano', 'meroe'],
    'american': ['rio', 'laboca', 'tenoch', 'mexico', 'chicago'],
  },
);

// أنواع ليست مباني (أشجار وزينة وسور اليمامة والمعلم): لا تُصبغ بلون المالك
const CITY_UNTINTED = ['palm', 'cherry', 'lantern', 'willow', 'lanterns', 'pine', 'rack', 'banyan', 'neem', 'cactus', 'tree',
  'ptree', 'rtree', 'lamp', 'acacia', 'baobab', 'dye', 'crane', 'chinampa', 'ahuejote',
  'grove', 'well', 'cart', 'wallI', 'wallJ', 'gateI', 'gateJ', 'archI', 'archJ', 'wallTower', 'brokenI', 'brokenJ', 'brokenTower',
  'monument'];

// --- إيقاع الرسم في التطبيق (2.11.0، بطلب المستخدم: "60 إطاراً هو الطبيعي و30 لمن أراد تفعيله في الإعدادات"، و"اجعل إطارات
// القائمة الرئيسية 30"). fps في اللعب (اللمس والكاميرا وكل جندي ظاهر يمشي أو يقاتل، وأي سهم طائر)، وcalmFps بعد activeMs بلا شيء
// منها (لا حركة على الشاشة فلا يُرى الفرق)، ولا إطار في الإيقاف والنهاية (يُرسم مرة حين يتغير شيء)، وخلفية القوائم menuFps،
// وعرض الشخصيات showFps. و"توفير البطارية" في الإعدادات saverFps وsaverCalm. وحارس المعالج (CPU) ينزل بإيقاع اللعب إن تجاوزت
// اللعبة حصتها. (2.8.0 كانت 30 و15 بطلبه بعد رسالة "العناية بالجهاز"، والحارس بحصة 6% أنزلها إلى 15 في معارك جواله) ---
const PACE = (fps: 60.0, calmFps: 30.0, activeMs: 2000, menuFps: 30.0, showFps: 30.0, saverFps: 30.0, saverCalm: 15.0,
    unitHz: 30.0,   // unitHz: كم مرة في الثانية يُحسب شكل الجندي (وبينها يُنقل)
    // المعارك الثقيلة (2.1.1، بطلب المستخدم): أكثر تحديثين منطقيين في الإطار (كان 5: الإطار المتأخر يُلحقه بتحديثات أكثر فيتأخر أكثر)
    maxTicks: 2);

// --- حارس المعالج (2.8.0، بطلب المستخدم: "وتأكد من عدم حدوث ذلك مرة ثانية"، lib/ui/cpu_guard.dart): وقت اللعبة على المعالج
// من /proc/self/stat كل ثانية، بنسبته من الجهاز كله (رقم رسالة سامسونج نفسه، وظهرت عند 12.5%). حصتها share من الجهاز ولا أكثر من
// cores نواة (ثمانٍ: 0.8 نواة = 10%، وأربع: 0.4)، ومع توفير البطارية saver منها. في المباراة: إن تجاوز متوسط window ثوانٍ حصتها
// نزل إيقاع اللعب إلى الدرجة التالية من steps (أو saverSteps مع توفير البطارية)، وإن بقي تحت relax منها calmSeconds صعد، وبين
// تغييرين hold ثوانٍ على الأقل. 2.11.0: درجتان فقط (60 ثم 30) لا ينزل تحتهما، فاللعب سلس دائماً، والحصة عند حد الرسالة لا قبله ---
const CPU = (share: 0.10, cores: 1.0, saver: 0.7, steps: [60.0, 30.0], saverSteps: [30.0, 20.0], window: 4, hold: 4, relax: 0.45,
    calmSeconds: 10);

// --- صورة الأرض الجاهزة (2.9.0، GroundCache في city_layer.dart): تغطي الشاشة وmargin من عرضها وطولها حول كل جانب، وتُرسم
// من جديد بعد settle إطارات من استقرار التقريب، ولا أكثر من مرة كل gap إطارات (والكاميرا تجري تُرسم الأرض مباشرة). وللجوالات
// القديمة: أطول ضلع maxSide نقطة وmaxPixels نقطة كلها (تنقص دقتها قليلاً إن تجاوزتها) ---
const GROUND_CACHE = (margin: 0.25, settle: 3, gap: 6, maxSide: 4096.0, maxPixels: 6.5e6);

// --- الذهب والمتجر (2.12.0، بطلب المستخدم: "خلنا نجرب الطريقة الثالثة"، GAME_SPEC 18.18): الأسعار بالذهب، وما يكسبه الفائز على
// البوتات (rewards بصعوبتهم إن كانت واحدة، وmixedReward إن اختلفت، 2.13.0)، وfogBonus مع ضباب الحرب، ولا شيء عند الخسارة. ومع
// الحلفاء لا ذهب إلا إن كان في الأعداء فريق بعدد فريقك على الأقل وبصعوبة حليفك أو أصعب. والصمود ينتهي بالخسارة: survival لكل
// survivalEvery موجات بصعوبة الشرطة. ومظهر النخبة مجاناً بإكمال حملة عصابته بصعوبة من skinStory. وstartGold رصيد أول تشغيل ---
const SHOP = (city: 500, side: 800, skin: 250,
    rewards: {'easy': 15, 'medium': 35, 'hard': 70, 'insane': 140}, mixedReward: 20, fogBonus: 10,
    survival: {'easy': 5, 'medium': 10, 'hard': 25, 'insane': 35}, survivalEvery: 3,
    skinStory: ['hard', 'insane'], startGold: 0);

// --- الإنجازات (2.13.0، بطلب المستخدم، GAME_SPEC 18.18ج): جائزة كل درجة بالذهب (والمجنونة جوهرة تشتري أي شيء واحد مجاناً)،
// وأهداف الإنجازات بأسمائها في lib/ui/achievements.dart ---
const ACH = (rewards: {'easy': 25, 'medium': 70, 'hard': 120}, gems: 1,
    districts: 10, ults: 10, points: 1000, cities: 4, mediumWins: 10, hqs: 3, waves: 10, kills: 500,
    hardWins: 10, hardBots: 2, hardWaves: 12, insaneWaves: 12, mobAllies: 1, mob: 6);

// --- الأعلام في صورة المدينة (2.11.0، بطلب المستخدم: "قم بالبحث عن طرق لتخفيف الضغط"): سارية العلم وحلقته وظله لا تتحرك، فتُرسم
// مع المباني في الصورة الجاهزة، والراية معها والتقريب أقل من waveZoom (لا ترفرف وهي صغيرة)؛ ومن waveZoom ترفرف فوقها مع الجنود.
// كان كل علم خلف مبنى يقطع دفعة الجنود ويعيد المبنى فوقه: ثلث رسم الإطار في معركة شبام بتقريب 0.8 ---
const FLAG_BAKE = (waveZoom: 1.5);

// --- ضباب الحرب (2.0.5، وشكله الجديد 2.0.6 بطلب المستخدم: "سلس ويغطي المنطقة بالكامل ويخفي المباني"، للتطبيق وحده):
// رصد كل جندي unitSight مربعاً على الأقل (أو رصده إن كان أبعد) بحافة ناعمة عرضها soft، وأحياؤك ومناطقها ظاهرة.
// المستكشف الذي لا يُرى الآن بعتمة explored (تخفي المباني)، وما لم يُستكشف أسود. وminLift: أقل ارتفاع يغطيه الضباب فوق
// المربع (رأس الجندي)، وblur تنعيم الطبقة كلها بوحدات العالم. يُحسب كل every ثانية من زمن المباراة، والمستكشف يُحفظ مع المباراة في key ---
// bake: دقة صورة الضباب الجاهزة (مقابل وحدات العالم): تُرسم مع كل حساب (every) ويعرضها كل إطار كما هي
const FOG = (unitSight: 6.0, soft: 2.0, explored: 0.84, minLift: 10.0, blur: 6.0, every: 0.25, key: 'gangcity.matchFog', bake: 0.4);

// --- الأرض البارزة والأرصفة (18.10أ) ---
// الشارع والماء أخفض من أرض الأحياء والرصيف (relief.drop في manifest.json وأطلس كل مدينة، وsub خُمس المربع للرصيف).
// shadow: عتمة ظل قاعدة المبنى على ما حوله، وshadowIn/Mid/Out: حلقاته بنسبة نصف مربعه (عتمة كاملة بين الأولى والثانية
// وتخفت حتى الثالثة). edge: عمق حافة الخريطة الأمامية. snow: كم يبيضّ الرصيف والحافة في الثلج، وrain: كم يغمقان في المطر
// river: كم يمتد الماء خارج حافة الخريطة ويخفت (من المربع)، فيبدو نهراً يجري تحتها (2.4.0؛ كان هامش أرض حولها).
// ruins: نسبة ما يبقى أطلالاً من مربعات الأطلال (والباقي بيوت المدينة، 2.3.1؛ وأقل في 2.4.0 بطلب المستخدم)
// inset: المباني أصغر قليلاً من مربعها، وyard: فناء بين الرصيف (أو حافة الخريطة أو الماء) والمبنى بنسبة من المربع، فلا تخرج
// زينة صوره إلى الرصيف ولا عن الخريطة (2.4.0، بطلب المستخدم؛ كان edgeInset لحافة الخريطة وحدها). ويبتعد المبنى بقدر ما يبرز
// من صورته (العتبات والمظلات، 2.4.1) حتى yardMax.
// park: كم يخضرّ أخضر الحديقة (وفي المدن الجافة parkArid)، وparkEvery: حديقة لكل هذا القدر من ضلع الخريطة (أكثر في 2.4.0).
// monument: المعلم في وسط الحديقة، وisland: جزيرة الدوار مكانه في مدن الدوار بلا دوار (أعرض من المربع)، وfountain: عرض نافورة
// الحديقة من عرض المربع
const GROUND = (sub: 5, shadow: 0.3, shadowIn: 0.78, shadowMid: 1.0, shadowOut: 1.2, edge: 9.0, snow: 0.4, rain: 0.8, river: 1.3, ruins: 0.05,
    inset: 0.86, yard: 0.12, yardMax: 0.25, monument: 0.82, island: 0.62, fountain: 0.9, park: 0.45, parkArid: 0.2, parkEvery: 14,
    // المباني المميزة كلها أصغر (2.4.0، بطلب المستخدم): المعابد والمرتزقة ومباني المدن، حول وسط كتلتها
    feature: 0.8,
    // والمبنى المميز بمربع واحد وسط خانته 3×3 (2.4.1، بطلب المستخدم: "قم بتصغير رقعة..."): مقياس صورة الكتلة
    plot: 0.62);

// زينة الشوارع أقل كثيراً (بطلب المستخدم، 2.3.1): debris نسبة ما يبقى من حطام الشارع والأرض (سيارات وبراميل وبقع وركام
// وأكياس رمل)، وcrack شقوق الشارع، وneon بقع نيون هونغ كونغ، وlane زينة ممرات المدن المفتوحة، وgrass الحصى والعشب على أرض
// الحي. cars: المدن الحديثة وما له صورة سيارة من المستخدم، ولا سيارات في غيرها. noHang: زينة معلّقة فوق الشارع بلا أعمدة لا تُرسم
// boats: نسبة مربعات الماء بقارب (2.4.0: كانت صفوفاً). والسيارات في خمس مدن وحدها (2.4.0، بطلب المستخدم)
const STREET = (debris: 0.2, crack: 0.12, neon: 0.1, lane: 0.5, grass: 0.25, boats: 0.15,
    cars: {'chicago', 'laboca', 'rothenburg', 'paris', 'birmingham'},
    noHang: {'kano', 'shibam'});

// --- الكاميرا ---
const CAMERA = (minZoom: 0.8, maxZoom: 4.5, startZoom: 2.2);

// --- توليد الخريطة ---
const MAP_GEN = (
  streetSpacingMin: 4,
  streetSpacingMax: 6,
  bendChance: 0.10,
  alleysPerSmallMap: 40,
  alleyLength: 2,
  minDistrictTiles: 4,
  minHomeDistrictTiles: 6,
  homeRingRadiusPct: 0.40,
  specialCenterRadiusPct: 0.38,
  captureRadius: 1.5,
  maxTries: 40,
  pocketRepairRounds: 3,
  pocketFillType: 'H',
  protectedBuildings: 'QSGCONFf~Y',   // لا تُفتح لعمل ممر
);

// --- أحجام الأحياء (القسم 3.12) ---
const DISTRICT_SIZES = (
  order: ['small', 'medium', 'large'],
  maxTiles: (small: 9, medium: 16),
  names: (small: 'صغير', medium: 'متوسط', large: 'كبير'),
  income:     (small: 0.8,  medium: 1.0, large: 1.3),
  capture:    (small: 1.15, medium: 1.0, large: 0.8),
  reach:      (small: 0.85, medium: 1.0, large: 1.2),
  power:      (small: 0.85, medium: 1.0, large: 1.3),
  production: (small: 1.15, medium: 1.0, large: 0.85),
  botValue:   (small: 0.85, medium: 1.0, large: 1.25),
  home: 'medium',
);

// --- مراكز الشرطة (القسم 3.8): ما يحتاجه المولّد، والباقي مع مرحلة الشرطة ---
const POLICE = (minHomeDistance: 6.0,);

// --- مزايا المدن (القسم 3.11): ما يحتاجه المولّد (مكان المباني)، والباقي مع مرحلتها ---
typedef FeaturePlace = ({PerSize<int>? count, double? minHomeDistance, int? neighbors});
const CITY_FEATURES = (
  cities: <String, String>{'diriyah': 'storm', 'shibam': 'villages', 'cairo': 'pyramid', 'japan': 'dojo',
    'gyeongju': 'bandits', 'kano': 'bandits', 'kaifeng': 'clinic', 'gondar': 'fortress', 'meroe': 'khartoum',
    'paris': 'coups', 'rothenburg': 'policeHQ', 'birmingham': 'clock', 'tenoch': 'cartel', 'rio': 'statue',
    'laboca': 'mercs', 'yamamah': 'caravan', 'arab': 'souk', 'china': 'fireworks', 'hk': 'triads',
    'jaipur': 'elephants', 'norway': 'troll', 'europe': 'bells', 'mexico': 'mine', 'chicago': 'bank'},
  // مبنى مدن الأحداث (12هـ)
  buildings: <String, String>{'diriyah': 'salwa', 'gyeongju': 'observatory', 'kano': 'kanoGate', 'paris': 'arch',
    'yamamah': 'khan', 'china': 'powder', 'norway': 'hunters'},
  blockTiles: 9,       // أقل حي يتسع لكتلة المبنى المميز 2×2 وساحته
  ground: ('#c9a24e', 0.24),   // أرض حي الميزة قبل الاستيلاء تميل لهذا اللون بهذه النسبة
  // عدد المباني لكل حجم خريطة (وإلا واحد)، وأقل بعد عن الأحياء المنزلية، وأحياء العصابة حول المجمع
  place: <String, FeaturePlace>{
    'villages': (count: (small: 3, medium: 4, large: 6), minHomeDistance: 5, neighbors: null),
    'dojo': (count: null, minHomeDistance: 6, neighbors: null),
    'clinic': (count: (small: 2, medium: 3, large: 4), minHomeDistance: 5, neighbors: null),
    'fortress': (count: (small: 2, medium: 3, large: 4), minHomeDistance: 6, neighbors: null),
    'cartel': (count: null, minHomeDistance: null, neighbors: 3),
    'mercs': (count: (small: 2, medium: 3, large: 4), minHomeDistance: 5, neighbors: null),
  },
);

// --- المعابد ومباني المرتزقة (GAME_SPEC 3.14، بطلب المستخدم، 2026-11-15؛ في التطبيق وحده، بإعداد المباراة 'temples') ---
// لكل مدينة: المعبد في الحي الأقرب للوسط، والمرتزقة في الحي الأقرب لكل زاوية من الأربع، وما بقي من مبانيها القديمة
// (extra) في الحي التالي للوسط. والمفاتيح الجديدة تُضاف إلى CITY_FEATURES (features: الأسماء والوصف والألوان والقيم والتجنيد)
const TEMPLES = <String, Object?>{
  // المدينة: [المعبد، المرتزقة]
  'cities': <String, Object?>{
    'yamamah': ['khan', 'bedouin'], 'arab': ['souk', 'swords'], 'shibam': ['awwam', 'village'], 'diriyah': ['salwa', 'knights'],
    'cairo': ['pyramid', 'futuwwa'], 'japan': ['sensoji', 'dojo'], 'china': ['heaven', 'kungfu'], 'hk': ['manmo', 'triads'],
    'jaipur': ['hawa', 'stable'], 'kaifeng': ['pagoda', 'clinic'], 'gyeongju': ['observatory', 'koreanCamp'],
    'europe': ['cathedral', 'inn'], 'norway': ['stave', 'hunters'], 'paris': ['arch', 'apache'], 'birmingham': ['clock', 'boys'],
    'rothenburg': ['policeHQ', 'watchinn'], 'gondar': ['debre', 'fortress'], 'kano': ['kanoGate', 'kanoCamp'],
    'meroe': ['amun', 'nubian'], 'mexico': ['catedral', 'vaquero'], 'chicago': ['bank', 'speakeasy'], 'rio': ['statue', 'capoeira'],
    'laboca': ['sanjuan', 'mercs'], 'tenoch': ['mayor', 'eagles'],
  },

  // حراس مباني المرتزقة المحايدون حتى تُحتل (إلا القرى والدوجو والحصن: لها حراسها)، بنوع أول ما تجنّده
  'guards': <String, Object?>{'count': 3, 'leash': 6, 'vanishSeconds': 5, 'name': 'المرتزقة', 'color': '#6b5a45',
    'hp': 1.25, 'kinds': <String, Object?>{'triads': 'triadGuard', 'clinic': 'doctor', 'hunters': 'trollHunter', 'mercs': 'blade'}},
  // ما تجنّده مباني المرتزقة القديمة إضافة لما تجنّده الآن
  'extraRecruits': <String, Object?>{'village': ['janbiya'], 'hunters': ['trollHunter']},
  // أماكن ثابتة مربعة (بالمربعات، وحولها شارع): المعبد في الوسط، والمرتزقة في الزوايا، وقواعد اللاعبين على دائرة
  // بأبعاد متساوية (نصف قطرها نسبة من الخريطة، من ringMax نزولاً حتى تتسع)، وما بقي من مبنى المدينة القديم بين قاعدتين
  'layout': <String, Object?>{'home': 4, 'temple': 3, 'merc': 3, 'extra': 3, 'ringMax': 0.40, 'ringMin': 0.20, 'ringStep': 0.01},
  // موجات قطاع الطرق ومتمردو الانقلاب يخرجون من مبانيهم ما لم يحتلها لاعب (من يحتلها يغلقها)
  'dens': <String, Object?>{'bandits': ['koreanCamp', 'kanoCamp'], 'coups': ['apache']},
  // مزايا المعابد الجديدة
  'awwam': <String, Object?>{'perVillage': 1.0},
  'sensoji': <String, Object?>{'ultCharge': 1.25},
  'hawa': <String, Object?>{'sight': 2.0},
  'pagoda': <String, Object?>{'armor': 0.1},
  'debre': <String, Object?>{'heal': 0.3},
  'amun': <String, Object?>{'bankIncome': 0.5},
  'catedral': <String, Object?>{'radius': 6, 'attackSpeed': 0.1},
  'mayor': <String, Object?>{'income': 3},
  'features': <String, Object?>{
    'names': <String, Object?>{
      'awwam': 'معبد أوام', 'sensoji': 'معبد سينسو-جي', 'heaven': 'معبد السماء', 'manmo': 'معبد مان مو', 'hawa': 'هوا محل',
      'pagoda': 'الباغودا الحديدية', 'stave': 'كنيسة الألواح', 'debre': 'كنيسة دبرا برهان', 'amun': 'معبد آمون',
      'catedral': 'الكاتدرائية الكبرى', 'sanjuan': 'كنيسة سان خوان', 'mayor': 'تمبلو مايور',
      'bedouin': 'مضارب البدو', 'swords': 'دار السيوف', 'knights': 'مجلس الفرسان', 'futuwwa': 'بيت الفتوات',
      'kungfu': 'دار الكونغ فو', 'koreanCamp': 'معسكر قطاع الطرق', 'inn': 'نُزل المرتزقة', 'apache': 'حانة الأباتشي',
      'boys': 'مصنع الفتيان', 'watchinn': 'نُزل الحارس الليلي', 'kanoCamp': 'معسكر قطاع الطرق', 'nubian': 'مخيم رماة النوبة',
      'vaquero': 'مزرعة الفاكيروس', 'speakeasy': 'الحانة السرية', 'capoeira': 'مدرسة الكابويرا', 'eagles': 'بيت النسر والجاغوار',
    },
    'desc': <String, Object?>{
      'awwam': 'معبد أوام: كل قرية يملكها مالكه تعطيه نقطة في الثانية', 'sensoji': 'معبد سينسو-جي: ضربات أبطال مالكه تُشحن أسرع 25%',
      'heaven': 'معبد السماء: الألعاب النارية لا تمس جنود مالكه', 'manmo': 'معبد مان مو: الإعصار لا يدفع جنود مالكه ولا يقصّر مداهم',
      'hawa': 'هوا محل: جنود مالكه يرون أبعد بمربعين في ضباب الحرب', 'pagoda': 'الباغودا الحديدية: درع جنود مالكه +10',
      'stave': 'كنيسة الألواح: الثلج لا يبطئ جنود مالكه', 'debre': 'كنيسة دبرا برهان: علاج معالجي مالكه ومستشفياته +30%',
      'amun': 'معبد آمون: دخل أحياء الضفة لمالكه +50%', 'catedral': 'الكاتدرائية الكبرى: جنود مالكه حولها يضربون أسرع 10%',
      'sanjuan': 'كنيسة سان خوان: جمهور الديربي لا يبطئ جنود مالكه', 'mayor': 'تمبلو مايور: 3 نقاط في الثانية، والكارتل حوله',
      'bedouin': 'مضارب البدو: يحرسها البدو، ومن يحتلها يجنّد قوّاسي البدو', 'swords': 'دار السيوف: من يحتلها يجنّد النفّاطين',
      'knights': 'مجلس الفرسان: من يحتله يجنّد القوّاسين', 'futuwwa': 'بيت الفتوات: من يحتله يجنّد أصحاب النبّوت',
      'kungfu': 'دار الكونغ فو: من يحتلها يجنّد معلّمي الكونغ فو', 'koreanCamp': 'معسكر قطاع الطرق: من يحتله يجنّدهم',
      'inn': 'نُزل المرتزقة: من يحتله يجنّد اللاندسكنخت', 'apache': 'حانة الأباتشي: من يحتلها يجنّد الأباتشي',
      'boys': 'مصنع الفتيان: من يحتله يجنّد فتيان سمول هيث', 'watchinn': 'نُزل الحارس الليلي: من يحتله يجنّد حاملي المطرد',
      'kanoCamp': 'معسكر قطاع الطرق: من يحتله يجنّد الملاكمين', 'nubian': 'مخيم رماة النوبة: من يحتله يجنّد رماة النوبة',
      'vaquero': 'مزرعة الفاكيروس: من يحتلها يجنّد محاربي النسر', 'speakeasy': 'الحانة السرية: من يحتلها يجنّد المحطِّمين',
      'capoeira': 'مدرسة الكابويرا: من يحتلها يجنّد راقصي الكابويرا', 'eagles': 'بيت النسر والجاغوار: من يحتله يجنّد محاربي الجاغوار',
    },
    'colors': <String, Object?>{
      'awwam': '235,200,130', 'sensoji': '232,70,86', 'heaven': '120,170,255', 'manmo': '255,120,90', 'hawa': '255,140,190',
      'pagoda': '170,150,140', 'stave': '200,150,100', 'debre': '150,214,96', 'amun': '255,206,84', 'catedral': '255,214,120',
      'sanjuan': '120,190,255', 'mayor': '47,190,175',
      'bedouin': '235,185,95', 'swords': '230,170,70', 'knights': '235,200,130', 'futuwwa': '225,140,80', 'kungfu': '255,105,60',
      'koreanCamp': '160,195,255', 'inn': '200,160,110', 'apache': '235,95,110', 'boys': '240,205,120', 'watchinn': '95,160,240',
      'kanoCamp': '225,140,80', 'nubian': '255,150,60', 'vaquero': '200,215,230', 'speakeasy': '120,230,150', 'capoeira': '140,230,120',
      'eagles': '150,214,96',
    },
    'botValue': <String, Object?>{
      'awwam': 3, 'sensoji': 3, 'heaven': 3, 'manmo': 3, 'hawa': 3, 'pagoda': 3, 'stave': 3, 'debre': 3, 'amun': 3, 'catedral': 3,
      'sanjuan': 3, 'mayor': 3,
      'bedouin': 2, 'swords': 2, 'knights': 2, 'futuwwa': 2, 'kungfu': 2, 'koreanCamp': 2, 'inn': 2, 'apache': 2, 'boys': 2,
      'watchinn': 2, 'kanoCamp': 2, 'nubian': 2, 'vaquero': 2, 'speakeasy': 2, 'capoeira': 2, 'eagles': 2,
    },
    // ما تجنّده مباني المرتزقة الجديدة
    'bedouin': <String, Object?>{'recruits': ['bedouinArcher']}, 'swords': <String, Object?>{'recruits': ['naffat']},
    'knights': <String, Object?>{'recruits': ['knightArcher']}, 'futuwwa': <String, Object?>{'recruits': ['nabboot']},
    'kungfu': <String, Object?>{'recruits': ['kungfuMaster']}, 'koreanCamp': <String, Object?>{'recruits': ['koreanBandit']},
    'inn': <String, Object?>{'recruits': ['landsknecht']}, 'apache': <String, Object?>{'recruits': ['apacheFighter']},
    'boys': <String, Object?>{'recruits': ['smallHeath']}, 'watchinn': <String, Object?>{'recruits': ['halberd']},
    'kanoCamp': <String, Object?>{'recruits': ['boxer']}, 'nubian': <String, Object?>{'recruits': ['nubianArcher']},
    'vaquero': <String, Object?>{'recruits': ['eagleWarrior']}, 'speakeasy': <String, Object?>{'recruits': ['crusher']},
    'capoeira': <String, Object?>{'recruits': ['capoeirista']}, 'eagles': <String, Object?>{'recruits': ['jaguar']},
    'recruits': <String, Object?>{
      'bedouinArcher': <String, Object?>{'name': 'قوّاس البدو', 'cost': 35, 'seconds': 7, 'nation': 'saudi', 'hero': 'sniper'},
      'naffat': <String, Object?>{'name': 'النفّاط', 'cost': 40, 'seconds': 8, 'nation': 'saudi', 'hero': 'firebomber'},
      'janbiya': <String, Object?>{'name': 'مقاتل الجنبية', 'cost': 15, 'seconds': 4, 'nation': 'yemen', 'hero': null},
      'knightArcher': <String, Object?>{'name': 'القوّاس', 'cost': 35, 'seconds': 7, 'nation': 'saudi', 'hero': 'sniper'},
      'nabboot': <String, Object?>{'name': 'صاحب النبّوت', 'cost': 45, 'seconds': 8, 'nation': 'egypt', 'hero': 'smasher'},
      'kungfuMaster': <String, Object?>{'name': 'معلّم الكونغ فو', 'cost': 45, 'seconds': 8, 'nation': 'china', 'hero': 'boss'},
      'koreanBandit': <String, Object?>{'name': 'قاطع طريق', 'cost': 15, 'seconds': 4, 'nation': 'korea', 'hero': null},
      'landsknecht': <String, Object?>{'name': 'لاندسكنخت', 'cost': 20, 'seconds': 5, 'nation': 'germany', 'hero': null},
      'trollHunter': <String, Object?>{'name': 'صياد الترول', 'cost': 50, 'seconds': 9, 'nation': 'germany', 'hero': 'smasher'},
      'apacheFighter': <String, Object?>{'name': 'أباتشي', 'cost': 15, 'seconds': 4, 'nation': 'france', 'hero': null},
      'smallHeath': <String, Object?>{'name': 'فتى سمول هيث', 'cost': 15, 'seconds': 4, 'nation': 'britain', 'hero': null},
      'halberd': <String, Object?>{'name': 'حامل المطرد', 'cost': 40, 'seconds': 8, 'nation': 'germany', 'hero': 'armored'},
      'boxer': <String, Object?>{'name': 'الملاكم', 'cost': 40, 'seconds': 8, 'nation': 'nigeria', 'hero': 'smasher'},
      'nubianArcher': <String, Object?>{'name': 'رامي النوبة', 'cost': 35, 'seconds': 7, 'nation': 'sudan', 'hero': 'sniper'},
      'eagleWarrior': <String, Object?>{'name': 'محارب النسر', 'cost': 40, 'seconds': 8, 'nation': 'mexico', 'hero': 'firebomber'},
      'crusher': <String, Object?>{'name': 'المحطِّم', 'cost': 45, 'seconds': 8, 'gang': 'hammers', 'hero': 'smasher'},
      'capoeirista': <String, Object?>{'name': 'راقص الكابويرا', 'cost': 40, 'seconds': 8, 'nation': 'brazil', 'hero': 'dual'},
      'jaguar': <String, Object?>{'name': 'محارب الجاغوار', 'cost': 40, 'seconds': 8, 'nation': 'mexico', 'hero': 'sniper'},
      'triadGuard': <String, Object?>{'name': 'مقاتل الترياد', 'cost': 0, 'seconds': 0, 'nation': 'china', 'hero': 'boss'},
    },
  },
};

// المدينة ← (المعبد، المرتزقة) للمولّد
final TEMPLES_CITIES = <String, (String, String)>{
  for (final e in (TEMPLES['cities'] as Map<String, Object?>).entries) e.key: ((e.value as List)[0] as String, (e.value as List)[1] as String),
};
