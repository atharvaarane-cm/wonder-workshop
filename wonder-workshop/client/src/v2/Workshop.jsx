import { useState, useEffect, useRef, useCallback, useReducer, createContext, useContext, useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoonIcon, SparklesIcon, SunIcon } from "lucide-react";

// Shared spring config — used across press/hover feedback so the whole
// app feels physically coherent. Tuned to feel snappy on click without
// the bouncy overshoot of a softer spring.
const TAP_SPRING = { type: "spring", stiffness: 420, damping: 30, mass: 0.6 };
const HOVER_SCALE = 1.012;
const TAP_SCALE = 0.985;
import { generateBrief, chatWithTools, regenerateShotList } from "../hooks/useBrief.js";
import {
  V2_CHAT_TOOLS,
  applyV2ChatActions,
  buildV2ChatContext,
  improveV2ChatInstruction,
  summarizeV2ChatResult,
} from "./aiChat.js";
import { v1BriefToV2Data } from "./migration.js";
import { briefFromV2Data } from "./briefFromV2Data.js";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover";
import OnePager from "../components/OnePager.jsx";
import { ProjectSidebar } from "./components/sidebar/ProjectSidebar.jsx";
import { BriefSettingsCard } from "./components/BriefPanel.jsx";
import { GenerateStoryboardButton } from "./components/GenerateStoryboardButton.jsx";
import {
  HOME_BACKGROUND_OPTIONS,
  HOME_BACKGROUND_STORAGE_KEY,
  HomeBackground,
  HomeBackgroundSwitch,
  normalizeHomeBackground,
} from "./components/home/HomeBackground.jsx";
import { StoryboardFrameCard } from "./components/storyboard/StoryboardFrameCard.jsx";
import { V2Lightbox } from "./components/V2Lightbox.jsx";
import { generateImage, upscaleImage, talentPrompt, locationPrompt, productPrompt, framePrompt, talentHeadshotPrompt, talentFullBodyPrompt, moodPrompt } from "./imageGen.js";
import iconAspectUrl from "../assets/icon-aspect.svg";
import iconClockUrl from "../assets/icon-clock.svg";
import iconDropfilesUrl from "../assets/icon-dropfiles.svg";
import iconFolderUrl from "../assets/icon-folder.svg";
import iconLockedSvg from "../assets/icon-locked.svg?raw";
import iconRegenerateSvg from "../assets/icon-regenerate.svg?raw";
import iconSparkleUrl from "../assets/icon-sparkle.svg";
import iconStoryboardTitleUrl from "../assets/icon-storyboard-title.svg";
import iconUnlockedSvg from "../assets/icon-unlocked.svg?raw";
import iconNavBrandSvg from "../assets/icon-nav-brand.svg?raw";
import iconNavCharSvg from "../assets/icon-nav-char.svg?raw";
import iconNavElementsSvg from "../assets/icon-nav-elements.svg?raw";
import iconNavLocationSvg from "../assets/icon-nav-location.svg?raw";
import iconNavMoodSvg from "../assets/icon-nav-mood.svg?raw";
import ratioIcon169Svg from "../assets/ratio-icon-16-9.svg?raw";
import ratioIcon916Svg from "../assets/ratio-icon-9-16.svg?raw";
import ratioIcon11Svg from "../assets/ratio-icon-1-1.svg?raw";
import ratioIcon45Svg from "../assets/ratio-icon-4-5.svg?raw";
import ratioIcon43Svg from "../assets/ratio-icon-4-3.svg?raw";
import ratioIcon21Svg from "../assets/ratio-icon-2-1.svg?raw";
import {
  newProjectId,
  listProjects,
  loadProject,
  loadProjectAsync,
  saveProject,
  saveProjectAsync,
  saveProjectSync,
  deleteProject,
  renameProject,
  setProjectFolder,
  getActiveProjectId,
  setActiveProjectId,
  listFolders,
  createFolder,
  deleteFolder,
  renameFolder,
} from "./persistence.js";

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

export function WLogo({ color = "#fff", size = 18 }) {
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
// Spelled-out labels for the shot-type dropdown. Stored value stays
// the short token (used by reducer + image-gen prompts); only the
// dropdown UI shows the long form so non-production users can pick.
const SHOT_TYPE_LABELS = {
  WIDE: "Wide",
  MED: "Medium",
  MCU: "Medium close-up",
  CU: "Close-up",
  ECU: "Extreme close-up",
  OTS: "Over the shoulder",
  POV: "Point of view",
  INSERT: "Insert",
};

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
  { label: "Create a character.", icon: "characters" },
  { label: "Add new location", icon: "locations" },
  { label: "Add a hero product or element", icon: "elements" },
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
    { id: "t1", name: "Maya Chen", handle: "@maya", role: "Lead", initials: "MC", note: "Late 20s, athletic, short black hair. Quiet intensity.", headshot: null, headshots: { front: null, side: null, threeQuarter: null, back: null }, fullBody: { front: null, side: null, threeQuarter: null, back: null }, generatedAngles: null, generationStatus: "idle", locked: false },
    { id: "t2", name: "Coach Rivera", handle: "@coach", role: "Supporting", initials: "CR", note: "50s, silver temples, warm eyes. Worn track jacket.", headshot: null, headshots: { front: null, side: null, threeQuarter: null, back: null }, fullBody: { front: null, side: null, threeQuarter: null, back: null }, generatedAngles: null, generationStatus: "idle", locked: false },
  ],
  products: [
    { id: "p1", name: "Ultra Boost X9", handle: "@ultra", category: "Footwear", hue: "#D4E157", note: "", referenceImage: null, generationStatus: "idle", locked: false },
    { id: "p2", name: "DryFit Singlet", handle: "@dryfit", category: "Apparel", hue: "#78909C", note: "", referenceImage: null, generationStatus: "idle", locked: false },
    { id: "p3", name: "Running Cap", handle: "@running", category: "Accessories", hue: "#BCAAA4", note: "", referenceImage: null, generationStatus: "idle", locked: false },
  ],
  locations: [
    { id: "l1", name: "Desert Highway", handle: "@desert", type: "ai", colors: ["#E8C47C", "#8B6F47", "#2C1810", "#FF6B35"], note: "", referenceImage: null, generationStatus: "idle", generatedImage: null, locked: false },
    { id: "l2", name: "Track Stadium", handle: "@track", type: "ref", colors: ["#1A1A2E", "#4A6FA5", "#D4D4D4", "#FF4444"], note: "", referenceImage: null, generationStatus: "idle", generatedImage: null, locked: false },
    { id: "l3", name: "Motel Room", handle: "@motel", type: "ai", colors: ["#3D2B1F", "#D4A574", "#8B7355", "#FFE4B5"], note: "", referenceImage: null, generationStatus: "idle", generatedImage: null, locked: false },
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
  // Section-level locks. Either this OR a per-item lock blocks
  // regeneration on that asset. Toggled from each tab's header.
  locks: { talent: false, locations: false, products: false, mood: false, brand: false },
  // Version history per slot. Keys are slot identifiers like
  // "talent.t1.headshot", "talent.t1.headshots.front", "location.l1",
  // "product.p1", "frame.f1", "mood.m1". Each value is an array of
  // { src, createdAt } records, oldest first, capped at MAX_VERSIONS.
  // Reducer cases that write images auto-append.
  versionHistory: {},
  frames: [
    { id: "f1", number: "01", shotType: "WIDE", camera: "Static", brief: "Dawn. Empty road to vanishing point. Heat shimmer. @maya runs toward camera, impossibly small against the landscape.", talentIds: ["t1"], locationId: "l1", productIds: [], cameraAngle: "front", cameraHeight: "eye", lens: "wide", movement: "static", imageStatus: "placeholder", uploadedImage: null, duration: "5s" },
    { id: "f2", number: "02", shotType: "ECU", camera: "Tracking \xB7 Worm's Eye", brief: "@maya's feet in @ultra. Each strike kicks dust. Breath before music. Rhythm as score.", talentIds: ["t1"], locationId: "l1", productIds: ["p1"], cameraAngle: "front", cameraHeight: "worm", lens: "normal", movement: "track", imageStatus: "placeholder", uploadedImage: null, duration: "5s" },
    { id: "f3", number: "03", shotType: "MED", camera: "Tracking", brief: "@coach at the track edge, stopwatch in hand. Watching something off-screen. Pride, worry, memory.", talentIds: ["t2"], locationId: "l2", productIds: [], cameraAngle: "3qR", cameraHeight: "eye", lens: "telephoto", movement: "track", imageStatus: "placeholder", uploadedImage: null, duration: "5s" },
    { id: "f4", number: "04", shotType: "WIDE", camera: "Crane \xB7 High Angle", brief: "@maya rounds the final curve. Stadium lights flicker on. Alone on the track, running like the stands are full.", talentIds: ["t1"], locationId: "l2", productIds: ["p2"], cameraAngle: "front", cameraHeight: "high", lens: "wide", movement: "crane", imageStatus: "placeholder", uploadedImage: null, duration: "5s" },
    { id: "f5", number: "05", shotType: "ECU", camera: "Handheld", brief: "Extreme close-up. @maya's eyes. Sweat on her brow. She sees the finish. We see every mile.", talentIds: ["t1"], locationId: "l2", productIds: [], cameraAngle: "front", cameraHeight: "eye", lens: "telephoto", movement: "handheld", imageStatus: "placeholder", uploadedImage: null, duration: "5s" },
    { id: "f6", number: "06", shotType: "WIDE", camera: "Static", brief: "@maya breaks the plane. Doesn't celebrate. Stops. Breathes. @coach enters frame. No words. A nod.", talentIds: ["t1", "t2"], locationId: "l2", productIds: ["p1"], cameraAngle: "front", cameraHeight: "eye", lens: "normal", movement: "static", imageStatus: "placeholder", uploadedImage: null, duration: "5s" },
  ],
};

// -- REDUCER --------------------------------------------------

function renumber(frames) {
  return frames.map((f, i) => ({ ...f, number: String(i + 1).padStart(2, "0") }));
}

// Append a new image URL to versionHistory under the given slotKey.
// Dedupes consecutive duplicate URLs (so flipping versions via
// onSelectVersion → UPDATE_X doesn't pile copies) and trims to the
// last MAX_VERSIONS to bound localStorage memory. Called from every
// reducer case that writes a new image URL into the model.
const MAX_VERSIONS_PER_SLOT = 12;
function appendVersion(history, slotKey, src) {
  if (!slotKey || !src) return history || {};
  const prev = (history || {})[slotKey] || [];
  const last = prev[prev.length - 1];
  if (last && last.src === src) return history || {}; // dedupe
  const next = [...prev, { src, createdAt: Date.now() }];
  const trimmed = next.length > MAX_VERSIONS_PER_SLOT ? next.slice(-MAX_VERSIONS_PER_SLOT) : next;
  return { ...(history || {}), [slotKey]: trimmed };
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
        ...clearStaleGenerationState(action.data),
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
    case "CLEAR_FRAME_IMAGE":
      return { ...state, frames: state.frames.map(f => f.id === action.frameId ? { ...f, uploadedImage: null, imageStatus: action.status || "error" } : f) };
    case "UPLOAD_FRAME_IMAGE":
      return {
        ...state,
        frames: state.frames.map(f => f.id === action.frameId ? { ...f, uploadedImage: action.dataUrl, imageStatus: "uploaded" } : f),
        versionHistory: appendVersion(state.versionHistory, `frame.${action.frameId}`, action.dataUrl),
      };
    case "ADD_FRAME": {
      const maxId = Math.max(0, ...state.frames.map(f => parseInt(f.id.slice(1))));
      const nf = {
        id: "f" + (maxId + 1), number: "00", shotType: "MED", camera: "Static",
        brief: "New frame — describe the shot.", talentIds: [],
        locationId: state.locations[0]?.id || null, productIds: [],
        cameraAngle: "front", cameraHeight: "eye", lens: "normal", movement: "static",
        imageStatus: "placeholder", uploadedImage: null, duration: "3s",
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
      const nextTalent = state.talent.map(t => {
        if (t.id !== action.id) return t;
        const updated = { ...t, [action.field]: action.value };
        if (action.field === "name") updated.handle = autoHandle(action.value);
        return updated;
      });
      // Track version when the visible headshot URL changes.
      let nextHistory = state.versionHistory;
      if (action.field === "headshot" && action.value) {
        nextHistory = appendVersion(nextHistory, `talent.${action.id}.headshot`, action.value);
      }
      return { ...state, talent: nextTalent, versionHistory: nextHistory };
    }
    case "UPDATE_TALENT_HEADSHOT_SLOT":
      // slot ∈ "front" | "side" | "threeQuarter" | "back"
      return {
        ...state,
        talent: state.talent.map(t => t.id === action.id
          ? { ...t, headshots: { ...(t.headshots || {}), [action.slot]: action.url } }
          : t),
        versionHistory: appendVersion(state.versionHistory, `talent.${action.id}.headshots.${action.slot}`, action.url),
      };
    case "UPDATE_TALENT_FULLBODY_SLOT":
      return {
        ...state,
        talent: state.talent.map(t => t.id === action.id
          ? { ...t, fullBody: { ...(t.fullBody || {}), [action.slot]: action.url } }
          : t),
        versionHistory: appendVersion(state.versionHistory, `talent.${action.id}.fullBody.${action.slot}`, action.url),
      };
    case "TOGGLE_SECTION_LOCK":
      // section ∈ "talent" | "locations" | "products" | "mood" | "brand"
      return {
        ...state,
        locks: { ...(state.locks || {}), [action.section]: !state.locks?.[action.section] },
      };
    case "TOGGLE_TALENT_LOCK":
      return {
        ...state,
        talent: state.talent.map(t => t.id === action.id ? { ...t, locked: !t.locked } : t),
      };
    case "CLEAR_TALENT_IMAGE_SLOT": {
      // slot ∈ "headshot" | "headshots:front" | "fullBody:back" | ...
      const [kind, view] = String(action.slot || "").split(":");
      return {
        ...state,
        talent: state.talent.map(t => {
          if (t.id !== action.id) return t;
          if (kind === "headshot") return { ...t, headshot: null };
          if (kind === "headshots") return { ...t, headshots: { ...(t.headshots || {}), [view]: null } };
          if (kind === "fullBody") return { ...t, fullBody: { ...(t.fullBody || {}), [view]: null } };
          return t;
        }),
      };
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
    case "UPDATE_PRODUCT_GENERATION": {
      const nextProducts = state.products.map(p => {
        if (p.id !== action.id) return p;
        const u = { ...p, generationStatus: action.status };
        if (action.image) u.referenceImage = action.image;
        return u;
      });
      const nextHistory = action.image
        ? appendVersion(state.versionHistory, `product.${action.id}`, action.image)
        : state.versionHistory;
      return { ...state, products: nextProducts, versionHistory: nextHistory };
    }
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
    case "UPDATE_LOCATION_GENERATION": {
      const nextLocations = state.locations.map(l => {
        if (l.id !== action.id) return l;
        const u = { ...l, generationStatus: action.status };
        if (action.image) u.generatedImage = action.image;
        return u;
      });
      const nextHistory = action.image
        ? appendVersion(state.versionHistory, `location.${action.id}`, action.image)
        : state.versionHistory;
      return { ...state, locations: nextLocations, versionHistory: nextHistory };
    }
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
      return {
        ...state,
        moodBoard: (state.moodBoard || []).map(m => m.id === action.id ? { ...m, image: action.dataUrl } : m),
        versionHistory: action.dataUrl
          ? appendVersion(state.versionHistory, `mood.${action.id}`, action.dataUrl)
          : state.versionHistory,
      };
    case "TOGGLE_LOCATION_LOCK":
      return {
        ...state,
        locations: state.locations.map(l => l.id === action.id ? { ...l, locked: !l.locked } : l),
      };
    case "TOGGLE_PRODUCT_LOCK":
      return {
        ...state,
        products: state.products.map(p => p.id === action.id ? { ...p, locked: !p.locked } : p),
      };
    case "CLEAR_LOCATION_IMAGE":
      return {
        ...state,
        locations: state.locations.map(l => l.id === action.id ? { ...l, generatedImage: null, referenceImage: null } : l),
      };
    case "CLEAR_PRODUCT_IMAGE":
      return {
        ...state,
        products: state.products.map(p => p.id === action.id ? { ...p, referenceImage: null } : p),
      };
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

// Actions that wholesale-replace state (load a project, finish brief
// generation). These are checkpoints — undo MUST NOT cross them, since
// the "before" state is usually an empty / blank canvas and one careless
// undo press would wipe out everything the user just generated.
const CHECKPOINT_ACTIONS = new Set(["SET_DATA"]);

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
  // Checkpoint actions reset undo history so the user can't accidentally
  // undo back past a generation / project load into the empty state.
  if (CHECKPOINT_ACTIONS.has(action.type)) {
    return { past: [], present: next, future: [] };
  }
  return { past: [...state.past.slice(-30), state.present], present: next, future: [] };
}

// Count how many image-bearing fields a data blob has populated.
// Used by the IndexedDB hydration effect to decide whether the IDB
// copy is richer than the localStorage-stripped copy already in
// memory (so we don't clobber edits in flight with stale data).
function countImageUrls(data) {
  if (!data) return 0;
  let n = 0;
  for (const t of (data.talent || [])) {
    if (t.headshot) n++;
    for (const v of Object.values(t.headshots || {})) if (v) n++;
    for (const v of Object.values(t.fullBody || {})) if (v) n++;
  }
  for (const l of (data.locations || [])) {
    if (l.generatedImage || l.referenceImage) n++;
  }
  for (const p of (data.products || [])) {
    if (p.referenceImage) n++;
  }
  for (const f of (data.frames || [])) {
    if (f.uploadedImage) n++;
  }
  for (const m of (data.moodBoard || [])) {
    if (m.image) n++;
  }
  if (data.brand?.logo) n++;
  return n;
}

function clearStaleGenerationState(data) {
  if (!data) return data;
  let changed = false;
  const next = {
    ...data,
    frames: (data.frames || []).map(f => {
      if (f.imageStatus !== "generating") return f;
      changed = true;
      return { ...f, imageStatus: f.uploadedImage ? "uploaded" : "error" };
    }),
    talent: (data.talent || []).map(t => {
      if (t.generationStatus !== "generating") return t;
      changed = true;
      return { ...t, generationStatus: t.headshot ? "complete" : "error" };
    }),
    products: (data.products || []).map(p => {
      if (p.generationStatus !== "generating") return p;
      changed = true;
      return { ...p, generationStatus: p.referenceImage ? "complete" : "error" };
    }),
    locations: (data.locations || []).map(l => {
      if (l.generationStatus !== "generating") return l;
      changed = true;
      return { ...l, generationStatus: (l.generatedImage || l.referenceImage) ? "complete" : "error" };
    }),
  };
  return changed ? next : data;
}

// -- SHARE / EXPORT HELPERS -----------------------------------
// Strips data: URLs from a project's image fields so the JSON fits
// reasonably in a URL hash. Gemini-hosted URLs are short strings and
// survive the trip; only user-uploaded blobs are dropped.
function stripDataUrls(data) {
  const isData = (s) => typeof s === "string" && s.startsWith("data:");
  return {
    ...data,
    talent: (data.talent || []).map(t => ({
      ...t,
      headshot: isData(t.headshot) ? null : t.headshot,
      headshots: t.headshots ? Object.fromEntries(
        Object.entries(t.headshots).map(([k, v]) => [k, isData(v) ? null : v]),
      ) : t.headshots,
      fullBody: t.fullBody ? Object.fromEntries(
        Object.entries(t.fullBody).map(([k, v]) => [k, isData(v) ? null : v]),
      ) : t.fullBody,
    })),
    products: (data.products || []).map(p => ({
      ...p,
      referenceImage: isData(p.referenceImage) ? null : p.referenceImage,
    })),
    locations: (data.locations || []).map(l => ({
      ...l,
      generatedImage: isData(l.generatedImage) ? null : l.generatedImage,
      referenceImage: isData(l.referenceImage) ? null : l.referenceImage,
    })),
    frames: (data.frames || []).map(f => ({
      ...f,
      uploadedImage: isData(f.uploadedImage) ? null : f.uploadedImage,
    })),
    moodBoard: (data.moodBoard || []).map(m => ({
      ...m,
      image: isData(m.image) ? null : m.image,
    })),
    brand: data.brand ? { ...data.brand, logo: isData(data.brand.logo) ? null : data.brand.logo } : data.brand,
  };
}

// Parse #share=<base64> on initial load. Returns the decoded data or
// null. Read-only-mode signal for the App's bootstrap.
function parseShareHash() {
  try {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash || "";
    if (!hash.startsWith("#share=")) return null;
    const encoded = hash.slice("#share=".length);
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    console.warn("[share] parse failed", e);
    return null;
  }
}

// -- UI EVENT BUS (confirm modal) ------------------------------
// Module-level pub/sub so any code path — components, async
// handlers, event listeners — can call confirm(...) without threading
// context through every prop. Toasts are handled by coss toastManager.

const uiBus = {
  listeners: { toast: [], confirm: [] },
  emit(event, payload) {
    for (const l of (this.listeners[event] || [])) l(payload);
  },
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return () => { this.listeners[event] = this.listeners[event].filter(l => l !== cb); };
  },
};

// -- PENDING BUS ----------------------------------------------
// Module-level pending state — tracks every asset slot whose image
// has been queued or is in-flight in a generation pool. Components
// subscribe via usePending(key) to render shimmer whether or not
// the slot has actually started yet (so the user can see what's
// QUEUED, not just what's running through a 3-worker pool).
//
// Slot keys:
//   talent.<id>.primary
//   talent.<id>.headshots.<view>
//   talent.<id>.fullBody.<view>
//   location.<id>
//   product.<id>
//   mood.<index>
//   frame.<id>
const _pending = new Set();
const _pendingListeners = new Set();
function _notifyPending() { for (const fn of _pendingListeners) fn(); }
export function markPending(key) {
  if (!key) return;
  if (_pending.has(key)) return;
  _pending.add(key);
  _notifyPending();
}
export function markDone(key) {
  if (!key) return;
  if (!_pending.has(key)) return;
  _pending.delete(key);
  _notifyPending();
}
export function clearAllPending() {
  if (_pending.size === 0) return;
  _pending.clear();
  _notifyPending();
}
function usePending(key) {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    _pendingListeners.add(force);
    return () => { _pendingListeners.delete(force); };
  }, []);
  if (!key) return false;
  return _pending.has(key);
}

// -- DEBUG LOG BUS --------------------------------------------
// Tiny in-app logger. Calls log("info", msg, meta?) push entries
// into a ring buffer + notify the debug panel. Cap at 500 entries.
const _logBuffer = [];
const _logListeners = new Set();
const LOG_CAP = 500;
function _notifyLog() { for (const fn of _logListeners) fn(); }
export function log(level, message, meta) {
  const entry = { id: Date.now() + "_" + Math.random().toString(36).slice(2, 6), time: Date.now(), level, message: String(message), meta };
  _logBuffer.push(entry);
  if (_logBuffer.length > LOG_CAP) _logBuffer.shift();
  _notifyLog();
  // Mirror to console with a recognizable tag.
  const tag = `[ww:${level}]`;
  if (level === "error") console.error(tag, message, meta || "");
  else if (level === "warn") console.warn(tag, message, meta || "");
  else console.log(tag, message, meta || "");
}

