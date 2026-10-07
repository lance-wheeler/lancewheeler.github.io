// GearUp 3D: procedural wheel, car and part models rendered with three.js.
// Exposes window.GU3D. If WebGL is unavailable, the app keeps its 2D SVG art.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

const GU3D = { ok: false };
window.GU3D = GU3D;

function glAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

/* ---------------- Materials ---------------- */
const FIN = {
  bronze: { color: 0xa8742f, metal: 1, rough: 0.3 },
  silver: { color: 0xcfd3d8, metal: 1, rough: 0.2 },
  gunmetal: { color: 0x50555d, metal: 1, rough: 0.32 },
  black: { color: 0x17181b, metal: 0.5, rough: 0.22, clear: 1 },
  gold: { color: 0xc89d3e, metal: 1, rough: 0.26 }
};
const MATS = {};
const mat = (k, make) => MATS[k] || (MATS[k] = make());
const finishMat = f => mat('fin-' + f, () => {
  const d = FIN[f] || FIN.silver;
  return new THREE.MeshPhysicalMaterial({ color: d.color, metalness: d.metal, roughness: d.rough, clearcoat: d.clear || 0.3, clearcoatRoughness: 0.12 });
});
const rubber = () => mat('rubber', () => new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.86, metalness: 0, side: THREE.DoubleSide }));
const darkMetal = () => mat('dark', () => new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.55, metalness: 0.8, side: THREE.DoubleSide }));
const lipMat = () => mat('lip', () => new THREE.MeshPhysicalMaterial({ color: 0xeceef1, metalness: 1, roughness: 0.1, clearcoat: 1 }));
const rotorMat = () => mat('rotor', () => new THREE.MeshStandardMaterial({ color: 0x8e9196, metalness: 0.9, roughness: 0.42 }));
const caliperMat = () => mat('caliper', () => new THREE.MeshPhysicalMaterial({ color: 0xc4261c, metalness: 0.2, roughness: 0.35, clearcoat: 1 }));
const nutMat = () => mat('nut', () => new THREE.MeshStandardMaterial({ color: 0xb9bdc3, metalness: 1, roughness: 0.25 }));
const capMat = () => mat('cap', () => new THREE.MeshStandardMaterial({ color: 0x101113, metalness: 0.4, roughness: 0.35 }));
const glassMat = () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0b0f14, metalness: 0.3, roughness: 0.05, clearcoat: 1 }));
const trimMat = () => mat('trim', () => new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.2, roughness: 0.6 }));
const chromeMat = () => mat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xe0e3e7, metalness: 1, roughness: 0.12 }));
const headMat = () => mat('head', () => new THREE.MeshStandardMaterial({ color: 0xdfe8f0, emissive: 0xa8bfd4, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.15 }));
const tailMat = () => mat('tail', () => new THREE.MeshStandardMaterial({ color: 0x6d0a06, emissive: 0xd51a10, emissiveIntensity: 0.9, roughness: 0.3 }));
const paintMat = hex => mat('paint-' + hex, () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), metalness: 0.6, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.8 }));

