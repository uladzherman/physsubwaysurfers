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

/* Устройство ввода и уровень графики (тени, bloom, MSAA, частицы). */
const TOUCH_DEVICE = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0;
const QUALITY_OVERRIDE = new URLSearchParams(location.search).get("q");

const LS_MISTAKES = "phys-runner-mistakes-v1";
const LS_BEST = "phys-runner-best-v1";

/* Палитры биомов = разделы физики. sky — зенит, haze — дымка у горизонта,
   grass — зелёные полосы у пути, sun — цвет солнечного света, amb — полусфера. */
const BIOMES = {
  kin: { sky: 0x35b5f2, ground: 0xc6b58d, fog: 0xd4f2ff, grass: 0x75cf3c, accent: 0x6ee7ff, sun: 0xfff3d6, amb: 1.08 },
  dyn: { sky: 0x3b7fc4, ground: 0xc0a98c, fog: 0xc6dcf0, grass: 0x74bd46, accent: 0xffa94d, sun: 0xffe8c2, amb: 1.0 },
  sta: { sky: 0x2fa0b5, ground: 0xb2bcbc, fog: 0xc6ecef, grass: 0x6fb84a, accent: 0x4dd0e1, sun: 0xeafcff, amb: 1.0 },
  mom: { sky: 0x5f52b5, ground: 0xb0a8c2, fog: 0xd3cef0, grass: 0x74c05a, accent: 0xb388ff, sun: 0xf4e9ff, amb: 0.95 },
  mkt: { sky: 0xd98a3c, ground: 0xc7ab86, fog: 0xf6d3a4, grass: 0x86c255, accent: 0xff8a5c, sun: 0xffd9a4, amb: 1.05 },
  ele: { sky: 0x3a68c8, ground: 0xacb4c8, fog: 0xc8d8f6, grass: 0x6fbcd8, accent: 0x5c8bff, sun: 0xe8f0ff, amb: 0.95 },
  mag: { sky: 0x5548a0, ground: 0xaca4c6, fog: 0xc9c1ee, grass: 0x7ab0d8, accent: 0x9d7bff, sun: 0xe2d8ff, amb: 0.9 },
  osc: { sky: 0x2aa8a8, ground: 0xa9c0ba, fog: 0xc2f0ec, grass: 0x6fd0b4, accent: 0x2ee6c8, sun: 0xdefff9, amb: 1.0 },
  opt: { sky: 0x6f5ecb, ground: 0xbcb4c8, fog: 0xd8d2f0, grass: 0x86c27a, accent: 0xffe066, sun: 0xfff5d4, amb: 1.0 },
  qnt: { sky: 0xb55a9c, ground: 0xc8a4b8, fog: 0xf2cfe2, grass: 0xd87fb0, accent: 0xff6ec7, sun: 0xffe0f0, amb: 0.95 }
};
const DEFAULT_BIOME = { sky: 0x35b5f2, ground: 0xc6b58d, fog: 0xd4f2ff, grass: 0x75cf3c, accent: 0x6ee7ff, sun: 0xfff3d6, amb: 1.08 };

const SECTION_ORDER = (window.QuizContent && window.QuizContent.sectionOrder) ||
  ["kin", "dyn", "sta", "mom", "mkt", "ele", "mag", "osc", "opt", "qnt"];
const SECTION_TITLE = (window.QuizContent && window.QuizContent.sectionTitle) || {};

/* Настройки перед стартом: разделы и скорость/сложность. */
const SPEED_PRESETS = {
  slow: { start: 12, max: 24, ramp: 0.22, gap: 1.28, level: 0 },
  normal: { start: 17, max: 36, ramp: 0.42, gap: 1, level: 1 },
  fast: { start: 25, max: 52, ramp: 0.66, gap: 0.82, level: 2 }
};
const SPEED_LABELS = { slow: "спокойно", normal: "обычно", fast: "быстро" };
const LS_SECTIONS = "phys-runner-sections-v1";
const LS_SPEED = "phys-runner-speed-v1";
let selectedSections = load(LS_SECTIONS, SECTION_ORDER.slice());
selectedSections = selectedSections.filter((id) => SECTION_ORDER.indexOf(id) !== -1);
if (!selectedSections.length) selectedSections = SECTION_ORDER.slice();
let difficulty = load(LS_SPEED, "normal");
if (!SPEED_PRESETS[difficulty]) difficulty = "normal";

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
const speedLinesEl = byId("speedlines");
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
const recentEl = byId("recent");
const recentBadge = byId("recentBadge");
const recentMath = byId("recentMath");
const recentTitle = byId("recentTitle");
const sectionChips = byId("sectionChips");
const speedChips = byId("speedChips");
const menuHint = byId("menuHint");
const menuEl = byId("menu");
const gameoverEl = byId("gameover");
const pausedEl = byId("paused");
const pauseBtn = byId("pauseBtn");

/* Вспышка при столкновении. */
const flashEl = document.createElement("div");
flashEl.style.cssText = "position:fixed;inset:0;z-index:18;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 60%, rgba(255,80,110,0) 30%, rgba(255,60,90,0.55));transition:opacity 0.45s ease-out;";
document.body.appendChild(flashEl);

/* ---------------- Three.js каркас ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", stencil: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneEl.appendChild(renderer.domElement);
const textureAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function canvasTexture(canvas, color = true) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = textureAnisotropy;
  return texture;
}

/* Уровень графики: авто по GPU/устройству, ручной — ?q=high / ?q=low. */
function detectQuality() {
  if (QUALITY_OVERRIDE === "low") return "low";
  if (QUALITY_OVERRIDE === "high") return "high";
  let name = "";
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "");
  } catch (e) { /* расширения нет */ }
  if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return "low";
  if (TOUCH_DEVICE && (navigator.deviceMemory || 4) <= 4) return "low";
  return "high";
}
const QUALITY = detectQuality();
const gfx = {
  quality: QUALITY,
  shadows: true,
  bloom: QUALITY === "high" && !TOUCH_DEVICE,
  msaa: QUALITY === "high" && !TOUCH_DEVICE ? 2 : 0,
  shadowMapSize: QUALITY === "high" && !TOUCH_DEVICE ? 2048 : 1024,
  maxPixelRatio: TOUCH_DEVICE ? 1.35 : QUALITY === "high" ? 1.75 : 1.15,
  dustCount: QUALITY === "high" ? 22 : 10
};
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfx.maxPixelRatio));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(DEFAULT_BIOME.fog, 0.0038);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 4.5, 7.6);

/* Небо — вертикальный градиент с дымкой у горизонта (фон сцены). */
function makeSkyTexture(topCol, hazeCol) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 512;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 512);
  const t = "#" + new THREE.Color(topCol).getHexString();
  const h = "#" + new THREE.Color(hazeCol).getHexString();
  grd.addColorStop(0, t);
  grd.addColorStop(0.42, t);
  grd.addColorStop(0.68, h);
  grd.addColorStop(1, h);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 512);
  return canvasTexture(c);
}
function applySky(topCol, hazeCol) {
  const old = scene.background;
  scene.background = makeSkyTexture(topCol, hazeCol);
  if (old && old.isTexture) old.dispose();
}
applySky(DEFAULT_BIOME.sky, DEFAULT_BIOME.fog);

/* Окружение (IBL) из панорамы неба — даёт металлам и бетону живые отражения. */
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
let envRT = null;
function applyEnvironment(skyCol, hazeCol, groundCol) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "#" + new THREE.Color(skyCol).getHexString());
  grd.addColorStop(0.46, "#" + new THREE.Color(hazeCol).getHexString());
  grd.addColorStop(0.52, "#" + new THREE.Color(groundCol).getHexString());
  grd.addColorStop(1, "#" + new THREE.Color(groundCol).multiplyScalar(0.55).getHexString());
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const tex = canvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const next = pmrem.fromEquirectangular(tex);
  tex.dispose();
  if (envRT) envRT.dispose();
  envRT = next;
  scene.environment = next.texture;
}
applyEnvironment(DEFAULT_BIOME.sky, DEFAULT_BIOME.fog, DEFAULT_BIOME.ground);

const hemi = new THREE.HemisphereLight(0xd8e8ff, 0x6a6a4a, DEFAULT_BIOME.amb);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xfff0d8, 2.7);
dir.position.set(9, 20, 9);
dir.castShadow = gfx.shadows;
dir.shadow.mapSize.set(gfx.shadowMapSize, gfx.shadowMapSize);
dir.shadow.camera.near = 1;
dir.shadow.camera.far = 72;
dir.shadow.camera.left = -13;
dir.shadow.camera.right = 13;
dir.shadow.camera.top = 17;
dir.shadow.camera.bottom = -9;
dir.shadow.bias = -0.0006;
dir.shadow.normalBias = 0.028;
scene.add(dir);
scene.add(dir.target);
const rim = new THREE.DirectionalLight(0x9fc4ff, 0.7);
rim.position.set(-8, 6, -10);
scene.add(rim);
/* Мягкая заливка с направления камеры — тени не «чернеют». */
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(0, 5, 12);
scene.add(fill);

