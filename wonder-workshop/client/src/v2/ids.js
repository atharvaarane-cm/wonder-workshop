// Opaque, globally-unique ids for assets/frames.
//
// WHY: collection-local sequential ids (t1/p1/l1, computed via
// parseInt(id.slice(1))+1) are unique only within one project's one collection.
// In the flat shared cloud workspace, rows from different projects collide on
// `t1`, and the slice/parseInt scheme breaks the moment a Postgres UUID is the
// key. New assets get a UUID instead. A short type prefix is kept ONLY for
// debuggability — nothing parses the id format anymore, so existing t1/p1 ids
// keep working as opaque strings (no data migration needed).
export function uid(prefix = "a") {
  const rnd =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${rnd}`;
}

// Current persisted-data schema version, stamped on new/saved projects so future
// migrations have a discriminator. Legacy projects have it `undefined` (= pre-v2,
// collection-local ids), which is itself the signal that they predate this change.
export const SCHEMA_VERSION = 2;
