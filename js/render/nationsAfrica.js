/* الدفعة الأفريقية (المرحلة 9ب، القسم 3.10): إثيوبيا «أبطال عدوة»، نيجيريا «مقاتلو الدمبي»، السودان «رماة النوبة».
   منقولة من docs/nations/batch4-skins.js: نفس الأشكال والنسب والألوان، مع إضافات اللعبة كما في الدفعات السابقة:
   حقول السلاح، وحلقات الأبطال والهالات، والحجر والمشعل يختفيان لحظة الرمي، والقوس الطويل بشد الوتر (pullBow)،
   ونسخة مبسّطة لكل وحدة، والنقاط أعداد مباشرة بلا مصفوفات جديدة في كل إطار.
   - رامي المشاعل: مشعله يطير مشعلاً (shotLook)، وقواعده قواعد رامي النار (يشعل الأرض حيث يسقط)
   - الأدوات المشتركة (torso وpullBow وquiverBack وglowAt وCREAM) في nationArt.js
   (المرحلة 9ج) بالنمط المظلَّل: طرف النطالة ولثام العمامة والعباءات أشكال مستقلة في النسخ الكاملة، والمشعل بلهب
   الطبقات (batch4 المحدث)، وتفاصيل skins-v6.js: حافة ذهبية متعرجة ولوح أزرق وعصابة ذهبية وأشعة الراس لإثيوبيا،
   وحواف ومعينات ذهبية وشريط ذراع وعباءة حمراء للبطل لنيجيريا، ولفائف الصنادل وحافة مغرة متعرجة للسودان. */
import { dk, limb, ell, rrect, tri, flame } from './anim.js';
import { heroRing } from './bodies.js';
import {
  registerNation, both, memo, mixHex, GOLD, STEEL2, CREAM, auraRing, auraHealRings,
  lp, pg, dot, robe, stripes, belt, staff, ellTo, triTo, at, PT, torso, hStripes, vStripes, pullBow, quiverBack,
  hemZig, hemDiamonds, hemLine, apron, armband, legWraps
} from './nationArt.js';

const ETG = '#2e8b57', ETY = '#e8c23a', ETR = '#c8322a', MANE = '#c9923a', MANE2 = '#a8742a', INDG = '#24325e', OCHRE = '#c98a3a';

