// تنبيهات الحافة (القسم 12.3): سهم صغير يشير إلى ما يحدث خارج حدود الشاشة
// أحمر: وحداتك تتعرض للهجوم. برتقالي: عدو بدأ يستولي على حي تملكه.
import { TICK_SEC, ALERTS, TILE_HALF_W, TILE_HALF_H } from '../config.js';

// "المنطقة" الواحدة: ما يقع داخل نصف قطر regionTiles من تنبيه سابق من نفس النوع.
// نقيسها بالمسافة لا بشبكة، حتى لا يصير مربعان متلاصقان منطقتين مختلفتين.
const sameRegion = (a, i, j) => {
  const dx = a.i - i, dy = a.j - j;
  return dx * dx + dy * dy <= ALERTS.regionTiles * ALERTS.regionTiles;
};

// هل هذا المربع داخل حدود الشاشة؟ (نفس حساب الكاميرا في الرسم)
export function onScreen(state, i, j, margin = 0) {
  const { camera, view } = state;
  if (!view.w) return true;                 // قبل أول رسم لا نزعج اللاعب بتنبيهات
  const wx = (i - j) * TILE_HALF_W, wy = (i + j) * TILE_HALF_H;
  const x = (wx - camera.x) * camera.z + view.w / 2;
  const y = (wy - camera.y) * camera.z + view.h / 2;
  return x >= -margin && x <= view.w + margin && y >= -margin && y <= view.h + margin;
}

// يضيف تنبيهاً إن كان الحدث خارج الشاشة ولم تُنبَّه منطقته قريباً
// يعيد true إذا ظهر تنبيه جديد (ليُرفق به صوت التنبيه)
export function raiseAlert(state, kind, i, j) {
  if (onScreen(state, i, j)) return false;

  const existing = state.alerts.find(a => a.kind === kind && sameRegion(a, i, j));
  if (existing) {                            // نفس المنطقة: نجدد عمر السهم فقط
    existing.i = i; existing.j = j;
    existing.life = ALERTS.lifeSeconds;
    return false;
  }
  // منطقة نُبّه عنها قريباً: نصمت حتى تمر المدة
  const seen = state.alertSeen.find(a => a.kind === kind && sameRegion(a, i, j));
  if (seen && state.time - seen.t < ALERTS.repeatSeconds) return false;

  if (seen) { seen.i = i; seen.j = j; seen.t = state.time; }
  else state.alertSeen.push({ kind, i, j, t: state.time });
  // نُبقي سجل المناطق قصيراً: ما مضى عليه أكثر من المدة لا يلزم
  state.alertSeen = state.alertSeen.filter(a => state.time - a.t < ALERTS.repeatSeconds);

  // أكثر من سهمين: نستبدل أقدمها
  if (state.alerts.length >= ALERTS.maxArrows) {
    state.alerts.sort((a, b) => a.life - b.life);
    state.alerts.shift();
  }
  state.alerts.push({ kind, i, j, life: ALERTS.lifeSeconds, screen: null });
  return true;
}

export function updateAlerts(state) {
  if (!state.alerts.length) return;
  const remaining = [];
  for (const alert of state.alerts) {
    alert.life -= TICK_SEC;
    // السهم يختفي متى صار مكانه داخل الشاشة أو انتهى عمره
    if (alert.life > 0 && !onScreen(state, alert.i, alert.j)) remaining.push(alert);
  }
  state.alerts = remaining;
}
