// إيقاع الإطارات (المرحلة 8، القسم 14: 30 إطاراً/ث أو أكثر على جوال متوسط)
// الجهاز الذي لا يلحق بكل إطارات الشاشة بانتظام يتقطع (40-55 متقلبة)، والإيقاع الثابت أنعم بكثير:
// إن تأخرت إطارات كثيرة نرسم كل إطار ثانٍ من الشاشة (30 ثابتة على شاشة 60)، ثم نجرّب العودة للإيقاع
// الكامل بعد مدة، فإن فشل رجعنا وانتظرنا ضعف المدة. لا ينزل أبداً تحت 30. المنطق لا يتأثر: ساعته مستقلة.
// التخطي بالزمن لا بالعدّ: الإطار الذي تأخر أصلاً عن موعده يُرسم فوراً بلا أي انتظار إضافي،
// فتحت الحمل الثقيل (إطارات أبطأ من 30 أصلاً) لا يغيّر الإيقاع شيئاً.
import { PERFORMANCE } from './config.js';

const P = PERFORMANCE.pacing;
const pace = {
  div: 1,            // نرسم إطاراً واحداً كل div إطارات للشاشة (بالزمن)
  last: 0,           // آخر استدعاء من الشاشة
  shown: 0,          // آخر إطار مرسوم
  skipped: false,    // الاستدعاء السابق تُخطي: الفاصل بعده إطار شاشة واحد بالضبط
  exact: [],         // الفواصل بعد استدعاء متخطى (زمن إطار الشاشة بالضبط)
  any: [],           // بقية الفواصل: مضاعفات لزمن إطار الشاشة
  vsync: 1000 / 60,  // زمن إطار الشاشة: 60 أو 90 أو 120...
  frames: 0, late: 0, windowAt: 0,
  hold: P.holdMs, holdUntil: 0,
  probing: 0,        // نجرّب إيقاعاً أسرع: الإيقاع الذي نعود إليه إن فشلت التجربة
  work: []           // زمن عمل الإطارات المرسومة في النافذة (تحديث + رسم)
};

// زمن عمل الإطار المرسوم (من أوله لآخره): يقرر هل تستحق العودة للإيقاع الأسرع أن تُجرَّب
export function paceWork(ms) {
  if (pace.work.length < 240) pace.work.push(ms);
}

// يُستدعى أول كل إطار من الشاشة. false: تخطَّ هذا الإطار (بلا تحديث ولا رسم)
// active: مباراة جارية بلا إيقاف ولا تجهيز (في القوائم والإيقاف يعود الإيقاع كاملاً)
export function paceFrame(now, active) {
  const raw = now - pace.last;
  pace.last = now;
  if (raw >= 4 && raw < 50) {
    const pool = pace.skipped ? pace.exact : pace.any;
    pool.push(raw);
    if (pool.length > 120) pool.shift();
  }
  pace.skipped = false;

  if (!P.enabled || !active) {
    pace.div = 1; pace.probing = 0; pace.hold = P.holdMs;
    pace.shown = now; pace.frames = pace.late = 0; pace.windowAt = now; pace.work.length = 0;
    return true;
  }
  const shownMs = now - pace.shown;
  // قبل موعد الإيقاع (مع نصف إطار شاشة للتذبذب): تخطَّ. بعده: ارسم فوراً مهما تأخر
  if (pace.div > 1 && shownMs < pace.vsync * (pace.div - 0.5)) { pace.skipped = true; return false; }
  pace.shown = now;
  if (shownMs < 250) {                       // بعد العودة من الخلفية: فاصل طويل لا يُحسب
    pace.frames++;
    // متأخر: فاته إطار شاشة كامل بعد موعده، وبقدر يُرى (إطار 16 على شاشة 120 لا يُلحظ)
    if (shownMs > pace.vsync * (pace.div + P.lateExtra) && shownMs > P.minLateMs) pace.late++;
  }
  if (now - pace.windowAt >= P.windowMs) judge(now);
  return true;
}

function quantile(list, q) {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * q)];
}

// زمن إطار الشاشة: الفاصل بعد استدعاء متخطى يحدده بالضبط (في الاتجاهين). بقية الفواصل قد تكون
// كلها مضاعفات (جهاز لا يلحق) فلا تُستخدم إلا لإنقاصه (الشاشة أسرع مما ظننا).
// إن تغيّر نحافظ على زمن الإيقاع نفسه بإطارات الشاشة الجديدة (ولا أبطأ من 30)
function measureVsync() {
  let v = pace.vsync;
  if (pace.exact.length >= 10) v = quantile(pace.exact, 0.5);
  if (pace.any.length >= 20) v = Math.min(v, quantile(pace.any, 0.1));
  if (Math.abs(v - pace.vsync) < 0.5) return;
  const fit = div => {
    if (div < 2) return div;
    const n = Math.min(Math.round(pace.vsync * div / v), Math.floor(P.maxFrameMs / v));
    return n >= 2 ? n : 1;
  };
  pace.div = fit(pace.div);
  pace.probing = fit(pace.probing);
  pace.vsync = v;
}

function judge(now) {
  measureVsync();
  const lateShare = pace.frames ? pace.late / pace.frames : 0;
  if (pace.probing) {
    if (lateShare > P.enterLate) {           // التجربة فشلت: نرجع وننتظر ضعف المدة
      pace.div = pace.probing;
      pace.hold = Math.min(P.maxHoldMs, pace.hold * 2);
    } else {
      pace.hold = P.holdMs;
    }
    pace.holdUntil = now + pace.hold;
    pace.probing = 0;
  } else if (lateShare > P.enterLate) {
    if (pace.vsync * (pace.div + 1) <= P.maxFrameMs) {
      pace.div++;
      pace.holdUntil = now + pace.hold;
    }
  } else if (pace.div > 1 && now >= pace.holdUntil) {
    // نجرّب الإيقاع الأسرع نافذة واحدة، فقط إن كان عمل أغلب الإطارات يتسع له بوضوح؛
    // وإلا ننتظر مدة أخرى بلا تجربة (التجربة الفاشلة نفسها نافذة متقطعة)
    const typical = pace.work.length ? quantile(pace.work, 0.75) : Infinity;
    if (typical <= pace.vsync * (pace.div - 1) * P.probeWorkShare) {
      pace.probing = pace.div;
      pace.div--;
    } else {
      pace.holdUntil = now + pace.hold;
    }
  }
  pace.frames = pace.late = 0;
  pace.work.length = 0;
  pace.windowAt = now;
}

// للاختبارات ومؤشر الإطارات
export const pacingState = () => ({ div: pace.div, vsync: pace.vsync, probing: pace.probing, hold: pace.hold });
