// Combat: hitscan shooting with tracers, melee punches, enemy gunmen, and
// the player's health/ammo economy.
import { sound } from './audio.js';
import { raiseWanted } from './police.js';

export function shootAt(state, wx, wy) {
  const p = state.player;
  if (state.playerCar) { /* drive-by: fire from the car window */ }
  if (p.ammo <= 0) { sound.click(); state.message = 'OUT OF AMMO — press R to reload'; state.messageTimer = 1.5; return; }
  if (p.shootCooldown > 0) return;
  p.shootCooldown = 0.22;
  p.ammo -= 1;
  state.shotsFiredAt = 2; // pedestrians hear it and run
  const ox = state.playerCar ? state.playerCar.x : p.x;
  const oy = state.playerCar ? state.playerCar.y : p.y;
  const angle = Math.atan2(wy - oy, wx - ox);
  const range = 460;
  const ex = ox + Math.cos(angle) * range, ey = oy + Math.sin(angle) * range;
  state.tracers.push({ x1: ox, y1: oy, x2: ex, y2: ey, life: 0.08 });
  state.effects.muzzle(ox, oy, angle);
  sound.shot();
  state.effects.addShake(1.5);
  // Nearest target along the shot line takes the hit.
  let best = null, bestD = range;
  const consider = (x, y, r, ref) => {
    const dx = x - ox, dy = y - oy;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > bestD) return;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < r + 6) { bestD = along; best = ref; }
  };
  for (const e of state.enemies) if (e.hp > 0) consider(e.x, e.y, 14, { type: 'enemy', ref: e });
  for (const ped of state.peds) if (ped.hp > 0) consider(ped.x, ped.y, 11, { type: 'ped', ref: ped });
  for (const car of state.cars) {
    if (car === state.playerCar) continue;
    consider(car.x, car.y, 22, { type: 'car', ref: car });
  }
  if (!best) return;
  state.tracers[state.tracers.length - 1].x2 = ox + Math.cos(angle) * bestD;
  state.tracers[state.tracers.length - 1].y2 = oy + Math.sin(angle) * bestD;
  if (best.type === 'enemy') {
    best.ref.hp -= 34;
    state.effects.blood(best.ref.x, best.ref.y);
    if (best.ref.hp <= 0) {
      state.effects.burst(best.ref.x, best.ref.y, '#c0392b', 14, 160);
      state.money += 60; state.stats.kills += 1;
      state.effects.addText(best.ref.x, best.ref.y, '+$60', '#2ecc71');
      raiseWanted(state, 1, 'a body hit the pavement');
    }
  } else if (best.type === 'ped') {
    best.ref.hp = 0; state.effects.blood(best.ref.x, best.ref.y);
    raiseWanted(state, 1, 'shot a civilian');
  } else if (best.type === 'car') {
    best.ref.hp -= 30;
    state.effects.burst(best.ref.x, best.ref.y, '#f1c40f', 8, 120);
    if (best.ref.kind === 'police') raiseWanted(state, 1, 'shot at the police');
    else if (best.ref.hp <= 0) { best.ref.hp = 0; state.effects.burst(best.ref.x, best.ref.y, '#e67e22', 20, 200); }
  }
}

export function punch(state) {
  const p = state.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.4;
  sound.punch();
  const reach = 40;
  const fx = p.x + Math.cos(p.angle) * reach, fy = p.y + Math.sin(p.angle) * reach;
  for (const e of state.enemies) {
    if (e.hp > 0 && Math.hypot(e.x - fx, e.y - fy) < 30) {
      e.hp -= 25; state.effects.blood(e.x, e.y);
      if (e.hp <= 0) { state.money += 60; state.stats.kills += 1; }
    }
  }
  for (const ped of state.peds) {
    if (ped.hp > 0 && Math.hypot(ped.x - fx, ped.y - fy) < 26) { ped.hp = 0; raiseWanted(state, 1, 'beat up a civilian'); }
  }
}

export function spawnEnemies(state, x, y, count) {
  for (let i = 0; i < count; i++) {
    state.enemies.push({
      x: x + (Math.random() - 0.5) * 160, y: y + (Math.random() - 0.5) * 160,
      angle: 0, hp: 100, cooldown: 1 + Math.random(), r: 13, color: '#8e44ad', speed: 95,
    });
  }
  state.message = `${count} of Kaine's crew — take them down!`;
  state.messageTimer = 3;
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 260) { e.x += Math.cos(e.angle) * e.speed * dt; e.y += Math.sin(e.angle) * e.speed * dt; }
    else if (d < 120) { e.x -= Math.cos(e.angle) * e.speed * 0.5 * dt; e.y -= Math.sin(e.angle) * e.speed * 0.5 * dt; }
    e.cooldown -= dt;
    if (e.cooldown <= 0 && d < 420 && !state.playerCar) {
      e.cooldown = 1.3 + Math.random() * 0.7;
      const spread = (Math.random() - 0.5) * 0.25;
      const a = e.angle + spread;
      state.tracers.push({ x1: e.x, y1: e.y, x2: p.x + Math.cos(a) * 30, y2: p.y + Math.sin(a) * 30, life: 0.08 });
      sound.shot();
      if (Math.random() < 0.55) {
        p.hp -= 7 + Math.random() * 5;
        state.effects.blood(p.x, p.y); state.effects.addShake(3);
      }
    }
  }
  // The dead are gone the moment they fall (the burst already showed it).
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}

export function reloadPlayer(state) {
  const p = state.player;
  if (p.ammo >= 12 || p.reloadTimer > 0) return;
  p.reloadTimer = 0.9;
  state.message = 'Reloading…'; state.messageTimer = 1;
}
