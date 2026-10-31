// ===================================================================
// كل الأرقام القابلة للموازنة في اللعبة موجودة هنا فقط.
// ممنوع كتابة أرقام الموازنة داخل منطق اللعبة.
// ===================================================================

// --- حلقة اللعبة ---
export const TICK_MS = 50;              // 20 تحديثاً في الثانية
export const TICK_SEC = TICK_MS / 1000;

// --- المربع في العالم (نسبة 2:1) ---
export const TILE_HALF_W = 18;  // نصف عرض المربع
export const TILE_HALF_H = 9;   // نصف ارتفاع المربع

// --- أحجام الخريطة ---
// (بطلب المستخدم، القسم 3.12: مساحتها أكبر 50% من 26 و34 و42 مربعاً للضلع)
export const MAP_SIZES = {
  small:  { key: 'small',  name: 'صغيرة',  n: 32, maxPlayers: 4, specialDistricts: 2, policeStations: 2 },
  medium: { key: 'medium', name: 'متوسطة', n: 42, maxPlayers: 6, specialDistricts: 3, policeStations: 3 },
  large:  { key: 'large',  name: 'كبيرة',  n: 51, maxPlayers: 8, specialDistricts: 4, policeStations: 4 }
};

// --- طوابع المدن (القسم 3.9): شكل فقط، لا تغيّر قواعد اللعب ---
export const CITIES = {
  // مدن الأمم (القسم 3.10) تُضاف بعد المدن العشر: شبام والدرعية والقاهرة القديمة (الدفعة العربية)،
  // ثم كايفنغ وغيونغجو (الدفعة الآسيوية). إيدو هي المدينة اليابانية نفسها بمعلم جديد (المفتاح japan)،
  // ثم باريس وبرمنغهام وروتنبورغ (الدفعة الأوروبية)، ثم غوندر وكانو ومروي (الدفعة الأفريقية)،
  // ثم ريو ولا بوكا وتينوتشتيتلان (الدفعة اللاتينية؛ المكسيكية الاستعمارية mexico تبقى للعصابات الكلاسيكية)
  order: ['yamamah', 'arab', 'japan', 'china', 'europe', 'norway', 'hk', 'jaipur', 'mexico', 'chicago',
          'shibam', 'diriyah', 'cairo', 'kaifeng', 'gyeongju', 'paris', 'birmingham', 'rothenburg',
          'gondar', 'kano', 'meroe', 'rio', 'laboca', 'tenoch'],
  defaultCity: 'random',
  // ماء على حافة الخريطة بهذا العرض من المربعات (لا يُمشى عليه): مضيق النرويجية المتجمد، وقناتا كايفنغ وبرمنغهام،
  // ونيل مروي، وميناء لا بوكا، وبحيرة تينوتشتيتلان. huts: المباني المجاورة للماء أكواخ على أعمدة (النرويجية وحدها)
  water: { norway: { small: 2, medium: 2, large: 3, huts: true },
           kaifeng: { small: 2, medium: 2, large: 3 },
           birmingham: { small: 2, medium: 2, large: 3 },
           meroe: { small: 2, medium: 2, large: 3 },
           laboca: { small: 2, medium: 2, large: 3 },
           tenoch: { small: 2, medium: 2, large: 3 } },
  rorbuChance: 0.55,            // نسبة المباني المجاورة للماء التي تصير أكواخاً على أعمدة
  // أسماء قصيرة لأزرار قائمة الإعداد (الاسم الكامل تحت الصورة المصغرة)
  short: { yamamah: 'اليمامة', arab: 'عربية', japan: 'إيدو', china: 'صينية', europe: 'أوروبية', norway: 'نرويجية',
           hk: 'هونغ كونغ', jaipur: 'جايبور', mexico: 'مكسيكية', chicago: 'شيكاغو',
           shibam: 'شبام', diriyah: 'الدرعية', cairo: 'القاهرة', kaifeng: 'كايفنغ', gyeongju: 'غيونغجو',
           paris: 'باريس', birmingham: 'برمنغهام', rothenburg: 'روتنبورغ', gondar: 'غوندر', kano: 'كانو', meroe: 'مروي',
           rio: 'ريو', laboca: 'لا بوكا', tenoch: 'تينوتشتيتلان' },
  thumbCycleMs: 2000,           // "عشوائي": الصورة المصغرة تتبدل بين المدن
  thumbZoom: 1.4,               // تقريب الصورة المصغرة (تُقص الأطراف)
  thumbParticles: 0.4,          // صور لوحة الطقس: ندف الثلج وخطوط المطر بهذه النسبة من عددها في شاشة المباراة
  cardZoom: 1.5,                // خانات لوحة المدن: وسط الصورة المصغرة مكبّراً بهذا القدر (المباني أوضح)
  // هالة خفيفة خلف الجنود: فاتحة في المدينة الداكنة (هونغ كونغ)، وداكنة في الصحراء الفاتحة (اليمامة)
  // حتى يبقى الجنود الصفر والبرتقاليون واضحين فوق الرمل والبيوت الفاتحة
  unitHalo: { hk: { color: 'rgba(255,255,255,0.28)', rx: 5.5, ry: 9, lift: 8 },
              yamamah: { color: 'rgba(58,38,16,0.2)', rx: 5.5, ry: 9, lift: 8 } },
  // المدن المفتوحة (بطلب المستخدم): شوارع أعرض ومستقيمة بأرصفة وممرات مشاة، والمباني صفوف مرتبة
  // بينها ممرات مرصوفة (أرض يمشي عليها الجنود، موصولة بالشارع من طرفيها)
  // street: عرض الشارع بالمربعات، spacing: قيم المسافة بين بدايتي شارعين (5 و7 ← أحياء 3 و5 مربعات)
  // lanes: 'rows' ممر بين كل صفين، 'center' ممر واحد في وسط الحي (أكثف)، 'lots' كل مبنى في قطعته
  // scale: حجم رسم المبنى العادي (المباني الحاسمة بحجمها الكامل)، أقل من 1 تظهر الأرض بين المباني
  // roadProp: false يخفي علامات الطابع على الشارع (خطوط شيكاغو تتقاطع مع خط منتصف الشارع العريض)
  // roundabout: دوار في التقاطع الأقرب لمركز الخريطة، radius نصف قطر حلقته بالمربعات
  // مدينة بسور (صحراء اليمامة): سور حجري بأقواس على الحافتين البعيدتين وبوابات حيث تخرج الشوارع،
  // وسور منهار منخفض على الحافتين القريبتين (لا يحجب الجنود)، وأبراج على الزوايا وكل towerEvery مربعاً
  // archChance: نسبة الشوارع الخارجة من الحافتين القريبتين التي يقوم فوقها قوس قديم
  walls: { yamamah: { towerEvery: 6, archChance: 0.6 } },
  open: {
    chicago: { street: 2, spacing: [5, 7], lanes: 'center', scale: 1, roadProp: false },
    hk:      { street: 2, spacing: [5, 7], lanes: 'center', scale: 1, roundabout: { radius: 3 } },
    europe:  { street: 2, spacing: [5, 6, 7], lanes: 'rows', scale: 0.86 },
    // شبام (بطلب المستخدم): نفس توسعة شيكاغو وهونغ كونغ، وأشجار رصيفها نخيل صغير (openCity.js)
    shibam:  { street: 2, spacing: [5, 7], lanes: 'center', scale: 1 },
    // باريس وروتنبورغ (بطلب المستخدم): توسعة هونغ كونغ بدوارها، وكثافة أقل (ممر بين كل صفين ومبانٍ أصغر)،
    // ودوار كل مدينة بطابعها: مسلة بين نافورتين في باريس، ونافورة السوق بتمثالها في روتنبورغ (openCity.js)
    paris:      { street: 2, spacing: [5, 7], lanes: 'rows', scale: 0.86, roundabout: { radius: 3 } },
    rothenburg: { street: 2, spacing: [5, 7], lanes: 'rows', scale: 0.86, roundabout: { radius: 3 } }
  }
};

// مناطق قائمة الإعداد (بطلب المستخدم): المدن والأمم مرتبة حسب المنطقة، لكل منطقة تبويب وخانة خاصة
// (js/ui/picker.js). cities: مدن أمم المنطقة أولاً ثم بقية المدن بطابعها، nations: أمم المنطقة.
// المدينة أو الأمة التي لا تظهر في أي منطقة تُجمع في تبويب "أخرى" فلا تختفي من القائمة
export const REGIONS = {
  order: ['arabic', 'asian', 'european', 'african', 'american'],
  arabic:   { name: 'العربية', cityTitle: 'المدن العربية', nationTitle: 'العصابات العربية',
              cities: ['shibam', 'diriyah', 'cairo', 'yamamah', 'arab'], nations: ['yemen', 'saudi', 'egypt'] },
  asian:    { name: 'الآسيوية', cityTitle: 'المدن الآسيوية', nationTitle: 'العصابات الآسيوية',
              cities: ['kaifeng', 'japan', 'gyeongju', 'china', 'hk', 'jaipur'], nations: ['china', 'japan', 'korea'] },
  european: { name: 'الأوروبية', cityTitle: 'المدن الأوروبية', nationTitle: 'العصابات الأوروبية',
              cities: ['paris', 'birmingham', 'rothenburg', 'europe', 'norway'], nations: ['france', 'britain', 'germany'] },
  african:  { name: 'الأفريقية', cityTitle: 'المدن الأفريقية', nationTitle: 'العصابات الأفريقية',
              cities: ['gondar', 'kano', 'meroe'], nations: ['ethiopia', 'nigeria', 'sudan'] },
  american: { name: 'الأمريكتان', cityTitle: 'مدن الأمريكتين', nationTitle: 'عصابات الأمريكتين',
              cities: ['rio', 'laboca', 'tenoch', 'mexico', 'chicago'], nations: ['brazil', 'argentina', 'mexico'] },
  classic:  { name: 'الكلاسيكية', nationTitle: 'العصابات الكلاسيكية' },   // تبويب العصابات الأربع في اختيار الأمة
  other:    { name: 'أخرى', cityTitle: 'مدن أخرى', nationTitle: 'عصابات أخرى' }
};

// أنواع من pool المدن ليست مباني (أشجار وزينة): لا تُصبغ بلون المالك، كأشجار الطابع القديم
// والسور وبواباته وأبراجه في صحراء اليمامة: ملك المدينة لا الحي
export const CITY_UNTINTED = ['palm', 'cherry', 'lantern', 'willow', 'lanterns', 'pine', 'rack', 'banyan', 'neem', 'cactus', 'tree',
  'ptree', 'rtree', 'lamp', 'acacia', 'baobab', 'dye', 'crane', 'chinampa', 'ahuejote',
  'grove', 'well', 'cart', 'wallI', 'wallJ', 'gateI', 'gateJ', 'archI', 'archJ', 'wallTower', 'brokenI', 'brokenJ', 'brokenTower',
  'monument'];   // معلم المنطقة وسط المدينة (generator.js: placeMonument): ملك المدينة لا الحي

// تخزين الطبقة الثابتة (الأرض والمباني والزينة) في قطع مخفية: تُرسم مرة وتُعرض الظاهرة فقط
export const CITY_CACHE = {
  chunkWorld: 128,               // ضلع القطعة بوحدات العالم (المربع 36×18)
  scales: [0.75, 1.1, 1.6, 2.4, 3.6, 5.4],   // دقات الرسم (بكسل لكل وحدة)؛ تُختار حسب التقريب
  scaleSlack: 0.85,              // تُقبل دقة أقل من المطلوب بهذا القدر قبل الانتقال للأعلى
  maxPixels: 20e6,               // أقصى مجموع بكسلات القطع المخزنة (≈ 80 ميغابايت)، والأقدم يُحذف
  frameBudgetMs: 6,              // وقت رسم القطع في الإطار الواحد (على دفعات: لا قطعة كاملة في إطار واحد)
  warmScale: 2.4,                // بداية المباراة: الظاهر يُرسم أولاً بهذه الدقة الأقل، ثم يُرفع تدريجياً
  warmBudgetMs: 14,              // وقت تجهيز المدينة في كل إطار عند بداية المباراة (لا تتقدم المباراة حتى تكتمل)
  warmMaxMs: 2500,               // أقصى انتظار لتجهيز المدينة قبل أن تبدأ المباراة على أي حال
  prefetchRing: 1,               // حلقة قطع حول الشاشة تُرسم مسبقاً بالوقت الفائض
  baseScale: 0.75,               // خريطة الأرض الكاملة منخفضة الدقة: بديل مؤقت حتى تُرسم القطعة
  tintSteps: 3,                  // إعادة رسم القطعة أثناء انتقال لون المالك على 3 مراحل فقط
  reach: { side: 40, up: 110, down: 22 },  // ما قد يرسمه المربع حول مركزه (المباني ترتفع للأعلى)
  // الوحدة خلف مبنى أمامها تختفي خلفه: قصاصة المبنى من صورة المدينة تُلصق فوقها (occlusion.js)
  occlusion: {
    enabled: true,               // للقياس فقط: false يرسم الوحدات فوق كل شيء
    side: 38, down: 14,          // أقصى ما يرسمه المبنى حول مركز مربعه يميناً ويساراً وتحته (المبنى المميز 2×2 حتى 36)
    alphaCut: 160,               // البكسل أعتم من هذا يُعد من المبنى عند قياس حدوده (من 255)
    unitSide: 7.5, unitUp: 21, unitDown: 4,  // صندوق الفرد العادي حول قدميه (الجسم والسلاح وشريط الدم)، ويكبر مع حجم الوحدة
    maxPixels: 8e6,              // أقصى مجموع بكسلات القصاصات المخزنة، والأقدم يُحذف
    budgetMs: 2                  // وقت قياس المباني وصنع قصاصات جديدة في الإطار الواحد
  }
};

// المباني الحاسمة بطراز كل مدينة: hq أعلى مبانيها للمقر، وbase مبناها العادي للشرطة والمستشفى والمخزن
export const CITY_SPECIALS = {
  yamamah: { hq: 'tower',   base: 'house' },
  arab:    { hq: 'tall',    base: 'house' },
  japan:   { hq: 'two',     base: 'house' },
  china:   { hq: 'tower2',  base: 'hutong' },
  europe:  { hq: 'row',     base: 'row' },
  norway:  { hq: 'long',    base: 'wood' },
  hk:      { hq: 'tower',   base: 'shop' },
  jaipur:  { hq: 'haveli2', base: 'haveli' },
  mexico:  { hq: 'balcony', base: 'adobe' },
  chicago: { hq: 'brick',   base: 'warehouse' },
  // مدن الأمم العربية: المقر أعلى مبانيها، والمباني الحاسمة على مبنى المدينة العادي
  shibam:  { hq: 'tower',   base: 'towerLow' },
  diriyah: { hq: 'najdiTall', base: 'najdi' },
  cairo:   { hq: 'house',   base: 'wikala' },
  // مدن الأمم الآسيوية (إيدو هي japan أعلاه)
  kaifeng:  { hq: 'tea',      base: 'shop' },
  gyeongju: { hq: 'hanokBig', base: 'hanok' },
  // مدن الأمم الأوروبية
  paris:      { hq: 'haus',    base: 'haus' },
  birmingham: { hq: 'factory', base: 'terrace' },
  rothenburg: { hq: 'row',     base: 'fach' },
  // مدن الأمم الأفريقية
  gondar: { hq: 'stone',     base: 'stone' },
  kano:   { hq: 'hausaTall', base: 'hausa' },
  meroe:  { hq: 'nubian',    base: 'nubian' },
  // مدن الأمم اللاتينية
  rio:    { hq: 'colonial', base: 'colonial' },
  laboca: { hq: 'conv',     base: 'conv' },
  tenoch: { hq: 'house',    base: 'house' }
};

// --- الكاميرا ---
export const CAMERA = {
  minZoom: 0.8,
  maxZoom: 4.5,
  startZoom: 2.2,
  wheelStep: 1.12,      // مقدار التكبير بعجلة الماوس

  // ارتجاجة خفيفة جداً عند الضربات المميزة وحدها (القسم 5.2)
  shake: {
    pixels: 3,          // أقصى إزاحة بالبكسل
    seconds: 0.15,      // مدة الارتجاجة
    minGapSeconds: 1    // لا تتكرر أكثر من مرة كل ثانية مهما تعددت الضربات
  }
};

// --- اللمس ---
export const INPUT = {
  tapMovePx: 8,                 // أقل من هذا يُعتبر لمسة سريعة لا سحباً
  unitTapRadiusPx: 22,          // دقة اللمس على وحدة
  doubleTapMs: 300,             // أقصى مدة بين نقرتين لتُحسبا نقرة مزدوجة
  doubleTapSlackPx: 44,         // تسامح مكان النقرة الثانية حول الجندي (الإصبع لا يصيب بدقة)
  groupSelectRadiusTiles: 5,    // نصف قطر تحديد المجموعة حول الجندي بالنقر المزدوج
  longPressMs: 500              // ضغطة مطوّلة على الأرض = أمر هجوم متحرك
};

// --- توليد الخريطة ---
export const MAP_GEN = {
  streetSpacingMin: 4,        // المسافة بين خطي شارع
  streetSpacingMax: 6,
  bendChance: 0.10,           // احتمال انحراف الشارع مربعاً واحداً
  alleysPerSmallMap: 40,      // عدد الأزقة على خريطة 26×26 (يتناسب مع المساحة)
  alleyLength: 2,
  minDistrictTiles: 4,        // أقل من هذا: ليس حياً قابلاً للاستيلاء
  minHomeDistrictTiles: 6,    // أقل حجم لحي منزلي
  homeRingRadiusPct: 0.40,    // نصف قطر دائرة توزيع الأحياء المنزلية
  specialCenterRadiusPct: 0.38, // الأحياء المميزة قرب المركز
  captureRadius: 1.5,         // نصف قطر منطقة الاستيلاء بالمربعات
  maxTries: 40,               // محاولات التوليد قبل الاستسلام

  // إصلاح الفراغات المعزولة (القسم 3.4.1)
  pocketRepairRounds: 3,      // أقصى عدد مرات لإعادة الـ flood fill والإصلاح
  pocketFillType: 'H',        // الفراغ الذي لا يمكن وصله يُردم بهذا المبنى
  protectedBuildings: ['Q', 'S', 'G', 'C', 'O', 'N', 'F', 'f', '~', 'Y'],  // لا تُفتح لعمل ممر (مقر، مستشفى، مخزن، ساعة، نافورة، مركز شرطة، مبنى ميزة المدينة وكتلته، ماء، جزيرة الدوار)
  devChecks: true             // وضع التطوير: يطبع تحذيراً إن بقي مربع معزول
};

// --- الوحدة الأساسية المرجعية (القسم 6.1 من الوصف) ---
export const UNIT_BASE = {
  hp: 100,
  armor: 0,            // نسبة تخفيض الضرر
  damage: 10,
  attackTime: 1.0,     // ثانية
  attackRange: 1.0,    // مربع
  visionRange: 4,      // مربعات
  speed: 2.2,          // مربع/ثانية
  capturePower: 1
};

// --- العصابات: الفرد العادي وشخصيتاها المميزتان ---
export const GANGS = {
  crows:     { id: 'crows',     name: 'الغربان',  heroes: ['spear', 'dual'],     unit: { speed: 2.5, capturePower: 1.5 } },
  hammers:   { id: 'hammers',   name: 'المطارق',  heroes: ['armored', 'smasher'], unit: { hp: 120, armor: 0.15 } },
  // الأفاعي يرمون حجارة من بعيد، ويقاتلون بالأيدي إذا اقترب العدو
  vipers:    { id: 'vipers',    name: 'الأفاعي',  heroes: ['sniper', 'firebomber'], unit: {
    damage: 7, attackTime: 1.4, attackRange: 3.5, visionRange: 4.5,
    projectile: 'stone', meleeRange: 1.5, meleeDamage: 8, meleeAttackTime: 1.0
  } },
  scorpions: { id: 'scorpions', name: 'العقارب',  heroes: ['boss', 'medic'],     unit: { spawnMultiplier: 0.8 } }
};

