import { describe, expect, test } from "bun:test";
import {
  applyV2ChatActions,
  buildV2ChatContext,
  normalizeChatToolResponse,
  resolveMentionHandles,
} from "./aiChat.js";

const baseData = {
  meta: { title: "Test", treatment: "A test spot", aspect: "16:9" },
  locks: { talent: false, locations: false, products: false },
  talent: [{ id: "t1", name: "The Beachgoer", handle: "@the", note: "Beach volleyball player", role: "Lead" }],
  locations: [{ id: "l1", name: "Beach", handle: "@beach", note: "Sunny beach" }],
  products: [{ id: "p1", name: "Frappuccino", handle: "@frappuccino", note: "Iced drink", category: "Beverage" }],
  frames: [{
    id: "f1",
    number: "01",
    shotType: "CU",
    brief: "@the spikes the ball while holding @frappuccino.",
    camera: "Pan",
    imageStatus: "uploaded",
    uploadedImage: "data:image/png;base64,abc",
    talentIds: ["t1"],
    locationId: "l1",
    productIds: ["p1"],
  }],
};

describe("normalizeChatToolResponse", () => {
  test("normalizes local Express actions shape", () => {
    expect(normalizeChatToolResponse({
      actions: [{ name: "update_frame_brief", arguments: { frameNumber: "01", newBrief: "Sunset" } }],
    })).toEqual([{ name: "update_frame_brief", args: { frameNumber: "01", newBrief: "Sunset" } }]);
  });

  test("normalizes production functionCalls shape", () => {
    expect(normalizeChatToolResponse({
      functionCalls: [{ name: "generate_frame_image", args: { frameNumber: "01" } }],
    })).toEqual([{ name: "generate_frame_image", args: { frameNumber: "01" } }]);
  });

  test("ignores malformed calls", () => {
    expect(normalizeChatToolResponse({ actions: [{ arguments: { nope: true } }, null] })).toEqual([]);
  });
});

describe("v2 chat context", () => {
  test("uses frame_edit mode when a frame is selected", () => {
    const context = buildV2ChatContext(baseData, "f1", null, "make it sunset time");
    expect(context.mode).toBe("frame_edit");
    expect(context.systemPrompt).toContain("Selected frame: 01");
  });

  test("resolves known and unknown mentions", () => {
    const mentions = resolveMentionHandles(baseData, "make @the wear red and add @ghost");
    expect(mentions.known).toEqual([{ type: "talent", id: "t1", name: "The Beachgoer", handle: "@the" }]);
    expect(mentions.unknown).toEqual(["@ghost"]);
  });
});

describe("applyV2ChatActions", () => {
  test("updates a frame brief and queues image regeneration", () => {
    const dispatched = [];
    const result = applyV2ChatActions([
      { name: "update_frame_brief", args: { frameNumber: "01", newBrief: "A mountain with a goat at sunset." } },
    ], {
      data: baseData,
      dispatch: action => dispatched.push(action),
    });

    expect(dispatched).toEqual([{ type: "UPDATE_FRAME", frameId: "f1", field: "brief", value: "A mountain with a goat at sunset." }]);
    expect(result.effects).toEqual([{ type: "generateFrameImage", frameId: "f1" }]);
    expect([...result.highlights]).toEqual(["f1"]);
  });
});