/* Солнце в небе (спрайт с ореолом). */
function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 126);
  grad.addColorStop(0, "rgba(255,255,250,1)");
  grad.addColorStop(0.12, "rgba(255,247,224,0.98)");
  grad.addColorStop(0.3, "rgba(255,226,160,0.5)");
  grad.addColorStop(0.62, "rgba(255,214,140,0.14)");
  grad.addColorStop(1, "rgba(255,220,150,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return canvasTexture(c);
}
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffe6b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
sun.scale.set(30, 30, 1);
sun.position.set(52, 26, -168);
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
  return canvasTexture(c);
}
const cloudTexture = makeCloudTexture();
const clouds = [];
for (let i = 0; i < 7; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  s.scale.set(rand(30, 52), rand(14, 22), 1);
  s.position.set(rand(-70, 70), rand(22, 42), rand(-120, -360));
  scene.add(s);
  clouds.push(s);
}

/* Общий шум для bump-карт: объёмная зернистость бетона/балласта. */
function makeNoiseTexture(size, contrast, seed) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  let s = seed || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = 0; i < size * size; i++) {
    const base = 128 + (rnd() - 0.5) * contrast * 255;
    const v = Math.max(0, Math.min(255, base | 0));
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // мягкие низкочастотные пятна поверх шума
  g.globalAlpha = 0.35;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size, r = 6 + rnd() * 34;
    const grad = g.createRadialGradient(x, y, 1, x, y, r);
    const tone = rnd() < 0.5 ? 255 : 0;
    grad.addColorStop(0, "rgba(" + tone + "," + tone + "," + tone + ",0.5)");
    grad.addColorStop(1, "rgba(" + tone + "," + tone + "," + tone + ",0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  const tex = canvasTexture(c, false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* Земля: балласт со шпалами (прокручиваемая текстура). */
function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#b9b9b2";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const v = 165 + (Math.random() * 78 | 0);
    const warm = Math.random() < 0.35;
    g.fillStyle = "rgba(" + v + "," + (v - 3) + "," + (warm ? v - 22 : v + 6) + "," + (0.2 + Math.random() * 0.5).toFixed(2) + ")";
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 0.8 + Math.random() * 2.8, 0, 6.3);
    g.fill();
  }
  const plank = "#6f5c48", plankDark = "#4c3d2e";
  for (let y = 6; y < 512; y += 64) {
    g.fillStyle = plank;
    g.fillRect(0, y, 512, 26);
    // фактура дерева
    for (let k = 0; k < 26; k++) {
      g.fillStyle = "rgba(0,0,0," + (Math.random() * 0.16).toFixed(2) + ")";
      g.fillRect(Math.random() * 512, y + Math.random() * 26, 20 + Math.random() * 70, 1.4);
    }
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(0, y + 23, 512, 5);
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(0, y, 512, 3);
    for (let x = 0; x < 512; x += 44) {
      g.fillStyle = plankDark;
      g.fillRect(x, y - 1, 4, 28);
      g.fillStyle = "rgba(120,120,140,0.5)";
      g.fillRect(x - 1, y + 2, 2, 20);
    }
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, GROUND_TEXTURE_REPEAT);
  return tex;
}
const groundTex = makeGroundTexture();
const groundBump = makeNoiseTexture(256, 0.55, 7);
groundBump.repeat.set(1, GROUND_TEXTURE_REPEAT);
const groundMat = new THREE.MeshStandardMaterial({
  map: groundTex, bumpMap: groundBump, bumpScale: 0.6,
  roughness: 0.94, metalness: 0.04, envMapIntensity: 0.35
});
const groundGeo = new THREE.PlaneGeometry(20, GROUND_TEXTURE_LEN, 1, 1);
groundGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.z = -GROUND_TEXTURE_LEN / 2 + 50;
ground.receiveShadow = true;
scene.add(ground);

const TRACK_CENTER = -GROUND_TEXTURE_LEN / 2 + 50;

/* Рельсы: полированный металл с отражением неба. */
const railMetalMat = new THREE.MeshStandardMaterial({ color: 0xd7dde8, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.15 });
const railGeo = new THREE.BoxGeometry(0.14, 0.2, GROUND_TEXTURE_LEN);
LANE_X.forEach((cx) => {
  [-0.72, 0.72].forEach((dx) => {
    const r = new THREE.Mesh(railGeo, railMetalMat);
    r.position.set(cx + dx, 0.17, TRACK_CENTER);
    r.receiveShadow = true;
    scene.add(r);
  });
});

/* Платформы по бокам: плитка + жёлтая линия безопасности. */
function makePlatformTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#b6b7bd";
  g.fillRect(0, 0, 128, 256);
  g.strokeStyle = "rgba(0,0,0,0.18)";
  g.lineWidth = 2;
  for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let i = 0; i < 900; i++) {
    const v = 150 + (Math.random() * 70 | 0);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v + 4) + ",0.25)";
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  g.fillStyle = "#e8b53a";
  g.fillRect(0, 10, 128, 16);
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(0, 10, 128, 4);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, GROUND_TEXTURE_REPEAT * 1.6);
  return tex;
}
const platformMat = new THREE.MeshStandardMaterial({ map: makePlatformTexture(), roughness: 0.82, metalness: 0.06, envMapIntensity: 0.5 });
const platformEdgeMat = new THREE.MeshStandardMaterial({ color: 0x14161f, emissive: 0x6ee7ff, emissiveIntensity: 0.9, roughness: 0.4 });

/* Зелёные полосы у пути — «живой» городской вид. */
function makeGrassTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#7ec850";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5
      ? "rgba(70,150,60," + (0.2 + Math.random() * 0.4).toFixed(2) + ")"
      : "rgba(190,235,130," + (0.15 + Math.random() * 0.35).toFixed(2) + ")";
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 1 + Math.random() * 3);
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, GROUND_TEXTURE_REPEAT * 3);
  return tex;
}
const grassMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.95, metalness: 0, envMapIntensity: 0.5 });

[-5.4, 5.4].forEach((x) => {
  const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, GROUND_TEXTURE_LEN), platformMat);
  p.position.set(x, 0.25, TRACK_CENTER);
  p.receiveShadow = true;
  scene.add(p);
  const e = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, GROUND_TEXTURE_LEN), platformEdgeMat);
  e.position.set(x + (x < 0 ? 1.2 : -1.2), 0.52, TRACK_CENTER);
  scene.add(e);
  // газон за платформой
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, GROUND_TEXTURE_LEN), grassMat);
  lawn.position.set(x + (x < 0 ? -2.8 : 2.8), 0.11, TRACK_CENTER);
  lawn.receiveShadow = true;
  scene.add(lawn);
});

/* Низкий бетонный бордюр вдоль пути. */
function makeWallTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "#e2e2e8");
  grd.addColorStop(0.72, "#cdced6");
  grd.addColorStop(1, "#a9aab4");
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 2200; i++) {
    const v = 150 + (Math.random() * 90 | 0);
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.18)";
    g.fillRect(Math.random() * 512, Math.random() * 128, 2, 2);
  }
  g.fillStyle = "rgba(0,0,0,0.14)";
  for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 3, 128);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 1);
  return tex;
}
const wallTex = makeWallTexture();
const wallBump = makeNoiseTexture(256, 0.5, 21);
wallBump.repeat.set(40, 1);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallBump, bumpScale: 0.3, color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.45 });
const wallCapMat = new THREE.MeshStandardMaterial({ color: 0xd8d8de, roughness: 0.8, metalness: 0.05 });
[-6.9, 6.9].forEach((x) => {
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, GROUND_TEXTURE_LEN), wallMat);
  w.position.set(x, 0.31, TRACK_CENTER);
  w.receiveShadow = true;
  scene.add(w);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, GROUND_TEXTURE_LEN), wallCapMat);
  cap.position.set(x, 0.66, TRACK_CENTER);
  scene.add(cap);
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
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.fillRect(x, y + 18, 18, 4);
      if (Math.random() < 0.25) { // отблеск стекла
        g.fillStyle = "rgba(180,220,255,0.22)";
        g.fillRect(x + 2, y + 3, 14, 8);
      }
    }
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const buildingTex = makeBuildingTexture();
const buildingBump = makeNoiseTexture(128, 0.35, 33);
buildingBump.repeat.set(1, 1);
const buildingMats = [0xe06a5a, 0xe8b34a, 0x5aa9e6, 0x63c27a, 0xb07ce0, 0xe3ded0, 0xd98a5a, 0x6fc4d6].map(
  (col) => new THREE.MeshStandardMaterial({ map: buildingTex, bumpMap: buildingBump, bumpScale: 0.2, color: col, roughness: 0.88, metalness: 0.06, envMapIntensity: 0.55 })
);
const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.9, metalness: 0.1 });
const unitMat = new THREE.MeshStandardMaterial({ color: 0x8d939c, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.7 });
const awningMat = new THREE.MeshStandardMaterial({ color: 0xd23b4e, roughness: 0.7 });