// ---------- إثيوبيا: الشمّا البيضاء بحواف «تيبب» ملونة، الشوتيل المعقوف، الدرع الجلدي، عرف الأسد ----------
const shammaCol = memo(col => mixHex(col, '#f4f1ea', 0.62));
const shawlCol = memo(col => mixHex(col, '#ffffff', 0.75));
const netelaCol = memo(col => mixHex(col, '#f4f1ea', 0.75));
const TIBEB = [0.9, 0.95], TIBEB_COLS = [ETG, ETR];
const ETH_GOLD = '#d9b040', ETH_BLUE = '#2f4a8a';
// الشمّا: ثوب أبيض بحاشية خضراء وحمراء، ووشاح مائل بخيط أصفر (المبسّطة: الثوب وحده، فالوشاح بلون قريب منه لا يظهر صغيراً)،
// وفي الكاملة (skins-v6) حافة ذهبية متعرجة، ولوح أزرق بحافة ذهبية لغير الفرد العادي (panel)
function shamma(c, J, col, len, lite, panel) {
  robe(c, J, len, shammaCol(col), lite ? null : dk(col, 0.25), 'chest', 1.6);
  if (lite) return;
  stripes(c, TIBEB, TIBEB_COLS, 0.7);
  at(J.chest, -2.4, -0.4, J.a2); const ax = PT.x, ay = PT.y;
  at(J.hip, 2.8, 0, J.pl);
  limb(c, ax, ay, PT.x, PT.y, 1.4, shawlCol(col));
  limb(c, ax + 0.4, ay + 0.9, PT.x + 0.4, PT.y + 0.9, 0.5, ETY);
  hemZig(c, ETH_GOLD, 0.84, 8, 1.1);
  if (panel) apron(c, ETH_BLUE, ETH_GOLD);
}
// العصابة الذهبية على النطالة (skins-v6)
function goldBand(c) { c.beginPath(); c.ellipse(0, -1.3, 4.25, 1.2, 0, Math.PI * 1.02, Math.PI * 1.98); c.strokeStyle = ETH_GOLD; c.lineWidth = 0.6; c.stroke(); }
// النطالة على الرأس بطرف متدلٍّ
// (الكاملة: الطرف مضلع مستقل يأخذ تدرجه، وعصابة ذهبية)
const NETELA_DRAPE = [[-4.3, -1], [-5.2, 4.6], [-2.2, 4], [-2.4, -0.4]];
function netela(c, col, lite) {
  c.beginPath();
  c.ellipse(0, -1, 4.3, 3.9, 0, Math.PI, 0); c.closePath();
  if (lite) { c.moveTo(-4.3, -1); c.lineTo(-2.4, -0.4); c.lineTo(-2.2, 4); c.lineTo(-5.2, 4.6); c.closePath(); }
  c.fillStyle = netelaCol(col); c.fill();
  if (lite) return;
  pg(c, NETELA_DRAPE, netelaCol(col));
  limb(c, -5, 4.4, -2.3, 3.9, 0.6, ETG);
  goldBand(c);
}
// غطاء رأس من عرف الأسد (الراس): خصلات بلونين، ورسمة لكل لون
function maneTris(big) {
  const n = big ? 16 : 11, R = big ? 6.8 : 5.4, out = [];
  for (let k = 0; k < n; k++) {
    const a = Math.PI * 0.55 + k / (n - 1) * Math.PI * 1.25;
    out.push(Math.cos(a) * 2.6, Math.sin(a) * 2.6 - 0.6, Math.cos(a) * R, Math.sin(a) * R - 0.8, Math.cos(a + 0.25) * 2.6, Math.sin(a + 0.25) * 2.6 - 0.6);
  }
  return out;
}
const MANE_BIG = maneTris(true);
function maneHead(c, lite) {
  const T = MANE_BIG;
  for (let pass = 0; pass < (lite ? 1 : 2); pass++) {
    c.beginPath();
    for (let k = lite ? 0 : pass; k < T.length / 6; k += lite ? 1 : 2) {
      const i = k * 6; triTo(c, T[i], T[i + 1], T[i + 2], T[i + 3], T[i + 4], T[i + 5]);
    }
    c.fillStyle = lite || pass ? MANE : MANE2; c.fill();
  }
  ell(c, 0, -2.4, 3.9, 1, '#d9b06a');
  if (lite) return;
  ell(c, 0, -2.4, 3.9, 0.4, '#b8c0c8');
  c.beginPath();                                 // أشعة ذهبية في العرف (skins-v6)
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * 0.62 + k / 8 * Math.PI * 1.1, ca = Math.cos(a), sa = Math.sin(a);
    c.moveTo(ca * 4.2, sa * 4.2 - 0.8); c.lineTo(ca * 7.4, sa * 7.4 - 1);
  }
  c.strokeStyle = '#f0c850'; c.lineWidth = 0.5; c.stroke();
}
// الشوتيل: سيف معقوف كالمنجل (المبسّطة: النصل وحده بلا مقبض)
function shotel(c, J, p, L, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  if (!lite) limb(c, hx - dx * 1.2, hy - dy * 1.2, hx + dx * 0.6, hy + dy * 0.6, 1.2, '#4a3424');
  c.beginPath(); c.moveTo(hx + dx * 0.6, hy + dy * 0.6);
  c.quadraticCurveTo(hx + dx * L * 1.05 + nx * L * 0.25, hy + dy * L * 1.05 + ny * L * 0.25, hx + dx * L * 0.55 - nx * L * 0.45, hy + dy * L * 0.55 - ny * L * 0.45);
  c.strokeStyle = STEEL2; c.lineWidth = 1.2; c.stroke();
}
// الغاشا: درع جلدي مستدير، والمزخرف بمسامير فضية (المبسّطة: قرص واحد بلا حافة ولا قلب ولا مسامير)
function gasha(c, x, y, r, deco, lite) {
  if (lite) { dot(c, x, y, r, '#8a5630'); return; }
  dot(c, x, y, r, '#7a4a2a'); dot(c, x, y, r * 0.82, '#9a6236');
  c.beginPath(); ellTo(c, x, y, r * 0.3, r * 0.3);
  if (deco) for (let k = 0; k < 6; k++) { const a = k * 1.047; ellTo(c, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, 0.45, 0.45); }
  c.fillStyle = deco ? '#c9ced4' : '#5a3a22'; c.fill();
}
function ethiopia(lite) {
  return {
    common: { sx: 0.98, sy: 1.03, lw: 2.9, headR: 3.5, wlen: 6, legFrom: lite ? 0.78 : 0,
      head: (c, p, col) => netela(c, col, lite),
      robe: (c, J, p, col) => shamma(c, J, col, 0.78, lite, false),
      back: (c, J) => gasha(c, J.handB[0], J.handB[1], 3.4, false, lite),
      weapon: (c, J, p) => shotel(c, J, p, 6, lite) },
    boss: { sx: 0.98, sy: 1.03, lw: 2.9, headR: 3.5, wlen: 4.2, legFrom: lite ? 0.8 : 0,
      ground: auraRing,
      head: (c, p, col) => netela(c, col, lite),
      robe: (c, J, p, col) => shamma(c, J, col, 0.8, lite, true),
      over(c, J) {                               // النقارة: طبل الحرب على الورك بحزامه، وفي الكاملة شدّ متعرج (skins-v6)
        at(J.hip, 3.2, -0.4, J.pl); const x = PT.x, y = PT.y;
        ell(c, x, y + 2.4, 3.2, 1.2, '#7a4a2a'); rrect(c, x - 3.2, y - 0.2, 6.4, 2.6, 0.4, '#9a5a2e'); ell(c, x, y - 0.2, 3.2, 1.2, '#e6d6b4');
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 4; k++) { c.moveTo(x - 2.6 + k * 1.7, y + 0.4); c.lineTo(x - 2.2 + k * 1.7, y + 2.2); }
        c.strokeStyle = '#5a3a22'; c.lineWidth = 0.4; c.stroke();
        limb(c, x - 3, y - 0.2, J.chest[0] - 1, J.chest[1], 0.5, '#5a3a22');
        c.beginPath();
        for (let k = 0; k <= 6; k++) { const zx = x - 3 + k, zy = y + (k % 2 ? 2.3 : 0.1); if (k) c.lineTo(zx, zy); else c.moveTo(zx, zy); }
        c.strokeStyle = '#e8d8b0'; c.lineWidth = 0.4; c.stroke();
      },
      weapon(c, J, p) {                          // عصا الطبل
        const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
        limb(c, hx, hy, hx + dx * 4, hy + dy * 4, 0.9, '#5a3a22');
        dot(c, hx + dx * 4.2, hy + dy * 4.2, 0.9, '#e6d6b4');
      } },
    medic: { sx: 0.98, sy: 1.02, lw: 2.8, headR: 3.5, wlen: 1.6, legFrom: lite ? 0.9 : 0,
      head(c, p, col) { ell(c, 0, -1.8, 4, 2.2, netelaCol(col)); if (!lite) { limb(c, -3.4, -1.6, 3.6, -1.6, 0.6, ETY); goldBand(c); } },
      robe: (c, J, p, col) => shamma(c, J, col, 0.9, lite, true),
      over: lite ? undefined : (c, J) => {       // حقيبة الدواء
        at(J.hip, -2.2, -0.8, J.pl); const x = PT.x, y = PT.y;
        rrect(c, x - 1.6, y - 0.4, 3, 3, 0.6, '#8a5a36'); limb(c, x - 1.2, y + 0.6, x + 1.2, y + 0.6, 0.4, ETR);
      },
      weapon(c, J) {                             // قرن الدواء
        const hx = J.handF[0], hy = J.handF[1];
        c.beginPath(); c.moveTo(hx - 1, hy + 1); c.quadraticCurveTo(hx + 2.6, hy - 0.4, hx + 1.6, hy - 3.6);
        c.strokeStyle = '#d9c8a0'; c.lineWidth = 1.6; c.stroke();
        ell(c, hx + 1.6, hy - 3.8, 0.8, 0.5, '#5a4a32');
      } },
    champion: { sx: 1.0, sy: 1.08, lw: 3.0, headR: 3.5, wlen: 12, legFrom: lite ? 0.84 : 0,
      ground: auraHealRings,
      head: (c) => maneHead(c, lite),
      back(c, J) {                               // عباءة من عرف الأسد بحاشية خصلات، ودرع مزخرف في اليد الخلفية
        const L = J.legB, hx = L.h[0] + (L.k[0] - L.h[0]) * 0.7, hy = L.h[1] + (L.k[1] - L.h[1]) * 0.7;
        at(J.chest, -3, -0.8, J.a2); const sx = PT.x, sy = PT.y;
        at(J.chest, 1.8, -0.6, J.a2);
        if (lite) {
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(PT.x, PT.y); c.lineTo(hx + 1.8, hy); c.lineTo(hx - 4.6, hy); c.closePath();
          c.fillStyle = MANE2; c.fill();
        } else pg(c, [[sx, sy], [PT.x, PT.y], [hx + 1.8, hy], [hx - 4.6, hy]], MANE2);
        if (!lite) {
          c.beginPath();
          for (let k = 1; k < 7; k += 2) { const px = hx - 4.6 + 6.4 * k / 6; triTo(c, px - 0.7, hy, px, hy + 2.4, px + 0.7, hy); }
          c.fillStyle = MANE; c.fill();
          c.beginPath();
          for (let k = 0; k < 7; k += 2) { const px = hx - 4.6 + 6.4 * k / 6; triTo(c, px - 0.7, hy, px, hy + 2.4, px + 0.7, hy); }
          c.fillStyle = MANE2; c.fill();
        }
        gasha(c, J.handB[0], J.handB[1], 4.4, true, lite);
      },
      robe: (c, J, p, col) => shamma(c, J, col, 0.84, lite, true),
      weapon(c, J, p) {                          // الرمح
        const s = staff(c, J, p, 4, 9, 1, '#5a3a22'), dx = s.dx, dy = s.dy, bx = s.bx, by = s.by;
        c.beginPath(); triTo(c, bx - dy * 0.9, by + dx * 0.9, bx + dx * 3, by + dy * 3, bx + dy * 0.9, by - dx * 0.9);
        c.fillStyle = STEEL2; c.fill();
      } }
  };
}

