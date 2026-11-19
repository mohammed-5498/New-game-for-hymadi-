// فئة حجم الحي (القسم 3.12) من عدد مربعاته، كـ js/map/sizes.js
import '../config.dart';
import 'generator.dart';

String sizeOf(District d) => d.tiles.length <= DISTRICT_SIZES.maxTiles.small
    ? 'small' : d.tiles.length <= DISTRICT_SIZES.maxTiles.medium ? 'medium' : 'large';