/* Зелень и ограждения — «мультяшная» городская среда. */
const bushMat = new THREE.MeshStandardMaterial({ color: 0x3fae52, roughness: 0.9, envMapIntensity: 0.5 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9c47, roughness: 0.9, envMapIntensity: 0.5 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.75, metalness: 0.05, envMapIntensity: 0.6 });
const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff5fa2, roughness: 0.6, emissive: 0x551030, emissiveIntensity: 0.3 });
const bushGeo = new THREE.SphereGeometry(0.55, 10, 8);
const flowerGeo = new THREE.SphereGeometry(0.16, 8, 6);
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.4, 7);
const leafGeo = new THREE.IcosahedronGeometry(0.95, 0);

function spawnBush(side) {
  const g = new THREE.Group();
  const n = 2 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(bushGeo, bushMat);
    const s = rand(0.7, 1.3);
    b.scale.setScalar(s);
    b.position.set(rand(-0.8, 0.8), 0.5 * s, rand(-0.8, 0.8));
    b.castShadow = true;
    g.add(b);
  }
  if (Math.random() < 0.6) {
    const f = new THREE.Mesh(flowerGeo, flowerMat);
    f.position.set(rand(-0.6, 0.6), rand(0.9, 1.3), rand(-0.6, 0.6));
    g.add(f);
  }
  g.position.set(side * rand(6.6, 7.6), 0.22, SPAWN_Z);
  addItem({ type: "scenery", grp: g });
}

function spawnTree(side) {
  const g = new THREE.Group();
  const h = rand(1.1, 1.9);
  const tr = scaledMesh(unitCyl, trunkMat, 0.14, 1.4 * h, 0.16);
  tr.position.y = 0.7 * h;
  tr.castShadow = true;
  g.add(tr);
  const crown = new THREE.Mesh(unitIco, leafMat);
  crown.scale.setScalar(rand(0.9, 1.35));
  crown.position.y = 0.7 * h + 0.75;
  crown.castShadow = true;
  g.add(crown);
  const crown2 = new THREE.Mesh(unitIco, leafMat);
  crown2.scale.setScalar(rand(0.5, 0.8));
  crown2.position.set(rand(-0.5, 0.5), 0.7 * h + 1.4, rand(-0.4, 0.4));
  g.add(crown2);
  g.position.set(side * rand(7.2, 8.4), 0.22, SPAWN_Z);
  addItem({ type: "scenery", grp: g });
}

function spawnFence(side) {
  const g = new THREE.Group();
  const len = rand(8, 16);
  for (let i = 0; i <= Math.round(len / 1.6); i++) {
    const post = scaledMesh(unitBox, fenceMat, 0.14, 1.1, 0.14);
    post.position.set(0, 0.55, -len / 2 + i * (len / Math.max(1, Math.round(len / 1.6))));
    post.castShadow = true;
    g.add(post);
  }
  [0.4, 0.85].forEach((y) => {
    const rail = scaledMesh(unitBox, fenceMat, 0.08, 0.16, len);
    rail.position.y = y;
    g.add(rail);
  });
  g.position.set(side * rand(7.4, 8.2), 0.22, SPAWN_Z);
  addItem({ type: "scenery", grp: g });
}

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

/* ---------------- Земля: контактная тень игрока ---------------- */
function makeShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6, 1.6),
  new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.02;
scene.add(shadow);

/* ---------------- Игрок ---------------- */
function buildPlayer() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x7c6cff, emissive: 0x241a66, roughness: 0.48, metalness: 0.28, envMapIntensity: 0.85 });
  const suit2 = new THREE.MeshStandardMaterial({ color: 0x4a3bd6, roughness: 0.52, metalness: 0.24, envMapIntensity: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd9a8, roughness: 0.6, envMapIntensity: 0.7 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, emissive: 0x333a55, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.2, envMapIntensity: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xff5470, roughness: 0.55, envMapIntensity: 0.8 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x2ee6c8, emissive: 0x0b4a44, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.9 });

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
/* Единичные геометрии: объекты масштабируются вместо создания новых буферов.
   Это убирает постоянное пересоздание GPU-ресурсов (артефакты/пропадание текстур). */
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const unitSphere = new THREE.SphereGeometry(1, 14, 10);
const unitIco = new THREE.IcosahedronGeometry(1, 0);
const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14);
wheelGeo.rotateZ(Math.PI / 2);
const headlightConeGeo = new THREE.ConeGeometry(0.62, 3.2, 12, 1, true);
const lampGlowGeo = new THREE.SphereGeometry(0.1, 10, 8);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const portalRingGeo = new THREE.TorusGeometry(1.0, 0.13, 12, 36);
const portalOuterGeo = new THREE.TorusGeometry(1.22, 0.05, 8, 28);
const portalDiscGeo = new THREE.CircleGeometry(0.9, 32);
const matOk = new THREE.MeshStandardMaterial({ color: 0x35d07f, emissive: 0x2fe08a, emissiveIntensity: 1.7, roughness: 0.28, metalness: 0.25, envMapIntensity: 0.9 });
const matBad = new THREE.MeshStandardMaterial({ color: 0xff5470, emissive: 0xff5470, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.2, envMapIntensity: 0.8 });
const discOk = new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
const discBad = new THREE.MeshBasicMaterial({ color: 0xff5470, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
const glowTex = makeGlowTexture();

const coinGeo = new THREE.TorusGeometry(0.42, 0.15, 14, 30);
const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffd166, emissive: 0xffa62b, emissiveIntensity: 0.75,
  metalness: 0.95, roughness: 0.14, envMapIntensity: 1.8
});
const coinHaloMat = new THREE.SpriteMaterial({
  map: glowTex, color: 0xffd166, transparent: true, opacity: 0.62,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
});
const popGeo = new THREE.TorusGeometry(0.3, 0.07, 8, 18);

const trainWindowMat = new THREE.MeshStandardMaterial({ color: 0x101a2c, emissive: 0x2f7ea0, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.65, envMapIntensity: 1.5 });
const trainRoofMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.62, metalness: 0.55, envMapIntensity: 0.9 });
const trainBogieMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.85, metalness: 0.5, envMapIntensity: 0.6 });
const trainWheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.5, metalness: 0.75, envMapIntensity: 0.8 });
const trainLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeeaa, emissiveIntensity: 2.2, roughness: 0.3 });
const TRAIN_COLORS = [0xd23b4e, 0x2f6fd6, 0xe8a33d, 0x3fae6b, 0x8a5bd6, 0xd6d9e6];

/* Предупреждающая разметка «в полосу»: диагональные полосы. */
function makeHazardTexture(repeat) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 64);
  g.save();
  g.beginPath();
  g.rect(0, 0, 128, 64);
  g.clip();
  g.strokeStyle = "#ffd45e";
  g.lineWidth = 13;
  for (let i = -64; i < 200; i += 26) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 64, 0);
    g.stroke();
  }
  g.restore();
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat || 3, 1);
  return tex;
}
const lowBarrierTex = makeHazardTexture(4);
const hazardStripeTex = makeHazardTexture(3);
const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4d, roughness: 0.55, metalness: 0.65, envMapIntensity: 0.8 });
const meshMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3d, roughness: 0.7, metalness: 0.4, transparent: true, opacity: 0.6 });
const lowBarrierMat = new THREE.MeshStandardMaterial({ map: lowBarrierTex, color: 0xffffff, emissive: 0xff7a00, emissiveIntensity: 0.18, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.7 });
const highBarrierMat = new THREE.MeshStandardMaterial({ map: lowBarrierTex, color: 0xffd0d0, emissive: 0xff2222, emissiveIntensity: 0.22, roughness: 0.5, metalness: 0.25, envMapIntensity: 0.7 });

const boardPickMat = new THREE.MeshStandardMaterial({ color: 0x0b3d4a, emissive: 0x2ee6c8, emissiveIntensity: 0.9, roughness: 0.4 });

/* Далёкий скайлайн: силуэты кварталов у горизонта (медленный параллакс). */
const skylineMat = new THREE.MeshStandardMaterial({ color: 0x8fa8bd, roughness: 1, metalness: 0 });
const skylineGeo = new THREE.BoxGeometry(1, 1, 1);
const SKYLINE_SPAN = 520;
const skyline = [];
function spawnSkylineCluster() {
  const g = new THREE.Group();
  const n = 3 + ((Math.random() * 4) | 0);
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rand(5, 13), h = rand(10, 34), d = rand(5, 12);
    const b = new THREE.Mesh(skylineGeo, skylineMat);
    b.scale.set(w, h, d);
    b.position.set(x + w / 2, h / 2, rand(-10, 10));
    g.add(b);
    if (Math.random() < 0.4) {
      const top = new THREE.Mesh(skylineGeo, skylineMat);
      top.scale.set(w * 0.35, rand(2, 6), d * 0.35);
      top.position.set(b.position.x, h + top.scale.y / 2, b.position.z);
      g.add(top);
    }
    x += w + rand(1.5, 6);
  }
  const side = Math.random() < 0.5 ? -1 : 1;
  g.position.set(side * rand(26, 74), 0, rand(-260, 40));
  g.userData.side = side;
  scene.add(g);
  skyline.push(g);
  return g;
}
for (let i = 0; i < 5; i++) spawnSkylineCluster();
function updateSkyline(move) {
  for (let i = skyline.length - 1; i >= 0; i--) {
    const g = skyline[i];
    g.position.z += move * 0.3;
    if (g.position.z > 90) {
      g.position.z -= SKYLINE_SPAN;
      g.position.x = g.userData.side * rand(26, 74);
    }
  }
}

