// طور القصة (القسم 17، بطلب المستخدم): مرحلة من حملة عصابة على أنظمة اللعبة نفسها. مباراة سيطرة كاملة على الاقتصاد:
// أنت ضد العدو الرئيسي (بوت) وقوات القصة (طرف محايد حليف له)، والمهام بالترتيب (js/story/campaigns.js).
// كل مهمة من أدوات موجودة: الاستيلاء على الأحياء، وموجات تستولي كقطاع الطرق، وأسرى ينضمون كأهل القرى، وزعيم
// بحراسه كالفارس الأسود، وتجار بلا قتال كالقافلة، ونقطة يُبقى عندها كالكنز، وبرج العدو من مباني الاقتصاد.
// الفوز بإكمال آخر مهمة، والخسارة بفشل مهمة أو بخسارة كل جنودك وأحيائك (victory.js). الأرقام في STORY.
import { TICK_SEC, STORY as S, PLAYER_COLORS, nations } from '../config.js';
import { CAMPAIGNS } from '../story/campaigns.js';
import { createUnit, commandMove, commandAttackMove } from './units.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { applyUpgrades, buildSpot, BUILDING_TILE } from './empire.js';
import { isEnemyId } from './combat.js';
import { finish } from './victory.js';
import { raiseAlert } from './alerts.js';
import { addUltFx } from './realism.js';
import { snapDistrictTints } from './capture.js';
import { sound, soundAt } from '../audio/sound.js';
import { hypot } from './hypot.js';

const isAlive = (u) => u.state !== 'dead' && u.hp > 0;
const colorHex = (id) => (PLAYER_COLORS.find(c => c.id === id) || PLAYER_COLORS[0]).hex;
export const storyLevelOf = (settings) => {
  const st = settings && settings.story;
  const camp = st && CAMPAIGNS[st.campaign];
  return camp && camp.levels[st.level] ? { camp, level: camp.levels[st.level], tier: st.level } : null;
};

// --- قبل المباراة: لاعبو المرحلة كما تأخذهم createMatch (أنت ثم العدو الرئيسي وحلفاؤه) ---
export function storyPlayers(campaignId, levelIndex) {
  const camp = CAMPAIGNS[campaignId], level = camp.levels[levelIndex], nation = nations[camp.nation];
  // حلفاء العدو بصعوبة أقل منه بمستوى (عصابتان بالقوة نفسها أكثر مما يحتمله لاعب وحده)
  const order = ['easy', 'medium', 'hard', 'insane'], main = S.botLevel[levelIndex];
  const weaker = order[Math.max(0, order.indexOf(main) - 1)];
  const bot = (side, difficulty) => ({ name: side.name, gangName: side.name, gang: side.gang, nation: side.nation || null,
    color: side.color, isHuman: false, team: 2, difficulty });
  return [
    { name: 'أنت', gang: nation.style, nation: camp.nation, color: S.colors.you, isHuman: true, team: 1, difficulty: 'medium' },
    bot(camp.enemy, main),
    ...(level.allies || []).map(side => bot(side, weaker))
  ];
}

// --- أطراف القصة المحايدة (تُضاف مع الشرطة في createMatch): قوات العدو، وطرف لكل زعيم بنمط غير نمطها، والأسرى ---
export function createStoryPlayers(settings, players) {
  const L = storyLevelOf(settings);
  if (!L) return [];
  const { camp, level } = L, human = players.find(p => p.isHuman);
  const enemy = camp.enemy, list = [];
  const add = (p) => { p.id = players.length + list.length; list.push(p); return p; };
  const side = (role, gang, nation = null) => ({
    name: enemy.name, gang, nation, gangName: enemy.name, color: colorHex(enemy.color), isHuman: false,
    neutral: true, captures: true, team: 2, storyRole: role, difficulty: 'medium', homeDistrictId: -1, friendOf: -1
  });
  add(side('forces', enemy.gang));
  for (const step of level.steps) {
    if (step.type !== 'boss' || step.boss.gang === enemy.gang || list.some(p => p.storyRole === 'boss:' + step.boss.gang)) continue;
    add(side('boss:' + step.boss.gang, step.boss.gang));
  }
  add({ name: 'الأسرى', gang: human.gang, nation: human.nation, gangName: 'الأسرى', color: S.colors.captives, isHuman: false,
        neutral: true, passive: true, team: 0, storyRole: 'captives', difficulty: 'medium', homeDistrictId: -1, friendOf: -1 });
  return list;
}

