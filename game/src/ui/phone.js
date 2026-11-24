// Dez's phone (P): a contact list he can call from anywhere. Lupe points him at the next story job and
// marks it on the map, Manny's Motors delivers a Marlin GT to the nearest kerb, Sal Benedetti (lawyer)
// makes two wanted stars go away for a fee, and the Seabreeze line saves the game when nobody is chasing.
import { wasKeyPressed } from '../core/input.js';
import { spendMoney } from '../economy/money.js';
import { showEvent } from './hud.js';
import { playDialogue } from './dialogue.js';
import { setWantedLevel } from '../police/wanted.js';
import { createVehicle } from '../vehicles/vehicle.js';
import { nearestRoad, GRID } from '../world/roads.js';

export const CONTACTS = [
  { id: 'lupe', name: 'Lupe', role: 'Tiki Taco', color: '#ff6fd0' },
  { id: 'mechanic', name: "Manny's Motors", role: 'Car delivery · $500', color: '#7df9ff', price: 500 },
  { id: 'lawyer', name: 'Sal Benedetti', role: 'Lawyer · -2 stars · $1,500', color: '#ffd166', price: 1500 },
  { id: 'safehouse', name: 'Seabreeze Apts', role: 'Save game', color: '#7dffb0' },
];

export function createPhone() {
  return { open: false, el: null, cooldown: {} };
}

function render(game) {
  const ph = game.phone;
  if (!ph.el) {
    ph.el = document.createElement('div');
    ph.el.className = 'hud-phone';
    game.hud.root.appendChild(ph.el);
  }
  const rows = CONTACTS.map((c, i) => `<div class="ph-row"><b style="color:${c.color}">${i + 1}</b><div><div class="ph-name">${c.name}</div><div class="ph-role">${c.role}</div></div></div>`).join('');
  ph.el.innerHTML = `<div class="ph-top">CONTACTS</div>${rows}<div class="ph-foot">1-4 call · P close</div>`;
  ph.el.classList.toggle('show', ph.open);
}

export function togglePhone(game, open = !game.phone.open) {
  game.phone.open = open;
  render(game);
  game.events.emit('uiMove', {});
}

// a delivery spot on the driving lane of the road nearest to Dez
function kerbSpot(game) {
  const p = game.player.pos;
  const road = nearestRoad(p.x, p.z);
  const centre = GRID.origin + road.index * GRID.pitch;
  if (road.axis === 'NS') return { x: centre - GRID.laneOffset, z: p.z + 6, yaw: 0 };
  return { x: p.x + 6, z: centre + GRID.laneOffset, yaw: Math.PI / 2 };
}

export function callContact(game, id) {
  const c = CONTACTS.find((k) => k.id === id);
  if (!c) return false;
  if ((game.phone.cooldown[id] || 0) > game.time) { showEvent(game, `${c.name}: line busy, try again soon`, '#aaaaaa'); return false; }
  if (c.price && game.money < c.price) { showEvent(game, `${c.name}: come back when you have $${c.price.toLocaleString()}`, '#ff6b6b'); game.events.emit('uiDeny', {}); return false; }
  if (id === 'lupe') {
    const next = game.missionHud;
    playDialogue(game, [['Lupe', next && !game.activeMission ? `Dez! ${next.title} is waiting. ${next.objective}.` : 'Focus on the job, Dez. Call me when it is done.']], null, 3);
  } else if (id === 'mechanic') {
    if (game.player.vehicle) { showEvent(game, "Manny's Motors: get out of that car first", '#aaaaaa'); return false; }
    const s = kerbSpot(game);
    spendMoney(game, c.price);
    createVehicle(game, 'marlin', { x: s.x, z: s.z, yaw: s.yaw, color: '#7df9ff', parked: true });
    playDialogue(game, [["Manny", 'Marlin GT, full tank, at the kerb next to you. Bring it back in one piece.']], null, 3);
  } else if (id === 'lawyer') {
    if (game.wanted.level === 0) { showEvent(game, 'Sal Benedetti: nobody is looking for you, kid', '#aaaaaa'); return false; }
    spendMoney(game, c.price);
    setWantedLevel(game, Math.max(0, game.wanted.level - 2));
    playDialogue(game, [['Sal', 'I made a couple of calls downtown. Keep your head down for an hour.']], null, 3);
  } else if (id === 'safehouse') {
    if (game.wanted.level > 0) { showEvent(game, 'Lose the cops before you save', '#ff6b6b'); return false; }
    game.events.emit('requestSave', {});
  }
  game.phone.cooldown[id] = game.time + 20;
  togglePhone(game, false);
  return true;
}

export function updatePhone(game) {
  const input = game.input;
  if (game.mode !== 'play') { if (game.phone.open) togglePhone(game, false); return; }
  if (wasKeyPressed(input, 'KeyP')) togglePhone(game);
  if (!game.phone.open) return;
  for (let k = 1; k <= CONTACTS.length; k++) if (wasKeyPressed(input, 'Digit' + k)) callContact(game, CONTACTS[k - 1].id);
}