/* ---------------- Wheel ---------------- */
const zAt = r => -0.06 + 0.3 * Math.pow(r, 1.4);   // concave face: hub sits back, spokes rise to the lip
function spoke(r0, r1, w0, w1, angle, material) {
  const s = new THREE.Shape();
  s.moveTo(-w0 / 2, r0); s.lineTo(w0 / 2, r0); s.lineTo(w1 / 2, r1); s.lineTo(-w1 / 2, r1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 2, curveSegments: 4 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + zAt(Math.hypot(p.getX(i), p.getY(i))));
  g.computeVertexNormals(); g.rotateZ(angle);
  return new THREE.Mesh(g, material);
}
export function buildWheel(style, finish, { brake = false } = {}) {
  const g = new THREE.Group();
  const fm = finishMat(finish);
  const prof = [[1.0, -0.34], [1.1, -0.37], [1.24, -0.385], [1.35, -0.355], [1.405, -0.28], [1.42, -0.14], [1.42, 0.14], [1.405, 0.28], [1.35, 0.355], [1.24, 0.385], [1.1, 0.37], [1.0, 0.34]]
    .map(([r, z]) => new THREE.Vector2(r, z));
  const tire = new THREE.LatheGeometry(prof, 72); tire.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(tire, rubber()));
  const barrel = new THREE.CylinderGeometry(0.99, 0.99, 0.68, 56, 1, true); barrel.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(barrel, darkMetal()));
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.99, 48), darkMetal()); back.position.z = -0.33; g.add(back);
  if (brake) {
    const rotor = new THREE.CylinderGeometry(0.8, 0.8, 0.05, 56); rotor.rotateX(Math.PI / 2);
    const r = new THREE.Mesh(rotor, rotorMat()); r.position.z = -0.17; g.add(r);
    const cs = new THREE.Shape(); cs.absarc(0, 0, 0.88, 0.35, 1.3, false); cs.absarc(0, 0, 0.56, 1.3, 0.35, true);
    const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 });
    const c = new THREE.Mesh(cg, caliperMat()); c.position.z = -0.24; g.add(c);
  }
  if (style === 'six') {
    for (let i = 0; i < 6; i++) g.add(spoke(0.24, 0.95, 0.3, 0.21, i * Math.PI / 3, fm));
  } else if (style === 'twin5') {
    for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; g.add(spoke(0.24, 0.95, 0.1, 0.075, a - 0.13, fm)); g.add(spoke(0.24, 0.95, 0.1, 0.075, a + 0.13, fm)); }
  } else if (style === 'ten') {
    for (let i = 0; i < 10; i++) g.add(spoke(0.24, 0.95, 0.12, 0.085, i * Math.PI / 5, fm));
  } else {
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      g.add(spoke(0.24, 0.6, 0.085, 0.07, a, fm));
      g.add(spoke(0.56, 0.95, 0.06, 0.05, a - 0.16, fm)); g.add(spoke(0.56, 0.95, 0.06, 0.05, a + 0.16, fm));
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 12, 64), fm); ring.position.z = zAt(0.58) + 0.06; g.add(ring);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.965, 0.045, 16, 80), style === 'mesh' ? lipMat() : fm); lip.position.z = 0.31; g.add(lip);
  const step = new THREE.Mesh(new THREE.TorusGeometry(0.925, 0.02, 8, 80), darkMetal()); step.position.z = 0.27; g.add(step);
  const hubZ = zAt(0.2) + 0.05;
  const hub = new THREE.CylinderGeometry(0.27, 0.3, 0.14, 40); hub.rotateX(Math.PI / 2);
  const h = new THREE.Mesh(hub, fm); h.position.z = hubZ; g.add(h);
  for (let i = 0; i < 5; i++) {
    const a = i * 2 * Math.PI / 5 - Math.PI / 2;
    const ng = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 6); ng.rotateX(Math.PI / 2);
    const n = new THREE.Mesh(ng, nutMat()); n.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, hubZ + 0.08); g.add(n);
  }
  const cap = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 32); cap.rotateX(Math.PI / 2);
  const cm = new THREE.Mesh(cap, capMat()); cm.position.z = hubZ + 0.09; g.add(cm);
  const em = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 32), fm); em.position.z = hubZ + 0.125; g.add(em);
  return g;
}

