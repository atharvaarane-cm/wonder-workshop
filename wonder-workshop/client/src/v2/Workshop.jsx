import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { generateBrief } from "../hooks/useBrief.js";
import { v1BriefToV2Data } from "./migration.js";
import { generateImage, talentPrompt, locationPrompt, productPrompt, framePrompt } from "./imageGen.js";

/*
  +======================================================+
  |  WORKSHOP v9.5 — AI Storyboard Tool                  |
  |                                                      |
  |  Source: Ravi's wireframe (Downloads/workshop/).     |
  |  Imported 2026-05-27 as the v2 redesign target.      |
  |                                                      |
  |  Status: UI only — mock AI, no persistence yet.      |
  |  Backend integration lands in subsequent commits.    |
  |                                                      |
  |  Reachable at ?v=2 (current production stays default |
  |  until backend is wired and Ravi/Ed sign off).       |
  |                                                      |
  |  Font: Inter 200-800                                 |
  |  Palette: #0A0A0A -> #E0E0E0 (neutral) + #FFFFFF    |
  +======================================================+
*/

// -- AUTO HANDLE HELPER ----------------------------------------

function autoHandle(name) {
  return "@" + (name || "").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

// -- W LOGO ---------------------------------------------------

function WLogo({ color = "#fff", size = 18 }) {
  const w = size * (168.46 / 122.67);
  return (
    <svg viewBox="0 0 168.46 122.67" width={w} height={size} fill={color} style={{ display: "block" }}>
      <path d="M146.1,13.69s5.13-.24,8.1,3.72c1.79,2.39,2.57,5.54,2.04,9.54-.05.28-4.92,28.2-6.1,34.29-4.56,23.56-10.82,39.22-15.94,39.91-1.73.23-3.44-1.32-5.07-4.62-1.83-3.71-4.25-10.12-7.06-17.53-8.25-21.8-20.73-54.76-34.49-62.19-2.43-1.52-8.19-4.19-13.66,2.81-4.35,5.56-1.75,10.95,1,16.36,1.67,3.29,3.25,6.4,3.25,9.43,0,5.87-5.3,18.36-30.58,44.56-.43.45-.93.97-1.49,1.56-5.19,5.46-15.99,16.81-22.79,17.97-4.04.69-7.4-1.73-8.2-4.36-1.49-4.93,4.82-14.5,8.67-21.02C47.57,43.85,51.16,21.55,39.65,7.65,34.42,1.34,24.01-1.49,14.33.77,6.9,2.51,1.85,6.78.49,12.51c-2.52,10.59,5.11,16.08,13.18,21.9,1.78,1.28,3.62,2.61,5.4,4.02,8.7,6.89,9.2,12.93,7.06,21.67-2.44,10.01-7.89,19.82-13.17,29.3-2.13,3.82-4.32,7.77-6.26,11.64-2.44,4.85-7.51,14.94.11,19.65,2.29,1.41,4.87,2,7.48,2,5.74,0,11.65-2.81,15.04-5.76,17.86-15.51,45.47-46.22,55.74-61.98,1.02-1.56,1.91-3.14,2.66-4.71.86,2.05,1.74,4.19,2.65,6.39,11.01,26.58,26.03,62.88,40.44,62.88.16,0,.32,0,.47-.01,10.27-.57,16.54-6.08,19.18-16.84,1.21-4.94,12.46-66.32,12.93-68.94l5.05-27.78-22.36-.01v7.78Z" />
    </svg>
  );
}

// -- CONSTANTS ------------------------------------------------

const FILM = [
  "linear-gradient(145deg, #161618 0%, #252528 35%, #161618 100%)",
  "linear-gradient(180deg, #121214 0%, #1e1e22 50%, #121214 100%)",
  "linear-gradient(200deg, #101016 0%, #1a1a24 50%, #101016 100%)",
  "linear-gradient(160deg, #101016 0%, #1c1c28 40%, #101016 100%)",
  "linear-gradient(175deg, #161618 0%, #252528 50%, #161618 100%)",
  "linear-gradient(140deg, #101016 0%, #1a1a24 30%, #161618 75%, #121214 100%)",
];

const SHOT_TYPES = ["WIDE", "MED", "MCU", "CU", "ECU", "OTS", "POV", "INSERT"];

const CAMERA_ANGLES = [
  { value: "front", label: "F", full: "Front" },
  { value: "3qR", label: "\xBER", full: "3/4 Right" },
  { value: "right", label: "R", full: "Right" },
  { value: "back", label: "B", full: "Back" },
  { value: "left", label: "L", full: "Left" },
  { value: "3qL", label: "\xBEL", full: "3/4 Left" },
];

const CAMERA_HEIGHTS = [
  { value: "worm", label: "Worm's Eye" },
  { value: "low", label: "Low" },
  { value: "eye", label: "Eye Level" },
  { value: "high", label: "High" },
  { value: "bird", label: "Bird's Eye" },
];

const LENS_TYPES = [
  { value: "wide", label: "Wide", hint: "24mm" },
  { value: "normal", label: "Normal", hint: "50mm" },
  { value: "telephoto", label: "Tele", hint: "85mm" },
];

const MOVEMENT_TYPES = [
  { value: "static", label: "Static" },
  { value: "pan", label: "Pan" },
  { value: "track", label: "Track" },
  { value: "crane", label: "Crane" },
  { value: "handheld", label: "Handheld" },
  { value: "steadicam", label: "Steadicam" },
];

const CAMERA_DEFAULTS = { cameraAngle: "front", cameraHeight: "eye", lens: "normal", movement: "static" };

// -- THEME SYSTEM ------------------------------------------------

function getThemeVars(isDark) {
  const b = isDark ? [224,224,224] : [10,10,8];
  const r = (a) => {
    // Light mode needs higher contrast — boost alphas
    const alpha = isDark ? a : Math.min(1, a * 1.6);
    return `rgba(${b[0]},${b[1]},${b[2]},${alpha})`;
  };
  return {
    "--f": "'Inter', sans-serif",
    "--bg": isDark ? "#0A0A0A" : "#F6F5F3",
    "--warm": isDark ? "#EAEAEA" : "#111110",
    "--warm-60": r(0.7), "--warm-50": r(0.6), "--warm-45": r(0.55),
    "--warm-40": r(0.5), "--warm-35": r(0.45), "--warm-30": r(0.4),
    "--warm-25": r(0.35), "--warm-20": r(0.28), "--warm-15": r(0.22),
    "--warm-12": r(0.18), "--warm-10": r(0.15), "--warm-08": r(0.12),
    "--warm-06": r(0.09), "--warm-04": r(0.06),
    "--surface": isDark ? "rgba(10,10,10,0.85)" : "rgba(246,245,243,0.88)",
    "--surface-solid": isDark ? "rgba(12,12,14,0.97)" : "rgba(246,245,243,0.97)",
    "--hover-fill": isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
    "--hover-text": isDark ? "#111" : "#fff",
    "--select-bg": isDark ? "#111112" : "#F6F5F3",
    "--card-bg": isDark ? "rgba(224,224,224,0.015)" : "rgba(26,26,24,0.03)",
    "--page-gradient": isDark
      ? "radial-gradient(ellipse 80% 60% at 50% 40%, #111112 0%, #0A0A0A 100%)"
      : "radial-gradient(ellipse 80% 60% at 50% 40%, #FFFFFF 0%, #F0EFED 100%)",
    "--logo-color": isDark ? "#fff" : "#1a1a18",
  };
}

const CHAT_SUGGESTIONS = [
  { label: "Create a character", icon: "users" },
  { label: "Wardrobe preview", icon: "camera" },
  { label: "Get location ideas", icon: "map" },
];

function isCameraDefault(frame) {
  return frame.cameraAngle === "front" && frame.cameraHeight === "eye" && frame.lens === "normal" && frame.movement === "static";
}

function deriveCameraText(frame) {
  const m = { static: "Static", pan: "Pan", track: "Tracking", crane: "Crane", handheld: "Handheld", steadicam: "Steadicam" };
  const h = { eye: "", low: "Low Angle", high: "High Angle", bird: "Bird's Eye", worm: "Worm's Eye" };
  const parts = [m[frame.movement] || "Static"];
  if (h[frame.cameraHeight]) parts.push(h[frame.cameraHeight]);
  return parts.join(" \xB7 ");
}

const INITIAL_STATE = {
  meta: {
    title: "THE LONG RUN",
    client: "Nike",
    format: "60",
    aspect: "16:9",
    treatment: "A sixty-second brand film about a runner who never stopped. Dawn on a desert highway. A woman runs alone. We intercut with her coach watching from an empty stadium. The product lives in the run — never forced, always earned. The finish line isn't a race. It's a promise she made to herself.",
  },
  talent: [
    { id: "t1", name: "Maya Chen", handle: "@maya", role: "Lead", initials: "MC", note: "Late 20s, athletic, short black hair. Quiet intensity.", headshot: null, generatedAngles: null, generationStatus: "idle" },
    { id: "t2", name: "Coach Rivera", handle: "@coach", role: "Supporting", initials: "CR", note: "50s, silver temples, warm eyes. Worn track jacket.", headshot: null, generatedAngles: null, generationStatus: "idle" },
  ],
  products: [
    { id: "p1", name: "Ultra Boost X9", handle: "@ultra", category: "Footwear", hue: "#D4E157", referenceImage: null, generationStatus: "idle" },
    { id: "p2", name: "DryFit Singlet", handle: "@dryfit", category: "Apparel", hue: "#78909C", referenceImage: null, generationStatus: "idle" },
    { id: "p3", name: "Running Cap", handle: "@running", category: "Accessories", hue: "#BCAAA4", referenceImage: null, generationStatus: "idle" },
  ],
  locations: [
    { id: "l1", name: "Desert Highway", handle: "@desert", type: "ai", colors: ["#E8C47C", "#8B6F47", "#2C1810", "#FF6B35"], referenceImage: null, generationStatus: "idle", generatedImage: null },
    { id: "l2", name: "Track Stadium", handle: "@track", type: "ref", colors: ["#1A1A2E", "#4A6FA5", "#D4D4D4", "#FF4444"], referenceImage: null, generationStatus: "idle", generatedImage: null },
    { id: "l3", name: "Motel Room", handle: "@motel", type: "ai", colors: ["#3D2B1F", "#D4A574", "#8B7355", "#FFE4B5"], referenceImage: null, generationStatus: "idle", generatedImage: null },
  ],
  // Brand Info — preserved from v1 per Logan's "err on side of features"
  // rule. Singular (one brand per project), unlike the asset arrays.
  brand: {
    name: "Nike",
    url: "nike.com",
    logo: null,
    guidelines: "Bold. Athletic. Authentic. Just Do It.",
  },
  // Mood Board — array of visual style references, similar shape to
  // locations but with a free-form caption instead of structured fields.
  // Carries v1's Mood Board section forward.
  moodBoard: [],
  frames: [
    { id: "f1", number: "01", shotType: "WIDE", camera: "Static", brief: "Dawn. Empty road to vanishing point. Heat shimmer. @maya runs toward camera, impossibly small against the landscape.", talentIds: ["t1"], locationId: "l1", productIds: [], cameraAngle: "front", cameraHeight: "eye", lens: "wide", movement: "static", imageStatus: "placeholder", uploadedImage: null },
    { id: "f2", number: "02", shotType: "ECU", camera: "Tracking \xB7 Worm's Eye", brief: "@maya's feet in @ultra. Each strike kicks dust. Breath before music. Rhythm as score.", talentIds: ["t1"], locationId: "l1", productIds: ["p1"], cameraAngle: "front", cameraHeight: "worm", lens: "normal", movement: "track", imageStatus: "placeholder", uploadedImage: null },
    { id: "f3", number: "03", shotType: "MED", camera: "Tracking", brief: "@coach at the track edge, stopwatch in hand. Watching something off-screen. Pride, worry, memory.", talentIds: ["t2"], locationId: "l2", productIds: [], cameraAngle: "3qR", cameraHeight: "eye", lens: "telephoto", movement: "track", imageStatus: "placeholder", uploadedImage: null },
    { id: "f4", number: "04", shotType: "WIDE", camera: "Crane \xB7 High Angle", brief: "@maya rounds the final curve. Stadium lights flicker on. Alone on the track, running like the stands are full.", talentIds: ["t1"], locationId: "l2", productIds: ["p2"], cameraAngle: "front", cameraHeight: "high", lens: "wide", movement: "crane", imageStatus: "placeholder", uploadedImage: null },
    { id: "f5", number: "05", shotType: "ECU", camera: "Handheld", brief: "Extreme close-up. @maya's eyes. Sweat on her brow. She sees the finish. We see every mile.", talentIds: ["t1"], locationId: "l2", productIds: [], cameraAngle: "front", cameraHeight: "eye", lens: "telephoto", movement: "handheld", imageStatus: "placeholder", uploadedImage: null },
    { id: "f6", number: "06", shotType: "WIDE", camera: "Static", brief: "@maya breaks the plane. Doesn't celebrate. Stops. Breathes. @coach enters frame. No words. A nod.", talentIds: ["t1", "t2"], locationId: "l2", productIds: ["p1"], cameraAngle: "front", cameraHeight: "eye", lens: "normal", movement: "static", imageStatus: "placeholder", uploadedImage: null },
  ],
};

// -- REDUCER --------------------------------------------------

function renumber(frames) {
  return frames.map((f, i) => ({ ...f, number: String(i + 1).padStart(2, "0") }));
}

function applyAction(state, action) {
  switch (action.type) {
    case "SET_DATA":
      // Wholesale replacement — used when a real generateBrief() call
      // returns and we migrate v1 brief shape → v2 data shape. Merging
      // the incoming meta with existing meta lets the BriefForm's
      // typed-in fields (title, client, treatment) override anything
      // the model might guess differently.
      return {
        ...action.data,
        meta: { ...action.data.meta, ...(action.metaOverrides || {}) },
      };
    case "SET_META":
      return { ...state, meta: { ...state.meta, ...action.meta } };
    case "UPDATE_META":
      return { ...state, meta: { ...state.meta, [action.field]: action.value } };
    case "UPDATE_FRAME":
      return { ...state, frames: state.frames.map(f => f.id === action.frameId ? { ...f, [action.field]: action.value } : f) };
    case "UPDATE_FRAME_CAMERA": {
      return {
        ...state,
        frames: state.frames.map(f => {
          if (f.id !== action.frameId) return f;
          const updated = { ...f, ...action.fields };
          updated.camera = deriveCameraText(updated);
          return updated;
        }),
      };
    }
    case "SET_FRAME_IMAGE_STATUS":
      return { ...state, frames: state.frames.map(f => f.id === action.frameId ? { ...f, imageStatus: action.status } : f) };
    case "UPLOAD_FRAME_IMAGE":
      return { ...state, frames: state.frames.map(f => f.id === action.frameId ? { ...f, uploadedImage: action.dataUrl, imageStatus: "uploaded" } : f) };
    case "ADD_FRAME": {
      const maxId = Math.max(0, ...state.frames.map(f => parseInt(f.id.slice(1))));
      const nf = {
        id: "f" + (maxId + 1), number: "00", shotType: "MED", camera: "Static",
        brief: "New frame — describe the shot.", talentIds: [],
        locationId: state.locations[0]?.id || null, productIds: [],
        cameraAngle: "front", cameraHeight: "eye", lens: "normal", movement: "static",
        imageStatus: "placeholder", uploadedImage: null,
      };
      const idx = action.afterFrameId
        ? state.frames.findIndex(f => f.id === action.afterFrameId) + 1
        : state.frames.length;
      const frames = [...state.frames];
      frames.splice(idx, 0, nf);
      return { ...state, frames: renumber(frames) };
    }
    case "DELETE_FRAME":
      if (state.frames.length <= 1) return state;
      return { ...state, frames: renumber(state.frames.filter(f => f.id !== action.frameId)) };
    case "REORDER_FRAMES": {
      const ordered = action.orderedIds.map(id => state.frames.find(f => f.id === id)).filter(Boolean);
      return { ...state, frames: renumber(ordered) };
    }
    case "UPDATE_TALENT": {
      return { ...state, talent: state.talent.map(t => {
        if (t.id !== action.id) return t;
        const updated = { ...t, [action.field]: action.value };
        if (action.field === "name") updated.handle = autoHandle(action.value);
        return updated;
      })};
    }
    case "UPDATE_TALENT_GENERATION":
      return {
        ...state,
        talent: state.talent.map(t => {
          if (t.id !== action.id) return t;
          const u = { ...t, generationStatus: action.status };
          if (action.angles) u.generatedAngles = action.angles;
          return u;
        }),
      };
    case "ADD_TALENT": {
      const mx = Math.max(0, ...state.talent.map(t => parseInt(t.id.slice(1))));
      const merged = { id: "t" + (mx + 1), name: "New Talent", role: "Supporting", initials: "NT", note: "", headshot: null, generatedAngles: null, generationStatus: "idle", ...action.data };
      merged.handle = autoHandle(merged.name);
      return { ...state, talent: [...state.talent, merged] };
    }
    case "DELETE_TALENT": {
      const id = action.id;
      return { ...state, talent: state.talent.filter(t => t.id !== id), frames: state.frames.map(f => ({ ...f, talentIds: f.talentIds.filter(tid => tid !== id) })) };
    }
    case "UPDATE_PRODUCT": {
      return { ...state, products: state.products.map(p => {
        if (p.id !== action.id) return p;
        const updated = { ...p, [action.field]: action.value };
        if (action.field === "name") updated.handle = autoHandle(action.value);
        return updated;
      })};
    }
    case "UPDATE_PRODUCT_GENERATION":
      return { ...state, products: state.products.map(p => {
        if (p.id !== action.id) return p;
        const u = { ...p, generationStatus: action.status };
        if (action.image) u.referenceImage = action.image;
        return u;
      })};
    case "ADD_PRODUCT": {
      const mx = Math.max(0, ...state.products.map(p => parseInt(p.id.slice(1))));
      const merged = { id: "p" + (mx + 1), name: "New Product", category: "Other", hue: "#888888", referenceImage: null, generationStatus: "idle", ...action.data };
      merged.handle = autoHandle(merged.name);
      return { ...state, products: [...state.products, merged] };
    }
    case "DELETE_PRODUCT": {
      const id = action.id;
      return { ...state, products: state.products.filter(p => p.id !== id), frames: state.frames.map(f => ({ ...f, productIds: f.productIds.filter(pid => pid !== id) })) };
    }
    case "UPDATE_LOCATION": {
      return { ...state, locations: state.locations.map(l => {
        if (l.id !== action.id) return l;
        const updated = { ...l, [action.field]: action.value };
        if (action.field === "name") updated.handle = autoHandle(action.value);
        return updated;
      })};
    }
    case "UPDATE_LOCATION_GENERATION":
      return { ...state, locations: state.locations.map(l => {
        if (l.id !== action.id) return l;
        const u = { ...l, generationStatus: action.status };
        if (action.image) u.generatedImage = action.image;
        return u;
      })};
    case "ADD_LOCATION": {
      const mx = Math.max(0, ...state.locations.map(l => parseInt(l.id.slice(1))));
      const merged = { id: "l" + (mx + 1), name: "New Location", handle: "", type: "ai", colors: ["#444", "#555", "#666", "#777"], referenceImage: null, generationStatus: "idle", generatedImage: null, ...action.data };
      merged.handle = autoHandle(merged.name);
      return { ...state, locations: [...state.locations, merged] };
    }
    case "DELETE_LOCATION": {
      const id = action.id;
      return { ...state, locations: state.locations.filter(l => l.id !== id), frames: state.frames.map(f => ({ ...f, locationId: f.locationId === id ? null : f.locationId })) };
    }
    case "UPDATE_BRAND":
      return { ...state, brand: { ...(state.brand || {}), [action.field]: action.value } };
    case "UPLOAD_BRAND_LOGO":
      return { ...state, brand: { ...(state.brand || {}), logo: action.dataUrl } };
    case "ADD_MOOD": {
      const mx = Math.max(0, ...((state.moodBoard || []).map(m => parseInt(String(m.id).slice(1)) || 0)));
      const merged = { id: "m" + (mx + 1), caption: "", image: null, generationStatus: "idle", ...action.data };
      return { ...state, moodBoard: [...(state.moodBoard || []), merged] };
    }
    case "UPDATE_MOOD":
      return { ...state, moodBoard: (state.moodBoard || []).map(m => m.id === action.id ? { ...m, [action.field]: action.value } : m) };
    case "DELETE_MOOD":
      return { ...state, moodBoard: (state.moodBoard || []).filter(m => m.id !== action.id) };
    case "UPLOAD_MOOD_IMAGE":
      return { ...state, moodBoard: (state.moodBoard || []).map(m => m.id === action.id ? { ...m, image: action.dataUrl } : m) };
    case "AUTO_DETECT_MENTIONS": {
      return { ...state, frames: state.frames.map(f => {
        const briefLower = f.brief.toLowerCase();
        const mentionedTalent = state.talent.filter(t => briefLower.includes(t.handle.toLowerCase())).map(t => t.id);
        const mentionedProducts = state.products.filter(p => briefLower.includes(p.handle.toLowerCase())).map(p => p.id);
        return { ...f, talentIds: mentionedTalent, productIds: mentionedProducts };
      })};
    }
    case "AI_APPLY_CHANGES": {
      let s = state;
      for (const c of action.changes) {
        if (c.type === "frame") s = applyAction(s, { type: "UPDATE_FRAME", frameId: c.id, field: c.field, value: c.value });
        if (c.type === "meta") s = applyAction(s, { type: "UPDATE_META", field: c.field, value: c.value });
        if (c.type === "reorder") s = applyAction(s, { type: "REORDER_FRAMES", orderedIds: c.orderedIds });
        if (c.type === "camera") s = applyAction(s, { type: "UPDATE_FRAME_CAMERA", frameId: c.id, fields: c.fields });
      }
      return s;
    }
    default:
      return state;
  }
}

function storyboardReducer(state, action) {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (action.type === "REDO") {
    if (state.future.length === 0) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  const next = applyAction(state.present, action);
  if (next === state.present) return state;
  return { past: [...state.past.slice(-30), state.present], present: next, future: [] };
}

// -- MOCK AI --------------------------------------------------

function mockAI(command, state) {
  const l = command.toLowerCase();
  const changes = [];
  let message = "";

  if (l.includes("gritty") || l.includes("grittier") || l.includes("raw")) {
    state.frames.forEach(f => {
      if (f.movement === "static") changes.push({ type: "camera", id: f.id, fields: { movement: "handheld" } });
    });
    message = "Shifted tone toward grit. Camera loosened to handheld where static. @maya feels rawer now.";
  } else if (l.includes("low angle") || l.includes("lower")) {
    state.frames.forEach(f => {
      if (f.cameraHeight === "eye") changes.push({ type: "camera", id: f.id, fields: { cameraHeight: "low" } });
    });
    message = "Dropped all eye-level cameras to low angle. More power in the frame.";
  } else if (l.includes("wide lens") || l.includes("wider lens")) {
    state.frames.forEach(f => {
      if (f.lens !== "wide") changes.push({ type: "camera", id: f.id, fields: { lens: "wide" } });
    });
    message = "Switched all frames to wide lens (24mm). More context, more environment.";
  } else if (l.includes("tracking") || l.includes("tracking shot")) {
    state.frames.filter(f => f.movement === "static").forEach(f => {
      changes.push({ type: "camera", id: f.id, fields: { movement: "track" } });
    });
    message = "Static shots converted to tracking. More kinetic energy.";
  } else if (l.includes("flip") || l.includes("reverse angle")) {
    state.frames.forEach(f => {
      const flip = { front: "back", back: "front", left: "right", right: "left", "3qL": "3qR", "3qR": "3qL" };
      changes.push({ type: "camera", id: f.id, fields: { cameraAngle: flip[f.cameraAngle] || "back" } });
    });
    message = "Flipped all camera angles. Reversed perspective across the board.";
  } else if (l.includes("desert") || l.includes("highway")) {
    state.frames.filter(f => f.locationId === "l1").forEach(f => {
      const nb = f.brief.replace(/\.$/, "") + ". Later dawn, more amber warmth, distant mountains.";
      changes.push({ type: "frame", id: f.id, field: "brief", value: nb, old: f.brief });
    });
    message = "Desert frames updated. Later dawn, more amber warmth, distant mountains.";
  } else if (l.includes("maya") || l.includes("talent")) {
    state.frames.filter(f => f.talentIds.includes("t1")).forEach(f => {
      const nb = f.brief.replace(/\.$/, "") + ". Less performative, more internal.";
      changes.push({ type: "frame", id: f.id, field: "brief", value: nb, old: f.brief });
    });
    message = "Adjusted @maya's performance across all frames. More internal intensity, less performative.";
  } else if ((l.includes("swap") || l.includes("reorder") || l.includes("move")) && state.frames.length >= 3) {
    const ids = state.frames.map(f => f.id);
    const tmp = ids[1]; ids[1] = ids[2]; ids[2] = tmp;
    changes.push({ type: "reorder", orderedIds: ids });
    message = "Swapped frames 02 and 03. Narrative stakes shifted.";
  } else if (l.includes("add") || l.includes("insert") || l.includes("new frame")) {
    return { changes: [], message: "Added new frame at end of sequence.", addFrame: true };
  } else if (l.includes("product") || l.includes("shoe") || l.includes("boost")) {
    state.frames.filter(f => f.productIds.length > 0).forEach(f => {
      changes.push({ type: "frame", id: f.id, field: "brief", value: f.brief + " Light catches @ultra.", old: f.brief });
    });
    message = "Product emphasis adjusted. @ultra gets more intentional placement.";
  } else {
    message = "Applied. Continuity verified across all frames.";
  }
  return { changes, message };
}

function mockFrameAI(command, frame, state) {
  const l = command.toLowerCase();
  const changes = [];
  let message = "";
  const talents = state.talent.filter(t => frame.talentIds.includes(t.id));
  const talentMention = talents.length > 0 ? talents[0].handle : "";

  if (l.includes("morning") || l.includes("dawn") || l.includes("sunrise")) {
    changes.push({ type: "frame", id: frame.id, field: "brief", value: frame.brief.replace(/\.$/, "") + ". Early morning light rakes across the scene, long shadows, golden warmth.", old: frame.brief });
    message = "Shifted to morning. Golden hour light, long shadows." + (talentMention ? " " + talentMention + " bathed in warm light." : "");
  } else if (l.includes("night") || l.includes("dark") || l.includes("evening")) {
    changes.push({ type: "frame", id: frame.id, field: "brief", value: frame.brief.replace(/\.$/, "") + ". Night. Sodium vapor pools of light. Everything else falls to black.", old: frame.brief });
    message = "Shifted to night. Sodium vapor, pooled light, deep blacks.";
  } else if (l.includes("close") || l.includes("closer") || l.includes("tighter")) {
    const t = { WIDE: "MED", MED: "MCU", MCU: "CU", CU: "ECU", OTS: "CU", POV: "CU", INSERT: "ECU" };
    const ns = t[frame.shotType] || "CU";
    changes.push({ type: "frame", id: frame.id, field: "shotType", value: ns, old: frame.shotType });
    message = "Tightened from " + frame.shotType + " to " + ns + ". More intimacy.";
  } else if (l.includes("wide") || l.includes("wider") || l.includes("pull back")) {
    const t = { ECU: "CU", CU: "MCU", MCU: "MED", MED: "WIDE", OTS: "WIDE", POV: "WIDE", INSERT: "MED" };
    const ns = t[frame.shotType] || "WIDE";
    changes.push({ type: "frame", id: frame.id, field: "shotType", value: ns, old: frame.shotType });
    message = "Pulled back from " + frame.shotType + " to " + ns + ". More context.";
  } else if (l.includes("dramatic") || l.includes("intense") || l.includes("epic")) {
    changes.push({ type: "camera", id: frame.id, fields: { cameraHeight: "low", movement: "steadicam" } });
    message = "Cranked the drama. Low angle, steadicam, epic feel.";
  } else if (l.includes("calm") || l.includes("quiet") || l.includes("still") || l.includes("peaceful")) {
    changes.push({ type: "camera", id: frame.id, fields: { movement: "static", cameraHeight: "eye" } });
    message = "Brought it down. Static camera, stillness.";
  } else if (l.includes("handheld") || l.includes("shaky") || l.includes("doc")) {
    changes.push({ type: "camera", id: frame.id, fields: { movement: "handheld" } });
    message = "Switched to handheld. Documentary feel.";
  } else if (l.includes("low angle") || l.includes("lower")) {
    changes.push({ type: "camera", id: frame.id, fields: { cameraHeight: "low" } });
    message = "Dropped to low angle. More power in the frame.";
  } else if (l.includes("high angle") || l.includes("overhead") || l.includes("bird")) {
    changes.push({ type: "camera", id: frame.id, fields: { cameraHeight: "bird" } });
    message = "Raised to bird's eye. Vulnerability from above.";
  } else if (l.includes("flip") || l.includes("reverse")) {
    const flip = { front: "back", back: "front", left: "right", right: "left", "3qL": "3qR", "3qR": "3qL" };
    changes.push({ type: "camera", id: frame.id, fields: { cameraAngle: flip[frame.cameraAngle] || "back" } });
    message = "Flipped the angle. New perspective on the scene.";
  } else if (l.includes("rain") || l.includes("wet") || l.includes("storm")) {
    changes.push({ type: "frame", id: frame.id, field: "brief", value: frame.brief.replace(/\.$/, "") + ". Rain hammers the pavement. Every surface reflects.", old: frame.brief });
    message = "Added rain. Wet surfaces, reflections, thunder underscore.";
  } else {
    changes.push({ type: "frame", id: frame.id, field: "brief", value: frame.brief.replace(/\.$/, "") + ". " + command.charAt(0).toUpperCase() + command.slice(1) + ".", old: frame.brief });
    message = "Applied to frame " + frame.number + ".";
  }
  return { changes, message };
}

// -- MOCK IMPROVE WITH AI -------------------------------------

function mockImproveText(text, hasImage) {
  if (hasImage) {
    return text.replace(/\.$/, "") + ". Cinematic depth of field, volumetric lighting, photorealistic detail. 8K resolution, anamorphic lens flare.";
  }
  const enhancements = [
    "with visceral texture and emotional weight",
    "through a lens of raw authenticity",
    "where every frame breathes with intention",
  ];
  const pick = enhancements[Math.floor(Math.random() * enhancements.length)];
  return text.replace(/\.$/, "") + " — " + pick + ".";
}

// -- LOCATION THUMBNAIL COMPONENT -----------------------------

function LocationThumb({ loc, size = 32, borderRadius = 6, style = {} }) {
  const img = loc?.referenceImage || loc?.generatedImage;
  if (img) {
    return <img src={img} alt="" style={{ width: size, height: size, borderRadius, objectFit: "cover", flexShrink: 0, display: "block", ...style }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius, flexShrink: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "var(--warm-04)",
      border: "1px solid var(--warm-08)",
      ...style,
    }}>
      <span style={{ fontFamily: "var(--f)", fontSize: Math.max(7, size * 0.25), fontWeight: 500, color: "var(--warm-20)", textAlign: "center", lineHeight: 1.1, padding: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: size - 4 }}>
        {loc?.name?.split(" ")[0] || "Loc"}
      </span>
    </div>
  );
}

// -- PRIMITIVES -----------------------------------------------

function Reveal({ children, delay = 0, y = 24 }) {
  const [on, set] = useState(false);
  useEffect(() => { const t = setTimeout(() => set(true), delay); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      opacity: on ? 1 : 0, transform: on ? "translateY(0)" : `translateY(${y}px)`,
      filter: on ? "blur(0px)" : "blur(4px)", transition: "all 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
    }}>{children}</div>
  );
}

