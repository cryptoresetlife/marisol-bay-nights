// The sky: a gradient dome with a sun glow, drifting cumulus clouds and stars that come out at night.
import * as THREE from 'three';
import { makeCloudTexture } from './textures.js';
import { createRng, randRange } from '../core/rng.js';

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 groundColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.5));
  if (h < 0.0) col = mix(horizonColor, groundColor, clamp(-h * 5.0, 0.0, 1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 1400.0) * 6.0 + pow(s, 64.0) * 0.45 + pow(s, 6.0) * 0.18);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color('#3a8ee6') },
    horizonColor: { value: new THREE.Color('#bfe3f5') },
    groundColor: { value: new THREE.Color('#9fc6d6') },
    sunColor: { value: new THREE.Color('#fff2d0') },
    sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  const rng = createRng(2024);
  const clouds = [];
  const cloudGroup = new THREE.Group();
  for (let k = 0; k < 34; k++) {
    const mat = new THREE.SpriteMaterial({ map: makeCloudTexture(k % 6), transparent: true, depthWrite: false, fog: false, opacity: randRange(rng, 0.75, 0.95) });
    const s = new THREE.Sprite(mat);
    const a = rng() * Math.PI * 2, r = randRange(rng, 600, 1250);
    s.position.set(Math.cos(a) * r, randRange(rng, 170, 360), Math.sin(a) * r);
    const w = randRange(rng, 220, 420);
    s.scale.set(w, w * randRange(rng, 0.35, 0.5), 1);
    cloudGroup.add(s);
    clouds.push({ sprite: s, angle: a, radius: r, speed: randRange(rng, 0.002, 0.006), baseOpacity: mat.opacity });
  }
  scene.add(cloudGroup);

  const starPos = [];
  for (let k = 0; k < 900; k++) {
    const u = rng() * 2 - 1, a = rng() * Math.PI * 2;
    const y = Math.abs(u) * 0.95 + 0.05;
    const r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * r * 1400, y * 1400, Math.sin(a) * r * 1400);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  return { dome, uniforms, clouds, cloudGroup, stars, starMat };
}

export function updateSky(sky, cameraPos, dt, tint, night) {
  sky.dome.position.copy(cameraPos);
  sky.stars.position.copy(cameraPos);
  sky.cloudGroup.position.set(cameraPos.x, 0, cameraPos.z);
  for (const c of sky.clouds) {
    c.angle += c.speed * dt;
    c.sprite.position.x = Math.cos(c.angle) * c.radius;
    c.sprite.position.z = Math.sin(c.angle) * c.radius;
    c.sprite.material.color.copy(tint);
    c.sprite.material.opacity = c.baseOpacity * (1 - night * 0.6);
  }
  sky.starMat.opacity = Math.max(0, night - 0.3) * 1.3;
}