export function toast(message, opts = {}) {
  const type = opts.kind || opts.type || "success";
  toastManager.add({
    id: opts.id,
    title: opts.title || message,
    description: opts.description,
    type,
    timeout: opts.ttl || (type === "error" ? 6000 : 3500),
    priority: type === "error" ? "high" : "low",
  });
}
export function uiConfirm(opts = {}) {
  return new Promise(resolve => {
    uiBus.emit("confirm", { ...opts, resolve });
  });
}

function UIProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    const offConfirm = uiBus.on("confirm", (payload) => {
      setConfirmState({
        title: payload.title || "Are you sure?",
        message: payload.message || "",
        confirmLabel: payload.confirmLabel || "Confirm",
        cancelLabel: payload.cancelLabel || "Cancel",
        danger: payload.danger !== false,
        resolve: payload.resolve,
      });
    });
    return () => { offConfirm(); };
  }, []);

  const handleConfirmResolve = (v) => {
    if (confirmState?.resolve) confirmState.resolve(v);
    setConfirmState(null);
  };

  return (
    <>{/* fragment wrapper, no context */}
      {children}
      {/* Confirm modal — centered overlay, click backdrop to cancel. */}
      {confirmState && (
        <div onClick={() => handleConfirmResolve(false)} style={{
          position: "fixed", inset: 0, zIndex: 11000,
          background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            // Solid lifted surface so the modal reads as a clearly
            // separate layer from the page behind it.
            background: "#1A1A1D",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 12,
            padding: "24px 26px",
            width: "min(100%, 460px)",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.4)",
            animation: "fadeIn 0.18s ease",
          }}>
            <div style={{
              fontFamily: "var(--f)", fontSize: 17, fontWeight: 600,
              color: "#FFFFFF", letterSpacing: "-0.01em", marginBottom: 10,
            }}>
              {confirmState.title}
            </div>
            {confirmState.message && (
              <div style={{
                fontFamily: "var(--f)", fontSize: 13, fontWeight: 400,
                color: "rgba(255, 255, 255, 0.78)", lineHeight: 1.6, marginBottom: 22,
              }}>
                {confirmState.message}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => handleConfirmResolve(false)} style={{
                fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
                padding: "9px 18px", borderRadius: 7, cursor: "pointer",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                color: "#FFFFFF", outline: "none",
              }}>{confirmState.cancelLabel}</button>
              <button onClick={() => handleConfirmResolve(true)} style={{
                fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
                padding: "9px 18px", borderRadius: 7, cursor: "pointer",
                background: confirmState.danger ? "#E04141" : "#FFFFFF",
                border: confirmState.danger ? "1px solid #E04141" : "1px solid #FFFFFF",
                color: confirmState.danger ? "#fff" : "#111",
                outline: "none",
              }}>{confirmState.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
      {/* Dev log panel — toggled with the bottom-right ⓘ button.
          Subscribes to the log bus; the buffer holds the last 500
          entries. Click an error row to expand its meta payload. */}
      <DebugLogPanel />
    </>
  );
}

function DebugLogPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    _logListeners.add(force);
    return () => { _logListeners.delete(force); };
  }, []);
  const entries = _logBuffer.slice().reverse();
  const errorCount = entries.filter(e => e.level === "error").length;
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? "Hide debug log" : `Show debug log${errorCount ? ` (${errorCount} error${errorCount > 1 ? "s" : ""})` : ""}`}
        style={{
          position: "fixed", bottom: 16, left: 16, zIndex: 11500,
          width: 36, height: 36, borderRadius: 999, cursor: "pointer",
          background: errorCount > 0 ? "rgba(255,138,128,0.18)" : "rgba(0,0,0,0.55)",
          border: `1px solid ${errorCount > 0 ? "rgba(255,138,128,0.55)" : "rgba(255,255,255,0.18)"}`,
          color: errorCount > 0 ? "#FF8A80" : "rgba(255,255,255,0.65)",
          fontFamily: "var(--f)", fontSize: 11, fontWeight: 700,
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          outline: "none",
        }}
      >
        {errorCount > 0 ? errorCount : "ⓘ"}
      </button>
      {open && (
        <div style={{
          position: "fixed", bottom: 60, left: 16, zIndex: 11500,
          width: 480, maxHeight: "60vh",
          background: "rgba(14,14,16,0.96)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10, padding: 8,
          boxShadow: "0 16px 64px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "4px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Debug log · {entries.length}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { _logBuffer.length = 0; _notifyLog(); }} title="Clear" style={{
                fontFamily: "var(--f)", fontSize: 10, fontWeight: 600,
                padding: "2px 8px", borderRadius: 4, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.6)", outline: "none",
              }}>Clear</button>
              <button onClick={() => setOpen(false)} title="Close" style={{
                fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
                width: 22, height: 22, borderRadius: 4, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.6)", outline: "none",
              }}>×</button>
            </div>
          </div>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {entries.length === 0 && (
              <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "rgba(255,255,255,0.4)", padding: 12, textAlign: "center" }}>
                Nothing logged yet.
              </div>
            )}
            {entries.map(e => {
              const color = e.level === "error" ? "#FF8A80" : e.level === "warn" ? "#FFC857" : "rgba(255,255,255,0.7)";
              const tagBg = e.level === "error" ? "rgba(255,138,128,0.18)" : e.level === "warn" ? "rgba(255,200,87,0.15)" : "rgba(255,255,255,0.08)";
              const t = new Date(e.time);
              const hh = String(t.getHours()).padStart(2, "0");
              const mm = String(t.getMinutes()).padStart(2, "0");
              const ss = String(t.getSeconds()).padStart(2, "0");
              return (
                <div key={e.id} style={{
                  display: "flex", gap: 6, padding: "4px 8px",
                  fontFamily: "ui-monospace, SF Mono, Consolas, monospace",
                  fontSize: 11, lineHeight: 1.5,
                  borderRadius: 4,
                  alignItems: "flex-start",
                }}>
                  <span style={{ color: "rgba(255,255,255,0.32)", flexShrink: 0 }}>{hh}:{mm}:{ss}</span>
                  <span style={{
                    flexShrink: 0,
                    padding: "0 5px", borderRadius: 3,
                    background: tagBg, color,
                    fontWeight: 700, fontSize: 9, letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    alignSelf: "center",
                  }}>{e.level}</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", wordBreak: "break-word", flex: 1 }}>
                    {e.message}
                    {e.meta && (
                      <span style={{ color: "rgba(255,255,255,0.42)" }}> {JSON.stringify(e.meta).slice(0, 200)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
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

function Reveal({ children, delay = 0, y = 20, duration = 540, direction = "down" }) {
  const revealY = direction === "down" ? -Math.abs(y) : Math.abs(y);
  return (
    <div
      className="ww-reveal"
      style={{
        "--ww-reveal-y": `${revealY}px`,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
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

function EditableText({ value, onChange, multiline, style = {}, placeholder, maxHeight, onEditingChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { onEditingChange?.(editing); /* eslint-disable-next-line */ }, [editing]);
  // Auto-grow the textarea to fit content, bounded by maxHeight (defaults
  // to 600px so a 12-paragraph brief doesn't push the storyboard off
  // screen). Recompute on every draft change so it tracks typing.
  const cap = maxHeight ?? 600;
  const autoSize = () => {
    const el = ref.current;
    if (!el || !multiline) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, cap);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  };
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current.select) ref.current.select();
      // Defer one tick so the textarea is in the DOM with its computed
      // width before we measure scrollHeight.
      requestAnimationFrame(autoSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  useEffect(() => { if (editing) autoSize(); /* eslint-disable-next-line */ }, [draft]);
  if (editing) {
    const s = {
      ...style, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 4, padding: multiline ? "8px 10px" : "2px 8px", outline: "none",
      width: "100%", boxSizing: "border-box", fontFamily: "inherit",
      fontSize: style.fontSize || "inherit", fontWeight: style.fontWeight || "inherit",
      color: style.color || "var(--warm)", letterSpacing: style.letterSpacing || "inherit",
      lineHeight: style.lineHeight || "inherit",
      // Multiline auto-grows — disable manual resize handle so users
      // can't drag past the cap. Single-line is unchanged.
      resize: multiline ? "none" : "none",
      // Sensible floor while typing (overridden by style.minHeight if passed).
      minHeight: style.minHeight ?? (multiline ? 96 : undefined),
      maxHeight: multiline ? cap : undefined,
    };
    const commit = () => { setEditing(false); if (draft !== value) onChange(draft); };
    const cancel = () => { setEditing(false); setDraft(value); };
    const onKey = e => { if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); } if (e.key === "Escape") cancel(); };
    return multiline
      ? <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} style={s} />
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

// Sliding sheen overlay — drop into any button/container that's
// position:relative + overflow:hidden to signal something async is
// running. Uses the existing @keyframes shimmer in App's <style>.
export function ShimmerSweep({ color = "rgba(255,255,255,0.22)" }) {
  return (
    <span aria-hidden="true" style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite linear",
      pointerEvents: "none",
    }} />
  );
}

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
      style={{ ...base, ...variants[variant], ...style, overflow: "hidden" }}
    >
      {/* Sliding sheen across the button while loading — keeps the
          label / icon visible underneath so the user still reads what
          they kicked off. */}
      {loading && <ShimmerSweep color={variant === "primary" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)"} />}
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {complete ? "✓" : children}
      </span>
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

export function SectionIcon({ name, size = 14, color = "var(--warm-25)" }) {
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
    <RootMenuDropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      style={extraStyle}
      triggerSize="lg"
    />
  );
}

function DropdownAssetIcon({ src, size = 18, alt = "" }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size, flexShrink: 0, objectFit: "contain" }}
    />
  );
}

const RATIO_ICON_SVGS = {
  "16:9": ratioIcon169Svg,
  "9:16": ratioIcon916Svg,
  "1:1": ratioIcon11Svg,
  "4:5": ratioIcon45Svg,
  "4:3": ratioIcon43Svg,
  "2:1": ratioIcon21Svg,
};

function RatioIcon({ ratio, size = 18, color = "currentColor" }) {
  return (
    <span
      aria-hidden="true"
      style={{ color, width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: RATIO_ICON_SVGS[ratio] || ratioIcon169Svg }}
    />
  );
}

const CHAT_SUGGESTION_ICON_SVGS = {
  characters: iconNavCharSvg,
  locations: iconNavLocationSvg,
  elements: iconNavElementsSvg,
};

const SECTION_HEADER_ICON_SVGS = {
  Brand: iconNavBrandSvg,
  "Project Settings": iconNavBrandSvg,
  Characters: iconNavCharSvg,
  Elements: iconNavElementsSvg,
  Locations: iconNavLocationSvg,
  Mood: iconNavMoodSvg,
};

function ChatSuggestionIcon({ name }) {
  const svg = CHAT_SUGGESTION_ICON_SVGS[name]
    ?.replace("<svg ", '<svg class="size-5" ');

  return (
    <span
      aria-hidden="true"
      style={{ color: "currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg || "" }}
    />
  );
}

function RawSvgIcon({ svg }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg || "" }}
    />
  );
}

function BackArrowIcon() {
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3.84863 6.03613L2.25586 5.94043L4.27246 7.78613L5.80371 9.33789C5.94043 9.46777 6.02246 9.65234 6.02246 9.86426C6.02246 10.2744 5.71484 10.582 5.28418 10.582C5.09961 10.582 4.91504 10.5068 4.75098 10.3496L0.246094 5.84473C0.0888672 5.69434 0 5.49609 0 5.29102C0 5.08594 0.0888672 4.88086 0.246094 4.7373L4.7373 0.239258C4.91504 0.0683594 5.09961 0 5.28418 0C5.71484 0 6.02246 0.300781 6.02246 0.710938C6.02246 0.922852 5.94043 1.10742 5.80371 1.24414L4.27246 2.7959L2.25586 4.63477L3.84863 4.5459H12.1611C12.6055 4.5459 12.9199 4.84668 12.9199 5.29102C12.9199 5.72852 12.6055 6.03613 12.1611 6.03613H3.84863Z" fill="currentColor" />
    </svg>
  );
}

function LockToggleButton({ locked, onClick, unlockedLabel = "Lock", title }) {
  return (
    <Button
      variant="outline"
      size="xs"
      onClick={onClick}
      aria-pressed={locked}
      title={title || (locked ? "Unlock" : unlockedLabel)}
    >
      <RawSvgIcon svg={locked ? iconLockedSvg : iconUnlockedSvg} />
      {locked ? "Locked" : unlockedLabel}
    </Button>
  );
}

function RootMenuDropdown({ label, value, options, onChange, renderIcon, triggerIcon, triggerLabel, popupClassName, style, triggerSize = "lg", sideOffset = 4 }) {
  const selected = options.find(o => o.type !== "separator" && o.value === value);
  const selectedLabel = triggerLabel || selected?.triggerLabel || selected?.label || value;
  const menuClassName = popupClassName || "w-[var(--anchor-width)]";

  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && <label style={lbl}>{label}</label>}
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="outline"
              size={triggerSize}
              className="w-full justify-between"
            />
          }
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {triggerIcon || renderIcon?.(value, "currentColor", 18)}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedLabel}</span>
          </span>
          <SectionIcon name="chevron-down" size={14} color="currentColor" />
        </MenuTrigger>
        <MenuPopup
          align="start"
          sideOffset={sideOffset}
          className={menuClassName}
        >
          <MenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((o, idx) => o.type === "separator" ? (
              <MenuSeparator key={`separator-${idx}`} className="dark:bg-white/10" />
            ) : (
              <MenuRadioItem
                key={o.value}
                value={o.value}
                closeOnClick
                label={o.label}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  {renderIcon?.(o.value, "currentColor", 20)}
                  <span style={{ whiteSpace: "nowrap" }}>{o.label}</span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}

// -- LOCATION DROPDOWN -----------------------------------------

function LocationDropdown({ label, value, locations, onChange }) {
  const options = [{ value: "", label: "None" }, ...locations.map(loc => ({ value: loc.id, label: loc.name, loc }))];
  const selectedValue = value || "";
  const renderLocationIcon = (locationId) => {
    const loc = locations.find(l => l.id === locationId);
    if (loc) return <LocationThumb loc={loc} size={18} borderRadius={4} />;
    return (
      <span style={{
        width: 18, height: 18, borderRadius: 4, background: "var(--warm-06)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-25)",
      }}>
        —
      </span>
    );
  };

  return (
    <RootMenuDropdown
      label={label}
      value={selectedValue}
      options={options}
      onChange={v => onChange(v || null)}
      renderIcon={renderLocationIcon}
      triggerSize="lg"
    />
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
        <Button variant="destructive-outline" size="xs" onClick={() => { onConfirm(); setConfirming(false); }}>
          <SectionIcon name="trash" size={12} color="#ff6b6b" />
          Yes, Delete
        </Button>
        <Button variant="outline" size="xs" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    );
  }
  const buttonVariant = variant === "danger" ? "destructive-outline" : variant;
  return (
    <Button variant={buttonVariant} size="xs" onClick={() => setConfirming(true)} style={style}>
      {variant === "danger" && <SectionIcon name="trash" size={12} color="#ff6b6b" />}
      {label}
    </Button>
  );
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

// Sum per-shot durations to a single "Xs" string. Used by the topbar
// to show the project's total runtime as a derived value (not from
// meta.format, which is the user's target).
function totalDuration(frames) {
  if (!Array.isArray(frames) || frames.length === 0) return null;
  let sum = 0;
  for (const f of frames) {
    const n = parseFloat(String(f.duration || "").match(/[\d.]+/)?.[0] || "0");
    if (!isNaN(n)) sum += n;
  }
  return sum > 0 ? `${sum % 1 === 0 ? sum : sum.toFixed(1)}s` : null;
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

function ProductionView({ frame, data, dispatch, onBack, onPrev, onNext, hasPrev, hasNext, onDeleteFrame, onFocusChat, onRegenerateFrame }) {
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
  const handleImageError = () => {
    dispatch({ type: "CLEAR_FRAME_IMAGE", frameId: frame.id, status: "error" });
  };

  const handleGenerate = async () => {
    if (onRegenerateFrame) {
      await onRegenerateFrame(frame.id);
    }
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
    <div style={{ padding: "0 24px 32px", maxWidth: isPortrait ? 1100 : 960, margin: "0 auto", background: "transparent" }}>
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
          <div style={{ aspectRatio: aspCSS, background: frame.uploadedImage ? "transparent" : FILM[fIdx >= 0 ? fIdx % FILM.length : 0], position: "relative", overflow: "hidden" }}>
            {frame.uploadedImage && <img src={frame.uploadedImage} alt="" onError={handleImageError} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            {!frame.uploadedImage && (
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at center, transparent 0%, rgba(0,0,0,0.4) 100%)" }} />
            )}
            {frame.imageStatus === "generating" && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(255,255,255,0.07) 50%, rgba(0,0,0,0) 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite linear",
                pointerEvents: "none",
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
                  color: "#fff", letterSpacing: 0,
                  background: "rgba(0,0,0,0.64)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
                  padding: "8px 13px", borderRadius: 999,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: "var(--accent)",
                    boxShadow: "0 0 12px var(--accent)",
                    flexShrink: 0,
                  }} />
                  <span style={{ animation: "pulse 1.5s ease infinite" }}>Generating...</span>
                </span>
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
        <Card className="mb-5 px-6 py-5">
          {/* Description (renamed from Brief) */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Description</label>
            <textarea value={frame.brief} onChange={e => update("brief", e.target.value)} style={{ ...inp, minHeight: 90, resize: "vertical", lineHeight: 1.75 }} />
            {/* Tagged-asset preview — same colored chip palette as the
                storyboard sheet. Only entities present in the project
                show as chips; @-words that don't match a real asset
                (e.g. "@Manhattan" when there's no Manhattan location)
                are rendered as plain prose by renderMentions. Click
                a chip to focus the chat with that asset's name so
                you can ask the AI to do something with it. */}
            {(() => {
              const tagged = [];
              const seen = new Set();
              const re = /@[\w-]+/g;
              for (const m of (frame.brief || "").matchAll(re)) {
                const handle = m[0].toLowerCase();
                if (seen.has(handle)) continue;
                const t = data.talent.find(x => (x.handle || "").toLowerCase() === handle);
                if (t) { tagged.push({ asset: t, type: "talent" }); seen.add(handle); continue; }
                const l = data.locations.find(x => (x.handle || "").toLowerCase() === handle);
                if (l) { tagged.push({ asset: l, type: "location" }); seen.add(handle); continue; }
                const p = data.products.find(x => (x.handle || "").toLowerCase() === handle);
                if (p) { tagged.push({ asset: p, type: "product" }); seen.add(handle); continue; }
              }
              if (tagged.length === 0) return null;
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tagged</span>
                  {tagged.map(({ asset, type }) => {
                    const colors = MENTION_COLORS[type];
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        title={`Open ${asset.name} in the chat`}
                        onClick={() => {
                          onFocusChat?.();
                          toast(`${asset.name} ${asset.handle} ready to discuss in chat`, { kind: "info", ttl: 2500 });
                        }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 999,
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                          cursor: "pointer", outline: "none",
                        }}
                      >
                        {asset.handle || `@${asset.name?.split(/\s+/)[0]?.toLowerCase()}`}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Shot Type + Camera Movement side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ChevronDropdown
              label="Shot Type"
              value={frame.shotType}
              options={SHOT_TYPES.map(s => ({ value: s, label: SHOT_TYPE_LABELS[s] || s }))}
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

          <div className="mt-5 flex border-t border-white/10 pt-5">
            <Button
              variant="destructive-outline"
              size="xs"
              className="w-fit gap-1.5"
              onClick={() => onDeleteFrame(frame.id)}
            >
              <SectionIcon name="trash" size={12} color="#ff6b6b" />
              Delete Frame
            </Button>
          </div>
        </Card>
        </div>
        </div>{/* close portrait grid wrapper */}
      </Reveal>
    </div>
  );
}

// -- BRAND PANEL (single-record panel, not array) ---------------
// Logo upload + name + URL + guidelines. Sits inside the Brand tab.

function BrandPanel({ brand, sectionLocked, dispatch }) {
  const fileRef = useRef(null);
  const logo = brand?.logo;
  const [refetching, setRefetching] = useState(false);
  // Logo fallback chain — Clearbit's free API returns 404 for many
  // domains in 2026, so we fall back to Google's favicon endpoints
  // (which work for basically every registered domain). Match the v1
  // behavior: try the explicit logo URL first, then s2/favicons,
  // then gstatic/faviconV2, then show the upload placeholder.
  function domainFrom(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }
  function domainGuessFromName(name) {
    const slug = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return slug ? `${slug}.com` : "";
  }
  const domain = domainFrom(brand?.url) || domainFrom(logo) || domainGuessFromName(brand?.name);
  const fallbacks = [
    logo,
    domain && `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    domain && `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`,
  ].filter(Boolean);
  const [srcIdx, setSrcIdx] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setSrcIdx(0); setLogoFailed(false); }, [logo, brand?.url, brand?.name]);
  const handleLogoError = () => {
    if (srcIdx + 1 < fallbacks.length) setSrcIdx(i => i + 1);
    else setLogoFailed(true);
  };
  const logoUsable = fallbacks.length > 0 && !logoFailed;
  const currentLogoSrc = logoUsable ? fallbacks[srcIdx] : null;

  function onLogoFile(file) {
    if (sectionLocked) return;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => dispatch({ type: "UPLOAD_BRAND_LOGO", dataUrl: e.target.result });
    reader.readAsDataURL(file);
  }

  // Brand auto-generate = re-fetch /api/brand with the current brand
  // URL or name. Pulls in fresh logo + guidelines + colors. Unlike
  // image gen this doesn't produce a new image — it looks up the
  // brand's official assets.
  async function refetchBrand() {
    if (sectionLocked || refetching) return;
    const input = (brand?.url || brand?.name || "").trim();
    if (!input) return;
    setRefetching(true);
    try {
      let brandKey = input;
      try {
        const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
        const url = new URL(normalized);
        brandKey = url.hostname.replace(/^www\./, "").split(".")[0];
      } catch {}
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: brandKey }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error || `HTTP ${res.status}`);
      if (payload.logoUrl) dispatch({ type: "UPLOAD_BRAND_LOGO", dataUrl: payload.logoUrl });
      if (payload.sourceUrl) dispatch({ type: "UPDATE_BRAND", field: "url", value: payload.sourceUrl });
      if (payload.rules) dispatch({ type: "UPDATE_BRAND", field: "guidelines", value: payload.rules });
      if (payload.brand) dispatch({ type: "UPDATE_BRAND", field: "name", value: payload.brand });
      toast(`Brand info refreshed${payload.brand ? ` for ${payload.brand}` : ""}`, { kind: "success" });
    } catch (e) {
      console.error("[brand refetch]", e);
      toast(`Brand lookup failed: ${e?.message?.slice(0, 120) || "unknown"}`, { kind: "error" });
    } finally {
      setRefetching(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader
        title="Brand"
        count={0}
        locked={sectionLocked}
        generating={refetching}
        onToggleLock={() => dispatch({ type: "TOGGLE_SECTION_LOCK", section: "brand" })}
        onAutoGenerate={brand?.url || brand?.name ? refetchBrand : undefined}
        autoGenerateLabel="Refetch brand"
      />
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Logo upload zone — square. Renders the logo as a real <img>
            so we can detect load failures (Clearbit's free logo API
            often returns 404) and fall back to the upload prompt. */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); onLogoFile(e.dataTransfer.files?.[0]); }}
          style={{
            width: 96, height: 96, borderRadius: 10, cursor: "pointer",
            background: "var(--warm-04)",
            border: "1px dashed var(--warm-10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "border-color 0.15s ease",
            position: "relative", overflow: "hidden",
          }}
        >
          {currentLogoSrc && (
            <img
              key={currentLogoSrc}
              src={currentLogoSrc}
              alt=""
              onError={handleLogoError}
              style={{
                position: "absolute", inset: 6,
                width: "calc(100% - 12px)", height: "calc(100% - 12px)",
                objectFit: "contain",
              }}
            />
          )}
          {!logoUsable && (
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
            <Input
              type="text"
              size="lg"
              value={brand?.name || ""}
              onChange={e => dispatch({ type: "UPDATE_BRAND", field: "name", value: e.target.value })}
              placeholder="Brand name"
            />
          </div>
          <div>
            <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>URL</label>
            <Input
              type="text"
              size="lg"
              value={brand?.url || ""}
              onChange={e => dispatch({ type: "UPDATE_BRAND", field: "url", value: e.target.value })}
              placeholder="nike.com"
            />
          </div>
        </div>
      </div>
      <div>
        <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Guidelines</label>
        <Textarea
          size="lg"
          value={brand?.guidelines || ""}
          onChange={e => dispatch({ type: "UPDATE_BRAND", field: "guidelines", value: e.target.value })}
          placeholder="Brand voice, tone, dos and don'ts…"
          rows={3}
        />
      </div>
    </div>
  );
}

// -- MOOD PANEL (image grid) ------------------------------------
// Visual references for tone, palette, composition. Click a tile to
// upload an image; type a caption to describe what the reference is
// pointing at.

function MoodPanel({ moodBoard, sectionLocked, dispatch, data }) {
  const addBtnRef = useRef(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  function onTileUpload(id, file) {
    if (sectionLocked) return;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => dispatch({ type: "UPLOAD_MOOD_IMAGE", id, dataUrl: e.target.result });
    reader.readAsDataURL(file);
  }

  // Mood auto-gen — regenerate every existing tile's image using its
  // caption as the prompt. Tiles without captions are skipped.
  async function bulkRegenerate() {
    if (sectionLocked || bulkGenerating) return;
    setBulkGenerating(true);
    for (const m of moodBoard) {
      if (!m.caption) continue;
      try {
        const url = await generateImage(moodPrompt(m.caption), { ratio: "1:1" });
        dispatch({ type: "UPLOAD_MOOD_IMAGE", id: m.id, dataUrl: url });
      } catch (err) { console.error("[mood regen]", err); }
    }
    setBulkGenerating(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <SectionHeader
          title="Mood"
          count={moodBoard.length}
          locked={sectionLocked}
          generating={bulkGenerating}
          onToggleLock={() => dispatch({ type: "TOGGLE_SECTION_LOCK", section: "mood" })}
          onAutoGenerate={moodBoard.some(m => m.caption) ? bulkRegenerate : undefined}
          autoGenerateLabel="Regenerate all"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {moodBoard.map(m => (
          <MoodTile
            key={m.id}
            item={m}
            dispatch={dispatch}
            locked={sectionLocked}
            versions={data?.versionHistory?.[`mood.${m.id}`] || []}
          />
        ))}
        <div style={{ position: "relative" }}>
          <button
            ref={addBtnRef}
            onClick={() => dispatch({ type: "ADD_MOOD", data: {} })}
            style={{
              width: "100%", aspectRatio: "1/1", borderRadius: 8, cursor: "pointer",
              background: "transparent", border: "1px dashed var(--warm-10)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              color: "var(--warm-25)", outline: "none",
            }}
          >
            <SectionIcon name="plus" size={14} color="var(--warm-25)" />
            <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, letterSpacing: "0.02em" }}>Add reference</span>
          </button>
          <div aria-hidden="true" style={{ width: "100%", marginTop: 4, fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, padding: "3px 5px", visibility: "hidden" }}>
            Caption…
          </div>
        </div>
      </div>
      {moodBoard.length === 0 && (
        <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 400, color: "var(--warm-25)", textAlign: "center", marginTop: 10, lineHeight: 1.6 }}>
          Drop in mood references — color palettes, film stills, photos. They guide tone without driving generation directly.
        </div>
      )}
    </div>
  );
}

function MoodTile({ item, dispatch, locked, versions = [] }) {
  // Mood tiles use V2ImageSlot directly so they get the same full
  // blue hover bar (Expand / Download / Replace / Improve with AI /
  // Regenerate / Delete) as every other image in v2. Caption sits
  // below the tile and stays inline-editable.
  async function regenerate(opts) {
    const captionText = (item.caption || "Mood reference, cinematic, evocative").trim();
    const base = moodPrompt(captionText);
    let prompt = base;
    if (opts && typeof opts === "object" && opts.customPrompt) prompt = opts.customPrompt;
    else if (opts && typeof opts === "object" && opts.instruction) prompt = `${base} Refinement: ${opts.instruction}. Keep the same mood; apply the refinement.`;
    else if (typeof opts === "string" && opts) prompt = `${base} Refinement: ${opts}. Keep the same mood; apply the refinement.`;
    const url = await generateImage(prompt, { ratio: "1:1" });
    dispatch({ type: "UPLOAD_MOOD_IMAGE", id: item.id, dataUrl: url });
    return url;
  }
  return (
    <div style={{ position: "relative" }}>
      <V2ImageSlot
        src={item.image}
        label="Mood"
        ratio="1:1"
        locked={locked}
        pendingKey={`mood.${item.id}`}
        basePrompt={moodPrompt((item.caption || "Mood reference, cinematic, evocative").trim())}
        versions={versions}
        onSelectVersion={src => dispatch({ type: "UPLOAD_MOOD_IMAGE", id: item.id, dataUrl: src })}
        onRegenerate={regenerate}
        onClear={() => dispatch({ type: "UPLOAD_MOOD_IMAGE", id: item.id, dataUrl: null })}
        onUpload={dataUrl => dispatch({ type: "UPLOAD_MOOD_IMAGE", id: item.id, dataUrl })}
      />
      <input
        value={item.caption || ""}
        onChange={e => dispatch({ type: "UPDATE_MOOD", id: item.id, field: "caption", value: e.target.value })}
        placeholder="Caption…"
        style={{ width: "100%", marginTop: 4, fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, padding: "3px 5px", border: "none", background: "transparent", color: "var(--warm-35)", outline: "none" }}
      />
      <button
        onClick={() => dispatch({ type: "DELETE_MOOD", id: item.id })}
        title="Remove tile"
        disabled={locked}
        style={{
          position: "absolute", top: 4, right: 4, zIndex: 4,
          width: 20, height: 20, borderRadius: 4,
          background: "rgba(0,0,0,0.55)", border: "none", color: "#fff",
          fontSize: 12, cursor: locked ? "not-allowed" : "pointer",
          opacity: locked ? 0.4 : 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >×</button>
    </div>
  );
}

// -- CHARACTER TAB (tile grid + drill-down detail view) ----------
// Per Logan's 2026-05-28 redesign: Characters tab shows a tile grid
// (face + name above each tile, "Add Character" tile at end). Click
// any tile → drill into detail view with name, description, REFERENCE
// slot, 4 HEADSHOT slots (FRONT/SIDE/3-4/BACK), 4 FULL BODY slots —
// mirroring v1's Character Design section layout while keeping the
// v2 IA (left-rail asset nav + persistent right pane).

function CharacterTab({ data, dispatch }) {
  const [viewingId, setViewingId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const locked = !!data.locks?.talent;
  // Listen for "user clicked the active tab" — pop back to grid view.
  useEffect(() => {
    function onReset(e) { if (e.detail?.tab === "talent") setViewingId(null); }
    window.addEventListener("ww-asset-tab-reset", onReset);
    return () => window.removeEventListener("ww-asset-tab-reset", onReset);
  }, []);

  if (viewingId) {
    const character = data.talent.find(t => t.id === viewingId);
    if (!character) {
      setTimeout(() => setViewingId(null), 0);
      return null;
    }
    return (
      <CharacterDetailView
        character={character}
        data={data}
        dispatch={dispatch}
        sectionLocked={locked}
        onBack={() => setViewingId(null)}
      />
    );
  }

  async function bulkRegenerate() {
    if (locked || bulkGenerating) return;
    setBulkGenerating(true);
    for (const t of data.talent) {
      if (t.locked) continue; // per-character lock still wins
      dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "generating" });
      try {
        const url = await generateImage(talentPrompt(t), { ratio: "1:1" });
        dispatch({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: url });
        dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: "front", url });
        dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "complete" });
      } catch (err) {
        console.error("[character regen]", t.name, err);
        dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "error" });
      }
    }
    setBulkGenerating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader
        title="Characters"
        count={data.talent.length}
        locked={locked}
        generating={bulkGenerating}
        onToggleLock={() => dispatch({ type: "TOGGLE_SECTION_LOCK", section: "talent" })}
        onAutoGenerate={bulkRegenerate}
        autoGenerateLabel={data.talent.some(t => t.headshot) ? "Regenerate all" : "Auto-generate"}
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}>
        {data.talent.map(t => (
          <CharacterTile key={t.id} character={t} onClick={() => setViewingId(t.id)} />
        ))}
        <AddCharacterTile onClick={() => dispatch({ type: "ADD_TALENT", data: {} })} />
      </div>
    </div>
  );
}

function CharacterTile({ character, onClick }) {
  const [hovered, setHovered] = useState(false);
  // Priority: explicit headshot → first generated headshot view → none.
  const img = character.headshot
    || character.headshots?.front
    || character.headshots?.threeQuarter
    || character.headshots?.side
    || character.headshots?.back
    || null;
  const status = character.generationStatus;
  const externalPending = usePending(`talent.${character.id}.primary`);
  const isPending = status === "generating" || externalPending;
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: HOVER_SCALE, y: -1 }}
      whileTap={{ scale: TAP_SCALE }}
      transition={TAP_SPRING}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: 6, borderRadius: 10, cursor: "pointer",
        background: hovered ? "var(--warm-06)" : "var(--warm-04)",
        border: hovered ? "1px solid var(--warm-12)" : "1px solid var(--warm-06)",
        outline: "none",
        overflow: "hidden",
      }}
    >
      <div style={{
        fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
        color: "var(--warm-50)", textAlign: "center",
        letterSpacing: "0.02em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{character.name || "Unnamed"}</div>
      <div style={{
        aspectRatio: "1/1", borderRadius: 8,
        background: "var(--warm-04)",
        border: "1px solid var(--warm-08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Render headshot as a real <img> rather than a CSS
            background-image. background-image was producing a faint
            ghost behind the placeholder during the partial-state window
            where status=generating but an old image was also present. */}
        {img && (
          <img
            src={img}
            alt=""
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {!img && !isPending && (
          <div style={{ textAlign: "center", color: "var(--warm-25)", position: "relative", zIndex: 1 }}>
            <SectionIcon name="users" size={20} color="var(--warm-25)" />
            <div style={{ fontFamily: "var(--f)", fontSize: 9, marginTop: 4, letterSpacing: "0.04em" }}>
              {character.initials || "??"}
            </div>
          </div>
        )}
        {/* Only show shimmer when there's no image yet — once an image
            lands, the shimmer would just smear over a real result. */}
        {isPending && !img && <ShimmerOverlay />}
        {character.locked && (
          <div title="Locked" style={{
            position: "absolute", top: 4, right: 4, zIndex: 4,
            width: 18, height: 18, borderRadius: 4,
            background: "rgba(0,0,0,0.6)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10,
          }}>🔒</div>
        )}
      </div>
      <div style={{
        fontFamily: "var(--f)", fontSize: 9, fontWeight: 400,
        color: "var(--warm-25)", textAlign: "center",
        letterSpacing: "0.06em", textTransform: "uppercase",
      }}>{character.role || ""}</div>
    </motion.button>
  );
}

function AddCharacterTile({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: 6, borderRadius: 10, cursor: "pointer",
        background: "transparent",
        border: hovered ? "1px dashed var(--warm-25)" : "1px dashed var(--warm-10)",
        transition: "all 0.15s ease",
        outline: "none",
      }}
    >
      {/* Spacer to match the height of a tile's name row */}
      <div style={{ fontSize: 11, height: 13, opacity: 0 }}>·</div>
      <div style={{
        aspectRatio: "1/1", borderRadius: 8,
        background: "transparent",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        color: hovered ? "var(--warm-50)" : "var(--warm-25)",
      }}>
        <SectionIcon name="plus" size={20} color={hovered ? "var(--warm-50)" : "var(--warm-25)"} />
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>Add Character</span>
      </div>
      <div style={{ fontSize: 9, height: 11, opacity: 0 }}>·</div>
    </button>
  );
}

function CharacterDetailView({ character, data, dispatch, sectionLocked, onBack }) {
  const VIEWS = ["front", "side", "threeQuarter", "back"];
  const VIEW_LABEL = { front: "FRONT", side: "SIDE", threeQuarter: "3/4 ANGLE", back: "BACK" };
  // Effective lock = section lock OR per-character lock. Either blocks regen.
  const effLocked = sectionLocked || character.locked;

  // `opts` is what V2ImageSlot's onRegenerate passes:
  //   undefined → just regen with the slot's base prompt
  //   "string"  → treat as Improve-with-AI refinement (append clause)
  //   { customPrompt } → bypass base, use the user's text verbatim
  //   { instruction } → same as the string form
  function resolvePrompt(basePrompt, opts) {
    if (opts && typeof opts === "object") {
      if (opts.customPrompt) return opts.customPrompt;
      if (opts.instruction) return `${basePrompt} Refinement: ${opts.instruction}. Keep the same subject and composition; apply the refinement.`;
      return basePrompt;
    }
    if (typeof opts === "string" && opts) {
      return `${basePrompt} Refinement: ${opts}. Keep the same subject and composition; apply the refinement.`;
    }
    return basePrompt;
  }
  async function regenerateReference(opts) {
    const url = await generateImage(resolvePrompt(talentPrompt(character), opts), { ratio: "1:1" });
    dispatch({ type: "UPDATE_TALENT", id: character.id, field: "headshot", value: url });
    return url;
  }
  async function regenerateHeadshot(view, opts) {
    const refs = character.headshot ? [character.headshot] : [];
    const url = await generateImage(resolvePrompt(talentHeadshotPrompt(character, view), opts), { ratio: "1:1", referenceImages: refs });
    dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: character.id, slot: view, url });
    return url;
  }
  async function regenerateFullBody(view, opts) {
    const refs = character.headshot ? [character.headshot] : [];
    const url = await generateImage(resolvePrompt(talentFullBodyPrompt(character, view), opts), { ratio: "3:4", referenceImages: refs });
    dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: character.id, slot: view, url });
    return url;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Detail header — back button, name, role, LOCK CHARACTER pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 9px", borderRadius: 6, cursor: "pointer",
          background: "transparent", border: "1px solid var(--warm-08)",
          color: "var(--warm-40)", outline: "none",
          fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
        }}>
          <span>‹</span> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableText
            value={character.name}
            onChange={v => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "name", value: v })}
            style={{ fontFamily: "var(--f)", fontSize: 20, fontWeight: 600, color: "var(--warm)", letterSpacing: "-0.01em", display: "block" }}
          />
          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-25)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
            {character.role || "Supporting"} · {character.handle}
          </div>
        </div>
        <LockToggleButton
          locked={character.locked}
          onClick={() => dispatch({ type: "TOGGLE_TALENT_LOCK", id: character.id })}
          unlockedLabel="Lock Character"
          title={character.locked ? "Unlock this character" : "Lock this character"}
        />
      </div>

      {/* Description */}
      <div>
        <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Description
        </div>
        <EditableText
          value={character.note || ""}
          onChange={v => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "note", value: v })}
          multiline
          style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, lineHeight: 1.7, color: "var(--warm-40)", display: "block" }}
          placeholder="Describe this character — age, look, energy, wardrobe…"
        />
      </div>

      {/* Reference (primary headshot — also serves as the tile thumbnail) */}
      <div>
        <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          Reference
        </div>
        <div style={{ width: 200 }}>
          <V2ImageSlot
            src={character.headshot}
            label="Reference"
            ratio="1:1"
            locked={effLocked}
            pendingKey={`talent.${character.id}.primary`}
            basePrompt={talentPrompt(character)}
            versions={data.versionHistory?.[`talent.${character.id}.headshot`] || []}
            onSelectVersion={src => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "headshot", value: src })}
            onRegenerate={regenerateReference}
            onClear={() => dispatch({ type: "CLEAR_TALENT_IMAGE_SLOT", id: character.id, slot: "headshot" })}
            onUpload={dataUrl => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "headshot", value: dataUrl })}
          />
        </div>
      </div>

      {/* Headshots grid (4 views) */}
      <SlotGrid
        label="Headshots"
        views={VIEWS}
        viewLabel={VIEW_LABEL}
        slots={character.headshots || {}}
        ratio="1:1"
        locked={effLocked}
        basePromptByView={Object.fromEntries(VIEWS.map(v => [v, talentHeadshotPrompt(character, v)]))}
        pendingKeyByView={Object.fromEntries(VIEWS.map(v => [v, `talent.${character.id}.headshots.${v}`]))}
        versionsBySlot={Object.fromEntries(VIEWS.map(v => [v, data.versionHistory?.[`talent.${character.id}.headshots.${v}`] || []]))}
        onSelectVersion={(view, src) => dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: character.id, slot: view, url: src })}
        onRegenerate={regenerateHeadshot}
        onClear={view => dispatch({ type: "CLEAR_TALENT_IMAGE_SLOT", id: character.id, slot: `headshots:${view}` })}
        onUpload={(view, dataUrl) => dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: character.id, slot: view, url: dataUrl })}
        onPopulateAll={async () => {
          for (const v of VIEWS) { try { await regenerateHeadshot(v); } catch (e) { console.error(e); } }
        }}
      />

      {/* Full Body grid (4 views) */}
      <SlotGrid
        label="Full Body"
        views={VIEWS}
        viewLabel={VIEW_LABEL}
        slots={character.fullBody || {}}
        ratio="3:4"
        locked={effLocked}
        basePromptByView={Object.fromEntries(VIEWS.map(v => [v, talentFullBodyPrompt(character, v)]))}
        pendingKeyByView={Object.fromEntries(VIEWS.map(v => [v, `talent.${character.id}.fullBody.${v}`]))}
        versionsBySlot={Object.fromEntries(VIEWS.map(v => [v, data.versionHistory?.[`talent.${character.id}.fullBody.${v}`] || []]))}
        onSelectVersion={(view, src) => dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: character.id, slot: view, url: src })}
        onRegenerate={regenerateFullBody}
        onClear={view => dispatch({ type: "CLEAR_TALENT_IMAGE_SLOT", id: character.id, slot: `fullBody:${view}` })}
        onUpload={(view, dataUrl) => dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: character.id, slot: view, url: dataUrl })}
        onPopulateAll={async () => {
          for (const v of VIEWS) { try { await regenerateFullBody(v); } catch (e) { console.error(e); } }
        }}
      />

      {/* Delete character (bottom danger zone) */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--warm-06)" }}>
        <ConfirmAction label="Delete character" onConfirm={() => {
          dispatch({ type: "DELETE_TALENT", id: character.id });
          onBack();
        }} variant="danger" />
      </div>
    </div>
  );
}

// 4-up grid used for both Headshots and Full Body inside the detail
// view. Each cell is a V2ImageSlot; clicking the slot triggers
// per-view regeneration. "Populate All" fires all four in sequence
// (matches v1's button label).
function SlotGrid({ label, views, viewLabel, slots, ratio, locked, basePromptByView = {}, pendingKeyByView = {}, versionsBySlot = {}, onSelectVersion, onRegenerate, onClear, onUpload, onPopulateAll }) {
  const [populating, setPopulating] = useState(false);
  const hasAny = views.some(v => slots[v]);

  async function handlePopulateAll() {
    setPopulating(true);
    try { await onPopulateAll(); } catch (e) { console.error(e); }
    finally { setPopulating(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 600, color: "var(--warm)", letterSpacing: "-0.01em" }}>
          {label}
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={handlePopulateAll}
          disabled={locked || populating}
          title={hasAny ? "Regenerate all 4 views" : "Generate all 4 views"}
        >
          <RawSvgIcon svg={iconRegenerateSvg} />
          {populating ? (hasAny ? "Regenerating..." : "Generating...") : (hasAny ? "Regenerate All" : "Generate All")}
        </Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {views.map(view => (
          <div key={view} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <V2ImageSlot
              src={slots[view]}
              label={viewLabel[view]}
              ratio={ratio}
              locked={locked}
              basePrompt={basePromptByView[view]}
              pendingKey={pendingKeyByView[view]}
              versions={versionsBySlot[view] || []}
              onSelectVersion={src => onSelectVersion?.(view, src)}
              onRegenerate={instruction => onRegenerate(view, instruction)}
              onClear={() => onClear(view)}
              onUpload={dataUrl => onUpload(view, dataUrl)}
            />
            <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 500, color: "var(--warm-30)", textAlign: "center", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {viewLabel[view]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// V2 image slot — simplified port of v1's ImageSlot. Renders an image
// or a placeholder; on hover (or always when not empty) shows a small
// blue action bar with Regenerate / Improve / Upload / Delete. Click
// the placeholder to fire onRegenerate. Real shimmer + lightbox + the
// full v1 hover toolbar (8 actions) land in a follow-up — this is the
// minimum surface for the redesign to feel right.
function V2ImageSlot({ src, label, ratio, locked, basePrompt, pendingKey, versions = [], onSelectVersion, onRegenerate, onClear, onUpload }) {
  const [hovered, setHovered] = useState(false);
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const [generating, setGenerating] = useState(false);
  // External pending state (from the autoGen pool's pending bus).
  // The slot shimmers whether or not its task has actually started,
  // so queued items announce themselves alongside in-flight ones.
  const externalPending = usePending(pendingKey);
  const showShimmer = generating || (externalPending && !src);
  const [improveOpen, setImproveOpen] = useState(false);
  const [improveText, setImproveText] = useState("");
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [editPromptOpen, setEditPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileRef = useRef(null);
  const toolbarCloseTimer = useRef(null);
  const toolbarTriggerId = useId();
  const aspectCSS = ratio.replace(":", "/");
  const toolbarOpen = (hovered || toolbarHovered) && src && !generating;

  useEffect(() => () => clearTimeout(toolbarCloseTimer.current), []);

  function openToolbar() {
    clearTimeout(toolbarCloseTimer.current);
    setHovered(true);
  }

  function scheduleToolbarClose() {
    clearTimeout(toolbarCloseTimer.current);
    toolbarCloseTimer.current = setTimeout(() => {
      setHovered(false);
      setToolbarHovered(false);
      setImproveOpen(false);
      setUpscaleOpen(false);
    }, 140);
  }

  function keepToolbarOpen() {
    clearTimeout(toolbarCloseTimer.current);
    setToolbarHovered(true);
  }

  async function handleUpscale(targetRes) {
    setUpscaleOpen(false);
    if (!src || locked) return;
    setGenerating(true);
    try {
      const url = await upscaleImage(src, targetRes, ratio);
      // Reuse onUpload — semantically the upscaled image is replacing the
      // current one (just like an upload would). Callers wire onUpload to
      // the correct dispatch for the slot kind.
      onUpload?.(url);
      toast(`Upscaled to ${String(targetRes).toUpperCase()}`, { kind: "success" });
    } catch (e) {
      console.error("[upscale]", e);
      toast(`Upscale failed: ${e?.message?.slice(0, 140) || "unknown"}`, { kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  // Run a "custom prompt" generation — bypasses the slot's base
  // prompt entirely and uses whatever the user typed. Caller's
  // onRegenerate accepts an opts arg that can be either a string
  // (refinement) or { customPrompt } (full override).
  async function handleCustomGenerate() {
    const text = customPrompt.trim();
    if (!text || locked) return;
    setEditPromptOpen(false);
    setGenerating(true);
    try {
      await onRegenerate?.({ customPrompt: text });
      toast("Generated from custom prompt", { kind: "success", ttl: 2500 });
    } catch (e) {
      console.error("[custom prompt]", e);
      toast(`Generation failed: ${e?.message?.slice(0, 140) || "unknown"}`, { kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  // "Improve prompt with AI" inside the Edit prompt modal — sends
  // the current text to Gemini and asks for a richer image-gen
  // prompt, replaces the textarea.
  async function handleImprovePrompt() {
    const text = customPrompt.trim();
    if (!text || improvingPrompt) return;
    setImprovingPrompt(true);
    try {
      const messages = [
        { role: "system", content: [
          "You are a senior image-prompt engineer for cinematic / editorial photography.",
          "Take the user's rough prompt and rewrite it as a single richer prompt that:",
          "- Keeps the same SUBJECT and INTENT (don't change what's being shown)",
          "- Adds specific visual detail: lighting, mood, composition, framing, lens, color palette, texture",
          "- Stays in one paragraph, no lists or headings",
          "- Does NOT include preamble, quotes, or explanations",
          "- Returns ONLY the improved prompt text, ready to paste into an image generator",
        ].join("\n") },
        { role: "user", content: text },
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const improved = (data?.message?.content || "").trim().replace(/^["'`]+|["'`]+$/g, "");
      if (improved) setCustomPrompt(improved);
    } catch (e) {
      console.error("[improve prompt]", e);
      toast(`Improve failed: ${e?.message?.slice(0, 120) || "unknown"}`, { kind: "error" });
    } finally {
      setImprovingPrompt(false);
    }
  }

  async function handleRegen(instruction) {
    if (locked) return;
    setGenerating(true);
    setImproveOpen(false);
    try {
      await onRegenerate?.(instruction);
      toast(instruction ? "Improved" : "Regenerated", { kind: "success", ttl: 2200 });
    } catch (e) {
      console.error("[V2ImageSlot regen]", e);
      toast(`Generation failed: ${e?.message?.slice(0, 140) || "unknown error"}`, { kind: "error" });
    } finally {
      setGenerating(false);
    }
  }
  async function handleImprove() {
    const text = improveText.trim();
    if (!text) return;
    setImproveText("");
    await handleRegen(text);
  }
  function handleUploadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => onUpload?.(e.target.result);
    reader.readAsDataURL(file);
  }
  async function handleDownload() {
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(label || "image").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast("Downloaded", { kind: "success", ttl: 2000 });
    } catch (e) {
      console.error("[download]", e);
      window.open(src, "_blank", "noopener");
      toast("Opened in new tab — right-click to save", { kind: "info" });
    }
  }

  return (
    <>
      <div
        onMouseEnter={openToolbar}
        onMouseMove={openToolbar}
        onMouseLeave={scheduleToolbarClose}
        onPointerEnter={openToolbar}
        onPointerMove={openToolbar}
        onPointerLeave={scheduleToolbarClose}
        style={{
          position: "relative", aspectRatio: aspectCSS, borderRadius: 8,
          background: "var(--warm-04)",
          border: "1px solid var(--warm-08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: src ? "zoom-in" : "pointer", overflow: "hidden",
        }}
        onClick={() => {
          if (src) setLightboxOpen(true);
          else if (!generating && !locked) handleRegen();
        }}
      >
        {/* Render the image as a real <img> rather than a CSS
            background-image. background-image + border-radius +
            objectFit:cover leaves a 1–2px anti-aliasing band of
            background-color at the rounded edges of the box on some
            browsers (visible as a faint horizontal line at the top of
            every tile). A position:absolute <img> covers the whole
            box exactly. */}
        {src && (
          <img
            src={src}
            alt=""
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )}
        {!src && !showShimmer && (
          <div style={{ textAlign: "center", color: "var(--warm-25)", position: "relative", zIndex: 1 }}>
            <SectionIcon name="plus" size={16} color="var(--warm-25)" />
            <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 500, marginTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
          </div>
        )}
        {showShimmer && <ShimmerOverlay />}
        {/* Version navigator — surfaces when 2+ versions exist for
            this slot. Prev/next arrows + "N of M" badge in the
            bottom-left, doesn't block the hover bar centered below. */}
        {(() => {
          const count = versions.length;
          if (count < 2 || !src) return null;
          const activeIdx = versions.findIndex(v => v.src === src);
          const selectIdx = (idx) => {
            if (idx < 0 || idx >= count) return;
            onSelectVersion?.(versions[idx].src);
          };
          return (
            <div onClick={e => e.stopPropagation()} style={{
              position: "absolute", bottom: 6, left: 6, zIndex: 5,
              display: "flex", alignItems: "center", gap: 2,
              padding: "3px 6px", borderRadius: 14,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              fontFamily: "var(--f)", fontSize: 9, fontWeight: 600,
              color: "#fff", letterSpacing: "0.04em",
            }}>
              <button onClick={() => selectIdx(activeIdx - 1)} disabled={activeIdx <= 0} title="Previous version"
                style={{ background: "transparent", border: "none", color: "#fff", cursor: activeIdx > 0 ? "pointer" : "not-allowed", opacity: activeIdx > 0 ? 1 : 0.35, padding: "0 3px", fontSize: 12, lineHeight: 1, outline: "none" }}>‹</button>
              <span>{activeIdx >= 0 ? activeIdx + 1 : "?"} / {count}</span>
              <button onClick={() => selectIdx(activeIdx + 1)} disabled={activeIdx >= count - 1} title="Next version"
                style={{ background: "transparent", border: "none", color: "#fff", cursor: activeIdx < count - 1 ? "pointer" : "not-allowed", opacity: activeIdx < count - 1 ? 1 : 0.35, padding: "0 3px", fontSize: 12, lineHeight: 1, outline: "none" }}>›</button>
            </div>
          );
        })()}
        {/* Portaled action bar — anchored to the slot but rendered outside
            the image/card clipping context. */}
        {src && !generating && (
          <Popover open={toolbarOpen} triggerId={toolbarTriggerId}>
            <PopoverTrigger id={toolbarTriggerId} className="img-hover-nav-anchor" aria-label="Image actions" />
            <PopoverPopup
              side="top"
              align="center"
              sideOffset={8}
              className="img-hover-nav-popover"
              onMouseEnter={keepToolbarOpen}
              onMouseLeave={scheduleToolbarClose}
              onClick={e => e.stopPropagation()}
            >
          <div style={{
            display: "flex", alignItems: "center", gap: 2, padding: 4, borderRadius: 20,
            background: "#006dd4", border: "1px solid #43a3fd",
            boxShadow: "0 4px 14px rgba(0,0,0,0.32)",
          }} onClick={e => e.stopPropagation()}>
            <HoverBarBtn title="Expand" onClick={() => setLightboxOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 2H2v4M10 2h4v4M14 10v4h-4M2 10v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </HoverBarBtn>
            <HoverBarBtn title="Download" onClick={handleDownload}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </HoverBarBtn>
            <HoverBarBtn title="Upload / Replace" onClick={() => fileRef.current?.click()}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 14V6M5 9l3-3 3 3M3 3h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </HoverBarBtn>
            <HoverBarBtn title="Improve with AI" disabled={locked} onClick={() => setImproveOpen(o => !o)} active={improveOpen} accent="#FFC857">
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M10.5 3.5l2 2L6 12l-2.5.5L4 10l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M13.5 1l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L13.5 1z" fill="currentColor"/>
              </svg>
            </HoverBarBtn>
            <HoverBarBtn title="Edit prompt" disabled={locked} onClick={() => setEditPromptOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M11.3 2.3l2.4 2.4L5.8 12.6 3 13.4l.8-2.8 7.5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </HoverBarBtn>
            <HoverBarBtn title="Regenerate" disabled={locked} onClick={() => handleRegen()}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </HoverBarBtn>
            <div style={{ position: "relative" }}>
              <HoverBarBtn title="Upscale" disabled={locked} active={upscaleOpen} onClick={() => setUpscaleOpen(o => !o)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 6V3h3M13 10v3h-3M3 13l4-4M13 3l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </HoverBarBtn>
              {upscaleOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: "absolute", top: "calc(100% + 6px)", left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex", flexDirection: "column", gap: 2, padding: 4,
                  minWidth: 70, borderRadius: 6, zIndex: 8,
                  background: "var(--surface-solid)",
                  border: "1px solid var(--warm-12)",
                  boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
                }}>
                  <button onClick={() => handleUpscale("2k")} style={upscaleMenuStyle()}>2K</button>
                  <button onClick={() => handleUpscale("4k")} style={upscaleMenuStyle()}>4K</button>
                </div>
              )}
            </div>
            <HoverBarBtn title="Delete" disabled={locked} onClick={onClear} danger>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </HoverBarBtn>
          </div>
            </PopoverPopup>
          </Popover>
        )}
        {/* Improve with AI popover */}
        {improveOpen && toolbarOpen && src && !generating && (
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", bottom: 56, left: "50%", transform: "translateX(-50%)",
            zIndex: 6, width: "min(90%, 320px)",
            background: "var(--surface-solid)", border: "1px solid var(--warm-10)",
            borderRadius: 10, padding: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.34)",
          }}>
            <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "var(--warm-30)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Improve with AI
            </div>
            <input
              autoFocus
              value={improveText}
              onChange={e => setImproveText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); handleImprove(); }
                if (e.key === "Escape") { e.preventDefault(); setImproveOpen(false); }
              }}
              placeholder="e.g. more cinematic / tighter framing / warmer lighting"
              style={{
                width: "100%", fontFamily: "var(--f)", fontSize: 12, fontWeight: 400,
                padding: "6px 8px", borderRadius: 6,
                background: "var(--warm-04)", border: "1px solid var(--warm-10)",
                color: "var(--warm)", outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
              <button onClick={() => setImproveOpen(false)} style={{
                fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid var(--warm-08)",
                color: "var(--warm-40)", outline: "none",
              }}>Cancel</button>
              <button onClick={handleImprove} disabled={!improveText.trim()} style={{
                fontFamily: "var(--f)", fontSize: 11, fontWeight: 700,
                padding: "5px 14px", borderRadius: 18,
                cursor: improveText.trim() ? "pointer" : "not-allowed",
                background: "rgba(255,200,87,0.10)",
                border: "1px solid rgba(255,200,87,0.6)",
                color: "#FFC857", outline: "none",
                letterSpacing: "0.02em",
                opacity: improveText.trim() ? 1 : 0.4,
                transition: "background 0.14s, border-color 0.14s",
              }}>Improve</button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { handleUploadFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {lightboxOpen && src && (
        <V2Lightbox
          src={src}
          label={label}
          basePrompt={basePrompt}
          versions={versions}
          onSelectVersion={onSelectVersion}
          onRegenerate={locked ? undefined : (opts) => onRegenerate?.(opts)}
          onUpload={locked ? undefined : onUpload}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      {editPromptOpen && (
        <div onClick={() => setEditPromptOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 9500,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(100%, 560px)", padding: 22, borderRadius: 12,
            background: "var(--surface-solid)", border: "1px solid var(--warm-12)",
            boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
            animation: "fadeIn 0.18s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "var(--warm-30)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                  Edit image prompt{label ? ` · ${label}` : ""}
                </div>
                <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-30)", lineHeight: 1.5 }}>
                  Write a custom prompt that replaces the slot's default. Use Improve with AI to enrich it.
                </div>
              </div>
              <button onClick={() => setEditPromptOpen(false)} style={{
                width: 28, height: 28, borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid var(--warm-08)",
                color: "var(--warm-30)", outline: "none",
                fontFamily: "var(--f)", fontSize: 16,
              }}>×</button>
            </div>
            <textarea
              autoFocus
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              rows={6}
              disabled={improvingPrompt}
              placeholder="Describe what you want in the image — subject, setting, lighting, framing, mood…"
              style={{
                width: "100%", fontFamily: "var(--f)", fontSize: 13, fontWeight: 300,
                padding: "10px 12px", borderRadius: 8,
                background: "var(--warm-04)", border: "1px solid var(--warm-10)",
                color: "var(--warm)", outline: "none", resize: "vertical",
                lineHeight: 1.6, opacity: improvingPrompt ? 0.6 : 1,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <button
                onClick={handleImprovePrompt}
                disabled={!customPrompt.trim() || improvingPrompt}
                title="Use Gemini to expand your prompt into a richer image-generation prompt"
                style={{
                  position: "relative", overflow: "hidden",
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 18,
                  background: "rgba(255,200,87,0.10)",
                  border: "1px solid rgba(255,200,87,0.5)",
                  color: "#FFC857",
                  cursor: (customPrompt.trim() && !improvingPrompt) ? "pointer" : "not-allowed",
                  outline: "none",
                  fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
                  opacity: (customPrompt.trim() && !improvingPrompt) ? 1 : 0.5,
                }}
              >
                {improvingPrompt && <ShimmerSweep color="rgba(255,200,87,0.32)" />}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
                    <path d="M10.5 3.5l2 2L6 12l-2.5.5L4 10l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M13.5 1l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L13.5 1z" fill="currentColor"/>
                  </svg>
                  {improvingPrompt ? "Improving…" : "Improve with AI"}
                </span>
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditPromptOpen(false)} style={{
                  fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
                  padding: "7px 14px", borderRadius: 7, cursor: "pointer",
                  background: "transparent", border: "1px solid var(--warm-12)",
                  color: "var(--warm-40)", outline: "none",
                }}>Cancel</button>
                <button onClick={handleCustomGenerate} disabled={!customPrompt.trim()} style={{
                  fontFamily: "var(--f)", fontSize: 12, fontWeight: 700,
                  padding: "7px 16px", borderRadius: 7, cursor: customPrompt.trim() ? "pointer" : "not-allowed",
                  background: "var(--warm)", border: "none",
                  color: "var(--bg)", outline: "none",
                  opacity: customPrompt.trim() ? 1 : 0.4,
                }}>✦ Generate</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// -- LOCATION TAB (tile grid + drill-down) ----------------------
// Same shape as CharacterTab. Single reference image per location
// (no FRONT/SIDE/BACK grid — locations aren't multi-angle assets).

function LocationTab({ data, dispatch }) {
  const [viewingId, setViewingId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const aspect = data.meta?.aspect || "16:9";
  const locked = !!data.locks?.locations;
  useEffect(() => {
    function onReset(e) { if (e.detail?.tab === "locations") setViewingId(null); }
    window.addEventListener("ww-asset-tab-reset", onReset);
    return () => window.removeEventListener("ww-asset-tab-reset", onReset);
  }, []);

  if (viewingId) {
    const loc = data.locations.find(l => l.id === viewingId);
    if (!loc) {
      setTimeout(() => setViewingId(null), 0);
      return null;
    }
    return <LocationDetailView location={loc} data={data} dispatch={dispatch} sectionLocked={locked} aspect={aspect} onBack={() => setViewingId(null)} />;
  }

  async function bulkRegenerate() {
    if (locked || bulkGenerating) return;
    setBulkGenerating(true);
    for (const l of data.locations) {
      if (l.locked) continue;
      dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "generating" });
      try {
        const url = await generateImage(locationPrompt(l), { ratio: aspect });
        dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
      } catch (err) {
        console.error("[location regen]", l.name, err);
        dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "error" });
      }
    }
    setBulkGenerating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader
        title="Locations"
        count={data.locations.length}
        locked={locked}
        generating={bulkGenerating}
        onToggleLock={() => dispatch({ type: "TOGGLE_SECTION_LOCK", section: "locations" })}
        onAutoGenerate={bulkRegenerate}
        autoGenerateLabel={data.locations.some(l => l.generatedImage || l.referenceImage) ? "Regenerate all" : "Auto-generate"}
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}>
        {(() => {
          const asp = data.meta?.aspect || "16:9";
          const aspectCSS = asp.includes(":") ? asp.replace(":", "/") : `${asp}/1`;
          return (
            <>
              {data.locations.map(l => (
                <LocationTile key={l.id} location={l} onClick={() => setViewingId(l.id)} aspectCSS={aspectCSS} />
              ))}
              <AddTile label="Add Location" iconName="map" onClick={() => dispatch({ type: "ADD_LOCATION", data: {} })} aspectCSS={aspectCSS} />
            </>
          );
        })()}
      </div>
    </div>
  );
}

function LocationTile({ location, onClick, aspectCSS = "16/9" }) {
  const [hovered, setHovered] = useState(false);
  const img = location.generatedImage || location.referenceImage;
  const status = location.generationStatus;
  const externalPending = usePending(`location.${location.id}`);
  const isPending = status === "generating" || externalPending;
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: HOVER_SCALE, y: -1 }}
      whileTap={{ scale: TAP_SCALE }}
      transition={TAP_SPRING}
      style={{
        position: "relative",
        aspectRatio: aspectCSS,
        padding: 0, borderRadius: 10, cursor: "pointer",
        background: img ? "transparent" : "var(--warm-04)",
        border: hovered ? "1px solid var(--warm-12)" : "1px solid var(--warm-06)",
        outline: "none",
        overflow: "hidden",
      }}
    >
      {img && (
        <img
          src={img}
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {!img && !isPending && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SectionIcon name="map" size={24} color="var(--warm-25)" />
        </div>
      )}
      {isPending && !img && <ShimmerOverlay />}
      {/* Bottom gradient + name overlay — keeps the title legible without
          stealing vertical space from the image. */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "16px 10px 8px",
        background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)",
        fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
        color: "#fff", textAlign: "left",
        letterSpacing: "0.02em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>{location.name || "Unnamed"}</div>
      {location.locked && (
        <div title="Locked" style={{
          position: "absolute", top: 6, right: 6, zIndex: 4,
          width: 18, height: 18, borderRadius: 4,
          background: "rgba(0,0,0,0.6)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10,
        }}>🔒</div>
      )}
    </motion.button>
  );
}

function LocationDetailView({ location, data, dispatch, sectionLocked, aspect = "16:9", onBack }) {
  const effLocked = sectionLocked || location.locked;
  const versions = data?.versionHistory?.[`location.${location.id}`] || [];
  async function regenerateReference(opts) {
    const base = locationPrompt(location);
    let prompt = base;
    if (opts && typeof opts === "object" && opts.customPrompt) prompt = opts.customPrompt;
    else if (opts && typeof opts === "object" && opts.instruction) prompt = `${base} Refinement: ${opts.instruction}. Keep the same location; apply the refinement.`;
    else if (typeof opts === "string" && opts) prompt = `${base} Refinement: ${opts}. Keep the same location; apply the refinement.`;
    const url = await generateImage(prompt, { ratio: aspect });
    dispatch({ type: "UPDATE_LOCATION_GENERATION", id: location.id, status: "complete", image: url });
    return url;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <DetailHeader
        onBack={onBack}
        name={location.name}
        subtitle={`${location.type === "ai" ? "AI generated" : "Reference"} · ${location.handle}`}
        locked={effLocked}
        onToggleLock={() => dispatch({ type: "TOGGLE_LOCATION_LOCK", id: location.id })}
        onRename={v => dispatch({ type: "UPDATE_LOCATION", id: location.id, field: "name", value: v })}
        lockLabel="Lock Location"
      />
      <DescriptionField
        label="Description"
        value={location.note || ""}
        onChange={v => dispatch({ type: "UPDATE_LOCATION", id: location.id, field: "note", value: v })}
        placeholder="Describe this location — time of day, weather, architecture, atmosphere…"
      />
      <div>
        <SectionLabel>Reference</SectionLabel>
        <div style={{ width: 360 }}>
          <V2ImageSlot
            src={location.generatedImage || location.referenceImage}
            label="Reference"
            ratio="16:9"
            locked={effLocked}
            basePrompt={locationPrompt(location)}
            pendingKey={`location.${location.id}`}
            versions={versions}
            onSelectVersion={src => dispatch({ type: "UPDATE_LOCATION_GENERATION", id: location.id, status: "complete", image: src })}
            onRegenerate={regenerateReference}
            onClear={() => dispatch({ type: "CLEAR_LOCATION_IMAGE", id: location.id })}
            onUpload={dataUrl => dispatch({ type: "UPDATE_LOCATION_GENERATION", id: location.id, status: "complete", image: dataUrl })}
          />
        </div>
      </div>
      {/* Palette section removed — the location.colors swatches were
          decorative grays unrelated to the actual image. Logan asked
          to drop them. (location.colors data field stays in storage
          for back-compat.) */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--warm-06)" }}>
        <ConfirmAction label="Delete location" onConfirm={() => {
          dispatch({ type: "DELETE_LOCATION", id: location.id });
          onBack();
        }} variant="danger" />
      </div>
    </div>
  );
}

// -- ELEMENT TAB (products tile grid + drill-down) --------------

function ElementTab({ data, dispatch }) {
  const [viewingId, setViewingId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const locked = !!data.locks?.products;
  useEffect(() => {
    function onReset(e) { if (e.detail?.tab === "products") setViewingId(null); }
    window.addEventListener("ww-asset-tab-reset", onReset);
    return () => window.removeEventListener("ww-asset-tab-reset", onReset);
  }, []);

  if (viewingId) {
    const prod = data.products.find(p => p.id === viewingId);
    if (!prod) {
      setTimeout(() => setViewingId(null), 0);
      return null;
    }
    return <ElementDetailView product={prod} data={data} dispatch={dispatch} sectionLocked={locked} onBack={() => setViewingId(null)} />;
  }

  async function bulkRegenerate() {
    if (locked || bulkGenerating) return;
    setBulkGenerating(true);
    for (const p of data.products) {
      if (p.locked) continue;
      dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "generating" });
      try {
        const url = await generateImage(productPrompt(p), { ratio: "1:1" });
        dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "complete", image: url });
      } catch (err) {
        console.error("[product regen]", p.name, err);
        dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "error" });
      }
    }
    setBulkGenerating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader
        title="Elements"
        count={data.products.length}
        locked={locked}
        generating={bulkGenerating}
        onToggleLock={() => dispatch({ type: "TOGGLE_SECTION_LOCK", section: "products" })}
        onAutoGenerate={bulkRegenerate}
        autoGenerateLabel={data.products.some(p => p.referenceImage) ? "Regenerate all" : "Auto-generate"}
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}>
        {data.products.map(p => (
          <ElementTile key={p.id} product={p} onClick={() => setViewingId(p.id)} />
        ))}
        <AddTile label="Add Element" iconName="box" onClick={() => dispatch({ type: "ADD_PRODUCT", data: {} })} />
      </div>
    </div>
  );
}

