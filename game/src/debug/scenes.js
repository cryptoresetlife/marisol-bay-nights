// Scene presets for testing and screenshots (?scene=chase|shootout|race|hijack|night|free). Each one starts
// a real game, jumps to a moment of a mission or activity, and lets the simulation run from there.
import * as THREE from 'three';
import { createVehicle } from '../vehicles/vehicle.js';
import { enterVehicle, hijackVehicle } from '../vehicles/carjack.js';
import { setWantedLevel } from '../police/wanted.js';
import { spawnPoliceCruiser } from '../police/police.js';
import { placeRoadblock } from '../police/roadblocks.js';
import { startMission } from '../missions/missions.js';
import { startStreetRace, RACE_CHECKPOINTS } from '../missions/streetRace.js';
import { giveWeapon, fireWeapon } from '../combat/weapons.js';
import { playDialogue } from '../ui/dialogue.js';
import { spawnTrafficCar } from '../vehicles/traffic.js';
import { spawnPedestrian } from '../characters/pedestrians.js';

function drive(game, type, x, z, yaw, speed, color) {
  const v = createVehicle(game, type, { x, z, yaw, color });
  v.vel.x = Math.sin(yaw) * speed; v.vel.z = Math.cos(yaw) * speed;
  v.forwardSpeed = speed;
  return v;
}

function autofireAtEnemies(game, weapon, interval) {
  let t = 0;
  const from = new THREE.Vector3();
  return (dt) => {
    const p = game.player;
    const foes = game.hostiles.filter((g) => !g.dead && Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 45);
    if (!foes.length) return;
    foes.sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z));
    const f = foes[0];
    p.yaw = Math.atan2(f.pos.x - p.pos.x, f.pos.z - p.pos.z);
    game.cameraRig.yaw += (p.yaw - 0.12 - game.cameraRig.yaw) * Math.min(1, dt * 3);
    t -= dt;
    if (t > 0) return;
    t = interval;
    from.set(p.pos.x + Math.sin(p.yaw) * 0.6, p.pos.y + 1.45, p.pos.z + Math.cos(p.yaw) * 0.6);
    const dir = new THREE.Vector3(f.pos.x - from.x, f.pos.y + 1.2 - from.y, f.pos.z - from.z).normalize();
    const slot = p.weapons[weapon];
    if (slot && slot.clip > 1) slot.clip -= 1;
    fireWeapon(game, p, from, dir, weapon, 0.6);
  };
}

// Helpers the automated play tests call through window.__game.dev.
export function installDevTools(game) {
  game.dev = {
    teleport(x, z, yaw) {
      const v = game.player.vehicle;
      const o = v || game.player;
      o.pos.x = x; o.pos.z = z;
      if (yaw !== undefined) { o.yaw = yaw; game.cameraRig.yaw = yaw; }
      if (v) { v.vel.x = v.vel.z = 0; v.yawRate = 0; }
    },
    skipLine() { if (game.dialogue.current) game.dialogue.t = 0; },
    named(name) { return game.activeMission?.named[name] || null; },
    nearNamed(name, dist = 2.8) {
      const v = game.dev.named(name);
      if (!v) return false;
      game.dev.teleport(v.pos.x + Math.cos(v.yaw) * dist, v.pos.z - Math.sin(v.yaw) * dist);
      return true;
    },
    shootHostiles() {
      for (const g of game.hostiles) if (!g.dead) game.events.emit('bulletHit', { kind: 'gunman', ref: g, point: g.pos, damage: 1000, shooter: game.player, dir: { x: 0, y: 0, z: 1 } });
    },
    wreck(name) { const v = game.dev.named(name); if (v) game.events.emit('damageVehicle', { vehicle: v, amount: 99999 }); },
    step() { const m = game.activeMission; return m ? `${m.def.id}:${m.def.steps[m.step]?.type}` : null; },
  };
}

