// Neon Bay bootstrap: create the game on the canvas and expose a small
// read-only handle for playtesting (state snapshots, never a cheat menu).
import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

window.__neonbay = {
  game,
  version: '1.0.0',
  state() {
    const s = game.state;
    return {
      screen: s.screen, money: s.money, hp: Math.round(s.player.hp),
      ammo: s.player.ammo, wanted: s.wanted, clock: Math.round(s.clock),
      mission: s.missionIndex, step: s.stepIndex, objective: s.objective,
      inCar: !!s.playerCar, x: Math.round(s.player.x), y: Math.round(s.player.y),
      cars: s.cars.length, peds: s.peds.length, enemies: s.enemies.filter((e) => e.hp > 0).length,
      kills: s.stats.kills, missionsDone: s.stats.missionsDone,
    };
  },
};

window.__shotReady = false;