function ElementTile({ product, onClick }) {
  const [hovered, setHovered] = useState(false);
  const img = product.referenceImage;
  const status = product.generationStatus;
  const externalPending = usePending(`product.${product.id}`);
  const isPending = status === "generating" || externalPending;
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: HOVER_SCALE, y: -1 }}
      whileTap={{ scale: TAP_SCALE }}
      transition={TAP_SPRING}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: 6, borderRadius: 10, cursor: "pointer",
        background: hovered ? "var(--warm-06)" : "var(--warm-04)",
        border: hovered ? "1px solid var(--warm-12)" : "1px solid var(--warm-06)",
        outline: "none",
      }}
    >
      <div style={{
        fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
        color: "var(--warm-50)", textAlign: "center",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{product.name || "Unnamed"}</div>
      <div style={{
        aspectRatio: "1/1", borderRadius: 8,
        background: img ? `url(${img}) center/cover` : `linear-gradient(135deg, ${product.hue || "#444"}33, var(--warm-04))`,
        border: "1px solid var(--warm-08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {!img && !isPending && (
          <SectionIcon name="box" size={20} color="var(--warm-25)" />
        )}
        {isPending && !img && <ShimmerOverlay />}
        {product.locked && (
          <div title="Locked" style={{
            position: "absolute", top: 4, right: 4, zIndex: 4,
            width: 18, height: 18, borderRadius: 4,
            background: "rgba(0,0,0,0.6)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10,
          }}>🔒</div>
        )}
      </div>
      <div style={{
        fontFamily: "var(--f)", fontSize: 9, fontWeight: 400,
        color: "var(--warm-25)", textAlign: "center",
        letterSpacing: "0.06em", textTransform: "uppercase",
      }}>{product.category || ""}</div>
    </motion.button>
  );
}

