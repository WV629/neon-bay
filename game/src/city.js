// Neon Bay — the city itself. A seeded 2560x1920 island grid: streets,
// blocks of buildings, two parks, a beach and a bay along the south edge,
// and the named places the story uses. Everything here is pure data;
// rendering and collision both read these tables.
import { makeRng, hash2 } from './rng.js';

export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROAD_W = 64;

// Street centre lines. Blocks sit between them.
export const STREETS_X = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const STREETS_Y = [160, 480, 800, 1120, 1440, 1760];

export const PLACES = {
  safehouse:  { name: 'Safehouse',        x: 300,  y: 300,  label: 'SAFEHOUSE' },
  docks:      { name: 'The Docks',        x: 2140, y: 1690, label: 'THE DOCKS' },
  club:       { name: 'Club Neon Reef',   x: 800,  y: 480,  label: 'CLUB NEON REEF' },
  warehouse:  { name: 'Kaine Warehouse',  x: 1820, y: 1180, label: 'KAINE WAREHOUSE' },
  bank:       { name: 'Bayfront Bank',    x: 1120, y: 800,  label: 'BAYFRONT BANK' },
  hospital:   { name: 'St. Marina Hospital', x: 480, y: 1440, label: 'ST. MARINA HOSPITAL' },
  square:     { name: 'Bay Square',       x: 1280, y: 960,  label: 'BAY SQUARE' },
  beach:      { name: 'Neon Beach',       x: 1280, y: 1830, label: 'NEON BEACH' },
};

