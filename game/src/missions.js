// The story: five missions for Rook, a getaway driver back in Neon Bay, with
// objectives, dialogue, payouts and a finale. Each step is one clear check.
import { spawnEnemies } from './combat.js';
import { raiseWanted } from './police.js';
import { sound } from './audio.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: '1 · First Wheels', giver: 'Mara Voss',
    intro: [
      'MARA: Rook. You\'re back in Neon Bay. Good — I need wheels, not memories.',
      'MARA: Steal a car — any car — and bring it to the Docks. Don\'t get cute.',
    ],
    steps: [
      { kind: 'inCar', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'reach', target: 'docks', radius: 90, text: 'Drive to the Docks' },
    ],
    payout: 400,
    outro: ['MARA: Clean. The crew\'s talking about you already.', 'MARA: Next job pays better. Much better.'],
  },
  {
    id: 'the-drop', title: '2 · The Drop', giver: 'Mara Voss',
    intro: [
      'MARA: A package for Club Neon Reef. The buyer waits 100 seconds, then walks.',
      'MARA: Drive fast, drive straight, and don\'t stop for anyone.',
    ],
    steps: [
      { kind: 'reach', target: 'club', radius: 90, text: 'Deliver the package to Club Neon Reef', timeLimit: 100 },
    ],
    payout: 700,
    outro: ['MARA: Delivered. The Reef owes us now.', 'MARA: Word is Dario Kaine noticed. Watch your back.'],
  },
  {
    id: 'heat', title: '3 · Heat on the Strip', giver: 'Mara Voss',
    intro: [
      'MARA: Kaine\'s crew needs a distraction, and you\'re it.',
      'MARA: Make some noise — get the cops to 2 stars — then lose them. All of them.',
    ],
    steps: [
      { kind: 'wanted', value: 2, text: 'Raise your wanted level to ★★ (steal cars, hit things, shoot)' },
      { kind: 'loseWanted', text: 'Lose the cops — get back to 0 stars' },
    ],
    payout: 900,
    outro: ['MARA: Beautiful chaos. Kaine\'s boys walked right past the cops.', 'MARA: You\'re officially the loudest driver in Neon Bay.'],
  },
  {
    id: 'brawl', title: '4 · Bayfront Brawl', giver: 'Mara Voss',
    intro: [
      'MARA: Kaine sent his crew to the warehouse to lean on our dock workers.',
      'MARA: Go to the warehouse. On foot. Settle it.',
    ],
    steps: [
      { kind: 'reach', target: 'warehouse', radius: 110, text: 'Go to Kaine Warehouse (on foot works best)' },
      { kind: 'spawnEnemies', count: 3, text: 'Take down all 3 of Kaine\'s crew' },
      { kind: 'killAll', text: 'Take down all 3 of Kaine\'s crew' },
    ],
    payout: 1200,
    outro: ['MARA: The docks are ours again. Kaine is furious.', 'MARA: One last job. The big one. Meet me at the bank.'],
  },
  {
    id: 'big-score', title: '5 · The Big Score', giver: 'Mara Voss',
    intro: [
      'MARA: Bayfront Bank. In, grab the cash, out. Kaine\'s crew tips the cops — expect heat.',
      'MARA: When the vault\'s open, run for the safehouse. Don\'t stop for anything.',
    ],
    steps: [
      { kind: 'reach', target: 'bank', radius: 100, text: 'Get to Bayfront Bank' },
      { kind: 'hold', target: 'bank', radius: 80, seconds: 3, text: 'Grab the cash — stay in the bank zone' },
      { kind: 'reach', target: 'safehouse', radius: 100, text: 'Escape to the Safehouse (3★ heat!)' },
    ],
    payout: 2500,
    outro: ['MARA: We did it, Rook. The whole bay is ours tonight.', '— STORY COMPLETE — Free roam Neon Bay. The city is yours.'],
  },
];

export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.stepIndex] : null;
}