const storyPlayer = (state, role) => state.players.find(p => p.storyRole === role) || null;
const forces = (state) => storyPlayer(state, 'forces');
const mainEnemy = (state) => state.players.find(p => !p.isHuman && !p.neutral) || null;
const tier = (state) => state.story.tier;
const at = (list, state) => list[Math.min(list.length - 1, tier(state))];

// --- بداية المرحلة (createMatch بعد مزايا المدينة وقبل البوتات) ---
export function initStory(state) {
  const L = storyLevelOf(state.settings);
  if (!L) return;
  const { camp, level } = L;
  state.story = {
    campaign: state.settings.story.campaign, level: state.settings.story.level, tier: L.tier,
    title: level.title, count: level.steps.length,
    step: -1, cur: null, nextAt: S.startDelay, done: false,
    slots: pickSlots(state, level.steps),
    exitAt: null
  };
  const st = state.story, me = state.players[state.humanId];
  level.steps.forEach((step, k) => prepareStep(state, step, k));
  applyBonus(state, state.settings.story.bonus || {}, me);
  snapDistrictTints(state);
  state.notice = { text: 'المرحلة ' + (st.level + 1) + ': ' + level.title + ' — ' + level.goal, mine: true, t: 6, keep: true };
}

// المكافآت الدائمة من مراحل الحملة السابقة (STORY.rewards): نقاط، وحي قرب قاعدتك، وشخصية، وترقية
function applyBonus(state, bonus, me) {
  const ms = state.modeState, home = state.map.districts[me.homeDistrictId];
  if (bonus.points && ms.points) ms.points[me.id] += bonus.points;
  if (bonus.district && home) {
    const used = new Set(Object.values(state.story.slots));
    const extra = candidates(state).filter(d => !used.has(d.id) && d.owner === null)
      .sort((a, b) => dist(a.capture, home.capture) - dist(b.capture, home.capture))[0];
    if (extra) own(extra, me.id);
  }
  if (bonus.hero && home) {
    const spot = findFreeTiles(state.map, home.capture.i, home.capture.j, 1)[0];
    if (spot) state.units.push(createUnit(state, me, spot[0], spot[1], bonus.hero));
  }
  if (bonus.upgrade && ms.levels) {
    ms.levels[me.id][bonus.upgrade] = Math.max(ms.levels[me.id][bonus.upgrade] || 0, 1);
    for (const u of state.units) if (u.playerId === me.id) applyUpgrades(state, u);
  }
}

// --- أماكن المهام: كل اسم حي واحد يبقى للمرحلة كلها (المهمتان بالاسم نفسه في الحي نفسه) ---
const dist = (a, b) => hypot(a.i - b.i, a.j - b.j);
function candidates(state) {
  return state.map.districts.filter(d => d.capture && !d.isHome && !d.police && !d.hill && !d.feature && d.featureTile === undefined);
}
function pickSlots(state, steps) {
  const map = state.map, slots = {}, used = new Set();
  const me = state.players[state.humanId], enemy = mainEnemy(state);
  const H = map.districts[me.homeDistrictId].capture;
  const E = enemy && map.districts[enemy.homeDistrictId] ? map.districts[enemy.homeDistrictId].capture : { i: map.n - 1 - H.i, j: map.n - 1 - H.j };
  const D = Math.max(1, dist(H, E));
  const all = candidates(state);
  const cx = all.reduce((s, d) => s + d.capture.i, 0) / all.length, cy = all.reduce((s, d) => s + d.capture.j, 0) / all.length;
  // الأقرب لقاعدتك، وعلى الطريق إلى العدو بنسبة ratio من المسافة، ووسط المدينة
  const score = {
    near: (d) => dist(d.capture, H),
    mid: (d) => Math.abs(dist(d.capture, H) - 0.45 * D) + 0.6 * (dist(d.capture, H) + dist(d.capture, E) - D),
    far: (d) => Math.abs(dist(d.capture, H) - 0.72 * D) + 0.6 * (dist(d.capture, H) + dist(d.capture, E) - D),
    far2: (d) => Math.abs(dist(d.capture, H) - 0.62 * D) + 0.3 * (dist(d.capture, H) + dist(d.capture, E) - D),
    center: (d) => hypot(d.capture.i - cx, d.capture.j - cy)
  };
  for (const step of steps) {
    const name = step.at;
    if (slots[name] !== undefined) continue;
    if (name === 'home') { slots[name] = me.homeDistrictId; continue; }
    if (name === 'enemyHome') { slots[name] = enemy ? enemy.homeDistrictId : -1; continue; }
    const fn = score[name] || score.mid;
    const best = all.filter(d => !used.has(d.id)).sort((a, b) => fn(a) - fn(b))[0];
    if (!best) continue;
    slots[name] = best.id;
    used.add(best.id);
  }
  return slots;
}
const stepDistrict = (state, step) => {
  const id = state.story.slots[step.at];
  return id !== undefined && id >= 0 ? state.map.districts[id] : null;
};

