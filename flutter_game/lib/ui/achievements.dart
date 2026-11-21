// الإنجازات (2.13.0، بطلب المستخدم: "الانجازات او ال achievements صعوبتها متدرجه وفي حاله انجازها يتم اعطائه عملات ذهب
// متدرجه... و عمله مميزه نادره جداً لا يمكن حصولها الا عند الانجازات المجنونه"، و"كل الانجازات تملك خلفيه مميزه وقم بأضافه
// خانه الانجازات ورتبهم كل واحد في قسمه"، GAME_SPEC 18.18ج): 28 إنجازاً بأربع درجات، جائزتها ذهب ACH.rewards والمجنونة
// جوهرة. ما يحدث في المباراة يُفحص مرتين في الثانية (poll) ومع أوامر قائمة الحي (command)، والفوز عند النهاية (ended)، ولا
// يُحسب إلا فوز يعطي ذهباً (Lineup.fair). لا إنجازات في اللعب المحلي، والتقدم محفوظ في gangcity.achievements
import 'package:flutter/material.dart' hide Text;

import '../config.dart' show ACH;
import '../core/cfg.dart';
import '../data/campaigns.dart';
import '../data/js_config.dart';
import '../game/modes.dart' show modeOf;
import '../game/spawn.dart' show countUnits;
import '../game/state.dart';
import '../game/victory.dart' show MatchResult;
import '../i18n/tr.dart';
import 'menus.dart' show regionOfCity;
import 'prefs.dart';
import 'story_screen.dart' show campaignHard;
import 'wallet.dart';
import 'widgets.dart';

class Ach {
  final String id, tier, title;
  final IconData icon;
  final int goal;            // أكثر من 1: عدّاد بشريط تقدم
  const Ach(this.id, this.tier, this.icon, this.title, [this.goal = 1]);
}

const _modes = ['conquest', 'points', 'king', 'regicide'];
final _regions = REGIONS.l('order').length;

final achievements = <Ach>[
  const Ach('first_win', 'easy', Icons.emoji_events_rounded, 'اربح أول مباراة'),
  Ach('districts', 'easy', Icons.location_city_rounded, 'امتلك ${ACH.districts} أحياء في مباراة واحدة'),
  const Ach('tower_hospital', 'easy', Icons.local_hospital_rounded, 'امتلك برجاً ومستشفى معاً'),
  const Ach('upgrade', 'easy', Icons.upgrade_rounded, 'اشترِ أول ترقية'),
  const Ach('fortify', 'easy', Icons.fort_rounded, 'حصّن حياً بسور'),
  Ach('ults', 'easy', Icons.bolt_rounded, 'استعمل ضربة البطل ${ACH.ults} مرات', ACH.ults),
  const Ach('fog_win', 'easy', Icons.cloud_rounded, 'اربح مباراة بضباب الحرب'),
  const Ach('night_win', 'easy', Icons.nightlight_round, 'اربح مباراة في الليل'),
  const Ach('king_win', 'easy', Icons.terrain_rounded, 'اربح في طور ملك الحي'),
  const Ach('regicide_win', 'easy', Icons.shield_rounded, 'اربح في طور حماية الزعيم'),
  Ach('points', 'easy', Icons.savings_rounded, 'اجمع ${ACH.points} نقطة في مباراة واحدة'),
  Ach('cities', 'easy', Icons.map_rounded, 'العب في ${ACH.cities} مدن مختلفة', ACH.cities),

  Ach('medium_wins', 'medium', Icons.military_tech_rounded, 'اربح ${ACH.mediumWins} مباريات ضد بوتات متوسطة أو أصعب', ACH.mediumWins),
  Ach('hqs', 'medium', Icons.castle_rounded, 'امتلك ${ACH.hqs} قواعد معاً'),
  Ach('waves', 'medium', Icons.local_police_rounded, 'اصمد حتى الموجة ${ACH.waves} في طور الصمود'),
  const Ach('beast', 'medium', Icons.pets_rounded, 'أسقط ترول الجبل أو الفارس الأسود'),
  const Ach('merc', 'medium', Icons.handshake_rounded, 'جنّد من مبنى للمرتزقة'),
  const Ach('max_army', 'medium', Icons.groups_rounded, 'اجمع جيشاً بالحد الأقصى للوحدات'),
  Ach('regions', 'medium', Icons.public_rounded, 'اربح في مدينة من كل منطقة من المناطق الخمس', _regions),
  Ach('kills', 'medium', Icons.gps_fixed_rounded, 'أسقط ${ACH.kills} عدو في كل مبارياتك', ACH.kills),

  Ach('hard_wins', 'hard', Icons.local_fire_department_rounded, 'اربح ${ACH.hardWins} مباريات ضد بوتات صعبة أو أصعب', ACH.hardWins),
  const Ach('story_hard', 'hard', Icons.menu_book_rounded, 'أكمل حملة في القصة على الصعب'),
  Ach('two_hard', 'hard', Icons.sports_kabaddi_rounded, 'اربح وحدك ضد ${ACH.hardBots} بوتات على الصعب'),
  Ach('hard_waves', 'hard', Icons.warning_amber_rounded, 'اصمد حتى الموجة ${ACH.hardWaves} على الصعب'),
  Ach('all_modes', 'hard', Icons.stars_rounded, 'اربح الأطوار الأربعة ضد بوتات صعبة', _modes.length),

  const Ach('insane_win', 'insane', Icons.whatshot_rounded, 'اربح ضد بوت مجنون'),
  Ach('insane_waves', 'insane', Icons.dangerous_rounded, 'اصمد حتى الموجة ${ACH.insaneWaves} على المجنون'),
  Ach('mob', 'insane', Icons.diversity_3_rounded, 'اربح أنت وحليف على مستوى الصعب ضد ${ACH.mob} بوتات صعبة'),
];

