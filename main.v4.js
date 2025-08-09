// ASCII Black Hole — background-only relativistic lensing + white planets/stars + white curved ring
// Drop-in for GitHub Pages (ESM CDN). Works with ASCII mode.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { AsciiEffect } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/effects/AsciiEffect.js";

console.log("Loaded main.v4.js (lensing + ASCII)");

/* DOM */
const container = document.getElementById("scene");
const modeToggle = document.getElementById("modeToggle");
const links = document.querySelectorAll('#topbar [data-section]');
const panelAbout = document.getElementById('panel-about');
const panelProjects = document.getElementById('panel-projects');
const panelContact = document.getElementById('panel-contact');
const panels = [panelAbout, panelProjects, panelContact];

/* Renderer + ASCII */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);

const asciiChars = " .:-=+*#%@";
const effect = new AsciiEffect(renderer, asciiChars, { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
effect.domElement.style.color = "#FFFFFF"; // pure white glyphs
effect.domElement.style.backgroundColor = "#000";
effect.domElement.style.fontSize = "6px";
effect.domElement.style.lineHeight = "6px";
let asciiEnabled = true;

/* Cameras */
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0.25, 4);

/* Controls */
let controls = new OrbitControls(camera, effect.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2.5;
controls.maxDistance = 6;

/* Scenes: background (stars+planets) and final (lensed background quad + BH core + ring) */
const sceneBG = new THREE.Scene();
const sceneFinal = new THREE.Scene();

/* Lights (minimal; stars are Points, planets use Basic material) */
sceneBG.add(new THREE.AmbientLight(0x1a1a1a, 1.0));
sceneFinal.add(new THREE.AmbientLight(0x1a1a1a, 1.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(3, 2, 1);
sceneFinal.add(keyLight);

/* --- Background content: stars + planets --- */
(function makeStars(count = 2000, radius = 130) {
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.85 + Math.random() * 0.25);
    positions.set([
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    ], i * 3);
  }
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, sizeAttenuation: true });
  sceneBG.add(new THREE.Points(g, m));
})();

const planets = [];
function addPlanet({ radius, distance, speed, tilt = 0, ring = false }) {
  const geo = new THREE.SphereGeometry(radius, 48, 48);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // flat white
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(distance, 0, 0);
  mesh.rotation.z = tilt;
  mesh.userData = { angle: Math.random() * Math.PI * 2, speed, distance };
  sceneBG.add(mesh);

  if (ring) {
    const ri = radius * 1.6;
    const ro = radius * 2.4;
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(ri, ro, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = Math.PI / 2 + tilt;
    mesh.add(ringMesh);
  }

  planets.push(mesh);
}

addPlanet({ radius: 0.18, distance: 8.5,  speed: 0.03,  tilt: 0.2,  ring: false });
addPlanet({ radius: 0.28, distance: 11.5, speed: 0.02,  tilt: -0.15, ring: true  });
addPlanet({ radius: 0.22, distance: 14.0, speed: 0.018, tilt: 0.05,  ring: false });

/* --- Foreground: event horizon + white curved accretion ring --- */
const horizonRadius = 0.78;
const core = new THREE.Mesh(
  new THREE.SphereGeometry(horizonRadius, 96, 96),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
sceneFinal.add(core);

// White, curved accretion ring (your shader, monochrome)
const diskInner = horizonRadius * 1.05;
const diskOuter = 1.95;
const accretion = new THREE.Mesh(
  new THREE.RingGeometry(diskInner, diskOuter, 384, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      u_time:     { value: 0 },
      u_noiseAmp: { value: 1.0 }
    },
    vertexShader: `
      varying float vT;
      varying float vPhi;
      void main(){
        vec3 p = position;
        float r = length(p.xy);
        vT = clamp((r - ${diskInner.toFixed(4)}) / (${(diskOuter - diskInner).toFixed(4)}), 0.0, 1.0);
        vPhi = atan(p.y, p.x);
        float puff = 0.20 * (1.0 - vT);
        p.z += puff * sin(vPhi * 2.0);
        p.z += (1.0 - vT) * 0.32;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vT;
      varying float vPhi;
      uniform float u_time;
      uniform float u_noiseAmp;
      float hash(float n){ return fract(sin(n)*43758.5453123); }
      float noise(vec2 x){
        vec2 p=floor(x), f=fract(x);
        f=f*f*(3.0-2.0*f);
        float n=p.x+p.y*57.0;
        return mix(mix(hash(n+0.0),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y);
      }
      void main(){
        float time = u_time * 0.22;
        float band = vT * 6.0;
        float n1 = noise(vec2(vPhi * 12.0 - time*3.0, band + time*1.1));
        float n2 = noise(vec2(vPhi * 13.4 - time*2.6, band - time*0.9));
        float n  = 0.5*(n1+n2);
        float streaks = smoothstep(0.45, 0.98, n * u_noiseAmp);
        float inner = smoothstep(0.02, 0.10, vT);
        float outer = 1.0 - smoothstep(0.88, 1.00, vT);
        float alpha = inner * outer;
        float a = alpha * mix(0.55, 1.0, streaks);
        gl_FragColor = vec4(vec3(1.0), a);
      }
    `
  })
);
accretion.rotation.x = Math.PI / 2;
sceneFinal.add(accretion);

