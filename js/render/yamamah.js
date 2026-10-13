// صحراء اليمامة (بطلب المستخدم): بلدة صحراوية قديمة شبه مخربة، مبانيها صور جاهزة أرسلها المستخدم
// (assets/yamamah/، مصححة الزاوية ومصغّرة مسبقاً، js/render/sprites.js) لا رسم بالكود.
// - أحياء نجدية: بيوت طين وأبراج مراقبة طينية ونخيل
// - أحياء القصور: أبراج حجرية بقباب زرقاء وقاعات وقباب وأروقة
// - واحات: نخيل وآبار وعربات
// - سور حجري بأقواس على الحافتين البعيدتين ببوابات حيث تخرج الشوارع وأبراج على الزوايا،
//   ومنهار منخفض على الحافتين القريبتين حتى لا يحجب الجنود خلفه (المولّد: buildCityWalls)
// - المعلم (برج الساعة والتلة): القبة الكبرى ومئذنة، ونافورة الساحة بئر
import { getCtx, getToneInfo, poly, circ, ln, hsh, mixc, damage } from './cityThemes.js';
import { loadSpriteSet, spriteSetReady, getSprite, drawSprite, drawSpriteBroken } from './sprites.js';

// [عرض، ارتفاع، ارتكاز x، ارتكاز y، له سطح] بالبكسل بدقة PX (sprites.js)
const ART = {
  house_a: [163, 143, 81.6, 92.9, 1],
  house_b: [163, 143, 81.6, 93, 1],
  tower_a: [116, 228, 60, 195.4, 1],
  tower_b: [115, 228, 54.8, 196.8, 1],
  round_tower: [109, 193, 54.5, 172.9, 1],
  arch_tower: [104, 179, 52, 158.7, 1],
  drum: [138, 156, 69.3, 123, 1],
  great_dome: [202, 218, 101, 177.8, 1],
  hall_a: [173, 151, 86.6, 97.5, 1],
  hall_b: [176, 178, 89.4, 120.6, 1],
  gatehouse_a: [167, 170, 82.1, 126, 1],
  gatehouse_b: [168, 179, 85, 131, 1],
  gate_i: [152, 168, 75.9, 125.7, 0],
  gate_j: [133, 159, 66.7, 120.7, 0],
  wall_j1: [117, 131, 57.4, 99.9, 0],
  wall_j2: [114, 129, 57.1, 97.8, 0],
  wall_i1: [124, 140, 62.9, 105.7, 0],
  wall_i2: [124, 141, 62.5, 105.7, 0],
  arch: [124, 212, 61.8, 176, 0],
  minaret: [38, 224, 19.1, 214.6, 1],
  rotunda: [121, 133, 60.6, 104, 0],
  watchtower: [117, 182, 58.3, 160.3, 0],
  qubba: [142, 92, 70.9, 58, 1],
  well: [76, 104, 34.9, 86, 0],
  cart_a: [87, 58, 44.7, 43, 0],
  cart_b: [87, 65, 44.5, 48.4, 0],
  barrel: [26, 31, 12.9, 25.8, 0]
};
const SET = 'yamamah';
loadSpriteSet(SET, new URL('../../assets/yamamah/', import.meta.url), ART);

const art = (name, x, y) => drawSprite(getCtx(), getSprite(SET, name), x, y, getToneInfo());
const pick = (a, b, i, j, k) => (hsh(i, j, k) < 0.5 ? a : b);

// ركام عند قاعدة المبنى (نفس ركام damage في المدن الأخرى) لنحو نصف المباني
function rubble(x, y, i, j, T, d = 7.5) {
  if (hsh(i, j, 8) >= 0.45) return;
  const dc = T.debris;
  poly([[x + 3, y + d - 1], [x + 7, y + d - 3.6], [x + 11, y + d - 2.6], [x + 8, y + d + 0.4]], dc);
  poly([[x - 10, y + 2], [x - 7, y], [x - 4, y + 2.4], [x - 7, y + 3.6]], mixc(dc, '#000000', 0.15));
}

