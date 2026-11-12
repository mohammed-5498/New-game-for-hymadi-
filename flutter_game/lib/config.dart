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

// --- إيقاع الرسم في التطبيق (2.0.4، للتطبيق وحده): 60 إطاراً مع اللمس وتحرك الكاميرا والقتال الظاهر وجنودك المحددين
// يمشون، و30 بعد activeMs بلا شيء منها، وخلفية القوائم 20. الإيقاف والنهاية GRAPHICS.idleFps وتوفير البطارية batteryFps ---
const PACE = (calmFps: 30.0, activeMs: 2000, menuFps: 20.0);

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
