// Traffic cars that follow the road grid and pedestrians who walk the
// sidewalks — and run when things get loud.
import { ROADS_V, ROADS_H, ROAD_HALF, isOnRoad, pointInBuilding } from './city.js';
import { makeRng } from './rng.js';

const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22', '#8e44ad', '#16a085', '#bdc3c7'];
const PED_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#fd79a8', '#636e72'];

export function makeTrafficCar(rng, x, y, angle) {
  return {
    kind: 'traffic', x, y, angle, speed: 0, r: 20,
    color: rng.pick(CAR_COLORS), targetSpeed: rng.range(120, 190),
    street: Math.abs(Math.cos(angle)) > 0.5 ? 'h' : 'v',
    dir: (Math.abs(Math.cos(angle)) > 0.5 ? Math.sign(Math.cos(angle)) : Math.sign(Math.sin(angle))) || 1,
    lane: rng.chance(0.5) ? 24 : -24, hp: 100, smoke: 0,
  };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    let x, y, angle;
    if (vertical) {
      x = rng.pick(ROADS_V) + (rng.chance(0.5) ? 24 : -24);
      y = rng.range(100, 1820);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = rng.pick(ROADS_H) + (rng.chance(0.5) ? 24 : -24);
      x = rng.range(100, 2200);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    cars.push(makeTrafficCar(rng, x, y, angle));
  }
  return cars;
}

export function spawnParkedCars(city, rng) {
  return city.parkedSpots.slice(0, 26).map((s) => ({
    kind: 'parked', x: s.x, y: s.y, angle: s.angle, speed: 0, r: 20,
    color: rng.pick(CAR_COLORS), hp: 100, smoke: 0, targetSpeed: 0,
  }));
}

export function spawnPedestrians(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(120, 2250), y = rng.range(120, 1800);
    if (pointInBuilding(x, y, city) || isOnRoad(x, y)) { i--; continue; }
    peds.push({
      x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55), r: 11,
      color: rng.pick(PED_COLORS), tx: x, ty: y, flee: false, hp: 40, panic: 0,
    });
  }
  return peds;
}

function nearestCrossing(x, y) {
  // Distance along the car's current street to the next intersection.
  let best = Infinity;
  for (const ry of ROADS_H) best = Math.min(best, Math.abs(y - ry));
  for (const rx of ROADS_V) best = Math.min(best, Math.abs(x - rx));
  return best;
}

export function updateTraffic(state, dt) {
  const { cars, city, player } = state;
  for (const car of cars) {
    if (car.kind === 'parked') continue;
    if (car === state.playerCar) continue;
    // Slow down for the car ahead so traffic doesn't pile through itself.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.kind === 'parked' && other !== state.playerCar) {
        const dx = other.x - car.x, dy = other.y - car.y;
        const d = Math.hypot(dx, dy);
        if (d < 64 && d > 1) {
          const dot = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / d;
          if (dot > 0.6) { blocked = true; break; }
        }
      }
    }
    const want = blocked ? 0 : car.targetSpeed;
    car.speed += Math.sign(want - car.speed) * 160 * dt;
    if (car.speed < 0) car.speed = 0;
    // Maybe turn at an intersection.
    if (nearestCrossing(car.x, car.y) < 26 && Math.random() < dt * 1.4) {
      if (car.street === 'v') {
        const ry = ROADS_H.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
        if (Math.abs(car.y - ry) < 30) {
          car.street = 'h'; car.dir = Math.random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? 0 : Math.PI;
          car.y = ry + car.lane; car.x = Math.max(80, Math.min(2240, car.x));
        }
      } else {
        const rx = ROADS_V.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
        if (Math.abs(car.x - rx) < 30) {
          car.street = 'v'; car.dir = Math.random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.x = rx + car.lane; car.y = Math.max(80, Math.min(1840, car.y));
        }
      }
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 60 || car.x > 2260 || car.y < 60 || car.y > 1860) {
      // Wrap around the far side so the streets never empty out.
      car.x = Math.max(60, Math.min(2260, car.x));
      car.y = Math.max(60, Math.min(1860, car.y));
      car.angle += Math.PI; car.dir *= -1;
    }
    if (car.hp < 40 && Math.random() < dt * 2) state.effects.smoke(car.x, car.y);
  }
  // Player's car ramming traffic: shove the other car and damage both.
  if (state.playerCar && state.playerCar.speed > 120) {
    for (const car of cars) {
      if (car === state.playerCar || car.kind === 'parked') continue;
      const d = Math.hypot(car.x - state.playerCar.x, car.y - state.playerCar.y);
      if (d < 44) {
        car.hp -= 18; car.speed = Math.max(0, car.speed - 60);
        state.playerCar.hp -= 4;
        state.effects.burst(car.x, car.y, '#f1c40f', 6, 140);
        state.effects.addShake(4);
      }
    }
  }
}