// نخلة تمر: جذع منحني بحلقات، وسعف بوريقات، وعذوق تمر
function palm(x, y, i, j, s = 1) {
  const c = getCtx(), lean = (hsh(i, j, 720) - 0.5) * 6 * s, h = (22 + hsh(i, j, 721) * 7) * s;
  const tx = x + lean, ty = y - h;
  c.beginPath(); c.moveTo(x - 1.1 * s, y); c.quadraticCurveTo(x + lean * 0.2, y - h * 0.55, tx - 0.8 * s, ty);
  c.lineTo(tx + 0.8 * s, ty); c.quadraticCurveTo(x + lean * 0.2 + 1.6 * s, y - h * 0.55, x + 1.3 * s, y); c.closePath();
  c.fillStyle = '#8a6a45'; c.fill();
  for (let k = 1; k < 7; k++) {
    const t = k / 7, px = x + (tx - x) * t * t * 0.6 + lean * t * 0.4, py = y - h * t;
    ln(px - 1.1 * s, py, px + 1.1 * s, py - 0.4, '#6a4e30', 0.5);
  }
  const dead = hsh(i, j, 722) < 0.18, fronds = 9;
  for (let k = 0; k < fronds; k++) {
    const a = k / fronds * 6.2832 + hsh(i, j, 723) * 2, dx = Math.cos(a) * 11 * s, dy = Math.sin(a) * 4 * s + 3.5 * s;
    const mx = tx + dx * 0.55, my = ty + dy * 0.3 - 2.6 * s;
    const col = dead ? (k % 2 ? '#a8925a' : '#94804c') : (k % 2 ? '#5f8a3a' : '#4a7430');
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my, tx + dx, ty + dy);
    c.quadraticCurveTo(mx + 0.4, my + 2.2 * s, tx, ty + 1.2 * s); c.closePath();
    c.fillStyle = col; c.fill();
  }
  if (!dead) for (let k = 0; k < 3; k++) circ(tx - 2.2 * s + k * 2.2 * s, ty + 2.2 * s + (k % 2) * 0.8 * s, 1.1 * s, k % 2 ? '#b8621e' : '#c97a2a');
}

// تموجات الرمل وشجيرات صحراوية على الأرض الفارغة
function sand(x, y, i, j) {
  const c = getCtx();
  for (let k = 0; k < 2; k++) {
    const oy = (hsh(i, j, 730 + k) - 0.5) * 8, ox = (hsh(i, j, 732 + k) - 0.5) * 10;
    c.beginPath(); c.moveTo(x - 9 + ox, y + oy); c.quadraticCurveTo(x - 2 + ox, y - 2.5 + oy, x + 8 + ox, y + 1.2 + oy);
    c.strokeStyle = 'rgba(255,244,214,0.45)'; c.lineWidth = 0.8; c.stroke();
    c.beginPath(); c.moveTo(x - 8 + ox, y + 1 + oy); c.quadraticCurveTo(x - 1 + ox, y - 1.3 + oy, x + 8 + ox, y + 2.2 + oy);
    c.strokeStyle = 'rgba(140,104,60,0.22)'; c.lineWidth = 0.7; c.stroke();
  }
  if (hsh(i, j, 734) < 0.22) {             // شجيرة يابسة
    const sx = x + (hsh(i, j, 735) - 0.5) * 14, sy = y + (hsh(i, j, 736) - 0.5) * 6;
    for (let k = 0; k < 5; k++) ln(sx, sy, sx - 3 + k * 1.5, sy - 2.5 - (k % 2) * 1.2, '#7a6a3a', 0.6);
  }
}

// مشعلان على جانبي البوابة (يضيئان ليلاً: lightsAt)
const TORCH = { gateI: [[-8, -4], [6, 3]], gateJ: [[8, -4], [-6, 3]] };
function torches(kind, x, y) {
  for (const [dx, dy] of TORCH[kind]) {
    const px = x + dx, py = y + dy - 14;
    ln(px, py + 3, px, py, '#3a2a1c', 0.9);
    poly([[px - 1.3, py], [px, py - 3.6], [px + 1.3, py]], '#f0a040');
    poly([[px - 0.6, py], [px, py - 2], [px + 0.6, py]], '#ffe08a');
  }
}

