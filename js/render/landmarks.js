// المباني الحاسمة للعب بطراز المدينة (القسم 3.9): تُعرف من لمحة في أي مدينة
// - المقر: أعلى مبنى من طراز المدينة + علم العصابة
// - مركز الشرطة: مبنى المدينة + لوحة الشرطة + المصباح الأزرق الوامض
// - المستشفى: مبنى المدينة + صليب أحمر واضح على السطح
// - مخزن السلاح: مبنى المدينة + شعار سلاحين متقاطعين
// - برج الساعة والتلة: معلم المدينة (landmark) + ساعة، أو تاج ذهبي فوق علم التلة
// العلامات لا تُصبغ بلون المالك حتى تبقى واضحة دائماً.
import { CITY_SPECIALS, CAPTURE, EMPIRE } from '../config.js';
import { THEMES, getCtx, setThemeContext, setTone, getTone, getToneInfo, poly, circ, ln, box, el } from './cityThemes.js';
import { drawFeatureBuilding } from './featureArt.js';
import { drawCityTower, drawCityHospital, medicSign, medicOf, towerUpgrades, hospitalUpgrades, hqYard } from './empireBuildings.js';
import { sizeOf } from '../map/sizes.js';

const cityOf = (map) => THEMES[map.city] || THEMES.arab;
const specialsOf = (map) => CITY_SPECIALS[map.city] || CITY_SPECIALS.arab;

// مباني طور الإمبراطورية بطراز كل مدينة (EMPIRE.art): القاعدة مبنى مقرها، والبرج والمستشفى بطراز منطقتها وحجم
// حيها (empireBuildings.js، القسم 3.12). والمدينة التي لها صور مبانيها (اليمامة) ترسمها بها
const TOWER = 'cityTower:', HOSPITAL = 'cityHospital:';
const empireArtOf = (map) => EMPIRE.art[map.city] || null;
const hospitalRoof = (map) => (empireArtOf(map) || {}).hospitalRoof || 0;
const districtOfTile = (map, i, j) => { const d = map.districtAt ? map.districtAt[map.idx(i, j)] : -1; return d >= 0 ? map.districts[d] : null; };

// نوع مبنى طور الإمبراطورية بحرفه (Q قاعدة، T برج، M مستشفى) وحجم حيه: لرسمه، ولقياس ارتفاعه خارج هذا الملف
export function empireKind(map, type, district = null) {
  const S = specialsOf(map), A = empireArtOf(map), size = district ? sizeOf(district) : 'medium';
  if (type === 'Q') return S.hq;
  if (type === 'T') return A ? A.tower : TOWER + size;
  return A ? A.hospital : HOSPITAL + size;
}

// --- ارتفاع سطح المبنى الحقيقي: يُقاس مرة واحدة لكل مربع برسمه في لوحة صغيرة مخفية ---
const tops = new Map();     // مفتاح: بذرة الخريطة + المربع + النوع
let probe = null;

export function roofTop(map, kind, i, j) {
  const key = map.seed + '|' + i + ',' + j + '|' + kind;
  if (tops.has(key)) return tops.get(key);
  let top = 30;                                          // تقدير إن لم يتوفر رسم (اختبارات Node)
  if (typeof document !== 'undefined') {
    if (!probe) {
      probe = document.createElement('canvas');
      probe.width = 120; probe.height = 170;
    }
    const pc = probe.getContext('2d', { willReadFrequently: true });
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.clearRect(0, 0, 120, 170);
    pc.setTransform(1, 0, 0, 1, 60, 150);
    const saved = getCtx(), savedTone = getTone(), savedInfo = getToneInfo();
    setThemeContext(pc, map.seed || 0);
    setTone(null);
    drawKind(map, kind, 0, 0, i, j);
    setThemeContext(saved, map.seed || 0);
    setTone(savedTone, savedInfo);
    // أعلى بكسل معتم في الأعمدة الوسطى (لا الوهج ولا الدخان على الأطراف)
    const data = pc.getImageData(48, 0, 24, 170).data;
    for (let y = 0; y < 170; y++) {
      let solid = false;
      for (let x = 0; x < 24; x++) if (data[(y * 24 + x) * 4 + 3] > 200) { solid = true; break; }
      if (solid) { top = 150 - y; break; }
    }
  }
  tops.set(key, top);
  return top;
}

