/*
 * Формула-Раннер — бесконечный 3D-раннер по мотивам Subway Surfers,
 * тематика — тренажёр по физике (window.CARDS из assets/js/data/cards.js).
 *
 * Игрок бежит по трём полосам. На «воротах вопросов» нужно попасть в полосу
 * с верным ответом (зелёный портал) и не врезаться в неверные (красные барьеры).
 * Между вопросами — поезда/барьеры (прыжок/подкат) и монеты-единицы СИ.
 */
import * as THREE from "three";

/* ---------------- Константы ---------------- */
const LANE_X = [-2.2, 0, 2.2];
const SPAWN_Z = -112;
const DESPAWN_Z = 15;
const GROUND_TEXTURE_LEN = 500;
const GROUND_TEXTURE_REPEAT = 60;
const TILE = GROUND_TEXTURE_LEN / GROUND_TEXTURE_REPEAT;

const GRAVITY = 24;
const JUMP_V = 10.4;
const ROLL_TIME = 0.5;
const START_SPEED = 17;
const MAX_SPEED = 34;

const LS_MISTAKES = "phys-runner-mistakes-v1";
const LS_BEST = "phys-runner-best-v1";

/* Палитры биомов = разделы физики (светлый «дневной» вид). */
const BIOMES = {
  kin: { sky: 0x3f86c9, ground: 0x8f9484, fog: 0x9cc3e0, accent: 0x6ee7ff },
  dyn: { sky: 0x3a6ea5, ground: 0x9a8568, fog: 0x9ab6cf, accent: 0xffa94d },
  sta: { sky: 0x2f8fa6, ground: 0x8a9a9a, fog: 0x93c6cf, accent: 0x4dd0e1 },
  mom: { sky: 0x5a4fa0, ground: 0x8a82a0, fog: 0xa9a3cf, accent: 0xb388ff },
  mkt: { sky: 0xd07a3a, ground: 0xa08868, fog: 0xe0b48a, accent: 0xff8a5c },
  ele: { sky: 0x2f5fb0, ground: 0x8790a8, fog: 0x8fa8d6, accent: 0x5c8bff },
  mag: { sky: 0x4a3f8f, ground: 0x837ba0, fog: 0x9a92c9, accent: 0x9d7bff },
  osc: { sky: 0x2f9fa0, ground: 0x87a09a, fog: 0x92cfc9, accent: 0x2ee6c8 },
  opt: { sky: 0x6a5bb8, ground: 0x968fa8, fog: 0xb0a8d6, accent: 0xffe066 },
  qnt: { sky: 0xb0508f, ground: 0xa8849a, fog: 0xdba8c8, accent: 0xff6ec7 }
};
const DEFAULT_BIOME = { sky: 0x3f86c9, ground: 0x8f9484, fog: 0x9cc3e0, accent: 0x6ee7ff };

const SECTION_ORDER = (window.QuizContent && window.QuizContent.sectionOrder) ||
  ["kin", "dyn", "sta", "mom", "mkt", "ele", "mag", "osc", "opt", "qnt"];
const SECTION_TITLE = (window.QuizContent && window.QuizContent.sectionTitle) || {};

/* ---------------- Утилиты ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function byId(id) { return document.getElementById(id); }
function load(key, fb) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; }
  catch (e) { return fb; }
}
function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* недоступно */ }
}

/* ---------------- DOM ---------------- */
const sceneEl = byId("scene");
const labelsEl = byId("labels");
const hud = byId("hud");
const scoreEl = byId("score");
const coinsEl = byId("coins");
const livesEl = byId("lives");
const questionBox = byId("questionBox");
const promptTextEl = byId("promptText");
const promptMathEl = byId("promptMath");
const promptTitleEl = byId("promptTitle");
const biomeEl = byId("biome");
const speedValEl = byId("speedVal");
const comboEl = byId("combo");
const menuEl = byId("menu");
const gameoverEl = byId("gameover");
const pausedEl = byId("paused");
const pauseBtn = byId("pauseBtn");

/* Вспышка при столкновении. */
const flashEl = document.createElement("div");
flashEl.style.cssText = "position:fixed;inset:0;z-index:18;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 60%, rgba(255,80,110,0) 30%, rgba(255,60,90,0.55));transition:opacity 0.45s ease-out;";
document.body.appendChild(flashEl);

/* ---------------- Three.js каркас ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
sceneEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(DEFAULT_BIOME.fog, 34, 145);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.5, 7.6);

/* Небо — вертикальный градиент как фон сцены (без кастомных шейдеров). */
function makeSky(topCol, bottomCol) {
  const c = document.createElement("canvas");
  c.width = 8; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  const t = "#" + new THREE.Color(topCol).getHexString();
  const b = "#" + new THREE.Color(bottomCol).getHexString();
  grd.addColorStop(0, t);
  grd.addColorStop(0.5, t);
  grd.addColorStop(1, b);
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function applySky(topCol, bottomCol) {
  const old = scene.background;
  scene.background = makeSky(topCol, bottomCol);
  if (old && old.isTexture) old.dispose();
}
applySky(DEFAULT_BIOME.sky, DEFAULT_BIOME.fog);

const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x2a2418, 0.95);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xfff0d8, 1.4);
dir.position.set(7, 18, 9);
scene.add(dir);
const rim = new THREE.DirectionalLight(0x8fb4ff, 0.4);
rim.position.set(-8, 6, -10);
scene.add(rim);

/* Солнце в небе (спрайт). */
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 126);
  grad.addColorStop(0, "rgba(255,255,240,1)");
  grad.addColorStop(0.25, "rgba(255,232,170,0.85)");
  grad.addColorStop(1, "rgba(255,220,150,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffe6b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
sun.scale.set(38, 38, 1);
sun.position.set(52, 30, -150);
scene.add(sun);

/* Облака. */
function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  for (let i = 0; i < 7; i++) {
    const x = 44 + Math.random() * 168, y = 52 + Math.random() * 36, r = 22 + Math.random() * 32;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, 6.3);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}
const clouds = [];
for (let i = 0; i < 7; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeCloudTexture(), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  s.scale.set(rand(30, 52), rand(14, 22), 1);
  s.position.set(rand(-70, 70), rand(22, 42), rand(-120, -360));
  scene.add(s);
  clouds.push(s);
}