/* ---------------- Окружение: фонари, арки, билборды ---------------- */
const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3d, roughness: 0.7, metalness: 0.5 });
const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd89a, emissiveIntensity: 1.2, roughness: 0.4 });
const archMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.8, metalness: 0.3 });
const billboardFrameMat = new THREE.MeshStandardMaterial({ color: 0x171b2b, roughness: 0.7, metalness: 0.35 });
const sceneryMat = new THREE.MeshStandardMaterial({ color: 0x1b2036, emissive: 0x6ee7ff, emissiveIntensity: 0.5, roughness: 0.6 });
const pylonGeo = new THREE.BoxGeometry(0.35, 3.4, 0.35);
const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 4.4, 10);
const lampGeo = new THREE.BoxGeometry(0.55, 0.22, 0.75);
const archSignMat = new THREE.MeshStandardMaterial({ color: 0x0c1224, emissive: 0x6ee7ff, emissiveIntensity: 0.35, roughness: 0.5 });
const lampGlowSpriteMat = new THREE.SpriteMaterial({
  map: glowTex, color: 0xffd89a, transparent: true, opacity: 0.6,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
});

const haloMats = {
  ok: new THREE.SpriteMaterial({ map: glowTex, color: 0x35d07f, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  bad: new THREE.SpriteMaterial({ map: glowTex, color: 0xff5470, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
};
const poolMats = {
  ok: new THREE.MeshBasicMaterial({ map: glowTex, color: 0x35d07f, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  bad: new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff5470, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
};

function makePortal(ok) {
  const g = new THREE.Group();
  const key = ok ? "ok" : "bad";
  const col = ok ? 0x35d07f : 0xff5470;
  const ring = new THREE.Mesh(portalRingGeo, ok ? matOk : matBad);
  const disc = new THREE.Mesh(portalDiscGeo, ok ? discOk : discBad);
  disc.position.z = -0.02;
  g.add(ring); g.add(disc);

  // внешнее кольцо и ореол — кольцо «светится», bloom подхватит
  const outer = new THREE.Mesh(portalOuterGeo, ok ? matOk : matBad);
  g.add(outer);
  const halo = new THREE.Sprite(haloMats[key]);
  halo.scale.set(4.6, 4.6, 1);
  halo.position.z = -0.05;
  g.add(halo);

  // световое пятно на земле под кольцом
  const pool = new THREE.Mesh(unitPlane, poolMats[key]);
  pool.scale.set(3.4, 3.4, 1);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -1.52;
  g.add(pool);

  ring.castShadow = true;
  g.position.y = 1.55;
  g.userData.ring = ring;
  g.userData.outer = outer;
  g.userData.halo = halo;
  g.userData.pool = pool;
  return g;
}

/* Подбор предмета: короткая анимация исчезновения перед удалением из сцены. */
function markCollected(item, kind) {
  item.collecting = true;
  item.collectT = 0;
  item.collectKind = kind || "pop";
  item.collectY = item.grp.position.y;
}
function updateCollectAnim(it, dt) {
  it.collectT += dt;
  const k = clamp(it.collectT / 0.18, 0, 1);
  if (it.collectKind === "ring") {
    // кольцо «разлетается» в момент прохода
    it.grp.scale.setScalar(1 + k * 0.75);
    it.grp.position.y = it.collectY + k * 0.5;
  } else {
    // золотое кольцо подпрыгивает и гаснет
    it.grp.scale.setScalar((1 + k * 0.6) * (1 - k * 0.9));
    it.grp.position.y = it.collectY + dt * 2.2;
  }
  if (k >= 1) it.doomed = true;
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
  baseSpeed: START_SPEED,
  maxSpeed: MAX_SPEED,
  ramp: 0.42,
  gapScale: 1,
  difficulty: 1,
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
  time: 0,
  fps: 0
};

const player = {
  lane: 1, x: 0, y: 0, vy: 0, jumping: false, rolling: false, rollT: 0, airborne: false
};

/* ---------------- Вопросы ---------------- */
function loadMistakes() { return load(LS_MISTAKES, {}); }

function buildSelectedDeck() {
  let deck = [];
  selectedSections.forEach((id) => {
    if (window.QuizContent) deck = deck.concat(window.QuizContent.buildDeck(id));
  });
  const mistakes = loadMistakes();
  deck.sort((a, b) => (mistakes[b.cardId] ? 1 : 0) - (mistakes[a.cardId] ? 1 : 0));
  return shuffle(deck);
}

function biomeFor(id) { return BIOMES[id] || DEFAULT_BIOME; }

function applyBiome(id) {
  const b = biomeFor(id);
  applySky(b.sky, b.fog);
  applyEnvironment(b.sky, b.fog, b.ground);
  scene.fog.color.set(b.fog).multiplyScalar(0.94);
  dir.color.set(b.sun);
  sun.material.color.set(b.sun);
  hemi.intensity = b.amb;
  groundMat.color.set(b.ground);
  grassMat.color.set(b.grass);
  platformEdgeMat.emissive.set(b.accent);
  sceneryMat.emissive.set(b.accent);
  skylineMat.color.set(b.fog).lerp(new THREE.Color(b.sky), 0.5);
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

/* Дублирование пройденной формулы сверху экрана. */
function showRecent(q, wasCorrect) {
  if (!q) return;
  const correct = (q.choices || []).filter((c) => c.ok)[0];
  if (!correct) return;
  recentEl.hidden = false;
  recentEl.classList.toggle("hud__recent--ok", !!wasCorrect);
  recentEl.classList.toggle("hud__recent--bad", !wasCorrect);
  recentBadge.textContent = wasCorrect ? "Верно" : "Ошибка";
  recentMath.innerHTML = "";
  if (correct.tex) {
    if (window.katex) {
      try { window.katex.render(correct.tex, recentMath, { throwOnError: false, strict: "ignore" }); }
      catch (e) { recentMath.textContent = correct.tex; }
    } else { recentMath.textContent = correct.tex; }
  } else {
    recentMath.textContent = correct.text || "";
  }
  recentTitle.textContent = q.promptTitle || "";
  bump(recentEl);
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
  state.effects.push({ mesh: m, t: 0, dur: dur || 0.4, grow: 2.2, ownMat: true });
}

/* Искры вокруг собранного предмета (материалы из пула — без утечек). */
const sparkleMats = [0xffe066, 0xffd977, 0x7df0a8].map((c) => new THREE.SpriteMaterial({
  map: glowTex, color: c, transparent: true, opacity: 0.95,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
}));
function sparkleMaterial(color) {
  let best = sparkleMats[0];
  let bestD = Infinity;
  for (const m of sparkleMats) {
    const d = Math.abs(m.color.getHex() - color);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}
function spawnSparkle(v, color, n) {
  const count = Math.max(2, Math.min(8, n || 4));
  const mat = sparkleMaterial(color || 0xffe066);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(mat);
    s.position.copy(v);
    const sc = rand(0.18, 0.34);
    s.scale.setScalar(sc);
    scene.add(s);
    const a = Math.random() * Math.PI * 2;
    state.effects.push({
      mesh: s, t: 0, dur: rand(0.28, 0.46), grow: 0.4, sprite: true, scale0: sc,
      vx: Math.cos(a) * rand(1.4, 3.2),
      vy: rand(0.8, 2.6),
      vz: Math.sin(a) * rand(1.4, 3.2) + 4
    });
  }
}

function spawnDust(x) {
  const m = new THREE.Mesh(popGeo, new THREE.MeshBasicMaterial({ color: 0xe6ecf8, transparent: true, opacity: 0.6, depthWrite: false }));
  m.position.set(x, 0.1, 0.5);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  state.effects.push({ mesh: m, t: 0, dur: 0.32, grow: 1.4, ownMat: true });
}

/* Пул пылинок за игроком — ощущение скорости (без аллокаций в кадре). */
function makeDustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.55, "rgba(230,236,248,0.28)");
  grad.addColorStop(1, "rgba(220,230,250,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return canvasTexture(c);
}
const dustTex = makeDustTexture();
const dustPool = [];
for (let i = 0; i < gfx.dustCount; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, opacity: 0, depthWrite: false }));
  s.visible = false;
  scene.add(s);
  dustPool.push({ sprite: s, life: 1, max: 1, vy: 0, vz: 0 });
}
let dustCursor = 0;
let dustTimer = 0;
function spawnSpeedDust() {
  const d = dustPool[dustCursor];
  dustCursor = (dustCursor + 1) % dustPool.length;
  d.sprite.position.set(player.x + rand(-0.75, 0.75), rand(0.15, 0.6), 0.5);
  d.life = 0;
  d.max = rand(0.4, 0.75);
  d.vy = rand(0.6, 1.5);
  d.vz = rand(3, 6.5);
  d.sprite.visible = true;
}
function updateDust(dt) {
  for (const d of dustPool) {
    if (d.life >= d.max) continue;
    d.life += dt;
    const k = clamp(d.life / d.max, 0, 1);
    d.sprite.position.z += d.vz * dt;
    d.sprite.position.y += d.vy * dt;
    d.sprite.scale.setScalar(0.5 + k * 1.7);
    d.sprite.material.opacity = 0.32 * (1 - k);
    if (k >= 1) d.sprite.visible = false;
  }
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

/* Кольцо-вопрос: на земле или на крыше вагона. */
function spawnChoice(q, choice, lane, opts) {
  const o = opts || {};
  const grp = makePortal(choice.ok);
  grp.position.x = LANE_X[lane];
  if (o.roofGate) {
    grp.position.y = ROOF_RING_Y;
    if (grp.userData.pool) grp.userData.pool.visible = false;   // «пол» под кольцом не нужен
  }
  const el = document.createElement("div");
  el.className = "q-label " + (choice.ok ? "q-label--ok" : "q-label--bad") + (choice.text ? " q-label--unit" : "") + (o.roofGate ? " q-label--roof" : "");
  renderChoiceLabel(el, choice);
  labelsEl.appendChild(el);
  addItem({
    type: "choice", ok: choice.ok, grp, lane, labelEl: el,
    roofGate: !!o.roofGate, roofTopY: TRAIN_TOP_Y,
    resolved: false, cardId: q.cardId, title: q.promptTitle, section: q.section, question: q
  });
}

function spawnGate(forceRoof) {
  if (!state.deck.length) { state.deck = buildSelectedDeck(); if (!state.deck.length) return 30; }
  if (state.deckPos >= state.deck.length) { state.deck = buildSelectedDeck(); state.deckPos = 0; }
  const q = state.deck[state.deckPos++];
  // Биом подстраивается под раздел текущей формулы.
  if (q.section && q.section !== state.currentSection) { state.currentSection = q.section; applyBiome(q.section); }
  // В полос всего три: берём верный вариант и два неверных.
  const correct = q.choices.filter((c) => c.ok)[0];
  const wrongs = shuffle(q.choices.filter((c) => !c.ok)).slice(0, 2);
  const set = shuffle([correct].concat(wrongs));
  const lanes = shuffle([0, 1, 2]);
  // Часть вопросов — «на крыше»: верное кольцо стоит на вагоне, нужно запрыгнуть.
  const roofGate = forceRoof !== undefined
    ? forceRoof
    : Math.random() < 0.3 + state.difficulty * 0.12;
  const correctLane = lanes[set.indexOf(correct)];
  if (roofGate) {
    const len = rand(10, 17);
    spawnTrain(correctLane, len, 1);
    spawnCoinLine({ lane: correctLane, count: 4, y: ROOF_COIN_Y, speedMul: 1, roof: true });
  }
  set.forEach((choice, i) => {
    spawnChoice(q, choice, lanes[i], { roofGate: roofGate && lanes[i] === correctLane });
  });
  return (30 + Math.random() * 10) * (state.speed / 18);
}

/* Скруглённый профиль вагона (экструзия вдоль Z) — мягкие блики на бортах. */
function roundedBodyGeo(w, h, len, r) {
  const hw = w / 2 - r, hh = h / 2 - r;
  const s = new THREE.Shape();
  s.moveTo(-hw - r, -hh);
  s.lineTo(-hw - r, hh);
  s.quadraticCurveTo(-hw - r, hh + r, -hw, hh + r);
  s.lineTo(hw, hh + r);
  s.quadraticCurveTo(hw + r, hh + r, hw + r, hh);
  s.lineTo(hw + r, -hh);
  s.quadraticCurveTo(hw + r, -hh - r, hw, -hh - r);
  s.lineTo(-hw, -hh - r);
  s.quadraticCurveTo(-hw - r, -hh - r, -hw - r, -hh);
  const depth = Math.max(0.5, len - 0.08);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03,
    bevelSegments: 2, curveSegments: 3, steps: 1
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/* Кэш геометрий и материалов вагонов: длины округляются до 0.5 м. */
const trainGeoCache = new Map();
function trainBodyGeo(len) {
  const key = Math.max(6, Math.round(len * 2) / 2);
  let g = trainGeoCache.get(key);
  if (!g) {
    g = roundedBodyGeo(1.86, 1.4, key, 0.16);
    trainGeoCache.set(key, g);
  }
  return g;
}
const trainBodyMats = new Map();
function trainBodyMat(colorHex) {
  let m = trainBodyMats.get(colorHex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.38, metalness: 0.42, envMapIntensity: 0.9 });
    trainBodyMats.set(colorHex, m);
  }
  return m;
}
const trainStripMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd24a, emissiveIntensity: 1.1, roughness: 0.4 });
const headFlareMat = new THREE.SpriteMaterial({
  map: glowTex, color: 0xfff0c0, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
});
const headConeMat = new THREE.MeshBasicMaterial({
  color: 0xffe9b8, transparent: true, opacity: 0.09,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});

function scaledMesh(geo, mat, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  return m;
}

function buildTrain(len, colorHex) {
  const g = new THREE.Group();
  const bodyMat = trainBodyMat(colorHex);
  const body = new THREE.Mesh(trainBodyGeo(len), bodyMat);
  body.position.y = 0.9;
  g.add(body);

  const roof = scaledMesh(unitBox, trainRoofMat, 1.66, 0.18, len * 0.98);
  roof.position.y = 1.66;
  g.add(roof);
  const ribCount = Math.max(2, Math.round(len / 3));
  for (let i = 0; i < ribCount; i++) {
    const rib = scaledMesh(unitBox, trainRoofMat, 1.72, 0.06, 0.1);
    rib.position.set(0, 1.77, -len / 2 + (i + 0.5) * (len / ribCount));
    g.add(rib);
  }
  const ac = scaledMesh(unitBox, trainBogieMat, 0.8, 0.22, 1.3);
  ac.position.set(0, 1.84, len * 0.18);
  g.add(ac);

  const winCount = Math.max(2, Math.round(len / 2.2));
  for (let w = 0; w < winCount; w++) {
    const z = -len / 2 + (w + 0.5) * (len / winCount);
    [-1, 1].forEach((side) => {
      const win = scaledMesh(unitBox, trainWindowMat, 0.06, 0.5, 0.9);
      win.position.set(side * 0.95, 1.2, z);
      g.add(win);
      if (w % 2 === 0) {
        const door = scaledMesh(unitBox, bodyMat, 0.05, 1.1, 0.5);
        door.position.set(side * 0.955, 0.9, z + len / winCount / 2);
        g.add(door);
      }
    });
  }

  [-1, 1].forEach((side) => {
    const strip = scaledMesh(unitBox, trainStripMat, 0.05, 0.12, len * 0.98);
    strip.position.set(side * 0.96, 0.5, 0);
    g.add(strip);
  });

  const cab = scaledMesh(unitBox, trainWindowMat, 1.7, 0.7, 0.08);
  cab.position.set(0, 1.35, len / 2 + 0.01);
  g.add(cab);
  [-0.55, 0.55].forEach((x) => {
    const hl = new THREE.Mesh(unitSphere, trainLightMat);
    hl.scale.setScalar(0.15);
    hl.position.set(x, 0.7, len / 2 + 0.05);
    g.add(hl);
    const flare = new THREE.Sprite(headFlareMat);
    flare.scale.set(1.5, 1.5, 1);
    flare.position.set(x, 0.7, len / 2 + 0.16);
    g.add(flare);
    const cone = new THREE.Mesh(headlightConeGeo, headConeMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(x, 0.7, len / 2 + 1.5);
    g.add(cone);
  });
  const bumper = scaledMesh(unitBox, trainBogieMat, 1.5, 0.18, 0.2);
  bumper.position.set(0, 0.28, len / 2 + 0.1);
  g.add(bumper);

  [-(len / 2 - 1.4), (len / 2 - 1.4)].forEach((z) => {
    const bogie = scaledMesh(unitBox, trainBogieMat, 1.5, 0.35, 1.5);
    bogie.position.set(0, 0.35, z);
    g.add(bogie);
    [-0.6, 0.6].forEach((x) => {
      const wheel = new THREE.Mesh(wheelGeo, trainWheelMat);
      wheel.position.set(x, 0.28, z + 0.4);
      g.add(wheel);
      const wheel2 = new THREE.Mesh(wheelGeo, trainWheelMat);
      wheel2.position.set(x, 0.28, z - 0.4);
      g.add(wheel2);
    });
  });

  g.traverse((o) => {
    if (o.isSprite) return;
    o.castShadow = true;
  });
  return g;
}

const TRAIN_TOP_Y = 1.75;
const ROOF_COIN_Y = TRAIN_TOP_Y + 0.95;   // золото на крыше вагона
const ROOF_RING_Y = TRAIN_TOP_Y + 0.8;    // кольцо-вопрос вокруг стоящего игрока

function spawnTrain(lane, len, speedMul) {
  const g = buildTrain(len, TRAIN_COLORS[(Math.random() * TRAIN_COLORS.length) | 0]);
  g.position.x = LANE_X[lane];
  addItem({
    type: "train", grp: g, lane, halfLen: len / 2, topY: TRAIN_TOP_Y,
    speedMul: speedMul != null ? speedMul : rand(0.9, 1.12)
  });
  return len;
}

/* Мигалка-предупреждение: купол + ореол (видно издалека). */
const warnDomeMats = {
  0xffc043: new THREE.MeshStandardMaterial({ color: 0xffc043, emissive: 0xffc043, emissiveIntensity: 1.8, roughness: 0.3 }),
  0xff4a4a: new THREE.MeshStandardMaterial({ color: 0xff4a4a, emissive: 0xff4a4a, emissiveIntensity: 1.8, roughness: 0.3 })
};
const warnFlareMats = {
  0xffc043: new THREE.SpriteMaterial({ map: glowTex, color: 0xffc043, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  0xff4a4a: new THREE.SpriteMaterial({ map: glowTex, color: 0xff4a4a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
};
const hazardStripeMat = new THREE.MeshBasicMaterial({ map: hazardStripeTex, transparent: true, opacity: 0.85, depthWrite: false });
function addWarnLight(g, x, y, color, scale) {
  const s = scale || 1;
  const dome = new THREE.Mesh(lampGlowGeo, warnDomeMats[color]);
  dome.position.set(x, y, 0.06);
  dome.scale.setScalar(s);
  g.add(dome);
  const flare = new THREE.Sprite(warnFlareMats[color]);
  flare.scale.setScalar(1.1 * s);
  flare.position.set(x, y, 0.1);
  g.add(flare);
}

/* Разметка на земле перед препятствием — подсказывает, что впереди. */
function addHazardStripe(g, zOff, w) {
  const m = new THREE.Mesh(unitPlane, hazardStripeMat);
  m.scale.set(w || 2.2, 1.1, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.02, zOff);
  g.add(m);
}

/* Низкий барьер: брус с диагональными полосами, ножки, мигалки. */
function buildLowBarrier() {
  const g = new THREE.Group();
  const beam = scaledMesh(unitBox, lowBarrierMat, 1.95, 0.5, 0.34);
  beam.position.y = 0.36;
  g.add(beam);
  const lip = scaledMesh(unitBox, frameMat, 1.99, 0.1, 0.44);
  lip.position.y = 0.64;
  g.add(lip);
  [-0.72, 0.72].forEach((x) => {
    const leg = scaledMesh(unitBox, frameMat, 0.14, 0.36, 0.14);
    leg.position.set(x, 0.18, 0);
    g.add(leg);
    const foot = scaledMesh(unitBox, frameMat, 0.42, 0.07, 0.62);
    foot.position.set(x, 0.035, 0);
    g.add(foot);
  });
  [-0.5, 0.5].forEach((x) => addWarnLight(g, x, 0.72, 0xffc043, 1.1));
  addHazardStripe(g, 0.95, 2.2);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* Высокий барьер: подвесная ферма — проезжать только подкатом. */
function buildHighBarrier() {
  const g = new THREE.Group();
  [-0.94, 0.94].forEach((x) => {
    const post = scaledMesh(unitBox, frameMat, 0.18, 2.7, 0.18);
    post.position.set(x, 1.35, 0);
    g.add(post);
    const base = scaledMesh(unitBox, frameMat, 0.44, 0.09, 0.5);
    base.position.set(x, 0.045, 0);
    g.add(base);
  });
  const top = scaledMesh(unitBox, frameMat, 2.1, 0.18, 0.3);
  top.position.y = 2.42;
  g.add(top);
  const bar = scaledMesh(unitBox, highBarrierMat, 2.05, 0.52, 0.3);
  bar.position.y = 2.05;
  g.add(bar);
  const grid = scaledMesh(unitBox, meshMat, 1.9, 0.5, 0.07);
  grid.position.y = 1.62;
  g.add(grid);
  [-0.6, 0.6].forEach((x) => addWarnLight(g, x, 2.6, 0xff4a4a, 1.15));
  addHazardStripe(g, 0.95, 2.2);
  g.traverse((o) => { if (o.isMesh && o.material !== hazardStripeMat) o.castShadow = true; });
  return g;
}

function spawnLowBarrier(lane) {
  const g = buildLowBarrier();
  g.position.x = LANE_X[lane];
  addItem({ type: "low", grp: g, lane });
}

function spawnHighBarrier(lane) {
  const g = buildHighBarrier();
  g.position.x = LANE_X[lane];
  addItem({ type: "high", grp: g, lane });
}

/* Комбинации препятствий: чем сложнее — тем меньше свободных полос. */
function spawnDodgePattern() {
  const r = Math.random();
  let span = 0;
  if (r < 0.3) {
    // два вагона: остаётся одна полоса, на крыше — золото
    const lanes = shuffle([0, 1, 2]);
    span = Math.max(spawnTrain(lanes[0], rand(9, 16)), spawnTrain(lanes[1], rand(7, 13)));
    if (Math.random() < 0.55) spawnCoinLine({ lane: lanes[0], count: 5, y: ROOF_COIN_Y, speedMul: 1, roof: true });
  } else if (r < 0.46) {
    // длинный вагон с золотом на крыше + низкий барьер рядом
    const lanes = shuffle([0, 1, 2]);
    const len = spawnTrain(lanes[0], rand(12, 19));
    spawnCoinLine({ lane: lanes[0], count: clamp(Math.round(len / 2.8), 4, 8), y: ROOF_COIN_Y, speedMul: 1, roof: true });
    spawnLowBarrier(lanes[1]);
    span = 2;
  } else if (r < 0.6) {
    // вагон между двумя барьерами: удобная траектория — крыша
    const lanes = shuffle([0, 1, 2]);
    spawnTrain(lanes[0], rand(11, 17));
    spawnCoinLine({ lane: lanes[0], count: 4, y: ROOF_COIN_Y, speedMul: 1, roof: true });
    spawnLowBarrier(lanes[1]);
    spawnLowBarrier(lanes[2]);
    span = 2;
  } else if (r < 0.72) {
    // ферма (подкат) и вагон рядом
    const lanes = shuffle([0, 1, 2]);
    spawnHighBarrier(lanes[0]);
    spawnTrain(lanes[1], rand(8, 14));
    span = 2;
  } else if (r < 0.87) {
    [0, 1, 2].forEach(spawnLowBarrier);
    span = 1;
  } else {
    [0, 1, 2].forEach(spawnHighBarrier);
    span = 1;
  }
  return (23 + span + Math.random() * 8) * state.gapScale;
}

/* Золотые кольца: по земле, дугой или на крыше вагона. */
function spawnCoinLine(opts) {
  const o = opts || {};
  const lane = o.lane != null ? o.lane : Math.floor(Math.random() * 3);
  const count = o.count != null ? o.count : 6 + Math.floor(Math.random() * 4);
  const y = o.y != null ? o.y : 0.95;
  const startZ = o.z != null ? o.z : SPAWN_Z;
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(coinGeo, coinMat);
    g.add(m);
    const halo = new THREE.Sprite(coinHaloMat);
    halo.scale.setScalar(2.1);
    g.add(halo);
    g.position.x = LANE_X[lane];
    g.position.y = y;
    addItem({
      type: "coin", grp: g, lane, z: startZ - i * 2.2, spin: m, halo,
      onRoof: !!o.roof, speedMul: o.speedMul || 1
    });
  }
  return o.gap == null ? (24 + Math.random() * 8) * state.gapScale : o.gap;
}

/* Ховерборд-щит: доска с колёсиками и подсветкой. */
const boardGlowMat = new THREE.SpriteMaterial({
  map: glowTex, color: 0x2ee6c8, transparent: true, opacity: 0.75,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
});
function spawnBoardPickup() {
  const lane = Math.floor(Math.random() * 3);
  const g = new THREE.Group();
  const deck = scaledMesh(unitBox, boardPickMat, 1.15, 0.1, 0.44);
  deck.position.y = 1.15;
  deck.rotation.x = 0.32;
  g.add(deck);
  const rail = scaledMesh(unitBox, trainBogieMat, 1.15, 0.05, 0.08);
  rail.position.y = 1.22;
  rail.rotation.x = 0.32;
  g.add(rail);
  [-0.4, 0.4].forEach((x) => {
    const w = scaledMesh(unitCyl, trainWheelMat, 0.09, 0.06, 0.09);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 1.0, 0.04);
    g.add(w);
  });
  const glow = new THREE.Sprite(boardGlowMat);
  glow.scale.set(2.4, 2.4, 1);
  glow.position.y = 1.15;
  g.add(glow);
  g.position.x = LANE_X[lane];
  addItem({ type: "board", grp: g, lane, spin: deck });
  return 34 * state.gapScale;
}

/* ---------------- Окружение ---------------- */
let billboardAccent = "#6ee7ff";

/* Текстуры билбордов кэшируются: иначе GPU накапливает текстуры и они «пропадают». */
const billboardTexCache = new Map();
function makeBillboardTexture(text) {
  const cached = billboardTexCache.get(text);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 512, 256);
  grd.addColorStop(0, "#10162a");
  grd.addColorStop(1, "#6ee7ff");
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
  const tex = canvasTexture(c);
  tex.anisotropy = Math.min(4, textureAnisotropy);
  billboardTexCache.set(text, tex);
  return tex;
}
const billboardPanelMats = new Map();
function billboardMaterial(title) {
  let m = billboardPanelMats.get(title);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: makeBillboardTexture(title), toneMapped: false });
    billboardPanelMats.set(title, m);
  }
  return m;
}

const BILLBOARD_TITLES = Object.keys(SECTION_TITLE).map((k) => SECTION_TITLE[k]);
function billboardText() {
  return BILLBOARD_TITLES[(Math.random() * BILLBOARD_TITLES.length) | 0] || "ФИЗИКА";
}

function spawnPole() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2.2;
  g.add(pole);
  const arm = scaledMesh(unitBox, poleMat, 0.9, 0.1, 0.1);
  arm.position.set(-side * 0.45, 4.35, 0);
  g.add(arm);
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(-side * 0.8, 4.2, 0);
  g.add(lamp);
  const lampGlow = new THREE.Sprite(lampGlowSpriteMat);
  lampGlow.scale.set(2.2, 2.2, 1);
  lampGlow.position.set(-side * 0.8, 4.15, 0);
  g.add(lampGlow);
  g.position.x = side * 5.3;
  addItem({ type: "scenery", grp: g });
}

