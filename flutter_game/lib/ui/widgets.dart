// عناصر القوائم المشتركة (style.css في اللعبة الحالية): لوحة داكنة دافئة بذهبي، وأزرار 52 بكسل، وخط 16
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/scheduler.dart' show Ticker;

import '../audio/sound.dart';
import '../i18n/tr.dart';

const gold = Color(0xFFE2B55A), panel = Color(0xE6261E17), ink = Color(0xFFF2E6CF), dim = Color(0xFF9C8F7A);
const deep = Color(0xFF15110D), card = Color(0xFF2E241B), cardOn = Color(0xFF4A3A26), danger = Color(0xFFE07060);

Color colorOf(String hex) => Color(0xFF000000 | int.parse(hex.substring(1, 7), radix: 16));
String clock(double seconds) { final s = seconds.floor(); return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}'; }

class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.symmetric(horizontal: 10, vertical: 6)});
  @override
  Widget build(BuildContext context) => Container(
      padding: padding,
      decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0x55E2B55A))),
      child: child);
}

// أزرار القوائم (2.5.0، شكل القائمة "أ" باختيار المستخدم): لوح بتدرج داكن وحافة ذهبية، والأساسي بتدرج ذهبي
const goldGrad = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
    colors: [Color(0xFFF6D585), Color(0xFFDCA747), Color(0xFFB8822B)], stops: [0, 0.55, 1]);
const plateGrad = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF54A3A26), Color(0xF5281F16)]);
const _shadow = [BoxShadow(color: Color(0x80000000), blurRadius: 8, offset: Offset(0, 3))];

class WideButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool primary, ghost;
  final String? note;
  final double width;
  const WideButton(this.label, this.onTap, {super.key, this.primary = false, this.ghost = false, this.note, this.width = 260});
  @override
  Widget build(BuildContext context) {
    final on = onTap != null, gilt = primary && on;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: SizedBox(width: width, height: note == null ? 50 : 58, child: _Plate(
        gilt: gilt, flat: ghost || !on, color: on ? null : const Color(0xFF241D16), radius: 10,
        onTap: on ? onTap : null,
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: !on ? dim : gilt ? const Color(0xFF1B140C) : ink)),
          if (note != null) Text(note!, style: TextStyle(fontSize: 11, color: gilt ? const Color(0xFF4A3415) : dim)),
        ])),
      )),
    );
  }
}

// لوح الزر: تدرجه وحافته وظله ولمسته
class _Plate extends StatelessWidget {
  final bool gilt, flat;
  final Color? color;
  final double radius;
  final VoidCallback? onTap;
  final Widget child;
  const _Plate({required this.gilt, required this.flat, this.color, required this.radius, required this.onTap, required this.child});
  @override
  Widget build(BuildContext context) => Material(type: MaterialType.transparency, child: Ink(
    decoration: BoxDecoration(
      gradient: color != null || (flat && !gilt) ? null : gilt ? goldGrad : plateGrad, color: color,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: gilt ? const Color(0xFFFFE6A8) : const Color(0x80E2B55A)),
      boxShadow: flat ? null : _shadow),
    child: InkWell(borderRadius: BorderRadius.circular(radius), onTap: onTap == null ? null : () { sound('ui_tap'); onTap!(); }, child: child),
  ));
}

// زر القائمة الرئيسية: أيقونة في مربعها، والعنوان وسطر تحته
class MenuButton extends StatelessWidget {
  final Widget icon;
  final String label;
  final String? note;
  final bool gilt;
  final VoidCallback onTap;
  const MenuButton(this.icon, this.label, {super.key, this.note, this.gilt = false, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3.5),
    child: SizedBox(height: 50, child: _Plate(gilt: gilt, flat: false, radius: 12, onTap: onTap, child: Row(children: [
      const SizedBox(width: 11),
      Container(width: 31, height: 31, decoration: BoxDecoration(color: gilt ? const Color(0x2E281908) : const Color(0x24E2B55A),
          borderRadius: BorderRadius.circular(8)),
          child: IconTheme(data: IconThemeData(color: gilt ? const Color(0xFF2A1A08) : gold, size: 20), child: Center(child: icon))),
      const SizedBox(width: 11),
      Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 19, height: 1.15, fontWeight: FontWeight.w700, color: gilt ? const Color(0xFF1B140C) : ink)),
        if (note != null) Text(note!, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, height: 1.2, color: gilt ? const Color(0xFF4A3415) : const Color(0xFFB9AB91))),
      ])),
      const SizedBox(width: 8),
    ]))),
  );
}

// زر دائري بأيقونة وكلمة تحته (الإعدادات والإحصائيات واللغة)
class RoundButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const RoundButton(this.icon, this.label, this.onTap, {super.key});
  @override
  Widget build(BuildContext context) => SizedBox(width: 76, child: Column(mainAxisSize: MainAxisSize.min, children: [
    Material(type: MaterialType.transparency, child: Ink(
      width: 42, height: 42,
      decoration: BoxDecoration(color: const Color(0xE01E1710), shape: BoxShape.circle,
          border: Border.all(color: const Color(0xA6E2B55A), width: 1.5), boxShadow: _shadow),
      child: InkWell(customBorder: const CircleBorder(), onTap: () { sound('ui_tap'); onTap(); }, child: Icon(icon, size: 21, color: gold)))),
    const SizedBox(height: 2),
    Text(label, maxLines: 1, style: const TextStyle(color: Color(0xFFEADCC2), fontSize: 11.5, shadows: [Shadow(blurRadius: 3)])),
  ]));
}

