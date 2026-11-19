// زينة المدن صوراً (GAME_SPEC 18.6): كل ما ترسمه المدينة اليوم بالكود من زينة وأرضيات، وثلاث قطع جديدة لكل مدينة،
// ليرسمها المستخدم صوراً. ليست في اللعبة: render.cjs يرسمها على قالب ثابت بنقطة ارتكاز مركز المربع.
// كل مدخل: { city ('_' للعام)، cat، name، draw(x, y) حول مركز المربع، أو img من الحزمة، وunder للأرضيات الشفافة }
import { THEMES, poly, circ, ln, rc, el, box, cyl, cone, glow, getCtx, streetDebris, hsh, setThemeContext } from '/js/render/cityThemes.js';
import '/js/render/cityRender.js';
import { laneDecor, drawLaneDecor, drawRoundaboutIsland, streetPalm } from '/js/render/openCity.js';
import { drawFeaturePlaza } from '/js/render/featureArt.js';

const TAU = Math.PI * 2;
const at = (x, y, a, b) => [x + (a - b) * 18, y + (a + b) * 9];
const diamond = (x, y, c) => poly([[x - 18, y], [x, y - 9], [x + 18, y], [x, y + 9]], c);
const shade = (x, y, rx = 4, ry = 1.8) => el(x, y + 0.6, rx, ry, 'rgba(0,0,0,0.22)');
const line = (pts, c, w) => { const g = getCtx(); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); };
const stroke = (fn, c, w) => { const g = getCtx(); g.beginPath(); fn(g); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); };
const light = (x, y, r = 12, c = 'rgba(255,205,120,0.45)') => glow(x, y, r, c);

// المعلّقة: عمودان على جانبي المربع (±14) وحبل مرتخٍ بينهما، وقطع على الحبل بالتساوي
const curve = (t, h, sag) => [-14 + 28 * t, -h + 4 * sag * t * (1 - t)];
function hanger(x, y, { h = 17, sag = 5, pole = '#4a3a2e', rope = '#3a2e24', n = 8, item }) {
  shade(x - 14, y + 1, 1.6, 0.8); shade(x + 14, y + 1, 1.6, 0.8);
  ln(x - 14, y + 1, x - 14, y - h - 1, pole, 0.9); ln(x + 14, y + 1, x + 14, y - h - 1, pole, 0.9);
  stroke(g => { g.moveTo(x - 14, y - h); g.quadraticCurveTo(x, y - h + 2 * sag, x + 14, y - h); }, rope, 0.4);
  for (let k = 0; k < n; k++) { const [px, py] = curve((k + 0.5) / n, h, sag); item(x + px, y + py, k); }
}
const pennant = cs => (px, py, k) => poly([[px - 1.5, py], [px + 1.5, py], [px, py + 3.6]], cs[k % cs.length]);
const cloth = (cs, w = 1.6, l = 5) => (px, py, k) => { poly([[px - w, py], [px + w, py], [px + w, py + l], [px - w, py + l - 0.6]], cs[k % cs.length]); };
const lanternAt = (cs, r = 1.3) => (px, py, k) => { ln(px, py, px, py + 1, '#2b2420', 0.3); el(px, py + 2.4, r, r * 1.25, cs[k % cs.length]); rc(px - r * 0.5, py + 0.9, r, 0.5, '#c9a046'); };
// عمود إنارة بفانوس وضوء
function lampPost(x, y, h, post, lamp, { arm = 0, glowC } = {}) {
  shade(x, y, 2.2, 1);
  ln(x, y, x, y - h, post, 1);
  if (arm) ln(x, y - h, x + arm, y - h, post, 0.8);
  const lx = x + arm;
  light(lx, y - h + 2, 13, glowC);
  lamp(lx, y - h);
}

