// Skills and street respect. Dez gets better at what he does: driving fast raises Driving (more tyre grip),
// landing shots raises Shooting (tighter spread), sprinting raises Stamina (faster, longer sprints), and
// missions, race wins, takedowns and carjackings earn Respect, whose ranks raise his maximum health.
import { showEvent } from '../ui/hud.js';

export const SKILLS = {
  driving: { name: 'Driving', perLevel: 2500 },
  shooting: { name: 'Shooting', perLevel: 60 },
  stamina: { name: 'Stamina', perLevel: 90 },
  respect: { name: 'Respect', perLevel: 400 },
};
export const MAX_LEVEL = 5;
export const RESPECT_RANKS = ['Nobody', 'Street Hustler', 'Known Face', 'Crew Boss', 'Bay Legend', 'King of Marisol'];

export function createProgression() {
  return { xp: { driving: 0, shooting: 0, stamina: 0, respect: 0 } };
}

export function skillLevel(game, key) {
  const xp = game.progression.xp[key] || 0;
  return Math.min(MAX_LEVEL, Math.floor(xp / SKILLS[key].perLevel));
}

// fraction of the way to the next level, 1 when maxed
export function skillProgress(game, key) {
  const lvl = skillLevel(game, key);
  if (lvl >= MAX_LEVEL) return 1;
  return (game.progression.xp[key] - lvl * SKILLS[key].perLevel) / SKILLS[key].perLevel;
}

export function respectRank(game) { return RESPECT_RANKS[skillLevel(game, 'respect')]; }

export function gainXp(game, key, amount) {
  const before = skillLevel(game, key);
  game.progression.xp[key] = (game.progression.xp[key] || 0) + amount;
  const after = skillLevel(game, key);
  if (after > before) {
    if (key === 'respect') {
      applyRespectPerks(game);
      showEvent(game, `Respect up: ${RESPECT_RANKS[after]} · max health +10`, '#ffd166');
    } else {
      showEvent(game, `${SKILLS[key].name} skill up: level ${after} / ${MAX_LEVEL}`, '#ffd166');
    }
    game.events.emit('skillUp', { key, level: after });
  }
}

export function applyRespectPerks(game) {
  game.player.maxHealth = 100 + skillLevel(game, 'respect') * 10;
}

// Multipliers the other systems read.
export const shootingAccuracy = (game) => 1 + skillLevel(game, 'shooting') * 0.12;
export const drivingGrip = (game) => 1 + skillLevel(game, 'driving') * 0.04;
export const sprintBoost = (game) => 1 + skillLevel(game, 'stamina') * 0.04;
export const staminaDrain = (game) => 1 - skillLevel(game, 'stamina') * 0.1;

export function installProgressionRules(game) {
  const ev = game.events;
  ev.on('bulletHit', ({ shooter, kind }) => { if (shooter === game.player && kind !== 'world') gainXp(game, 'shooting', 1); });
  ev.on('missionComplete', () => gainXp(game, 'respect', 150));
  ev.on('raceFinished', ({ place }) => gainXp(game, 'respect', place === 1 ? 120 : 30));
  ev.on('gunmanKilled', ({ source }) => { if (source && source.kind === 'player') gainXp(game, 'respect', 12); });
  ev.on('carjack', () => gainXp(game, 'respect', 8));
}

export function updateProgression(game, dt) {
  const p = game.player;
  if (!p.alive) return;
  if (p.vehicle && p.vehicle.driver === 'player') {
    const speed = Math.abs(p.vehicle.forwardSpeed);
    if (speed > 12) gainXp(game, 'driving', speed * dt);
  } else if (!p.vehicle && p.speed > 6) {
    gainXp(game, 'stamina', dt);
  }
}