function Tag({ children, lit, onClick }) {
  return (
    <span onClick={onClick} style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 3,
      fontSize: 10, fontWeight: 500, letterSpacing: "0.02em",
      color: lit ? "#fff" : "var(--warm-40)",
      background: lit ? "rgba(255,255,255,0.06)" : "rgba(224,224,224,0.04)",
      border: `1px solid ${lit ? "rgba(255,255,255,0.12)" : "rgba(224,224,224,0.06)"}`,
      cursor: onClick ? "pointer" : "default",
    }}>{children}</span>
  );
}

function EditableText({ value, onChange, multiline, style = {}, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); if (ref.current.select) ref.current.select(); } }, [editing]);
  if (editing) {
    const s = {
      ...style, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 4, padding: multiline ? "8px 10px" : "2px 8px", outline: "none",
      width: "100%", boxSizing: "border-box", fontFamily: "inherit",
      fontSize: style.fontSize || "inherit", fontWeight: style.fontWeight || "inherit",
      color: style.color || "var(--warm)", letterSpacing: style.letterSpacing || "inherit",
      lineHeight: style.lineHeight || "inherit", resize: multiline ? "vertical" : "none",
    };
    const commit = () => { setEditing(false); if (draft !== value) onChange(draft); };
    const cancel = () => { setEditing(false); setDraft(value); };
    const onKey = e => { if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); } if (e.key === "Escape") cancel(); };
    return multiline
      ? <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} style={s} rows={3} />
      : <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} style={s} />;
  }
  return (
    <span onClick={e => { e.stopPropagation(); setEditing(true); }}
      style={{ ...style, cursor: "text", borderRadius: 4, display: multiline ? "block" : undefined }}
      title="Click to edit"
    >{value || <span style={{ opacity: 0.3 }}>{placeholder}</span>}</span>
  );
}

// -- PREMIUM BUTTON -------------------------------------------

function PremiumButton({ children, onClick, disabled, loading, complete, variant = "secondary", style = {}, title }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;

  const base = {
    fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, borderRadius: 8,
    padding: "8px 18px", cursor: isDisabled ? "not-allowed" : "pointer",
    border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all 0.15s cubic-bezier(0.22, 1, 0.36, 1)",
    opacity: isDisabled ? 0.35 : 1,
    transform: pressed && !isDisabled ? "scale(0.97)" : "scale(1)",
    outline: "none", position: "relative", letterSpacing: "-0.01em",
  };

  const variants = {
    primary: {
      background: complete ? "#2a7a2a" : "linear-gradient(180deg, #eee 0%, #ddd 50%, #ccc 100%)",
      color: complete ? "#fff" : "#111",
      boxShadow: hovered && !isDisabled ? "0 2px 8px rgba(255,255,255,0.12)" : "0 1px 3px rgba(255,255,255,0.06)",
    },
    secondary: {
      background: complete ? "rgba(42,122,42,0.15)" : hovered && !isDisabled ? "var(--warm-06)" : "transparent",
      color: complete ? "#6c6" : "var(--warm-50)",
      border: `1px solid ${complete ? "rgba(102,204,102,0.3)" : hovered ? "var(--warm-15)" : "var(--warm-10)"}`,
    },
    danger: {
      background: hovered && !isDisabled ? "rgba(204,68,68,0.08)" : "transparent",
      color: "#c44",
      border: "1px solid rgba(204,68,68,0.2)",
    },
    ghost: {
      background: hovered && !isDisabled ? "var(--warm-04)" : "transparent",
      color: "var(--warm-40)",
      border: "1px solid transparent",
    },
  };

  return (
    <button onClick={isDisabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      title={title}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {loading ? (
        <span style={{ display: "flex", gap: 3 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: 1, background: "currentColor", animation: `pulse 1.2s ease ${i * 0.15}s infinite` }} />)}
        </span>
      ) : complete ? "✓" : children}
    </button>
  );
}

// -- ICON PILL ------------------------------------------------

function IconPill({ label, selected, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: "var(--f)", fontSize: 10, fontWeight: selected ? 600 : 400,
        padding: "5px 10px", borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer",
        border: selected ? "1px solid var(--warm-20)" : "1px solid var(--warm-08)",
        background: selected ? "var(--warm-08)" : hovered && !disabled ? "var(--warm-04)" : "transparent",
        color: selected ? "var(--warm)" : disabled ? "var(--warm-12)" : "var(--warm-35)",
        transition: "all 0.15s ease", opacity: disabled ? 0.35 : 1,
        outline: "none", letterSpacing: "0.01em", whiteSpace: "nowrap",
      }}
    >{label}</button>
  );
}

// -- SECTION ICON (inline SVG icons) --------------------------

function SectionIcon({ name, size = 14, color = "var(--warm-25)" }) {
  const s = { display: "inline-block", verticalAlign: "middle", flexShrink: 0 };
  const icons = {
    camera: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    film: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>,
    grid: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    box: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    map: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    "chevron-down": <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><polyline points="6 9 12 15 18 9"/></svg>,
    "chevron-right": <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><polyline points="9 18 15 12 9 6"/></svg>,
    image: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    sparkle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>,
    prompt: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    sliders: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    link: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    zip: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M21 8v13H3V3h13l5 5z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
    "file-text": <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    sun: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    "pencil-sparkle": <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={s}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="M20 7l1.5 1.5L23 7l-1.5-1.5L20 7z" fill={color} strokeWidth="0.5"/></svg>,
  };
  return icons[name] || null;
}