export function applyDebugScene(game, name, { startNewGame, placePlayer }) {
  startNewGame(game);
  game.hideIntro = true;
  game.story.chapter = 3;
  game.money = 18450;
  giveWeapon(game.player, 'pistol', 90);
  const rig = game.cameraRig;

  if (name === 'chase') {
    game.hours = 15.2;
    game.godMode = true;
    game.story.chapter = 6;
    const v = drive(game, 'marlin', 317.1, 150, Math.PI, 27, '#e63946');
    v.health = v.maxHealth = 6000;
    enterVehicle(game, v);
    startMission(game, 6, 6);
    setWantedLevel(game, 4);
    drive(game, 'police', 313.6, 157.5, Math.PI - 0.03, 28.5);
    drive(game, 'police', 318.2, 164, Math.PI, 28);
    drive(game, 'police', 314, 176, Math.PI - 0.04, 27.5);
    drive(game, 'police', 318, 190, Math.PI, 27);
    for (const v2 of game.vehicles) if (v2.isPolice) { v2.driver = { police: true }; v2.siren = true; v2.ai = { mode: 'police', state: 'pursuit', route: [], routeT: 0, stuckT: 0, reverseT: 0, crew: 2, deployed: false }; }
    placeRoadblock(game, { x: 315, z: -60, axis: 'NS' });
    game.police.heliAltitude = Number(game.params.get('heli') || 24);
    game.autopilot = { route: [{ x: 317.1, z: 60 }, { x: 317.1, z: -80 }, { x: 317.1, z: -300 }], speed: 28 };
    rig.fixedOffset = Math.PI * 0.82;
    rig.pitch = -0.17;
    rig.distScale = Number(game.params.get('camdist') || 1);
    for (let k = 0; k < 10; k++) spawnTrafficCar(game);
    playDialogue(game, [['Lupe', 'Four stars and a chopper, Dez! Lose them before you come anywhere near the safehouse!']], null, 3);
  } else if (name === 'shootout') {
    game.hours = 11.2;
    game.godMode = true;
    startMission(game, 3, 3);
    placePlayer(game, -224, 223.5, Math.PI / 2);
    game.player.current = 'smg';
    game.forceAim = true;
    for (const g of game.hostiles) g.alerted = true;
    game.autofire = autofireAtEnemies(game, 'smg', 0.085);
    rig.pitch = -0.12;
  } else if (name === 'race') {
    game.hours = 13.2;
    game.godMode = true;
    const v = drive(game, 'marlin', 311, 250, Math.PI, 0, '#2ec4b6');
    enterVehicle(game, v);
    startStreetRace(game, { instant: true });
    game.autopilot = { route: RACE_CHECKPOINTS.map((c) => ({ ...c })), speed: 31 };
    rig.fixedOffset = 0;
    rig.pitch = -0.2;
  } else if (name === 'hijack') {
    game.hours = 12.6;
    game.godMode = true;
    placePlayer(game, 224.4, 58.5, Math.PI);
    const cab = createVehicle(game, 'taxi', { x: 227.1, z: 57.5, yaw: Math.PI });
    cab.driver = { look: { skin: '#e0ac69', shirt: '#ffe14d', pants: '#2b2d42', hair: '#3b2416', shoes: '#222', style: 'cap', hat: '#1d3557' } };
    for (let k = 0; k < 12; k++) spawnTrafficCar(game);
    for (let k = 0; k < 6; k++) spawnPedestrian(game, 212 + k * 1.3, 66 + (k % 2), { loop: { bi: 4, bj: 4, corner: 1, cw: true } });
    game.pendingHijack = { vehicle: cab, delay: 1.2 };
    rig.fixedOffset = -Math.PI * 0.62;
    rig.pitch = -0.16;
    const tick = (dt) => {
      const h = game.pendingHijack;
      if (!h) return;
      h.delay -= dt;
      if (h.delay <= 0) { game.pendingHijack = null; hijackVehicle(game, h.vehicle); }
    };
    game.autofire = tick;
  } else if (name === 'night') {
    game.hours = 21.9;
    game.godMode = true;
    giveWeapon(game.player, 'rifle', 180);
    game.player.current = 'rifle';
    placePlayer(game, 311, 2, Math.PI);
    setWantedLevel(game, 3);
    game.noCrimes = true; // keep the scene at three stars
    game.wanted.lockLevel = true;
    placeRoadblock(game, { x: 315, z: -28, axis: 'NS' });
    spawnPoliceCruiser(game, { x: 305.5, z: -4, yaw: 0.4, mode: 'roadblock' });
    for (const v of game.vehicles) if (v.isPolice) { v.siren = true; v.ai.state = 'roadblock'; v.ai.deployed = true; }
    game.forceAim = true;
    game.autofire = autofireAtEnemies(game, 'rifle', 0.14);
    rig.pitch = -0.08;
    if (game.params.get('wide') !== '0') rig.cinematic = { pos: new THREE.Vector3(310, 8.5, 31), look: new THREE.Vector3(316, 2.5, -26) };
  } else if (name === 'showroom') {
    // every vehicle type and a row of locals parked on Tidewater Drive, for checking models up close
    game.hours = 15;
    game.godMode = true;
    game.noCrimes = true;
    placePlayer(game, 305, 92, 0);
    const types = ['marlin', 'coupe', 'sedan', 'taxi', 'pickup', 'van', 'roadster', 'police', 'tactical'];
    types.forEach((t, k) => createVehicle(game, t, { x: 308.5, z: 70 + k * 6.2, yaw: 0.35, parked: true }));
    for (let k = 0; k < 8; k++) spawnPedestrian(game, 304 + (k % 2) * 0.8, 72 + k * 2.4, { loop: { bi: 4, bj: 4, corner: 1, cw: true } });
    const front = game.params.get('front') === '1';
    rig.cinematic = front
      ? { pos: new THREE.Vector3(305, 2.0, 127), look: new THREE.Vector3(309, 0.8, 112) }
      : { pos: new THREE.Vector3(302.5, 1.9, 65.5), look: new THREE.Vector3(308, 0.9, 74) };
  } else if (name === 'free') {
    game.hours = Number(game.params.get('hour') || 10.5);
  }
  if (game.params.get('hour')) game.hours = Number(game.params.get('hour'));
  if (game.params.get('camyaw')) rig.fixedOffset = Number(game.params.get('camyaw'));
  if (game.params.get('campitch')) rig.pitch = Number(game.params.get('campitch'));
}