// قطعة سور منهارة: صورة السور مقصوصة بخط مكسور، وركام حجارة عند قاعدتها
function broken(name, x, y, i, j, T, slope, keep = 9 + hsh(i, j, 740) * 5) {
  drawSpriteBroken(getCtx(), getSprite(SET, name), x, y, getToneInfo(), keep, slope, i * 31 + j * 17);
  for (let k = 0; k < 4; k++) {
    const ox = (hsh(i, j, 741 + k) - 0.5) * 18, oy = 3 + hsh(i, j, 745 + k) * 4;
    poly([[x + ox - 2.2, y + oy], [x + ox, y + oy - 1.6], [x + ox + 2.4, y + oy - 0.2], [x + ox + 0.4, y + oy + 1.2]], k % 2 ? '#e2d6be' : '#cbbd9f');
  }
}

export const yamamah = {
  name: 'صحراء اليمامة',
  ground: '#dbbf8b', road: '#bd9763', road2: '#b6905d', plaza: '#e6d4ad', debris: '#c4a87e', wallL: '#d2bd96', wallR: '#e4d3b0',
  car: ['#7a5a3c', '#8e6a48', '#5e4430'],      // حطام الشارع: عربات خشب لا سيارات
  ready: () => spriteSetReady(SET),
  // النوع الافتراضي (للمربعات المردومة)، وأنماط الأحياء: كل حي يأخذ نمطاً واحداً فيبدو حياً متجانساً
  pool: [['house', 40], ['watchtower', 6], ['palm', 14], ['ruin', 12], ['.', 8]],
  styles: [
    { weight: 52, pool: [['house', 46], ['watchtower', 6], ['qubba', 3], ['palm', 13], ['ruin', 12], ['.', 9]] },          // نجدي
    { weight: 33, pool: [['tower', 10], ['roundTower', 7], ['archTower', 6], ['drum', 6], ['hall', 9], ['gatehouse', 6],
                         ['qubba', 5], ['rotunda', 2], ['minaret', 2], ['house', 12], ['palm', 9], ['ruin', 10], ['.', 6]] },  // قصور
    { weight: 15, pool: [['grove', 30], ['palm', 16], ['well', 8], ['house', 16], ['watchtower', 4], ['ruin', 6], ['.', 14]] }   // واحة
  ],
  // الأحياء الصغيرة (غير القابلة للاستيلاء): بساتين نخيل وآبار وعربات
  smallPool: [['grove', 34], ['palm', 18], ['well', 6], ['cart', 6], ['.', 36]],
  // مشاعل البوابات ليلاً
  lightsAt(map, i, j, x, y) {
    const kind = map.kind[map.idx(i, j)];
    if (!TORCH[kind]) return null;
    return TORCH[kind].map(([dx, dy]) => ({ x: x + dx, y: y + dy - 16, r: 26, c: '255,160,70', a: 0.55 }));
  },
  draw: {
    house(x, y, i, j, T) {
      art(pick('house_a', 'house_b', i, j, 700), x, y);
      damage(x, y, 15, 7.5, 8, i, j, T);
    },
    // الأطلال: بيت طين منهار (الصورة نفسها مقصوصة بخط مكسور) وركام حوله
    ruin(x, y, i, j, T) {
      broken(pick('house_a', 'house_b', i, j, 700), x, y, i, j, T, 0, 3 + hsh(i, j, 742) * 5);
      rubble(x, y, i, j + 7, T);
    },
    tower(x, y, i, j, T) { art(pick('tower_a', 'tower_b', i, j, 701), x, y); rubble(x, y, i, j, T); },
    roundTower(x, y, i, j, T) { art('round_tower', x, y); rubble(x, y, i, j, T); },
    archTower(x, y, i, j, T) { art('arch_tower', x, y); rubble(x, y, i, j, T); },
    drum(x, y, i, j, T) { art('drum', x, y); rubble(x, y, i, j, T); },
    hall(x, y, i, j, T) { art(pick('hall_a', 'hall_b', i, j, 702), x, y); rubble(x, y, i, j, T); },
    gatehouse(x, y, i, j, T) { art(pick('gatehouse_a', 'gatehouse_b', i, j, 703), x, y); rubble(x, y, i, j, T); },
    qubba(x, y, i, j, T) { art('qubba', x, y); rubble(x, y, i, j, T, 6); },
    rotunda(x, y) { art('rotunda', x, y); },
    minaret(x, y, i, j, T) { art('minaret', x, y); rubble(x, y, i, j, T, 4); },
    watchtower(x, y, i, j, T) { art('watchtower', x, y); rubble(x, y, i, j, T, 6); },
    // زينة لا تُصبغ (CITY_UNTINTED): نخيل وبساتين وآبار وعربات
    palm(x, y, i, j) { palm(x, y, i, j); },
    grove(x, y, i, j) {
      palm(x - 7, y - 2, i, j + 50, 0.8);
      if (hsh(i, j, 750) < 0.7) palm(x + 6, y - 3, i + 50, j, 0.7);
      palm(x + 1, y + 3, i + 9, j + 9, 0.9);
    },
    well(x, y) { art('well', x, y); },
    cart(x, y, i, j) { art(pick('cart_a', 'cart_b', i, j, 704), x, y); },
    // السور: أقواس حجرية على الحافتين البعيدتين، وبوابات فوق الشوارع، وأبراج
    wallI(x, y, i, j) { art(pick('wall_i1', 'wall_i2', i, j, 705), x, y); },
    wallJ(x, y, i, j) { art(pick('wall_j1', 'wall_j2', i, j, 706), x, y); },
    gateI(x, y) { art('gate_i', x, y); torches('gateI', x, y); },
    gateJ(x, y) { art('gate_j', x, y); torches('gateJ', x, y); },
    wallTower(x, y) { art('round_tower', x, y); },
    // قوس قديم قائم فوق شارع يخرج من الحافة القريبة (القوس على محور i، ومعكوساً على محور j)
    archI(x, y) { art('arch', x, y); },
    archJ(x, y) { drawSprite(getCtx(), getSprite(SET, 'arch'), x, y, getToneInfo(), 1, true); },
    brokenI(x, y, i, j, T) { broken(pick('wall_i1', 'wall_i2', i, j, 705), x, y, i, j, T, 0.5); },
    brokenJ(x, y, i, j, T) { broken(pick('wall_j1', 'wall_j2', i, j, 706), x, y, i, j, T, -0.5); },
    brokenTower(x, y, i, j, T) { broken('round_tower', x, y, i, j, T, 0); },
    // المئذنة خلف القبة إلى اليسار، خارج أعمدة قياس السطح (landmarks.roofTop) فتبقى الساعة فوق القبة
    landmark(x, y) { art('minaret', x - 17, y - 8.5); art('great_dome', x, y); },
    plazaProp(x, y) { art('well', x, y); },
    // حطام الشارع (streetDebris): عربة متروكة بدل السيارة المحطمة، وبراميل هنا وهناك
    wreck(x, y, i, j) { art(pick('cart_a', 'cart_b', i, j, 761), x + (hsh(i, j, 762) - 0.5) * 6, y); },
    roadProp(x, y, i, j) {
      if (hsh(i, j, 760) >= 0.05) return;
      const n = 1 + Math.floor(hsh(i, j, 763) * 3);
      for (let k = 0; k < n; k++) art('barrel', x - 6 + k * 3.6, y + 2 - k * 1.8);
    },
    ground(x, y, i, j) { sand(x, y, i, j); },
    // آثار عجلات العربات على الشارع، باتجاهه (dash: 1 على محور i و2 على محور j)
    tile(x, y, i, j, map) {
      const dir = map ? map.dash[map.idx(i, j)] : 0;
      if (!dir) return;
      const s = dir === 1 ? 1 : -1;
      for (const o of [-2.4, 2.4]) ln(x - 11 * s, y - 5.5 + o, x + 11 * s, y + 5.5 + o, 'rgba(96,66,34,0.2)', 0.7);
    },
    tree: 'palm'
  }
};
