export function load(key, fallback, storage) {
  try {
    const target = storage || globalThis.localStorage;
    const value = target && target.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value, storage) {
  try {
    const target = storage || globalThis.localStorage;
    if (target) target.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}