function ElementDetailView({ product, data, dispatch, sectionLocked, onBack }) {
  const effLocked = sectionLocked || product.locked;
  const versions = data?.versionHistory?.[`product.${product.id}`] || [];
  async function regenerateReference(opts) {
    const base = productPrompt(product);
    let prompt = base;
    if (opts && typeof opts === "object" && opts.customPrompt) prompt = opts.customPrompt;
    else if (opts && typeof opts === "object" && opts.instruction) prompt = `${base} Refinement: ${opts.instruction}. Keep the same product; apply the refinement.`;
    else if (typeof opts === "string" && opts) prompt = `${base} Refinement: ${opts}. Keep the same product; apply the refinement.`;
    const url = await generateImage(prompt, { ratio: "1:1" });
    dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: product.id, status: "complete", image: url });
    return url;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <DetailHeader
        onBack={onBack}
        name={product.name}
        subtitle={`${product.category || "Element"} · ${product.handle}`}
        locked={effLocked}
        onToggleLock={() => dispatch({ type: "TOGGLE_PRODUCT_LOCK", id: product.id })}
        onRename={v => dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "name", value: v })}
        lockLabel="Lock Element"
      />
      <div>
        <SectionLabel>Category</SectionLabel>
        <EditableText
          value={product.category || ""}
          onChange={v => dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "category", value: v })}
          placeholder="e.g. Footwear, Apparel, Beverage…"
          style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, color: "var(--warm-50)", display: "block" }}
        />
      </div>
      <DescriptionField
        label="Description"
        value={product.note || ""}
        onChange={v => dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "note", value: v })}
        placeholder="Describe this element — color, material, shape, key details for product photography…"
      />
      <div>
        <SectionLabel>Reference</SectionLabel>
        <div style={{ width: 240 }}>
          <V2ImageSlot
            src={product.referenceImage}
            label="Reference"
            ratio="1:1"
            locked={effLocked}
            basePrompt={productPrompt(product)}
            pendingKey={`product.${product.id}`}
            versions={versions}
            onSelectVersion={src => dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: product.id, status: "complete", image: src })}
            onRegenerate={regenerateReference}
            onClear={() => dispatch({ type: "CLEAR_PRODUCT_IMAGE", id: product.id })}
            onUpload={dataUrl => dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: product.id, status: "complete", image: dataUrl })}
          />
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--warm-06)" }}>
        <ConfirmAction label="Delete element" onConfirm={() => {
          dispatch({ type: "DELETE_PRODUCT", id: product.id });
          onBack();
        }} variant="danger" />
      </div>
    </div>
  );
}

