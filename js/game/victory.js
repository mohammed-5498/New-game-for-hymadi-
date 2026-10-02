// شروط الخسارة والفوز ونتيجة المباراة
// الإقصاء واحد في كل الأطوار (9.5.0)؛ وشروط الفوز الخاصة بكل طور في modes.js
import { ownedDistricts, countUnits } from './spawn.js';
import { sound, stopMusic } from '../audio/sound.js';

// يخسر اللاعب عندما يموت كل أفراده وتُحتل كل أحيائه
// (أو حين يسقط زعيمه في طور حماية الزعيم: fallen)
export function isPlayerAlive(state, playerId) {
  if (state.players[playerId].fallen) return false;
  return countUnits(state, playerId) > 0 || ownedDistricts(state, playerId).length > 0;
}

const sideKey = (player) => player.team ? 'team' + player.team : 'player' + player.id;

export function updateVictory(state) {
  if (state.matchResult) return;

  const owned = ownedDistricts(state, state.humanId).length;
  if (owned > state.stats.maxDistricts) state.stats.maxDistricts = owned;

  // الصمود ضد الشرطة: لا خصوم من العصابات، والنهاية حين تسقط أنت فقط
  if (state.mode === 'survival') {
    if (state.humanId >= 0 && !isPlayerAlive(state, state.humanId)) {
      finish(state, false, 'خسرت كل جنودك وأحيائك أمام الشرطة');
    }
    return;
  }

  // الشرطة المحايدة خارج حساب الفوز والخسارة
  const alivePlayers = state.players.filter(p => !p.neutral && isPlayerAlive(state, p.id));
  const sides = new Set(alivePlayers.map(sideKey));
  const regicide = state.mode === 'regicide';

  // مباراة بلا لاعب بشري (اختبارات أو عرض): تنتهي ببقاء جانب واحد فقط
  if (state.humanId < 0) {
    if (sides.size <= 1) finish(state, false, '');
    return;
  }

  // الفوز: آخر لاعب أو آخر فريق متحالف باقٍ (في كل الأطوار)
  const humanAlive = alivePlayers.some(p => p.id === state.humanId);
  if (!humanAlive) {
    finish(state, false, regicide ? 'سقط زعيمك' : 'خسرت كل جنودك وأحيائك');
  } else if (sides.size <= 1) {
    finish(state, true, regicide ? 'سقط زعيم آخر خصم' : 'هزمت كل خصومك');
  }
}

// reason: جملة واضحة لسبب النهاية تظهر في شاشة النهاية (9.5.0)
export function finish(state, won, reason) {
  stopMusic();
  sound(won ? 'victory' : 'defeat');
  state.matchResult = {
    won,
    reason: reason || '',
    mode: state.mode || 'conquest',
    duration: state.time,
    maxDistricts: state.stats.maxDistricts,
    kills: state.stats.kills[state.humanId],
    losses: state.stats.losses[state.humanId]
  };
}
