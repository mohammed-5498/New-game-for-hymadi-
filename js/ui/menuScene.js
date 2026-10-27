// الخلفية الحية للقوائم (القسم 12.0): الخريطة نفسها بالعرض المائل،
// والكاميرا تنجرف فوقها ببطء، وبضع وحدات تتجول في الشوارع.
// مدينة مستقلة عن المباراة: بلا قتال ولا ظهور ولا بوتات ولا صوت، حركة فقط.
import { UI, TICK_MS, TICK_SEC, TILE_HALF_W, TILE_HALF_H, GANG_IDS, PLAYER_COLORS, HEROES, UNITS } from '../config.js';
import { createMatch } from '../state.js';
import { createUnit, commandMove, processPathQueue, updateUnits } from '../game/units.js';
import { snapDistrictTints } from '../game/capture.js';
import { render } from '../render/renderer.js';
import { updateParticles, resetParticles } from '../render/weather.js';
import { fadeIn, fadeOut } from './transition.js';

const SCENE = UI.menuScene;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = ([from, to]) => from + Math.random() * (to - from);

let canvas = null, ctx = null, layer = null;
let city = null;          // حالة المدينة الخلفية، تُبنى عند أول ظهور
let active = false;
let lastTime = 0, accumulator = 0, sinceDraw = 0;
let drift = null;         // مسار انجراف الكاميرا
let half = null;          // نصف عرض المدينة ونصف ارتفاعها بالبكسل

export function setupMenuScene(canvasNode, layerNode) {
  canvas = canvasNode;
  ctx = canvas.getContext('2d');
  layer = layerNode;
}

// تُستدعى عند ظهور أي قائمة وعند الانتقال للمباراة
export function showMenuScene() {
  if (active) return;
  active = true;
  lastTime = performance.now();
  accumulator = 0;
  sinceDraw = Infinity;     // ارسم في أول إطار
  fadeIn(layer);
}

export function hideMenuScene() {
  active = false;
  fadeOut(layer);
}

// --- بناء المدينة: أربع عصابات متحالفة، أحياء ملوّنة، ووحدات موزعة على الشوارع ---
function build() {
  const colors = [...PLAYER_COLORS].sort(() => Math.random() - 0.5);
  const players = GANG_IDS.map((gang, k) => ({
    name: gang, gang, color: colors[k].id, isHuman: false, team: 1, difficulty: 'easy'
  }));
  const state = createMatch({
    mapSize: SCENE.mapSize, maxUnits: UNITS.maxUnitsDefault, weather: pick(SCENE.weathers), players
  });
  const map = state.map;

  // نصف الأحياء تقريباً بألوان العصابات: مدينة متنازع عليها كما في المباراة
  for (const district of map.districts) {
    if (!district.capturable || district.isHome || Math.random() > SCENE.ownedShare) continue;
    const owner = Math.floor(Math.random() * players.length);
    district.owner = owner;
    district.progress = 100;
    district.progressOwner = owner;
  }
  snapDistrictTints(state);

  // بلا شرطة ولا أبطال (شريط دم البطل الدائم لا يناسب الخلفية): أفراد وشخصيات مميزة
  // تتجول في وسط المدينة حيث تمر الكاميرا
  half = { w: (map.n - 1) * TILE_HALF_W, h: (map.n - 1) * TILE_HALF_H };
  state.units = [];
  const streets = [];
  for (let j = 0; j < map.n; j++) {
    for (let i = 0; i < map.n; i++) {
      if (isStreet(map, i, j)) streets.push([i, j]);
    }
  }
  for (let k = 0; k < SCENE.walkers && streets.length; k++) {
    const player = state.players[k % players.length];
    const heroes = Object.values(HEROES).filter(h => h.gang === player.gang);
    const heroId = heroes.length && Math.random() < SCENE.heroShare ? pick(heroes).id : null;
    const [i, j] = pick(streets);
    const unit = createUnit(state, player, i, j, heroId);
    unit.facing = Math.random() < 0.5 ? 1 : -1;
    unit.restUntil = Math.random() * SCENE.restSeconds[1];    // لا تنطلق كلها معاً
    state.units.push(unit);
  }

  // الكاميرا تنجرف حول مركز المدينة على منحنى بطيء لا يتكرر سريعاً
  drift = { phase: 0, px: Math.random() * 6.28, py: Math.random() * 6.28 };
  state.view = { w: 0, h: 0, dpr: 1 };
  return state;
}