// ================= ما في اللعبة الآن =================
export function existing(PAL, MAN) {
  const out = [];
  const add = (city, cat, name, draw, extra = {}) => out.push({ city, cat, name, draw, ...extra });
  const cities = Object.keys(MAN.cities);
  // الأرضيات والخطوط العامة (فوق أرض الشارع في المعاينة)
  const ROAD = '#8b8478';
  const side = (da, db) => (x, y) => {
    const f = 0.2, p = (u, w) => at(x, y, da ? da * u : w, db ? db * u : w);
    const e1 = p(0.5, -0.5), e2 = p(0.5, 0.5), e3 = p(0.5 - f, 0.5), e4 = p(0.5 - f, -0.5);
    poly([e1, e2, e3, e4], 'rgba(255,255,255,0.16)');
    ln(e4[0], e4[1], e3[0], e3[1], 'rgba(0,0,0,0.28)', 0.6);
  };
  add('_', 'ground', 'رصيف الضلع الأيمن الأمامي', side(1, 0), { under: ROAD });
  add('_', 'ground', 'رصيف الضلع الأيسر الأمامي', side(0, 1), { under: ROAD });
  add('_', 'ground', 'رصيف الضلع الأيسر الخلفي', side(-1, 0), { under: ROAD });
  add('_', 'ground', 'رصيف الضلع الأيمن الخلفي', side(0, -1), { under: ROAD });
  const cross = along => (x, y) => { for (const o of [-0.3, 0, 0.3]) { const s = along ? at(x, y, -0.28, o) : at(x, y, o, -0.28), e = along ? at(x, y, 0.28, o) : at(x, y, o, 0.28); ln(s[0], s[1], e[0], e[1], 'rgba(236,232,220,0.62)', 1.5); } };
  add('_', 'ground', 'ممر مشاة باتجاه i', cross(true), { under: ROAD });
  add('_', 'ground', 'ممر مشاة باتجاه j', cross(false), { under: ROAD });
  const C = '#c9bd85';
  add('_', 'ground', 'خط منتصف الشارع (1)', (x, y) => ln(x - 4, y - 2, x + 4, y + 2, C, 1), { under: ROAD });
  add('_', 'ground', 'خط منتصف الشارع (2)', (x, y) => ln(x + 4, y - 2, x - 4, y + 2, C, 1), { under: ROAD });
  add('_', 'ground', 'خط بين حارتين (3)', (x, y) => ln(x - 13, y + 2.5, x - 5, y + 6.5, C, 1), { under: ROAD });
  add('_', 'ground', 'خط بين حارتين (4)', (x, y) => ln(x + 5, y + 6.5, x + 13, y + 2.5, C, 1), { under: ROAD });
  add('_', 'ground', 'شق في الشارع', (x, y) => line([[x - 8, y - 1], [x - 3, y + 1.5], [x + 1, y], [x + 6, y + 2.5]], 'rgba(20,16,12,0.35)', 0.5), { under: ROAD });
  const lane = alongI => (x, y) => {
    const p = (u, w) => alongI ? at(x, y, u, w) : at(x, y, w, u);
    for (const u of [-0.25, 0.25]) { const s = p(u, -0.42), e = p(u, 0.42); ln(s[0], s[1], e[0], e[1], 'rgba(0,0,0,0.13)', 0.5); }
    for (const w of [-0.42, 0.42]) { const s = p(-0.5, w), e = p(0.5, w); ln(s[0], s[1], e[0], e[1], 'rgba(255,255,255,0.24)', 0.7); }
  };
  add('_', 'ground', 'ممر مرصوف بين المباني (i)', lane(true), { under: '#b8ad94' });
  add('_', 'ground', 'ممر مرصوف بين المباني (j)', lane(false), { under: '#b8ad94' });
  add('_', 'ground', 'رصف ساحة المبنى المميز', (x, y) => {
    line([[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6], [x - 12, y]], 'rgba(255,226,150,0.32)', 0.6);
    ln(x - 6, y - 3, x + 6, y + 3, 'rgba(255,226,150,0.32)', 0.6); ln(x + 6, y - 3, x - 6, y + 3, 'rgba(255,226,150,0.32)', 0.6);
  }, { under: '#c8b994' });
  add('_', 'ground', 'خصل عشب على أرض الحي', (x, y) => { for (const [dx, dy] of [[-6, -1], [4, 2], [-1, 3], [7, -2]]) for (const a of [-0.5, 0, 0.5]) ln(x + dx, y + dy, x + dx + a * 1.4, y + dy - 1.6, 'rgba(70,120,50,0.55)', 0.45); }, { under: '#8d9277' });
  add('_', 'ground', 'حصى على أرض الحي (المدن الجافة)', (x, y) => { for (const [dx, dy] of [[-6, -1], [4, 2], [-1, 3], [7, -2]]) el(x + dx, y + dy, 1, 0.45, 'rgba(110,88,60,0.45)'); }, { under: '#d4bd92' });
  add('_', 'ground', 'حلقة الدوار المتقطعة', (x, y) => { const g = getCtx(); g.setLineDash([4, 3]); g.beginPath(); g.ellipse(x, y - 9, 38, 19, 0, 0, TAU); g.strokeStyle = 'rgba(240,236,224,0.7)'; g.lineWidth = 0.9; g.stroke(); g.setLineDash([]); }, { under: '#4f4c48', underScale: 2.3 });

  // زينة الشوارع العامة
  const fake = city => ({ city, kind: ['lane_i'], idx: () => 0 });
  const laneItem = (city, kind) => {
    for (let i = 0; i < 400; i++) {
      const d = laneDecor(fake(city), i, 3);
      if (d && d.kind === kind) { const [ox, oy] = at(0, 0, d.a, d.b); return (x, y) => drawLaneDecor(fake(city), i, 3, x - ox, y - oy); }
    }
    return null;
  };
  add('_', 'street', 'عمود إنارة الممرات', laneItem('europe', 'lamp'));
  add('_', 'street', 'حوض زهور', laneItem('europe', 'planter'));
  add('_', 'street', 'مقعد', laneItem('europe', 'bench'));
  add('_', 'street', 'شجرة رصيف', (x, y) => { el(x, y + 0.6, 4.2, 1.8, 'rgba(0,0,0,0.22)'); rc(x - 0.8, y - 7, 1.6, 7, '#5b4636'); circ(x, y - 10.5, 4.6, '#5f8a44'); circ(x - 2, y - 12, 3.2, '#6f9a52'); circ(x + 2.2, y - 9.6, 2.6, '#5f8a44'); });
  add('_', 'street', 'نخلة رصيف', (x, y) => streetPalm(x, y, 1, 1));
  const debris = (lo, hi) => { for (let i = 0; i < 4000; i++) { const r = hsh(i, 1, 20); if (r >= lo && r < hi) return (x, y) => streetDebris(x, y, i, 1, THEMES.europe); } };
  add('_', 'street', 'سيارة محطمة', debris(0, 0.07));
  add('_', 'street', 'برميل نار (يضيء ليلاً)', debris(0.07, 0.12));
  add('_', 'street', 'بقعة زيت', debris(0.12, 0.24));
  add('_', 'street', 'ركام', debris(0.24, 0.3));
  add('_', 'street', 'أكياس رمل', debris(0.3, 0.33));

  // لكل مدينة
  const LOCAL = { paris: ['terrace', 'طاولة مقهى على الممر'], europe: ['terrace', 'طاولة مقهى على الممر'], rothenburg: ['stall', 'بسطة سوق'], shibam: ['souq', 'بسطة سوق'], chicago: ['newsstand', 'كشك جرائد'] };
  for (const city of cities) {
    const T = THEMES[city], M = MAN.cities[city];
    // الأرضيات بألوان المدينة
    add(city, 'ground', 'أرض الشارع', (x, y) => { diamond(x, y, M.colors.road); if (T.draw.tile) T.draw.tile(x, y, 1, 1, { dash: [1], idx: () => 0 }); });
    add(city, 'ground', 'أرض الشارع (المربع المجاور)', (x, y) => { diamond(x, y, M.colors.road2); if (T.draw.tile) T.draw.tile(x, y, 2, 1, { dash: [1], idx: () => 0 }); });
    add(city, 'ground', 'أرض الحي', (x, y) => diamond(x, y, M.colors.ground));
    add(city, 'ground', 'أرض الساحة', (x, y) => diamond(x, y, M.colors.plaza));
    if (M.colors.water) {
      add(city, 'ground', 'الماء', (x, y) => { diamond(x, y, M.colors.water); for (let k = 0; k < 3; k++) ln(x - 8 + k * 5, y - 2 + k * 1.5, x - 3 + k * 5, y - 0.5 + k * 1.5, 'rgba(255,255,255,0.18)', 0.6); });
      // ما يطفو على الماء: قوارب وجليد (أشكال مختلفة من دالة المدينة)
      if (T.draw.water) {
        const seen = new Set();
        for (let i = 0; i < 300 && seen.size < 3; i++) {
          const sig = boatSig(T, i);
          if (sig && !seen.has(sig)) { seen.add(sig); add(city, 'street', 'قارب أو ما يطفو على الماء', (x, y) => T.draw.water(x, y, i, 2)); }
        }
      }
    }
    // الأشجار والقطع الكبيرة من الحزمة
    for (const r of M.images) {
      if (r.group === 'prop' && (r.variant || 1) === 1) add(city, 'tree', PROP_NAMES[r.kind] || r.kind, null, { img: r });
    }
    // زينة الشارع بطابع المدينة: أشكال مختلفة (حتى اثنين)
    if (T.draw.roadProp && city !== 'yamamah') {
      const seen = new Set();
      for (let i = 0; i < 60 && seen.size < 2; i++) for (let j = 0; j < 60 && seen.size < 2; j++) {
        const sig = probe(() => T.draw.roadProp(0, 0, i, j));
        if (sig && !seen.has(sig)) { seen.add(sig); add(city, 'street', [].concat(ROAD_NAMES[city] || 'زينة الشارع')[seen.size - 1] || 'زينة الشارع', (x, y) => T.draw.roadProp(x, y, i, j)); }
      }
    }
    if (LOCAL[city]) add(city, 'street', LOCAL[city][1], laneItem(city, LOCAL[city][0]));
    if (city === 'hk') add(city, 'street', 'عمود إنارة الممرات (نيون)', laneItem('hk', 'lamp'));
    if (city === 'chicago' || city === 'hk') add(city, 'street', 'شجرة رصيف', (x, y) => {
      const c = city === 'hk' ? ['#3a2f28', '#2f5a3a', '#3a6a44'] : ['#4a3a2e', '#4f6b3a', '#5f7d45'];
      el(x, y + 0.6, 4.2, 1.8, 'rgba(0,0,0,0.22)'); rc(x - 0.8, y - 7, 1.6, 7, c[0]); circ(x, y - 10.5, 4.6, c[1]); circ(x - 2, y - 12, 3.2, c[2]); circ(x + 2.2, y - 9.6, 2.6, c[1]);
    });
    if (T.car) add(city, 'street', 'سيارة محطمة بلون المدينة', (x, y) => streetDebris(x, y, carTile(), 1, T));
    if (['hk', 'paris', 'rothenburg'].includes(city)) add(city, 'street', 'جزيرة الدوار', (x, y) => drawRoundaboutIsland(x, y, city));
    // زينة أركان ساحة المبنى المميز
    for (const r of M.images) {
      if (r.group !== 'feature' || (r.footprint || 2) < 2) continue;
      const n = 100, fmap = { n, districtOf: () => ({ featureBig: true, featureTile: 12 + 12 * n, feature: r.kind }) };
      add(city, 'street', 'زينة ركن ساحة المبنى المميز', (x, y) => drawFeaturePlaza(fmap, 10, 10, x, y));
    }
  }
  return out;
}
const carTile = () => { for (let i = 0; i < 4000; i++) if (hsh(i, 1, 20) < 0.07) return i; };
// بصمة ما ترسمه دالة على لوحة صغيرة (لاختيار أشكال مختلفة)، أو null إن لم ترسم شيئاً
let probeCanvas;
function probe(fn) {
  const g = getCtx(), c = probeCanvas ||= Object.assign(document.createElement('canvas'), { width: 80, height: 80 });
  const p = c.getContext('2d', { willReadFrequently: true });
  p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, 80, 80); p.setTransform(1, 0, 0, 1, 40, 55);
  setThemeContext(p, 7);
  try { fn(); } finally { setThemeContext(g, 7); }
  const d = p.getImageData(0, 0, 80, 80).data;
  let n = 0, x0 = 80, y0 = 80, x1 = 0, y1 = 0;
  for (let k = 3; k < d.length; k += 4) if (d[k] > 8) { n++; const q = (k - 3) / 4, x = q % 80, y = (q / 80) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return n ? `${x1 - x0}x${y1 - y0}` : null;
}
// القارب: ما يرسم فوق الموج وحده (الموج وحده أقل من 4 وحدات ارتفاعاً)
function boatSig(T, i) {
  const s = probe(() => T.draw.water(0, 0, i, 2));
  return s && +s.split('x')[1] > 4 ? s : null;
}

const ROAD_NAMES = {
  europe: 'عمود إنارة', rothenburg: 'عمود إنارة', birmingham: 'عمود إنارة', laboca: 'عمود إنارة', rio: 'عمود إنارة',
  hk: ['انعكاس نيون على الأرض', 'انعكاس نيون على الأرض'], jaipur: 'إكليل زهور القطيفة بين عمودين', mexico: 'أعلام ورق مخرّم بين عمودين',
  chicago: 'خط على الشارع', shibam: 'سلك فوق الشارع', diriyah: 'مشعل', meroe: 'مشعل', cairo: 'فانوس على عمود', kaifeng: 'فانوس أحمر على عمود',
  gyeongju: 'فانوس حجري', paris: ['مدخل مترو آرت نوفو', 'عمود إنارة'], gondar: 'حجارة', kano: 'أعلام قماش ملونة', tenoch: 'راية',
};
const PROP_NAMES = {
  palm: 'نخلة', pine: 'صنوبرة', cherry: 'شجرة كرز', lantern: 'فانوس حجري', lanterns: 'حبل فوانيس', willow: 'صفصافة', tree: 'شجرة',
  rack: 'حامل سمك', banyan: 'شجرة بانيان', neem: 'شجرة نيم', cactus: 'صبار', acacia: 'أكاسيا', baobab: 'باوباب', dye: 'حفرة صباغة',
  ptree: 'شجرة باريسية', rtree: 'شجرة', lamp: 'عمود إنارة', crane: 'رافعة ميناء', ahuejote: 'شجرة أهويخوتي', chinampa: 'تشينامبا',
  archI: 'قوس السور', archJ: 'قوس السور', brokenI: 'سور منهار', brokenJ: 'سور منهار', brokenTower: 'برج منهار', cart: 'عربة',
  gateI: 'بوابة السور', gateJ: 'بوابة السور', grove: 'بستان', wallI: 'السور', wallJ: 'السور', wallTower: 'برج السور', well: 'بئر',
};