/* Земля: балласт со шпалами (прокручиваемая текстура). */
function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#c6c6c6";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3200; i++) {
    const v = 190 + (Math.random() * 60 | 0);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v - 8) + "," + (0.25 + Math.random() * 0.45).toFixed(2) + ")";
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2.4, 0, 6.3);
    g.fill();
  }
  const plank = "#6f5c48", plankDark = "#544434";
  for (let y = 6; y < 512; y += 64) {
    g.fillStyle = plank;
    g.fillRect(0, y, 512, 26);
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(0, y + 24, 512, 4);
    for (let x = 0; x < 512; x += 44) {
      g.fillStyle = plankDark;
      g.fillRect(x, y, 3, 26);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, GROUND_TEXTURE_REPEAT);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  return tex;
}
const groundTex = makeGroundTexture();
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0.05 });
const groundGeo = new THREE.PlaneGeometry(20, GROUND_TEXTURE_LEN);
groundGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.z = -GROUND_TEXTURE_LEN / 2 + 50;
ground.receiveShadow = true;
scene.add(ground);

const TRACK_CENTER = -GROUND_TEXTURE_LEN / 2 + 50;

/* Рельсы: по два металлических на каждую полосу. */
const railMetalMat = new THREE.MeshStandardMaterial({ color: 0xc7d0e2, metalness: 0.45, roughness: 0.35, emissive: 0x223049, emissiveIntensity: 0.5 });
const railGeo = new THREE.BoxGeometry(0.14, 0.18, GROUND_TEXTURE_LEN);
LANE_X.forEach((cx) => {
  [-0.72, 0.72].forEach((dx) => {
    const r = new THREE.Mesh(railGeo, railMetalMat);
    r.position.set(cx + dx, 0.16, TRACK_CENTER);
    scene.add(r);
  });
});

/* Платформы по бокам. */
const platformMat = new THREE.MeshStandardMaterial({ color: 0x9aa1b4, roughness: 0.85, metalness: 0.05 });
const platformEdgeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x6ee7ff, emissiveIntensity: 0.9, roughness: 0.4 });
[-5.4, 5.4].forEach((x) => {
  const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, GROUND_TEXTURE_LEN), platformMat);
  p.position.set(x, 0.25, TRACK_CENTER);
  p.receiveShadow = true;
  scene.add(p);
  const e = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, GROUND_TEXTURE_LEN), platformEdgeMat);
  e.position.set(x + (x < 0 ? 1.2 : -1.2), 0.52, TRACK_CENTER);
  scene.add(e);
});

/* Стены с бетоном и граффити. */
function makeWallTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#b9b9c4";
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 150 + (Math.random() * 70 | 0);
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.25)";
    g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  }
  const tags = ["#ff5470", "#6ee7ff", "#ffe066", "#b388ff", "#35d07f", "#ff8a5c"];
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = tags[i % tags.length];
    g.globalAlpha = 0.55;
    g.lineWidth = 3 + Math.random() * 6;
    const x = Math.random() * 460, y = 40 + Math.random() * 160;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) g.quadraticCurveTo(x + Math.random() * 80 - 40, y + Math.random() * 60 - 30, x + Math.random() * 120, y + Math.random() * 60 - 30);
    g.stroke();
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  return tex;
}
const wallTex = makeWallTexture();
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0 });
[-6.9, 6.9].forEach((x) => {
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, GROUND_TEXTURE_LEN), wallMat);
  w.position.set(x, 0.65, TRACK_CENTER);
  w.receiveShadow = true;
  scene.add(w);
});

/* Фасады зданий: окна + цвет корпуса. */
function makeBuildingTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#e6e6e6";
  g.fillRect(0, 0, 128, 256);
  for (let y = 18; y < 244; y += 34) {
    for (let x = 14; x < 118; x += 30) {
      const lit = Math.random() < 0.3;
      g.fillStyle = lit ? "#ffe9a8" : "#2b3550";
      g.fillRect(x, y, 18, 22);
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.fillRect(x, y, 18, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const buildingTex = makeBuildingTexture();
const buildingMats = [0xe06a5a, 0xe8b34a, 0x5aa9e6, 0x63c27a, 0xb07ce0, 0xe3ded0, 0xd98a5a, 0x6fc4d6].map(
  (col) => new THREE.MeshStandardMaterial({ map: buildingTex, color: col, roughness: 0.9, metalness: 0.05 })
);
const awningMat = new THREE.MeshStandardMaterial({ color: 0xd23b4e, roughness: 0.7 });

/* Контактная сеть: короткие поперечные подвесы (без длинных линий над камерой). */
const wireMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.5, metalness: 0.7 });
function spawnCatenary() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.08), wireMat);
  bar.position.y = 5.4;
  g.add(bar);
  [-3.3, 0, 3.3].forEach((x) => {
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), wireMat);
    drop.position.set(x, 4.95, 0);
    g.add(drop);
  });
  return g;
}

/* ---------------- Земля: тень игрока ---------------- */
function makeShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.7, 1.7),
  new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.02;
scene.add(shadow);

/* ---------------- Игрок ---------------- */
function buildPlayer() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x7c6cff, emissive: 0x241a66, roughness: 0.5, metalness: 0.25 });
  const suit2 = new THREE.MeshStandardMaterial({ color: 0x4a3bd6, roughness: 0.55, metalness: 0.2 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd9a8, roughness: 0.65 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, emissive: 0x333a55, emissiveIntensity: 0.4, roughness: 0.5 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xff5470, roughness: 0.6 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x2ee6c8, emissive: 0x0b4a44, emissiveIntensity: 0.5, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 6, 16), suit);
  torso.position.y = 1.05;
  g.add(torso);

  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.12), new THREE.MeshStandardMaterial({ color: 0xdfe3ff, emissive: 0x8899ff, emissiveIntensity: 0.5, roughness: 0.4 }));
  zip.position.set(0, 1.05, 0.31);
  g.add(zip);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 12), suit2);
  collar.position.y = 1.4;
  g.add(collar);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), skin);
  head.position.y = 1.63;
  g.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.285, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x2a2036, roughness: 0.85 }));
  hair.position.y = 1.66;
  g.add(hair);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
  cap.position.y = 1.7;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.22), capMat);
  brim.position.set(0, 1.72, 0.28);
  g.add(brim);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x6ee7ff, emissiveIntensity: 0.7, roughness: 0.3 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat);
  eyeL.position.set(-0.09, 1.64, 0.24);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.09;
  g.add(eyeL); g.add(eyeR);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), packMat);
  backpack.position.set(0, 1.12, -0.34);
  g.add(backpack);
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), suit2);
  strapL.position.set(-0.18, 1.18, 0.26);
  const strapR = strapL.clone(); strapR.position.x = 0.18;
  g.add(strapL); g.add(strapR);

  const legGeo = new THREE.CapsuleGeometry(0.11, 0.42, 4, 10);
  const legL = new THREE.Mesh(legGeo, suit); legL.position.set(-0.16, 0.48, 0);
  const legR = new THREE.Mesh(legGeo, suit); legR.position.set(0.16, 0.48, 0);
  const shoeGeo = new THREE.BoxGeometry(0.22, 0.14, 0.34);
  const shoeL = new THREE.Mesh(shoeGeo, shoe); shoeL.position.set(0, -0.28, 0.06);
  const shoeR = shoeL.clone();
  legL.add(shoeL); legR.add(shoeR);

  const armGeo = new THREE.CapsuleGeometry(0.085, 0.36, 4, 10);
  const armL = new THREE.Mesh(armGeo, suit); armL.position.set(-0.42, 1.1, 0);
  const armR = new THREE.Mesh(armGeo, suit); armR.position.set(0.42, 1.1, 0);
  const handGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const handL = new THREE.Mesh(handGeo, skin); handL.position.y = -0.28; armL.add(handL);
  const handR = handL.clone(); armR.add(handR);

  [legL, legR, armL, armR].forEach((m) => g.add(m));

  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.suit = suit;
  g.userData.head = head;
  return g;
}
const playerGroup = buildPlayer();
playerGroup.traverse((o) => { o.castShadow = true; });
scene.add(playerGroup);

