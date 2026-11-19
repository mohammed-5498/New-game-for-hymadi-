// شاشة طور القصة (js/ui/storyScreen.js، القسم 17): اختيار العصابة، ثم مراحل حملتها، ثم القصة قبل المعركة.
// التقدم (المراحل المكتملة) وصعوبة البوتات محفوظان، ومكافآت المراحل السابقة تُحسب منه
import 'package:flutter/material.dart';

import '../core/cfg.dart';
import '../data/campaigns.dart';
import '../data/js_config.dart';
import '../game/story.dart';
import 'match_screen.dart';
import 'prefs.dart';
import 'widgets.dart';

const _type = {'defend': 'دفاع', 'rescue': 'إنقاذ', 'destroy': 'تدمير', 'escort': 'حماية', 'capture': 'سيطرة على منطقة', 'storm': 'اقتحام',
  'intercept': 'قتال', 'hold': 'سيطرة على منطقة', 'gather': 'تجميع', 'boss': 'الزعيم'};

// --- التقدم: { حملة: [مكتملة؟ × 5] } ---
Map<String, Object?> _progress() => Prefs.read(STORY.s('storageKey')) ?? {};
List<bool> doneOf(String id) {
  final l = _progress()[id];
  return [for (var k = 0; k < STORY.i('levels'); k++) l is List && k < l.length && l[k] == true];
}
void _markDone(String id, int k) {
  final p = _progress(), list = doneOf(id);
  list[k] = true;
  p[id] = list;
  Prefs.write(STORY.s('storageKey'), p);
}
String storyDifficulty() {
  final d = Prefs.raw(STORY.s('difficultyKey'));
  return d != null && STORY.m('difficulty').has(d) ? d : STORY.s('defaultDifficulty');
}
bool _unlocked(String id, int k) => k == 0 || doneOf(id)[k - 1];

// إعداد مباراة المرحلة، ومعه مكافآت ما اكتمل قبلها من الحملة نفسها
J storySettings(String id, int k) {
  final camp = CAMPAIGNS.m(id), level = camp.l('levels')[k] as J, done = doneOf(id), bonus = <String, Object?>{};
  for (var n = 0; n < k; n++) {
    if (!done[n]) continue;
    final r = (camp.l('levels')[n] as J).m('reward');
    if (r['kind'] == 'points') bonus['points'] = STORY.m('rewards')['points'];
    if (r['kind'] == 'district') bonus['district'] = true;
    if (r['kind'] == 'hero') bonus['hero'] = r['hero'];
    if (r['kind'] == 'upgrade') bonus['upgrade'] = STORY.m('rewards')['upgrade'];
  }
  return {
    'mode': 'conquest', 'modeOptions': <String, Object?>{}, 'city': camp.s('city'), 'mapSize': STORY.l('mapSize')[k], 'maxUnits': STORY['maxUnits'],
    'weather': level.ss('weather') ?? 'day', 'story': {'campaign': id, 'level': k, 'bonus': bonus},
    'players': storyPlayers(id, k, storyDifficulty()),
  };
}

// نهاية المرحلة: تحفظ الإكمال، وتعيد (العنوان، الحوار، المكافأة، النهاية، نص الزر التالي)
({String title, List<(String, String)> lines, String reward, String ending, String next}) storyEnd(J settings, bool won) {
  final st = settings.m('story'), id = st.s('campaign'), k = st.i('level');
  final camp = CAMPAIGNS.m(id), level = camp.l('levels')[k] as J;
  if (won) _markDone(id, k);
  final last = k + 1 >= camp.l('levels').length;
  return (
    title: won ? 'اكتملت المرحلة ${k + 1}' : 'فشلت المرحلة ${k + 1}',
    lines: won ? [for (final l in level.l('after')) ((l as List)[0] as String, l[1] as String)] : const [],
    reward: won ? 'المكافأة: ${level.m('reward').s('text')}' : '',
    ending: won && last ? 'النهاية: ${camp.s('ending')}' : '',
    next: won ? (last ? 'قائمة القصة' : 'المرحلة التالية') : 'إعادة المرحلة',
  );
}

// زر النهاية: المرحلة التالية بعد الفوز، وإعادتها بعد الخسارة، وnull بعد آخر مرحلة (العودة إلى القائمة)
J? storyAgain(J settings, bool won) {
  final st = settings.m('story'), id = st.s('campaign'), k = st.i('level');
  if (!won) return storySettings(id, k);
  if (k + 1 >= CAMPAIGNS.m(id).l('levels').length) return null;
  return storySettings(id, k + 1);
}

class StoryScreen extends StatefulWidget {
  const StoryScreen({super.key});
  @override
  State<StoryScreen> createState() => _StoryScreenState();
}

class _StoryScreenState extends State<StoryScreen> {
  String view = 'gangs';
  String? campaign;
  int level = 0;

