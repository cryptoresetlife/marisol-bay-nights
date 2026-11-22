// Getting in and out of cars: walk up and press F to take a parked car, drag the driver out of an occupied
// one (they run off screaming), climb out when stopped or bail out of a moving car.
import { doorPoint, vehicleSpeed, vehicleRight } from './vehicle.js';
import { spawnPedestrian } from '../characters/pedestrians.js';
import { groundHeight } from '../world/terrain.js';

export const ENTER_RANGE = 4.2;

export function findEnterableVehicle(game) {
  const p = game.player;
  let best = null, bestD = ENTER_RANGE;
  for (const v of game.vehicles) {
    if (v.destroyed || v.health <= 0 || v.noEnter) continue;
    const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) - v.type.len * 0.25;
    if (d < bestD) { best = v; bestD = d; }
  }
  return best;
}

export function enterVehicle(game, v) {
  const p = game.player;
  if (v.driver && v.driver !== 'player') return hijackVehicle(game, v);
  takeSeat(game, v);
  return true;
}

// Pull the NPC driver out, who stumbles and flees; carjacking is a crime.
export function hijackVehicle(game, v) {
  const door = doorPoint(v, 1);
  const driverLook = v.driver.look;
  const isCop = v.isPolice;
  v.driver = null;
  const ped = spawnPedestrian(game, door.x, door.z, { look: driverLook, state: 'flee' });
  ped.fleeFrom = { x: v.pos.x, z: v.pos.z };
  ped.fleeTimer = 10;
  ped.down = true;
  ped.downTimer = 0.9;
  ped.vel.set(door.x - v.pos.x, 0, door.z - v.pos.z).multiplyScalar(1.5);
  if (v.ai) v.ai = null;
  takeSeat(game, v);
  game.events.emit('carjack', { vehicle: v, ped, police: isCop });
  return true;
}

function takeSeat(game, v) {
  const p = game.player;
  v.driver = 'player';
  v.parked = false;
  v.ai = null;
  p.vehicle = v;
  p.aiming = false;
  p.vel.set(0, 0, 0);
  game.cameraRig.yaw = v.yaw;
  game.events.emit('enterVehicle', { vehicle: v });
}

export function exitVehicle(game) {
  const p = game.player;
  const v = p.vehicle;
  if (!v) return;
  const speed = vehicleSpeed(v);
  const door = doorPoint(v, 1);
  v.driver = null;
  v.controls.throttle = 0;
  v.controls.steer = 0;
  v.controls.handbrake = speed < 8;
  p.vehicle = null;
  p.pos.set(door.x, groundHeight(door.x, door.z), door.z);
  p.yaw = v.yaw;
  if (speed > 8) {
    // bail out: tumble onto the asphalt
    const r = vehicleRight(v);
    p.pos.x -= r.x * 1.2; p.pos.z -= r.z * 1.2;
    p.vel.set(v.vel.x * 0.35, 0, v.vel.z * 0.35);
    game.events.emit('playerHurt', { amount: Math.min(25, speed * 0.8), cause: 'bail' });
  }
  game.events.emit('exitVehicle', { vehicle: v, speed });
}
