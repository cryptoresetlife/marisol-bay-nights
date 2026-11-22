// The mission runner: shows where the next chapter starts, starts it when Dez steps into the marker, walks
// through its steps, fails it on death, arrest or a broken objective, and pays out on completion.
import { CHAPTERS } from './story.js';
import { OBJECTIVES, resolvePoint, cleanupStep } from './objectives.js';
import { createMarker, removeMarker } from './markers.js';
import { showBanner, showEvent } from '../ui/hud.js';
import { addMoney } from '../economy/money.js';
import { removeVehicle } from '../vehicles/vehicle.js';
import { removePedestrian } from '../characters/pedestrians.js';
import { removeGunman } from '../combat/gunmen.js';
import { playFanfare } from '../audio/sound.js';
import { playDialogue } from '../ui/dialogue.js';

export function createStory() {
  return { chapter: 0, revealedHQ: false, startMarker: null, startChapter: -1, retryDelay: 0 };
}

export function startMission(game, index, fromStep = 0) {
  const def = CHAPTERS[index];
  const run = {
    def, index, step: -1, state: {}, named: {}, spawned: { vehicles: [], peds: [], gunmen: [] },
    objective: '', counter: '', companion: null, busy: true,
  };
  game.activeMission = run;
  removeStartMarker(game);
  showBanner(game, def.title.toUpperCase(), `Chapter ${index + 1}`, '#ff8fd0', 3);
  game.events.emit('missionStarted', { index, title: def.title });
  // when jumping ahead (debug scenes), run the instant steps that set things up
  for (let k = 0; k < fromStep; k++) {
    const s = def.steps[k];
    if (s.type === 'spawnVehicle' || s.type === 'give' || s.type === 'reveal') { OBJECTIVES[s.type].begin(game, run, s); }
  }
  advance(game, run, fromStep);
  return run;
}

function advance(game, run, to = run.step + 1) {
  if (run.step >= 0) cleanupStep(game, run);
  game.missionAllowsGunfire = false;
  run.step = to;
  run.state = {};
  const step = run.def.steps[run.step];
  if (!step) { completeMission(game, run); return; }
  run.objective = step.text || run.objective;
  OBJECTIVES[step.type].begin(game, run, step);
}

export function updateMissions(game, dt) {
  const story = game.story;
  const run = game.activeMission;
  if (run) {
    const step = run.def.steps[run.step];
    if (!step) return;
    let result = OBJECTIVES[step.type].update(game, run, step, dt);
    let guard = 0;
    while (result === 'done' && guard++ < 8) {
      advance(game, run);
      if (game.activeMission !== run) break;
      const next = run.def.steps[run.step];
      result = next ? OBJECTIVES[next.type].update(game, run, next, dt) : null;
    }
    if (typeof result === 'string' && result.startsWith('fail:')) failMission(game, result.slice(5));
    if (game.activeMission === run) {
      game.missionHud = { chapter: `Chapter ${run.index + 1} of ${CHAPTERS.length}`, title: run.def.title, objective: run.objective, counter: run.counter };
    }
    return;
  }
  if (game.sideActivity) return;
  // no mission running: point at the next chapter
  if (story.chapter >= CHAPTERS.length) {
    game.missionHud = { chapter: 'Marisol Bay', title: 'Free roam', objective: 'Story complete. Try the Tidewater Sprint, taxi fares or hunt Lucky Geckos.', counter: '' };
    return;
  }
  const def = CHAPTERS[story.chapter];
  story.retryDelay = Math.max(0, story.retryDelay - dt);
  if (def.auto && story.retryDelay <= 0 && game.mode === 'play') { startMission(game, story.chapter); return; }
  const p = resolvePoint(def.start);
  if (story.startChapter !== story.chapter) {
    removeStartMarker(game);
    story.startMarker = createMarker(game, p.x, p.z, { color: '#ff6fd0', radius: 1.8, height: 55 });
    story.startChapter = story.chapter;
  }
  game.missionBlips = [{ x: p.x, z: p.z, glyph: '!', color: '#ff6fd0', kind: 'target' }];
  game.missionHud = { chapter: `Next · Chapter ${story.chapter + 1}`, title: def.title, objective: `Meet Lupe at the pink marker (${def.start.landmark === 'garage' ? "Lupe's Garage" : 'Tiki Taco'})`, counter: '' };
  const pos = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  if (story.retryDelay <= 0 && Math.hypot(pos.x - p.x, pos.z - p.z) < (game.player.vehicle ? 5 : 2.6)) startMission(game, story.chapter);
}

function removeStartMarker(game) {
  if (game.story.startMarker) removeMarker(game, game.story.startMarker);
  game.story.startMarker = null;
  game.story.startChapter = -1;
}

function cleanupRun(game, run, keepVehicles = false) {
  cleanupStep(game, run);
  game.missionAllowsGunfire = false;
  for (const v of run.spawned.vehicles) {
    v.mission = false;
    v.noEnter = false;
    if (v.ai?.mode === 'mission') v.ai = null;
    if (!keepVehicles && v !== game.player.vehicle) removeVehicle(game, v);
  }
  for (const p of run.spawned.peds) if (!p.removed) removePedestrian(game, p);
  for (const g of run.spawned.gunmen) { g.mission = false; if (!g.dead && !g.removed) removeGunman(game, g); }
  game.activeMission = null;
  game.missionHud = null;
}

export function failMission(game, reason) {
  const run = game.activeMission;
  if (!run) return;
  cleanupRun(game, run);
  game.story.retryDelay = 6;
  showBanner(game, 'CHAPTER FAILED', reason, '#ff5a5a', 4);
  playFanfare(game.audio, false);
  game.events.emit('missionFailed', { index: run.index, reason });
}

export function completeMission(game, run) {
  cleanupRun(game, run, true);
  game.story.chapter = Math.max(game.story.chapter, run.index + 1);
  game.story.retryDelay = 8; // give the player a moment before the next chapter can trigger
  addMoney(game, run.def.reward, 'mission');
  game.stats.missions = (game.stats.missions || 0) + 1;
  const last = run.index === CHAPTERS.length - 1;
  showBanner(game, last ? 'MARISOL BAY IS YOURS' : 'CHAPTER COMPLETE', `${run.def.title} · +$${run.def.reward.toLocaleString('en-US')}`, '#ffd23f', 5);
  playFanfare(game.audio, true);
  if (run.index === 1) showEvent(game, 'Iron Pelican Arms now stocks the Hornet SMG', '#ff7b2e');
  if (last) playDialogue(game, [['DJ', 'Breaking news on KBAY: developer Sterling Vance arrested at his own tower. The Strip celebrates tonight.']], null, 1);
  game.events.emit('missionComplete', { index: run.index });
  game.events.emit('requestSave', { silent: true });
}

export function installMissionRules(game) {
  game.events.on('missionFailedBy', ({ reason }) => failMission(game, reason));
}