class Achievements {
  static const _key = 'gangcity.achievements';
  static final done = <String>{};
  static final counts = <String, int>{};          // ults وkills وmedium_wins وhard_wins
  static final sets = <String, Set<String>>{};    // cities وregions وall_modes

  static void load() {
    final j = Prefs.read(_key);
    done..clear()..addAll((j?['done'] as List? ?? const []).whereType<String>());
    counts.clear();
    sets.clear();
    final c = j?['counts'], st = j?['sets'];
    if (c is Map) c.forEach((k, v) { if (k is String && v is num) counts[k] = v.toInt(); });
    if (st is Map) st.forEach((k, v) { if (k is String && v is List) sets[k] = v.whereType<String>().toSet(); });
  }
  static void save() => Prefs.write(_key, {'done': done.toList(), 'counts': counts, 'sets': {for (final e in sets.entries) e.key: e.value.toList()}});

  static int have(Ach a) => done.contains(a.id) ? a.goal : (counts[a.id] ?? sets[a.id]?.length ?? 0).clamp(0, a.goal);
  static String rewardText(Ach a) => a.tier == 'insane' ? '+${ACH.gems} جوهرة' : '+${ACH.rewards[a.tier]} ذهب';

  static void _check(String id, bool ok, List<Ach> out) {
    if (!ok || done.contains(id)) return;
    final a = achievements.firstWhere((x) => x.id == id);
    done.add(id);
    if (a.tier == 'insane') { Wallet.gems += ACH.gems; Wallet.save(); } else { Wallet.earn(ACH.rewards[a.tier]!); }
    out.add(a);
  }
  static void _add(String id, int n, List<Ach> out) {
    if (n <= 0 || done.contains(id)) return;
    counts[id] = (counts[id] ?? 0) + n;
    _check(id, counts[id]! >= achievements.firstWhere((x) => x.id == id).goal, out);
  }
  static void _put(String id, String item, List<Ach> out) {
    if (done.contains(id)) return;
    final set = sets[id] ??= {};
    set.add(item);
    _check(id, set.length >= achievements.firstWhere((x) => x.id == id).goal, out);
  }

  // ما بلغته في المباراة الآن. عدّادا الضربات والقتلى من أول ما رآه في هذه المباراة (المتابَعة تكمل منه)
  static MatchState? _seen;
  static int _ults = 0, _kills = 0;
  static List<Ach> poll(MatchState s) {
    final out = <Ach>[], me = s.humanId;
    if (me < 0 || s.lanRole != null) return out;
    if (!identical(s, _seen)) { _seen = s; _ults = s.stats.ults; _kills = s.stats.kills[me]; }
    _add('ults', s.stats.ults - _ults, out);
    _add('kills', s.stats.kills[me] - _kills, out);
    _ults = s.stats.ults;
    _kills = s.stats.kills[me];
    var towers = 0, hospitals = 0, hqs = 0;
    for (final d in s.map.districts) {
      if (d.owner != me) continue;
      if (d.building == 'tower') towers++;
      if (d.building == 'hospital') hospitals++;
      if (d.building == 'hq') hqs++;
    }
    _check('districts', s.stats.maxDistricts >= ACH.districts, out);
    _check('tower_hospital', towers > 0 && hospitals > 0, out);
    _check('hqs', hqs >= ACH.hqs, out);
    _check('points', s.empire != null && s.empire!.earned[me] >= ACH.points, out);
    _check('beast', s.stats.beasts > 0, out);
    _check('max_army', countUnits(s, me) >= s.maxUnits, out);
    if (s.mode == 'survival') {
      final ms = modeOf(s), level = BOT_LEVELS.indexOf(ms.level);
      _check('waves', ms.wave >= ACH.waves, out);
      _check('hard_waves', level >= 2 && ms.wave >= ACH.hardWaves, out);
      _check('insane_waves', level >= 3 && ms.wave >= ACH.insaneWaves, out);
    }
    if (out.isNotEmpty) save();
    return out;
  }