export function updatePedestrians(state, dt) {
  const rng = state.rng;
  for (const ped of state.peds) {
    const dx = state.player.x - ped.x, dy = state.player.y - ped.y;
    const d = Math.hypot(dx, dy);
    const danger = state.shotsFiredAt > 0 && d < 260;
    if (danger || (state.playerCar && Math.hypot(state.playerCar.x - ped.x, state.playerCar.y - ped.y) < 120)) {
      ped.flee = true; ped.panic = 2.5;
    }
    if (ped.panic > 0) ped.panic -= dt; else ped.flee = false;
    let tx = ped.tx, ty = ped.ty, speed = ped.speed;
    if (ped.flee) {
      tx = ped.x - dx; ty = ped.y - dy; speed = 150;
    } else if (Math.hypot(tx - ped.x, ty - ped.y) < 24 || Math.random() < dt * 0.02) {
      // Pick a new stroll target on a sidewalk near a road.
      const road = rng.chance(0.5);
      if (road) { tx = rng.pick(ROADS_V) + rng.range(52, 70) * (rng.chance(0.5) ? 1 : -1); ty = rng.range(100, 1800); }
      else { ty = rng.pick(ROADS_H) + rng.range(52, 70) * (rng.chance(0.5) ? 1 : -1); tx = rng.range(100, 2200); }
      ped.tx = tx; ped.ty = ty;
    }
    const mx = tx - ped.x, my = ty - ped.y, md = Math.hypot(mx, my);
    if (md > 4) {
      ped.angle = Math.atan2(my, mx);
      ped.x += (mx / md) * speed * dt;
      ped.y += (my / md) * speed * dt;
    }
    // Keep pedestrians out of buildings and the sea.
    if (pointInBuilding(ped.x, ped.y, state.city)) { ped.tx = ped.x + 80; ped.ty = ped.y; }
    ped.x = Math.max(30, Math.min(2320, ped.x));
    ped.y = Math.max(30, Math.min(1890, ped.y));
  }
  // Car hits a pedestrian: they go down, the law notices.
  if (state.playerCar && state.playerCar.speed > 60) {
    for (const ped of state.peds) {
      const d = Math.hypot(ped.x - state.playerCar.x, ped.y - state.playerCar.y);
      if (d < 30 && ped.hp > 0) {
        ped.hp = 0; state.effects.blood(ped.x, ped.y);
        state.stats.pedsHit += 1;
        state.effects.addText(ped.x, ped.y, 'PEDESTRIAN DOWN', '#e74c3c');
        raiseWanted(state, 1, 'hit a pedestrian');
      }
    }
  }
  state.peds = state.peds.filter((p) => p.hp > 0); // downed pedestrians are cleared; the crowd refills below
  if (state.peds.length < 22 && Math.random() < dt * 0.2) {
    const fresh = spawnPedestrians(state.city, state.rng, 1);
    state.peds.push(...fresh);
  }
}

// Imported lazily here to avoid a cycle: police.js never imports traffic.js.
import { raiseWanted } from './police.js';