export const GANG_IDS = ['crows', 'hammers', 'vipers', 'scorpions'];

// --- الأنماط الأربعة: حجر وورقة ومقص (القسم 3.12، بطلب المستخدم) ---
// النمط من عصابة الوحدة (unit.gang): الخاطف crows، الصامد hammers، الرامي vipers، الحشد scorpions.
// مزايا لا تقوية: كل نمط يغلب نمطاً واحداً (beats) بضرر +counter. والمخلوقات (الترول والفيل) خارجها
export const STYLE_PERKS = {
  soldierDamage: 0.8,            // ضرر كل الجنود (والشرطة والأطراف المحايدة) أضعف 20%، لا المخلوقات ولا الأبراج
  soldierHeal: 0.6,              // وعلاجهم (الطبيب والهالة والضربات المميزة) أضعف 40%: بأقل منها يلغي العلاجُ الضررَ في معارك الحشد فلا يموت أحد
  beats: { crows: 'hammers', hammers: 'vipers', vipers: 'crows' },
  counter: 0.2,                  // +20% ضرراً على النمط الذي يغلبه
  pierce: 0.2,                   // الخاطف يتجاوز 20% من درع الصامد
  shotGuard: 0.2,                // الصامد يتلقى من المقذوفات (السهام والحجارة والأبراج) 20% أقل
  shotSpeed: 0.35,               // مقذوفات الرامي تطير أسرع 35%
  fireRate: 0.25,                // والرامي يرمي أسرع 25%
  // الحشد: إنتاجه في القاعدة أسرع 30%، وضرره أكبر كلما اجتمع: عدد أفراده من لاعبه داخل radius مربع (معه نفسه)
  horde: { production: 0.3, radius: 3, tiers: [[14, 0.15], [9, 0.10], [6, 0.05]] }
};

// --- الشخصيات المميزة: شخصيتان لكل عصابة ---
// كل شخصية تبدأ من الوحدة الأساسية ثم تُطبق قيمها فوقها
export const HEROES = {
  // الغربان
  spear: {
    id: 'spear', name: 'حامل الرمح', gang: 'crows',
    // مدى 1.8 مربع: يطعن من الصف الثاني من خلف رفاقه
    stats: {
      hp: 150, damage: 12, attackTime: 1.3, attackRange: 1.8, visionRange: 4.5, speed: 2.2,
      // طعنة قاضية: ضعف الضرر وتخترق أول عدوين في خط الطعنة
      ult: { kind: 'pierce', needs: 'enemy', range: 1.8, damage: 24, targets: 2 }
    }
  },
  dual: {
    id: 'dual', name: 'المزدوج', gang: 'crows',
    // يتسارع في الاشتباك: كل ضربة متتالية على نفس الهدف تقصّر زمن الضربة
    stats: {
      hp: 95, damage: 7, attackTime: 0.8, speed: 2.6,
      combo: { step: 0.12, maxStacks: 4, minAttackTime: 0.5, resetSeconds: 2, sameTarget: true },
      // وابل: 4 ضربات متتالية خلال ثانية واحدة
      ult: { kind: 'flurry', needs: 'enemy', range: 1.0, hits: 4, damage: 7, duration: 1 }
    }
  },

  // المطارق
  armored: {
    id: 'armored', name: 'المصفّح', gang: 'hammers',
    // تصلّب: لا يتلقى أي ضرر لمدة 3 ثوانٍ
    stats: {
      hp: 320, armor: 0.50, damage: 8, attackTime: 1.2, speed: 1.6,
      ult: { kind: 'harden', needs: 'enemy', duration: 3 }
    }
  },
  smasher: {
    id: 'smasher', name: 'المحطِّم', gang: 'hammers',
    // ضربته تصيب كل الأعداء داخل دائرة نصف قطرها مربع واحد حول الهدف
    stats: {
      hp: 200, armor: 0.20, damage: 28, attackTime: 2.2, attackRange: 1.2, speed: 1.8, splashRadius: 1,
      // ضربة أرضية: 60 ضرراً لكل عدو داخل 2.5 مربع مع إبطائهم
      ult: { kind: 'slam', needs: 'enemy', radius: 2.5, damage: 60, slow: 0.30, slowDuration: 2 }
    }
  },

  // الأفاعي (زمن الضربة القريبة غير مذكور في الوصف، فيبقى على الأساس 1.0 ث)
  sniper: {
    id: 'sniper', name: 'القناص', gang: 'vipers',
    stats: {
      hp: 80, damage: 26, attackTime: 2.5, attackRange: 7, visionRange: 7.5, speed: 2.0,
      projectile: 'arrow', meleeRange: 1.5, meleeDamage: 4, meleeAttackTime: 1.0,
      // طلقة بعيدة: مدى 10 مربعات وضرر 55
      ult: { kind: 'shot', needs: 'enemy', range: 10, damage: 55 }
    }
  },
  firebomber: {
    id: 'firebomber', name: 'رامي النار', gang: 'vipers',
    // الزجاجة لا تضر مباشرة، بل تشعل الأرض
    stats: {
      hp: 90, damage: 0, attackTime: 5, attackRange: 4, visionRange: 4.5, speed: 2.1,
      projectile: 'bottle', fire: { radius: 1.2, duration: 4, damagePerSecond: 6 },
      meleeRange: 1.5, meleeDamage: 5, meleeAttackTime: 1.0,
      // حريق أكبر: دائرة 2.5 مربع لمدة 7 ثوانٍ بـ 12 دم/ث
      ult: { kind: 'fire', needs: 'enemy', range: 4, fire: { radius: 2.5, duration: 7, damagePerSecond: 12 } }
    }
  },

  // العقارب
  boss: {
    id: 'boss', name: 'الزعيم', gang: 'scorpions',
    stats: {
      hp: 160, armor: 0.10, damage: 12, speed: 2.0, aura: { radius: 3, damageBonus: 0.20 },
      // توحّش: الحلفاء داخل 3 مربعات +50% ضرر و+20% سرعة ضرب لمدة 5 ثوانٍ
      ult: { kind: 'buff', needs: 'enemy', radius: 3, damageBonus: 0.50, attackSpeedBonus: 0.20, duration: 5 }
    }
  },
  medic: {
    id: 'medic', name: 'الطبيب', gang: 'scorpions',
    stats: {
      hp: 100, damage: 5, speed: 2.2, heal: { radius: 3, perSecond: 10 },
      // علاج جماعي: 60 دماً دفعة واحدة لكل حليف داخل 2.5 مربع
      ult: { kind: 'heal', needs: 'ally', radius: 2.5, heal: 60 }
    }
  }
};

// --- القتال الواقعي (القسم 5.4) ---
// منقولة كما هي من CR في docs/combat-reference.html.
// المسافات هناك بالبكسل (مربع = 30 بكسل)، وهنا كلها بالمربعات مباشرة.
export const COMBAT_REALISM = {
  dodgeBase: 0.18,             // احتمال التفادي الأساسي
  blockBase: 0.35,             // احتمال الصدّ (لأصحاب الدروع وحدهم)
  projectileDodge: 0.5,        // المقذوف يُتفادى بنصف الاحتمال ولا يُصَدّ

  stMax: 100,                  // التحمّل
  stRegen: 20,                 // تجدد التحمّل في الثانية
  dodgeCost: 35,
  blockCost: 25,
  dodgeCd: 1.2,                // تبريد التفادي

  frontHalf: 60 * Math.PI / 180,    // أمام: ±60° (قوس 120°)
  sideHalf: 120 * Math.PI / 180,    // جانب: حتى ±120°، وما بعدها خلف
  angleMul: { front: 1, side: 0.5, back: 0 },      // فرصة التفادي حسب الزاوية
  dmgMul:   { front: 1, side: 1.10, back: 1.25 },  // الضرر حسب الزاوية

  dodgeDist: 0.8,              // مربعات تقطعها القفزة الجانبية
  dodgeTime: 0.30,
  blockTime: 0.30,
  staggerBump: 0.30,           // ترنّح الحليف الذي اصطدمت به وحدة مرتدة
  staggerBlocked: 0.25,        // ترنّح المهاجم بعد أن يُصَدّ
  jitter: 0.15,                // عشوائية نقاط اختيار الحركة

  // بذرة الشخصية: لكل وحدة قيمة ثابتة بين هذين الحدين
  traits: {
    aggr: [0.7, 1.3],          // الجرأة: تقصّر الفاصل بين الضربات وتحبّب الضربة القوية
    dodgeSkill: [0.7, 1.3],    // مهارة التفادي والصدّ
    react: [0.10, 0.35],       // زمن رد الفعل بالثواني
    spd: [0.93, 1.07],         // تنويع سرعة المشي
    size: [0.96, 1.04]         // تنويع الحجم في الرسم
  },

  // الحركات الأربع. أزمنتها نسبية لا مطلقة:
  // زمن الحركة = زمن ضربة الوحدة (القسم 6) × مجموع أزمنة الحركة ÷ moveTimeBase.
  // moveTimeBase = 0.8 مختار حتى يبقى الضرر في الثانية كما كان قبل هذه المرحلة،
  // فأرقام القسم 6 لم تتغير: الضربة السريعة أسرع وأضعف، والقوية أبطأ وأقوى، ومحصلتهما واحدة.
  moveTimeBase: 0.8,
  moves: {
    quick:  { wind: 0.18, strike: 0.08, hold: 0.05, rec: 0.25, dmg: 0.7, rangeAdd: 0,   arc: 100, sAmp: 0.85, lunge: 0.8 },
    heavy:  { wind: 0.45, strike: 0.10, hold: 0.09, rec: 0.55, dmg: 1.6, rangeAdd: 0,   arc: 110, sAmp: 1.20, lunge: 1.25, stagger: 0.40, knock: 1.0, down: 0.3 },
    thrust: { wind: 0.30, strike: 0.07, hold: 0.06, rec: 0.35, dmg: 1.0, rangeAdd: 0.6, arc: 50,  sAmp: 0.60, lunge: 1.6 },
    spin:   { wind: 0.50, strike: 0.15, hold: 0.05, rec: 0.60, dmg: 0.8, rangeAdd: 0.2, arc: 360, sAmp: 1.10, lunge: 0.4 },
    // اللكمات والركلات (القسم 5.4.7): unarmed = بلا سلاح. push يدفع الهدف ليصنع مسافة، down احتمال إسقاطه أرضاً
    punch:      { wind: 0.12, strike: 0.06, hold: 0.04, rec: 0.20, dmg: 0.5, rangeAdd: -0.15, arc: 80, unarmed: true },
    kick_front: { wind: 0.24, strike: 0.08, hold: 0.06, rec: 0.30, dmg: 0.9, rangeAdd: 0.3,   arc: 70, push: 1.1, unarmed: true },
    kick_high:  { wind: 0.36, strike: 0.10, hold: 0.08, rec: 0.45, dmg: 1.3, rangeAdd: 0.2,   arc: 80, stagger: 0.35, knock: 0.9, down: 0.45, unarmed: true }
  },
  downTime: 1.1,               // السقوط على الأرض ثم النهوض بالركوع: لا يهاجم ولا يتفادى
  comboChance: 0.55,           // بعد لكمة أو ركلة أمامية: يُتبعها بضربة سلاح فوراً
  comboPause: 0.04,
  primaryBonus: 1.0,           // مكافأة نقاط لحركة الوحدة الأساسية (طعنة حامل الرمح)
  pauseMin: 0.10,              // الفاصل بعد التعافي، مقسوماً على الجرأة
  pauseRandom: 0.25,
  strikeMoment: 0.6,           // لحظة الضرر داخل زمن الضرب
  reachBonus: 0.33,            // تسامح مدى عند لحظة الضربة (مربعات)
  arcTolerance: 0.35,          // تسامح زاوية القوس (راديان)
  aimTolerance: 0.6,           // لا تبدأ الضربة قبل أن يقترب وجهها من الهدف (راديان)
  turnWhileAttacking: 2,       // أثناء الضربة يدور الجميع ببطء واحد: من يضرب لا يتابعك

  friction: 8,                 // تباطؤ الارتداد في الثانية
  bumpSpeed: 2.0,              // أقل سرعة ارتداد تصطدم بالحليف (مربع/ثانية)
  bumpCd: 0.4,                 // تبريد الاصطدام للوحدة نفسها
  corpseBumpCd: 0.2,
  corpseKnockBig: 1.4,         // دفع الجثة بضربة قوية أو دائرية (مربعات)
  corpseKnockSmall: 0.6,
  maxRagdolls: 20,             // أقصى عدد جثث متدحرجة في وقت واحد

  // ارتداد خفيف مرئي مع كل ضربة عادية: لا يقطع هجوم المصاب (القسم 5.4.4ب)
  flinchTime: 0.2,
  flinchKnock: 0.15,           // مربعات
  duckChance: 0.55,            // التلويح والقوية: احتمال الانحناء بدل القفز
  duckSpeed: 0.3,              // الانحناء يتحرك قليلاً فقط

  // تصادم الأسلحة: متقابلان يضربان في نفس اللحظة تقريباً
  clashChance: 0.6,
  clashWindow: 0.08,           // ثانية
  clashKnock: 0.45,            // مربعات
  clashStagger: 0.2,

  // الكلمات الطائرة فوق الأحداث
  pops: {
    seconds: 1.1,
    max: 40,                   // أقصى عدد ظاهر معاً (الأقدم يُحذف)
    colors: { dodge: '#b8f0a8', block: '#8fd0ff', back: '#ff8a7a', bump: '#ffd66e', clash: '#ffe08a', down: '#ffffff',
              show: '#ffb3c2', bribe: '#9fe08a', miss: '#ecd39c', loot: '#ffd25a' }   // show: «استعراض!» (سمة اليابان)، bribe: «رُشي!» (القسم 3.10)، miss: «أخطأ!» (العاصفة الرملية، 3.11)، loot: نهب تاجر القافلة
  },
  clashFxSeconds: 0.3,         // شرر التصادم
  burstSeconds: 0.22,          // نجمة الانفجار عند الارتطام (القسم 5.4.7)
  speedLinesAbove: 2.33,       // خطوط السرعة خلف كل وحدة أسرع من هذا (مربع/ث = 70 بكسل/ث في المرجع)
  speedLinesSimple: true,      // خطوط السرعة في المستوى المبسّط أيضاً (أول ما يُلغى إن ثقل الأداء بعد أثر الأطراف)
  pushFlinch: 1.4,             // الركلة الأمامية: ارتداد أطول من العادي

  // الرسم (القسم 5.4.6)
  // ساحة تجربة القتال (قائمة الإعداد): 7 غربان ضد 4 مطارق متقاربين
  arena: {
    crows: 7,
    hammers: [null, 'armored', null, 'smasher'],   // فرد، مصفّح، فرد، محطِّم
    gapTiles: 2.6,             // المسافة بين الصفين عند البداية
    zoom: 3.8,
    restartSeconds: 3.2        // بعد فناء أحد الطرفين تبدأ معركة جديدة
  },

  trailGhosts: 3,              // أشباح أثر السلاح في المستوى الكامل
  trailGhostsCrowded: 1,       // وحين يزدحم المشهد (أكثر من 60 وحدة ظاهرة): قيس مع 300 وحدة فكانت 3 أثقل بـ 13%
  combatPoseTiles: 2.6,        // داخل هذه المسافة من الهدف تقف الوحدة وقفة القتال

  busyBonus: 1.33,             // تفضيل الهدف المشغول بغيرنا (مربعات) × ميل الالتفاف
  crowdRadius: 1.6,            // نصف قطر عدّ الأعداء المحيطين (يحبّب الضربة الدائرية)
  nightReact: 0.10,            // ليلاً تتأخر كل الوحدات في رد الفعل (القسم 7)

  // مستويات التفصيل (القسم 5.4.5)
  lod: {
    fullUnits: 60,             // أقرب 60 وحدة داخل الشاشة: النظام كامل
    crowdedAbove: 800,         // إذا تجاوزت وحدات المباراة الحية هذا العدد...
    fullUnitsCrowded: 30,      // ...ينخفض حد المستوى الكامل إلى 30 (القسم 5.4.5)
    refreshSeconds: 0.5,       // إعادة حساب المستوى
    offScreenDamage: 0.85      // الضرر الإحصائي خارج الشاشة
  }
};

// --- الدوران والالتفاف والحركات لكل وحدة (القسمان 5.4.4ب و5.4) ---
// turn: سرعة الدوران راديان/ثانية — البطيء في الدوران يُلتف عليه.
// flank: ميل الالتفاف من 0 إلى 1.
// moves: الحركات التي تملكها. block: هل تصدّ بالدرع. primary: حركتها الأساسية.
// الرماة يُعرفون من stats.projectile: حركاتهم هذه للقتال القريب وحده.
export const COMBAT_STYLE = {
  gangs: {
    crows:     { turn: 8, flank: 0.85 },
    hammers:   { turn: 4, flank: 0.25 },
    vipers:    { turn: 6, flank: 0.50 },
    scorpions: { turn: 5, flank: 0.40 },
    police:    { turn: 4, flank: 0.20 }
  },
  units: {
    // من يملك ماذا (القسم 5.4.7): الغربان كل الحركات بما فيها الركلة العالية، والأبطال كل الحركات،
    // المطارق العاديون لكمة وركلة أمامية، المصفّح والمحطِّم ركلة أمامية فقط، الأفاعي والشرطة لكمة وركلة أمامية،
    // العقارب لكمة وركلتان.
    // الغربان: خفيفة سريعة الدوران، أكثر من يلتف
    crow_common:    { moves: ['quick', 'heavy', 'thrust', 'punch', 'kick_front', 'kick_high'] },
    crow_spear:     { moves: ['thrust', 'quick', 'heavy', 'punch', 'kick_front', 'kick_high'], primary: 'thrust' },
    crow_dual:      { moves: ['quick', 'heavy', 'punch', 'kick_front', 'kick_high'] },
    crow_champion:  { moves: ['quick', 'heavy', 'thrust', 'spin', 'punch', 'kick_front', 'kick_high'] },

    // المطارق: ثقيلة بطيئة الدوران، والمصفّح والمحطِّم أبطأ (turn 3)
    hammer_common:   { moves: ['quick', 'heavy', 'thrust', 'punch', 'kick_front'] },
    hammer_armored:  { moves: ['quick', 'heavy', 'kick_front'], block: true, turn: 3, flank: 0 },
    hammer_smasher:  { moves: ['quick', 'heavy', 'spin', 'kick_front'], turn: 3, flank: 0.1 },
    hammer_champion: { moves: ['quick', 'heavy', 'thrust', 'spin', 'punch', 'kick_front', 'kick_high'], block: true },

    // الأفاعي: رماة، وحركاتهم هذه للقتال القريب وحده
    viper_common:     { moves: ['quick', 'heavy', 'punch', 'kick_front'] },
    viper_sniper:     { moves: ['quick', 'thrust', 'punch', 'kick_front'] },
    viper_firebomber: { moves: ['quick', 'punch', 'kick_front'] },
    viper_champion:   { moves: ['quick', 'heavy', 'thrust', 'spin', 'punch', 'kick_front', 'kick_high'] },

    // العقارب
    scorpion_common:    { moves: ['quick', 'heavy', 'thrust', 'punch', 'kick_front', 'kick_high'] },
    scorpion_boss:      { moves: ['quick', 'heavy', 'punch', 'kick_front', 'kick_high'] },
    scorpion_medic:     { moves: ['quick', 'punch', 'kick_front', 'kick_high'] },
    scorpion_champion:  { moves: ['quick', 'heavy', 'thrust', 'spin', 'punch', 'kick_front', 'kick_high'] },

    // الشرطة: دروع تصدّ
    police_common:  { moves: ['quick', 'heavy', 'punch', 'kick_front'], block: true },
    police_captain: { moves: ['quick', 'heavy', 'thrust', 'punch', 'kick_front'], block: true }
  }
};

