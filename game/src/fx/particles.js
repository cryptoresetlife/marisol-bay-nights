// GPU point-sprite particles: smoke, fire, sparks, dust, blood and muzzle flashes, in one blended pool and
// one additive pool, each drawn in a single call with soft round sprites and scene fog.
import * as THREE from 'three';

const VERTEX = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
#include <fog_pars_vertex>
void main() {
  vAlpha = alpha;
  vTint = tint;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (520.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vTint;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vTint, a);
  #include <fog_fragment>
}`;

class ParticlePool {
  constructor(scene, capacity, blending) {
    this.capacity = capacity;
    this.count = 0;
    this.pos = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.fade = new Float32Array(capacity);
    this.startAlpha = new Float32Array(capacity);
    this.cool = new Float32Array(capacity);
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.tintAttr = new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('tint', this.tintAttr);
    g.setAttribute('size', this.sizeAttr);
    g.setAttribute('alpha', this.alphaAttr);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, blending, fog: true,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, { size = 1, life = 1, color = '#ffffff', alpha = 1, grow = 0, gravity = 0, cool = 0 } = {}) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = tmp.set(color);
    this.tint[i * 3] = c.r; this.tint[i * 3 + 1] = c.g; this.tint[i * 3 + 2] = c.b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life;
    this.alpha[i] = alpha; this.startAlpha[i] = alpha;
    this.grow[i] = grow; this.gravity[i] = gravity; this.cool[i] = cool;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const k = i * 3;
      this.vel[k + 1] -= this.gravity[i] * dt;
      const drag = Math.max(0, 1 - dt * 1.2);
      this.vel[k] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.05) { this.pos[k + 1] = 0.05; this.vel[k + 1] *= -0.3; }
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.startAlpha[i] * Math.min(1, t * 2.2);
      if (this.cool[i] > 0) { // fire cools from yellow to deep red
        this.tint[k + 1] *= Math.max(0, 1 - this.cool[i] * dt);
        this.tint[k + 2] *= Math.max(0, 1 - this.cool[i] * dt * 2);
      }
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.count);
    this.posAttr.needsUpdate = this.tintAttr.needsUpdate = this.sizeAttr.needsUpdate = this.alphaAttr.needsUpdate = true;
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    const copy3 = (arr) => { arr[i * 3] = arr[last * 3]; arr[i * 3 + 1] = arr[last * 3 + 1]; arr[i * 3 + 2] = arr[last * 3 + 2]; };
    copy3(this.pos); copy3(this.vel); copy3(this.tint);
    for (const arr of [this.size, this.alpha, this.life, this.maxLife, this.grow, this.gravity, this.startAlpha, this.cool]) arr[i] = arr[last];
  }
}

const tmp = new THREE.Color();

export function createParticles(scene) {
  return {
    soft: new ParticlePool(scene, 2400, THREE.NormalBlending),
    glow: new ParticlePool(scene, 1600, THREE.AdditiveBlending),
  };
}

export function updateParticles(fx, dt) {
  fx.soft.update(dt);
  fx.glow.update(dt);
}

const r = (s) => (Math.random() - 0.5) * s;

export function emitSmoke(fx, x, y, z, dark = 0.4, amount = 1) {
  for (let k = 0; k < amount; k++) {
    const g = 0.25 + (1 - dark) * 0.55 + Math.random() * 0.1;
    fx.soft.emit(x + r(0.6), y, z + r(0.6), r(0.8), 1.4 + Math.random(), r(0.8), { size: 0.9 + Math.random() * 0.6, life: 2.2 + Math.random(), color: new THREE.Color(g, g, g * 1.02).getStyle(), alpha: 0.55, grow: 1.4 });
  }
}

export function emitFire(fx, x, y, z, amount = 1, scale = 1) {
  for (let k = 0; k < amount; k++) {
    fx.glow.emit(x + r(0.9 * scale), y + Math.random() * 0.3, z + r(0.9 * scale), r(0.6), 2 + Math.random() * 2, r(0.6), { size: (0.7 + Math.random() * 0.7) * scale, life: 0.5 + Math.random() * 0.4, color: '#ffd27a', alpha: 0.9, grow: -0.6, cool: 2.5 });
  }
}

export function emitSparks(fx, x, y, z, count = 8, color = '#ffdf8a') {
  for (let k = 0; k < count; k++) {
    fx.glow.emit(x, y, z, r(7), Math.random() * 5, r(7), { size: 0.12, life: 0.35 + Math.random() * 0.3, color, alpha: 1, gravity: 14 });
  }
}

export function emitDust(fx, x, y, z, count = 4, color = '#d8cbb0') {
  for (let k = 0; k < count; k++) fx.soft.emit(x + r(0.4), y, z + r(0.4), r(1.5), Math.random() * 1.2, r(1.5), { size: 0.4, life: 0.8, color, alpha: 0.45, grow: 1.2 });
}

export function emitBlood(fx, x, y, z) {
  for (let k = 0; k < 7; k++) fx.soft.emit(x, y, z, r(2.5), Math.random() * 2.5, r(2.5), { size: 0.14, life: 0.6, color: '#9b1010', alpha: 0.95, gravity: 9 });
}

export function emitMuzzleFlash(fx, x, y, z) {
  fx.glow.emit(x, y, z, 0, 0, 0, { size: 0.9, life: 0.06, color: '#ffe9a8', alpha: 1 });
  fx.glow.emit(x, y, z, 0, 0, 0, { size: 0.45, life: 0.09, color: '#ffffff', alpha: 1 });
}

export function emitTireSmoke(fx, x, z) {
  fx.soft.emit(x + r(0.3), 0.25, z + r(0.3), r(0.6), 0.6, r(0.6), { size: 0.6, life: 1.1, color: '#e9e9e9', alpha: 0.32, grow: 1.6 });
}
