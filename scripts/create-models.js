import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(rootDir, "assets/models");

function normalized(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function quaternionFromEuler([x, y, z]) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 - c1 * s2 * s3,
    c1 * s2 * c3 + s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3
  ];
}

function normalizeTransform(transform) {
  const nodeTransform = { ...transform };
  if (nodeTransform.rotation?.length === 3) nodeTransform.rotation = quaternionFromEuler(nodeTransform.rotation);
  return nodeTransform;
}

function triangle(geometry, a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = normalized(
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  );
  const base = geometry.positions.length / 3;
  for (const vertex of [a, b, c]) {
    geometry.positions.push(...vertex);
    geometry.normals.push(...normal);
  }
  geometry.indices.push(base, base + 1, base + 2);
}

function sphereGeometry(segments = 14, rings = 10) {
  const geometry = { positions: [], normals: [], indices: [] };
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const point = [Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi)];
      geometry.positions.push(...point);
      geometry.normals.push(...point);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      geometry.indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return geometry;
}

function boxGeometry() {
  const geometry = { positions: [], normals: [], indices: [] };
  const faces = [
    [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]],
    [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]],
    [[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5]],
    [[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5]],
    [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]],
    [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5]]
  ];
  for (const face of faces) {
    const start = geometry.positions.length / 3;
    const normal = normalized(...face[0].map((_, i) => {
      const ab = face[1].map((v, j) => v - face[0][j]);
      const ac = face[2].map((v, j) => v - face[0][j]);
      return i === 0 ? ab[1] * ac[2] - ab[2] * ac[1] : i === 1 ? ab[2] * ac[0] - ab[0] * ac[2] : ab[0] * ac[1] - ab[1] * ac[0];
    }));
    for (const vertex of face) {
      geometry.positions.push(...vertex);
      geometry.normals.push(...normal);
    }
    geometry.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return geometry;
}

function cylinderGeometry(radialSegments = 10, topRadius = 1, bottomRadius = 1) {
  const geometry = { positions: [], normals: [], indices: [] };
  const top = [], bottom = [];
  for (let i = 0; i < radialSegments; i++) {
    const angle = i / radialSegments * Math.PI * 2;
    const x = Math.cos(angle), z = Math.sin(angle);
    top.push([x * topRadius, 0.5, z * topRadius]);
    bottom.push([x * bottomRadius, -0.5, z * bottomRadius]);
  }
  for (let i = 0; i < radialSegments; i++) {
    const next = (i + 1) % radialSegments;
    triangle(geometry, bottom[i], bottom[next], top[i]);
    triangle(geometry, top[i], bottom[next], top[next]);
    triangle(geometry, [0, 0.5, 0], top[i], top[next]);
    triangle(geometry, [0, -0.5, 0], bottom[next], bottom[i]);
  }
  return geometry;
}

function coneGeometry(radialSegments = 8) {
  const geometry = { positions: [], normals: [], indices: [] };
  const base = [];
  for (let i = 0; i < radialSegments; i++) {
    const angle = i / radialSegments * Math.PI * 2;
    base.push([Math.cos(angle) * 0.5, -0.5, Math.sin(angle) * 0.5]);
  }
  for (let i = 0; i < radialSegments; i++) {
    const next = (i + 1) % radialSegments;
    triangle(geometry, base[i], base[next], [0, 0.5, 0]);
    triangle(geometry, [0, -0.5, 0], base[next], base[i]);
  }
  return geometry;
}

