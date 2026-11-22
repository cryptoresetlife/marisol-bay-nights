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

export function applyDebugScene(game, name, { startNewGame, placePlayer }) {
  startNewGame(game);
  game.hideIntro = true;
  game.story.chapter = 3;
  game.money = 18450;
  giveWeapon(game.player, 'pistol', 90);
  const rig = game.cameraRig;

  if (name === 'chase') {
    game.hours = 16.4;
    game.godMode = true;
    game.story.chapter = 6;
    const v = drive(game, 'marlin', 317.1, 150, Math.PI, 27, '#ffb703');
    enterVehicle(game, v);
    startMission(game, 6, 6);
    setWantedLevel(game, 4);
    drive(game, 'police', 316.4, 161, Math.PI, 28);
    drive(game, 'police', 312.4, 170, Math.PI - 0.05, 28);
    drive(game, 'police', 317, 183, Math.PI, 27);
    for (const v2 of game.vehicles) if (v2.isPolice) { v2.driver = { police: true }; v2.siren = true; v2.ai = { mode: 'police', state: 'pursuit', route: [], routeT: 0, stuckT: 0, reverseT: 0, crew: 2, deployed: false }; }
    placeRoadblock(game, { x: 315, z: -60, axis: 'NS' });
    game.autopilot = { route: [{ x: 317.1, z: 60 }, { x: 317.1, z: -80 }, { x: 317.1, z: -300 }], speed: 28 };
    rig.fixedOffset = Math.PI * 0.82;
    rig.pitch = -0.17;
    for (let k = 0; k < 10; k++) spawnTrafficCar(game);
    playDialogue(game, [['Lupe', 'Four stars and a chopper, Dez! Lose them before you come anywhere near the safehouse!']], null, 3);
  } else if (name === 'shootout') {
    game.hours = 11.2;
    game.godMode = true;
    startMission(game, 3, 3);
    placePlayer(game, -176, 203, 0.15);
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
    placePlayer(game, 309.5, -105, Math.PI);
    setWantedLevel(game, 3);
    placeRoadblock(game, { x: 315, z: -150, axis: 'NS' });
    spawnPoliceCruiser(game, { x: 305, z: -126, yaw: 0.4, mode: 'roadblock' });
    for (const v of game.vehicles) if (v.isPolice) { v.siren = true; v.ai.state = 'roadblock'; v.ai.deployed = true; }
    game.forceAim = true;
    game.autofire = autofireAtEnemies(game, 'rifle', 0.14);
    rig.pitch = -0.08;
  } else if (name === 'free') {
    game.hours = Number(game.params.get('hour') || 10.5);
  }
  if (game.params.get('hour')) game.hours = Number(game.params.get('hour'));
}