/* Доска ховерборда под игроком (видна только при щите). */
const board = new THREE.Mesh(
  new THREE.BoxGeometry(1.1, 0.12, 0.42),
  new THREE.MeshStandardMaterial({ color: 0x0b3d4a, emissive: 0x2ee6c8, emissiveIntensity: 0.9, roughness: 0.4 })
);
board.position.y = 0.12;
board.visible = false;
playerGroup.add(board);

/* ---------------- Общие ресурсы объектов ---------------- */
const portalRingGeo = new THREE.TorusGeometry(1.0, 0.1, 10, 30);
const portalDiscGeo = new THREE.CircleGeometry(0.9, 30);
const matOk = new THREE.MeshStandardMaterial({ color: 0x35d07f, emissive: 0x35d07f, emissiveIntensity: 0.9, roughness: 0.35 });
const matBad = new THREE.MeshStandardMaterial({ color: 0xff5470, emissive: 0xff5470, emissiveIntensity: 0.55, roughness: 0.4 });
const discOk = new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
const discBad = new THREE.MeshBasicMaterial({ color: 0xff5470, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });

const coinGeo = new THREE.TorusGeometry(0.32, 0.11, 10, 22);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd977, emissive: 0x9a6400, emissiveIntensity: 0.85, metalness: 0.6, roughness: 0.25 });
const popGeo = new THREE.TorusGeometry(0.3, 0.07, 8, 18);

const trainWindowMat = new THREE.MeshStandardMaterial({ color: 0x0a1220, emissive: 0x6ee7ff, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.4 });
const trainRoofMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.8, metalness: 0.3 });
const trainBogieMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.9, metalness: 0.4 });
const trainWheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.8, metalness: 0.5 });
const trainLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeeaa, emissiveIntensity: 1.3, roughness: 0.3 });
const TRAIN_COLORS = [0xd23b4e, 0x2f6fd6, 0xe8a33d, 0x3fae6b, 0x8a5bd6, 0xd6d9e6];

const lowBarrierMat = new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: 0x4a2a00, emissiveIntensity: 0.6, roughness: 0.5 });
const highBarrierMat = new THREE.MeshStandardMaterial({ color: 0xff6a6a, emissive: 0x4a1010, emissiveIntensity: 0.6, roughness: 0.5 });

const boardPickMat = new THREE.MeshStandardMaterial({ color: 0x0b3d4a, emissive: 0x2ee6c8, emissiveIntensity: 0.9, roughness: 0.4 });

/* Окружение: фонари, арки, билборды. */
const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3d, roughness: 0.7, metalness: 0.5 });
const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd89a, emissiveIntensity: 1.2, roughness: 0.4 });
const archMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.8, metalness: 0.3 });
const billboardFrameMat = new THREE.MeshStandardMaterial({ color: 0x171b2b, roughness: 0.7, metalness: 0.35 });
const sceneryMat = new THREE.MeshStandardMaterial({ color: 0x1b2036, emissive: 0x6ee7ff, emissiveIntensity: 0.5, roughness: 0.6 });
const pylonGeo = new THREE.BoxGeometry(0.35, 3.4, 0.35);
const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 4.4, 10);
const lampGeo = new THREE.BoxGeometry(0.55, 0.22, 0.75);

function makePortal(ok) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(portalRingGeo, ok ? matOk : matBad);
  const disc = new THREE.Mesh(portalDiscGeo, ok ? discOk : discBad);
  disc.position.z = -0.02;
  g.add(ring); g.add(disc);
  ring.castShadow = true;
  g.position.y = 1.55;
  g.userData.ring = ring;
  return g;
}

/* ---------------- Состояние игры ---------------- */
const state = {
  mode: "menu", // menu | playing | paused | gameover
  items: [],
  currentGateId: null,
  shownCardId: null,
  deck: [],
  deckPos: 0,
  biomeIndex: 0,
  speed: START_SPEED,
  distance: 0,
  score: 0,
  coins: 0,
  correct: 0,
  wrong: 0,
  combo: 0,
  bestCombo: 0,
  lives: 3,
  shield: 0, // секунд
  spawnCooldown: 40,
  sceneryCooldown: 0,
  catenaryCooldown: 0,
  runMistakes: {},   // cardId -> { title, section }
  runPhase: 0,
  lastTime: 0,
  loopActive: true,
  effects: [],
  time: 0
};

const player = {
  lane: 1, x: 0, y: 0, vy: 0, jumping: false, rolling: false, rollT: 0, airborne: false
};

/* ---------------- Вопросы ---------------- */
function loadMistakes() { return load(LS_MISTAKES, {}); }

function buildBiomeDeck(index) {
  const id = SECTION_ORDER[index % SECTION_ORDER.length];
  const deck = window.QuizContent ? window.QuizContent.buildDeck(id) : [];
  // Ошибочные карточки — вперёд.
  const mistakes = loadMistakes();
  deck.sort((a, b) => (mistakes[b.cardId] ? 1 : 0) - (mistakes[a.cardId] ? 1 : 0));
  return { id, deck };
}

function biomeFor(id) { return BIOMES[id] || DEFAULT_BIOME; }

function applyBiome(id) {
  const b = biomeFor(id);
  applySky(b.sky, b.fog);
  scene.fog.color.set(b.fog);
  groundMat.color.set(b.ground);
  platformEdgeMat.emissive.set(b.accent);
  sceneryMat.emissive.set(b.accent);
  wallMat.color.set(b.sky).lerp(new THREE.Color(0xffffff), 0.35);
  billboardAccent = "#" + new THREE.Color(b.accent).getHexString();
  biomeEl.textContent = SECTION_TITLE[id] || id;
}

