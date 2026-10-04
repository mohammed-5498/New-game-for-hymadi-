// المباني الحاسمة للعب بطراز المدينة (القسم 3.9): تُعرف من لمحة في أي مدينة
// - المقر: أعلى مبنى من طراز المدينة + علم العصابة
// - مركز الشرطة: مبنى المدينة + لوحة الشرطة + المصباح الأزرق الوامض
// - المستشفى: مبنى المدينة + صليب أحمر واضح على السطح
// - مخزن السلاح: مبنى المدينة + شعار سلاحين متقاطعين
// - برج الساعة والتلة: معلم المدينة (landmark) + ساعة، أو تاج ذهبي فوق علم التلة
// العلامات لا تُصبغ بلون المالك حتى تبقى واضحة دائماً.
import { CITY_SPECIALS } from '../config.js';
import { THEMES, getCtx, setThemeContext, setTone, getTone, poly, circ, ln, box, el } from './cityThemes.js';

const cityOf = (map) => THEMES[map.city] || THEMES.arab;
const specialsOf = (map) => CITY_SPECIALS[map.city] || CITY_SPECIALS.arab;

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
    const saved = getCtx(), savedTone = getTone();
    setThemeContext(pc, map.seed || 0);
    setTone(null);
    drawKind(map, kind, 0, 0, i, j);
    setThemeContext(saved, map.seed || 0);
    setTone(savedTone);
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

function drawKind(map, kind, x, y, i, j) {
  const T = cityOf(map);
  const fn = T.draw[kind];
  if (typeof fn === 'function') fn(x, y, i, j, T);
}

// بلا صبغ: العلامات واضحة بألوانها دائماً
function plain(draw) {
  const saved = getTone();
  setTone(null);
  draw();
  setTone(saved);
}

// --- كل مبنى حاسم ---
// type: Q مقر، N شرطة، S مستشفى، G مخزن سلاح، C برج ساعة، O نافورة، L معلم التلة
// يعيد نقطة السطح { x, y } لما يُرسم فوقه كل إطار (المصباح الوامض)
export function drawLandmark(map, type, x, y, i, j, ownerColor, flagColor, lights) {
  const S = specialsOf(map);
  const T = cityOf(map);

  if (type === 'Q') {
    drawKind(map, S.hq, x, y, i, j);
    const top = y - roofTop(map, S.hq, i, j);
    plain(() => {
      ln(x, top + 1, x, top - 20, '#2b2825', 1.3);
      poly([[x, top - 20], [x + 12, top - 16], [x, top - 12]], ownerColor || flagColor);
    });
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

  if (type === 'S') {
    drawKind(map, S.base, x, y, i, j);
    const top = y - roofTop(map, S.base, i, j);
    plain(() => {
      // صليب أحمر على لوحة بيضاء فوق السطح، كبير يُرى من بعيد
      poly([[x - 8, top - 2], [x, top - 6], [x + 8, top - 2], [x, top + 2]], '#f4f1ea');
      poly([[x - 6.5, top - 2], [x, top - 5.2], [x + 6.5, top - 2], [x, top + 1.2]], '#ffffff');
      poly([[x - 4.6, top - 3.4], [x - 1.6, top - 4.9], [x + 4.6, top - 1.8], [x + 1.6, top - 0.3]], '#d0322a');
      poly([[x - 4.6, top - 0.6], [x + 1.6, top - 3.7], [x + 4.6, top - 2.2], [x - 1.6, top + 0.9]], '#d0322a');
      // ولوحة واضحة قائمة فوقه
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

  if (type === 'O') {
    // نافورة الساحة بطراز المدينة
    if (typeof T.draw.plazaProp === 'function') T.draw.plazaProp(x, y, i, j, T);
    return null;
  }
  return null;
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
