// Build the ordered list of image "slots" a generation job must produce, from
// the project data. The ORDER is the worker's generation order, chosen so refs
// exist when needed and the storyboard appears fast:
//   1. talent primaries        (frames + the extra angles reference these)
//   2. locations + products    (frames reference these)
//   3. frames                  (the storyboard — generated before the rest)
//   4. extra talent angles + full-body + mood  (NOT referenced by frames → last)
//
// Each slot: { key, kind, assetId, view?, caption?, status:'pending' }.
// Asset ids are the project's (now-UUID) ids, so the worker resolves each asset
// out of the project data by id.

const HEAD_VIEWS_EXTRA = ["side", "threeQuarter", "back"]; // "front" = the primary
const FULLBODY_VIEWS = ["front", "side", "threeQuarter", "back"];

export function buildSlots(data) {
  const slots = [];
  const talent = data?.talent || [];

  for (const t of talent) {
    slots.push({ key: `t:${t.id}:primary`, kind: "talent_primary", assetId: t.id, status: "pending" });
  }
  for (const l of (data?.locations || [])) {
    slots.push({ key: `l:${l.id}`, kind: "location", assetId: l.id, status: "pending" });
  }
  for (const p of (data?.products || [])) {
    slots.push({ key: `p:${p.id}`, kind: "product", assetId: p.id, status: "pending" });
  }
  for (const f of (data?.frames || [])) {
    slots.push({ key: `f:${f.id}`, kind: "frame", assetId: f.id, status: "pending" });
  }
  for (const t of talent) {
    for (const v of HEAD_VIEWS_EXTRA) slots.push({ key: `t:${t.id}:hs:${v}`, kind: "talent_headshot", assetId: t.id, view: v, status: "pending" });
    for (const v of FULLBODY_VIEWS) slots.push({ key: `t:${t.id}:fb:${v}`, kind: "talent_fullbody", assetId: t.id, view: v, status: "pending" });
  }
  for (const m of (data?.moodBoard || [])) {
    slots.push({ key: `m:${m.id}`, kind: "mood", assetId: m.id, caption: m.caption || "", status: "pending" });
  }
  return slots;
}