// -- CHEVRON DROPDOWN -----------------------------------------

function ChevronDropdown({ label, value, options, onChange, style: extraStyle = {} }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={lbl}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", background: "var(--warm-06)", border: "1px solid var(--warm-08)",
            borderRadius: 8, padding: "10px 36px 10px 14px", color: "var(--warm)", fontSize: 13,
            fontWeight: 500, fontFamily: "var(--f)", outline: "none", boxSizing: "border-box",
            letterSpacing: "-0.01em", transition: "border-color 0.2s ease",
            appearance: "none", cursor: "pointer", ...extraStyle,
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", display: "flex", alignItems: "center",
        }}>
          <SectionIcon name="chevron-down" size={14} color="var(--warm-35)" />
        </div>
      </div>
    </div>
  );
}

// -- ASPECT RATIO DROPDOWN (visual icons) -----------------------

function AspectIcon({ ratio, size = 18, color = "var(--warm-30)" }) {
  const dims = { "16:9": [16, 9], "9:16": [9, 16], "2.39": [21, 9], "1:1": [12, 12] };
  const [w, h] = dims[ratio] || [16, 9];
  const scale = size / Math.max(w, h);
  const rw = Math.round(w * scale);
  const rh = Math.round(h * scale);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <rect x={(size - rw) / 2} y={(size - rh) / 2} width={rw} height={rh} rx={1.5} ry={1.5}
        fill="none" stroke={color} strokeWidth={1.2} />
    </svg>
  );
}

function AspectDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div style={{ marginBottom: 14 }} ref={ref}>
      {label && <label style={lbl}>{label}</label>}
      <div style={{ position: "relative" }}>
        <div onClick={() => setOpen(!open)} style={{
          width: "100%", background: "var(--warm-06)", border: "1px solid var(--warm-08)",
          borderRadius: 8, padding: "8px 36px 8px 10px", color: "var(--warm)", fontSize: 13,
          fontWeight: 500, fontFamily: "var(--f)", cursor: "pointer", display: "flex",
          alignItems: "center", gap: 8, boxSizing: "border-box", transition: "border-color 0.2s ease",
        }}>
          <AspectIcon ratio={value} size={18} color="var(--warm-30)" />
          <span>{selected?.label || value}</span>
        </div>
        <div style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", display: "flex", alignItems: "center",
        }}>
          <SectionIcon name="chevron-down" size={14} color="var(--warm-35)" />
        </div>
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
            background: "#151517", border: "1px solid var(--warm-08)", borderRadius: 8,
            overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            {options.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  cursor: "pointer", fontFamily: "var(--f)", fontSize: 12, fontWeight: 400,
                  color: o.value === value ? "#fff" : "var(--warm-35)",
                  background: o.value === value ? "rgba(255,255,255,0.06)" : "transparent",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = "transparent"; }}
              >
                <AspectIcon ratio={o.value} size={20} color={o.value === value ? "#fff" : "var(--warm-25)"} />
                <span>{o.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -- LOCATION DROPDOWN (custom with thumbnail previews) --------

function LocationDropdown({ label, value, locations, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = locations.find(l => l.id === value);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div style={{ marginBottom: 14 }} ref={ref}>
      {label && <label style={lbl}>{label}</label>}
      <div style={{ position: "relative" }}>
        <div
          onClick={() => setOpen(!open)}
          style={{
            width: "100%", background: "var(--warm-06)", border: "1px solid var(--warm-08)",
            borderRadius: 8, padding: "8px 36px 8px 10px", color: "var(--warm)", fontSize: 13,
            fontWeight: 500, fontFamily: "var(--f)", boxSizing: "border-box",
            letterSpacing: "-0.01em", transition: "border-color 0.2s ease",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
            borderColor: open ? "var(--warm-20)" : "var(--warm-08)",
          }}
        >
          {selected ? (
            <>
              <LocationThumb loc={selected} size={24} borderRadius={4} />
              <span>{selected.name}</span>
            </>
          ) : (
            <span style={{ color: "var(--warm-30)" }}>None</span>
          )}
        </div>
        <div style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", display: "flex", alignItems: "center",
        }}>
          <SectionIcon name="chevron-down" size={14} color="var(--warm-35)" />
        </div>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "#151517", border: "1px solid var(--warm-10)", borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden",
            animation: "fadeIn 0.15s ease", maxHeight: 240, overflowY: "auto",
          }}>
            <div
              onClick={() => { onChange(null); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                cursor: "pointer", transition: "background 0.1s ease",
                background: !value ? "rgba(255,255,255,0.06)" : "transparent",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = !value ? "rgba(255,255,255,0.06)" : "transparent"}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 4, background: "var(--warm-06)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-20)" }}>{"—"}</span>
              </div>
              <span style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 400, color: "var(--warm-30)" }}>None</span>
            </div>
            {locations.map(loc => (
              <div
                key={loc.id}
                onClick={() => { onChange(loc.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                  cursor: "pointer", transition: "background 0.1s ease",
                  background: value === loc.id ? "rgba(255,255,255,0.06)" : "transparent",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = value === loc.id ? "rgba(255,255,255,0.06)" : "transparent"}
              >
                <LocationThumb loc={loc} size={24} borderRadius={4} />
                <span style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "var(--warm)" }}>{loc.name}</span>
                <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-20)", marginLeft: "auto" }}>
                  {loc.type === "ai" ? "AI" : "Ref"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -- COLLAPSIBLE SECTION --------------------------------------

function CollapsibleSection({ title, icon, open, onToggle, children, badge }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
        padding: "10px 0", userSelect: "none",
      }}>
        <span style={{
          display: "inline-flex", transition: "transform 0.2s ease",
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
        }}>
          <SectionIcon name="chevron-right" size={12} color="var(--warm-30)" />
        </span>
        {icon && <SectionIcon name={icon} size={13} color="var(--warm-30)" />}
        <span style={{
          fontFamily: "var(--f)", fontSize: 11, fontWeight: 600, color: "var(--warm-30)",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>{title}</span>
        {badge && (
          <span style={{
            fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-15)",
            padding: "1px 6px", borderRadius: 4, border: "1px solid var(--warm-06)",
            letterSpacing: "0.02em", textTransform: "lowercase",
          }}>{badge}</span>
        )}
      </div>
      <div style={{
        maxHeight: open ? 800 : 0, opacity: open ? 1 : 0,
        overflow: "hidden", transition: "max-height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
      }}>
        {children}
      </div>
    </div>
  );
}

// -- GENERATION INDICATOR -------------------------------------

function GenerationIndicator({ status, onRetry }) {
  if (status === "idle") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      {status === "uploading" && (
        <>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--warm-06)", overflow: "hidden" }}>
            <div style={{ width: "60%", height: "100%", borderRadius: 2, background: "var(--warm-25)", animation: "shimmer 1.5s ease infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, var(--warm-15) 0%, var(--warm-30) 50%, var(--warm-15) 100%)" }} />
          </div>
          <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-25)" }}>Uploading...</span>
        </>
      )}
      {status === "generating" && (
        <>
          <div style={{ flex: 1, height: 3, borderRadius: 2, overflow: "hidden", background: "var(--warm-06)" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 2, backgroundImage: "linear-gradient(90deg, var(--warm-08) 0%, var(--warm-20) 50%, var(--warm-08) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s ease infinite" }} />
          </div>
          <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-25)" }}>Generating...</span>
        </>
      )}
      {status === "complete" && (
        <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "#6c6", display: "flex", alignItems: "center", gap: 4, animation: "fadeIn 0.3s ease" }}>{"✓"} Complete</span>
      )}
      {status === "error" && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "#c44" }}>Failed</span>
          {onRetry && <button onClick={onRetry} style={{ fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-30)", background: "none", border: "1px solid var(--warm-10)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>Retry</button>}
        </span>
      )}
    </div>
  );
}

// -- CONFIRM ACTION -------------------------------------------

function ConfirmAction({ label, onConfirm, variant = "danger", style = {} }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 11, color: "var(--warm-30)" }}>Confirm?</span>
        <PremiumButton variant="danger" onClick={() => { onConfirm(); setConfirming(false); }} style={{ padding: "4px 10px", fontSize: 10 }}>Yes, Delete</PremiumButton>
        <PremiumButton variant="ghost" onClick={() => setConfirming(false)} style={{ padding: "4px 10px", fontSize: 10 }}>Cancel</PremiumButton>
      </div>
    );
  }
  return <PremiumButton variant={variant} onClick={() => setConfirming(true)} style={style}>{label}</PremiumButton>;
}

// -- ASSET CONTEXT (for AI chat) ------------------------------

function AssetContext({ asset, type, onDismiss }) {
  const badges = { talent: "T", product: "P", location: "L" };
  return (
    <div style={{ borderRadius: 10, background: "var(--warm-04)", border: "1px solid var(--warm-08)", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px" }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 700, color: "var(--warm-30)", background: "var(--warm-06)", padding: "3px 6px", borderRadius: 3 }}>{badges[type]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 500, color: "var(--warm)" }}>{asset.name}</div>
          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-25)" }}>{asset.handle}</div>
        </div>
        <button onClick={onDismiss} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid var(--warm-08)", background: "transparent", color: "var(--warm-30)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f)", fontSize: 11, flexShrink: 0 }}>&times;</button>
      </div>
    </div>
  );
}

// -- FRAME UPLOAD ZONE (simplified: hidden input + button trigger) --

function FrameUploadZone({ frame, dispatch }) {
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      dispatch({ type: "UPLOAD_FRAME_IMAGE", frameId: frame.id, dataUrl: e.target.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <input ref={fileRef} type="file" hidden accept="image/*" onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
  );
}

// -- ASSET UPLOAD ZONE ----------------------------------------

function AssetUploadZone({ label, hasImage, onUpload }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onUpload(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
      onClick={() => fileRef.current?.click()}
      style={{
        border: `1.5px dashed ${dragOver ? "rgba(255,255,255,0.3)" : "var(--warm-10)"}`,
        borderRadius: 8, padding: "14px 12px", textAlign: "center", cursor: "pointer",
        transition: "all 0.2s ease", marginBottom: 8,
        background: hasImage ? "var(--warm-04)" : dragOver ? "rgba(255,255,255,0.02)" : "transparent",
      }}
    >
      <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 400, color: "var(--warm-25)" }}>
        {hasImage ? "Replace image" : label || "Drop image or click to upload"}
      </div>
      <input ref={fileRef} type="file" hidden accept="image/*" onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

// -- SHEET FRAME (Hollywood storyboard style) -----------------

function SheetFrame({ frame, index, data, aspectCSS = "2.39/1", selected, highlighted, isDragSrc, onDragStart, onDragOver, onDragLeave, onDragEnd, onDrop, onClick }) {
  const [hovered, setHovered] = useState(false);
  const loc = data.locations.find(l => l.id === frame.locationId);
  const prods = data.products.filter(p => frame.productIds.includes(p.id));
  const talents = data.talent.filter(t => frame.talentIds.includes(t.id));
  const lensHint = LENS_TYPES.find(lt => lt.value === frame.lens)?.hint || "";

  return (
    <div
      draggable onDragStart={e => onDragStart(e, frame.id)}
      onDragOver={e => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd} onDrop={onDrop} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8, overflow: "hidden",
        border: selected ? "1px solid var(--warm-20)"
          : highlighted ? "1px solid var(--warm-12)"
          : hovered ? "1px solid var(--warm-08)" : "1px solid var(--warm-04)",
        cursor: isDragSrc ? "grabbing" : "pointer",
        transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
        opacity: isDragSrc ? 0.15 : 1,
        transform: hovered && !isDragSrc ? "translateY(-1px)" : "translateY(0)",
        boxShadow: selected ? "0 2px 20px rgba(0,0,0,0.08)" : hovered ? "0 2px 12px rgba(0,0,0,0.04)" : "none",
        animation: highlighted ? "highlightPulse 1.5s ease" : "none",
        background: "var(--card-bg)",
      }}
    >
      {/* Header bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 10px",
        borderBottom: "1px solid var(--warm-04)",
      }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "var(--warm-35)", letterSpacing: "0.04em" }}>{frame.number}</span>
        <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-20)", letterSpacing: "0.04em" }}>
          {frame.shotType} {"\xB7"} {MOVEMENT_TYPES.find(m => m.value === frame.movement)?.label || "Static"}
        </span>
      </div>

      {/* Clean thumbnail */}
      <div style={{ aspectRatio: aspectCSS, background: FILM[index % FILM.length], position: "relative", overflow: "hidden" }}>
        {frame.uploadedImage && <img src={frame.uploadedImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at center, transparent 0%, rgba(0,0,0,0.4) 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "7%", background: "rgba(0,0,0,0.45)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "7%", background: "rgba(0,0,0,0.45)" }} />
      </div>

      {/* Footer bar -- location name only */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 10px",
        borderTop: "1px solid var(--warm-04)",
      }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-20)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{loc?.name || "—"}</span>
      </div>

      {/* Brief */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-35)", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{frame.brief}</div>
      </div>
    </div>
  );
}

// -- COMPASS WIDGET (SVG camera angle selector) ---------------

function CompassWidget({ value, onChange, size = 100 }) {
  const [hovered, setHovered] = useState(null);
  const cx = 50, cy = 50, r = 42, lr = 28;
  const segments = [
    { key: "back", angle: 0, label: "B" },
    { key: "3qR", angle: 60, label: "\xBER" },
    { key: "right", angle: 120, label: "R" },
    { key: "front", angle: 180, label: "F" },
    { key: "3qL", angle: 240, label: "\xBEL" },
    { key: "left", angle: 300, label: "L" },
  ];
  const d2r = d => d * Math.PI / 180;
  const pt = (angle, rad) => [cx + rad * Math.sin(d2r(angle)), cy - rad * Math.cos(d2r(angle))];

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
      {segments.map(seg => {
        const s = pt(seg.angle - 30, r);
        const e = pt(seg.angle + 30, r);
        const lp = pt(seg.angle, lr);
        const sel = value === seg.key;
        const hov = hovered === seg.key;
        return (
          <g key={seg.key} onClick={() => onChange(seg.key)} onMouseEnter={() => setHovered(seg.key)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
            <path d={`M ${cx} ${cy} L ${s[0]} ${s[1]} A ${r} ${r} 0 0 1 ${e[0]} ${e[1]} Z`}
              fill={sel ? "rgba(255,255,255,0.12)" : hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)"}
              stroke={sel ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.06)"}
              strokeWidth={sel ? 1.5 : 0.5}
              style={{ transition: "all 0.15s ease" }}
            />
            <text x={lp[0]} y={lp[1]} textAnchor="middle" dominantBaseline="central"
              style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: sel ? 700 : 400, fill: sel ? "#fff" : "var(--warm-30)", pointerEvents: "none", userSelect: "none" }}
            >{seg.label}</text>
          </g>
        );
      })}
      {/* Center camera icon */}
      <circle cx={cx} cy={cy} r={8} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: "var(--f)", fontSize: 7, fill: "var(--warm-20)", pointerEvents: "none" }}>{"🎥"}</text>
    </svg>
  );
}

// -- CAMERA CONTROL STRIP (Angle, Height, Lens -- no Movement) -

