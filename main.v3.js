// ASCII Black Hole with overlay panels, hash routing, and camera return-to-home
// Uses CDN ESM imports so it works on GitHub Pages without a bundler.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { AsciiEffect } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/effects/AsciiEffect.js";

console.log("Loaded main.v2.js at", new Date().toISOString());

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
effect.domElement.style.color = "#A7FFFB";
effect.domElement.style.backgroundColor = "#000";
/* Make ASCII glyphs readable */
effect.domElement.style.fontSize = "8px";
effect.domElement.style.lineHeight = "8px";
let asciiEnabled = true;

// Scene, Camera, Controls
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0.25, 4);

let controls = new OrbitControls(camera, effect.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2.5;
controls.maxDistance = 6;

// Lights
scene.add(new THREE.AmbientLight(0x222222, 1.0));
const keyLight = new THREE.DirectionalLight(0x66ccff, 0.8);
keyLight.position.set(3, 2, 1);
scene.add(keyLight);

// Stars
function makeStars(count = 2000, radius = 80) {
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
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true });
  const pts = new THREE.Points(geom, mat);
  scene.add(pts);
}
makeStars();

// Black Hole Core
const core = new THREE.Mesh(new THREE.SphereGeometry(0.65, 64, 64), new THREE.MeshBasicMaterial({ color: 0x000000 }));
scene.add(core);

// Accretion Disk (shader)
const disk = new THREE.Mesh(
  new THREE.TorusGeometry(1.2, 0.25, 128, 256),
  new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      u_time: { value: 0 },
      u_colourA: { value: new THREE.Color("#ffadad") },
      u_colourB: { value: new THREE.Color("#ffd6a5") },
      u_colourC: { value: new THREE.Color("#caffbf") },
      u_glow: { value: 1.4 },
    },
    vertexShader: `
      varying vec3 vPos; varying vec2 vUv2;
      void main(){
        vPos = position;
        vUv2 = vec2(atan(position.y, position.x), position.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vPos; varying vec2 vUv2;
      uniform float u_time; uniform vec3 u_colourA,u_colourB,u_colourC; uniform float u_glow;
      float hash(float n){ return fract(sin(n)*43758.5453123); }
      float noise(vec2 x){
        vec2 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        float n=p.x+p.y*57.0;
        return mix(mix(hash(n+0.0),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y);
      }
      void main(){
        float angle=(vUv2.x+3.14159265)/(2.0*3.14159265);
        float band=abs(vPos.z);
        float t=u_time*0.4;
        float n=noise(vec2(angle*12.0 - t*4.0, band*4.0 + t*1.3));
        float streaks=smoothstep(0.35,1.0,n);
        vec3 col=mix(u_colourA,u_colourB,streaks);
        col=mix(col,u_colourC,smoothstep(0.7,1.0,streaks));
        float inner=smoothstep(0.04,0.18,abs(band));
        float outer=1.0-smoothstep(0.18,0.23,abs(band));
        float alpha=inner*outer;
        col*= (1.0 + u_glow * smoothstep(0.6,1.0,streaks));
        gl_FragColor=vec4(col,alpha);
      }`,
  })
);
disk.rotation.x = Math.PI / 2;
scene.add(disk);

// Lens shimmer
const lens = new THREE.Mesh(
  new THREE.RingGeometry(0.8, 1.5, 256),
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { u_time: { value: 0.0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform float u_time;
      void main(){
        float r=distance(vUv,vec2(0.5));
        float ring=1.0 - smoothstep(0.32,0.5,r);
        float ripple=0.5 + 0.5*sin(10.0*r - u_time*0.6);
        float alpha=ring * 0.08 * ripple;
        gl_FragColor=vec4(vec3(0.8,0.95,1.0),alpha);
      }`
  })
);
lens.rotation.x = Math.PI / 2;
scene.add(lens);

// Volumetric hint
const cone = new THREE.Mesh(
  new THREE.ConeGeometry(0.35, 1.6, 64, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x66ffff, transparent: true, opacity: 0.05, side: THREE.DoubleSide })
);
cone.position.y = 0.15;
cone.rotation.x = -Math.PI / 2;
scene.add(cone);

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

// Camera targets
const targets = {
  about:    new THREE.Vector3( 0.0,  0.9,  3.2),
  projects: new THREE.Vector3(-2.2,  0.4,  3.2),
  contact:  new THREE.Vector3( 2.2,  0.2,  3.2),
  home:     new THREE.Vector3( 0.0,  0.25, 4.0),
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
  disk.rotation.z = t * 0.35;
  disk.material.uniforms.u_time.value = t;
  lens.material.uniforms.u_time.value = t;

  if (!flyActive) {
    camera.position.x += Math.sin(t * 0.1) * 0.0005;
    camera.position.y += Math.sin(t * 0.07) * 0.0003;
  } else {
    flyT = Math.min(1, flyT + 0.03);
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