function own(d, playerId) {
  d.owner = playerId;
  d.progress = 100;
  d.progressOwner = playerId;
}

// برج في الحي باسم مالكه (برج الدفاع لك، ونقطة مراقبة العدو): مبنى الاقتصاد نفسه، ومربعه الأصلي يُحفظ لهدمه
function placeTower(state, d) {
  const k = buildSpot(state.map, d);
  if (k < 0) return;
  d.storyTile = state.map.type[k];
  d.building = 'tower';
  d.buildTile = k;
  d.blv = {};
  d.cool = 0;
  state.map.type[k] = BUILDING_TILE.tower;
}
function razeTower(state, d) {
  if (d.building !== 'tower' || d.storyTile === undefined) return;
  state.map.type[d.buildTile] = d.storyTile;
  d.building = null;
  d.buildTile = undefined;
  d.blv = undefined;
  addUltFx(state, 'dust', d.capture.i, d.capture.j);
  soundAt(state, 'capture_done', d.capture.i, d.capture.j);
}

function spawnSquad(state, player, i, j, n, role, step, heroes = []) {
  const units = [];
  for (const [x, y] of findFreeTiles(state.map, Math.round(i), Math.round(j), n)) {
    const unit = createUnit(state, player, x, y, heroes[units.length] || null);
    unit.story = { role, step };
    state.units.push(unit);
    units.push(unit);
  }
  return units;
}
function guard(state, d, n, step) {
  const units = spawnSquad(state, forces(state), d.capture.i, d.capture.j, n, 'guard', step);
  for (const u of units) { u.homePost = { x: u.x, y: u.y }; u.leash = S.guardLeash; }
  return units;
}

// ما تحتاجه المهمة قبل أن تبدأ: الحي لك أو للعدو، والحراس والأسرى والبرج
function prepareStep(state, step, k) {
  const d = stepDistrict(state, step);
  if (!d) return;
  const me = state.humanId, f = forces(state), enemy = mainEnemy(state);
  switch (step.type) {
    case 'defend':
      own(d, me);
      if (step.tower) placeTower(state, d);
      break;
    case 'rescue': {
      own(d, f.id);
      guard(state, d, at(S.guards, state), k);
      const units = spawnSquad(state, storyPlayer(state, 'captives'), d.capture.i, d.capture.j, step.captives || 1, 'captive', k);
      for (const u of units) { u.homePost = { x: u.x, y: u.y }; u.leash = 1; }
      break;
    }
    case 'destroy':
      own(d, enemy ? enemy.id : f.id);
      placeTower(state, d);
      guard(state, d, Math.max(1, at(S.guards, state) - 1), k);
      break;
    case 'capture':
    case 'hold':
      own(d, f.id);
      guard(state, d, at(S.guards, state), k);
      break;
    case 'boss':
      if (d.owner === null) own(d, f.id);
      break;
  }
}

// --- كل تحديث (loop.js، قبل الفوز) ---
export function updateStory(state) {
  const st = state.story;
  if (!st || st.done || state.matchResult) return;
  const L = storyLevelOf(state.settings);
  if (!L) return;
  if (!st.cur) {
    if (state.time < st.nextAt) return;
    st.step++;
    if (st.step >= L.level.steps.length) { completeLevel(state, L); return; }
    startStep(state, L.level.steps[st.step]);
    return;
  }
  const step = L.level.steps[st.step];
  const r = runStep(state, step, st.cur);
  if (r === 'ok') stepDone(state, step);
  else if (r) fail(state, r);
}