function CameraControlStrip({ frame, dispatch }) {
  const update = (fields) => dispatch({ type: "UPDATE_FRAME_CAMERA", frameId: frame.id, fields });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Angle + Height side by side */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div>
          <div style={secLabel}>Angle</div>
          <CompassWidget value={frame.cameraAngle} onChange={v => update({ cameraAngle: v })} size={100} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={secLabel}>Height</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CAMERA_HEIGHTS.map(h => (
              <IconPill key={h.value} label={h.label} selected={frame.cameraHeight === h.value} onClick={() => update({ cameraHeight: h.value })} />
            ))}
          </div>
        </div>
      </div>

      {/* Lens */}
      <div>
        <div style={secLabel}>Lens</div>
        <div style={{ display: "flex", gap: 4 }}>
          {LENS_TYPES.map(lt => (
            <button key={lt.value} onClick={() => update({ lens: lt.value })}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: "var(--f)", fontSize: 11, fontWeight: frame.lens === lt.value ? 600 : 400,
                background: frame.lens === lt.value ? "rgba(255,255,255,0.1)" : "var(--warm-04)",
                color: frame.lens === lt.value ? "#fff" : "var(--warm-30)",
                transition: "all 0.15s ease", outline: "none",
              }}
            >
              <div>{lt.label}</div>
              <div style={{ fontSize: 9, fontWeight: 300, color: frame.lens === lt.value ? "var(--warm-40)" : "var(--warm-15)", marginTop: 1 }}>{lt.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- PRODUCTION VIEW (Hero image + dropdowns + collapsible Camera Info) --

function ProductionView({ frame, data, dispatch, onBack, onPrev, onNext, hasPrev, hasNext, onDeleteFrame, onFocusChat }) {
  const [genLoading, setGenLoading] = useState(false);
  const [genComplete, setGenComplete] = useState(false);
  const [cameraInfoOpen, setCameraInfoOpen] = useState(false);
  const [heroHovered, setHeroHovered] = useState(false);
  const fileInputRef = useRef(null);
  const fIdx = data.frames.findIndex(f => f.id === frame.id);
  const update = (field, value) => dispatch({ type: "UPDATE_FRAME", frameId: frame.id, field, value });
  const updateCamera = (fields) => dispatch({ type: "UPDATE_FRAME_CAMERA", frameId: frame.id, fields });
  const lensHint = LENS_TYPES.find(lt => lt.value === frame.lens)?.hint || "";
  const loc = data.locations.find(l => l.id === frame.locationId);
  const hasImage = !!frame.uploadedImage;
  const cameraIsDefault = isCameraDefault(frame);

  const handleGenerate = () => {
    setGenLoading(true);
    dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId: frame.id, status: "generating" });
    setTimeout(() => {
      setGenLoading(false);
      setGenComplete(true);
      dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId: frame.id, status: "generated" });
      setTimeout(() => setGenComplete(false), 2000);
    }, 2000);
  };

  const handleFileUpload = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      dispatch({ type: "UPLOAD_FRAME_IMAGE", frameId: frame.id, dataUrl: e.target.result });
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRefineWithAI = () => {
    if (onFocusChat) onFocusChat();
  };

  // Dynamic aspect ratio
  const asp = data.meta.aspect;
  const aspNum = asp.includes(":") ? (() => { const [w,h] = asp.split(":").map(Number); return w/h; })() : parseFloat(asp);
  const aspCSS = asp.includes(":") ? asp.replace(":", "/") : `${asp}/1`;
  const isPortrait = aspNum < 1;

  return (
    <div style={{ padding: "0 24px 32px", maxWidth: isPortrait ? 1100 : 960, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 20px" }}>
        <PremiumButton variant="ghost" onClick={onBack} style={{ gap: 6, padding: "6px 12px" }}>
          {"←"} Back to One-Sheet
        </PremiumButton>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PremiumButton variant="ghost" onClick={onPrev} disabled={!hasPrev} style={{ padding: "6px 10px" }}>{"←"}</PremiumButton>
          <span style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 500, color: "var(--warm)" }}>Frame {frame.number}</span>
          <PremiumButton variant="ghost" onClick={onNext} disabled={!hasNext} style={{ padding: "6px 10px" }}>{"→"}</PremiumButton>
        </div>
        <div style={{ width: 140 }} />
      </div>

      <Reveal>
        {/* === LAYOUT: portrait → side-by-side, landscape → stacked === */}
        <div style={isPortrait ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3%", alignItems: "start" } : {}}>

        {/* === HERO FRAME IMAGE with overlay actions === */}
        <div
          onMouseEnter={() => setHeroHovered(true)}
          onMouseLeave={() => setHeroHovered(false)}
          style={{
            borderRadius: 12, overflow: "hidden",
            border: "1px solid var(--warm-04)", marginBottom: isPortrait ? 0 : 20, position: "relative",
            transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
            boxShadow: heroHovered ? "0 2px 24px rgba(0,0,0,0.08)" : "none",
          }}
        >
          <div style={{ aspectRatio: aspCSS, background: FILM[fIdx >= 0 ? fIdx % FILM.length : 0], position: "relative", overflow: "hidden" }}>
            {frame.uploadedImage && <img src={frame.uploadedImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at center, transparent 0%, rgba(0,0,0,0.4) 100%)" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6%", background: "rgba(0,0,0,0.5)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "6%", background: "rgba(0,0,0,0.5)" }} />
            {frame.imageStatus === "generating" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--f)", fontSize: 14, color: "var(--warm-25)", animation: "pulse 1.5s ease infinite" }}>Generating...</span>
              </div>
            )}
            {frame.imageStatus === "generated" && !heroHovered && (
              <div style={{ position: "absolute", top: 10, right: 10, fontFamily: "var(--f)", fontSize: 10, color: "#6c6", background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: 4 }}>{"✓"} Generated</div>
            )}
            {/* Hover overlay with action buttons */}
            {heroHovered && frame.imageStatus !== "generating" && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                transition: "all 0.2s ease", animation: "fadeIn 0.15s ease",
              }}>
                {!hasImage ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); handleGenerate(); }} style={{
                      fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "#fff",
                      background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s ease", outline: "none",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}>
                      <SectionIcon name="sparkle" size={14} color="#fff" /> Generate Image
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); triggerUpload(); }} style={{
                      fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "var(--warm-60)",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s ease", outline: "none",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}>
                      <SectionIcon name="upload" size={14} color="var(--warm-60)" /> Upload Image
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); handleRefineWithAI(); }} style={{
                      fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "#fff",
                      background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s ease", outline: "none",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}>
                      <SectionIcon name="sparkle" size={14} color="#fff" /> Edit Image
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); triggerUpload(); }} style={{
                      fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "var(--warm-60)",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s ease", outline: "none",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}>
                      <SectionIcon name="upload" size={14} color="var(--warm-60)" /> Replace Image
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {/* Frame info bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 14px", background: "rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {loc && <LocationThumb loc={loc} size={16} borderRadius={3} />}
              <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{loc?.name || "—"}</span>
            </div>
            <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, color: "var(--warm-15)" }}>
              {frame.shotType} {"\xB7"} {frame.camera}{lensHint ? ` \xB7 ${lensHint}` : ""}
            </span>
          </div>
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }} />
        </div>

        {/* === FIELDS (right column in portrait, below in landscape) === */}
        <div>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--warm-04)", borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
          {/* Description (renamed from Brief) */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Description</label>
            <textarea value={frame.brief} onChange={e => update("brief", e.target.value)} style={{ ...inp, minHeight: 90, resize: "vertical", lineHeight: 1.75 }} />
          </div>

          {/* Shot Type + Camera Movement side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ChevronDropdown
              label="Shot Type"
              value={frame.shotType}
              options={SHOT_TYPES.map(s => ({ value: s, label: s }))}
              onChange={v => update("shotType", v)}
            />
            <ChevronDropdown
              label="Camera Movement"
              value={frame.movement}
              options={MOVEMENT_TYPES.map(m => ({ value: m.value, label: m.label }))}
              onChange={v => updateCamera({ movement: v })}
            />
          </div>

          {/* Location dropdown with thumbnails */}
          <LocationDropdown
            label="Location"
            value={frame.locationId || ""}
            locations={data.locations}
            onChange={v => update("locationId", v || null)}
          />

          {/* === CAMERA INFO (Collapsible, optional) === */}
          <CollapsibleSection
            title="Camera Info"
            icon="camera"
            open={cameraInfoOpen}
            onToggle={() => setCameraInfoOpen(!cameraInfoOpen)}
            badge={cameraIsDefault ? "optional" : null}
          >
            <div style={{ padding: "4px 0 8px" }}>
              <CameraControlStrip frame={frame} dispatch={dispatch} />
            </div>
          </CollapsibleSection>
        </div>

        {/* Delete frame */}
        <ConfirmAction label="Delete Frame" onConfirm={() => onDeleteFrame(frame.id)} variant="danger" style={{ padding: "6px 14px", fontSize: 11 }} />
        </div>
        </div>{/* close portrait grid wrapper */}
      </Reveal>
    </div>
  );
}

// -- ASSET TAB BUTTON (left-rail vertical row) -----------------

function AssetTabButton({ tab, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const bg = isActive ? "var(--warm-08)" : hovered ? "var(--warm-04)" : "transparent";
  const accent = isActive ? "var(--warm)" : hovered ? "var(--warm-50)" : "var(--warm-30)";
  const iconColor = isActive ? "var(--warm)" : hovered ? "var(--warm-40)" : "var(--warm-25)";
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "10px 12px",
        borderRadius: 8, cursor: "pointer",
        outline: "none", border: "none",
        fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
        background: bg,
        color: accent,
        textAlign: "left",
        position: "relative",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      {/* Left edge accent on active */}
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: 6, bottom: 6, width: 2,
          background: "var(--warm-40)", borderRadius: 1,
        }} />
      )}
      <SectionIcon name={tab.icon} size={14} color={iconColor} />
      <span style={{ flex: 1 }}>{tab.label}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 20, height: 18, padding: "0 5px", borderRadius: 9,
        background: isActive ? "var(--warm-12)" : "var(--warm-06)",
        fontFamily: "var(--f)", fontSize: 10, fontWeight: 600,
        color: isActive ? "var(--warm-50)" : "var(--warm-25)",
        flexShrink: 0, lineHeight: 1,
      }}>{tab.count}</span>
    </button>
  );
}

// -- BRAND PANEL (single-record panel, not array) ---------------
// Logo upload + name + URL + guidelines. Sits inside the Brand tab.

function BrandPanel({ brand, dispatch }) {
  const fileRef = useRef(null);
  const logo = brand?.logo;

  function onLogoFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => dispatch({ type: "UPLOAD_BRAND_LOGO", dataUrl: e.target.result });
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Logo upload zone — square */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); onLogoFile(e.dataTransfer.files?.[0]); }}
          style={{
            width: 96, height: 96, borderRadius: 10, cursor: "pointer",
            background: logo ? `url(${logo}) center/contain no-repeat var(--warm-04)` : "var(--warm-04)",
            border: "1px dashed var(--warm-10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "border-color 0.15s ease",
          }}
        >
          {!logo && (
            <div style={{ textAlign: "center", padding: 6 }}>
              <SectionIcon name="upload" size={14} color="var(--warm-25)" />
              <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-25)", marginTop: 4 }}>Upload logo</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { onLogoFile(e.target.files?.[0]); e.target.value = ""; }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div>
            <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Brand name</label>
            <input
              value={brand?.name || ""}
              onChange={e => dispatch({ type: "UPDATE_BRAND", field: "name", value: e.target.value })}
              placeholder="Brand name"
              style={{ width: "100%", fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, padding: "7px 10px", border: "1px solid var(--warm-08)", borderRadius: 6, background: "var(--warm-04)", color: "var(--warm)", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL</label>
            <input
              value={brand?.url || ""}
              onChange={e => dispatch({ type: "UPDATE_BRAND", field: "url", value: e.target.value })}
              placeholder="nike.com"
              style={{ width: "100%", fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, padding: "7px 10px", border: "1px solid var(--warm-08)", borderRadius: 6, background: "var(--warm-04)", color: "var(--warm)", outline: "none" }}
            />
          </div>
        </div>
      </div>
      <div>
        <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Guidelines</label>
        <textarea
          value={brand?.guidelines || ""}
          onChange={e => dispatch({ type: "UPDATE_BRAND", field: "guidelines", value: e.target.value })}
          placeholder="Brand voice, tone, dos and don'ts…"
          rows={3}
          style={{ width: "100%", fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, lineHeight: 1.6, padding: "8px 10px", border: "1px solid var(--warm-08)", borderRadius: 6, background: "var(--warm-04)", color: "var(--warm-40)", outline: "none", resize: "vertical" }}
        />
      </div>
    </div>
  );
}

// -- MOOD PANEL (image grid) ------------------------------------
// Visual references for tone, palette, composition. Click a tile to
// upload an image; type a caption to describe what the reference is
// pointing at.

function MoodPanel({ moodBoard, dispatch }) {
  const addBtnRef = useRef(null);

  function onTileUpload(id, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => dispatch({ type: "UPLOAD_MOOD_IMAGE", id, dataUrl: e.target.result });
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {moodBoard.map(m => (
          <MoodTile key={m.id} item={m} dispatch={dispatch} onUpload={onTileUpload} />
        ))}
        <button
          ref={addBtnRef}
          onClick={() => dispatch({ type: "ADD_MOOD", data: {} })}
          style={{
            aspectRatio: "1/1", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1px dashed var(--warm-10)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            color: "var(--warm-25)", outline: "none",
          }}
        >
          <SectionIcon name="plus" size={14} color="var(--warm-25)" />
          <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, letterSpacing: "0.02em" }}>Add reference</span>
        </button>
      </div>
      {moodBoard.length === 0 && (
        <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 400, color: "var(--warm-25)", textAlign: "center", marginTop: 10, lineHeight: 1.6 }}>
          Drop in mood references — color palettes, film stills, photos. They guide tone without driving generation directly.
        </div>
      )}
    </div>
  );
}

function MoodTile({ item, dispatch, onUpload }) {
  const fileRef = useRef(null);
  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); onUpload(item.id, e.dataTransfer.files?.[0]); }}
        style={{
          aspectRatio: "1/1", borderRadius: 8, cursor: "pointer",
          background: item.image ? `url(${item.image}) center/cover` : "var(--warm-04)",
          border: "1px solid var(--warm-08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {!item.image && <SectionIcon name="image" size={16} color="var(--warm-20)" />}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { onUpload(item.id, e.target.files?.[0]); e.target.value = ""; }} />
      <input
        value={item.caption || ""}
        onChange={e => dispatch({ type: "UPDATE_MOOD", id: item.id, field: "caption", value: e.target.value })}
        placeholder="Caption…"
        style={{ width: "100%", marginTop: 4, fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, padding: "3px 5px", border: "none", background: "transparent", color: "var(--warm-35)", outline: "none" }}
      />
      <button
        onClick={() => dispatch({ type: "DELETE_MOOD", id: item.id })}
        title="Remove"
        style={{
          position: "absolute", top: 3, right: 3,
          width: 18, height: 18, borderRadius: 4,
          background: "rgba(0,0,0,0.5)", border: "none", color: "#fff",
          fontSize: 10, cursor: "pointer", opacity: 0,
          transition: "opacity 0.15s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}
      >×</button>
    </div>
  );
}

// -- ASSET EXPANDED PANEL (scrollable with fade hints) ----------

function AssetExpandedPanel({ activeTab, data, dispatch, expanded, setExpanded, typeKey, onAIAssist }) {
  const scrollRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll, { passive: true });
    return () => { if (el) el.removeEventListener("scroll", checkScroll); };
  }, [activeTab, expanded, checkScroll]);

  // Re-check after images load or content changes
  useEffect(() => {
    const t = setTimeout(checkScroll, 200);
    return () => clearTimeout(t);
  }, [data.talent, data.products, data.locations, expanded, checkScroll]);

  // Brand and Mood don't fit the array-of-cards pattern — they get
  // their own panels. Branch before the items map so the existing
  // Talent / Products / Locations rendering stays untouched.
  if (activeTab === "brand") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <BrandPanel brand={data.brand} dispatch={dispatch} />
      </div>
    );
  }
  if (activeTab === "mood") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <MoodPanel moodBoard={data.moodBoard || []} dispatch={dispatch} />
      </div>
    );
  }

  const items = activeTab === "talent" ? data.talent : activeTab === "products" ? data.products : data.locations;

  return (
    <div style={{
      position: "relative",
      animation: "fadeIn 0.2s ease",
    }}>
      {/* Top fade */}
      {canScrollUp && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 32,
          background: "linear-gradient(to bottom, var(--bg), transparent)",
          zIndex: 2, pointerEvents: "none", borderRadius: "8px 8px 0 0",
        }} />
      )}
      {/* Scrollable content */}
      <div ref={scrollRef} style={{
        maxHeight: 480, overflowY: "auto", padding: "12px 0",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(item => (
            <AssetCard key={item.id} item={item} category={activeTab} data={data} dispatch={dispatch}
              isExpanded={expanded === item.id} onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              onAIAssist={onAIAssist} />
          ))}
          <PremiumButton variant="secondary" onClick={() => dispatch({ type: `ADD_${typeKey}`, data: {} })} style={{ width: "100%", marginTop: 4 }}>
            <SectionIcon name="plus" size={12} color="var(--warm-50)" /> Add {activeTab === "talent" ? "Character" : activeTab === "products" ? "Element" : "Location"}
          </PremiumButton>
        </div>
      </div>
      {/* Bottom fade */}
      {canScrollDown && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 32,
          background: "linear-gradient(to top, var(--bg), transparent)",
          zIndex: 2, pointerEvents: "none", borderRadius: "0 0 8px 8px",
        }} />
      )}
    </div>
  );
}

// -- ASSET TAB BAR (left-rail nav + right content) -------------
// Restructured per Logan 2026-05-27: instead of a horizontal pill bar
// with content stacked below, the asset section is now a tall 2-column
// container — vertical tab stack on the left, persistent content on the
// right. Brand Info opens by default. Clicking a tab switches the
// right pane (no toggle-to-close — something is always selected).

function AssetTabBar({ data, dispatch, activeTab, onToggleTab, onAIAssist }) {
  const [expanded, setExpanded] = useState(null);

  const tabs = [
    { key: "brand", label: "Brand", icon: "link", count: data.brand?.logo ? 1 : 0 },
    { key: "talent", label: "Characters", icon: "users", count: data.talent.length },
    { key: "products", label: "Elements", icon: "box", count: data.products.length },
    { key: "locations", label: "Locations", icon: "map", count: data.locations.length },
    { key: "mood", label: "Mood", icon: "image", count: (data.moodBoard || []).length },
  ];

  const typeKey = { talent: "TALENT", products: "PRODUCT", locations: "LOCATION", brand: "BRAND", mood: "MOOD" }[activeTab] || "TALENT";

  return (
    <div style={{ borderTop: "1px solid var(--warm-06)", marginTop: 20, paddingTop: 16 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: 20,
        minHeight: 520,
        borderRadius: 12,
        background: "var(--warm-04)",
        border: "1px solid var(--warm-06)",
        padding: 12,
      }}>
        {/* LEFT RAIL — vertical tab stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {tabs.map(tab => (
            <AssetTabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onClick={() => onToggleTab(tab.key)}
            />
          ))}
        </div>

        {/* RIGHT PANE — selected tab content */}
        <div style={{
          borderLeft: "1px solid var(--warm-06)",
          paddingLeft: 20,
          minWidth: 0,
        }}>
          <AssetExpandedPanel
            activeTab={activeTab}
            data={data}
            dispatch={dispatch}
            expanded={expanded}
            setExpanded={setExpanded}
            typeKey={typeKey}
            onAIAssist={onAIAssist}
          />
        </div>
      </div>
    </div>
  );
}

// -- ONE-SHEET WORKSPACE (drag-drop grid) ---------------------

