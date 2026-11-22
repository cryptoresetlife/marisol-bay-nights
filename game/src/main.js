// Sundown Syndicate: an open-world crime game set in Marisol Bay. Builds the city, then runs the frame:
// input, Dez on foot or at the wheel, traffic, pedestrians, police and the wanted level, combat, missions and
// side jobs, effects, audio, the HUD and menus.
import { createEngine, renderFrame } from './core/engine.js';
import { createInput, endInputFrame, wasKeyPressed, releasePointer } from './core/input.js';
import { startLoop } from './core/loop.js';
import { createEvents } from './core/events.js';
import { createFollowCamera, updateFollowCamera } from './core/camera.js';
import { buildCity } from './world/city.js';
import { updateDayNight } from './world/daynight.js';
import { updateSignalLamps, setStreetLightLevel, updateLampLights } from './world/props.js';
import { updateSea } from './world/water.js';
import { updateTrafficLights } from './world/roads.js';
import { getLandmark, landmarkDoor } from './world/landmarks.js';
import { groundHeight } from './world/terrain.js';
import { createPlayer, updatePlayerOnFoot, updatePlayerDriving, syncPlayerModel } from './characters/player.js';
import { updatePedestrians, hitPedestriansWithVehicles } from './characters/pedestrians.js';
import { stepVehiclePhysics, resolveVehicleContacts } from './vehicles/vehiclePhysics.js';
import { syncVehicleMesh, vehicleSpeed } from './vehicles/vehicle.js';
import { updateTraffic } from './vehicles/traffic.js';
import { findEnterableVehicle, enterVehicle, exitVehicle } from './vehicles/carjack.js';
import { followRoute } from './vehicles/driver.js';
import { createWanted, updateWantedLevel } from './police/wanted.js';
import { createPoliceForce, updatePolice } from './police/police.js';
import { createRoadblocks, updateRoadblocks } from './police/roadblocks.js';
import { installCrimeRules } from './police/crimes.js';
import { updatePlayerCombat, WEAPONS } from './combat/weapons.js';
import { createTracers, updateTracers } from './combat/projectiles.js';
import { installDamageRules, updateVehicleDamage } from './combat/damage.js';
import { updateGunmen } from './combat/gunmen.js';
import { createStory, updateMissions, installMissionRules } from './missions/missions.js';
import { updateMarkers } from './missions/markers.js';
import { createSideJobs, buildGeckos, updateSideJobs } from './missions/sideJobs.js';
import { createRaceState, updateStreetRace } from './missions/streetRace.js';
import { shopSpots, updateShops } from './economy/shops.js';
import { createHud, updateHud, showEvent, showBanner, setPrompt } from './ui/hud.js';
import { paintCityMap } from './ui/mapPainter.js';
import { createBigMap, toggleBigMap, drawBigMap } from './ui/bigMap.js';
import { createDialogue, updateDialogue, playDialogue } from './ui/dialogue.js';
import { showTitleScreen, showPauseMenu, closeMenu, updateMenuKeys, loadSettings } from './ui/menus.js';
import { saveGame, loadGame, hasSave } from './systems/save.js';
import { createRespawn, beginWasted, updateRespawn } from './systems/respawn.js';
import { createParticles, updateParticles, emitTireSmoke } from './fx/particles.js';
import { createExplosionLight, updateExplosionLight } from './fx/explosions.js';
import { createAudio, unlockAudio, applyVolumes, installSoundEvents, updateSirens } from './audio/sound.js';
import { createEngineSound, updateEngineSound } from './audio/engineSound.js';
import { createRadio, updateRadio, changeStation, radioLabel } from './audio/radio.js';
import { applyDebugScene, installDevTools } from './debug/scenes.js';

const params = new URLSearchParams(location.search);