function startStep(state, step) {
  const st = state.story, d = stepDistrict(state, step), t = state.time;
  const cur = st.cur = { t0: t, end: 0, nextWave: 0, waves: 0, thinkAt: 0, arrived: 0, since: 0, spawned: false };
  const k = st.step;
  if (step.type === 'defend') { cur.end = t + at(S.defendSeconds, state); cur.nextWave = t + S.firstWave; }
  if (step.type === 'rescue' || step.type === 'destroy' || step.type === 'hold') cur.end = t + at(S.timeLimit, state);
  if (step.type === 'escort') {
    const home = state.map.districts[state.players[state.humanId].homeDistrictId].capture;
    const me = state.players[state.humanId];
    const units = spawnSquad(state, me, home.i, home.j, S.escort.merchants, 'merchant', k);
    for (const u of units) { u.harmless = true; u.cargo = true; u.name = 'تاجر القافلة'; u.color = S.colors.escort; }
    cur.nextWave = t + 5;
  }
  if (step.type === 'intercept') cur.nextWave = t + S.runner.delay;
  if (step.type === 'boss' && d) spawnBoss(state, step, d, k);
  const p = targetPoint(state, step);
  if (p) raiseAlert(state, 'story', p.i, p.j);
  state.notice = { text: 'المهمة ' + (k + 1) + '/' + st.count + ': ' + step.text + ' — ' + step.hint, mine: true, t: 5, keep: true };
  sound('alert');
}

function spawnBoss(state, step, d, k) {
  const B = step.boss, player = storyPlayer(state, 'boss:' + B.gang) || forces(state);
  const spot = findFreeTiles(state.map, d.capture.i, d.capture.j, 1)[0];
  if (!spot) return;
  const boss = createUnit(state, player, spot[0], spot[1], B.champion ? null : B.hero, !!B.champion);
  const s = { ...boss.stats }, n = tier(state);
  s.hp *= S.boss.hp[n];
  s.damage *= S.boss.damage[n];
  if (s.meleeDamage) s.meleeDamage *= S.boss.damage[n];
  s.armor = Math.min(0.7, (s.armor || 0) + S.boss.armor[n]);
  s.capturePower = 0;
  boss.stats = s;
  boss.maxHp = s.hp;
  boss.hp = s.hp;
  boss.name = B.name;
  boss.storyBoss = true;
  boss.story = { role: 'boss', step: k };
  boss.homePost = { x: spot[0], y: spot[1] };
  boss.leash = S.boss.leash;
  state.units.push(boss);
  const escorts = spawnSquad(state, forces(state), d.capture.i, d.capture.j, S.boss.escorts[n], 'escort', k);
  for (const u of escorts) { u.homePost = { x: u.x, y: u.y }; u.leash = S.boss.leash; }
  addUltFx(state, 'dust', spot[0], spot[1]);
}

