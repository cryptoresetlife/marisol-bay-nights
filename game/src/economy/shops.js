// Places to spend money: Iron Pelican Arms for guns, ammo and body armour, and the Fresh Coat spray shops
// that repaint and repair your car and make the police forget your face. Walk or drive into the marker.
import { getLandmark, landmarkDoor, landmarkCurb } from '../world/landmarks.js';
import { WEAPONS, giveWeapon } from '../combat/weapons.js';
import { spendMoney } from './money.js';
import { clearWanted } from '../police/wanted.js';
import { openMenu, closeMenu } from '../ui/menus.js';
import { showEvent, setPrompt } from '../ui/hud.js';
import { wasKeyPressed } from '../core/input.js';

export const SPRAY_COST = 400;
const ARMOR_COST = 350;

const GUN_STOCK = [
  { id: 'pistol', unlock: 0 }, { id: 'smg', unlock: 2 }, { id: 'shotgun', unlock: 4 }, { id: 'rifle', unlock: 6 },
];

export function shopSpots() {
  return [
    { id: 'gunShop', kind: 'guns', ...landmarkDoor(getLandmark('gunShop')) },
    { id: 'sprayNorth', kind: 'spray', ...landmarkCurb(getLandmark('sprayNorth')) },
    { id: 'spraySouth', kind: 'spray', ...landmarkCurb(getLandmark('spraySouth')) },
    { id: 'safehouse', kind: 'save', ...landmarkDoor(getLandmark('safehouse')) },
  ];
}

export function updateShops(game, dt) {
  if (game.mode !== 'play') return;
  const p = game.player;
  const pos = p.vehicle ? p.vehicle.pos : p.pos;
  game.shopCooldown = Math.max(0, (game.shopCooldown || 0) - dt);
  for (const s of game.shops) {
    const d = Math.hypot(pos.x - s.x, pos.z - s.z);
    if (d > (s.kind === 'spray' ? 5 : 2.2)) continue;
    if (s.kind === 'guns' && !p.vehicle) {
      setPrompt(game, 'Press E to browse Iron Pelican Arms');
      if (wasKeyPressed(game.input, 'KeyE')) openGunShop(game);
    } else if (s.kind === 'save' && !p.vehicle) {
      setPrompt(game, 'Press E to save at the Seabreeze safehouse');
      if (wasKeyPressed(game.input, 'KeyE')) game.events.emit('requestSave', {});
    } else if (s.kind === 'spray' && p.vehicle && game.shopCooldown <= 0) {
      sprayVehicle(game);
    }
    return;
  }
}

export function sprayVehicle(game) {
  const v = game.player.vehicle;
  game.shopCooldown = 6;
  if (!spendMoney(game, SPRAY_COST)) { showEvent(game, `Fresh Coat: a respray costs $${SPRAY_COST}`, '#ff4fd8'); return false; }
  const colors = v.type.colors.length > 1 ? v.type.colors : ['#e63946', '#2ec4b6', '#ffb703', '#8338ec', '#ffffff'];
  const choices = colors.filter((c) => c !== v.color);
  v.color = choices[Math.floor(Math.random() * choices.length)] || '#ffffff';
  v.model.paint.color.set(v.color);
  v.health = v.maxHealth;
  v.burning = 0;
  const hadStars = game.wanted.level > 0;
  clearWanted(game);
  showEvent(game, hadStars ? 'Fresh Coat: new paint, new plates. The heat is off.' : 'Fresh Coat: fresh paint and a full repair.', '#ff4fd8');
  game.events.emit('resprayed', { vehicle: v, hadStars });
  return true;
}

export function openGunShop(game) {
  const p = game.player;
  const chapter = game.story ? game.story.chapter : 0;
  const render = () => {
    const rows = GUN_STOCK.map(({ id, unlock }) => {
      const w = WEAPONS[id];
      const owned = !!p.weapons[id];
      const locked = chapter < unlock;
      const label = locked ? `Unlocks in chapter ${unlock + 1}` : owned ? `Ammo x${w.ammoPack} — $${w.ammoPrice}` : `Buy — $${w.price}`;
      return `<div class="shop-item"><span>${w.name}</span><button data-buy="${id}" ${locked ? 'disabled' : ''}>${label}</button></div>`;
    }).join('');
    return `<h2>IRON PELICAN ARMS</h2><div class="shop-cash">$${game.money.toLocaleString('en-US')}</div>
      <div class="shop-list">${rows}<div class="shop-item"><span>Body Armour</span><button data-buy="armor" ${p.armor >= 100 ? 'disabled' : ''}>Buy — $${ARMOR_COST}</button></div></div>
      <div class="menu-buttons"><button data-act="close">Leave</button></div>`;
  };
  const onClick = (target) => {
    const id = target.dataset.buy;
    if (target.dataset.act === 'close') { closeMenu(game); return; }
    if (!id) return;
    if (id === 'armor') { if (spendMoney(game, ARMOR_COST)) { p.armor = 100; game.events.emit('uiBuy', {}); } }
    else {
      const w = WEAPONS[id];
      const cost = p.weapons[id] ? w.ammoPrice : w.price;
      if (spendMoney(game, cost)) { giveWeapon(p, id, p.weapons[id] ? w.ammoPack : w.ammoPack); p.current = id; game.events.emit('uiBuy', {}); }
      else game.events.emit('uiDeny', {});
    }
    openMenu(game, 'shop', render(), onClick);
  };
  openMenu(game, 'shop', render(), onClick);
}