// عنوان بتدرج ذهبي وظل
class GoldTitle extends StatelessWidget {
  final String text;
  final double size;
  const GoldTitle(this.text, {super.key, this.size = 30});
  @override
  Widget build(BuildContext context) => Text(text, style: TextStyle(fontSize: size, height: 1.2, fontWeight: FontWeight.w700,
      foreground: Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0xFFFFE9AD), gold, Color(0xFFA8741F)], stops: [0, 0.55, 1]).createShader(Rect.fromLTWH(0, size * 0.1, 1, size * 1.1)),
      shadows: const [Shadow(color: Color(0xE6000000), blurRadius: 3, offset: Offset(0, 2))]));
}

// شعار اللعبة: درع بسيفين متقاطعين
class Emblem extends StatelessWidget {
  final double size;
  const Emblem({super.key, this.size = 46});
  @override
  Widget build(BuildContext context) => CustomPaint(size: Size(size, size * 72 / 64), painter: const _EmblemPainter());
}

class _EmblemPainter extends CustomPainter {
  const _EmblemPainter();
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 64);
    final shield = Path()..moveTo(32, 3)..lineTo(58, 12)..lineTo(58, 36)..cubicTo(58, 52, 46, 63, 32, 69)..cubicTo(18, 63, 6, 52, 6, 36)
      ..lineTo(6, 12)..close();
    final shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFFE7A8), Color(0xFFB07A26)])
        .createShader(const Rect.fromLTWH(0, 0, 64, 72));
    canvas.drawShadow(shield, Colors.black, 3, false);
    canvas.drawPath(shield, Paint()..color = const Color(0xFF2A1F16));
    Paint line(double w) => Paint()..shader = shader..style = PaintingStyle.stroke..strokeWidth = w..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(shield, line(4));
    canvas..drawLine(const Offset(19, 19), const Offset(45, 47), line(4.6))..drawLine(const Offset(45, 19), const Offset(19, 47), line(4.6))
      ..drawLine(const Offset(38, 50), const Offset(47, 41), line(4))..drawLine(const Offset(26, 50), const Offset(17, 41), line(4));
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// أيقونة سيفين متقاطعين (زر "لعب")، بلون IconTheme وحجمه
class SwordsIcon extends StatelessWidget {
  const SwordsIcon({super.key});
  @override
  Widget build(BuildContext context) {
    final t = IconTheme.of(context);
    return CustomPaint(size: Size.square(t.size ?? 20), painter: _SwordsPainter(t.color ?? gold));
  }
}

class _SwordsPainter extends CustomPainter {
  final Color color;
  const _SwordsPainter(this.color);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24);
    final p = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 1.9..strokeCap = StrokeCap.round;
    for (final (a, b, c, d) in const [(4.0, 4.0, 14.5, 14.5), (12.4, 16.6, 16.6, 12.4), (14.5, 14.5, 18.1, 18.1), (20.0, 4.0, 9.5, 14.5),
        (7.4, 12.4, 11.6, 16.6), (9.5, 14.5, 5.9, 18.1)]) {
      canvas.drawLine(Offset(a, b), Offset(c, d), p);
    }
    canvas..drawCircle(const Offset(18.9, 18.9), 1.1, p)..drawCircle(const Offset(5.1, 18.9), 1.1, p);
  }
  @override
  bool shouldRepaint(covariant _SwordsPainter oldDelegate) => oldDelegate.color != color;
}

// خانة اختيار بعنوان وسطر تحته (أزرار قائمة الإعداد)
class PickTile extends StatelessWidget {
  final String title, value;
  final String? note, image;
  final IconData? icon;
  final VoidCallback? onTap;
  final double width;
  const PickTile({super.key, required this.title, required this.value, this.note, this.image, this.icon, this.onTap, this.width = 150});
  @override
  Widget build(BuildContext context) => Material(
    color: card, borderRadius: BorderRadius.circular(10),
    child: InkWell(borderRadius: BorderRadius.circular(10), onTap: onTap, child: SizedBox(width: width, child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (image != null) ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
            child: AspectRatio(aspectRatio: 2.9, child: Image.asset(image!, fit: BoxFit.cover))),
        Padding(padding: const EdgeInsets.fromLTRB(8, 5, 8, 6), child: Row(children: [
          if (icon != null && width >= 120) ...[Icon(icon, size: 18, color: gold), const SizedBox(width: 6)],   // الصغيرة بلا أيقونة: يتسع نصها (2.5.0)
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: dim, fontSize: 11)),
            Text(value, style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
            if (note != null) Text(note!, style: const TextStyle(color: dim, fontSize: 11), overflow: TextOverflow.ellipsis),
          ])),
        ])),
      ]))),
  );
}

