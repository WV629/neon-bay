// Neon Bay — the story. Five jobs for Mara Voss, the fixer who runs the
// Bay from a back room above Club Neon Reef. Each mission is a small
// state machine: an objective, a target point, a timer where the job
// needs one, and dialogue that plays when it starts and ends.
import { PLACES } from './city.js';
import { fmtMoney } from './rng.js';

export const MISSIONS = [
  {
    id: 1, title: 'Hot Wheels', payout: 400,
    brief: 'Mara needs a ride. Steal any car and bring it to the Docks.',
    intro: [
      ['MARA VOSS', 'New in town, huh? I run the jobs in Neon Bay. First one is easy.'],
      ['MARA VOSS', 'Take any car off the street — press E next to one — and bring it to the Docks.'],
    ],
    done: [['MARA VOSS', 'Clean work. The buyer paid. Four hundred is yours.']],
  },
  {
    id: 2, title: 'Bayfront Run', payout: 600, timeLimit: 100,
    brief: 'A package for the club. Drive it to Club Neon Reef in 100 seconds.',
    intro: [
      ['MARA VOSS', 'A package needs to reach Club Neon Reef. Fast. You have 100 seconds.'],
      ['MARA VOSS', 'Get in a car and drive. Do not stop to admire the view.'],
    ],
    done: [['MARA VOSS', 'Right on time. The club owes me one — and you six hundred.']],
  },
  {
    id: 3, title: 'Heat Check', payout: 900,
    brief: 'The crew needs to know you can handle heat. Reach 2 stars, then lose the cops.',
    intro: [
      ['MARA VOSS', 'Cops in this town are bought, but they still chase. Prove you can shake them.'],
      ['MARA VOSS', 'Get to 2 wanted stars, then lose the heat completely.'],
    ],
    done: [['MARA VOSS', 'Ghost. Not a single cruiser left. Nine hundred, and my respect.']],
  },
  {
    id: 4, title: 'Warehouse War', payout: 1500,
    brief: 'Kaine’s crew moved into the warehouse. Take out all 3 gunmen.',
    intro: [
      ['MARA VOSS', 'Kaine’s crew took my warehouse. Three gunmen inside. Make it empty.'],
      ['MARA VOSS', 'Aim with the mouse, click to shoot. Punch with F if they get close.'],
    ],
    done: [['MARA VOSS', 'Warehouse is mine again. Fifteen hundred — spend it loud.']],
  },
  {
    id: 5, title: 'Bayfront Bank', payout: 2500,
    brief: 'The big one. Reach the bank, then escape at 3 stars to the safehouse.',
    intro: [
      ['MARA VOSS', 'Bayfront Bank. In, out, and gone before the cruisers box you in.'],
      ['MARA VOSS', 'Get to the bank, grab the cash, then lose 3 stars at the safehouse.'],
    ],
    done: [['MARA VOSS', 'Twenty-five hundred. Neon Bay is yours now, kid. Come back when you want more.']],
  },
];