// ما يجري في المهمة: 'ok' نجحت، ونص سبب الفشل، أو null ما زالت
function runStep(state, step, cur) {
  const t = state.time, d = stepDistrict(state, step), me = state.humanId, k = state.story.step;
  const think = t >= cur.thinkAt;
  if (think) cur.thinkAt = t + S.think;
  const mine = (u) => u.story && u.story.step === k;
  switch (step.type) {
    case 'defend': {
      if (!d || d.owner !== me) return 'سقط ' + step.text.replace(/^دافع عن /, '');
      if (t >= cur.nextWave && t < cur.end - 5) { wave(state, d.capture, k, 'wave'); cur.nextWave = t + at(S.waveEvery, state); }
      if (think) push(state, (u) => mine(u) && u.story.role === 'wave', d.capture);
      return t >= cur.end ? 'ok' : null;
    }
    case 'escort': {
      const dest = d ? d.capture : null;
      const merchants = state.units.filter(u => mine(u) && u.story.role === 'merchant' && isAlive(u));
      if (dest) for (const u of merchants) {
        if (dist({ i: u.x, j: u.y }, dest) > S.escort.arrive) continue;
        u.story.role = 'arrived';
        u.hp = 0; u.state = 'dead'; u.deathTimer = 0; u.path = []; u.target = null; u.cargo = false;
        cur.arrived++;
      }
      state.units = state.units.filter(u => !(u.story && u.story.role === 'arrived' && u.story.step === k));
      const walking = merchants.filter(u => u.story.role === 'merchant');
      if (!walking.length) return cur.arrived ? 'ok' : 'سقط كل تجار القافلة';
      if (think && dest) {
        const idle = walking.filter(u => u.state === 'idle');
        if (idle.length) commandMove(state, dest.i, dest.j, idle, false);
      }
      if (t >= cur.nextWave && cur.waves < S.escort.ambushes && dest) {
        const home = state.map.districts[state.players[me].homeDistrictId].capture;
        const f = 0.4 + 0.3 * cur.waves;
        wave(state, { i: home.i + (dest.i - home.i) * f, j: home.j + (dest.j - home.j) * f }, k, 'ambush', 0);
        cur.nextWave = t + 10;
      }
      if (think && walking.length) {
        const ci = walking.reduce((s, u) => s + u.x, 0) / walking.length, cj = walking.reduce((s, u) => s + u.y, 0) / walking.length;
        push(state, (u) => mine(u) && u.story.role === 'ambush', { i: ci, j: cj });
      }
      return null;
    }
    case 'intercept': {
      if (!cur.spawned && t >= cur.nextWave && d) {
        cur.spawned = true;
        cur.dest = step.to === 'home' ? state.map.districts[state.players[me].homeDistrictId].capture : exitPoint(state);
        const units = spawnSquad(state, forces(state), d.capture.i, d.capture.j, step.runners || 1, 'runner', k);
        for (const u of units) {
          u.harmless = true;
          u.cargo = true;
          u.name = step.to === 'home' ? 'متفجّر' : 'رسول';
          u.stats = { ...u.stats, speed: u.stats.speed * S.runner.speed, capturePower: 0 };
        }
        raiseAlert(state, 'story', d.capture.i, d.capture.j);
      }
      if (!cur.spawned) return null;
      const runners = state.units.filter(u => mine(u) && u.story.role === 'runner' && isAlive(u));
      if (!runners.length) return 'ok';
      for (const u of runners) if (dist({ i: u.x, j: u.y }, cur.dest) <= S.runner.exitRadius) return step.to === 'home' ? 'وصل متفجّر إلى قاعدتك' : 'هرب الرسول';
      if (think) {
        const idle = runners.filter(u => u.state === 'idle');
        if (idle.length) commandMove(state, cur.dest.i, cur.dest.j, idle, false);
      }
      return null;
    }
    case 'rescue': {
      if (d && d.owner === me) { freeCaptives(state, k); return 'ok'; }
      return t >= cur.end ? 'نقلت الشبكة الأسرى بعيداً' : null;
    }
    case 'destroy': {
      if (d && d.owner === me) { razeTower(state, d); return 'ok'; }
      return t >= cur.end ? 'نقطة المراقبة ما زالت قائمة' : null;
    }
    case 'capture':
    case 'storm':
      return d && d.owner === me ? 'ok' : null;
    case 'hold': {
      if (!d) return 'ok';
      const p = d.capture, R = S.hold.radius;
      let mineIn = false, foe = false;
      for (const u of state.units) {
        if (!isAlive(u) || u.harmless || dist({ i: u.x, j: u.y }, p) > R) continue;
        if (u.playerId === me) mineIn = true;
        else if (isEnemyId(state, me, u.playerId)) foe = true;
      }
      cur.since = mineIn && !foe ? cur.since + TICK_SEC : 0;
      if (cur.since + 1e-6 >= at(S.hold.seconds, state)) return 'ok';
      return t >= cur.end ? 'انفجرت العبوة' : null;
    }
    case 'gather': {
      const home = state.map.districts[state.players[me].homeDistrictId].capture;
      let n = 0;
      for (const u of state.units) if (u.playerId === me && isAlive(u) && !u.harmless && dist({ i: u.x, j: u.y }, home) <= S.gather.radius) n++;
      cur.count = n;
      return n >= at(S.gather.count, state) ? 'ok' : null;
    }
    case 'boss':
      return state.units.some(u => u.storyBoss && u.story.step === k && isAlive(u)) ? null : 'ok';
  }
  return null;
}

// موجة من قوات القصة: تظهر على الطريق إلى العدو على بعد لا يزيد عن 14 مربعاً من الهدف، وتهاجم نحوه
function wave(state, target, k, role, extra = 0) {
  const enemy = mainEnemy(state), map = state.map;
  const E = enemy && map.districts[enemy.homeDistrictId] ? map.districts[enemy.homeDistrictId].capture : { i: map.n / 2, j: map.n / 2 };
  const len = dist(target, E), f = len > 14 ? 14 / len : 1;
  const src = role === 'ambush' ? target : { i: target.i + (E.i - target.i) * f, j: target.j + (E.j - target.j) * f };
  const units = spawnSquad(state, forces(state), src.i, src.j, at(S.waveSize, state) + extra, role, k);
  if (units.length) commandAttackMove(state, target.i, target.j, units, false);
  state.story.cur.waves++;
}
function push(state, which, p) {
  const idle = state.units.filter(u => which(u) && isAlive(u) && u.state === 'idle' && dist({ i: u.x, j: u.y }, p) > 2);
  if (idle.length) commandAttackMove(state, p.i, p.j, idle, false);
}