// --- أنميشن القتال حسب السلاح (القسم 5.4.8): رسم فقط، اللعب كما هو ---
// كل شخصية لها أسلوب حسب سلاحها، والحركة التي يختارها القتال (quick, heavy...) تُرسم كعقدة من شجرة تتابع
// أسلوبها: L1 → L2 → L3 للخفيفة، H1 للقوية، S1 للخاصة، D للاندفاع، F لإنهاء القائد، P لكمة، KF وKH ركلتان.
// لا يغيّر شيء هنا أزمنة الحركات ولا ضررها ولا اختيارها: كل الأرقام هنا للرسم.
export const FIGHT = {
  // الأسلوب لكل شخصية: الأمة أو العصابة ← النوع ← الأسلوب (knife سكين، blade سيف أو عصا بيد واحدة،
  // spear رمح أو عصا طويلة، hammer مطرقة أو هراوة ثقيلة، fists قبضات، shield درع، ranged سلاح الرامي باليد)
  weapons: {
    crows:     { common: 'knife', spear: 'spear', dual: 'knife', champion: 'spear' },
    hammers:   { common: 'hammer', armored: 'shield', smasher: 'hammer', champion: 'hammer' },
    vipers:    { common: 'knife', sniper: 'ranged', firebomber: 'ranged', champion: 'ranged' },
    scorpions: { common: 'blade', boss: 'blade', medic: 'fists', champion: 'spear' },
    police:    { common: 'blade', captain: 'blade' },
    yemen:     { common: 'knife', boss: 'knife', medic: 'fists', champion: 'blade' },
    saudi:     { common: 'ranged', sniper: 'ranged', firebomber: 'ranged', champion: 'ranged' },
    egypt:     { common: 'hammer', armored: 'shield', smasher: 'hammer', champion: 'blade' },
    china:     { common: 'blade', boss: 'hammer', medic: 'blade', champion: 'spear' },
    japan:     { common: 'blade', spear: 'spear', dual: 'blade', champion: 'blade' },
    korea:     { common: 'blade', sniper: 'ranged', firebomber: 'ranged', champion: 'ranged' },
    france:    { common: 'knife', spear: 'spear', dual: 'knife', champion: 'blade' },
    britain:   { common: 'hammer', armored: 'shield', smasher: 'fists', champion: 'blade' },
    germany:   { common: 'knife', armored: 'spear', smasher: 'blade', champion: 'spear' },
    ethiopia:  { common: 'blade', boss: 'blade', medic: 'fists', champion: 'spear' },
    nigeria:   { common: 'fists', armored: 'shield', smasher: 'fists', champion: 'fists' },
    sudan:     { common: 'fists', sniper: 'ranged', firebomber: 'ranged', champion: 'ranged' },
    brazil:    { common: 'blade', spear: 'spear', dual: 'fists', champion: 'spear' },
    argentina: { common: 'knife', spear: 'blade', dual: 'knife', champion: 'knife' },
    mexico:    { common: 'blade', sniper: 'ranged', firebomber: 'ranged', champion: 'ranged' }
  },
  big: { smasher: true, armored: true },   // العضو الضخم: أبطأ شكلاً وأثقل ارتطاماً، والقائد هو البطل (champion)

  // شجرة التتابع: الخفيفة التالية داخل النافذة تتقدم في سلسلة أسلوبها ثم تعود لأولها، وبعد الاندفاع D
  // أو اللكمة P أو القوية أو الخاصة تبدأ من L1 (اللكمة تفتح السلسلة فيليها L2). القوية H1 والخاصة S1 من أي عقدة.
  // light: الحركات التي تُعدّ خفيفة في هذا الأسلوب، dash: ما يصير اندفاعاً حين تصل الوحدة راكضة.
  // والقائد يزيد على سلسلة أسلوبه رابعة L4 (لفّة بركلة)
  // (الطعنة thrust خفيفة في كل الأساليب: هي أكثر ما يختاره القتال على مسافة الاشتباك المعتادة)
  styles: {
    knife:  { chain: ['L1', 'L2', 'L3'], light: ['quick', 'thrust'],          dash: ['quick', 'thrust'] },
    blade:  { chain: ['L1', 'L2', 'L3'], light: ['quick', 'thrust'],          dash: ['quick', 'thrust'] },
    spear:  { chain: ['L1', 'L2', 'L3'], light: ['quick', 'thrust'],          dash: ['quick', 'thrust'] },
    hammer: { chain: ['L1', 'L2', 'L3'], light: ['quick', 'thrust'],          dash: ['quick', 'thrust'] },
    fists:  { chain: ['L1', 'L2', 'L3'], light: ['punch', 'quick', 'thrust'], dash: ['quick', 'thrust', 'punch'] },
    shield: { chain: ['L1', 'L2', 'L3'], light: ['quick', 'thrust'],          dash: ['quick', 'thrust'] },
    ranged: { chain: ['L1', 'L2', 'L3'], light: ['quick', 'thrust'],          dash: ['quick', 'thrust'] }
  },
  special: ['spin', 'kick_high', 'kick_front'],   // الخاصة S1: أول ما تملكه الوحدة من هذه
  window: 0.7,          // نافذة التتابع: ثوانٍ بعد نهاية الحركة تكمل فيها التالية السلسلة
  dashWindow: 0.3,      // تقدّمت نحو هدفها خلال هذا قبل الضربة...
  dashMin: 0.25,        // ...وكان تقدّمها أطول من هذا: الضربة اندفاع D
  finisherHp: 0.25,     // القائد: ضربته القوية أو الخاصة والهدف تحت 25% من دمه = ضربة الإنهاء F

  // التجمّد عند الارتطام (Hitstop): يتجمّد الضارب في وضعية الارتطام ويرتجف المُصاب، ثم يكمل الضارب أسرع قليلاً
  // فينتهي في وقته تماماً. بالثواني للضربة الخفيفة، مضروباً في نوع الحركة، وأطول للعضو الضخم
  hitstop: { knife: 0.03, blade: 0.045, spear: 0.055, hammer: 0.085, fists: 0.065, shield: 0.06, ranged: 0.04 },
  hitstopMul: { light: 1, dash: 1.15, punch: 0.9, kick_front: 1.2, kick_high: 1.4, heavy: 1.7, special: 1.5, finisher: 2.3 },
  hitstopBig: 1.35,
  hitstopMax: 0.2,
  quake: { tiles: 1.8, seconds: 0.32, pixels: 1.1 },   // اهتزاز الأرض حول ارتطام المطرقة والعضو الضخم (لا الكاميرا)
  // مزج الوضعيات عند تبدّل الحالة، فلا قفزة إلى الوقفة: بداية ضربة، العودة للوقفة أو المشي بعدها، رد الفعل
  blend: { swing: 0.06, rest: 0.2, react: 0.06, walk: 0.14 }
};

// --- الضربات المميزة: قواعد الشحن (القسم 6.7) ---
// الأفراد العاديون لا يملكون ضربة مميزة، فلا شريط شحن لهم
export const ULT = {
  max: 100,                // شريط الشحن من 0 إلى 100
  castSeconds: 1.0,        // زمن حركة الضربة المميزة، وتأثيرها عند 47% منها
                           // (ثابت لكل الوحدات: زمن ضربة رامي النار 5 ث لا يصلح للضربة)
  perSecond: 3,            // شحن تلقائي في الثانية
  perHit: 8,               // عن كل ضربة تُصيب
  championPerSecond: 2,    // الأبطال أبطأ
  championPerHit: 6,
  perDamageChunk: 5,       // عن كل 50 ضرراً تتلقاه
  damageChunk: 50
};

// --- الأبطال: بطل واحد لكل عصابة (القسم 6.6) ---
// الرسم فقط في المرحلة 2؛ قواعد الظهور والقدرات في المرحلة 4
export const CHAMPIONS = {
  crows: {
    id: 'crow_hero', name: 'بطل الغربان', gang: 'crows',
    // يتسارع مع طول الاشتباك: 8% لكل ضربة حتى نصف الزمن
    stats: {
      hp: 260, armor: 0.10, damage: 18, attackTime: 1.2, attackRange: 2.2, speed: 2.5,
      combo: { step: 0.08, minFactor: 0.5, resetSeconds: 3, sameTarget: false },
      // ضربات قاضية متعددة: كل الأعداء داخل قوس أمامه بنصف قطر 2.5
      ult: { kind: 'arc', needs: 'enemy', radius: 2.5, damage: 36 }
    }
  },
  hammers: {
    id: 'hammer_hero', name: 'بطل المطارق', gang: 'hammers',
    stats: {
      hp: 420, armor: 0.40, damage: 26, attackTime: 1.8, attackRange: 1.2, speed: 1.7,
      // تصلّب + ضربة أرضية معاً
      ult: { kind: 'slam', needs: 'enemy', radius: 3, damage: 70, harden: 3 }
    }
  },
  vipers: {
    id: 'viper_hero', name: 'بطل الأفاعي', gang: 'vipers',
    // ثلاثة سهام في الطلقة الواحدة، كل سهم 12 ضرراً
    stats: {
      hp: 240, armor: 0, damage: 12, attackTime: 2.2, attackRange: 6.5, visionRange: 7, speed: 2.0,
      projectile: 'arrow', arrows: 3,
      // ثلاثة سهام نارية: كل سهم 20 ضرراً ويشعل بقعة صغيرة
      ult: {
        kind: 'arrows', needs: 'enemy', range: 6.5, arrows: 3, damage: 20,
        fire: { radius: 1, duration: 4, damagePerSecond: 8 }
      }
    }
  },
  scorpions: {
    id: 'scorp_hero', name: 'بطل العقارب', gang: 'scorpions',
    // قائد وطبيب معاً: هالة واحدة تعطي الحلفاء الضرر والعلاج
    stats: {
      hp: 280, armor: 0.15, damage: 16, attackTime: 1.3, attackRange: 1.0, speed: 2.1,
      aura: { radius: 3.5, damageBonus: 0.25, healPerSecond: 4 },
      // تحفيز وعلاج معاً: +50% ضرر لمدة 5 ثوانٍ و60 دماً فورياً
      ult: { kind: 'buff', needs: 'either', radius: 3.5, damageBonus: 0.50, duration: 5, heal: 60 }
    }
  }
};