// -- SHARED DETAIL VIEW PRIMITIVES ------------------------------
// Header (back button, editable name, subtitle, lock pill) and small
// reusable bits used by Location/Element/Character detail views.

function DetailHeader({ onBack, name, subtitle, locked, onToggleLock, onRename, lockLabel = "Lock" }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <Button variant="outline" size="xs" onClick={onBack} title="Back">
          <BackArrowIcon />
          Back
        </Button>
        <div style={{ minWidth: 0 }}>
          <EditableText
            value={name}
            onChange={onRename}
            style={{ fontFamily: "var(--f)", fontSize: 20, fontWeight: 600, color: "var(--warm)", letterSpacing: "-0.01em", display: "block" }}
          />
          {subtitle && (
            <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-25)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <LockToggleButton
        locked={locked}
        onClick={onToggleLock}
        unlockedLabel={lockLabel}
        title={locked ? `Unlock ${name}` : lockLabel}
      />
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function DescriptionField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <EditableText
        value={value}
        onChange={onChange}
        multiline
        style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, lineHeight: 1.7, color: "var(--warm-40)", display: "block" }}
        placeholder={placeholder}
      />
    </div>
  );
}

// SectionHeader — shared header for each asset tab (and Brand/Mood
// panels). Carries the section title + count + Auto-generate button
// + Lock section toggle. Both buttons are real: auto-generate runs a
// caller-supplied function, lock toggles data.locks[section].

function SectionTitle({ title, count }) {
  const svg = SECTION_HEADER_ICON_SVGS[title];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      minWidth: 0,
      fontFamily: "var(--f)",
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "var(--warm)",
    }}>
      <span
        aria-hidden="true"
        style={{ color: "var(--warm)", width: 24, height: 24, display: "inline-flex", flexShrink: 0, lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: svg || "" }}
      />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}{count !== undefined ? ` - ${count}` : ""}
      </span>
    </div>
  );
}

function SectionHeader({ title, count, locked, onToggleLock, onAutoGenerate, generating, autoGenerateLabel = "Auto-generate" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <SectionTitle title={title} count={count} />
      <div style={{ display: "flex", gap: 6 }}>
        {onAutoGenerate && (
          <Button
            variant="outline"
            size="xs"
            onClick={onAutoGenerate}
            disabled={locked || generating}
            title={locked ? "Unlock section to regenerate" : "Regenerate every item in this section"}
          >
            <SparklesIcon aria-hidden="true" className="size-3.5" />
            {generating ? "Generating…" : autoGenerateLabel}
          </Button>
        )}
        <LockToggleButton
          locked={locked}
          onClick={onToggleLock}
          unlockedLabel={`Lock ${title}`}
          title={locked ? `Unlock ${title}` : `Lock ${title}`}
        />
      </div>
    </div>
  );
}

function AddTile({ label, iconName, onClick, aspectCSS }) {
  const [hovered, setHovered] = useState(false);
  // When aspectCSS is passed (e.g. from LocationsTab matching the project
  // aspect), the whole button becomes a single aspect-ratio'd dashed cell
  // — no padding, no helper rows — so it lines up edge-to-edge with the
  // new image-fills-tile LocationTile.
  if (aspectCSS) {
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative", aspectRatio: aspectCSS,
          padding: 0, borderRadius: 10, cursor: "pointer",
          background: "transparent",
          border: hovered ? "1px dashed var(--warm-25)" : "1px dashed var(--warm-10)",
          transition: "all 0.15s ease",
          outline: "none",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          color: hovered ? "var(--warm-50)" : "var(--warm-25)",
        }}
      >
        <SectionIcon name="plus" size={22} color={hovered ? "var(--warm-50)" : "var(--warm-25)"} />
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: 6, borderRadius: 10, cursor: "pointer",
        background: "transparent",
        border: hovered ? "1px dashed var(--warm-25)" : "1px dashed var(--warm-10)",
        transition: "all 0.15s ease",
        outline: "none",
      }}
    >
      <div style={{ fontSize: 11, height: 13, opacity: 0 }}>·</div>
      <div style={{
        aspectRatio: "1/1", borderRadius: 8,
        background: "transparent",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        color: hovered ? "var(--warm-50)" : "var(--warm-25)",
      }}>
        <SectionIcon name="plus" size={20} color={hovered ? "var(--warm-50)" : "var(--warm-25)"} />
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, letterSpacing: "0.04em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 9, height: 11, opacity: 0 }}>·</div>
    </button>
  );
}

function HoverBarBtn({ children, title, onClick, disabled, danger, active, accent }) {
  const [h, setH] = useState(false);
  const bg = active ? "rgba(255,255,255,0.32)"
    : h ? (danger ? "rgba(255,86,86,0.92)" : "rgba(255,255,255,0.22)")
    : "transparent";
  // accent overrides the default white icon — used for "Improve with AI"
  // (orange/yellow #FFC857 per v1) so it reads as a different action.
  const color = accent || "#fff";
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 26, height: 26, borderRadius: 999,
        background: bg,
        border: "none", color, cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.12s",
      }}
    >{children}</button>
  );
}

// -- ASSET EXPANDED PANEL (scrollable with fade hints) ----------

function ProjectSettingsPanel({ data, dispatch, onUpdateMeta, onRunRegeneration }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.2s ease" }}>
      <Card className="p-5 shadow-md" style={{ background: "#222222" }}>
        <BrandPanel brand={data.brand} sectionLocked={!!data.locks?.brand} dispatch={dispatch} />
      </Card>
      <BriefSettingsCard
        value={data.meta?.treatment || ""}
        onUpdateMeta={onUpdateMeta}
        data={data}
        onRunRegeneration={onRunRegeneration}
      />
    </div>
  );
}

function AssetExpandedPanel({ activeTab, data, dispatch, expanded, setExpanded, typeKey, onAIAssist, onUpdateMeta, onRunRegeneration }) {
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

  // Brand / Mood / Characters have their own panels (don't fit the
  // generic array-of-cards layout used by Products / Locations).
  // Branch before the items map so the legacy rendering stays
  // untouched for the unbranched tabs.
  if (activeTab === "settings" || activeTab === "brand") {
    return (
      <ProjectSettingsPanel
        data={data}
        dispatch={dispatch}
        onUpdateMeta={onUpdateMeta}
        onRunRegeneration={onRunRegeneration}
      />
    );
  }
  if (activeTab === "mood") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <MoodPanel moodBoard={data.moodBoard || []} sectionLocked={!!data.locks?.mood} dispatch={dispatch} data={data} />
      </div>
    );
  }
  if (activeTab === "talent") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <CharacterTab data={data} dispatch={dispatch} />
      </div>
    );
  }
  if (activeTab === "locations") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <LocationTab data={data} dispatch={dispatch} />
      </div>
    );
  }
  if (activeTab === "products") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <ElementTab data={data} dispatch={dispatch} />
      </div>
    );
  }

  // All known tabs (settings / talent / locations / products / mood) are
  // branched above. This fallback should never fire in practice — keep
  // a safe empty list so the render doesn't crash if a new tab is
  // added without a panel handler.
  const items = [];

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

function AssetTabBar({ data, dispatch, activeTab, onAIAssist, onUpdateMeta, onRunRegeneration }) {
  const [expanded, setExpanded] = useState(null);
  const typeKey = { talent: "TALENT", products: "PRODUCT", locations: "LOCATION", settings: "BRAND", brand: "BRAND", mood: "MOOD" }[activeTab] || "TALENT";
  const tintByTab = {
    talent: "rgba(193, 21, 21, 0.08)",
    products: "rgba(47, 193, 21, 0.08)",
    locations: "rgba(193, 133, 21, 0.08)",
    mood: "rgba(21, 118, 193, 0.08)",
  };
  const cardBackground = tintByTab[activeTab]
    ? `linear-gradient(0deg, ${tintByTab[activeTab]}, ${tintByTab[activeTab]}), #222222`
    : "#222222";

  if (activeTab === "settings" || activeTab === "brand") {
    return (
      <div style={{ marginTop: 20, paddingTop: 16 }}>
        <AssetExpandedPanel
          activeTab={activeTab}
          data={data}
          dispatch={dispatch}
          expanded={expanded}
          setExpanded={setExpanded}
          typeKey={typeKey}
          onAIAssist={onAIAssist}
          onUpdateMeta={onUpdateMeta}
          onRunRegeneration={onRunRegeneration}
        />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16 }}>
      <Card className="p-5 shadow-md" style={{
        background: cardBackground,
        minHeight: 220,
        maxHeight: 800,
        overflowY: "auto",
      }}>
        <AssetExpandedPanel
          activeTab={activeTab}
          data={data}
          dispatch={dispatch}
          expanded={expanded}
          setExpanded={setExpanded}
          typeKey={typeKey}
          onAIAssist={onAIAssist}
          onUpdateMeta={onUpdateMeta}
          onRunRegeneration={onRunRegeneration}
        />
      </Card>
    </div>
  );
}

// -- ONE-SHEET WORKSPACE (drag-drop grid) ---------------------


