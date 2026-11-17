// The city on screen: ground, beach and bay, roads with lane paint, parks,
// buildings with lit windows, cars, people, the mission beacon — and the
// day/dusk/night light that washes over all of it.
import { WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_HALF } from './city.js';
import { dayPart } from './hud.js';

// How dark the world is, 0 (midday) to 1 (deep night), and how orange dusk is.
export function lightFor(clock) {
  const h = clock / 60;
  if (h >= 6 && h < 17) return { dark: 0, dusk: 0 };
  if (h >= 17 && h < 19) { const t = (h - 17) / 2; return { dark: 0.12 + t * 0.18, dusk: 1 - t * 0.4 }; }
  if (h >= 19 && h < 21) return { dark: 0.42, dusk: 0.25 };
  if (h >= 21 || h < 5) return { dark: 0.52, dusk: 0 };
  if (h >= 5 && h < 6) return { dark: 0.3, dusk: 0.4 };
  return { dark: 0, dusk: 0 };
}

function drawCar(ctx, car, state, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.roundRect(-20, -9, 42, 20, 6); ctx.fill();
  ctx.translate(0, -2);
  ctx.fillStyle = car.color;
  ctx.beginPath(); ctx.roundRect(-21, -11, 42, 22, 7); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.beginPath(); ctx.roundRect(2, -8, 9, 16, 3); ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.9)';
  ctx.beginPath(); ctx.roundRect(-12, -8, 8, 16, 3); ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath(); ctx.roundRect(-21, -11, 14, 22, 7); ctx.fill();
    const flash = Math.sin(state.time * 10) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#4da3ff';
    ctx.fillRect(-4, -11, 6, 5);
    ctx.fillStyle = flash ? '#4da3ff' : '#ff3b30';
    ctx.fillRect(-4, 6, 6, 5);
  }
  // Headlight glow at night.
  const light = lightFor(state.clock);
  if (light.dark > 0.3 && car.speed > 5) {
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.beginPath(); ctx.arc(22, -7, 2.5, 0, Math.PI * 2); ctx.arc(22, 7, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, gun) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
  if (gun) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18); ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(ctx, state, view) {
  const { camX, camY, w, h } = view;
  const light = lightFor(state.clock);
  ctx.save();
  ctx.translate(-camX + w / 2, -camY + h / 2);
  // Ground, beach, bay.
  ctx.fillStyle = '#3d4a38'; ctx.fillRect(camX - w / 2 - 40, camY - h / 2 - 40, w + 80, h + 80);
  ctx.fillStyle = '#d9c08a'; ctx.fillRect(2240, 0, 170, WORLD_H);
  ctx.fillStyle = '#1e6f8e'; ctx.fillRect(2410, 0, WORLD_W - 2410, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let y = 60; y < WORLD_H; y += 120) {
    ctx.beginPath(); ctx.moveTo(2430, y); ctx.quadraticCurveTo(2470, y + 14, 2430, y + 28); ctx.stroke();
  }
  // Parks and trees.
  for (const park of state.city.parks) {
    ctx.fillStyle = '#4a7a45'; ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#2f5d33';
    for (let i = 0; i < Math.floor(park.w * park.h / 9000); i++) {
      const tx = park.x + 20 + ((i * 53) % Math.max(40, park.w - 40));
      const ty = park.y + 20 + ((i * 37) % Math.max(40, park.h - 40));
      ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Roads.
  ctx.fillStyle = '#2b2f36';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  for (const ry of ROADS_H) ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  // Lane dashes.
  ctx.strokeStyle = 'rgba(255,214,64,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([18, 22]);
  for (const rx of ROADS_V) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke(); }
  for (const ry of ROADS_H) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_HALF, 0); ctx.lineTo(rx - ROAD_HALF, WORLD_H);
    ctx.moveTo(rx + ROAD_HALF, 0); ctx.lineTo(rx + ROAD_HALF, WORLD_H); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(0, ry - ROAD_HALF); ctx.lineTo(WORLD_W, ry - ROAD_HALF);
    ctx.moveTo(0, ry + ROAD_HALF); ctx.lineTo(WORLD_W, ry + ROAD_HALF); ctx.stroke();
  }
  // Buildings with shadows and windows.
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = light.dark > 0.3 ? 'rgba(255,214,120,0.9)' : 'rgba(255,255,255,0.25)';
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      if ((cx * 7 + cy * 3 + b.w) % 3 !== 0) continue;
      ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 26, 9, 7);
    }
  }
  // Named-place labels.
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const key of ['docks', 'club', 'warehouse', 'bank', 'hospital', 'square', 'beach']) {
    const s = state.city.spots[key];
    ctx.fillText(s.name.toUpperCase(), s.x, s.y - 58);
  }
  // Mission beacon.
  const mStep = state.objectiveTarget;
  if (mStep) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = 'rgba(255,217,77,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mStep.x, mStep.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,77,0.25)';
    ctx.beginPath(); ctx.arc(mStep.x, mStep.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.save(); ctx.translate(mStep.x, mStep.y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18); ctx.restore();
  }
  // Pickups.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'health' ? '#2ecc71' : '#f1c40f';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + 5);
  }
  // Pedestrians, enemies, cars, player.
  for (const ped of state.peds) if (ped.hp > 0) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, false);
  for (const e of state.enemies) if (e.hp > 0) drawPerson(ctx, e.x, e.y, e.angle, e.color, true);
  for (const car of state.cars) drawCar(ctx, car, state, car === state.playerCar);
  // Tracers.
  for (const t of state.tracers) {
    ctx.strokeStyle = `rgba(255,220,80,${Math.max(0, t.life) * 8})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  // Player.
  const p = state.player;
  if (!state.playerCar) {
    drawPerson(ctx, p.x, p.y, p.angle, '#ff2e88', p.ammo > 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.stroke();
  }
  // Particles and floating text.
  for (const pt of state.effects.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const t of state.effects.texts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Time-of-day wash + vignette over the world (HUD draws above it).
  if (light.dark > 0.01) {
    ctx.fillStyle = `rgba(8,12,38,${light.dark})`; ctx.fillRect(0, 0, w, h);
  }
  if (light.dusk > 0.01) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(255,110,40,${light.dusk * 0.10})`);
    g.addColorStop(1, `rgba(255,80,120,${light.dusk * 0.16})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
