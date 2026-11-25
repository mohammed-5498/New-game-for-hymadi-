// طور القصة (2.17.0): لاعب آلي يلعب كل مرحلة من الحملات المنفذة، بمكافآت ما قبلها. البوت المتوسط يقود اقتصادك وجيشك، ونصف
// جيشك يُرسل إلى مكان المهمة (ومن يركض يلاحقه أقرب أربعة، ومن يمشي يُلحق به، وكله في الدفاع والتجميع)، وجندي مجاناً عند قاعدتك
// كل BOOST ثوانٍ (2) حتى 50 فتكتمل كل مرحلة: الفحص أن كل مهمة تعمل حتى آخرها بلا خطأ، ولكل مهمة حيّها.
// BOOST=0 للمقارنة بين الحملات (اللاعب الآلي وحده أضعف من إنسان: يفوز في خمس من 15 مرحلة من حملة اليمن بثلاث بذور).
// CAMP=<حملة> لحملة واحدة، وSEED لبذرة أخرى، وTRACE=<حملة><مرحلة> لسير مرحلة كل خمس ثوانٍ
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/cfg.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/data/campaigns.dart';
import 'package:gangcity/data/js_config.dart';
import 'package:gangcity/game/combat.dart' show commandAttack;
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/game/story.dart';
import 'package:gangcity/game/units.dart' show commandAttackMove, createUnit;
import 'package:gangcity/map/pathfinding.dart' show findFreeTiles;
import 'package:gangcity/ui/prefs.dart';
import 'package:gangcity/ui/story_screen.dart' show storySettings;
import 'package:shared_preferences/shared_preferences.dart';

bool _alive(Unit u) => u.state != 'dead' && u.hp > 0;

// لاعب آلي: كل ثانيتين يرسل أقرب نصف جيشه إلى المهمة الحالية، وكله في الدفاع والتجميع
void _helper(MatchState s) {
  final st = s.story;
  if (st == null || st.cur == null || st.step < 0) return;
  final step = storyLevelOf(s.settings)!.$2.l('steps')[st.step] as J;
  final me = s.humanId;
  final army = [for (final u in s.units) if (u.playerId == me && _alive(u) && !u.harmless && u.story == null) u];
  if (army.isEmpty) return;
  (double, double)? to;
  final type = step.s('type');
  // من يركض: أقرب أربعة إليه يهاجمونه هو (كما يلمسه اللاعب)، ومن قرب مقصده يسدّه، ومن يمشي في الحماية يُلحق به
  if (type == 'intercept') {
    final free = [...army], dest = st.cur!.dest;
    for (final r in [for (final u in s.units) if (u.story?.step == st.step && u.story?.role == 'runner' && _alive(u)) u]) {
      free.sort((a, b) => hypot(a.x - r.x, a.y - r.y).compareTo(hypot(b.x - r.x, b.y - r.y)));
      final squad = free.take(4).toList();
      free.removeRange(0, squad.length);
      if (squad.isEmpty) break;
      commandAttack(s, squad, r);
    }
    // والباقون قرب المقصد يسدّونه
    if (dest != null) commandAttackMove(s, dest.$1, dest.$2, [for (final u in free) if (hypot(u.x - dest.$1, u.y - dest.$2) < 8) u], false);
    return;
  }
  if (type == 'escort') {
    final moving = [for (final u in s.units) if (u.story?.step == st.step && u.story?.role == 'merchant' && _alive(u)) u];
    if (moving.isNotEmpty) {
      to = (moving.map((u) => u.x).reduce((a, b) => a + b) / moving.length, moving.map((u) => u.y).reduce((a, b) => a + b) / moving.length);
    }
  }
  final p = targetPoint(s);
  to ??= p == null ? null : (p.$1, p.$2);
  if (to == null) return;
  final t = to;
  army.sort((a, b) => hypot(a.x - t.$1, a.y - t.$2).compareTo(hypot(b.x - t.$1, b.y - t.$2)));
  final n = type == 'gather' || type == 'defend' ? army.length : math.max(1, (army.length / 2).ceil());
  commandAttackMove(s, t.$1, t.$2, army.take(n), false);
}

