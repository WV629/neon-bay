// The wanted system: stars rise when the player is seen committing crimes,
// police cars spawn and chase, and the heat fades once the player is out of
// sight long enough. Arrest ends the run if a cruiser pins the player down.
import { nearestRoadPoint } from './city.js';
import { sound } from './audio.js';

export function raiseWanted(state, stars, reason) {
  const before = state.wanted;
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedTimer = 0;
  if (state.wanted > before) {
    state.message = `WANTED ${'★'.repeat(state.wanted)} — ${reason}`;
    state.messageTimer = 3;
    if (state.wanted >= 2) state.effects.addShake(3);
  }
}

export function updatePolice(state, dt) {
  const playerPos = state.playerCar || state.player;
  // Spawn cruisers up to the wanted level (capped at 4 active).
  const wantCount = Math.min(4, state.wanted);
  const police = state.cars.filter((c) => c.kind === 'police');
  if (police.length < wantCount && state.wanted > 0) {
    const spot = nearestRoadPoint(playerPos.x + (Math.random() - 0.5) * 900, playerPos.y + (Math.random() - 0.5) * 900);
    const angle = Math.atan2(playerPos.y - spot.y, playerPos.x - spot.x);
    state.cars.push({
      kind: 'police', x: spot.x, y: spot.y, angle, speed: 0, r: 20,
      color: '#1c2733', targetSpeed: 300, hp: 120, smoke: 0, siren: 0,
    });
  }
  // Despawn cruisers that fell far behind once the heat is gone.
  if (state.wanted === 0) {
    for (let i = state.cars.length - 1; i >= 0; i--) {
      const c = state.cars[i];
      if (c.kind === 'police' && Math.hypot(c.x - playerPos.x, c.y - playerPos.y) > 900) state.cars.splice(i, 1);
    }
  }
  let nearestPolice = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const d = Math.hypot(car.x - playerPos.x, car.y - playerPos.y);
    nearestPolice = Math.min(nearestPolice, d);
    // Steer toward the player, with a little wobble so chases look alive.
    const wantAngle = Math.atan2(playerPos.y - car.y, playerPos.x - car.x) + Math.sin(state.time * 1.7 + car.x) * 0.08;
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const target = state.wanted >= 3 ? 330 : 290;
    car.speed += (target - car.speed) * dt * 0.9;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.siren += dt;
    // Ram the player's car; on foot, pin the player to arrest them.
    if (d < 46) {
      if (state.playerCar) {
        state.playerCar.hp -= 14 * dt;
        state.player.hp -= 2 * dt;
        state.effects.addShake(2);
        if (Math.random() < dt * 3) sound.crash();
      } else {
        state.arrestTimer += dt;
        state.message = `BUSTED IN ${Math.max(0, 2.5 - state.arrestTimer).toFixed(1)}s — RUN!`;
        state.messageTimer = 0.5;
        if (state.arrestTimer > 2.5) { state.busted = true; }
      }
    } else {
      state.arrestTimer = Math.max(0, state.arrestTimer - dt * 2);
    }
    if (car.hp < 40 && Math.random() < dt * 2) state.effects.smoke(car.x, car.y);
  }
  // Heat decays only when no cruiser can see the player.
  if (state.wanted > 0 && nearestPolice > 650) {
    state.wantedTimer += dt;
    if (state.wantedTimer > 9) { state.wanted -= 1; state.wantedTimer = 0; state.message = 'Heat cooling off…'; state.messageTimer = 2; }
  } else if (nearestPolice <= 650) {
    state.wantedTimer = 0;
  }
  sound.setSiren(state.wanted > 0 && nearestPolice < 900);
}
