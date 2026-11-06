// شاشة التحميل (js/ui/blackout.js): ما تحتاجه المباراة قبل أن تبدأ، فلا يتقطع رسمها أول مرة: صور مدينتها (اليمامة)،
// وأطلس كل لاعب مصبوغاً بلونه، وصورة مخلوق المدينة، والأصوات. يعيد ما جهز منها من 0 إلى 1، ويصبغ أطلساً واحداً في
// كل استدعاء (الصبغ أثقل ما فيها). ما لم يجهز يُكمل تحميله في الخلفية كما كان
import { UNIT_ART } from '../config.js';
import { cityReady } from './cityRender.js';
import { warmSheet } from './unitSprites.js';
import { creatureReady } from './creatureArt.js';
import { samplesProgress } from '../audio/samples.js';

// ponytail: أول 12 زوجاً (أطلس ولون) وحدها: يُحفظ 16 أطلساً مصبوغاً، وأكثر منها يطرد بعضه بعضاً بلا نهاية
const MAX_SHEETS = 12;

export function preloadStep(state) {
  const sheets = new Set();
  for (const p of state.players) {
    const police = p.gang === 'police';
    if (!police && !p.color) continue;
    sheets.add((police ? 'police' : p.nation || p.gang) + '|' + (police ? UNIT_ART.policeColor : p.color));
  }
  let done = 0, painted = false;
  const list = [...sheets].slice(0, MAX_SHEETS);
  for (const pair of list) {
    const [atlas, color] = pair.split('|');
    const r = warmSheet(atlas, color, !painted);
    if (r) done++;
    if (r === 2) painted = true;
  }
  done += (cityReady(state.map) ? 1 : 0) + (creatureReady(state.feature) ? 1 : 0) + samplesProgress();
  return done / (list.length + 3);
}
