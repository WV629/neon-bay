// Neon Bay — entry point. Boots the canvas, reads the ?shot= and ?seed=
// query params the screenshot tool uses, and exposes a small debug handle
// (window.__neonbay) the playtest drives: state, save/load and staging.
import { createGame } from './game.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1337) || 1337;
const shot = params.get('shot') || null;

const canvas = document.getElementById('game');
const game = createGame(canvas, { seed, shot });

// Resize the canvas backing store to the window while keeping the game's
// 1280x800 logical view; input maps mouse coords through the rect.
function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
  canvas.style.width = `${Math.floor(1280 * scale)}px`;
  canvas.style.height = `${Math.floor(800 * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

if (shot) {
  game.stageShot(shot);
  // Let a few frames run so traffic, lighting and the HUD settle.
  let warm = 0;
  const warmTimer = setInterval(() => {
    game.updateOnce(1 / 60);
    game.renderOnce();
    warm++;
    if (warm >= 5) {
      clearInterval(warmTimer);
      window.__shotReady = true;
    }
  }, 50);
} else {
  window.__shotReady = false;
  // The title screen is ready as soon as the first frame paints.
  setTimeout(() => { window.__shotReady = true; }, 400);
}

game.start();

// Debug handle for scripted playtests (and nothing else reads it).
window.__neonbay = {
  game,
  state() {
    const p = game.player;
    return {
      screen: game.screen,
      money: p.money,
      hp: p.hp,
      ammo: p.ammo,
      x: Math.round(p.x),
      y: Math.round(p.y),
      inCar: p.inCar,
      wanted: game.police.wanted,
      heat: Math.round(game.police.heat),
      mission: game.missions.index,
      missionTitle: game.missions.current() ? game.missions.current().title : null,
      timer: Math.round(game.missions.timer),
      enemies: game.combat.enemies.filter((e) => !e.dead).length,
      cruisers: game.police.cruisers.length,
      cars: game.traffic.cars.length,
      peds: game.traffic.peds.length,
      clock: Math.round(game.clock),
      dialogue: game.dialogue.length,
    };
  },
  // Drive the game without real keys: used by the scripted playtest.
  press(key) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  },
  hold(key, down) {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key }));
  },
  clickAt(x, y) {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: r.left + x * (r.width / canvas.width),
      clientY: r.top + y * (r.height / canvas.height),
      button: 0, bubbles: true,
    }));
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  },
  teleport(x, y) {
    game.player.x = x;
    game.player.y = y;
    if (game.player.inCar && game.player.car) {
      game.player.car.x = x;
      game.player.car.y = y;
    }
  },
  setWanted(stars) { game.police.setHeat(stars * 20); },
  startMission(i) {
    game.missions.setIndex(i);
    game.screen = 'play';
    game.missions.startMission();
    game.dialogue = [];
  },
};