// --- الأمم (القسم 3.10، docs/NATIONS.md) ---
// الأمة = نمط قتالي (عصابة كلاسيكية بقواعدها في GANGS وHEROES وCHAMPIONS كما هي تماماً)
// + سمة وطنية واحدة + مظهر واسم لكل وحدة + ضربة بطل خاصة + مدينة. والعصابات الأربع تبقى "كلاسيكية".
// حقول الأمة:
//   name اسم البلد، gangName اسم العصابة (يظهر في شريط القوة وشاشة النهاية)، style النمط (مفتاح في GANGS)،
//   city مدينتها (مفتاح في CITIES، لخيار "مدينة المضيف")، secondary لونها الثانوي (في الإكسسوارات فقط)،
//   names أسماء الوحدات بمفاتيح النمط: common، والشخصيتان المميزتان (مثل boss وmedic)، وchampion،
//   trait السمة: name وdesc وmods (معدِّلات، كلها اختيارية):
//     homeDamageTaken: نسبة تُطرح من الضرر الذي تتلقاه وحداتك داخل أحيائك
//     homeDamage:      نسبة تُضاف إلى ضرر وحداتك داخل أحيائك
//     vision:          مربعات تُضاف إلى مدى رصد كل وحداتك
//     rangedRange:     مربعات تُضاف إلى مدى كل وحدة ترمي من بعيد
//     adjacentCapture: نسبة تُضاف إلى سرعة الاستيلاء على حي مجاور لحي تملكه
//     brothers:        {radius, perHero, max} كل شخصية مميزة حية تعطي الأفراد حولها نسبة ضرر (الصين)
//     showoff:         {idle, bonus, pop} أول ضربة بعد مدة بلا هجوم أقوى (اليابان)
//     weatherProof:    الرماة لا يتأثرون بالليل ولا بالمطر (كوريا)
//     kicks:           {damage, prefer} الركلات أقوى وتُختار أكثر (فرنسا)
//     commonArmor:     درع يُضاف إلى الأفراد العاديين (بريطانيا)
//     heavyStagger:    نسبة تُضاف إلى زمن ترنّح الضربة القوية (بريطانيا)
//     phalanx:         {count, radius, reduce} ضرر متلقى أقل في المجموعة الكبيرة (ألمانيا)
//     outnumbered:     {radius, bonus} ضرر أكبر حين يفوقك الأعداء عدداً حولك (إثيوبيا)
//     punches:         {damage, stagger, staggerTime} اللكمات أقوى وقد ترنّح (نيجيريا)
//     armorAll:        درع يُضاف إلى كل الوحدات (نيجيريا)
//     rangedDamage:    نسبة تُضاف إلى ضرر رمي الرماة (السودان)
//     dodge:           نقاط تُضاف إلى فرصة التفادي الأساسية (البرازيل: 0.18 ← 0.26)
//     capture:         نسبة تُضاف إلى سرعة الاستيلاء على أي حي (البرازيل)
//     duel:            {radius, bonus, clash} ضرر أكبر حين لا عدو حولك غير خصم واحد، وتصادم أسلحة أكثر (الأرجنتين)
//     slowShots:       {factor, duration} كل مقذوف يصيب يُبطئ المصاب (المكسيك)
//   heroMods (اختياري): معدِّلات شخصية مميزة واحدة بمفتاحها، خارج السمة:
//     slowHits:        {factor, duration} ضربتها القريبة تُبطئ المصاب (غاوتشو الأرجنتين)
//   ult ضربة البطل الخاصة: تحل محل ضربة بطل النمط، وبقية أرقام البطل كما هي.
//     ring (اختياري): لون حلقة تتسع حول مكان الضربة
// "داخل أحيائك": منطقة الحي هي مربعاته ومعها الشوارع الأقرب إليه (game/nations.js).
export const nations = {
  order: ['yemen', 'saudi', 'egypt', 'china', 'japan', 'korea', 'france', 'britain', 'germany',
          'ethiopia', 'nigeria', 'sudan', 'brazil', 'argentina', 'mexico'],   // الأمم المتاحة في قائمة الإعداد، دفعةً دفعة (القسم 5 من NATIONS.md)

  // ===== الدفعة العربية (المرحلة 9أ) =====
  yemen: {
    name: 'اليمن', gangName: 'أبناء سبأ', style: 'scorpions', city: 'shibam', secondary: '#2f3f7a',   // نيلي
    names: { common: 'مقاتل الجنبية', boss: 'شيخ الجنبية', medic: 'العطّار', champion: 'ملكة سبأ' },
    trait: { name: 'أبراج الطين', desc: 'وحداتك داخل أحيائك تأخذ ضرراً أقل 15%', mods: { homeDamageTaken: 0.15 } },
    // نداء القوافل: يظهر 3 أفراد فوراً حولها (ضمن الحد الأقصى للوحدات)، حين يكون عدو داخل radius
    ult: { kind: 'caravan', needs: 'enemy', radius: 4, count: 3, spread: 2,
           name: 'نداء القوافل', desc: 'يظهر 3 أفراد فوراً حولها' }
  },
  saudi: {
    name: 'السعودية', gangName: 'حراس القوافل', style: 'vipers', city: 'diriyah', secondary: '#c0392b',   // أحمر الشماغ
    names: { common: 'رامي المقلاع', sniper: 'القوّاس', firebomber: 'النفّاط', champion: 'الصقّار' },
    trait: { name: 'عين الصقر', desc: 'مدى الرصد +2 مربع، والرماة +0.5 مربع مدى', mods: { vision: 2, rangedRange: 0.5 } },
    // انقضاض الصقر: على أبعد عدو داخل range، ولا يُتفادى. زمن الطيران flightMin + flightPerTile × المسافة
    // (حتى flightMax)، ويعود الصقر إلى ساعد الصقّار بنفس الزمن
    ult: { kind: 'falcon', needs: 'enemy', range: 9, damage: 80, flightMin: 0.45, flightPerTile: 0.06, flightMax: 0.95,
           name: 'انقضاض الصقر', desc: 'الصقر ينقضّ على أبعد عدو بضرر كبير' }
  },
  egypt: {
    name: 'مصر', gangName: 'فتوات الحارة', style: 'hammers', city: 'cairo', secondary: '#e6d7bc',   // بيج الجلابية
    names: { common: 'الفتوة', armored: 'حامل الدرع', smasher: 'صاحب النبّوت الكبير', champion: 'كبير الفتوات' },
    trait: { name: 'رجالة الحارة', desc: '+20% ضرر داخل أحيائك، والاستيلاء على الحي المجاور لحيك أسرع 15%',
             mods: { homeDamage: 0.20, adjacentCapture: 0.15 } },
    // صيحة الحارة: كل حليف داخل radius (ومعه الكبير) يصمد duration ثانية بلا ترنّح ولا سقوط
    ult: { kind: 'shout', needs: 'enemy', radius: 3.5, duration: 3,
           name: 'صيحة الحارة', desc: 'كل فتوة حوله يصمد 3 ثوانٍ بلا ترنّح ولا سقوط' }
  },

  // ===== الدفعة الآسيوية (المرحلة 9ب) =====
  china: {
    name: 'الصين', gangName: 'إخوة الجبل', style: 'scorpions', city: 'kaifeng', secondary: '#3f8f6a',   // أخضر يشمي
    names: { common: 'فتى الجبل', boss: 'شيخ العصا', medic: 'الطبيب الجوال', champion: 'زعيم ليانغشان' },
    // الـ108: كل شخصية مميزة حية (لا البطل) تعطي الأفراد العاديين من لاعبها داخل radius نسبة perHero ضرراً، بحد أقصى max
    trait: { name: 'الـ108', desc: 'كل شخصية مميزة حية تعطي الأفراد حولها +3% ضرر، بحد أقصى +15%',
             mods: { brothers: { radius: 3, perHero: 0.03, max: 0.15 } } },
    // راية الأخوة: تحفيز وعلاج معاً لكل حليف داخل radius (بأرقام ضربة بطل الحشد)، وحلقة بلون ring حوله
    ult: { kind: 'buff', needs: 'either', radius: 3.5, damageBonus: 0.50, duration: 5, heal: 60, ring: '#7fd48a',
           name: 'راية الأخوة', desc: 'علاج وزيادة ضرر لكل حليف في دائرة حوله' }
  },
  japan: {
    name: 'اليابان', gangName: 'الكابوكيمونو', style: 'crows', city: 'japan', secondary: '#b8283a',   // قرمزي
    names: { common: 'كابوكيمونو', spear: 'حامل الغليون', dual: 'مبارز السيفين', champion: 'زعيم الكابوكيمونو' },
    // الاستعراض: أول ضربة بعد idle ثانية بلا هجوم تضرّ أكثر بنسبة bonus، وتظهر فوقها كلمة pop
    trait: { name: 'الاستعراض', desc: 'أول ضربة بعد 3 ثوانٍ بلا هجوم تُحدث +40% ضرر',
             mods: { showoff: { idle: 3, bonus: 0.40, pop: 'استعراض!' } } },
    // رقصة الشارع: hits ضربة متتالية خلال duration ثانية، كل ضربة على كل عدو داخل radius (لفّة في كل ضربة)
    ult: { kind: 'whirl', needs: 'enemy', radius: 2, hits: 4, damage: 8, duration: 1,
           name: 'رقصة الشارع', desc: 'سلسلة ضربات سريعة على كل من حوله' }
  },
  korea: {
    name: 'كوريا', gangName: 'الهوارانغ', style: 'vipers', city: 'gyeongju', secondary: '#e07a9a',   // وردي زهري
    names: { common: 'فتى الهوارانغ', sniper: 'الرامي الدقيق', firebomber: 'رامي السهام المشتعلة', champion: 'قائد الهوارانغ' },
    // weatherProof: الرماة لا يقصر رصدهم ليلاً ولا تخطئ رمياتهم في المطر
    trait: { name: 'رماية الهوارانغ', desc: 'الرماة لا يتأثرون بالليل ولا بالمطر، و+0.5 مربع مدى',
             mods: { rangedRange: 0.5, weatherProof: true } },
    // مطر السهام: arrows سهماً على دائرة نصف قطرها area حول أكثف تجمع للأعداء داخل range،
    // كل سهم يضر كل عدو داخل hitRadius من سقوطه (لا يُتفادى)، وتصل خلال flight + حتى spreadSeconds
    ult: { kind: 'rain', needs: 'enemy', range: 7, arrows: 12, area: 1.6, damage: 12, hitRadius: 0.7,
           flight: 0.55, spreadSeconds: 0.45, ring: '#e07a9a',
           name: 'مطر السهام', desc: 'وابل من السهام على مساحة' }
  },

  // ===== الدفعة الأوروبية (المرحلة 9ب) =====
  france: {
    name: 'فرنسا', gangName: 'الأباتشي', style: 'crows', city: 'paris', secondary: '#c22f2f',   // أحمر المنديل
    names: { common: 'أباتشي', spear: 'مقاتل العصا', dual: 'الراقص المقاتل', champion: 'ملك الأباتشي' },
    // السافات: الركلتان (الأمامية والعالية) تضرّان أكثر بنسبة damage، وتزيد نقاط اختيارهما prefer (تُختاران أكثر)
    trait: { name: 'السافات', desc: 'الركلات +25% ضرراً وتُختار أكثر', mods: { kicks: { damage: 0.25, prefer: 0.3 } } },
    // رقصة الأباتشي: أقرب عدو داخل range يتلقى damage ويُقذف throw مربعاً ويسقط أرضاً
    ult: { kind: 'throwdown', needs: 'enemy', range: 1.6, damage: 45, throw: 2.2,
           name: 'رقصة الأباتشي', desc: 'يقذف خصمه ويسقطه أرضاً' }
  },
  britain: {
    name: 'بريطانيا', gangName: 'فتيان سمول هيث', style: 'hammers', city: 'birmingham', secondary: '#3a3a3e',   // رمادي فحمي
    names: { common: 'فتى سمول هيث', armored: 'حامل غطاء البرميل', smasher: 'صاحب القبضة', champion: 'زعيم الحي' },
    // معاطف الصوف: الأفراد العاديون +commonArmor درع، وترنّح الضربة القوية لوحداتك أطول بنسبة heavyStagger
    trait: { name: 'معاطف الصوف', desc: 'الأفراد العاديون +10% درع، والضربة القوية ترنّح أطول 25%',
             mods: { commonArmor: 0.10, heavyStagger: 0.25 } },
    // رشوة الشرطي (مبسّطة): الشرطة داخل radius منه لحظة الضربة لا تهاجم وحداتك ولا تهاجمها وحداتك duration ثانية
    ult: { kind: 'bribe', needs: 'police', radius: 7, duration: 10,
           name: 'رشوة الشرطي', desc: 'الشرطة القريبة تتجاهل وحداتك 10 ثوانٍ' }
  },
  germany: {
    name: 'ألمانيا', gangName: 'اللاندسكنخت', style: 'hammers', city: 'rothenburg', secondary: '#d9a83a',   // أصفر ذهبي
    names: { common: 'لاندسكنخت', armored: 'حامل الرمح الطويل', smasher: 'حامل السيف ذي اليدين', champion: 'حامل الراية' },
    // الكتيبة: الوحدة التي حولها داخل radius (ومعها نفسها) count من وحدات لاعبها فأكثر تأخذ ضرراً أقل بنسبة reduce
    trait: { name: 'الكتيبة', desc: 'وحداتك في مجموعة من 6 فأكثر تأخذ ضرراً أقل 12%',
             mods: { phalanx: { count: 6, radius: 2.5, reduce: 0.12 } } },
    // غرس الراية (مبسّطة): الراية تُغرس مكانه duration ثانية، وكل حليف داخل radius منها يصمد بلا ترنّح ولا سقوط ولا دفع
    ult: { kind: 'banner', needs: 'enemy', radius: 3, duration: 8,
           name: 'غرس الراية', desc: 'منطقة لا يتراجع منها أحد' }
  },

  // ===== الدفعة الأفريقية (المرحلة 9ب) =====
  ethiopia: {
    name: 'إثيوبيا', gangName: 'أبطال عدوة', style: 'scorpions', city: 'gondar', secondary: '#2e8b57',   // أخضر الحواف (مع الأصفر والأحمر)
    names: { common: 'محارب عدوة', boss: 'قارع النقارة', medic: 'المعالج', champion: 'الراس' },
    // روح عدوة: الوحدة التي حولها داخل radius أعداء أكثر من وحدات لاعبها وحلفائه (ومعها نفسها) تضرّ أكثر بنسبة bonus
    trait: { name: 'روح عدوة', desc: 'حين يفوقك الأعداء عدداً حولك، ضررك +18%',
             mods: { outnumbered: { radius: 3, bonus: 0.18 } } },
    // هجوم عدوة: حين يكون عدو داخل range، كل حليف داخل radius منه أسرع بنسبة bonus مدة duration ثانية
    ult: { kind: 'haste', needs: 'enemy', range: 6, radius: 4, bonus: 0.30, duration: 5, ring: '#e8c23a',
           name: 'هجوم عدوة', desc: 'اندفاع جماعي بسرعة +30%' }
  },
  nigeria: {
    name: 'نيجيريا', gangName: 'مقاتلو الدمبي', style: 'hammers', city: 'kano', secondary: '#24325e',   // نيلي كانو الداكن
    names: { common: 'مقاتل الدمبي', armored: 'حارس السور', smasher: 'الملاكم الثقيل', champion: 'بطل الدمبي' },
    // اليد الملفوفة: اللكمة تضرّ أكثر بنسبة damage، وترنّح المصاب staggerTime ثانية باحتمال stagger؛ ودرع كل الوحدات +armorAll
    trait: { name: 'اليد الملفوفة', desc: 'اللكمات +35% ضرراً وفرصة ترنّح، والدرع +10%',
             mods: { punches: { damage: 0.35, stagger: 0.3, staggerTime: 0.3 }, armorAll: 0.10 } },
    // الضربة القاضية: لكمة على أقرب عدو داخل range بضرر damage تقذفه throw مربعاً وتسقطه أرضاً
    ult: { kind: 'knockout', needs: 'enemy', range: 1.4, damage: 60, throw: 2.6,
           name: 'الضربة القاضية', desc: 'لكمة تقذف وتُسقط' }
  },
  sudan: {
    name: 'السودان', gangName: 'رماة النوبة', style: 'vipers', city: 'meroe', secondary: '#c98a3a',   // ذهبي مغرة
    names: { common: 'فتى النوبة', sniper: 'الرامي الطويل', firebomber: 'رامي المشاعل', champion: 'الكنداكة' },
    // أرض القوس: الرماة +rangedRange مربع مدى، وضرر رميهم +rangedDamage
    trait: { name: 'أرض القوس', desc: 'الرماة +1 مربع مدى و+10% ضرر', mods: { rangedRange: 1, rangedDamage: 0.10 } },
    // وابل الملكة: arrows سهماً لا تُتفادى، كل سهم على عدو مختلف حول الهدف إن وُجد، بضرر damage
    ult: { kind: 'arrows', needs: 'enemy', range: 7.5, arrows: 6, damage: 22,
           name: 'وابل الملكة', desc: 'ستة سهام دفعة واحدة على الأعداء' }
  },

  // ===== الدفعة اللاتينية (المرحلة 9ب) =====
  brazil: {
    name: 'البرازيل', gangName: 'المالتاس', style: 'crows', city: 'rio', secondary: '#f2efe6',   // أبيض الكابويرا
    names: { common: 'كابويرا الشارع', spear: 'عازف البيريمباو', dual: 'الأكروبات', champion: 'المعلّم' },
    // الجينغا: فرصة التفادي الأساسية +dodge، والركلات تُختار أكثر (prefer) بلا ضرر زائد، والاستيلاء أسرع بنسبة capture
    trait: { name: 'الجينغا', desc: 'فرصة التفادي +8%، والركلات أكثر، والاستيلاء أسرع 10%',
             mods: { dodge: 0.08, kicks: { damage: 0, prefer: 0.3 }, capture: 0.10 } },
    // الروضة: hits ركلات خلال duration ثانية، كل ركلة على كل عدو داخل radius (كرقصة الشارع، بالركل)
    ult: { kind: 'roda', needs: 'enemy', radius: 2, hits: 4, damage: 8, duration: 1.2,
           name: 'الروضة', desc: 'دائرة يرقص فيها ويركل كل من فيها' }
  },
  argentina: {
    name: 'الأرجنتين', gangName: 'الكومبادريتوس', style: 'crows', city: 'laboca', secondary: '#1e1e22',   // أسود التانغو
    names: { common: 'كومبادريتو', spear: 'الغاوتشو بالبولياداس', dual: 'المبارز بالشال', champion: 'المالِفو' },
    // مبارزة الفاكون: ضرر +bonus للوحدة التي لا عدو داخل radius حولها غير خصم واحد، واحتمال تصادم الأسلحة +clash
    trait: { name: 'مبارزة الفاكون', desc: '+20% ضرر في المواجهة الفردية، وتصادم الأسلحة أكثر',
             mods: { duel: { radius: 2.5, bonus: 0.20, clash: 0.25 } } },
    // الغاوتشو بالبولياداس: ضربته القريبة تُبطئ المصاب بنسبة factor مدة duration ثانية
    heroMods: { spear: { slowHits: { factor: 0.2, duration: 1.5 } } },
    // تانغو الموت: يدور بأقرب عدو داخل range ثم يطرحه: ضرر damage ويقذفه throw مربعاً ويسقطه أرضاً
    ult: { kind: 'tango', needs: 'enemy', range: 1.6, damage: 45, throw: 1.8,
           name: 'تانغو الموت', desc: 'يدور بخصمه ثم يطرحه أرضاً' }
  },
  mexico: {
    name: 'المكسيك', gangName: 'فرسان النسر والجاغوار', style: 'vipers', city: 'tenoch', secondary: '#2fa8a0',   // فيروزي
    names: { common: 'محارب التشينامبا', sniper: 'فارس الجاغوار الرامي', firebomber: 'رامي الأتلاتل', champion: 'قائد النسور' },
    // رمية الأتلاتل: كل مقذوف يصيب يُبطئ المصاب بنسبة factor مدة duration ثانية
    trait: { name: 'رمية الأتلاتل', desc: 'المقذوفات تُبطئ الهدف 20% لثانية ونصف',
             mods: { slowShots: { factor: 0.2, duration: 1.5 } } },
    // صيحة النسر: كهجوم عدوة، حين يكون عدو داخل range كل حليف داخل radius أسرع بنسبة bonus مدة duration ثانية
    ult: { kind: 'haste', needs: 'enemy', range: 7, radius: 5, bonus: 0.15, duration: 6, ring: '#2fa8a0',
           name: 'صيحة النسر', desc: 'كل وحداته حوله +15% سرعة' }
  },

  // الأنماط القتالية الأربعة (أسماؤها في قائمة الإعداد)
  // (ومزايا كل نمط على غيره في STYLE_PERKS)
  styles: {
    crows:     { name: 'الخاطف', desc: 'سرعة والتفاف واستيلاء سريع • يغلب الصامد: +20% ويخترق 20% من درعه' },
    hammers:   { name: 'الصامد', desc: 'دم ودرع وضربات ثقيلة • يغلب الرامي: +20%، والمقذوفات عليه أضعف 20%' },
    vipers:    { name: 'الرامي', desc: 'قتال من بعيد • يغلب الخاطف: +20%، ويرمي أسرع 25% بسهام أسرع' },
    scorpions: { name: 'الحشد',  desc: 'عدد وهالات ودعم • ينتج أسرع 30%، و+5/10/15% ضرراً إذا اجتمع 6/9/14' }
  },
  classicNote: 'كلاسيكية',       // السطر الصغير تحت العصابة الكلاسيكية في خانة اللاعب
  // آثار ضربات الأبطال: مدة الحلقة المتسعة وغبار ظهور الأفراد، وحلقة الصامدين تحت أقدامهم
  // rainArc: ارتفاع قوس سهام مطر السهام (بكسل) فتسقط من الأعلى، لا كالرمية العادية (COMBAT.projectileArc)
  // bribeRing: حلقة تحت الشرطي المرتشي، bribeColor: حلقة الرشوة حول البطل
  fx: { ringSeconds: 0.7, dustSeconds: 0.8, steadyRing: 'rgba(230,194,90,0.85)', rainArc: 30,
        bribeRing: 'rgba(120,200,110,0.9)', bribeColor: '#e8c56a' },
  noticeSeconds: 6               // إشعار سمة أمتك عند بداية المباراة
};

// --- مراكز الشرطة: طرف محايد معادٍ للجميع (القسم 3.8) ---
// لا تنتمي لأي لاعب ولا تستولي على حي، ولونها ثابت لا يتبع لاعباً
export const POLICE = {
  minHomeDistance: 6,         // لا مركز أقرب من هذا لحي منزلي
  produceSeconds: 10,         // شرطي كل 10 ثوانٍ
  maxPerStation: 6,           // أقصى عدد شرطة أحياء لكل مركز (عدا الضابط)
  captainRespawnSeconds: 40,  // الضابط لا يتكرر إلا بعد موته بـ 40 ثانية
  chaseTiles: 6,              // أقصى ابتعاد عن المركز قبل الرجوع
  vanishSeconds: 5,           // بعد الاستيلاء تختفي شرطة المركز خلال هذه المدة
  armorBonus: 0.10,           // +10% درع لوحدات المستولي ما دام يملك الحي
  armorBonusMax: 0.20,        // لا تتجمع أكثر من هذا مهما تعددت المراكز

  common: {
    name: 'شرطي',
    hp: 130, armor: 0.10, damage: 12, attackTime: 1.0, attackRange: 1.0, visionRange: 4.5, speed: 2.3,
    capturePower: 0,
    // صدّة بالدرع: ضرر ودفع مربعاً للخلف مع إبطاء
    ult: { kind: 'bash', needs: 'enemy', range: 1.0, damage: 18, push: 1, slow: 0.40, slowDuration: 1.5 }
  },
  captain: {
    name: 'ضابط',
    hp: 210, armor: 0.20, damage: 16, attackTime: 1.1, attackRange: 1.0, visionRange: 5, speed: 2.1,
    capturePower: 0,
    // نداء تعزيز: الشرطة داخل 3 مربعات +30% ضرر لمدة 5 ثوانٍ
    ult: { kind: 'buff', needs: 'enemy', radius: 3, damageBonus: 0.30, duration: 5 }
  }
};

// مكافآت الأحياء المميزة لمالكها (أنواع مختلفة تتجمع، ونفس النوع لا يتكرر)
export const SPECIAL_BONUS = {
  hospital: { zoneHealPerSecond: 5, globalHealPerSecond: 0.5 },
  armory:   { damageBonus: 0.10 },
  clock:    { spawnMultiplier: 0.85 }
};

// --- ألوان اللاعبين الثمانية ---
export const PLAYER_COLORS = [
  { id: 'blue',   name: 'أزرق',    hex: '#3b7dd8' },
  { id: 'red',    name: 'أحمر',    hex: '#d9463b' },
  { id: 'green',  name: 'أخضر',    hex: '#3fa34d' },
  { id: 'yellow', name: 'أصفر',    hex: '#e0b030' },
  { id: 'cyan',   name: 'سماوي',   hex: '#2fb5c0' },
  { id: 'purple', name: 'بنفسجي',  hex: '#8a5cc7' },
  { id: 'gray',   name: 'رمادي',   hex: '#8c8c8c' },
  { id: 'orange', name: 'برتقالي', hex: '#e07b2e' }
];

// --- الوحدات والحركة ---
export const UNITS = {
  startUnits: 3,              // عدد الأفراد عند بداية المباراة
  maxUnitsDefault: 100,
  separationRadius: 0.55,     // مسافة التباعد بين وحدتين (مربعات)
  separationStrength: 1.2,    // قوة دفع التباعد (مربع/ثانية)
  arriveDistance: 0.06,       // اعتبار الوحدة وصلت لنقطة المسار
  groupSpotsFactor: 2,        // عدد مربعات الهدف = عدد الوحدات × هذا الرقم
  pathRequestsPerTick: 20     // حد طلبات A* في التحديث الواحد
};

// --- القتال ---
export const COMBAT = {
  scanInterval: 0.25,        // ثانية بين كل بحث عن هدف في حالة الانتظار
  chaseVisionFactor: 1.5,    // حد المطاردة = مدى الرصد × هذا الرقم
  chaseMaxTiles: 6,          // أقصى ابتعاد عن مكان بدء المطاردة
  repathInterval: 0.5,       // إعادة حساب المسار نحو هدف متحرك
  rangeTolerance: 0.1,       // تسامح بسيط في قياس مدى الهجوم
  projectileMinTime: 0.3,    // زمن طيران المقذوف
  projectileMaxTime: 0.5,
  projectileArc: 6,          // ارتفاع قوس المقذوف أثناء الطيران
  missSpread: 1.0,           // بُعد سقوط الرمية الخاطئة عن الهدف (مربعات)
  multiShotSearch: 2.5,      // بحث بطل الأفاعي عن أهداف إضافية حول هدفه (مربعات)
  multiShotSpread: 0.45,     // تفرّق السهام الثلاثة عن بعضها (مربعات)
  pierceReachBonus: 0.6,     // امتداد خط الطعنة خلف الهدف الأول (مربعات)
  pierceWidth: 0.7,          // عرض خط الطعنة: من يبعد أكثر عنه لا يُصاب
  maxArmor: 0.90,            // سقف الدرع بعد جمع المكافآت حتى لا تصير الوحدة حصينة
  hitFlashTime: 0.10,        // وميض أبيض خفيف على المُصاب عند كل ضربة تصيب
  deathTime: 1.0,            // زمن سقوط الوحدة الميتة واختفائها
  hitMoment: 0.47,           // لحظة الارتطام من زمن الضربة (تطابق أنميشن docs/units-art.js)
  flankSteerTiles: 3         // داخل هذه المسافة تتقدم الوحدة مباشرة بلا A* (يلزم للالتفاف)
};