/* ---------------- Рендер вариантов (KaTeX) ---------------- */
function renderChoiceLabel(el, choice) {
  el.innerHTML = "";
  if (choice.tex) {
    if (window.katex) {
      try { window.katex.render(choice.tex, el, { throwOnError: false, strict: "ignore" }); return; }
      catch (e) { /* фолбэк */ }
    }
    el.textContent = choice.tex;
  } else {
    el.textContent = choice.text;
  }
}

function showPrompt(q) {
  promptTextEl.textContent = q.promptText || "";
  promptMathEl.innerHTML = "";
  if (q.promptTex) {
    if (window.katex) {
      try { window.katex.render(q.promptTex, promptMathEl, { throwOnError: false, strict: "ignore" }); }
      catch (e) { promptMathEl.textContent = q.promptTex; }
    } else { promptMathEl.textContent = q.promptTex; }
  }
  promptTitleEl.textContent = q.promptTitle || "";
  questionBox.hidden = false;
}
function hidePrompt() {
  questionBox.hidden = true;
}

/* ---------------- Спавн объектов ---------------- */
function addItem(item) {
  item.grp.position.z = item.z != null ? item.z : SPAWN_Z;
  if (item.x != null) item.grp.position.x = item.x;
  scene.add(item.grp);
  state.items.push(item);
}

const tmpVec = new THREE.Vector3();
function spawnPop(v, color, dur) {
  const m = new THREE.Mesh(popGeo, new THREE.MeshBasicMaterial({ color: color || 0xffe066, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(v);
  scene.add(m);
  state.effects.push({ mesh: m, t: 0, dur: dur || 0.4, grow: 2.2 });
}

function spawnDust(x) {
  const m = new THREE.Mesh(popGeo, new THREE.MeshBasicMaterial({ color: 0xe6ecf8, transparent: true, opacity: 0.6, depthWrite: false }));
  m.position.set(x, 0.1, 0.5);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  state.effects.push({ mesh: m, t: 0, dur: 0.32, grow: 1.4 });
}

function spawnScorePopup(v, text, cls) {
  const el = document.createElement("div");
  el.className = "float-text" + (cls ? " " + cls : "");
  el.textContent = text;
  const p = v.clone().project(camera);
  el.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + "px";
  el.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight).toFixed(0) + "px";
  labelsEl.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
}

function spawnChoice(q, choice, lane) {
  const grp = makePortal(choice.ok);
  grp.position.x = LANE_X[lane];
  const el = document.createElement("div");
  el.className = "q-label " + (choice.ok ? "q-label--ok" : "q-label--bad") + (choice.text ? " q-label--unit" : "");
  renderChoiceLabel(el, choice);
  labelsEl.appendChild(el);
  addItem({
    type: "choice", ok: choice.ok, grp, lane, labelEl: el,
    resolved: false, cardId: q.cardId, title: q.promptTitle, section: q.section, question: q
  });
}

function spawnGate() {
  if (!state.deck.length) return 30;
  const q = state.deck[state.deckPos % state.deck.length];
  state.deckPos++;
  // В полос всего три: берём верный вариант и два неверных.
  const correct = q.choices.filter((c) => c.ok)[0];
  const wrongs = shuffle(q.choices.filter((c) => !c.ok)).slice(0, 2);
  const set = shuffle([correct].concat(wrongs));
  const lanes = shuffle([0, 1, 2]);
  set.forEach((choice, i) => spawnChoice(q, choice, lanes[i]));
  return (30 + Math.random() * 10) * (state.speed / 18);
}

function buildTrain(len, colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.86, 1.4, len), bodyMat);
  body.position.y = 0.9;
  g.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, len * 0.98), trainRoofMat);
  roof.position.y = 1.65;
  g.add(roof);

  const winCount = Math.max(2, Math.round(len / 2.2));
  for (let w = 0; w < winCount; w++) {
    const z = -len / 2 + (w + 0.5) * (len / winCount);
    [-1, 1].forEach((side) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), trainWindowMat);
      win.position.set(side * 0.95, 1.2, z);
      g.add(win);
    });
  }

  const stripMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd24a, emissiveIntensity: 0.9, roughness: 0.4 });
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, len * 0.98), stripMat);
    strip.position.set(side * 0.95, 0.5, 0);
    g.add(strip);
  });

  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.08), trainWindowMat);
  cab.position.set(0, 1.35, len / 2 + 0.01);
  g.add(cab);
  [-0.55, 0.55].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), trainLightMat);
    hl.position.set(x, 0.7, len / 2 + 0.05);
    g.add(hl);
  });

  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  [-(len / 2 - 1.4), (len / 2 - 1.4)].forEach((z) => {
    const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), trainBogieMat);
    bogie.position.set(0, 0.35, z);
    g.add(bogie);
    [-0.6, 0.6].forEach((x) => {
      const wheel = new THREE.Mesh(wheelGeo, trainWheelMat);
      wheel.position.set(x, 0.28, z + 0.4);
      g.add(wheel);
      const wheel2 = wheel.clone(); wheel2.position.z = z - 0.4; g.add(wheel2);
    });
  });

  g.traverse((o) => { o.castShadow = true; });
  return g;
}

const TRAIN_TOP_Y = 1.75;

function spawnTrain(lane, len) {
  const g = buildTrain(len, TRAIN_COLORS[(Math.random() * TRAIN_COLORS.length) | 0]);
  g.position.x = LANE_X[lane];
  addItem({ type: "train", grp: g, lane, halfLen: len / 2, topY: TRAIN_TOP_Y, speedMul: rand(0.9, 1.12) });
  return len;
}

function spawnLowBarrier(lane) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.7), lowBarrierMat);
  b.position.y = 0.3;
  b.castShadow = true;
  g.add(b);
  g.position.x = LANE_X[lane];
  addItem({ type: "low", grp: g, lane });
}

function spawnHighBarrier(lane) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.7), highBarrierMat);
  b.position.y = 1.75;
  b.castShadow = true;
  g.add(b);
  g.position.x = LANE_X[lane];
  addItem({ type: "high", grp: g, lane });
}

