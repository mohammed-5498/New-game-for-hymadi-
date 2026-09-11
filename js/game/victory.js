// شروط الخسارة والفوز ونتيجة المباراة
import { ownedDistricts, countUnits } from './spawn.js';

// يخسر اللاعب عندما يموت كل أفراده وتُحتل كل أحيائه
export function isPlayerAlive(state, playerId) {
  return countUnits(state, playerId) > 0 || ownedDistricts(state, playerId).length > 0;
}

const sideKey = (player) => player.team ? 'team' + player.team : 'player' + player.id;

export function updateVictory(state) {
  if (state.matchResult) return;

  const owned = ownedDistricts(state, state.humanId).length;
  if (owned > state.stats.maxDistricts) state.stats.maxDistricts = owned;

  const alivePlayers = state.players.filter(p => isPlayerAlive(state, p.id));
  const humanAlive = alivePlayers.some(p => p.id === state.humanId);
  const sides = new Set(alivePlayers.map(sideKey));

  // الفوز: آخر لاعب أو آخر فريق متحالف باقٍ
  if (!humanAlive) finish(state, false);
  else if (sides.size <= 1) finish(state, true);
}

function finish(state, won) {
  state.matchResult = {
    won,
    duration: state.time,
    maxDistricts: state.stats.maxDistricts,
    kills: state.stats.kills[state.humanId],
    losses: state.stats.losses[state.humanId]
  };
}
