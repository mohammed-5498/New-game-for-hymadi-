// أطوار اللعب (js/game/modes.js): كلها على اقتصاد الإمبراطورية. الآن السيطرة الكاملة، والأطوار الأربعة الأخرى في ن7
import '../core/cfg.dart';
import '../data/js_config.dart';
import 'empire.dart';
import 'state.dart';

String sideKey(Player p) => p.team != 0 ? 'team${p.team}' : 'player${p.id}';
bool economyOf(J settings) => gameModes.has(settings.ss('mode') ?? '') && !settings.b('arena');

// ponytail: الطور دائماً conquest حتى ن7 (الوقت بالنقاط وملك الحي وحماية الزعيم والصمود)
void initMode(MatchState state) {
  state.mode = 'conquest';
  state.economy = economyOf(state.settings);
  if (state.economy) initEmpire(state);
}

void prepareModeUnits(MatchState state) {}

void updateMode(MatchState state) {
  if (state.matchResult != null) return;
  if (state.economy && state.matchResult == null) updateEmpire(state);
}

bool isFinalMinute(MatchState state) => false;

void updateFades(MatchState state) {
  for (final unit in state.units) {
    if (!(unit.fadeAt >= 0) || unit.state == 'dead' || state.time < unit.fadeAt) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.d('deathTime');
    unit.target = null;
    unit.path = [];
    unit.selected = false;
  }
}
