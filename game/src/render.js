// Neon Bay — world rendering: streets, buildings with lit windows, parks,
// beach and bay, cars, pedestrians, enemies, the player, and the
// day/dusk/night lighting that tints everything.
import { WORLD_W, WORLD_H, ROAD_W, STREETS_X, STREETS_Y, PLACES, litWindow } from './city.js';
import { clamp } from './rng.js';

export function dayPart(minutes) {
  const h = (minutes / 60) % 24;
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'dusk';
  if (h >= 19.5 || h < 5) return 'night';
  return 'dawn';
}

// Overlay colour + opacity for the time of day.
export function lightTint(minutes) {
  const part = dayPart(minutes);
  if (part === 'morning') return { color: '#ffd9a0', alpha: 0.05 };
  if (part === 'day') return { color: '#ffffff', alpha: 0 };
  if (part === 'dusk') return { color: '#ff7a3c', alpha: 0.16 };
  if (part === 'night') return { color: '#0a1230', alpha: 0.42 };
  return { color: '#ffb37a', alpha: 0.1 };
}

export function drawWorld(ctx, game, cam) {
  const { city, player } = game;
  const minutes = game.clock;
  const part = dayPart(minutes);
  const night = part === 'night' || part === 'dusk';
  const view = { x0: cam.x - 40, y0: cam.y - 40, x1: cam.x + cam.w + 40, y1: cam.y + cam.h + 40 };
  const inView = (x, y, w, h) => x + w > view.x0 && x < view.x1 && y + h > view.y0 && y < view.y1;

  // Ground: grass blocks, sand, water.
  ctx.fillStyle = '#38663f';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(Math.max(view.x0, city.beach.x), city.beach.y, Math.min(view.x1, city.beach.x + city.beach.w) - Math.max(view.x0, city.beach.x), city.beach.h);
  // Bay water with a slow shimmer.
  const wave = Math.sin(game.time * 0.8) * 3;
  ctx.fillStyle = '#155e75';
  ctx.fillRect(Math.max(view.x0, 0), city.bay.y, Math.min(view.x1, WORLD_W) - Math.max(view.x0, 0), city.bay.h - city.bay.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let x = 80; x < WORLD_W; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, city.bay.y + 30 + wave);
    ctx.lineTo(x + 60, city.bay.y + 30 + wave);
    ctx.stroke();
  }

  // Parks.
  for (const p of city.parks) {
    if (!inView(p.x, p.y, p.w, p.h)) continue;
    ctx.fillStyle = '#3f7a4a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#2c5a35';
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // Roads: asphalt with centre dashes and crosswalk stripes.
  ctx.fillStyle = '#3a4048';
  for (const x of STREETS_X) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of STREETS_Y) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = '#c9a227';
  for (const x of STREETS_X) {
    for (let y = 40; y < WORLD_H; y += 56) {
      if (STREETS_Y.some((s) => Math.abs(y - s) < 40)) continue;
      ctx.fillRect(x - 2, y, 4, 26);
    }
  }
  for (const y of STREETS_Y) {
    for (let x = 40; x < WORLD_W; x += 56) {
      if (STREETS_X.some((s) => Math.abs(x - s) < 40)) continue;
      ctx.fillRect(x, y - 2, 26, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const x of STREETS_X) for (const y of STREETS_Y) {
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(x + i * 11 - 3, y - ROAD_W / 2 + 6, 6, 12);
      ctx.fillRect(x + i * 11 - 3, y + ROAD_W / 2 - 18, 6, 12);
    }
  }

  // Trees.
  for (const t of city.trees) {
    if (!inView(t.x - 16, t.y - 16, 32, 32)) continue;
    ctx.fillStyle = '#1d4a2a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f7a3e';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.65, 0, Math.PI * 2); ctx.fill();
  }

  // Buildings: body, roof edge, lit windows, neon sign after dark.
  const litRatio = part === 'night' ? 0.55 : part === 'dusk' ? 0.4 : 0.12;
  for (const b of city.buildings) {
    if (!inView(b.x, b.y, b.w, b.h)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows on a grid; lit ones glow warm at night.
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 24));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const wx = b.x + 8 + cx * ((b.w - 16) / cols);
        const wy = b.y + 8 + cy * ((b.h - 16) / rows);
        const lit = litWindow(Math.floor(wx), Math.floor(wy), b.seed, litRatio);
        ctx.fillStyle = lit ? '#ffd166' : 'rgba(10,16,28,0.55)';
        ctx.fillRect(wx, wy, 9, 11);
      }
    }
    if (b.neon && night) {
      ctx.save();
      ctx.shadowColor = b.neonColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = b.neonColor;
      ctx.fillRect(b.x + b.w / 2 - 22, b.y - 4, 44, 5);
      ctx.restore();
    }
    if (b.landmark) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.landmark.toUpperCase(), b.x + b.w / 2, b.y + b.h + 14);
    }
  }

  // Street lamps glow after dark.
  if (night) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#ffd166';
    for (const l of city.lamps) {
      if (!inView(l.x - 30, l.y - 30, 60, 60)) continue;
      ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Place labels on the map.
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    if (!inView(p.x - 60, p.y - 60, 120, 120)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const w = ctx.measureText(p.label).width + 12;
    ctx.fillRect(p.x - w / 2, p.y - 64, w, 17);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(p.label, p.x, p.y - 51);
  }

  // Mission target diamond (pulsing).
  const target = game.missions.target();
  if (target) {
    const pulse = 1 + Math.sin(game.time * 5) * 0.15;
    const s = 16 * pulse;
    ctx.save();
    ctx.translate(target.x, target.y - 34);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    // A guiding beam so the target is visible from afar.
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(game.time * 5) * 0.1;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(target.x - 3, target.y - 190, 6, 190);
    ctx.restore();
  }
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-19, -11, 40, 26);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -20, -12, 40, 24, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  roundRect(ctx, -6, -10, 14, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.fillRect(8, -9, 4, 18);
  // Headlights.
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(18, -10, 3, 5);
  ctx.fillRect(18, 5, 3, 5);
  // Brake lights.
  ctx.fillStyle = car.brakeLight ? '#ef4444' : '#7f1d1d';
  ctx.fillRect(-21, -10, 3, 5);
  ctx.fillRect(-21, 5, 3, 5);
  if (car.police) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-14, -12, 28, 24);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    // Light bar flashing.
    const on = Math.floor(Date.now() / 280) % 2 === 0;
    ctx.fillStyle = on ? '#ef4444' : '#3b82f6';
    ctx.fillRect(-4, -13, 8, 4);
  }
  ctx.restore();
}

export function drawPerson(ctx, x, y, angle, color, bob, flash = 0) {
  const b = Math.sin(bob) * 2;
  ctx.save();
  ctx.translate(x, y + b * 0.4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = flash > 0 ? '#ffffff' : color;
  roundRect(ctx, -7, -6, 14, 13, 4);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar && p.car) return; // the car drawing covers the driver
  // A pale ring under the player so they read at a glance in a busy city.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const aim = p.aimAngle;
  drawPerson(ctx, p.x, p.y, aim, '#2563eb', game.time * 8, 0);
  // Gun in hand when armed.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(aim);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function applyLighting(ctx, game, w, h) {
  const tint = lightTint(game.clock);
  if (tint.alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = tint.color;
  ctx.globalAlpha = tint.alpha;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