// جندي مجاناً عند قاعدتك ما دام جيشك أقل من 50
void _gift(MatchState s) {
  final me = s.players[s.humanId], home = s.map.districts[me.homeDistrictId].capture!;
  if (s.units.where((u) => u.playerId == me.id && _alive(u) && !u.harmless).length >= 50) return;
  final spot = findFreeTiles(s.map, home.i, home.j, 1);
  if (spot.isNotEmpty) s.units.add(createUnit(s, me, spot[0].$1, spot[0].$2));
}

void main() {
  test('كل مراحل الحملات المنفذة تُلعب وتنتهي', () async {
    final only = Platform.environment['CAMP'], seed = int.tryParse(Platform.environment['SEED'] ?? '') ?? 7;
    final boost = int.tryParse(Platform.environment['BOOST'] ?? '') ?? 2;
    final report = <String>[];
    var won = 0, all = 0;
    final failed = <String>[];
    for (final id in CAMPAIGNS.keys) {
      if (only != null && id != only) continue;
      final camp = CAMPAIGNS.m(id);
      for (var k = 0; k < camp.l('levels').length; k++) {
        // ما قبل المرحلة مكتمل، فتدخل مكافآته فيها
        SharedPreferences.setMockInitialValues({});
        await Prefs.init();
        Prefs.write(STORY.s('storageKey'), {id: [for (var n = 0; n < STORY.i('levels'); n++) n < k]});
        simRng = Rng(seed + k);
        final s = createMatch(storySettings(id, k));
        s.running = true;
        final level = camp.l('levels')[k] as J;
        for (final step in level.l('steps').cast<J>()) {
          final at = step.s('at');
          if (at == 'home' || at == 'enemyHome') continue;
          expect(s.story!.slots[at], isNotNull, reason: '$id ${k + 1}: لا حي للمهمة "${step.s('text')}" ($at)');
          expect(s.story!.slots[at]! >= 0, isTrue);
        }
        s.players[s.humanId].isHuman = false;   // البوت يقود جيشك واقتصادك (كمن غادر اللعب المحلي)
        var ticks = 0;
        while (s.matchResult == null && ticks < 20 * 60 * 25) {
          updateMatch(s);
          if (++ticks % 40 == 0) _helper(s);
          if (boost > 0 && ticks % (20 * boost) == 0) _gift(s);
          if (Platform.environment['TRACE'] == '$id${k + 1}' && ticks % 100 == 0) {
            final me = s.humanId, home = s.map.districts[s.players[me].homeDistrictId], e = s.empire!;
            // ignore: avoid_print
            print('TRACE ${s.time.round()}ث المهمة ${s.story!.step + 1} • جنودك ${s.units.where((u) => u.playerId == me && _alive(u)).length} '
                'وأحياؤك ${s.map.districts.where((d) => d.owner == me).length} ونقاطك ${e.points[me].round()} • مالك قاعدتك ${home.owner} • '
                'العدو ${s.units.where((u) => _alive(u) && u.playerId == 1).length} جندياً و${s.map.districts.where((d) => d.owner == 1).length} حياً '
                'وكسب ${e.earned[1].round()} • قوات القصة ${s.units.where((u) => _alive(u) && s.players[u.playerId].storyRole == 'forces').length} • '
                'من يركض ${[for (final u in s.units) if (u.story?.role == 'runner' && _alive(u)) '${u.x.round()},${u.y.round()} دم ${u.hp.round()}'].join('، ')} • '
                'المزايا ${[for (final d in s.map.districts) if (d.feature != null) '${d.feature}:${d.owner}'].join(' ')}');
          }
        }
        final r = s.matchResult;
        all++;
        if (r?.won == true) won++;
        final reached = math.max(0, s.story!.step) + (r?.won == true ? 0 : 1);
        report.add('$id ${k + 1} ${level.s('title')}: ${r == null ? 'لم تنتهِ' : r.won ? 'فوز' : 'خسارة'} • المهمة $reached/${s.story!.count}'
            ' • ${(s.time / 60).toStringAsFixed(1)} د${r != null && !r.won ? ' • ${r.reason}' : ''}');
        if (boost > 0 && r?.won != true) failed.add('$id ${k + 1}: ${r?.reason ?? 'لم تنتهِ في 25 دقيقة'}');
      }
    }
    // ignore: avoid_print
    print('STORY ${report.join('\nSTORY ')}\nSTORY فوز $won من $all');
    expect(failed, isEmpty, reason: 'مراحل لم تكتمل مع العون');
  }, timeout: const Timeout(Duration(minutes: 30)));
}