  // أمر نجح من قائمة الحي
  static List<Ach> command(MatchState s, String a, int did) {
    final out = <Ach>[];
    if (s.humanId < 0 || s.lanRole != null) return out;
    _check('upgrade', a == 'upgrade' || a == 'improve', out);
    _check('fortify', a == 'fortify', out);
    _check('merc', a == 'queue' && did >= 0 && did < s.map.districts.length && s.map.districts[did].merc, out);
    if (out.isNotEmpty) save();
    return out;
  }

  // نهاية المباراة: الفوز يُحسب كما يُحسب للذهب، والمدينة تُحسب بأي نتيجة
  static List<Ach> ended(MatchState s, MatchResult r, Lineup l, bool fog) {
    final out = <Ach>[];
    if (s.humanId < 0 || s.lanRole != null) return out;
    out.addAll(poll(s));
    _put('cities', s.map.city, out);
    final win = r.won && l.foes.isNotEmpty && l.fair, weakest = l.weakestFoe;
    if (win) {
      _check('first_win', true, out);
      _check('fog_win', fog, out);
      _check('night_win', s.weather == 'night', out);
      _check('king_win', s.mode == 'king', out);
      _check('regicide_win', s.mode == 'regicide', out);
      final region = regionOfCity(s.map.city);
      if (region != null) _put('regions', region, out);
      if (weakest >= 1) _add('medium_wins', 1, out);
      if (weakest >= 2) {
        _add('hard_wins', 1, out);
        if (_modes.contains(s.mode)) _put('all_modes', s.mode, out);
      }
      _check('two_hard', l.allies.isEmpty && l.foes.length >= ACH.hardBots && weakest >= 2, out);
      _check('insane_win', weakest >= 3, out);
      _check('mob', l.allies.length == ACH.mobAllies && l.allies.every((x) => x <= 2) && l.foes.length >= ACH.mob && weakest >= 2, out);
    }
    _check('story_hard', CAMPAIGNS.keys.any(campaignHard), out);
    save();
    return out;
  }
}

// ألوان كل درجة: برونزية وفضية وذهبية وأسطورية (الخلفية والحافة والوسام والكتابة)
typedef _Tier = ({String name, IconData icon, List<Color> bg, Color edge, List<Color> medal, Color ink});
const _tiers = <String, _Tier>{
  'easy': (name: 'سهلة', icon: Icons.star_border_rounded, bg: [Color(0xFF5C2C1C), Color(0xFF24110B)], edge: Color(0xFFDB8550),
      medal: [Color(0xFFA65A34), Color(0xFF42200F)], ink: Color(0xFFFFDBC2)),
  'medium': (name: 'متوسطة', icon: Icons.star_half_rounded, bg: [Color(0xFF3C4653), Color(0xFF161B21)], edge: Color(0xFFCBD5DF),
      medal: [Color(0xFF8592A0), Color(0xFF2C343C)], ink: Color(0xFFF2F6FA)),
  'hard': (name: 'صعبة', icon: Icons.star_rounded, bg: [Color(0xFF604612), Color(0xFF231908)], edge: Color(0xFFF2C45C),
      medal: [Color(0xFFC08E2E), Color(0xFF4A3410)], ink: Color(0xFFFFEDB8)),
  'insane': (name: 'مجنونة', icon: Icons.auto_awesome_rounded, bg: [Color(0xFF5E1040), Color(0xFF1A0818)], edge: gemColor,
      medal: [Color(0xFFB43C7C), Color(0xFF3A0C28)], ink: Color(0xFFFFD8EC)),
};

