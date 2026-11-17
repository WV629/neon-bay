// Neon Bay city generation: a road grid, building blocks, parks, a beach and
// the waterfront, plus every named place the story uses. All positions come
// from the seeded RNG, so the city is identical for a given seed.
import { makeRng } from './rng.js';

export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROADS_V = [240, 560, 880, 1200, 1520, 1840, 2160];
export const ROADS_H = [200, 440, 680, 920, 1160, 1400, 1640];
export const ROAD_HALF = 42;

const PALETTE = ['#5b6b8c', '#7a5b6e', '#4f7a6a', '#8c6b4f', '#6b5b8c', '#54677f', '#7f6b54', '#5f7f8c'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  for (let vi = 0; vi < ROADS_V.length - 1; vi++) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi++) {
      const x0 = ROADS_V[vi] + 56, x1 = ROADS_V[vi + 1] - 56;
      const y0 = ROADS_H[hi] + 56, y1 = ROADS_H[hi + 1] - 56;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (cx > 2200) continue; // beach strip, no buildings
      if (Math.abs(cx - 1200) < 200 && Math.abs(cy - 920) < 140) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; } // Bay Square
      if (rng.chance(0.13)) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      const w = (x1 - x0) * rng.range(0.55, 0.82);
      const h = (y1 - y0) * rng.range(0.55, 0.82);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: rng.pick(PALETTE), roof: rng.pick(['#2e3440', '#3d4454', '#4a3a32']),
        tall: rng.chance(0.3), name: '',
      });
    }
  }
  // Named places sit on roads/plazas so the player can always reach them.
  const spots = {
    spawn: { x: 560, y: 860, name: 'Safehouse' },
    safehouse: { x: 600, y: 880, name: 'Safehouse — Rook\'s flat' },
    docks: { x: 300, y: 1520, name: 'The Docks' },
    club: { x: 1520, y: 700, name: 'Club Neon Reef' },
    warehouse: { x: 2000, y: 1520, name: 'Kaine Warehouse' },
    bank: { x: 1200, y: 470, name: 'Bayfront Bank' },
    hospital: { x: 880, y: 1160, name: 'St. Marina Hospital' },
    square: { x: 1200, y: 920, name: 'Bay Square' },
    beach: { x: 2280, y: 920, name: 'Neon Beach' },
  };
  const parkedSpots = [];
  for (let i = 0; i < 46; i++) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      const x = rng.pick(ROADS_V) + (rng.chance(0.5) ? 26 : -26);
      const y = rng.range(120, WORLD_H - 120);
      parkedSpots.push({ x, y, angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 });
    } else {
      const y = rng.pick(ROADS_H) + (rng.chance(0.5) ? 26 : -26);
      const x = rng.range(120, WORLD_W - 220);
      parkedSpots.push({ x, y, angle: rng.chance(0.5) ? 0 : Math.PI });
    }
  }
  return { seed, buildings, parks, spots, parkedSpots, rng };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_HALF + 8) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_HALF + 8) return true;
  return false;
}

// Nearest point on a road centreline — used to spawn police on the street.
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

// Push a circle (player, ped, car) out of every building it overlaps.
export function pushOutOfBuildings(ent, city) {
  const r = ent.r || 14;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
    const dx = ent.x - cx, dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        ent.x = cx + (dx / d) * r; ent.y = cy + (dy / d) * r;
      } else {
        ent.y = b.y - r; // centred inside: push up out
      }
      ent.hitBuilding = true;
    }
  }
  // The sea is a wall: nobody drives into the bay.
  if (ent.x > WORLD_W - 120) { ent.x = WORLD_W - 120; ent.hitBuilding = true; }
  if (ent.x < 20) { ent.x = 20; ent.hitBuilding = true; }
  if (ent.y < 20) { ent.y = 20; ent.hitBuilding = true; }
  if (ent.y > WORLD_H - 20) { ent.y = WORLD_H - 20; ent.hitBuilding = true; }
}

export function pointInBuilding(x, y, city) {
  for (const b of city.buildings) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  return false;
}
