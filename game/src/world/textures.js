// Procedural canvas textures: building facades and their lit windows, asphalt with lane paint,
// crosswalks, sidewalks, grass, sand, planks, neon signs, clouds and a tileable water normal map.
import * as THREE from 'three';
import { createRng } from '../core/rng.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function speckle(ctx, w, h, rng, count, colors, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.fillRect(rng() * w, rng() * h, size * (0.5 + rng()), size * (0.5 + rng()));
  }
}

const FACADES = {
  glass: { wall: '#dfe6ea', bandH: 0.22, win: [0.06, 0.24, 0.94, 0.97], glass: ['#3d6f93', '#6fa7c9', '#a9d6ee'] },
  deco: { wall: '#ffffff', bandH: 0, win: [0.2, 0.3, 0.8, 0.72], glass: ['#2f6f8a', '#57a3bd', '#9bd3e0'], ledge: true },
  mid: { wall: '#f1e9dc', bandH: 0, win: [0.16, 0.22, 0.84, 0.8], glass: ['#2b4660', '#4f7896', '#86b3cf'] },
  villa: { wall: '#fffaf2', bandH: 0, win: [0.28, 0.26, 0.72, 0.74], glass: ['#3b5c70', '#5e8aa2'], shutters: true },
  brick: { wall: '#f3d9c4', bandH: 0, win: [0.22, 0.24, 0.78, 0.76], glass: ['#2a3e52', '#486a85'], bricks: true },
  industrial: { wall: '#e8e4dc', bandH: 0, win: [0.15, 0.62, 0.85, 0.82], glass: ['#4a5a66', '#6d7f8c'], ribs: true },
};

// A facade texture holds 8 x 8 window bays; one UV unit spans the whole tile.
export function makeFacadeTexture(style) {
  const key = 'facade:' + style;
  if (cache.has(key)) return cache.get(key);
  const f = FACADES[style];
  const rng = createRng(style.length * 977 + 13);
  const S = 512, C = S / 8;
  const [c, ctx] = canvas(S, S);
  const [e, ectx] = canvas(S, S);
  ctx.fillStyle = f.wall; ctx.fillRect(0, 0, S, S);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, S, S);
  if (f.bricks) {
    ctx.fillStyle = 'rgba(150,90,70,0.18)';
    for (let y = 0; y < S; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < S; x += 12) ctx.fillRect(x, y, 11, 5);
  }
  if (f.ribs) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let x = 0; x < S; x += 8) ctx.fillRect(x, 0, 3, S);
  }
  speckle(ctx, S, S, rng, 1800, ['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.08)'], 3);
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const x0 = gx * C, y0 = gy * C;
      if (f.bandH) { ctx.fillStyle = 'rgba(90,110,125,0.35)'; ctx.fillRect(x0, y0 + C * (1 - f.bandH), C, C * f.bandH); }
      const [ax, ay, bx, by] = f.win;
      const wx = x0 + ax * C, wy = y0 + ay * C, ww = (bx - ax) * C, wh = (by - ay) * C;
      const g = ctx.createLinearGradient(wx, wy, wx + ww * 0.6, wy + wh);
      const tint = f.glass[Math.floor(rng() * f.glass.length)];
      g.addColorStop(0, '#c8e6f5'); g.addColorStop(0.35, tint); g.addColorStop(1, '#1d3346');
      ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
      if (style === 'glass') { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(wx + ww * 0.48, wy, 2, wh); }
      if (f.ledge) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x0 + C * 0.12, wy - 5, C * 0.76, 5); }
      if (f.shutters) { ctx.fillStyle = 'rgba(40,120,110,0.85)'; ctx.fillRect(wx - 8, wy, 7, wh); ctx.fillRect(wx + ww + 1, wy, 7, wh); }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(wx, wy + wh, ww, 3);
      // lit windows for the night (emissive map)
      const r = rng();
      if (r < 0.46) {
        const warm = rng() < 0.7;
        ectx.fillStyle = warm ? `hsl(${34 + rng() * 14},95%,${62 + rng() * 18}%)` : `hsl(${190 + rng() * 30},80%,${70 + rng() * 15}%)`;
        ectx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
        if (rng() < 0.4) { ectx.fillStyle = 'rgba(0,0,0,0.55)'; ectx.fillRect(wx + ww * rng(), wy, ww * 0.3, wh); }
      }
    }
  }
  const out = { map: toTexture(c), emissive: toTexture(e) };
  cache.set(key, out);
  return out;
}

function asphalt(ctx, w, h, rng) {
  ctx.fillStyle = '#44474d'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, rng, w * h / 18, ['#3b3e44', '#4d5056', '#55585e', '#393c41'], 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 6; i++) ctx.fillRect(rng() * w, 0, 3 + rng() * 6, h);
}

// One road tile: 16 m across (u) by 32 m along (v). Double yellow centre, dashed lane lines, solid edges.
export function makeRoadTexture() {
  if (cache.has('road')) return cache.get('road');
  const rng = createRng(41);
  const W = 256, H = 512, ppm = 16;
  const [c, ctx] = canvas(W, H);
  asphalt(ctx, W, H, rng);
  // darker wheel tracks
  ctx.fillStyle = 'rgba(20,20,24,0.16)';
  for (const off of [-3.0, -1.2, 1.2, 3.0]) ctx.fillRect(W / 2 + off * ppm - 6, 0, 12, H);
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(W / 2 - 5, 0, 3, H);
  ctx.fillRect(W / 2 + 2, 0, 3, H);
  ctx.fillStyle = '#f4f4f0';
  for (const s of [-1, 1]) {
    for (let y = 0; y < H; y += 128) ctx.fillRect(W / 2 + s * 4.1 * ppm - 2, y + 20, 4, 52);
    ctx.fillRect(W / 2 + s * 7.55 * ppm - 2, 0, 4, H);
  }
  const t = toTexture(c);
  cache.set('road', t);
  return t;
}