// ---------- نيجيريا: إزار مصبوغ بنيلي كانو، قبعة «هولا» مطرزة، اليد الضاربة ملفوفة، تمائم، درع قطني محشو ----------
// قبعة الهولا المطرزة (المبسّطة: القبعة بلا تطريز)
function hula(c, lite) {
  c.beginPath(); c.ellipse(0, -1.4, 3.9, 3.4, 0, Math.PI, 0); c.fillStyle = CREAM; c.fill();
  if (lite) return;
  for (let pass = 0; pass < 2; pass++) {
    c.beginPath();
    for (let k = pass; k < 3; k += 2) { const rx = 3.9 - k * 1.1, ry = 3.4 - k; c.moveTo(-rx, -1.4); c.ellipse(0, -1.4, rx, ry, 0, Math.PI, 0); }
    c.strokeStyle = pass ? ETR : INDG; c.lineWidth = 0.4; c.stroke();
  }
}
// العمامة النيلية بلثام
const VEIL = [[0.4, 0.2], [3.8, -0.4], [3.6, 2.6], [0.4, 2.9]];
function veilTurban(c, lite) {
  if (!lite) { ell(c, 0, -1.9, 4.3, 2.5, INDG); pg(c, VEIL, INDG); limb(c, -3.6, -1.6, 3.8, -2.2, 0.4, '#3a4a7e'); return; }
  c.beginPath(); ellTo(c, 0, -1.9, 4.3, 2.5);
  c.moveTo(0.4, 0.2); c.lineTo(0.4, 2.9); c.lineTo(3.6, 2.6); c.lineTo(3.8, -0.4); c.closePath();
  c.fillStyle = INDG; c.fill();
}
// الإزار النيلي المنقّط بحزام بلون اللاعب (المبسّطة: الإزار والحزام بلا نقاط)
function indigoWrap(c, J, col, len, lite) {
  const r = robe(c, J, len, INDG, lite ? null : '#1a2448', 'waist', 1);
  if (!lite) {
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const t = 0.2 + k * 0.16;
      const ax = r.w1x + (r.bx - r.w1x) * t, ay = r.w1y + (r.by - r.w1y) * t, bx = r.w2x + (r.fx - r.w2x) * t, by = r.w2y + (r.fy - r.w2y) * t;
      for (let m = 0; m < 4; m++) { const u = 0.15 + m * 0.24; ellTo(c, ax + (bx - ax) * u, ay + (by - ay) * u, 0.35, 0.35); }
    }
    c.fillStyle = '#5a6ea8'; c.fill();
  }
  belt(c, J, col, 1.2);
  if (lite) return;
  hemLine(c, 0.95, NGA_GOLD, 0.6); hemDiamonds(c, NGA_GOLD, 0.72, 4); hemLine(c, 0.02, NGA_GOLD, 0.9);   // skins-v6
}
const NGA_GOLD = '#d9b040';
// شريط ذراع جلدي بزر ذهبي (skins-v6)
const nigArmband = (c, J) => armband(c, J, '#5a3a22', NGA_GOLD, 0.4);
// اليد الضاربة ملفوفة بالقماش وطرف أحمر متدلٍّ (المبسّطة: اللفّة وحدها)
function wrappedFist(c, x, y, big, lite) {
  const s = big ? 1.25 : 1;
  dot(c, x, y, 1.7 * s, CREAM);
  if (lite) return;
  c.beginPath();
  for (let k = 0; k < 3; k++) { c.moveTo(x - 1.4 * s, y - 1 + k); c.lineTo(x + 1.4 * s, y - 0.6 + k); }
  c.strokeStyle = '#b8a888'; c.lineWidth = 0.35; c.stroke();
  limb(c, x - 1, y + 1.4 * s, x - 1.6, y + 3.6 * s, 0.5, ETR);
}
// تمائم جلدية على الذراع الأمامية
function amulets(c, J, n) {
  const ex = J.elbowF ? J.elbowF[0] : J.Sf[0], ey = J.elbowF ? J.elbowF[1] : J.Sf[1];
  c.beginPath();
  for (let k = 0; k < n; k++) {
    const t = 0.4 + k * 0.25, x = J.Sf[0] + (ex - J.Sf[0]) * t, y = J.Sf[1] + (ey - J.Sf[1]) * t;
    if (c.roundRect) c.roundRect(x - 0.7, y - 0.6, 1.4, 1.2, 0.2); else c.rect(x - 0.7, y - 0.6, 1.4, 1.2);
  }
  c.fillStyle = '#6a4428'; c.fill();
}
// الدرع القطني المحشو بخطوط متقاطعة (المبسّطة: اللوح بلا خطوط)
const quiltCol = memo(col => mixHex(col, '#efe2c6', 0.55));
const QUILT_V = [0.25, 0.5, 0.75];
function quilted(c, J, col, lite) {
  const T = torso(c, J, quiltCol(col), lite ? null : dk(col, 0.3));
  if (lite) return;
  hStripes(c, T, 3, '#8a7a5a', 0.4);
  vStripes(c, T, QUILT_V, '#8a7a5a', 0.4);
}
const CHAMP_STRIPES = [0.4, 0.75], CHAMP_STRIPE_COLS = [CREAM, GOLD];
function nigeria(lite) {
  return {
    common: { sx: 0.98, sy: 1.0, lw: 2.9, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.45 : 0,
      head: (c) => hula(c, lite),
      robe: (c, J, p, col) => indigoWrap(c, J, col, 0.45, lite),
      front(c, J) { wrappedFist(c, J.handF[0], J.handF[1], false, lite); if (!lite) nigArmband(c, J); },
      back: lite ? undefined : (c, J) => limb(c, J.handB[0], J.handB[1], J.handB[0] + 0.8, J.handB[1] - 1.4, 0.9, '#d9c8a0') },
    armored: { sx: 0.98, sy: 0.98, lw: 2.9, headR: 3.5, wlen: 3, legFrom: lite ? 0.7 : 0,
      head: (c) => veilTurban(c, lite),
      chest: (c, J, p, col) => quilted(c, J, col, lite),
      robe: (c, J, p, col) => indigoWrap(c, J, col, 0.7, lite),
      front(c, J) {                              // درع جلدي مستدير بصليب من القماش وقلب ذهبي
        const x = J.handF[0] + 1.2, y = J.handF[1];
        dot(c, x, y, 5.2, '#6a4428'); dot(c, x, y, 4.4, '#8a5a36');
        if (lite) return;
        c.beginPath(); c.moveTo(x, y - 4.2); c.lineTo(x, y + 4.2); c.moveTo(x - 4.2, y); c.lineTo(x + 4.2, y);
        c.strokeStyle = CREAM; c.lineWidth = 0.6; c.stroke();
        dot(c, x, y, 1.1, GOLD);
      } },
    smasher: { sx: 0.98, sy: 1.0, lw: 2.9, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.5 : 0,
      head(c) { ell(c, -0.4, -2.6, 3.4, 1.2, INDG); },
      robe: (c, J, p, col) => indigoWrap(c, J, col, 0.5, lite),
      front(c, J) { if (!lite) amulets(c, J, 2); wrappedFist(c, J.handF[0], J.handF[1], true, lite); if (!lite) nigArmband(c, J); },
      back: (c, J) => wrappedFist(c, J.handB[0], J.handB[1], false, lite) },
    champion: { sx: 1.0, sy: 1.06, lw: 3.0, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.55 : 0,
      ground: heroRing,
      head(c) { hula(c, lite); ell(c, 0, -4.6, 1, 0.8, ETR); },
      chest: lite ? undefined : (c, J) => {      // حبال وأحزمة على الصدر بالأحمر والذهبي
        const a = J.a2;
        for (let pass = 0; pass < 2; pass++) {
          c.beginPath();
          for (let k = pass; k < 3; k += 2) {
            at(J.chest, -1.6 + k * 0.4, -1 + k * 0.6, a); const ax = PT.x, ay = PT.y;
            at(J.chest, 1.8 + k * 0.2, 0.4 + k * 1.2, a);
            c.moveTo(ax, ay); c.quadraticCurveTo((ax + PT.x) / 2, (ay + PT.y) / 2 + 1.4, PT.x, PT.y);
          }
          c.strokeStyle = pass ? ETR : GOLD; c.lineWidth = 0.6; c.stroke();
        }
      },
      back: lite ? undefined : (c, J) => {       // عباءة حمراء بحافة ذهبية (skins-v6)
        const L = J.legB, hx = L.h[0] + (L.k[0] - L.h[0]) * 0.8, hy = L.h[1] + (L.k[1] - L.h[1]) * 0.8;
        at(J.chest, -2.6, -0.8, J.a2); const ax = PT.x, ay = PT.y;
        at(J.chest, 1.2, -0.6, J.a2);
        pg(c, [[ax, ay], [PT.x, PT.y], [hx + 1, hy], [hx - 4, hy]], ETR, NGA_GOLD, 0.7);
      },
      robe(c, J) {                               // إزار أحمر مخطط وحزام ذهبي عريض، وفي الكاملة حافة ذهبية متعرجة
        robe(c, J, 0.55, ETR, lite ? null : '#6a1a16', 'waist', 1.2);
        if (!lite) stripes(c, CHAMP_STRIPES, CHAMP_STRIPE_COLS, 0.6);
        belt(c, J, GOLD, 1.8);
        if (!lite) hemZig(c, NGA_GOLD, 0.9, 6, 1.1);
      },
      front(c, J) { if (!lite) amulets(c, J, 3); wrappedFist(c, J.handF[0], J.handF[1], true, lite); if (!lite) nigArmband(c, J); } }
  };
}

