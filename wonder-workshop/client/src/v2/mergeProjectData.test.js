import { describe, it, expect } from "vitest";
import { mergeProjectData } from "./mergeProjectData.js";

// Helpers to build minimal project shapes.
const frame = (id, brief) => ({ id, number: "01", brief, talentIds: [], productIds: [], locationId: null });
const proj = (over = {}) => ({ schemaVersion: 2, meta: { title: "P", treatment: "t" }, talent: [], products: [], locations: [], frames: [], moodBoard: [], brand: {}, locks: {}, versionHistory: {}, ...over });

describe("mergeProjectData — top-level fields", () => {
  it("keeps mine when I changed a field, theirs otherwise", () => {
    const base = proj({ meta: { title: "P", treatment: "old" }, brand: { name: "A" } });
    const mine = proj({ meta: { title: "P", treatment: "MY EDIT" }, brand: { name: "A" } });
    const theirs = proj({ meta: { title: "P", treatment: "old" }, brand: { name: "THEIR BRAND" } });
    const out = mergeProjectData(base, mine, theirs);
    expect(out.meta.treatment).toBe("MY EDIT");   // I changed the treatment → mine
    expect(out.brand.name).toBe("THEIR BRAND");   // they changed brand, I didn't → theirs
  });
});

describe("mergeProjectData — id arrays (the core anti-clobber case)", () => {
  it("two people edit DIFFERENT frames → both survive", () => {
    const base = proj({ frames: [frame("f1", "one"), frame("f2", "two")] });
    const mine = proj({ frames: [frame("f1", "ONE EDIT"), frame("f2", "two")] });   // I edited f1
    const theirs = proj({ frames: [frame("f1", "one"), frame("f2", "TWO EDIT")] }); // they edited f2
    const out = mergeProjectData(base, mine, theirs);
    expect(out.frames.find(f => f.id === "f1").brief).toBe("ONE EDIT");
    expect(out.frames.find(f => f.id === "f2").brief).toBe("TWO EDIT");
  });

  it("both edit the SAME frame → mine wins (no crash, no loss of other items)", () => {
    const base = proj({ frames: [frame("f1", "one")] });
    const mine = proj({ frames: [frame("f1", "MINE")] });
    const theirs = proj({ frames: [frame("f1", "THEIRS")] });
    const out = mergeProjectData(base, mine, theirs);
    expect(out.frames.find(f => f.id === "f1").brief).toBe("MINE");
  });

  it("items added on either side are both kept", () => {
    const base = proj({ talent: [{ id: "t1", name: "A" }] });
    const mine = proj({ talent: [{ id: "t1", name: "A" }, { id: "t2", name: "MINE-NEW" }] });
    const theirs = proj({ talent: [{ id: "t1", name: "A" }, { id: "t3", name: "THEIR-NEW" }] });
    const out = mergeProjectData(base, mine, theirs);
    const ids = out.talent.map(t => t.id).sort();
    expect(ids).toEqual(["t1", "t2", "t3"]);
  });

  it("delete on one side + untouched on the other → honors the delete", () => {
    const base = proj({ talent: [{ id: "t1", name: "A" }, { id: "t2", name: "B" }] });
    const mine = proj({ talent: [{ id: "t1", name: "A" }] }); // I deleted t2
    const theirs = proj({ talent: [{ id: "t1", name: "A" }, { id: "t2", name: "B" }] }); // they left it
    const out = mergeProjectData(base, mine, theirs);
    expect(out.talent.map(t => t.id)).toEqual(["t1"]); // t2 stays deleted
  });

  it("delete on one side + EDIT on the other → edit beats delete (keep the data)", () => {
    const base = proj({ talent: [{ id: "t1", name: "A" }, { id: "t2", name: "B" }] });
    const mine = proj({ talent: [{ id: "t1", name: "A" }] });                          // I deleted t2
    const theirs = proj({ talent: [{ id: "t1", name: "A" }, { id: "t2", name: "B-EDIT" }] }); // they edited t2
    const out = mergeProjectData(base, mine, theirs);
    expect(out.talent.find(t => t.id === "t2")?.name).toBe("B-EDIT"); // kept
  });

  it("unchanged on both sides → no duplication, value preserved", () => {
    const base = proj({ frames: [frame("f1", "one")] });
    const out = mergeProjectData(base, base, base);
    expect(out.frames).toHaveLength(1);
    expect(out.frames[0].brief).toBe("one");
  });
});

describe("mergeProjectData — versionHistory + edge cases", () => {
  it("unions versionHistory keys", () => {
    const base = proj({ versionHistory: { "frame.f1": [1] } });
    const mine = proj({ versionHistory: { "frame.f1": [1], "talent.t1.primary": ["MINE"] } });
    const theirs = proj({ versionHistory: { "frame.f1": [1], "location.l1": ["THEIRS"] } });
    const out = mergeProjectData(base, mine, theirs);
    expect(out.versionHistory["talent.t1.primary"]).toEqual(["MINE"]);
    expect(out.versionHistory["location.l1"]).toEqual(["THEIRS"]);
  });

  it("null/missing inputs don't throw", () => {
    expect(mergeProjectData(null, proj(), proj())).toBeTruthy();
    expect(mergeProjectData(proj(), proj(), null)).toBeTruthy();
    expect(mergeProjectData(undefined, undefined, proj()).frames).toEqual([]);
  });
});
