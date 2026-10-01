import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("every statically referenced UI element exists in the HTML", async () => {
  const [html, game, menu] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("assets/js/game.js", root), "utf8"),
    readFile(new URL("assets/js/ui/menu.js", root), "utf8")
  ]);
  const htmlIds = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
  const referencedIds = new Set();

  for (const source of [game, menu]) {
    for (const match of source.matchAll(/(?:byId|getElementById)\("([^"]+)"\)/g)) {
      referencedIds.add(match[1]);
    }
  }

  assert.ok(referencedIds.size > 30);
  for (const id of referencedIds) assert.ok(htmlIds.has(id), `missing #${id} in index.html`);
});

test("the app is bootstrapped through one module entry", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /<script type="module" src="assets\/js\/game\.js"><\/script>/);
  assert.doesNotMatch(html, /assets\/js\/(?:data\/cards|questions)\.js/);
  assert.doesNotMatch(html, /(?:href|src)=["']\/(?!\/)/);
});

test("all local JavaScript module imports resolve to project files", async () => {
  const pending = ["assets/js/game.js"];
  const visited = new Set();

  while (pending.length) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(new URL(path, root), "utf8");
    const imports = Array.from(source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g), (match) => match[1]);

    for (const specifier of imports) {
      if (!specifier.startsWith(".")) continue;
      const importedPath = new URL(specifier, new URL(path, root));
      assert.equal(importedPath.pathname.startsWith(new URL(root).pathname), true);
      pending.push(importedPath.pathname.slice(new URL(root).pathname.length));
    }
  }

  assert.ok(visited.has("assets/js/quiz/questions.js"));
  assert.ok(visited.has("assets/js/input/controls.js"));
  assert.ok(visited.has("assets/js/ui/menu.js"));
});

test("the railway scene uses layered tracks and tree-only scenery", async () => {
  const game = await readFile(new URL("assets/js/game.js", root), "utf8");
  assert.match(game, /function createPalmTree/);
  assert.match(game, /new THREE\.InstancedMesh\(sleeperGeo/);
  assert.match(game, /function updateSleepers\(/);
  assert.doesNotMatch(game, /spawnBuildings|makeBuildingTexture|skylineGeo|skylineMat|unitIco/);
});

test("roadside shrubs use small varied foliage and instanced leaves", async () => {
  const game = await readFile(new URL("assets/js/game.js", root), "utf8");
  const spawnBush = game.match(/function spawnBush\([\s\S]*?\n\}/)?.[0] || "";
  assert.ok(spawnBush);
  assert.match(spawnBush, /new THREE\.InstancedMesh\(bushStemGeo/);
  assert.match(spawnBush, /new THREE\.InstancedMesh\(bushGeo, leafMats\[index\]/);
  assert.match(spawnBush, /const shrubCount = 3/);
  assert.match(game, /else if \(r < 0\.62\) spawnBush\(side\)/);
});

test("the runner model is a short-legged Pembroke corgi with a running rig", async () => {
  const game = await readFile(new URL("assets/js/game.js", root), "utf8");
  assert.match(game, /пемброк-корги/i);
  assert.match(game, /function makeLeg\(/);
  assert.match(game, /new THREE\.ConeGeometry\(0\.19, 0\.55, 5\)/);
  assert.match(game, /limbs\.tail\.rotation/);
});

test("the question remains the only large gameplay overlay", async () => {
  const [html, game, styles] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("assets/js/game.js", root), "utf8"),
    readFile(new URL("assets/css/style.css", root), "utf8")
  ]);

  assert.match(html, /id="questionBox"/);
  assert.doesNotMatch(html, /hud__recent/);
  assert.doesNotMatch(html, /зел[её]ный портал.*верный ответ/i);
  assert.match(game, /hud\.classList\.add\("hud--question"\)/);
  assert.doesNotMatch(game, /spawnScorePopup|spawnSparkle|showSwipeHint/);
  assert.doesNotMatch(styles, /hud__recent|float-text|swipe-hint/);
});

test("answer formulas are compact, capped, and vertically separated by lane", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("assets/js/game.js", root), "utf8"),
    readFile(new URL("assets/css/style.css", root), "utf8")
  ]);
  assert.match(game, /const scale = TOUCH_DEVICE \? 0\.9 : 1/);
  assert.match(game, /const rowGap = clamp\(h \* 0\.13, 74, 92\)/);
  assert.match(game, /function fitChoiceLabel\(/);
  assert.match(styles, /max-width: calc\(100vw - 24px\)/);
  assert.match(styles, /\.q-label__line \{ display: block/);
  assert.doesNotMatch(game, /clamp\(14 \/ Math\.max\(dist, 8\), 0\.72, 1\.9\)/);
});

test("answer correctness is evaluated only after choosing a gate", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("assets/js/game.js", root), "utf8"),
    readFile(new URL("assets/css/style.css", root), "utf8")
  ]);
  const spawnChoice = game.match(/function spawnChoice\([\s\S]*?\n\}/)?.[0] || "";

  assert.ok(spawnChoice);
  assert.match(spawnChoice, /question:\s*q/);
  assert.doesNotMatch(spawnChoice, /makePortal\(choice\.ok\)|choice\.ok\s*\?|q-label--correct|q-label--incorrect/);
  assert.match(styles, /\.q-label--correct/);
  assert.match(styles, /\.q-label--incorrect/);
  assert.match(game, /q: it\.question/);
  assert.match(game, /answer\.feedbackUntil = feedbackUntil/);
  assert.match(game, /answer\.ok \? "q-label--correct" : "q-label--incorrect"/);
  assert.match(game, /if \(ng && ng\.q && ng\.maxZ > -plead\)/);
  assert.match(game, /function makePortal\(\)/);
  assert.match(game, /if \(item\.ok\) \{/);
});