function OneSheetWorkspace({ data, selectedFrameId, highlightedFrames, onSelectFrame, onUpdateMeta, dispatch, assetTabOpen, onToggleAssetTab, onAIAssist, onRetryFrame, onRunRegeneration }) {
  const [dragId, setDragId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null); // insertion index (0..frames.length)
  const didDrag = useRef(false);
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
  const isProjectSettings = assetTabOpen === "settings" || assetTabOpen === "brand";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 32px", background: "transparent" }}>
      <Reveal>
        <div>
          {/* Header */}
	          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
	            <div>
	              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
	                {isProjectSettings ? (
	                  <RawSvgIcon svg={iconNavBrandSvg} />
	                ) : (
	                  <SectionIcon name="film" size={11} color="var(--warm-25)" />
	                )}
	                <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
	                  {isProjectSettings ? "Project Settings" : "Storyboard"}
	                </span>
	              </div>
	              {isProjectSettings ? (
	                <div style={{ fontFamily: "var(--f)", fontSize: 32, fontWeight: 700, color: "var(--warm)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
	                  Project Settings
	                </div>
	              ) : (
	                <EditableText value={data.meta.title} onChange={v => onUpdateMeta("title", v)}
	                  style={{ fontFamily: "var(--f)", fontSize: 32, fontWeight: 700, color: "var(--warm)", letterSpacing: "-0.03em", display: "block", lineHeight: 1.1 }} />
	              )}
	            </div>
	          </div>

	          {/* Asset Tab Bar */}
	          <AssetTabBar data={data} dispatch={dispatch} activeTab={assetTabOpen}
	            onAIAssist={onAIAssist}
	            onUpdateMeta={onUpdateMeta}
	            onRunRegeneration={onRunRegeneration} />

	          {/* Frame Grid */}
	          {!isProjectSettings && (() => {
            const asp = data.meta.aspect;
            const aspNum = asp.includes(":") ? (() => { const [w,h] = asp.split(":").map(Number); return w/h; })() : parseFloat(asp);
            const aspCSS = asp.includes(":") ? asp.replace(":", "/") : `${asp}/1`;
            const cols = aspNum < 1 ? 4 : 3;
            return (
          <div style={{ paddingTop: 20, marginTop: 16 }}>
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
                    <StoryboardFrameCard key={f.id} dispatch={dispatch} frame={f} index={i} data={data} aspectCSS={aspCSS}
                      selected={selectedFrameId === f.id} highlighted={highlightedFrames.has(f.id)}
                      isDragSrc={dragId === f.id}
                      onRetry={onRetryFrame}
                      onDragStart={onDS} onDragOver={onDO} onDragLeave={onDL} onDragEnd={onDE} onDrop={onDr}
                      onClick={() => clickF(f.id)}
                      renderMentions={renderMentions} />
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
                    <StoryboardFrameCard key={f.id} dispatch={dispatch} frame={f} index={origIdx} data={data} aspectCSS={aspCSS}
                      selected={selectedFrameId === f.id} highlighted={highlightedFrames.has(f.id)}
                      isDragSrc={false}
                      onRetry={onRetryFrame}
                      onDragStart={onDS} onDragOver={onDO} onDragLeave={onDL} onDragEnd={onDE} onDrop={onDr}
                      onClick={() => clickF(f.id)}
                      renderMentions={renderMentions} />
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
          <div style={{ marginTop: 20, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <WLogo color="var(--warm-10)" size={12} />
            <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-15)" }}>Wonder AI</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// -- CHAT: MESSAGE WITH @ MENTIONS ----------------------------

// Color palette for @-mention chips by entity type. Used in SheetFrame
// brief rendering + anywhere we want to highlight cross-references.
// Reusable shimmer overlay — drop into any tile/frame container that
// has position:relative + overflow:hidden + an aspect ratio. Pulses
// while a generation is in flight to make progress obvious across
// every grid (matches v1's slot-generating affordance).
function ShimmerOverlay({ label = "Generating…" }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 3,
      background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite linear",
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}>
      <span style={{
        fontFamily: "var(--f)", fontSize: 9, fontWeight: 600,
        color: "var(--warm-50)", letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: "rgba(0,0,0,0.4)", padding: "3px 8px", borderRadius: 999,
        backdropFilter: "blur(6px)",
      }}>{label}</span>
    </div>
  );
}

const MENTION_COLORS = {
  talent:   { bg: "rgba(91,178,255,0.18)",  text: "#7EB9FF", border: "rgba(91,178,255,0.34)" },
  location: { bg: "rgba(124,252,156,0.16)", text: "#9CECB1", border: "rgba(124,252,156,0.34)" },
  product:  { bg: "rgba(242,201,76,0.18)",  text: "#F2C94C", border: "rgba(242,201,76,0.34)" },
};

// Render a chunk of brief text with @-handles styled as colored chips.
// Read-only — clicking a chip is wired up via the optional onMentionClick
// prop (matches the chat panel's behavior). Falls back to plain text for
// any @-handle that doesn't match a known entity.
function renderMentions(text, data, opts = {}) {
  const parts = parseMentions(text || "", data);
  return parts.map((part, i) => {
    if (part.type === "text") return <span key={i}>{part.value}</span>;
    const colors = MENTION_COLORS[part.asset?._type];
    if (!colors) {
      // No matching asset → strip the leading @ so things like
      // "@Manhattan" read as plain prose ("Manhattan") instead of a
      // phantom tag for nothing.
      return <span key={i}>{part.handle.replace(/^@/, "")}</span>;
    }
    return (
      <span
        key={i}
        title={part.asset?.name || part.handle}
        onClick={opts.onMentionClick ? (e => { e.stopPropagation(); opts.onMentionClick(part.asset); }) : undefined}
        style={opts.variant === "figmaCard" ? {
          display: "inline",
          padding: "1px 7.317px 2px",
          margin: "0 1px",
          borderRadius: 7.317,
          background: "rgba(32,32,32,0.4)",
          color: part.asset?._type === "product" ? "#f1d676" : "#aecff3",
          border: "0",
          fontSize: "1em",
          fontWeight: 500,
          lineHeight: "inherit",
          cursor: opts.onMentionClick ? "pointer" : "default",
        } : {
          display: "inline-block",
          padding: "0 5px", margin: "0 1px",
          borderRadius: 4,
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          fontSize: "0.95em",
          fontWeight: 500,
          cursor: opts.onMentionClick ? "pointer" : "default",
        }}
      >
        {opts.variant === "figmaCard" ? part.handle.replace(/^@/, "") : part.handle}
      </span>
    );
  });
}

function parseMentions(text, data) {
  const allAssets = [
    ...data.talent.map(t => ({ ...t, _type: "talent" })),
    ...data.products.map(p => ({ ...p, _type: "product" })),
    ...data.locations.map(l => ({ ...l, _type: "location" })),
  ];
  if (!text) return [];
  // Build a single regex that matches either:
  //   - an explicit @handle (legacy v1 path — LLM-emitted)
  //   - a bare asset name with word boundaries (so "Maya and Marcus walk
  //     into frame" chips even though the LLM didn't add @-prefixes)
  // Longest-name-first so "Maya Chen" matches before "Maya". Aliases per
  // asset: prefer the @handle without "@", the name, and the initials if
  // they're letters. Render in original case from the input text.
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const aliases = []; // { token, asset, isHandle }
  for (const a of allAssets) {
    if (a.handle) {
      const bare = a.handle.replace(/^@/, "");
      if (bare) aliases.push({ token: bare, asset: a, isHandle: true });
    }
    if (a.name) aliases.push({ token: a.name, asset: a, isHandle: false });
  }
  if (!aliases.length) return [{ type: "text", value: text }];
  // De-dup by lowercase token, keep first occurrence (handles win when tied).
  const seen = new Set();
  const unique = [];
  for (const al of aliases) {
    const k = al.token.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(al);
  }
  unique.sort((a, b) => b.token.length - a.token.length);
  const pattern = unique.map(al =>
    al.isHandle
      ? `(?:@${escapeRe(al.token)})(?![A-Za-z0-9_])`
      : `\\b${escapeRe(al.token)}\\b`
  ).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    const raw = m[0];
    const key = raw.toLowerCase().replace(/^@/, "");
    const alias = unique.find(al => al.token.toLowerCase() === key);
    const asset = alias?.asset || null;
    parts.push({ type: "mention", handle: raw, asset, matched: !!asset });
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function ChatMessage({ message: m, data, onMentionClick }) {
  // Slide-in: subtle 6px rise + fade. Spring transition gives a little
  // settle instead of the linear bottom-up scrolls every chat UI does.
  const MotionWrap = ({ children }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.7 }}
    >{children}</motion.div>
  );
  if (m.role === "system") {
    return <MotionWrap><div style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 300, color: "var(--warm-25)", lineHeight: 1.65, padding: "4px 0" }}>{m.text}</div></MotionWrap>;
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
      <MotionWrap>
      <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--warm-06)" }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, color: "var(--warm-60)", lineHeight: 1.5 }}>{renderText(m.text)}</div>
        {m.frameId && <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, color: "var(--warm-15)", marginTop: 4 }}>Frame {m.frameNumber || "?"}</div>}
      </div>
      </MotionWrap>
    );
  }

  return (
    <MotionWrap>
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
    </MotionWrap>
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
    onSendMessage(val.trim(), selectedFrameId, frame ? frame.number : null, assetContextResolved);
    setVal("");
    setMentionOpen(false);
  };

  const handleImproveWithAI = async () => {
    if (!val.trim() || improving) return;
    setImproving(true);
    const hasImageContext = selectedFrame && selectedFrame.uploadedImage;
    try {
      const improved = await improveV2ChatInstruction(val.trim(), {
        hasImageContext,
        selectedFrame,
        assetContext: assetContextResolved,
      });
      setVal(improved);
    } catch (e) {
      toast(`Couldn't improve that prompt: ${e?.message?.slice(0, 100) || "unknown error"}`, { kind: "error" });
    } finally {
      setImproving(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
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
    onSendMessage(text, selectedFrameId, frame ? frame.number : null, assetContextResolved);
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "0 16px", flex: 1, justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--f)", fontSize: 16, fontWeight: 300, color: "var(--warm-35)", letterSpacing: "-0.02em" }}>
              What should we do?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {CHAT_SUGGESTIONS.map(s => (
                <Button key={s.label} variant="outline" size="sm" className="w-[min(330px,100%)] justify-center !text-foreground/80 text-[13px] dark:!text-white/80 sm:text-[13px] [&_svg]:!size-5" onClick={() => handleSuggestion(s.label)}>
                  <ChatSuggestionIcon name={s.icon} />
                  {s.label}
                </Button>
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

  const assetCardClassName = [
    "overflow-hidden rounded-xl transition-colors",
    isComplete ? "ring-1 ring-ring/30" : "",
    isDraft ? "border-dashed" : "",
  ].filter(Boolean).join(" ");

  return (
    <Card className={assetCardClassName}>
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
    </Card>
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

// -- BRIEF FORM (with file upload) ----------------------------


function upscaleMenuStyle() {
  return {
    width: "100%", textAlign: "center",
    padding: "5px 10px", borderRadius: 4,
    background: "transparent", border: "none",
    fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
    color: "var(--warm)", cursor: "pointer", outline: "none",
    letterSpacing: "0.06em",
  };
}

export function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}

// Target-duration dropdown shown next to the aspect-ratio pill. Editable
// list of standard runtimes. Picking a new value updates meta.format
// immediately, then prompts whether to re-pace the storyboard so the
// shot list sums to the new total.
function TargetDurationControl({ value, onChange }) {
  const FORMATS = ["6", "15", "30", "60", "90", "120"];
  const selectedValue = value || "30";

  return (
    <div className="ww-format-control" style={{ minWidth: 170 }}>
      <RootMenuDropdown
        value={selectedValue}
        options={FORMATS.map(f => ({ value: f, label: `${f} sec` }))}
        onChange={onChange}
        triggerIcon={<DropdownAssetIcon src={iconClockUrl} size={18} />}
        triggerLabel={`Length: ${selectedValue} sec`}
        renderIcon={() => <DropdownAssetIcon src={iconClockUrl} size={18} />}
        style={{ marginBottom: 0 }}
        triggerSize="sm"
        popupClassName="w-max min-w-[var(--anchor-width)] max-w-[min(360px,calc(100vw-32px))]"
      />
    </div>
  );
}

// Aspect ratio dropdown shown in the topbar when a project is open.
// Click pops a menu of standard ratios. Picking one fires the
// supplied onChange, which the App routes through handleAspectChange
// (saves new ratio + asks whether to regenerate all images).
function AspectRatioControl({ value, onChange }) {
  const selectedValue = value || "16:9";

  return (
    <div className="ww-aspect-control" style={{ minWidth: 170 }}>
      <RootMenuDropdown
        value={selectedValue}
        options={BRIEF_RATIOS.map(r => ({ value: r.id, label: r.label }))}
        onChange={onChange}
        triggerIcon={<DropdownAssetIcon src={iconAspectUrl} size={18} />}
        triggerLabel={`Aspect: ${selectedValue}`}
        renderIcon={(ratio) => <RatioIcon ratio={ratio} size={18} />}
        style={{ marginBottom: 0 }}
        triggerSize="sm"
        popupClassName="w-max min-w-[var(--anchor-width)] max-w-[min(420px,calc(100vw-32px))]"
      />
    </div>
  );
}

// -- SAVE INDICATOR (top of OneSheet) ---------------------------
// Subtle status pill — "Saving…" while the debounced write is pending,
// "Saved · just now" right after, then ticks up to "2 min ago".

function SaveIndicator({ status, lastSavedAt }) {
  // Re-render every 30s so the "X min ago" label stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  let label = "";
  let dotColor = "var(--warm-25)";
  if (status === "saving") { label = "Saving…"; dotColor = "#F2C94C"; }
  else if (status === "error") { label = "Couldn't save"; dotColor = "#FF8A80"; }
  else if (status === "saved" && lastSavedAt) {
    label = `Saved · ${timeAgo(lastSavedAt)}`;
    dotColor = "#7CFC9C";
  } else { return null; }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
      color: "var(--warm-40)",
      padding: "4px 10px", borderRadius: 999,
      background: "var(--warm-04)", border: "1px solid var(--warm-06)",
      letterSpacing: "0.01em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
      {label}
    </span>
  );
}

// Length options (seconds, suffixed "s"). Direct port of v1's LENGTHS.
const BRIEF_LENGTHS = ["6s", "15s", "30s", "60s", "90s", "120s"];
// Aspect ratio options. Direct port of v1's RATIOS.
const BRIEF_RATIOS = [
  { id: "16:9", label: "16:9 - Widescreen" },
  { id: "9:16", label: "9:16 - Vertical" },
  { id: "1:1",  label: "1:1 - Square" },
  { id: "4:5",  label: "4:5 - Portrait" },
  { id: "4:3",  label: "4:3 - Classic" },
  { id: "2:1",  label: "2:1 - Wide Banner" },
];
function BriefForm({
  onGenerate,
  generating = false,
  error = null,
  folders = [],
  homeBackground,
  onHomeBackgroundChange,
}) {
  // Blank by default — no Nike/Long Run prefill anymore. v1's form
  // starts empty and so should v2. Length defaults to "30s" since
  // most spots are 30s; aspect defaults to "16:9" because most edits
  // are widescreen.
  const [meta, setMeta] = useState({
    title: "", client: "",
    format: "30", aspect: "16:9",
    treatment: "",
  });
  const [files, setFiles] = useState([]);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [improving, setImproving] = useState(false);
  const fileRef = useRef(null);

  const addFiles = (fl) => {
    const nf = Array.from(fl).map(f => ({ name: f.name, size: f.size, type: f.type }));
    setFiles(prev => [...prev, ...nf]);
  };
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  // Improve with AI — expands the user's rough brief into a richer
  // creative brief with concrete location / mood / element / character
  // / camera detail. Direct port of v1's improvePrompt() pattern;
  // same system prompt, same /api/chat path, same intent: turn a
  // 1-sentence idea into a 100-180 word grounded paragraph.
  async function improveBrief() {
    const text = (meta.treatment || "").trim();
    if (!text || improving || generating) return;
    setImproving(true);
    try {
      // This brief is going to be fed into Wonder Workshop's brief
      // generator, which extracts STRUCTURED data from it: named
      // characters (each becomes a separately-generated reference +
      // 8 view shots), named locations (each becomes an establishing
      // shot), named elements/props (each becomes a product shot),
      // and a numbered storyboard where every shot's description uses
      // @-handles to reference those entities so they re-tile back
      // together with consistent identity across frames.
      //
      // So the AI's job here is NOT just "make this sound prettier" —
      // it's "rewrite this so the structured-extraction step produces
      // a clean, sensible entity list and shot sequence that the
      // image-gen pipeline can fulfill well."
      const messages = [
        { role: "system", content: [
          "You are EXPANDING a rough creative idea into a detailed campaign brief that will be fed into an AI pipeline that generates images for every named character, location, and prop in the brief — and a 6-9 frame storyboard where each frame references them.",
          "",
          "Your output MUST be LONGER and MORE SPECIFIC than the input — never a summary, never a paraphrase.",
          "",
          "PRESERVE EVERYTHING from the input — every character, every brand name, every action must appear in the output. Then ADD concrete sensory detail. Optimize for the downstream pipeline:",
          "",
          "CHARACTERS (each becomes a generated reference + headshots + full body):",
          "- Keep the COUNT and identity from the input — don't invent characters that weren't implied.",
          "- For each character, give a specific look: age range, ethnicity (or 'open casting'), hair, build, wardrobe with color + fabric, demeanor.",
          "- Use a short proper name (e.g. 'Maya', 'Coach Rivera') so it can be tagged consistently. Avoid generic 'a woman' / 'the runner' — name them.",
          "",
          "LOCATIONS (each becomes a generated establishing shot):",
          "- Name the primary location with a short proper-noun-style label ('Bushwick rooftop', 'Sunset Beach', 'Times Square Diner') even if it's invented.",
          "- Add time of day, weather, era, architecture, signage, key environmental textures.",
          "- If multiple locations are needed, name each one distinctly.",
          "",
          "ELEMENTS / HERO PROPS (each gets its own product shot):",
          "- Only call out HERO items the camera will actually feature (the Pepsi can, the Air Force 1s, the iPhone). Each one will be generated as a separate product reference.",
          "- DON'T name minor background dressing like 'string lights' or 'terracotta planters' — those waste the pipeline's effort and clutter the asset list. Let those exist in the prose without being singled out as props.",
          "- Use the brand's actual product name when the user implied a brand.",
          "",
          "MOOD + LIGHTING:",
          "- Specific color palette (named hues, not 'warm'), lighting setup (key/fill/rim, practical sources), atmosphere, pacing/music feel.",
          "",
          "CAMERA / RENDER:",
          "- Shot variety (wide / medium / close), lens feel (24mm, 50mm, 85mm), depth of field, film stock or digital look.",
          "",
          "BANNED WORDS: 'vibrant', 'lively', 'carefree', 'bustling', 'beautiful', 'great' — replace with specific concrete imagery.",
          "",
          "FORMAT:",
          "- ONE flowing paragraph, 120-200 words.",
          "- No headings, no bullets, no labels, no quotes, no preamble.",
          "- Return ONLY the expanded brief paragraph, ready to drop into the generation tool.",
        ].join("\n") },
        { role: "user", content: text },
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, stream: false }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const payload = await res.json();
      const expanded = (payload?.message?.content || "").trim().replace(/^["'`]+|["'`]+$/g, "");
      if (expanded) {
        setMeta(m => ({ ...m, treatment: expanded }));
      }
    } catch (e) {
      console.error("[improve brief]", e);
    } finally {
      setImproving(false);
    }
  }
  const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const fmtType = (t) => t.startsWith("image/") ? "IMG" : t === "application/pdf" ? "PDF" : t.includes("word") ? "DOC" : t.startsWith("text/") ? "TXT" : "FILE";

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "5vh 5% 4vh", position: "relative", zIndex: 1 }}>
      <Reveal delay={30}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "3%" }}>
            <WLogo color="rgba(224,224,224,0.25)" size={28} />
            <HomeBackgroundSwitch value={homeBackground} onChange={onHomeBackgroundChange} />
          </div>
          <h1 style={{ fontFamily: "var(--f)", fontSize: 48, fontWeight: 200, lineHeight: 1.1, letterSpacing: "-0.05em", marginBottom: 12, color: "var(--warm)", whiteSpace: "nowrap" }}>
            Welcome to the Workshop.
          </h1>
          <p style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 300, color: "var(--warm-35)", lineHeight: 1.7, marginBottom: "5%", whiteSpace: "nowrap" }}>
            Write a brief, a script, or a sentence. Add reference files for more context. AI builds the boards.
          </p>
        </div>
      </Reveal>

      <Reveal delay={520}>
        {/* Form card sits over the W backdrop, so it needs near-solid
            opacity + a backdrop blur to keep inputs and labels readable.
            Subtle inner highlight + soft shadow lift it off the bg. */}
        <div style={{
          background: "rgba(14, 14, 16, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
          borderRadius: 14, padding: "3%", marginBottom: "2%",
        }}>
          <div style={{ marginBottom: 20, position: "relative" }}>
            <span aria-hidden="true" style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              zIndex: 2, pointerEvents: "none", display: "inline-flex", alignItems: "center",
            }}>
              <DropdownAssetIcon src={iconStoryboardTitleUrl} size={17} />
            </span>
            <Input
              type="text"
              size="lg"
              value={meta.title}
              onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
              placeholder="Enter storyboard title..."
              className="[&_[data-slot=input]]:pl-11"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 5 }}>
            <RootMenuDropdown
              value={meta.client}
              options={[
                { value: "", label: "No Folder" },
                ...(folders.length ? [{ type: "separator" }] : []),
                ...folders.map(folder => ({ value: folder, label: folder })),
              ]}
              onChange={client => setMeta(m => ({ ...m, client }))}
              triggerIcon={<DropdownAssetIcon src={iconFolderUrl} size={18} />}
              triggerLabel={meta.client || "Select Folder"}
              renderIcon={(value, _color, size = 18) => value
                ? <DropdownAssetIcon src={iconFolderUrl} size={size} />
                : <span aria-hidden="true" style={{ display: "block", width: size, height: size, flexShrink: 0 }} />
              }
              popupClassName="w-max min-w-[var(--anchor-width)] max-w-[min(420px,calc(100vw-32px))]"
            />
            <RootMenuDropdown
              value={meta.format}
              options={BRIEF_LENGTHS.map(s => {
                const seconds = s.replace(/s$/, "");
                return { value: seconds, label: `${seconds} sec` };
              })}
              onChange={v => setMeta(m => ({ ...m, format: v }))}
              triggerIcon={<DropdownAssetIcon src={iconClockUrl} size={18} />}
              triggerLabel={`Length: ${meta.format || "30"} sec`}
              renderIcon={() => <DropdownAssetIcon src={iconClockUrl} size={18} />}
            />
            <RootMenuDropdown
              value={meta.aspect}
              options={BRIEF_RATIOS.map(r => ({ value: r.id, label: r.label }))}
              onChange={v => setMeta(m => ({ ...m, aspect: v }))}
              triggerIcon={<DropdownAssetIcon src={iconAspectUrl} size={18} />}
              triggerLabel={`Aspect: ${meta.aspect || "16:9"}`}
              renderIcon={(value, color, size = 18) => <RatioIcon ratio={value} color={color} size={size} />}
            />
          </div>
          <div style={{ marginBottom: 20, position: "relative" }}>
            <Textarea value={meta.treatment} onChange={e => setMeta(m => ({ ...m, treatment: e.target.value }))}
              size="lg"
              disabled={improving}
              placeholder="Storyboard Brief..."
              className="[&_[data-slot=textarea]]:pt-2 [&_[data-slot=textarea]]:pb-16"
              style={{ minHeight: 160, resize: "vertical", lineHeight: 1.85, opacity: improving ? 0.6 : 1 }} />
              <button
                onClick={improveBrief}
                disabled={!meta.treatment?.trim() || improving || generating}
                type="button"
                title="Use Gemini to expand a rough idea into a 100-180 word grounded brief"
                style={{
                  position: "absolute", right: 14, bottom: 14, zIndex: 3, overflow: "hidden",
                  display: "flex", alignItems: "center", gap: 6,
                  height: 25, padding: "0 8px", borderRadius: 7,
                  background: "linear-gradient(0deg, rgba(0, 0, 0, 0.17) 0%, rgba(102, 102, 102, 0.153) 100%), linear-gradient(0deg, rgba(219, 219, 219, 0.6), rgba(219, 219, 219, 0.6)), linear-gradient(92deg, #429FD6 3.61%, #7762E7 24.14%, #A45EE1 39.21%, #CB4FCB 56.02%, #FF3598 70.65%, #ED7180 85.72%, #E9886D 100%)",
                  border: "0.5px solid color(display-p3 1 1 1 / 0.5)",
                  color: "#fff",
                  cursor: meta.treatment?.trim() && !improving ? "pointer" : "not-allowed",
                  outline: "none",
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
                  letterSpacing: "-0.01em",
                  opacity: meta.treatment?.trim() && !improving ? 1 : 0.5,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.24)",
                  transition: "filter 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease",
                }}
                onMouseEnter={e => {
                  if (e.currentTarget.disabled) return;
                  e.currentTarget.style.filter = "brightness(1.05)";
                  e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.65), 0 2px 8px rgba(188,87,197,0.22)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.filter = "none";
                  e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.24)";
                }}
              >
                {improving && <ShimmerSweep color="rgba(255,255,255,0.38)" />}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <DropdownAssetIcon src={iconSparkleUrl} size={11} />
                  {improving ? "Improving…" : "Improve with AI"}
                </span>
              </button>
          </div>

          {/* File upload zone */}
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
              onDragLeave={() => setFileDragOver(false)}
              onDrop={e => { e.preventDefault(); setFileDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current.click()}
              style={{
                border: `1.5px dashed ${fileDragOver ? "rgba(255,255,255,0.3)" : "var(--warm-10)"}`,
                borderRadius: 10, padding: "26px 16px 24px", textAlign: "center",
                cursor: "pointer", transition: "all 0.2s ease",
                background: fileDragOver ? "rgba(255,255,255,0.02)" : "#1b1b1b",
              }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                fontFamily: "var(--f)", fontSize: 15, fontWeight: 500, color: "var(--warm)",
                marginBottom: 10, letterSpacing: "-0.01em",
              }}>
                <DropdownAssetIcon src={iconDropfilesUrl} size={18} />
                <span>Add Reference Files</span>
              </div>
              <div style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 300, color: "var(--warm-25)" }}>
                Drop treatments, scripts, images, or mood boards here or click to browse
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

      <Reveal delay={680}>
        <div style={{ marginTop: 28 }}>
          <GenerateStoryboardButton
            generating={generating}
            onClick={() => !generating && onGenerate(meta)}
          />
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
        </div>
      </Reveal>
    </div>
    </div>
  );
}

// -- MAIN APP -------------------------------------------------