function spawnArch() {
  const g = new THREE.Group();
  const beam = scaledMesh(unitBox, archMat, 13, 0.7, 0.8);
  beam.position.y = 5.2;
  g.add(beam);
  [-5.7, 5.7].forEach((x) => {
    const leg = scaledMesh(unitBox, archMat, 0.6, 5.2, 0.8);
    leg.position.set(x, 2.6, 0);
    g.add(leg);
  });
  const sign = scaledMesh(unitBox, archSignMat, 4.4, 0.8, 0.12);
  sign.position.set(0, 4.7, 0.5);
  g.add(sign);
  addItem({ type: "scenery", grp: g });
}

function spawnBillboard() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const g = new THREE.Group();
  const frame = scaledMesh(unitBox, billboardFrameMat, 4.4, 2.4, 0.25);
  frame.position.y = 3.4;
  g.add(frame);
  const panelMat = billboardMaterial(billboardText());
  const panel = new THREE.Mesh(unitPlane, panelMat);
  panel.scale.set(4.0, 2.0, 1);
  panel.position.set(0, 3.4, side < 0 ? 0.14 : -0.14);
  panel.rotation.y = side < 0 ? 0 : Math.PI;
  g.add(panel);
  [-1.5, 1.5].forEach((x) => {
    const post = scaledMesh(unitBox, billboardFrameMat, 0.25, 2.4, 0.25);
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
    const b = scaledMesh(unitBox, mat, w, h, d);
    b.position.set(0, h / 2, z - d / 2);
    g.add(b);
    const aw = scaledMesh(unitBox, awningMat, w * 0.9, 0.25, 1.1);
    aw.position.set(0, 2.1, z + 0.4);
    g.add(aw);
    // парапет и техника на кровле — силуэт выглядит объёмным
    const par = scaledMesh(unitBox, roofMat, w + 0.3, 0.5, d + 0.3);
    par.position.set(0, h + 0.2, z - d / 2);
    g.add(par);
    const units = 1 + ((Math.random() * 2) | 0);
    for (let k = 0; k < units; k++) {
      const uw = rand(0.7, 1.5), ud = rand(0.7, 1.4), uh = rand(0.5, 1.1);
      const u = scaledMesh(unitBox, unitMat, uw, uh, ud);
      u.position.set(rand(-w / 3, w / 3), h + uh / 2 + 0.4, z - rand(0.6, d - 0.6));
      g.add(u);
    }
    if (Math.random() < 0.4) {
      const mh = rand(1.4, 2.6);
      const mast = scaledMesh(unitCyl, unitMat, 0.06, mh, 0.06);
      mast.position.set(rand(-w / 3, w / 3), h + 0.4 + mh / 2, z - d / 2);
      g.add(mast);
    }
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
  const side = Math.random() < 0.5 ? -1 : 1;
  if (r < 0.22) spawnPole();
  else if (r < 0.32) spawnPylon();
  else if (r < 0.42) spawnArch();
  else if (r < 0.54) spawnBillboard();
  else if (r < 0.68) spawnBuildings();
  else if (r < 0.8) spawnBush(side);
  else if (r < 0.9) spawnTree(side);
  else spawnFence(side);
}

function spawnNext() {
  const r = Math.random();
  if (r < 0.44) return spawnGate();
  if (r < 0.84) return spawnDodgePattern();
  if (r < 0.94) return spawnCoinLine();
  if (state.shield <= 0) return spawnBoardPickup();
  return spawnCoinLine();
}

function removeItem(item) {
  scene.remove(item.grp);
  item.grp.scale.setScalar(1);
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
  return !target.closest(".btn, .pause-btn, .panel, .overlay");
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

/* ---------------- Мобильное управление: только свайпы ---------------- */
const isTouch = TOUCH_DEVICE;
if (isTouch) document.body.classList.add("touch");

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
  if (state.mode !== "playing") return;
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
    // Кольцо на крыше вагона: считается пройденным только с крыши.
    if (item.roofGate && player.y < TRAIN_TOP_Y - 0.08) return;
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
      spawnSparkle(tmpVec, 0x7df0a8, 5);
      spawnScorePopup(tmpVec, "+" + gain, "float-text--ok");
    } else {
      state.wrong++;
      recordMistake(item);
      loseLife();
      item.grp.getWorldPosition(tmpVec);
      spawnPop(tmpVec, 0xff5470, 0.5);
    }
    markCollected(item, "ring");      // кольцо исчезает после прохода
    showRecent(item.question, item.ok);
    return;
  }

  const half = item.halfLen || 0.75;
  if (z < -half - 0.75 || z > half + 0.75) return;

  if (item.type === "coin") {
    if (item.resolved || !sameLane(item)) return;
    // Золото с крыши берётся, только когда игрок действительно на крыше.
    if (Math.abs(player.y + 0.95 - item.grp.position.y) > 1.15) return;
    item.resolved = true;
    state.coins++;
    state.score += 15;
    updateCoins(); updateScore();
    item.grp.getWorldPosition(tmpVec);
    spawnPop(tmpVec, 0xffe066);
    spawnSparkle(tmpVec, 0xffd977, 4);
    spawnScorePopup(tmpVec, "+15", "float-text--coin");
    markCollected(item, "pop");      // золотое кольцо исчезает
    return;
  }
  if (item.type === "board") {
    if (item.resolved || !sameLane(item)) return;
    item.resolved = true;
    state.shield = 8;
    board.visible = true;
    markCollected(item, "pop");
    return;
  }
  if (item.type === "train") {
    const top = item.topY || TRAIN_TOP_Y;
    // Столкновение, только если игрок не стоит на крыше: перепрыгнуть вагон нельзя.
    if (sameLane(item) && player.y < top - 0.06) { item.resolved = true; loseLife(); }
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
  state.effects.forEach((e) => { scene.remove(e.mesh); if (e.ownMat) e.mesh.material.dispose(); });
  state.effects = [];
  state.currentGateId = null;
  state.shownCardId = null;
  recentEl.hidden = true;
  hidePrompt();
}