/* ---------------- Car: a generic sports coupe ---------------- */
const P = (x, y) => [(x - 202) / 50, (162 - y) / 50];
function shapeFrom(build) {
  const s = new THREE.Shape();
  const api = {
    m: (x, y) => s.moveTo(...P(x, y)),
    l: (x, y) => s.lineTo(...P(x, y)),
    q: (cx, cy, x, y) => { const a = P(cx, cy), b = P(x, y); s.quadraticCurveTo(a[0], a[1], b[0], b[1]); },
    arch: (cx, cy, r) => { const c = P(cx, cy); s.absarc(c[0], c[1], r / 50, 0, Math.PI, false); }
  };
  build(api); return s;
}
const ARCH_R = 45;
const bodyShape = () => shapeFrom(({ m, l, q, arch }) => {
  m(22, 129); l(20, 117); q(20, 108, 31, 104); l(118, 90); q(140, 86, 157, 84); l(300, 80); q(338, 80, 350, 83); q(373, 88, 381, 98);
  l(383, 124); q(383, 131, 376, 131); l(305 + ARCH_R, 131); arch(305, 131, ARCH_R); l(100 + ARCH_R, 131); arch(100, 131, ARCH_R); l(30, 131); q(22, 131, 22, 129);
});
const cabinShape = () => shapeFrom(({ m, l, q }) => { m(163, 87); q(189, 64, 215, 58); q(240, 54, 262, 58); q(305, 70, 343, 83); l(163, 87); });
const BODY_W = 1.6;
const TIRE_R = 0.62;
let bodyGeo, cabinGeo;
function geoms() {
  if (!bodyGeo) {
    bodyGeo = new THREE.ExtrudeGeometry(bodyShape(), { depth: BODY_W, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.16, bevelSegments: 6, curveSegments: 36 });
    bodyGeo.translate(0, 0, -BODY_W / 2);
    cabinGeo = new THREE.ExtrudeGeometry(cabinShape(), { depth: 1.12, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.14, bevelSegments: 6, curveSegments: 28 });
    cabinGeo.translate(0, -0.05, -0.56);
  }
  return { bodyGeo, cabinGeo };
}
function box(w, h, d, m, x, y, z, rz = 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.z = rz; return b; }
export function buildCar({ paint = '#c9cdd2', wheel = 'six', finish = 'bronze', drop = 0 } = {}) {
  const car = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body';
  const { bodyGeo, cabinGeo } = geoms();
  const pm = paintMat(paint);
  body.add(new THREE.Mesh(bodyGeo, pm));
  body.add(new THREE.Mesh(cabinGeo, glassMat()));
  const zEdge = BODY_W / 2 + 0.2;
  [-1, 1].forEach(sd => {
    body.add(box(0.07, 0.5, 0.06, pm, P(250, 0)[0], 1.55, sd * 0.69, -0.05));                      // B-pillar
    body.add(box(0.2, 0.1, 0.16, pm, P(172, 0)[0], 1.5, sd * (zEdge + 0.02)));                      // mirror
    body.add(box(0.46, 0.1, 0.34, headMat(), -3.05, 1.19, sd * 0.6, 0.16));                         // headlight
    body.add(box(0.12, 0.13, 0.46, tailMat(), 3.66, 1.23, sd * 0.58, -0.5));                        // taillight
    const tip = new THREE.CylinderGeometry(0.075, 0.075, 0.24, 20); tip.rotateZ(Math.PI / 2);
    const t = new THREE.Mesh(tip, chromeMat()); t.position.set(3.7, 0.58, sd * 0.42); body.add(t);   // exhaust tips
  });
  body.add(box(0.12, 0.16, 1.1, trimMat(), -3.66, 0.78, 0));                                        // grille
  body.add(box(7.1, 0.06, 1.9, trimMat(), 0.05, 0.47, 0));                                          // underbody shadow line
  body.position.y = -drop * 0.0025;
  car.add(body);
  const wheels = new THREE.Group(); wheels.name = 'wheels';
  const s = TIRE_R / 1.42;
  [[-2.04, 1], [2.06, 1], [-2.04, -1], [2.06, -1]].forEach(([x, sd]) => {
    const w = buildWheel(wheel, finish, { brake: true });
    w.scale.setScalar(s); w.position.set(x, TIRE_R, sd * (zEdge - 0.21));
    if (sd < 0) w.rotation.y = Math.PI;
    wheels.add(w);
  });
  car.add(wheels);
  car.add(shadowPlane(9.2, 3.4));
  return car;
}
let shadowTex;
function shadowPlane(w, h) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d'); const g = x.createRadialGradient(128, 64, 4, 128, 64, 124);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128); shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002; m.renderOrder = -1;
  return m;
}

