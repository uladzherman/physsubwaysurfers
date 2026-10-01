import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { graphicsProfile } from "../assets/js/core/quality.js";

test("mobile graphics stay within the lightweight profile even when high is requested", () => {
  const mobileHigh = graphicsProfile("high", true);
  const mobileLow = graphicsProfile("low", true);
  const desktopHigh = graphicsProfile("high", false);

  assert.equal(mobileHigh.shadows, false);
  assert.equal(mobileHigh.bloom, false);
  assert.equal(mobileHigh.msaa, 0);
  assert.equal(mobileHigh.maxPixelRatio, 1.35);
  assert.equal(mobileHigh.dustCount, 10);
  assert.equal(mobileLow.maxPixelRatio, 1.1);
  assert.equal(desktopHigh.shadows, true);
  assert.equal(desktopHigh.bloom, true);
  assert.equal(desktopHigh.msaa, 2);
});

test("local GLB files are compact, valid containers with the expected rigs", async () => {
  for (const [file, expectedNodes] of [
    ["pembroke-corgi.glb", ["pembroke-corgi", "head", "front-left-leg", "hind-right-leg", "tail"]],
    ["tropical-palm.glb", ["palm", "Tapered palm trunk", "Palm frond 0"]]
  ]) {
    const binary = await readFile(new URL("../assets/models/" + file, import.meta.url));
    assert.ok(binary.length < 100_000, `${file} should stay lightweight`);
    assert.equal(binary.readUInt32LE(0), 0x46546c67, `${file} magic`);
    assert.equal(binary.readUInt32LE(4), 2, `${file} version`);
    assert.equal(binary.readUInt32LE(8), binary.length, `${file} declared size`);

    const jsonLength = binary.readUInt32LE(12);
    assert.equal(binary.readUInt32LE(16), 0x4e4f534a, `${file} JSON chunk`);
    const gltf = JSON.parse(binary.toString("utf8", 20, 20 + jsonLength));
    const binHeaderOffset = 20 + jsonLength;
    const binChunkLength = binary.readUInt32LE(binHeaderOffset);
    assert.equal(binary.readUInt32LE(binHeaderOffset + 4), 0x004e4942, `${file} BIN chunk`);
    assert.ok(gltf.bufferViews.every((view) => view.byteOffset + view.byteLength <= gltf.buffers[0].byteLength));
    assert.ok(gltf.buffers[0].byteLength <= binChunkLength);
    for (const node of gltf.nodes) {
      if (!node.rotation) continue;
      assert.equal(node.rotation.length, 4, `${file} ${node.name} quaternion length`);
      assert.ok(Math.abs(Math.hypot(...node.rotation) - 1) < 0.0001, `${file} ${node.name} quaternion is normalized`);
    }
    const names = new Set(gltf.nodes.map((node) => node.name));
    for (const name of expectedNodes) assert.ok(names.has(name), `${file} missing ${name}`);
  }
});

test("model loading uses GitHub Pages-safe paths and retains procedural fallbacks", async () => {
  const game = await readFile(new URL("../assets/js/game.js", import.meta.url), "utf8");
  assert.match(game, /new URL\("\.\.\/models\/pembroke-corgi\.glb", import\.meta\.url\)/);
  assert.match(game, /new URL\("\.\.\/models\/tropical-palm\.glb", import\.meta\.url\)/);
  assert.match(game, /buildProceduralPlayer\(\)/);
  assert.match(game, /buildProceduralPalmTree\(\)/);
  assert.match(game, /Promise\.allSettled/);

  const gamePageUrl = new URL("https://example.github.io/physics-runner/assets/js/game.js");
  assert.equal(new URL("../models/pembroke-corgi.glb", gamePageUrl).pathname, "/physics-runner/assets/models/pembroke-corgi.glb");
  assert.equal(new URL("../models/tropical-palm.glb", gamePageUrl).pathname, "/physics-runner/assets/models/tropical-palm.glb");
});