function frondGeometry() {
  const geometry = { positions: [], normals: [], indices: [] };
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const width = (0.08 + Math.pow(Math.sin(Math.PI * t), 0.7) * 0.92) * 0.32;
    geometry.positions.push(t * 2.6 - 1.3, -width, 0, t * 2.6 - 1.3, width, 0);
    geometry.normals.push(0, 0, 1, 0, 0, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    geometry.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  return geometry;
}

function torusGeometry(majorSegments = 20, tubeSegments = 6) {
  const geometry = { positions: [], normals: [], indices: [] };
  for (let i = 0; i <= majorSegments; i++) {
    const u = i / majorSegments * Math.PI * 2;
    for (let j = 0; j <= tubeSegments; j++) {
      const v = j / tubeSegments * Math.PI * 2;
      const r = 0.31 + Math.cos(v) * 0.045;
      geometry.positions.push(Math.cos(u) * r, Math.sin(v) * 0.045, Math.sin(u) * r);
      geometry.normals.push(Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v));
    }
  }
  for (let i = 0; i < majorSegments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const a = i * (tubeSegments + 1) + j;
      const b = a + tubeSegments + 1;
      geometry.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return geometry;
}

function createGltfBuilder(modelName) {
  const geometries = new Map();
  const meshes = [], nodes = [], materials = [], bufferViews = [], accessors = [];
  const chunks = [];
  let byteLength = 0;

  function addBytes(buffer, target) {
    const padding = (4 - byteLength % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding; }
    const bufferView = { buffer: 0, byteOffset: byteLength, byteLength: buffer.length };
    if (target) bufferView.target = target;
    const index = bufferViews.push(bufferView) - 1;
    chunks.push(buffer);
    byteLength += buffer.length;
    return index;
  }

  function addFloatAccessor(values, type, count, target, min, max) {
    const buffer = Buffer.alloc(values.length * 4);
    values.forEach((value, i) => buffer.writeFloatLE(value, i * 4));
    const bufferView = addBytes(buffer, target);
    const accessor = { bufferView, componentType: 5126, count, type };
    if (min) accessor.min = min;
    if (max) accessor.max = max;
    return accessors.push(accessor) - 1;
  }

  function addIndexAccessor(indices) {
    const buffer = Buffer.alloc(indices.length * 2);
    indices.forEach((value, i) => buffer.writeUInt16LE(value, i * 2));
    const bufferView = addBytes(buffer, 34963);
    return accessors.push({ bufferView, componentType: 5123, count: indices.length, type: "SCALAR" }) - 1;
  }

  function addMaterial(name, color, roughness = 0.82, metallic = 0) {
    const index = materials.length;
    materials.push({
      name,
      pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: metallic, roughnessFactor: roughness },
      doubleSided: true
    });
    return index;
  }

  function addMesh(parent, name, geometry, material, transform = {}) {
    let attributes = geometries.get(geometry);
    if (!attributes) {
      const positions = geometry.positions;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], positions[i + axis]);
          max[axis] = Math.max(max[axis], positions[i + axis]);
        }
      }
      attributes = {
        POSITION: addFloatAccessor(positions, "VEC3", positions.length / 3, 34962, min, max),
        NORMAL: addFloatAccessor(geometry.normals, "VEC3", geometry.normals.length / 3, 34962),
        indices: addIndexAccessor(geometry.indices)
      };
      geometries.set(geometry, attributes);
    }
    const mesh = meshes.length;
    meshes.push({ name, primitives: [{ attributes: { POSITION: attributes.POSITION, NORMAL: attributes.NORMAL }, indices: attributes.indices, material, mode: 4 }] });
    const node = { name, mesh, ...normalizeTransform(transform) };
    const index = nodes.push(node) - 1;
    nodes[parent].children.push(index);
    return index;
  }

  function addGroup(parent, name, transform = {}) {
    const index = nodes.push({ name, children: [], ...normalizeTransform(transform) }) - 1;
    if (parent == null) roots.push(index);
    else nodes[parent].children.push(index);
    return index;
  }

  const roots = [];

  function finish() {
    const binary = Buffer.concat(chunks, byteLength);
    const document = {
      asset: { version: "2.0", generator: "Formula Runner low-poly model generator" },
      scene: 0,
      scenes: [{ name: modelName, nodes: roots }],
      nodes,
      meshes,
      materials,
      accessors,
      bufferViews,
      buffers: [{ byteLength: binary.length }]
    };
    let json = Buffer.from(JSON.stringify(document));
    const jsonPadding = (4 - json.length % 4) % 4;
    if (jsonPadding) json = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
    const binPadding = (4 - binary.length % 4) % 4;
    const paddedBinary = binPadding ? Buffer.concat([binary, Buffer.alloc(binPadding)]) : binary;
    const totalLength = 12 + 8 + json.length + 8 + paddedBinary.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);
    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(json.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(paddedBinary.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jsonHeader, json, binHeader, paddedBinary]);
  }

  return { addGroup, addMesh, addMaterial, finish, modelName };
}

