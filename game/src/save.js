// Neon Bay — localStorage saves. One key holds the whole run: money,
// health, position, mission progress, clock and whether the story is done.
const KEY = 'neonbay-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
