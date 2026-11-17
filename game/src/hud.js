// Neon Bay — everything drawn on top of the world: the HUD (money, health,
// ammo, wanted stars, clock, mission tracker), the minimap, the dialogue
// box, the crosshair, and the title / pause / game-over screens.
import { WORLD_W, WORLD_H, PLACES, STREETS_X, STREETS_Y } from './city.js';
import { fmtMoney, fmtClock, clamp } from './rng.js';
import { dayPart } from './render.js';

function stars(ctx, x, y, wanted) {
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#facc15' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 26, y);
  }
}

export function drawHud(ctx, game, W, H) {
  const p = game.player;
  // Money.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#a3e635';
  ctx.fillText(fmtMoney(p.money), W - 18, 36);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W - 218, 48, 200, 16);
  ctx.fillStyle = p.hp > 30 ? '#22c55e' : '#ef4444';
  ctx.fillRect(W - 216, 50, 196 * clamp(p.hp / 100, 0, 1), 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, W - 118, 60);
  // Ammo.
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(`AMMO ${p.ammo}${p.reloadT > 0 ? '  RELOADING…' : ''}`, W - 18, 88);
  // Wanted stars, top-left.
  stars(ctx, 18, 40, game.police.wanted);
  // Clock + day part.
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`${fmtClock(game.clock)}  ·  ${dayPart(game.clock).toUpperCase()}`, 18, 66);
  // Mission tracker (taller when a countdown is running, so the timer
  // gets its own line instead of colliding with the brief).
  const m = game.missions.current();
  const hasTimer = !!(m && m.timeLimit && game.missions.timer > 0);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const trackerW = 330;
  const trackerH = hasTimer ? 72 : 54;
  ctx.fillRect(18, 78, trackerW, trackerH);
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(m ? `MISSION ${m.id}: ${m.title}` : 'FREE ROAM', 28, 98);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(game.missions.statusLine(), 28, 118, trackerW - 20);
  if (hasTimer) {
    ctx.fillStyle = game.missions.timer < 20 ? '#ef4444' : '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(game.missions.timer)}s`, 28, 140);
  }
  // Car health when driving.
  if (p.inCar && p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(18, 140, 200, 14);
    ctx.fillStyle = p.car.hp > 30 ? '#38bdf8' : '#ef4444';
    ctx.fillRect(20, 142, 196 * clamp(p.car.hp / 100, 0, 1), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CAR', 24, 152);
  }
  // Speed readout while driving.
  if (p.inCar && p.car) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.9)} mph`, W - 18, H - 18);
  }
  // Dialogue box.
  if (game.dialogue.length) {
    const [name, line] = game.dialogue[0];
    ctx.fillStyle = 'rgba(2,6,23,0.85)';
    ctx.fillRect(140, H - 118, W - 280, 92);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.strokeRect(140, H - 118, W - 280, 92);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name, 158, H - 92);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, line, 158, H - 68, W - 316, 20);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('click / Enter to continue', W - 158, H - 34);
  }
  // "Press E" hint near a car.
  if (game.nearCarHint) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Press E to get in the car', W / 2, H - 140);
  }
  // Crosshair (mouse aim, not while driving a menu).
  if (game.screen === 'play' && !p.inCar) {
    const mx = game.input.mouse.x, my = game.input.mouse.y;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

export function drawMinimap(ctx, game, W, H) {
  const mw = 190, mh = 142;
  const mx = W - mw - 14, my = H - mh - 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(2,6,23,0.78)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, mw, mh);
  // Water + roads.
  ctx.fillStyle = '#155e75';
  ctx.fillRect(mx, my + 1744 * sy, mw, mh - 1744 * sy);
  ctx.fillStyle = '#3f4750';
  for (const x of STREETS_X) ctx.fillRect(mx + x * sx - 1, my, 2, mh);
  for (const y of STREETS_Y) ctx.fillRect(mx, my + y * sy - 1, mw, 2);
  // Mission target: pulsing diamond.
  const t = game.missions.target();
  if (t) {
    const pulse = 5 + Math.sin(game.time * 5) * 2;
    ctx.fillStyle = '#facc15';
    ctx.save();
    ctx.translate(mx + t.x * sx, my + t.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // Traffic cars as dots, police flashing.
  for (const c of game.traffic.cars) {
    if (c.parked) continue;
    ctx.fillStyle = c.police
      ? (Math.floor(game.time * 4) % 2 === 0 ? '#ef4444' : '#3b82f6')
      : '#e2e8f0';
    ctx.fillRect(mx + c.x * sx - 1.5, my + c.y * sy - 1.5, 3, 3);
  }
  // Named places.
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const key of ['bank', 'club', 'docks', 'hospital', 'safehouse']) {
    const p = PLACES[key];
    ctx.fillText(p.label[0], mx + p.x * sx - 2, my + p.y * sy + 3);
  }
  // Player arrow.
  const p = game.player;
  const px = mx + (p.inCar ? p.car.x : p.x) * sx;
  const py = my + (p.inCar ? p.car.y : p.y) * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.inCar ? p.car.angle : p.aimAngle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // North + label.
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('N', mx + 4, my + 12);
  ctx.restore();
}

function button(ctx, x, y, w, h, label, hover) {
  ctx.fillStyle = hover ? '#facc15' : 'rgba(15,23,42,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = hover ? '#0f172a' : '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
}

export function drawTitle(ctx, game, W, H) {
  // Dusk city backdrop is already drawn behind; darken + title.
  ctx.fillStyle = 'rgba(2,6,23,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('NEON BAY', W / 2, 210);
  ctx.restore();
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('A  N E O N  C R I M E  S T O R Y', W / 2, 252);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Steal cars. Outrun the law. Run five jobs for Mara Voss.', W / 2, 292);
  const bw = 320, bh = 52;
  const bx = W / 2 - bw / 2;
  const my = game.input.mouse.y;
  const mx = game.input.mouse.x;
  const hover = (y) => mx >= bx && mx <= bx + bw && my >= y && my <= y + bh;
  button(ctx, bx, 340, bw, bh, game.hasSave ? 'CONTINUE' : 'NEW GAME', hover(340));
  button(ctx, bx, 408, bw, bh, 'HOW TO PLAY', hover(408));
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move / drive · E enter car · Mouse aim + click shoot · F punch · R reload', W / 2, 510);
  ctx.fillText('Space handbrake · Shift sprint · P pause · S save · M mute', W / 2, 534);
  ctx.fillText('An original game. Neon Bay, Mara Voss and every character are fictional.', W / 2, 580);
  ctx.fillText('No real city, person or game is depicted.', W / 2, 602);
  return [
    { id: game.hasSave ? 'continue' : 'new', x: bx, y: 340, w: bw, h: bh },
    { id: 'howto', x: bx, y: 408, w: bw, h: bh },
  ];
}

export function drawHowTo(ctx, W, H) {
  ctx.fillStyle = 'rgba(2,6,23,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', W / 2, 110);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '17px system-ui, sans-serif';
  const lines = [
    'You are a driver new to Neon Bay. Mara Voss has five jobs for you.',
    '',
    'ON FOOT — WASD to walk, Shift to sprint. Mouse to aim, click to shoot.',
    'F punches, R reloads. Pick up green + and orange A crates for health and ammo.',
    '',
    'IN A CAR — Press E next to any parked or traffic car to take it. That is a crime:',
    'the cops will notice. WASD drives, Space is the handbrake, E gets out.',
    '',
    'WANTED — Stars rise when you steal, hit people or shoot. Cruisers chase and ram.',
    'On foot, a slow cruiser that touches you arrests you. Hide until the heat cools.',
    '',
    'MISSIONS — Follow the pulsing gold diamond on the map and minimap.',
    'Finish all five jobs to own the city. S saves, P pauses, M mutes.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 160 + i * 30));
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Click anywhere to go back', W / 2, H - 60);
}

export function drawPause(ctx, game, W, H) {
  ctx.fillStyle = 'rgba(2,6,23,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, 180);
  const bw = 300, bh = 48;
  const bx = W / 2 - bw / 2;
  const mx = game.input.mouse.x, my = game.input.mouse.y;
  const hover = (y) => mx >= bx && mx <= bx + bw && my >= y && my <= y + bh;
  const items = [
    ['resume', 'RESUME', 250],
    ['save', 'SAVE GAME', 312],
    ['load', 'LOAD GAME', 374],
    ['restart', 'RESTART STORY', 436],
    ['mute', game.audio.muted ? 'UNMUTE (M)' : 'MUTE (M)', 498],
    ['title', 'QUIT TO TITLE', 560],
  ];
  for (const [id, label, y] of items) button(ctx, bx, y, bw, bh, label, hover(y));
  return items.map(([id, , y]) => ({ id, x: bx, y, w: bw, h: bh }));
}

export function drawGameOver(ctx, game, W, H, kind) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(30,41,59,0.82)' : 'rgba(69,10,10,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#38bdf8' : '#ef4444';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', W / 2, 300);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(
    kind === 'busted'
      ? 'The Neon Bay PD took you in. Mara posted bail — but the job is blown.'
      : 'You went down in the streets of Neon Bay. St. Marina patched you up.',
    W / 2, 350,
  );
  ctx.fillText('Click to wake up at the hospital and keep playing.', W / 2, 384);
}
