// The Seabreeze garage beside the safehouse: stop a car you like on the yellow pad to keep it (up to three,
// oldest out first), walk back onto the pad and press G to take the last one out again. The stored cars go
// into the save file, so a stolen Marlin GT survives a reload. Police cars and hot cars are turned away.
import * as THREE from 'three';
import { getLandmark, landmarkCurb } from '../world/landmarks.js';
import { VEHICLE_TYPES } from '../vehicles/carModels.js';
import { createVehicle, removeVehicle, vehicleSpeed } from '../vehicles/vehicle.js';
import { exitVehicle } from '../vehicles/carjack.js';
import { showEvent, setPrompt } from '../ui/hud.js';
import { wasKeyPressed } from '../core/input.js';

export const GARAGE_SLOTS = 3;

export function createGarage(scene) {
  const curb = landmarkCurb(getLandmark('safehouse'));
  const spot = { x: curb.x, z: curb.z + 9 };
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.6, 32),
    new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.75, depthWrite: false }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(spot.x, 0.06, spot.z);
  scene.add(pad);
  return { cars: [], spot, pad, cooldown: 0 };
}

function isMissionCar(game, v) {
  const named = game.activeMission?.named;
  return !!named && Object.values(named).includes(v);
}

export function storeVehicle(game, v) {
  const g = game.garage;
  g.cars.push({ type: v.typeKey, color: v.color });
  while (g.cars.length > GARAGE_SLOTS) g.cars.shift();
  exitVehicle(game);
  removeVehicle(game, v);
  g.cooldown = 3;
  showEvent(game, `Stored the ${v.type.name} in the Seabreeze garage (${g.cars.length}/${GARAGE_SLOTS})`, '#ffe14d');
  game.events.emit('garageStored', { type: v.typeKey });
}

export function retrieveVehicle(game) {
  const g = game.garage;
  const car = g.cars.pop();
  if (!car) return null;
  const v = createVehicle(game, car.type, { x: g.spot.x, z: g.spot.z + 1, yaw: 0, color: car.color, parked: true });
  g.cooldown = 3;
  showEvent(game, `${v.type.name} out of the garage`, '#ffe14d');
  return v;
}

export function updateGarage(game, dt) {
  const g = game.garage;
  if (!g || game.mode !== 'play') return;
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.pad.material.opacity = 0.55 + Math.sin(game.time * 3) * 0.2;
  const p = game.player;
  const pos = p.vehicle ? p.vehicle.pos : p.pos;
  const d = Math.hypot(pos.x - g.spot.x, pos.z - g.spot.z);
  if (d > 3.2 || g.cooldown > 0 || !p.alive) return;
  const v = p.vehicle;
  if (v) {
    if (v.isPolice || isMissionCar(game, v)) { setPrompt(game, 'The garage will not take this car'); return; }
    if (game.wanted.level > 0) { setPrompt(game, 'Lose the cops before you park in the garage'); return; }
    if (vehicleSpeed(v) < 2.5) storeVehicle(game, v);
    else setPrompt(game, 'Stop on the pad to store this car');
  } else if (g.cars.length) {
    const next = VEHICLE_TYPES[g.cars[g.cars.length - 1].type].name;
    setPrompt(game, `Press G to take out the ${next} (${g.cars.length} stored)`);
    if (wasKeyPressed(game.input, 'KeyG')) retrieveVehicle(game);
  }
}