// --- الاستيلاء (تُستخدم في المرحلة 3) ---
export const CAPTURE = {
  pointsPerSecond: 8,         // × قوة الاستيلاء
  maxCapturePower: 6,
  decayPerSecond: 5,          // رجوع التقدم لحالة المالك عند خلو المنطقة
  groundTintAlpha: 0.30,      // نسبة صبغ أرض الحي بلون المالك
  roofTintAlpha: 0.45,        // الأسطح والأجزاء العلوية للمباني
  wallTintAlpha: 0.20,        // الجدران فقط، حتى تبقى قراءة المباني واضحة
  // الخلط في فضاء OKLab (colors.js): الإضاءة تقترب من لون المالك بالنسب أعلاه، ودرجة اللون أسرع بهذا الضعف
  // (أسطح 81% وجدران 36%): لون المالك نقي في كل المدن، لا زيتوني ولا باهت، وظلال المبنى كما هي
  tintChroma: 1.8,
  groundTintChroma: 1.0,      // الأرض أهدأ (درجة اللون بنسبة الخلط نفسها): لا تذوب فيها وحدات المالك بلونها نفسه
  // حدّ الحي بلون مالكه: خط مرسوم على أطراف الحي المطلة على الشارع (داخلها بمقدار inset)،
  // يُقرأ في كل مدينة مهما كانت ألوان مبانيها (الأحمر في جايبور وشيكاغو، والمدن الملونة)
  border: { width: 1.5, inset: 1.3, alpha: 0.95, under: 'rgba(24,18,12,0.45)', underWidth: 2.6 },
  tintSeconds: 0.5,           // زمن الانتقال اللوني عند تغيّر المالك
  tintSteps: 10,              // درجات الانتقال (تقليل عدد الألوان المخلوطة)
  noticeSeconds: 2.5,         // مدة ظهور إشعار الاستيلاء
  // علامة العلم (بطلب المستخدم): سهم ذهبي يلمع فوق كل علم استيلاء ودائرة ذهبية صغيرة حول قاعدته فيُرى العلم
  // في كل مدينة. السهم فوق طبقة الليل والمباني (يلمع: pulse)، والدائرة مع العلم في الطبقة الثابتة وتضيء ليلاً (light).
  // arrow: نصف عرض رأس السهم half (ولا يصغر على الشاشة عن
  // minScreen ÷ التقريب)، ورأسه فوق الأرض بـ lift، ويتمايل bob بسرعة bobSpeed. ring: نصفا قطري الدائرة
  // وعرضها. glow لون توهج السهم. pulseSpeed سرعة اللمعان، وpulseMin أخفت شدة له (0..1)
  flagMark: { color: '#ffd34d', outline: 'rgba(70,45,8,0.85)', glow: '255,205,70',
              // السهم بثلاث طبقات: توهج مكبَّر glowScale شفافيته glowAlpha × النبض، وحد داكن مكبَّر edgeScale، ثم الذهبي
              arrow: { half: 3.6, minScreen: 6, lift: 31, bob: 1.4, bobSpeed: 2.6, glowScale: 1.6, glowAlpha: 0.55, edgeScale: 1.22 },
              // الدائرة مرسومة مع العلم في الطبقة الثابتة: توهج عرضه glowWidth بشفافية glowAlpha، ثم خط ذهبي width
              ring: { rx: 7, ry: 3.5, width: 1.3, glowWidth: 3.6, glowAlpha: 0.4 },
              light: { r: 20, alpha: 0.45 },  // ضوء العلم ليلاً
              pulseSpeed: 3.2, pulseMin: 0.35 }
};

// --- الظهور ---
export const SPAWN = {
  normalBase: 14,             // max(4, 14 - (D-1)*1) ثانية
  normalPerDistrict: 1,
  normalMin: 4,
  heroBase: 75,               // max(30, 75 - (D-1)*3) ثانية
  heroPerDistrict: 3,
  heroMin: 30,
  spotSearchTiles: 6,         // عدد المربعات المفحوصة حول العلم لمكان الظهور

  // البطل خارج دورة الظهور تماماً (القسم 6.6)
  championRespawnSeconds: 60, // زمن عودة البطل بعد موته
  championMinDistricts: 5     // لا يعود إلا إذا ملك اللاعب هذا العدد من الأحياء
};

// --- الطقس: الشكل الآن، والتأثير على اللعب في المرحلة 7 ---
export const WEATHER = {
  day:   { key: 'day',   name: 'نهار',      overlay: null,                     particles: 0,   visionMul: 1,    speedMul: 1,    rangedHitChance: 1 },
  night: { key: 'night', name: 'ليل',       overlay: 'rgba(10,16,42,0.62)',    particles: 0,   visionMul: 0.75, speedMul: 1,    rangedHitChance: 1 },
  snow:  { key: 'snow',  name: 'ثلج',       overlay: 'rgba(225,235,245,0.12)', particles: 110, visionMul: 1,    speedMul: 0.85, rangedHitChance: 1 },
  rain:  { key: 'rain',  name: 'مطر خفيف',  overlay: 'rgba(45,60,80,0.30)',    particles: 150, visionMul: 1,    speedMul: 1,    rangedHitChance: 0.8 }
};

export const WEATHER_KEYS = ['day', 'night', 'snow', 'rain'];

// --- البوتات ---
export const BOT = {
  easy: {
    key: 'easy', name: 'سهل',
    decisionInterval: 4,      // ثانية بين كل قرار
    groupSize: 2,             // حجم المجموعة المرسلة
    attackArmy: 14,           // حجم الجيش اللازم قبل الهجوم (تهاجم متأخرة)
    defenseFactor: 1.0,       // عدد المدافعين لكل مهاجم
    focusTarget: false,       // تركيز كل الهجمات على هدف واحد
    retreatWounded: false,    // سحب المصابين إلى المستشفى
    rangedBehind: false,      // وضع الرماة خلف المقاتلين
    bossMinGroup: 0           // 0 = يرسل الزعيم مع أي مجموعة (بلا ذكاء)
  },
  medium: {
    key: 'medium', name: 'متوسط',
    decisionInterval: 2,
    groupSize: 3,
    attackArmy: 8,
    defenseFactor: 1.2,
    focusTarget: false,
    retreatWounded: false,
    rangedBehind: false,
    bossMinGroup: 0
  },
  hard: {
    key: 'hard', name: 'صعب',
    decisionInterval: 1,
    groupSize: 4,
    attackArmy: 6,
    defenseFactor: 1.5,
    focusTarget: true,
    retreatWounded: true,
    retreatHpRatio: 0.4,      // أقل من 40% دم: ينسحب للمستشفى
    rangedBehind: true,
    rangedOffset: 2,          // مربعات خلف المقاتلين
    bossMinGroup: 5           // الزعيم يخرج مع المجموعات الكبيرة فقط
  }
};

// المجنون (11.3): مثل الصعب وأسرع قراراً، ومعه مزايا إضافية غير عادلة
BOT.insane = {
  ...BOT.hard,
  key: 'insane', name: 'مجنون',
  decisionInterval: 0.5,
  note: 'يحصل على مزايا إضافية'
};

export const BOT_LEVELS = ['easy', 'medium', 'hard', 'insane'];

// --- ذكاء البوتات v2 (القسم 11) ---
export const ai = {
  // ما يملكه كل مستوى من الطبقتين (11.3). السهل يبقى بسلوكه القديم: أفراد بلا فرق.
  levels: {
    easy:   { squads: false },
    // retreat: الانسحاب، twoFronts: الجبهتان، raids: الإغارة على أحياء العدو الخالية،
    // protectRanged: حماية الرماة وتراجعهم، pullWounded: سحب المصابين (11.3: صعب فما فوق)
    medium: { squads: true, minSquad: 6,  focus: true, flank: true, smartUlts: 'partial',
              policeArmy: 8,
              responseRadius: 0,      // المتوسط يرى خريطة القوى وحدها (5 مربعات)، لا من يلحق للنجدة
              reinforce: false },   // ولا ينجد فرقه المشتبكة
    // الصعب فما فوق: يدافع عن حيه حين يصل العدو قرب نقطة استيلائه (3 مربعات)، لا حين يقف عدو في حيه المجاور،
    // وفرقة توسع صغيرة واحدة في وقت واحد (الباقون يتوسعون معاً) — بالقياس (5د-2)
    hard:   { squads: true, minSquad: 8,  focus: true, flank: true, smartUlts: 'full',
              retreat: true, twoFronts: true, raids: true, protectRanged: true, pullWounded: true,
              policeEarly: true,
              strictDefense: true, preferWeak: 3, threatRadius: 3, maxSmallSquads: 1 },
    insane: { squads: true, minSquad: 10, focus: true, flank: true, smartUlts: 'full',
              retreat: true, twoFronts: true, raids: true, protectRanged: true, pullWounded: true,
              policeEarly: true,
              strictDefense: true, preferWeak: 3, threatRadius: 3, maxSmallSquads: 1,
              spawnFactor: 0.75,       // ظهور أسرع 25% (زمن الظهور × 0.75)
              chargeFactor: 1.25,      // شحن الضربات أسرع 25%
              incomeFactor: 1.25 }     // ومع الاقتصاد: دخل النقاط أكثر 25% (الإنتاج الأسرع وحده لا يكفي: النقاط هي الحد)
  },

  // الطبقة الاستراتيجية (11.1)
  powerRadius: 5,             // نصف قطر خريطة القوى حول كل حي
  unitValue: { unit: 1, hero: 3, champion: 5 },   // × نسبة الدم الحالية
  attackRatio: 1.3,           // لا يُهاجَم حي إلا بقوة ≥ 1.3 × قوة المدافعين
  retreatRatio: 0.6,          // تنسحب الفرقة إن نقصت قوتها عن 0.6 × قوة الأعداء حولها
  defenseRatio: 1.2,          // الدفاع بلا إفراط: 1.2 × قوة المهاجم
  threatRadius: 5,            // يُدافَع عن الحي إن كان عدو ضمن هذا البعد عن نقطة استيلائه (= خريطة القوى)
  specialValue: 2,            // قيمة الحي المميز
  stationValue: 1.5,          // قيمة مركز الشرطة (صعب فما فوق)
  snowballValue: 3,           // أحياء صاحب 40% تتضاعف قيمتها (القسم 9)
  enemyDistrictValue: 1.5,    // حي يملكه عدو أثمن من محايد: انتزاعه يقوّيك ويضعفه
  preferWeak: 0,              // وزن تفضيل أضعف الخصوم (0 = بلا تفضيل؛ يُرفع للصعب في levels)
  expandSize: 2,              // فرقة التوسع لحي محايد خالٍ (الهدف السهل)
  dangerRadius: 8,            // الأعداء الجائلون قرب الهدف السهل: الفرقة تكبر حتى تفوقهم
  responseRadius: 12,         // أعداء ضمن هذا البعد عن الهدف يلحقون للدفاع عنه: يُحسبون مدافعين
  soloSafeRadius: 14,         // وحدة واحدة تكفي لحي خالٍ فقط إن لم يكن عدو ضمن هذا البعد
  maxSmallSquads: 3,          // أقصى عدد لفرق التوسع والإغارة الصغيرة في وقت واحد
  expandAwayWeight: 0.5,      // التوسع يفضّل الأحياء البعيدة عن العدو (نقاتل قرب أحيائنا)
  reinforce: true,            // نجدة الفرق المشتبكة (يمكن تعطيلها لمستوى بعينه)
  stage: false,               // الالتئام قبل الاقتحام: مطفأ (القياس: الاقتحام المباشر أقوى، 5د-2)
  groupExpand: true,          // المتجمعون قبل اكتمال فرقة الهجوم يتوسعون معاً
  reinforceRange: 14,         // الوحدات الحرة ضمن هذا البعد تنجد فرقة مشتبكة لا تتفوق
  stageDistance: 5,           // فرقة الهجوم تلتئم أولاً عند نقطة قبل الهدف بهذا البعد
  stageRadius: 3,
  stageShare: 0.75,           // تقتحم حين يصل 75% منها
  stageMaxSeconds: 12,        // أو بعد هذه المدة على أي حال
  policeAvoidRadius: 9,       // قبل مهاجمة الشرطة: تجنّب الأحياء ضمن مدى مطاردتها حول مراكزها
  rallyRadius: 4,             // من كان ضمن هذا البعد عن نقطة التجمع يُعد متجمعاً
  rallySwitchGain: 3,         // لا تتغير نقطة التجمع إلا إن صارت الجديدة أقرب للجبهة بهذا القدر
  twoFrontChance: 0.35,       // احتمال تقسيم الهجوم لجبهتين (صعب فما فوق)
  twoFrontMinDistance: 10,    // الحيان المستهدفان متباعدان بهذا القدر على الأقل
  raidAwayDistance: 12,       // جيش العدو الرئيسي بعيد عن أحيائه بهذا القدر: إغارة معاكسة
  raidSize: 3,
  raidMinSpeed: 2.3,          // الوحدات السريعة أولاً في الإغارة

  // الطبقة التكتيكية (11.2): كل 0.25 ث لكل فرقة مشتبكة
  tacticSeconds: 0.25,
  maxAttackersPerTarget: 3,
  priorityBonus: 3,           // الطبيب والقناص والبطل المصاب: كأنهم أقرب بهذا القدر
  woundedHero: 0.5,           // "البطل المصاب": دمه تحت هذه النسبة
  ehpScale: 60,               // كل 60 دم فعلي = مربع واحد إضافي في تفضيل الهدف
  kiteDistance: 1.6,          // عدو أقرب من هذا للرامي: يتراجع خطوة
  kiteStep: 1.5,
  kiteCooldown: 1.5,
  woundedRatio: 0.3,          // تحت 30% دم: تتراجع نحو الطبيب أو المستشفى
  flankMinSpeed: 2.3,         // الوحدات السريعة تلتف
  flankOffset: 2.5,
  flankMinSquad: 6,           // الالتفاف في الفرق الكبيرة فقط (الصغيرة تتفكك)
  heroBehind: 1.5,            // البطل يتقدم خلف مركز فرقته بهذا القدر (إلا ذو الدرع)
  armoredHero: 0.45,          // درع بهذا القدر فأكثر: يتقدم في المقدمة
  aoeMinEnemies: 3,           // الضربات الدائرية والأرضية والحريق
  healMinWounded: 2,          // العلاج الجماعي
  hardenMinAttackers: 2,      // التصلّب
  ultHoldSeconds: 4,          // أقصى انتظار للحظة الأفضل، ثم تُطلق على أي حال
  focusReach: 1,              // تركيز الضرب يختار من داخل مدى الضرب + هذا القدر

  // أداة القياس (11.4): مباراة بوتات فقط بلا رسم
  battle: {
    speed: 8,                 // ×8 من سرعة اللعب العادية
    maxMinutes: 40,           // حد أقصى لزمن المباراة؛ بعده يفوز صاحب الأحياء الأكثر
    mapSize: 'medium',
    matchOptions: [5, 10, 20, 40],
    defaultMatches: 10,
    // الصيغة القياسية: 4 لاعبين الكل ضد الكل (2 من كل مستوى) مثل المباراة العادية؛
    // 1 ضد 1 تحسمه فوضى البداية، والفرق تزيل حسابات الكل ضد الكل
    formats: {
      ffa4:  { name: '4 لاعبين', perSide: 2, teams: false },
      duel:  { name: '1 ضد 1',   perSide: 1, teams: false },
      teams: { name: 'فريقان',   perSide: 2, teams: true }
    },
    defaultFormat: 'ffa4',
    defaultMirror: true,      // نفس العصابة للجانبين: العصابات غير متكافئة بين البوتات
    tapsToOpen: 3             // ثلاث لمسات على عنوان اللعبة تفتح الأداة
  }
};

// منع الاكتساح: من يملك هذه النسبة من الأحياء يصير هدف كل البوتات غير المتحالفة معه
export const SNOWBALL = { districtShare: 0.40 };

// --- رسم الوحدات (docs/units-art.js) ---
export const UNIT_ART = {
  scale: 0.5,           // حجم رسم الفرد العادي
  heroScale: 1.15,      // الشخصيات المميزة أكبر بـ 15% (القسم 13)
  championScale: 1.3,   // الأبطال أكبر من الشخصيات المميزة (القسم 6.6)
  healthBarY: -16,      // ارتفاع شريط الدم فوق قدمي الوحدة
  heroHealthBarY: -18,
  championHealthBarY: -20,
  hurtSeconds: 0.35,    // مدة حالة hurt قبل الرجوع للحالة السابقة
  chargeBarGap: 1.8,    // بُعد شريط الشحن الذهبي تحت شريط الدم
  starY: -23,           // ارتفاع النجمة الذهبية فوق الوحدة عند الجاهزية
  starSize: 2.2,
  policeColor: '#3a5a86' // الشرطة المحايدة تُرسم بهذا اللون دائماً (المرحلة 4ج)
};

// --- لوحة اللاعبين وتنبيهات الحافة (القسم 12.3) ---
export const POWER_PANEL = {
  storageKey: 'gangcity.power',  // يتذكر آخر وضع طي اختاره اللاعب
  updateSeconds: 1,              // تتحدث كل ثانية لا كل إطار
  defeatedOpacity: 0.4,          // وضوح سطر اللاعب المهزوم
  maxHeightPct: 0.33,            // لا تغطي أكثر من ثلث ارتفاع الشاشة
  scrollSeconds: 1.5,            // الاسم الطويل يُمرَّر ذهاباً وإياباً: زمن كل اتجاه = هذا + الجزء المخفي / السرعة
  scrollSpeed: 20                // بكسل في الثانية
};

// --- مجموعات التحكم (القسم 4.4): تحفظ جنوداً برقم ثم تحددهم بلمسة ---
// المدتان من INPUT نفسها: نفس إيماءات اللعبة في كل مكان
export const controlGroups = {
  count: 5,                       // عدد الأزرار المرقّمة
  holdMs: INPUT.longPressMs,      // ضغطة مطوّلة = حفظ المحددين في الرقم
  doubleTapMs: INPUT.doubleTapMs, // لمستان سريعتان = تحديد ونقل الكاميرا
  cameraSeconds: 0.3,             // مدة انتقال الكاميرا الناعم إلى مركز المجموعة
  emptyOpacity: 0.4               // وضوح الزر الفارغ
};

export const ALERTS = {
  maxArrows: 2,          // لا يظهر أكثر من سهمين في وقت واحد
  repeatSeconds: 5,      // لا يتكرر التنبيه لنفس المنطقة قبل هذه المدة
  regionTiles: 6,        // حجم "المنطقة" الواحدة بالمربعات
  lifeSeconds: 4,        // مدة بقاء السهم على الحافة
  edgeMargin: 30,        // بُعد السهم عن حافة الشاشة بالبكسل
  size: 13,              // نصف قطر السهم
  tapRadiusPx: 30,       // دقة اللمس على السهم
  attackColor: '#d9463b',   // وحداتك تتعرض للهجوم
  captureColor: '#e07b2e'   // عدو يستولي على حي تملكه
};