function spawnDodgePattern() {
  const r = Math.random();
  let span;
  if (r < 0.5) {
    // 1–2 вагона: есть свободная полоса, а на вагон можно запрыгнуть.
    const lanes = shuffle([0, 1, 2]);
    const n = Math.random() < 0.5 ? 2 : 1;
    span = 0;
    for (let i = 0; i < n; i++) span = Math.max(span, spawnTrain(lanes[i], rand(7, 14)));
  } else if (r < 0.7) {
    // вагон + низкий барьер: прыжок помогает в обоих случаях
    const lanes = shuffle([0, 1, 2]);
    spawnTrain(lanes[0], rand(6, 10));
    spawnLowBarrier(lanes[1]);
    span = 2;
  } else if (r < 0.86) {
    [0, 1, 2].forEach(spawnLowBarrier);
    span = 1;
  } else {
    [0, 1, 2].forEach(spawnHighBarrier);
    span = 1;
  }
  return 24 + span + Math.random() * 10;
}

function spawnCoinLine() {
  const lane = Math.floor(Math.random() * 3);
  const n = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    const g = new THREE.Group();
    g.add(m);
    g.position.x = LANE_X[lane];
    g.position.y = 0.95;
    addItem({ type: "coin", grp: g, lane, z: SPAWN_Z - i * 2.2, spin: m });
  }
  return 24 + Math.random() * 8;
}

function spawnBoardPickup() {
  const lane = Math.floor(Math.random() * 3);
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.45), boardPickMat);
  m.position.y = 1.2;
  g.add(m);
  m.rotation.x = 0.35;
  g.position.x = LANE_X[lane];
  addItem({ type: "board", grp: g, lane, spin: m });
  return 34;
}

/* ---------------- Окружение ---------------- */
let billboardAccent = "#6ee7ff";

function makeBillboardTexture(text, accent) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 512, 256);
  grd.addColorStop(0, "#10162a");
  grd.addColorStop(1, accent);
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 10;
  g.strokeRect(12, 12, 488, 232);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "bold 60px 'Segoe UI', Arial";
  g.fillText(text, 256, 105);
  g.font = "600 30px 'Segoe UI', Arial";
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.fillText("ФИЗИКА • ЦЭ/ЦТ", 256, 178);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function billboardText() {
  const titles = Object.keys(SECTION_TITLE).map((k) => SECTION_TITLE[k]);
  return titles[(Math.random() * titles.length) | 0] || "ФИЗИКА";
}

function spawnPole() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2.2;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), poleMat);
  arm.position.set(-side * 0.45, 4.35, 0);
  g.add(arm);
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(-side * 0.8, 4.2, 0);
  g.add(lamp);
  g.position.x = side * 5.3;
  addItem({ type: "scenery", grp: g });
}

function spawnArch() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 0.7, 0.8), archMat);
  beam.position.y = 5.2;
  g.add(beam);
  [-5.7, 5.7].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.8), archMat);
    leg.position.set(x, 2.6, 0);
    g.add(leg);
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x0c1224, emissive: 0x6ee7ff, emissiveIntensity: 0.35, roughness: 0.5 }));
  sign.position.set(0, 4.7, 0.5);
  g.add(sign);
  addItem({ type: "scenery", grp: g });
}

function spawnBillboard() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 0.25), billboardFrameMat);
  frame.position.y = 3.4;
  g.add(frame);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 2.0),
    new THREE.MeshBasicMaterial({ map: makeBillboardTexture(billboardText(), billboardAccent), toneMapped: false })
  );
  panel.position.set(0, 3.4, side < 0 ? 0.14 : -0.14);
  panel.rotation.y = side < 0 ? 0 : Math.PI;
  g.add(panel);
  [-1.5, 1.5].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), billboardFrameMat);
    post.position.set(x, 1.2, 0);
    g.add(post);
  });
  g.position.x = side * 6.1;
  addItem({ type: "scenery", grp: g });
}

function spawnBuildings() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const g = new THREE.Group();
  const count = 2 + ((Math.random() * 2) | 0);
  let z = 0;
  for (let i = 0; i < count; i++) {
    const w = rand(3.5, 6), d = rand(4, 8), h = rand(4, 11);
    const mat = buildingMats[(Math.random() * buildingMats.length) | 0];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(0, h / 2, z - d / 2);
    g.add(b);
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.25, 1.1), awningMat);
    aw.position.set(0, 2.1, z + 0.4);
    g.add(aw);
    z -= d + rand(0.4, 1.4);
  }
  g.position.x = side * rand(7.8, 10.5);
  addItem({ type: "scenery", grp: g });
}

function spawnPylon() {
  const x = (Math.random() < 0.5 ? -1 : 1) * rand(4.8, 5.6);
  const h = rand(0.7, 1.5);
  const m = new THREE.Mesh(pylonGeo, sceneryMat);
  m.scale.y = h;
  m.position.set(x, 1.7 * h, 0);
  addItem({ type: "scenery", grp: m });
}

function spawnScenery() {
  const r = Math.random();
  if (r < 0.3) spawnPole();
  else if (r < 0.44) spawnPylon();
  else if (r < 0.6) spawnArch();
  else if (r < 0.78) spawnBillboard();
  else spawnBuildings();
}

function spawnNext() {
  const r = Math.random();
  if (r < 0.48) return spawnGate();
  if (r < 0.82) return spawnDodgePattern();
  if (r < 0.94) return spawnCoinLine();
  if (state.shield <= 0) return spawnBoardPickup();
  return spawnCoinLine();
}

function removeItem(item) {
  scene.remove(item.grp);
  if (item.labelEl) {
    item.labelEl.style.display = "none";
    if (item.labelEl.parentNode) item.labelEl.parentNode.removeChild(item.labelEl);
  }
}

/* ---------------- Управление ---------------- */
function moveLane(d) {
  if (state.mode !== "playing") return;
  player.lane = clamp(player.lane + d, 0, 2);
}
function jump() {
  if (state.mode !== "playing") return;
  if (player.jumping || player.rolling) return;
  player.vy = JUMP_V;
  player.jumping = true;
}
function roll() {
  if (state.mode !== "playing") return;
  if (player.rolling || player.jumping) return;
  player.rolling = true;
  player.rollT = ROLL_TIME;
}

window.addEventListener("keydown", (e) => {
  if (state.mode === "menu" || state.mode === "gameover") {
    if (e.key === "Enter" || e.key === " ") { startGame(); e.preventDefault(); }
    return;
  }
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { moveLane(-1); e.preventDefault(); }
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { moveLane(1); e.preventDefault(); }
  else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") { jump(); e.preventDefault(); }
  else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { roll(); e.preventDefault(); }
  else if (e.key === "Escape" || e.key === "p" || e.key === "P") { togglePause(); e.preventDefault(); }
});

