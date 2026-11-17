// Everything the player reads: health/money/ammo, wanted stars, the clock,
// the mission tracker, dialogue, and the minimap — plus the title, pause and
// game-over screens. All drawn on the canvas so screenshots show it all.
import { WORLD_W, WORLD_H, ROADS_V, ROADS_H } from './city.js';
import { MISSIONS, currentMission, currentStep } from './missions.js';

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function dayPart(minutes) {
  const h = minutes / 60;
  if (h >= 6 && h < 11) return 'MORNING';
  if (h >= 11 && h < 17) return 'DAY';
  if (h >= 17 && h < 19) return 'DUSK';
  if (h >= 19 || h < 5) return 'NIGHT';
  return 'DAWN';
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
}

export function drawHUD(ctx, state, view) {
  const { w, h } = view;
  const p = state.player;
  // Top-left: cash, health, ammo.
  panel(ctx, 12, 12, 250, 86);
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`$${state.money.toLocaleString()}`, 24, 20);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`AMMO ${p.ammo} / 12${p.reloadTimer > 0 ? ' — RELOADING' : ''}`, 24, 48);
  ctx.fillText(state.playerCar ? `CAR HP ${Math.max(0, Math.round(state.playerCar.hp))}` : 'ON FOOT', 150, 48);
  ctx.fillStyle = '#222'; ctx.fillRect(24, 68, 180, 10);
  ctx.fillStyle = p.hp > 30 ? '#e74c3c' : '#ff6b6b';
  ctx.fillRect(24, 68, 180 * Math.max(0, p.hp) / 100, 10);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.max(0, Math.round(p.hp))}`, 210, 66);
  // Top-right: wanted stars + clock.
  panel(ctx, w - 212, 12, 200, 86);
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted), w - 24, 18);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(fmtClock(state.clock), w - 24, 50);
  ctx.fillStyle = '#9fb4d8'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(dayPart(state.clock), w - 24, 76);
  // Mission tracker under the stats.
  const m = currentMission(state);
  panel(ctx, 12, 108, 300, 64);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(m ? m.title : 'FREE ROAM', 24, 116);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(state.objective || 'Explore Neon Bay', 24, 136, 276);
  if (state.stepTimer > 0) {
    const step = currentStep(state);
    if (step && step.timeLimit) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText(`TIME ${Math.max(0, step.timeLimit - state.stepTimer).toFixed(0)}s`, 24, 154);
    }
  }
  // Toast message, centre top.
  if (state.messageTimer > 0 && state.message) {
    ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(state.message).width + 32;
    panel(ctx, w / 2 - tw / 2, 110, tw, 34);
    ctx.fillStyle = '#ffd94d'; ctx.fillText(state.message, w / 2, 118);
  }
  drawMinimap(ctx, state, view);
  // Dialogue box, bottom centre.
  if (state.dialogue && state.dialogue.idx < state.dialogue.lines.length) {
    const line = state.dialogue.lines[state.dialogue.idx];
    panel(ctx, w / 2 - 330, h - 108, 660, 64);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(line, w / 2 - 314, h - 92, 628);
    ctx.fillStyle = '#9fb4d8'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('E / click — continue', w / 2 - 314, h - 62);
  }
  // Controls hint, bottom right.
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E enter car · Click shoot · F punch · R reload', w - 14, h - 34);
  ctx.fillText('Space handbrake · Shift sprint · P pause · S save · M mute', w - 14, h - 18);
  // Crosshair while on foot.
  if (!state.playerCar && state.screen === 'playing') {
    const mx = state.input.mouse.x, my = state.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13); ctx.stroke();
  }
  if (state.storyComplete) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('★ STORY COMPLETE — FREE ROAM ★', w / 2, 152);
  }
}

function drawMinimap(ctx, state, view) {
  const { w, h } = view;
  const mw = 220, mh = 164, mx = 14, my = h - mh - 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  panel(ctx, mx - 4, my - 4, mw + 8, mh + 8);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.fillStyle = '#1d3a4d'; ctx.fillRect(mx, my, mw, mh); // bay water
  ctx.fillStyle = '#233026'; ctx.fillRect(mx, my, 2240 * sx, mh); // land
  ctx.fillStyle = '#3f6b4f';
  for (const park of state.city.parks) ctx.fillRect(mx + park.x * sx, my + park.y * sy, park.w * sx, park.h * sy);
  ctx.strokeStyle = '#3a4152'; ctx.lineWidth = 5;
  for (const rx of ROADS_V) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
  for (const ry of ROADS_H) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
  ctx.fillStyle = '#5b6b8c';
  for (const b of state.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker — pulsing yellow diamond.
  const m = currentMission(state);
  const step = currentStep(state);
  if (m && step && step.target) {
    const t = state.city.spots[step.target];
    const pulse = 5 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(mx + t.x * sx, my + t.y * sy - pulse - 4);
    ctx.lineTo(mx + t.x * sx + pulse, my + t.y * sy);
    ctx.lineTo(mx + t.x * sx, my + t.y * sy + pulse + 4);
    ctx.lineTo(mx + t.x * sx - pulse, my + t.y * sy);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#ecf0f1';
  for (const car of state.cars) ctx.fillRect(mx + car.x * sx - 1.5, my + car.y * sy - 1.5, 3, 3);
  ctx.fillStyle = '#e74c3c';
  const flash = Math.sin(state.time * 8) > 0;
  for (const car of state.cars) if (car.kind === 'police') {
    ctx.fillStyle = flash ? '#ff3b30' : '#4da3ff';
    ctx.beginPath(); ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#c77dff';
  for (const e of state.enemies) if (e.hp > 0) { ctx.beginPath(); ctx.arc(mx + e.x * sx, my + e.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow.
  const px = mx + state.player.x * sx, py = my + state.player.y * sy;
  ctx.fillStyle = '#fff';
  ctx.save(); ctx.translate(px, py); ctx.rotate(state.player.angle);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#9fb4d8'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', mx, my - 8);
}

export function drawTitleScreen(ctx, state, view, buttons) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(5,8,18,0.55)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e88'; ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 28;
  ctx.fillText('NEON BAY', w / 2, h / 2 - 110);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7df9ff'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', w / 2, h / 2 - 72);
  ctx.fillStyle = '#fff'; ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Steal cars. Outrun the law. Take the city — one job at a time.', w / 2, h / 2 - 38);
  const labels = state.hasSave
    ? [['continue', 'CONTINUE'], ['new', 'NEW GAME'], ['how', 'HOW TO PLAY']]
    : [['new', 'NEW GAME'], ['how', 'HOW TO PLAY']];
  buttons.length = 0;
  labels.forEach(([id, label], i) => {
    const bw = 260, bh = 48, bx = w / 2 - bw / 2, by = h / 2 + i * 62;
    ctx.fillStyle = 'rgba(255,46,136,0.9)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(label, w / 2, by + 16);
    buttons.push({ id, x: bx, y: by, w: bw, h: bh });
  });
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '13px system-ui, sans-serif';
  const y0 = h / 2 + labels.length * 62 + 16;
  ctx.fillText('WASD move / drive · E enter & exit cars · Mouse aim, click to shoot · F punch', w / 2, y0);
  ctx.fillText('R reload · Space handbrake · Shift sprint · P pause · S save · M mute', w / 2, y0 + 22);
  if (state.showHelp) {
    panel(ctx, w / 2 - 340, h / 2 - 190, 680, 150);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'left';
    const lines = [
      '• Steal any car: walk up and press E. Parked cars are safest.',
      '• Crimes raise your wanted stars. Lose the cops\' line of sight and the heat fades.',
      '• Follow the yellow marker on the minimap to work through 5 story missions.',
      '• Health and ammo pickups are scattered around the city — green crosses, yellow crates.',
      '• Your progress saves automatically after each mission. Press S any time to save.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, w / 2 - 322, h / 2 - 162 + i * 24));
  }
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('A fully original game. Neon Bay, its people and its story are invented — no real city, no borrowed assets.', w / 2, h - 18);
}

export function drawPauseScreen(ctx, state, view, buttons) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(5,8,18,0.6)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 90);
  const labels = [['resume', 'RESUME'], ['save', 'SAVE GAME'], ['load', 'LOAD GAME'], ['restart', 'RESTART STORY'], ['mute', state.muted ? 'UNMUTE (M)' : 'MUTE (M)']];
  buttons.length = 0;
  labels.forEach(([id, label], i) => {
    const bw = 260, bh = 44, bx = w / 2 - bw / 2, by = h / 2 - 40 + i * 56;
    ctx.fillStyle = 'rgba(255,46,136,0.9)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(label, w / 2, by + 15);
    buttons.push({ id, x: bx, y: by, w: bw, h: bh });
  });
  if (state.saveNote) {
    ctx.fillStyle = '#2ecc71'; ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(state.saveNote, w / 2, h / 2 + 250);
  }
}

export function drawGameOverScreen(ctx, state, view, buttons) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(20,2,8,0.72)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff3b30'; ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = 24;
  ctx.fillText(state.busted ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 60);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(state.busted ? 'The Neon Bay PD hauled you in.' : 'Rook went down in the streets of Neon Bay.', w / 2, h / 2 - 18);
  ctx.fillStyle = '#9fb4d8'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Missions done: ${state.stats.missionsDone} · Kills: ${state.stats.kills} · Cars stolen: ${state.stats.carsStolen}`, w / 2, h / 2 + 12);
  const labels = [['respawn', 'RESPAWN AT HOSPITAL (−$150)'], ['load', 'LOAD SAVE'], ['new', 'NEW GAME']];
  buttons.length = 0;
  labels.forEach(([id, label], i) => {
    const bw = 340, bh = 46, bx = w / 2 - bw / 2, by = h / 2 + 44 + i * 58;
    ctx.fillStyle = 'rgba(255,46,136,0.9)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(label, w / 2, by + 15);
    buttons.push({ id, x: bx, y: by, w: bw, h: bh });
  });
}
