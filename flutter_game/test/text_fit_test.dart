// النص يصغر ليتسع لمكانه بدل أن يُقطع (2.16.0، lib/i18n/tr.dart): سطر واحد وسطران، وبلا maxLines مع نقاط القطع، وداخل نافذة
// تقيس عرضها (IntrinsicWidth)، وما لا يتسع حتى بأصغر نسبة يُقطع كما كان. خط الفحص لا حروف عربية فيه، وكل حرف لاتيني مربع بعرض حجمه
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show TEXT_FIT;
import 'package:gangcity/i18n/tr.dart';

Widget _app(Widget child) => MaterialApp(home: Directionality(textDirection: TextDirection.rtl, child: Center(child: child)));
RenderParagraph _para(WidgetTester t) => t.renderObject<RenderParagraph>(find.byType(RichText));
// نسبة التصغير: من النص إلى العلبة التي حوله
double _k(WidgetTester t) => t.renderObject<RenderBox>(find.byType(RichText)).getTransformTo(t.renderObject(find.byType(SizedBox).first)).entry(0, 0);

void main() {
  testWidgets('يصغر ولا يُقطع', (t) async {
    const style = TextStyle(fontSize: 14);
    await t.pumpWidget(_app(const SizedBox(width: 120, child: Text('Masters Nile', maxLines: 1, overflow: TextOverflow.ellipsis, style: style))));
    expect(_para(t).didExceedMaxLines, isFalse);
    final k = _k(t);
    expect(k, lessThan(1));
    expect(k, greaterThanOrEqualTo(TEXT_FIT.minScale));
    expect(t.getSize(find.byType(SizedBox)).width, 120);

    // سطران
    await t.pumpWidget(_app(const SizedBox(width: 150, child: Text('win with ally vs hard bots', maxLines: 2,
        overflow: TextOverflow.ellipsis, style: style))));
    expect(_para(t).didExceedMaxLines, isFalse);
    expect(_k(t), lessThan(1));

    // بلا maxLines مع نقاط القطع: سطر واحد
    await t.pumpWidget(_app(const SizedBox(width: 80, child: Text('Gold gem', overflow: TextOverflow.ellipsis, style: style))));
    expect(_para(t).didExceedMaxLines, isFalse);
    expect(_k(t), lessThan(1));

    // ما يتسع يبقى كما هو
    await t.pumpWidget(_app(const SizedBox(width: 300, child: Text('Back', maxLines: 1, overflow: TextOverflow.ellipsis, style: style))));
    expect(_k(t), closeTo(1, 1e-9));

    // ما لا يتسع حتى بأصغر نسبة يُقطع
    await t.pumpWidget(_app(const SizedBox(width: 20, child: Text('a very long text that never fits', maxLines: 1, overflow: TextOverflow.ellipsis, style: style))));
    expect(_k(t), closeTo(TEXT_FIT.minScale, 1e-9));
    expect(_para(t).didExceedMaxLines, isTrue);

    // داخل نافذة تقيس عرض ما فيها
    await t.pumpWidget(_app(const IntrinsicWidth(child: SizedBox(child: Text('OK', maxLines: 1, overflow: TextOverflow.ellipsis, style: style)))));
    expect(t.takeException(), isNull);
  });
}