/* ---------------- Свайпы (телефон/планшет) ---------------- */
let touchStart = null;
function swipeTargetOk(target) {
  if (!(target instanceof Element)) return true;
  return !target.closest(".ctrl, .btn, .pause-btn, .panel, .overlay");
}
document.addEventListener("touchstart", (e) => {
  if (state.mode !== "playing") { touchStart = null; return; }
  if (!swipeTargetOk(e.target)) { touchStart = null; return; }
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (state.mode === "playing" && touchStart && swipeTargetOk(e.target)) e.preventDefault();
}, { passive: false });
document.addEventListener("touchend", (e) => {
  if (!touchStart || state.mode !== "playing") { touchStart = null; return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) < 20) { jump(); }              // короткий тап — прыжок
  else if (adx > ady) { moveLane(dx > 0 ? 1 : -1); }    // влево/вправо
  else { dy < 0 ? jump() : roll(); }                    // вверх/вниз
  touchStart = null;
}, { passive: true });
document.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });

/* Мышь: свайп перетаскиванием (для десктопа/эмуляторов). */
let mouseStart = null;
renderer.domElement.addEventListener("mousedown", (e) => {
  if (state.mode !== "playing") return;
  mouseStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener("mouseup", (e) => {
  if (!mouseStart || state.mode !== "playing") { mouseStart = null; return; }
  const dx = e.clientX - mouseStart.x, dy = e.clientY - mouseStart.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) > 24) {
    if (adx > ady) moveLane(dx > 0 ? 1 : -1);
    else { dy < 0 ? jump() : roll(); }
  }
  mouseStart = null;
});

/* ---------------- Мобильное управление ---------------- */
const controlsEl = byId("controls");
const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0;
if (isTouch) document.body.classList.add("touch");
if (controlsEl) {
  const act = (a) => {
    if (a === "left") moveLane(-1);
    else if (a === "right") moveLane(1);
    else if (a === "jump") jump();
    else if (a === "roll") roll();
  };
  controlsEl.querySelectorAll(".ctrl").forEach((btn) => {
    const a = btn.getAttribute("data-act");
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); act(a); }, { passive: false });
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });
}

/* ---------------- Столкновения ---------------- */
function recordMistake(item) {
  state.runMistakes[item.cardId] = { title: item.title || item.cardId, section: item.section };
  const all = loadMistakes();
  all[item.cardId] = (all[item.cardId] || 0) + 1;
  save(LS_MISTAKES, all);
}

function flash() {
  flashEl.style.transition = "opacity 0.02s";
  flashEl.style.opacity = "1";
  setTimeout(() => { flashEl.style.transition = "opacity 0.5s ease-out"; flashEl.style.opacity = "0"; }, 40);
}

function loseLife() {
  if (state.shield > 0) { state.shield = 0; flash(); return; }
  state.lives -= 1;
  state.combo = 0;
  flash();
  renderLives();
  if (state.lives <= 0) gameOver();
}

function sameLane(item) { return Math.abs(player.x - item.grp.position.x) < 1.05; }

function collide(item) {
  const z = item.grp.position.z;
  if (item.type === "choice") {
    if (item.resolved || z < -0.8 || z > 0.85) return;
    if (!sameLane(item)) return;
    item.resolved = true;
    if (item.ok) {
      state.correct++;
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const gain = 120 * Math.min(state.combo, 6);
      state.score += gain;
      updateScore();
      item.grp.getWorldPosition(tmpVec);
      spawnPop(tmpVec, 0x35d07f, 0.5);
      spawnScorePopup(tmpVec, "+" + gain, "float-text--ok");
    } else {
      state.wrong++;
      recordMistake(item);
      loseLife();
    }
    return;
  }

  const half = item.halfLen || 0.75;
  if (z < -half - 0.75 || z > half + 0.75) return;

  if (item.type === "coin") {
    if (item.resolved || !sameLane(item)) return;
    item.resolved = true;
    state.coins++;
    state.score += 15;
    updateCoins(); updateScore();
    item.grp.getWorldPosition(tmpVec);
    spawnPop(tmpVec, 0xffe066);
    spawnScorePopup(tmpVec, "+15", "float-text--coin");
    return;
  }
  if (item.type === "board") {
    if (item.resolved || !sameLane(item)) return;
    item.resolved = true;
    state.shield = 8;
    board.visible = true;
    return;
  }
  if (item.type === "train") {
    const top = item.topY || TRAIN_TOP_Y;
    // Врезаемся, только если не находимся на крыше.
    if (sameLane(item) && player.y < top - 0.5) { item.resolved = true; loseLife(); }
    return;
  }
  if (item.type === "low") {
    if (sameLane(item) && player.y < 0.85) { item.resolved = true; loseLife(); }
    return;
  }
  if (item.type === "high") {
    if (sameLane(item) && !player.rolling) { item.resolved = true; loseLife(); }
    return;
  }
}