export function createGame() {
  const lowfx = params.get('lowfx') === '1';
  const engine = createEngine(document.getElementById('view'), { shadows: !lowfx });
  const game = {
    engine, params,
    input: createInput(engine.renderer.domElement),
    events: createEvents(),
    cameraRig: createFollowCamera(),
    city: buildCity(engine.scene, { shadows: !lowfx }),
    vehicles: [], peds: [], hostiles: [], markers: [], missionBlips: [],
    mode: 'title', menu: null, cutscene: null, timeScale: 1,
    hours: 10.5, time: 0, night: 0, money: 0,
    settings: { sensitivity: 1, volume: 0.8, music: 0.6, trafficDensity: 1, pedDensity: 1 },
    wanted: createWanted(), police: createPoliceForce(), roadblocks: createRoadblocks(),
    story: createStory(), activeMission: null, missionHud: null, sideActivity: null,
    sideJobs: createSideJobs(), race: createRaceState(), dialogue: createDialogue(), respawn: createRespawn(),
    audio: createAudio(), radio: createRadio(), engineSound: createEngineSound(),
    stats: { missions: 0, carsStolen: 0, kills: 0 },
    ready: false,
  };
  loadSettings(game);
  const safe = landmarkDoor(getLandmark('safehouse'));
  game.player = createPlayer(game, safe.x - 3, safe.z);
  game.fx = createParticles(engine.scene);
  game.tracers = createTracers(engine.scene);
  game.explosionLight = createExplosionLight(engine.scene);
  const mapCanvas = paintCityMap(game.city);
  game.hud = createHud(game, mapCanvas);
  game.bigMap = createBigMap(mapCanvas);
  game.shops = shopSpots();
  buildGeckos(game);
  installDamageRules(game);
  installCrimeRules(game);
  installSoundEvents(game);
  installMissionRules(game);
  installGameEvents(game);
  return game;
}

