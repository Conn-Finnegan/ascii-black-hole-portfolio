// ASCII Black Hole — all white: stars, planets, curved ring (no color halo/rings)
// Works on GitHub Pages via CDN ESM imports.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { AsciiEffect } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/effects/AsciiEffect.js";

console.log("Loaded main.v3.js (all-white) at", new Date().toISOString());

const container = document.getElementById("scene");
const modeToggle = document.getElementById("modeToggle");

const links = document.querySelectorAll('#topbar [data-section]');
const panelAbout = document.getElementById('panel-about');
const panelProjects = document.getElementById('panel-projects');
const panelContact = document.getElementById('panel-contact');
const panels = [panelAbout, panelProjects, panelContact];

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);

// ASCII Effect (pure white glyphs)
const asciiChars = " .:-=+*#%@";
const effect = new AsciiEffect(renderer, asciiChars, { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
effect.domElement.style.color = "#FFFFFF";
effect.domElement.style.backgroundColor = "#000";
effect.domElement.style.fontSize = "6px";
effect.domElement.style.lineHeight = "6px";
let asciiEnabled = true;

// Scene, Camera, Controls
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0.25, 4);

let controls = new OrbitControls(camera, effect.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2.5;
controls.maxDistance = 6;

// Minimal lighting (planets if using Standard; ring uses its own shader; stars unlit)
scene.add(new THREE.AmbientLight(0x1a1a1a, 1.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(3, 2, 1);
scene.add(keyLight);

// Stars (white)
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
  scene.add(new THREE.Points(g, m));
})();

// Event horizon (true black)
const horizonRadius = 0.78;
const core = new THREE.Mesh(
  new THREE.SphereGeometry(horizonRadius, 96, 96),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
scene.add(core);

// Curved accretion ring (monochrome). We use alpha + noise to get texture but keep color white.
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

        // Thickness + fake GR lift (no color, just shape)
        float puff = 0.20 * (1.0 - vT);   // thicker near inner edge
        p.z += puff * sin(vPhi * 2.0);    // slight vertical undulation
        p.z += (1.0 - vT) * 0.32;         // lift inner edge toward camera

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vT;
      varying float vPhi;
      uniform float u_time;
      uniform float u_noiseAmp;

      // simple value noise
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

        // streaks drive opacity only (monochrome white)
        float streaks = smoothstep(0.45, 0.98, n * u_noiseAmp);

        // radial fade: inner + outer soft edges
        float inner = smoothstep(0.02, 0.10, vT);
        float outer = 1.0 - smoothstep(0.88, 1.00, vT);
        float alpha = inner * outer;

        // use streaks to vary opacity so ASCII density varies
        float a = alpha * mix(0.55, 1.0, streaks);

        gl_FragColor = vec4(vec3(1.0), a); // pure white
      }
    `,
    blending: THREE.NormalBlending
  })
);
accretion.rotation.x = Math.PI / 2;
scene.add(accretion);

// ---------- Planets (all white) ----------
const planetsGroup = new THREE.Group();
scene.add(planetsGroup);

const planets = [];
function addPlanet({ radius, distance, speed, tilt = 0, ring = false }) {
  const geo = new THREE.SphereGeometry(radius, 48, 48);
  // MeshBasicMaterial so they’re flat white regardless of lights
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(distance, 0, 0);
  mesh.rotation.z = tilt;
  planetsGroup.add(mesh);

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

  planets.push({ mesh, angle: Math.random() * Math.PI * 2, speed, distance });
}

// Few background planets (monochrome)
addPlanet({ radius: 0.18, distance: 8.5,  speed: 0.03,  tilt: 0.2,  ring: false });
addPlanet({ radius: 0.28, distance: 11.5, speed: 0.02,  tilt: -0.15, ring: true  });
addPlanet({ radius: 0.22, distance: 14.0, speed: 0.018, tilt: 0.05,  ring: false });

// ASCII / Normal Toggle
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

// Camera targets — ~45°
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

// Panels + hash routing
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
    location.hash = id; // triggers hashchange handler
  });
});

// Handle direct hash navigation
function openSectionFromHash() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  panels.forEach(p => p.classList.remove('open'));
  if (hash === 'about') { panelAbout.classList.add('open'); flyTo('about'); }
  else if (hash === 'projects') { panelProjects.classList.add('open'); flyTo('projects'); }
  else if (hash === 'contact') { panelContact.classList.add('open'); flyTo('contact'); }
  else { flyTo('home'); }
}
window.addEventListener('hashchange', openSectionFromHash);
openSectionFromHash(); // run on load

// Resize
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  effect.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// --- One-time tooltip: "Drag to look around" ---
const HINT_KEY = "bh_drag_hint_seen_v1";
const hintEl = document.getElementById("hint");

function hideHint() {
  if (!hintEl) return;
  hintEl.classList.add("hidden");
  setTimeout(() => hintEl && hintEl.remove(), 500);
}

if (hintEl) {
  if (localStorage.getItem(HINT_KEY) === "1") {
    hideHint();
  } else {
    setTimeout(hideHint, 4000); // auto-hide after 4s

    const dismiss = () => {
      localStorage.setItem(HINT_KEY, "1");
      hideHint();
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
      controls.removeEventListener("start", dismiss);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss);
    controls.addEventListener("start", dismiss);
  }
}

// Animate
const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  // Ring flow animation
  accretion.material.uniforms.u_time.value = t;

  // Planet orbits (slow)
  for (const p of planets) {
    p.angle += p.speed * 0.016;
    const x = Math.cos(p.angle) * p.distance;
    const z = Math.sin(p.angle) * p.distance;
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y += 0.0015;
  }
  planetsGroup.rotation.y = 0.0005;

  // Slower camera fly speed (¼ of original)
  if (!flyActive) {
    camera.position.x += Math.sin(t * 0.1) * 0.0005;
    camera.position.y += Math.sin(t * 0.07) * 0.0003;
  } else {
    flyT = Math.min(1, flyT + 0.0075);
    const s = flyT * flyT * (3 - 2 * flyT); // smoothstep
    camera.position.lerpVectors(flyStart, flyEnd, s);
    if (flyT >= 1) flyActive = false;
  }

  camera.lookAt(0, 0, 0);
  controls.update();

  if (asciiEnabled) effect.render(scene, camera);
  else renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// Init
attachOutput();
animate();