/* ---------------- HUD ---------------- */
function renderLives() {
  livesEl.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("span");
    s.className = "life" + (i < state.lives ? "" : " life--lost");
    s.textContent = "❤";
    livesEl.appendChild(s);
  }
}
function bump(el) {
  if (!el) return;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function showSwipeHint() {
  const el = document.createElement("div");
  el.className = "swipe-hint";
  el.innerHTML = "Свайп: <b>↑</b> прыжок · <b>↓</b> подкат · <b>←</b> <b>→</b> полосы";
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
}
function updateScore() { scoreEl.textContent = String(Math.floor(state.score)); bump(scoreEl); }
function updateCoins() { coinsEl.textContent = String(state.coins); bump(coinsEl); }

/* ---------------- Запуск/окончание ---------------- */
function resetWorld() {
  state.items.forEach(removeItem);
  state.items = [];
  state.effects.forEach((e) => { scene.remove(e.mesh); e.mesh.material.dispose(); });
  state.effects = [];
  state.currentGateId = null;
  state.shownCardId = null;
  hidePrompt();
}

function startGame() {
  resetWorld();
  state.mode = "playing";
  state.biomeIndex = 0;
  const bi = buildBiomeDeck(0);
  state.deck = bi.deck;
  state.deckPos = 0;
  state.currentSection = bi.id;
  applyBiome(bi.id);

  state.speed = START_SPEED;
  state.distance = 0;
  state.score = 0;
  state.coins = 0;
  state.correct = 0;
  state.wrong = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.lives = 3;
  state.shield = 0;
  state.spawnCooldown = 46;
  state.sceneryCooldown = 0;
  state.catenaryCooldown = 0;
  state.runMistakes = {};
  state.runPhase = 0;

  player.lane = 1; player.x = 0; player.y = 0; player.vy = 0;
  player.jumping = false; player.rolling = false; player.rollT = 0; player.airborne = false;
  state.time = 0;
  playerGroup.position.set(0, 0, 0);
  playerGroup.scale.set(1, 1, 1);
  board.visible = false;

  renderLives(); updateScore(); updateCoins();
  hud.hidden = false;
  menuEl.hidden = true;
  gameoverEl.hidden = true;
  pausedEl.hidden = true;
  pauseBtn.hidden = false;
  comboEl.hidden = true;
  if (controlsEl) controlsEl.hidden = !isTouch;
  if (isTouch) showSwipeHint();
}

function nextBiome() {
  state.biomeIndex++;
  const bi = buildBiomeDeck(state.biomeIndex);
  state.deck = bi.deck;
  state.deckPos = 0;
  state.currentSection = bi.id;
  applyBiome(bi.id);
  state.speed = Math.min(MAX_SPEED, state.speed + 1.5);
}

function gameOver() {
  state.mode = "gameover";
  pauseBtn.hidden = true;
  hud.hidden = true;
  questionBox.hidden = true;
  if (controlsEl) controlsEl.hidden = true;
  byId("finalScore").textContent = String(Math.floor(state.score));
  byId("finalDistance").textContent = Math.round(state.distance) + " м";
  byId("finalCorrect").textContent = String(state.correct);
  byId("finalWrong").textContent = String(state.wrong);
  byId("finalCoins").textContent = String(state.coins);

  const ids = Object.keys(state.runMistakes);
  const reviewBox = byId("reviewBox");
  const reviewList = byId("reviewList");
  reviewList.innerHTML = "";
  if (ids.length) {
    reviewBox.hidden = false;
    ids.slice(0, 8).forEach((id) => {
      const m = state.runMistakes[id];
      const li = document.createElement("li");
      const sec = SECTION_TITLE[m.section] ? SECTION_TITLE[m.section] + ": " : "";
      li.textContent = sec + m.title;
      reviewList.appendChild(li);
    });
  } else {
    reviewBox.hidden = true;
  }

  const best = load(LS_BEST, 0);
  if (Math.floor(state.score) > best) save(LS_BEST, Math.floor(state.score));

  gameoverEl.hidden = false;
}

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    pausedEl.hidden = false;
    pauseBtn.hidden = true;
  } else if (state.mode === "paused") {
    state.mode = "playing";
    pausedEl.hidden = true;
    pauseBtn.hidden = false;
  }
}

/* ---------------- Метки вариантов (проекция DOM) ---------------- */
const projVec = new THREE.Vector3();
function updateLabels() {
  const w = window.innerWidth, h = window.innerHeight;
  const gateId = state.currentGateId;
  // Запас по дистанции растёт со скоростью, чтобы успеть прочитать.
  const lead = 36 + state.speed * 1.0;
  for (const it of state.items) {
    if (!it.labelEl) continue;
    if (it.resolved || it.cardId !== gateId) { it.labelEl.style.display = "none"; continue; }
    const zPos = it.grp.position.z;
    if (zPos < -lead || zPos > 3) { it.labelEl.style.display = "none"; continue; }
    it.grp.getWorldPosition(projVec);
    const dist = camera.position.distanceTo(projVec);
    projVec.project(camera);
    if (projVec.z > 1) { it.labelEl.style.display = "none"; continue; }
    const x = (projVec.x * 0.5 + 0.5) * w;
    let y = (-projVec.y * 0.5 + 0.5) * h;
    const scale = clamp(12 / dist, 0.5, 2.0);
    // Разводим метки соседних полос по вертикали, чтобы не наслаивались.
    const laneShift = (it.lane != null ? it.lane - 1 : 0) * 42 * scale;
    y += laneShift;
    it.labelEl.style.display = "";
    it.labelEl.style.transform = "translate(-50%,-50%) translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + scale.toFixed(3) + ")";
    it.labelEl.style.opacity = String(clamp((zPos + lead) / 12, 0, 1));
  }
}

/* ---------------- Игровой цикл ---------------- */
function supportHeightAt() {
  let s = 0;
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    if (it.type !== "train" || it.resolved) continue;
    const half = it.halfLen || 0;
    if (Math.abs(player.x - it.grp.position.x) < 1.05 &&
        it.grp.position.z > -half - 0.2 && it.grp.position.z < half + 0.2) {
      const top = it.topY || TRAIN_TOP_Y;
      if (top <= player.y + 0.02) s = Math.max(s, top);
    }
  }
  return s;
}

function updatePlayer(dt) {
  // Полоса
  const targetX = LANE_X[player.lane] != null ? LANE_X[player.lane] : 0;
  player.x += (targetX - player.x) * clamp(dt * 12, 0, 1);
  // Вертикальная физика: прыжок и опора (можно запрыгнуть на крышу вагона)
  const support = supportHeightAt();
  player.vy -= GRAVITY * dt;
  player.y += player.vy * dt;
  const groundedNow = player.y <= support;
  if (groundedNow) { player.y = support; player.vy = 0; player.jumping = false; }
  if (player.airborne && groundedNow && support < 0.1) spawnDust(player.x);
  player.airborne = !groundedNow;
  // Подкат
  if (player.rolling) {
    player.rollT -= dt;
    if (player.rollT <= 0) { player.rolling = false; }
  }
  playerGroup.position.x = player.x;
  playerGroup.position.z = 0;
  playerGroup.position.y = player.y;
  let sy = 1;
  if (player.rolling) sy = 0.55;
  else if (player.jumping) sy = clamp(1 + player.vy * 0.02, 0.82, 1.22);
  playerGroup.scale.y = sy;
  const laneDelta = targetX - player.x;
  playerGroup.rotation.z = -clamp(laneDelta * 0.18, -0.28, 0.28);
  playerGroup.rotation.x = 0.1 + clamp(state.speed * 0.004, 0, 0.12);

  // Анимация бега
  const limbs = playerGroup.userData.limbs;
  if (!player.rolling) {
    state.runPhase += dt * state.speed * 0.9;
    const sw = Math.sin(state.runPhase) * 0.7;
    const sw2 = Math.sin(state.runPhase + Math.PI) * 0.7;
    limbs.legL.rotation.x = sw;
    limbs.legR.rotation.x = sw2;
    limbs.armL.rotation.x = sw2;
    limbs.armR.rotation.x = sw;
  } else {
    limbs.legL.rotation.x = 0.9; limbs.legR.rotation.x = -0.4;
    limbs.armL.rotation.x = -0.6; limbs.armR.rotation.x = -0.6;
  }
  playerGroup.position.y = player.y + (player.jumping || player.rolling ? 0 : Math.abs(Math.sin(state.runPhase)) * 0.05);

  // Тень
  shadow.position.x = player.x;
  const sh = clamp(1 - player.y * 0.14, 0.45, 1);
  shadow.scale.set(sh, sh, sh);
  shadow.material.opacity = sh;

  // Щит
  if (state.shield > 0) {
    state.shield -= dt;
    board.visible = true;
    board.rotation.y += dt * 2;
    board.rotation.x = -0.16;
    board.rotation.z = Math.sin(state.runPhase) * 0.12;
    if (state.shield <= 0) { state.shield = 0; board.visible = false; }
  }

  // Камера следит за полосой
  camera.position.x += (player.x * 0.32 - camera.position.x) * clamp(dt * 5, 0, 1);
  camera.lookAt(player.x * 0.4, player.y * 0.5 + 1.15, -8);
  camera.position.y = 4.4 + Math.sin(state.runPhase * 0.5) * 0.05;
  camera.rotation.z = -clamp(laneDelta * 0.03, -0.05, 0.05);

  // Ощущение скорости: лёгкий рост FOV
  const targetFov = 60 + clamp((state.speed - START_SPEED) * 0.55, 0, 9);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * clamp(dt * 3, 0, 1);
    camera.updateProjectionMatrix();
  }
}

