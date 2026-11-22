// Menus: the title screen over a slow flight across the bay, the pause menu, settings (volume, music,
// mouse sensitivity, traffic and crowd density), the controls card, and a generic panel used by shops.
// Arrow keys and Enter work as well as the mouse.
import { releasePointer, wasKeyPressed } from '../core/input.js';

const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['Mouse', 'Look around'], ['Shift', 'Sprint'], ['Space', 'Jump / handbrake'],
  ['F', 'Enter, exit or steal a car'], ['Left click', 'Fire / punch'], ['Right click', 'Aim'], ['Q / E, wheel', 'Switch weapon'],
  ['R', 'Reload (on foot) / radio station (in car)'], ['H', 'Horn'], ['M', 'Map'], ['T', 'Taxi job (in a cab)'], ['Esc', 'Pause'],
];

export function openMenu(game, id, innerHtml, onClick, { dim = true, panel = true, className = '' } = {}) {
  const root = document.getElementById('menus');
  root.innerHTML = `<div class="menu ${dim ? 'dim' : ''} ${className}">${panel ? `<div class="panel">${innerHtml}</div>` : innerHtml}</div>`;
  game.menu = { id, onClick, sel: 0, prevMode: game.menu ? game.menu.prevMode : game.mode };
  if (game.mode !== 'title') game.mode = 'menu';
  releasePointer();
  root.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); game.events.emit('uiClick', {}); onClick(b); }));
  root.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => onClick(r)));
  highlight(game);
}

export function closeMenu(game, nextMode = 'play') {
  document.getElementById('menus').innerHTML = '';
  game.menu = null;
  game.mode = nextMode;
}

function buttons() {
  return [...document.querySelectorAll('#menus button:not(:disabled)')];
}

function highlight(game) {
  const list = buttons();
  list.forEach((b, i) => b.classList.toggle('sel', i === game.menu.sel));
}

export function updateMenuKeys(game) {
  if (!game.menu) return;
  const list = buttons();
  if (!list.length) return;
  const input = game.input;
  if (wasKeyPressed(input, 'ArrowDown', 'KeyS')) { game.menu.sel = (game.menu.sel + 1) % list.length; highlight(game); game.events.emit('uiMove', {}); }
  if (wasKeyPressed(input, 'ArrowUp', 'KeyW')) { game.menu.sel = (game.menu.sel - 1 + list.length) % list.length; highlight(game); game.events.emit('uiMove', {}); }
  if (wasKeyPressed(input, 'Enter')) { const b = list[Math.min(game.menu.sel, list.length - 1)]; game.events.emit('uiClick', {}); game.menu.onClick(b); }
}

export function showTitleScreen(game, { hasSave, onNew, onContinue }) {
  game.mode = 'title';
  game.menu = null;
  const html = `
    <div class="logo">SUNDOWN<br>SYNDICATE</div>
    <div class="logo-sub">MARISOL BAY</div>
    <div class="menu-buttons">
      <button data-act="new">New Game</button>
      <button data-act="continue" ${hasSave ? '' : 'disabled'}>Continue</button>
      <button data-act="controls">Controls</button>
      <button data-act="settings">Settings</button>
    </div>
    <div class="footer-note">An original open-world story · keyboard and mouse</div>`;
  openMenu(game, 'title', html, (b) => {
    const act = b.dataset.act;
    if (act === 'new') onNew();
    else if (act === 'continue') onContinue();
    else if (act === 'controls') showControls(game, () => showTitleScreen(game, { hasSave, onNew, onContinue }));
    else if (act === 'settings') showSettings(game, () => showTitleScreen(game, { hasSave, onNew, onContinue }));
  }, { dim: false, panel: false, className: 'title-screen' });
}

export function showControls(game, back) {
  const grid = CONTROLS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('');
  openMenu(game, 'controls', `<h2>CONTROLS</h2><div class="controls-grid">${grid}</div><div class="menu-buttons"><button data-act="back">Back</button></div>`, () => back());
}

export function showSettings(game, back) {
  const s = game.settings;
  const slider = (key, label, min, max, step) => `<div class="row"><span>${label}</span><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></div>`;
  const html = `<h2>SETTINGS</h2>
    ${slider('volume', 'Master volume', 0, 1, 0.05)}${slider('music', 'Radio volume', 0, 1, 0.05)}
    ${slider('sensitivity', 'Mouse sensitivity', 0.3, 2.5, 0.05)}${slider('trafficDensity', 'Traffic density', 0.3, 1.5, 0.1)}
    ${slider('pedDensity', 'Crowd density', 0.3, 1.5, 0.1)}
    <div class="menu-buttons" style="margin-top:16px"><button data-act="back">Back</button></div>`;
  openMenu(game, 'settings', html, (el) => {
    if (el.dataset.key) { s[el.dataset.key] = Number(el.value); game.events.emit('settingsChanged', s); try { localStorage.setItem('sundown.settings', JSON.stringify(s)); } catch { /* private mode */ } return; }
    back();
  });
}

export function loadSettings(game) {
  try { Object.assign(game.settings, JSON.parse(localStorage.getItem('sundown.settings') || '{}')); } catch { /* ignore */ }
}

export function showPauseMenu(game, { onSave, onQuit }) {
  const html = `<h2>PAUSED</h2><div class="menu-buttons">
    <button data-act="resume">Resume</button><button data-act="save">Save Game</button>
    <button data-act="settings">Settings</button><button data-act="controls">Controls</button>
    <button data-act="quit">Quit to Title</button></div>`;
  openMenu(game, 'pause', html, (b) => {
    const act = b.dataset.act;
    if (act === 'resume') closeMenu(game);
    else if (act === 'save') { onSave(); closeMenu(game); }
    else if (act === 'settings') showSettings(game, () => showPauseMenu(game, { onSave, onQuit }));
    else if (act === 'controls') showControls(game, () => showPauseMenu(game, { onSave, onQuit }));
    else if (act === 'quit') onQuit();
  });
}