// ================= الزينة الجديدة: ثلاث لكل مدينة =================
// المعلّقة فوق الشارع، والضوء (يضيء ليلاً)، وقطعة الأرض. بألوان المدينة (P: ستة ألوان من صور مبانيها، من الأغمق للأفتح)
export function proposed(PAL) {
  const out = [];
  const add = (city, slot, name, draw) => out.push({ city, cat: 'new', slot, name, draw: (x, y) => draw(x, y, PAL[city]) });
  const hang = (city, name, f) => add(city, 'hang', name, f), lit = (city, name, f) => add(city, 'light', name, f), gnd = (city, name, f) => add(city, 'ground', name, f);

  // ---------- العربية ----------
  hang('shibam', 'حبل أقمشة يمنية ملونة', (x, y, P) => hanger(x, y, { pole: P[1], n: 6, item: (px, py, k) => {
    cloth(['#b8322a', '#2e6a8a', '#e0b03a', '#3a7a4a', '#7a2e5a', '#e8dcc0'], 1.9, 5.5)(px, py, k);
    for (let f = -1; f <= 1; f++) ln(px + f * 1.2, py + 5.2, px + f * 1.2, py + 6.4, '#5a3a22', 0.3);
  } }));
  lit('shibam', 'فانوس نحاسي على عمود خشبي', (x, y, P) => lampPost(x, y, 15, P[1], (lx, ly) => {
    ln(lx, ly, lx + 3, ly, P[1], 0.8); ln(lx + 3, ly, lx + 3, ly + 1.4, '#2b2420', 0.3);
    poly([[lx + 1.6, ly + 1.4], [lx + 4.4, ly + 1.4], [lx + 4, ly + 5], [lx + 2, ly + 5]], '#c8913a'); rc(lx + 2.3, ly + 2.2, 1.4, 2.2, '#ffe2a0');
  }, { glowC: 'rgba(255,190,110,0.5)' }));
  gnd('shibam', 'زير ماء على حامل خشبي', (x, y, P) => {
    shade(x, y, 4, 1.8); box(x, y, 3.4, 1.7, 3, P[1], P[2], P[3]);
    el(x, y - 7, 3, 3.6, '#a86a3a'); el(x - 0.8, y - 8, 1.2, 2, 'rgba(255,220,180,0.25)'); el(x, y - 10.5, 1.6, 0.7, '#7a4a28');
    el(x + 5, y + 1, 1.2, 0.7, '#8a5a30');
  });
  hang('diriyah', 'مظلة سدو بين جذعي نخل', (x, y, P) => {
    for (const s of [-1, 1]) { ln(x + s * 14, y + 1, x + s * 14, y - 18, '#7a5a3a', 1.4); for (let k = 0; k < 6; k++) ln(x + s * 14 - 0.7, y - k * 3, x + s * 14 + 0.7, y - k * 3 - 0.6, '#5a4028', 0.3); }
    const band = (o, c) => poly([[x - 14, y - 17 + o], [x, y - 13 + o], [x + 14, y - 17 + o], [x + 14, y - 15.6 + o], [x, y - 11.6 + o], [x - 14, y - 15.6 + o]], c);
    band(0, '#8a1f1a'); band(1.4, '#efe6d2'); band(2.8, '#1f1a18'); band(4.2, '#c8322a');
    for (let k = 0; k < 7; k++) { const px = x - 12 + k * 4; poly([[px, y - 10.6 - Math.abs(k - 3) * 0.2], [px + 1, y - 9], [px + 2, y - 10.6 - Math.abs(k - 3) * 0.2]], '#efe6d2'); }
  });
  lit('diriyah', 'كانون جمر ودلة قهوة', (x, y, P) => {
    shade(x, y, 4.4, 2); light(x, y - 3, 12, 'rgba(255,140,60,0.45)');
    box(x, y, 4, 2, 2.4, P[1], P[2], '#3a2a1e'); el(x - 1, y - 2.6, 1.6, 0.7, '#ff7a2a'); el(x + 1.2, y - 2.2, 1.2, 0.5, '#ffb04a');
    cyl(x + 1, y - 2.6, 1.3, 3, '#c8a050', '#e0bc6a'); poly([[x + 2.2, y - 4.8], [x + 4.4, y - 6.4], [x + 2.4, y - 5.4]], '#c8a050'); circ(x + 1, y - 6, 0.6, '#e0bc6a');
  });
  gnd('diriyah', 'جلسة أرضية بسدو', (x, y, P) => {
    shade(x, y, 7, 3); poly([[x - 9, y], [x, y - 4.5], [x + 9, y], [x, y + 4.5]], '#8a1f1a');
    for (let k = -2; k <= 2; k++) ln(x - 7 + Math.abs(k), y + k * 0.9, x + 7 - Math.abs(k), y + k * 0.9 - 0.2, k % 2 ? '#efe6d2' : '#1f1a18', 0.5);
    box(x - 5, y - 1, 2.4, 1.2, 1.6, '#3a5a8a', '#4a6a9a', '#5a7aaa'); box(x + 4, y - 2.4, 2.4, 1.2, 1.6, '#c8a050', '#d8b060', '#e8c070');
    el(x + 0.5, y + 1, 1.6, 0.8, '#c8a050'); cyl(x + 0.5, y + 0.6, 0.5, 1, '#efe6d2', '#ffffff');
  });
  hang('cairo', 'فوانيس رمضان على حبل', (x, y, P) => hanger(x, y, { pole: P[0], n: 7, item: (px, py, k) => {
    if (k % 2) { pennant(['#c8322a', '#2e8b57', '#e0b03a'])(px, py, k >> 1); return; }
    ln(px, py, px, py + 0.8, '#2b2420', 0.3); poly([[px - 1.3, py + 1.6], [px, py + 0.8], [px + 1.3, py + 1.6], [px + 1.1, py + 4], [px, py + 4.8], [px - 1.1, py + 4]], ['#e0b03a', '#c8322a', '#2e8b57', '#3a6ab0'][(k >> 1) % 4]);
  } }));
  lit('cairo', 'فانوس رمضان كبير قائم', (x, y, P) => {
    shade(x, y, 3.4, 1.5); light(x, y - 8, 15, 'rgba(255,200,110,0.5)');
    poly([[x - 3, y - 1], [x + 3, y - 1], [x + 2, y + 0.6], [x - 2, y + 0.6]], '#7a5a2a');
    poly([[x - 3, y - 1], [x - 3.4, y - 10], [x, y - 11], [x + 3.4, y - 10], [x + 3, y - 1]], '#c89a3a');
    for (const [dx, c] of [[-2.2, '#c8322a'], [0, '#ffe08a'], [2.2, '#2e8b57']]) poly([[x + dx - 0.9, y - 2], [x + dx - 1, y - 9], [x + dx + 1, y - 9], [x + dx + 0.9, y - 2]], c);
    poly([[x - 3.4, y - 10], [x, y - 15], [x + 3.4, y - 10]], '#a87a2a'); circ(x, y - 15.6, 0.8, '#e0b03a');
  });
  gnd('cairo', 'عربة فول', (x, y, P) => {
    shade(x, y, 6, 2.6); box(x, y - 2, 5, 2.5, 3, '#2e6a8a', '#3a7a9a', '#c8b48a');
    circ(x - 4, y + 0.6, 1.8, '#3a2e24'); circ(x + 3.6, y + 1.8, 1.8, '#3a2e24');
    el(x, y - 6.4, 2.6, 1.3, '#b87333'); poly([[x - 2.6, y - 6.4], [x - 2, y - 10], [x + 2, y - 10], [x + 2.6, y - 6.4]], '#c8843f'); el(x, y - 10, 2, 0.9, '#d8944f'); circ(x, y - 11, 0.6, '#e0b03a');
  });
  hang('yamamah', 'أعلام قماشية بين جذعي نخل', (x, y, P) => hanger(x, y, { pole: '#7a5a3a', h: 18, n: 7, item: pennant(['#8a1f1a', '#e8dcc0', '#2e5a3a', '#c8913a']) }));
  lit('yamamah', 'نار مخيم بحجارة', (x, y, P) => {
    shade(x, y, 4.6, 2); light(x, y - 4, 14, 'rgba(255,150,60,0.5)');
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; el(x + Math.cos(a) * 3.4, y + Math.sin(a) * 1.7, 1, 0.7, P[3]); }
    ln(x - 2, y + 0.5, x + 2, y - 0.5, '#5a3a22', 0.8); ln(x + 2, y + 0.6, x - 2, y - 0.4, '#5a3a22', 0.8);
    poly([[x - 2, y], [x, y - 7], [x + 2, y]], '#e8893a'); poly([[x - 1, y], [x, y - 4], [x + 1, y]], '#f2c14e');
  });
  gnd('yamamah', 'أكياس تمر وسلال', (x, y, P) => {
    shade(x, y, 6, 2.6);
    for (const [dx, dy] of [[-4, 0], [-1.4, 1.4], [-3, -2.2]]) { el(x + dx, y + dy - 1.6, 2, 2.2, '#c8b08a'); el(x + dx, y + dy - 3.6, 1.2, 0.6, '#a8906a'); }
    cyl(x + 3.4, y, 2.2, 2.6, '#8a6a3a', '#a8844a'); el(x + 3.4, y - 2.6, 2, 1, '#5a3218'); for (let k = 0; k < 4; k++) circ(x + 2.6 + k * 0.6, y - 2.8 + (k % 2) * 0.4, 0.4, '#7a3a18');
  });
  hang('arab', 'شادر قماش مخطط', (x, y, P) => {
    for (const s of [-1, 1]) ln(x + s * 14, y + 1, x + s * 14, y - 18, P[0], 0.9);
    const st = 6;
    for (let k = 0; k < st; k++) { const t0 = k / st, t1 = (k + 1) / st, X = t => x - 14 + 28 * t, Y = t => y - 17 + Math.sin(Math.PI * t) * 3;
      poly([[X(t0), Y(t0)], [X(t1), Y(t1)], [X(t1), Y(t1) + 4], [X(t0), Y(t0) + 4]], k % 2 ? '#efe6d2' : '#2e7a6a'); }
    for (let k = 0; k < 12; k++) { const t = (k + 0.5) / 12; poly([[x - 14 + 28 * t - 1, y - 13 + Math.sin(Math.PI * t) * 3], [x - 14 + 28 * t + 1, y - 13 + Math.sin(Math.PI * t) * 3], [x - 14 + 28 * t, y - 11.6 + Math.sin(Math.PI * t) * 3]], '#c8913a'); }
  });
  lit('arab', 'فانوس معدني مثقب على عمود', (x, y, P) => lampPost(x, y, 15, '#2b2420', (lx, ly) => {
    stroke(g => { g.moveTo(lx, ly); g.quadraticCurveTo(lx + 3, ly - 2, lx + 3.4, ly + 0.4); }, '#2b2420', 0.7);
    poly([[lx + 3.4, ly + 0.6], [lx + 5.2, ly + 2.4], [lx + 4.8, ly + 6], [lx + 3.4, ly + 7], [lx + 2, ly + 6], [lx + 1.6, ly + 2.4]], '#a8843a');
    for (const [dx, dy] of [[0, 3], [-0.8, 4.4], [0.8, 4.4], [0, 5.6]]) circ(lx + 3.4 + dx, ly + dy, 0.35, '#ffe6a0');
  }, { glowC: 'rgba(255,200,120,0.5)' }));
  gnd('arab', 'نافورة زليج صغيرة', (x, y, P) => {
    shade(x, y, 6, 2.8); cyl(x, y, 5.4, 2.4, '#2e7a8a', '#3a8a9a');
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI; rc(x - 5 + k * 1.05, y - 1.6 + Math.sin(a) * 0.9, 0.6, 0.6, k % 2 ? '#e0b03a' : '#efe6d2'); }
    el(x, y - 2.4, 4.6, 2.2, '#6ab0c8'); cyl(x, y - 2.4, 0.8, 3.4, '#efe6d2', '#ffffff'); el(x, y - 6.4, 1.6, 0.8, '#bfe6f2');
  });

  // ---------- الآسيوية ----------
  hang('kaifeng', 'فوانيس ورقية حمراء', (x, y, P) => hanger(x, y, { pole: P[0], n: 6, item: (px, py) => { lanternAt(['#d33a2c'], 1.6)(px, py, 0); ln(px, py + 4.4, px, py + 6, '#e0b03a', 0.4); } }));
  lit('kaifeng', 'مجمرة برونزية ثلاثية القوائم', (x, y, P) => {
    shade(x, y, 4, 1.8); light(x, y - 7, 13, 'rgba(255,150,70,0.5)');
    for (const dx of [-2.4, 0, 2.4]) ln(x + dx, y + (dx ? 0 : 1), x + dx * 0.8, y - 3, '#5a4a2a', 0.8);
    cyl(x, y - 3, 3, 3, '#6a5a32', '#8a7a42'); for (const s of [-1, 1]) stroke(g => g.ellipse(x + s * 3.3, y - 6.4, 0.8, 1, 0, 0, TAU), '#6a5a32', 0.5);
    poly([[x - 2, y - 6], [x, y - 11], [x + 2, y - 6]], '#e8893a'); poly([[x - 1, y - 6], [x, y - 8.6], [x + 1, y - 6]], '#f2c14e');
  });
  gnd('kaifeng', 'عربة بعجلة واحدة محملة جراراً', (x, y, P) => {
    shade(x, y, 5, 2.2); circ(x + 4, y - 1.6, 2, '#5a4028'); circ(x + 4, y - 1.6, 0.5, '#2b2420');
    poly([[x - 6, y - 1], [x + 4, y - 4], [x + 4, y - 3], [x - 6, y]], P[1]);
    for (const [dx, dy] of [[-3.4, -2.2], [-0.6, -3], [2, -3.8]]) { el(x + dx, y + dy - 1.6, 1.4, 1.8, '#a85a2a'); el(x + dx, y + dy - 3.4, 0.7, 0.3, '#7a3a18'); }
    ln(x - 6, y, x - 7.6, y + 1.6, P[1], 0.6);
  });
  hang('japan', 'حبل شيمي ناوا بشرائط ورقية', (x, y, P) => {
    for (const s of [-1, 1]) { ln(x + s * 14, y + 1, x + s * 14, y - 18, '#8a3a2a', 1.2); }
    stroke(g => { g.moveTo(x - 14, y - 17); g.quadraticCurveTo(x, y - 9, x + 14, y - 17); }, '#c8b47a', 1.6);
    for (let k = 0; k < 5; k++) { const [px, py] = curve((k + 0.5) / 5, 17, 2); line([[x + px, y + py + 0.8], [x + px + 1, y + py + 2], [x + px, y + py + 3], [x + px + 1, y + py + 4.2], [x + px, y + py + 5.4]], '#f6f2e8', 0.8); }
  });
  lit('japan', 'فانوس أندون ورقي قائم', (x, y, P) => {
    shade(x, y, 3, 1.4); light(x, y - 6, 13, 'rgba(255,220,150,0.55)');
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, 1], [0, -1]]) ln(x + dx, y + dy, x + dx, y + dy - 2, '#3a2a1e', 0.5);
    box(x, y - 2, 2.4, 1.2, 7, '#f2e6c8', '#fff2d6', '#e8dcc0'); for (let k = 1; k < 3; k++) { ln(x - 2.4, y - 2 - k * 2.4, x, y - 0.8 - k * 2.4, '#3a2a1e', 0.3); ln(x, y - 0.8 - k * 2.4, x + 2.4, y - 2 - k * 2.4, '#3a2a1e', 0.3); }
    poly([[x - 2.8, y - 9], [x, y - 11], [x + 2.8, y - 9], [x, y - 7.6]], '#3a2a1e');
  });
  gnd('japan', 'براميل ساكي مكدسة', (x, y, P) => {
    shade(x, y, 6, 2.6);
    const keg = (px, py) => { cyl(px, py, 2, 3.2, '#c8b48a', '#e0cca0'); el(px, py - 3.2, 2, 1, '#a8946a'); rc(px - 1, py - 2.4, 2, 1.6, '#f6f2e8'); ln(px - 0.4, py - 2.2, px + 0.4, py - 1.2, '#c8322a', 0.4); };
    keg(x - 2.2, y + 0.6); keg(x + 2.2, y - 0.6); keg(x, y - 3);
  });
  hang('gyeongju', 'أعلام الألوان الخمسة', (x, y, P) => hanger(x, y, { pole: P[0], n: 10, item: pennant(['#2a5ab0', '#c8322a', '#e8c23a', '#f2efe6', '#2b2825']) }));
  lit('gyeongju', 'فانوس تشونغسا على عمود', (x, y, P) => lampPost(x, y, 15, '#5a4028', (lx, ly) => {
    ln(lx, ly, lx + 3, ly, '#5a4028', 0.8); ln(lx + 3, ly, lx + 3, ly + 1, '#2b2420', 0.3);
    poly([[lx + 1.4, ly + 1], [lx + 4.6, ly + 1], [lx + 4.6, ly + 3.4], [lx + 1.4, ly + 3.4]], '#2a5ab0'); poly([[lx + 1.4, ly + 3.4], [lx + 4.6, ly + 3.4], [lx + 4.2, ly + 6], [lx + 1.8, ly + 6]], '#c8322a');
    ln(lx + 3, ly + 6, lx + 3, ly + 7.6, '#e8c23a', 0.4);
  }, { glowC: 'rgba(255,200,140,0.45)' }));
  gnd('gyeongju', 'جانغسونغ (تمثالا حراسة خشبيان)', (x, y, P) => {
    for (const [dx, dy, c] of [[-2.6, 0.6, '#8a6a4a'], [2.6, -0.6, '#7a5a3a']]) {
      shade(x + dx, y + dy, 1.8, 0.8); cyl(x + dx, y + dy, 1.4, 12, c, '#a8845a');
      el(x + dx, y + dy - 13, 1.6, 1.6, '#2b2420'); circ(x + dx - 0.5, y + dy - 9.6, 0.35, '#2b2420'); circ(x + dx + 0.5, y + dy - 9.6, 0.35, '#2b2420'); ln(x + dx - 0.6, y + dy - 7.6, x + dx + 0.6, y + dy - 7.6, '#c8322a', 0.4);
    }
  });
  hang('china', 'شرائط وفوانيس احتفال', (x, y, P) => hanger(x, y, { pole: '#8a2a20', n: 7, item: (px, py, k) => k % 2 ? cloth(['#c8322a'], 1.2, 6)(px, py, 0) : lanternAt(['#e8322a'], 1.5)(px, py, 0) }));
  lit('china', 'فانوس قصر سداسي على عمود', (x, y, P) => lampPost(x, y, 14, '#8a2a20', (lx, ly) => {
    poly([[lx - 2.6, ly - 1], [lx, ly - 3], [lx + 2.6, ly - 1]], '#3a3a3a');
    poly([[lx - 2.4, ly - 1], [lx + 2.4, ly - 1], [lx + 2.4, ly + 4], [lx - 2.4, ly + 4]], '#e8c23a'); rc(lx - 1, ly - 0.4, 2, 3.8, '#fff0b0');
    for (const s of [-1, 1]) ln(lx + s * 2.4, ly + 4, lx + s * 2.4, ly + 5.6, '#c8322a', 0.4);
  }, { glowC: 'rgba(255,210,120,0.5)' }));
  gnd('china', 'أسد حجري حارس', (x, y, P) => {
    shade(x, y, 4, 1.8); box(x, y, 3.4, 1.7, 3, '#8a8478', '#a8a296', '#b8b2a6');
    el(x, y - 5.6, 2.4, 2.6, '#a8a296'); circ(x + 0.4, y - 9, 2.2, '#b8b2a6'); for (let k = 0; k < 6; k++) circ(x + 0.4 + Math.cos(k) * 1.8, y - 9 + Math.sin(k) * 1.8, 0.7, '#9a9488');
    circ(x + 1.4, y - 9.4, 0.3, '#2b2420'); el(x - 1.6, y - 3.6, 1.2, 0.8, '#9a9488'); circ(x + 2.2, y - 3.8, 1, '#8a8478');
  });
  hang('hk', 'لافتة نيون فوق الشارع', (x, y, P) => {
    for (const s of [-1, 1]) ln(x + s * 14, y + 1, x + s * 14, y - 18, '#3a3a40', 1);
    ln(x - 14, y - 17, x + 14, y - 17, '#3a3a40', 0.6);
    light(x - 5, y - 13, 9, 'rgba(255,79,163,0.4)'); light(x + 6, y - 13, 9, 'rgba(63,224,255,0.4)');
    rc(x - 10, y - 16.6, 9, 6, '#1e1e24'); stroke(g => g.rect(x - 9.6, y - 16.2, 8.2, 5.2), '#ff4fa3', 0.6); for (let k = 0; k < 3; k++) ln(x - 8.4 + k * 2.6, y - 15, x - 7 + k * 2.6, y - 12.6, '#ffd23f', 0.5);
    rc(x + 2, y - 16.6, 8, 5, '#1e1e24'); stroke(g => g.rect(x + 2.4, y - 16.2, 7.2, 4.2), '#3fe0ff', 0.6); ln(x + 3.4, y - 14, x + 8.6, y - 14, '#7cff6b', 0.5);
  });
  lit('hk', 'لافتة نيون قائمة على عمود', (x, y, P) => {
    shade(x, y, 2, 1); light(x, y - 12, 13, 'rgba(255,79,163,0.5)');
    ln(x, y, x, y - 6, '#3a3a40', 0.9); rc(x - 1.8, y - 18, 3.6, 12, '#1e1e24'); stroke(g => g.rect(x - 1.5, y - 17.7, 3, 11.4), '#ff4fa3', 0.5);
    for (let k = 0; k < 4; k++) rc(x - 0.9, y - 16.6 + k * 2.6, 1.8, 1.6, ['#3fe0ff', '#ffd23f', '#7cff6b', '#ff7a3f'][k]);
  });
  gnd('hk', 'عربة طعام شارع بمظلة', (x, y, P) => {
    shade(x, y, 6, 2.6); box(x, y - 1.6, 4.4, 2.2, 3.4, '#b0b4b8', '#c8ccd0', '#8a8e92'); circ(x - 3.6, y + 0.6, 1.2, '#2b2825'); circ(x + 3, y + 1.4, 1.2, '#2b2825');
    ln(x + 0.4, y - 5, x + 0.4, y - 12, '#3a3a40', 0.5); poly([[x - 6, y - 11], [x + 0.4, y - 14], [x + 7, y - 11], [x + 0.4, y - 9.4]], '#c8322a'); poly([[x - 6, y - 11], [x + 0.4, y - 14], [x + 0.4, y - 9.4]], '#e8e2d2');
    for (let k = 0; k < 3; k++) stroke(g => { g.moveTo(x - 1 + k, y - 5.4); g.quadraticCurveTo(x - 2 + k, y - 7, x - 1 + k, y - 8.4); }, 'rgba(255,255,255,0.45)', 0.4);
  });
  hang('jaipur', 'أعلام مثلثة بمرايا', (x, y, P) => hanger(x, y, { pole: P[1], n: 9, item: (px, py, k) => { pennant(['#e8508a', '#f0a020', '#2ab0a8', '#8a3ab0'])(px, py, k); circ(px, py + 1.2, 0.4, '#f6f2e8'); } }));
  lit('jaipur', 'سراج ديا على حامل نحاسي', (x, y, P) => {
    shade(x, y, 2.6, 1.2); light(x, y - 12, 12, 'rgba(255,180,80,0.5)');
    el(x, y, 2.4, 1, '#b8862a'); ln(x, y, x, y - 10, '#c8963a', 0.9);
    for (const [dy, r] of [[-6, 2.2], [-10.6, 3]]) { el(x, y + dy, r, r * 0.4, '#c8963a'); for (const s of [-1, 0, 1]) { poly([[x + s * r * 0.7 - 0.5, y + dy - 0.2], [x + s * r * 0.7, y + dy - 2], [x + s * r * 0.7 + 0.5, y + dy - 0.2]], '#ffb030'); } }
  });
  gnd('jaipur', 'عربة شاي', (x, y, P) => {
    shade(x, y, 5.4, 2.4); box(x, y - 1.4, 4, 2, 3, '#2ab0a8', '#3ac0b8', '#e8d8b8'); circ(x - 3.2, y + 0.6, 1.4, '#5a3a22'); circ(x + 2.8, y + 1.4, 1.4, '#5a3a22');
    cyl(x - 1.4, y - 5, 1.4, 2.4, '#b87333', '#c8843f'); poly([[x - 0.2, y - 6.6], [x + 1.6, y - 8], [x + 0.2, y - 7.2]], '#b87333');
    for (let k = 0; k < 3; k++) cyl(x + 1.4 + k * 0.9, y - 4.4 + k * 0.4, 0.4, 0.9, '#f6f2e8', '#ffffff');
  });

  // ---------- الأوروبية ----------
  hang('paris', 'حبل أضواء غانغيت', (x, y, P) => hanger(x, y, { pole: '#2b2825', n: 9, sag: 4, item: (px, py) => { light(px, py + 1.4, 3.4, 'rgba(255,220,140,0.5)'); circ(px, py + 1.2, 0.8, '#ffe8a8'); } }));
  lit('paris', 'عمود إنارة بثلاث كرات', (x, y, P) => {
    shade(x, y, 2.6, 1.2); light(x, y - 17, 15, 'rgba(255,225,160,0.5)');
    box(x, y, 1.6, 0.8, 2, '#2f3a32', '#3f4a42', '#4f5a52'); ln(x, y - 2, x, y - 17, '#2f3a32', 1);
    for (const s of [-1, 1]) { stroke(g => { g.moveTo(x, y - 14); g.quadraticCurveTo(x + s * 3, y - 15, x + s * 3.6, y - 17); }, '#2f3a32', 0.7); circ(x + s * 3.6, y - 18, 1.3, '#fff2c8'); }
    circ(x, y - 18.6, 1.4, '#fff2c8');
  });
  gnd('paris', 'عمود موريس للإعلانات', (x, y, P) => {
    shade(x, y, 3.4, 1.6); cyl(x, y, 2.6, 11, '#2f5a3a', '#3f6a4a');
    for (const [dy, c] of [[-3, '#e8c23a'], [-6.4, '#c8322a'], [-9, '#efe6d2']]) poly([[x - 2.2, y + dy], [x + 0.4, y + dy + 0.4], [x + 0.4, y + dy - 2.6], [x - 2.2, y + dy - 3]], c);
    el(x, y - 11, 3, 1.4, '#2f5a3a'); poly([[x - 3, y - 11], [x, y - 14.4], [x + 3, y - 11]], '#3f6a4a'); circ(x, y - 14.6, 0.6, '#c8a050');
  });
  hang('birmingham', 'حبال غسيل بين البيوت', (x, y, P) => hanger(x, y, { pole: P[0], n: 6, sag: 3, item: (px, py, k) => {
    const c = ['#efe6d2', '#3a5a8a', '#c8322a', '#8a8478'][k % 4];
    if (k % 2) poly([[px - 1.6, py], [px + 1.6, py], [px + 1.4, py + 2], [px + 0.8, py + 5], [px, py + 2.6], [px - 0.8, py + 5], [px - 1.4, py + 2]], c);
    else poly([[px - 2, py], [px + 2, py], [px + 2.4, py + 1.6], [px + 1.4, py + 1.8], [px + 1.4, py + 4.6], [px - 1.4, py + 4.6], [px - 1.4, py + 1.8], [px - 2.4, py + 1.6]], c);
  } }));
  lit('birmingham', 'مصباح غاز فيكتوري بعارضة سلّم', (x, y, P) => lampPost(x, y, 16, '#1e1e22', (lx, ly) => {
    ln(lx - 2.6, ly + 2.4, lx + 2.6, ly + 2.4, '#1e1e22', 0.7);
    poly([[lx - 1.8, ly - 1], [lx + 1.8, ly - 1], [lx + 1.2, ly + 1.6], [lx - 1.2, ly + 1.6]], '#ffe6a0'); poly([[lx - 2.2, ly - 1], [lx, ly - 3.4], [lx + 2.2, ly - 1]], '#1e1e22');
  }, { glowC: 'rgba(255,215,140,0.5)' }));
  gnd('birmingham', 'عربة فحم يدوية وأكياس', (x, y, P) => {
    shade(x, y, 6, 2.6); box(x, y - 1.6, 4, 2, 3, '#4a3a2e', '#5a4a3a', '#2b2825'); circ(x - 3.4, y + 0.6, 1.6, '#2b2420'); circ(x + 2.8, y + 1.6, 1.6, '#2b2420');
    for (let k = 0; k < 7; k++) circ(x - 2 + (k % 4) * 1.3, y - 5 - (k > 3 ? 1 : 0), 0.8, '#1e1e22');
    ln(x + 4, y - 3.6, x + 7, y - 5, '#5a4a3a', 0.6); el(x - 6, y + 0.4, 1.8, 2, '#8a7a5a');
  });
  hang('rothenburg', 'لافتة حرفي من حديد مشغول', (x, y, P) => {
    shade(x - 6, y, 2, 1); ln(x - 6, y, x - 6, y - 18, '#2b2825', 1); ln(x - 6, y - 16, x + 6, y - 16, '#2b2825', 0.8);
    stroke(g => { g.moveTo(x - 6, y - 12); g.quadraticCurveTo(x, y - 12, x + 4, y - 16); }, '#2b2825', 0.6);
    for (const dx of [1, 5]) { stroke(g => g.arc(x - 6 + dx * 1.6, y - 14, 1, 0, TAU), '#2b2825', 0.4); }
    ln(x + 2, y - 16, x + 2, y - 14.6, '#2b2825', 0.4); ln(x + 6, y - 16, x + 6, y - 14.6, '#2b2825', 0.4);
    poly([[x + 1, y - 14.6], [x + 7, y - 14.6], [x + 7, y - 9.6], [x + 4, y - 8.4], [x + 1, y - 9.6]], '#c8a050');
    stroke(g => { g.arc(x + 4, y - 11.8, 1.6, 0, TAU); }, '#7a4a28', 0.6);
  });
  lit('rothenburg', 'فانوس قديم على قاعدة حجرية', (x, y, P) => {
    shade(x, y, 2.6, 1.2); light(x, y - 14, 13, 'rgba(255,205,130,0.5)');
    box(x, y, 2, 1, 3, '#8a8478', '#a8a296', '#b8b2a6'); ln(x, y - 3, x, y - 12, '#2b2825', 0.9);
    poly([[x - 2, y - 12], [x + 2, y - 12], [x + 1.6, y - 16], [x - 1.6, y - 16]], '#ffe2a0'); stroke(g => { g.moveTo(x - 2, y - 12); g.lineTo(x - 1.6, y - 16); g.moveTo(x + 2, y - 12); g.lineTo(x + 1.6, y - 16); }, '#2b2825', 0.5);
    poly([[x - 2.4, y - 16], [x, y - 18.4], [x + 2.4, y - 16]], '#2b2825');
  });
  gnd('rothenburg', 'برميل نبيذ طاولةً وبرميلان', (x, y, P) => {
    shade(x, y, 6, 2.6);
    const barrel = (px, py, s = 1) => { cyl(px, py, 1.8 * s, 3.4 * s, '#6b4a2e', '#8a6440'); for (const k of [0.8, 2.6]) ln(px - 1.8 * s, py - k * s, px + 1.8 * s, py - k * s, '#3a2a1e', 0.3); };
    barrel(x, y, 1.3); el(x, y - 4.4, 2.4, 1.2, '#7a5636'); cyl(x - 0.6, y - 4.6, 0.5, 1.6, '#e8c23a', '#f2d24a');
    barrel(x - 5, y + 1); barrel(x + 4.6, y + 1.4);
  });
  hang('europe', 'أكاليل زهور وأعلام صغيرة', (x, y, P) => hanger(x, y, { pole: P[0], n: 10, sag: 4, item: (px, py, k) => k % 2 ? pennant(['#3a6ab0', '#e8c23a', '#c8322a'])(px, py, k >> 1) : (circ(px, py + 0.4, 1, '#5f8a44'), circ(px + 0.4, py + 0.2, 0.5, '#e8508a')) }));
  lit('europe', 'فانوس على ذراع حائط', (x, y, P) => {
    shade(x - 4, y, 2.4, 1.2); box(x - 4, y, 1.4, 0.7, 14, P[2], P[3], P[4]);
    light(x + 2, y - 10, 12, 'rgba(255,210,140,0.5)');
    stroke(g => { g.moveTo(x - 2.6, y - 13); g.quadraticCurveTo(x, y - 15, x + 2, y - 13); }, '#2b2825', 0.6);
    poly([[x + 0.6, y - 12.4], [x + 3.4, y - 12.4], [x + 3, y - 9], [x + 1, y - 9]], '#ffe2a0'); poly([[x + 0.2, y - 12.4], [x + 2, y - 14], [x + 3.8, y - 12.4]], '#2b2825');
  });
  gnd('europe', 'نافورة شرب حجرية', (x, y, P) => {
    shade(x, y, 4, 1.8); box(x, y, 3, 1.5, 1.6, '#8a8478', '#a8a296', '#b8b2a6'); box(x - 1, y - 1.6, 1.2, 0.6, 7, '#9a948a', '#b0aaa0', '#c0bab0');
    ln(x - 0.4, y - 7, x + 1.6, y - 6.4, '#5a6a6a', 0.6); stroke(g => { g.moveTo(x + 1.6, y - 6.4); g.quadraticCurveTo(x + 2.4, y - 4, x + 1.4, y - 2); }, 'rgba(160,210,230,0.8)', 0.4);
    el(x + 0.8, y - 1.8, 2, 0.8, '#6ab0c8');
  });
  hang('norway', 'حامل سمك مجفف', (x, y, P) => {
    for (const s of [-1, 1]) { ln(x + s * 14, y + 1, x + s * 12, y - 16, '#6a5040', 1); ln(x + s * 10, y + 2, x + s * 12, y - 16, '#6a5040', 1); }
    ln(x - 12, y - 15, x + 12, y - 15, '#5a4030', 0.8); ln(x - 12.6, y - 9, x + 12.6, y - 9, '#5a4030', 0.6);
    for (let k = 0; k < 8; k++) for (const [ry, l] of [[-15, 5], [-9, 4]]) { const px = x - 10 + k * 2.9; poly([[px - 0.6, y + ry], [px + 0.6, y + ry], [px + 0.4, y + ry + l], [px, y + ry + l + 0.8], [px - 0.4, y + ry + l]], k % 2 ? '#c8b48a' : '#a8946a'); }
  });
  lit('norway', 'فانوس سفينة على عمود', (x, y, P) => lampPost(x, y, 14, '#4a3a2e', (lx, ly) => {
    ln(lx, ly, lx + 2.4, ly, '#4a3a2e', 0.7); ln(lx + 2.4, ly, lx + 2.4, ly + 1, '#2b2825', 0.4);
    cyl(lx + 2.4, ly + 4.4, 1.4, 3.4, '#ffe2a0', '#fff0c0'); el(lx + 2.4, ly + 1, 1.6, 0.6, '#2b2825'); el(lx + 2.4, ly + 4.4, 1.6, 0.6, '#2b2825');
  }, { glowC: 'rgba(255,210,140,0.5)' }));
  gnd('norway', 'قارب مقلوب ومجدافان', (x, y, P) => {
    shade(x, y, 8, 3);
    for (const dx of [-4, 4]) box(x + dx, y + (dx > 0 ? -1 : 1), 1.4, 0.7, 2, '#5a4030', '#6a5040', '#7a6050');
    poly([[x - 9, y + 2.4], [x + 8, y - 6], [x + 9, y - 5.4], [x - 8, y + 3]], P[3]); poly([[x - 9, y + 2.4], [x + 8, y - 6], [x + 6, y - 8.6], [x - 7, y - 1.6]], P[1]);
    ln(x - 2, y + 3.6, x + 6, y + 0.6, '#c8a878', 0.6); el(x + 6.6, y + 0.4, 1.2, 0.5, '#c8a878');
  });

  // ---------- الأفريقية ----------
  hang('gondar', 'أقمشة نتيلا بحواف ملونة', (x, y, P) => hanger(x, y, { pole: P[0], n: 5, sag: 3, item: (px, py, k) => { cloth(['#f6f2e8'], 2.2, 6)(px, py, 0); rc(px - 2.2, py + 4.4, 4.4, 0.9, ['#2e8b57', '#e8c23a', '#c8322a'][k % 3]); } }));
  lit('gondar', 'مبخرة وجبنة قهوة', (x, y, P) => {
    shade(x, y, 4, 1.8); light(x - 1.6, y - 3, 10, 'rgba(255,160,80,0.45)');
    cyl(x - 1.6, y, 1.4, 2, '#5a3a22', '#7a4a2a'); el(x - 1.6, y - 2, 1.2, 0.5, '#ff7a2a');
    for (let k = 0; k < 3; k++) stroke(g => { g.moveTo(x - 1.6, y - 2.4 - k * 2); g.quadraticCurveTo(x - 0.4, y - 3.4 - k * 2, x - 1.6, y - 4.4 - k * 2); }, 'rgba(230,230,230,0.5)', 0.5);
    el(x + 2.2, y - 1.8, 2, 2, '#2b2420'); cyl(x + 2.2, y - 3.4, 0.6, 2.4, '#2b2420', '#3a2e24'); poly([[x + 3.6, y - 2.4], [x + 5, y - 4], [x + 3.8, y - 3.2]], '#2b2420');
  });
  gnd('gondar', 'سلال مسوب ملونة', (x, y, P) => {
    shade(x, y, 5.4, 2.4);
    const mesob = (px, py, s) => { poly([[px - 1.4 * s, py], [px + 1.4 * s, py], [px + 2.2 * s, py - 4 * s], [px - 2.2 * s, py - 4 * s]], '#c8a050'); for (let k = 0; k < 3; k++) rc(px - 1.8 * s, py - (1 + k * 1.1) * s, 3.6 * s, 0.4 * s, ['#c8322a', '#2e8b57', '#2a5ab0'][k]); cone(px, py - 4 * s, 2.3 * s, 3.4 * s, '#d8b060', '#e8c070'); };
    mesob(x - 2.4, y + 0.8, 1); mesob(x + 2.6, y - 0.6, 0.8);
  });
  hang('kano', 'أقمشة نيلة للتجفيف', (x, y, P) => hanger(x, y, { pole: P[1], n: 4, sag: 2, item: (px, py, k) => { cloth(['#1f2a6a', '#2a3a8a', '#3a4e9a'], 3, 7)(px, py, k); for (let f = 0; f < 2; f++) ln(px - 2.6, py + 2 + f * 2.4, px + 2.6, py + 2.4 + f * 2.4, '#8ab0e0', 0.3); } }));
  lit('kano', 'سراج زيت على جرة', (x, y, P) => {
    shade(x, y, 2.6, 1.2); light(x, y - 8, 11, 'rgba(255,170,80,0.5)');
    el(x, y - 2.6, 2.4, 2.8, '#a85a2a'); el(x, y - 5.4, 1.2, 0.5, '#7a3a18'); el(x, y - 6, 1.8, 0.7, '#8a4a22');
    poly([[x - 0.6, y - 6.2], [x, y - 8.6], [x + 0.6, y - 6.2]], '#ffb030');
  });
  gnd('kano', 'قرع وأوانٍ فخارية', (x, y, P) => {
    shade(x, y, 5.4, 2.4);
    for (const [dx, dy, r, c] of [[-3, 0.6, 2.2, '#c8a050'], [0.6, -0.8, 1.8, '#a85a2a'], [3.4, 0.4, 1.6, '#d8b060']]) { el(x + dx, y + dy - r, r, r * 0.9, c); el(x + dx, y + dy - r * 1.8, r * 0.5, r * 0.2, '#5a3a22'); }
    for (let k = 0; k < 4; k++) ln(x - 4.6 + k, y - 2 - k * 0.2, x - 4.4 + k, y - 0.4, '#8a6a2a', 0.2);
  });
  hang('meroe', 'حصائر سعف ملونة معلقة', (x, y, P) => hanger(x, y, { pole: P[1], n: 4, sag: 2, item: (px, py, k) => {
    poly([[px - 2.6, py], [px + 2.6, py], [px + 2.6, py + 6], [px - 2.6, py + 6]], '#c8a060');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if ((r + c + k) % 2) rc(px - 2.2 + c * 1.6, py + 0.6 + r * 1.8, 1.2, 1.2, ['#c8322a', '#2e6a8a', '#2b2420'][k % 3]);
  } }));
  lit('meroe', 'مشعل معبد على قاعدة', (x, y, P) => {
    shade(x, y, 3, 1.4); light(x, y - 11, 13, 'rgba(255,150,60,0.5)');
    box(x, y, 2.4, 1.2, 6, P[2], P[3], P[4]); for (let k = 0; k < 3; k++) rc(x - 1.8 + k * 1.2, y - 4, 0.6, 1.4, '#5a3a22');
    el(x, y - 6.6, 2.6, 1, '#6a5a3a'); poly([[x - 2, y - 6.6], [x, y - 12.4], [x + 2, y - 6.6]], '#e8893a'); poly([[x - 1, y - 6.6], [x, y - 9.6], [x + 1, y - 6.6]], '#f2c14e');
  });
  gnd('meroe', 'تمثال كبش على قاعدة', (x, y, P) => {
    shade(x, y, 5, 2.2); box(x, y, 5, 2.5, 2.4, P[2], P[3], P[4]);
    el(x, y - 4.6, 4, 2, P[3]); circ(x + 3.6, y - 6, 1.6, P[4]); stroke(g => g.arc(x + 3, y - 6.4, 1.2, -0.4, 2.4), P[1], 0.8);
    ln(x - 3, y - 3, x - 3, y - 2.4, P[2], 0.8); ln(x + 2.4, y - 3, x + 2.4, y - 2.4, P[2], 0.8);
  });

  // ---------- الأمريكتان ----------
  hang('rio', 'أعلام عيد شعبي ملونة', (x, y, P) => hanger(x, y, { pole: P[0], n: 11, sag: 4, item: (px, py, k) => poly([[px - 1.1, py], [px + 1.1, py], [px + 1.1, py + 2.6], [px, py + 1.8], [px - 1.1, py + 2.6]], ['#e8322a', '#2ab0a8', '#f0c020', '#3a8a3a', '#e8508a'][k % 5]) }));
  lit('rio', 'فانوس برتغالي على عمود حديد', (x, y, P) => lampPost(x, y, 15, '#1e1e22', (lx, ly) => {
    stroke(g => { g.moveTo(lx, ly); g.quadraticCurveTo(lx + 3, ly - 1, lx + 3, ly + 1); }, '#1e1e22', 0.7);
    poly([[lx + 1.4, ly + 1], [lx + 4.6, ly + 1], [lx + 4, ly + 5], [lx + 2, ly + 5]], '#fff0c0'); poly([[lx + 1, ly + 1], [lx + 3, ly - 0.6], [lx + 5, ly + 1]], '#1e1e22'); el(lx + 3, ly + 5, 1.2, 0.5, '#1e1e22');
  }, { glowC: 'rgba(255,215,150,0.5)' }));
  gnd('rio', 'كشك جوز هند بمظلة', (x, y, P) => {
    shade(x, y, 6, 2.6); box(x, y - 0.6, 3.6, 1.8, 3, '#2ab0a8', '#3ac0b8', '#e8d8b8');
    for (let k = 0; k < 6; k++) circ(x - 2 + (k % 3) * 1.8, y - 4.4 - (k > 2 ? 1.2 : 0), 1, '#5a9a3a');
    ln(x + 3, y - 2, x + 3, y - 13, '#e8e2d2', 0.5); poly([[x - 3, y - 11], [x + 3, y - 14.4], [x + 9, y - 11], [x + 3, y - 9]], '#f0c020'); poly([[x - 3, y - 11], [x + 3, y - 14.4], [x + 3, y - 9]], '#2ab0a8');
  });
  hang('laboca', 'أعلام بالأزرق والأصفر', (x, y, P) => hanger(x, y, { pole: P[1], n: 9, item: pennant(['#125292', '#efb426']) }));
  lit('laboca', 'فانوس فيلتيادو مزخرف', (x, y, P) => lampPost(x, y, 15, '#1e1e22', (lx, ly) => {
    for (const [c, s] of [['#c8322a', 1], ['#2a8a4a', -1]]) stroke(g => g.arc(lx + s * 2, ly + 1.4, 1.2, 0, Math.PI * 1.5), c, 0.5);
    poly([[lx - 2, ly - 1], [lx + 2, ly - 1], [lx + 1.6, ly + 3.6], [lx - 1.6, ly + 3.6]], '#ffe8a8'); poly([[lx - 2.4, ly - 1], [lx, ly - 3.4], [lx + 2.4, ly - 1]], '#efb426');
  }, { glowC: 'rgba(255,215,150,0.5)' }));
  gnd('laboca', 'صناديق وبراميل الميناء وحبل', (x, y, P) => {
    shade(x, y, 6, 2.6); box(x - 3, y + 0.6, 2.4, 1.2, 2.4, '#7a5a3a', '#8a6a4a', '#9a7a5a'); box(x - 2.4, y - 1.8, 1.8, 0.9, 1.8, '#6a4a2e', '#7a5a3a', '#8a6a4a');
    cyl(x + 2.6, y + 0.4, 1.8, 3.4, '#125292', '#2a62a2'); el(x + 2.6, y - 3, 1.6, 0.8, '#0a3a72');
    for (const r of [1.6, 1.1, 0.6]) stroke(g => g.ellipse(x + 0.4, y + 2.4, r * 1.4, r * 0.6, 0, 0, TAU), '#c8a878', 0.4);
  });
  hang('tenoch', 'رايات ريش ملونة', (x, y, P) => hanger(x, y, { pole: P[1], n: 7, sag: 4, item: (px, py, k) => { const c = ['#2e8b57', '#c8322a', '#e8c23a', '#2a8ab0'][k % 4]; poly([[px, py], [px - 1, py + 3], [px, py + 5.4], [px + 1, py + 3]], c); ln(px, py + 0.6, px, py + 5, 'rgba(0,0,0,0.25)', 0.3); } }));
  lit('tenoch', 'مجمرة حجرية كبيرة', (x, y, P) => {
    shade(x, y, 4, 1.8); light(x, y - 8, 14, 'rgba(255,140,60,0.5)');
    poly([[x - 2, y], [x + 2, y], [x + 3.4, y - 4], [x - 3.4, y - 4]], P[2]); el(x, y - 4, 3.4, 1.4, P[3]);
    for (const s of [-1, 1]) rc(x + s * 2.4 - 0.5, y - 3.6, 1, 1.2, '#c8322a');
    poly([[x - 2.4, y - 4], [x, y - 10.6], [x + 2.4, y - 4]], '#e8893a'); poly([[x - 1.2, y - 4], [x, y - 7.6], [x + 1.2, y - 4]], '#f2c14e');
  });
  gnd('tenoch', 'سلال ذرة وأوعية فخار', (x, y, P) => {
    shade(x, y, 5.6, 2.4); cyl(x - 2.6, y + 0.6, 2.2, 2.4, '#a8844a', '#c8a060'); for (let k = 0; k < 4; k++) el(x - 3.6 + k * 0.7, y - 2 - (k % 2) * 0.4, 0.5, 1.4, ['#e8c23a', '#c8322a', '#e8c23a', '#5a3a8a'][k]);
    el(x + 2.6, y - 1.4, 2, 1.8, '#a85a2a'); el(x + 2.6, y - 3, 1.2, 0.5, '#7a3a18'); for (let k = 0; k < 3; k++) circ(x + 1.6 + k, y - 1.6, 0.3, '#efe6d2');
  });
  hang('mexico', 'فوانيس صفيح نجمية', (x, y, P) => hanger(x, y, { pole: P[0], n: 6, item: (px, py) => {
    ln(px, py, px, py + 1, '#5a5a5a', 0.3); light(px, py + 3, 4, 'rgba(255,215,140,0.4)');
    const st = []; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, r = k % 2 ? 1 : 2.2; st.push([px + Math.cos(a) * r, py + 3 + Math.sin(a) * r]); }
    poly(st, '#c8c2b4'); circ(px, py + 3, 0.7, '#ffe8a8');
  } }));
  lit('mexico', 'مذبح شموع وأزهار القطيفة', (x, y, P) => {
    shade(x, y, 4.6, 2); light(x, y - 5, 12, 'rgba(255,190,100,0.5)');
    box(x, y, 4, 2, 2, P[2], P[3], '#f6f2e8'); box(x, y - 2, 2.6, 1.3, 2, P[2], P[3], '#f6f2e8');
    for (const [dx, dy] of [[-2.6, -2], [2.6, -1.6], [0, -4]]) { rc(x + dx - 0.4, y + dy - 2, 0.8, 2, '#f6f2e8'); poly([[x + dx - 0.4, y + dy - 2], [x + dx, y + dy - 3.4], [x + dx + 0.4, y + dy - 2]], '#ffb030'); }
    for (let k = 0; k < 5; k++) circ(x - 3 + k * 1.5, y + 0.6 - (k % 2) * 0.4, 0.7, '#f08a1a');
  });
  gnd('mexico', 'عربة إلوتي بمظلة', (x, y, P) => {
    shade(x, y, 6, 2.6); box(x, y - 1.4, 4, 2, 3, '#e8c23a', '#f0d24a', '#c8b48a'); circ(x - 3.4, y + 0.6, 1.4, '#3a2e24'); circ(x + 3, y + 1.6, 1.4, '#3a2e24');
    for (let k = 0; k < 4; k++) { el(x - 2 + k * 1.3, y - 5.2, 0.5, 1.4, '#f2d24a'); ln(x - 2 + k * 1.3, y - 4, x - 2 + k * 1.3, y - 3.2, '#8a6a3a', 0.3); }
    ln(x + 2.6, y - 3, x + 2.6, y - 13, '#e8e2d2', 0.5); poly([[x - 3.6, y - 11], [x + 2.6, y - 14.4], [x + 8.6, y - 11], [x + 2.6, y - 9]], '#e3708c'); poly([[x - 3.6, y - 11], [x + 2.6, y - 14.4], [x + 2.6, y - 9]], '#3fb5a8');
  });
  hang('chicago', 'شريط أعلام بالأحمر والأبيض والأزرق', (x, y, P) => hanger(x, y, { pole: '#2b2825', n: 7, sag: 3, item: (px, py, k) => {
    stroke(g => { g.moveTo(px - 2, py); g.quadraticCurveTo(px, py + 3.4, px + 2, py); }, '#c8322a', 0.9);
    stroke(g => { g.moveTo(px - 1.6, py + 0.4); g.quadraticCurveTo(px, py + 2.4, px + 1.6, py + 0.4); }, '#f2efe6', 0.6);
    stroke(g => { g.moveTo(px - 1.2, py + 0.6); g.quadraticCurveTo(px, py + 1.6, px + 1.2, py + 0.6); }, '#2a3e8a', 0.5);
  } }));
  lit('chicago', 'عمود إنارة عكاز الأسقف', (x, y, P) => {
    shade(x, y, 2.2, 1); light(x + 4, y - 15, 14, 'rgba(255,220,150,0.5)');
    box(x, y, 1.4, 0.7, 2, '#3a4a3a', '#4a5a4a', '#5a6a5a'); ln(x, y - 2, x, y - 17, '#3a4a3a', 1);
    stroke(g => { g.moveTo(x, y - 17); g.quadraticCurveTo(x + 1, y - 21, x + 4, y - 19); }, '#3a4a3a', 0.9);
    poly([[x + 2.6, y - 18.6], [x + 5.4, y - 18.6], [x + 4.6, y - 16.4], [x + 3.4, y - 16.4]], '#fff0c0');
  });
  gnd('chicago', 'صنبور حريق وصندوق جرائد', (x, y, P) => {
    shade(x - 3, y, 2, 1); cyl(x - 3, y, 1.2, 4, '#c8322a', '#d8423a'); el(x - 3, y - 4.4, 1.2, 0.8, '#a8221a'); for (const s of [-1, 1]) rc(x - 3 + s * 1.2 - 0.4, y - 2.8, 0.8, 0.8, '#a8221a');
    shade(x + 3, y + 1, 2.4, 1.1); box(x + 3, y + 1, 1.8, 0.9, 4.6, '#2a5a8a', '#3a6a9a', '#4a7aaa'); rc(x + 3.4, y - 2.6, 1.2, 1, '#f2efe6');
  });
  return out;
}
