// Cash: earning and spending with a pop-up on the HUD, and the bills for hospital stays and bail.
import { popCash } from '../ui/hud.js';

export function addMoney(game, amount, reason = '') {
  game.money = Math.max(0, game.money + amount);
  popCash(game, amount);
  game.events.emit('money', { amount, reason });
}

export function spendMoney(game, amount) {
  if (game.money < amount) return false;
  addMoney(game, -amount, 'purchase');
  return true;
}

export const HOSPITAL_BILL = 500;
export const BAIL = 750;
