// Neon Bay — traffic cars that follow the street grid and pedestrians who
// stroll the sidewalks and run from gunfire or a speeding car.
import { makeRng, clamp, angleDiff } from './rng.js';
import { STREETS_X, STREETS_Y, ROAD_W, WORLD_W, WORLD_H, nearestStreet, inWater, collideBuildings } from './city.js';

export const CAR_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#ecf0f1', '#1abc9c', '#8e44ad', '#e67e22', '#7f8c8d', '#27ae60', '#d4ac0d'];
const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#fd79a8', '#fdcb6e', '#00cec9'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || '#c0392b',
    hp: opts.hp ?? 100,
    police: !!opts.police,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    stolen: false,
    targetSpeed: opts.targetSpeed ?? 0,
    dir: opts.dir ?? 1, // +1 along the street, -1 against
    vertical: !!opts.vertical,
    stuck: 0,
    brakeLight: false,
  };
}

export function makeTraffic(city, seed) {
  const rng = makeRng(seed + 101);
  const cars = [];
  const peds = [];

  // Parked cars from the city's kerb spots.
  for (const s of city.parkedSpots) {
    cars.push(makeCar(s.x, s.y, s.angle, { color: rng.pick(CAR_COLORS), parked: true }));
  }
  // Moving traffic, snapped onto streets.
  for (let i = 0; i < 16; i++) {
    const vertical = rng.chance(0.5);
    const street = vertical ? rng.pick(STREETS_X) : rng.pick(STREETS_Y);
    const along = rng.range(140, 1700);
    const lane = (rng.chance(0.5) ? -1 : 1) * 16;
    const x = vertical ? street + lane : along;
    const y = vertical ? along : street + lane;
    const dir = rng.chance(0.5) ? 1 : -1;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const c = makeCar(x, y, angle, { color: rng.pick(CAR_COLORS), traffic: true, vertical, dir, targetSpeed: rng.range(70, 130) });
    c.speed = c.targetSpeed;
    cars.push(c);
  }
  // Pedestrians on sidewalks near the centre of town.
  for (let i = 0; i < 26; i++) {
    const s = nearestStreet(rng.range(200, 2300), rng.range(200, 1650));
    peds.push({
      x: s.x + rng.range(-70, 70), y: s.y + rng.range(-70, 70),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(22, 42),
      color: rng.pick(PED_COLORS), state: 'walk', fleeT: 0, pauseT: rng.range(0, 3),
      bob: rng.range(0, 6),
    });
  }

  function steerCar(c, dt) {
    // Follow the current street; at an intersection, sometimes turn.
    const ns = nearestStreet(c.x, c.y);
    const want = c.vertical
      ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (c.dir > 0 ? 0 : Math.PI);
    const atX = STREETS_X.some((s) => Math.abs(c.x - s) < 26);
    const atY = STREETS_Y.some((s) => Math.abs(c.y - s) < 26);
    if ((c.vertical && atY) || (!c.vertical && atX)) {
      if (rng.chance(dt * 0.55)) {
        c.vertical = !c.vertical;
        c.dir = rng.chance(0.5) ? 1 : -1;
      }
    }
    const diff = angleDiff(c.angle, want);
    c.angle += clamp(diff, -1.7 * dt, 1.7 * dt);
    // Ease back onto the street centre line.
    if (c.vertical) c.x += clamp(ns.x - c.x, -30 * dt, 30 * dt);
    else c.y += clamp(ns.y - c.y, -30 * dt, 30 * dt);
  }

  return {
    cars, peds,
    update(dt, player, danger) {
      // danger: {x, y, radius, kind} — gunfire or a fast car peds run from.
      for (const c of cars) {
        if (c.parked || c.police) continue;
        steerCar(c, dt);
        // Slow down for the car ahead on the same street.
        let ahead = null;
        for (const o of cars) {
          if (o === c || o.parked) continue;
          const dx = o.x - c.x, dy = o.y - c.y;
          const along = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
          const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
          if (along > 0 && along < 70 && side < 22) { ahead = o; break; }
        }
        const target = ahead ? 0 : c.targetSpeed;
        c.speed += clamp(target - c.speed, -160 * dt, 70 * dt);
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        // Wrap around the map edges so traffic never runs out.
        if (c.x < 60) c.x = WORLD_W - 80; if (c.x > WORLD_W - 60) c.x = 80;
        if (c.y < 60) c.y = WORLD_H - 80; if (c.y > WORLD_H - 60) c.y = 80;
        collideBuildings(city, c, 16);
        if (inWater(city, c.x, c.y)) { c.y = 1730; c.angle = -Math.PI / 2; }
      }
      for (const p of peds) {
        p.bob += dt * 8;
        const d2 = (p.x - danger.x) ** 2 + (p.y - danger.y) ** 2;
        if (danger.radius > 0 && d2 < danger.radius * danger.radius) {
          p.state = 'flee'; p.fleeT = 2.5;
          p.angle = Math.atan2(p.y - danger.y, p.x - danger.x);
        } else if (p.fleeT > 0) {
          p.fleeT -= dt;
          if (p.fleeT <= 0) p.state = 'walk';
        }
        if (p.state === 'walk') {
          p.pauseT -= dt;
          if (p.pauseT <= 0) {
            p.pauseT = rng.range(2, 7);
            p.angle += rng.range(-1.2, 1.2);
            if (rng.chance(0.25)) p.angle = rng.range(0, Math.PI * 2);
          }
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.y += Math.sin(p.angle) * p.speed * dt;
        } else {
          p.x += Math.cos(p.angle) * 110 * dt;
          p.y += Math.sin(p.angle) * 110 * dt;
        }
        p.x = clamp(p.x, 80, WORLD_W - 80);
        p.y = clamp(p.y, 80, 1720);
        collideBuildings(city, p, 10);
      }
    },
    // Nearest drivable car to a point (parked or traffic, not police).
    nearestCar(x, y, maxD) {
      let best = null, bd = maxD * maxD;
      for (const c of cars) {
        if (c.police) continue;
        const d2 = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d2 < bd) { bd = d2; best = c; }
      }
      return best;
    },
    removeCar(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
  };
}
