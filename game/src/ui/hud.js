// The heads-up display: radar with health and armour, wanted stars, cash, clock, weapon and ammo, mission
// title / objective / counter, speedometer and radio, location, crosshair, prompts, dispatch feed and banners.
import { createMinimap, drawMinimap } from './minimap.js';
import { WEAPONS } from '../combat/weapons.js';
import { formatClock } from '../world/daynight.js';
import { locationLabel } from '../world/districts.js';
import { vehicleSpeed } from '../vehicles/vehicle.js';

const html = `
<div class="hud-tr">
  <div class="hud-clock" id="hudClock">10:30</div>
  <div class="hud-stars" id="hudStars">${'<span>★</span>'.repeat(5)}</div>
  <div class="hud-money" id="hudMoney">$0</div>
  <div class="hud-weapon" id="hudWeapon"><div class="w-icon" id="hudWIcon"></div><div><div class="w-name" id="hudWName">Fists</div><div class="w-ammo" id="hudWAmmo"></div></div></div>
</div>
<div class="hud-mission" id="hudMission"><div class="m-chapter" id="hudChapter"></div><div class="m-title" id="hudMTitle"></div><div class="m-obj" id="hudMObj"></div><div class="m-count" id="hudMCount"></div></div>
<div class="hud-radar" id="hudRadar"><div class="hud-bars"><div class="bar health"><i id="hudHealth"></i></div><div class="bar armor"><i id="hudArmor"></i></div></div></div>
<div class="hud-location" id="hudLocation"></div>
<div class="hud-vehicle" id="hudVehicle"><canvas id="hudGauge" width="190" height="120"></canvas><div class="v-name" id="hudVName"></div><div class="v-radio" id="hudRadio"></div></div>
<div class="hud-events" id="hudEvents"></div>
<div class="hud-subtitle" id="hudSubtitle"></div>
<div class="hud-banner" id="hudBanner"><div class="b-title" id="hudBTitle"></div><div class="b-sub" id="hudBSub"></div></div>
<div class="hud-cross" id="hudCross"></div>
<div class="hud-prompt" id="hudPrompt"></div>
<div class="hud-cash-pop" id="hudCashPop"></div>
<div class="hud-hurt" id="hudHurt"></div>
<div class="hud-fade" id="hudFade"></div>`;

export function createHud(game, mapCanvas) {
  const root = document.getElementById('hud');
  root.innerHTML = html;
  const $ = (id) => document.getElementById(id);
  const hud = {
    root, $,
    minimap: createMinimap($('hudRadar'), mapCanvas),
    stars: [...$('hudStars').children],
    events: [], banner: null, prompt: '', locationT: 0, lastLocation: '', cashPopT: 0, shownMoney: 0, fade: 0,
  };
  return hud;
}

export function showEvent(game, text, color = '#ffffff') {
  const hud = game.hud;
  const el = document.createElement('div');
  el.className = 'ev';
  el.style.borderLeftColor = color;
  el.textContent = text;
  hud.$('hudEvents').prepend(el);
  hud.events.push({ el, t: 5 });
  while (hud.events.length > 4) hud.events.shift().el.remove();
}

export function showBanner(game, title, sub = '', color = '#ffd166', duration = 4) {
  const hud = game.hud;
  hud.$('hudBTitle').textContent = title;
  hud.$('hudBTitle').style.color = color;
  hud.$('hudBSub').textContent = sub;
  hud.banner = { t: duration };
  hud.$('hudBanner').classList.add('show');
}

export function setPrompt(game, text) {
  game.hud.prompt = text || '';
}

export function popCash(game, amount) {
  const el = game.hud.$('hudCashPop');
  el.textContent = (amount >= 0 ? '+$' : '-$') + Math.abs(amount).toLocaleString('en-US');
  el.style.color = amount >= 0 ? '#7dffb0' : '#ff6b6b';
  game.hud.cashPopT = 2.5;
}

function drawGauge(canvas, speedKmh, maxKmh, rpm) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H - 14, R = 82;
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(10,14,24,0.65)';
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.stroke();
  const t = Math.min(1, speedKmh / maxKmh);
  const grad = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  grad.addColorStop(0, '#3fe0d0'); grad.addColorStop(0.6, '#ffd166'); grad.addColorStop(1, '#ff4f7a');
  ctx.strokeStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * t); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(cx, cy, R - 12, Math.PI, Math.PI + Math.PI * Math.min(1, rpm)); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic bold 44px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
  ctx.fillText(String(Math.round(speedKmh)), cx, cy - 14);
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.fillText('KM/H', cx, cy + 2);
  ctx.shadowBlur = 0;
}

