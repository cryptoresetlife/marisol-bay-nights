// The Tidewater Sprint: a street race up the beachfront, across Sunrise Blvd and back through Downtown
// against three rival drivers, with a countdown, checkpoints, live positions, a clock and prize money.
import { createVehicle, removeVehicle } from '../vehicles/vehicle.js';
import { steerToward, scanAhead } from '../vehicles/driver.js';
import { createMarker, removeMarker } from './markers.js';
import { showBanner, showEvent } from '../ui/hud.js';
import { addMoney } from '../economy/money.js';
import { randomLook } from '../characters/characterModel.js';

export const RACE_START = { x: 309, z: 250 };
export const RACE_CHECKPOINTS = [
  { x: 309, z: 150 }, { x: 309, z: 0 }, { x: 309, z: -150 }, { x: 296, z: -306 }, { x: 180, z: -317 }, { x: 56, z: -308 },
  { x: 47, z: -180 }, { x: 47, z: -45 }, { x: 47, z: 90 }, { x: 64, z: 137 }, { x: 200, z: 137 }, { x: 303, z: 128 }, { x: 309, z: 30 },
];
const RIVALS = [['marlin', '#ffffff', 'Ray "Redline" Ortiz'], ['roadster', '#ff595e', 'Tasha Vega'], ['coupe', '#3a86ff', 'Kid Mako']];
const PRIZE = 1500;

export function createRaceState() {
  return { active: null, startMarker: null, cooldown: 0 };
}

export function startStreetRace(game, { instant = false } = {}) {
  const pv = game.player.vehicle;
  if (!pv) return null;
  pv.pos.set(RACE_START.x + 2, pv.pos.y, RACE_START.z);
  pv.yaw = Math.PI; pv.vel.x = pv.vel.z = 0; pv.yawRate = 0;
  game.cameraRig.yaw = Math.PI;
  const rivals = RIVALS.map(([type, color, name], k) => {
    const v = createVehicle(game, type, { x: RACE_START.x - 2.5 + (k % 2) * 4.5, z: RACE_START.z + 7 + Math.floor((k + 1) / 2) * 7, yaw: Math.PI, color });
    v.driver = { look: randomLook(), name };
    v.ai = { mode: 'race', cp: 0 };
    v.mission = true;
    return v;
  });
  const race = { rivals, cp: 0, t: 0, countdown: instant ? 0 : 3.5, markers: [], finished: false, lastCount: 4 };
  game.race.active = race;
  game.sideActivity = 'race';
  if (game.race.startMarker) { removeMarker(game, game.race.startMarker); game.race.startMarker = null; }
  placeCheckpointMarkers(game, race);
  game.events.emit('raceStarted', {});
  return race;
}

function placeCheckpointMarkers(game, race) {
  for (const m of race.markers) removeMarker(game, m);
  race.markers = [];
  const a = RACE_CHECKPOINTS[race.cp], b = RACE_CHECKPOINTS[race.cp + 1];
  if (a) race.markers.push(createMarker(game, a.x, a.z, { color: race.cp === RACE_CHECKPOINTS.length - 1 ? '#7dffb0' : '#ffd23f', radius: 5, height: 40 }));
  if (b) race.markers.push(createMarker(game, b.x, b.z, { color: '#ffffff', radius: 3.5, height: 18, chevron: false }));
}

function progressOf(cp, pos) {
  const c = RACE_CHECKPOINTS[Math.min(cp, RACE_CHECKPOINTS.length - 1)];
  return cp * 1000 - Math.hypot(c.x - pos.x, c.z - pos.z);
}

function endRace(game, race, place) {
  for (const m of race.markers) removeMarker(game, m);
  for (const v of race.rivals) { v.mission = false; if (v.ai) v.ai = { mode: 'none' }; v.driver = v.driver || null; }
  game.race.active = null;
  game.sideActivity = null;
  game.race.cooldown = 8;
  game.missionHud = null;
  if (place === 0) return;
  const time = race.t.toFixed(1);
  if (place === 1) {
    addMoney(game, PRIZE, 'race');
    const best = game.sideJobs.raceBest;
    if (!best || race.t < best) game.sideJobs.raceBest = race.t;
    showBanner(game, 'YOU WIN', `Tidewater Sprint · ${time}s · +$${PRIZE}`, '#7dffb0', 4);
  } else {
    if (place === 2) addMoney(game, 300, 'race');
    showBanner(game, `FINISHED ${place}${['', 'ST', 'ND', 'RD', 'TH'][place]}`, `Tidewater Sprint · ${time}s`, '#ffd166', 4);
  }
  game.events.emit('raceFinished', { place, time: race.t });
}