// --- الصوت (القسم 13.5): كل المؤثرات مولّدة بالكود في docs/audio.js ---
export const AUDIO = {
  storageKey: 'gangcity.audio',   // حفظ الإعدادات في localStorage
  sfxVolume: 0.7,                 // القيم الافتراضية قبل أي اختيار
  musicVolume: 0.35,
  muted: false,
  volumeStep: 0.05,               // خطوة مؤشري الصوت في شاشة الإعدادات (5%)

  screenMargin: 40,               // هامش حول الشاشة: ما خرج عنه لا يُسمع
  heavyDamage: 20,                // ضربة بهذا الضرر فأكثر تُسمع ضربة ثقيلة
  shieldArmor: 0.35,              // هدف بهذا الدرع فأكثر يُسمع ارتطاماً بدرع

  musicPerEngaged: 0.1,           // حرارة الموسيقى = المشتبكون × هذا الرقم (بحد 1)
  musicInterval: 0.5,             // ثانية بين كل تحديث لحرارة الموسيقى
  captureTickSeconds: 1.0,        // نبضة الاستيلاء لحي اللاعب
  alertSeconds: 5.0,              // تنبيه "وحداتك تتعرض للهجوم" خارج الشاشة
  whistleSeconds: 6.0,            // صافرة الشرطة عند بدء مطاردتها

  // يُفتح الصوت بأول تفاعل يسمح به المتصفح: بعضها لا يسمح في pointerdown ويسمح في touchend أو click
  unlockEvents: ['pointerdown', 'touchend', 'click', 'keydown'],

  // مزج مؤثرات القتال (المرحلة 5ب): المعركة الكبيرة تطلب مئات المؤثرات في الثانية (200 وحدة: ~560)،
  // فتُجمع طلبات كل تحديث ويُسمع أهمها فقط: حتى maxPerTick في التحديث الواحد بلا تكرار نفس المؤثر فيه،
  // وحتى combatVoices مسموعة معاً (بطلب المستخدم). الأعلى priority يُسمع أولاً، وjitter عشوائي بين
  // المتساويين، وcenter مكافأة لما قرب وسط الشاشة. المعركة الصغيرة تُسمع كاملة تقريباً.
  // minGap: أقل زمن بين مرتين لنفس المؤثر (أعلى من الحد العام 0.045): دويّ الضربة المميزة لا يتلاحق.
  // ما ليس في priority (الظهور والعلاج والاستيلاء والصافرة واكتمال الشحن) يُسمع مباشرة بالحد العام وحده
  combatVoices: 20,
  mix: {
    maxPerTick: 3, queueMax: 64, jitter: 0.6, center: 0.5,
    priority: { death: 3, ult_cast: 2.8, hit_heavy: 2.5, fire: 2.2, hit_shield: 2, hit_melee: 1.8,
                arrow: 1.4, stone: 1.4, swing: 1 },
    minGap: { ult_cast: 0.6, death: 0.12 }
  },

  // قرب الكاميرا (بطلب المستخدم): ارتفاع صوت الحدث على الخريطة من تقريبها، floor (يكاد لا يُسمع) حتى التقريب quiet،
  // ثم يعلو حتى 1 عند loud بمنحنى curve، وعند أطراف الشاشة أخفض حتى edge. وما خرج عن الشاشة لا يُسمع (screenMargin)
  near: { quiet: 1.0, loud: 3.4, floor: 0.04, curve: 1.3, edge: 0.45 },

  // ملفات الصوت (بطلب المستخدم، 2026-10-30): assets/audio/ من صوتياته بعد قص الصمت، وبداية الضربة عند ارتطامها،
  // وتسوية الارتفاع (CREDITS.md هناك). لكل حدث نسخ يُختار منها عشوائياً بلا تكرار متتالٍ، وحسب أسلوب سلاح الضارب
  // إن كان له (FIGHT.weapons: knife وblade وspear وhammer وfists وshield وranged)، وإلا any. rate سرعة التشغيل
  // (أقل = أثقل) وgain الارتفاع، ويتغيران قليلاً كل مرة (rateJitter وgainJitter). وقائمة فارغة: الحدث صامت لهذا
  // الأسلوب (قوس الرامي: يُسمع سهمه). والأحداث بلا ملفات بالصوت المولَّد كما كان، أخفض بـ synthGain
  files: {
    dir: 'assets/audio/',
    sfx: ['swing', 'whoosh', 'slash', 'knife', 'stab', 'hit', 'thump', 'clang', 'tap', 'scrape', 'unsheathe', 'fall',
          'arrow', 'click', 'punch1', 'punch2', 'punch3', 'punch4', 'punch5', 'punch6',
          'heavy1', 'heavy2', 'heavy3', 'heavy4', 'heavy5', 'capture', 'capture_special', 'lost', 'victory'],
    music: ['theme', 'loading', 'match_start', 'game_start']
  },
  events: {
    swing:      { gain: 0.45, any: ['swing', 'whoosh'], knife: ['knife', 'swing'], ranged: [] },
    hit_melee:  { gain: 0.7, any: ['hit', 'thump'], knife: ['stab', 'thump'], spear: ['stab', 'hit'],
                  fists: ['punch1', 'punch2', 'punch3', 'punch4', 'punch5', 'punch6'],
                  hammer: ['heavy1', 'heavy2', 'heavy3', 'heavy4', 'heavy5'], shield: ['heavy1', 'heavy4', 'thump'],
                  ranged: ['punch1', 'punch3', 'punch5'] },
    hit_heavy:  { gain: 0.8, rate: 0.88, any: ['hit', 'thump', 'heavy1', 'heavy4'], knife: ['stab'], spear: ['stab'],
                  fists: ['heavy1', 'heavy2', 'heavy3', 'heavy4', 'heavy5'], hammer: ['heavy1', 'heavy2', 'heavy3', 'heavy4', 'heavy5'],
                  shield: ['heavy1', 'heavy4'], ranged: ['punch2', 'punch4', 'punch6'] },
    hit_shield: { gain: 0.5, any: ['tap', 'clang', 'scrape'] },
    death:      { gain: 0.6, any: ['fall'] },
    arrow:      { gain: 0.55, any: ['arrow'] },
    stone:      { gain: 0.45, rate: 1.25, any: ['whoosh'] },       // الرمي: الحجارة والزجاجات
    ult_ready:  { gain: 0.6, any: ['unsheathe'] },
    ult_cast:   { gain: 0.8, any: ['slash'] },
    ui_tap:     { gain: 0.6, any: ['click'] },
    select:     { gain: 0.5, any: ['click'] },
    command:    { gain: 0.5, rate: 0.85, any: ['click'] },
    // الاستيلاء والخسارة والفوز (بطلب المستخدم: منخفضة، والفوز منخفض جداً). capture_special: حي بمبنى مميز
    // (مبنى المدينة أو قاعدة أو برج أو مستشفى)، وcapture_done لكل نجاح آخر (حي، بناء، غنيمة)
    capture_done:    { gain: 0.35, any: ['capture'] },
    capture_special: { gain: 0.4, any: ['capture_special'] },
    district_lost:   { gain: 0.35, any: ['lost'] },
    victory:         { gain: 0.15, any: ['victory'] }
  },
  rateJitter: 0.06,
  gainJitter: 0.15,
  softHz: 6000,          // مرشح يخفف حدة المؤثرات (بطلب المستخدم: خافتة لا حادة)، ثم ضاغط يمنع تراكم المتزامنة
  synthGain: 0.6,
  combatGain: 0.8,       // مؤثرات القتال (mix.priority) كلها أخفض 20% (بطلب المستخدم)

  // لحن القوائم وأصوات البداية (بمؤشر الموسيقى): theme في القوائم بتلاشٍ، وmatch_start ثم loading بعد loadingDelay
  // على الشاشة السوداء لبدء المباراة، وgame_start على شاشة التشغيل السوداء إن جهز الصوت وهي ظاهرة (التطبيق)،
  // واللحن يبدأ مع ارتفاعها مباشرة (بطلب المستخدم)
  tracks: { theme: 0.8, themeFadeIn: 1.5, themeFadeOut: 0.6, match_start: 0.9, loading: 0.85, loadingDelay: 0.6,
            game_start: 0.9, city: 0.2, cityFadeIn: 2, cityFadeOut: 0.8 },

  // موسيقى الخرائط (بطلب المستخدم، assets/audio/music/): لحن لكل مدينة يدور خلف المباراة، وبعض المدن تتشارك لحناً.
  // الملفات m01-m20 بترتيب إرساله ومسوّاة الارتفاع، وتُسمع بـ tracks.city (20%) قبل مؤشر الموسيقى، وتظهر بتلاشٍ
  // بعد الشاشة السوداء. والخريطة لكل لحن من كلامه. المدينة بلا لحن هنا: الموسيقى المولَّدة كما كانت
  cityMusic: {
    rio: 'm01', china: 'm02', kaifeng: 'm02', arab: 'm03', cairo: 'm04', diriyah: 'm04', europe: 'm05',
    norway: 'm06', japan: 'm07', birmingham: 'm08', tenoch: 'm09', mexico: 'm09', jaipur: 'm10',
    rothenburg: 'm11', shibam: 'm12', yamamah: 'm12', chicago: 'm13', gondar: 'm14', gyeongju: 'm15',
    paris: 'm16', kano: 'm17', laboca: 'm18', meroe: 'm19', hk: 'm20'
  }
};

// --- الأداء ---
export const PERFORMANCE = {
  hashCellTiles: 2,       // حجم خلية الشبكة المكانية (مربعان × مربعان)
  flowFieldMinGroup: 10,  // مجموعة أكبر من هذا تستخدم حقل تدفق بدل A* لكل وحدة
  maxLights: 140,         // أقصى عدد إضاءات تُرسم في الإطار الواحد ليلاً
  detailZoom: 1.4,        // أقل من هذا التقريب: نتجاوز التفاصيل الصغيرة (نوافذ...)
  unitDetailZoom: 1.2,    // أقل من هذا: الوحدة نقطة بسيطة (حجمها أقل من 3 بكسل أصلاً)
  // النمط المظلَّل (المرحلة 9ج، القسم 3.10، docs/nations/style-v5.js): وحدات المستوى الكامل بأطراف كبسولية
  // ورأس متدرج وتدرج للأقمشة وظل ناعم ولهب بطبقات، ومظاهر الأمم فيه بكل تفاصيلها.
  // المبسّط والإحصائي بالرسم القديم كما هو. false يطفئه كله (للمقارنة)
  shadedStyle: true,
  // عدد الوحدات المظللة (أقربها إلى وسط الشاشة من وحدات المستوى الكامل) يتكيف مع الجهاز، تطبيقاً آلياً لقاعدة
  // "إن نزل الأداء خفّض عدد وحدات المستوى الكامل حتى يعود" (js/pacing.js). الهدف 60 إطاراً/ث بهامش: كل نافذة
  // إيقاع (1.5 ث) فيها إطارات متأخرة أكثر من lateShare، أو إيقاع أبطأ من 60، أو عمل إطار (p75) أكثر من
  // workShrink من زمنه، تضرب العدد في shrink؛ وكل نافذة بلا تأخر وعملها أقل من workGrow تزيده growStep حتى max،
  // ولا يتجاوز بعد التأخر ما سبّبه مدة capMs. الرسم وحده يتأثر
  shaded: {
    max: 60,
    min: 0,
    start: 12,            // العدد أول مرة (يتعلم بعدها ويبقى بين المباريات)
    growStep: 4,
    shrink: 0.5,
    lateShare: 0.05,
    workGrow: 0.6,
    workShrink: 0.75,
    capMs: 20000
  },
  fpsTaps: 3,             // لمسات شريط المعلومات لإظهار مؤشر الإطارات
  // إيقاع الإطارات (js/pacing.js): جهاز لا يلحق بكل إطارات الشاشة بانتظام يرسم كل إطار ثانٍ،
  // فالإيقاع الثابت (30 على شاشة 60) أنعم من المتقلب، ثم يجرّب العودة للإيقاع الكامل
  pacing: {
    enabled: true,
    lateExtra: 0.5,       // الإطار متأخر إن تجاوز موعده بأكثر من نصف إطار شاشة (فاته إطار كامل)
    minLateMs: 20,        // ...وتجاوز هذا (التذبذب بين 8 و16 على شاشة 120 لا يُرى)
    enterLate: 0.25,      // إن تأخر ربع الإطارات في النافذة: إيقاع أبطأ
    windowMs: 1500,       // نافذة الحكم
    holdMs: 8000,         // مدة البقاء على الإيقاع الأبطأ قبل تجربة الأسرع (تتضاعف عند الفشل)
    maxHoldMs: 64000,
    probeWorkShare: 0.7,  // لا تُجرَّب العودة للأسرع إلا إن كان عمل الإطار ≤ 70% من زمنه هناك
    maxFrameMs: 34        // لا أبطأ من هذا: 30 إطاراً/ث على الأقل
  }
};

// --- أطوار اللعب (القسم 9.5) ---
// كل الأطوار تُلعب على اقتصاد الإمبراطورية (بطلب المستخدم، EMPIRE أدناه): الأحياء تجمع النقاط، والجنود والترقيات
// والمباني بها. والطور يحدد شرط الفوز وحده. والمباراة التي لا يُذكر طورها (ساحة التجربة وخلفية القوائم) بلا اقتصاد
export const gameModes = {
  order: ['conquest', 'points', 'regicide', 'king', 'survival'],
  defaultMode: 'conquest',

  // 9.5.1 آخر من يبقى يفوز
  conquest: {
    name: 'السيطرة الكاملة',
    short: 'آخر من يبقى يفوز',   // سطر تحت اسم الطور في لوحة الأطوار
    desc: 'آخر عصابة تبقى في المدينة تفوز.'
  },

  // 9.5.2 الوقت بالنقاط
  points: {
    name: 'الوقت بالنقاط',
    short: 'الأعلى نقاطاً يفوز',
    desc: 'كل ما تجمعه من نقاط (أحياؤك وقواعدك وزعماء تسقطهم) نتيجتك، والصرف لا ينقصها. الأعلى عند انتهاء الوقت يفوز.',
    minutes: [5, 10, 15, 20],
    defaultMinutes: 10,
    finalSeconds: 60,           // الدقيقة الأخيرة
    finalMultiplier: 2,         // دخل النقاط مضاعف فيها
    armyWeights: { unit: 1, hero: 3, champion: 5 },   // حسم التعادل: الأكبر جيشاً
    // البوتات: توسع مبكر وقوي، ودفاع أكثر من الهجوم، وفي الدقيقة الأخيرة أضعف حي للمتصدر
    botExpandGroup: 2,          // مجموعات توسع أصغر = أحياء أكثر في وقت واحد
    botDefenseBoost: 1.5,       // مدافعون أكثر لكل مهاجم
    botAttackArmyFactor: 1.6    // جيش أكبر قبل مهاجمة الخصوم
  },

  // 9.5.3 حماية الزعيم
  regicide: {
    name: 'حماية الزعيم',
    short: 'احمِ زعيمك',
    desc: 'بطلك هو زعيمك: إن مات خسرت فوراً. آخر من يبقى زعيمه حياً يفوز.',
    hpBonus: 0.5,               // دم الزعيم +50%
    homeHealPerSecond: 2,       // علاجه داخل حيه المنزلي
    homeHealRadius: 4,          // "داخل الحي": مربعاته، أو شوارعه حتى هذا البعد عن علمه
    fadeSeconds: 1,             // تلاشي وحدات من سقط زعيمه
    hitAlertSeconds: 2.5,       // عمر السهم الأحمر حين يُضرب زعيمك
    leaderArrowSize: 9,         // نصف قطر السهم الذهبي نحو زعماء الأعداء
    // البوتات: الزعيم خلف الجيش، ومطاردة الزعيم المعادي المعزول أو الضعيف
    botGuardDistance: 3,        // كم مربعاً يبقى الزعيم خلف مجموعته
    botHuntHpRatio: 0.5,        // زعيم عدو دمه أقل من هذا = هدف
    botHuntIsolation: 3,        // أو حوله أقل من هذا العدد من حراسه
    botHuntRange: 14            // أبعد مسافة يطارد منها
  },

  // 9.5.4 ملك الحي
  king: {
    name: 'ملك الحي',
    short: 'سيطر على التلة',
    desc: 'سيطر على حي التلة في وسط المدينة. أول من يجمع الزمن المطلوب يفوز.',
    holdMinutes: [2, 3, 5],
    defaultHoldMinutes: 3,
    hillMinTiles: 6,            // التلة: الأقرب للمركز من الأحياء بهذا الحجم فأكثر
    warnSeconds: 20,            // تنبيه حين يقترب أحد من الفوز
    botHillShare: 0.75,         // نسبة الجيش المرسلة للتلة
    botHomeGuard: 2,            // قوة صغيرة تبقى للدفاع عن الحي المنزلي (بحد أقصى)
    botHomeGuardShare: 0.2      // ولا تزيد على هذه النسبة من الجيش
  },

  // 9.5.5 الصمود ضد الشرطة
  survival: {
    name: 'الصمود ضد الشرطة',
    short: 'موجات الشرطة',
    desc: 'أنت وحلفاؤك ضد موجات شرطة تزداد قوة كل 45 ثانية. اصمد أطول ما يمكن.',
    allies: [0, 1, 2, 3],
    defaultAllies: 0,
    levels: ['easy', 'medium', 'hard', 'insane'],
    defaultLevel: 'medium',
    // الإيقاع (9.5.5 v2): 45 ث، ثم ينقص ثانيتين مع كل موجة حتى حد أدنى
    waveSeconds: 45,
    firstWaveSeconds: 45,
    waveSpeedup: 2,
    minWaveSeconds: { easy: 25, medium: 25, hard: 25, insane: 18 },
    // الحجم والقوة ينموان أُسّياً: عدد الموجة n = base + per×n، والدم والضرر × growth^n
    size: {
      easy:   { base: 3, per: 2, growth: 1.05 },
      medium: { base: 4, per: 3, growth: 1.08 },
      hard:   { base: 5, per: 4, growth: 1.11 },
      insane: { base: 6, per: 5, growth: 1.14 }
    },
    // التكوين والتكتيك حسب رقم الموجة، ولكل مرحلة اسم يُعلَن
    // captainsPer: ضابط لكل هذا العدد (0 = بلا ضباط)، riotShare: نسبة وحدات التدخل،
    // fronts: عدد الجبهات، weakest: إحدى الجبهات على أضعف حي، focusHeroes: الضرب على الأبطال أولاً
    phases: [
      { from: 1,  name: 'دورية',       captainsPer: 0, riotShare: 0,    fronts: 1 },
      { from: 4,  name: 'تعزيزات',     captainsPer: 6, riotShare: 0,    fronts: 2 },
      { from: 7,  name: 'قوات التدخل', captainsPer: 6, riotShare: 0.25, fronts: 3, weakest: true },
      { from: 10, name: 'الطوارئ',     captainsPer: 5, riotShare: 0.5,  fronts: 3, weakest: true, focusHeroes: true }
    ],
    // وحدة التدخل: رسم الشرطي بلون أغمق، دم ×1.6، درع 35%، تصدّ دائماً من الأمام ما دام معها تحمّل
    riot: { name: 'وحدة تدخل', color: '#1f2f46', hpFactor: 1.6, armor: 0.35 },
    // كل موجة خامسة: قائد الشرطة (رسم الضابط ×1.3، دم ×5، هالة +30% ضرر، نداء يستدعي 4 شرطة)
    boss: {
      every: 5, name: 'قائد الشرطة', scale: 1.3, hpFactor: 5,
      aura: { radius: 3, damageBonus: 0.30 },
      summon: 4, summonRadius: 3
    },
    captainsBehind: 2,          // الضباط يتقدمون خلف الصفوف بهذا البعد (من الموجة 10)
    // الشرطة تستولي على الأحياء في هذا الطور؛ قوة استيلاء كل شرطي حسب الصعوبة
    // (مضبوطة بأداة القياس حتى يصل بوت صعب إلى: سهل 12-15، متوسط 8-10، صعب 6-8، مجنون 4-5)
    capturePower: { easy: 0.25, medium: 0.25, hard: 0.25, insane: 1 },
    // دخل نقاط الاقتصاد في هذا الطور (مضاعف لكل صعوبة): الجنود والأبراج بالنقاط تقوى على الموجات، فيُقلَّل
    // حتى تبقى أهداف الصعوبة (أداة القياس scripts/survival-test.mjs)
    // (أُعيد ضبطها بعد توسعة الخرائط 11ب: الخريطة الأكبر تعطي أحياء ودخلاً أكثر، وكانت 0.55 و0.65 و0.7 و0.6)
    incomeMul: { easy: 0.45, medium: 0.45, hard: 0.5, insane: 0.45 },
    edgeSearchTiles: 12,        // البحث عن شارع قرب حافة الخريطة لظهور الموجة
    spawnSpread: 8,             // مربعات الظهور حول كل مصدر
    retargetSeconds: 2,         // شرطة الموجة الواقفة تختار هدفاً جديداً كل هذه المدة
    alarmSeconds: 5,            // العدّاد يحمرّ قبل الموجة بهذه المدة
    noticeSeconds: 3,           // إشعار "الموجة N قادمة!"
    botHelpGroup: 3,            // الحليف البوت يرسل هذا العدد لنجدة حي حليف مهدد
    botAttackArmyFactor: 0.5,   // الحليف يسترجع أحياء الشرطة بجيش أصغر من المعتاد
    recordKey: 'gangcity.survivalBest'   // أفضل نتيجة لكل صعوبة: gangcity.survivalBest.hard ...
  }
};

