// نقل الحفظ من اللعبة القديمة (ui/migrate.dart): ما يُنقل وكيف، ولا يُكتب فوق حفظ التطبيق الجديد، والمباراة لا تنتقل
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/ui/migrate.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('مفاتيح اللعبة القديمة', () async {
    SharedPreferences.setMockInitialValues({'gangcity.story': '{"yemen":[true]}'});
    await Prefs.init();
    final n = moveOldKeys({
      'gangcity.stats': '{"played":7,"wins":4}', 'gangcity.setup': '{"mode":"king"}', 'gangcity.story': '{"yemen":[true,true,true]}',
      'gangcity.storyDifficulty': 'hard', 'gangcity.survivalBest.hard': '{"waves":9,"seconds":400}', 'gangcity.match': '{}',
      'gangcity.audio': '{"sfx":0.4,"music":0.2,"muted":true}', 'gangcity.prefs': '{"pops":false,"quality":"low","lanName":"أبو علي"}',
    });
    expect(Prefs.read('gangcity.stats')!['played'], 7);
    expect(Prefs.read('gangcity.story')!['yemen'], [true], reason: 'لا يُكتب فوق تقدم التطبيق الجديد');
    expect(Prefs.raw('gangcity.storyDifficulty'), 'hard');
    expect(Prefs.read('gangcity.survivalBest.hard')!['waves'], 9);
    expect(Prefs.raw('gangcity.match'), isNull, reason: 'المباراة المحفوظة لا تنتقل');
    expect(Prefs.read('gangcity.prefs')!['lanName'], 'أبو علي');
    final s = Prefs.read('gangcity.settings')!;
    expect([s['sfx'], s['music'], s['mute'], s['pops'], s['quality']], [0.4, 0.2, true, false, 'low']);
    expect(n, 6, reason: "ستة مفاتيح: القصة كانت محفوظة هنا");
  });
}