export function updateStreetRace(game, dt) {
  const rs = game.race;
  const race = rs.active;
  if (!race) {
    rs.cooldown = Math.max(0, rs.cooldown - dt);
    if (game.activeMission || game.sideActivity) { if (rs.startMarker) { removeMarker(game, rs.startMarker); rs.startMarker = null; } return; }
    if (!rs.startMarker) rs.startMarker = createMarker(game, RACE_START.x, RACE_START.z, { color: '#c77dff', radius: 4, height: 50 });
    const pv = game.player.vehicle;
    if (pv && rs.cooldown <= 0 && Math.hypot(pv.pos.x - RACE_START.x, pv.pos.z - RACE_START.z) < 6) startStreetRace(game);
    return;
  }
  const pv = game.player.vehicle;
  if (race.countdown > 0) {
    race.countdown -= dt;
    const n = Math.ceil(race.countdown);
    if (n !== race.lastCount && n >= 0) { race.lastCount = n; showBanner(game, n > 0 ? String(n) : 'GO!', 'Tidewater Sprint', n > 0 ? '#ffd166' : '#7dffb0', 1); game.events.emit('checkpoint', {}); }
    for (const v of [...race.rivals, pv]) if (v) { v.controls.throttle = 0; v.controls.handbrake = true; }
    return;
  }
  race.t += dt;
  // rivals drive the checkpoint line, a little faster when they trail
  const playerProg = pv ? progressOf(race.cp, pv.pos) : -1e9;
  for (const v of race.rivals) {
    if (v.destroyed || !v.ai || v.ai.mode !== 'race') continue;
    const c = RACE_CHECKPOINTS[v.ai.cp];
    if (!c) { v.controls.throttle = 0; v.controls.handbrake = true; continue; }
    if (Math.hypot(c.x - v.pos.x, c.z - v.pos.z) < 10) v.ai.cp++;
    const behind = progressOf(v.ai.cp, v.pos) < playerProg;
    const gap = scanAhead(game, v, 14, 1.3);
    const target = RACE_CHECKPOINTS[Math.min(v.ai.cp, RACE_CHECKPOINTS.length - 1)];
    steerToward(v, target.x, target.z, (behind ? 40 : 33) * (gap < 8 ? 0.6 : 1));
    if (gap < 10) v.controls.steer = Math.max(-1, Math.min(1, v.controls.steer - 0.5));
  }
  if (pv) {
    const c = RACE_CHECKPOINTS[race.cp];
    if (Math.hypot(c.x - pv.pos.x, c.z - pv.pos.z) < 10) {
      race.cp++;
      game.events.emit('checkpoint', {});
      if (race.cp >= RACE_CHECKPOINTS.length) {
        const ahead = race.rivals.filter((v) => v.ai?.cp >= RACE_CHECKPOINTS.length).length;
        endRace(game, race, ahead + 1);
        return;
      }
      placeCheckpointMarkers(game, race);
    }
  } else {
    race.outT = (race.outT || 0) + dt;
    if (race.outT > 8) { showEvent(game, 'Race abandoned', '#ff6b6b'); endRace(game, race, 0); return; }
  }
  const pos = 1 + race.rivals.filter((v) => progressOf(v.ai?.cp || 0, v.pos) > playerProg).length;
  const next = RACE_CHECKPOINTS[Math.min(race.cp, RACE_CHECKPOINTS.length - 1)];
  game.missionBlips = [{ x: next.x, z: next.z, glyph: '⚑', color: '#ffd23f', kind: 'target' }];
  game.missionHud = { chapter: 'Street race', title: 'Tidewater Sprint', objective: `Checkpoint ${race.cp + 1} / ${RACE_CHECKPOINTS.length}`, counter: `Position ${pos} / 4 · ${race.t.toFixed(1)}s` };
}