// الأسرى ينضمون إليك بلونك (كأهل القرى، features.js)
function freeCaptives(state, k) {
  const me = state.players[state.humanId];
  let n = 0;
  for (const u of state.units) {
    if (!u.story || u.story.role !== 'captive' || u.story.step !== k || !isAlive(u)) continue;
    u.playerId = me.id;
    u.color = me.color;
    u.homePost = null;
    u.leash = 0;
    u.story = null;
    applyUpgrades(state, u);
    n++;
  }
  if (n) state.notice = { text: 'انضم إليك ' + n + ' من الأسرى', mine: true, t: 3 };
}

// مخرج المدينة للرسول: أبعد مربع شارع موصول على الحافة عن قاعدتك
function exitPoint(state) {
  if (state.story.exitAt) return state.story.exitAt;
  const map = state.map, home = state.map.districts[state.players[state.humanId].homeDistrictId].capture;
  let best = null, bestD = -1;
  const last = map.n - 1;
  for (let a = 0; a < map.n; a++) {
    for (const [i, j] of [[a, 0], [a, last], [0, a], [last, a]]) {
      if (!map.road[map.idx(i, j)] || !map.isConnected(i, j)) continue;
      const dd = dist({ i, j }, home);
      if (dd > bestD) { bestD = dd; best = { i, j }; }
    }
  }
  state.story.exitAt = best || { i: last, j: last };
  return state.story.exitAt;
}

function stepDone(state, step) {
  const st = state.story, ms = state.modeState, me = state.humanId, pts = at(S.missionPoints, state);
  if (ms.points) { ms.points[me] += pts; ms.earned[me] += pts; }
  sound('capture_special');
  st.cur = null;
  st.nextAt = state.time + 2.5;
  const last = st.step + 1 >= st.count;
  state.notice = { text: '✓ ' + step.text + ' • +' + pts + ' نقطة' + (last ? '' : ' • المهمة التالية بعد لحظات'), mine: true, t: 3, keep: true };
}

function fail(state, reason) {
  state.story.done = true;
  finish(state, false, 'فشلت المهمة: ' + reason);
}

function completeLevel(state, L) {
  state.story.done = true;
  state.story.won = true;
  finish(state, true, L.level.result);
}

// --- الواجهة: شريط المهمة أعلى الشاشة، ونقطة المهمة على الخريطة ---
export function storyBar(state) {
  const st = state.story;
  if (!st || st.done) return null;
  const L = storyLevelOf(state.settings);
  if (!st.cur) return { text: st.step < 0 ? '📜 ' + st.title : '📜 المهمة التالية…', alarm: false };
  const step = L.level.steps[st.step], cur = st.cur, t = state.time;
  let extra = '';
  if (cur.end) extra = ' • ' + clock(Math.max(0, cur.end - t));
  if (step.type === 'gather') extra = ' • ' + (cur.count || 0) + '/' + at(S.gather.count, state);
  if (step.type === 'hold') extra = ' • ' + Math.floor(cur.since) + '/' + at(S.hold.seconds, state) + ' ث' + extra;
  if (step.type === 'escort') extra = ' • وصل ' + cur.arrived;
  return { text: '📜 ' + (st.step + 1) + '/' + st.count + ': ' + step.text + extra, alarm: !!cur.end && cur.end - t <= 20 };
}

const clock = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

// مكان المهمة الحالية على الخريطة: { i, j, r }، أو null
export function targetPoint(state, step = null) {
  const st = state.story;
  if (!st || st.done) return null;
  const L = storyLevelOf(state.settings);
  step = step || (st.cur ? L.level.steps[st.step] : null);
  if (!step) return null;
  if (step.type === 'intercept' && st.cur && st.cur.dest) return { ...st.cur.dest, r: S.runner.exitRadius };
  if (step.type === 'gather') {
    const home = state.map.districts[state.players[state.humanId].homeDistrictId].capture;
    return { i: home.i, j: home.j, r: S.gather.radius };
  }
  const d = stepDistrict(state, step);
  return d ? { i: d.capture.i, j: d.capture.j, r: step.type === 'hold' ? S.hold.radius : 2.6 } : null;
}

// إحصائيات شاشة النهاية
export function storyExtras(state) {
  const st = state.story;
  if (!st) return [];
  return [['المهام المكتملة', Math.min(st.count, Math.max(0, st.step)) + '/' + st.count]];
}