// يعيد جذع المبنى { w, h, top } لبرج المنطقة ومستشفاها (لرسم ترقياتهما فوقه)، وundefined لغيرهما
function drawKind(map, kind, x, y, i, j) {
  const T = cityOf(map);
  if (kind.startsWith(TOWER)) return drawCityTower(x, y, i, j, T, map.city, kind.slice(TOWER.length));
  if (kind.startsWith(HOSPITAL)) return drawCityHospital(x, y, i, j, T, map.city, kind.slice(HOSPITAL.length), plain);
  const fn = T.draw[kind];
  if (typeof fn === 'function') fn(x, y, i, j, T);
}

// بلا صبغ: العلامات واضحة بألوانها دائماً
function plain(draw) {
  const saved = getTone(), savedInfo = getToneInfo();
  setTone(null);
  draw();
  setTone(saved, savedInfo);
}

// أحواض نبات حجرية على ركني الساحة الجانبيين (المتوسط)، وعلى الأربعة في الحي الكبير
function plazaPlanters(x, y, big) {
  const spots = big ? [[-11, 0], [0, -5.5], [11, 0], [0, 5.5]] : [[-11, 0], [11, 0]];
  for (const [dx, dy] of spots) {
    box(x + dx, y + dy, 1.9, 0.95, 1.6, '#8f8776', '#a8a08e', '#6b5a40');
    el(x + dx, y + dy - 2.6, 1.9, 1.3, '#5f8f4a');
    el(x + dx - 0.5, y + dy - 3.2, 1.1, 0.8, '#7aa85c');
  }
}

// رايتا القاعدة على ساريتين عند ركنيها الجانبيين (لا في الحي الصغير)
function hqBanners(x, y, size, color, tier = 0) {
  if (size === 'small' && !tier) return;
  const big = size === 'large' || tier >= 2, h = big ? 26 : 22, bw = big ? 4.2 : 3.4, bh = big ? 10 : 8;
  for (const sx of [-1, 1]) {
    const px = x + sx * 14.5, py = y + 1.5;
    ln(px, py, px, py - h, '#3a322a', 1);
    poly([[px - bw / 2, py - h + 2], [px + bw / 2, py - h + 2], [px + bw / 2, py - h + 2 + bh], [px, py - h + bh + 4], [px - bw / 2, py - h + 2 + bh]], color);
    ln(px - bw / 2, py - h + 2, px + bw / 2, py - h + 2, '#d9b44a', 0.9);
    if (big) circ(px, py - h - 1, 1.1, '#f2c14e');
  }
}

