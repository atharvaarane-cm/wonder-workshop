// Test setup: a minimal, deterministic in-memory localStorage.
// jsdom's Storage is unreliable under an opaque origin (it isn't exposed as a
// global), so we provide our own — the persistence layer only needs the standard
// getItem/setItem/removeItem/clear/key/length surface.
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.has(String(k)) ? this.store.get(String(k)) : null;
  }
  setItem(k, v) {
    this.store.set(String(k), String(v));
  }
  removeItem(k) {
    this.store.delete(String(k));
  }
  clear() {
    this.store.clear();
  }
  key(i) {
    return [...this.store.keys()][i] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

globalThis.localStorage = new MemoryStorage();
