// شاشة طور القصة (القسم 17): اختيار العصابة، ثم مراحل حملتها، ثم القصة قبل المعركة. ونتيجة المرحلة في شاشة النهاية
// (hud.js) بحوار ما بعدها ومكافأتها. التقدم (المراحل المكتملة) في localStorage، ومكافآت المراحل السابقة تُحسب منه
import { STORY, REGIONS, nations, PLAYER_COLORS } from '../config.js';
import { CAMPAIGNS } from '../story/campaigns.js';
import { storyPlayers } from '../game/story.js';
import { drawCharacters } from './charThumb.js';
import { sound } from '../audio/sound.js';

const el = (id) => document.getElementById(id);
const TYPE = { defend: 'دفاع', rescue: 'إنقاذ', destroy: 'تدمير', escort: 'حماية', capture: 'سيطرة على منطقة', storm: 'اقتحام',
               intercept: 'قتال', hold: 'سيطرة على منطقة', gather: 'تجميع', boss: 'الزعيم' };

let view = 'gangs', campaign = null, levelIndex = 0, H = null;

// handlers: start(settings) يبدأ المرحلة، وback() يعود إلى القائمة الرئيسية
export function setupStoryScreen(handlers) {
  H = handlers;
}

// --- التقدم: { حملة: [مكتملة؟ × 5] } ---
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORY.storageKey) || '{}') || {}; } catch (e) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(STORY.storageKey, JSON.stringify(p)); } catch (e) { /* تخزين معطّل */ }
}
const doneOf = (id) => (loadProgress()[id] || []).slice(0, STORY.levels);
const unlocked = (id, k) => k === 0 || !!doneOf(id)[k - 1];

// إعداد مباراة المرحلة، ومعه مكافآت ما اكتمل قبلها من الحملة نفسها
export function storySettings(id, k) {
  const camp = CAMPAIGNS[id], level = camp.levels[k], done = doneOf(id), bonus = {};
  for (let n = 0; n < k; n++) {
    if (!done[n]) continue;
    const r = camp.levels[n].reward;
    if (r.kind === 'points') bonus.points = STORY.rewards.points;
    if (r.kind === 'district') bonus.district = true;
    if (r.kind === 'hero') bonus.hero = r.hero;
    if (r.kind === 'upgrade') bonus.upgrade = STORY.rewards.upgrade;
  }
  return {
    mode: 'conquest', modeOptions: {}, city: camp.city, mapSize: STORY.mapSize[k], maxUnits: STORY.maxUnits,
    weather: level.weather || 'day', story: { campaign: id, level: k, bonus }, players: storyPlayers(id, k)
  };
}

// --- العرض ---
export function openStory(at = null) {
  if (at) { view = at.view; campaign = at.campaign || campaign; levelIndex = at.level || 0; }
  render();
}

// زر الرجوع في أندرويد: خطوة إلى الخلف داخل الشاشة، وfalse في أولها
export function storyBack() {
  if (view === 'brief') { view = 'levels'; render(); return true; }
  if (view === 'levels') { view = 'gangs'; render(); return true; }
  return false;
}

function render() {
  const body = el('storyBody');
  body.textContent = '';
  if (view === 'levels' && CAMPAIGNS[campaign]) renderLevels(body);
  else if (view === 'brief' && CAMPAIGNS[campaign]) renderBrief(body);
  else { view = 'gangs'; renderGangs(body); }
  el('screenStory').scrollTop = 0;        // كل عرض يبدأ من أعلاه
}

const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (cls, text, action) => {
  const b = node('button', cls, text);
  b.addEventListener('click', () => { sound('ui_tap'); action(); });
  return b;
};
const colorHex = (id) => (PLAYER_COLORS.find(c => c.id === id) || PLAYER_COLORS[0]).hex;

function renderGangs(body) {
  body.append(node('h2', null, 'القصة'), node('p', 'hint story-note', 'لكل عصابة حملة من خمس مراحل. اختر عصابتك.'));
  const grid = node('div', 'story-grid');
  const order = REGIONS.order.flatMap(r => REGIONS[r].nations || []);
  for (const id of order) {
    const n = nations[id], camp = CAMPAIGNS[id];
    const card = node('button', 'story-card' + (camp ? '' : ' soon'));
    const cv = node('canvas', 'story-thumb');
    card.append(cv, node('b', null, n.gangName), node('span', 'hint', n.name));
    const done = camp ? doneOf(id).filter(Boolean).length : 0;
    card.append(node('span', 'story-badge', camp ? done + '/' + STORY.levels : 'قريباً'));
    if (camp) card.addEventListener('click', () => { sound('ui_tap'); campaign = id; view = 'levels'; render(); });
    grid.append(card);
    requestAnimationFrame(() => drawCharacters(cv, id, ['champion'], colorHex(STORY.colors.you)));
  }
  body.append(grid, button('wide ghost', 'رجوع', () => H && H.back()));
}

