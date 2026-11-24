// Post-processing written for this game: the scene renders into an HDR multisampled target, bright parts
// (sun glare, neon, headlights, siren bars) bleed into a two-level bloom, then one composite pass applies
// ACES tone mapping, a warm sunset colour grade, a touch of saturation and a soft vignette.
import * as THREE from 'three';

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(threshold, threshold + 0.8, l);
  gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0);
}`;

const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
  c += (texture2D(tInput, vUv + texel * 1.384615).rgb + texture2D(tInput, vUv - texel * 1.384615).rgb) * 0.316216;
  c += (texture2D(tInput, vUv + texel * 3.230769).rgb + texture2D(tInput, vUv - texel * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float bloomStrength;
uniform float saturation;
uniform float vignette;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.9;
  c += bloom * bloomStrength;
  // split-tone grade in linear light: cool shadows, warm highlights
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= mix(shadowTint, highlightTint, smoothstep(0.05, 0.9, l));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 g = gl_FragColor.rgb;
  float gl = dot(g, vec3(0.299, 0.587, 0.114));
  g = mix(vec3(gl), g, saturation);
  vec2 d = vUv - 0.5;
  g *= 1.0 - vignette * smoothstep(0.32, 0.95, dot(d, d) * 2.2);
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

function target(w, h, samples = 0) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0 });
}

export function createPostFx(renderer) {
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const fx = {
    renderer, quadScene, quadCam, quad, width: 0, height: 0,
    scene: target(1, 1, 4), half: target(1, 1), blurA: target(1, 1), blurB: target(1, 1), blurC: target(1, 1), blurD: target(1, 1),
    bright: new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, threshold: { value: 1.0 } }, vertexShader: QUAD_VERTEX, fragmentShader: BRIGHT_FRAGMENT, depthTest: false, depthWrite: false }),
    blur: new THREE.ShaderMaterial({ uniforms: { tInput: { value: null }, texel: { value: new THREE.Vector2() } }, vertexShader: QUAD_VERTEX, fragmentShader: BLUR_FRAGMENT, depthTest: false, depthWrite: false }),
    composite: new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
        bloomStrength: { value: 0.55 }, saturation: { value: 1.12 }, vignette: { value: 0.32 },
        shadowTint: { value: new THREE.Color(0.94, 0.98, 1.06) }, highlightTint: { value: new THREE.Color(1.05, 1.0, 0.94) },
      },
      vertexShader: QUAD_VERTEX, fragmentShader: COMPOSITE_FRAGMENT, depthTest: false, depthWrite: false,
    }),
  };
  return fx;
}

function resizePostFx(fx) {
  const size = fx.renderer.getDrawingBufferSize(new THREE.Vector2());
  if (size.x === fx.width && size.y === fx.height) return;
  fx.width = size.x; fx.height = size.y;
  fx.scene.setSize(size.x, size.y);
  fx.half.setSize(size.x >> 1, size.y >> 1);
  fx.blurA.setSize(size.x >> 2, size.y >> 2);
  fx.blurB.setSize(size.x >> 2, size.y >> 2);
  fx.blurC.setSize(size.x >> 3, size.y >> 3);
  fx.blurD.setSize(size.x >> 3, size.y >> 3);
}

function pass(fx, material, output) {
  fx.quad.material = material;
  fx.renderer.setRenderTarget(output);
  fx.renderer.render(fx.quadScene, fx.quadCam);
}

function blurInto(fx, src, tmp, dst) {
  const u = fx.blur.uniforms;
  u.tInput.value = src.texture;
  u.texel.value.set(1 / tmp.width, 0);
  pass(fx, fx.blur, tmp);
  u.tInput.value = tmp.texture;
  u.texel.value.set(0, 1 / tmp.height);
  pass(fx, fx.blur, dst);
}

// night (0..1) pushes the bloom up so neon and lamps glow, and cools the grade a little.
export function renderWithPostFx(fx, scene, camera, night = 0) {
  resizePostFx(fx);
  const r = fx.renderer;
  r.setRenderTarget(fx.scene);
  r.render(scene, camera);
  fx.sceneCalls = r.info.render.calls;
  fx.sceneTriangles = r.info.render.triangles;
  fx.bright.uniforms.tScene.value = fx.scene.texture;
  fx.bright.uniforms.threshold.value = 1.05 - night * 0.45;
  pass(fx, fx.bright, fx.half);
  blurInto(fx, fx.half, fx.blurA, fx.blurB);
  blurInto(fx, fx.blurB, fx.blurC, fx.blurD);
  const u = fx.composite.uniforms;
  u.tScene.value = fx.scene.texture;
  u.tBloomA.value = fx.blurB.texture;
  u.tBloomB.value = fx.blurD.texture;
  u.bloomStrength.value = 0.45 + night * 0.65;
  u.shadowTint.value.setRGB(0.94 - night * 0.04, 0.98, 1.06 + night * 0.06);
  pass(fx, fx.composite, null);
}