function OneSheetWorkspace({ data, selectedFrameId, highlightedFrames, onSelectFrame, onUpdateMeta, dispatch, assetTabOpen, onToggleAssetTab, onAIAssist }) {
  const [dragId, setDragId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null); // insertion index (0..frames.length)
  const didDrag = useRef(false);
  const [brandHovered, setBrandHovered] = useState(false);
  const [treatmentExpanded, setTreatmentExpanded] = useState(false);

  const dragRef = useRef({ id: null, targetPos: null });
  const dragGhostRef = useRef(null);

  const onDS = (e, id) => {
    setDragId(id); dragRef.current.id = id; dragRef.current.targetPos = null;
    didDrag.current = true; e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);

    // Build a polished drag preview
    const frame = data.frames.find(f => f.id === id);
    const idx = data.frames.findIndex(f => f.id === id);
    const ghost = document.createElement("div");
    ghost.style.cssText = `
      width: 180px; border-radius: 10px; overflow: hidden;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
      transform: rotate(-2deg) scale(1.04); opacity: 0.95;
      font-family: Inter, system-ui, sans-serif; background: #1a1a1e;
    `;
    // Header
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04);";
    hdr.innerHTML = `<span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.04em">${frame?.number || ""}</span><span style="font-size:8px;color:rgba(255,255,255,0.25)">Moving…</span>`;
    ghost.appendChild(hdr);
    // Thumbnail
    const thumb = document.createElement("div");
    const bg = frame?.uploadedImage ? `url(${frame.uploadedImage}) center/cover` : (FILM[idx % FILM.length] || FILM[0]);
    thumb.style.cssText = `aspect-ratio: 2.39/1; background: ${bg}; position: relative;`;
    // Film bars
    thumb.innerHTML = `<div style="position:absolute;top:0;left:0;right:0;height:7%;background:rgba(0,0,0,0.5)"></div><div style="position:absolute;bottom:0;left:0;right:0;height:7%;background:rgba(0,0,0,0.5)"></div>`;
    ghost.appendChild(thumb);
    // Brief snippet
    if (frame?.brief) {
      const br = document.createElement("div");
      br.style.cssText = "padding: 6px 10px; font-size: 8px; color: rgba(255,255,255,0.3); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
      br.textContent = frame.brief.substring(0, 60);
      ghost.appendChild(br);
    }
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 90, 30);
    dragGhostRef.current = ghost;
    requestAnimationFrame(() => { if (dragGhostRef.current) { dragGhostRef.current.style.position = "fixed"; dragGhostRef.current.style.left = "-9999px"; } });
  };
  const onDO = (e, index) => {
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!dragRef.current.id) return;
    // Entire frame is one drop zone — hover triggers immediately
    if (index !== dragRef.current.targetPos) {
      dragRef.current.targetPos = index;
      setDropIndex(index);
    }
  };
  const onDL = () => {};
  const commitDrop = () => {
    const did = dragRef.current.id;
    const tp = dragRef.current.targetPos;
    if (!did || tp === null) return;
    const ids = data.frames.map(f => f.id);
    const from = ids.indexOf(did);
    if (from === -1 || from === tp) return;
    // "Move to HERE": remove from original spot, insert at target position
    const item = ids.splice(from, 1)[0];
    ids.splice(tp, 0, item);
    dispatch({ type: "REORDER_FRAMES", orderedIds: ids });
  };
  const cleanupDrag = () => {
    if (dragGhostRef.current) { dragGhostRef.current.remove(); dragGhostRef.current = null; }
    dragRef.current = { id: null, targetPos: null };
    setDragId(null); setDropIndex(null);
  };
  const onDr = (e) => {
    e.preventDefault(); e.stopPropagation();
    commitDrop();
    cleanupDrag();
  };
  const onDE = () => {
    cleanupDrag();
    setTimeout(() => { didDrag.current = false; }, 50);
  };
  const clickF = (id) => { if (!didDrag.current) onSelectFrame(id); };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 32px" }}>
      <Reveal>
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <SectionIcon name="film" size={11} color="var(--warm-25)" />
                <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.15em", textTransform: "uppercase" }}>Storyboard</span>
              </div>
              <EditableText value={data.meta.title} onChange={v => onUpdateMeta("title", v)}
                style={{ fontFamily: "var(--f)", fontSize: 32, fontWeight: 700, color: "var(--warm)", letterSpacing: "-0.03em", display: "block", lineHeight: 1.1 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <span style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 400, color: "var(--warm-30)" }}>:{data.meta.format}</span>
                <span style={{ color: "var(--warm-12)" }}>&middot;</span>
                <span style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 400, color: "var(--warm-30)" }}>{data.meta.aspect === "2.39" ? "2.39:1 Anamorphic" : data.meta.aspect}</span>
              </div>
            </div>
            <div style={{ paddingTop: 6 }}>
              <span
                onMouseEnter={() => setBrandHovered(true)}
                onMouseLeave={() => setBrandHovered(false)}
                style={{
                  fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
                  color: brandHovered ? "var(--warm-40)" : "var(--warm-25)",
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "5px 12px", borderRadius: 6,
                  background: brandHovered ? "var(--warm-06)" : "var(--warm-04)",
                  border: brandHovered ? "1px solid var(--warm-10)" : "1px solid var(--warm-06)",
                  cursor: "pointer", transition: "all 0.15s ease",
                }}
              >{data.meta.client}</span>
            </div>
          </div>

          {/* Treatment */}
          <div style={{ borderTop: "1px solid var(--warm-06)", margin: "20px 0", padding: "20px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <SectionIcon name="file-text" size={11} color="var(--warm-25)" />
              <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Brief</span>
            </div>
            {(() => {
              const treatmentText = data.meta.treatment || "";
              const isLong = treatmentText.length > 450;
              return (
                <div>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      maxHeight: (!isLong || treatmentExpanded) ? "none" : 96,
                      overflow: "hidden",
                      transition: "max-height 0.35s cubic-bezier(0.22,1,0.36,1)",
                      ...(isLong && !treatmentExpanded ? {
                        maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
                      } : {}),
                    }}>
                      <EditableText value={treatmentText} onChange={v => onUpdateMeta("treatment", v)} multiline
                        style={{ fontFamily: "var(--f)", fontSize: 15, fontWeight: 300, color: "var(--warm-40)", lineHeight: 1.85, display: "block" }}
                        placeholder="Write a brief treatment..." />
                    </div>
                  </div>
                  {isLong && (
                    <button onClick={() => setTreatmentExpanded(!treatmentExpanded)} style={{
                      fontFamily: "var(--f)", fontSize: 11, fontWeight: 500, color: "var(--warm-30)",
                      background: "none", border: "none", cursor: "pointer", padding: "8px 0 0",
                      outline: "none", transition: "color 0.15s ease",
                    }}>{treatmentExpanded ? "Show less" : "Show more"}</button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Asset Tab Bar */}
          <AssetTabBar data={data} dispatch={dispatch} activeTab={assetTabOpen}
            onToggleTab={onToggleAssetTab} onAIAssist={onAIAssist} />

          {/* Frame Grid */}
          {(() => {
            const asp = data.meta.aspect;
            const aspNum = asp.includes(":") ? (() => { const [w,h] = asp.split(":").map(Number); return w/h; })() : parseFloat(asp);
            const aspCSS = asp.includes(":") ? asp.replace(":", "/") : `${asp}/1`;
            const cols = aspNum < 1 ? 4 : 3;
            return (
          <div style={{ borderTop: "1px solid var(--warm-06)", paddingTop: 20, marginTop: 16 }}>
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={onDr}
              style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}
            >
              {(() => {
                const dragIdx = dragId ? data.frames.findIndex(f => f.id === dragId) : -1;
                const showPlaceholder = dragId && dropIndex !== null && dropIndex !== dragIdx;

                const dropPreview = (
                  <div key="__drop-preview"
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={onDr}
                    style={{
                      borderRadius: 8, overflow: "hidden",
                      border: "1.5px dashed var(--warm-15)",
                      background: "linear-gradient(135deg, var(--warm-04), rgba(255,255,255,0.02))",
                      minHeight: 100,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}>
                    <span style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.04em" }}>
                      {data.frames[dragIdx]?.number || ""}
                    </span>
                    <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-12)", letterSpacing: "0.02em" }}>
                      Release to place
                    </span>
                  </div>
                );

                if (!showPlaceholder) {
                  return data.frames.map((f, i) => (
                    <SheetFrame key={f.id} frame={f} index={i} data={data} aspectCSS={aspCSS}
                      selected={selectedFrameId === f.id} highlighted={highlightedFrames.has(f.id)}
                      isDragSrc={dragId === f.id}
                      onDragStart={onDS} onDragOver={onDO} onDragLeave={onDL} onDragEnd={onDE} onDrop={onDr}
                      onClick={() => clickF(f.id)} />
                  ));
                }

                // Build reordered view: drag source removed, placeholder at target position
                const remaining = data.frames.filter(f => f.id !== dragId);
                const insertAt = Math.max(0, Math.min(dropIndex, remaining.length));

                const items = [];
                remaining.forEach((f, i) => {
                  if (i === insertAt) items.push(dropPreview);
                  const origIdx = data.frames.indexOf(f);
                  items.push(
                    <SheetFrame key={f.id} frame={f} index={origIdx} data={data} aspectCSS={aspCSS}
                      selected={selectedFrameId === f.id} highlighted={highlightedFrames.has(f.id)}
                      isDragSrc={false}
                      onDragStart={onDS} onDragOver={onDO} onDragLeave={onDL} onDragEnd={onDE} onDrop={onDr}
                      onClick={() => clickF(f.id)} />
                  );
                });
                if (insertAt >= remaining.length) items.push(dropPreview);
                return items;
              })()}
              <div
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragRef.current.id) { const endPos = data.frames.length - 1; if (endPos !== dragRef.current.targetPos) { dragRef.current.targetPos = endPos; setDropIndex(endPos); } } }}
                onDrop={onDr}
                onClick={() => dispatch({ type: "ADD_FRAME" })}
                style={{
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", minHeight: 120, transition: "all 0.25s ease",
                  border: "1px dashed var(--warm-06)",
                  background: "transparent",
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 200, color: "var(--warm-15)" }}>+</span>
              </div>
            </div>
          </div>
            );
          })()}

          {/* Footer */}
          <div style={{ borderTop: "1px solid var(--warm-06)", marginTop: 20, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <WLogo color="var(--warm-10)" size={12} />
            <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-15)" }}>Wonder AI</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// -- CHAT: MESSAGE WITH @ MENTIONS ----------------------------

function parseMentions(text, data) {
  const allAssets = [
    ...data.talent.map(t => ({ ...t, _type: "talent" })),
    ...data.products.map(p => ({ ...p, _type: "product" })),
    ...data.locations.map(l => ({ ...l, _type: "location" })),
  ];
  const parts = [];
  const regex = /(^|\s)(@\w+)/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(last, match.index + match[1].length);
    if (before) parts.push({ type: "text", value: before });
    const handle = match[2];
    const asset = allAssets.find(a => a.handle === handle);
    parts.push({ type: "mention", handle, asset, matched: !!asset });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function ChatMessage({ message: m, data, onMentionClick }) {
  if (m.role === "system") {
    return <div style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 300, color: "var(--warm-25)", lineHeight: 1.65, padding: "4px 0" }}>{m.text}</div>;
  }

  const renderText = (text) => {
    const parts = parseMentions(text, data);
    return parts.map((p, i) => {
      if (p.type === "mention") {
        return (
          <span key={i} onClick={p.matched ? () => onMentionClick(p.asset) : undefined}
            style={{
              background: p.matched ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              color: p.matched ? "#fff" : "var(--warm-20)",
              padding: "1px 6px", borderRadius: 4, fontWeight: 500,
              cursor: p.matched ? "pointer" : "default",
              transition: "background 0.15s ease",
            }}
          >{p.handle}</span>
        );
      }
      return <span key={i}>{p.value}</span>;
    });
  };

  if (m.role === "user") {
    return (
      <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--warm-06)" }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, color: "var(--warm-60)", lineHeight: 1.5 }}>{renderText(m.text)}</div>
        {m.frameId && <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, color: "var(--warm-15)", marginTop: 4 }}>Frame {m.frameNumber || "?"}</div>}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 4px" }}>
      <div style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, color: "var(--warm-40)", lineHeight: 1.6 }}>{renderText(m.text)}</div>
      {m.changes && m.changes.length > 0 && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--warm-06)" }}>
          <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Changes</div>
          {m.changes.map((c, j) => {
            const fr = data.frames.find(f => f.id === c.id);
            const label = c.type === "camera" ? "camera" : c.field;
            return <div key={j} style={{ fontFamily: "var(--f)", fontSize: 11, color: "var(--warm-20)", marginBottom: 2 }}>Frame {fr?.number || "?"} {"\xB7"} {label}</div>;
          })}
        </div>
      )}
    </div>
  );
}

// -- MENTION POPUP --------------------------------------------

function MentionPopup({ query, data, onSelect, onClose, selectedIndex }) {
  const allAssets = [
    ...data.talent.map(t => ({ ...t, _type: "talent", _badge: "T" })),
    ...data.products.map(p => ({ ...p, _type: "product", _badge: "P" })),
    ...data.locations.map(l => ({ ...l, _type: "location", _badge: "L" })),
  ];
  const q = query.toLowerCase();
  const filtered = allAssets.filter(a =>
    a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes("@" + q) || a.handle.toLowerCase().includes(q)
  );
  if (filtered.length === 0) return null;

  return (
    <div style={{
      position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4,
      background: "#151517", border: "1px solid var(--warm-10)", borderRadius: 10,
      boxShadow: "0 -8px 32px rgba(0,0,0,0.4)", overflow: "hidden",
      animation: "fadeIn 0.15s ease", maxHeight: 200, overflowY: "auto",
    }}>
      {filtered.map((a, i) => (
        <div key={a.id} onClick={() => onSelect(a)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
            cursor: "pointer", transition: "background 0.1s ease",
            background: i === selectedIndex ? "rgba(255,255,255,0.06)" : "transparent",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          onMouseLeave={e => e.currentTarget.style.background = i === selectedIndex ? "rgba(255,255,255,0.06)" : "transparent"}
        >
          <span style={{
            fontFamily: "var(--f)", fontSize: 9, fontWeight: 700, color: "var(--warm-30)",
            background: "var(--warm-06)", padding: "2px 5px", borderRadius: 3, letterSpacing: "0.02em",
          }}>{a._badge}</span>
          <span style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "var(--warm)" }}>{a.name}</span>
          <span style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-20)" }}>{a.handle}</span>
        </div>
      ))}
    </div>
  );
}

// -- FRAME CONTEXT (simplified) -------------------------------

function FrameContext({ frame, data, onDismiss, onOpenProduction }) {
  if (!frame) return null;
  const fIdx = data.frames.findIndex(f => f.id === frame.id);

  return (
    <div style={{ borderRadius: 10, background: "var(--warm-04)", border: "1px solid var(--warm-08)", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px" }}>
        <div style={{
          width: 52, height: 22, borderRadius: 4, flexShrink: 0, position: "relative", overflow: "hidden",
          background: FILM[fIdx >= 0 ? fIdx % FILM.length : 0],
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8%", background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8%", background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: 600, color: "var(--warm-20)" }}>{frame.number}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 500, color: "var(--warm)" }}>Frame {frame.number} {"\xB7"} {frame.shotType}</div>
          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{!isCameraDefault(frame) ? frame.camera : ""}</div>
        </div>
        <PremiumButton variant="ghost" onClick={onOpenProduction} style={{ padding: "4px 8px", fontSize: 10, gap: 4 }}>
          <SectionIcon name="edit" size={10} color="var(--warm-40)" /> Edit
        </PremiumButton>
        <button onClick={onDismiss} style={{
          width: 20, height: 20, borderRadius: 4, border: "1px solid var(--warm-08)",
          background: "transparent", color: "var(--warm-30)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f)", fontSize: 11, flexShrink: 0,
        }}>&times;</button>
      </div>
    </div>
  );
}

// -- CHAT ICON BUTTON (with hover state) -------------------------

function ChatIconButton({ onClick, disabled, title, active, muted, pulsing, children, size = 24, borderRadius: br = 5 }) {
  const [hovered, setHovered] = useState(false);
  const showHover = (active || muted) && hovered && !disabled;
  return (
    <button onClick={disabled ? undefined : onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: size, height: size, borderRadius: br, border: "none",
        background: showHover ? "var(--hover-fill)" : active ? "var(--warm-06)" : "transparent",
        color: showHover ? "var(--hover-text)" : active ? "var(--warm)" : muted ? "var(--warm-25)" : "var(--warm-10)",
        cursor: active ? "pointer" : muted ? "default" : "default",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s ease", outline: "none", flexShrink: 0,
        opacity: active ? 1 : muted ? 0.6 : 0.3,
        animation: pulsing ? "pulse 0.6s ease infinite" : "none",
      }}
    >{children}</button>
  );
}

// -- AI CHAT PANEL (with @ mentions + asset context + improve button) --

