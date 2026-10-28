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

  // الصمود ضد الشرطة: لا خصوم من العصابات، ونهايته ورقمه القياسي في modes.js
  if (state.mode === 'survival') return;

  // الشرطة المحايدة خارج حساب الفوز والخسارة
  const alivePlayers = state.players.filter(p => !p.neutral && isPlayerAlive(state, p.id));
  const sides = new Set(alivePlayers.map(sideKey));
  const regicide = state.mode === 'regicide';

  // اللعب المحلي (القسم 16): خروج لاعب لا ينهي المباراة (يشاهد حتى النهاية)، فلا يتعلق شيء هنا بلاعب هذا الجهاز
  // إلا النتيجة نفسها. تنتهي ببقاء جانب واحد، أو حين لا يبقى لاعب بشري، في نفس التحديث على كل الأجهزة
  if (state.settings.lan) {
    const me = state.players[state.humanId];
    if (me && !state.lanOut && !isPlayerAlive(state, me.id)) {
      state.lanOut = true;
      state.notice = { text: 'خرجت من المباراة • تستطيع المشاهدة حتى النهاية', mine: false, t: 6 };
    }
    const humans = alivePlayers.some(p => p.isHuman);
    if (sides.size > 1 && humans) return;
    const won = !!me && sides.size === 1 && sides.has(sideKey(me));
    const winners = alivePlayers.map(p => p.gangName).join(' و');
    finish(state, won, won ? (regicide ? 'سقط زعيم آخر خصم' : 'هزمت كل خصومك')
      : !humans ? 'خرج كل اللاعبين من المباراة' : 'فاز ' + winners);
    return;
  }

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
