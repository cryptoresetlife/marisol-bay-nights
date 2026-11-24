// Saving and loading through localStorage: story progress, cash, weapons and ammo, armour, collectibles,
// side-job records, the clock and the safehouse spawn point.
const KEY = 'sundown.save.v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveGame(game) {
  const p = game.player;
  const data = {
    version: 1,
    savedAt: Date.now(),
    money: game.money,
    hours: game.hours,
    chapter: game.story.chapter,
    revealedHQ: !!game.story.revealedHQ,
    weapons: p.weapons,
    current: p.current,
    armor: p.armor,
    collected: [...game.sideJobs.collected],
    raceBest: game.sideJobs.raceBest,
    taxiFares: game.sideJobs.taxiFares,
    stats: game.stats,
    progression: game.progression,
    garage: game.garage ? game.garage.cars : [],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    game.events.emit('saved', data);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(game) {
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { data = null; }
  if (!data) return false;
  const p = game.player;
  game.money = data.money;
  game.hours = data.hours;
  game.story.chapter = data.chapter;
  game.story.revealedHQ = data.revealedHQ;
  p.weapons = data.weapons;
  p.current = p.weapons[data.current] ? data.current : 'fists';
  p.armor = data.armor || 0;
  game.sideJobs.collected = new Set(data.collected || []);
  game.sideJobs.raceBest = data.raceBest || null;
  game.sideJobs.taxiFares = data.taxiFares || 0;
  game.stats = { ...game.stats, ...(data.stats || {}) };
  if (data.progression?.xp) game.progression.xp = { ...game.progression.xp, ...data.progression.xp };
  if (game.garage && Array.isArray(data.garage)) game.garage.cars = data.garage.filter((c) => c && c.type).slice(-3);
  game.events.emit('loaded', data);
  return true;
}

export function deleteSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