// --- كل مبنى حاسم ---
// type: Q مقر، N شرطة، S مستشفى، G مخزن سلاح، C برج ساعة، O نافورة، L معلم التلة،
// وفي طور الإمبراطورية: Q القاعدة الرئيسية (المقر نفسه)، T برج الرماية، M المستشفى (كمستشفى الأطوار الأخرى)
// يعيد نقطة السطح { x, y } لما يُرسم فوقه كل إطار (المصباح الوامض)
// badges: طور الإمبراطورية، شارة المبنى تُرسم فوقه كل إطار (empireArt.js) بدل العلم ولوحة الصليب القائمة
// tech: ما يتطور في المبنى مع ترقياته (evolveOf في empireBuildings.js)، وnull بلا اقتصاد
export function drawLandmark(map, type, x, y, i, j, ownerColor, flagColor, lights, badges = false, tech = null) {
  const S = specialsOf(map);
  const T = cityOf(map);

  if (type === 'Q' || type === 'T') {
    // برج الرماية بطراز المدينة (empireKind) وعلم مالكه فوقه كالقاعدة الرئيسية
    const district = districtOfTile(map, i, j);
    const kind = type === 'T' ? empireKind(map, 'T', district) : S.hq;
    const body = drawKind(map, kind, x, y, i, j);
    const top = y - roofTop(map, kind, i, j);
    // البرج يتطور بترقياته: شرفة رماة، وقوس منجنيق، ومجمرتان (صور اليمامة: جذع تقديري من ارتفاعها المقيس)
    if (type === 'T' && tech) plain(() => towerUpgrades(x, y, body || { w: 6.5, h: y - top - 4 }, tech));
    // القاعدة الرئيسية في طور الإمبراطورية: رايتان بلون مالكها عند مدخلها، وأكبر بقمم ذهبية في الحي الكبير (11هـ)
    // أو حين تبلغ المستوى 2 من تطورها
    if (type === 'Q' && badges && ownerColor && district) {
      plain(() => hqBanners(x, y, sizeOf(district), ownerColor, tech ? tech.tier : 0));
    }
    if (!badges) {
      plain(() => {
        ln(x, top + 1, x, top - 20, '#2b2825', 1.3);
        poly([[x, top - 20], [x + 12, top - 16], [x, top - 12]], ownerColor || flagColor);
      });
    }
    if (lights && ownerColor) lights.push({ x, y: top - 16, r: 14, c: '255,235,190', a: 0.25 });
    return null;
  }

  if (type === 'N') {
    drawKind(map, S.base, x, y, i, j);
    const top = y - roofTop(map, S.base, i, j);
    plain(() => {
      // لوحة الشرطة على الواجهة: زرقاء داكنة بشريط أبيض
      poly([[x + 2, y - 8], [x + 12, y - 13], [x + 12, y - 9], [x + 2, y - 4]], '#1f3a66');
      poly([[x + 3, y - 6.6], [x + 11, y - 10.6], [x + 11, y - 9.8], [x + 3, y - 5.8]], '#e8eef8');
      // ولوحة كبيرة فوق السطح: زرقاء بشريط أبيض وشارة، يعلوها المصباح
      ln(x, top + 1, x, top - 8, '#3d3a36', 1);
      poly([[x - 7, top - 8], [x + 7, top - 8], [x + 7, top - 16], [x - 7, top - 16]], '#1f3a66');
      poly([[x - 6, top - 11.2], [x + 6, top - 11.2], [x + 6, top - 12.8], [x - 6, top - 12.8]], '#e8eef8');
      poly([[x, top - 15.2], [x + 2, top - 13.6], [x + 1.2, top - 10.6], [x - 1.2, top - 10.6], [x - 2, top - 13.6]], '#f2c14e');
      box(x, top - 16, 1.6, 0.8, 1.6, '#2b2825', '#3d3a36', '#4a4744');
    });
    return { x, y: top - 20 };                     // المصباح نفسه يُرسم كل إطار (يومض)
  }

  if (type === 'S' || type === 'M') {
    // مستشفى طور الإمبراطورية بطراز المدينة (empireKind): في اليمامة قاعتها بسقفها المقوّس،
    // واللوحة في وسط السطح لا عند حافته الخلفية (hospitalRoof)
    const kind = type === 'M' ? empireKind(map, 'M', districtOfTile(map, i, j)) : S.base;
    const body = drawKind(map, kind, x, y, i, j);
    // المستشفى يتطور بترقياته: خيام إسعاف، وسيارة إسعاف، ومنارة (قاعة اليمامة: سطح تقديري من ارتفاعها المقيس)
    if (type === 'M' && tech) plain(() => hospitalUpgrades(x, y, body || { w: 10, h: roofTop(map, kind, i, j), top: roofTop(map, kind, i, j) }, tech, map.city));
    if (kind.startsWith(HOSPITAL)) return null;          // مستشفى المنطقة يرسم علامته بنفسه
    const top = y - roofTop(map, kind, i, j) + (type === 'M' ? hospitalRoof(map) : 0);
    if (type === 'M') {                                  // قاعة اليمامة: لوحة العلامة مسطحة في وسط سطحها
      plain(() => {
        const ctx = getCtx();
        ctx.save(); ctx.translate(x, top - 2); ctx.scale(1, 0.5); medicSign(ctx, 0, 0, 5.2, medicOf(map.city)); ctx.restore();
      });
      return null;
    }
    plain(() => {
      // صليب أحمر على لوحة بيضاء فوق السطح، كبير يُرى من بعيد
      poly([[x - 8, top - 2], [x, top - 6], [x + 8, top - 2], [x, top + 2]], '#f4f1ea');
      poly([[x - 6.5, top - 2], [x, top - 5.2], [x + 6.5, top - 2], [x, top + 1.2]], '#ffffff');
      poly([[x - 4.6, top - 3.4], [x - 1.6, top - 4.9], [x + 4.6, top - 1.8], [x + 1.6, top - 0.3]], '#d0322a');
      poly([[x - 4.6, top - 0.6], [x + 1.6, top - 3.7], [x + 4.6, top - 2.2], [x - 1.6, top + 0.9]], '#d0322a');
      // ولوحة واضحة قائمة فوقه (في طور الإمبراطورية مكانها الشارة: empireArt.js)
      if (badges) return;
      ln(x, top - 2, x, top - 12, '#5a5650', 0.9);
      el(x, top - 15, 4.6, 4.6, '#ffffff');
      poly([[x - 1.2, top - 18.6], [x + 1.2, top - 18.6], [x + 1.2, top - 16.2], [x + 3.6, top - 16.2], [x + 3.6, top - 13.8],
            [x + 1.2, top - 13.8], [x + 1.2, top - 11.4], [x - 1.2, top - 11.4], [x - 1.2, top - 13.8], [x - 3.6, top - 13.8],
            [x - 3.6, top - 16.2], [x - 1.2, top - 16.2]], '#d0322a');
    });
    return null;
  }

  if (type === 'G') {
    drawKind(map, S.base, x, y, i, j);
    const top = y - roofTop(map, S.base, i, j);
    plain(() => {
      // صناديق ذخيرة عند الباب، وشعار سلاحين متقاطعين على لوحة مستديرة فوق السطح
      box(x - 9, y + 5, 3.6, 1.8, 3.6, '#5e5232', '#74663e', '#857548');
      box(x - 4, y + 7.5, 3, 1.5, 3, '#5e5232', '#74663e', '#857548');
      ln(x, top - 1, x, top - 9, '#4a4640', 1);
      circ(x, top - 14, 5.6, '#2b2a28');
      circ(x, top - 14, 4.8, '#c9a648');
      circ(x, top - 14, 4, '#2b2a28');
      ln(x - 3, top - 17, x + 3, top - 11, '#e8e4dc', 1.3);
      ln(x + 3, top - 17, x - 3, top - 11, '#e8e4dc', 1.3);
      poly([[x - 3.6, top - 17.6], [x - 2.2, top - 17.4], [x - 3.4, top - 16.2]], '#e8e4dc');
      poly([[x + 3.6, top - 17.6], [x + 2.2, top - 17.4], [x + 3.4, top - 16.2]], '#e8e4dc');
    });
    return null;
  }

  if (type === 'C' || type === 'L') {
    // معلم المدينة؛ وبرج الساعة يحمل ساعة واضحة فوقه، والتلة يميزها التاج الذهبي فوق علمها
    if (typeof T.draw.landmark === 'function') T.draw.landmark(x, y, i, j, T);
    if (type === 'C') {
      const top = y - roofTop(map, 'landmark', i, j);
      plain(() => {
        ln(x, top + 1, x, top - 6, '#3d3a36', 1.2);
        circ(x, top - 11, 5.4, '#2b2825');
        circ(x, top - 11, 4.6, '#f4efe2');
        ln(x, top - 11, x, top - 14.2, '#2b2825', 0.8);
        ln(x, top - 11, x + 2.4, top - 10, '#2b2825', 0.8);
        circ(x, top - 11, 0.6, '#2b2825');
      });
    }
    return null;
  }

  if (type === 'P') {
    // ساحة العلم (نقطة الاستيلاء): بلاط وقاعدة حجرية للسارية، وأحواض نبات على أركانها بحجم الحي (11هـ)،
    // ودائرة متقطعة وعلم بلون المالك
    const district = districtOfTile(map, i, j), size = district ? sizeOf(district) : 'small';
    plain(() => {
      poly([[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6]], 'rgba(255,255,255,0.16)');
      const c = getCtx();
      c.beginPath();                                       // البلاط: شبكة معينات داخل الساحة
      for (let k = -2; k <= 2; k++) {
        c.moveTo(x - 6 + k * 3, y - 3 + k * 1.5 - 0); c.lineTo(x + 6 + k * 3, y + 3 + k * 1.5 - 0);
        c.moveTo(x + 6 + k * 3, y - 3 - k * 1.5 + 0); c.lineTo(x - 6 + k * 3, y + 3 - k * 1.5 + 0);
      }
      c.strokeStyle = 'rgba(70,55,35,0.16)';
      c.lineWidth = 0.5;
      c.stroke();
      // ساحة حي القاعدة تصير ساحة تدريب بمستوى تطورها، وإلا أحواض النبات
      if (tech && tech.tier) hqYard(x, y, tech.tier);
      else if (size !== 'small') plazaPlanters(x, y, size === 'large');
      c.beginPath();
      c.ellipse(x, y, 15, 7.5, 0, 0, 6.2832);
      c.strokeStyle = 'rgba(255,255,255,.55)';
      c.lineWidth = 0.8;
      c.setLineDash([3, 2]);
      c.stroke();
      c.setLineDash([]);
      // دائرة ذهبية تلمع حول قاعدة العلم (بطلب المستخدم): توهج شفاف ثم خط ذهبي، فيُرى العلم في كل مدينة
      const M = CAPTURE.flagMark, R = M.ring;
      c.beginPath();
      c.ellipse(x, y, R.rx, R.ry, 0, 0, 6.2832);
      c.strokeStyle = 'rgba(' + M.glow + ',' + R.glowAlpha + ')'; c.lineWidth = R.glowWidth; c.stroke();
      c.strokeStyle = M.color; c.lineWidth = R.width; c.stroke();
      box(x, y + 0.6, 2.2, 1.1, 1.4, '#8a8274', '#a39b8a', '#c2b9a6');   // قاعدة السارية
      ln(x, y - 1.2, x, y - 22, '#2b2825', 1.2);
      poly([[x, y - 22], [x + 10, y - 19], [x, y - 16]], ownerColor || '#e8e2d6');
    });
    // ليلاً: ضوء ذهبي عند العلم
    if (lights) lights.push({ x, y: y - 4, r: CAPTURE.flagMark.light.r, c: CAPTURE.flagMark.glow, a: CAPTURE.flagMark.light.alpha });
    return null;
  }

  if (type === 'F') {
    // مبنى ميزة المدينة (القسم 3.11): كتلة 2×2 مرسومة من مربعها الأمامي، لا يُصبغ، وشارته فوقه (featureArt.js)
    const district = map.districtOf(i, j);
    if (district && district.feature) drawFeatureBuilding(district.feature, x, y, i, j, !!district.featureBig);
    return null;
  }

  if (type === 'O') {
    // نافورة الساحة بطراز المدينة
    if (typeof T.draw.plazaProp === 'function') T.draw.plazaProp(x, y, i, j, T);
    return null;
  }
  return null;
}

// مكان المصباح الأزرق فوق مركز الشرطة بلا رسم (لطبقة المصابيح الخفيفة)
export function lampSpot(map, i, j, x, y) {
  const top = y - roofTop(map, specialsOf(map).base, i, j);
  return { x, y: top - 20 };
}

// المصباح الأزرق الوامض فوق مركز الشرطة: يُرسم كل إطار فوق الطبقة الثابتة
export function drawPoliceLamp(ctx, spot, time, lights) {
  const blink = 0.35 + 0.65 * Math.max(0, Math.sin(time * 6));
  ctx.globalAlpha = blink;
  ctx.beginPath(); ctx.arc(spot.x, spot.y, 2.6, 0, 6.2832); ctx.fillStyle = '#5b9bd5'; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(spot.x, spot.y, 1.3, 0, 6.2832); ctx.fillStyle = '#dbeaf7'; ctx.fill();
  if (lights) lights.push({ x: spot.x, y: spot.y + 1, r: 26, c: '90,155,215', a: 0.35 + 0.35 * blink });
}
