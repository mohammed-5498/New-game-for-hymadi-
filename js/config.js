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

// --- طوابع المدن (القسم 3.9): شكل فقط، لا تغيّر قواعد اللعب ---
export const CITIES = {
  order: ['arab', 'japan', 'china', 'europe', 'norway', 'hk', 'jaipur', 'mexico', 'chicago'],
  defaultCity: 'random',
  // النرويجية: مضيق متجمد على حافة الخريطة بهذا العرض من المربعات (لا يُمشى عليه)
  water: { norway: { small: 2, medium: 2, large: 3 } },
  rorbuChance: 0.55,            // نسبة المباني المجاورة للماء التي تصير أكواخاً على أعمدة
  // أسماء قصيرة لأزرار قائمة الإعداد (الاسم الكامل تحت الصورة المصغرة)
  short: { arab: 'عربية', japan: 'يابانية', china: 'صينية', europe: 'أوروبية', norway: 'نرويجية',
           hk: 'هونغ كونغ', jaipur: 'جايبور', mexico: 'مكسيكية', chicago: 'شيكاغو' },
  thumbCycleMs: 2000,           // "عشوائي": الصورة المصغرة تتبدل بين المدن
  thumbZoom: 1.4,               // تقريب الصورة المصغرة (تُقص الأطراف)
  // هالة خفيفة خلف الجنود في المدن الداكنة فقط (هونغ كونغ) حتى يبقوا واضحين فوق الأرض والأبراج
  unitHalo: { hk: { color: 'rgba(255,255,255,0.28)', rx: 5.5, ry: 9, lift: 8 } }
};

// أنواع من pool المدن ليست مباني (أشجار وزينة): لا تُصبغ بلون المالك، كأشجار الطابع القديم
export const CITY_UNTINTED = ['palm', 'cherry', 'lantern', 'willow', 'lanterns', 'pine', 'rack', 'banyan', 'neem', 'cactus'];

// تخزين الطبقة الثابتة (الأرض والمباني والزينة) في قطع مخفية: تُرسم مرة وتُعرض الظاهرة فقط
export const CITY_CACHE = {
  chunkWorld: 128,               // ضلع القطعة بوحدات العالم (المربع 36×18)
  scales: [0.75, 1.1, 1.6, 2.4, 3.6, 5.4],   // دقات الرسم (بكسل لكل وحدة)؛ تُختار حسب التقريب
  scaleSlack: 0.85,              // تُقبل دقة أقل من المطلوب بهذا القدر قبل الانتقال للأعلى
  maxPixels: 20e6,               // أقصى مجموع بكسلات القطع المخزنة (≈ 80 ميغابايت)، والأقدم يُحذف
  frameBudgetMs: 6,              // وقت رسم القطع في الإطار الواحد (على دفعات: لا قطعة كاملة في إطار واحد)
  warmScale: 2.4,                // بداية المباراة: الظاهر يُرسم دفعة واحدة بهذه الدقة الأقل، ثم يُرفع تدريجياً
  prefetchRing: 1,               // حلقة قطع حول الشاشة تُرسم مسبقاً بالوقت الفائض
  baseScale: 0.75,               // خريطة الأرض الكاملة منخفضة الدقة: بديل مؤقت حتى تُرسم القطعة
  tintSteps: 3,                  // إعادة رسم القطعة أثناء انتقال لون المالك على 3 مراحل فقط
  reach: { side: 40, up: 110, down: 22 },  // ما قد يرسمه المربع حول مركزه (المباني ترتفع للأعلى)
  // الوحدة خلف مبنى أمامها تختفي خلفه: قصاصة المبنى من صورة المدينة تُلصق فوقها (occlusion.js)
  occlusion: {
    enabled: true,               // للقياس فقط: false يرسم الوحدات فوق كل شيء
    side: 28, down: 14,          // أقصى ما يرسمه المبنى حول مركز مربعه يميناً ويساراً وتحته
    alphaCut: 160,               // البكسل أعتم من هذا يُعد من المبنى عند قياس حدوده (من 255)
    unitSide: 7.5, unitUp: 21, unitDown: 4,  // صندوق الفرد العادي حول قدميه (الجسم والسلاح وشريط الدم)، ويكبر مع حجم الوحدة
    maxPixels: 8e6,              // أقصى مجموع بكسلات القصاصات المخزنة، والأقدم يُحذف
    budgetMs: 2                  // وقت قياس المباني وصنع قصاصات جديدة في الإطار الواحد
  }
};

