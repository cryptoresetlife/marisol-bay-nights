// The day-night cycle: sun path and shadows, sky and fog colours by the hour, moonlight, exposure,
// and a night factor that switches on windows, neon, street lamps and headlights.
import * as THREE from 'three';
import { updateSky } from './sky.js';

const KEYS = [
  { h: 0, top: '#060c22', hor: '#1d2a50', sun: '#6d7fb5', sunI: 0.0, sky: '#4a5c9a', gnd: '#1a1830', hemi: 0.8, fog: '#16203d', exp: 1.3, cloud: '#2c3557' },
  { h: 5.2, top: '#0b1430', hor: '#2a3358', sun: '#6d7fb5', sunI: 0.0, sky: '#4a5c9a', gnd: '#1a1a2a', hemi: 0.75, fog: '#1d2545', exp: 1.25, cloud: '#3b4468' },
  { h: 6.3, top: '#3a5fa8', hor: '#ff9e6b', sun: '#ffb27a', sunI: 1.1, sky: '#8ea6d8', gnd: '#5a4a44', hemi: 0.6, fog: '#e7a98a', exp: 1.0, cloud: '#ffc2a0' },
  { h: 8.0, top: '#2f7fe0', hor: '#a9dcf5', sun: '#fff0d6', sunI: 2.8, sky: '#a8d4ff', gnd: '#8c7a62', hemi: 0.9, fog: '#b9def2', exp: 0.9, cloud: '#ffffff' },
  { h: 13, top: '#1a6fe0', hor: '#a9dcf5', sun: '#fff7e8', sunI: 3.3, sky: '#b0dcff', gnd: '#8f7e66', hemi: 0.95, fog: '#b8e0f5', exp: 0.88, cloud: '#ffffff' },
  { h: 15.6, top: '#1c6ce0', hor: '#b4dff5', sun: '#fff1da', sunI: 3.2, sky: '#acd6ff', gnd: '#8f7a62', hemi: 0.92, fog: '#bfe0f0', exp: 0.88, cloud: '#ffffff' },
  { h: 17, top: '#2368d6', hor: '#ffcf96', sun: '#ffcf8f', sunI: 3.0, sky: '#a9c9f0', gnd: '#8a6f55', hemi: 0.85, fog: '#f0cfa8', exp: 0.9, cloud: '#fff0dc' },
  { h: 18.9, top: '#3b4f9e', hor: '#ff8a5c', sun: '#ff8f4f', sunI: 1.6, sky: '#9a8fc4', gnd: '#6a4c45', hemi: 0.7, fog: '#f0957a', exp: 1.05, cloud: '#ffab85' },
  { h: 19.9, top: '#1b2457', hor: '#c75a6a', sun: '#ff6a4f', sunI: 0.35, sky: '#5a4f8a', gnd: '#2a2030', hemi: 0.55, fog: '#7a4a62', exp: 1.1, cloud: '#c77a8a' },
  { h: 21, top: '#080f2a', hor: '#2a2f5c', sun: '#6d7fb5', sunI: 0.0, sky: '#4c5ea0', gnd: '#1c1a30', hemi: 0.8, fog: '#1a2244', exp: 1.3, cloud: '#2f3a5c' },
  { h: 24, top: '#060c22', hor: '#1d2a50', sun: '#6d7fb5', sunI: 0.0, sky: '#4a5c9a', gnd: '#1a1830', hemi: 0.8, fog: '#16203d', exp: 1.3, cloud: '#2c3557' },
];
const COLOR_FIELDS = ['top', 'hor', 'sun', 'sky', 'gnd', 'fog', 'cloud'];