export function makeIntersectionTexture() {
  if (cache.has('cross')) return cache.get('cross');
  const rng = createRng(77);
  const [c, ctx] = canvas(256, 256);
  asphalt(ctx, 256, 256, rng);
  const t = toTexture(c);
  cache.set('cross', t);
  return t;
}

export function makeCrosswalkTexture() {
  if (cache.has('zebra')) return cache.get('zebra');
  const [c, ctx] = canvas(256, 64);
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(248,248,244,0.95)';
  for (let x = 6; x < 256; x += 22) ctx.fillRect(x, 4, 12, 56);
  const t = toTexture(c, { repeat: false });
  cache.set('zebra', t);
  return t;
}

export function makeSidewalkTexture() {
  if (cache.has('walk')) return cache.get('walk');
  const rng = createRng(5);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#d8d2c6'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 3000, ['#cfc8bb', '#e2ddd2', '#c6bfb2'], 2);
  ctx.strokeStyle = 'rgba(90,80,70,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  const t = toTexture(c);
  cache.set('walk', t);
  return t;
}

export function makeNoiseTexture(key, base, colors, count = 6000, size = 3) {
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(key.length * 31 + 7);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, count, colors, size);
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

export const makeGrassTexture = () => makeNoiseTexture('grass', '#5fae4a', ['#55a043', '#6cbb55', '#4e9640', '#79c45e'], 9000, 3);
export const makeSandTexture = () => makeNoiseTexture('sand', '#f1dcae', ['#e9d09e', '#f7e6c0', '#e2c690', '#fff1d4'], 9000, 2);
export const makeQuayTexture = () => makeNoiseTexture('quay', '#a9a59d', ['#9d998f', '#b5b1a8', '#8f8b82'], 7000, 3);

export function makePlankTexture() {
  if (cache.has('plank')) return cache.get('plank');
  const rng = createRng(9);
  const [c, ctx] = canvas(256, 256);
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = `hsl(28,${38 + rng() * 12}%,${40 + rng() * 10}%)`;
    ctx.fillRect(0, y, 256, 15);
    ctx.fillStyle = 'rgba(40,20,10,0.6)'; ctx.fillRect(0, y + 15, 256, 1);
  }
  speckle(ctx, 256, 256, rng, 1500, ['rgba(60,30,10,0.25)', 'rgba(255,230,200,0.12)'], 3);
  const t = toTexture(c);
  cache.set('plank', t);
  return t;
}

export function makeSignTexture(text, { fg = '#ff4fd8', bg = 'rgba(20,10,30,0.92)', border = fg, font = 'bold 74px "Trebuchet MS", "Segoe UI", sans-serif', w = 512, h = 128 } = {}) {
  const key = `sign:${text}:${fg}:${bg}:${w}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(w, h);
  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, 4, 4, w - 8, h - 8, 18); ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 6; ctx.shadowColor = border; ctx.shadowBlur = 14;
    roundRect(ctx, 10, 10, w - 20, h - 20, 14); ctx.stroke();
  }
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(text).width > w - 50 && size > 20) { size -= 4; ctx.font = font.replace(/\d+px/, size + 'px'); }
  ctx.shadowColor = fg; ctx.shadowBlur = 22; ctx.fillStyle = fg;
  ctx.fillText(text, w / 2, h / 2 + 4);
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.55;
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = toTexture(c, { repeat: false });
  cache.set(key, t);
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function makeStripeTexture(a, b) {
  const key = `stripe:${a}:${b}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(128, 32);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? b : a; ctx.fillRect(i * 16, 0, 16, 32); }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

export function makeCloudTexture(seed) {
  const key = 'cloud' + seed;
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed * 101 + 3);
  const [c, ctx] = canvas(256, 128);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rng() * 176, y = 50 + rng() * 40 - Math.abs(x - 128) * 0.12, r = 18 + rng() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = toTexture(c, { repeat: false });
  cache.set(key, t);
  return t;
}

export function makeGlowTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = toTexture(c, { repeat: false });
  cache.set('glow', t);
  return t;
}

export function makeBeamTexture() {
  if (cache.has('beam')) return cache.get('beam');
  const [c, ctx] = canvas(8, 128);
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 128);
  const t = toTexture(c, { repeat: false });
  cache.set('beam', t);
  return t;
}

// Tileable normal map from a sum of integer-frequency waves.
export function makeWaterNormalTexture() {
  if (cache.has('waterN')) return cache.get('waterN');
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S);
  const waves = [[3, 1, 0.9], [1, 4, 0.7], [5, -2, 0.45], [-7, 3, 0.3], [9, 8, 0.2], [2, -11, 0.18], [13, 5, 0.12]];
  const h = (x, y) => waves.reduce((s, [a, b, amp], k) => s + amp * Math.sin(((a * x + b * y) / S) * Math.PI * 2 + k * 1.7), 0);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, { srgb: false });
  cache.set('waterN', t);
  return t;
}