export function updateHud(game, dt) {
  const hud = game.hud;
  const $ = hud.$;
  const p = game.player;
  hud.root.style.display = game.mode === 'title' || game.hideHud ? 'none' : 'block';
  if (game.mode === 'title') return;
  $('hudClock').textContent = formatClock(game.hours);
  const w = game.wanted;
  const blink = w.searching && Math.floor(game.time * 3) % 2 === 0;
  hud.stars.forEach((s, i) => {
    s.className = i < w.level ? (blink ? 'on blink' : 'on') : '';
  });
  hud.shownMoney += (game.money - hud.shownMoney) * Math.min(1, dt * 6);
  if (Math.abs(game.money - hud.shownMoney) < 1) hud.shownMoney = game.money;
  $('hudMoney').textContent = '$' + Math.round(hud.shownMoney).toLocaleString('en-US');
  const weapon = WEAPONS[p.current];
  $('hudWName').textContent = weapon.name;
  const slot = p.weapons[p.current];
  $('hudWAmmo').textContent = weapon.melee ? '' : (p.reloadT > 0 ? 'RELOADING' : `${slot.clip} / ${slot.ammo}`);
  $('hudWIcon').className = 'w-icon w-' + p.current;
  $('hudWeapon').style.display = p.vehicle ? 'none' : 'inline-flex';
  $('hudHealth').style.width = Math.max(0, p.health / p.maxHealth * 100) + '%';
  $('hudArmor').style.width = Math.max(0, p.armor) + '%';
  $('hudHealth').parentElement.classList.toggle('low', p.health < 30);

  // mission panel
  const m = game.missionHud;
  const panel = $('hudMission');
  panel.style.display = m && m.title ? 'block' : 'none';
  if (m && m.title) {
    $('hudChapter').textContent = m.chapter || '';
    $('hudMTitle').textContent = m.title;
    $('hudMObj').textContent = m.objective || '';
    $('hudMCount').textContent = m.counter || '';
    $('hudMCount').style.display = m.counter ? 'block' : 'none';
  }

  // vehicle panel
  const v = p.vehicle;
  $('hudVehicle').style.display = v ? 'block' : 'none';
  if (v) {
    const kmh = vehicleSpeed(v) * 3.6;
    drawGauge($('hudGauge'), kmh, v.type.maxSpeed * 3.6, game.engineRpm || 0);
    $('hudVName').textContent = v.type.name;
    $('hudRadio').textContent = game.radioLabel || '';
  }

  // location appears when it changes
  const pos = v ? v.pos : p.pos;
  const loc = locationLabel(pos.x, pos.z);
  if (loc !== hud.lastLocation) { hud.lastLocation = loc; hud.locationT = 5; $('hudLocation').textContent = loc; }
  hud.locationT -= dt;
  $('hudLocation').classList.toggle('show', hud.locationT > 0 || !!v || game.alwaysShowLocation);

  for (let i = hud.events.length - 1; i >= 0; i--) {
    const e = hud.events[i];
    e.t -= dt;
    e.el.style.opacity = Math.min(1, e.t);
    if (e.t <= 0) { e.el.remove(); hud.events.splice(i, 1); }
  }
  if (hud.banner) {
    hud.banner.t -= dt;
    if (hud.banner.t <= 0) { hud.banner = null; $('hudBanner').classList.remove('show'); }
  }
  $('hudCross').style.display = !v && p.alive && game.mode === 'play' && (p.aiming || p.current !== 'fists') ? 'block' : 'none';
  $('hudCross').classList.toggle('aim', p.aiming);
  $('hudPrompt').textContent = hud.prompt;
  $('hudPrompt').style.display = hud.prompt ? 'block' : 'none';
  hud.cashPopT -= dt;
  $('hudCashPop').style.opacity = Math.max(0, Math.min(1, hud.cashPopT));
  const hurt = Math.max(0, 1 - (game.time - p.lastDamage) * 1.5) * 0.8 + (p.health < 30 ? 0.25 + Math.sin(game.time * 5) * 0.1 : 0);
  $('hudHurt').style.opacity = hurt;
  $('hudFade').style.opacity = hud.fade;
  drawMinimap(game, hud.minimap);
}