function AIChatPanel({ data, dispatch, chatMessages, chatBusy, selectedFrameId, onSendMessage, onDismissFrame, onOpenProduction, onMentionClick, chatAssetContext, onDismissAssetContext, chatFocusTrigger }) {
  const [val, setVal] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const [improving, setImproving] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const selectedFrame = selectedFrameId ? data.frames.find(f => f.id === selectedFrameId) : null;

  // Resolve asset context
  const assetContextResolved = chatAssetContext ? (() => {
    const { type, id } = chatAssetContext;
    if (type === "talent") return { type, asset: data.talent.find(t => t.id === id) };
    if (type === "product") return { type, asset: data.products.find(p => p.id === id) };
    if (type === "location") return { type, asset: data.locations.find(l => l.id === id) };
    return null;
  })() : null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, chatBusy]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  // Focus input when chatFocusTrigger changes (hero image click)
  useEffect(() => {
    if (chatFocusTrigger > 0) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [chatFocusTrigger]);

  const detectMention = (text, pos) => {
    const before = text.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setVal(v);
    const pos = e.target.selectionStart;
    const mq = detectMention(v, pos);
    if (mq !== null) {
      setMentionOpen(true);
      setMentionQuery(mq);
      setMentionIdx(0);
    } else {
      setMentionOpen(false);
    }
  };

  const handleMentionSelect = (asset) => {
    const pos = inputRef.current?.selectionStart || val.length;
    const before = val.slice(0, pos);
    const atPos = before.lastIndexOf("@");
    if (atPos === -1) return;
    const after = val.slice(pos);
    const newVal = before.slice(0, atPos) + asset.handle + " " + after;
    setVal(newVal);
    setMentionOpen(false);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const allMentionAssets = [
    ...data.talent.map(t => ({ ...t, _type: "talent", _badge: "T" })),
    ...data.products.map(p => ({ ...p, _type: "product", _badge: "P" })),
    ...data.locations.map(l => ({ ...l, _type: "location", _badge: "L" })),
  ];
  const filteredMentions = allMentionAssets.filter(a => {
    const q = mentionQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q);
  });

  const send = () => {
    if (!val.trim() || chatBusy) return;
    const frame = selectedFrame;
    onSendMessage(val.trim(), selectedFrameId, frame ? frame.number : null);
    setVal("");
    setMentionOpen(false);
  };

  const handleImproveWithAI = () => {
    if (!val.trim() || improving) return;
    setImproving(true);
    const hasImageContext = selectedFrame && selectedFrame.uploadedImage;
    setTimeout(() => {
      setVal(mockImproveText(val.trim(), !!hasImageContext));
      setImproving(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (mentionOpen && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i + 1) % filteredMentions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => (i - 1 + filteredMentions.length) % filteredMentions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); handleMentionSelect(filteredMentions[mentionIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Determine placeholder
  let placeholder = selectedFrame ? `Describe changes for Frame ${selectedFrame.number}...` : "What do you want to change?";
  if (assetContextResolved?.asset) {
    const pMap = { talent: "Describe this character...", product: "Describe this product...", location: "Help me refine this location..." };
    placeholder = pMap[assetContextResolved.type] || placeholder;
  }

  const hasUserMessages = chatMessages.some(m => m.role === "user" || m.role === "assistant");

  const handleSuggestion = (text) => {
    const frame = selectedFrame;
    onSendMessage(text, selectedFrameId, frame ? frame.number : null);
  };

  // Auto-expand textarea height
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }
  }, []);
  useEffect(() => { autoResize(); }, [val, autoResize]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages — bottom-aligned like text messages, centered when empty */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12, justifyContent: hasUserMessages ? "flex-end" : "center" }}>
        {hasUserMessages ? (
          <>
            {chatMessages.map((m, i) => <ChatMessage key={m.id || i} message={m} data={data} onMentionClick={onMentionClick} />)}
            {chatBusy && (
              <div style={{ display: "flex", gap: 5, padding: "8px 0" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: 1, background: "var(--warm)", animation: `pulse 1.2s ease ${i * 0.15}s infinite` }} />)}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "0 16px", flex: 1, justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--f)", fontSize: 20, fontWeight: 300, color: "var(--warm-35)", letterSpacing: "-0.02em" }}>
              What should we do?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              {CHAT_SUGGESTIONS.map(s => (
                <button key={s.label} onClick={() => handleSuggestion(s.label)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "8px 16px", borderRadius: 8,
                    background: "var(--warm-04)", border: "1px solid var(--warm-06)",
                    fontFamily: "var(--f)", fontSize: 12, fontWeight: 400, color: "var(--warm-35)",
                    cursor: "pointer", transition: "all 0.2s ease", outline: "none",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--warm-06)"; e.currentTarget.style.borderColor = "var(--warm-10)"; e.currentTarget.style.color = "var(--warm-50)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--warm-04)"; e.currentTarget.style.borderColor = "var(--warm-06)"; e.currentTarget.style.color = "var(--warm-35)"; }}
                >
                  <SectionIcon name={s.icon} size={12} color="currentColor" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Bottom: helper hint + context cards + input */}
      <div style={{ borderTop: "1px solid var(--warm-06)", padding: "10px 16px 14px", flexShrink: 0 }}>
        {!hasUserMessages && (
          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-15)", lineHeight: 1.5, textAlign: "center", marginBottom: 8 }}>
            Click any frame to open it, or use @ to reference assets.
          </div>
        )}
        {selectedFrame && (
          <div style={{ marginBottom: 10 }}>
            <FrameContext frame={selectedFrame} data={data} onDismiss={onDismissFrame} onOpenProduction={onOpenProduction} />
          </div>
        )}
        {assetContextResolved?.asset && (
          <div style={{ marginBottom: 10 }}>
            <AssetContext asset={assetContextResolved.asset} type={assetContextResolved.type} onDismiss={onDismissAssetContext} />
          </div>
        )}
        <div style={{ position: "relative" }}>
          {mentionOpen && filteredMentions.length > 0 && (
            <MentionPopup query={mentionQuery} data={data} onSelect={handleMentionSelect} onClose={() => setMentionOpen(false)} selectedIndex={mentionIdx} />
          )}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 6,
            padding: "8px 10px", borderRadius: 10,
            background: "var(--warm-04)", border: "1px solid var(--warm-06)",
          }}>
            <textarea ref={inputRef} value={val}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, color: "var(--warm)",
                letterSpacing: "-0.01em", resize: "none", lineHeight: 1.5,
                minHeight: 26, maxHeight: 120, overflow: "auto",
                padding: "3px 4px",
              }}
            />
            {/* Improve with AI button — muted at 50% until text typed */}
            <ChatIconButton
              onClick={handleImproveWithAI}
              disabled={!val.trim() || improving}
              title="Improve with AI"
              active={!!val.trim() && !improving}
              muted={!val.trim() && !improving}
              pulsing={improving}
              size={26}
              borderRadius={6}
            >
              <SectionIcon name="pencil-sparkle" size={12} color="currentColor" />
            </ChatIconButton>
            {/* Send button — always-visible bright arrow */}
            <ChatIconButton
              onClick={send}
              disabled={!val.trim() || chatBusy}
              title="Send"
              active={!!val.trim()}
              muted={!val.trim()}
              size={26}
              borderRadius={6}
            >
              <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 700, color: "var(--warm)" }}>{"↑"}</span>
            </ChatIconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- PROGRESS CIRCLE (character completion) --------------------