function startGame() {
  resetWorld();
  state.mode = "playing";
  state.deck = buildSelectedDeck();
  state.deckPos = 0;
  state.currentSection = selectedSections[0];
  applyBiome(selectedSections[0]);
  const sp = SPEED_PRESETS[difficulty] || SPEED_PRESETS.normal;
  state.baseSpeed = sp.start;
  state.maxSpeed = sp.max;
  state.ramp = sp.ramp;
  state.gapScale = sp.gap;
  state.difficulty = sp.level;

  state.speed = state.baseSpeed;
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
  if (isTouch) showSwipeHint();
}

function gameOver() {
  state.mode = "gameover";
  pauseBtn.hidden = true;
  hud.hidden = true;
  questionBox.hidden = true;

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
    // Метка всегда читаемого размера: слегка растёт с расстоянием, но не мельчает.
    const scale = clamp(14 / Math.max(dist, 8), 0.72, 1.9);
    // Поднимаем над кольцом и разводим по высоте, чтобы формулы не слипались.
    y -= 54 * scale;
    y += (it.lane != null ? it.lane - 1 : 0) * 20 * scale;
    it.labelEl.style.display = "";
    it.labelEl.style.transform = "translate(-50%,-50%) translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + scale.toFixed(3) + ")";
    it.labelEl.style.opacity = String(clamp((zPos + lead) / 10, 0, 1));
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
  shadow.material.opacity = sh * (gfx.shadows ? 0.42 : 0.75);

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

  // Солнце и карта теней едут за игроком — резкие тени без «желе»
  sun.position.x = 46 + player.x * 0.25;
  sun.position.y = 24;
  dir.position.set(player.x + 9, 20, 11);
  dir.target.position.set(player.x * 0.5, 0, -6);
  dir.target.updateMatrixWorld();

  // Ощущение скорости: лёгкий рост FOV
  const targetFov = 60 + clamp((state.speed - state.baseSpeed) * 0.55, 0, 10);
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
  state.speed = Math.min(state.maxSpeed, state.speed + dt * state.ramp);

  // Прокрутка земли и параллакса далёкого города
  groundTex.offset.y = (groundTex.offset.y + move / TILE) % 1;
  groundBump.offset.y = groundTex.offset.y;
  updateSkyline(move);

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
    if (it.type === "coin" && !it.collecting && !it.onRoof) it.grp.position.y = 0.95 + Math.sin(state.time * 2 + it.grp.position.z * 0.4) * 0.12;
    if (it.halo) it.halo.scale.setScalar(2.0 + Math.sin(state.time * 4.5 + it.grp.position.z * 0.5) * 0.4);
    if (it.spin) it.spin.rotation.y += dt * 3.2;
    if (it.type === "choice" && it.grp.userData.ring) it.grp.userData.ring.rotation.z += dt * 0.8;
    if (it.type === "choice" && it.grp.userData.outer) it.grp.userData.outer.rotation.z -= dt * 1.6;

    collide(it);
    if (it.collecting) updateCollectAnim(it, dt);

    if (it.doomed || it.grp.position.z > DESPAWN_Z) {
      removeItem(it);
      state.items.splice(i, 1);
    }
  }

  // Эффекты: вспышка при сборе монеты
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const e = state.effects[i];
    e.t += dt;
    const k = e.t / e.dur;
    if (e.sprite) {
      e.mesh.position.x += (e.vx || 0) * dt;
      e.mesh.position.y += (e.vy || 0) * dt;
      e.mesh.position.z += (e.vz || 0) * dt;
      e.mesh.scale.setScalar((e.scale0 || (e.scale0 = e.mesh.scale.x)) * (1 + k * (e.grow || 0.4)));
      e.mesh.material.opacity = Math.max(0, 0.95 * (1 - k));
    } else {
      e.mesh.scale.setScalar(1 + k * (e.grow || 2.2));
      e.mesh.rotation.z += dt * 6;
      e.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    }
    if (k >= 1) {
      scene.remove(e.mesh);
      if (e.ownMat) e.mesh.material.dispose();
      state.effects.splice(i, 1);
    }
  }

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

