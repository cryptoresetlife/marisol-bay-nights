// When things go wrong: "HOSPITALIZED" wakes Dez outside Mercy General minus the bill; "ARRESTED" releases
// him from MBPD Central minus bail and some ammo. Both fade the screen, clear the stars and fail any mission.
import { getLandmark, landmarkDoor } from '../world/landmarks.js';
import { clearWanted } from '../police/wanted.js';
import { exitVehicle } from '../vehicles/carjack.js';
import { showBanner } from '../ui/hud.js';
import { addMoney, HOSPITAL_BILL, BAIL } from '../economy/money.js';
import { groundHeight } from '../world/terrain.js';
import { removeGunman } from '../combat/gunmen.js';

export function createRespawn() {
  return { state: null, t: 0 };
}

export function beginWasted(game, kind) {
  const r = game.respawn;
  if (r.state) return;
  r.state = kind;
  r.t = 0;
  if (kind === 'hospital') showBanner(game, 'HOSPITALIZED', 'Mercy General will send the bill', '#ff4f5e', 4);
  else showBanner(game, 'ARRESTED', 'Marisol Bay PD takes you downtown', '#5aa8ff', 4);
  game.events.emit('missionFailedBy', { reason: kind === 'hospital' ? 'You were hospitalized.' : 'You were arrested.' });
}

export function updateRespawn(game, dt) {
  const r = game.respawn;
  if (!r.state) return;
  r.t += dt;
  game.timeScale = r.t < 2.2 ? 0.35 : 1;
  game.hud.fade = Math.max(0, Math.min(1, (r.t - 2.2) / 0.8));
  if (r.t > 3.2 && !r.moved) {
    r.moved = true;
    const p = game.player;
    if (p.vehicle) exitVehicle(game);
    const lm = getLandmark(r.state === 'hospital' ? 'hospital' : 'police');
    const d = landmarkDoor(lm);
    p.pos.set(d.x + d.dx * 1.5, groundHeight(d.x, d.z), d.z + d.dz * 1.5);
    p.yaw = Math.atan2(d.dx, d.dz);
    game.cameraRig.yaw = p.yaw;
    p.health = p.maxHealth;
    p.alive = true;
    p.invulnerable = 3;
    if (r.state === 'hospital') { addMoney(game, -Math.min(game.money, HOSPITAL_BILL), 'hospital'); p.armor = 0; }
    else {
      addMoney(game, -Math.min(game.money, BAIL), 'bail');
      for (const id of Object.keys(p.weapons)) if (id !== 'fists') p.weapons[id].ammo = Math.floor(p.weapons[id].ammo * 0.5);
    }
    clearWanted(game);
    for (const g of [...game.hostiles]) if (!g.mission) removeGunman(game, g);
    game.hours = (game.hours + 6) % 24;
  }
  if (r.t > 4) {
    game.hud.fade = Math.max(0, 1 - (r.t - 4) / 0.8);
    if (r.t > 4.8) { r.state = null; r.moved = false; game.hud.fade = 0; game.timeScale = 1; }
  }
}
