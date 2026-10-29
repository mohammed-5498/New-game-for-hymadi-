// اللمس والتحديد والأوامر (إصبع واحد، إصبعان، وعجلة الماوس)
import { CAMERA, INPUT, ALERTS, TILE_HALF_W, TILE_HALF_H, EMPIRE } from '../config.js';
import { screenToWorld, worldToTile, worldToScreen, tileToWorld } from '../map/coords.js';
import { clampCamera } from '../render/renderer.js';
import { commandMove, commandAttackMove } from '../game/units.js';
import { commandAttack, isEnemy } from '../game/combat.js';
import { selectedUnits, selectUnitsAround, clearSelection } from '../state.js';
import { sound } from '../audio/sound.js';
import { setInputMode } from './hud.js';
import { unitWorldPos } from '../render/units.js';
import { badgeOf } from '../render/empireArt.js';
import { openEmpireMenu, closeEmpireMenu, isEmpireMenuOpen } from './empireMenu.js';
import { lanCommand } from '../net/session.js';

export function setupInput(canvas, state) {
  const pointers = new Map();
  let dragStart = null;    // بداية سحب الإصبع الواحد
  let moved = false;       // هل تجاوز السحب حد اللمسة السريعة
  let pinch = null;        // حالة إصبعين
  let lastUnitTap = null;  // آخر نقرة على جندي: للكشف عن النقرة المزدوجة
  let longPressTimer = null;   // مؤقت الضغطة المطوّلة (أمر الهجوم المتحرك)
  let longPressFired = false;  // نفّذنا الأمر فلا نكرره عند رفع الإصبع
  // طور الإمبراطورية: لمستان سريعتان على مبنى تملكه (أو على حي لك بلا مبنى) تفتحان قائمته
  let lastDistrictTap = null;  // { id, time }

  const pointFromEvent = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function onDown(id, p) {
    pointers.set(id, p);
    state.cameraTween = null;          // لمس الخريطة يوقف انتقال الكاميرا إلى مجموعة
    if (pointers.size === 1) {
      dragStart = { x: p.x, y: p.y, camX: state.camera.x, camY: state.camera.y };
      moved = false;
      state.selectionBox = null;
      startLongPress(p);
    } else if (pointers.size === 2) {
      cancelLongPress();
      const v = [...pointers.values()];
      pinch = {
        d: Math.max(1, Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y)),
        z: state.camera.z,
        mx: (v[0].x + v[1].x) / 2,
        my: (v[0].y + v[1].y) / 2
      };
      state.selectionBox = null;
      dragStart = null;
    }
  }

  function onMove(id, p) {
    if (!pointers.has(id)) return;
    pointers.set(id, p);

    // إصبعان: تكبير وتصغير حول منتصف الإصبعين مع تحريك الكاميرا
    if (pointers.size >= 2 && pinch) {
      const v = [...pointers.values()];
      const d = Math.max(1, Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y));
      const mx = (v[0].x + v[1].x) / 2, my = (v[0].y + v[1].y) / 2;
      const anchor = screenToWorld(pinch.mx, pinch.my, state.camera, state.view);

      state.camera.z = Math.max(CAMERA.minZoom, Math.min(CAMERA.maxZoom, pinch.z * d / pinch.d));
      state.camera.x = anchor.x - (mx - state.view.w / 2) / state.camera.z;
      state.camera.y = anchor.y - (my - state.view.h / 2) / state.camera.z;
      clampCamera(state);

      pinch.mx = mx; pinch.my = my; pinch.z = state.camera.z; pinch.d = d;
      return;
    }

    if (!dragStart) return;
    const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
    if (Math.hypot(dx, dy) > INPUT.tapMovePx) { moved = true; cancelLongPress(); }
    if (!moved) return;

    if (state.inputMode === 'pan') {
      state.camera.x = dragStart.camX - dx / state.camera.z;
      state.camera.y = dragStart.camY - dy / state.camera.z;
      clampCamera(state);
    } else {
      state.selectionBox = { x0: dragStart.x, y0: dragStart.y, x1: p.x, y1: p.y };
    }
  }

  function onUp(id) {
    if (!pointers.has(id)) return;
    const p = pointers.get(id);
    pointers.delete(id);
    cancelLongPress();

    if (pinch) {
      if (pointers.size < 2) pinch = null;
      dragStart = null;
      return;
    }

    if (pointers.size === 0) {
      if (longPressFired) {
        longPressFired = false;          // الأمر نُفّذ أثناء الضغط، فلا لمسة إضافية
      } else if (dragStart && !moved) {
        handleTap(p.x, p.y);
      } else if (state.selectionBox) {
        applySelectionBox();
      }
      state.selectionBox = null;
      dragStart = null;
    }
  }

  // --- الضغطة المطوّلة على الأرض: أمر هجوم متحرك ---
  function startLongPress(p) {
    cancelLongPress();
    longPressFired = false;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (moved || pointers.size !== 1) return;

      // الاقتصاد (بطلب المستخدم): ضغطة مطوّلة على مبناك أو أي حي لك تفتح قائمته، ولو كان معك جنود محددون
      if (state.economy) {
        const target = ownBuildingAt(p.x, p.y) || ownAreaAt(p.x, p.y);
        if (target) {
          longPressFired = true;
          lastDistrictTap = null;
          clearSelection(state);
          sound('ui_tap');
          openEmpireMenu(state, target.id);
          return;
        }
      }

      const group = selectedUnits(state);
      if (!group.length) return;
      if (findUnitAt(p.x, p.y)) return;          // الضغط على وحدة ليس أمر أرض

      const world = screenToWorld(p.x, p.y, state.camera, state.view);
      const tile = worldToTile(world.x, world.y);
      if (order('amove', group, tile)) { longPressFired = true; sound('command'); }
    }, INPUT.longPressMs);
  }

  // أوامر الحركة والهجوم. في اللعب المحلي (القسم 16) تُرسل أمراً ينفذه كل جهاز في نفس التحديث،
  // وحلقة مكان الأمر تظهر هنا فوراً
  function order(kind, group, tile, target) {
    if (!state.lanRole) {
      if (kind === 'attack') { commandAttack(state, group, target); return true; }
      return kind === 'move' ? commandMove(state, tile.i, tile.j, group) : commandAttackMove(state, tile.i, tile.j, group);
    }
    const u = group.map(unit => unit.id);
    if (kind === 'attack') { lanCommand({ k: 'attack', u, t: target.id }); return true; }
    const n = state.map.n;
    const i = Math.max(0, Math.min(n - 1, Math.round(tile.i))), j = Math.max(0, Math.min(n - 1, Math.round(tile.j)));
    lanCommand({ k: kind, u, i, j });
    state.moveMarker = { i, j, t: 0, attack: kind === 'amove' };
    return true;
  }

  function cancelLongPress() {
    if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  // هل هذه النقرة هي الثانية على نفس الجندي؟
  // نتسامح في المكان لأن الإصبع نادراً ما يصيب الجندي الصغير مرتين بدقة
  function isSecondTapOn(unit, sx, sy) {
    if (!lastUnitTap || lastUnitTap.unit !== unit) return false;
    if (performance.now() - lastUnitTap.time > INPUT.doubleTapMs) return false;
    const world = unitWorldPos(unit, 1);
    const screen = worldToScreen(world.x, world.y, state.camera, state.view);
    return Math.hypot(screen.x - sx, screen.y - sy) <= INPUT.doubleTapSlackPx;
  }

  // لمسة سريعة: على وحدتك تحددها، وعلى عدو أمر هجوم، وعلى الأرض أمر حركة
  function handleTap(sx, sy) {
    // سهم التنبيه أولاً: لمسته تنقل الكاميرا إلى مكان الاشتباك (القسم 12.3)
    if (tapAlertArrow(sx, sy)) return;

    const group = selectedUnits(state);
    const hit = findUnitAt(sx, sy);

    // الاقتصاد: اللمسة الثانية السريعة على مبناك تفتح قائمته وتلغي تحديد الجنود (بقرار المستخدم)،
    // واللمسة على الخريطة تغلق المفتوحة. وأوامر الحركة فورية
    if (state.economy) {
      const target = hit && hit.playerId === state.humanId ? null : menuDistrictAt(sx, sy);
      const now = performance.now();
      if (target && lastDistrictTap && lastDistrictTap.id === target.id && now - lastDistrictTap.time <= INPUT.doubleTapMs) {
        lastDistrictTap = null;
        lastUnitTap = null;
        clearSelection(state);
        sound('ui_tap');
        openEmpireMenu(state, target.id);
        return;
      }
      lastDistrictTap = target ? { id: target.id, time: now } : null;
      if (isEmpireMenuOpen()) {
        closeEmpireMenu(state);
        return;                          // لمسة الإغلاق لا تصدر أمراً
      }
    }

    // نقرة ثانية قرب الجندي نفسه حتى لو لم تصبه بدقة: تحديد المجموعة
    const doubleTarget = lastUnitTap && isSecondTapOn(lastUnitTap.unit, sx, sy)
      ? lastUnitTap.unit : null;

    if (doubleTarget) {
      selectUnitsAround(state, doubleTarget, INPUT.groupSelectRadiusTiles);
      lastUnitTap = null;               // لا تُحسب نقرة ثالثة تحديداً جديداً
      afterSuccessfulSelection();
      return;
    }

    // اللمس على جندي من جنودك: تحديد فردي (ولا يصدر أي أمر حركة)
    if (hit && hit.playerId === state.humanId) {
      for (const unit of state.units) unit.selected = false;
      hit.selected = true;
      lastUnitTap = { unit: hit, time: performance.now() };
      afterSuccessfulSelection();
      return;
    }

    lastUnitTap = null;
    if (!group.length) return;

    if (hit && isEnemy(state, group[0], hit)) {
      order('attack', group, null, hit);
      sound('command');
      return;
    }

    const world = screenToWorld(sx, sy, state.camera, state.view);
    const tile = worldToTile(world.x, world.y);
    if (order('move', group, tile)) sound('command');
  }

  // ما تفتح لمستاه قائمة (طور الإمبراطورية): مبنى تملكه، أو حي تملكه بلا مبنى. أرض حي فيه مبنى للحركة فقط
  function menuDistrictAt(sx, sy) {
    const building = ownBuildingAt(sx, sy);
    if (building) return building;
    const area = ownAreaAt(sx, sy);
    return area && !area.building ? area : null;
  }

  // مبنى تملكه تحت الإصبع: صورته كلها مع شارتها فوقها (فهي أعلى من مربعها)، والقاعدة بقلعتها كلها
  function ownBuildingAt(sx, sy) {
    const z = state.camera.z;
    for (const d of state.map.districts) {
      if (d.owner !== state.humanId || !d.building || d.buildTile === undefined) continue;
      const b = badgeOf(state, d), wide = d.building === 'hq' ? EMPIRE.menu.hqTapBox : 1;
      const base = worldToScreen(b.x, b.y, state.camera, state.view);
      const top = base.y - (b.y - b.cy + b.r) * z;
      if (Math.abs(sx - base.x) <= TILE_HALF_W * wide * z && sy >= top && sy <= base.y + TILE_HALF_H * wide * z) return d;
    }
    return null;
  }

  // حي تملكه تحت الإصبع: مربعاته والشوارع الأقرب إليه (map.areaAt)
  function ownAreaAt(sx, sy) {
    const map = state.map;
    const world = screenToWorld(sx, sy, state.camera, state.view);
    const tile = worldToTile(world.x, world.y);
    const i = Math.round(tile.i), j = Math.round(tile.j);
    if (i < 0 || j < 0 || i >= map.n || j >= map.n || !map.areaAt) return null;
    const d = map.districts[map.areaAt[j * map.n + i]];
    return d && d.owner === state.humanId ? d : null;
  }

  // لمسة على سهم الحافة: تنقل الكاميرا إلى مكان الحدث ويختفي السهم
  function tapAlertArrow(sx, sy) {
    for (const alert of state.alerts) {
      if (!alert.screen) continue;
      if (Math.hypot(alert.screen.x - sx, alert.screen.y - sy) > ALERTS.tapRadiusPx) continue;

      const world = tileToWorld(alert.i, alert.j);
      state.camera.x = world.x;
      state.camera.y = world.y;
      clampCamera(state);
      state.alerts = state.alerts.filter(a => a !== alert);
      sound('ui_tap');
      return true;
    }
    return false;
  }

  // بعد أي تحديد ناجح نرجع تلقائياً لوضع تحريك الخريطة
  function afterSuccessfulSelection() {
    sound('select');
    if (state.inputMode === 'select') setInputMode(state, 'pan');
  }

  function findUnitAt(sx, sy) {
    let best = null, bestDist = INPUT.unitTapRadiusPx;
    for (const unit of state.units) {
      if (unit.state === 'dead') continue;
      const world = unitWorldPos(unit, 1);
      const screen = worldToScreen(world.x, world.y, state.camera, state.view);
      // نصوّب على جسم الوحدة لا على قدميها
      const dist = Math.hypot(screen.x - sx, (screen.y - 5 * state.camera.z) - sy);
      if (dist < bestDist) { bestDist = dist; best = unit; }
    }
    return best;
  }

  function applySelectionBox() {
    const sel = state.selectionBox;
    const x0 = Math.min(sel.x0, sel.x1), x1 = Math.max(sel.x0, sel.x1);
    const y0 = Math.min(sel.y0, sel.y1), y1 = Math.max(sel.y0, sel.y1);
    let selected = 0;

    for (const unit of state.units) {
      if (unit.playerId !== state.humanId || unit.state === 'dead') { unit.selected = false; continue; }
      const world = unitWorldPos(unit, 1);
      const screen = worldToScreen(world.x, world.y, state.camera, state.view);
      unit.selected = screen.x >= x0 && screen.x <= x1 && screen.y >= y0 && screen.y <= y1 + 5;
      if (unit.selected) selected++;
    }

    // مربع فارغ يبقيك في وضع التحديد لتعيد المحاولة
    if (selected > 0) afterSuccessfulSelection();
  }

  // أحداث المؤشر (ومع المتصفحات القديمة أحداث اللمس)
  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      onDown(e.pointerId, pointFromEvent(e));
    });
    canvas.addEventListener('pointermove', e => { e.preventDefault(); onMove(e.pointerId, pointFromEvent(e)); });
    canvas.addEventListener('pointerup', e => onUp(e.pointerId));
    canvas.addEventListener('pointercancel', e => onUp(e.pointerId));
  } else {
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) onDown(t.identifier, pointFromEvent(t));
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) onMove(t.identifier, pointFromEvent(t));
    }, { passive: false });
    const end = e => { e.preventDefault(); for (const t of e.changedTouches) onUp(t.identifier); };
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
  }

  // عجلة الماوس على الكمبيوتر
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const p = pointFromEvent(e);
    const anchor = screenToWorld(p.x, p.y, state.camera, state.view);
    state.camera.z *= e.deltaY < 0 ? CAMERA.wheelStep : 1 / CAMERA.wheelStep;
    clampCamera(state);
    state.camera.x = anchor.x - (p.x - state.view.w / 2) / state.camera.z;
    state.camera.y = anchor.y - (p.y - state.view.h / 2) / state.camera.z;
    clampCamera(state);
  }, { passive: false });

  // منع قائمة الضغط المطول على الجوال
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