export function startMission(state, idx) {
  const m = MISSIONS[idx];
  if (!m) return;
  state.missionIndex = idx; state.stepIndex = 0; state.stepTimer = 0; state.holdTimer = 0;
  state.dialogue = { lines: m.intro, idx: 0, timer: 0 };
  state.message = `${m.title} — ${m.giver}`;
  state.messageTimer = 3.5;
  state.objective = m.steps[0].text;
}

export function completeMission(state) {
  const m = currentMission(state);
  if (!m) return;
  state.money += m.payout;
  state.stats.missionsDone += 1;
  state.effects.addText(state.player.x, state.player.y - 30, `+$${m.payout}`, '#2ecc71');
  sound.missionDone();
  state.dialogue = { lines: [...m.outro], idx: 0, timer: 0 };
  state.missionIndex += 1; state.stepIndex = 0; state.stepTimer = 0; state.holdTimer = 0;
  if (state.missionIndex < MISSIONS.length) {
    const next = MISSIONS[state.missionIndex];
    state.dialogue.lines.push(`${next.title} — ${next.giver}: ${next.intro[0]}`);
    state.dialogue.lines.push(next.intro[1] || '');
    state.objective = next.steps[0].text;
  } else {
    state.objective = 'Story complete — free roam Neon Bay';
    state.storyComplete = true;
  }
  saveProgress(state);
}

export function failMission(state, reason) {
  state.message = `MISSION FAILED — ${reason}. Restarting mission…`;
  state.messageTimer = 3;
  state.enemies = [];
  startMission(state, state.missionIndex);
}

export function updateMissions(state, dt) {
  const m = currentMission(state);
  if (!m) return;
  const step = m.steps[state.stepIndex];
  if (!step) { completeMission(state); return; }
  state.objective = step.text;
  const target = step.target ? state.city.spots[step.target] : null;
  const px = state.playerCar ? state.playerCar.x : state.player.x;
  const py = state.playerCar ? state.playerCar.y : state.player.y;
  switch (step.kind) {
    case 'inCar':
      if (state.playerCar) { state.stepIndex += 1; state.message = 'Got wheels. Move!'; state.messageTimer = 2; }
      break;
    case 'reach':
      if (step.timeLimit) {
        state.stepTimer += dt;
        if (state.stepTimer > step.timeLimit) { failMission(state, 'the buyer walked away'); return; }
      }
      if (target && Math.hypot(target.x - px, target.y - py) < step.radius) {
        state.stepIndex += 1; state.stepTimer = 0;
        sound.pickup();
      }
      break;
    case 'hold':
      if (state.playerCar && target && Math.hypot(target.x - px, target.y - py) < step.radius) {
        state.message = 'Get out of the car (E) to grab the cash'; state.messageTimer = 0.5;
        break;
      }
      if (target && Math.hypot(target.x - px, target.y - py) < step.radius && !state.playerCar) {
        state.holdTimer += dt;
        state.message = `Grabbing cash… ${Math.max(0, step.seconds - state.holdTimer).toFixed(1)}s`;
        state.messageTimer = 0.4;
        if (state.holdTimer >= step.seconds) {
          state.holdTimer = 0; state.stepIndex += 1;
          raiseWanted(state, 3, 'the bank alarm tripped');
          state.message = 'ALARM! Get to the safehouse!'; state.messageTimer = 3;
        }
      } else {
        state.holdTimer = Math.max(0, state.holdTimer - dt);
      }
      break;
    case 'wanted':
      if (state.wanted >= step.value) { state.stepIndex += 1; state.message = 'They\'re on you — now lose them!'; state.messageTimer = 2.5; }
      break;
    case 'loseWanted':
      if (state.wanted === 0) { state.stepIndex += 1; }
      break;
    case 'spawnEnemies':
      spawnEnemies(state, state.city.spots.warehouse.x, state.city.spots.warehouse.y, step.count);
      state.stepIndex += 1;
      break;
    case 'killAll':
      if (state.enemies.length === 0) { state.stepIndex += 1; }
      break;
    default:
      state.stepIndex += 1;
  }
  if (state.stepIndex >= m.steps.length) completeMission(state);
}

// Save hook is injected by game.js to avoid a module cycle.
export let saveProgress = () => {};
export function setSaveHook(fn) { saveProgress = fn; }
