import { chatWithTools } from "../hooks/useBrief.js";

export const V2_CHAT_TOOLS = [
  {
    name: "update_frame_brief",
    description: "Replace a storyboard frame's shot description. Use this for any change to what a selected frame depicts. Pass the FULL new brief text, preserving relevant @handles. The app will regenerate the frame image after this update.",
    parameters: {
      type: "object",
      properties: {
        frameNumber: { type: "string", description: "Zero-padded frame number, e.g. '01' or '06'." },
        newBrief: { type: "string", description: "The complete replacement brief text. Use @handles to reference characters, locations, and products." },
      },
      required: ["frameNumber", "newBrief"],
    },
  },
  {
    name: "update_frame_camera",
    description: "Change a frame's camera settings: movement, height, lens, or angle. Any field can be omitted; only provided fields are updated.",
    parameters: {
      type: "object",
      properties: {
        frameNumber: { type: "string", description: "Zero-padded frame number." },
        movement: { type: "string", enum: ["static", "pan", "track", "crane", "handheld", "steadicam"] },
        cameraHeight: { type: "string", enum: ["worm", "low", "eye", "high", "bird"] },
        lens: { type: "string", enum: ["wide", "normal", "telephoto"] },
        cameraAngle: { type: "string", enum: ["front", "3qR", "right", "back", "left", "3qL"] },
      },
      required: ["frameNumber"],
    },
  },
  {
    name: "update_frame_shot_type",
    description: "Change a frame's shot type or framing.",
    parameters: {
      type: "object",
      properties: {
        frameNumber: { type: "string", description: "Zero-padded frame number." },
        shotType: { type: "string", enum: ["WIDE", "MED", "MCU", "CU", "ECU", "OTS", "POV", "INSERT"] },
      },
      required: ["frameNumber", "shotType"],
    },
  },
  {
    name: "update_meta",
    description: "Edit a project-level metadata field: title, treatment, client, format, or aspect. Pass the FULL new value.",
    parameters: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["title", "treatment", "client", "format", "aspect"] },
        value: { type: "string" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "update_talent",
    description: "Edit an existing character's name, role, or appearance note. Find by current name. The app will regenerate that character's reference image after appearance/name changes.",
    parameters: {
      type: "object",
      properties: {
        talentName: { type: "string", description: "Current character name to find." },
        field: { type: "string", enum: ["name", "role", "note"] },
        value: { type: "string" },
      },
      required: ["talentName", "field", "value"],
    },
  },
  {
    name: "update_location",
    description: "Edit an existing location's name or note. Find by current name. The app will regenerate that location reference image after the update.",
    parameters: {
      type: "object",
      properties: {
        locationName: { type: "string" },
        field: { type: "string", enum: ["name", "note"] },
        value: { type: "string" },
      },
      required: ["locationName", "field", "value"],
    },
  },
  {
    name: "update_product",
    description: "Edit an existing element/product's name, category, or note. Find by current name. The app will regenerate that product reference image after the update.",
    parameters: {
      type: "object",
      properties: {
        productName: { type: "string" },
        field: { type: "string", enum: ["name", "category", "note"] },
        value: { type: "string" },
      },
      required: ["productName", "field", "value"],
    },
  },
  {
    name: "add_frame",
    description: "Append a new frame to the storyboard.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "create_talent",
    description: "Create a new character. By default also generates the primary headshot image.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full character name." },
        role: { type: "string", description: "Lead, Supporting, Cameo, or similar role label." },
        note: { type: "string", description: "Appearance only: age range, build, hair, wardrobe, distinctive visual traits." },
        generateImage: { type: "boolean", description: "Default true. Set false only if the user explicitly says not to generate an image." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_location",
    description: "Create a new location. By default also generates its reference image.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        note: { type: "string", description: "Time of day, weather, architecture, atmosphere." },
        generateImage: { type: "boolean", description: "Default true." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_product",
    description: "Create a new product or hero element. By default also generates its product reference image.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        category: { type: "string" },
        note: { type: "string", description: "Color, material, shape, label/brand details, and key visual traits." },
        generateImage: { type: "boolean", description: "Default true." },
      },
      required: ["name"],
    },
  },
  {
    name: "generate_asset_image",
    description: "Regenerate the reference image for an existing character, location, or product from its current saved description.",
    parameters: {
      type: "object",
      properties: {
        assetType: { type: "string", enum: ["talent", "location", "product"] },
        assetName: { type: "string", description: "Current asset name." },
      },
      required: ["assetType", "assetName"],
    },
  },
  {
    name: "generate_frame_image",
    description: "Regenerate the storyboard image for an existing frame from its current saved brief. For visual edits, call update_frame_brief instead so the saved frame text stays in sync.",
    parameters: {
      type: "object",
      properties: {
        frameNumber: { type: "string", description: "Zero-padded frame number." },
      },
      required: ["frameNumber"],
    },
  },
];