// --- اقتصاد الإمبراطورية (بطلب المستخدم): بنية اللعبة نفسها، في كل الأطوار والمدن ---
// لا ظهور تلقائي: الأحياء تجمع النقاط، وتُصرف على الجنود من القاعدة الرئيسية، وعلى ترقيات العصابة،
// وعلى بناء الأحياء (قاعدة رئيسية أو برج رماية أو مستشفى). فئة المبنى لا تتغير بعد بنائه.
// المباني بطراز كل مدينة (art أدناه)، ولا يتغير شكل الجنود مع الترقيات
export const EMPIRE = {
  startPoints: 0,
  income: { district: 0.5, hq: 2 },        // نقطة في الثانية: كل حي، والقاعدة الرئيسية (بدل الحي)
  leaderKill: 50,                           // من يُسقط زعيم عصابة (بطلها) يأخذ هذه النقاط
  hintSeconds: 7,                           // تلميح البداية: لمستان على حيك تفتحان قائمته
  // الإنتاج من القاعدة الرئيسية: الكلفة بالنقاط، والزمن بالثواني قبل ترقية سرعة الإنتاج
  units: {
    order: ['common', 'strong', 'elite', 'leader'],
    common: { cost: 10, seconds: 4 },       // الفرد العادي
    strong: { cost: 25, seconds: 7 },       // الأقوى منه: الشخصية المميزة الأخرى
    elite:  { cost: 50, seconds: 10 },      // النخبة: الشخصية المميزة الأقوى (elite)
    leader: { cost: 100, seconds: 15 }      // الزعيم (البطل): واحد فقط لكل عصابة
  },
  // النخبة من الشخصيتين المميزتين لكل نمط قتالي (الأمم بأنماطها)، والأخرى هي "الأقوى"
  elite: { crows: 'spear', hammers: 'smasher', vipers: 'sniper', scorpions: 'boss' },
  queueMax: 5,                              // أقصى طلبات الإنتاج في القاعدة الواحدة
  // ترقيات العصابة: ثلاثة مستويات، والكلفة لكل مستوى، والأثر لكل مستوى. الجنود الحاليون والجدد معاً،
  // وتبقى للعصابة التي اشترتها مهما سقطت قواعدها (بقرار المستخدم)
  upgrades: {
    order: ['hp', 'damage', 'armor', 'speed'],
    hp:         { name: 'الدم',         costs: [30, 50, 70], per: 0.10 },   // +10% دم لكل مستوى
    damage:     { name: 'الضرر',        costs: [30, 50, 70], per: 0.10 },   // +10% ضرر
    armor:      { name: 'الدفاع',       costs: [30, 50, 70], per: 0.05 },   // +5 نقاط درع (من 100) فوق درع الوحدة
    speed:      { name: 'سرعة المشي',   costs: [30, 50, 70], per: 0.06 }    // +6% سرعة
  },
  buildings: {
    order: ['tower', 'hospital', 'hq'],
    // القاعدة الرئيسية: سرعة الإنتاج ملك القاعدة نفسها، فتبقى فيها وتنتقل لمن يحتلها (زمن الإنتاج × times)
    hq:       { name: 'قاعدة رئيسية', cost: 100, desc: 'تنتج الجنود',
                upgrades: { order: ['production'],
                            production: { name: 'سرعة الإنتاج', costs: [20, 40, 50], times: [1, 0.8, 0.65, 0.5] } } },
    // برج الرماية: يرمي سهماً على أقرب عدو في مداه كل attackTime ثانية (المربع من مركز البرج)
    tower:    { name: 'برج رماية', cost: 40, desc: 'يرمي سهاماً على الأعداء', range: 6.5, damage: 14, attackTime: 1.5,
                upgrades: { order: ['damage', 'rate'],
                            damage: { name: 'الضرر', costs: [40, 70], per: 0.35 },        // +35% ضرر لكل مستوى
                            rate:   { name: 'سرعة الضرب', costs: [40, 70], per: 0.2 } } }, // زمن الرمية −20%
    // المستشفى: يعالج جنود صاحبه داخل radius مربعاً حوله، perSecond دم في الثانية لكل واحد
    hospital: { name: 'مستشفى', cost: 50, desc: 'يعالج جنودك حوله', radius: 3.5, perSecond: 4,
                upgrades: { order: ['radius', 'rate'],
                            radius: { name: 'مدى العلاج', costs: [40, 70], per: 1 },      // +1 مربع
                            rate:   { name: 'سرعة العلاج', costs: [40, 70], per: 0.5 } } } // +50% علاج
  },
  // مباني الطور بطراز كل مدينة (landmarks.js): القاعدة مبنى مقر المدينة (CITY_SPECIALS.hq) في كل المدن.
  // وفي كل مدينة: البرج برج رماية مرسوم بألوانها (empireTower في cityThemes.js)، والمستشفى مبناها الأساسي
  // (CITY_SPECIALS.base) بالصليب الأحمر كالمستشفى في الأطوار الأخرى. إلا المدن المذكورة هنا فلها صورها:
  // tower وhospital نوعا مبنى من طابعها، hospitalRoof من أعلى سطح المستشفى إلى وسطه (لوحة الصليب)،
  // وfort: القاعدة قلعة بسور وأبراج من صورها (fortify في empire.js)
  art: { yamamah: { tower: 'watchtower', hospital: 'hall', hospitalRoof: 3, fort: true } },
  // شارة كل مبنى على سارية فوق سطحه (بطلب المستخدم): تاج للقاعدة، وقوس وسهم للبرج، وصليب للمستشفى،
  // على قرص بحلقة بلون صاحبه. نصف القطر بوحدات العالم، ولا يصغر على الشاشة عن minScreen بكسل
  badge: { radius: 6.5, minScreen: 11, pole: 5, disc: 'rgba(32,23,13,0.9)', neutral: '#9a9183' },
  // هالة ذهبية حول كل قاعدة رئيسية (حول القلعة كلها): نصف القطر بالمربعات، ونبض بطيء
  baseHalo: { radius: 2.15, width: 1.5, glow: 6, alpha: 0.8, glowAlpha: 0.3, pulse: 0.35, speed: 2.2 },
  arrow: { flight: 0.45, top: 30 },         // سهم البرج: زمن الطيران، وارتفاع انطلاقه فوق قاعدة البرج
  halo: { width: 5, alpha: 0.32 },          // هالة على حدود الحي المملوك (تحت الحد الملون)
  // قائمة الحي (لمستان على حيك): تحديثها، ومكان الحي فوقها حين تغطيه (نسبة من ارتفاع ما فوقها)
  // hqTapBox: لمس القاعدة يشمل قلعتها كلها (نصف العرض بأنصاف عرض المربع)
  menu: { refreshMs: 250, revealAt: 0.55, hqTapBox: 2.2 },
  // البوتات: كيف تصرف نقاطها (js/ai/empireBot.js). لا ظهور تلقائي في هذا الطور: بلا صرف لا جيش
  bot: {
    queue: 2,                               // تبقي هذا العدد من الطلبات في طابور كل قاعدة
    // نسب الإنتاج بالدور: عادي، الأقوى، النخبة (السهل: عاديون فقط)
    mix: { easy: [1, 0, 0], medium: [5, 2, 1], hard: [4, 2, 1], insane: [4, 2, 1] },
    // حصة الترقيات والمباني مما يصرفه (السهل لا يرقّي ولا يبني)
    techShare: { easy: 0, medium: 0.25, hard: 0.35, insane: 0.35 },
    upgradeOrder: ['damage', 'hp', 'armor', 'speed'],   // الأقل مستوى أولاً، وبهذا الترتيب عند التساوي (وسرعة إنتاج القاعدة قبلها)
    minArmy: 6,                             // جيش أصغر من هذا: الجنود قبل أي ترقية
    leaderArmy: 5,                          // لا يعيد شراء الزعيم قبل أن يكون معه هذا العدد من الجنود
    towerEvery: 4,                          // برج لكل 4 أحياء، على الحي الأقرب للأعداء
    hospitalAt: 4,                          // مستشفى واحد حين يملك 4 أحياء، قرب قاعدته
    hqAt: 8, maxHq: 2,                      // قاعدة رئيسية ثانية حين يملك 8 أحياء، في أبعد أحيائه عن الأعداء
    buysPerDecision: 3,                     // أقصى مشتريات في القرار الواحد
    recruitEvery: 5                         // مجنَّد مبنى مميز (طبيب، أبطال عدوة) لكل 5 من جيشه، إن ملك مبناه (القسم 3.11)
  }
};

// ساموراي إيدو: حراس الدوجو والمجنَّدون فيه (أقوى 30% بطلب المستخدم: كانوا 230 دماً و14 ضرراً)
const SAMURAI = { hp: 300, armor: 0.2, damage: 18, attackTime: 0.9, speed: 2.4, visionRange: 4.5 };

