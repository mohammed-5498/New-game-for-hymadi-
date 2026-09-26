// طبقة رقيقة بين اللعبة وتطبيق أندرويد (Capacitor) — القسم 2.1
// نفس الكود يعمل في المتصفح وفي التطبيق: في المتصفح كل دالة هنا لا تفعل شيئاً.
// لا نستورد حزم Capacitor بالاسم لأن اللعبة بلا أداة بناء؛ نستعمل الجسر
// الذي يزرعه التطبيق نفسه في window.Capacitor.

const bridge = () => (typeof window !== 'undefined' ? window.Capacitor : null);

// هل نحن داخل تطبيق أندرويد؟
export function isNativeApp() {
  const cap = bridge();
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

// زر الرجوع في أندرويد: تسجيل مستمع واحد يمنع السلوك الافتراضي (الخروج المباشر)
export function onBackButton(handler) {
  const cap = bridge();
  if (!isNativeApp() || typeof cap.addListener !== 'function') return false;
  cap.addListener('App', 'backButton', () => handler());
  return true;
}

// إغلاق التطبيق فعلاً (App.exitApp). في المتصفح لا يمكن إغلاق الصفحة.
export function exitApp() {
  const cap = bridge();
  if (!isNativeApp() || typeof cap.nativePromise !== 'function') return false;
  cap.nativePromise('App', 'exitApp', {}).catch(() => {});
  return true;
}

// --- منع إطفاء الشاشة أثناء المباراة ---
// Screen Wake Lock API: تعمل في متصفح الجوال وداخل WebView التطبيق بلا أي إضافة.
let wakeLock = null;       // القفل الحالي إن وُجد
let wakeWanted = false;    // هل نريد الشاشة صاحية الآن؟
let wakeBusy = false;      // طلب جارٍ: يمنع طلبين متزامنين

export function keepScreenAwake(on) {
  if (on === wakeWanted) return;      // تُنادى كل إطار، فلا عمل بلا تغيير
  wakeWanted = on;
  applyWakeLock();
}

async function applyWakeLock() {
  if (wakeBusy) return;
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
  wakeBusy = true;
  try {
    if (wakeWanted && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!wakeWanted && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch {
    wakeLock = null;                  // الجهاز أو المتصفح لا يسمح: نتجاهل بهدوء
  }
  wakeBusy = false;
}

// النظام يسحب القفل عند تصغير التطبيق، فنعيد طلبه عند العودة
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wakeWanted && !wakeLock) applyWakeLock();
  });
}
