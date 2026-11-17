// Neon Bay — the game itself: state machine, the per-frame update,
// driving and walking, stealing cars, crime and heat, and the glue that
// ties city, traffic, police, combat, missions, audio and HUD together.
import { buildCity, PLACES, WORLD_W, WORLD_H, collideBuildings, inWater } from './city.js';
import { makeRng, clamp, angleDiff } from './rng.js';
import { makeAudio } from './audio.js';
import { makeEffects } from './effects.js';
import { makeInput } from './input.js';
import { makeTraffic } from './traffic.js';
import { makePolice } from './police.js';
import { makeCombat } from './combat.js';
import { makeMissions } from './missions.js';
import { drawWorld, drawCar, drawPerson, drawPlayer, applyLighting } from './render.js';
import { drawHud, drawMinimap, drawTitle, drawHowTo, drawPause, drawGameOver } from './hud.js';
import { hasSave, writeSave, readSave } from './save.js';

const VIEW_W = 1280;
const VIEW_H = 800;

export function createGame(canvas, opts = {}) {
  const seed = opts.seed ?? 1337;
  const ctx = canvas.getContext('2d');
  const input = makeInput(canvas);
  const audio = makeAudio();
  const fx = makeEffects();
  const city = buildCity(seed);
  const rng = makeRng(seed + 909);
  const traffic = makeTraffic(city, seed);
  const police = makePolice(city, seed);
  const combat = makeCombat(city, seed, fx, audio);

  const player = {
    x: PLACES.safehouse.x, y: PLACES.safehouse.y + 70,
    angle: 0, aimAngle: 0, hp: 100, money: 250, ammo: 48,
    inCar: false, car: null, reloadT: 0, speed: 0,
  };

  const game = {
    canvas, ctx, input, audio, fx, city, traffic, police, combat,
    player, rng, seed,
    screen: 'title', // title | howto | play | pause | busted | wasted
    time: 0,
    clock: 17 * 60 + 24, // 5:24 PM — dusk over the bay
    cam: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
    dialogue: [],
    nearCarHint: false,
    hasSave: hasSave(),
    shotMode: opts.shot || null,
    danger: { x: -9999, y: -9999, radius: 0 },
    combatFlash: 0, // seconds of staged tracer left (screenshot staging)
    frame: 0,
  };
  game.missions = makeMissions(game);

  // ---- dialogue -------------------------------------------------------
  game.say = (lines) => { game.dialogue = lines.slice(); };
  game.advanceDialogue = () => { if (game.dialogue.length) game.dialogue.shift(); };

  // ---- saving ---------------------------------------------------------
  game.saveGame = (quiet) => {
    const ok = writeSave({
      money: player.money, hp: player.hp, ammo: player.ammo,
      x: player.x, y: player.y, mission: game.missions.index,
      clock: game.clock, inCar: player.inCar,
      car: player.inCar && player.car ? { x: player.car.x, y: player.car.y, angle: player.car.angle, color: player.car.color, hp: player.car.hp } : null,
    });
    game.hasSave = hasSave();
    if (!quiet && ok) fx.floatText(player.x, player.y - 30, 'SAVED', '#a3e635');
    return ok;
  };
  game.loadGame = () => {
    const s = readSave();
    if (!s) return false;
    player.money = s.money ?? 250;
    player.hp = s.hp ?? 100;
    player.ammo = s.ammo ?? 48;
    player.x = s.x ?? PLACES.safehouse.x;
    player.y = s.y ?? PLACES.safehouse.y + 70;
    game.clock = s.clock ?? game.clock;
    game.missions.setIndex(s.mission ?? 0);
    if (s.inCar && s.car) {
      const car = traffic.cars.find((c) => !c.police) ?? null;
      if (car) {
        car.x = s.car.x; car.y = s.car.y; car.angle = s.car.angle;
        car.color = s.car.color; car.hp = s.car.hp; car.parked = false; car.stolen = true;
        player.car = car; player.inCar = true;
      }
    } else {
      player.inCar = false; player.car = null;
    }
    police.clear();
    combat.clearEnemies();
    game.missions.startMission();
    game.screen = 'play';
    return true;
  };

  // ---- car handling ---------------------------------------------------
  function enterCar(car) {
    player.inCar = true;
    player.car = car;
    car.parked = false;
    car.traffic = false;
    car.speed = 0;
    audio.door();
    if (!car.stolen) {
      car.stolen = true;
      police.addCrime(20, 'Grand theft auto');
      fx.floatText(player.x, player.y - 30, 'STOLEN! +1 ★', '#facc15');
    }
  }
  function exitCar() {
    const car = player.car;
    if (!car) return;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 34;
    player.y = car.y + Math.sin(side) * 34;
    player.inCar = false;
    player.car = null;
    car.speed = 0;
    audio.door();
  }

  function damageCar(car, amount, fromX, fromY) {
    car.hp -= amount;
    fx.sparks(car.x, car.y);
    audio.crash();
    fx.addShake(4);
    if (car.hp <= 0) {
      fx.burst(car.x, car.y, '#f97316', 26, 200, 0.9, 5);
      fx.burst(car.x, car.y, '#1f2937', 18, 90, 1.4, 7);
      audio.crash();
      if (player.inCar && player.car === car) {
        player.hp -= 25;
        exitCar();
        car.hp = 0;
      }
      traffic.removeCar(car);
    }
  }

  // ---- per-frame update ------------------------------------------------
  function update(dt) {
    game.time += dt;
    if (game.combatFlash > 0) game.combatFlash -= dt;
    game.clock = (game.clock + dt * 0.6) % (24 * 60); // a game hour every 100 s
    fx.update(dt);

    if (game.screen !== 'play') { input.endFrame(); return; }
    if (game.dialogue.length) {
      // World freezes while Mara talks; the player reads, then continues.
      if (input.hit('Enter') || input.mouse.clicked) game.advanceDialogue();
      input.endFrame();
      return;
    }

    // Aim follows the mouse.
    const cam = game.cam;
    const aim = input.aimWorld(cam.x, cam.y);
    player.aimAngle = Math.atan2(aim.y - player.y, aim.x - player.x);

    // Global keys.
    if (input.hit('p') || input.hit('Escape')) { game.screen = 'pause'; audio.setEngine(0, false); input.endFrame(); return; }
    if (input.hit('m')) audio.setMuted(!audio.muted);
    if (input.hit('s')) game.saveGame(false);

    if (player.reloadT > 0) player.reloadT -= dt;

    if (player.inCar && player.car) {
      updateDriving(dt);
    } else {
      updateWalking(dt);
    }

    // Traffic, pedestrians, police, combat, missions.
    traffic.update(dt, player, game.danger);
    game.danger.radius = Math.max(0, game.danger.radius - dt * 300);
    police.update(dt, player,
      () => { // arrested
        game.screen = 'busted';
        audio.busted();
        audio.setSiren(false, 0);
      },
      (cruiser) => { // rammed
        if (player.inCar && player.car) damageCar(player.car, 8, cruiser.x, cruiser.y);
        else { player.hp -= 6; fx.addShake(3); }
      });
    combat.update(dt, player, (dmg) => {
      player.hp -= dmg;
      fx.blood(player.x, player.y);
      fx.addShake(2);
      if (player.hp <= 0) {
        game.screen = 'wasted';
        audio.busted();
      }
    });
    game.missions.update(dt);

    // Mission 5 escape: the safehouse hides the player, heat bleeds off fast.
    if (game.missions.current() && game.missions.current().id === 5 && game.missions.phase === 'escape') {
      const d = Math.hypot(player.x - PLACES.safehouse.x, player.y - PLACES.safehouse.y);
      if (d < 170) police.setHeat(police.heat - 30 * dt);
    }

    // Shooting / punching / reloading (on foot only; driving uses the horn of justice: the car).
    if (!player.inCar) {
      if (input.mouse.down || input.mouse.clicked) {
        const result = combat.shoot(player, aim.x, aim.y);
        if (result) {
          game.danger = { x: player.x, y: player.y, radius: 320 };
          if (result.kind === 'hit' || result.kind === 'kill') {
            police.addCrime(6, 'Discharging a firearm');
            if (result.kind === 'kill') fx.floatText(result.enemy.x, result.enemy.y - 20, '+$50', '#a3e635');
            if (result.kind === 'kill') player.money += 50;
          }
          fx.addShake(1.5);
        }
      }
      if (input.hit('f')) {
        const result = combat.punch(player);
        if (result && result.kind !== 'miss') police.addCrime(4, 'Assault');
      }
      if (input.hit('r') && player.reloadT <= 0 && player.ammo > 0) {
        player.reloadT = 0.9;
        player.ammo = Math.min(120, player.ammo + 12);
        audio.reload();
      }
    }

    // Camera follows the player (or their car).
    const fx0 = player.inCar ? player.car.x : player.x;
    const fy0 = player.inCar ? player.car.y : player.y;
    const tx = clamp(fx0 - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(fy0 - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    cam.x += (tx - cam.x) * Math.min(1, dt * 5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 5);

    audio.setEngine(player.inCar ? Math.abs(player.car.speed) / 320 : 0, player.inCar);
    audio.setSiren(police.wanted > 0, game.time);
    input.endFrame();
  }

  function updateWalking(dt) {
    const sprint = input.down('Shift');
    const sp = sprint ? 235 : 150;
    let mx = 0, my = 0;
    if (input.down('w') || input.down('ArrowUp')) my -= 1;
    if (input.down('s') || input.down('ArrowDown')) my += 1;
    if (input.down('a') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('d') || input.down('ArrowRight')) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      player.x += (mx / len) * sp * dt;
      player.y += (my / len) * sp * dt;
      player.angle = Math.atan2(my, mx);
    }
    player.x = clamp(player.x, 24, WORLD_W - 24);
    player.y = clamp(player.y, 24, WORLD_H - 24);
    collideBuildings(city, player, 12);
    if (inWater(city, player.x, player.y)) player.y = 1796;

    // Pedestrian collision: shoving a pedestrian is a crime.
    for (const ped of traffic.peds) {
      if (Math.hypot(ped.x - player.x, ped.y - player.y) < 20) {
        ped.state = 'flee';
        ped.fleeT = 2;
        ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
        if (!player._hitPedAt || game.time - player._hitPedAt > 2) {
          player._hitPedAt = game.time;
          police.addCrime(14, 'Hit a pedestrian');
          fx.floatText(ped.x, ped.y - 20, 'PEDESTRIAN DOWN!', '#ef4444');
        }
      }
    }

    // Enter a car.
    const near = traffic.nearestCar(player.x, player.y, 64);
    game.nearCarHint = !!near;
    if (near && input.hit('e')) enterCar(near);
  }

  function updateDriving(dt) {
    const car = player.car;
    const fwd = input.down('w') || input.down('ArrowUp');
    const back = input.down('s') || input.down('ArrowDown');
    const left = input.down('a') || input.down('ArrowLeft');
    const right = input.down('d') || input.down('ArrowRight');
    const handbrake = input.down(' ');
    const accel = 260;
    if (fwd) car.speed += accel * dt;
    if (back) car.speed -= (car.speed > 4 ? 340 : 150) * dt;
    if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 120 * dt);
    car.speed = clamp(car.speed, -110, 330);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const grip = handbrake ? 0.45 : 1;
    car.angle += steer * 2.1 * dt * clamp(Math.abs(car.speed) / 90, 0, 1) * Math.sign(car.speed || 1) * grip;
    if (handbrake) car.speed *= Math.max(0, 1 - 1.6 * dt);
    car.brakeLight = back || handbrake;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const probe = { x: nx, y: ny };
    const hitWall = collideBuildings(city, probe, 18);
    if (hitWall) {
      if (Math.abs(car.speed) > 120) {
        damageCar(car, 10, car.x, car.y);
        police.addCrime(2, 'Reckless driving');
      }
      car.speed *= 0.4;
    } else {
      car.x = nx; car.y = ny;
    }
    car.x = clamp(car.x, 24, WORLD_W - 24);
    car.y = clamp(car.y, 24, 1796);
    player.x = car.x; player.y = car.y;

    // Running over a pedestrian: a crime, and the ped flees.
    for (const ped of traffic.peds) {
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 40) {
        ped.state = 'flee'; ped.fleeT = 3;
        ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
        if (!player._hitPedAt || game.time - player._hitPedAt > 2) {
          player._hitPedAt = game.time;
          police.addCrime(16, 'Hit a pedestrian');
          fx.floatText(ped.x, ped.y - 20, 'PEDESTRIAN DOWN!', '#ef4444');
          car.speed *= 0.7;
        }
      }
    }
    // Bumping traffic cars.
    for (const other of traffic.cars) {
      if (other === car || other.police) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 34 && d > 0.1) {
        const push = (34 - d) / 2;
        const ux = (other.x - car.x) / d, uy = (other.y - car.y) / d;
        other.x += ux * push; other.y += uy * push;
        if (Math.abs(car.speed) > 90) {
          damageCar(car, 4, other.x, other.y);
          other.parked = false;
        }
        car.speed *= 0.85;
      }
    }
    // Bumping cruisers damages both.
    for (const c of police.cruisers) {
      const d = Math.hypot(c.x - car.x, c.y - car.y);
      if (d < 36 && d > 0.1) {
        car.speed *= 0.6;
        c.speed *= 0.5;
        if (Math.abs(car.speed) > 60) damageCar(car, 3, c.x, c.y);
      }
    }
    if (input.hit('e')) exitCar();
  }

  // ---- rendering -------------------------------------------------------
  function render() {
    const W = VIEW_W, H = VIEW_H;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (game.screen === 'title' || game.screen === 'howto') {
      // Title over a live dusk city: camera drifts over Bay Square.
      const drift = 1280 + Math.sin(game.time * 0.05) * 260;
      game.cam.x = clamp(drift - W / 2, 0, WORLD_W - W);
      game.cam.y = clamp(960 - H / 2, 0, WORLD_H - H);
      ctx.translate(-game.cam.x, -game.cam.y);
      drawWorld(ctx, game, game.cam);
      for (const c of traffic.cars) if (!c.parked) drawCar(ctx, c);
      ctx.restore();
      applyLighting(ctx, game, W, H);
      if (game.screen === 'title') game.titleButtons = drawTitle(ctx, game, W, H);
      else drawHowTo(ctx, W, H);
      return;
    }
    const shake = fx.offset();
    ctx.translate(-Math.round(game.cam.x) + shake.x, -Math.round(game.cam.y) + shake.y);
    drawWorld(ctx, game, game.cam);
    for (const c of traffic.cars) drawCar(ctx, c);
    for (const c of police.cruisers) drawCar(ctx, c);
    for (const ped of traffic.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.bob);
    for (const e of combat.enemies) {
      if (e.dead) continue;
      drawPerson(ctx, e.x, e.y, e.angle, '#7f1d1d', game.time * 8, e.flash);
      // Enemy health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 16, e.y - 24, 32, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x - 15, e.y - 23, 30 * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
    combat.drawPickups(ctx);
    drawPlayer(ctx, game);
    // Staged combat flash: a live tracer + muzzle glow toward the nearest
    // gunman, so the combat screenshot shows the shooting in progress.
    if (game.combatFlash > 0) {
      let foe = null, bd = 1e12;
      for (const e of combat.enemies) {
        if (e.dead) continue;
        const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
        if (d < bd) { bd = d; foe = e; }
      }
      if (foe) {
        const a = Math.atan2(foe.y - player.y, foe.x - player.x);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(foe.x, foe.y); ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.arc(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    fx.draw(ctx);
    ctx.restore();
    applyLighting(ctx, game, W, H);
    drawMinimap(ctx, game, W, H);
    drawHud(ctx, game, W, H);
    if (game.screen === 'pause') game.pauseButtons = drawPause(ctx, game, W, H);
    if (game.screen === 'busted') drawGameOver(ctx, game, W, H, 'busted');
    if (game.screen === 'wasted') drawGameOver(ctx, game, W, H, 'wasted');
  }

  // ---- menu clicks -----------------------------------------------------
  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (game.screen === 'title' && game.titleButtons) {
      const mx = input.mouse.x, my = input.mouse.y;
      for (const b of game.titleButtons) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.id === 'howto') { game.screen = 'howto'; return; }
          if (b.id === 'continue') game.loadGame();
          else {
            game.screen = 'play';
            game.missions.setIndex(0);
            game.missions.startMission();
          }
          return;
        }
      }
    } else if (game.screen === 'howto') {
      game.screen = 'title';
    } else if (game.screen === 'pause' && game.pauseButtons) {
      const mx = input.mouse.x, my = input.mouse.y;
      for (const b of game.pauseButtons) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.id === 'resume') game.screen = 'play';
          if (b.id === 'save') game.saveGame(false);
          if (b.id === 'load') game.loadGame();
          if (b.id === 'restart') {
            game.missions.setIndex(0);
            player.money = 250; player.hp = 100; player.ammo = 48;
            player.x = PLACES.safehouse.x; player.y = PLACES.safehouse.y + 70;
            player.inCar = false; player.car = null;
            police.clear(); combat.clearEnemies();
            game.missions.startMission();
            game.screen = 'play';
          }
          if (b.id === 'mute') audio.setMuted(!audio.muted);
          if (b.id === 'title') game.screen = 'title';
          return;
        }
      }
    } else if (game.screen === 'busted' || game.screen === 'wasted') {
      // Wake up at the hospital, patched up, heat gone.
      player.hp = 100;
      player.x = PLACES.hospital.x; player.y = PLACES.hospital.y + 90;
      player.inCar = false; player.car = null;
      player.money = Math.max(0, player.money - 100);
      police.clear();
      game.screen = 'play';
    }
  });

  // ---- staged scenes for screenshots ----------------------------------
  game.stageShot = (shot) => {
    game.screen = 'play';
    game.dialogue = [];
    if (shot === 'start') {
      game.screen = 'title';
      game.clock = 17 * 60 + 40;
    } else if (shot === 'chase') {
      game.clock = 17 * 60 + 50;
      player.money = 1250;
      const car = traffic.nearestCar(PLACES.square.x, PLACES.square.y, 900) || traffic.cars[0];
      enterCarSilent(car);
      player.car.x = PLACES.square.x; player.car.y = PLACES.square.y;
      player.car.angle = 0; player.car.speed = 210;
      player.x = player.car.x; player.y = player.car.y;
      police.setHeat(60);
      police.syncCruisers(player);
      police.cruisers.forEach((c, i) => {
        c.x = player.car.x - 180 - i * 90;
        c.y = player.car.y + (i % 2 ? 60 : -60);
        c.angle = 0; c.speed = 220;
      });
      game.missions.setIndex(1);
      game.missions.startMission();
      game.dialogue = [];
      game.cam.x = clamp(player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
      game.cam.y = clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    } else if (shot === 'combat') {
      game.clock = 12 * 60;
      player.x = PLACES.warehouse.x - 160; player.y = PLACES.warehouse.y;
      player.ammo = 48; player.hp = 82;
      // startMission below spawns the warehouse crew; no extra spawn here.
      game.missions.setIndex(3);
      game.missions.startMission();
      game.dialogue = [];
      game.combatFlash = 0.9; // keep a tracer on screen for the capture
      game.cam.x = clamp(player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
      game.cam.y = clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    } else if (shot === 'night') {
      game.clock = 22 * 60 + 10;
      player.money = 3400;
      const car = traffic.nearestCar(PLACES.bank.x, PLACES.bank.y, 900) || traffic.cars[0];
      enterCarSilent(car);
      player.car.x = PLACES.bank.x; player.car.y = PLACES.bank.y + 120;
      player.car.angle = Math.PI / 2; player.car.speed = 160;
      player.x = player.car.x; player.y = player.car.y;
      police.setHeat(40);
      police.syncCruisers(player);
      game.missions.setIndex(4);
      game.missions.startMission();
      game.dialogue = [];
      game.cam.x = clamp(player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
      game.cam.y = clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    }
    function enterCarSilent(car) {
      player.inCar = true; player.car = car;
      car.parked = false; car.traffic = false; car.stolen = true; car.speed = 0;
    }
  };

  // ---- main loop --------------------------------------------------------
  let last = performance.now();
  let raf = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.frame++;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  game.start = () => { raf = requestAnimationFrame(frame); };
  game.stop = () => cancelAnimationFrame(raf);
  game.updateOnce = (dt) => update(dt);
  game.renderOnce = () => render();

  return game;
}
