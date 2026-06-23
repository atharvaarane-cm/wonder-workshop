// 3-way merge of project data, used by cloud persistence when a save hits a
// concurrent-edit conflict (someone else saved since we loaded). The whole-blob
// last-write-wins upsert silently clobbered the other person's work; this merges
// instead so two people editing DIFFERENT items/sections both keep their changes.
//
//   base   = the project as it was when this client last synced (common ancestor)
//   mine   = local current state (what I'm trying to save)
//   theirs = current server state (what landed since)
//
// Conservative rules (never lose data on doubt):
//   • top-level fields (meta/brand/locks/…): if I changed it from base, mine wins;
//     else keep theirs.
//   • id-keyed arrays (talent/products/locations/frames/moodBoard): merge per item:
//       - changed on one side only → that side
//       - changed on both → mine (rare true conflict)
//       - added on either side → keep it
//       - deleted on one side, edited on the other → keep the EDIT (edit beats delete)
//       - deleted on one side, untouched on the other → honor the delete
//   • versionHistory (object keyed by slot): union of keys; mine wins per key.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ID_ARRAYS = ["talent", "products", "locations", "frames", "moodBoard"];
const FIELD_KEYS = ["schemaVersion", "meta", "brand", "locks", "chatHistory"];

function mergeListById(base = [], mine = [], theirs = []) {
  const byId = (arr) => new Map((Array.isArray(arr) ? arr : []).filter(x => x && x.id != null).map(x => [x.id, x]));
  const b = byId(base), m = byId(mine), t = byId(theirs);
  const merged = new Map(); // id -> item

  for (const id of new Set([...m.keys(), ...t.keys()])) {
    const inB = b.has(id), inM = m.has(id), inT = t.has(id);
    const bv = b.get(id), mv = m.get(id), tv = t.get(id);

    if (inM && inT) {
      const meChanged = !inB || !same(mv, bv);
      const themChanged = !inB || !same(tv, bv);
      // both changed → mine; one side → that side; neither → same value
      merged.set(id, meChanged ? mv : (themChanged ? tv : mv));
    } else if (inM && !inT) {
      // gone from theirs: I added it (never in base) → keep; else they deleted it →
      // keep only if I edited it (edit beats delete)
      if (!inB || !same(mv, bv)) merged.set(id, mv);
    } else if (!inM && inT) {
      // gone from mine: they added it → keep; else I deleted it → keep only if they edited
      if (!inB || !same(tv, bv)) merged.set(id, tv);
    }
    // gone from both → drop
  }

  // Order: mine's order first, then any theirs-only items appended.
  const order = [];
  const seen = new Set();
  for (const x of (Array.isArray(mine) ? mine : [])) if (x && merged.has(x.id) && !seen.has(x.id)) { order.push(x.id); seen.add(x.id); }
  for (const x of (Array.isArray(theirs) ? theirs : [])) if (x && merged.has(x.id) && !seen.has(x.id)) { order.push(x.id); seen.add(x.id); }
  return order.map(id => merged.get(id));
}

function mergeVersionHistory(base = {}, mine = {}, theirs = {}) {
  const out = { ...(theirs || {}) };
  for (const k of Object.keys(mine || {})) {
    const changedByMe = !same(mine[k], (base || {})[k]);
    if (changedByMe || !(k in out)) out[k] = mine[k];
  }
  return out;
}

export function mergeProjectData(base, mine, theirs) {
  if (!theirs || typeof theirs !== "object") return mine;
  if (!mine || typeof mine !== "object") return theirs;
  const b = base && typeof base === "object" ? base : {};
  const out = { ...theirs };

  for (const k of FIELD_KEYS) {
    const changedByMe = !same(mine[k], b[k]);
    out[k] = changedByMe ? mine[k] : (k in theirs ? theirs[k] : mine[k]);
  }
  for (const k of ID_ARRAYS) {
    out[k] = mergeListById(b[k], mine[k], theirs[k]);
  }
  out.versionHistory = mergeVersionHistory(b.versionHistory, mine.versionHistory, theirs.versionHistory);

  return out;
}