const PALETTES = [
  ['#3a4a6b', '#4a5a7d', '#2e3d5c'],
  ['#6b4a5e', '#7d5a6e', '#54404e'],
  ['#4a6b52', '#5a7d63', '#3d5c46'],
  ['#6b5a3a', '#7d6c4a', '#54452e'],
  ['#54486b', '#655a7d', '#453d5c'],
];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const lamps = [];

  // Beach + bay along the south edge.
  const bay = { x: 0, y: 1808, w: WORLD_W, h: WORLD_H - 1808 };
  const beach = { x: 0, y: 1744, w: WORLD_W, h: 64 };

  // Two parks: Bay Square in the middle, Marina Green in the south-west.
  parks.push({ x: 1184, y: 864, w: 192, h: 192, name: 'Bay Square' });
  parks.push({ x: 352, y: 1504, w: 192, h: 176, name: 'Marina Green' });

  // Buildings fill each block between streets. A block is skipped when a
  // park or a named place sits on it, and sometimes split into two towers.
  const isPark = (x, y, w, h) => parks.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);
  const nearPlace = (cx, cy) => Object.values(PLACES).some((p) => Math.abs(p.x - cx) < 150 && Math.abs(p.y - cy) < 150);

  let id = 0;
  for (let ix = 0; ix < STREETS_X.length - 1; ix++) {
    for (let iy = 0; iy < STREETS_Y.length - 1; iy++) {
      const bx = STREETS_X[ix] + ROAD_W / 2 + 14;
      const by = STREETS_Y[iy] + ROAD_W / 2 + 14;
      const bw = STREETS_X[ix + 1] - STREETS_X[ix] - ROAD_W - 28;
      const bh = STREETS_Y[iy + 1] - STREETS_Y[iy] - ROAD_W - 28;
      if (by + bh > 1730) continue; // beach strip stays open
      if (isPark(bx, by, bw, bh)) continue;
      if (nearPlace(bx + bw / 2, by + bh / 2)) continue;
      const pal = rng.pick(PALETTES);
      const tall = rng.chance(0.3);
      const split = rng.chance(0.45) && bw > 170;
      const mk = (x, y, w, h) => {
        buildings.push({
          id: id++, x, y, w, h,
          color: rng.pick(pal),
          roof: rng.pick(['#232c3f', '#2c2430', '#1f2c26', '#33291f']),
          hgt: tall ? rng.int(3, 6) : rng.int(1, 3),
          neon: rng.chance(0.35),
          neonColor: rng.pick(['#ff2e88', '#22d3ee', '#facc15', '#a3e635', '#c084fc']),
          seed: rng.int(1, 99999),
        });
      };
      if (split) {
        const cut = bw * rng.range(0.42, 0.58);
        mk(bx, by, cut - 8, bh);
        mk(bx + cut + 8, by, bw - cut - 8, bh);
      } else {
        mk(bx, by, bw, bh);
      }
    }
  }

  // Named-place buildings: solid landmarks with their own colours.
  const landmark = (place, w, h, color, neonColor) => {
    buildings.push({
      id: id++, x: place.x - w / 2, y: place.y - h / 2, w, h,
      color, roof: '#1c2433', hgt: 2, neon: true, neonColor,
      seed: 777, landmark: place.name,
    });
  };
  landmark(PLACES.bank, 150, 110, '#7d6c2e', '#facc15');
  landmark(PLACES.club, 170, 120, '#5e2a4d', '#ff2e88');
  landmark(PLACES.warehouse, 200, 130, '#4d4436', '#fb923c');
  landmark(PLACES.hospital, 180, 130, '#dfe7ea', '#22d3ee');
  landmark(PLACES.safehouse, 110, 90, '#3f5a44', '#a3e635');
  // The Docks is a pier building on the beach, not a solid block.
  buildings.push({
    id: id++, x: PLACES.docks.x - 90, y: PLACES.docks.y - 46, w: 180, h: 92,
    color: '#5a4632', roof: '#33291f', hgt: 1, neon: true, neonColor: '#fb923c',
    seed: 778, landmark: 'The Docks',
  });

  // Trees in parks and along sidewalks; lamps at intersections.
  for (const p of parks) {
    for (let i = 0; i < 14; i++) {
      trees.push({ x: p.x + 14 + rng.range(0, p.w - 28), y: p.y + 14 + rng.range(0, p.h - 28), r: rng.range(9, 15) });
    }
  }
  for (let i = 0; i < 90; i++) {
    const sx = rng.pick(STREETS_X), sy = rng.range(120, 1720);
    trees.push({ x: sx + (rng.chance(0.5) ? -52 : 52), y: sy, r: rng.range(8, 12) });
  }
  for (const sx of STREETS_X) for (const sy of STREETS_Y) {
    lamps.push({ x: sx + ROAD_W / 2 + 6, y: sy + ROAD_W / 2 + 6 });
  }

  // Parked cars dotted along the kerbs, seeded so shots are stable.
  const parkedSpots = [];
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const sx = rng.pick(STREETS_X), sy = rng.pick(STREETS_Y);
    if (vertical) {
      parkedSpots.push({ x: sx - ROAD_W / 2 - 14, y: sy + rng.range(-140, 140), angle: Math.PI / 2 });
    } else {
      parkedSpots.push({ x: sx + rng.range(-140, 140), y: sy - ROAD_W / 2 - 14, angle: 0 });
    }
  }

  return { buildings, parks, trees, lamps, bay, beach, parkedSpots, seed };
}

// True when a point (with a small radius) is inside water.
export function inWater(city, x, y) {
  return y >= city.bay.y;
}

// True when a point is on a road (drivable, not sidewalk).
export function onRoad(x, y) {
  const near = (list) => list.some((c) => Math.abs(c - x) <= ROAD_W / 2 || Math.abs(c - y) <= ROAD_W / 2);
  return STREETS_X.some((c) => Math.abs(x - c) <= ROAD_W / 2) || STREETS_Y.some((c) => Math.abs(y - c) <= ROAD_W / 2);
}

// Nearest street centre to a point, used to snap traffic onto roads.
export function nearestStreet(x, y) {
  let bx = STREETS_X[0], bd = 1e9;
  for (const c of STREETS_X) if (Math.abs(c - x) < bd) { bd = Math.abs(c - x); bx = c; }
  let by = STREETS_Y[0]; bd = 1e9;
  for (const c of STREETS_Y) if (Math.abs(c - y) < bd) { bd = Math.abs(c - y); by = c; }
  return { x: bx, y: by };
}

// Circle-vs-building collision: pushes the circle out, returns true on hit.
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        p.y = b.y - r;
      }
    }
  }
  return hit;
}

export function litWindow(x, y, seed, litRatio) {
  return hash2(x, y, seed) < litRatio;
}