/* ---------- LENSING PIPELINE ---------- */
// 1) Render background (stars+planets) into a texture
let rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  depthBuffer: true,
  stencilBuffer: false
});

// 2) Screen-filling quad that samples the background texture and warps it around the BH
const screenQuadGeo = new THREE.PlaneGeometry(2, 2); // clip-space quad (we’ll place at camera)
const lensUniforms = {
  u_tex:      { value: rt.texture },
  u_bhUV:     { value: new THREE.Vector2(0.5, 0.5) }, // updated each frame
  u_aspect:   { value: window.innerWidth / window.innerHeight },
  u_strength: { value: 0.085 }, // lensing intensity (realistic, subtle)
  u_r0:       { value: (horizonRadius * 0.98) }, // event horizon approx in world -> used for falloff shaping
};
const lensMat = new THREE.ShaderMaterial({
  uniforms: lensUniforms,
  depthWrite: false,
  depthTest: false,
  transparent: false,
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = vec4(position, 1.0); // full-screen (NDC)
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D u_tex;
    uniform vec2  u_bhUV;
    uniform float u_aspect;
    uniform float u_strength;
    uniform float u_r0;

    // Radial deflection around BH UV. Subtle, realistic-style falloff.
    void main(){
      // make coords aspect-corrected
      vec2 p = vUv;
      vec2 bh = u_bhUV;
      vec2 d = p - bh;

      // aspect correction in distance
      d.x *= u_aspect;
      float r = length(d) + 1e-6;

      // Deflection magnitude ~ k / r with clamped peak near center (avoid singularity)
      float maxDeflect = 0.12; // clamp
      float deflect = min(maxDeflect, u_strength / r);

      // ease out so far field is unaffected
      float fall = smoothstep(0.0, 0.8, 1.0 - r); // stronger near center

      // direction
      vec2 dir = normalize(d);
      vec2 offset = -dir * (deflect * fall); // bend toward BH

      // undo aspect
      offset.x /= u_aspect;

      vec2 uv = p + offset;

      // keep within bounds
      uv = clamp(uv, vec2(0.0), vec2(1.0));
      vec3 col = texture2D(u_tex, uv).rgb;

      gl_FragColor = vec4(col, 1.0);
    }
  `
});

// This quad needs its own scene + an orthographic "camera" in NDC
// But since we wrote VS in clip-space, we can render it with any camera.
// We’ll render it as part of sceneFinal by attaching it to the camera.
const lensQuad = new THREE.Mesh(screenQuadGeo, lensMat);
lensQuad.frustumCulled = false;
lensQuad.renderOrder = -1000;
// Put the quad into sceneFinal via a Group parent that follows the camera
const quadHolder = new THREE.Group();
quadHolder.add(lensQuad);
sceneFinal.add(quadHolder);

/* Keep UI + toggle */
function attachOutput() {
  container.innerHTML = "";
  if (asciiEnabled) {
    container.appendChild(effect.domElement);
    controls.dispose();
    controls = new OrbitControls(camera, effect.domElement);
  } else {
    container.appendChild(renderer.domElement);
    controls.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
  }
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2.5;
  controls.maxDistance = 6;
}
modeToggle.addEventListener("click", () => {
  asciiEnabled = !asciiEnabled;
  modeToggle.textContent = `ASCII: ${asciiEnabled ? "ON" : "OFF"}`;
  attachOutput();
});

/* Panels + hash routing (unchanged but kept) */
const targets = {
  about:    new THREE.Vector3( 1.5, 0.9,  3.2),
  projects: new THREE.Vector3(-1.8, 0.7,  3.2),
  contact:  new THREE.Vector3( 1.8, 0.7,  3.2),
  home:     new THREE.Vector3( 0.0, 0.25, 4.0),
};

let flyActive = false;
let flyStart = new THREE.Vector3();
let flyEnd = targets.home.clone();
let flyT = 0;

function flyTo(which='home') {
  flyStart.copy(camera.position);
  flyEnd.copy(targets[which] || targets.home);
  flyT = 0;
  flyActive = true;
}

function closePanels(goHome = true) {
  panels.forEach(p => p.classList.remove('open'));
  if (goHome) {
    flyTo('home');
    if (location.hash) location.hash = '';
  }
}
document.querySelectorAll('.panel .close')
  .forEach(btn => btn.addEventListener('click', () => closePanels(true)));

links.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const id = e.currentTarget.getAttribute('data-section');
    location.hash = id;
  });
});

function openSectionFromHash() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  panels.forEach(p => p.classList.remove('open'));
  if (hash === 'about') { panelAbout.classList.add('open'); flyTo('about'); }
  else if (hash === 'projects') { panelProjects.classList.add('open'); flyTo('projects'); }
  else if (hash === 'contact') { panelContact.classList.add('open'); flyTo('contact'); }
  else { flyTo('home'); }
}
window.addEventListener('hashchange', openSectionFromHash);
openSectionFromHash();

/* Resize */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  effect.setSize(window.innerWidth, window.innerHeight);

  // rebuild render target to match size
  rt.dispose();
  rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    depthBuffer: true,
    stencilBuffer: false
  });

  lensUniforms.u_aspect.value = window.innerWidth / window.innerHeight;
}
window.addEventListener("resize", onResize);

/* Animate */
const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  // Planet orbits
  for (const p of planets) {
    p.userData.angle += p.userData.speed * 0.016;
    const x = Math.cos(p.userData.angle) * p.userData.distance;
    const z = Math.sin(p.userData.angle) * p.userData.distance;
    p.position.set(x, 0, z);
    p.rotation.y += 0.0015;
  }

  // Camera fly (¼ speed)
  if (!flyActive) {
    camera.position.x += Math.sin(t * 0.1) * 0.0005;
    camera.position.y += Math.sin(t * 0.07) * 0.0003;
  } else {
    flyT = Math.min(1, flyT + 0.0075);
    const s = flyT * flyT * (3 - 2 * flyT);
    camera.position.lerpVectors(flyStart, flyEnd, s);
    if (flyT >= 1) flyActive = false;
  }
  camera.lookAt(0, 0, 0);
  controls.update();

  // 1) Render background to texture
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(sceneBG, camera);
  renderer.setRenderTarget(null);

  // 2) Update lens quad: keep it glued to camera, compute BH UV
  quadHolder.position.copy(camera.position);
  quadHolder.quaternion.copy(camera.quaternion);

  // Project BH world (0,0,0) to screen UV for lens center
  const bhNDC = core.position.clone().project(camera); // since core at origin, this is fine
  lensUniforms.u_bhUV.value.set(
    0.5 * (bhNDC.x + 1.0),
    0.5 * (1.0 - bhNDC.y)
  );
  lensUniforms.u_tex.value = rt.texture;

  // Update accretion animation
  accretion.material.uniforms.u_time.value = t;

  // 3) Final composite render: lensQuad (warped background) + core + ring
  if (asciiEnabled) effect.render(sceneFinal, camera);
  else renderer.render(sceneFinal, camera);

  requestAnimationFrame(animate);
}

/* Init */
attachOutput();
animate();
