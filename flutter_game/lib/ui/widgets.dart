// عناصر القوائم المشتركة (style.css في اللعبة الحالية): لوحة داكنة دافئة بذهبي، وأزرار 52 بكسل، وخط 16
import 'package:flutter/material.dart';

import '../audio/sound.dart';

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

class WideButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool primary, ghost;
  final String? note;
  final double width;
  const WideButton(this.label, this.onTap, {super.key, this.primary = false, this.ghost = false, this.note, this.width = 260});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: SizedBox(width: width, height: note == null ? 50 : 58, child: FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: primary ? gold : ghost ? Colors.transparent : const Color(0xFF3A2E22),
        foregroundColor: primary ? Colors.black : ink,
        disabledBackgroundColor: const Color(0xFF241D16), disabledForegroundColor: dim,
        side: ghost ? const BorderSide(color: Color(0x66E2B55A)) : null,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
      onPressed: onTap == null ? null : () { sound('ui_tap'); onTap!(); },
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        if (note != null) Text(note!, style: TextStyle(fontSize: 11, color: primary ? Colors.black87 : dim)),
      ]),
    )),
  );
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
          if (icon != null) ...[Icon(icon, size: 18, color: gold), const SizedBox(width: 6)],
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
  const PickerSheet({super.key, required this.title, required this.groups, this.footer = const []});
  @override
  Widget build(BuildContext context) => SizedBox(
    height: MediaQuery.sizeOf(context).height * 0.9,
    child: DefaultTabController(length: groups.length, child: Column(children: [
      Padding(padding: const EdgeInsets.only(top: 8), child: Text(title, style: const TextStyle(color: gold, fontSize: 17, fontWeight: FontWeight.w800))),
      if (groups.length > 1) TabBar(isScrollable: true, labelColor: gold, unselectedLabelColor: dim, indicatorColor: gold,
          tabs: [for (final g in groups) Tab(text: g.$1)]),
      Expanded(child: TabBarView(children: [
        for (final g in groups) GridView.extent(maxCrossAxisExtent: 210, childAspectRatio: 1.7, padding: const EdgeInsets.all(10),
            mainAxisSpacing: 8, crossAxisSpacing: 8, children: g.$2),
      ])),
      if (footer.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Wrap(spacing: 8, children: footer)),
    ])),
  );
}
