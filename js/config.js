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
  small:  { key: 'small',  name: 'صغيرة',  n: 26, maxPlayers: 4, specialDistricts: 2, policeStations: 2 },
  medium: { key: 'medium', name: 'متوسطة', n: 34, maxPlayers: 6, specialDistricts: 3, policeStations: 3 },
  large:  { key: 'large',  name: 'كبيرة',  n: 42, maxPlayers: 8, specialDistricts: 4, policeStations: 4 }
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
  protectedBuildings: ['Q', 'S', 'G', 'C', 'O', 'N'],  // مبانٍ لا تُفتح لعمل ممر (مقر، مستشفى، مخزن، ساعة، نافورة، مركز شرطة)
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
  hitMoment: 0.47            // لحظة الارتطام من زمن الضربة (تطابق أنميشن docs/units-art.js)
};

// --- الاستيلاء (تُستخدم في المرحلة 3) ---
export const CAPTURE = {
  pointsPerSecond: 8,         // × قوة الاستيلاء
  maxCapturePower: 6,
  decayPerSecond: 5,          // رجوع التقدم لحالة المالك عند خلو المنطقة
  groundTintAlpha: 0.30,      // نسبة صبغ أرض الحي بلون المالك
  roofTintAlpha: 0.45,        // الأسطح والأجزاء العلوية للمباني
  wallTintAlpha: 0.20,        // الجدران فقط، حتى تبقى قراءة المباني واضحة
  tintSeconds: 0.5,           // زمن الانتقال اللوني عند تغيّر المالك
  tintSteps: 10,              // درجات الانتقال (تقليل عدد الألوان المخلوطة)
  noticeSeconds: 2.5          // مدة ظهور إشعار الاستيلاء
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

export const BOT_LEVELS = ['easy', 'medium', 'hard'];

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
  maxHeightPct: 0.33             // لا تغطي أكثر من ثلث ارتفاع الشاشة
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
  volumeSteps: [0, 0.25, 0.5, 0.75, 1],   // درجات مؤشري الصوت في القائمة

  screenMargin: 40,               // هامش حول الشاشة: ما خرج عنه لا يُسمع
  heavyDamage: 20,                // ضربة بهذا الضرر فأكثر تُسمع ضربة ثقيلة
  shieldArmor: 0.35,              // هدف بهذا الدرع فأكثر يُسمع ارتطاماً بدرع

  musicPerEngaged: 0.1,           // حرارة الموسيقى = المشتبكون × هذا الرقم (بحد 1)
  musicInterval: 0.5,             // ثانية بين كل تحديث لحرارة الموسيقى
  captureTickSeconds: 1.0,        // نبضة الاستيلاء لحي اللاعب
  alertSeconds: 5.0,              // تنبيه "وحداتك تتعرض للهجوم" خارج الشاشة
  whistleSeconds: 6.0             // صافرة الشرطة عند بدء مطاردتها
};

// --- الأداء ---
export const PERFORMANCE = {
  hashCellTiles: 2,       // حجم خلية الشبكة المكانية (مربعان × مربعان)
  flowFieldMinGroup: 10,  // مجموعة أكبر من هذا تستخدم حقل تدفق بدل A* لكل وحدة
  maxLights: 140,         // أقصى عدد إضاءات تُرسم في الإطار الواحد ليلاً
  detailZoom: 1.4,        // أقل من هذا التقريب: نتجاوز التفاصيل الصغيرة (نوافذ...)
  unitDetailZoom: 1.2,    // أقل من هذا: الوحدة نقطة بسيطة (حجمها أقل من 3 بكسل أصلاً)
  fpsTaps: 3              // لمسات شريط المعلومات لإظهار مؤشر الإطارات
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
