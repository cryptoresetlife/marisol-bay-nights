// Weather over Marisol Bay: mostly sunny, sometimes hazy or clouded over, now and then a tropical downpour.
// Each state sets fog distance, cloud cover and darkness and how much sunlight gets through; rain draws
// falling streaks around the camera, soaks the asphalt (shinier, reflecting lamps and neon) and costs
// cars some grip until the streets dry out. `?weather=rain|cloudy|hazy|sunny` pins it for testing.
import * as THREE from 'three';

export const WEATHER = {
  sunny: { label: 'Sunny', fogNear: 160, fogFar: 1300, cloud: 1, dark: 0, sun: 1, rain: 0, weight: 55 },
  hazy: { label: 'Hazy', fogNear: 70, fogFar: 750, cloud: 0.8, dark: 0.05, sun: 0.85, rain: 0, weight: 20 },
  cloudy: { label: 'Cloudy', fogNear: 80, fogFar: 700, cloud: 1.3, dark: 0.4, sun: 0.45, rain: 0, weight: 15 },
  rain: { label: 'Rain', fogNear: 40, fogFar: 420, cloud: 1.4, dark: 0.6, sun: 0.22, rain: 1, weight: 10 },
};
const KEYS = Object.keys(WEATHER);
const RAIN_DROPS = 2600;
const BOX = { w: 70, h: 32 };
const grey = new THREE.Color('#7f8a96');

export function createWeather(scene, streets, forced = null) {
  const pos = new Float32Array(RAIN_DROPS * 6);
  for (let i = 0; i < RAIN_DROPS; i++) {
    const x = (Math.random() - 0.5) * BOX.w, y = Math.random() * BOX.h, z = (Math.random() - 0.5) * BOX.w;
    pos.set([x, y, z, x + 0.05, y + 0.9, z + 0.02], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#b8d4ff', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const rain = new THREE.LineSegments(geo, mat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const start = forced && WEATHER[forced] ? forced : 'sunny';
  const w = {
    state: start, locked: !!(forced && WEATHER[forced]), timer: 240 + Math.random() * 180,
    cur: { ...WEATHER[start] }, wetness: WEATHER[start].rain, rain, rainMat: mat, rainPos: pos,
    wetMaterials: streets.wetMaterials || [],
  };
  return w;
}

export function weatherLabel(w) { return WEATHER[w.state].label; }

export function setWeather(w, state, instant = false) {
  if (!WEATHER[state]) return;
  w.state = state;
  if (instant) { w.cur = { ...WEATHER[state] }; w.wetness = WEATHER[state].rain; }
}

function pickNext(w) {
  let roll = Math.random() * KEYS.reduce((s, k) => s + WEATHER[k].weight, 0);
  for (const k of KEYS) { roll -= WEATHER[k].weight; if (roll <= 0) return k; }
  return 'sunny';
}

// grip multiplier for cars on wet roads
export function roadGrip(w) { return w ? 1 - w.wetness * 0.18 : 1; }

// Runs after the day-night cycle each frame and scales what it set.
export function updateWeather(game, dt) {
  const w = game.weather;
  if (!w) return;
  if (!w.locked && game.mode === 'play') {
    w.timer -= dt;
    if (w.timer <= 0) {
      const next = pickNext(w);
      if (next !== w.state) game.events.emit('weatherChanged', { from: w.state, to: next });
      w.state = next;
      w.timer = 240 + Math.random() * 240;
    }
  }
  const target = WEATHER[w.state];
  const k = Math.min(1, dt * 0.25);
  for (const f of ['fogNear', 'fogFar', 'cloud', 'dark', 'sun', 'rain']) w.cur[f] += (target[f] - w.cur[f]) * k;
  w.wetness = THREE.MathUtils.clamp(w.wetness + (w.cur.rain > 0.3 ? dt * 0.06 : -dt * 0.012), 0, 1);

  const dn = game.city.dayNight;
  const scene = game.engine.scene;
  const c = w.cur;
  dn.sun.intensity *= c.sun;
  dn.hemi.intensity *= 1 - c.dark * 0.35;
  scene.fog.near = c.fogNear;
  scene.fog.far = c.fogFar;
  scene.fog.color.lerp(grey.clone().multiplyScalar(1 - game.night * 0.75), c.dark * 0.6);
  const u = dn.sky.uniforms;
  u.topColor.value.lerp(grey.clone().multiplyScalar(0.8 - game.night * 0.6), c.dark * 0.7);
  u.horizonColor.value.lerp(scene.fog.color, c.dark * 0.8);
  for (const cl of dn.sky.clouds) {
    cl.sprite.material.opacity = Math.min(1, cl.sprite.material.opacity * c.cloud);
    cl.sprite.material.color.multiplyScalar(1 - c.dark * 0.55);
  }
  for (const m of w.wetMaterials) { m.roughness = 0.92 - w.wetness * 0.62; m.metalness = w.wetness * 0.25; }

  // rain streaks follow the camera and wrap inside a box around it
  w.rain.visible = c.rain > 0.02;
  if (w.rain.visible) {
    const cam = game.engine.camera.position;
    w.rain.position.set(cam.x, cam.y - BOX.h * 0.4, cam.z);
    w.rainMat.opacity = 0.3 * c.rain;
    const p = w.rainPos, fall = 26 * dt;
    for (let i = 0; i < RAIN_DROPS; i++) {
      const o = i * 6;
      p[o + 1] -= fall; p[o + 4] -= fall;
      if (p[o + 1] < 0) { p[o + 1] += BOX.h; p[o + 4] += BOX.h; }
    }
    w.rain.geometry.attributes.position.needsUpdate = true;
  }
}
