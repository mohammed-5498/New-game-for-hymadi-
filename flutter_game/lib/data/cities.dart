// مولّد من js/render/cityThemes.js بـ scripts/export_flutter_data.mjs: لا تعدّله باليد
// ما يحتاجه مولّد الخريطة من طابع كل مدينة: أنواع المربعات بأوزانها (pool)، وأنماط الأحياء (styles، اليمامة)،
// وأنواع الأحياء الصغيرة (smallPool)، ونوع الشجرة، ووجود المعلم
typedef Pool = List<(String?, double)>;

class CityTheme {
  final String name;
  final Pool pool;
  final List<(Pool, double)>? styles;
  final Pool? smallPool;
  final String? tree;
  final bool monument;
  final List<String>? car;   // ألوان السيارة المحطمة في الشوارع (streetDebris)
  final String? debris;      // لون الركام
  const CityTheme({required this.name, required this.pool, this.styles, this.smallPool, this.tree, this.monument = false,
      this.car, this.debris});
}

const CITY_THEMES = <String, CityTheme>{
  'yamamah': CityTheme(name: 'صحراء اليمامة', pool: [('house', 40.0), ('watchtower', 6.0), ('palm', 14.0), ('ruin', 12.0), ('.', 8.0)], styles: [([('house', 35.0), ('souq', 7.0), ('majlis', 7.0), ('watchtower', 6.0), ('palm', 13.0), ('ruin', 12.0), ('.', 9.0)], 52.0), ([('tower', 10.0), ('roundTower', 7.0), ('archTower', 6.0), ('drum', 6.0), ('hall', 9.0), ('gatehouse', 6.0), ('pavilion', 5.0), ('rotunda', 2.0), ('minaret', 2.0), ('house', 8.0), ('souq', 2.0), ('majlis', 2.0), ('palm', 9.0), ('ruin', 10.0), ('.', 6.0)], 33.0), ([('grove', 30.0), ('palm', 16.0), ('well', 8.0), ('house', 12.0), ('souq', 2.0), ('majlis', 2.0), ('watchtower', 4.0), ('ruin', 6.0), ('.', 14.0)], 15.0)], smallPool: [('grove', 34.0), ('palm', 18.0), ('well', 6.0), ('cart', 6.0), ('.', 36.0)], tree: 'palm', monument: true, car: ['#7a5a3c', '#8e6a48', '#5e4430'], debris: '#c4a87e'),
  'arab': CityTheme(name: 'مدينة عربية', pool: [('house', 16.0), ('qahwa', 6.0), ('attar', 6.0), ('tall', 16.0), ('domeHouse', 10.0), ('souk', 10.0), ('palm', 14.0), ('ruin', 12.0), ('.', 8.0)], tree: 'palm', monument: true, debris: '#bba47c'),
  'japan': CityTheme(name: 'إيدو — اليابان', pool: [('house', 16.0), ('izakaya', 6.0), ('chaya', 6.0), ('two', 16.0), ('shop', 12.0), ('cherry', 14.0), ('lantern', 6.0), ('ruin', 14.0), ('.', 8.0)], tree: 'cherry', monument: true, debris: '#8f8778'),
  'china': CityTheme(name: 'مدينة صينية', pool: [('hall', 14.0), ('dumpling', 5.0), ('silk', 5.0), ('hutong', 20.0), ('tower2', 12.0), ('willow', 12.0), ('lanterns', 8.0), ('ruin', 14.0), ('.', 10.0)], tree: 'willow', monument: true, debris: '#8a847a'),
  'europe': CityTheme(name: 'مدينة أوروبية', pool: [('row', 28.0), ('flowers', 6.0), ('cheese', 6.0), ('rowStep', 20.0), ('rowBell', 12.0), ('fach', 10.0), ('ruin', 10.0), ('.', 3.0)], tree: 'tree', monument: true, debris: '#8a8378'),
  'norway': CityTheme(name: 'قرية صيد نرويجية', pool: [('wood', 16.0), ('fishmarket', 5.0), ('kafe', 5.0), ('turf', 14.0), ('long', 12.0), ('pine', 22.0), ('rack', 6.0), ('ruin', 10.0), ('.', 8.0)], tree: 'pine', monument: true, car: ['#3e4a56', '#4e5a66', '#2e3640'], debris: '#7a7e82'),
  'hk': CityTheme(name: 'هونغ كونغ النيون', pool: [('tower', 26.0), ('noodle', 5.0), ('herbal', 5.0), ('tower', 14.0), ('shop', 16.0), ('market', 12.0), ('ruin', 10.0), ('.', 2.0)], tree: 'banyan', car: ['#b8322c', '#d0443a', '#e8e2d6'], debris: '#5a5a62'),
  'jaipur': CityTheme(name: 'جايبور الوردية', pool: [('haveli', 18.0), ('chai', 6.0), ('textile', 6.0), ('haveli2', 16.0), ('bazaar', 12.0), ('neem', 12.0), ('ruin', 12.0), ('.', 6.0)], tree: 'neem', monument: true, car: ['#e8c23a', '#2f6e4e', '#2a2a2a'], debris: '#b3866a'),
  'mexico': CityTheme(name: 'مدينة مكسيكية', pool: [('adobe', 18.0), ('taqueria', 6.0), ('frutas', 6.0), ('balcony', 16.0), ('portal', 12.0), ('cactus', 14.0), ('ruin', 12.0), ('.', 8.0)], tree: 'cactus', monument: true, debris: '#b39672'),
  'chicago': CityTheme(name: 'شيكاغو الثلاثينيات', pool: [('brick', 20.0), ('diner', 5.0), ('cinema', 5.0), ('warehouse', 14.0), ('tank', 10.0), ('billboard', 8.0), ('ruin', 14.0), ('.', 6.0)], tree: 'tank', monument: true, car: ['#2a2a2c', '#3a3a3e', '#1e1e20'], debris: '#7a5a4a'),
  'shibam': CityTheme(name: 'شبام — اليمن', pool: [('tower', 40.0), ('honey', 6.0), ('qishr', 6.0), ('towerLow', 16.0), ('palm', 6.0), ('ruin', 10.0), ('.', 4.0)], tree: 'palm', monument: true, debris: '#b08a5e'),
  'diriyah': CityTheme(name: 'الدرعية — السعودية', pool: [('najdi', 22.0), ('souq', 7.0), ('qahwa', 7.0), ('najdiTall', 18.0), ('tower', 8.0), ('palm', 18.0), ('ruin', 10.0), ('.', 6.0)], tree: 'palm', monument: true, debris: '#b8935f'),
  'cairo': CityTheme(name: 'القاهرة القديمة — مصر', pool: [('house', 30.0), ('fawanees', 7.0), ('attara', 7.0), ('wikala', 12.0), ('ahwa', 10.0), ('ruin', 12.0), ('.', 4.0)], tree: 'tree', monument: true, debris: '#a89070'),
  'kaifeng': CityTheme(name: 'كايفنغ — الصين', pool: [('shop', 20.0), ('restaurant', 5.0), ('umbrella', 5.0), ('tea', 16.0), ('court', 16.0), ('willow', 12.0), ('ruin', 10.0), ('.', 6.0)], tree: 'willow', monument: true, debris: '#8a847a'),
  'gyeongju': CityTheme(name: 'غيونغجو — كوريا', pool: [('hanok', 20.0), ('teahouse', 6.0), ('onggi', 6.0), ('hanokBig', 14.0), ('wall', 8.0), ('pine', 18.0), ('ruin', 10.0), ('.', 8.0)], tree: 'pine', monument: true, debris: '#8e877a'),
  'paris': CityTheme(name: 'باريس — فرنسا', pool: [('haus', 28.0), ('cafe', 12.0), ('boutique', 12.0), ('market', 6.0), ('ptree', 10.0), ('ruin', 10.0), ('.', 6.0)], tree: 'ptree', car: ['#2e3a40', '#3e4a50', '#22282c'], debris: '#958c7c'),
  'birmingham': CityTheme(name: 'برمنغهام — بريطانيا', pool: [('terrace', 32.0), ('chippy', 6.0), ('tearoom', 6.0), ('factory', 14.0), ('pub', 8.0), ('ruin', 12.0), ('.', 4.0)], tree: 'lamp', monument: true, car: ['#2a2a2c', '#3a3a3e', '#1e1e20'], debris: '#7a5a4a'),
  'rothenburg': CityTheme(name: 'روتنبورغ — ألمانيا', pool: [('fach', 20.0), ('row', 12.0), ('rowStep', 6.0), ('bakery', 10.0), ('rcafe', 10.0), ('markthalle', 6.0), ('wallSeg', 4.0), ('rtree', 10.0), ('ruin', 8.0), ('.', 6.0)], tree: 'rtree', debris: '#8a8378'),
  'gondar': CityTheme(name: 'غوندر — إثيوبيا', pool: [('tukul', 20.0), ('buna', 5.0), ('mercato', 5.0), ('stone', 22.0), ('acacia', 14.0), ('ruin', 12.0), ('.', 8.0)], tree: 'acacia', monument: true, debris: '#7a6a5c'),
  'kano': CityTheme(name: 'كانو — نيجيريا', pool: [('hausa', 20.0), ('kasuwa', 6.0), ('suya', 6.0), ('hausaTall', 14.0), ('dye', 8.0), ('baobab', 10.0), ('wallK', 6.0), ('ruin', 12.0), ('.', 6.0)], tree: 'baobab', monument: true, debris: '#a8744a'),
  'meroe': CityTheme(name: 'مروي والنوبة — السودان', pool: [('nubian', 28.0), ('souq', 6.0), ('shai', 6.0), ('palm', 18.0), ('ruin', 12.0), ('.', 8.0)], tree: 'palm', monument: true, debris: '#b8986a'),
  'rio': CityTheme(name: 'ريو — البرازيل', pool: [('colonial', 32.0), ('boteco', 8.0), ('fruta', 8.0), ('palm', 14.0), ('ruin', 12.0), ('.', 4.0)], tree: 'palm', monument: true, debris: '#a89a82'),
  'laboca': CityTheme(name: 'لا بوكا — الأرجنتين', pool: [('conv', 34.0), ('parrilla', 7.0), ('tango', 7.0), ('crane', 6.0), ('ruin', 12.0), ('.', 4.0)], tree: 'crane', monument: true, car: ['#2a2a2c', '#3a3a3e', '#1e1e20'], debris: '#7a6a5a'),
  'tenoch': CityTheme(name: 'تينوتشتيتلان — المكسيك', pool: [('house', 24.0), ('tianguis', 6.0), ('pottery', 6.0), ('chinampa', 18.0), ('ahuejote', 10.0), ('ruin', 10.0), ('.', 6.0)], tree: 'ahuejote', monument: true, debris: '#b8aa8e'),
};