function renderLevels(body) {
  const camp = CAMPAIGNS[campaign], n = nations[campaign], done = doneOf(campaign);
  body.append(node('h2', null, n.gangName + ' — ' + n.name), node('p', 'story-pitch', camp.pitch),
              node('p', 'hint', 'العدو: ' + camp.enemy.name));
  const list = node('div', 'story-levels');
  camp.levels.forEach((level, k) => {
    const open = unlocked(campaign, k);
    const b = node('button', 'story-level' + (done[k] ? ' done' : '') + (open ? '' : ' locked'));
    b.append(node('b', null, (done[k] ? '✓ ' : open ? '' : '🔒 ') + 'المرحلة ' + (k + 1) + ': ' + level.title),
             node('span', 'hint', 'المكافأة: ' + level.reward.text));
    if (open) b.addEventListener('click', () => { sound('ui_tap'); levelIndex = k; view = 'brief'; render(); });
    list.append(b);
  });
  body.append(list);
  if (done.filter(Boolean).length === STORY.levels) body.append(node('p', 'story-ending', 'النهاية: ' + camp.ending));
  body.append(button('wide ghost', 'رجوع', () => { view = 'gangs'; render(); }));
}

function renderBrief(body) {
  const camp = CAMPAIGNS[campaign], level = camp.levels[levelIndex];
  body.append(node('h2', null, 'المرحلة ' + (levelIndex + 1) + ': ' + level.title));
  body.append(section('القصة قبل المعركة', node('p', null, level.story)));
  body.append(dialogue(level.before));
  body.append(section('الهدف الرئيسي', node('p', null, level.goal)));
  const ol = node('ol', 'story-steps');
  for (const step of level.steps) {
    const li = node('li');
    li.append(node('b', null, step.text), node('span', 'story-type', TYPE[step.type] || ''), node('span', 'hint', step.hint));
    ol.append(li);
  }
  body.append(section('المهام', ol));
  const boss = level.steps.find(s => s.type === 'boss');
  if (boss) {
    const box = node('div');
    box.append(node('p', null, boss.boss.name + ' — ' + boss.boss.ability), node('p', 'hint', 'طريقة الهزيمة: ' + boss.boss.defeat));
    body.append(section('الزعيم', box));
  }
  body.append(section('المكافأة', node('p', null, level.reward.text)));
  const row = node('div', 'story-actions');
  row.append(button('wide gold', 'ابدأ المعركة', () => H && H.start(storySettings(campaign, levelIndex))),
             button('wide ghost', 'رجوع', () => { view = 'levels'; render(); }));
  body.append(row);
}

function section(title, content) {
  const s = node('section', 'story-section');
  s.append(node('h3', null, title), content);
  return s;
}

export function dialogue(lines) {
  const box = node('div', 'story-dialogue');
  for (const [who, text] of lines || []) {
    const p = node('p');
    p.append(node('b', null, who + ': '), document.createTextNode(text));
    box.append(p);
  }
  return box;
}

// --- نهاية المرحلة (شاشة النهاية في hud.js): تحفظ الإكمال، وتعيد نصوصها وزرها التالي ---
export function storyEnd(state) {
  const st = state.settings.story, camp = CAMPAIGNS[st.campaign], level = camp.levels[st.level];
  const won = state.matchResult && state.matchResult.won;
  if (won) {
    const p = loadProgress(), list = (p[st.campaign] || []).slice();
    list[st.level] = true;
    p[st.campaign] = list;
    saveProgress(p);
  }
  const last = st.level + 1 >= camp.levels.length;
  return {
    title: won ? 'اكتملت المرحلة ' + (st.level + 1) : 'فشلت المرحلة ' + (st.level + 1),
    lines: won ? level.after : [],
    reward: won ? 'المكافأة: ' + level.reward.text : '',
    ending: won && last ? 'النهاية: ' + camp.ending : '',
    next: won ? (last ? 'قائمة القصة' : 'المرحلة التالية') : 'إعادة المرحلة'
  };
}

// زر شاشة النهاية: المرحلة التالية بعد الفوز (أو قائمة القصة بعد آخرها)، وإعادة المرحلة بعد الخسارة.
// يعيد إعداد المباراة الجديدة، أو null للعودة إلى قائمة الحملة
export function storyAgain(state) {
  const st = state.settings.story, camp = CAMPAIGNS[st.campaign];
  const won = state.matchResult && state.matchResult.won;
  if (!won) return storySettings(st.campaign, st.level);
  if (st.level + 1 >= camp.levels.length) { campaign = st.campaign; view = 'levels'; return null; }
  return storySettings(st.campaign, st.level + 1);
}

// العودة من المباراة إلى قائمة مراحل حملتها
export function storyMenuOf(state) {
  campaign = state.settings.story.campaign;
  view = 'levels';
}
