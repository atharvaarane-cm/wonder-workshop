import { describe, it, expect } from "vitest";
import { buildSlots } from "./genPlan.js";

const data = {
  talent: [{ id: "t1" }, { id: "t2" }],
  locations: [{ id: "l1" }],
  products: [{ id: "p1" }, { id: "p2" }],
  frames: [{ id: "f1" }, { id: "f2" }, { id: "f3" }],
  moodBoard: [{ id: "m1", caption: "a mood" }],
};

describe("buildSlots", () => {
  it("covers every asset/angle/frame", () => {
    const slots = buildSlots(data);
    const byKind = (k) => slots.filter(s => s.kind === k).length;
    expect(byKind("talent_primary")).toBe(2);
    expect(byKind("talent_headshot")).toBe(2 * 3);   // side/3q/back per talent
    expect(byKind("talent_fullbody")).toBe(2 * 4);   // 4 views per talent
    expect(byKind("location")).toBe(1);
    expect(byKind("product")).toBe(2);
    expect(byKind("frame")).toBe(3);
    expect(byKind("mood")).toBe(1);
    expect(slots).toHaveLength(2 + 6 + 8 + 1 + 2 + 3 + 1);
  });

  it("orders primaries + location/product refs BEFORE frames, and frames before the background", () => {
    const slots = buildSlots(data);
    const idx = (pred) => slots.findIndex(pred);
    const lastPrimary = slots.map(s => s.kind).lastIndexOf("talent_primary");
    const firstFrame = idx(s => s.kind === "frame");
    const firstRef = idx(s => s.kind === "location" || s.kind === "product");
    const firstBg = idx(s => s.kind === "talent_headshot" || s.kind === "talent_fullbody" || s.kind === "mood");
    const lastFrame = slots.map(s => s.kind).lastIndexOf("frame");
    expect(lastPrimary).toBeLessThan(firstFrame);  // primaries before frames
    expect(firstRef).toBeLessThan(firstFrame);     // loc/prod refs before frames
    expect(lastFrame).toBeLessThan(firstBg);       // frames before background (mood can't block them)
  });

  it("carries view + caption + stable keys", () => {
    const slots = buildSlots(data);
    expect(slots.find(s => s.kind === "talent_fullbody").view).toBeTruthy();
    expect(slots.find(s => s.kind === "mood").caption).toBe("a mood");
    expect(new Set(slots.map(s => s.key)).size).toBe(slots.length); // keys unique
  });

  it("handles empty/missing data", () => {
    expect(buildSlots({})).toEqual([]);
    expect(buildSlots(null)).toEqual([]);
  });
});
