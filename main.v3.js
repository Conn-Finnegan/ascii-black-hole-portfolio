// ASCII Black Hole with proper event-horizon look, planets, slower camera, 45° views
// Works on GitHub Pages via CDN ESM imports.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { AsciiEffect } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/effects/AsciiEffect.js";

console.log("Loaded main.v3.js at", new Date().toISOString());

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

// ASCII Effect
const asciiChars = " .:-=+*#%@";
const effect = new AsciiEffect(renderer, asciiChars, { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
// Pure white ASCII glyphs
effect.domElement.style.color = "#FFFFFF";
effect.domElement.style.backgroundColor = "#000";
// Slightly finer glyphs for smoother motion
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

// Lights (subtle)
scene.add(new THREE.AmbientLight(0x202020, 1.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(3, 2, 1);
scene.add(keyLight);

// Stars
function makeStars(count = 2000, radius = 120) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.8 + Math.random() * 0.2);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    positions.set([x, y, z], i * 3);
  }
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true });
  const pts = new THREE.Points(geom, mat);
  scene.add(pts);
}
makeStars();

// Event horizon (true black sphere)
const horizonRadius = 0.75;
const core = new THREE.Mesh(
  new THREE.SphereGeometry(horizonRadius, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
scene.add(core);

// Accretion Disk (ring) — procedural, swirl + Doppler brightening, slight GR "lift"
const diskInner = horizonRadius * 1.05; // just outside the horizon
const diskOuter = 1.8;

const accretion = new THREE.Mesh(
  new THREE.RingGeometry(diskInner, diskOuter, 256, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      u_time:     { value: 0 },
      u_viewDir:  { value: new THREE.Vector3(0,0,1) },
      // Colour ramp: white-hot -> yellow -> orange
      u_cA:       { value: new THREE.Color("#fff6e8") },
      u_cB:       { value: new THREE.Color("#ffd166") },
      u_cC:       { value: new THREE.Color("#ff8c42") },
      u_glow:     { value: 1.2 },
      u_swirl:    { value: 0.35 },   // swirl amount
      u_doppler:  { value: 0.55 },   // brightness asymmetry
      u_warp:     { value: 0.12 },   // vertical "lift" near inner edge
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec2 vUv;
      void main(){
        vPos = position;
        vUv = uv;
        // Fake GR warping: lift geometry near inner edge so top appears "bent" over the horizon
        float r = length(vec2(position.x, position.y));
        float t = clamp((r - ${diskInner.toFixed(3)}) / (${(diskOuter - diskInner).toFixed(3)}), 0.0, 1.0);
        float lift = (1.0 - t);              // stronger lift near inner edge
        vec3 p = position;
        p.z += lift * ${ (0.35).toFixed(3) }; // push towards camera
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vPos;
      varying vec2 vUv;

      uniform float u_time;
      uniform vec3 u_cA, u_cB, u_cC;
      uniform float u_glow, u_swirl, u_doppler;

      // hash + noise
      float hash(float n){ return fract(sin(n)*43758.5453123); }
      float noise(vec2 x){
        vec2 p=floor(x), f=fract(x);
        f=f*f*(3.0-2.0*f);
        float n=p.x+p.y*57.0;
        return mix(mix(hash(n+0.0),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y);
      }

      void main(){
        // Polar coordinates in disk plane (x,y come from ring geometry)
        float r = length(vPos.xy);
        float phi = atan(vPos.y, vPos.x); // [-PI, PI]

        // Normalised radius 0 (inner) -> 1 (outer)
        float t = clamp((r - ${diskInner.toFixed(4)}) / (${(diskOuter - diskInner).toFixed(4)}), 0.0, 1.0);

        // Swirling streaks flowing azimuthally
        float time = u_time * 0.25;
        float n1 = noise(vec2(phi*10.0 - time*3.0, t*5.0 + time*1.1));
        float n2 = noise(vec2(phi*10.6 - time*2.6, t*5.3 - time*0.9));
        float n = 0.5*(n1+n2);
        float streaks = smoothstep(0.42, 0.98, n);

        // Colour ramp
        vec3 col = mix(u_cA, u_cB, streaks);
        col = mix(col, u_cC, smoothstep(0.72, 1.0, streaks));

        // Radial falloff: fade inner/outer edges
        float inner = smoothstep(0.02, 0.10, t);     // fade in from inner edge
        float outer = 1.0 - smoothstep(0.88, 1.00, t); // fade out near outer edge
        float alpha = inner * outer;

        // Doppler beaming: brighten the approaching side (phi≈0)
        float beaming = 1.0 + u_doppler * max(0.0, cos(phi));
        col *= beaming;

        // Gentle glow boost on brightest streaks
        col *= (1.0 + u_glow * smoothstep(0.6,1.0,streaks));

        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
);
// Orient disk: X right, Y up, Z toward camera; we already "lifted" toward camera in VS
accretion.rotation.x = Math.PI / 2;
scene.add(accretion);

// Photon ring — razor-thin, bright at horizon radius
const photonRing = new THREE.Mesh(
  new THREE.TorusGeometry(horizonRadius * 1.02, 0.03, 32, 256),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { u_time: { value: 0.0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform float u_time;
      void main(){
        // Soft, hot white ring with subtle flicker
        float a = 0.7 + 0.3 * sin(u_time*3.0 + vUv.x*20.0);
        gl_FragColor = vec4(vec3(1.0), a);
      }
    `
  })
);
photonRing.rotation.x = Math.PI / 2;
scene.add(photonRing);

// Lensing halo (billboarded quad with radial falloff)
const halo = new THREE.Mesh(
  new THREE.PlaneGeometry(4.5, 4.5),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { u_time: { value: 0.0 } },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        // face camera: use regular modelView
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform float u_time;
      // Subtle radial glow that peaks near the photon ring radius
      void main(){
        vec2 p = vUv*2.0 - 1.0;
        float r = length(p);
        // peak near ~0.33 of quad size (roughly ring radius on this quad)
        float peak = 0.33;
        float w = 0.08;
        float g = exp(-pow((r - peak)/w, 2.0));
        float alpha = 0.10 * g; // faint
        gl_FragColor = vec4(vec3(1.0), alpha);
      }
    `
  })
);
halo.position.z = 0.0; // sits around origin; subtle overlay
scene.add(halo);

// ---------- Planets (background) ----------
const planetsGroup = new THREE.Group();
scene.add(planetsGroup);

const planets = [];
function addPlanet({ radius, distance, color, speed, tilt = 0, ring = false }) {
  const geo = new THREE.SphereGeometry(radius, 48, 48);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 1.0, metalness: 0.0, emissive: 0x000000
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(distance, 0, 0);
  mesh.rotation.z = tilt;
  planetsGroup.add(mesh);

  if (ring) {
    const rInner = radius * 1.6;
    const rOuter = radius * 2.4;
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(rInner, rOuter, 128),
      new THREE.MeshBasicMaterial({ color: 0xb3a186, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = Math.PI / 2 + tilt;
    mesh.add(ringMesh);
  }

  planets.push({ mesh, angle: Math.random() * Math.PI * 2, speed, distance });
}

// A few subtle background planets
addPlanet({ radius: 0.18, distance: 8.5,  color: 0x8aa4ff, speed: 0.03,  tilt: 0.2,  ring: false });
addPlanet({ radius: 0.28, distance: 11.5, color: 0xc4a484, speed: 0.02,  tilt: -0.15, ring: true  });
addPlanet({ radius: 0.22, distance: 14.0, color: 0x7ad3a1, speed: 0.018, tilt: 0.05,  ring: false });

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

// Camera targets — bias to ~45° angles
const targets = {
  about:    new THREE.Vector3( 1.5, 0.9,  3.2),  // right + up
  projects: new THREE.Vector3(-1.8, 0.7,  3.2),  // left + up
  contact:  new THREE.Vector3( 1.8, 0.7,  3.2),  // right + up (different azimuth)
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

// Animate
const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  // Animate accretion + photon ring + halo
  accretion.material.uniforms.u_time.value = t;
  photonRing.material.uniforms.u_time.value = t;
  halo.material.uniforms.u_time.value = t;

  // Planet orbits
  for (const p of planets) {
    p.angle += p.speed * 0.016; // ~60fps step
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
    flyT = Math.min(1, flyT + 0.0075); // <- slowed from 0.03
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