/* ---------------- Пост-обработка: bloom + MSAA + цвет ---------------- */
let composer = null;
let bloomPass = null;
let composerReady = false;
let contextLost = false;

function applyRenderSize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }
}

renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  contextLost = true;
  gfx.bloom = false;
  gfx.shadows = false;
  dir.castShadow = false;
  renderer.shadowMap.enabled = false;
  if (composer) {
    try { composer.dispose(); } catch (e) { /* Контекст уже недоступен */ }
  }
  composer = null;
  bloomPass = null;
});

renderer.domElement.addEventListener("webglcontextrestored", () => {
  contextLost = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  applyRenderSize();
  applyBiome(state.currentSection || SECTION_ORDER[0]);
  state.lastTime = performance.now();
});

async function initComposer() {
  if (gfx.bloom) {
    try {
      const [ec, rp, bp, op] = await Promise.all([
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js")
      ]);
      if (contextLost || !gfx.bloom) return;
      const w = window.innerWidth, h = window.innerHeight;
      const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: gfx.msaa });
      composer = new ec.EffectComposer(renderer, target);
      composer.addPass(new rp.RenderPass(scene, camera));
      bloomPass = new bp.UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.44, 0.7, 0.8);
      composer.addPass(bloomPass);
      composer.addPass(new op.OutputPass());
      applyRenderSize();
    } catch (e) {
      composer = null;
      bloomPass = null;
      gfx.bloom = false;
    }
  }
  composerReady = true;
}
initComposer();