export function normalizeChatToolResponse(data = {}) {
  const rawCalls = Array.isArray(data.functionCalls)
    ? data.functionCalls
    : Array.isArray(data.actions)
      ? data.actions
      : [];
  return rawCalls
    .map(call => ({
      name: call?.name,
      args: call?.args || call?.arguments || {},
    }))
    .filter(call => call.name);
}

function briefAssetSnapshot(data) {
  return {
    meta: data?.meta || {},
    talent: (data?.talent || []).map(t => ({
      id: t.id, name: t.name, handle: t.handle, role: t.role, note: t.note,
      locked: !!t.locked, hasImage: !!(t.headshot || t.headshots?.front),
    })),
    locations: (data?.locations || []).map(l => ({
      id: l.id, name: l.name, handle: l.handle, type: l.type, note: l.note,
      locked: !!l.locked, hasImage: !!(l.generatedImage || l.referenceImage),
    })),
    products: (data?.products || []).map(p => ({
      id: p.id, name: p.name, handle: p.handle, category: p.category, note: p.note,
      locked: !!p.locked, hasImage: !!p.referenceImage,
    })),
    frames: (data?.frames || []).map(f => ({
      id: f.id,
      number: f.number,
      shotType: f.shotType,
      brief: f.brief,
      camera: f.camera,
      cameraAngle: f.cameraAngle,
      cameraHeight: f.cameraHeight,
      lens: f.lens,
      movement: f.movement,
      duration: f.duration,
      imageStatus: f.imageStatus,
      hasImage: !!f.uploadedImage,
      talentIds: f.talentIds,
      locationId: f.locationId,
      productIds: f.productIds,
    })),
    locks: data?.locks || {},
  };
}

export function resolveMentionHandles(data, text = "") {
  const handles = [...String(text).matchAll(/@[\w-]+/g)].map(m => m[0].toLowerCase());
  const unique = [...new Set(handles)];
  const find = (list, type) => unique
    .map(handle => {
      const asset = (list || []).find(item => (item.handle || "").toLowerCase() === handle);
      return asset ? { type, id: asset.id, name: asset.name, handle: asset.handle } : null;
    })
    .filter(Boolean);
  const known = [
    ...find(data?.talent, "talent"),
    ...find(data?.locations, "location"),
    ...find(data?.products, "product"),
  ];
  const knownHandles = new Set(known.map(a => (a.handle || "").toLowerCase()));
  return {
    known,
    unknown: unique.filter(handle => !knownHandles.has(handle)),
  };
}

function inferMode({ text, focusedFrame, focusedAsset }) {
  const l = String(text || "").toLowerCase();
  const asksQuestion = /^(what|why|how|can you explain|tell me|show me)\b/.test(l);
  if (asksQuestion && !/\b(change|make|add|create|regenerate|edit|replace|update)\b/.test(l)) return "chat";
  if (focusedAsset?.asset) return "asset_edit";
  if (focusedFrame) return "frame_edit";
  if (/\b(project|brief|treatment|title|client|runtime|duration|aspect)\b/.test(l)) return "project_edit";
  return "chat";
}

