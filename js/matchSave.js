// حفظ المباراة الجارية والعودة إليها لاحقاً (خانة واحدة في localStorage، القسم 2.1)
// تُحفظ حالة المباراة كلها كما هي: الخريطة والوحدات والأحياء والمؤقتات والبوتات.
// الشكل مضغوط حتى يتسع للمباريات الكبيرة:
// - كل كائن عقدة في جدول، والإشارة إليه برقمه: يبقى هدف الوحدة هو نفس الوحدة بعد التحميل
// - أسماء الحقول تُكتب مرة واحدة لكل "شكل" كائن، لا مع كل وحدة
// - كائنات config.js تُحفظ باسمها، فتعود هي نفسها لا نسخة منها
import * as CONFIG from './config.js';
import { UI, MAP_SIZES } from './config.js';
import { attachMapMethods } from './map/generator.js';
import { restoreRng } from './game/realism.js';
import { districtsOwnedBy } from './state.js';

// حقول لا تُحفظ: تخص الشاشة الحالية، أو تُبنى من جديد في كل تحديث
const SKIP_STATE_KEYS = new Set(['view', 'inputMode', 'debugView', 'selectionBox', 'running', 'paused', 'unitHash', 'cameraTween', 'hudAvoid']);

const TYPED = {
  Uint8Array, Int8Array, Uint8ClampedArray, Uint16Array, Int16Array,
  Uint32Array, Int32Array, Float32Array, Float64Array
};

// دوال لا تُحفظ، وتُعاد بعد التحميل
const MAP_METHOD_KEYS = new Set(['idx', 'inBounds', 'isWalkable', 'isConnected', 'districtOf']);

// تُحفظ المباراة الجارية فقط: لا المنتهية، ولا ساحة التجربة
export const canSaveMatch = (state) =>
  !!state.running && !state.matchResult && !(state.settings && state.settings.arena) && state.humanId >= 0;

// --- كائنات config.js: المسار بدل النسخة ---
let configPaths = null;

function configIndex() {
  if (configPaths) return configPaths;
  configPaths = new Map();
  const walk = (obj, path) => {
    if (!obj || typeof obj !== 'object' || configPaths.has(obj)) return;
    configPaths.set(obj, path);
    for (const key of Object.keys(obj)) walk(obj[key], path + '.' + key);
  };
  for (const [name, value] of Object.entries(CONFIG)) walk(value, name);
  return configPaths;
}

function fromConfig(path) {
  let value = CONFIG;
  for (const part of path.split('.')) {
    value = value[part];
    if (value === undefined) throw new Error('مسار غير موجود في config: ' + path);
  }
  return value;
}

// --- الترميز: جدول عقد بلا تداخل (فلا عمق استدعاء مهما طالت سلاسل الأهداف) ---
function encode(root) {
  const config = configIndex();
  const scale = 10 ** UI.matchDecimals;
  const ids = new Map(), nodes = [], queue = [];
  const shapes = [], shapeIds = new Map();

  const ref = (obj) => {
    let id = ids.get(obj);
    if (id === undefined) {
      id = nodes.length;
      ids.set(obj, id);
      nodes.push(null);
      queue.push(obj);
    }
    return id;
  };

  const value = (v) => {
    if (v === null) return null;
    switch (typeof v) {
      case 'number':
        if (Number.isFinite(v)) return Number.isInteger(v) ? v : Math.round(v * scale) / scale;
        return { n: v > 0 ? 1 : v < 0 ? -1 : 0 };            // ∞ و-∞ وNaN
      case 'string':
      case 'boolean':
        return v;
      case 'object': {
        const path = config.get(v);
        return path !== undefined ? { c: path } : [ref(v)];
      }
      default:
        return { u: 1 };                                     // undefined داخل مصفوفة
    }
  };

  ref(root);
  for (let q = 0; q < queue.length; q++) {
    const obj = queue[q];
    let node;
    if (Array.isArray(obj)) {
      node = ['a'];
      for (const item of obj) node.push(value(item));
    } else if (ArrayBuffer.isView(obj)) {
      node = ['t', obj.constructor.name];
      for (const item of obj) node.push(value(item));
    } else if (obj instanceof Map) {
      node = ['m'];
      for (const [k, v] of obj) node.push(value(k), value(v));
    } else if (obj instanceof Set) {
      node = ['s'];
      for (const item of obj) node.push(value(item));
    } else {
      const proto = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) throw new Error('نوع لا يُحفظ: ' + proto.constructor.name);
      const keys = [], fns = [], vals = [];
      for (const key of Object.keys(obj)) {
        const v = obj[key];
        if (v === undefined) continue;
        if (typeof v === 'function') { fns.push(key); continue; }
        if (obj === root && SKIP_STATE_KEYS.has(key)) continue;
        keys.push(key);
        vals.push(value(v));
      }
      const shapeKey = JSON.stringify([keys, fns]);
      let shape = shapeIds.get(shapeKey);
      if (shape === undefined) {
        shape = shapes.length;
        shapeIds.set(shapeKey, shape);
        shapes.push([keys, fns]);
      }
      node = ['o', shape, ...vals];
    }
    nodes[ids.get(obj)] = node;
  }
  return { shapes, nodes };
}

