// قراءة أرقام js/config.js المولّدة (lib/data/js_config.dart): كائنات JavaScript خرائط في Dart،
// والأدوات تحوّل القيمة إلى نوعها كما يقرؤها JavaScript (الرقم رقم، والغائب null)
typedef J = Map<String, Object?>;

extension Cfg on J {
  double d(String k) => (this[k] as num).toDouble();
  double dd(String k, double fallback) => (this[k] as num?)?.toDouble() ?? fallback;   // k || fallback
  int i(String k) => (this[k] as num).toInt();
  J m(String k) => this[k] as J;
  J? mm(String k) => this[k] as J?;
  List<Object?> l(String k) => this[k] as List<Object?>;
  String s(String k) => this[k] as String;
  String? ss(String k) => this[k] as String?;
  bool b(String k) => truthy(this[k]);
  bool has(String k) => this[k] != null;
  double? dn(String k) => (this[k] as num?)?.toDouble();       // الرقم أو null (undefined)
  double dz(String k) => (this[k] as num?)?.toDouble() ?? 0;   // (x || 0) حيث يحرسه JavaScript بصدق القيمة
}

// صدق القيمة كما في JavaScript: لا شيء ولا false ولا 0 ولا نص فارغ
bool truthy(Object? v) => !(v == null || v == false || v == 0 || v == '' || (v is double && v.isNaN));
