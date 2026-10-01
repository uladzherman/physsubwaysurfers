import test from "node:test";
import assert from "node:assert/strict";
import { loadSettings, SPEED_PRESETS } from "../assets/js/core/settings.js";
import { load, save } from "../assets/js/core/storage.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test("settings restore valid sections and speed", () => {
  const storage = memoryStorage({
    "phys-runner-sections-v1": JSON.stringify(["dyn", "invalid"]),
    "phys-runner-speed-v1": JSON.stringify("fast")
  });

  assert.deepEqual(loadSettings(["kin", "dyn"], storage), { sections: ["dyn"], difficulty: "fast" });
  assert.ok(SPEED_PRESETS.fast.max > SPEED_PRESETS.slow.max);
});

test("invalid persisted settings safely fall back to defaults", () => {
  const storage = memoryStorage({
    "phys-runner-sections-v1": JSON.stringify({ bad: true }),
    "phys-runner-speed-v1": JSON.stringify("impossible")
  });

  assert.deepEqual(loadSettings(["kin", "dyn"], storage), { sections: ["kin", "dyn"], difficulty: "normal" });
});

test("storage handles malformed values and unavailable storage", () => {
  const storage = memoryStorage({ value: "not json" });
  assert.equal(load("value", 42, storage), 42);
  assert.equal(load("missing", 42, storage), 42);
  assert.doesNotThrow(() => save("key", 1, { setItem() { throw new Error("blocked"); } }));
});