// شارع موصول داخل منطقة التجوال حول المركز
function isStreet(map, i, j) {
  if (!map.isConnected(i, j) || map.road[map.idx(i, j)] !== 1) return false;
  const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
  return Math.abs(x) <= half.w * SCENE.walkArea[0] && Math.abs(y - half.h) <= half.h * SCENE.walkArea[1];
}

// المدينة معيّن (◇) على الشاشة. يبقى مستطيل الرؤية داخله بهامش edgeMargin إذا تحقق:
// |x|/نصف العرض + |y - المركز|/نصف الارتفاع <= 1 - (نصف الرؤية عرضاً/نصف العرض + نصف الرؤية طولاً/نصف الارتفاع)
// فنرفع التقريب على الشاشات الطويلة حتى يتسع الهامش، ثم ننجرف داخل ما بقي.
function moveCamera(state, seconds) {
  const { view, camera } = state;
  const spread = view.w / 2 / half.w + view.h / 2 / half.h;   // حجم الرؤية عند تقريب 1
  camera.z = Math.max(SCENE.zoom, spread / (1 - SCENE.edgeMargin));
  const room = Math.max(0, 1 - spread / camera.z) / 2;        // ما بقي للانجراف في كل اتجاه
  const ax = half.w * room, ay = half.h * room;
  drift.phase += seconds * SCENE.cameraSpeed / Math.max(1, ax);   // أقصى سرعة أفقية = cameraSpeed
  camera.x = ax * Math.sin(drift.phase + drift.px);
  camera.y = half.h + ay * Math.sin(drift.phase * 0.77 + drift.py);
}

// كل وحدة تقف قليلاً ثم تمشي إلى شارع قريب
function roam(state) {
  for (const unit of state.units) {
    if (unit.state !== 'idle') continue;
    if (unit.restUntil === null) { unit.restUntil = state.time + between(SCENE.restSeconds); continue; }
    if (state.time < unit.restUntil) continue;
    unit.restUntil = null;
    const target = nearbyStreet(state.map, unit);
    if (target) commandMove(state, target[0], target[1], [unit], false);   // بلا حلقة أمر
  }
}

function nearbyStreet(map, unit) {
  const r = SCENE.roamTiles;
  for (let tries = 0; tries < 10; tries++) {
    const i = Math.round(unit.x + (Math.random() * 2 - 1) * r);
    const j = Math.round(unit.y + (Math.random() * 2 - 1) * r);
    if (isStreet(map, i, j)) return [i, j];
  }
  return null;
}

function tick(state) {
  state.time += TICK_SEC;
  roam(state);
  processPathQueue(state);
  updateUnits(state);
}

// اللوحة بدقة مخفّضة: الخلفية تحت طبقة داكنة لا تحتاج دقة الشاشة الكاملة
function fit(state) {
  const view = state.view;
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, SCENE.maxDpr);
  if (w === view.w && h === view.h && dpr === view.dpr) return;
  view.w = w; view.h = h; view.dpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  resetParticles(state.weather, view);
}

// إطار واحد من حلقة اللعبة: تُستدعى في القوائم فقط
export function menuSceneFrame(now) {
  if (!active) return;
  if (!city) {
    city = build();
    resetParticles(city.weather, city.view);
  }

  const frameMs = Math.min(250, Math.max(0, now - lastTime));
  lastTime = now;
  accumulator += frameMs;
  let steps = 0;
  while (accumulator >= TICK_MS && steps < 5) { tick(city); accumulator -= TICK_MS; steps++; }
  if (accumulator > TICK_MS * 5) accumulator = 0;

  // رسم بمعدل أقل من الشاشة: الحركة بطيئة، والبطارية أهم في القوائم
  sinceDraw += frameMs;
  if (sinceDraw < 1000 / SCENE.fps - 2) return;
  const seconds = Math.min(0.25, sinceDraw / 1000);
  sinceDraw = 0;

  fit(city);
  moveCamera(city, seconds);
  updateParticles(city.weather, city.view, seconds);
  render(ctx, city, accumulator / TICK_MS);
  canvas.classList.add('ready');          // تظهر الخلفية بتلاشٍ بعد أول رسم
}