function buildCorgi() {
  const gltf = createGltfBuilder("Pembroke Corgi");
  const root = gltf.addGroup(null, "pembroke-corgi");
  const red = gltf.addMaterial("Pembroke red", [0.72, 0.25, 0.08]);
  const tan = gltf.addMaterial("Warm coat", [0.82, 0.39, 0.15]);
  const white = gltf.addMaterial("Cream markings", [0.94, 0.88, 0.76]);
  const black = gltf.addMaterial("Nose and eyes", [0.055, 0.035, 0.03], 0.3);
  const pink = gltf.addMaterial("Inner ears", [0.6, 0.24, 0.23]);
  const teal = gltf.addMaterial("Harness", [0.04, 0.38, 0.34]);
  const gold = gltf.addMaterial("Tag", [0.92, 0.62, 0.13], 0.26, 0.55);
  const ball = sphereGeometry(16, 12);
  const smallBall = sphereGeometry(10, 8);
  const box = boxGeometry();
  const cone = coneGeometry(5);
  const legGeo = sphereGeometry(10, 8);
  const torus = torusGeometry();

  gltf.addMesh(root, "Long low body", ball, red, { translation: [0, 0.66, 0.04], scale: [0.52, 0.43, 0.78] });
  gltf.addMesh(root, "Back fur", ball, tan, { translation: [0, 0.98, 0.17], scale: [0.4, 0.1, 0.5] });
  gltf.addMesh(root, "White chest", ball, white, { translation: [0, 0.69, -0.54], scale: [0.28, 0.34, 0.16] });
  gltf.addMesh(root, "Neck", ball, tan, { translation: [0, 0.91, -0.53], scale: [0.29, 0.28, 0.27] });

  const head = gltf.addGroup(root, "head", { translation: [0, 1.02, -0.72] });
  gltf.addMesh(head, "Head", ball, tan, { scale: [0.37, 0.33, 0.37] });
  gltf.addMesh(head, "White blaze", ball, white, { translation: [0, -0.01, -0.32], scale: [0.055, 0.16, 0.045] });
  gltf.addMesh(head, "Muzzle", ball, white, { translation: [0, -0.14, -0.37], scale: [0.23, 0.16, 0.27] });
  gltf.addMesh(head, "Nose", smallBall, black, { translation: [0, -0.1, -0.61], scale: [0.11, 0.07, 0.07] });
  const earGeo = coneGeometry(5);
  const innerEarGeo = coneGeometry(3);
  for (const side of [-1, 1]) {
    gltf.addMesh(head, "Eye " + side, smallBall, black, { translation: [side * 0.17, 0.08, -0.31], scale: [0.05, 0.055, 0.035] });
    gltf.addMesh(head, "Upright ear " + side, earGeo, red, { translation: [side * 0.25, 0.38, -0.02], rotation: [0, 0, -side * 0.1], scale: [0.38, 0.6, 0.22] });
    gltf.addMesh(head, "Ear detail " + side, innerEarGeo, pink, { translation: [side * 0.25, 0.37, -0.13], rotation: [0, 0, -side * 0.1], scale: [0.23, 0.37, 0.09] });
  }

  gltf.addMesh(root, "Collar", torus, teal, { translation: [0, 0.92, -0.4] });
  gltf.addMesh(root, "Golden tag", smallBall, gold, { translation: [0, 0.79, -0.72], scale: [0.06, 0.1, 0.035] });
  gltf.addMesh(root, "Harness", torus, teal, { translation: [0, 0.69, 0.36], scale: [1.35, 1.05, 1.1] });
  gltf.addMesh(root, "Backpack", box, teal, { translation: [0, 0.94, 0.71], scale: [0.46, 0.4, 0.26] });
  gltf.addMesh(root, "Pack flap", box, tan, { translation: [0, 1.16, 0.85], scale: [0.4, 0.08, 0.04] });

  for (const [name, x, z] of [
    ["hind-left-leg", -0.3, 0.48], ["hind-right-leg", 0.3, 0.48],
    ["front-left-leg", -0.3, -0.49], ["front-right-leg", 0.3, -0.49]
  ]) {
    const leg = gltf.addGroup(root, name, { translation: [x, 0.29, z] });
    gltf.addMesh(leg, name + " fur", legGeo, red, { translation: [0, -0.06, 0], scale: [0.115, 0.21, 0.12] });
    gltf.addMesh(leg, name + " paw", smallBall, white, { translation: [0, -0.23, -0.025], scale: [0.13, 0.08, 0.16] });
  }
  const tail = gltf.addGroup(root, "tail", { translation: [0, 0.77, 0.82] });
  gltf.addMesh(tail, "Short white tail", smallBall, white, { scale: [0.11, 0.1, 0.16] });
  return gltf.finish();
}

function buildPalm() {
  const gltf = createGltfBuilder("Tropical palm");
  const root = gltf.addGroup(null, "palm");
  const bark = gltf.addMaterial("Warm palm bark", [0.39, 0.23, 0.12]);
  const band = gltf.addMaterial("Bark rings", [0.62, 0.43, 0.24]);
  const greens = [
    gltf.addMaterial("Palm green", [0.18, 0.49, 0.19]),
    gltf.addMaterial("Sunlit palm green", [0.29, 0.62, 0.23]),
    gltf.addMaterial("Deep palm green", [0.1, 0.35, 0.14])
  ];
  const cylinder = cylinderGeometry(12, 0.82, 1, 0.78);
  const frond = frondGeometry();
  const torus = torusGeometry(18, 5);
  gltf.addMesh(root, "Tapered palm trunk", cylinder, bark, { translation: [0, 3.65, 0], scale: [0.34, 7.3, 0.34] });
  for (let i = 1; i <= 6; i++) {
    gltf.addMesh(root, "Trunk ring " + i, torus, band, { translation: [0, i * 1.03, 0] });
  }
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI * 2 / 10;
    gltf.addMesh(root, "Palm frond " + i, frond, greens[i % greens.length], {
      translation: [Math.cos(angle) * 1.15, 7.35, Math.sin(angle) * 1.15],
      rotation: [0, -angle, -0.32]
    });
  }
  gltf.addMesh(root, "Crown", sphereGeometry(10, 8), greens[1], { translation: [0, 7.35, 0], scale: [0.28, 0.28, 0.28] });
  return gltf.finish();
}

await mkdir(outputDir, { recursive: true });
for (const [name, model] of [["pembroke-corgi.glb", buildCorgi()], ["tropical-palm.glb", buildPalm()]]) {
  const binary = model;
  await writeFile(resolve(outputDir, name), binary);
  console.log(`${name}: ${binary.byteLength} bytes`);
}
