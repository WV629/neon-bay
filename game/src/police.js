// Neon Bay — the wanted system. Crimes raise heat, police cruisers spawn
// and chase, and heat only cools when no cruiser can see the player.
// Being pinned on foot ends in an arrest (Busted).
import { makeRng, clamp, angleDiff } from './rng.js';
import { makeCar } from './traffic.js';
import { WORLD_W, WORLD_H, nearestStreet } from './city.js';

export function makePolice(city, seed) {
  const rng = makeRng(seed + 303);
  const cruisers = [];
  let wanted = 0;
  let heat = 0; // 0..100, feeds the star display and decay
  let quietT = 0; // seconds since the last crime or sighting
  let sirenT = 0;

  function starCount() { return Math.max(0, Math.min(5, Math.round(heat / 20))); }

  function addCrime(amount, reason) {
    heat = clamp(heat + amount, 0, 100);
    quietT = 0;
    wanted = starCount();
    return reason;
  }

  function spawnCruiserNear(x, y) {
    // Spawn just off-screen on a street, heading for the player.
    const s = nearestStreet(x + (rng.chance(0.5) ? -1 : 1) * 520, y + (rng.chance(0.5) ? -1 : 1) * 420);
    const c = makeCar(
      clamp(s.x, 120, WORLD_W - 120), clamp(s.y, 120, WORLD_H - 220),
      Math.atan2(y - s.y, x - s.x),
      { color: '#1c2733', police: true, hp: 120 },
    );
    c.speed = 120;
    c.targetSpeed = 260;
    cruisers.push(c);
    return c;
  }

  function syncCruisers(player) {
    const want = starCount();
    while (cruisers.length < want) spawnCruiserNear(player.x, player.y);
    while (cruisers.length > want) {
      // Retire the farthest cruiser first.
      let far = 0, fd = -1;
      cruisers.forEach((c, i) => {
        const d = (c.x - player.x) ** 2 + (c.y - player.y) ** 2;
        if (d > fd) { fd = d; far = i; }
      });
      cruisers.splice(far, 1);
    }
  }

  return {
    cruisers,
    get wanted() { return starCount(); },
    get heat() { return heat; },
    get quietT() { return quietT; },
    addCrime,
    setHeat(v) { heat = clamp(v, 0, 100); wanted = starCount(); },
    clear() { heat = 0; wanted = 0; quietT = 0; cruisers.length = 0; },
    syncCruisers,
    update(dt, player, onArrest, onRam) {
      sirenT += dt;
      const stars = starCount();
      if (stars > 0) {
        syncCruisers(player);
        // Heat cools only while no cruiser is close enough to see the player.
        const seen = cruisers.some((c) => (c.x - player.x) ** 2 + (c.y - player.y) ** 2 < 420 * 420);
        if (seen) quietT = 0;
        else {
          quietT += dt;
          if (quietT > 6) heat = clamp(heat - dt * 4, 0, 100);
        }
      } else {
        quietT += dt;
        if (cruisers.length) cruisers.length = 0;
      }
      for (const c of cruisers) {
        const dx = player.x - c.x, dy = player.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        const wantAngle = Math.atan2(dy, dx);
        const diff = angleDiff(c.angle, wantAngle);
        const turn = clamp(diff, -2.4 * dt, 2.4 * dt);
        c.angle += turn;
        // Ram speed: faster when lined up, slower when turning hard —
        // and easing off close in, so a cruiser can pin the player on foot.
        const nearPin = d < 130 ? 0.35 : 1;
        const target = (230 + stars * 18 - Math.abs(diff) * 60) * nearPin;
        c.speed += clamp(target - c.speed, -320 * dt, 170 * dt);
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        c.x = clamp(c.x, 60, WORLD_W - 60);
        c.y = clamp(c.y, 60, WORLD_H - 60);
        // Touching the player: ram their car, or pin them on foot.
        if (d < 46) {
          if (player.inCar) {
            if (onRam) onRam(c, d);
          } else if (c.speed < 150) {
            if (onArrest) onArrest(c);
          } else if (onRam) {
            onRam(c, d);
          }
        }
      }
      return sirenT;
    },
  };
}
