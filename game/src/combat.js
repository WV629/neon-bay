// Neon Bay — combat: mouse-aim hitscan shooting, punching, reloading,
// armed enemies who shoot back, and health/ammo pickups scattered in town.
import { makeRng, clamp, angleDiff } from './rng.js';
import { collideBuildings } from './city.js';

export function makeCombat(city, seed, fx, audio) {
  const rng = makeRng(seed + 505);
  const enemies = [];
  const pickups = [];
  let shotCooldown = 0;
  let punchCooldown = 0;

  // A few pickups near the safehouse, hospital and square.
  const spots = [
    [340, 380, 'health'], [260, 260, 'ammo'], [1180, 900, 'health'],
    [520, 1480, 'ammo'], [1420, 1060, 'health'], [900, 560, 'ammo'],
    [2060, 1600, 'health'], [1760, 1240, 'ammo'],
  ];
  for (const [x, y, kind] of spots) pickups.push({ x, y, kind, bob: rng.range(0, 6) });

  function spawnCrew(x, y, count, hp = 60) {
    const made = [];
    for (let i = 0; i < count; i++) {
      const e = {
        x: x + rng.range(-70, 70), y: y + rng.range(-70, 70),
        angle: rng.range(0, Math.PI * 2), hp, maxHp: hp,
        state: 'hunt', shootT: rng.range(0.4, 1.2), speed: 78,
        dead: false, flash: 0,
      };
      enemies.push(e);
      made.push(e);
    }
    return made;
  }

  function lineBlocked(x1, y1, x2, y2) {
    // Sample the segment; a building in the way blocks the shot.
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 14);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      for (const b of city.buildings) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
      }
    }
    return false;
  }

  return {
    enemies, pickups,
    get shotCooldown() { return shotCooldown; },
    spawnCrew,
    clearEnemies() { enemies.length = 0; },
    // Player fires toward (tx, ty). Returns what the shot hit, if anything.
    shoot(player, tx, ty) {
      if (shotCooldown > 0 || player.ammo <= 0 || player.reloadT > 0) return null;
      shotCooldown = 0.22;
      player.ammo--;
      const ox = player.inCar ? player.car.x : player.x;
      const oy = player.inCar ? player.car.y : player.y;
      const angle = Math.atan2(ty - oy, tx - ox);
      const range = 620;
      const ex = ox + Math.cos(angle) * range, ey = oy + Math.sin(angle) * range;
      fx.muzzle(ox + Math.cos(angle) * 22, oy + Math.sin(angle) * 22, angle);
      audio.gunshot();
      // Nearest enemy or car the ray crosses.
      let hitEnemy = null, hitD = range;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - ox, dy = e.y - oy;
        const along = dx * Math.cos(angle) + dy * Math.sin(angle);
        if (along < 0 || along > hitD) continue;
        const side = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
        if (side < 16) { hitEnemy = e; hitD = along; }
      }
      if (hitEnemy) {
        hitEnemy.hp -= 34;
        hitEnemy.flash = 0.12;
        fx.blood(hitEnemy.x, hitEnemy.y);
        fx.tracer(ox, oy, hitEnemy.x, hitEnemy.y);
        if (hitEnemy.hp <= 0) {
          hitEnemy.dead = true;
          fx.burst(hitEnemy.x, hitEnemy.y, '#c0392b', 16, 120, 0.7, 4);
          return { kind: 'kill', enemy: hitEnemy };
        }
        return { kind: 'hit', enemy: hitEnemy };
      }
      fx.tracer(ox, oy, ex, ey);
      return { kind: 'miss' };
    },
    punch(player) {
      if (punchCooldown > 0) return null;
      punchCooldown = 0.45;
      audio.punch();
      const ox = player.x, oy = player.y;
      const angle = player.aimAngle;
      let hit = null;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - ox, e.y - oy);
        if (d < 52 && Math.abs(angleDiff(angle, Math.atan2(e.y - oy, e.x - ox))) < 1.1) { hit = e; break; }
      }
      if (hit) {
        hit.hp -= 25;
        hit.flash = 0.12;
        fx.blood(hit.x, hit.y);
        if (hit.hp <= 0) { hit.dead = true; return { kind: 'kill', enemy: hit }; }
        return { kind: 'hit', enemy: hit };
      }
      return { kind: 'miss' };
    },
    update(dt, player, onPlayerShot) {
      shotCooldown = Math.max(0, shotCooldown - dt);
      punchCooldown = Math.max(0, punchCooldown - dt);
      for (const e of enemies) {
        if (e.dead) continue;
        e.flash = Math.max(0, e.flash - dt);
        const px = player.inCar ? player.car.x : player.x;
        const py = player.inCar ? player.car.y : player.y;
        const d = Math.hypot(px - e.x, py - e.y);
        const want = Math.atan2(py - e.y, px - e.x);
        e.angle += clamp(angleDiff(e.angle, want), -3 * dt, 3 * dt);
        if (d > 260) {
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
        } else if (d < 130) {
          e.x -= Math.cos(e.angle) * e.speed * 0.5 * dt;
          e.y -= Math.sin(e.angle) * e.speed * 0.5 * dt;
        }
        collideBuildings(city, e, 10);
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 420 && !lineBlocked(e.x, e.y, px, py)) {
          e.shootT = 1.1 + rng.range(0, 0.7);
          audio.enemyShot();
          fx.muzzle(e.x + Math.cos(e.angle) * 18, e.y + Math.sin(e.angle) * 18, e.angle);
          fx.tracer(e.x, e.y, px, py);
          if (rng.chance(0.55)) onPlayerShot(7 + rng.int(0, 6));
        }
      }
      for (const p of pickups) p.bob += dt * 3;
      // Player walks over a pickup.
      const px = player.inCar ? player.car.x : player.x;
      const py = player.inCar ? player.car.y : player.y;
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        if (Math.hypot(p.x - px, p.y - py) < 30) {
          if (p.kind === 'health') player.hp = Math.min(100, player.hp + 40);
          else player.ammo = Math.min(120, player.ammo + 36);
          audio.pickup();
          fx.floatText(p.x, p.y - 18, p.kind === 'health' ? '+40 HP' : '+36 AMMO', '#a3e635');
          pickups.splice(i, 1);
        }
      }
    },
    drawPickups(ctx) {
      for (const p of pickups) {
        const bobY = Math.sin(p.bob) * 3;
        ctx.save();
        ctx.translate(p.x, p.y + bobY);
        ctx.fillStyle = p.kind === 'health' ? '#22c55e' : '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.kind === 'health' ? '+' : 'A', 0, 1);
        ctx.restore();
      }
    },
  };
}