/* Ближайшие к игроку ворота (поддерживает перекрывающиеся вопросы). */
function nearestGate() {
  const groups = new Map();
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    if (it.type !== "choice") continue;
    let g = groups.get(it.cardId);
    if (!g) { g = { cardId: it.cardId, q: it.question, maxZ: -Infinity }; groups.set(it.cardId, g); }
    if (it.grp.position.z > g.maxZ) g.maxZ = it.grp.position.z;
    if (!g.q && it.question) g.q = it.question;
  }
  let best = null;
  groups.forEach((g) => {
    if (g.maxZ > 8) return;
    if (!best || g.maxZ > best.maxZ) best = g;
  });
  return best;
}

function updateWorld(dt) {
  const move = state.speed * dt;
  state.time += dt;
  state.distance += move;
  state.score += move * 0.6;
  state.speed = Math.min(MAX_SPEED, state.speed + dt * 0.35);

  // Прокрутка земли
  groundTex.offset.y += move / TILE;

  // Спавн
  state.spawnCooldown -= move;
  if (state.spawnCooldown <= 0) state.spawnCooldown = spawnNext();
  state.sceneryCooldown -= move;
  if (state.sceneryCooldown <= 0) { spawnScenery(); state.sceneryCooldown = rand(9, 16); }
  state.catenaryCooldown -= move;
  if (state.catenaryCooldown <= 0) { addItem({ type: "scenery", grp: spawnCatenary() }); state.catenaryCooldown = rand(30, 44); }

  // Движение и столкновения
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i];
    it.grp.position.z += move * (it.speedMul || 1);
    if (it.type === "coin") it.grp.position.y = 0.95 + Math.sin(state.time * 2 + it.grp.position.z * 0.4) * 0.12;
    if (it.spin) it.spin.rotation.y += dt * 3.2;
    if (it.type === "choice" && it.grp.userData.ring) it.grp.userData.ring.rotation.z += dt * 0.8;

    collide(it);

    if (it.grp.position.z > DESPAWN_Z) {
      removeItem(it);
      state.items.splice(i, 1);
    }
  }

  // Эффекты: вспышка при сборе монеты
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const e = state.effects[i];
    e.t += dt;
    const k = e.t / e.dur;
    e.mesh.scale.setScalar(1 + k * (e.grow || 2.2));
    e.mesh.rotation.z += dt * 6;
    e.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) {
      scene.remove(e.mesh);
      e.mesh.material.dispose();
      state.effects.splice(i, 1);
    }
  }

  // Смена биома при исчерпании колоды
  if (state.deckPos >= state.deck.length) nextBiome();

  // Ближайшие ворота: показываем вопрос при подходе, скрываем после проезда.
  const ng = nearestGate();
  state.currentGateId = ng ? ng.cardId : null;
  const plead = 48 + state.speed * 1.1;
  if (ng && ng.q && ng.maxZ > -plead) {
    if (state.shownCardId !== ng.cardId) { showPrompt(ng.q); state.shownCardId = ng.cardId; }
  } else if (state.shownCardId) {
    hidePrompt();
    state.shownCardId = null;
  }
}

let lastCombo = 0;
function updateSpeedHud() {
  speedValEl.textContent = String(Math.round(state.speed * 3.4));
  if (state.combo >= 2) {
    comboEl.hidden = false;
    comboEl.textContent = "Серия ×" + state.combo;
    if (state.combo !== lastCombo) { bump(comboEl); lastCombo = state.combo; }
  } else {
    if (!comboEl.hidden) comboEl.hidden = true;
    lastCombo = 0;
  }
}

let lastHudScore = -1;
function loop() {
  requestAnimationFrame(loop);
  if (!state.loopActive) return;
  const now = performance.now();
  let dt = (now - state.lastTime) / 1000;
  state.lastTime = now;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.05);

  if (state.mode === "playing") {
    updatePlayer(dt);
    updateWorld(dt);

    const sc = Math.floor(state.score);
    if (sc !== lastHudScore) { scoreEl.textContent = String(sc); lastHudScore = sc; }
    updateSpeedHud();
  } else {
    if (state.mode !== "paused") {
      // Лёгкое вращение камеры в меню.
      camera.position.x = Math.sin(now / 2600) * 0.6;
      camera.lookAt(0, 1.1, -8);
    }
  }

  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    c.position.x += dt * 0.6;
    if (c.position.x > 95) c.position.x = -95;
  }

  updateLabels();
  renderer.render(scene, camera);
}

/* ---------------- Ресайз ---------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- Кнопки ---------------- */
byId("startBtn").addEventListener("click", startGame);
byId("againBtn").addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
byId("resumeBtn").addEventListener("click", togglePause);
byId("quitBtn").addEventListener("click", () => {
  state.mode = "menu";
  pausedEl.hidden = true;
  hud.hidden = true;
  menuEl.hidden = false;
  if (controlsEl) controlsEl.hidden = true;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.mode === "playing") togglePause();
});

/* ---------------- Старт ---------------- */
applyBiome(SECTION_ORDER[0]);
renderLives();
state.lastTime = performance.now();
loop();

/* Отладочный доступ для автотестов (не влияет на игру). */
window.__runner = { state, player, startGame, updateWorld, updatePlayer, updateLabels, spawnNext, spawnScenery, spawnTrain, spawnGate, spawnDodgePattern, camera, scene, renderer };
