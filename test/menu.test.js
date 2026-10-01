import test from "node:test";
import assert from "node:assert/strict";
import { mountSettingsMenu } from "../assets/js/ui/menu.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.classes = new Set();
    this.classList = {
      toggle: (name, force) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
      },
      contains: (name) => this.classes.has(name)
    };
  }

  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return Array.from(this.classes).join(" "); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] || null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren() { this.children = []; }
  querySelectorAll() { return this.children; }
  click() { this.listeners.click?.(); }
}

test("settings menu preserves one section and saves selections and speed", () => {
  const originalDocument = globalThis.document;
  const originalStorage = globalThis.localStorage;
  const elements = new Map();
  for (const id of ["sectionChips", "speedChips", "menuHint"]) elements.set(id, new FakeElement());
  for (const speed of ["slow", "normal", "fast"]) {
    const button = new FakeElement();
    button.setAttribute("data-speed", speed);
    button.className = speed === "normal" ? "chip is-active" : "chip";
    elements.get("speedChips").appendChild(button);
  }
  const values = new Map();
  globalThis.document = {
    getElementById: (id) => elements.get(id),
    createElement: () => new FakeElement()
  };
  globalThis.localStorage = {
    setItem: (key, value) => values.set(key, value)
  };

  try {
    const settings = { sections: ["kin"], difficulty: "normal" };
    mountSettingsMenu({
      settings,
      sectionOrder: ["kin", "dyn"],
      sectionTitle: { kin: "Кинематика", dyn: "Динамика" },
      cards: [{ s: "kin" }, { s: "dyn" }, { s: "dyn" }],
      speedLabels: { slow: "спокойно", normal: "обычно", fast: "быстро" }
    });

    const getSectionButton = (title) => elements.get("sectionChips").children.find((button) => button.textContent === title);
    getSectionButton("Кинематика").click();
    assert.deepEqual(settings.sections, ["kin"]);
    getSectionButton("Динамика").click();
    assert.deepEqual(settings.sections, ["kin", "dyn"]);
    getSectionButton("Кинематика").click();
    assert.deepEqual(settings.sections, ["dyn"]);
    assert.deepEqual(JSON.parse(values.get("phys-runner-sections-v1")), ["dyn"]);

    elements.get("speedChips").children.find((button) => button.getAttribute("data-speed") === "fast").click();
    assert.equal(settings.difficulty, "fast");
    assert.equal(JSON.parse(values.get("phys-runner-speed-v1")), "fast");
    assert.ok(elements.get("speedChips").children.find((button) => button.getAttribute("data-speed") === "fast").classList.contains("is-active"));
    assert.match(elements.get("menuHint").textContent, /карточек: 2/);
  } finally {
    globalThis.document = originalDocument;
    globalThis.localStorage = originalStorage;
  }
});