export function buildV2ChatContext(data, selectedFrameId, assetContext, userText = "") {
  const focusedFrame = selectedFrameId ? (data?.frames || []).find(f => f.id === selectedFrameId) || null : null;
  const focusedAsset = assetContext?.asset ? assetContext : null;
  const mentions = resolveMentionHandles(data, userText);
  const mode = inferMode({ text: userText, focusedFrame, focusedAsset });

  const modeRules = {
    frame_edit: [
      "MODE: frame_edit.",
      "The selected frame is the target. If the user asks to change what the image depicts, call update_frame_brief with a complete replacement brief for that frame.",
      "Do not call generate_frame_image as the only action for a visual edit; the app regenerates automatically after update_frame_brief.",
      "Preserve useful @handles from the existing frame brief unless the user asks to remove or replace that subject.",
    ],
    asset_edit: [
      "MODE: asset_edit.",
      "The selected asset is the target. Edit it with update_talent, update_location, or update_product.",
      "The app regenerates that asset reference image automatically after the update.",
    ],
    project_edit: [
      "MODE: project_edit.",
      "Use update_meta only when the user asks to change project-level title, treatment, client, format, or aspect.",
    ],
    chat: [
      "MODE: chat.",
      "If the user is asking a question, answer in plain text. If they clearly ask to change something, use the right tool.",
    ],
  };

  const targetLines = [];
  if (focusedFrame) {
    targetLines.push(`Selected frame: ${focusedFrame.number} (${focusedFrame.id})`);
    targetLines.push(`Selected frame current brief: ${focusedFrame.brief || ""}`);
    targetLines.push(`Selected frame image status: ${focusedFrame.imageStatus || "unknown"}`);
  }
  if (focusedAsset?.asset) {
    targetLines.push(`Selected asset: ${focusedAsset.type} ${focusedAsset.asset.name} (${focusedAsset.asset.id}) ${focusedAsset.asset.handle || ""}`);
    targetLines.push(`Selected asset note: ${focusedAsset.asset.note || ""}`);
  }
  if (mentions.known.length) {
    targetLines.push(`Resolved @mentions: ${mentions.known.map(a => `${a.handle}=${a.type}:${a.id}`).join(", ")}`);
  }
  if (mentions.unknown.length) {
    targetLines.push(`Unknown @mentions: ${mentions.unknown.join(", ")}`);
  }

  const systemPrompt = [
    "You are the v2 Wonder Workshop AI chat assistant editing a production storyboard.",
    "Use tools to perform requested changes. Do not merely describe a change when a tool can apply it.",
    "Return a short human summary after tool calls.",
    "",
    ...modeRules[mode],
    "",
    "Vocabulary:",
    "- Frames/shots/storyboard images are data.frames[].",
    "- Characters/cast/talent are data.talent[].",
    "- Locations/settings are data.locations[].",
    "- Products/elements/hero items are data.products[].",
    "- The top-level brief/treatment is data.meta.treatment.",
    "",
    "Rules:",
    "- For selected-frame visual edits like 'make it sunset' or 'change this image to a mountain with a goat', call update_frame_brief for the selected frame.",
    "- For asset appearance edits like 'make @maya wear red', update the asset note with the full replacement description.",
    "- For new characters, locations, products, or frames, use create_talent, create_location, create_product, or add_frame.",
    "- If a referenced @handle is unknown, ask the user to choose an existing handle instead of guessing.",
    "- Use exact frame numbers and current asset names from the state snapshot.",
    "",
    "Current target:",
    targetLines.join("\n") || "(no selected target)",
    "",
    "Current project state JSON:",
    JSON.stringify(briefAssetSnapshot(data), null, 2),
  ].join("\n");

  return { mode, focusedFrame, focusedAsset, mentions, systemPrompt };
}