  Future<void> _start() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => MatchScreen(settings: storySettings(campaign!, level))));
    if (mounted) setState(() => view = 'levels');
  }

  Widget _title(String t) => Padding(padding: const EdgeInsets.only(bottom: 6),
      child: Text(t, style: const TextStyle(color: gold, fontSize: 19, fontWeight: FontWeight.w800)));
  Widget _p(String t, {Color color = ink, double size = 13.5}) => Padding(padding: const EdgeInsets.only(bottom: 4),
      child: Text(t, style: TextStyle(color: color, fontSize: size)));
  Widget _section(String title, List<Widget> body) => Padding(padding: const EdgeInsets.only(top: 6), child: Panel(
      padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: gold, fontSize: 14, fontWeight: FontWeight.w700)), ...body])));
  Widget _dialogue(List lines) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    for (final l in lines) Text.rich(TextSpan(children: [
      TextSpan(text: '${(l as List)[0]}: ', style: const TextStyle(color: gold, fontWeight: FontWeight.w700)),
      TextSpan(text: l[1] as String),
    ]), style: const TextStyle(color: ink, fontSize: 13)),
  ]);

  Widget _gangs() => Column(children: [
    _title('القصة'),
    _p('اختر عصابة لتلعب حملتها: خمس مراحل بمهام وقصة.', color: dim),
    Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
      for (final id in nations.l('order').cast<String>())
        SizedBox(width: 170, child: PickCard(title: nations.m(id).s('gangName'), note: nations.m(id).s('name'), image: 'assets/thumbs/side_$id.webp',
            aspect: 2.5, badge: CAMPAIGNS.has(id) ? '${doneOf(id).where((x) => x).length}/${STORY.i('levels')}' : 'قريباً',
            onTap: CAMPAIGNS.has(id) ? () => setState(() { campaign = id; view = 'levels'; }) : () {})),
    ]),
    const SizedBox(height: 8),
    WideButton('رجوع', () => Navigator.pop(context), ghost: true),
  ]);

  Widget _levels() {
    final camp = CAMPAIGNS.m(campaign!), n = nations.m(campaign!), done = doneOf(campaign!), diff = storyDifficulty();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _title('${n.s('gangName')} — ${n.s('name')}'),
      _p(camp.s('pitch')),
      _p('العدو: ${camp.m('enemy').s('name')}', color: dim),
      Row(children: [
        const Text('صعوبة البوتات  ', style: TextStyle(color: ink, fontSize: 13)),
        for (final d in STORY.m('difficulty').keys) Padding(padding: const EdgeInsets.only(left: 6), child: ChoiceChip(
            label: Text(BOT.m(d).s('name')), selected: d == diff,
            onSelected: (_) { Prefs.writeRaw(STORY.s('difficultyKey'), d); setState(() {}); })),
      ]),
      const SizedBox(height: 6),
      for (var k = 0; k < camp.l('levels').length; k++) Builder(builder: (_) {
        final l = camp.l('levels')[k] as J, open = _unlocked(campaign!, k);
        return Padding(padding: const EdgeInsets.only(bottom: 6), child: Opacity(opacity: open ? 1 : 0.5, child: Material(
          color: done[k] ? cardOn : card, borderRadius: BorderRadius.circular(9),
          child: InkWell(borderRadius: BorderRadius.circular(9), onTap: open ? () => setState(() { level = k; view = 'brief'; }) : null,
            child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${done[k] ? '✓ ' : open ? '' : '🔒 '}المرحلة ${k + 1}: ${l.s('title')}',
                  style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w700)),
              Text('العدو: ${BOT.m(storyBotLevel(k, diff)).s('name')} • المكافأة: ${l.m('reward').s('text')}', style: const TextStyle(color: dim, fontSize: 12)),
            ]))))));
      }),
      if (done.every((x) => x)) _p('النهاية: ${camp.s('ending')}', color: gold),
      WideButton('رجوع', () => setState(() => view = 'gangs'), ghost: true),
    ]);
  }

  Widget _brief() {
    final camp = CAMPAIGNS.m(campaign!), l = camp.l('levels')[level] as J;
    final boss = l.l('steps').cast<J>().where((s) => s.s('type') == 'boss').firstOrNull;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _title('المرحلة ${level + 1}: ${l.s('title')}'),
      _section('القصة قبل المعركة', [_p(l.s('story')), _dialogue(l.l('before'))]),
      _section('الهدف الرئيسي', [_p(l.s('goal'))]),
      _section('المهام', [
        for (final (k, s) in l.l('steps').cast<J>().indexed)
          _p('${k + 1}. ${s.s('text')} (${_type[s.s('type')] ?? ''}) — ${s.s('hint')}'),
      ]),
      if (boss != null) _section('الزعيم', [_p('${boss.m('boss').s('name')} — ${boss.m('boss').s('ability')}'),
        _p('طريقة الهزيمة: ${boss.m('boss').s('defeat')}', color: dim)]),
      _section('المكافأة', [_p(l.m('reward').s('text'))]),
      _p('صعوبة العدو: ${BOT.m(storyBotLevel(level, storyDifficulty())).s('name')} (تُغيَّر من قائمة المراحل)', color: dim),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        WideButton('ابدأ المعركة', _start, primary: true, width: 200),
        const SizedBox(width: 8),
        WideButton('رجوع', () => setState(() => view = 'levels'), ghost: true, width: 140),
      ]),
    ]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 720),
          child: view == 'gangs' ? _gangs() : view == 'levels' ? _levels() : _brief())))));
}