function ProgressCircle({ progress, size = 22 }) {
  // progress: 0 to 1
  const r = (size - 3) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * progress;
  const isComplete = progress >= 1;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* Background circle */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--warm-08)" strokeWidth={1.5} />
      {/* Progress arc */}
      {progress > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill={isComplete ? "#4a9" : "none"}
          stroke={isComplete ? "#4a9" : "#4a9"} strokeWidth={1.5}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      )}
      {/* Checkmark when complete */}
      {isComplete && (
        <polyline points={`${size * 0.32},${size * 0.5} ${size * 0.45},${size * 0.65} ${size * 0.68},${size * 0.38}`}
          fill="none" stroke="#111" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function getCharacterProgress(item) {
  let filled = 0;
  let total = 5; // name, note, headshot, angles generated, all 6 angle slots
  if (item.name && item.name.trim()) filled++;
  if (item.note && item.note.trim()) filled++;
  if (item.headshot) filled++;
  if (item.generatedAngles) filled += 2; // angles generated counts as 2 (angles + all slots)
  return Math.min(filled / total, 1);
}

// -- ASSET CARD -----------------------------------------------

function AssetCard({ item, category, data, dispatch, isExpanded, onToggle, onAIAssist }) {
  const typeKey = { talent: "TALENT", products: "PRODUCT", locations: "LOCATION" }[category];
  const updateItem = (field, value) => dispatch({ type: `UPDATE_${typeKey}`, id: item.id, field, value });
  const deleteItem = () => dispatch({ type: `DELETE_${typeKey}`, id: item.id });
  const [anglesOpen, setAnglesOpen] = useState(false);

  const getFrameRefs = () => {
    if (category === "talent") return data.frames.filter(f => f.talentIds.includes(item.id));
    if (category === "products") return data.frames.filter(f => f.productIds.includes(item.id));
    return data.frames.filter(f => f.locationId === item.id);
  };
  const refs = getFrameRefs();

  const isComplete = category === "talent" && item.generatedAngles;
  const isDraft = category === "talent" && !item.generatedAngles;
  const isGenerating = item.generationStatus === "uploading" || item.generationStatus === "generating";

  const handleGenerate = () => {
    const statusType = `UPDATE_${typeKey}_GENERATION`;
    dispatch({ type: statusType, id: item.id, status: "uploading" });
    setTimeout(() => {
      dispatch({ type: statusType, id: item.id, status: "generating" });
      setTimeout(() => {
        if (category === "talent") {
          dispatch({ type: statusType, id: item.id, status: "complete", angles: {
            frontHead: true, sideHead: true, backHead: true, frontBody: true, sideBody: true, backBody: true,
          }});
        } else {
          const letter = category === "products" ? "P" : "L";
          dispatch({ type: statusType, id: item.id, status: "complete", image: "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2a2a32"/><text x="32" y="36" text-anchor="middle" fill="#6c6" font-size="12">${letter}</text></svg>`) });
        }
      }, 2000);
    }, 1000);
  };

  return (
    <div style={{
      borderRadius: 10, overflow: "hidden", transition: "all 0.2s ease",
      border: isComplete ? "1px solid var(--warm-10)" : isDraft ? "1px dashed var(--warm-08)" : "1px solid var(--warm-06)",
    }}>
      {/* Collapsed header */}
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        cursor: "pointer", background: isExpanded ? "var(--warm-04)" : "transparent",
        transition: "background 0.15s ease",
      }}>
        {category === "talent" && (
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: isComplete ? "linear-gradient(135deg, #2a2a30, #3a3a40)" : "linear-gradient(135deg, #1a1a1e, #2a2a30)",
            border: isComplete ? "1px solid var(--warm-12)" : "1px dashed var(--warm-08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-30)",
          }}>{item.initials}</div>
        )}
        {category === "products" && (
          item.referenceImage ? (
            <img src={item.referenceImage} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--warm-06)", border: "1px solid var(--warm-08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <SectionIcon name="box" size={14} color="var(--warm-15)" />
            </div>
          )
        )}
        {category === "locations" && (
          <LocationThumb loc={item} size={32} borderRadius={6} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "var(--warm)" }}>{item.name}</div>
          {category === "talent" && item.note && <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-20)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.note.split(".")[0]}</div>}
        </div>
        {category === "talent" && (
          <ProgressCircle progress={getCharacterProgress(item)} size={22} />
        )}
        <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-15)", flexShrink: 0 }}>{isExpanded ? "▾" : "▸"}</span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--warm-06)" }}>

          {/* === SHARED IMAGE + FIELDS LAYOUT (all categories) === */}
          {(() => {
            const img = category === "talent" ? item.headshot : (item.referenceImage || item.generatedImage);
            const namePlaceholder = category === "talent" ? "Character name" : category === "products" ? "Element name" : "Location name";
            const fileInputId = `upload-${item.id}`;
            const handleFileUpload = (file) => {
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => updateItem(category === "talent" ? "headshot" : "referenceImage", ev.target.result);
              reader.readAsDataURL(file);
            };

            return (
              <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  {/* Left: 16:9 landscape image with overlay buttons — 2/3 width */}
                  <div style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input type="file" id={fileInputId} accept="image/*" style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); }} />
                    <div style={{
                      borderRadius: 8, overflow: "hidden", aspectRatio: "16/9",
                      background: img ? "var(--warm-04)" : "linear-gradient(135deg, #131316, #1a1a1e)",
                      border: img ? "1px solid var(--warm-08)" : "1px solid var(--warm-06)",
                      position: "relative", cursor: img ? "default" : "pointer",
                    }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}
                    onClick={() => { if (!img) document.getElementById(fileInputId).click(); }}
                    >
                      {img ? (
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 10, padding: 16,
                        }}>
                          {/* Upload area */}
                          <div style={{ textAlign: "center" }}>
                            <SectionIcon name="image" size={20} color="var(--warm-15)" />
                            <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, color: "var(--warm-20)", marginTop: 6, lineHeight: 1.4 }}>
                              Drag and drop or click to upload
                            </div>
                          </div>
                          {/* Divider */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "60%" }}>
                            <div style={{ flex: 1, height: 1, background: "var(--warm-08)" }} />
                            <span style={{ fontFamily: "var(--f)", fontSize: 8, fontWeight: 500, color: "var(--warm-12)", letterSpacing: "0.1em" }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: "var(--warm-08)" }} />
                          </div>
                          {/* Generate button */}
                          <button onClick={e => { e.stopPropagation(); if (onAIAssist) onAIAssist(item, category); }}
                            style={{
                              fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "rgba(180, 160, 255, 0.9)",
                              background: "rgba(120, 90, 220, 0.12)", border: "1px solid rgba(120, 90, 220, 0.25)",
                              borderRadius: 6, padding: "5px 14px", cursor: "pointer", outline: "none",
                              display: "flex", alignItems: "center", gap: 5,
                              boxShadow: "0 0 12px rgba(120, 90, 220, 0.08)",
                              transition: "all 0.15s ease",
                            }}>
                            <SectionIcon name="sparkle" size={10} color="rgba(180, 160, 255, 0.8)" /> Generate Image
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Right: fields — 1/3 width */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input value={item.name} onChange={e => updateItem("name", e.target.value)} placeholder={namePlaceholder} style={{ ...inp, fontSize: 12 }} />
                    {(category === "talent" || category === "products") && (
                      <textarea value={category === "talent" ? (item.note || "") : (item.description || "")}
                        onChange={e => updateItem(category === "talent" ? "note" : "description", e.target.value)}
                        placeholder={category === "talent" ? "Character notes..." : "Description (optional)"}
                        style={{ ...inp, fontSize: 11, minHeight: 36, resize: "vertical", flex: 1 }} />
                    )}
                  </div>
                </div>

                {/* Character: Generate Full Character button */}
                {category === "talent" && !isComplete && !isGenerating && (
                  <button onClick={handleGenerate}
                    style={{
                      fontFamily: "var(--f)", fontSize: 11, fontWeight: 600, color: "rgba(200, 180, 255, 0.95)",
                      background: "linear-gradient(135deg, rgba(100, 70, 200, 0.15), rgba(140, 100, 240, 0.1))",
                      border: "1px solid rgba(120, 90, 220, 0.3)",
                      borderRadius: 8, padding: "10px 16px", cursor: "pointer", outline: "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      width: "100%",
                      boxShadow: "0 0 20px rgba(120, 90, 220, 0.1), 0 0 40px rgba(120, 90, 220, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
                      transition: "all 0.2s ease",
                      position: "relative",
                    }}>
                    <SectionIcon name="sparkle" size={13} color="rgba(180, 160, 255, 0.9)" />
                    Generate Full Character
                  </button>
                )}

                <GenerationIndicator status={item.generationStatus} onRetry={handleGenerate} />

                {/* Character angles (collapsible) */}
                {category === "talent" && (isComplete || item.generationStatus === "generating") && (
                  <div>
                    {isComplete ? (
                      <button onClick={(e) => { e.stopPropagation(); setAnglesOpen(!anglesOpen); }} style={{
                        fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-30)",
                        background: "none", border: "none", cursor: "pointer", padding: "4px 0",
                        display: "flex", alignItems: "center", gap: 4, outline: "none",
                      }}>
                        <span style={{ transition: "transform 0.2s ease", transform: anglesOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-flex" }}>
                          <SectionIcon name="chevron-right" size={10} color="var(--warm-25)" />
                        </span>
                        {anglesOpen ? "Hide Angles" : "Show Angles (6)"}
                      </button>
                    ) : (
                      <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 500, color: "var(--warm-20)", marginBottom: 6 }}>Generating angles...</div>
                    )}
                    <div style={{
                      maxHeight: (anglesOpen || !isComplete) ? 400 : 0, opacity: (anglesOpen || !isComplete) ? 1 : 0,
                      overflow: "hidden", transition: "max-height 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 4 }}>
                        {["Front", "Side", "Back"].map(angle => (
                          <div key={angle}>
                            <div style={{
                              aspectRatio: "1/1", borderRadius: 4, overflow: "hidden",
                              background: isComplete ? "linear-gradient(135deg, #1e1e24, #2a2a32)" : "var(--warm-04)",
                              border: "1px solid var(--warm-06)", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {isComplete ? <span style={{ fontFamily: "var(--f)", fontSize: 8, color: "var(--warm-20)" }}>{"✓"}</span> : (
                                <div style={{ width: "60%", height: 2, borderRadius: 1, backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, var(--warm-06) 0%, var(--warm-12) 50%, var(--warm-06) 100%)", animation: "shimmer 1.5s ease infinite" }} />
                              )}
                            </div>
                            <div style={{ fontFamily: "var(--f)", fontSize: 8, fontWeight: 400, color: "var(--warm-15)", textAlign: "center", marginTop: 2 }}>{angle}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 4 }}>
                        {["Full Front", "Full Side", "Full Back"].map(angle => (
                          <div key={angle}>
                            <div style={{
                              aspectRatio: "3/4", borderRadius: 4, overflow: "hidden",
                              background: isComplete ? "linear-gradient(135deg, #1e1e24, #2a2a32)" : "var(--warm-04)",
                              border: "1px solid var(--warm-06)", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {isComplete ? <span style={{ fontFamily: "var(--f)", fontSize: 8, color: "var(--warm-20)" }}>{"✓"}</span> : (
                                <div style={{ width: "60%", height: 2, borderRadius: 1, backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, var(--warm-06) 0%, var(--warm-12) 50%, var(--warm-06) 100%)", animation: "shimmer 1.5s ease infinite" }} />
                              )}
                            </div>
                            <div style={{ fontFamily: "var(--f)", fontSize: 8, fontWeight: 400, color: "var(--warm-15)", textAlign: "center", marginTop: 2 }}>{angle.replace("Full ", "")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* AI Assist button */}
          {onAIAssist && (
            <PremiumButton variant="ghost" onClick={() => onAIAssist(item, category)} style={{ width: "100%", fontSize: 11, gap: 4 }}>
              <SectionIcon name="sparkle" size={12} color="var(--warm-40)" /> AI Assist
            </PremiumButton>
          )}

          {/* Frame refs + delete */}
          <div style={{ paddingTop: 6, borderTop: "1px solid var(--warm-06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, color: "var(--warm-15)" }}>
              {refs.length > 0 ? `Used in: ${refs.map(f => "Frame " + f.number).join(", ")}` : "Not used"}
            </span>
            <ConfirmAction label="Delete" onConfirm={deleteItem} variant="danger" style={{ padding: "4px 10px", fontSize: 10 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// -- FLOATING AI CHAT TAB ------------------------------------

function AIChatTab({ sidebarOpen, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: "50%",
      transform: `translateY(-50%) translateX(${sidebarOpen ? "100%" : "0"})`,
      opacity: sidebarOpen ? 0 : 1,
      pointerEvents: sidebarOpen ? "none" : "auto",
      transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
      zIndex: 90,
    }}>
      {/* Primary glow — centered behind button */}
      <div style={{
        position: "absolute", top: 4, left: 2, right: 0, bottom: 4, borderRadius: "14px 0 0 14px", zIndex: 0,
        backgroundImage: "linear-gradient(135deg, #8855f0, #5577f4, #9960f0, #6070f8, #7755ee, #4a68f0)",
        backgroundSize: "300% 300%",
        animation: "liquidGradient 18s ease infinite",
        filter: "blur(7px)",
        opacity: hovered ? 0.85 : 0.5,
        transition: "opacity 0.5s ease",
      }} />
      {/* Secondary glow */}
      <div style={{
        position: "absolute", top: 8, left: 4, right: 0, bottom: 8, borderRadius: "14px 0 0 14px", zIndex: 0,
        backgroundImage: "linear-gradient(225deg, #6644dd, #3b62e8, #8050e4, #5060ec, #6644dd)",
        backgroundSize: "350% 350%",
        animation: "liquidGradient 24s ease-in-out infinite reverse",
        filter: "blur(10px)",
        opacity: hovered ? 0.55 : 0.25,
        transition: "opacity 0.5s ease",
      }} />
      {/* Ambient glow — wider spread */}
      <div style={{
        position: "absolute", top: -2, left: -2, right: -2, bottom: -2, borderRadius: "18px 0 0 18px", zIndex: 0,
        backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(120,60,230,0.5), transparent 70%), radial-gradient(ellipse at 50% 50%, rgba(60,100,240,0.4), transparent 70%)",
        backgroundSize: "200% 200%",
        animation: "liquidGradient 20s ease infinite",
        filter: "blur(14px)",
        opacity: hovered ? 0.45 : 0.2,
        transition: "opacity 0.5s ease",
      }} />
      {/* Button */}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Open AI Chat"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "16px 12px",
          background: hovered ? "var(--warm-06)" : "var(--surface-solid)",
          borderTop: `1px solid ${hovered ? "var(--warm-12)" : "var(--warm-08)"}`,
          borderLeft: `1px solid ${hovered ? "var(--warm-12)" : "var(--warm-08)"}`,
          borderBottom: `1px solid ${hovered ? "var(--warm-12)" : "var(--warm-08)"}`,
          borderRight: "none",
          borderRadius: "12px 0 0 12px",
          cursor: "pointer",
          outline: "none",
          fontFamily: "var(--f)",
        }}
      >
        <SectionIcon name="sparkle" size={20} color={hovered ? "var(--warm)" : "var(--warm-30)"} />
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
          color: hovered ? "var(--warm-50)" : "var(--warm-20)",
          transition: "color 0.2s ease",
          whiteSpace: "nowrap",
        }}>AI Chat</span>
      </button>
    </div>
  );
}

// -- SIDEBAR PANEL (always AI Chat) ---------------------------

function SidebarPanel({ onClose, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", borderBottom: "1px solid var(--warm-06)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SectionIcon name="sparkle" size={15} color="var(--warm)" />
          <span style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 600, color: "var(--warm)" }}>AI Chat</span>
        </div>
        <button onClick={onClose} style={{
          width: 24, height: 24, borderRadius: 5, border: "1px solid var(--warm-08)",
          background: "transparent", color: "var(--warm-30)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f)", fontSize: 14, lineHeight: 1, outline: "none",
          paddingBottom: 1,
        }}>&times;</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// -- EXPORT: ONE-SHEET PREVIEW --------------------------------

function OneSheetExport({ data, dark, includes }) {
  const inc = includes || { descriptions: true, cameraNotes: true, talentTags: true, locationPalettes: true };
  const bg = dark ? "#0E0D0B" : "#FAFAF8";
  const fg = dark ? "#E0E0E0" : "#1a1a18";
  const sub = dark ? "rgba(224,224,224,0.45)" : "#777";
  const dim = dark ? "rgba(224,224,224,0.25)" : "#bbb";
  const line = dark ? "rgba(224,224,224,0.06)" : "rgba(0,0,0,0.06)";

  // Determine orientation from aspect ratio
  const aspectStr = String(data.meta.aspect);
  let aspectNum = 2.39;
  if (aspectStr.includes(":")) {
    const [w, h] = aspectStr.split(":").map(Number);
    if (w && h) aspectNum = w / h;
  } else {
    aspectNum = parseFloat(aspectStr) || 2.39;
  }
  const isLandscape = aspectNum >= 1;
  const frameCount = data.frames.length;
  const gridCols = isLandscape ? (frameCount > 6 ? 4 : 3) : 2;
  const frameAspect = `${aspectNum}/1`;

  return (
    <div style={{ background: bg, padding: 24, height: "100%", display: "flex", flexDirection: "column", borderRadius: 10, transition: "background 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: sub, letterSpacing: "0.15em", textTransform: "uppercase" }}>Storyboard</div>
          <div style={{ fontFamily: "var(--f)", fontSize: 24, fontWeight: 700, color: fg, letterSpacing: "-0.02em" }}>{data.meta.title}</div>
          <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: sub }}>{data.meta.client} &middot; :{data.meta.format} &middot; {data.meta.aspect}{aspectStr.includes(":") ? "" : ":1"}</div>
        </div>
        <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: dim, textAlign: "right" }}>
          <div>{data.frames.length} Frames</div>
          <div>{data.talent.length} Talent &middot; {data.locations.length} Loc</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 4, flex: 1 }}>
        {data.frames.map((f, i) => {
          const loc = data.locations.find(l => l.id === f.locationId);
          const talents = data.talent.filter(t => f.talentIds.includes(t.id));
          return (
            <div key={f.id}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 3px", fontSize: 8, fontFamily: "var(--f)", color: sub, fontWeight: 500 }}>
                <span>{f.number}</span>
                <span>{f.shotType}</span>
              </div>
              <div style={{
                background: dark ? FILM[i % FILM.length] : "#E8E8E6",
                borderRadius: 2, aspectRatio: frameAspect, position: "relative", overflow: "hidden",
              }}>
                {f.uploadedImage && <img src={f.uploadedImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                {dark && <><div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "7%", background: "rgba(0,0,0,0.4)" }} /><div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "7%", background: "rgba(0,0,0,0.4)" }} /></>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 3px", fontSize: 8, fontFamily: "var(--f)", color: dim, marginTop: 1 }}>
                <span>{loc?.name || "—"}</span>
                {inc.cameraNotes && !isCameraDefault(f) && <span>{f.camera}</span>}
              </div>
              {inc.descriptions && (
                <div style={{ fontFamily: "var(--f)", fontSize: 8, fontWeight: 300, color: dark ? "rgba(224,224,224,0.35)" : "#999", lineHeight: 1.45, marginTop: 1, padding: "0 3px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.brief}</div>
              )}
              {inc.talentTags && talents.length > 0 && (
                <div style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: 400, color: dim, padding: "1px 3px", marginTop: 1 }}>{talents.map(t => t.name.split(" ")[0]).join(", ")}</div>
              )}
            </div>
          );
        })}
      </div>
      {/* Visual asset reference strip */}
      <div style={{ borderTop: `1px solid ${line}`, paddingTop: 4, marginTop: 4, display: "flex", gap: 16, alignItems: "flex-start" }}>
        {inc.talentTags && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {data.talent.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {t.headshot ? (
                  <img src={t.headshot} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: dark ? "linear-gradient(135deg, #1a1a1e, #2a2a30)" : "#ddd",
                    border: `1px solid ${dark ? "rgba(224,224,224,0.08)" : "#ccc"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--f)", fontSize: 7, fontWeight: 500, color: sub,
                  }}>{t.initials}</div>
                )}
                <span style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: 400, color: sub }}>{t.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {data.products.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {p.referenceImage ? (
                <img src={p.referenceImage} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: 4, background: p.hue, opacity: 0.6 }} />
              )}
              <span style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: 400, color: sub }}>{p.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
        {inc.locationPalettes && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {data.locations.map(loc => (
              <div key={loc.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <LocationThumb loc={loc} size={20} borderRadius={3} style={{ width: 36, height: 20, border: "none" }} />
                <span style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: 400, color: sub }}>{loc.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginLeft: "auto", fontFamily: "var(--f)", fontSize: 7, fontWeight: 500, color: dim }}>Wonder AI</div>
      </div>
    </div>
  );
}

// -- EXPORT MODAL ---------------------------------------------

function ExportModal({ data, onClose }) {
  const [theme, setTheme] = useState("dark");
  const [status, setStatus] = useState(null);
  const [includes, setIncludes] = useState({ descriptions: true, cameraNotes: true, talentTags: true, locationPalettes: true });
  const [downloadStatus, setDownloadStatus] = useState(null);

  const doExport = () => { setStatus("exporting"); setTimeout(() => setStatus("done"), 1500); setTimeout(() => setStatus(null), 3500); };
  const doShare = () => { navigator.clipboard?.writeText("https://workshop.wonder.ai/s/abc123").catch(() => {}); setStatus("copied"); setTimeout(() => setStatus(null), 2000); };
  const doDownloadAssets = () => { setDownloadStatus("loading"); setTimeout(() => { setDownloadStatus("complete"); setTimeout(() => setDownloadStatus(null), 2000); }, 1500); };

  const includeLabels = [
    { key: "descriptions", label: "Shot descriptions" },
    { key: "cameraNotes", label: "Camera notes" },
    { key: "talentTags", label: "Talent tags" },
    { key: "locationPalettes", label: "Location thumbnails" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      <div style={{ position: "absolute", inset: 40, display: "flex", gap: 32, animation: "sheetUp 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ flex: "1 1 68%", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            aspectRatio: "11/8.5", width: "100%", maxHeight: "100%",
            borderRadius: 14, overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid var(--warm-06)",
            background: theme === "dark" ? "#0E0D0B" : "#FAFAF8",
          }}>
            <OneSheetExport data={data} dark={theme === "dark"} includes={includes} />
          </div>
        </div>
        <div style={{ flex: "0 0 240px", minWidth: 200, paddingTop: 16, position: "relative" }}>
          {/* Close icon */}
          <button onClick={onClose} style={{
            position: "absolute", top: 0, right: 0, width: 28, height: 28, borderRadius: 6,
            border: "1px solid var(--warm-08)", background: "transparent", color: "var(--warm-30)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--f)", fontSize: 14, outline: "none",
          }}>&times;</button>

          <h2 style={{ fontFamily: "var(--f)", fontSize: 26, fontWeight: 200, color: "var(--warm)", letterSpacing: "-0.04em", marginBottom: 6 }}>Export</h2>
          <p style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, color: "var(--warm-30)", marginBottom: 36, lineHeight: 1.6 }}>Production-ready one-sheet. Print or share.</p>

          <div style={{ marginBottom: 28 }}>
            <label style={lbl}>Theme</label>
            <div style={{ display: "flex", gap: 3, background: "var(--warm-04)", borderRadius: 8, padding: 3 }}>
              {[{ v: "dark", l: "Cinematic" }, { v: "light", l: "Clean" }].map(o => (
                <button key={o.v} onClick={() => setTheme(o.v)} style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  fontFamily: "var(--f)", fontSize: 12, fontWeight: theme === o.v ? 600 : 400,
                  background: theme === o.v ? "var(--warm-10)" : "transparent",
                  color: theme === o.v ? "var(--warm)" : "var(--warm-30)", transition: "all 0.2s ease", outline: "none",
                }}>{o.l}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={lbl}>Include</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {includeLabels.map(o => (
                <label key={o.key} onClick={() => setIncludes(prev => ({ ...prev, [o.key]: !prev[o.key] }))}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: includes[o.key] ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: includes[o.key] ? "1px solid rgba(255,255,255,0.3)" : "1px solid var(--warm-10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}>
                    {includes[o.key] && (
                      <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, color: "var(--warm-50)" }}>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PremiumButton variant="primary" onClick={doExport} loading={status === "exporting"} complete={status === "done"} style={{ width: "100%", padding: "12px 0", fontSize: 13, fontWeight: 600 }}>
              <SectionIcon name="download" size={14} color="#111" /> Export PDF
            </PremiumButton>
            <PremiumButton variant="secondary" onClick={doShare} complete={status === "copied"} style={{ width: "100%", padding: "10px 0" }}>
              <SectionIcon name="link" size={13} color="var(--warm-50)" /> {status === "copied" ? "Link Copied!" : "Share Link"}
            </PremiumButton>
            <PremiumButton variant="secondary" onClick={doDownloadAssets} loading={downloadStatus === "loading"} complete={downloadStatus === "complete"} style={{ width: "100%", padding: "10px 0" }}>
              <SectionIcon name="zip" size={13} color="var(--warm-50)" /> {downloadStatus === "complete" ? "Downloaded!" : "Download All Assets"}
            </PremiumButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- LIQUID GLASS BUTTON --------------------------------------

function LiquidGlassButton({ onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", padding: "6px 0" }}>
      {/* Primary glow — tight, bright at edges */}
      <div style={{
        position: "absolute", inset: "2px -2px", borderRadius: 16, zIndex: 0,
        backgroundImage: "linear-gradient(135deg, #8855f0, #5577f4, #9960f0, #6070f8, #7755ee, #4a68f0)",
        backgroundSize: "300% 300%",
        animation: "liquidGradient 18s ease infinite",
        filter: "blur(6px)",
        opacity: hovered ? 0.9 : 0.6,
        transition: "opacity 0.5s ease",
      }} />
      {/* Secondary glow — offset, different timing for organic feel */}
      <div style={{
        position: "absolute", inset: "4px 2px", borderRadius: 16, zIndex: 0,
        backgroundImage: "linear-gradient(225deg, #6644dd, #3b62e8, #8050e4, #5060ec, #6644dd)",
        backgroundSize: "350% 350%",
        animation: "liquidGradient 24s ease-in-out infinite reverse",
        filter: "blur(10px)",
        opacity: hovered ? 0.6 : 0.3,
        transition: "opacity 0.5s ease",
      }} />
      {/* Third glow — larger, softer ambient */}
      <div style={{
        position: "absolute", inset: "-2px -4px", borderRadius: 20, zIndex: 0,
        backgroundImage: "radial-gradient(ellipse at 30% 50%, rgba(120,60,230,0.5), transparent 70%), radial-gradient(ellipse at 70% 50%, rgba(60,100,240,0.4), transparent 70%)",
        backgroundSize: "200% 200%",
        animation: "liquidGradient 20s ease infinite",
        filter: "blur(14px)",
        opacity: hovered ? 0.5 : 0.25,
        transition: "opacity 0.5s ease",
      }} />
      {/* Button */}
      <button onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative", zIndex: 1, width: "100%", padding: "16px 0",
          fontFamily: "var(--f)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
          border: "none",
          borderRadius: 14, cursor: "pointer", outline: "none",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          color: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
          backgroundImage: hovered
            ? "linear-gradient(135deg, rgba(0,0,0,0.97), rgba(4,4,8,0.98), rgba(0,0,0,0.97))"
            : "linear-gradient(135deg, rgba(6,6,10,0.97), rgba(10,10,14,0.98))",
          backgroundSize: "100% 100%",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: hovered
            ? "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.06)"
            : "inset 0 1px 0 rgba(255,255,255,0.05)",
          transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)",
          overflow: "hidden",
        }}
      >
        {/* Grain overlay inside button */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14, pointerEvents: "none",
          opacity: 0.04,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'g\'%3E%3CfeTurbulence baseFrequency=\'0.7\' numOctaves=\'4\' type=\'fractalNoise\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g)\'/%3E%3C/svg%3E")',
          backgroundSize: "128px",
          animation: "grainShift 8s steps(10) infinite",
          mixBlendMode: "overlay",
        }} />
        {children}
      </button>
    </div>
  );
}

// -- BRIEF FORM (with file upload) ----------------------------

function BriefForm({ onGenerate, generating = false, error = null }) {
  const [meta, setMeta] = useState({
    title: INITIAL_STATE.meta.title, client: INITIAL_STATE.meta.client,
    format: INITIAL_STATE.meta.format, aspect: INITIAL_STATE.meta.aspect,
    treatment: INITIAL_STATE.meta.treatment,
  });
  const [files, setFiles] = useState([]);
  const [fileDragOver, setFileDragOver] = useState(false);
  const fileRef = useRef(null);

  const addFiles = (fl) => {
    const nf = Array.from(fl).map(f => ({ name: f.name, size: f.size, type: f.type }));
    setFiles(prev => [...prev, ...nf]);
  };
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const fmtType = (t) => t.startsWith("image/") ? "IMG" : t === "application/pdf" ? "PDF" : t.includes("word") ? "DOC" : t.startsWith("text/") ? "TXT" : "FILE";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "5vh 5% 4vh" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "3%" }}>
          <WLogo color="rgba(224,224,224,0.25)" size={28} />
        </div>
      </Reveal>
      <Reveal delay={60}>
        <h1 style={{ fontFamily: "var(--f)", fontSize: 48, fontWeight: 200, lineHeight: 1.1, letterSpacing: "-0.05em", marginBottom: 12, color: "var(--warm)", whiteSpace: "nowrap" }}>
          Welcome to the Workshop.
        </h1>
      </Reveal>
      <Reveal delay={120}>
        <p style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 300, color: "var(--warm-35)", lineHeight: 1.7, marginBottom: "5%", whiteSpace: "nowrap" }}>
          Write a brief, a script, or a sentence. Add reference files for more context. AI builds the boards.
        </p>
      </Reveal>

      <Reveal delay={200}>
        <div style={{ background: "var(--warm-04)", border: "1px solid var(--warm-06)", borderRadius: 14, padding: "3% 5%", marginBottom: "2%" }}>
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Project</label>
            <input value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div><label style={lbl}>Client</label><input value={meta.client} onChange={e => setMeta(m => ({ ...m, client: e.target.value }))} style={inp} /></div>
            <ChevronDropdown
              label="Format"
              value={meta.format}
              options={[{ value: "15", label: ":15" }, { value: "30", label: ":30" }, { value: "60", label: ":60" }, { value: "90", label: ":90" }]}
              onChange={v => setMeta(m => ({ ...m, format: v }))}
              style={{}}
            />
            <AspectDropdown
              label="Aspect Ratio"
              value={meta.aspect}
              options={[{ value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" }, { value: "2.39", label: "Anamorphic" }, { value: "1:1", label: "1:1" }]}
              onChange={v => setMeta(m => ({ ...m, aspect: v }))}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Brief</label>
            <textarea value={meta.treatment} onChange={e => setMeta(m => ({ ...m, treatment: e.target.value }))}
              style={{ ...inp, minHeight: 120, resize: "vertical", lineHeight: 1.85 }} />
          </div>

          {/* File upload zone */}
          <div>
            <label style={lbl}>Reference Files</label>
            <div
              onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
              onDragLeave={() => setFileDragOver(false)}
              onDrop={e => { e.preventDefault(); setFileDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current.click()}
              style={{
                border: `1.5px dashed ${fileDragOver ? "rgba(255,255,255,0.3)" : "var(--warm-10)"}`,
                borderRadius: 10, padding: "18px 16px", textAlign: "center",
                cursor: "pointer", transition: "all 0.2s ease",
                background: fileDragOver ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, color: "var(--warm-25)", marginBottom: 3 }}>
                Drop files here or click to browse
              </div>
              <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-15)" }}>
                Treatments, scripts, product images, mood boards
              </div>
            </div>
            <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.rtf"
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />

            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 8px 4px 6px", borderRadius: 6,
                    background: "var(--warm-04)", border: "1px solid var(--warm-06)",
                  }}>
                    <span style={{
                      fontFamily: "var(--f)", fontSize: 8, fontWeight: 700, color: "var(--warm-25)",
                      background: "var(--warm-06)", padding: "2px 4px", borderRadius: 3, letterSpacing: "0.02em",
                    }}>{fmtType(f.type)}</span>
                    <span style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 400, color: "var(--warm-35)" }}>{f.name}</span>
                    <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-15)" }}>{fmtSize(f.size)}</span>
                    <button onClick={e => { e.stopPropagation(); removeFile(i); }} style={{
                      width: 16, height: 16, borderRadius: 3, border: "none",
                      background: "transparent", color: "var(--warm-25)", cursor: "pointer",
                      fontFamily: "var(--f)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    }}>&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={320}>
        <LiquidGlassButton onClick={() => !generating && onGenerate(meta)}>
          <SectionIcon name="sparkle" size={15} color="rgba(255,255,255,0.8)" />
          {generating ? " Generating brief…" : " Generate Storyboard"}
        </LiquidGlassButton>
        {error ? (
          <p style={{ textAlign: "center", marginTop: 16, fontFamily: "var(--f)", fontSize: 12, fontWeight: 400, color: "#FF8A80" }}>
            {error}
          </p>
        ) : (
          <p style={{ textAlign: "center", marginTop: 16, fontFamily: "var(--f)", fontSize: 12, fontWeight: 400, color: "var(--warm-20)" }}>
            {generating
              ? "Talking to Gemini — characters, locations, and a 9-frame storyboard incoming. Usually ~10–20 seconds."
              : "Creates talent, locations, products, and a complete shot sequence"}
          </p>
        )}
      </Reveal>
    </div>
  );
}