/* Авто-снижение качества, если кадры проседают (мобильные/слабые GPU). */
const perf = { acc: 0, frames: 0, step: 0, cool: 0 };
function trackPerf(dt) {
  perf.acc += dt;
  perf.frames++;
  if (perf.acc < 2) return;
  const fps = perf.frames / perf.acc;
  perf.acc = 0;
  perf.frames = 0;
  state.fps = fps;
  if (perf.cool > 0) { perf.cool--; return; }
  if (fps < 34 && perf.step === 0) {
    perf.step = 1;
    perf.cool = 2;
    if (bloomPass) bloomPass.enabled = false;          // первым уходит bloom
    else { renderer.setPixelRatio(Math.min(1, window.devicePixelRatio || 1)); applyRenderSize(); }
  } else if (fps < 24 && perf.step === 1) {
    perf.step = 2;
    perf.cool = 3;
    dir.castShadow = false;                            // затем тени
    renderer.shadowMap.enabled = false;
    gfx.shadows = false;
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
  if (contextLost) return;

  if (state.mode === "playing") {
    updatePlayer(dt);
    updateWorld(dt);
    updateDust(dt);

    // Пыль из-под ног тем сильнее, чем быстрее бег
    dustTimer -= dt;
    const speedK = clamp((state.speed - state.baseSpeed) / 10, 0, 1);
    if (dustTimer <= 0) {
      dustTimer = rand(0.05, 0.16);
      spawnSpeedDust();
    }
    const streak = clamp((state.speed - state.baseSpeed - 2) / 14, 0, 1);
    speedLinesEl.style.opacity = (streak * 0.42).toFixed(3);
    speedLinesEl.style.transform = "scale(" + (1 + streak * 0.12).toFixed(3) + ")";

    const sc = Math.floor(state.score);
    if (sc !== lastHudScore) { scoreEl.textContent = String(sc); lastHudScore = sc; }
    updateSpeedHud();
    if (!QUALITY_OVERRIDE) trackPerf(dt);
  } else {
    if (state.mode !== "paused") {
      // Лёгкое вращение камеры в меню.
      camera.position.x = Math.sin(now / 2600) * 0.6;
      camera.lookAt(0, 1.1, -8);
    }
    speedLinesEl.style.opacity = "0";
  }

  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    c.position.x += dt * 0.6;
    if (c.position.x > 95) c.position.x = -95;
  }

  updateLabels();
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

/* ---------------- Ресайз ---------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyRenderSize();
});

/* ---------------- Настройки меню ---------------- */
function questionCount() {
  if (!window.CARDS) return 0;
  let n = 0;
  window.CARDS.forEach((c) => { if (selectedSections.indexOf(c.s) !== -1) n++; });
  return n;
}
function updateMenuHint() {
  menuHint.textContent = "Разделов: " + selectedSections.length + " · карточек: " + questionCount() +
    " · скорость: " + (SPEED_LABELS[difficulty] || difficulty);
}
function renderSectionChips() {
  sectionChips.innerHTML = "";
  SECTION_ORDER.forEach((id) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (selectedSections.indexOf(id) !== -1 ? " is-active" : "");
    b.textContent = SECTION_TITLE[id] || id;
    b.addEventListener("click", () => {
      const i = selectedSections.indexOf(id);
      if (i === -1) selectedSections.push(id);
      else if (selectedSections.length > 1) selectedSections.splice(i, 1);
      save(LS_SECTIONS, selectedSections);
      renderSectionChips();
      updateMenuHint();
    });
    sectionChips.appendChild(b);
  });
}
function refreshSpeedChips() {
  speedChips.querySelectorAll(".chip").forEach((b) => {
    b.classList.toggle("is-active", b.getAttribute("data-speed") === difficulty);
  });
}
speedChips.querySelectorAll(".chip").forEach((b) => {
  b.addEventListener("click", () => {
    difficulty = b.getAttribute("data-speed");
    save(LS_SPEED, difficulty);
    refreshSpeedChips();
    updateMenuHint();
  });
});
renderSectionChips();
refreshSpeedChips();
updateMenuHint();

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
window.__runner = { state, player, startGame, updateWorld, updatePlayer, updateLabels, spawnNext, spawnScenery, spawnTrain, spawnGate, spawnDodgePattern, spawnCoinLine, spawnBoardPickup, camera, scene, renderer, gfx, get composer() { return composer; }, get bloomPass() { return bloomPass; }, QUALITY };