/* ---------------- Parts ---------------- */
function helix(radius, height, turns) {
  class H extends THREE.Curve { getPoint(t, o = new THREE.Vector3()) { const a = t * turns * Math.PI * 2; return o.set(Math.cos(a) * radius, t * height - height / 2, Math.sin(a) * radius); } }
  return new H();
}
export function buildPart(cat) {
  const g = new THREE.Group();
  if (cat === 'suspension') {
    const body = new THREE.CylinderGeometry(0.17, 0.17, 2.6, 32);
    g.add(new THREE.Mesh(body, mat('anod', () => new THREE.MeshStandardMaterial({ color: 0xc8a23c, metalness: 1, roughness: 0.3 }))));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(helix(0.36, 1.7, 7), 400, 0.055, 12), mat('spring', () => new THREE.MeshPhysicalMaterial({ color: 0xc4261c, metalness: 0.3, roughness: 0.3, clearcoat: 1 }))));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 40), darkMetal()); top.position.y = 0.92; g.add(top);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 40), darkMetal()); seat.position.y = -0.9; g.add(seat);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16), chromeMat()); rod.position.y = 1.2; g.add(rod);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 12, 24), darkMetal()); eye.position.y = -1.45; g.add(eye);
    g.rotation.z = 0.35; g.scale.setScalar(0.95);
  } else if (cat === 'exhaust') {
    const steel = mat('steel', () => new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.28 }));
    const muff = new THREE.CylinderGeometry(0.42, 0.42, 1.4, 40); muff.rotateZ(Math.PI / 2);
    const mf = new THREE.Mesh(muff, steel); mf.position.set(0.5, -0.1, 0); g.add(mf);
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.2, 0.5, -0.3), new THREE.Vector3(-1.4, 0.4, -0.2), new THREE.Vector3(-0.6, 0.1, 0), new THREE.Vector3(-0.2, -0.1, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 60, 0.12, 20), steel));
    const ti = mat('ti', () => new THREE.MeshStandardMaterial({ color: 0x6a5bc9, metalness: 1, roughness: 0.22 }));
    [-0.2, 0.2].forEach(z => { const t = new THREE.CylinderGeometry(0.17, 0.15, 0.6, 32, 1, true); t.rotateZ(Math.PI / 2); const m = new THREE.Mesh(t, ti); m.position.set(1.45, -0.1, z); g.add(m); });
    g.rotation.y = -0.6; g.rotation.x = 0.2;
  } else if (cat === 'intake') {
    const cone = new THREE.CylinderGeometry(0.42, 0.62, 1.2, 96, 6, true);
    const p = cone.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.sign(Math.cos(a * 24));
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    cone.computeVertexNormals(); cone.rotateZ(Math.PI / 2);
    const f = new THREE.Mesh(cone, mat('filter', () => new THREE.MeshStandardMaterial({ color: 0xb3241b, roughness: 0.8, side: THREE.DoubleSide }))); f.position.x = 0.9; g.add(f);
    const capG = new THREE.CylinderGeometry(0.66, 0.66, 0.1, 48); capG.rotateZ(Math.PI / 2);
    const c = new THREE.Mesh(capG, trimMat()); c.position.x = 1.52; g.add(c);
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.8, 0.7, 0), new THREE.Vector3(-1.0, 0.6, 0), new THREE.Vector3(-0.2, 0.15, 0), new THREE.Vector3(0.3, 0, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 60, 0.3, 28), chromeMat()));
    g.rotation.y = -0.5; g.rotation.x = 0.25;
  } else {
    const carbon = mat('carbon', () => new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, metalness: 0.4, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }));
    const foil = new THREE.Shape(); foil.moveTo(-0.9, 0); foil.quadraticCurveTo(-0.6, 0.28, 0.2, 0.2); foil.quadraticCurveTo(0.8, 0.12, 0.95, 0.02); foil.quadraticCurveTo(0, -0.05, -0.9, 0);
    const wg = new THREE.ExtrudeGeometry(foil, { depth: 3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 }); wg.translate(0, 0.65, -1.5);
    g.add(new THREE.Mesh(wg, carbon));
    [-1.55, 1.55].forEach(z => g.add(box(1.0, 0.55, 0.05, carbon, 0, 0.6, z)));
    [-0.8, 0.8].forEach(z => g.add(box(0.35, 0.65, 0.06, carbon, 0.1, 0.32, z)));
    g.add(box(2.2, 0.08, 3.4, trimMat(), 0, -0.02, 0));
    g.rotation.y = -0.65; g.rotation.x = 0.35; g.scale.setScalar(0.85);
  }
  return g;
}

