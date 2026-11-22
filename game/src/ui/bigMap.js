// The full map (M): the whole of Marisol Bay with district names, street names, shop icons, mission
// targets, the player arrow and a legend.
import { worldToMap, MAP_BOUNDS } from './mapPainter.js';
import { collectBlips, SHOP_ICONS } from './minimap.js';
import { DISTRICTS, AVENUE_NAMES, STREET_NAMES } from '../world/districts.js';
import { GRID } from '../world/roads.js';
import { LANDMARKS } from '../world/landmarks.js';

const DISTRICT_LABELS = [
  ['Palm Heights', -230, -250], ['Midtown', 45, -250], ['Ocean Strip', 270, -230], ['Downtown', 30, -10],
  ['Flamingo Park', -135, -45], ['Dockyards', -230, 200], ['Southside', 60, 220], ['Sunset Beach', 360, 110],
  ['The Pier', 470, -64], ['Harbor Front', -40, 336],
];

export function createBigMap(mapCanvas) {
  const wrap = document.createElement('div');
  wrap.id = 'bigmap';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);
  return { wrap, canvas, map: mapCanvas, open: false };
}

export function toggleBigMap(game, open = !game.bigMap.open) {
  game.bigMap.open = open;
  game.bigMap.wrap.style.display = open ? 'block' : 'none';
}

export function drawBigMap(game) {
  const bm = game.bigMap;
  if (!bm.open) return;
  const c = bm.canvas;
  c.width = window.innerWidth; c.height = window.innerHeight;
  const ctx = c.getContext('2d');
  const mw = bm.map.width, mh = bm.map.height;
  const s = Math.min((c.width - 340) / mw, (c.height - 80) / mh);
  const ox = 30 + ((c.width - 340) - mw * s) / 2, oy = (c.height - mh * s) / 2;
  ctx.fillStyle = '#0a1324'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bm.map, ox, oy, mw * s, mh * s);
  const at = (x, z) => { const m = worldToMap(x, z); return { x: ox + m.x * s, y: oy + m.y * s }; };
  const px = MAP_BOUNDS.scale * s; // screen pixels per metre

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // street names
  ctx.font = `bold ${Math.max(9, px * 6)}px "Trebuchet MS", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < GRID.count; k++) {
    const c0 = GRID.origin + k * GRID.pitch;
    const a = at(c0, GRID.origin + GRID.pitch * 1.5);
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(-Math.PI / 2); ctx.fillText(AVENUE_NAMES[k], 0, 0); ctx.restore();
    const b = at(GRID.origin + GRID.pitch * 2.5 + (k % 2) * GRID.pitch * 2, c0);
    ctx.fillText(STREET_NAMES[k], b.x, b.y);
  }
  // district names
  ctx.font = `italic bold ${Math.max(14, px * 13)}px Impact, "Arial Black", sans-serif`;
  for (const [name, x, z] of DISTRICT_LABELS) {
    const p = at(x, z);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(name.toUpperCase(), p.x, p.y);
    const d = Object.values(DISTRICTS).find((dd) => dd.name === name);
    ctx.fillStyle = d ? d.color : '#ffffff';
    ctx.fillText(name.toUpperCase(), p.x, p.y);
  }
  for (const b of collectBlips(game)) {
    const p = at(b.x, b.z);
    if (b.dot) { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(p.x, p.y, (b.size || 4) * 1.2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b1020'; ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.fillText(b.glyph, p.x, p.y + 1);
  }
  const pl = game.player.vehicle ? game.player.vehicle : game.player;
  const pp = at(pl.pos.x, pl.pos.z);
  ctx.save(); ctx.translate(pp.x, pp.y); ctx.rotate(Math.PI - pl.yaw);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();

  // legend
  const lx = c.width - 290, ly = 40;
  ctx.fillStyle = 'rgba(10,14,30,0.9)'; ctx.fillRect(lx, ly, 260, 52 + LANDMARKS.length * 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166'; ctx.font = 'italic bold 26px Impact, "Arial Black", sans-serif';
  ctx.fillText('MARISOL BAY', lx + 16, ly + 24);
  ctx.font = '15px "Trebuchet MS", sans-serif';
  const seen = new Set();
  let row = 0;
  for (const lm of LANDMARKS) {
    const icon = SHOP_ICONS[lm.id];
    if (!icon || seen.has(lm.name)) continue;
    seen.add(lm.name);
    const y = ly + 58 + row * 26;
    ctx.fillStyle = icon.color; ctx.beginPath(); ctx.arc(lx + 26, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b1020'; ctx.textAlign = 'center'; ctx.font = 'bold 12px "Trebuchet MS", sans-serif'; ctx.fillText(icon.glyph, lx + 26, y + 1);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '15px "Trebuchet MS", sans-serif'; ctx.fillText(lm.name, lx + 44, y + 1);
    row++;
  }
  const y = ly + 58 + row * 26;
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(lx + 26, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('Mission target', lx + 44, y + 1);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('M or Esc to close', lx + 16, y + 34);
}