function autoHandle(name) {
  return "@" + (name || "").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nextId(items, prefix) {
  const mx = Math.max(0, ...(items || []).map(item => parseInt(String(item.id || "").replace(prefix, "")) || 0));
  return `${prefix}${mx + 1}`;
}

function findByName(list, name) {
  const needle = String(name || "").toLowerCase().trim();
  if (!needle) return null;
  return (list || []).find(item => item.name?.toLowerCase().includes(needle)) || null;
}

function lockedFailure(kind, name) {
  return `${name || "That item"} is locked. Unlock it before asking chat to change it.`;
}

export function applyV2ChatActions(actions, { data, dispatch }) {
  const applied = [];
  const failures = [];
  const effects = [];
  const highlights = new Set();
  const findFrame = (num) => {
    const norm = String(num || "").padStart(2, "0");
    return (data.frames || []).find(f => f.number === norm) || null;
  };

  for (const action of actions || []) {
    const args = action.args || {};
    switch (action.name) {
      case "update_frame_brief": {
        const frame = findFrame(args.frameNumber);
        if (!frame) { failures.push(`I couldn't find frame ${args.frameNumber || ""}.`); break; }
        if (!args.newBrief) { failures.push(`I couldn't update Frame ${frame.number} because the new brief was empty.`); break; }
        dispatch({ type: "UPDATE_FRAME", frameId: frame.id, field: "brief", value: args.newBrief });
        applied.push({ kind: "frame", frameId: frame.id, field: "brief", message: `Updated Frame ${frame.number}. Regenerating the image...` });
        effects.push({ type: "generateFrameImage", frameId: frame.id });
        highlights.add(frame.id);
        break;
      }
      case "update_frame_camera": {
        const frame = findFrame(args.frameNumber);
        if (!frame) { failures.push(`I couldn't find frame ${args.frameNumber || ""}.`); break; }
        const fields = {};
        for (const k of ["movement", "cameraHeight", "lens", "cameraAngle"]) if (args[k]) fields[k] = args[k];
        if (!Object.keys(fields).length) { failures.push(`I didn't receive any camera settings to update for Frame ${frame.number}.`); break; }
        dispatch({ type: "UPDATE_FRAME_CAMERA", frameId: frame.id, fields });
        applied.push({ kind: "camera", frameId: frame.id, field: Object.keys(fields).join(","), message: `Updated Frame ${frame.number} camera.` });
        highlights.add(frame.id);
        break;
      }
      case "update_frame_shot_type": {
        const frame = findFrame(args.frameNumber);
        if (!frame) { failures.push(`I couldn't find frame ${args.frameNumber || ""}.`); break; }
        if (!args.shotType) { failures.push(`I didn't receive a shot type for Frame ${frame.number}.`); break; }
        dispatch({ type: "UPDATE_FRAME", frameId: frame.id, field: "shotType", value: args.shotType });
        applied.push({ kind: "frame", frameId: frame.id, field: "shotType", message: `Updated Frame ${frame.number} shot type.` });
        highlights.add(frame.id);
        break;
      }
      case "update_meta": {
        if (!args.field || args.value == null) { failures.push("I couldn't update the project metadata because a field or value was missing."); break; }
        dispatch({ type: "UPDATE_META", field: args.field, value: args.value });
        applied.push({ kind: "meta", field: args.field, message: `Updated ${args.field}.` });
        break;
      }
      case "update_talent": {
        const target = findByName(data.talent, args.talentName);
        if (!target) { failures.push(`I couldn't find character "${args.talentName || ""}".`); break; }
        if (data.locks?.talent || target.locked) { failures.push(lockedFailure("talent", target.name)); break; }
        if (!args.field || args.value == null) { failures.push(`I couldn't update ${target.name} because a field or value was missing.`); break; }
        dispatch({ type: "UPDATE_TALENT", id: target.id, field: args.field, value: args.value });
        applied.push({ kind: "talent", field: args.field, message: `Updated ${target.name}. Regenerating their reference image...` });
        effects.push({ type: "generateTalentPrimary", talentId: target.id, talentName: args.field === "name" ? args.value : target.name });
        break;
      }
      case "update_location": {
        const target = findByName(data.locations, args.locationName);
        if (!target) { failures.push(`I couldn't find location "${args.locationName || ""}".`); break; }
        if (data.locks?.locations || target.locked) { failures.push(lockedFailure("location", target.name)); break; }
        if (!args.field || args.value == null) { failures.push(`I couldn't update ${target.name} because a field or value was missing.`); break; }
        dispatch({ type: "UPDATE_LOCATION", id: target.id, field: args.field, value: args.value });
        applied.push({ kind: "location", field: args.field, message: `Updated ${target.name}. Regenerating the location reference...` });
        effects.push({ type: "generateLocationImage", locationId: target.id, locationName: args.field === "name" ? args.value : target.name });
        break;
      }
      case "update_product": {
        const target = findByName(data.products, args.productName);
        if (!target) { failures.push(`I couldn't find product/element "${args.productName || ""}".`); break; }
        if (data.locks?.products || target.locked) { failures.push(lockedFailure("product", target.name)); break; }
        if (!args.field || args.value == null) { failures.push(`I couldn't update ${target.name} because a field or value was missing.`); break; }
        dispatch({ type: "UPDATE_PRODUCT", id: target.id, field: args.field, value: args.value });
        applied.push({ kind: "product", field: args.field, message: `Updated ${target.name}. Regenerating the product reference...` });
        effects.push({ type: "generateProductImage", productId: target.id, productName: args.field === "name" ? args.value : target.name });
        break;
      }
      case "add_frame": {
        dispatch({ type: "ADD_FRAME" });
        applied.push({ kind: "frame", field: "added", message: "Added a new frame." });
        break;
      }
      case "create_talent": {
        if (data.locks?.talent) { failures.push("The character section is locked."); break; }
        if (!args.name) { failures.push("I couldn't create a character without a name."); break; }
        const id = nextId(data.talent, "t");
        dispatch({ type: "ADD_TALENT", data: {
          id,
          name: args.name,
          handle: autoHandle(args.name),
          role: args.role || "Supporting",
          note: args.note || "",
          initials: String(args.name).trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase(),
        }});
        applied.push({ kind: "talent", field: "created", message: `Created ${args.name}.` });
        if (args.generateImage !== false) effects.push({ type: "generateTalentPrimary", talentId: id, talentName: args.name });
        break;
      }
      case "create_location": {
        if (data.locks?.locations) { failures.push("The locations section is locked."); break; }
        if (!args.name) { failures.push("I couldn't create a location without a name."); break; }
        const id = nextId(data.locations, "l");
        dispatch({ type: "ADD_LOCATION", data: { id, name: args.name, handle: autoHandle(args.name), note: args.note || "", type: "ai" } });
        applied.push({ kind: "location", field: "created", message: `Created ${args.name}.` });
        if (args.generateImage !== false) effects.push({ type: "generateLocationImage", locationId: id, locationName: args.name });
        break;
      }
      case "create_product": {
        if (data.locks?.products) { failures.push("The products/elements section is locked."); break; }
        if (!args.name) { failures.push("I couldn't create a product/element without a name."); break; }
        const id = nextId(data.products, "p");
        dispatch({ type: "ADD_PRODUCT", data: { id, name: args.name, handle: autoHandle(args.name), category: args.category || "Other", note: args.note || "" } });
        applied.push({ kind: "product", field: "created", message: `Created ${args.name}.` });
        if (args.generateImage !== false) effects.push({ type: "generateProductImage", productId: id, productName: args.name });
        break;
      }
      case "generate_asset_image": {
        const list = args.assetType === "talent" ? data.talent : args.assetType === "location" ? data.locations : args.assetType === "product" ? data.products : [];
        const target = findByName(list, args.assetName);
        if (!target) { failures.push(`I couldn't find ${args.assetType || "asset"} "${args.assetName || ""}".`); break; }
        const typeMap = { talent: "generateTalentPrimary", location: "generateLocationImage", product: "generateProductImage" };
        effects.push({ type: typeMap[args.assetType], [`${args.assetType}Id`]: target.id, [`${args.assetType}Name`]: target.name, assetName: target.name });
        applied.push({ kind: args.assetType, field: "regenerating", message: `Regenerating ${target.name}.` });
        break;
      }
      case "generate_frame_image": {
        const frame = findFrame(args.frameNumber);
        if (!frame) { failures.push(`I couldn't find frame ${args.frameNumber || ""}.`); break; }
        effects.push({ type: "generateFrameImage", frameId: frame.id });
        applied.push({ kind: "frame", frameId: frame.id, field: "regenerating", message: `Regenerating Frame ${frame.number}.` });
        highlights.add(frame.id);
        break;
      }
      default:
        failures.push(`I don't know how to run "${action.name}".`);
    }
  }

  return { applied, failures, effects: effects.filter(Boolean), highlights };
}

export function summarizeV2ChatResult(replyText, result) {
  if (result.failures?.length) return result.failures.join("\n");
  const text = String(replyText || "").trim();
  if (text) return text;
  const messages = (result.applied || []).map(r => r.message).filter(Boolean);
  if (messages.length) return messages.slice(0, 2).join(" ");
  return "I didn't get a valid change back. Try naming the frame, character, location, or product you want to edit.";
}

export async function improveV2ChatInstruction(text, context = {}) {
  const hasImage = !!context.hasImageContext;
  const target = context.selectedFrame
    ? `Frame ${context.selectedFrame.number}: ${context.selectedFrame.brief || ""}`
    : context.assetContext?.asset
      ? `${context.assetContext.type}: ${context.assetContext.asset.name} ${context.assetContext.asset.note || ""}`
      : "general project chat";
  const { text: improved } = await chatWithTools([
    {
      role: "system",
      content: [
        "Rewrite the user's rough chat instruction for a storyboard editing assistant.",
        "Return only the improved instruction. No quotes, no markdown.",
        "Keep the user's intent. Make it specific and actionable.",
        hasImage ? "The instruction is for editing an existing generated image." : "The instruction may be for editing storyboard data.",
      ].join("\n"),
    },
    { role: "user", content: `Target: ${target}\nInstruction: ${text}` },
  ], []);
  return String(improved || text).trim() || text;
}
