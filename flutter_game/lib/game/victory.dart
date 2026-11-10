// شروط الخسارة والفوز (js/game/victory.js). اللعب المحلي (ن11) والقصة (ن9) بعدُ
import 'modes.dart';
import 'spawn.dart';
import 'state.dart';

class MatchResult {
  final bool won;
  final String reason, mode;
  final double duration;
  final int maxDistricts, kills, losses;
  MatchResult(this.won, this.reason, this.mode, this.duration, this.maxDistricts, this.kills, this.losses);
}

bool isPlayerAlive(MatchState state, int playerId) {
  if (state.players[playerId].fallen) return false;
  return countUnits(state, playerId) > 0 || ownedDistricts(state, playerId).isNotEmpty;
}

void updateVictory(MatchState state) {
  if (state.matchResult != null) return;
  if (state.humanId >= 0) {
    final owned = ownedDistricts(state, state.humanId).length;
    if (owned > state.stats.maxDistricts) state.stats.maxDistricts = owned;
  }
  if (state.mode == 'survival') return;
  final alivePlayers = state.players.where((p) => !p.neutral && isPlayerAlive(state, p.id)).toList();
  final sides = {for (final p in alivePlayers) sideKey(p)};
  final regicide = state.mode == 'regicide';
  if (state.humanId < 0) {
    if (sides.length <= 1) finish(state, false, '');
    return;
  }
  final humanAlive = alivePlayers.any((p) => p.id == state.humanId);
  if (!humanAlive) {
    finish(state, false, regicide ? 'سقط زعيمك' : 'خسرت كل جنودك وأحيائك');
  } else if (sides.length <= 1) {
    finish(state, true, regicide ? 'سقط زعيم آخر خصم' : 'هزمت كل خصومك');
  }
}

void finish(MatchState state, bool won, String reason) {
  final h = state.humanId;
  state.matchResult = MatchResult(won, reason, state.mode, state.time, state.stats.maxDistricts,
      h >= 0 ? state.stats.kills[h] : 0, h >= 0 ? state.stats.losses[h] : 0);
}