// المباني الحاسمة بطراز كل مدينة: hq أعلى مبانيها للمقر، وbase مبناها العادي للشرطة والمستشفى والمخزن
export const CITY_SPECIALS = {
  arab:    { hq: 'tall',    base: 'house' },
  japan:   { hq: 'two',     base: 'house' },
  china:   { hq: 'tower2',  base: 'hutong' },
  europe:  { hq: 'row',     base: 'row' },
  norway:  { hq: 'long',    base: 'wood' },
  hk:      { hq: 'tower',   base: 'shop' },
  jaipur:  { hq: 'haveli2', base: 'haveli' },
  mexico:  { hq: 'balcony', base: 'adobe' },
  chicago: { hq: 'brick',   base: 'warehouse' }
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
  protectedBuildings: ['Q', 'S', 'G', 'C', 'O', 'N', '~'],  // لا تُفتح لعمل ممر (مقر، مستشفى، مخزن، ساعة، نافورة، مركز شرطة، ماء)
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
    colors: { dodge: '#b8f0a8', block: '#8fd0ff', back: '#ff8a7a', bump: '#ffd66e', clash: '#ffe08a', down: '#ffffff' }
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
              reinforce: false, stage: false },   // ولا ينجد فرقه المشتبكة ولا يلتئم قبل الاقتحام
    hard:   { squads: true, minSquad: 8,  focus: true, flank: true, smartUlts: 'full',
              retreat: true, twoFronts: true, raids: true, protectRanged: true, pullWounded: true,
              policeEarly: true,
              strictDefense: true, preferWeak: 3 },
    insane: { squads: true, minSquad: 10, focus: true, flank: true, smartUlts: 'full',
              retreat: true, twoFronts: true, raids: true, protectRanged: true, pullWounded: true,
              policeEarly: true,
              strictDefense: true, preferWeak: 3,
              spawnFactor: 0.75,       // ظهور أسرع 25% (زمن الظهور × 0.75)
              chargeFactor: 1.25 }     // شحن الضربات أسرع 25%
  },

  // الطبقة الاستراتيجية (11.1)
  powerRadius: 5,             // نصف قطر خريطة القوى حول كل حي
  unitValue: { unit: 1, hero: 3, champion: 5 },   // × نسبة الدم الحالية
  attackRatio: 1.3,           // لا يُهاجَم حي إلا بقوة ≥ 1.3 × قوة المدافعين
  retreatRatio: 0.6,          // تنسحب الفرقة إن نقصت قوتها عن 0.6 × قوة الأعداء حولها
  defenseRatio: 1.2,          // الدفاع بلا إفراط: 1.2 × قوة المهاجم
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
  stage: true,                // الالتئام قبل الاقتحام
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
  maxHeightPct: 0.33             // لا تغطي أكثر من ثلث ارتفاع الشاشة
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

// --- أطوار اللعب (القسم 9.5) ---
export const gameModes = {
  order: ['conquest', 'points', 'regicide', 'king', 'survival'],
  defaultMode: 'conquest',

  // 9.5.1 الطور الأصلي: بلا تغيير
  conquest: {
    name: 'السيطرة الكاملة',
    desc: 'آخر عصابة تبقى في المدينة تفوز.'
  },

  // 9.5.2 الوقت بالنقاط
  points: {
    name: 'الوقت بالنقاط',
    desc: 'كل حي تملكه يعطيك نقطة كل ثانية، والمميز نقطتين. الأعلى نقاطاً عند انتهاء الوقت يفوز.',
    minutes: [5, 10, 15, 20],
    defaultMinutes: 10,
    pointPerDistrict: 1,        // نقطة في الثانية لكل حي
    pointPerSpecial: 2,         // والحي المميز نقطتان
    finalSeconds: 60,           // الدقيقة الأخيرة
    finalMultiplier: 2,         // النقاط مضاعفة فيها
    armyWeights: { unit: 1, hero: 3, champion: 5 },   // حسم التعادل: الأكبر جيشاً
    // البوتات: توسع مبكر وقوي، ودفاع أكثر من الهجوم، وفي الدقيقة الأخيرة أضعف حي للمتصدر
    botExpandGroup: 2,          // مجموعات توسع أصغر = أحياء أكثر في وقت واحد
    botDefenseBoost: 1.5,       // مدافعون أكثر لكل مهاجم
    botAttackArmyFactor: 1.6    // جيش أكبر قبل مهاجمة الخصوم
  },

  // 9.5.3 حماية الزعيم
  regicide: {
    name: 'حماية الزعيم',
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

// --- القوائم (القسم 12.0) ---
export const UI = {
  fadeMs: 200,                   // مدة التلاشي بين الشاشات
  statsKey: 'gangcity.stats',    // الإحصائيات الدائمة في localStorage
  setupKey: 'gangcity.setup',    // آخر إعداد مباراة اختاره اللاعب

  // حفظ المباراة الجارية للعودة إليها لاحقاً (خانة واحدة)
  matchKey: 'gangcity.match',      // المباراة نفسها
  matchInfoKey: 'gangcity.matchInfo', // ملخص صغير يقرؤه زر "متابعة المباراة" بلا فك المباراة كلها
  matchVersion: 2,               // يُرفع عند تغيّر شكل حالة المباراة، فتُهمل الحفظات القديمة
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