/* ---------------- Rendering ---------------- */
function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.setClearColor(0x000000, 0);
  const pm = new THREE.PMREMGenerator(r);
  r.__env = pm.fromScene(new RoomEnvironment(r), 0.04).texture; pm.dispose();
  return r;
}
function sceneFor(r) {
  const s = new THREE.Scene(); s.environment = r.__env;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 7, 6); s.add(key);
  const rim = new THREE.DirectionalLight(0xffe2b0, 0.8); rim.position.set(6, 3, -5); s.add(rim);
  s.add(new THREE.HemisphereLight(0xdfe6ee, 0x1a1a1a, 0.35));
  return s;
}
function dispose(obj) { obj.traverse(o => { if (o.geometry && o.geometry !== bodyGeo && o.geometry !== cabinGeo) o.geometry.dispose(); }); }

let snapR, snapCanvas;
const cache = new Map();
function snap(key, w, h, build, cam) {
  if (cache.has(key)) return cache.get(key);
  if (!snapR) { snapCanvas = document.createElement('canvas'); snapR = makeRenderer(snapCanvas); }
  snapR.setPixelRatio(1); snapR.setSize(w, h, false);
  const scene = sceneFor(snapR); const obj = build(); scene.add(obj);
  const camera = new THREE.PerspectiveCamera(cam.fov, w / h, 0.1, 100);
  camera.position.set(...cam.pos); camera.lookAt(...cam.at);
  snapR.render(scene, camera);
  const url = snapCanvas.toDataURL('image/png');
  dispose(obj); cache.set(key, url);
  return url;
}
const WHEEL_CAM = { fov: 28, pos: [0, 0.2, 6.4], at: [0, 0, 0] };
const CAR_CAM = { fov: 26, pos: [-6.4, 2.3, 9.2], at: [-0.1, 0.62, 0] };
GU3D.wheelImage = (style, finish) => snap(`w-${style}-${finish}`, 300, 300, () => { const w = buildWheel(style, finish); w.rotation.y = -0.55; w.rotation.x = 0.08; return w; }, WHEEL_CAM);
GU3D.carImage = cfg => snap('c-' + JSON.stringify(cfg), 720, 300, () => buildCar(cfg), CAR_CAM);
GU3D.partImage = cat => snap('p-' + cat, 300, 300, () => buildPart(cat), { fov: 30, pos: [0, 0.3, 6.6], at: [0, 0, 0] });

