import { load } from "./storage.js";

export const SETTINGS_KEYS = {
  sections: "phys-runner-sections-v1",
  speed: "phys-runner-speed-v1"
};

export const SPEED_PRESETS = {
  slow: { start: 12, max: 24, ramp: 0.22, gap: 1.28, level: 0 },
  normal: { start: 17, max: 36, ramp: 0.42, gap: 1, level: 1 },
  fast: { start: 25, max: 52, ramp: 0.66, gap: 0.82, level: 2 }
};

export const SPEED_LABELS = { slow: "спокойно", normal: "обычно", fast: "быстро" };

export function loadSettings(sectionOrder, storage) {
  const availableSections = new Set(sectionOrder);
  const savedSections = load(SETTINGS_KEYS.sections, sectionOrder.slice(), storage);
  const sections = Array.isArray(savedSections)
    ? savedSections.filter((id) => availableSections.has(id))
    : [];
  const speed = load(SETTINGS_KEYS.speed, "normal", storage);

  return {
    sections: sections.length ? sections : sectionOrder.slice(),
    difficulty: SPEED_PRESETS[speed] ? speed : "normal"
  };
}
