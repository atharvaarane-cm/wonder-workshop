// localStorage-backed persistence for v2's single-project state. Saves
// the entire reducer state on every change (debounced). Restores on
// mount so refresh doesn't destroy the brief + generated images.
//
// Multi-project list + IndexedDB blob storage come in a follow-up.
// For tonight, single-project + image URLs is enough for the demo
// not to evaporate on accidental refresh.

const STORAGE_KEY = "ww_v2_state";

// Test whether localStorage is even usable (Safari private mode +
// disabled-cookies-style settings can throw on any write). Cached so
// we don't keep checking.
let storageOk = null;
function storageAvailable() {
  if (storageOk !== null) return storageOk;
  try {
    const k = "__ww_storage_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}

// data: URLs (base64-encoded images uploaded by the user) blow past the
// 5MB localStorage cap fast. Strip them when we hit QuotaExceededError
// so at least the structural brief + Gemini-hosted images persist.
function isDataUrl(s) {
  return typeof s === "string" && s.startsWith("data:");
}

function stripBigImages(data) {
  return {
    ...data,
    talent: (data.talent || []).map(t => ({
      ...t,
      headshot: isDataUrl(t.headshot) ? null : t.headshot,
    })),
    products: (data.products || []).map(p => ({
      ...p,
      referenceImage: isDataUrl(p.referenceImage) ? null : p.referenceImage,
    })),
    locations: (data.locations || []).map(l => ({
      ...l,
      generatedImage: isDataUrl(l.generatedImage) ? null : l.generatedImage,
      referenceImage: isDataUrl(l.referenceImage) ? null : l.referenceImage,
    })),
    frames: (data.frames || []).map(f => ({
      ...f,
      uploadedImage: isDataUrl(f.uploadedImage) ? null : f.uploadedImage,
    })),
    moodBoard: (data.moodBoard || []).map(m => ({
      ...m,
      image: isDataUrl(m.image) ? null : m.image,
    })),
    brand: data.brand ? {
      ...data.brand,
      logo: isDataUrl(data.brand.logo) ? null : data.brand.logo,
    } : data.brand,
  };
}

export function saveState(data) {
  if (!storageAvailable()) return false;
  if (!data) return false;
  try {
    const payload = JSON.stringify({ data, savedAt: Date.now(), version: 1 });
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (e) {
    if (e?.name === "QuotaExceededError" || /quota/i.test(String(e?.message))) {
      // Retry without data: URLs (user uploads). Gemini-hosted URLs
      // are short strings and survive easily.
      try {
        const stripped = stripBigImages(data);
        const payload = JSON.stringify({
          data: stripped,
          savedAt: Date.now(),
          stripped: true,
          version: 1,
        });
        localStorage.setItem(STORAGE_KEY, payload);
        console.warn("[persistence] saved without data: URLs (quota)");
        return true;
      } catch (e2) {
        console.error("[persistence] save failed even after stripping", e2);
        return false;
      }
    }
    console.error("[persistence] save failed", e);
    return false;
  }
}

export function loadState() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return parsed.data;
  } catch (e) {
    console.warn("[persistence] load failed", e);
    return null;
  }
}

export function clearState() {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