// --- مزايا المدن (القسم 3.11، بطلب المستخدم): ميزة واحدة لكل مدينة أمة، في كل مباراة على الاقتصاد ---
// cities: المدينة ← ميزتها، والمدن التي لا تُذكر بلا ميزة. ground: أرض حي الميزة قبل الاستيلاء عليه تميل لهذا اللون
// botValue: قيمة حي الميزة عند البوتات (الحي العادي 1، والحي المميز القديم ai.specialValue)
export const CITY_FEATURES = {
  cities: { diriyah: 'storm', shibam: 'villages', cairo: 'pyramid',
            japan: 'dojo', gyeongju: 'bandits', kano: 'bandits', kaifeng: 'clinic', gondar: 'fortress', meroe: 'khartoum',
            paris: 'coups', rothenburg: 'policeHQ', birmingham: 'clock', tenoch: 'cartel', rio: 'statue', laboca: 'mercs',
            yamamah: 'caravan', arab: 'souk', china: 'fireworks', hk: 'triads', jaipur: 'elephants', norway: 'troll',
            europe: 'bells', mexico: 'mine', chicago: 'bank' },
  ground: ['#c9a24e', 0.24],
  // المبنى المميز (بطلب المستخدم: مساحة خاصة به، وحجم أكبر وفخامة وهالة): كتلة 2×2 وسط حيه لا يُمشى عليها،
  // وبقية الحي ساحة مرصوفة حوله يُمشى عليها. حيه blockTiles مربعاً فأكثر (generator.js)
  blockTiles: 9,
  botValue: { pyramid: 3, village: 2, dojo: 2.5, clinic: 2, fortress: 2.5, khartoum: 3,
              policeHQ: 3, clock: 3, complex: 2.5, cartel: 1.6, statue: 3, mercs: 2, souk: 2.5, triads: 2.5, stable: 2.5,
              cathedral: 2.5, mine: 3, bank: 2.5 },
  names: { pyramid: 'الهرم', village: 'القرية', dojo: 'دوجو الساموراي', clinic: 'دار العلاج', fortress: 'الحصن',
           khartoum: 'برج الخرطوم', policeHQ: 'مركز الشرطة الرئيسي', clock: 'برج الساعة', complex: 'المجمع السكني',
           statue: 'تمثال ريو', mercs: 'بيت المرتزقة', souk: 'السوق الكبير', triads: 'مقر الترياد', stable: 'إسطبل الفيلة',
           cathedral: 'الكاتدرائية', mine: 'منجم الفضة', bank: 'البنك' },
  hintSeconds: 6,                     // إشعار ميزة المدينة في بداية المباراة (بعد تلميح قائمة الحي)
  // سطر ميزة المدينة في معاينة المدينة (قائمة الإعداد والمتجر) وإشعار البداية
  desc: { storm: 'العاصفة الرملية: كل 3 دقائق لنصف دقيقة، مدى الرماة أقل والضربات تخطئ',
          villages: 'القرى المحايدة: أهلها ينضمون لمن يستولي على قريتهم',
          pyramid: 'الهرم: 5 نقاط في الثانية، وجنود مالكه حوله يتلقون ضرراً أقل',
          dojo: 'دوجو الساموراي: ساموراي محايدون يحرسونه، ومن يحتله جنوده أقوى 10%',
          bandits: 'قطاع الطرق: عصابة تظهر في الوسط كل دقيقتين، أكبر وأقوى في كل مرة، وتستولي على الأحياء',
          clinic: 'دار العلاج: تعالج جنود مالكها حولها، ويجنّد فيها أطباء',
          fortress: 'الحصن: حراس أقوياء وسهام، ومن يحتله يجنّد فيه أبطال عدوة',
          khartoum: 'برج الخرطوم: برج رماية بعيد المدى بضعف الضرر، واحتلاله أطول بكثير',
          coups: 'الانقلابات: كل دقيقتين تتمرد أحياء من العصابات الكبيرة وتستولي على ما حولها',
          policeHQ: 'مركز الشرطة الرئيسي: من يحتله تصير الشرطة صديقة له، وتنضم إليه شرطة كل مركز يحتله',
          clock: 'برج الساعة: مالكه دخله +30% وإنتاجه أسرع 40%، واحتلاله أطول',
          cartel: 'المجمع السكني: عصابة محايدة تحرس أربعة أحياء، وكل حي تنتزعه منها يرخّص جنودك 5%',
          statue: 'تمثال ريو: جنود مالكه حوله أسرع ضرباً 20% وأقوى 15%، واحتلاله أطول',
          mercs: 'بيوت المرتزقة: يستأجر مالكها مرتزقاً خفيفاً رخيصاً أو ثقيلاً غالياً',
          caravan: 'قافلة التجارة: كل 3 دقائق قافلة تعبر المدينة بحراسها، وكل تاجر تنهبه يعطيك 20 نقطة',
          souk: 'السوق الكبير: مالكه يأخذ 10% من كل ما يصرفه غيره',
          fireworks: 'مهرجان الألعاب النارية: كل دقيقتين ونصف تنفجر فوق أكبر تجمعات الجنود، فابتعد عن الدوائر الحمراء',
          triads: 'مقر الترياد: مالكه يرسل 6 مقاتلين أقوياء إلى أي حي لعدوه، يقاتلون 45 ثانية ثم يختفون',
          elephants: 'إسطبل الفيلة: مالكه يجنّد فيلاً حربياً ضخماً يدهس كل من حوله',
          troll: 'ترول الجبل: كل 4 دقائق ينزل وحش ضخم يهاجم أكبر تجمعات الجنود، ومن يقتله يأخذ 240 نقطة',
          bells: 'الكاتدرائية: مالكها يقرع أجراسها فيصير كل جنوده أسرع 25% وأقوى 15% لمدة 15 ثانية',
          mine: 'منجم الفضة: دخله يكبر كلما طال امتلاكه حتى 4 نقاط في الثانية',
          bank: 'سرقة البنك: خزنته تمتلئ طوال المباراة، ومن يحتل البنك يسرقها كلها' },
  // الهالة حول كل مبنى مميز وحول القرية التي ينتظر أهلها (رسم فقط): نصف القطر بالمربعات من وسط الكتلة، ونبض بطيء،
  // ونجوم صغيرة تدور عليها. colors: لون هالة كل ميزة
  halo: { radius: 1.95, width: 1.6, glow: 8, alpha: 0.85, glowAlpha: 0.3, pulse: 0.3, speed: 1.8,
          sparkles: 4, sparkleSpeed: 0.45, sparkleR: 1.6, light: 46 },
  colors: { pyramid: '255,206,84', village: '120,140,225', dojo: '232,70,86', clinic: '96,220,150', fortress: '150,214,96',
            khartoum: '255,150,60', policeHQ: '95,160,240', clock: '240,205,120', complex: '47,190,175', statue: '140,230,120',
            mercs: '235,95,110', souk: '230,170,70', triads: '255,80,170', stable: '255,140,190',
            cathedral: '255,214,120', mine: '200,215,230', bank: '120,230,150' },
  // العاصفة الرملية (الدرعية): أولها عند first ثانية ثم كل every ثانية، لمدة duration، وتنبيه قبلها بـ warn ثانية.
  // أثناءها: مدى الرماة والأبراج × rangeMul، والضربة القريبة والسهم وسهم البرج يخطئ باحتمال miss
  // ("أخطأ!" pop)، والنار وضربات الأبطال أضعف بنفس النسبة
  storm: {
    first: 180, every: 180, duration: 30, warn: 10, rangeMul: 0.6, miss: 0.3, pop: 'أخطأ!',
    // الرسم: الغبار يشتد في أول fade ثانية ويخف في آخرها، بلون color وشفافية alpha، وخطوط رمل particles
    fade: 2.5, color: '190,142,78', alpha: 0.42, particles: 190, streak: '255,240,210'
  },
  // القرى المحايدة (شبام): عددها لكل حجم خريطة، وpeople أفراد كل قرية (من، إلى) بشكل أفراد nation العاديين،
  // وminHomeDistance أقل بُعد (بالمربعات) عن الأحياء المنزلية. لا يهاجمون ولا يُهاجَمون، وينضمون لمن يستولي على قريتهم
  villages: { count: { small: 3, medium: 4, large: 6 }, people: [3, 4], minHomeDistance: 5,
              name: 'أهل القرية', color: '#8f7d5c', nation: 'yemen' },
  // الهرم (القاهرة): في الحي الأقرب لوسط المدينة. دخل حيه income في الثانية (بدل EMPIRE.income.district)،
  // وجنود مالكه داخل radius مربعاً منه يتلقون ضرراً أقل بنسبة damageTaken
  pyramid: { income: 5, radius: 5, damageTaken: 0.2, top: 58 },
  // دوجو الساموراي (إيدو): مبنى واحد قرب الوسط بعيد عن الأحياء المنزلية. ساموراي محايدون معادون للجميع بشكل hero
  // أمة nation وإحصائيات stats فوقه: start منهم في البداية، ثم واحد كل every ثانية حتى max، ولا يبتعدون عنه أكثر من chase.
  // أول استيلاء يوقف إنتاجهم ويختفي الباقون خلال vanishSeconds، ومالكه: كل جنوده +damageBonus ضرراً
  dojo: { minHomeDistance: 6, start: 2, every: 12, max: 5, chase: 6, vanishSeconds: 5, damageBonus: 0.10, top: 50,
          name: 'الساموراي', color: '#7d1f2c', nation: 'japan', hero: 'dual', look: 'samurai',   // look: صورة الساموراي (بطلب المستخدم)
          stats: SAMURAI, recruits: ['samurai'] },
  // قطاع الطرق (غيونغجو وكانو): أول عصابة عند first ثانية ثم كل every، في وسط الخريطة، بشكل أفراد أمة المدينة بلون color.
  // الموجة n: count + perWave × (n − 1) فرداً (حتى maxCount)، ودمهم وضررهم × (1 + grow × (n − 1))، ومن الموجة heroFrom
  // شخصية مميزة لكل heroEvery أفراد. تستولي على الأحياء المجاورة حتى cap حياً، وتفكر كل think ثانية. لا تنتج جنوداً
  bandits: { first: 120, every: 120, count: 3, perWave: 2, maxCount: 15, grow: 0.12, heroFrom: 3, heroEvery: 5,
             cap: { small: 6, medium: 8, large: 10 }, think: 2, name: 'قطاع الطرق', color: '#3a312b' },
  // دار العلاج (كايفنغ): عددها لكل حجم خريطة، موزعة بعيدة عن الأحياء المنزلية. تعالج جنود مالكها داخل radius
  // بـ perSecond دم/ث لكل واحد (أقوى من مستشفى الاقتصاد)، وفي قائمتها تجنيد recruits
  clinic: { count: { small: 2, medium: 3, large: 4 }, minHomeDistance: 5, radius: 4.5, perSecond: 9, top: 44,
            recruits: ['doctor'] },
  // الحصن (غوندر): عدده لكل حجم خريطة، موزع بعيد عن الأحياء المنزلية. فيه guards حراس محايدون بشكل hero أمة nation
  // وإحصائيات stats (لا يُعوَّضون، ويختفي الباقون عند أول استيلاء)، ويرمي السهام كبرج (tower): على كل من يقترب وهو محايد،
  // وعلى أعداء مالكه بعد احتلاله. ومالكه يجنّد فيه recruits
  fortress: { count: { small: 2, medium: 3, large: 4 }, minHomeDistance: 6, guards: 4, chase: 6, vanishSeconds: 5, top: 52,
              name: 'حراس الحصن', color: '#5b4a2e', nation: 'ethiopia', hero: 'boss',
              stats: { hp: 260, armor: 0.25, damage: 15, speed: 2.1, aura: null },   // بلا هالة قارع النقارة: حرس لا قائد
              tower: { range: 6, damage: 16, attackTime: 1.4 }, recruits: ['drummer', 'healer'] },
  // برج الخرطوم (مروي): برج رماية واحد قرب الوسط، يرمي لمالكه: المدى range، والضرر ضرر برج الاقتصاد × damageMul،
  // وزمن الرمية زمنه ÷ rateMul. واحتلاله أبطأ: سرعة الاستيلاء على حيه × captureMul
  khartoum: { range: 9, damageMul: 2, rateMul: 1.5, captureMul: 0.3, top: 84 },
  // الانقلابات (باريس): أولها عند first ثم كل every. كل عصابة تملك at[k] حياً فأكثر يتمرد منها k + 1 حياً (ليس قاعدة
  // ولا مركز شرطة ولا التلة، وما بلا مبنى أولاً)، ويظهر في كل حي متمرد perDistrict متمردين بشكل أفراد nation بلون color،
  // دمهم وضررهم × (1 + grow × (n − 1)) في الانقلاب n. يستولون على الأحياء المجاورة داخل range مربعاً من حيهم،
  // ويقررون كل think ثانية. لا انقلابات في الصمود
  coups: { first: 120, every: 120, at: [6, 9, 12], perDistrict: 3, grow: 0.1, range: 8, think: 2,
           name: 'المتمردون', color: '#4a1c22', nation: 'france' },
  // مركز الشرطة الرئيسي (روتنبورغ): مركز شرطة كبير قرب الوسط بجانب المراكز العادية، شرطته بشكل أفراد nation
  // (والضابط بشكل captainLook)، ودمها وضررها × boost. من يحتله: الشرطة كلها صديقة له، وتنضم إليه شرطته
  // وشرطة كل مركز يحتله بعده (police.js)
  policeHQ: { nation: 'germany', captainLook: 'armored', boost: 1.15, top: 76 },
  // برج الساعة (برمنغهام): قرب الوسط. مالكه: دخله × incomeMul، وزمن إنتاج جنوده ÷ productionMul، واحتلاله أبطأ (captureMul)
  clock: { incomeMul: 1.3, productionMul: 1.4, captureMul: 0.5, top: 96 },
  // المجمع السكني (تينوتشتيتلان): في الوسط، ومعه أحياء جيرانه الأقرب (neighbors) لعصابة محايدة بشكل nation وبلون color
  // من البداية. تنتج total فرداً مميزاً فقط طوال المباراة (start في البداية ثم واحد كل every ثانية ما دام المجمع لها)،
  // بالتناوب بين heroes، لا يبتعدون عن المجمع أكثر من leash مربعاً، ويستردون ما يُنتزع من أحيائهم (كل think ثانية).
  // وكل حي من الأربعة يملكه لاعب: جنوده أرخص بنسبة discount
  cartel: { neighbors: 3, total: 10, start: 4, every: 20, leash: 9, think: 2, discount: 0.05, heroes: ['sniper', 'firebomber'],
            name: 'عصابة المجمع', color: '#1f5f5a', nation: 'mexico' },
  complex: { top: 52 },                     // مبنى المجمع: ارتفاع قمته للشارة
  // تمثال ريو (ريو): على صخرة قرب الوسط. جنود مالكه داخل radius مربعاً منه: سرعة الضرب + attackSpeed والضرر + damage،
  // واحتلاله أبطأ (captureMul)
  statue: { radius: 7, attackSpeed: 0.2, damage: 0.15, captureMul: 0.5, top: 70 },
  // بيوت المرتزقة (لا بوكا): عددها لكل حجم خريطة، موزعة بعيدة عن الأحياء المنزلية. يستأجر مالكها فيها recruits
  mercs: { count: { small: 2, medium: 3, large: 4 }, minHomeDistance: 5, top: 46, recruits: ['blade', 'gaucho'] },
  // قافلة التجارة (صحراء اليمامة): أولها عند first ثم كل every ثانية (لا قوافل في الصمود)، من بوابة في السور إلى الحافة
  // المقابلة: merchants تجار لا يقاتلون يحملون البضائع، وguards حراس (شخصية كل حارس، null للفرد العادي) من حراس القوافل.
  // كل تاجر يُقتل يعطي قاتله loot نقطة. كل think ثانية يمضي التجار ويرافقهم الحراس، ومن بلغ المخرج (exitRadius) يخرج،
  // ومن بقي بعد maxSeconds يخرج على أي حال
  caravan: { first: 150, every: 180, merchants: 4, guards: [null, null, 'sniper'], loot: 20, think: 2, exitRadius: 1.6,
             maxSeconds: 150, escort: 1.5, name: 'القافلة', merchantName: 'تاجر', color: '#7a5a34', nation: 'saudi',
             merchant: { hp: 120, damage: 0, speed: 0.9 }, guard: { hp: 200, armor: 0.15, speed: 1.6 } },
  // السوق الكبير (المدينة العربية): مالكه يأخذ tax من كل ما يصرفه غيره، ولا يدفع الصارف أكثر من سعره
  souk: { tax: 0.1, top: 50 },
  // مهرجان الألعاب النارية (المدينة الصينية): أولها عند first ثم كل every ثانية، دوائر نصف قطرها radius فوق أكبر count
  // تجمعات للجنود (minUnits فأكثر في الدائرة، ولا تتداخل)، وبعد warn ثانية تنفجر: damage لكل وحدة داخلها من أي طرف.
  // كل بوت يُخرج جنوده من الدائرة إلى dodge مربع خارجها بفرصة dodgeChance حسب صعوبته (لكل دائرة).
  // والانفجار يبقى مرسوماً fade ثانية
  fireworks: { first: 150, every: 150, count: 3, minUnits: 3, radius: 2.5, warn: 5, damage: 40, dodge: 1.2, fade: 1.6,
               dodgeChance: { easy: 0, medium: 0.5, hard: 0.8, insane: 1 },
               name: 'الألعاب النارية', color: '#c0392b', nation: 'china' },
  // مقر الترياد (هونغ كونغ): من قائمته يدفع مالكه cost ويلمس حياً لعدو، فيظهر حوله fighters مقاتلين بلونه (heroes:
  // شخصية كل واحد، null للفرد العادي) بشكل أمة nation وإحصائيات stats، يقاتلون seconds ثانية ثم يختفون. مرة كل cooldown
  // ثانية لكل مقر. والبوت يرسلهم إن بقي معه بعد الدفع botReserve نقطة
  triads: { cost: 60, cooldown: 90, seconds: 45, nation: 'china', heroes: [null, null, null, null, 'boss', 'boss'],
            name: 'مقاتل الترياد', stats: { hp: 230, armor: 0.15, damage: 14, speed: 2.6 }, botReserve: 30, top: 82 },
  // إسطبل الفيلة (جايبور): يجنّد فيه مالكه الفيل الحربي (recruits.elephant). الفيل يدهس كل عدو داخل radius
  // كل every ثانية بضرر damage، ولا يترنّح ولا يسقط ولا يُدفع
  stable: { top: 62, recruits: ['elephant'], trample: { radius: 1.5, damage: 22, every: 1.5 } },
  // الكاتدرائية (المدينة الأوروبية، بدل محطة القطار): مالكها يقرع أجراسها فيصير كل جنوده على الخريطة أسرع speed وأقوى
  // damage مدة seconds، مرة كل cooldown. والبوت يقرعها حين يقاتل botFighting من جنوده فأكثر. ring: حلقة تحت الجندي
  cathedral: { top: 66, cooldown: 90, seconds: 15, speed: 0.25, damage: 0.15, botFighting: 6, ring: '#ffd36b' },
  // منجم الفضة (المدينة المكسيكية): دخله base نقطة/ث في أول every ثانية من امتلاكه، ثم +step كل every حتى max،
  // ويعود إلى base كلما احتُل
  mine: { base: 1, step: 1, every: 60, max: 4, top: 58 },
  // البنك (شيكاغو): خزنته تمتلئ fill نقطة/ث طوال المباراة حتى cap، ومن يحتل البنك يسرقها كلها، ومالكه يأخذ fee نقطة/ث.
  // وقيمته عند البوتات تزيد نقطة لكل botPer في الخزنة
  bank: { fill: 1.5, cap: 300, fee: 1, botPer: 100, top: 60 },
  // ترول الجبل (القرية النرويجية): أوله عند first ثم كل every ثانية (لا ترول في الصمود)، ينزل من حافة الجبل (i = 0)
  // ويقصد كل think ثانية أكبر تجمع للجنود (cluster مربع)، ولا يقاتل الشرطة، وبعد stay ثانية يعود إلى الجبل ويختفي. ضربته تُسقط المصاب
  // وتدفعه slam مربع، ومن يقتله يأخذ reward نقطة. hero: شخصية الأساس من نمط أمته، وscale حجم رسمه
  // (بطلب المستخدم: أقوى 50% دماً وضرراً من 2500 و60، وجائزته 120 نقطة زيادة)
  troll: { first: 180, every: 240, stay: 120, think: 3, cluster: 4, reward: 240, scale: 2.7, barY: -44,
           name: 'ترول الجبل', color: '#5f6f58', nation: 'germany', hero: 'smasher',
           stats: { hp: 3750, armor: 0.2, damage: 90, attackTime: 1.8, speed: 1.4, attackRange: 2.2, visionRange: 8,
                    slam: 1.6, capturePower: 0 } },
  // التجنيد في المباني المميزة (من قائمتها، بطابور كالقاعدة): الكلفة والزمن، وشكل الوحدة (أمة nation وشخصيتها hero،
  // وnull للفرد العادي) وما يُضاف إلى إحصائياتها stats، واسمها name (وإلا اسمها في أمتها)
  recruits: {
    doctor:  { name: 'طبيب', cost: 30, seconds: 6, nation: 'china', hero: null,
               stats: { damage: 4, heal: { radius: 3, perSecond: 10 } } },
    drummer: { cost: 45, seconds: 9, nation: 'ethiopia', hero: 'boss' },
    healer:  { cost: 35, seconds: 8, nation: 'ethiopia', hero: 'medic' },
    // مرتزقة لا بوكا: خفيف يضرب بسرعة ورخيص، وثقيل قوي وغالٍ جداً
    blade:   { name: 'مرتزق خفيف', cost: 15, seconds: 4, nation: 'argentina', hero: 'dual',
               stats: { hp: 90, damage: 7, attackTime: 0.55, speed: 2.7 } },
    gaucho:  { name: 'مرتزق ثقيل', cost: 140, seconds: 14, nation: 'argentina', hero: 'spear',
               stats: { hp: 520, armor: 0.35, damage: 30, attackTime: 1.3, speed: 2.0 } },
    // ساموراي الدوجو (إيدو، بطلب المستخدم): يجنّده مالك الدوجو بصورة الساموراي (look) وبلونه
    samurai: { name: 'ساموراي', cost: 80, seconds: 10, nation: 'japan', hero: 'dual', look: 'samurai', stats: SAMURAI },
    // الفيل الحربي (جايبور): مخلوق (creature) يُرسم بشكله لا بشكل أمة، بحجم scale (أصغر 40% من 2.1 بطلب المستخدم)
    // وشريط دمه عند barY، وواحد فقط لكل لاعب في الوقت نفسه (limit، ومعه ما في الطوابير)
    elephant: { name: 'فيل حربي', cost: 180, seconds: 18, creature: 'elephant', scale: 1.26, barY: -28, limit: 1,
                limitText: 'لك فيل الآن',
                stats: { hp: 1800, armor: 0.3, damage: 30, attackTime: 1.6, speed: 1.3, attackRange: 1.8 } }
  }
};

// --- القوائم (القسم 12.0) ---
export const UI = {
  fadeMs: 200,                   // مدة التلاشي بين الشاشات
  // الشاشة السوداء (بطلب المستخدم): عند بدء المباراة أو متابعتها seconds تُجهَّز فيها المدينة ولا يُسمع إلا صوتا البداية
  // والتحميل، وتظهر وتختفي بسرعة (fadeMs). وintro عند تشغيل اللعبة: مكان مقدمة التطبيق لاحقاً
  blackout: { seconds: 4, fadeMs: 250 },
  intro: { seconds: 4.2, fadeMs: 400 },      // 1.2 ثم أطول بـ 3 ث (بطلب المستخدم)
  statsKey: 'gangcity.stats',    // الإحصائيات الدائمة في localStorage
  setupKey: 'gangcity.setup',    // آخر إعداد مباراة اختاره اللاعب

  // حفظ المباراة الجارية للعودة إليها لاحقاً (خانة واحدة)
  matchKey: 'gangcity.match',      // المباراة نفسها
  matchInfoKey: 'gangcity.matchInfo', // ملخص صغير يقرؤه زر "متابعة المباراة" بلا فك المباراة كلها
  matchVersion: 8,               // يُرفع عند تغيّر شكل حالة المباراة، فتُهمل الحفظات القديمة (3: الأمم، 4: الآسيوية، 5: الأوروبية، 6: الأفريقية، 7: الاقتصاد في كل الأطوار، 8: الكاتدرائية بدل محطات القطار)
  matchDecimals: 5,              // دقة الأعداد العشرية في الحفظ (تصغّر حجمه)

  // الخلفية الحية للقائمة الرئيسية: الخريطة نفسها وبضع وحدات تتجول
  menuScene: {
    mapSize: 'large',            // مدينة كبيرة: تتسع لانجراف الكاميرا بالطول والعرض
    weathers: ['day', 'day', 'snow', 'rain'],   // بلا ليل: الطبقة الداكنة تكفي
    zoom: 1.9,                   // أقل تقريب للكاميرا (يزيد على الشاشات الطويلة)
    edgeMargin: 0.3,             // هامش يبقي الكاميرا داخل المدينة فلا تظهر حافتها
    cameraSpeed: 9,              // أقصى سرعة لانجراف الكاميرا (بكسل عالم في الثانية)
    walkers: 30,                 // عدد الوحدات المتجولة
    walkArea: [0.55, 0.65],      // منطقة التجوال حول المركز (نسبة من نصف العرض، ونصف الارتفاع)
    heroShare: 0.4,              // نسبة الشخصيات المميزة بينها
    roamTiles: 7,                // أبعد مربع تمشي إليه الوحدة في الجولة الواحدة
    restSeconds: [2, 7],         // وقفة الوحدة بين جولة وأخرى (من، إلى)
    ownedShare: 0.5,             // نسبة الأحياء الملوّنة بألوان العصابات
    fps: 30,                     // معدل رسم الخلفية: يوفّر البطارية في القوائم
    maxDpr: 1.5                  // دقة الرسم: تحت طبقة داكنة لا تحتاج أكثر
  }
};

// --- اللعب المحلي (القسم 16، بطلب المستخدم): أصحاب على نفس الشبكة (واي فاي أو نقطة اتصال أحدهم) ---
// كل الأجهزة تحاكي المباراة نفسها خطوة بخطوة (lockstep)، والذي يسافر بينها أوامر اللاعبين وحدها.
// المضيف يجمع الأوامر ويحدد لكل منها تحديثاً بعد delayTicks، فتنفذها كل الأجهزة في نفس التحديث
export const NET = {
  version: 1,              // يُرفع عند تغيّر البروتوكول: الأجهزة بنسخ مختلفة لا تلعب معاً
  port: 47821,             // منفذ المضيف (TCP)، ويجرب التالي إن كان مشغولاً
  beaconPort: 47820,       // إعلان المضيف على الشبكة (UDP) ليظهر عند من يريد الانضمام
  beaconSeconds: 1,        // كل كم ثانية يُعلن المضيف عن مباراته
  // البحث أيضاً بسؤال كل عناوين الشبكة على منفذ المضيف (إن منعت الشبكة الإعلان): كل scanSeconds، ومهلة كل سؤال
  scanSeconds: 6,
  probeMs: 350,
  foundSeconds: 12,        // مباراة لم يصل خبرها منذ هذا تختفي من القائمة (أطول من جولة السؤال)
  delayTicks: 3,           // تأخير الأوامر بالتحديثات (150 ملي ث): يكفي لوصولها لكل الأجهزة قبل تنفيذها
  hashTicks: 20,           // كل كم تحديث تقارن الأجهزة بصمة المباراة، وعند الاختلاف يعيد المضيف المزامنة
  keepTicks: 60,           // التحديثات المنفذة تبقى محفوظة هذا القدر (لإعادة تنفيذها بعد إعادة المزامنة)
  catchUpAbove: 6,         // جهاز متأخر بأكثر من هذا من التحديثات يسرّع حتى يلحق...
  catchUpSteps: 12,        // ...بهذا الحد في الإطار الواحد
  camSeconds: 0.5,         // كل كم ثانية يرسل الجهاز موضع كاميرته (مستويات التفصيل تُحسب من كل الكاميرات)
  defaultView: { w: 900, h: 420 },   // مقاس شاشة افتراضي لكاميرا لاعب قبل أن يرسل موضعه
  maxNameLength: 14,       // أقصى طول لاسم اللاعب
  modes: ['conquest', 'points', 'king', 'regicide']   // الأطوار المتاحة في اللعب المحلي (أولها المختار)
};

// --- المتجر (بطلب المستخدم): الخرائط والعصابات (الأمم) تُشترى منه، والمظاهر لاحقاً ---
// المجاني مع اللاعب: العصابات الكلاسيكية الأربع (GANG_IDS) وهذه الخرائط الأربع. الأسعار تُحدد لاحقاً،
// وفي فترة الاختبار كل شيء متاح للعب بلا شراء (لا قفل في قائمة الإعداد)
export const STORE = {
  freeCities: ['arab', 'hk', 'europe', 'chicago'],   // العربية، هونغ كونغ، الأوروبية، شيكاغو
  prices: { cities: {}, sides: {} },   // السعر بمفتاح المدينة أو الأمة: فارغ حتى تُحدد الأسعار
  previewColor: 'blue'                 // لون الشخصيات في صور المتجر (من PLAYER_COLORS)
};

// --- إعدادات المباراة الافتراضية (تُستبدل باختيارات قائمة الإعداد) ---
// (تُستبدل بقائمة الإعداد في المرحلة 6)
export const MATCH_DEFAULTS = {
  mapSize: 'medium',
  weather: 'day',
  maxUnits: UNITS.maxUnitsDefault,
  players: [
    { name: 'أنت',    gang: 'crows',     color: 'blue',   isHuman: true,  team: 0 },
    { name: 'بوت 1',  gang: 'hammers',   color: 'red',    isHuman: false, team: 0, difficulty: 'medium' },
    { name: 'بوت 2',  gang: 'vipers',    color: 'green',  isHuman: false, team: 0, difficulty: 'medium' },
    { name: 'بوت 3',  gang: 'scorpions', color: 'yellow', isHuman: false, team: 0, difficulty: 'medium' }
  ]
};
