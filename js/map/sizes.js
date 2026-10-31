// فئة حجم الحي (القسم 3.12): صغير أو متوسط أو كبير من عدد مربعاته، فلا تُحفظ ولا تتغير أثناء المباراة
import { DISTRICT_SIZES as DS } from '../config.js';

export const sizeOf = (d) => d.tiles.length <= DS.maxTiles.small ? 'small' : d.tiles.length <= DS.maxTiles.medium ? 'medium' : 'large';