// --- فك الترميز: الحاويات أولاً ثم ملؤها، فتعمل الإشارات المتبادلة ---
function decode({ shapes, nodes }) {
  const plain = (v) => (v && typeof v === 'object' && 'n' in v)
    ? (v.n > 0 ? Infinity : v.n < 0 ? -Infinity : NaN)
    : v;

  const objs = nodes.map(node => {
    switch (node[0]) {
      case 'a': return [];
      case 'm': return new Map();
      case 's': return new Set();
      case 'o': return {};
      case 't': {
        const Typed = TYPED[node[1]];
        if (!Typed) throw new Error('مصفوفة غير معروفة: ' + node[1]);
        return Typed.from(node.slice(2), plain);
      }
      default: throw new Error('عقدة غير معروفة');
    }
  });

  const value = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return objs[v[0]];
    if ('c' in v) return fromConfig(v.c);
    if ('n' in v) return plain(v);
    return undefined;
  };

  const withFunctions = [];
  nodes.forEach((node, id) => {
    const obj = objs[id];
    switch (node[0]) {
      case 'a': for (let k = 1; k < node.length; k++) obj.push(value(node[k])); break;
      case 'm': for (let k = 1; k < node.length; k += 2) obj.set(value(node[k]), value(node[k + 1])); break;
      case 's': for (let k = 1; k < node.length; k++) obj.add(value(node[k])); break;
      case 'o': {
        const [keys, fns] = shapes[node[1]];
        for (let k = 0; k < keys.length; k++) obj[keys[k]] = value(node[k + 2]);
        if (fns.length) withFunctions.push([obj, fns]);
        break;
      }
    }
  });
  return { root: objs[0], withFunctions };
}

// إعادة الدوال التي لم تُحفظ: دوال الخريطة، ومولّد الأرقام لكل وحدة
function restoreFunctions(state, obj, fns) {
  for (const key of fns) {
    if (MAP_METHOD_KEYS.has(key)) attachMapMethods(obj);
    else if (key === 'rng') restoreRng(state, obj);
    else throw new Error('دالة لا يعرف الحفظ إعادتها: ' + key);
  }
}

// --- الواجهة ---
export function saveMatch(state) {
  if (!canSaveMatch(state)) return false;
  try {
    const text = JSON.stringify({ v: UI.matchVersion, ...encode(state) });
    localStorage.setItem(UI.matchKey, text);
    localStorage.setItem(UI.matchInfoKey, JSON.stringify(matchInfo(state)));
    return true;
  } catch {
    clearSavedMatch();                   // مساحة لا تكفي أو تخزين معطّل: لا نترك حفظاً أقدم مضللاً
    return false;
  }
}

// ملخص صغير لزر "متابعة المباراة"
function matchInfo(state) {
  const human = state.players[state.humanId];
  return {
    savedAt: Date.now(),
    time: Math.round(state.time),
    gang: human.gangName,
    color: human.color,
    districts: districtsOwnedBy(state, state.humanId),
    map: (MAP_SIZES[state.settings.mapSize] || MAP_SIZES.medium).name
  };
}

export function savedMatchInfo() {
  try { return JSON.parse(localStorage.getItem(UI.matchInfoKey) || 'null'); }
  catch { return null; }
}

export function clearSavedMatch() {
  try {
    localStorage.removeItem(UI.matchKey);
    localStorage.removeItem(UI.matchInfoKey);
  } catch { /* تخزين معطّل */ }
}

// يحمّل المباراة المحفوظة داخل نفس كائن الحالة (اللمس والواجهة يحتفظون بمرجعه)
// ويعيد false إن لم يوجد حفظ صالح، ويحذف الحفظ التالف أو القديم
export function loadMatch(state) {
  let saved;
  try {
    const data = JSON.parse(localStorage.getItem(UI.matchKey) || 'null');
    if (!data || data.v !== UI.matchVersion) throw new Error('لا حفظ صالح');
    const { root, withFunctions } = decode(data);
    for (const [obj, fns] of withFunctions) restoreFunctions(root, obj, fns);
    if (!root.map || !Array.isArray(root.units) || !root.players) throw new Error('حفظ ناقص');
    saved = root;
  } catch {
    clearSavedMatch();
    return false;
  }

  const keep = { view: state.view, inputMode: state.inputMode, debugView: state.debugView };
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, saved, keep, { running: false, paused: false, selectionBox: null, cameraTween: null });
  return true;
}