class AchievementsScreen extends StatefulWidget {
  const AchievementsScreen({super.key});
  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen> {
  String tier = 'easy';
  @override
  Widget build(BuildContext context) {
    int doneIn(String t) => achievements.where((a) => a.tier == t && Achievements.done.contains(a.id)).length;
    final total = achievements.where((a) => Achievements.done.contains(a.id)).length;
    final reward = tier == 'insane' ? 'جائزة كل إنجاز: جوهرة تشتري أي شيء واحد مجاناً' : 'جائزة كل إنجاز: ${ACH.rewards[tier]} ذهب';
    return Scaffold(body: DecoratedBox(
      decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0.35, -0.5), radius: 1.35,
          colors: [Color(0xFF3B2D1D), Color(0xFF120E0A)])),
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 10), child: Column(children: [
        Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, gradient: goldGrad,
              border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const Icon(Icons.emoji_events_rounded, size: 20, color: Color(0xFF2A1A08))),
          const SizedBox(width: 10),
          const GoldTitle('الإنجازات', size: 26),
          const SizedBox(width: 14),
          Text('أنجزت $total من ${achievements.length}', style: const TextStyle(color: dim, fontSize: 14)),
          const Spacer(),
          const GoldChip(size: 16),
          const SizedBox(width: 10),
          Pill(Icons.arrow_back_rounded, 'رجوع', on: false, onTap: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          for (final t in _tiers.keys) Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: Pill(_tiers[t]!.icon,
              '${_tiers[t]!.name} ${doneIn(t)}/${achievements.where((a) => a.tier == t).length}', on: tier == t, onTap: () => setState(() => tier = t))),
          const SizedBox(width: 6),
          Expanded(child: Text(reward, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: tier == 'insane' ? gemColor : gold, fontSize: 13))),
        ]),
        const SizedBox(height: 10),
        Expanded(child: GridView.extent(maxCrossAxisExtent: 340, childAspectRatio: 2.4, mainAxisSpacing: 10, crossAxisSpacing: 10,
            children: [for (final a in achievements) if (a.tier == tier) _AchCard(a)])),
      ]))),
    ));
  }
}

// خانة الإنجاز: خلفية درجته وأيقونته الكبيرة الباهتة خلفها، ووسام، وعدّاد إن كان له، وجائزته، وعلامة الإنجاز
class _AchCard extends StatelessWidget {
  final Ach a;
  const _AchCard(this.a);
  @override
  Widget build(BuildContext context) {
    final t = _tiers[a.tier]!, done = Achievements.done.contains(a.id), have = Achievements.have(a);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14),
          border: Border.all(color: done ? t.edge : t.edge.withValues(alpha: 0.4), width: done ? 2 : 1.2),
          gradient: LinearGradient(begin: AlignmentDirectional.topStart, end: AlignmentDirectional.bottomEnd, colors: t.bg),
          boxShadow: [done ? BoxShadow(color: t.edge.withValues(alpha: 0.35), blurRadius: 12)
              : const BoxShadow(color: Color(0x88000000), blurRadius: 8, offset: Offset(0, 3))]),
      child: Stack(children: [
        PositionedDirectional(end: -16, bottom: -26, child: Icon(a.icon, size: 112, color: t.edge.withValues(alpha: done ? 0.2 : 0.1))),
        const Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter,
            end: Alignment.bottomCenter, colors: [Color(0x1FFFFFFF), Color(0x00FFFFFF)], stops: [0, 0.55])))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), child: Row(children: [
          Container(width: 50, height: 50,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: t.medal),
                  border: Border.all(color: done ? t.edge : t.edge.withValues(alpha: 0.5), width: 2)),
              child: Icon(a.icon, size: 26, color: done ? t.ink : t.ink.withValues(alpha: 0.45))),
          const SizedBox(width: 10),
          Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(a.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: TextStyle(color: done ? t.ink : ink, fontSize: 14, fontWeight: FontWeight.w700, height: 1.25)),
            if (a.goal > 1 && !done) Padding(padding: const EdgeInsets.only(top: 4), child: Row(children: [
              Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: have / a.goal,
                  minHeight: 6, backgroundColor: const Color(0x55000000), color: t.edge))),
              const SizedBox(width: 6),
              Text('$have/${a.goal}', style: TextStyle(color: t.ink, fontSize: 11.5)),
            ])),
            const SizedBox(height: 4),
            Row(children: [
              Icon(a.tier == 'insane' ? Icons.diamond_rounded : Icons.monetization_on_rounded, size: 15, color: a.tier == 'insane' ? gemColor : gold),
              const SizedBox(width: 4),
              Text(Achievements.rewardText(a), style: TextStyle(color: a.tier == 'insane' ? gemColor : gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
              const Spacer(),
              if (done) ...[
                const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF8FD06A)),
                const SizedBox(width: 3),
                const Text('أُنجز', style: TextStyle(color: Color(0xFF8FD06A), fontSize: 12.5, fontWeight: FontWeight.w700)),
              ],
            ]),
          ])),
        ])),
      ]),
    );
  }
}

// إنجاز جديد في شاشة النهاية: قرص بلون درجته وجائزته
class AchChip extends StatelessWidget {
  final Ach a;
  const AchChip(this.a, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = _tiers[a.tier]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: t.edge, width: 1.5),
          gradient: LinearGradient(colors: t.bg)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(a.icon, size: 16, color: t.ink),
        const SizedBox(width: 6),
        Text(a.title, style: TextStyle(color: t.ink, fontSize: 12.5, fontWeight: FontWeight.w700)),
        const SizedBox(width: 6),
        Text(Achievements.rewardText(a), style: TextStyle(color: a.tier == 'insane' ? gemColor : gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
