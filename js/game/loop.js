// تحديث منطقي واحد للمباراة بالترتيب الصحيح
// (تستعمله حلقة اللعبة والاختبارات معاً حتى لا يختلف الترتيب بينهما)
import { TICK_SEC } from '../config.js';
import { buildUnitHash } from './spatialHash.js';
import { updateAbilities } from './abilities.js';
import { updateCombat, removeDeadUnits } from './combat.js';
import { updateUnits, processPathQueue } from './units.js';
import { updateCapture, updateDistrictTints, updateNotice } from './capture.js';
import { updateSpawn } from './spawn.js';
import { updatePolice } from './police.js';
import { updateVictory } from './victory.js';
import { updateBots } from '../ai/bot.js';
import { updateMusicIntensity } from '../audio/sound.js';
import { updateAlerts } from './alerts.js';
import { updateArena } from './arena.js';
import { updateMode } from './modes.js';

export function updateMatch(state) {
  state.time += TICK_SEC;

  buildUnitHash(state);     // شبكة مكانية واحدة يستعملها الجميع هذا التحديث
  updateAbilities(state);   // الهالات والعلاج والنار قبل حساب الضرر
  updateCombat(state);      // اختيار الأهداف والضرب قبل الحركة
  processPathQueue(state);  // حد أقصى 20 عملية A* في التحديث
  updateUnits(state);
  removeDeadUnits(state);
  if (state.arena) {
    updateArena(state);     // ساحة تجربة القتال: لا ظهور ولا بوتات ولا شرطة ولا فوز
  } else {
    updateCapture(state);
    updateDistrictTints(state);   // الانتقال اللوني لأرض الحي ومبانيه
    updateSpawn(state);
    updatePolice(state);      // إنتاج الشرطة واختفاؤها بعد الاستيلاء
    updateBots(state);
    updateMode(state);        // عدّادات الطور ونقاطه وشروط فوزه (القسم 9.5)
    updateVictory(state);
  }
  updateNotice(state);
  updateAlerts(state);           // أسهم الحافة تختفي بانتهاء عمرها أو بدخولها الشاشة
  updateMusicIntensity(state);   // الطبول تشتد مع اشتباك وحدات اللاعب

  if (state.moveMarker) {
    state.moveMarker.t += TICK_SEC;
    if (state.moveMarker.t > 0.8) state.moveMarker = null;
  }
}
