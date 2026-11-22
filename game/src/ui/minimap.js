// The radar: a round, camera-aligned slice of the city map with the player arrow, shops, mission targets,
// police units and enemies; blips off the edge stick to the rim and the frame flashes red and blue when wanted.
import { worldToMap, MAP_BOUNDS } from './mapPainter.js';
import { LANDMARKS, landmarkDoor } from '../world/landmarks.js';

export const SHOP_ICONS = {
  tikiTaco: { glyph: 'L', color: '#ffb347' }, safehouse: { glyph: 'H', color: '#5ff2a0' }, hospital: { glyph: '+', color: '#ff5a5a' },
  police: { glyph: 'P', color: '#4fa8ff' }, gunShop: { glyph: 'G', color: '#ff7b2e' }, sprayNorth: { glyph: 'S', color: '#ff4fd8' },
  spraySouth: { glyph: 'S', color: '#ff4fd8' }, bank: { glyph: '$', color: '#7dffb0' }, vanceTower: { glyph: 'V', color: '#ffd86b' },
  garage: { glyph: 'W', color: '#ffe14d' }, coralHQ: { glyph: 'C', color: '#ff5f7a' },
};

export function collectBlips(game) {
  const blips = [];
  for (const lm of LANDMARKS) {
    const icon = SHOP_ICONS[lm.id];
    if (!icon || (lm.id === 'coralHQ' && !game.story?.revealedHQ)) continue;
    const d = landmarkDoor(lm);
    blips.push({ x: d.x, z: d.z, glyph: icon.glyph, color: icon.color, kind: 'shop', label: lm.name });
  }
  for (const b of game.missionBlips || []) blips.push(b);
  const flash = Math.floor(game.time * 4) % 2 === 0;
  for (const v of game.vehicles) {
    if (v.ai?.mode === 'police' && v.driver && !v.destroyed && (game.wanted.level > 0 || v.ai.state === 'roadblock')) blips.push({ x: v.pos.x, z: v.pos.z, dot: true, color: flash ? '#ff3b3b' : '#3b7bff', kind: 'police', size: 5 });
    if (v.ai?.mode === 'race') blips.push({ x: v.pos.x, z: v.pos.z, dot: true, color: '#c77dff', kind: 'racer', size: 4 });
  }
  for (const g of game.hostiles) {
    if (g.dead) continue;
    const cop = g.faction === 'police' || g.faction === 'swat';
    if (cop && game.wanted.level === 0) continue;
    blips.push({ x: g.pos.x, z: g.pos.z, dot: true, color: cop ? (flash ? '#ff3b3b' : '#3b7bff') : '#ff4040', kind: cop ? 'police' : 'enemy', size: 3.5 });
  }
  return blips;
}

export function createMinimap(container, mapCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = 260; canvas.height = 260;
  canvas.className = 'minimap-canvas';
  container.appendChild(canvas);
  return { canvas, ctx: canvas.getContext('2d'), map: mapCanvas, zoom: 1 };
}

function drawGlyph(ctx, x, y, glyph, color, r = 9) {
  ctx.fillStyle = 'rgba(10,14,24,0.9)';
  ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10131c';
  ctx.font = `bold ${Math.round(r * 1.3)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y + 1);
}

export function drawMinimap(game, mm) {
  const { ctx, canvas } = mm;
  const W = canvas.width, R = W / 2 - 6;
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  const speed = game.player.vehicle ? Math.abs(game.player.vehicle.forwardSpeed) : 0;
  mm.zoom += ((0.95 - Math.min(0.4, speed / 90)) - mm.zoom) * 0.05; // pixels per metre
  const yaw = game.cameraRig.yaw;
  const theta = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#2a7fc0'; ctx.fillRect(0, 0, W, W);
  ctx.translate(W / 2, W / 2);
  ctx.rotate(theta);
  const k = mm.zoom / MAP_BOUNDS.scale;
  ctx.scale(k, k);
  const m = worldToMap(p.x, p.z);
  ctx.drawImage(mm.map, -m.x, -m.y);
  ctx.restore();

  // blips: positions rotate with the map, icons stay upright
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const toScreen = (x, z) => {
    const dx = (x - p.x) * mm.zoom, dz = (z - p.z) * mm.zoom;
    let sx = dx * cos - dz * sin, sy = dx * sin + dz * cos;
    const d = Math.hypot(sx, sy);
    const edge = d > R - 10;
    if (edge) { sx *= (R - 10) / d; sy *= (R - 10) / d; }
    return { x: W / 2 + sx, y: W / 2 + sy, edge };
  };
  for (const b of collectBlips(game)) {
    const s = toScreen(b.x, b.z);
    if (b.kind === 'shop' && s.edge) continue;
    if (b.dot) {
      if (s.edge && b.kind !== 'target') continue;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, b.size || 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    } else drawGlyph(ctx, s.x, s.y, b.glyph, b.color, b.kind === 'target' ? 10 : 8);
  }
  // route line to the active objective
  // player arrow
  const pyaw = game.player.vehicle ? game.player.vehicle.yaw : game.player.yaw;
  const a = -Math.PI / 2 - Math.atan2(Math.cos(pyaw), Math.sin(pyaw)) - theta;
  ctx.save();
  ctx.translate(W / 2, W / 2);
  ctx.rotate(-a);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath();
  ctx.stroke(); ctx.fill();
  ctx.restore();
  // north marker
  const n = toScreen(p.x, p.z - 1000);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('N', n.x, n.y); ctx.fillText('N', n.x, n.y);
  // frame
  const wanted = game.wanted.level > 0;
  const flash = Math.floor(game.time * 5) % 2 === 0;
  ctx.lineWidth = 6;
  ctx.strokeStyle = wanted ? (flash ? '#ff2d3a' : '#2d6bff') : 'rgba(15,20,32,0.95)';
  ctx.beginPath(); ctx.arc(W / 2, W / 2, R + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(W / 2, W / 2, R - 2.5, 0, Math.PI * 2); ctx.stroke();
}