export default function WorkshopV2() {
  // First mount: check for a #share=<base64> URL hash first (read-only
  // shared brief), then resolve the active project id. If a project's already active,
  // restore its data and jump straight to the OneSheet workspace. If
  // the active ID points at a project whose data blob is missing
  // (corruption, manual localStorage edit, mid-save crash) we clear
  // the stale pointer so we don't end up stuck — active in sidebar
  // but never able to load the workspace.
  const bootstrap = useRef(null);
  if (!bootstrap.current) {
    const shared = parseShareHash();
    if (shared) {
      bootstrap.current = { activeId: null, data: shared, shared: true };
    } else {
      let activeId = getActiveProjectId();
      // Sync read of localStorage fallback for instant paint. If
      // empty, the post-mount async effect (further below) hydrates
      // from IndexedDB. DON'T clear the active pointer here — the
      // data might be IDB-only after the persistence refactor.
      let initialData = activeId ? clearStaleGenerationState(loadProject(activeId)) : null;
      bootstrap.current = { activeId, data: initialData, shared: false };
    }
  }
  const isSharedView = bootstrap.current.shared;
  const [activeProjectId, setActiveProjectIdState] = useState(bootstrap.current.activeId);
  const [projects, setProjects] = useState(() => listProjects());
  const [folders, setFolders] = useState(() => listFolders());
  const [{ past, present, future }, dispatch] = useReducer(storyboardReducer, {
    past: [], present: bootstrap.current.data || INITIAL_STATE, future: [],
  });
  const data = present;

  const [ready, setReady] = useState(false);
  // If we restored a project, skip the BriefForm landing and go straight
  // to the OneSheet — the user already has a project to work in.
  const [built, setBuilt] = useState(() => !!bootstrap.current.data);
  // Brief-generation lifecycle for the BriefForm landing page. Lets us
  // disable the Generate button + show progress while Gemini works.
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  // Auto-save status surfaced at the top of the OneSheet so the user
  // can trust it's safe to close the tab. States: "idle" → "saving"
  // → "saved-just-now" → ticks to "saved 2 min ago" etc.
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [productionFrameId, setProductionFrameId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [highlightedFrames, setHighlightedFrames] = useState(new Set());
  const [chatAssetContext, setChatAssetContext] = useState(null);
  // Default to Project Settings so project-level settings live away from
  // the storyboard asset grids.
  const [assetTabOpen, setAssetTabOpen] = useState("settings");
  const [chatFocusTrigger, setChatFocusTrigger] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [homeBackground, setHomeBackground] = useState(() => {
    if (typeof window === "undefined") return HOME_BACKGROUND_OPTIONS.shader;
    return normalizeHomeBackground(window.localStorage.getItem(HOME_BACKGROUND_STORAGE_KEY));
  });
  const isDark = theme === "dark";

  useEffect(() => { setTimeout(() => setReady(true), 80); }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme, isDark]);

  // Hydrate the active project's full data from IndexedDB on mount.
  // localStorage's bootstrap gave us a lightweight (data-URL-stripped)
  // copy so the OneSheet renders immediately; this fills in the
  // actual image data after first paint.
  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    loadProjectAsync(activeProjectId).then(full => {
      if (cancelled || !full) return;
      // Only swap in if IDB has richer data — avoid clobbering any
      // edits the user already made on the lightweight version.
      // Heuristic: if any image-bearing field in IDB has a value the
      // current state doesn't, replace.
      const dataNow = dataRef.current;
      const idbCount = countImageUrls(full);
      const memCount = countImageUrls(dataNow);
      if (idbCount > memCount) {
        dispatch({ type: "SET_DATA", data: full });
        // If we were stuck on the BriefForm because bootstrap's sync
        // localStorage read came back empty (data lives in IDB only),
        // flip into the workspace now that the IDB data is loaded.
        if (!builtRef.current) {
          setBuilt(true);
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save the active project on every data change.
  //
  // Earlier version used a 500ms debounce — that broke during the
  // initial auto-generation pipeline, which dispatches ~50 actions
  // over 60 seconds. Each dispatch reset the debounce timer, so the
  // save NEVER actually fired before the user could reload. Result:
  // entire briefs disappeared.
  //
  // Fix: short 150ms debounce (still avoids hammering localStorage on
  // every keystroke) + a hard ceiling that forces a save every 2s if
  // changes keep coming + beforeunload flushes any pending save when
  // the user closes/reloads the page.
  const dataRef = useRef(data);
  dataRef.current = data;
  const activeRef = useRef(activeProjectId);
  activeRef.current = activeProjectId;
  const builtRef = useRef(built);
  builtRef.current = built;
  const pendingSaveRef = useRef({ debounce: null, ceiling: null });

  useEffect(() => {
    if (!built || !activeProjectId) return;
    setSaveStatus("saving");
    // Short debounce — let a couple rapid dispatches batch, but never
    // hold the save off for more than a fraction of a second.
    if (pendingSaveRef.current.debounce) clearTimeout(pendingSaveRef.current.debounce);
    pendingSaveRef.current.debounce = setTimeout(() => {
      const saveId = activeProjectId;
      const saveSnapshot = data;
      const saveData = clearStaleGenerationState(saveSnapshot);
      saveProjectAsync(saveId, saveData).then(ok => {
        if (activeRef.current !== saveId || dataRef.current !== saveSnapshot) return;
        if (ok) {
          setSaveStatus("saved");
          setLastSavedAt(Date.now());
          setProjects(listProjects());
        } else {
          setSaveStatus("error");
        }
      });
      pendingSaveRef.current.debounce = null;
    }, 150);
    // Ceiling — if changes keep coming faster than the debounce can
    // settle, force a save every 2s anyway so the user is never more
    // than 2s of work away from a durable write.
    if (!pendingSaveRef.current.ceiling) {
      pendingSaveRef.current.ceiling = setTimeout(() => {
        if (activeRef.current && builtRef.current) {
          const saveId = activeRef.current;
          const saveSnapshot = dataRef.current;
          const saveData = clearStaleGenerationState(saveSnapshot);
          saveProjectAsync(saveId, saveData).then(ok => {
            if (activeRef.current !== saveId || dataRef.current !== saveSnapshot) return;
            if (ok) {
              setSaveStatus("saved");
              setLastSavedAt(Date.now());
              setProjects(listProjects());
            } else {
              setSaveStatus("error");
            }
          });
        }
        pendingSaveRef.current.ceiling = null;
      }, 2000);
    }
    return () => {
      // Note: we don't clear ceiling on every render — it's intentional
      // that it fires every 2s during bursts. Only the debounce is
      // cleared on each render so the latest data wins.
    };
  }, [data, built, activeProjectId]);

  // Flush any pending save when the page unloads (refresh, close,
  // navigate away). Synchronous localStorage write — the only reliable
  // way to guarantee data is persisted before the JS context dies.
  useEffect(() => {
    function flushOnUnload() {
      if (activeRef.current && builtRef.current) {
        saveProjectSync(activeRef.current, clearStaleGenerationState(dataRef.current));
      }
    }
    window.addEventListener("beforeunload", flushOnUnload);
    window.addEventListener("pagehide", flushOnUnload);
    return () => {
      window.removeEventListener("beforeunload", flushOnUnload);
      window.removeEventListener("pagehide", flushOnUnload);
    };
  }, []);

  // Project switcher — load a different project into the workspace.
  // Saves the current one first so no work is lost. Async because
  // after the IndexedDB persistence refactor, full project data may
  // live ONLY in IDB (no localStorage fallback) for projects with
  // big image payloads. We try sync (LS) first for instant-paint;
  // if that returns null we await IDB before giving up.
  //
  // CRITICAL: never auto-delete on load failure — the previous
  // version did that and any project saved IDB-only would disappear
  // on first click. Just warn + open the BriefForm landing if we
  // really can't recover it.
  async function switchToProject(projectId) {
    if (!projectId) return;
    if (projectId === activeProjectId && built) return;
    if (activeProjectId && built && activeProjectId !== projectId) {
      saveProject(activeProjectId, clearStaleGenerationState(data));
    }
    let next = loadProject(projectId);
    if (!next) {
      // localStorage didn't have it — pull the full blob from IDB.
      try { next = await loadProjectAsync(projectId); } catch {}
    }
    if (!next) {
      console.warn("[v2] couldn't load project", projectId, "— no data in localStorage OR IndexedDB");
      toast("Couldn't open that project — data appears missing. The entry has been left in the sidebar so you can try again.", { kind: "error", ttl: 8000 });
      return;
    }
    setActiveProjectId(projectId);
    setActiveProjectIdState(projectId);
    dispatch({ type: "SET_DATA", data: next });
    setBuilt(true);
    setProjects(listProjects());
    setSaveStatus("idle");
  }

  // Start fresh — save current, clear active, show BriefForm.
  function startNewProject() {
    if (activeProjectId && built) {
      saveProject(activeProjectId, clearStaleGenerationState(data));
    }
    setActiveProjectId(null);
    setActiveProjectIdState(null);
    dispatch({ type: "SET_DATA", data: INITIAL_STATE });
    setBuilt(false);
    setProjects(listProjects());
  }

  function handleBackToProjects() {
    if (activeProjectId && built) {
      saveProject(activeProjectId, clearStaleGenerationState(data));
    }
    setBuilt(false);
    setProductionFrameId(null);
    setSelectedFrameId(null);
    setProjects(listProjects());
  }

  function handleDeleteProject(projectId) {
    // If we're deleting the active project, clear pending auto-saves
    // FIRST so a ceiling timeout doesn't fire seconds later and recreate
    // the project from in-memory state. Then clear active state. Then
    // delete the blob + refresh the sidebar.
    const wasActive = projectId === activeProjectId;
    if (wasActive) {
      if (pendingSaveRef.current.debounce) {
        clearTimeout(pendingSaveRef.current.debounce);
        pendingSaveRef.current.debounce = null;
      }
      if (pendingSaveRef.current.ceiling) {
        clearTimeout(pendingSaveRef.current.ceiling);
        pendingSaveRef.current.ceiling = null;
      }
      // Update refs immediately so beforeunload + any in-flight ceiling
      // callbacks see the cleared state, not waiting for the next render.
      activeRef.current = null;
      builtRef.current = false;
      setActiveProjectId(null);
      setActiveProjectIdState(null);
      dispatch({ type: "SET_DATA", data: INITIAL_STATE });
      setBuilt(false);
    }
    deleteProject(projectId);
    setProjects(listProjects());
  }
  function handleRenameProject(projectId, newName) {
    renameProject(projectId, newName);
    setProjects(listProjects());
  }
  function handleMoveToFolder(projectId, folder) {
    setProjectFolder(projectId, folder || null);
    setProjects(listProjects());
    setFolders(listFolders());
    toast(folder ? `Moved to "${folder}"` : "Removed from folder", { kind: "info", ttl: 2500 });
  }
  function handleNewFolder() {
    setNewFolderName("");
    setNewFolderOpen(true);
  }
  function handleCreateFolderSubmit(e) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const created = createFolder(name);
    if (created) {
      setFolders(listFolders());
      toast(`Created client folder "${created}"`, { kind: "success", ttl: 2500 });
    }
    setNewFolderOpen(false);
    setNewFolderName("");
  }
  async function handleDeleteFolder(name) {
    const ok = await uiConfirm({
      title: `Delete client folder "${name}"?`,
      message: "Projects inside will be moved out of the folder, but their data stays untouched.",
      confirmLabel: "Delete client folder",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    deleteFolder(name);
    setProjects(listProjects());
    setFolders(listFolders());
    toast(`Deleted folder "${name}"`, { kind: "info", ttl: 2500 });
  }
  function handleRenameFolder(oldName, newName) {
    const cleaned = (newName || "").trim();
    if (!cleaned || cleaned === oldName) return;
    if (folders.includes(cleaned)) {
      toast(`A folder named "${cleaned}" already exists`, { kind: "warning", ttl: 2500 });
      return;
    }
    if (!renameFolder(oldName, cleaned)) return;
    setProjects(listProjects());
    setFolders(listFolders());
    if (data.meta?.client === oldName) {
      dispatch({ type: "SET_META", meta: { client: cleaned } });
    }
    toast(`Renamed folder to "${cleaned}"`, { kind: "success", ttl: 2500 });
  }

  // Run a chat-driven side-effect. The chat tool handlers return
  // descriptors like { type: "generateTalentPrimary", talentName }
  // when the model asks for an image to be generated; this function
  // dispatches the actual gen + writeback. It uses dataRef.current so
  // newly-created assets (which were just dispatched a tick ago) are
  // visible.
  async function runChatEffect(effect) {
    const current = dataRef.current;
    if (!current || !effect) return;
    const findByName = (list, name) => {
      const lc = String(name || "").toLowerCase();
      return list.find(x => x.name?.toLowerCase().includes(lc)) || null;
    };
    const findByIdOrName = (list, id, name) =>
      (id ? list.find(x => x.id === id) : null) || findByName(list, name);

    switch (effect.type) {
      case "generateTalentPrimary": {
        const t = findByIdOrName(current.talent || [], effect.talentId, effect.talentName);
        if (!t) return;
        markPending(`talent.${t.id}.primary`);
        markPending(`talent.${t.id}.headshots.front`);
        dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "generating" });
        try {
          log("info", `chat: generating primary headshot for ${t.name}`);
          const url = await generateImage(talentPrompt(t), { ratio: "1:1" });
          dispatch({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: url });
          dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: "front", url });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "complete" });
          log("info", `chat: ${t.name} done`);
        } catch (e) {
          log("error", `chat talent gen failed: ${t.name}`, { error: String(e?.message || e) });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "error" });
          toast(`Couldn't generate headshot for ${t.name}: ${e?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
        } finally {
          markDone(`talent.${t.id}.primary`);
          markDone(`talent.${t.id}.headshots.front`);
        }
        return;
      }
      case "generateLocationImage": {
        const l = findByIdOrName(current.locations || [], effect.locationId, effect.locationName);
        if (!l) return;
        const aspect = current.meta?.aspect || "16:9";
        markPending(`location.${l.id}`);
        dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "generating" });
        try {
          log("info", `chat: generating location ${l.name}`);
          const url = await generateImage(locationPrompt(l), { ratio: aspect });
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
          log("info", `chat: ${l.name} done`);
        } catch (e) {
          log("error", `chat location gen failed: ${l.name}`, { error: String(e?.message || e) });
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "error" });
          toast(`Couldn't generate ${l.name}: ${e?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
        } finally {
          markDone(`location.${l.id}`);
        }
        return;
      }
      case "generateProductImage": {
        const p = findByIdOrName(current.products || [], effect.productId, effect.productName);
        if (!p) return;
        markPending(`product.${p.id}`);
        dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "generating" });
        try {
          log("info", `chat: generating product ${p.name}`);
          const url = await generateImage(productPrompt(p), { ratio: "1:1" });
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "complete", image: url });
          log("info", `chat: ${p.name} done`);
        } catch (e) {
          log("error", `chat product gen failed: ${p.name}`, { error: String(e?.message || e) });
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "error" });
          toast(`Couldn't generate ${p.name}: ${e?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
        } finally {
          markDone(`product.${p.id}`);
        }
        return;
      }
      case "generateAssetImage": {
        const list = effect.assetType === "talent" ? current.talent
          : effect.assetType === "location" ? current.locations
          : effect.assetType === "product" ? current.products
          : [];
        const asset = findByIdOrName(list, effect.assetId, effect.assetName);
        if (!asset) return;
        if (effect.assetType === "talent") {
          await runChatEffect({ type: "generateTalentPrimary", talentName: asset.name });
        } else if (effect.assetType === "location") {
          await runChatEffect({ type: "generateLocationImage", locationName: asset.name });
        } else if (effect.assetType === "product") {
          await runChatEffect({ type: "generateProductImage", productName: asset.name });
        }
        return;
      }
      case "generateFrameImage": {
        await regenerateOneFrame(effect.frameId);
        return;
      }
      default:
        console.warn("[runChatEffect] unknown effect type", effect.type);
    }
  }

  // Regenerate a single frame's image inline. Used by the SheetFrame
  // error state — when bulk auto-gen drops a frame on a rate limit,
  // the frame card shows "Failed — Retry" and clicking it calls this.
  // Collects reference images the same way Phase B does so the retry
  // benefits from already-generated talent/location/product refs.
  async function regenerateOneFrame(frameId) {
    const current = dataRef.current;
    if (!current) return;
    const frame = (current.frames || []).find(f => f.id === frameId);
    if (!frame) return;
    const aspect = current.meta?.aspect || "16:9";
    const briefLower = (frame.brief || "").toLowerCase();
    const handles = {
      talent: (current.talent || []).map(t => ({ id: t.id, handle: (t.handle || "").toLowerCase(), img: t.headshot })),
      products: (current.products || []).map(p => ({ id: p.id, handle: (p.handle || "").toLowerCase(), img: p.referenceImage })),
    };
    const talentIds = handles.talent.filter(h => h.handle && briefLower.includes(h.handle)).map(h => h.id);
    const productIds = handles.products.filter(h => h.handle && briefLower.includes(h.handle)).map(h => h.id);
    const locationId = frame.locationId || (current.locations?.[0]?.id ?? null);
    const refs = [];
    for (const tid of talentIds) {
      const t = current.talent.find(x => x.id === tid);
      const u = t?.headshot || t?.headshots?.front;
      if (u) refs.push(u);
    }
    if (locationId) {
      const l = current.locations.find(x => x.id === locationId);
      const u = l?.generatedImage || l?.referenceImage;
      if (u) refs.push(u);
    }
    for (const pid of productIds) {
      const p = current.products.find(x => x.id === pid);
      const u = p?.referenceImage;
      if (u) refs.push(u);
    }
    markPending(`frame.${frameId}`);
    dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId, status: "generating" });
    try {
      log("info", `retrying frame ${frame.number}`);
      const url = await generateImage(framePrompt(frame), { ratio: aspect, referenceImages: refs });
      dispatch({ type: "UPLOAD_FRAME_IMAGE", frameId, dataUrl: url });
      log("info", `frame ${frame.number} retry done`);
    } catch (err) {
      log("error", `frame ${frame.number} retry failed`, { error: String(err?.message || err) });
      dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId, status: "error" });
      toast(`Frame ${frame.number} retry failed: ${err?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
    } finally {
      markDone(`frame.${frameId}`);
    }
  }

  // Apply a brief-audit plan from RegenerateAuditModal. `scope` is
  // "list" (only the items the audit flagged) or "all" (rerun the
  // full brief generation from scratch). Locked items always skipped.
  async function handleRunRegeneration(scope, plan) {
    const current = dataRef.current;
    if (!current) return;
    if (scope === "all") {
      toast("Regenerating the full project from the new brief…", { kind: "info", ttl: 4000 });
      await handleGenerate({
        title: current.meta?.title || "",
        client: current.meta?.client || "",
        format: current.meta?.format || "30",
        aspect: current.meta?.aspect || "16:9",
        treatment: current.meta?.treatment || "",
      });
      return;
    }
    if (scope !== "list" || !plan) return;
    toast("Applying targeted changes…", { kind: "info", ttl: 3000 });
    // Updates: re-run the per-asset generators on existing items.
    for (const id of plan.talent?.update || []) {
      const t = (current.talent || []).find(x => x.id === id);
      if (t && !t.locked) runChatEffect({ type: "generateTalentPrimary", talentName: t.name }).catch(e => console.error("[regen talent]", e));
    }
    for (const id of plan.locations?.update || []) {
      const l = (current.locations || []).find(x => x.id === id);
      if (l && !l.locked) runChatEffect({ type: "generateLocationImage", locationName: l.name }).catch(e => console.error("[regen location]", e));
    }
    for (const id of plan.products?.update || []) {
      const p = (current.products || []).find(x => x.id === id);
      if (p && !p.locked) runChatEffect({ type: "generateProductImage", productName: p.name }).catch(e => console.error("[regen product]", e));
    }
    // Adds: create the asset shells. User can trigger image gen via
    // the existing tile UI; auto-gen on bulk add can overwhelm Gemini.
    for (const desc of plan.talent?.add || []) {
      dispatch({ type: "ADD_TALENT", data: { name: String(desc).slice(0, 60), note: String(desc) } });
    }
    for (const desc of plan.locations?.add || []) {
      dispatch({ type: "ADD_LOCATION", data: { name: String(desc).slice(0, 60), note: String(desc) } });
    }
    for (const desc of plan.products?.add || []) {
      dispatch({ type: "ADD_PRODUCT", data: { name: String(desc).slice(0, 60), note: String(desc) } });
    }
    // Frames: regenerate each frame's image inline if the audit asked.
    if (plan.frames === "regenerate") {
      for (const f of (current.frames || [])) {
        regenerateOneFrame(f.id).catch(e => console.error("[regen frame]", e));
      }
    }
  }

  // Change project aspect ratio. The new ratio is saved immediately
  // (so future generations use it), then we prompt whether to also
  // regenerate every existing image at the new ratio. Cancel = keep
  // current images cropped/letterboxed into the new shape. Confirm =
  // re-fire generation across every section.
  async function handleAspectChange(newRatio) {
    if (!newRatio || newRatio === data.meta?.aspect) return;
    dispatch({ type: "UPDATE_META", field: "aspect", value: newRatio });
    const wantsRegen = await uiConfirm({
      title: `Change aspect ratio to ${newRatio}?`,
      message: "Existing images keep their original ratio and will look cropped/letterboxed. Regenerate updates everything to the new ratio (talent / locations / products / frames). Mood and brand stay 1:1.",
      confirmLabel: "Regenerate all",
      cancelLabel: "Keep current images",
      danger: false,
    });
    if (!wantsRegen) return;
    toast(`Regenerating images at ${newRatio}…`, { kind: "info", ttl: 4000 });
    // Re-fire generation for every non-locked image in every section.
    // Sequenced through Promise.allSettled so a single failure doesn't
    // tank the whole sweep.
    const tasks = [];
    for (const t of (data.talent || [])) {
      if (t.locked || data.locks?.talent) continue;
      tasks.push((async () => {
        try {
          const url = await generateImage(talentPrompt(t), { ratio: "1:1" });
          dispatch({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: url });
          dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: "front", url });
        } catch (e) { console.error("[aspect-regen talent]", e); }
      })());
    }
    for (const l of (data.locations || [])) {
      if (l.locked || data.locks?.locations) continue;
      tasks.push((async () => {
        try {
          const url = await generateImage(locationPrompt(l), { ratio: newRatio });
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
        } catch (e) { console.error("[aspect-regen location]", e); }
      })());
    }
    for (const p of (data.products || [])) {
      if (p.locked || data.locks?.products) continue;
      tasks.push((async () => {
        try {
          const url = await generateImage(productPrompt(p), { ratio: "1:1" });
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "complete", image: url });
        } catch (e) { console.error("[aspect-regen product]", e); }
      })());
    }
    for (const f of (data.frames || [])) {
      tasks.push((async () => {
        try {
          const url = await generateImage(framePrompt(f), { ratio: newRatio });
          dispatch({ type: "UPLOAD_FRAME_IMAGE", frameId: f.id, dataUrl: url });
        } catch (e) { console.error("[aspect-regen frame]", e); }
      })());
    }
    await Promise.allSettled(tasks);
    toast("Aspect-ratio regeneration complete", { kind: "success" });
  }

  // Change target runtime. Saves new value immediately, then asks
  // whether to re-pace the storyboard so per-shot durations sum to the
  // new total. Uses v1's regenerateShotList helper which calls Gemini
  // with the existing brief + new duration constraint.
  async function handleDurationChange(newFormat) {
    if (!newFormat || newFormat === data.meta?.format) return;
    dispatch({ type: "UPDATE_META", field: "format", value: newFormat });
    const wantsRepace = await uiConfirm({
      title: `Change target runtime to :${newFormat}?`,
      message: "Re-pacing rewrites each shot's brief + duration so the storyboard sums to the new total. Existing storyboard images stay attached to their frame positions; regenerate them from the Storyboard if you want them remade for the new shots.",
      confirmLabel: "Re-pace storyboard",
      cancelLabel: "Keep current shots",
      danger: false,
    });
    if (!wantsRepace) return;
    toast(`Re-pacing storyboard for :${newFormat}…`, { kind: "info", ttl: 4000 });
    try {
      // Build a minimal v1-shape brief for the helper.
      const v1Brief = {
        creativeDirection: {
          brand: data.brand?.name || data.meta?.client || "",
          description: data.meta?.treatment || "",
          duration: `${newFormat}s`,
          format: data.meta?.aspect || "16:9",
        },
        character: data.talent?.[0] ? { name: data.talent[0].name, description: data.talent[0].note || "", wardrobe: "" } : {},
        characters: (data.talent || []).slice(1).map(t => ({ name: t.name, description: t.note || "", wardrobe: "" })),
        environment: data.locations?.[0] ? { heroName: data.locations[0].name, heroEnvironment: data.locations[0].note || "" } : {},
        environments: (data.locations || []).slice(1).map(l => ({ heroName: l.name, heroEnvironment: l.note || "" })),
        productElements: (data.products || []).map(p => ({ name: p.name, description: p.note || "" })),
        shotList: (data.frames || []).map(f => ({
          num: f.number,
          framing: f.shotType,
          description: f.brief,
          camera: f.camera,
          duration: f.duration,
        })),
      };
      const newShots = await regenerateShotList(v1Brief, `${newFormat}s`);
      // Apply each new shot back into v2's frame shape. Preserve the
      // existing frame id by index so attached images don't orphan.
      for (let i = 0; i < newShots.length; i++) {
        const existing = data.frames?.[i];
        if (!existing) continue;
        const s = newShots[i];
        dispatch({ type: "UPDATE_FRAME", frameId: existing.id, field: "brief", value: s.description || existing.brief });
        if (s.duration) {
          const m = String(s.duration).match(/[\d.]+/);
          if (m) dispatch({ type: "UPDATE_FRAME", frameId: existing.id, field: "duration", value: `${m[0]}s` });
        }
        if (s.framing) {
          const mapped = { EWS: "WIDE", WS: "WIDE", MS: "MED", CU: "CU", ECU: "ECU", OTS: "OTS", POV: "POV" }[s.framing] || existing.shotType;
          dispatch({ type: "UPDATE_FRAME", frameId: existing.id, field: "shotType", value: mapped });
        }
      }
      // Re-fire mention detection so any new @-handles in the brief
      // text get attached to the right talent/products.
      dispatch({ type: "AUTO_DETECT_MENTIONS" });
      toast("Storyboard re-paced", { kind: "success" });
    } catch (e) {
      console.error("[duration repace]", e);
      toast(`Re-pacing failed: ${e?.message?.slice(0, 140) || "unknown"}`, { kind: "error" });
    }
  }

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
      // Cmd+Shift+N — start a fresh project. Non-destructive now —
      // the current project stays saved in the sidebar, we just return
      // to the BriefForm landing for a new one.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        startNewProject();
      }
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
    setChatAssetContext(null);
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
      // Preserve the user's original brief text. v1BriefToV2Data pulls
      // meta.treatment from the LLM's creativeDirection.description,
      // which is often empty or a rewrite — Logan wants his original
      // typed brief to live in the editable Brief panel. Falls back to
      // the LLM description if the user didn't write one.
      if (meta.treatment?.trim()) {
        v2Data.meta.treatment = meta.treatment.trim();
      }
      // imagePrompts comes back as 4 cinematic visual descriptions —
      // perfect mood-board fodder. Capture before the v2Data discards them.
      const imagePrompts = Array.isArray(v1Brief?.imagePrompts) ? v1Brief.imagePrompts.slice(0, 4) : [];

      // Brand enrichment — generateBrief calls /api/brand internally,
      // but the results sometimes don't make it through the merge
      // (parsed brief has empty brandInfo, or the brand key wasn't
      // recognized on first pass). Explicitly call /api/brand again
      // here with the cleanest brand key we can derive, so logo +
      // guidelines + URL are populated as reliably as v1 had them.
      //
      // Robust extraction: if the input looks like a URL or domain
      // (pepsi.com, https://pepsi.com), pull just the hostname's
      // first label ("pepsi"). Otherwise strip non-alphanumerics.
      // Previous version turned "pepsi.com" into "pepsicom" which
      // didn't match any known-brand entry.
      let brandKey = (v2Data.brand?.name || meta.client || "").toLowerCase().trim();
      try {
        const probe = /^https?:\/\//i.test(brandKey) ? brandKey : `https://${brandKey}`;
        const u = new URL(probe);
        const host = u.hostname.replace(/^www\./, "");
        if (host.includes(".")) brandKey = host.split(".")[0];
      } catch {}
      brandKey = brandKey.replace(/[^a-z0-9]/g, "");
      if (brandKey) {
        try {
          const r = await fetch("/api/brand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brand: brandKey }),
          });
          if (r.ok) {
            const payload = await r.json();
            if (!payload?.error) {
              if (payload.logoUrl && !v2Data.brand.logo) v2Data.brand.logo = payload.logoUrl;
              if (payload.sourceUrl && !v2Data.brand.url) v2Data.brand.url = payload.sourceUrl;
              if (payload.rules && !v2Data.brand.guidelines) v2Data.brand.guidelines = payload.rules;
              if (payload.brand && (!v2Data.brand.name || v2Data.brand.name.includes("."))) {
                v2Data.brand.name = payload.brand;
              }
            }
          }
        } catch (e) {
          console.warn("[brand enrich] failed", e);
        }
      }

      // Each new brief gets its own project record — that way the
      // sidebar list shows every brief the user has ever generated,
      // and switching between them is just a project-switch.
      const newId = newProjectId();
      setActiveProjectId(newId);
      setActiveProjectIdState(newId);
      // Auto-file only when the user selected an existing folder. If
      // they choose "No Folder", the new project stays at the sidebar
      // root with the other unfiled projects.
      if (meta.client?.trim() && listFolders().includes(meta.client.trim())) {
        const clientName = meta.client.trim();
        // saveProject merges this when it next runs; force a save now
        // so the sidebar updates immediately.
        setProjectFolder(newId, clientName);
        setFolders(listFolders());
      }

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
      autoGenerateAssets(v2Data, meta.aspect, { imagePrompts });
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
  async function autoGenerateAssets(initialData, aspect, opts = {}) {
    const generated = {
      talent: new Map(),
      locations: new Map(),
      products: new Map(),
    };
    const HEAD_VIEWS_EXTRA = ["side", "threeQuarter", "back"]; // "front" filled by primary
    const FULLBODY_VIEWS = ["front", "side", "threeQuarter", "back"];

    // Shared worker-pool + retry. Gemini rate-limits the account when
    // we fire >3 image gens in parallel, so EVERY phase has to be
    // throttled — not just Phase B (frames). Previously Phase A2 fanned
    // out 14+ requests at once (4 fullbody × N talent + 3 extra
    // headshots × N talent + locations + products + mood) and half
    // were dropping silently.
    const IMG_CONCURRENCY = 3;
    async function withRetry(task) {
      try {
        return await task();
      } catch (err) {
        if (err?.status === 429 || (err?.status >= 500 && err?.status < 600) || !err?.status) {
          await new Promise(r => setTimeout(r, 1500));
          return await task();
        }
        throw err;
      }
    }
    async function runPool(tasks, concurrency = IMG_CONCURRENCY) {
      const queue = [...tasks];
      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next) await next();
        }
      });
      await Promise.allSettled(workers);
    }

    // Phase A1 — primary talent headshots ONLY. We need these done
    // before A2 can fire view-specific gens with the primary as a
    // reference image (identity preservation across all 8 views).
    // Mark every primary as pending BEFORE the pool starts so all
    // queued tiles shimmer even while they wait their turn.
    log("info", `Phase A1: primary headshots × ${initialData.talent?.length || 0}`);
    for (const t of initialData.talent || []) {
      markPending(`talent.${t.id}.primary`);
      markPending(`talent.${t.id}.headshots.front`);
      // Pre-mark every other view + full-body slot too — they ARE
      // going to be queued in Phase A2, so the empty cells should
      // shimmer immediately rather than only when the worker thread
      // reaches them.
      for (const v of HEAD_VIEWS_EXTRA) markPending(`talent.${t.id}.headshots.${v}`);
      for (const v of FULLBODY_VIEWS) markPending(`talent.${t.id}.fullBody.${v}`);
    }
    for (const l of initialData.locations || []) markPending(`location.${l.id}`);
    for (const p of initialData.products || []) markPending(`product.${p.id}`);
    for (const f of initialData.frames || []) markPending(`frame.${f.id}`);
    const phaseA1 = [];
    for (const t of initialData.talent || []) {
      phaseA1.push((async () => {
        dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "generating" });
        try {
          const url = await generateImage(talentPrompt(t), { ratio: "1:1" });
          generated.talent.set(t.id, url);
          dispatch({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: url });
          // The primary also fills the FRONT headshot slot in the
          // detail-view 4-up grid — both fields point at the same image.
          dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: "front", url });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "complete" });
          log("info", `talent primary done: ${t.name}`);
        } catch (err) {
          log("error", `talent primary failed: ${t.name}`, { error: String(err?.message || err) });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "error" });
        } finally {
          markDone(`talent.${t.id}.primary`);
          // The front-slot key shares its pending lifecycle with the primary.
          markDone(`talent.${t.id}.headshots.front`);
        }
      })());
    }
    await Promise.allSettled(phaseA1);

    // Phase A2 — everything that can run after the primary headshots
    // exist (so they can be used as reference images for identity
    // preservation). Pushed as closures and run through the shared
    // worker pool so we don't overrun Gemini's per-minute rate limit.
    const phaseA2Tasks = [];

    for (const t of initialData.talent || []) {
      const primaryRef = generated.talent.get(t.id);
      if (!primaryRef) continue; // primary failed — skip the rest
      for (const view of HEAD_VIEWS_EXTRA) {
        phaseA2Tasks.push(async () => {
          try {
            const url = await withRetry(() => generateImage(talentHeadshotPrompt(t, view), {
              ratio: "1:1",
              referenceImages: [primaryRef],
            }));
            dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: view, url });
            log("info", `headshot done: ${t.name} / ${view}`);
          } catch (err) {
            log("error", `headshot failed: ${t.name} / ${view}`, { error: String(err?.message || err) });
          } finally {
            markDone(`talent.${t.id}.headshots.${view}`);
          }
        });
      }
      for (const view of FULLBODY_VIEWS) {
        phaseA2Tasks.push(async () => {
          try {
            const url = await withRetry(() => generateImage(talentFullBodyPrompt(t, view), {
              ratio: "3:4",
              referenceImages: [primaryRef],
            }));
            dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: t.id, slot: view, url });
            log("info", `fullbody done: ${t.name} / ${view}`);
          } catch (err) {
            log("error", `fullbody failed: ${t.name} / ${view}`, { error: String(err?.message || err) });
          } finally {
            markDone(`talent.${t.id}.fullBody.${view}`);
          }
        });
      }
    }
    // If a talent's primary failed, their A2 slots will never run —
    // clear the pending marks now so the placeholder text shows.
    for (const t of initialData.talent || []) {
      if (!generated.talent.get(t.id)) {
        for (const v of HEAD_VIEWS_EXTRA) markDone(`talent.${t.id}.headshots.${v}`);
        for (const v of FULLBODY_VIEWS) markDone(`talent.${t.id}.fullBody.${v}`);
      }
    }

    for (const l of initialData.locations || []) {
      phaseA2Tasks.push(async () => {
        dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "generating" });
        try {
          const url = await withRetry(() => generateImage(locationPrompt(l), { ratio: aspect }));
          generated.locations.set(l.id, url);
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
          log("info", `location done: ${l.name}`);
        } catch (err) {
          log("error", `location failed: ${l.name}`, { error: String(err?.message || err) });
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "error" });
        } finally {
          markDone(`location.${l.id}`);
        }
      });
    }
    for (const p of initialData.products || []) {
      phaseA2Tasks.push(async () => {
        dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "generating" });
        try {
          const url = await withRetry(() => generateImage(productPrompt(p), { ratio: "1:1" }));
          generated.products.set(p.id, url);
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "complete", image: url });
          log("info", `product done: ${p.name}`);
        } catch (err) {
          log("error", `product failed: ${p.name}`, { error: String(err?.message || err) });
          dispatch({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "error" });
        } finally {
          markDone(`product.${p.id}`);
        }
      });
    }
    // Mood board — use the brief's imagePrompts (Gemini returns 4
    // cinematic visual descriptions). Each becomes a mood tile with
    // the description as caption + generated image.
    for (const prompt of (opts.imagePrompts || [])) {
      phaseA2Tasks.push(async () => {
        try {
          const url = await withRetry(() => generateImage(moodPrompt(prompt), { ratio: "1:1" }));
          dispatch({
            type: "ADD_MOOD",
            data: { caption: String(prompt).slice(0, 80), image: url },
          });
          log("info", `mood tile done: "${String(prompt).slice(0, 40)}…"`);
        } catch (err) {
          log("error", `mood tile failed`, { error: String(err?.message || err) });
        }
      });
    }

    log("info", `Phase A2: ${phaseA2Tasks.length} tasks queued`);
    await runPool(phaseA2Tasks);

    // Phase B — frames with reference images. Detect @-handle mentions
    // inline (matching the reducer's AUTO_DETECT_MENTIONS logic) so we
    // know which talent / products each frame references, then look up
    // the just-generated images to use as Gemini reference inputs.
    //
    // Throttled: Gemini rate-limits an account that fires 9 image
    // requests in parallel. We run with concurrency=3 + a single retry
    // on 429 with a short delay, which empirically keeps every frame
    // successful instead of seeing 7+ silent 429 failures.
    const handles = {
      talent: initialData.talent.map(t => ({ id: t.id, handle: t.handle.toLowerCase() })),
      products: initialData.products.map(p => ({ id: p.id, handle: p.handle.toLowerCase() })),
    };
    let frameSuccess = 0;
    let frameFail = 0;
    const frameTasks = (initialData.frames || []).map(f => async () => {
      dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId: f.id, status: "generating" });
      const briefLower = (f.brief || "").toLowerCase();
      const talentIds = handles.talent.filter(h => briefLower.includes(h.handle)).map(h => h.id);
      const productIds = handles.products.filter(h => briefLower.includes(h.handle)).map(h => h.id);
      const locationId = f.locationId || (initialData.locations[0]?.id ?? null);
      const refs = [];
      for (const tid of talentIds) { const u = generated.talent.get(tid); if (u) refs.push(u); }
      if (locationId) { const u = generated.locations.get(locationId); if (u) refs.push(u); }
      for (const pid of productIds) { const u = generated.products.get(pid); if (u) refs.push(u); }
      try {
        const url = await withRetry(() => generateImage(framePrompt(f), { ratio: aspect, referenceImages: refs }));
        dispatch({ type: "UPLOAD_FRAME_IMAGE", frameId: f.id, dataUrl: url });
        frameSuccess++;
        log("info", `frame done: ${f.number}`);
      } catch (err) {
        log("error", `frame failed: ${f.number}`, { error: String(err?.message || err) });
        dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId: f.id, status: "error" });
        frameFail++;
      } finally {
        markDone(`frame.${f.id}`);
      }
    });
    log("info", `Phase B: ${frameTasks.length} frames queued`);
    await runPool(frameTasks);
    log("info", `Done. ${frameSuccess} succeeded, ${frameFail} failed.`);
    if (frameFail === 0) {
      toast("All images generated. Refine anything that needs a tweak.", { kind: "success", ttl: 4500 });
    } else {
      toast(`Generated ${frameSuccess} of ${frameSuccess + frameFail} frames. Click any unfilled frame to regenerate.`, { kind: "error", ttl: 8000 });
    }
  }

  // Real v2 chat via Gemini + tool calls. The v2-specific context,
  // tool schemas, validation, and reducer application live in aiChat.js.
  const handleSendMessage = useCallback(async (text, frameId, frameNumber, assetContext) => {
    setChatMessages(prev => [...prev, { id: Date.now(), role: "user", text, frameId, frameNumber }]);
    setChatBusy(true);
    const currentData = data;
    const chatContext = buildV2ChatContext(currentData, frameId, assetContext, text);

    const history = [
      { role: "system", content: chatContext.systemPrompt },
      ...chatMessages.filter(m => m.role === "user" || m.role === "ai").map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: text },
    ];

    try {
      const { text: replyText, actions } = await chatWithTools(history, V2_CHAT_TOOLS);
      const result = applyV2ChatActions(actions, { data: currentData, dispatch });
      if (result.highlights.size > 0) setHighlightedFrames(result.highlights);
      const summary = summarizeV2ChatResult(replyText, result);

      setChatMessages(prev => [...prev, {
        id: Date.now(),
        role: "ai",
        text: summary,
        changes: result.applied.map(a => ({ type: a.kind, id: a.frameId, field: a.field })),
      }]);

      // Fire async side-effects (image generation for newly created
      // assets, etc). Each effect resolves against the latest data
      // via dataRef, so it sees the asset the reducer just added.
      if (result.effects.length > 0) {
        // Give React a tick to flush the dispatches so dataRef updates.
        await new Promise(r => setTimeout(r, 50));
        for (const eff of result.effects) {
          runChatEffect(eff).catch(e => console.error("[chat effect]", eff.type, e));
        }
      }
    } catch (e) {
      console.error("[chat] failed", e);
      setChatMessages(prev => [...prev, {
        id: Date.now(),
        role: "ai",
        text: `Chat failed: ${e?.message?.slice(0, 200) || "unknown error"}. Try again in a moment.`,
        changes: [],
      }]);
    } finally {
      setChatBusy(false);
    }
  }, [data, chatMessages]);

  const handleDeleteFrame = useCallback((id) => {
    dispatch({ type: "DELETE_FRAME", frameId: id });
    if (selectedFrameId === id) setSelectedFrameId(null);
    if (productionFrameId === id) setProductionFrameId(null);
  }, [selectedFrameId, productionFrameId]);

  const handleMentionClick = useCallback((asset) => {
    // Toggle the appropriate asset tab
    const typeMap = { talent: "talent", product: "products", location: "locations" };
    const tabKey = typeMap[asset._type] || "talent";
    setProductionFrameId(null);
    setSelectedFrameId(null);
    setChatAssetContext(null);
    setAssetTabOpen(tabKey);
  }, []);

  const handleAssetAIAssist = useCallback((item, category) => {
    const type = { talent: "talent", products: "product", locations: "location" }[category];
    setChatAssetContext({ type, id: item.id });
    setSelectedFrameId(null);
    setProductionFrameId(null);
    setSidebarOpen(true);
  }, []);

  const handleFocusChat = useCallback(() => {
    setSidebarOpen(true);
    setChatFocusTrigger(prev => prev + 1);
  }, []);

  // Left-rail nav — clicking a tab selects it; clicking the ALREADY
  // active tab fires a "ww-asset-tab-reset" event so any drilled-in
  // detail view (CharacterDetailView, LocationDetailView, etc.) can
  // listen and pop back to its tile grid. Matches Logan's request
  // that clicking the tab name returns to the grid.
  const handleToggleAssetTab = useCallback((tabKey) => {
    setProductionFrameId(null);
    setSelectedFrameId(null);
    setChatAssetContext(null);
    setAssetTabOpen(prev => {
      if (prev === tabKey) {
        window.dispatchEvent(new CustomEvent("ww-asset-tab-reset", { detail: { tab: tabKey } }));
      }
      return tabKey;
    });
  }, []);

  // Production view frame navigation
  const prodFrame = productionFrameId ? data.frames.find(f => f.id === productionFrameId) : null;
  const prodIdx = prodFrame ? data.frames.indexOf(prodFrame) : -1;

  const updateHomeBackground = useCallback((nextBackground) => {
    const normalizedBackground = normalizeHomeBackground(nextBackground);
    setHomeBackground(normalizedBackground);
    window.localStorage.setItem(HOME_BACKGROUND_STORAGE_KEY, normalizedBackground);
  }, []);

  return (
    <UIProvider>
    <div className={isDark ? "dark" : undefined} style={{
      ...getThemeVars(isDark),
      background: "transparent",
      position: "relative",
      minHeight: "100vh", fontFamily: "var(--f)", color: "var(--warm)",
      opacity: ready ? 1 : 0, transition: "opacity 0.8s ease, background 0.4s ease, color 0.4s ease",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; margin: 0; }
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
        @keyframes workshopRevealDown {
          from {
            opacity: 0;
            filter: blur(5px);
            transform: translate3d(0, var(--ww-reveal-y, -14px), 0);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
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
        .ww-reveal {
          opacity: 0;
          will-change: opacity, transform, filter;
          animation-name: workshopRevealDown;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          animation-fill-mode: both;
        }
        @media (prefers-reduced-motion: reduce) {
          .ww-reveal {
            opacity: 1;
            filter: none;
            transform: none;
            animation: none;
          }
        }
        button { font-family: var(--f); }
        button:focus-visible { outline: 1.5px solid rgba(255,255,255,0.4); outline-offset: 2px; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--warm-20) !important; }
        select { appearance: none; cursor: pointer; }
        select option { background: var(--select-bg); color: var(--warm); }
        /* Print rules live in index.css scoped to the v1 OnePager
           (.onepager-page / .op-*). v2 now exports via that component
           — see briefFromV2Data.js + the ExportModal swap below. */
        .grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998; opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence baseFrequency='0.75' numOctaves='4' type='fractalNoise'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
          background-size: 128px;
        }
      `}</style>

      {!built && <HomeBackground mode={homeBackground} />}
      <div className="grain" />
      {exportOpen && (() => {
        // v2 export uses the proven v1 OnePager component instead of v2's
        // OneSheetExport. briefFromV2Data adapts the data + images shape so
        // OnePager resolves slot images via its existing stable-ID keys.
        const { brief, images } = briefFromV2Data(data);
        return <OnePager brief={brief} images={images} projectId={activeProjectId} onClose={() => setExportOpen(false)} />;
      })()}
      {newFolderOpen && (
        <div
          onClick={() => setNewFolderOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 11000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          <form
            onSubmit={handleCreateFolderSubmit}
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(100%, 420px)",
              padding: 24,
              borderRadius: 12,
              background: "#1A1A1D",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)",
              animation: "fadeIn 0.18s ease",
            }}
          >
            <div style={{
              fontFamily: "var(--f)",
              fontSize: 17,
              fontWeight: 600,
              color: "#fff",
              marginBottom: 8,
            }}>
              New client folder
            </div>
            <label style={{
              display: "block",
              fontFamily: "var(--f)",
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.62)",
              marginBottom: 8,
            }}>
              Client name
            </label>
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") setNewFolderOpen(false);
              }}
              style={{
                width: "100%",
                height: 42,
                padding: "0 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "#fff",
                fontFamily: "var(--f)",
                fontSize: 13,
                fontWeight: 500,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                style={{
                  fontFamily: "var(--f)",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "9px 18px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#fff",
                  outline: "none",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                style={{
                  fontFamily: "var(--f)",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "9px 18px",
                  borderRadius: 7,
                  cursor: newFolderName.trim() ? "pointer" : "not-allowed",
                  background: newFolderName.trim() ? "#fff" : "rgba(255,255,255,0.10)",
                  border: newFolderName.trim() ? "1px solid #fff" : "1px solid rgba(255,255,255,0.16)",
                  color: newFolderName.trim() ? "#111" : "rgba(255,255,255,0.42)",
                  outline: "none",
                }}
              >
                Create folder
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", height: "100vh", minHeight: 0, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Left: project sidebar (full-height multi-project nav) */}
        <ProjectSidebar
          homeBackdrop={!built}
          mode={built && activeProjectId ? "project" : "root"}
          projects={projects}
          folders={folders}
          activeProjectId={activeProjectId}
          activeProjectTitle={data.meta?.title || "Untitled"}
          activeAssetTab={assetTabOpen === "brand" ? "settings" : assetTabOpen}
          onAssetTabChange={handleToggleAssetTab}
          onBackToProjects={handleBackToProjects}
          assetCounts={{
            settings: data.brand?.logo ? 1 : 0,
            talent: data.talent.length,
            products: data.products.length,
            locations: data.locations.length,
            mood: (data.moodBoard || []).length,
          }}
          onSwitch={switchToProject}
          onNew={startNewProject}
          onHome={handleBackToProjects}
          onDelete={handleDeleteProject}
          onRename={handleRenameProject}
          onMoveToFolder={handleMoveToFolder}
          onNewFolder={handleNewFolder}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
        />

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Read-only banner — surfaces when the project was loaded from
          a #share=<base64> URL hash. Save-as-copy clones the data into
          a fresh local project, switches to it, and strips the hash. */}
      {isSharedView && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "8px 16px",
          background: "rgba(91,178,255,0.08)",
          borderBottom: "1px solid rgba(91,178,255,0.2)",
          fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
          color: "#7EB9FF",
        }}>
          <span>Viewing a shared brief — read only.</span>
          <button onClick={() => {
            const id = newProjectId();
            saveProject(id, data);
            setActiveProjectId(id);
            setActiveProjectIdState(id);
            setProjects(listProjects());
            window.history.replaceState({}, "", window.location.pathname + window.location.search);
            // Reset the shared flag in the bootstrap ref so future
            // re-renders treat this as a normal active project.
            bootstrap.current = { ...bootstrap.current, shared: false };
            toast("Saved as your own copy", { kind: "success" });
          }} style={{
            padding: "4px 12px", borderRadius: 6, cursor: "pointer",
            background: "rgba(91,178,255,0.18)", border: "1px solid rgba(91,178,255,0.35)",
            color: "#9DD3FF", outline: "none",
            fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
          }}>Save as my copy</button>
        </div>
      )}

      {/* Nav */}
      <nav style={{
        position: "relative", zIndex: 100, height: 64, flexShrink: 0,
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) max-content", columnGap: 16, alignItems: "center",
        padding: "0 24px",
        background: "transparent",
        backdropFilter: built ? "blur(24px) saturate(1.3)" : "none",
        WebkitBackdropFilter: built ? "blur(24px) saturate(1.3)" : "none",
        transition: "background 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {built && <>
            <AspectRatioControl
              value={data.meta.aspect}
              onChange={(newRatio) => handleAspectChange(newRatio)}
            />
            <TargetDurationControl
              value={data.meta.format}
              onChange={(f) => handleDurationChange(f)}
            />
            <span style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 300, color: "var(--warm-25)" }}>
              {data.meta.client}
              {data.meta.format ? ` · target :${data.meta.format}` : ""}
              {(() => {
                const total = totalDuration(data.frames);
                return total ? ` · ${total} total` : "";
              })()}
            </span>
            <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </>}
        </div>

        {built && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", justifySelf: "end" }}>
            <PremiumButton variant="ghost" onClick={() => dispatch({ type: "UNDO" })} disabled={past.length === 0} style={{ padding: "5px 8px", fontSize: 14 }} title="Undo (Ctrl+Z)">{"↩"}</PremiumButton>
            <PremiumButton variant="ghost" onClick={() => dispatch({ type: "REDO" })} disabled={future.length === 0} style={{ padding: "5px 8px", fontSize: 14 }} title="Redo (Ctrl+Shift+Z)">{"↪"}</PremiumButton>

            <div style={{ width: 1, height: 14, background: "var(--warm-08)", margin: "0 6px" }} />

            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <SectionIcon name="download" color="currentColor" /> Export
            </Button>

            <div style={{ width: 1, height: 14, background: "var(--warm-08)", margin: "0 6px" }} />

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <SunIcon aria-hidden="true" className="size-4" /> : <MoonIcon aria-hidden="true" className="size-4" />}
            </Button>
          </div>
        )}

        {/* Theme toggle when not built (landing page) */}
        {!built && (
          <div style={{ display: "flex", justifyContent: "flex-end", justifySelf: "end" }}>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <SunIcon aria-hidden="true" className="size-4" /> : <MoonIcon aria-hidden="true" className="size-4" />}
            </Button>
          </div>
        )}
      </nav>

      {/* Content area */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Main */}
        <main style={{ flex: 1, overflowY: "auto", minWidth: 0, background: "transparent" }}>
          {!built && (
            <BriefForm
              onGenerate={handleGenerate}
              generating={generating}
              error={generationError}
              folders={folders}
              homeBackground={homeBackground}
              onHomeBackgroundChange={updateHomeBackground}
            />
          )}
          {built && !productionFrameId && (
            <OneSheetWorkspace data={data} selectedFrameId={selectedFrameId}
              highlightedFrames={highlightedFrames} onSelectFrame={selectFrame}
              onUpdateMeta={(field, value) => dispatch({ type: "UPDATE_META", field, value })}
              dispatch={dispatch}
              assetTabOpen={assetTabOpen} onToggleAssetTab={handleToggleAssetTab}
              onAIAssist={handleAssetAIAssist}
              onRetryFrame={regenerateOneFrame}
              onRunRegeneration={handleRunRegeneration} />
          )}
          {built && productionFrameId && prodFrame && (
            <ProductionView frame={prodFrame} data={data} dispatch={dispatch}
              onBack={() => { setProductionFrameId(null); setSelectedFrameId(null); }}
              onPrev={() => { if (prodIdx > 0) { const nf = data.frames[prodIdx - 1]; setProductionFrameId(nf.id); setSelectedFrameId(nf.id); } }}
              onNext={() => { if (prodIdx < data.frames.length - 1) { const nf = data.frames[prodIdx + 1]; setProductionFrameId(nf.id); setSelectedFrameId(nf.id); } }}
              hasPrev={prodIdx > 0} hasNext={prodIdx < data.frames.length - 1}
              onDeleteFrame={handleDeleteFrame}
              onFocusChat={handleFocusChat}
              onRegenerateFrame={regenerateOneFrame}
            />
          )}
        </main>

        {/* Sidebar -- always AI Chat */}
        {built && (
          <div style={{
            width: sidebarOpen ? 380 : 0, flexShrink: 0, overflow: "hidden",
            borderLeft: sidebarOpen ? "1px solid var(--warm-06)" : "none",
            background: "transparent",
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
      </div>
    </div>
    </UIProvider>
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