class Toggle extends StatelessWidget {
  final String label;
  final bool on;
  final ValueChanged<bool> onChanged;
  const Toggle(this.label, this.on, this.onChanged, {super.key});
  @override
  Widget build(BuildContext context) => SwitchListTile(
      dense: true, value: on, onChanged: onChanged, activeThumbColor: gold,
      title: Text(label, style: const TextStyle(color: ink, fontSize: 15)));
}

// بطاقة رقم وعنوان (الإحصائيات وشاشة النهاية)
class StatCard extends StatelessWidget {
  final String label, value;
  const StatCard(this.label, this.value, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    width: 132, padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
    decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(9)),
    child: Column(children: [
      Text(value, style: const TextStyle(color: gold, fontSize: 19, fontWeight: FontWeight.w800)),
      Text(label, style: const TextStyle(color: dim, fontSize: 12), textAlign: TextAlign.center),
    ]),
  );
}

// خانة في لوحة اختيار (مدينة أو عصابة) بصورتها واسمها وسطر تحته
class PickCard extends StatelessWidget {
  final String title;
  final String? note, image, badge;
  final bool selected;
  final VoidCallback onTap;
  final double aspect;
  const PickCard({super.key, required this.title, this.note, this.image, this.badge, this.selected = false, required this.onTap, this.aspect = 2.9});
  @override
  Widget build(BuildContext context) => Material(
    color: selected ? cardOn : card, borderRadius: BorderRadius.circular(10),
    child: InkWell(borderRadius: BorderRadius.circular(10), onTap: onTap, child: Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: selected ? gold : Colors.transparent, width: 1.5)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (image != null) ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(9)),
            child: AspectRatio(aspectRatio: aspect, child: Image.asset(image!, fit: BoxFit.cover))),
        Padding(padding: const EdgeInsets.fromLTRB(6, 4, 6, 5), child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
            if (note != null) Text(note!, style: const TextStyle(color: dim, fontSize: 10.5), overflow: TextOverflow.ellipsis),
          ])),
          if (badge != null) Container(padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(color: const Color(0x33E2B55A), borderRadius: BorderRadius.circular(5)),
              child: Text(badge!, style: const TextStyle(color: gold, fontSize: 10))),
        ])),
      ]),
    )),
  );
}

// لوحة اختيار بتبويب لكل مجموعة (المناطق) وخانات في كل تبويب (picker.js)
class PickerSheet extends StatelessWidget {
  final String title;
  final List<(String, List<Widget>)> groups;
  final List<Widget> footer;
  final Widget? side;                  // لوحة جانبية (يسار الخانات): وصف المختار وزر اختياره
  const PickerSheet({super.key, required this.title, required this.groups, this.footer = const [], this.side});
  @override
  Widget build(BuildContext context) => SizedBox(
    height: MediaQuery.sizeOf(context).height * 0.9,
    child: DefaultTabController(length: groups.length, child: Column(children: [
      Padding(padding: const EdgeInsets.only(top: 8), child: Text(title, style: const TextStyle(color: gold, fontSize: 17, fontWeight: FontWeight.w800))),
      if (groups.length > 1) TabBar(isScrollable: true, labelColor: gold, unselectedLabelColor: dim, indicatorColor: gold,
          tabs: [for (final g in groups) Tab(text: tr(g.$1))]),
      Expanded(child: Row(children: [
        Expanded(child: TabBarView(children: [
          for (final g in groups) GridView.extent(maxCrossAxisExtent: 210, childAspectRatio: 1.7, padding: const EdgeInsets.all(10),
              mainAxisSpacing: 8, crossAxisSpacing: 8, children: g.$2),
        ])),
        ?side,
      ])),
      if (footer.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Wrap(spacing: 8, children: footer)),
    ])),
  );
}

// إيقاع أقل من الشاشة فعلاً: بعد كل إطار مرسوم تُكتم التكتكة حتى موعد التالي، فلا يركّب المحرك إطارات لا تتغير
// (تخطي الرسم وحده كان يتركه يركّب كل إطارات الشاشة). وTickerMode صاحب الكلمة: لا تُفتح التكتكة وشاشتها مخفية
// وشاشات 90 و120 هرتز: الحد 60 فيها أيضاً (2.1.1، كانت تُرسم بإيقاع الشاشة كله فيتضاعف العمل)
final _hz = () {
  final r = ui.PlatformDispatcher.instance.displays.firstOrNull?.refreshRate ?? 60;
  return r < 30 ? 60.0 : r;
}();
Timer? restTicker(Ticker t, double fps, BuildContext context) {
  if (fps >= _hz - 1) return null;
  t.muted = true;
  return Timer(Duration(microseconds: (1e6 / fps - math.min(8000, 750000 / _hz)).round()), () => wakeTicker(t, context));
}

void wakeTicker(Ticker t, BuildContext context) {
  if (context.mounted) t.muted = !TickerMode.getValuesNotifier(context).value.enabled;
}