// -- MAIN APP -------------------------------------------------

export default function WorkshopV2() {
  const [{ past, present, future }, dispatch] = useReducer(storyboardReducer, {
    past: [], present: INITIAL_STATE, future: [],
  });
  const data = present;

  const [ready, setReady] = useState(false);
  const [built, setBuilt] = useState(false);
  // Brief-generation lifecycle for the BriefForm landing page. Lets us
  // disable the Generate button + show progress while Gemini works.
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [productionFrameId, setProductionFrameId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [highlightedFrames, setHighlightedFrames] = useState(new Set());
  const [chatAssetContext, setChatAssetContext] = useState(null);
  // Default to "brand" so the asset rail opens with Brand Info visible —
  // per Logan's left-rail redesign, something is always selected.
  const [assetTabOpen, setAssetTabOpen] = useState("brand");
  const [chatFocusTrigger, setChatFocusTrigger] = useState(0);
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  useEffect(() => { setTimeout(() => setReady(true), 80); }, []);

  // Auto-detect mentions in briefs
  useEffect(() => {
    if (built) {
      dispatch({ type: "AUTO_DETECT_MENTIONS" });
    }
  }, [data.frames.map(f => f.brief).join("|"), built]);

  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSidebarOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); dispatch({ type: "REDO" }); }
      if (e.key === "Escape") { if (productionFrameId) { setProductionFrameId(null); setSelectedFrameId(null); } else { setSelectedFrameId(null); } }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [productionFrameId]);

  useEffect(() => {
    if (highlightedFrames.size > 0) {
      const t = setTimeout(() => setHighlightedFrames(new Set()), 2000);
      return () => clearTimeout(t);
    }
  }, [highlightedFrames]);

  const selectFrame = useCallback((id) => {
    setSelectedFrameId(id);
    setProductionFrameId(id);
    if (!sidebarOpen) setSidebarOpen(true);
  }, [sidebarOpen]);

  // Real brief generation, powered by v1's generateBrief() → Gemini.
  // Builds a single prompt string from the BriefForm inputs (title,
  // client, treatment, format, aspect), waits for Gemini to return the
  // structured brief, then maps it onto v2's data shape via the
  // migration utility. The user's typed inputs override anything the
  // model might guess differently (the BriefForm IS authoritative for
  // title/client/aspect/format).
  const handleGenerate = async (meta) => {
    if (generating) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      const prompt = [
        meta.title ? `${meta.title}` : null,
        meta.client ? `for ${meta.client}` : null,
        meta.treatment ? `\n\n${meta.treatment}` : null,
        `\n\nFormat: ${meta.format}s, ${meta.aspect} aspect ratio.`,
      ].filter(Boolean).join(" ").trim();

      const v1Brief = await generateBrief(prompt);
      const v2Data = v1BriefToV2Data(v1Brief);

      // BriefForm inputs are authoritative for meta — don't let the
      // model rewrite the project title or aspect ratio the user
      // explicitly chose.
      dispatch({
        type: "SET_DATA",
        data: v2Data,
        metaOverrides: {
          title: meta.title || v2Data.meta.title,
          client: meta.client || v2Data.meta.client,
          format: meta.format || v2Data.meta.format,
          aspect: meta.aspect || v2Data.meta.aspect,
          treatment: meta.treatment || v2Data.meta.treatment,
        },
      });
      // Auto-detect @mentions in the new shot briefs so frame
      // talent/location/product references are populated. The reducer
      // case already exists in v1's wireframe; just kick it.
      setTimeout(() => dispatch({ type: "AUTO_DETECT_MENTIONS" }), 0);

      setBuilt(true);
      setChatMessages([{
        id: Date.now(),
        role: "system",
        text: "Brief generated. Generating images now — characters / locations / elements first, then storyboard frames with identity preservation. This takes about a minute.",
      }]);

      // Kick off auto image generation in the background. Don't await
      // it here — we want the OneSheet to be interactive immediately
      // and have images stream in as they complete.
      autoGenerateAssets(v2Data, meta.aspect);
    } catch (e) {
      console.error("[handleGenerate] failed", e);
      setGenerationError(e?.message || "Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Auto-image-generation pipeline. Two phases:
  //   A — talent headshots, location refs, product refs (parallel)
  //   B — storyboard frames (parallel, but only AFTER phase A) with
  //       reference images attached for identity preservation
  // Phase A images get tracked in a local Map so phase B can attach
  // them even though our React state updates are still propagating.
  // Errors are surfaced via the reducer's "error" generationStatus on
  // the affected asset — generation keeps moving for everything else.
  async function autoGenerateAssets(initialData, aspect) {
    const generated = {
      talent: new Map(),
      locations: new Map(),
      products: new Map(),
    };

    // Phase A — talent / locations / products in parallel.
    const phaseA = [];
    for (const t of initialData.talent || []) {
      phaseA.push((async () => {
        dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "generating" });
        try {
          const url = await generateImage(talentPrompt(t), { ratio: "1:1" });
          generated.talent.set(t.id, url);
          dispatch({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: url });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "complete" });
        } catch (err) {
          console.error("[talent gen]", t.name, err);
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "error" });
        }
      })());
    }
    for (const l of initialData.locations || []) {
      phaseA.push((async () => {
        dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "generating" });
        try {
          const url = await generateImage(locationPrompt(l), { ratio: aspect });
          generated.locations.set(l.id, url);
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
        } catch (err) {
          console.error("[location gen]", l.name, err);
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "error" });
        }
      })());
    }
    for (const p of initialData.products || []) {
      phaseA.push((async () => {
        dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "generating" });
        try {
          const url = await generateImage(productPrompt(p), { ratio: "1:1" });
          generated.products.set(p.id, url);
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "complete", image: url });
        } catch (err) {
          console.error("[product gen]", p.name, err);
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "error" });
        }
      })());
    }
    await Promise.allSettled(phaseA);

    // Phase B — frames with reference images. Detect @-handle mentions
    // inline (matching the reducer's AUTO_DETECT_MENTIONS logic) so we
    // know which talent / products each frame references, then look up
    // the just-generated images to use as Gemini reference inputs.
    const handles = {
      talent: initialData.talent.map(t => ({ id: t.id, handle: t.handle.toLowerCase() })),
      products: initialData.products.map(p => ({ id: p.id, handle: p.handle.toLowerCase() })),
    };
    const phaseB = [];
    for (const f of initialData.frames || []) {
      phaseB.push((async () => {
        dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId: f.id, status: "generating" });
        const briefLower = (f.brief || "").toLowerCase();
        const talentIds = handles.talent.filter(h => briefLower.includes(h.handle)).map(h => h.id);
        const productIds = handles.products.filter(h => briefLower.includes(h.handle)).map(h => h.id);
        const locationId = f.locationId
          || (initialData.locations[0]?.id ?? null);

        const refs = [];
        for (const tid of talentIds) {
          const url = generated.talent.get(tid);
          if (url) refs.push(url);
        }
        if (locationId) {
          const url = generated.locations.get(locationId);
          if (url) refs.push(url);
        }
        for (const pid of productIds) {
          const url = generated.products.get(pid);
          if (url) refs.push(url);
        }

        try {
          const url = await generateImage(framePrompt(f), {
            ratio: aspect,
            referenceImages: refs,
          });
          dispatch({ type: "UPLOAD_FRAME_IMAGE", frameId: f.id, dataUrl: url });
        } catch (err) {
          console.error("[frame gen]", f.number, err);
          dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId: f.id, status: "error" });
        }
      })());
    }
    await Promise.allSettled(phaseB);
  }

  const handleSendMessage = useCallback((text, frameId, frameNumber) => {
    setChatMessages(prev => [...prev, { id: Date.now(), role: "user", text, frameId, frameNumber }]);
    setChatBusy(true);
    const currentData = data;
    setTimeout(() => {
      let result;
      if (frameId) {
        const frame = currentData.frames.find(f => f.id === frameId);
        result = frame ? mockFrameAI(text, frame, currentData) : mockAI(text, currentData);
      } else {
        result = mockAI(text, currentData);
      }
      setChatBusy(false);
      if (result.addFrame) {
        dispatch({ type: "ADD_FRAME" });
        setChatMessages(prev => [...prev, { id: Date.now(), role: "ai", text: result.message, changes: [] }]);
        return;
      }
      if (result.changes.length > 0) {
        dispatch({ type: "AI_APPLY_CHANGES", changes: result.changes });
        setHighlightedFrames(new Set(result.changes.filter(c => c.type === "frame" || c.type === "camera").map(c => c.id)));
      }
      setChatMessages(prev => [...prev, { id: Date.now(), role: "ai", text: result.message, changes: result.changes.filter(c => c.type === "frame" || c.type === "camera") }]);
    }, 500 + Math.random() * 500);
  }, [data]);

  const handleDeleteFrame = useCallback((id) => {
    dispatch({ type: "DELETE_FRAME", frameId: id });
    if (selectedFrameId === id) setSelectedFrameId(null);
    if (productionFrameId === id) setProductionFrameId(null);
  }, [selectedFrameId, productionFrameId]);

  const handleMentionClick = useCallback((asset) => {
    // Toggle the appropriate asset tab
    const typeMap = { talent: "talent", product: "products", location: "locations" };
    const tabKey = typeMap[asset._type] || "talent";
    setAssetTabOpen(prev => prev === tabKey ? null : tabKey);
  }, []);

  const handleAssetAIAssist = useCallback((item, category) => {
    const type = { talent: "talent", products: "product", locations: "location" }[category];
    setChatAssetContext({ type, id: item.id });
    setSidebarOpen(true);
  }, []);

  const handleFocusChat = useCallback(() => {
    setSidebarOpen(true);
    setChatFocusTrigger(prev => prev + 1);
  }, []);

  // Left-rail nav — always selects the clicked tab (no toggle-to-close).
  // Something is always visible on the right, so this is a switch, not
  // a toggle. The argument name "Toggle" is kept for back-compat with
  // the prop wired through OneSheetWorkspace.
  const handleToggleAssetTab = useCallback((tabKey) => {
    setAssetTabOpen(tabKey);
  }, []);

  // Production view frame navigation
  const prodFrame = productionFrameId ? data.frames.find(f => f.id === productionFrameId) : null;
  const prodIdx = prodFrame ? data.frames.indexOf(prodFrame) : -1;

  return (
    <div style={{
      ...getThemeVars(isDark),
      background: isDark
        ? "radial-gradient(ellipse 80% 60% at 50% 40%, #111112 0%, #0A0A0A 100%)"
        : "radial-gradient(ellipse 80% 60% at 50% 40%, #FFFFFF 0%, #F0EFED 100%)",
      minHeight: "100vh", fontFamily: "var(--f)", color: "var(--warm)",
      opacity: ready ? 1 : 0, transition: "opacity 0.8s ease, background 0.4s ease, color 0.4s ease",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: var(--warm-10); color: var(--warm); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--warm-08); border-radius: 3px; }
        @keyframes sheetUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:0.2 } 50% { opacity:1 } }
        @keyframes highlightPulse {
          0% { box-shadow: 0 0 0 rgba(255,255,255,0) }
          30% { box-shadow: 0 0 24px rgba(255,255,255,0.1) }
          100% { box-shadow: 0 0 0 rgba(255,255,255,0) }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes liquidGradient {
          0% { background-position: 0% 50%; }
          20% { background-position: 80% 30%; }
          40% { background-position: 100% 60%; }
          60% { background-position: 30% 90%; }
          80% { background-position: 10% 40%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes grainShift {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-2%, -2%); }
          30% { transform: translate(1%, 3%); }
          50% { transform: translate(-3%, 1%); }
          70% { transform: translate(2%, -1%); }
          90% { transform: translate(-1%, 2%); }
        }
        button { font-family: var(--f); }
        button:focus-visible { outline: 1.5px solid rgba(255,255,255,0.4); outline-offset: 2px; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--warm-20) !important; }
        select { appearance: none; cursor: pointer; }
        select option { background: var(--select-bg); color: var(--warm); }
        .grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998; opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence baseFrequency='0.75' numOctaves='4' type='fractalNoise'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
          background-size: 128px;
        }
      `}</style>

      <div className="grain" />
      {exportOpen && <ExportModal data={data} onClose={() => setExportOpen(false)} />}

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 48,
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        padding: "0 24px",
        borderBottom: "1px solid var(--warm-06)", background: "var(--surface)",
        backdropFilter: "blur(24px) saturate(1.3)", WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        transition: "background 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => { setBuilt(false); setProductionFrameId(null); setSelectedFrameId(null); }}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", opacity: 0.9, transition: "opacity 0.15s ease" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.9"}
            title="Back to home"
          ><WLogo color="var(--warm)" size={16} /></div>
          {built && <>
            <div style={{ width: 1, height: 16, background: "var(--warm-08)" }} />
            <span style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 500, color: "var(--warm)" }}>{data.meta.title}</span>
            <span style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 300, color: "var(--warm-25)" }}>{data.meta.client} &middot; :{data.meta.format}</span>
          </>}
        </div>

        {/* Center spacer */}
        <div />

        {built && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <PremiumButton variant="ghost" onClick={() => dispatch({ type: "UNDO" })} disabled={past.length === 0} style={{ padding: "5px 8px", fontSize: 14 }} title="Undo (Ctrl+Z)">{"↩"}</PremiumButton>
            <PremiumButton variant="ghost" onClick={() => dispatch({ type: "REDO" })} disabled={future.length === 0} style={{ padding: "5px 8px", fontSize: 14 }} title="Redo (Ctrl+Shift+Z)">{"↪"}</PremiumButton>

            <div style={{ width: 1, height: 14, background: "var(--warm-08)", margin: "0 6px" }} />

            <PremiumButton variant="secondary" onClick={() => setExportOpen(true)} style={{ padding: "5px 14px", fontSize: 11, gap: 5 }}>
              <SectionIcon name="download" size={12} color="var(--warm-50)" /> Export
            </PremiumButton>

            <div style={{ width: 1, height: 14, background: "var(--warm-08)", margin: "0 6px" }} />

            <PremiumButton variant="ghost" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              style={{ padding: "5px 8px" }}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <SectionIcon name={isDark ? "sun" : "moon"} size={14} color="var(--warm-30)" />
            </PremiumButton>
          </div>
        )}

        {/* Theme toggle when not built (landing page) */}
        {!built && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <PremiumButton variant="ghost" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              style={{ padding: "5px 8px" }}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <SectionIcon name={isDark ? "sun" : "moon"} size={14} color="var(--warm-30)" />
            </PremiumButton>
          </div>
        )}
      </nav>

      {/* Content area */}
      <div style={{ display: "flex", height: built ? "calc(100vh - 48px)" : "auto" }}>
        {/* Main */}
        <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          {!built && <BriefForm onGenerate={handleGenerate} generating={generating} error={generationError} />}
          {built && !productionFrameId && (
            <OneSheetWorkspace data={data} selectedFrameId={selectedFrameId}
              highlightedFrames={highlightedFrames} onSelectFrame={selectFrame}
              onUpdateMeta={(field, value) => dispatch({ type: "UPDATE_META", field, value })}
              dispatch={dispatch}
              assetTabOpen={assetTabOpen} onToggleAssetTab={handleToggleAssetTab}
              onAIAssist={handleAssetAIAssist} />
          )}
          {built && productionFrameId && prodFrame && (
            <ProductionView frame={prodFrame} data={data} dispatch={dispatch}
              onBack={() => { setProductionFrameId(null); setSelectedFrameId(null); }}
              onPrev={() => { if (prodIdx > 0) { const nf = data.frames[prodIdx - 1]; setProductionFrameId(nf.id); setSelectedFrameId(nf.id); } }}
              onNext={() => { if (prodIdx < data.frames.length - 1) { const nf = data.frames[prodIdx + 1]; setProductionFrameId(nf.id); setSelectedFrameId(nf.id); } }}
              hasPrev={prodIdx > 0} hasNext={prodIdx < data.frames.length - 1}
              onDeleteFrame={handleDeleteFrame}
              onFocusChat={handleFocusChat}
            />
          )}
        </main>

        {/* Sidebar -- always AI Chat */}
        {built && (
          <div style={{
            width: sidebarOpen ? 380 : 0, flexShrink: 0, overflow: "hidden",
            borderLeft: sidebarOpen ? "1px solid var(--warm-06)" : "none",
            background: "var(--surface-solid)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            transition: "width 0.35s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <div style={{ width: 380, height: "100%" }}>
              <SidebarPanel onClose={() => setSidebarOpen(false)}>
                <AIChatPanel data={data} dispatch={dispatch}
                  chatMessages={chatMessages} chatBusy={chatBusy}
                  selectedFrameId={selectedFrameId}
                  onSendMessage={handleSendMessage}
                  onDismissFrame={() => { setSelectedFrameId(null); setProductionFrameId(null); }}
                  onOpenProduction={() => { if (selectedFrameId) setProductionFrameId(selectedFrameId); }}
                  onMentionClick={handleMentionClick}
                  chatAssetContext={chatAssetContext}
                  onDismissAssetContext={() => setChatAssetContext(null)}
                  chatFocusTrigger={chatFocusTrigger}
                />
              </SidebarPanel>
            </div>
          </div>
        )}

        {/* Floating AI Chat tab — right edge when sidebar closed */}
        {built && <AIChatTab sidebarOpen={sidebarOpen} onClick={() => setSidebarOpen(true)} />}
      </div>
    </div>
  );
}

// -- SHARED STYLES --------------------------------------------

const secLabel = {
  fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)",
  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8,
};

const lbl = {
  display: "block", fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
  color: "var(--warm-30)", marginBottom: 7, letterSpacing: "0.01em",
};

const inp = {
  width: "100%", background: "var(--warm-04)", border: "1px solid var(--warm-06)",
  borderRadius: 8, padding: "11px 14px", color: "var(--warm)", fontSize: 14,
  fontWeight: 400, fontFamily: "var(--f)", outline: "none", boxSizing: "border-box",
  letterSpacing: "-0.01em", transition: "border-color 0.2s ease",
};