// ---------- السودان: ثياب بيضاء ومغرة، عصابة رأس بريشة، قوس طويل، مشاعل، تاج الكنداكة ----------
// عصابة الرأس بريشة أو اثنتين (بيضاء ثم سوداء)
function featherBand(c, n) {
  ell(c, 0, -1.8, 4, 0.8, OCHRE);
  for (let pass = 0; pass < Math.min(2, n); pass++) {
    c.beginPath();
    for (let k = pass; k < n; k += 2) {
      c.moveTo(-1.4 - k * 1.2, -2.2); c.quadraticCurveTo(-2.4 - k * 1.6, -6, -0.8 - k * 1.4, -8.4);
      c.lineTo(-0.2 - k * 1.2, -7.8); c.quadraticCurveTo(-1.6 - k * 1.4, -5.6, -0.6 - k * 1.2, -2.2); c.closePath();
    }
    c.fillStyle = pass ? '#2a2a2a' : '#f2efe6'; c.fill();
  }
}
const kiltCol = memo(col => mixHex(col, '#f4f1ea', 0.62));
const KILT_TS = [0.85], KILT_COLS = [OCHRE];
// الإزار الأبيض بحاشية مغرة وحزام مغرة (المبسّطة: الإزار وحده)
// وفي الكاملة (skins-v6) لفائف الصنادل على الساقين وحافة مغرة متعرجة
function kilt(c, J, col, len, lite) {
  robe(c, J, len, kiltCol(col), lite ? null : dk(col, 0.25), 'waist', 1.2);
  if (lite) return;
  stripes(c, KILT_TS, KILT_COLS, 0.8);
  belt(c, J, OCHRE, 1.4);
  nubianWraps(c, J);
}
function nubianWraps(c, J) { legWraps(c, J, '#8a5a32'); hemZig(c, OCHRE, 0.94, 6, 0.9); }
// المشعل في اليد (يختفي لحظة الرمي فهو نفسه ما يُرمى)
function torch(c, J, p, lite) {
  if (p.thrown) return;
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1], tx = hx + dx * 4.6, ty = hy + dy * 4.6;
  limb(c, hx - dx, hy - dy, tx, ty, 1.1, '#6a4a2a');
  if (lite) { c.beginPath(); triTo(c, tx - 1.3, ty, tx, ty - 4.2, tx + 1.3, ty); c.fillStyle = '#f0902a'; c.fill(); return; }
  rrect(c, tx - 0.9, ty - 0.6, 1.8, 1.4, 0.3, '#5a3a22');      // رأس المشعل ولهب بطبقات (batch4 المحدث)
  flame(c, tx, ty - 0.4, 1);
}
const longbow = pullBow(9, 1.3, '#6a4a2a', 1), queenBow = pullBow(9, 1.4, GOLD, 3);
const robeCol55 = memo(col => mixHex(col, '#f4f1ea', 0.55));
const QUEEN_TS = [0.55, 0.9], QUEEN_COLS = [GOLD, OCHRE];
function sudan(lite) {
  return {
    common: { sx: 0.97, sy: 1.04, lw: 2.8, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.5 : 0,
      head: (c) => featherBand(c, 1),
      robe: (c, J, p, col) => kilt(c, J, col, 0.5, lite),
      weapon(c, J, p) { if (!p.thrown) dot(c, J.handF[0] + 0.6, J.handF[1] - 0.6, 1.3, '#8a857c'); } },   // حجر
    sniper: { sx: 0.97, sy: 1.06, lw: 2.8, headR: 3.5, wlen: 2, legFrom: lite ? 0.56 : 0,
      head: (c) => featherBand(c, 2),
      robe: (c, J, p, col) => kilt(c, J, col, 0.56, lite),
      back: (c, J) => quiverBack(c, J, '#7a4a2a', '#f2efe6', lite),
      weapon: longbow },
    firebomber: { sx: 0.98, sy: 1.03, lw: 2.9, headR: 3.5, wlen: 4.6, legFrom: lite ? 0.52 : 0,
      head: (c) => featherBand(c, 1),
      robe: (c, J, p, col) => kilt(c, J, col, 0.52, lite),
      back: lite ? undefined : (c, J) => {       // مشعلان احتياطيان على الظهر
        c.beginPath();
        for (let k = 0; k < 2; k++) {
          at(J.chest, -2 + k * 0.8, -1, J.a2); c.moveTo(PT.x, PT.y);
          at(J.mid, -2.6 + k * 0.8, 2.4, J.pl); c.lineTo(PT.x, PT.y);
        }
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 0.9; c.stroke();
      },
      weapon: (c, J, p) => torch(c, J, p, lite) },
    champion: { sx: 1.0, sy: 1.08, lw: 3.0, headR: 3.5, wlen: 2, legFrom: lite ? 0.94 : 0,
      ground: heroRing,
      head(c) {                                  // تاج الكنداكة الذهبي بريشتين بيضاوين وحجر فيروزي
        c.beginPath(); c.ellipse(0, -1.2, 4.1, 3.8, 0, Math.PI, 0); c.fillStyle = GOLD; c.fill();
        ell(c, 0, -1.4, 4.2, 0.8, '#e0b84a');
        c.beginPath();
        for (let k = 0; k < 2; k++) {
          c.moveTo(-0.6 + k * 1.2, -4.6); c.quadraticCurveTo(-1.4 + k * 1.6, -9, -0.2 + k * 1.2, -11);
          c.lineTo(0.4 + k * 1.2, -10.4); c.quadraticCurveTo(-0.4 + k * 1.4, -8, 0.4 + k * 1.2, -4.6); c.closePath();
        }
        c.fillStyle = '#f2efe6'; c.fill();
        if (!lite) dot(c, 2.6, -3.2, 0.7, '#2f8f8a');
      },
      back(c, J) {                               // عباءة مغرة بحافة ذهبية
        const L = J.legB, qx = L.k[0] + (L.f[0] - L.k[0]) * 0.85, qy = L.k[1] + (L.f[1] - L.k[1]) * 0.85;
        at(J.chest, -2.2, -0.4, J.a2); const ax = PT.x, ay = PT.y;
        at(J.chest, 1, 0, J.a2);
        if (!lite) { pg(c, [[ax, ay], [PT.x, PT.y], [qx, qy], [qx - 4.6, qy]], OCHRE, GOLD, 0.8); return; }
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(PT.x, PT.y); c.lineTo(qx, qy); c.lineTo(qx - 4.6, qy); c.closePath();
        c.fillStyle = OCHRE; c.fill();
      },
      robe(c, J, p, col) {                       // ثوب طويل بخطين ذهبي ومغرة وأهداب ذهبية على الحاشية
        const r = robe(c, J, 0.94, robeCol55(col), lite ? null : dk(col, 0.25), 'chest', 2);
        if (lite) return;
        stripes(c, QUEEN_TS, QUEEN_COLS, 0.9);
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const t = k / 5, x = r.bx + (r.fx - r.bx) * t, y = r.by + (r.fy - r.by) * t;
          c.moveTo(x, y); c.lineTo(x, y + 1.4);
        }
        c.strokeStyle = GOLD; c.lineWidth = 0.4; c.stroke();
        nubianWraps(c, J);
      },
      over: lite ? undefined : (c, J) => belt(c, J, GOLD, 1.6),
      weapon: queenBow }
  };
}

registerNation('ethiopia', both(ethiopia));
registerNation('nigeria', both(nigeria));
registerNation('sudan', both(sudan), { firebomber: 'torch' });
