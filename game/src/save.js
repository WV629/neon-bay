// Save and load through localStorage. Nothing leaves the player's browser.
const KEY = 'neon-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money, hp: state.player.hp, ammo: state.player.ammo,
      missionIndex: state.missionIndex, stepIndex: state.stepIndex,
      wanted: state.wanted, clock: state.clock,
      px: state.player.x, py: state.player.y,
      storyComplete: state.storyComplete, stats: state.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() { return loadGame() !== null; }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
