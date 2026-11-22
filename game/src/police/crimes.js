// What the law notices: gunfire, assaults, running people over, carjackings, attacks on officers and
// their cruisers. Each is reported to the wanted level; gunfire also scatters crowds and traffic.
import { reportCrime } from './wanted.js';
import { scarePedestrians } from '../characters/pedestrians.js';
import { panicTrafficNear } from '../vehicles/traffic.js';
import { alertGunmenNear } from '../combat/gunmen.js';

export function installCrimeRules(game) {
  const ev = game.events;
  const byPlayer = (s) => s && s.kind === 'player';
  const at = () => (game.player.vehicle ? game.player.vehicle.pos : game.player.pos);
  ev.on('gunfire', ({ shooter, x, z }) => {
    scarePedestrians(game, x, z, 45);
    panicTrafficNear(game, x, z, 40);
    if (byPlayer(shooter)) {
      alertGunmenNear(game, x, z, 40, 'gang');
      if (!game.missionAllowsGunfire) reportCrime(game, 'gunfire', x, z);
    }
  });
  ev.on('pedAttacked', ({ shooter, melee }) => { if (byPlayer(shooter)) reportCrime(game, melee ? 'assault' : 'killPed', at().x, at().z); });
  ev.on('pedKilled', ({ cause }) => { if (cause === 'vehicle' && game.player.vehicle) reportCrime(game, 'killPed', at().x, at().z); });
  ev.on('vehicleHitPed', ({ vehicle }) => {
    if (vehicle === game.player.vehicle) { reportCrime(game, 'hitPed', vehicle.pos.x, vehicle.pos.z); scarePedestrians(game, vehicle.pos.x, vehicle.pos.z, 25); }
  });
  ev.on('carjack', ({ vehicle, police }) => reportCrime(game, police ? 'stealPolice' : 'carjack', vehicle.pos.x, vehicle.pos.z));
  ev.on('enterVehicle', ({ vehicle }) => { if (vehicle.isPolice) reportCrime(game, 'stealPolice', vehicle.pos.x, vehicle.pos.z); });
  ev.on('gunmanAttacked', ({ gunman, shooter }) => {
    if (!byPlayer(shooter)) return;
    if (gunman.faction === 'police' || gunman.faction === 'swat') reportCrime(game, 'assaultCop', gunman.pos.x, gunman.pos.z);
  });
  ev.on('gunmanKilled', ({ gunman, source }) => {
    if (byPlayer(source) && (gunman.faction === 'police' || gunman.faction === 'swat')) reportCrime(game, 'killCop', gunman.pos.x, gunman.pos.z);
  });
  ev.on('vehicleShot', ({ vehicle }) => {
    if (vehicle.isPolice) reportCrime(game, 'shootPoliceCar', vehicle.pos.x, vehicle.pos.z);
    vehicle.lastAttacker = game.player;
    vehicle.attackedByPlayer = true;
  });
  ev.on('vehicleImpact', ({ vehicle, other, impact }) => {
    const pv = game.player.vehicle;
    if (!pv || impact < 6) return;
    const hit = vehicle === pv ? other : other === pv ? vehicle : null;
    if (hit) hit.attackedByPlayer = true;
    if (hit && hit.isPolice && game.wanted.level === 0) reportCrime(game, 'ramPolice', pv.pos.x, pv.pos.z);
  });
}