function installGameEvents(game) {
  const ev = game.events;
  ev.on('dispatch', ({ text }) => showEvent(game, text, '#5aa8ff'));
  ev.on('missionFailed', ({ reason }) => { game.lastFail = reason; });
  ev.on('playerDied', () => beginWasted(game, 'hospital'));
  ev.on('playerArrested', () => { if (game.player.alive && !game.respawn.state) beginWasted(game, 'arrest'); });
  ev.on('carjack', ({ vehicle }) => { game.stats.carsStolen++; showEvent(game, `Carjacked a ${vehicle.type.name}`, '#ff9f43'); });
  ev.on('enterVehicle', ({ vehicle }) => {
    if (!game.radioPicked) { game.radio.station = Math.floor(Math.random() * 3); game.radioPicked = true; }
    game.radioLabel = radioLabel(game.radio);
    void vehicle;
  });
  ev.on('radioChanged', () => { game.radioLabel = radioLabel(game.radio); showEvent(game, game.radioLabel, '#ff9ed2'); });
  ev.on('gunmanKilled', ({ source }) => { if (source && source.kind === 'player') game.stats.kills++; });
  ev.on('requestSave', ({ silent } = {}) => { if (saveGame(game) && !silent) showEvent(game, 'Game saved at Seabreeze Apartments', '#7dffb0'); });
  ev.on('settingsChanged', (s) => applyVolumes(game.audio, s));
  const unlock = () => unlockAudio(game.audio, game.settings);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function startNewGame(game) {
  closeMenu(game);
  resetWorld(game);
  game.money = 200;
  game.story = createStory();
  const door = landmarkDoor(getLandmark('police'));
  placePlayer(game, door.x + 2, door.z - 1.5, Math.PI);
  game.hours = 10.5;
  if (!params.get('scene')) showBanner(game, 'MARISOL BAY', 'Six years later...', '#7df9ff', 3.5);
}

export function continueGame(game) {
  closeMenu(game);
  resetWorld(game);
  game.story = createStory();
  loadGame(game);
  const door = landmarkDoor(getLandmark('safehouse'));
  placePlayer(game, door.x - 1.5, door.z, -Math.PI / 2);
  showEvent(game, 'Welcome back to Marisol Bay', '#7dffb0');
}

function resetWorld(game) {
  const p = game.player;
  if (p.vehicle) exitVehicle(game);
  p.health = p.maxHealth; p.armor = 0; p.alive = true;
  p.weapons = { fists: { clip: 0, ammo: 0 } }; p.current = 'fists';
  game.wanted = createWanted();
  game.mode = 'play';
}

export function placePlayer(game, x, z, yaw) {
  const p = game.player;
  p.pos.set(x, groundHeight(x, z), z);
  p.yaw = yaw;
  game.cameraRig.yaw = yaw;
  game.cameraRig.pitch = -0.2;
}

function handlePlayerActions(game) {
  const p = game.player;
  setPrompt(game, '');
  if (game.mode !== 'play' || !p.alive || game.respawn.state) return;
  const input = game.input;
  if (p.vehicle) {
    if (wasKeyPressed(input, 'KeyF')) exitVehicle(game);
    else if (wasKeyPressed(input, 'KeyR')) changeStation(game, 1);
    return;
  }
  const v = findEnterableVehicle(game);
  if (v) setPrompt(game, v.driver ? `F  Steal the ${v.type.name}` : `F  Get in the ${v.type.name}`);
  if (v && wasKeyPressed(input, 'KeyF')) enterVehicle(game, v);
}

function handleMenuKeys(game) {
  const input = game.input;
  if (game.mode === 'title' || game.mode === 'menu') { updateMenuKeys(game); }
  const lostLock = input.lostLock;
  input.lostLock = false;
  if (wasKeyPressed(input, 'Escape') || (lostLock && game.mode === 'play' && !game.bigMap.open)) {
    if (game.bigMap.open) toggleBigMap(game, false);
    else if (game.mode === 'play') showPauseMenu(game, { onSave: () => game.events.emit('requestSave', {}), onQuit: () => goToTitle(game) });
    else if (game.mode === 'menu' && game.menu?.id !== 'title') closeMenu(game);
  }
  if (game.mode === 'play' && wasKeyPressed(input, 'KeyM')) { toggleBigMap(game); releasePointer(input); }
  input.enabled = game.mode === 'play' && !game.bigMap.open;
}

function goToTitle(game) {
  closeMenu(game, 'title');
  showTitleScreen(game, { hasSave: hasSave(), onNew: () => startNewGame(game), onContinue: () => continueGame(game) });
}

function updateTitleCamera(game) {
  const cam = game.engine.camera;
  const t = game.time * 0.035;
  cam.position.set(120 + Math.cos(t) * 300, 75 + Math.sin(t * 0.7) * 15, -40 + Math.sin(t) * 280);
  cam.lookAt(150, 20, -40);
}

function updateSimulation(game, dt) {
  game.time += dt;
  game.hours = (game.hours + dt / 60) % 24;
  updateTrafficLights(game.city.roads, dt);
  updateSignalLamps(game.city.props, game.city.roads);
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateRoadblocks(game, dt);
  if (game.autopilot && game.player.vehicle) followRoute(game.player.vehicle, game.autopilot.route, game.autopilot.speed, 8);
  for (const v of game.vehicles) {
    stepVehiclePhysics(game, v, dt);
    if ((v.slip || 0) > 4.5 && Math.random() < 0.6) emitTireSmoke(game.fx, v.pos.x, v.pos.z);
  }
  resolveVehicleContacts(game);
  hitPedestriansWithVehicles(game);
  updateVehicleDamage(game, dt);
  updatePedestrians(game, dt);
  updateGunmen(game, dt);
  updateWantedLevel(game, dt);
}

function updatePlayState(game, dt) {
  const p = game.player;
  if (p.vehicle && !game.autopilot) updatePlayerDriving(game, dt);
  updateSimulation(game, dt);
  if (p.vehicle) { p.pos.copy(p.vehicle.pos); syncPlayerModel(game, dt); }
  else updatePlayerOnFoot(game, dt);
  updatePlayerCombat(game, dt);
  if (game.autofire) game.autofire(dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  // a little health comes back after a quiet spell
  if (p.alive && p.health < 50 && game.time - p.lastDamage > 8) p.health = Math.min(50, p.health + dt * 2);
  updateMissions(game, dt);
  updateStreetRace(game, dt);
  updateSideJobs(game, dt);
  updateShops(game, dt);
  updateRespawn(game, dt);
}

function nearestSirenDistance(game) {
  const cam = game.engine.camera.position;
  let best = Infinity;
  for (const v of game.vehicles) if (v.siren && !v.destroyed) best = Math.min(best, Math.hypot(v.pos.x - cam.x, v.pos.z - cam.z));
  return best;
}

function updateFrame(game, rawDt) {
  handleMenuKeys(game);
  const dt = rawDt * (game.timeScale || 1);
  if (game.mode === 'title') {
    game.time += rawDt;
    updateTrafficLights(game.city.roads, rawDt);
    updateSignalLamps(game.city.props, game.city.roads);
    updateTitleCamera(game);
  } else if (game.mode === 'play' && !game.bigMap.open) {
    handlePlayerActions(game);
    updatePlayState(game, dt);
    updateFollowCamera(game, rawDt);
  } else {
    updateFollowCamera(game, 0);
  }
  updateDialogue(game, rawDt);
  updateMarkers(game, rawDt);
  updateParticles(game.fx, dt);
  updateTracers(game.tracers, dt);
  updateExplosionLight(game, dt);
  const focus = game.mode === 'title' ? game.engine.camera.position : game.player.pos;
  game.night = updateDayNight(game.city.dayNight, game.hours, focus, game.engine.camera.position, game.engine.renderer, rawDt);
  for (const m of game.city.buildings.nightMaterials) m.emissiveIntensity = game.night * 1.5;
  for (const m of game.city.buildings.signMaterials) m.color.setScalar(0.85 + game.night * 1.6);
  setStreetLightLevel(game.city.props, game.night);
  updateLampLights(game.city.props, focus, game.night, rawDt);
  updateSea(game.city.sea, game.time, game.night);
  for (const v of game.vehicles) syncVehicleMesh(v, rawDt, game.night, game.time);
  game.engineRpm = updateEngineSound(game, game.engineSound, rawDt);
  updateSirens(game.audio, game.mode === 'play' ? nearestSirenDistance(game) : Infinity, game.wanted.level, game.time);
  updateRadio(game, rawDt);
  updateHud(game, rawDt);
  drawBigMap(game);
  renderFrame(game.engine);
  endInputFrame(game.input);
}

const game = createGame();
window.__game = game;
game.debugInfo = () => ({
  mode: game.mode, calls: game.engine.renderer.info.render.calls, tris: game.engine.renderer.info.render.triangles,
  vehicles: game.vehicles.length, peds: game.peds.length, hostiles: game.hostiles.length,
  player: [+game.player.pos.x.toFixed(1), +game.player.pos.z.toFixed(1)], inCar: game.player.vehicle ? game.player.vehicle.type.name : null,
  speed: game.player.vehicle ? +(vehicleSpeed(game.player.vehicle) * 3.6).toFixed(0) : 0,
  wanted: game.wanted.level, money: game.money, health: Math.round(game.player.health), chapter: game.story.chapter,
  mission: game.activeMission ? `${game.activeMission.def.title}#${game.activeMission.step}` : null,
  weapon: WEAPONS[game.player.current].name, fps: Math.round(game.loop?.fps || 0),
});
game.startNewGame = () => startNewGame(game);
game.continueGame = () => continueGame(game);
game.saveGame = () => saveGame(game);
game.say = (lines) => playDialogue(game, lines);
installDevTools(game);
const scene = params.get('scene');
if (scene) applyDebugScene(game, scene, { startNewGame, placePlayer });
else if (params.get('play') === '1') startNewGame(game);
else goToTitle(game);
game.ready = true;
game.loop = startLoop((dt) => updateFrame(game, dt));