export function createDayNight(scene, sky, { shadows = true } = {}) {
  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 1; sc.far = 700;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);
  const moon = new THREE.DirectionalLight('#8fa6ff', 0.0);
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight('#b0dcff', '#8f7e66', 1);
  scene.add(hemi);
  scene.fog = new THREE.Fog('#bfe3f5', 160, 1300);
  const pal = {};
  for (const f of COLOR_FIELDS) pal[f] = new THREE.Color();
  return { sun, moon, hemi, sky, pal, night: 0, hours: 10, sunDir: new THREE.Vector3(), lastEnvHour: -1 };
}

function sampleKeys(h, pal) {
  let a = KEYS[0], b = KEYS[1];
  for (let k = 0; k < KEYS.length - 1; k++) {
    if (h >= KEYS[k].h && h <= KEYS[k + 1].h) { a = KEYS[k]; b = KEYS[k + 1]; break; }
  }
  const t = (h - a.h) / Math.max(0.001, b.h - a.h);
  for (const f of COLOR_FIELDS) pal[f].set(a[f]).lerp(new THREE.Color(b[f]), t);
  return { sunI: a.sunI + (b.sunI - a.sunI) * t, hemiI: a.hemi + (b.hemi - a.hemi) * t, exp: a.exp + (b.exp - a.exp) * t };
}

export function updateDayNight(dn, hours, focus, cameraPos, renderer, dt) {
  dn.hours = ((hours % 24) + 24) % 24;
  const h = dn.hours;
  const s = sampleKeys(h, dn.pal);
  // sun rises over the ocean in the east and sets behind the hills in the west
  const a = ((h - 6.2) / 13.6) * Math.PI;
  dn.sunDir.set(Math.cos(a), Math.max(-0.3, Math.sin(a)) * 0.95 + 0.02, 0.42).normalize();
  const elev = dn.sunDir.y;
  dn.night = THREE.MathUtils.clamp(1 - (elev + 0.05) / 0.25, 0, 1);

  dn.sun.color.copy(dn.pal.sun);
  dn.sun.intensity = s.sunI * THREE.MathUtils.clamp(elev * 4, 0, 1);
  dn.sun.position.copy(focus).addScaledVector(dn.sunDir, 300);
  dn.sun.target.position.copy(focus);
  dn.moon.intensity = dn.night * 0.55;
  dn.moon.position.set(focus.x - 120, focus.y + 260, focus.z - 80);
  dn.moon.target.position.copy(focus);
  dn.hemi.color.copy(dn.pal.sky);
  dn.hemi.groundColor.copy(dn.pal.gnd);
  dn.hemi.intensity = s.hemiI;
  dn.sun.parent.fog.color.copy(dn.pal.fog);
  renderer.toneMappingExposure = s.exp;

  const u = dn.sky.uniforms;
  u.topColor.value.copy(dn.pal.top);
  u.horizonColor.value.copy(dn.pal.hor);
  u.groundColor.value.copy(dn.pal.fog);
  u.sunColor.value.copy(dn.pal.sun).multiplyScalar(elev > -0.05 ? 1 : 0);
  u.sunDir.value.copy(dn.sunDir);
  updateSky(dn.sky, cameraPos, dt, dn.pal.cloud, dn.night);
  refreshEnvironment(dn, renderer, Math.floor(h * 2));
  return dn.night;
}

// Re-renders the sky into a reflection map every half hour so car paint and glass mirror the sky.
function refreshEnvironment(dn, renderer, bucket) {
  if (bucket === dn.lastEnvHour) return;
  dn.lastEnvHour = bucket;
  const scene = dn.sun.parent;
  if (!dn.pmrem) {
    dn.pmrem = new THREE.PMREMGenerator(renderer);
    dn.envScene = new THREE.Scene();
    dn.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), dn.sky.dome.material));
  }
  if (dn.envTarget) dn.envTarget.dispose();
  dn.envTarget = dn.pmrem.fromScene(dn.envScene, 0.03);
  scene.environment = dn.envTarget.texture;
  scene.environmentIntensity = 0.55 * (1 - dn.night * 0.75);
}

export function formatClock(hours) {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
