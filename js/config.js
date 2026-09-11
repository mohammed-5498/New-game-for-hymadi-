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
export const MAP_SIZES = {
  small:  { key: 'small',  name: 'صغيرة',  n: 26, maxPlayers: 4, specialDistricts: 2 },
  medium: { key: 'medium', name: 'متوسطة', n: 34, maxPlayers: 6, specialDistricts: 3 },
  large:  { key: 'large',  name: 'كبيرة',  n: 42, maxPlayers: 8, specialDistricts: 4 }
};

// --- الكاميرا ---
export const CAMERA = {
  minZoom: 0.8,
  maxZoom: 4.5,
  startZoom: 2.2,
  wheelStep: 1.12       // مقدار التكبير بعجلة الماوس
};

// --- اللمس ---
export const INPUT = {
  tapMovePx: 8,         // أقل من هذا يُعتبر لمسة سريعة لا سحباً
  unitTapRadiusPx: 22   // دقة اللمس على وحدة
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
  maxTries: 40                // محاولات التوليد قبل الاستسلام
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
  crows:     { id: 'crows',     name: 'الغربان',  heroes: ['runner', 'biker'],   unit: { speed: 2.5, capturePower: 1.25 } },
  hammers:   { id: 'hammers',   name: 'المطارق',  heroes: ['armored', 'smasher'], unit: { hp: 120, armor: 0.15 } },
  // الأفاعي يرمون حجارة من بعيد، ويقاتلون بالأيدي إذا اقترب العدو
  vipers:    { id: 'vipers',    name: 'الأفاعي',  heroes: ['sniper', 'firebomber'], unit: {
    damage: 7, attackTime: 1.4, attackRange: 3.5, visionRange: 4.5,
    projectile: 'stone', meleeRange: 1.5, meleeDamage: 8, meleeAttackTime: 1.0
  } },
  scorpions: { id: 'scorpions', name: 'العقارب',  heroes: ['boss', 'medic'],     unit: { spawnMultiplier: 0.8 } }
};

export const GANG_IDS = ['crows', 'hammers', 'vipers', 'scorpions'];

// --- الشخصيات المميزة: شخصيتان لكل عصابة ---
// كل شخصية تبدأ من الوحدة الأساسية ثم تُطبق قيمها فوقها
export const HEROES = {
  // الغربان
  runner: {
    id: 'runner', name: 'الراكض', gang: 'crows',
    stats: { hp: 90, damage: 8, speed: 2.8, capturePower: 3 }
  },
  biker: {
    id: 'biker', name: 'راكب الدراجة', gang: 'crows',
    stats: { hp: 110, damage: 14, attackTime: 1.2, speed: 4.2, visionRange: 6 }
  },

  // المطارق
  armored: {
    id: 'armored', name: 'المصفّح', gang: 'hammers',
    stats: { hp: 320, armor: 0.50, damage: 8, attackTime: 1.2, speed: 1.6 }
  },
  smasher: {
    id: 'smasher', name: 'المحطِّم', gang: 'hammers',
    // ضربته تصيب كل الأعداء داخل دائرة نصف قطرها مربع واحد حول الهدف
    stats: { hp: 200, armor: 0.20, damage: 28, attackTime: 2.2, attackRange: 1.2, speed: 1.8, splashRadius: 1 }
  },

  // الأفاعي (زمن الضربة القريبة غير مذكور في الوصف، فيبقى على الأساس 1.0 ث)
  sniper: {
    id: 'sniper', name: 'القناص', gang: 'vipers',
    stats: {
      hp: 80, damage: 26, attackTime: 2.5, attackRange: 7, visionRange: 7.5, speed: 2.0,
      projectile: 'arrow', meleeRange: 1.5, meleeDamage: 4, meleeAttackTime: 1.0
    }
  },
  firebomber: {
    id: 'firebomber', name: 'رامي النار', gang: 'vipers',
    // الزجاجة لا تضر مباشرة، بل تشعل الأرض
    stats: {
      hp: 90, damage: 0, attackTime: 5, attackRange: 4, visionRange: 4.5, speed: 2.1,
      projectile: 'bottle', fire: { radius: 1.2, duration: 4, damagePerSecond: 6 },
      meleeRange: 1.5, meleeDamage: 5, meleeAttackTime: 1.0
    }
  },

  // العقارب
  boss: {
    id: 'boss', name: 'الزعيم', gang: 'scorpions',
    stats: { hp: 160, armor: 0.10, damage: 12, speed: 2.0, aura: { radius: 3, damageBonus: 0.20 } }
  },
  medic: {
    id: 'medic', name: 'الطبيب', gang: 'scorpions',
    stats: { hp: 100, damage: 5, speed: 2.2, heal: { radius: 3, perSecond: 10 } }
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
  hitFlashTime: 0.15,        // ومضة الوحدة عند تلقي ضربة
  deathTime: 1.0             // زمن سقوط الوحدة الميتة واختفائها
};

// --- الاستيلاء (تُستخدم في المرحلة 3) ---
export const CAPTURE = {
  pointsPerSecond: 8,         // × قوة الاستيلاء
  maxCapturePower: 6,
  decayPerSecond: 5,          // رجوع التقدم لحالة المالك عند خلو المنطقة
  groundTintAlpha: 0.30,      // نسبة صبغ أرض الحي بلون المالك
  noticeSeconds: 2.5          // مدة ظهور إشعار الاستيلاء
};

// --- الظهور ---
export const SPAWN = {
  normalBase: 14,             // max(4, 14 - (D-1)*1) ثانية
  normalPerDistrict: 1,
  normalMin: 4,
  heroBase: 75,               // max(30, 75 - (D-1)*3) ثانية (المرحلة 4)
  heroPerDistrict: 3,
  heroMin: 30,
  spotSearchTiles: 6          // عدد المربعات المفحوصة حول العلم لمكان الظهور
};

// --- الطقس: الشكل الآن، والتأثير على اللعب في المرحلة 7 ---
export const WEATHER = {
  day:   { key: 'day',   name: 'نهار',      overlay: null,                     particles: 0,   visionMul: 1,    speedMul: 1,    rangedHitChance: 1 },
  night: { key: 'night', name: 'ليل',       overlay: 'rgba(10,16,42,0.62)',    particles: 0,   visionMul: 0.75, speedMul: 1,    rangedHitChance: 1 },
  snow:  { key: 'snow',  name: 'ثلج',       overlay: 'rgba(225,235,245,0.12)', particles: 110, visionMul: 1,    speedMul: 0.85, rangedHitChance: 1 },
  rain:  { key: 'rain',  name: 'مطر خفيف',  overlay: 'rgba(45,60,80,0.30)',    particles: 150, visionMul: 1,    speedMul: 1,    rangedHitChance: 0.8 }
};

export const WEATHER_KEYS = ['day', 'night', 'snow', 'rain'];

// --- إعدادات المباراة المؤقتة للمرحلة 1 ---
// (تُستبدل بقائمة الإعداد في المرحلة 6)
export const MATCH_DEFAULTS = {
  mapSize: 'medium',
  weather: 'day',
  maxUnits: UNITS.maxUnitsDefault,
  players: [
    { name: 'أنت',    gang: 'crows',     color: 'blue',   isHuman: true,  team: 0 },
    { name: 'بوت 1',  gang: 'hammers',   color: 'red',    isHuman: false, team: 0 },
    { name: 'بوت 2',  gang: 'vipers',    color: 'green',  isHuman: false, team: 0 },
    { name: 'بوت 3',  gang: 'scorpions', color: 'yellow', isHuman: false, team: 0 }
  ]
};