export function makeMissions(game) {
  let index = 0; // which mission is active (0-based); 5 means story done
  let phase = 'toTarget'; // toTarget | escape | done
  let timer = 0;
  let reachedTwoStars = false;
  let crewLeft = 0;
  let failed = false;
  let lastNag = -99; // last game-time a nag line was shown; nags are throttled

  // A nag line (e.g. "still hot") must never use the blocking dialogue
  // box: dialogue freezes the world, and a nag that re-fires while the
  // player waits for heat to decay would freeze the game forever. Nags
  // are floating hints instead, throttled to one every few seconds.
  function nag(lines) {
    if (game.time - lastNag < 4) return;
    lastNag = game.time;
    game.fx.floatText(game.player.x, game.player.y - 34, lines[0][1], '#facc15');
  }

  function current() { return MISSIONS[index] ?? null; }
  function target() {
    const m = current();
    if (!m) return null;
    if (m.id === 1) return { ...PLACES.docks, radius: 90 };
    if (m.id === 2) return { ...PLACES.club, radius: 80 };
    if (m.id === 3) return null;
    if (m.id === 4) return { ...PLACES.warehouse, radius: 130 };
    if (m.id === 5) {
      return phase === 'escape'
        ? { ...PLACES.safehouse, radius: 80 }
        : { ...PLACES.bank, radius: 80 };
    }
    return null;
  }
  function statusLine() {
    const m = current();
    if (!m) return 'Story complete — Neon Bay is yours. Free roam!';
    if (m.id === 3) {
      if (!reachedTwoStars) return 'Reach 2 wanted stars';
      return 'Now lose the heat completely';
    }
    if (m.id === 4) return `Defeat the warehouse crew (${crewLeft} left)`;
    if (m.id === 5 && phase === 'escape') return 'Escape at 3 stars to the safehouse';
    return m.brief;
  }

  function startMission() {
    const m = current();
    if (!m) return;
    phase = 'toTarget';
    timer = m.timeLimit ?? 0;
    failed = false;
    reachedTwoStars = false;
    crewLeft = 0;
    game.say(m.intro);
    if (m.id === 4) {
      const made = game.combat.spawnCrew(PLACES.warehouse.x, PLACES.warehouse.y, 3);
      crewLeft = made.length;
    }
    game.fx.floatText(game.player.x, game.player.y - 30, m.title, '#facc15');
  }

  function complete() {
    const m = current();
    if (!m) return;
    game.player.money += m.payout;
    game.audio.cash();
    game.audio.mission();
    game.say(m.done);
    game.fx.floatText(game.player.x, game.player.y - 40, `+${fmtMoney(m.payout)}`, '#a3e635');
    game.saveGame(true);
    index++;
    if (current()) startMission();
    else game.say([['MARA VOSS', 'That is all five jobs. The city is yours — go enjoy it.']]);
  }

  function fail(reason) {
    failed = true;
    game.say([['MARA VOSS', reason]]);
    game.audio.busted();
    // Restart the same mission after the player reads the line.
    setTimeout(() => { if (game.missions === api) startMission(); }, 1200);
  }

  const api = {
    get index() { return index; },
    get phase() { return phase; },
    get timer() { return timer; },
    get failed() { return failed; },
    current, target, statusLine, startMission, complete,
    setIndex(i) { index = Math.max(0, Math.min(MISSIONS.length, i)); },
    setCrewLeft(n) { crewLeft = n; },
    update(dt) {
      const m = current();
      if (!m) return;
      const p = game.player;
      if (m.timeLimit) {
        timer -= dt;
        if (timer <= 0) { fail('Too slow. The package went to someone else. Try again.'); return; }
      }
      if (m.id === 3) {
        if (!reachedTwoStars && game.police.wanted >= 2) reachedTwoStars = true;
        if (reachedTwoStars && game.police.wanted === 0) { complete(); return; }
      }
      if (m.id === 4) {
        crewLeft = game.combat.enemies.filter((e) => !e.dead).length;
        const near = Math.hypot(p.x - PLACES.warehouse.x, p.y - PLACES.warehouse.y) < 260;
        if (near && crewLeft === 0) { complete(); return; }
      }
      const t = target();
      if (t && m.id !== 3 && m.id !== 4) {
        const px = p.inCar ? p.car.x : p.x;
        const py = p.inCar ? p.car.y : p.y;
        if (Math.hypot(px - t.x, py - t.y) < t.radius) {
          if (m.id === 1) {
            if (!p.inCar) { nag([['MARA VOSS', 'Get back in the car — the Docks want the car, not you.']]); return; }
            complete(); return;
          }
          if (m.id === 2) { complete(); return; }
          if (m.id === 5) {
            if (phase === 'toTarget') {
              p.money += 0;
              phase = 'escape';
              game.police.setHeat(60); // 3 stars the moment the vault opens
              game.say([
                ['MARA VOSS', 'Vault is open. Cops are coming — 3 stars and climbing.'],
                ['MARA VOSS', 'Lose them at the safehouse. Do not get caught.'],
              ]);
              game.audio.mission();
              return;
            }
            if (game.police.wanted === 0) { complete(); return; }
            nag([['MARA VOSS', 'Still hot. Shake the cruisers first, then come home.']]);
            return;
          }
        }
      }
    },
  };
  return api;
}
