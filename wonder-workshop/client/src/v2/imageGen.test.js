import { describe, it, expect } from "vitest";
import { framePrompt } from "./imageGen.js";

// Characterization tests — these lock in framePrompt's CURRENT behavior so the
// upcoming refactor + backend migration can't silently change the prompt the
// image model receives. They also guard the lens/angle fix (lens/angle used to
// be dropped from the prompt entirely).

describe("framePrompt", () => {
  it("includes the frame brief and always appends the cinematic suffix", () => {
    const out = framePrompt({ brief: "A dog runs across a beach" });
    expect(out).toContain("A dog runs across a beach");
    expect(out).toContain("Cinematic film still, photorealistic, narrative production photography.");
  });

  it("adds shot-type framing when set", () => {
    expect(framePrompt({ brief: "x", shotType: "wide" })).toContain(", wide framing");
    expect(framePrompt({ brief: "x" })).not.toContain("framing");
  });

  describe("lens (the regression we fixed)", () => {
    it("spells out a wide lens", () => {
      expect(framePrompt({ brief: "x", lens: "wide" })).toContain("wide-angle lens");
      expect(framePrompt({ brief: "x", lens: "wide" })).toContain("24mm");
    });
    it("spells out a normal lens", () => {
      expect(framePrompt({ brief: "x", lens: "normal" })).toContain("normal lens");
      expect(framePrompt({ brief: "x", lens: "normal" })).toContain("50mm");
    });
    it("spells out a telephoto lens", () => {
      expect(framePrompt({ brief: "x", lens: "telephoto" })).toContain("telephoto");
      expect(framePrompt({ brief: "x", lens: "telephoto" })).toContain("85mm");
    });
    it("ignores an unknown lens value", () => {
      expect(framePrompt({ brief: "x", lens: "fisheye" })).not.toContain("mm equivalent");
    });
    it("adds no lens text when lens is unset", () => {
      expect(framePrompt({ brief: "x" })).not.toContain("mm equivalent");
    });
  });

  describe("camera angle", () => {
    it("describes a three-quarter-right angle", () => {
      const out = framePrompt({ brief: "x", cameraAngle: "3qR" });
      expect(out).toContain("three-quarter angle");
      expect(out).toContain("front-right");
    });
    it("treats 'front' as neutral — no angle phrasing", () => {
      const out = framePrompt({ brief: "x", cameraAngle: "front" });
      expect(out).not.toContain("three-quarter");
      expect(out).not.toContain("viewed from");
    });
  });

  describe("role / focus weighting", () => {
    it("foregrounds a lead character", () => {
      const out = framePrompt(
        { brief: "x", talentIds: ["t1"] },
        [{ id: "t1", name: "Maya", role: "Lead" }],
      );
      expect(out).toContain("Maya is the lead — primary focus");
    });
    it("backgrounds an extra", () => {
      const out = framePrompt(
        { brief: "x", talentIds: ["t9"] },
        [{ id: "t9", name: "Background Guy", role: "Extra" }],
      );
      expect(out).toContain("Background Guy is an extra");
    });
    it("features a high-focus element", () => {
      const out = framePrompt(
        { brief: "x", productIds: ["p1"] },
        [],
        [{ id: "p1", name: "Pepsi Can", focus: "High" }],
      );
      expect(out).toContain("Pepsi Can is the hero element");
    });
    it("adds no weighting when nothing is referenced", () => {
      const out = framePrompt({ brief: "x" });
      expect(out).not.toContain("Character emphasis");
      expect(out).not.toContain("Element emphasis");
    });
  });
});
