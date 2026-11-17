// Neon Bay — the game itself: state, the main loop, driving and walking,
// stealing cars, the camera, menus, save/load and the ?shot= staging used
// for screenshots. All original: a fictional city, story and characters.
import { buildCity, pushOutOfBuildings, nearestRoadPoint } from './city.js';
import { makeRng } from './rng.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { sound } from './audio.js';
import { spawnTraffic, spawnParkedCars, spawnPedestrians, updateTraffic, updatePedestrians } from './traffic.js';
import { updatePolice, raiseWanted } from './police.js';
import { shootAt, punch, updateEnemies, reloadPlayer } from './combat.js';
import { MISSIONS, currentMission, currentStep, startMission, updateMissions, setSaveHook } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitleScreen, drawPauseScreen, drawGameOverScreen } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';

export function createState(seed) {
  const city = buildCity(seed);
  const rng = makeRng(seed * 7 + 13);
  const state = {
    seed, city, rng,
    time: 0, clock: 600, // 10:00
    screen: 'title', // title | playing | paused | over
    player: {
      x: city.spots.spawn.x, y: city.spots.spawn.y, angle: -Math.PI / 2,
      hp: 100, ammo: 12, r: 13, shootCooldown: 0, punchCooldown: 0, reloadTimer: 0,
    },
    playerCar: null, cars: [], peds: [], enemies: [], tracers: [], pickups: [],
    effects: new Effects(),
    wanted: 0, wantedTimer: 0, arrestTimer: 0,
    money: 250, missionIndex: 0, stepIndex: 0, stepTimer: 0, holdTimer: 0,
    objective: '', objectiveTarget: null, dialogue: null,
    message: '', messageTimer: 0, busted: false, wasted: false, storyComplete: false,
    stats: { kills: 0, pedsHit: 0, carsStolen: 0, missionsDone: 0 },
    shotsFiredAt: 0, camera: { x: city.spots.spawn.x, y: city.spots.spawn.y },
    showHelp: false, hasSave: hasSave(), muted: false, saveNote: '',
  };
  state.cars = [...spawnParkedCars(city, rng), ...spawnTraffic(city, rng, 14)];
  state.peds = spawnPedestrians(city, rng, 26);
  const spots = city.spots;
  state.pickups = [
    { x: spots.hospital.x + 40, y: spots.hospital.y, kind: 'health', taken: false },
    { x: spots.square.x, y: spots.square.y + 40, kind: 'health', taken: false },
    { x: spots.docks.x - 40, y: spots.docks.y, kind: 'ammo', taken: false },
    { x: spots.beach.x - 60, y: spots.beach.y, kind: 'ammo', taken: false },
    { x: spots.club.x + 50, y: spots.club.y, kind: 'health', taken: false },
  ];
  return state;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.freshState(7);
    this.menuButtons = [];
    this._last = 0; this._frames = 0; this._shotReadyAt = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    setSaveHook(() => this.doSave(true));
    this.applyShotFromURL();
    requestAnimationFrame((t) => this.loop(t));
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  // Fresh state with the input device attached (HUD and render read it off state).
  freshState(seed) {
    this.state = createState(seed);
    this.state.input = this.input;
    return this.state;
  }
  view() {
    return { w: this.canvas.width, h: this.canvas.height, camX: this.state.camera.x, camY: this.state.camera.y };
  }
  doSave(silent) {
    const ok = saveGame(this.state);
    this.state.saveNote = ok ? 'Saved.' : 'Save failed — browser storage unavailable.';
    this.state.hasSave = hasSave();
    if (!silent) this.state.message = this.state.saveNote;
    return ok;
  }
  doLoad() {
    const data = loadGame();
    if (!data) { this.state.saveNote = 'No save found.'; return false; }
    const s = this.state;
    s.money = data.money; s.player.hp = data.hp; s.player.ammo = data.ammo;
    s.missionIndex = data.missionIndex; s.stepIndex = data.stepIndex;
    s.wanted = data.wanted; s.clock = data.clock;
    s.player.x = data.px; s.player.y = data.py;
    s.storyComplete = data.storyComplete; s.stats = data.stats || s.stats;
    s.playerCar = null; s.enemies = []; s.wantedTimer = 0; s.arrestTimer = 0;
    s.busted = false; s.wasted = false; s.screen = 'playing';
    s.objective = MISSIONS[s.missionIndex] ? MISSIONS[s.missionIndex].steps[s.stepIndex].text : 'Free roam';
    s.message = 'Save loaded.'; s.messageTimer = 2.5;
    return true;
  }
  newGame() {
    this.freshState(7);
    this.state.screen = 'playing';
    startMission(this.state, 0);
    sound.ensure(); sound.startMusic();
  }
  startFromSave() {
    this.freshState(7);
    if (this.doLoad()) { sound.ensure(); sound.startMusic(); }
    else this.state.screen = 'title';
  }
  // ---- ?shot= staging: fixed scenes so screenshots are reproducible ----
  applyShotFromURL() {
    const q = new URLSearchParams(window.location.search);
    const shot = q.get('shot');
    if (!shot) return;
    const seed = Number(q.get('seed') || 7);
    this.freshState(seed);
    const s = this.state, spots = s.city.spots;
    const putInCar = (x, y, angle) => {
      const car = s.cars.find((c) => c.kind === 'parked') || s.cars[0];
      car.x = x; car.y = y; car.angle = angle; car.kind = 'stolen'; car.speed = 0; car.hp = 100;
      s.playerCar = car; s.player.x = x; s.player.y = y;
    };
    if (shot === 'start') {
      s.screen = 'title'; s.clock = 17 * 60 + 20; s.camera.x = 1200; s.camera.y = 920;
    } else if (shot === 'chase') {
      s.screen = 'playing'; s.clock = 18 * 60 + 10;
      putInCar(1200, 920, 0); s.playerCar.speed = 210;
      s.wanted = 3; s.missionIndex = 1; s.stepIndex = 0;
      s.objective = MISSIONS[1].steps[0].text;
      for (let i = 0; i < 3; i++) {
        const spot = nearestRoadPoint(1200 + (i - 1) * 260, 920 + (i % 2 ? 180 : -180));
        s.cars.push({ kind: 'police', x: spot.x, y: spot.y, angle: 0, speed: 240, r: 20, color: '#1c2733', targetSpeed: 320, hp: 120, smoke: 0 });
      }
    } else if (shot === 'combat') {
      s.screen = 'playing'; s.clock = 12 * 60;
      s.player.x = spots.warehouse.x - 90; s.player.y = spots.warehouse.y; s.player.angle = 0;
      s.missionIndex = 3; s.stepIndex = 2; s.wanted = 2;
      s.objective = MISSIONS[3].steps[2].text;
      for (let i = 0; i < 3; i++) {
        s.enemies.push({ x: spots.warehouse.x + 30 + i * 46, y: spots.warehouse.y - 60 + i * 55, angle: Math.PI, hp: 100, cooldown: 1 + i, r: 13, color: '#8e44ad', speed: 95 });
      }
      s.dialogue = { lines: ['MARA: There they are. Take them down, Rook.'], idx: 0, timer: 0 };
    } else if (shot === 'night') {
      s.screen = 'playing'; s.clock = 21 * 60 + 30;
      putInCar(1520, 920, Math.PI / 2); s.playerCar.speed = 190;
      s.wanted = 1; s.missionIndex = 4; s.stepIndex = 0;
      s.objective = MISSIONS[4].steps[0].text;
    }
    this._shotReadyAt = performance.now() + 700;
  }
  // ---- entering / leaving cars ----
  nearestCar(maxD) {
    let best = null, bestD = maxD;
    for (const car of this.state.cars) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.x - this.state.player.x, car.y - this.state.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
  enterCar() {
    const s = this.state;
    const car = this.nearestCar(58);
    if (!car) { s.message = 'No car close enough.'; s.messageTimer = 1.2; return; }
    if (car.kind === 'traffic') {
      raiseWanted(s, 1, 'stole a car in traffic');
      s.stats.carsStolen += 1;
      s.message = 'Car jacked! The driver ran for it.'; s.messageTimer = 2;
    } else if (car.kind === 'parked') {
      const nearCop = s.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - car.x, c.y - car.y) < 600);
      if (nearCop) raiseWanted(s, 1, 'stole a car in front of the police');
      s.stats.carsStolen += 1;
      s.message = 'Hot-wired. It\'s yours now.'; s.messageTimer = 2;
    }
    car.kind = 'stolen';
    s.playerCar = car;
    s.player.x = car.x; s.player.y = car.y;
    sound.ensure(); sound.click();
  }
  exitCar() {
    const s = this.state;
    const car = s.playerCar;
    if (!car) return;
    car.speed = 0;
    s.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    s.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    s.player.angle = car.angle;
    s.playerCar = null;
    pushOutOfBuildings(s.player, s.city);
  }
  // ---- per-frame update ----
  update(dt) {
    const s = this.state, input = this.input;
    s.time += dt;
    s.clock = (s.clock + dt * 0.5) % 1440;
    if (s.shotsFiredAt > 0) s.shotsFiredAt -= dt;
    if (s.messageTimer > 0) s.messageTimer -= dt;
    for (const t of s.tracers) t.life -= dt;
    s.tracers = s.tracers.filter((t) => t.life > 0);
    s.effects.update(dt);
    // Dialogue advance (remember it was open: the same E press must not also steal a car).
    const hadDialogue = !!s.dialogue;
    if (s.dialogue) {
      s.dialogue.timer += dt;
      if (input.wasPressed('KeyE') || input.wasPressed('Enter') || input.mouse.clicked || s.dialogue.timer > 6) {
        s.dialogue.idx += 1; s.dialogue.timer = 0;
        if (s.dialogue.idx >= s.dialogue.lines.length) s.dialogue = null;
      }
      if (hadDialogue) input.mouse.clicked = false; // the click dismissed dialogue; it must not also fire a shot
    }
    if (input.wasPressed('KeyM')) { s.muted = sound.toggleMute(); }
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      s.screen = s.screen === 'playing' ? 'paused' : s.screen === 'paused' ? 'playing' : s.screen;
    }
    if (input.wasPressed('KeyS') && s.screen === 'playing') this.doSave(false);
    if (s.screen !== 'playing') return;
    const p = s.player;
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.reloadTimer > 0) { p.reloadTimer -= dt; if (p.reloadTimer <= 0) p.ammo = 12; }
    if (input.wasPressed('KeyR')) reloadPlayer(s);
    // Driving or walking.
    if (s.playerCar) this.updateCar(dt); else this.updateOnFoot(dt);
    if (input.wasPressed('KeyE') && !hadDialogue) {
      if (s.playerCar) this.exitCar(); else this.enterCar();
    }
    updateTraffic(s, dt);
    updatePedestrians(s, dt);
    updatePolice(s, dt);
    updateEnemies(s, dt);
    updateMissions(s, dt);
    // Mission marker for the minimap and the world beacon.
    const step = currentStep(s);
    s.objectiveTarget = step && step.target ? s.city.spots[step.target] : null;
    // Pickups.
    for (const pk of s.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
        pk.taken = true; sound.pickup();
        if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); s.effects.addText(p.x, p.y, '+40 HP', '#2ecc71'); }
        else { p.ammo = 12; s.effects.addText(p.x, p.y, 'AMMO FULL', '#f1c40f'); }
      }
    }
    // Health regen when the heat is off.
    if (s.wanted === 0 && p.hp > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 3 * dt);
    // Car wrecked under the player.
    if (s.playerCar && s.playerCar.hp <= 0) {
      s.effects.burst(s.playerCar.x, s.playerCar.y, '#e67e22', 26, 220);
      s.effects.addShake(8); sound.crash();
      s.player.hp -= 15; s.playerCar = null;
    }
    if (p.hp <= 0) { s.wasted = true; s.screen = 'over'; sound.busted(); }
    if (s.busted) { s.screen = 'over'; sound.busted(); }
    // Camera follows the player (or the car).
    const tx = s.playerCar ? s.playerCar.x : p.x, ty = s.playerCar ? s.playerCar.y : p.y;
    s.camera.x += (tx - s.camera.x) * Math.min(1, dt * 5);
    s.camera.y += (ty - s.camera.y) * Math.min(1, dt * 5);
    sound.setEngine(s.playerCar ? Math.abs(s.playerCar.speed) / 340 : 0);
  }
  updateOnFoot(dt) {
    const s = this.state, p = s.player, input = this.input;
    const ax = input.axis();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 260 : 165;
    if (ax.x || ax.y) {
      const len = Math.hypot(ax.x, ax.y);
      p.x += (ax.x / len) * speed * dt;
      p.y += (ax.y / len) * speed * dt;
      p.angle = Math.atan2(ax.y, ax.x);
    }
    // Aim at the mouse while firing.
    if (input.mouse.down || input.mouse.clicked) {
      const wx = s.camera.x - this.canvas.width / 2 + input.mouse.x;
      const wy = s.camera.y - this.canvas.height / 2 + input.mouse.y;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
      if (input.mouse.clicked) shootAt(s, wx, wy);
    }
    if (input.wasPressed('KeyF')) punch(s);
    pushOutOfBuildings(p, s.city);
  }
  updateCar(dt) {
    const s = this.state, car = s.playerCar, input = this.input;
    const ax = input.axis();
    const maxSpeed = 340, maxReverse = 130;
    if (ax.y < 0) car.speed += 300 * dt;
    else if (ax.y > 0) car.speed -= 260 * dt;
    else car.speed -= Math.sign(car.speed) * 140 * dt;
    if (input.down('Space')) car.speed -= Math.sign(car.speed) * 420 * dt;
    car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
    if (Math.abs(car.speed) < 4 && !ax.y) car.speed = 0;
    const steer = ax.x * Math.min(1, Math.abs(car.speed) / 90) * 2.6 * (car.speed < 0 ? -1 : 1);
    car.angle += steer * dt * (input.down('Space') ? 1.5 : 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.hitBuilding = false;
    pushOutOfBuildings(car, s.city);
    if (car.hitBuilding) {
      const lost = Math.abs(car.speed);
      if (lost > 180) { sound.crash(); s.effects.addShake(6); car.hp -= 12; s.effects.burst(car.x, car.y, '#f1c40f', 8, 120); }
      car.speed *= 0.45;
    }
    // Bumping other cars slows both down.
    for (const other of s.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 42 && d > 0.1) {
        const push = (42 - d) / 2;
        const nx = (other.x - car.x) / d, ny = (other.y - car.y) / d;
        other.x += nx * push; other.y += ny * push;
        if (other.kind !== 'parked') other.speed = Math.max(0, other.speed - 40);
      }
    }
    s.player.x = car.x; s.player.y = car.y; s.player.angle = car.angle;
    if (input.mouse.clicked) {
      const wx = s.camera.x - this.canvas.width / 2 + input.mouse.x;
      const wy = s.camera.y - this.canvas.height / 2 + input.mouse.y;
      shootAt(s, wx, wy);
    }
  }
  // ---- menus ----
  clickButton(id) {
    const s = this.state;
    sound.ensure(); sound.click();
    if (id === 'new') this.newGame();
    else if (id === 'continue') this.startFromSave();
    else if (id === 'how') { s.showHelp = !s.showHelp; }
    else if (id === 'resume') s.screen = 'playing';
    else if (id === 'save') this.doSave(false);
    else if (id === 'load') { if (this.doLoad()) s.screen = 'playing'; }
    else if (id === 'restart') this.newGame();
    else if (id === 'mute') { s.muted = sound.toggleMute(); }
    else if (id === 'respawn') {
      s.money = Math.max(0, s.money - 150);
      s.player.hp = 100; s.player.x = s.city.spots.hospital.x; s.player.y = s.city.spots.hospital.y;
      s.playerCar = null; s.wanted = 0; s.busted = false; s.wasted = false;
      s.enemies = []; s.screen = 'playing';
      s.message = 'Patched up at St. Marina. Back to work.'; s.messageTimer = 3;
    }
  }
  handleMenuClick() {
    const { x, y } = this.input.mouse;
    for (const b of this.menuButtons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.clickButton(b.id); return; }
    }
  }
  loop(t) {
    const dt = Math.min(0.05, (t - this._last) / 1000 || 0.016);
    this._last = t;
    const s = this.state;
    if (s.screen === 'title') {
      // Slow pan over the city behind the title.
      s.camera.x = 1200 + Math.sin(t / 9000) * 500;
      s.camera.y = 920 + Math.cos(t / 11000) * 300;
      s.time += dt;
      if (this.input.mouse.clicked) this.handleMenuClick();
      if (this.input.wasPressed('Enter')) this.newGame();
    } else if (s.screen === 'paused' || s.screen === 'over') {
      if (this.input.mouse.clicked) this.handleMenuClick();
      if (s.screen === 'paused' && (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape'))) s.screen = 'playing';
    } else {
      this.update(dt);
    }
    this.render();
    this.input.endFrame();
    this._frames += 1;
    if (this._shotReadyAt && performance.now() > this._shotReadyAt && this._frames > 5) {
      window.__shotReady = true;
    }
    requestAnimationFrame((nt) => this.loop(nt));
  }
  render() {
    const s = this.state;
    const ctx = this.ctx;
    const view = this.view();
    ctx.clearRect(0, 0, view.w, view.h);
    // Camera shake offset.
    const sh = s.effects.offset();
    const v = { ...view, camX: view.camX + sh.x, camY: view.camY + sh.y };
    drawWorld(ctx, s, v);
    if (s.screen === 'playing' || s.screen === 'paused') drawHUD(ctx, s, view);
    if (s.screen === 'title') drawTitleScreen(ctx, s, view, this.menuButtons);
    else if (s.screen === 'paused') drawPauseScreen(ctx, s, view, this.menuButtons);
    else if (s.screen === 'over') drawGameOverScreen(ctx, s, view, this.menuButtons);
  }
}