/* Live viewers (one at a time each), disposed when their screen closes */
function live(el, cam, buildScene) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  canvas.setAttribute('aria-hidden', 'true');
  el.innerHTML = ''; el.appendChild(canvas);
  const r = makeRenderer(canvas);
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = sceneFor(r);
  const camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.1, 100);
  const ctl = { yaw: 0, dirty: true, anim: null, alive: true, r, scene, camera, canvas };
  const resize = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); ctl.dirty = true;
  };
  const ro = new ResizeObserver(resize); ro.observe(el); resize();
  buildScene(ctl);
  const loop = t => {
    if (!ctl.alive) return;
    if (ctl.anim) ctl.anim(t);
    if (ctl.dirty) { ctl.place(); r.render(scene, camera); ctl.dirty = !!ctl.anim; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  ctl.destroy = () => { ctl.alive = false; ro.disconnect(); scene.traverse(o => { if (o.geometry && o.geometry !== bodyGeo && o.geometry !== cabinGeo) o.geometry.dispose(); }); r.dispose(); r.forceContextLoss(); canvas.remove(); };
  return ctl;
}
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function spinIn(ctl, group, ms = 750) {
  if (reduceMotion()) { ctl.dirty = true; return; }
  const start = performance.now();
  ctl.anim = t => {
    const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
    const spin = (1 - e) * -6;
    group.children.forEach((w, i) => { w.rotation.z = (i >= 2 ? -1 : 1) * spin; });
    ctl.dirty = true;
    if (k >= 1) ctl.anim = null;
  };
}

GU3D.mountWheel = (el, { style, finish }) => live(el, { fov: 28 }, ctl => {
  let w = buildWheel(style, finish); ctl.scene.add(w);
  ctl.camera.position.set(0, 0.2, 6.2); ctl.camera.lookAt(0, 0, 0);
  ctl.place = () => { w.rotation.y = THREE.MathUtils.degToRad(ctl.yaw) - 0.35; w.rotation.z = -THREE.MathUtils.degToRad(ctl.yaw) * 1.2; };
  ctl.setYaw = d => { ctl.yaw = d; ctl.dirty = true; };
});

GU3D.mountCar = (el, cfg) => live(el, { fov: 26 }, ctl => {
  let car = buildCar(cfg); ctl.scene.add(car);
  let cur = { ...cfg };
  ctl.place = () => {
    const a = THREE.MathUtils.degToRad(ctl.yaw), rad = Math.max(11.4, 21.5 / ctl.camera.aspect);
    const base = Math.atan2(-6.4, 9.2);
    ctl.camera.position.set(Math.sin(base + a) * rad, 2.3, Math.cos(base + a) * rad);
    ctl.camera.lookAt(0, 0.72, 0);
  };
  ctl.update = next => {
    const wheelChanged = next.wheel !== cur.wheel || next.finish !== cur.finish;
    if (next.paint !== cur.paint || wheelChanged) {
      ctl.scene.remove(car); dispose(car); car = buildCar(next); ctl.scene.add(car);
      if (next.wheel !== cur.wheel) spinIn(ctl, car.getObjectByName('wheels'));
    } else {
      car.getObjectByName('body').position.y = -next.drop * 0.0025;
    }
    cur = { ...next }; ctl.dirty = true;
  };
  let sx = null, sy = 0;
  ctl.canvas.addEventListener('pointerdown', e => { sx = e.clientX; sy = ctl.yaw; ctl.canvas.setPointerCapture(e.pointerId); });
  ctl.canvas.addEventListener('pointermove', e => { if (sx === null) return; ctl.yaw = Math.max(-75, Math.min(75, sy + (e.clientX - sx) * 0.35)); ctl.dirty = true; });
  const up = () => { sx = null; };
  ctl.canvas.addEventListener('pointerup', up); ctl.canvas.addEventListener('pointercancel', up);
  ctl.canvas.style.cursor = 'grab';
});

if (glAvailable()) {
  try {
    GU3D.wheelImage('six', 'bronze');   // warm up and verify rendering works
    GU3D.ok = true;
  } catch (e) { GU3D.ok = false; console.warn('3D unavailable, using 2D art', e); }
}
window.dispatchEvent(new Event('gu3d-ready'));
