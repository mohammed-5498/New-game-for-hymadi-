// المتجر (بطلب المستخدم): ما يأتي مجاناً مع اللاعب وما يُشترى.
// المجاني: العصابات الكلاسيكية الأربع وأربع خرائط (STORE.freeCities)، والباقي يُشترى بسعر يُحدد لاحقاً.
// في فترة الاختبار كل شيء متاح للعب، فلا تسأل قائمة الإعداد عن الملكية بعد
import { STORE, GANG_IDS } from './config.js';

export const isFreeCity = (city) => STORE.freeCities.includes(city);
export const isFreeSide = (side) => GANG_IDS.includes(side);

// السعر بمفتاح المدينة أو الأمة، أو null ما دام لم يُحدد
export const cityPrice = (city) => (city in STORE.prices.cities ? STORE.prices.cities[city] : null);
export const sidePrice = (side) => (side in STORE.prices.sides ? STORE.prices.sides[side] : null);
