// Spelstand en voorkeuren bewaren op de telefoon (localStorage).

const GAME_KEY = 'dartking.game';
const PREFS_KEY = 'dartking.prefs';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Opslaan lukt niet (bv. privémodus); de app werkt gewoon door.
  }
}

export function saveGame(game) {
  write(GAME_KEY, game);
}

export function loadGame() {
  const g = read(GAME_KEY);
  if (!g || !g.settings || !Array.isArray(g.players) || !Array.isArray(g.darts)) return null;
  return g;
}

export function clearGame() {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    // negeren
  }
}

export const DEFAULT_PREFS = {
  startScore: 501,
  outRule: 'double',
  legsBestOf: 1,
  setsBestOf: 1,
  playerCount: 2,
  names: [],
  sound: true,
  voiceLang: 'en',
};

export function loadPrefs() {
  return { ...DEFAULT_PREFS, ...(read(PREFS_KEY) ?? {}) };
}

export function savePrefs(prefs) {
  write(PREFS_KEY, prefs);
}
