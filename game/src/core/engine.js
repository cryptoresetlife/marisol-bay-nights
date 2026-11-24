// Renderer, scene and camera: the WebGL plumbing every other system draws into.
import * as THREE from 'three';
import { createPostFx, renderWithPostFx } from '../fx/postfx.js';

export function createEngine(canvas, { shadows = true, pixelRatio = 1.5, postFx = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio));
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 2200);

  const engine = { renderer, scene, camera, width: 1, height: 1, postFx: postFx ? createPostFx(renderer) : null, night: 0 };
  const resize = () => {
    engine.width = window.innerWidth;
    engine.height = window.innerHeight;
    renderer.setSize(engine.width, engine.height, false);
    camera.aspect = engine.width / engine.height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  return engine;
}

export function renderFrame(engine) {
  if (engine.postFx) renderWithPostFx(engine.postFx, engine.scene, engine.camera, engine.night);
  else engine.renderer.render(engine.scene, engine.camera);
}
