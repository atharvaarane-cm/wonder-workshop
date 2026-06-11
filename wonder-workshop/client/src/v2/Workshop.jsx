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

// Shared layout-transition config so containers grow/shrink smoothly when
// tiles or frames are added/removed (framer-motion `layout` + AnimatePresence).
const LAYOUT_TRANSITION = { type: "spring", stiffness: 360, damping: 34, mass: 0.8 };
// Enter/exit for individual tiles inside an AnimatePresence grid.
const TILE_ENTER = {
  layout: true,
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
  transition: LAYOUT_TRANSITION,
};
import { generateBrief, chatWithTools, regenerateShotList, suggestReconciliation, suggestOrphanCleanup } from "../hooks/useBrief.js";
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
import { ProjectSidebar, PROJECT_SECTION_TABS } from "./components/sidebar/ProjectSidebar.jsx";
import { EditBriefDialog } from "./components/BriefPanel.jsx";
import { AIChatPanel, AIChatTab } from "./components/AIChat.jsx";
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
import { DEMO_PROJECT_META, cloneDemoProjectData, isDemoProjectId } from "./demoProject.js";
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

// Edit an asset's @tag. If the OLD tag is referenced in the brief/frames, ask
// whether to rename it EVERYWHERE (propagate) or undo. Returns true if changed.
async function renameAssetTag({ type, id, rawHandle, data, dispatch }) {
  const list = type === "talent" ? data.talent : type === "products" ? data.products : data.locations;
  const asset = (list || []).find(a => a.id === id);
  if (!asset) return false;
  const oldHandle = (asset.handle || "").toLowerCase();
  let h = String(rawHandle || "").trim().replace(/^@+/, "");
  h = "@" + h.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (h === "@" || h === oldHandle) return false;
  const others = [...(data.talent || []), ...(data.products || []), ...(data.locations || [])].filter(a => a.id !== id);
  if (others.some(a => (a.handle || "").toLowerCase() === h)) {
    toast(`The tag ${h} is already used by another item — pick a different one.`, { kind: "error" });
    return false;
  }
  const updateType = type === "talent" ? "UPDATE_TALENT" : type === "products" ? "UPDATE_PRODUCT" : "UPDATE_LOCATION";
  const briefHas = oldHandle && (data.meta?.treatment || "").toLowerCase().includes(oldHandle);
  const usedFrames = (data.frames || []).filter(f => oldHandle && (f.brief || "").toLowerCase().includes(oldHandle));
  if (briefHas || usedFrames.length) {
    const where = [briefHas && "the brief", usedFrames.length && `${usedFrames.length} frame${usedFrames.length === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
    const ok = await uiConfirm({
      title: `Rename ${oldHandle} → ${h} everywhere?`,
      message: `${oldHandle} is used in ${where}. Renaming updates every reference to ${h}. Choose Undo to discard your edit and keep ${oldHandle}.`,
      confirmLabel: "Rename everywhere",
      cancelLabel: "Undo",
      danger: false,
    });
    if (!ok) return false;
    const re = new RegExp(oldHandle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (briefHas) dispatch({ type: "UPDATE_META", field: "treatment", value: (data.meta.treatment || "").replace(re, h) });
    for (const f of usedFrames) dispatch({ type: "UPDATE_FRAME", frameId: f.id, field: "brief", value: (f.brief || "").replace(re, h) });
    dispatch({ type: updateType, id, field: "handle", value: h });
    setTimeout(() => dispatch({ type: "AUTO_DETECT_MENTIONS" }), 0);
    toast(`Renamed ${oldHandle} → ${h} everywhere.`, { kind: "success" });
    return true;
  }
  dispatch({ type: updateType, id, field: "handle", value: h });
  toast(`Tag set to ${h}.`, { kind: "success" });
  return true;
}

// Inline editor for an asset's @tag. Commits on Enter/blur; reverts if the
// rename was declined (Undo) or invalid.
function TagEditor({ handle, onCommit }) {
  const [val, setVal] = useState(handle || "");
  useEffect(() => { setVal(handle || ""); }, [handle]);
  async function commit() {
    const v = val.trim();
    if (!v || v === (handle || "")) { setVal(handle || ""); return; }
    const applied = await onCommit(v);
    if (!applied) setVal(handle || "");
  }
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { setVal(handle || ""); e.currentTarget.blur(); } }}
      spellCheck={false}
      style={{
        fontFamily: "var(--f)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
        color: "var(--warm-50)", background: "var(--warm-04)", border: "1px solid var(--warm-10)",
        borderRadius: 6, padding: "4px 8px", outline: "none", width: 160,
      }}
    />
  );
}

// Make a handle unique across ALL assets (handles share the frame-text
// namespace). Without this, every freshly-added asset got the same "@new"
// (from the default "New …" name), so once one "@new" was woven into a frame,
// the others looked "already in the storyboard" and never flagged for reconcile.
function uniqueHandle(base, state, selfId) {
  const taken = new Set([...(state.talent || []), ...(state.products || []), ...(state.locations || [])]
    .filter(a => a.id !== selfId)
    .map(a => (a.handle || "").toLowerCase()).filter(Boolean));
  if (!base || !taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has((base + n).toLowerCase())) n++;
  return base + n;
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

export const FILM = [
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
    // Asset hero panel + popovers: a solid surface that flips with the
    // theme. Previously hardcoded dark (#141414), which left the panel's
    // theme-colored labels invisible (dark-on-dark) in light mode.
    "--panel-bg": isDark ? "#141414" : "#FFFFFF",
    "--panel-border": isDark ? "rgba(255,255,255,0.05)" : "rgba(17,17,16,0.08)",
    "--popover-bg": isDark ? "#151517" : "#FFFFFF",
    "--page-gradient": isDark
      ? "radial-gradient(ellipse 80% 60% at 50% 40%, #111112 0%, #0A0A0A 100%)"
      : "radial-gradient(ellipse 80% 60% at 50% 40%, #FFFFFF 0%, #F0EFED 100%)",
    "--logo-color": isDark ? "#fff" : "#1a1a18",
  };
}

export const CHAT_SUGGESTIONS = [
  { label: "Create a character", icon: "users" },
  { label: "Add new location", icon: "map" },
  { label: "Add a hero product or element", icon: "camera" },
];

export function isCameraDefault(frame) {
  return frame.cameraAngle === "front" && frame.cameraHeight === "eye" && frame.lens === "normal" && frame.movement === "static";
}

function deriveCameraText(frame) {
  const m = { static: "Static", pan: "Pan", track: "Tracking", crane: "Crane", handheld: "Handheld", steadicam: "Steadicam" };
  const h = { eye: "", low: "Low Angle", high: "High Angle", bird: "Bird's Eye", worm: "Worm's Eye" };
  const parts = [m[frame.movement] || "Static"];
  if (h[frame.cameraHeight]) parts.push(h[frame.cameraHeight]);
  return parts.join(" \xB7 ");
}

// -- RECONCILIATION ---------------------------------------------
// An asset (character / element / location) is "reconciled" when it
// appears in BOTH the project brief (meta.treatment) AND at least one
// storyboard frame. Anything generated but never woven into the
// creative drifts out of sync — these helpers detect that so the UI
// can flag it and offer one-click AI reconciliation.
const RECONCILE_AMBER = "#F5A623";
const RECONCILE_LABEL = { talent: "Character", products: "Element", locations: "Location" };
const RECONCILE_SECTION_NAME = { talent: "characters", products: "elements", locations: "locations" };

// Record a deleted asset's name+handle so we can later detect references to it
// still lingering in the brief / frame text (the "reverse reconcile").
function addTombstone(list, asset, type) {
  const arr = list || [];
  if (!asset) return arr;
  const name = String(asset.name || "").trim();
  const handle = String(asset.handle || "").trim();
  if (!name && !handle) return arr;
  const key = (name + "|" + handle).toLowerCase();
  return [...arr.filter(r => ((r.name || "") + "|" + (r.handle || "")).toLowerCase() !== key), { type, name, handle }];
}

// Orphans = deleted assets whose name or @handle still appears in the brief or a
// frame, and which haven't been re-created as a current asset.
function computeOrphans(data) {
  const refs = data?.deletedRefs || [];
  if (!refs.length) return { items: [], handles: [], count: 0 };
  const brief = String(data?.meta?.treatment || "").toLowerCase();
  const frames = data?.frames || [];
  const liveNames = new Set([...(data?.talent || []), ...(data?.products || []), ...(data?.locations || [])].map(a => String(a.name || "").toLowerCase().trim()).filter(Boolean));
  const liveHandles = new Set([...(data?.talent || []), ...(data?.products || []), ...(data?.locations || [])].map(a => String(a.handle || "").toLowerCase().trim()).filter(Boolean));
  const items = [];
  for (const r of refs) {
    const name = String(r.name || "").toLowerCase().trim();
    const handle = String(r.handle || "").toLowerCase().trim();
    // Re-created? then it's a live asset again, not an orphan.
    if ((name && liveNames.has(name)) || (handle && liveHandles.has(handle))) continue;
    const hit = (s) => (handle && handleMatches(s, handle)) || (name && mentionsName(s, name));
    const inBrief = hit(brief);
    const frameNumbers = frames.filter(f => hit(String(f.brief || "").toLowerCase())).map(f => f.number);
    if (inBrief || frameNumbers.length) items.push({ type: r.type, name: r.name, handle: r.handle, inBrief, frameNumbers });
  }
  return { items, handles: items.map(i => i.handle || i.name), count: items.length };
}

// Build the rich context reconcile needs to STAGE assets logically: each
// frame's act position, shot type, current cast, location, and group-shot flag;
// and each asset enriched with its role (talent) / focus (products) so the
// model can weight presence proportionally.
function buildReconcileContext(d, assets) {
  const talentById = Object.fromEntries((d.talent || []).map(t => [t.id, t]));
  const prodById = Object.fromEntries((d.products || []).map(p => [p.id, p]));
  const locById = Object.fromEntries((d.locations || []).map(l => [l.id, l]));
  const fr = d.frames || [];
  const n = fr.length;
  const frames = fr.map((f, i) => ({
    number: f.number,
    brief: f.brief,
    shotType: f.shotType,
    characters: (f.talentIds || []).map(id => talentById[id]?.name).filter(Boolean),
    location: locById[f.locationId]?.name || null,
    isGroup: (f.talentIds || []).length >= 2,
    position: n <= 1 ? "opening" : (i < n / 3 ? "opening third" : i >= (2 * n) / 3 ? "closing third" : "middle third"),
  }));
  const enriched = (assets || []).map(a => ({
    ...a,
    role: a.type === "talent" ? (talentById[a.id]?.role || "Supporting") : undefined,
    focus: a.type === "products" ? (prodById[a.id]?.focus || "Medium") : undefined,
  }));
  return { frames, assets: enriched };
}

// Whole-word match so a name isn't counted via a coincidental substring
// ("ball" inside "volleyball", "Sam" inside "sample").
// Match an @handle as a whole token so a short handle ("@sam") doesn't also
// match a longer one ("@sample"). The leading "@" bounds the start; the
// trailing (?![a-z0-9_]) bounds the end. Replaces fragile includes() matching
// that let short handles attach to the wrong asset (Court's review #10).
function handleMatches(text, handle) {
  const h = String(handle || "").toLowerCase().trim();
  if (!h) return false;
  try {
    return new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9_])", "i").test(String(text || ""));
  } catch {
    return String(text || "").toLowerCase().includes(h);
  }
}

function mentionsName(text, name) {
  if (!name) return false;
  try { return new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(text); }
  catch { return text.toLowerCase().includes(name.toLowerCase()); }
}

// Does a frame's brief reference this asset via a REAL @-tag? Matches BOTH
// the short @handle ("@cocacola") AND the @-prefixed full name the brief
// generator actually emits ("@Coca-Cola Classic can"). These diverge whenever
// the name has characters the handle strips (a hyphen, spaces) — e.g. the
// handle "@cocacola" is NOT a substring of "@coca-cola classic can", which made
// the can false-flag as "not in the storyboard" even though it's tagged in the
// shots. A bare prose mention (no @) still does NOT count — only @-tags attach a
// reference image at generation time (keeps the #43 tightening intact).
function frameTagsAsset(frameBrief, asset) {
  const fb = String(frameBrief || "");
  const handle = String(asset?.handle || "").toLowerCase().trim();
  if (handle && handleMatches(fb, handle)) return true;
  const name = String(asset?.name || "").trim();
  if (name) {
    try { if (new RegExp("@" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(fb)) return true; }
    catch { if (fb.toLowerCase().includes("@" + name.toLowerCase())) return true; }
  }
  return false;
}

function assetReconcileStatus(asset, type, data) {
  const brief = String(data?.meta?.treatment || "");
  const briefL = brief.toLowerCase();
  const name = String(asset?.name || "").trim();
  const handle = String(asset?.handle || "").toLowerCase().trim();
  // Distinctive handle word (e.g. "coke" from @coke). The brief often refers to
  // an asset by this token even when the exact multi-word NAME isn't present or
  // is reordered — e.g. element "Coke Bottle" (@coke) vs brief "glass bottle
  // Coke". Match it whole-word so the asset counts as in-brief. Skip common
  // stopwords / the @new placeholder so degenerate handles don't always pass.
  const handleWord = handle.replace(/^@/, "").trim();
  const HANDLE_STOPWORDS = new Set(["the", "and", "for", "new", "a", "an"]);
  const inBrief = (!!name && mentionsName(brief, name))
    || (!!handle && handleMatches(brief, handle))
    || (handleWord.length >= 3 && !HANDLE_STOPWORDS.has(handleWord) && mentionsName(brief, handleWord));
  const frames = data?.frames || [];
  const idKey = type === "talent" ? "talentIds" : type === "products" ? "productIds" : null;
  const inStoryboard = frames.some(f => {
    const fb = String(f?.brief || "");
    // Talent / products count as "in the storyboard" only via a REAL structured
    // reference — the @handle in a frame, or an id link. A loose prose mention
    // of the name does NOT count (it isn't @-tagged, so image-gen won't attach
    // its reference). This is why a just-added element whose name happens to
    // appear in the brief still flags until it's properly woven in.
    if (frameTagsAsset(fb, asset)) return true;
    if (idKey && (f[idKey] || []).includes(asset.id)) return true;
    // Locations have no @handle and aren't id-tagged in prose, so they DO match
    // by name (plus the locationId set by AUTO_DETECT once they're woven in).
    if (type === "locations") {
      if (f.locationId === asset.id) return true;
      if (name && mentionsName(fb, name)) return true;
    }
    return false;
  });
  return { inBrief, inStoryboard, needs: !inBrief || !inStoryboard };
}

// Whole-project scan → flat list of unreconciled items + per-section
// flags + total count. Mood and Brand are excluded (no identity to sync).
function computeReconciliation(data) {
  const sections = [
    ["talent", data?.talent || []],
    ["products", data?.products || []],
    ["locations", data?.locations || []],
  ];
  const items = [];
  const bySection = { talent: false, products: false, locations: false };
  for (const [type, list] of sections) {
    for (const a of list) {
      const st = assetReconcileStatus(a, type, data);
      if (st.needs) {
        items.push({ type, id: a.id, name: a.name, handle: a.handle, note: a.note, ...st });
        bySection[type] = true;
      }
    }
  }
  return { items, bySection, count: items.length };
}

// Fire a reconcile request from anywhere (tile chip, section button,
// chat). Workshop listens on window for "ww-reconcile". scope is
// "object" | "section" | "all".
function requestReconcile(detail) {
  window.dispatchEvent(new CustomEvent("ww-reconcile", { detail }));
}

// Small amber status dot overlaid on the top-left of an asset tile that
// isn't yet in the brief / storyboard. Clicking it reconciles just that
// item; clicking elsewhere on the tile still opens its detail view.
function ReconcileChip({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Reconcile this item"
      title="This isn't in the brief or storyboard yet — click to reconcile it"
      style={{
        position: "absolute", top: 8, left: 8, zIndex: 6,
        width: 11, height: 11, borderRadius: "50%", padding: 0, cursor: "pointer",
        background: RECONCILE_AMBER, outline: "none",
        border: "1.5px solid rgba(0,0,0,0.45)",
        boxShadow: "0 0 0 3px rgba(245,166,35,0.22), 0 1px 3px rgba(0,0,0,0.4)",
      }}
    />
  );
}

// Reconcile preview: shows the AI's proposed (editable) brief + optional
// per-frame touch-ups. The user can accept as-is, tweak the brief inline
// (= "edit manually"), or dismiss. Applies via onApply.
function ReconcileModal({ state, frames, onClose, onApply }) {
  const [brief, setBrief] = useState("");
  const [chosen, setChosen] = useState({}); // frameNumber -> bool

  useEffect(() => {
    if (state?.suggestion) {
      setBrief(state.suggestion.newBrief || "");
      const init = {};
      for (const fe of state.suggestion.frameEdits || []) init[fe.frameNumber] = true;
      setChosen(init);
    }
  }, [state?.suggestion]);

  if (!state) return null;
  const cleanup = state.mode === "cleanup";
  const targets = cleanup ? (state.orphans || []) : (state.assets || []);
  const names = targets.map(a => a.name).join(", ");
  const heading = cleanup
    ? (targets.length === 1 ? `Clean up "${targets[0].name}"` : `Clean up ${targets.length} deleted references`)
    : (targets.length === 1 ? `Reconcile "${targets[0]?.name}"` : `Reconcile ${targets.length} items`);
  const subtitle = cleanup
    ? `${names} ${targets.length === 1 ? "was" : "were"} deleted but ${targets.length === 1 ? "is" : "are"} still referenced in the brief / storyboard. Review the cleanup — it removes the dangling reference${targets.length === 1 ? "" : "s"} and regenerates affected frames.`
    : `${names} ${targets.length === 1 ? "isn't" : "aren't"} fully reflected in the brief / storyboard yet. Review the proposed update — edit the brief inline if you like, then apply.`;
  const frameByNum = Object.fromEntries((frames || []).map(f => [f.number, f]));
  const edits = state.suggestion?.frameEdits || [];
  const adds = state.suggestion?.newFrames || [];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.78)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--popover-bg)", border: "1px solid var(--panel-border)",
        borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "86vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
      }}>
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: RECONCILE_AMBER }} />
            <span style={{ fontFamily: "var(--f)", fontSize: 17, fontWeight: 600, color: "var(--warm)", letterSpacing: "-0.01em" }}>{heading}</span>
          </div>
          <div style={{ fontFamily: "var(--f)", fontSize: 13, color: "var(--warm-40)", lineHeight: 1.5 }}>
            {subtitle}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {state.loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "28px 0", color: "var(--warm-40)", fontFamily: "var(--f)", fontSize: 13 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--warm-12)", borderTopColor: RECONCILE_AMBER, animation: "spin 0.8s linear infinite" }} />
              Analyzing the brief and storyboard…
            </div>
          )}
          {state.error && (
            <div style={{ padding: "16px 0", fontFamily: "var(--f)", fontSize: 13, color: "#FF8A80", lineHeight: 1.5 }}>{state.error}</div>
          )}
          {!state.loading && !state.error && state.suggestion && (
            <>
              {state.suggestion.plan && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.28)" }}>
                  <SectionIcon name="sparkle" size={13} color={RECONCILE_AMBER} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 700, color: RECONCILE_AMBER, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>Staging plan</div>
                    <div style={{ fontFamily: "var(--f)", fontSize: 12, color: "var(--warm-50)", lineHeight: 1.5 }}>{state.suggestion.plan}</div>
                  </div>
                </div>
              )}
              <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Proposed brief</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                style={{
                  width: "100%", minHeight: 200, resize: "vertical",
                  fontFamily: "var(--f)", fontSize: 13, lineHeight: 1.7, color: "var(--warm)",
                  background: "var(--warm-04)", border: "1px solid var(--warm-10)",
                  borderRadius: 10, padding: "12px 14px", outline: "none",
                }}
              />
              {edits.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Storyboard touch-ups</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {edits.map(fe => (
                      <label key={fe.frameNumber} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: "var(--warm-04)", border: "1px solid var(--warm-08)" }}>
                        <input type="checkbox" checked={!!chosen[fe.frameNumber]} onChange={e => setChosen(c => ({ ...c, [fe.frameNumber]: e.target.checked }))} style={{ marginTop: 3, accentColor: RECONCILE_AMBER }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 700, color: "var(--warm-40)", letterSpacing: "0.06em", marginBottom: 3 }}>FRAME {fe.frameNumber}</div>
                          {frameByNum[fe.frameNumber]?.brief && (
                            <div style={{ fontFamily: "var(--f)", fontSize: 11, color: "var(--warm-25)", lineHeight: 1.5, textDecoration: "line-through", marginBottom: 3 }}>{frameByNum[fe.frameNumber].brief}</div>
                          )}
                          <div style={{ fontFamily: "var(--f)", fontSize: 12, color: "var(--warm-50)", lineHeight: 1.5 }}>{fe.newBrief}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {adds.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>New shots to add</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {adds.map((nf, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.30)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: RECONCILE_AMBER, marginTop: 6, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 700, color: RECONCILE_AMBER, letterSpacing: "0.06em", marginBottom: 3 }}>+ NEW {nf.shotType || "WIDE"} SHOT{nf.afterFrameNumber ? ` (after ${nf.afterFrameNumber})` : ""}</div>
                          <div style={{ fontFamily: "var(--f)", fontSize: 12, color: "var(--warm-50)", lineHeight: 1.5 }}>{nf.brief}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid var(--warm-06)" }}>
          <button onClick={onClose} style={{
            padding: "9px 16px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1px solid var(--warm-12)",
            color: "var(--warm-50)", outline: "none", fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
          }}>Keep editing</button>
          <button
            disabled={state.loading || !!state.error || !state.suggestion}
            onClick={() => onApply({ newBrief: brief, frameEdits: edits.filter(fe => chosen[fe.frameNumber]), newFrames: adds })}
            style={{
              padding: "9px 18px", borderRadius: 8,
              cursor: state.loading || state.error ? "default" : "pointer",
              background: state.loading || state.error ? "var(--warm-08)" : RECONCILE_AMBER,
              border: "none", color: state.loading || state.error ? "var(--warm-25)" : "#1A1206",
              outline: "none", fontFamily: "var(--f)", fontSize: 13, fontWeight: 700,
            }}>{cleanup ? "Remove references" : "Use this brief"}</button>
        </div>
      </div>
    </div>
  );
}

// Persist the AI chat drawer's open/closed state across reloads (ported from
// Court ckizer b6de969). NOTE: that commit also restyled AssetContext — we do
// NOT take that half; main's AssetContext is newer (thumbnails + slot labels).
const AI_CHAT_DRAWER_STORAGE_KEY = "ww-v2-ai-chat-drawer";
function readAIChatDrawerOpenPreference() {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(AI_CHAT_DRAWER_STORAGE_KEY) !== "closed"; }
  catch { return true; }
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
  // Dedupe against the WHOLE history, not just the last entry: selecting an
  // older version to make it live writes the image field again, which routes
  // back through here — without this it would append a duplicate thumbnail
  // and, over repeated flips, push genuinely-old versions out of the cap.
  // Real regenerations always produce a new URL, so they still append.
  if (prev.some(v => v.src === src)) return history || {};
  const next = [...prev, { src, createdAt: Date.now() }];
  const trimmed = next.length > MAX_VERSIONS_PER_SLOT ? next.slice(-MAX_VERSIONS_PER_SLOT) : next;
  return { ...(history || {}), [slotKey]: trimmed };
}

// Statuses that imply an async worker is in flight. If we see one of
// these in persisted data, the worker is almost certainly dead (the
// page was reloaded or the user closed the tab between dispatching
// "generating" and "complete"). Flip to "error" so the UI shows a
// retry affordance instead of an indefinite shimmer.
const STUCK_STATUSES = new Set(["generating", "uploading"]);
const isStuck = (s) => s && STUCK_STATUSES.has(s);

function sanitizeStuckStatuses(data) {
  if (!data) return data;
  const cleanList = (arr) => Array.isArray(arr)
    ? arr.map(x => isStuck(x?.generationStatus) ? { ...x, generationStatus: "error" } : x)
    : arr;
  return {
    ...data,
    talent: cleanList(data.talent),
    locations: cleanList(data.locations),
    products: cleanList(data.products),
    moodBoard: cleanList(data.moodBoard),
    frames: Array.isArray(data.frames)
      ? data.frames.map(f => f?.imageStatus === "generating"
        ? { ...f, imageStatus: "error" }
        : f)
      : data.frames,
  };
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
    case "UPDATE_META": {
      // Whitelist meta fields so a chat tool call (or any dispatch) can't write
      // an arbitrary key into meta — reducer-side defense, even if the tool
      // schema's enum is bypassed/hallucinated (Court's review #9).
      const META_FIELDS = new Set(["title", "treatment", "client", "format", "aspect"]);
      if (!META_FIELDS.has(action.field)) return state;
      return { ...state, meta: { ...state.meta, [action.field]: action.value } };
    }
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
    // Remove one saved version from a slot's history (the version-tracker's
    // per-thumbnail delete). Only touches the history log — the live image
    // (the slot's own field) is untouched, even if it was that version.
    case "REMOVE_VERSION": {
      const { slotKey, src } = action;
      if (!slotKey || !src || !state.versionHistory?.[slotKey]) return state;
      const next = state.versionHistory[slotKey].filter(v => v.src !== src);
      return { ...state, versionHistory: { ...state.versionHistory, [slotKey]: next } };
    }
    case "ADD_FRAME": {
      const maxId = Math.max(0, ...state.frames.map(f => parseInt(f.id.slice(1))));
      const nf = {
        id: "f" + (maxId + 1), number: "00", shotType: "MED", camera: "Static",
        brief: "New frame — describe the shot.", talentIds: [],
        locationId: state.locations[0]?.id || null, productIds: [],
        cameraAngle: "front", cameraHeight: "eye", lens: "normal", movement: "static",
        imageStatus: "placeholder", uploadedImage: null, duration: "3s",
        // Optional initial fields (used by reconcile to add an establishing
        // shot with a real brief/shotType). action.data.id wins so the caller
        // can track the new frame for regeneration.
        ...(action.data || {}),
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
      merged.handle = uniqueHandle(autoHandle(merged.name), state);
      return { ...state, talent: [...state.talent, merged] };
    }
    case "DELETE_TALENT": {
      const id = action.id;
      const gone = state.talent.find(t => t.id === id);
      return { ...state, talent: state.talent.filter(t => t.id !== id), frames: state.frames.map(f => ({ ...f, talentIds: f.talentIds.filter(tid => tid !== id) })), deletedRefs: addTombstone(state.deletedRefs, gone, "talent") };
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
      const merged = { id: "p" + (mx + 1), name: "New Product", category: "Other", focus: "Medium", hue: "#888888", referenceImage: null, generationStatus: "idle", ...action.data };
      merged.handle = uniqueHandle(autoHandle(merged.name), state);
      return { ...state, products: [...state.products, merged] };
    }
    case "DELETE_PRODUCT": {
      const id = action.id;
      const gone = state.products.find(p => p.id === id);
      return { ...state, products: state.products.filter(p => p.id !== id), frames: state.frames.map(f => ({ ...f, productIds: f.productIds.filter(pid => pid !== id) })), deletedRefs: addTombstone(state.deletedRefs, gone, "products") };
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
      merged.handle = uniqueHandle(autoHandle(merged.name), state);
      return { ...state, locations: [...state.locations, merged] };
    }
    case "DELETE_LOCATION": {
      const id = action.id;
      const gone = state.locations.find(l => l.id === id);
      return { ...state, locations: state.locations.filter(l => l.id !== id), frames: state.frames.map(f => ({ ...f, locationId: f.locationId === id ? null : f.locationId })), deletedRefs: addTombstone(state.deletedRefs, gone, "locations") };
    }
    case "PRUNE_DELETED_REFS":
      return { ...state, deletedRefs: action.refs || [] };
    case "UPDATE_BRAND": {
      // Whitelist brand fields (same rationale as UPDATE_META, Court #9).
      const BRAND_FIELDS = new Set(["name", "url", "guidelines", "logo"]);
      if (!BRAND_FIELDS.has(action.field)) return state;
      return { ...state, brand: { ...(state.brand || {}), [action.field]: action.value } };
    }
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
        // Link by @handle OR the @-prefixed full name (frameTagsAsset) — the
        // brief generator tags by name ("@Coca-Cola Classic can"), not the short
        // handle, so handle-only matching missed them (and the reference image
        // never attached). frameTagsAsset guards empty handles internally.
        const mentionedTalent = state.talent.filter(t => frameTagsAsset(f.brief, t)).map(t => t.id);
        const mentionedProducts = state.products.filter(p => frameTagsAsset(f.brief, p)).map(p => p.id);
        // Link a location by handle OR name → set the frame's single locationId.
        // Locations aren't @-tagged like talent/products, so without this they
        // never link to a frame (and never count as "in storyboard"). Preserve
        // the existing locationId when nothing in the text matches.
        const mloc = state.locations.find(l =>
          (l.handle && handleMatches(briefLower, l.handle.toLowerCase())) ||
          (l.name && l.name.trim() && mentionsName(briefLower, l.name.toLowerCase())),
        );
        return { ...f, talentIds: mentionedTalent, productIds: mentionedProducts, locationId: mloc ? mloc.id : f.locationId };
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
// High-water-mark for the current batch: total distinct keys queued since the
// pending set was last empty. Lets usePendingStats() report "done / total"
// (e.g. 12/43) without each call site tracking its own counts.
let _pendingTotal = 0;
const _pendingListeners = new Set();
function _notifyPending() { for (const fn of _pendingListeners) fn(); }
export function markPending(key) {
  if (!key) return;
  if (_pending.has(key)) return;
  if (_pending.size === 0) _pendingTotal = 0; // empty → start a fresh batch
  _pending.add(key);
  _pendingTotal++;
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
  _pendingTotal = 0;
  _notifyPending();
}
export function usePending(key) {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    _pendingListeners.add(force);
    return () => { _pendingListeners.delete(force); };
  }, []);
  if (!key) return false;
  return _pending.has(key);
}

// True if ANY pending key starts with prefix — drives the per-section shimmer
// on the left-nav tabs ("talent.", "product.", "location.", "mood.", "frame.").
export function useCategoryPending(prefix) {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    _pendingListeners.add(force);
    return () => { _pendingListeners.delete(force); };
  }, []);
  if (!prefix) return false;
  for (const k of _pending) if (k.startsWith(prefix)) return true;
  return false;
}

// Batch progress for the global "N/M generated" counter. total =
// high-water-mark since the pending set was last empty.
export function usePendingStats() {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    _pendingListeners.add(force);
    return () => { _pendingListeners.delete(force); };
  }, []);
  return { pending: _pending.size, total: _pendingTotal, done: Math.max(0, _pendingTotal - _pending.size) };
}

// True whenever ANY generation/regeneration is in flight (any pending key).
// Drives the chat's "working" spinner so people know the tool is busy.
function useAnyPending() {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => {
    _pendingListeners.add(force);
    return () => { _pendingListeners.delete(force); };
  }, []);
  return _pending.size > 0;
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

// Per-project "approve generations without asking" flag (Flow-style
// "Approve, do not ask again"). In-memory + localStorage so it persists
// per project. Cleared by toggling off (no UI for that yet — a fresh
// project simply starts asking again).
const _genAutoApprove = {};
function _genKey(pid) { return `ww_v2_genapprove_${pid || "_"}`; }

// Gate a bulk / expensive image generation behind a confirm — UNLESS the
// user already chose "don't ask again" for this project. Returns true to
// proceed. Reads the active project id itself so any component (section
// buttons, populate-all, chat) can call it without prop-threading.
export function confirmGeneration({ count = 0, label } = {}) {
  let pid = "_";
  try { pid = getActiveProjectId() || "_"; } catch {}
  if (_genAutoApprove[pid]) return Promise.resolve(true);
  try {
    if (localStorage.getItem(_genKey(pid)) === "1") { _genAutoApprove[pid] = true; return Promise.resolve(true); }
  } catch {}
  return new Promise(resolve => {
    uiBus.emit("confirm", {
      title: `Generate ${count} image${count === 1 ? "" : "s"}?`,
      message: label || "This will start generating images.",
      confirmLabel: "Approve",
      cancelLabel: "Cancel",
      danger: false,
      dontAskAgain: true,
      resolve: (res) => {
        const obj = (res && typeof res === "object") ? res : { confirmed: !!res, dontAskAgain: false };
        if (obj.confirmed && obj.dontAskAgain) {
          _genAutoApprove[pid] = true;
          try { localStorage.setItem(_genKey(pid), "1"); } catch {}
        }
        resolve(!!obj.confirmed);
      },
    });
  });
}

function UIProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    const offConfirm = uiBus.on("confirm", (payload) => {
      setDontAskAgain(false);
      setConfirmState({
        title: payload.title || "Are you sure?",
        message: payload.message || "",
        confirmLabel: payload.confirmLabel || "Confirm",
        cancelLabel: payload.cancelLabel || "Cancel",
        danger: payload.danger !== false,
        showDontAskAgain: !!payload.dontAskAgain,
        resolve: payload.resolve,
      });
    });
    return () => { offConfirm(); };
  }, []);

  const handleConfirmResolve = (v) => {
    // When the "don't ask again" toggle is present, resolve an object so
    // confirmGeneration can persist the choice; otherwise keep the plain
    // boolean that every existing uiConfirm caller expects.
    if (confirmState?.resolve) {
      confirmState.resolve(confirmState.showDontAskAgain ? { confirmed: v, dontAskAgain: v && dontAskAgain } : v);
    }
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
            {confirmState.showDontAskAgain && (
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
                marginBottom: 18, padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
              }}>
                <input type="checkbox" checked={dontAskAgain} onChange={e => setDontAskAgain(e.target.checked)}
                  style={{ marginTop: 1, accentColor: "#fff", width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--f)", fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.72)" }}>
                  <span style={{ fontWeight: 600, color: "#fff" }}>Approve, don't ask again</span> — let me generate freely in this project without confirming each time.
                </span>
              </label>
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

// -- CHAT TOOL SCHEMA (real Gemini chat-with-tools) -----------
// Used by handleSendMessage to turn user prompts into reducer
// dispatches via Gemini function calling. Add new tools here +
// matching dispatch logic in applyChatToolCall below.

const V2_CHAT_TOOLS = [
  {
    name: "update_frame_brief",
    description: "Replace a storyboard frame's shot description. Use this for any change to what a frame depicts. Pass the FULL new brief text — not just the modification.",
    parameters: {
      type: "object",
      properties: {
        frameNumber: { type: "string", description: "Zero-padded frame number, e.g. '01' or '06'." },
        newBrief: { type: "string", description: "The complete replacement brief text. Use @handles to reference characters / locations / products." },
      },
      required: ["frameNumber", "newBrief"],
    },
  },
  {
    name: "update_frame_camera",
    description: "Change a frame's camera settings — movement, height, lens, or angle. Any of the four fields can be omitted; only provided fields are updated.",
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
    description: "Change a frame's shot type (framing). Goes tighter (WIDE → MED → MCU → CU → ECU) or looser as the user asks.",
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
    description: "Edit a project-level metadata field — title, treatment, client. Pass the FULL new value.",
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
    description: "Edit a character's name, role, or note. Find by current name (case-insensitive substring match).",
    parameters: {
      type: "object",
      properties: {
        talentName: { type: "string", description: "Current name of the character to find." },
        field: { type: "string", enum: ["name", "role", "note"] },
        value: { type: "string" },
      },
      required: ["talentName", "field", "value"],
    },
  },
  {
    name: "update_location",
    description: "Edit a location's name or note. Find by current name.",
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
    description: "Edit an element/product's name, category, or note. Find by current name.",
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
    description: "Append a new frame to the storyboard. The frame starts with placeholder content the user can refine.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "create_talent",
    description: "Create a new character (talent) in the project. By default also generates the primary headshot image — set generateImage:false to skip. Use this when the user asks to add a character, suggest a casting option, etc.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full character name, e.g. 'Maya Chen'." },
        role: { type: "string", description: "Lead | Supporting | Cameo | similar role label. Default 'Supporting'." },
        note: { type: "string", description: "Physical / wardrobe description. Stick to appearance — age range, ethnicity, build, hair, wardrobe — and avoid expression / pose directions (they bias every generated frame)." },
        generateImage: { type: "boolean", description: "Default true. Set false only if the user explicitly says 'don't generate an image'." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_location",
    description: "Create a new location in the project. By default also generates the establishing-shot reference image. Use this when the user asks to add a setting / place.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short location name, e.g. 'Brooklyn Brownstone Rooftop'." },
        note: { type: "string", description: "Time of day, weather, architecture, atmosphere." },
        generateImage: { type: "boolean", description: "Default true." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_product",
    description: "Create a new product / element (props, branded items, hero objects). By default also generates the product photography reference.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product / element name." },
        category: { type: "string", description: "Footwear | Apparel | Beverage | Accessory | etc." },
        note: { type: "string", description: "Color, material, shape, key details." },
        generateImage: { type: "boolean", description: "Default true." },
      },
      required: ["name"],
    },
  },
  {
    name: "generate_asset_image",
    description: "Generate (or regenerate) the image for an EXISTING asset — talent primary headshot, location reference, product reference. Use this when the user asks to 'remake' or 'try a different look for' an asset.",
    parameters: {
      type: "object",
      properties: {
        assetType: { type: "string", enum: ["talent", "location", "product"] },
        assetName: { type: "string", description: "Current name of the asset (case-insensitive substring match)." },
        promptOverride: { type: "string", description: "Optional custom prompt that replaces the base prompt. Leave blank to regenerate from the asset's existing description." },
      },
      required: ["assetType", "assetName"],
    },
  },
  {
    name: "generate_frame_image",
    description: "Generate (or regenerate) the storyboard image for a frame. Uses the frame's brief + tagged @-handles as references.",
    parameters: {
      type: "object",
      properties: {
        frameNumber: { type: "string", description: "Zero-padded frame number." },
        promptOverride: { type: "string", description: "Optional custom prompt." },
      },
      required: ["frameNumber"],
    },
  },
  {
    name: "delete_frame",
    description: "Delete a storyboard frame. Remaining frames renumber automatically. Won't delete the last remaining frame.",
    parameters: {
      type: "object",
      properties: { frameNumber: { type: "string", description: "Zero-padded frame number." } },
      required: ["frameNumber"],
    },
  },
  {
    name: "reorder_frames",
    description: "Reorder the whole storyboard. Pass EVERY existing frame number exactly once, in the desired new order.",
    parameters: {
      type: "object",
      properties: { order: { type: "array", items: { type: "string" }, description: "All frame numbers in the new order, e.g. ['02','01','03']." } },
      required: ["order"],
    },
  },
  {
    name: "delete_talent",
    description: "Remove a character from the project. Also untags it from any frames it appeared in.",
    parameters: {
      type: "object",
      properties: { talentName: { type: "string", description: "Current name (case-insensitive substring match)." } },
      required: ["talentName"],
    },
  },
  {
    name: "delete_location",
    description: "Remove a location. Also clears it from any frames that used it.",
    parameters: {
      type: "object",
      properties: { locationName: { type: "string" } },
      required: ["locationName"],
    },
  },
  {
    name: "delete_product",
    description: "Remove a product / element. Also untags it from any frames it appeared in.",
    parameters: {
      type: "object",
      properties: { productName: { type: "string" } },
      required: ["productName"],
    },
  },
  {
    name: "update_brand",
    description: "Edit the project's brand info — the brand name, website URL, or written brand guidelines.",
    parameters: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["name", "url", "guidelines"] },
        value: { type: "string" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "add_mood",
    description: "Add a new mood-board reference. Optionally generate its image from the caption.",
    parameters: {
      type: "object",
      properties: {
        caption: { type: "string", description: "Short description of the visual reference." },
        generateImage: { type: "boolean", description: "Default false — set true only if the user wants an image generated now." },
      },
      required: [],
    },
  },
  {
    name: "update_mood",
    description: "Edit a mood-board item's caption. Reference the item by its 1-based position in the mood board.",
    parameters: {
      type: "object",
      properties: {
        index: { type: "number", description: "1-based position in the mood board." },
        caption: { type: "string" },
      },
      required: ["index", "caption"],
    },
  },
  {
    name: "delete_mood",
    description: "Remove a mood-board item by its 1-based position.",
    parameters: {
      type: "object",
      properties: { index: { type: "number" } },
      required: ["index"],
    },
  },
  {
    name: "generate_mood_image",
    description: "Generate (or regenerate) the image for a mood-board item by its 1-based position, from its caption.",
    parameters: {
      type: "object",
      properties: {
        index: { type: "number" },
        promptOverride: { type: "string", description: "Optional custom prompt." },
      },
      required: ["index"],
    },
  },
  {
    name: "toggle_section_lock",
    description: "Lock or unlock an entire section so its images are protected from regeneration. Toggles the current state.",
    parameters: {
      type: "object",
      properties: { section: { type: "string", enum: ["talent", "locations", "products", "mood", "brand"] } },
      required: ["section"],
    },
  },
  {
    name: "toggle_asset_lock",
    description: "Lock or unlock a single character, location, or product so it's protected from regeneration. Toggles the current state.",
    parameters: {
      type: "object",
      properties: {
        assetType: { type: "string", enum: ["talent", "location", "product"] },
        assetName: { type: "string" },
      },
      required: ["assetType", "assetName"],
    },
  },
  {
    name: "reconcile_asset",
    description: "Reconcile ONE character / element / location that isn't yet in the brief and/or storyboard — rewrites the brief (and a couple of frames) to include it. Use when the user asks to 'add X to the brief', 'reconcile X', or 'put the chips in the story'.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "The asset's name (case-insensitive substring match)." } },
      required: ["name"],
    },
  },
  {
    name: "reconcile_section",
    description: "Reconcile EVERY unreconciled item in a section (all characters, all elements, or all locations) into the brief & storyboard.",
    parameters: {
      type: "object",
      properties: { section: { type: "string", enum: ["characters", "elements", "locations"] } },
      required: ["section"],
    },
  },
  {
    name: "reconcile_all",
    description: "Reconcile ALL characters, elements, and locations that aren't yet in the brief and/or storyboard.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "cleanup_deleted_references",
    description: "REVERSE reconcile: remove leftover references to DELETED characters/elements/locations from the brief and storyboard. Use when the user says something like 'remove X everywhere', 'X is gone, take them out', 'clean up the deleted stuff', or 'get rid of the references to the deleted location'. Pass a name to clean only that one; omit to clean all deleted-item references.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Optional — clean only references to this deleted item's name. Omit to clean all." } },
    },
  },
  {
    name: "suggest_followups",
    description: "Offer 1-3 short, specific next-step suggestions the user can tap to continue (like a creative collaborator proposing what to do next). Call this at the END of a turn, in addition to any edits you made. ALSO use it when you ask a clarifying question — pass the likely answers as the suggestions so the user can just tap one. Each suggestion is the exact prompt that will be sent if tapped, so phrase them as first-person user requests (e.g. 'Add a wide establishing shot', 'Make Chloe the lead', 'Put her in the Pepsi sweatshirt').",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: { type: "string" },
          description: "1-3 concise tappable next-step prompts (max ~6 words each).",
        },
      },
      required: ["suggestions"],
    },
  },
];

// Apply a single chat tool call to the v2 reducer. Returns metadata
// about what happened so the chat UI can summarize + highlight.
function applyChatToolCall(action, data, dispatch) {
  const args = action.args || {};
  const findFrameId = (num) => {
    const norm = String(num || "").padStart(2, "0");
    return data.frames.find(f => f.number === norm)?.id || null;
  };
  switch (action.name) {
    case "update_frame_brief": {
      const id = findFrameId(args.frameNumber);
      if (!id || !args.newBrief) return null;
      dispatch({ type: "UPDATE_FRAME", frameId: id, field: "brief", value: args.newBrief });
      return { applied: true, kind: "frame", frameId: id, field: "brief" };
    }
    case "update_frame_camera": {
      const id = findFrameId(args.frameNumber);
      if (!id) return null;
      const fields = {};
      for (const k of ["movement", "cameraHeight", "lens", "cameraAngle"]) {
        if (args[k]) fields[k] = args[k];
      }
      if (Object.keys(fields).length === 0) return null;
      dispatch({ type: "UPDATE_FRAME_CAMERA", frameId: id, fields });
      return { applied: true, kind: "camera", frameId: id, field: Object.keys(fields).join(",") };
    }
    case "update_frame_shot_type": {
      const id = findFrameId(args.frameNumber);
      if (!id || !args.shotType) return null;
      dispatch({ type: "UPDATE_FRAME", frameId: id, field: "shotType", value: args.shotType });
      return { applied: true, kind: "frame", frameId: id, field: "shotType" };
    }
    case "update_meta": {
      if (!args.field || args.value == null) return null;
      dispatch({ type: "UPDATE_META", field: args.field, value: args.value });
      return { applied: true, kind: "meta", field: args.field };
    }
    case "update_talent": {
      const target = (data.talent || []).find(t =>
        t.name?.toLowerCase().includes((args.talentName || "").toLowerCase()),
      );
      if (!target || !args.field || args.value == null) return null;
      dispatch({ type: "UPDATE_TALENT", id: target.id, field: args.field, value: args.value });
      return { applied: true, kind: "talent", field: args.field };
    }
    case "update_location": {
      const target = (data.locations || []).find(l =>
        l.name?.toLowerCase().includes((args.locationName || "").toLowerCase()),
      );
      if (!target || !args.field || args.value == null) return null;
      dispatch({ type: "UPDATE_LOCATION", id: target.id, field: args.field, value: args.value });
      return { applied: true, kind: "location", field: args.field };
    }
    case "update_product": {
      const target = (data.products || []).find(p =>
        p.name?.toLowerCase().includes((args.productName || "").toLowerCase()),
      );
      if (!target || !args.field || args.value == null) return null;
      dispatch({ type: "UPDATE_PRODUCT", id: target.id, field: args.field, value: args.value });
      return { applied: true, kind: "product", field: args.field };
    }
    case "add_frame": {
      dispatch({ type: "ADD_FRAME" });
      return { applied: true, kind: "frame", field: "added" };
    }
    case "create_talent": {
      if (!args.name) return null;
      // Derive a unique @-handle from the first name. Reducer doesn't
      // validate uniqueness so we do it here.
      const firstWord = String(args.name).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const existingHandles = new Set((data.talent || []).map(t => (t.handle || "").toLowerCase()));
      let handle = `@${firstWord || "char"}`;
      let n = 2;
      while (existingHandles.has(handle.toLowerCase())) { handle = `@${firstWord}${n++}`; }
      const initials = String(args.name).trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
      dispatch({ type: "ADD_TALENT", data: {
        name: args.name,
        handle,
        role: args.role || "Supporting",
        note: args.note || "",
        initials,
      }});
      const wantImage = args.generateImage !== false;
      return {
        applied: true, kind: "talent", field: "created",
        effect: wantImage ? { type: "generateTalentPrimary", talentName: args.name } : null,
        message: `Created character ${args.name} ${handle}${wantImage ? " — generating headshot…" : ""}`,
      };
    }
    case "create_location": {
      if (!args.name) return null;
      const firstWord = String(args.name).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const existingHandles = new Set((data.locations || []).map(l => (l.handle || "").toLowerCase()));
      let handle = `@${firstWord || "loc"}`;
      let n = 2;
      while (existingHandles.has(handle.toLowerCase())) { handle = `@${firstWord}${n++}`; }
      dispatch({ type: "ADD_LOCATION", data: {
        name: args.name,
        handle,
        note: args.note || "",
        type: "ai",
      }});
      const wantImage = args.generateImage !== false;
      return {
        applied: true, kind: "location", field: "created",
        effect: wantImage ? { type: "generateLocationImage", locationName: args.name } : null,
        message: `Created location ${args.name} ${handle}${wantImage ? " — generating reference…" : ""}`,
      };
    }
    case "create_product": {
      if (!args.name) return null;
      const firstWord = String(args.name).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const existingHandles = new Set((data.products || []).map(p => (p.handle || "").toLowerCase()));
      let handle = `@${firstWord || "prod"}`;
      let n = 2;
      while (existingHandles.has(handle.toLowerCase())) { handle = `@${firstWord}${n++}`; }
      dispatch({ type: "ADD_PRODUCT", data: {
        name: args.name,
        handle,
        category: args.category || "Other",
        note: args.note || "",
      }});
      const wantImage = args.generateImage !== false;
      return {
        applied: true, kind: "product", field: "created",
        effect: wantImage ? { type: "generateProductImage", productName: args.name } : null,
        message: `Created element ${args.name} ${handle}${wantImage ? " — generating reference…" : ""}`,
      };
    }
    case "generate_asset_image": {
      if (!args.assetType || !args.assetName) return null;
      return {
        applied: true, kind: args.assetType, field: "regenerating",
        effect: {
          type: "generateAssetImage",
          assetType: args.assetType,
          assetName: args.assetName,
          promptOverride: args.promptOverride || null,
        },
        message: `Generating new ${args.assetType} image for ${args.assetName}…`,
      };
    }
    case "generate_frame_image": {
      const id = findFrameId(args.frameNumber);
      if (!id) return null;
      return {
        applied: true, kind: "frame", frameId: id, field: "regenerating",
        effect: {
          type: "generateFrameImage",
          frameId: id,
          promptOverride: args.promptOverride || null,
        },
        message: `Generating new image for frame ${args.frameNumber}…`,
      };
    }
    case "delete_frame": {
      const id = findFrameId(args.frameNumber);
      if (!id) return null;
      if ((data.frames || []).length <= 1) {
        return { applied: false, kind: "frame", message: "Can't delete the last remaining frame." };
      }
      dispatch({ type: "DELETE_FRAME", frameId: id });
      return { applied: true, kind: "frame", field: "deleted", message: `Deleted frame ${args.frameNumber}` };
    }
    case "reorder_frames": {
      const order = Array.isArray(args.order) ? args.order : [];
      const orderedIds = order.map(findFrameId).filter(Boolean);
      // Only reorder if we matched every frame exactly once — a partial
      // order would silently drop frames via the reducer's filter.
      if (orderedIds.length !== (data.frames || []).length) return null;
      dispatch({ type: "REORDER_FRAMES", orderedIds });
      return { applied: true, kind: "frame", field: "reordered", message: "Reordered the storyboard" };
    }
    case "delete_talent": {
      const target = (data.talent || []).find(t =>
        t.name?.toLowerCase().includes((args.talentName || "").toLowerCase()),
      );
      if (!target) return null;
      dispatch({ type: "DELETE_TALENT", id: target.id });
      return { applied: true, kind: "talent", field: "deleted", message: `Deleted character ${target.name}` };
    }
    case "delete_location": {
      const target = (data.locations || []).find(l =>
        l.name?.toLowerCase().includes((args.locationName || "").toLowerCase()),
      );
      if (!target) return null;
      dispatch({ type: "DELETE_LOCATION", id: target.id });
      return { applied: true, kind: "location", field: "deleted", message: `Deleted location ${target.name}` };
    }
    case "delete_product": {
      const target = (data.products || []).find(p =>
        p.name?.toLowerCase().includes((args.productName || "").toLowerCase()),
      );
      if (!target) return null;
      dispatch({ type: "DELETE_PRODUCT", id: target.id });
      return { applied: true, kind: "product", field: "deleted", message: `Deleted element ${target.name}` };
    }
    case "update_brand": {
      if (!args.field || args.value == null) return null;
      dispatch({ type: "UPDATE_BRAND", field: args.field, value: args.value });
      return { applied: true, kind: "brand", field: args.field, message: `Updated brand ${args.field}` };
    }
    case "add_mood": {
      dispatch({ type: "ADD_MOOD", data: { caption: args.caption || "" } });
      const wantImage = args.generateImage === true;
      // New item lands at the end → its 1-based index is current length + 1.
      const idx = (data.moodBoard || []).length + 1;
      return {
        applied: true, kind: "mood", field: "created",
        message: `Added mood reference${wantImage ? " — generating…" : ""}`,
        effect: wantImage ? { type: "generateMoodImage", index: idx, promptOverride: args.caption || null } : null,
      };
    }
    case "update_mood": {
      const item = (data.moodBoard || [])[Number(args.index) - 1];
      if (!item) return null;
      dispatch({ type: "UPDATE_MOOD", id: item.id, field: "caption", value: args.caption || "" });
      return { applied: true, kind: "mood", field: "caption", message: "Updated mood caption" };
    }
    case "delete_mood": {
      const item = (data.moodBoard || [])[Number(args.index) - 1];
      if (!item) return null;
      dispatch({ type: "DELETE_MOOD", id: item.id });
      return { applied: true, kind: "mood", field: "deleted", message: "Removed mood reference" };
    }
    case "generate_mood_image": {
      const item = (data.moodBoard || [])[Number(args.index) - 1];
      if (!item) return null;
      return {
        applied: true, kind: "mood", field: "regenerating",
        effect: { type: "generateMoodImage", index: Number(args.index), promptOverride: args.promptOverride || null },
        message: "Generating mood image…",
      };
    }
    case "toggle_section_lock": {
      if (!args.section) return null;
      dispatch({ type: "TOGGLE_SECTION_LOCK", section: args.section });
      return { applied: true, kind: "lock", field: args.section, message: `Toggled ${args.section} lock` };
    }
    case "toggle_asset_lock": {
      const list = args.assetType === "talent" ? (data.talent || [])
        : args.assetType === "location" ? (data.locations || [])
        : args.assetType === "product" ? (data.products || [])
        : [];
      const target = list.find(x => x.name?.toLowerCase().includes((args.assetName || "").toLowerCase()));
      const actionType = { talent: "TOGGLE_TALENT_LOCK", location: "TOGGLE_LOCATION_LOCK", product: "TOGGLE_PRODUCT_LOCK" }[args.assetType];
      if (!target || !actionType) return null;
      dispatch({ type: actionType, id: target.id });
      return { applied: true, kind: args.assetType, field: "lock", message: `Toggled lock on ${target.name}` };
    }
    case "reconcile_asset": {
      if (!args.name) return null;
      return { applied: true, kind: "reconcile", field: "reconcile", message: `Reconciling ${args.name}`,
        effect: { type: "reconcile", scope: "object", assetName: args.name } };
    }
    case "reconcile_section": {
      const map = { characters: "talent", elements: "products", locations: "locations" };
      const assetType = map[args.section];
      if (!assetType) return null;
      return { applied: true, kind: "reconcile", field: "reconcile", message: `Reconciling all ${args.section}`,
        effect: { type: "reconcile", scope: "section", assetType } };
    }
    case "reconcile_all": {
      return { applied: true, kind: "reconcile", field: "reconcile", message: "Reconciling everything",
        effect: { type: "reconcile", scope: "all" } };
    }
    case "cleanup_deleted_references": {
      return { applied: true, kind: "cleanup", field: "cleanup", message: args.name ? `Cleaning up references to ${args.name}` : "Cleaning up deleted references",
        effect: { type: "cleanupRefs", name: args.name || null } };
    }
    case "suggest_followups": {
      const suggestions = (args.suggestions || []).filter(s => typeof s === "string" && s.trim()).slice(0, 3);
      if (!suggestions.length) return null;
      return { suggestions };
    }
    default:
      return null;
  }
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

export function mockImproveText(text, hasImage) {
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

export function PremiumButton({ children, onClick, disabled, loading, complete, variant = "secondary", style = {}, title }) {
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

function DropdownAssetIcon({ src, size = 18, alt = "", style = {} }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size, flexShrink: 0, objectFit: "contain", ...style }}
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

export function AssetContext({ asset, type, thumb, onDismiss, slotLabel }) {
  const badges = { talent: "T", product: "P", location: "L", mood: "M", brand: "B" };
  const labels = { talent: "Character", product: "Element", location: "Location", mood: "Mood", brand: "Brand" };
  // When a specific image slot is focused, lead with "Selected image" + the
  // slot label so the user sees the chat is targeting that exact image.
  const topLabel = slotLabel ? "Selected image" : (labels[type] || "Selected");
  const nameLine = slotLabel || asset.name;
  return (
    <div style={{ borderRadius: 10, background: "var(--warm-04)", border: "1px solid var(--warm-08)", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px" }}>
        {thumb ? (
          <img src={thumb} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid var(--warm-08)", background: "var(--warm-06)" }} />
        ) : (
          <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 700, color: "var(--warm-30)", background: "var(--warm-06)", width: 34, height: 34, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{badges[type]}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{topLabel}</div>
          <div style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, color: "var(--warm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameLine}</div>
          {asset.handle ? <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 300, color: "var(--warm-25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asset.handle}</div> : null}
        </div>
        <button onClick={onDismiss} title="Dismiss" style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid var(--warm-08)", background: "transparent", color: "var(--warm-30)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f)", fontSize: 11, flexShrink: 0 }}>&times;</button>
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

function SheetFrame({ frame, index, data, aspectCSS = "2.39/1", selected, highlighted, isDragSrc, dispatch, onRetry, onDragStart, onDragOver, onDragLeave, onDragEnd, onDrop, onClick }) {
  const [hovered, setHovered] = useState(false);
  // Watch the pending bus too — bulk/auto regen marks every frame pending
  // up-front but flips imageStatus to "generating" only as each reaches the
  // worker pool, so without this a queued frame would sit with no shimmer
  // (the asset slots already do this; SheetFrame was the odd one out).
  const isPending = usePending(`frame.${frame.id}`);
  const loc = data.locations.find(l => l.id === frame.locationId);
  const prods = data.products.filter(p => frame.productIds.includes(p.id));
  const talents = data.talent.filter(t => frame.talentIds.includes(t.id));
  const lensHint = LENS_TYPES.find(lt => lt.value === frame.lens)?.hint || "";
  const handleImageError = () => {
    dispatch({ type: "CLEAR_FRAME_IMAGE", frameId: frame.id, status: "error" });
  };

  const frameCardClassName = [
    "overflow-hidden rounded-lg transition-colors",
    selected ? "ring-1 ring-ring/50" : "",
    highlighted ? "ring-1 ring-ring/30" : "",
    hovered ? "border-ring/40" : "",
  ].filter(Boolean).join(" ");

  return (
    <Card
      render={<motion.div />}
      className={frameCardClassName}
      layout
      layoutId={`frame-${frame.id}`}
      draggable onDragStart={e => onDragStart(e, frame.id)}
      onDragOver={e => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd} onDrop={onDrop} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      whileHover={isDragSrc ? undefined : { y: -2, scale: HOVER_SCALE }}
      whileTap={isDragSrc ? undefined : { scale: TAP_SCALE }}
      transition={TAP_SPRING}
      style={{
        cursor: isDragSrc ? "grabbing" : "pointer",
        opacity: isDragSrc ? 0.15 : 1,
        animation: highlighted ? "highlightPulse 1.5s ease" : "none",
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

      {/* Clean thumbnail. Vignette darkens the empty-state gradient
          for empty frames so the placeholder doesn't look flat. When
          an image IS loaded, only the image shows — no overlay, no
          film-strip bars (Logan asked to remove them). */}
      <div style={{ aspectRatio: aspectCSS, background: frame.uploadedImage ? "transparent" : FILM[index % FILM.length], position: "relative", overflow: "hidden" }}>
        {frame.uploadedImage && <img src={frame.uploadedImage} alt="" onError={handleImageError} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {!frame.uploadedImage && (
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at center, transparent 0%, rgba(0,0,0,0.4) 100%)" }} />
        )}
        {(frame.imageStatus === "generating" || isPending) && <ShimmerOverlay />}
        {/* Error state — frame failed during bulk auto-gen (usually
            a Gemini rate limit). Show a Retry pill so the user doesn't
            have to leave the storyboard to recover the missing frame. */}
        {frame.imageStatus === "error" && !frame.uploadedImage && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, padding: 10,
            background: "rgba(0,0,0,0.42)",
          }}>
            <div style={{
              fontFamily: "var(--f)", fontSize: 10, fontWeight: 600,
              color: "rgba(255,255,255,0.92)", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Generation failed</div>
            {onRetry && (
              <button
                onClick={e => { e.stopPropagation(); onRetry(frame.id); }}
                style={{
                  fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                  color: "#fff", background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.4)", borderRadius: 999,
                  padding: "4px 12px", cursor: "pointer", letterSpacing: "0.04em",
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer bar — location name on the left, editable duration on
          the right. Duration commits on blur via UPDATE_FRAME. */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 10px",
        borderTop: "1px solid var(--warm-04)",
      }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-20)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{loc?.name || "—"}</span>
        <FrameDuration
          duration={frame.duration}
          onChange={v => dispatch?.({ type: "UPDATE_FRAME", frameId: frame.id, field: "duration", value: v })}
        />
      </div>

      {/* Brief — @-handles render as colored chips by entity type */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-35)", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {renderMentions(frame.brief, data)}
        </div>
      </div>
    </Card>
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

function CameraControlStrip({ frame, dispatch, onStageChange }) {
  const update = (fields) => dispatch({ type: "UPDATE_FRAME_CAMERA", frameId: frame.id, fields });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Height (Angle wheel removed — it didn't influence generation) */}
      <div>
        <div style={secLabel}>Height</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {CAMERA_HEIGHTS.map(h => (
            <IconPill key={h.value} label={h.label} selected={frame.cameraHeight === h.value} onClick={() => { update({ cameraHeight: h.value }); onStageChange?.("height", h.label); }} />
          ))}
        </div>
      </div>

      {/* Lens */}
      <div>
        <div style={secLabel}>Lens</div>
        <div style={{ display: "flex", gap: 4 }}>
          {LENS_TYPES.map(lt => (
            <button key={lt.value} onClick={() => { update({ lens: lt.value }); onStageChange?.("lens", lt.label); }}
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

function ProductionView({ frame, data, dispatch, onBack, onPrev, onNext, hasPrev, hasNext, onDeleteFrame, onFocusChat, onStageChange, onRegenerateFrame }) {
  const [genLoading, setGenLoading] = useState(false);
  const [genComplete, setGenComplete] = useState(false);
  const [cameraInfoOpen, setCameraInfoOpen] = useState(false);
  const [heroHovered, setHeroHovered] = useState(false);
  const fileInputRef = useRef(null);
  const fIdx = data.frames.findIndex(f => f.id === frame.id);
  const update = (field, value) => dispatch({ type: "UPDATE_FRAME", frameId: frame.id, field, value });
  const updateCamera = (fields) => dispatch({ type: "UPDATE_FRAME_CAMERA", frameId: frame.id, fields });
  const isMobile = useIsMobile();
  const lensHint = LENS_TYPES.find(lt => lt.value === frame.lens)?.hint || "";
  const loc = data.locations.find(l => l.id === frame.locationId);
  const hasImage = !!frame.uploadedImage;
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
    <div style={{ padding: isMobile ? "0 16px 120px" : "0 24px 32px", maxWidth: isPortrait ? 1100 : 960, margin: "0 auto", background: "transparent" }}>
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
            {frame.imageStatus === "generating" && <ShimmerOverlay label="Generating…" />}
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
            <textarea value={frame.brief} onChange={e => { update("brief", e.target.value); onStageChange?.("description", "Description"); }} style={{ ...inp, minHeight: 90, resize: "vertical", lineHeight: 1.75 }} />
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
              onChange={v => { update("shotType", v); onStageChange?.("shotType", SHOT_TYPE_LABELS[v] || v); }}
            />
            <ChevronDropdown
              label="Camera Movement"
              value={frame.movement}
              options={MOVEMENT_TYPES.map(m => ({ value: m.value, label: m.label }))}
              onChange={v => { updateCamera({ movement: v }); onStageChange?.("movement", MOVEMENT_TYPES.find(m => m.value === v)?.label || v); }}
            />
          </div>

          {/* Location dropdown with thumbnails */}
          <LocationDropdown
            label="Location"
            value={frame.locationId || ""}
            locations={data.locations}
            onChange={v => { update("locationId", v || null); onStageChange?.("location", data.locations.find(l => l.id === v)?.name || "None"); }}
          />

          {/* === CAMERA INFO (always visible) === */}
          <div style={{ borderTop: "1px solid var(--warm-06)", marginTop: 4, paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <SectionIcon name="camera" size={13} color="var(--warm-30)" />
              <span style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--warm-35)", textTransform: "uppercase" }}>Camera Info</span>
            </div>
            <CameraControlStrip frame={frame} dispatch={dispatch} onStageChange={onStageChange} />
          </div>

          <div className="mt-5 flex border-t border-white/10 pt-5">
            <ConfirmAction label="Delete Frame" variant="danger" onConfirm={() => onDeleteFrame(frame.id)} />
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
    // Prefer the NAME — it's the field the user edits to switch brands.
    // (Previously the URL won, so changing the name to "Coca Cola" while the
    // old "pepsi.com" URL lingered just re-fetched Pepsi.)
    const input = (brand?.name || brand?.url || "").trim();
    if (!input) return;
    setRefetching(true);
    try {
      let brandKey = input.toLowerCase();
      try {
        const normalized = /^https?:\/\//i.test(brandKey) ? brandKey : `https://${brandKey}`;
        const url = new URL(normalized);
        const host = url.hostname.replace(/^www\./, "");
        if (host.includes(".")) brandKey = host.split(".")[0];
      } catch {}
      brandKey = brandKey.replace(/[^a-z0-9]/g, "");
      if (!brandKey) { setRefetching(false); return; }
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
    const n = moodBoard.filter(m => m.caption).length;
    if (!(await confirmGeneration({ count: n, label: "Regenerate every mood image from its caption." }))) return;
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
      <motion.div layout transition={LAYOUT_TRANSITION} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <AnimatePresence>
          {moodBoard.map(m => (
            <motion.div key={m.id} {...TILE_ENTER}>
              <MoodTile
                item={m}
                dispatch={dispatch}
                locked={sectionLocked}
                versions={data?.versionHistory?.[`mood.${m.id}`] || []}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.div layout transition={LAYOUT_TRANSITION} style={{ position: "relative" }}>
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
        </motion.div>
      </motion.div>
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

function CharacterTab({ data, dispatch, onFocusAsset }) {
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
    const ids = data.talent.map(t => t.id);
    const idx = ids.indexOf(viewingId);
    const goPrev = ids.length > 1 ? () => setViewingId(ids[(idx - 1 + ids.length) % ids.length]) : undefined;
    const goNext = ids.length > 1 ? () => setViewingId(ids[(idx + 1) % ids.length]) : undefined;
    return (
      <CharacterDetailView
        character={character}
        data={data}
        dispatch={dispatch}
        sectionLocked={locked}
        onBack={() => setViewingId(null)}
        onPrev={goPrev}
        onNext={goNext}
      />
    );
  }

  async function bulkRegenerate() {
    if (locked || bulkGenerating) return;
    const n = data.talent.filter(t => !t.locked).length;
    if (!(await confirmGeneration({ count: n, label: "Regenerate every character's reference headshot." }))) return;
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
        reconcileCount={data.talent.filter(t => assetReconcileStatus(t, "talent", data).needs).length}
        onReconcileAll={() => requestReconcile({ scope: "section", type: "talent" })}
      />
      <motion.div layout transition={LAYOUT_TRANSITION} style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}>
        <AnimatePresence>
          {data.talent.map(t => (
            <motion.div key={t.id} {...TILE_ENTER} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
              <CharacterTile character={t} onClick={() => { setViewingId(t.id); onFocusAsset?.("talent", t.id); }} />
              {assetReconcileStatus(t, "talent", data).needs && (
                <ReconcileChip onClick={e => { e.stopPropagation(); requestReconcile({ scope: "object", type: "talent", id: t.id }); }} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.div layout transition={LAYOUT_TRANSITION}>
          <AddCharacterTile onClick={() => dispatch({ type: "ADD_TALENT", data: {} })} />
        </motion.div>
      </motion.div>
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
  // Watch ALL of this character's slots (primary + headshots + full-body), not
  // just the primary, so the card keeps signalling through the whole generation
  // process. Label mirrors the storyboard cards: Generating vs Queued.
  const externalPending = useCategoryPending(`talent.${character.id}.`);
  const isPending = status === "generating" || externalPending;
  const genLabel = status === "generating" ? "Generating…" : "Queued";
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
        {/* Shimmer + Generating/Queued label whenever ANY of this character's
            slots are generating — persists through the headshot/full-body phase
            so the card shows where the tool is in the process. */}
        {isPending && <ShimmerOverlay label={genLabel} />}
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

function CharacterDetailView({ character, data, dispatch, sectionLocked, onBack, onPrev, onNext }) {
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
    // No primary reference yet → refuse: angle headshots NEED it as the
    // identity anchor, else every view is a different person. (The UI also
    // hides these sections until the reference exists; this is the backstop.)
    if (!character.headshot) { toast("Generate the reference image first — the angles need it to stay the same person.", { kind: "info" }); return; }
    // Mark the slot pending so it shimmers + shows "Generating…" — covers
    // both single-slot regen and the "Populate all" loop, which both route
    // through here (previously neither lit the slot up).
    const key = `talent.${character.id}.headshots.${view}`;
    markPending(key);
    try {
      const refs = character.headshot ? [character.headshot] : [];
      const url = await generateImage(resolvePrompt(talentHeadshotPrompt(character, view), opts), { ratio: "1:1", referenceImages: refs });
      dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: character.id, slot: view, url });
      return url;
    } finally {
      markDone(key);
    }
  }
  async function regenerateFullBody(view, opts) {
    if (!character.headshot) { toast("Generate the reference image first — the full-body shots need it to stay the same person.", { kind: "info" }); return; }
    const key = `talent.${character.id}.fullBody.${view}`;
    markPending(key);
    try {
      const refs = character.headshot ? [character.headshot] : [];
      const url = await generateImage(resolvePrompt(talentFullBodyPrompt(character, view), opts), { ratio: "3:4", referenceImages: refs });
      dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: character.id, slot: view, url });
      return url;
    } finally {
      markDone(key);
    }
  }

  // Populate-all: generate every view, RETRY each once (firing 8 images at
  // once often trips a transient rate-limit / safety block), and if any still
  // fail, TOAST which ones — instead of silently leaving an empty slot with no
  // explanation (that's why a "front full body" could just not appear).
  async function populateAllViews(genFn, kindLabel) {
    const failed = [];
    let lastMsg = "";
    for (const v of VIEWS) {
      try {
        await genFn(v);
      } catch {
        try { await genFn(v); }
        catch (e2) { failed.push(v); lastMsg = e2?.message || lastMsg; console.error(`[populate ${kindLabel}]`, v, e2); }
      }
    }
    if (failed.length) {
      const names = failed.map(v => VIEW_LABEL[v] || v).join(", ");
      toast(`Couldn't generate ${failed.length} ${kindLabel} view${failed.length === 1 ? "" : "s"} (${names})${lastMsg ? `: ${lastMsg}` : ""}. Click the empty slot to retry.`, { kind: "error", ttl: 8000 });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Detail header — cycle arrows FLANK the name (‹ Leo ›) so they're
          both right beside it; the lock button is pushed to the far right via
          marginLeft:auto. The left-nav "Characters" tab still returns to the
          grid. Falls back to ‹ Back if no siblings. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onPrev || onNext ? (
          <CycleArrow dir="prev" onClick={onPrev} title="Previous character" />
        ) : (
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 9px", borderRadius: 6, cursor: "pointer",
            background: "transparent", border: "1px solid var(--warm-08)",
            color: "var(--warm-40)", outline: "none",
            fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
          }}>
            <span>‹</span> Back
          </button>
        )}
        <div style={{ minWidth: 0, flexShrink: 1 }}>
          <EditableText
            value={character.name}
            onChange={v => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "name", value: v })}
            style={{ fontFamily: "var(--f)", fontSize: 20, fontWeight: 600, color: "var(--warm)", letterSpacing: "-0.01em", display: "block" }}
          />
          <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 500, color: "var(--warm-25)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
            {character.role || "Supporting"} · {character.handle}
          </div>
        </div>
        {(onPrev || onNext) && <CycleArrow dir="next" onClick={onNext} title="Next character" />}
        <div style={{ marginLeft: "auto" }}>
          <LockToggleButton
            locked={character.locked}
            onClick={() => dispatch({ type: "TOGGLE_TALENT_LOCK", id: character.id })}
            unlockedLabel="Lock Character"
            title={character.locked ? "Unlock this character" : "Lock this character"}
          />
        </div>
      </div>

      {/* Role — Lead / Supporting / Extra. Drives how much weight the brief
          and storyboard give this character (leads = focal/foreground,
          extras = background). */}
      <div>
        <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Role
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Lead", "Supporting", "Extra"].map(r => {
            const active = (character.role || "Supporting").toLowerCase() === r.toLowerCase();
            return (
              <button
                key={r}
                onClick={() => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "role", value: r })}
                style={{
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer", outline: "none",
                  fontFamily: "var(--f)", fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
                  background: active ? "var(--warm-12)" : "transparent",
                  border: `1px solid ${active ? "var(--warm-30)" : "var(--warm-10)"}`,
                  color: active ? "var(--warm)" : "var(--warm-40)",
                  transition: "all 0.12s ease",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag — editable @handle. Renaming a tag used elsewhere prompts to
          propagate the rename across the brief + frames, or undo. */}
      <div>
        <SectionLabel>Tag</SectionLabel>
        <TagEditor handle={character.handle} onCommit={(v) => renameAssetTag({ type: "talent", id: character.id, rawHandle: v, data, dispatch })} />
      </div>

      {/* Description */}
      <DescriptionField
        label="Description"
        value={character.note || ""}
        onChange={v => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "note", value: v })}
        placeholder="Describe this character — age, look, energy, wardrobe…"
        improveContext={{ kind: "character", name: character.name, brand: data.brand?.name, projectBrief: data.meta?.treatment, existingNames: [...data.talent, ...data.products, ...data.locations].map(a => a.name).filter(n => n && n !== character.name) }}
        currentName={character.name}
        onName={(nm) => {
          dispatch({ type: "UPDATE_TALENT", id: character.id, field: "name", value: nm });
          if (!character.handle || /^@new/i.test(character.handle)) dispatch({ type: "UPDATE_TALENT", id: character.id, field: "handle", value: uniqueHandle(deriveHandle(nm), data, character.id) });
        }}
      />

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
            focus={{ type: "talent", id: character.id, slotKey: `talent.${character.id}.headshot`, slotLabel: `${character.name} · Reference`, basePrompt: talentPrompt(character) }}
            onSelectVersion={src => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "headshot", value: src })}
            onRegenerate={regenerateReference}
            onClear={() => dispatch({ type: "CLEAR_TALENT_IMAGE_SLOT", id: character.id, slot: "headshot" })}
            onUpload={dataUrl => dispatch({ type: "UPDATE_TALENT", id: character.id, field: "headshot", value: dataUrl })}
          />
        </div>
      </div>

      {/* Angle headshots + full body use the PRIMARY reference above as
          their identity anchor — generating them before it exists produces a
          different person per angle. So gate the whole block on the reference
          being made (Court's call), and show a hint in its place until then. */}
      {character.headshot ? (
        <>
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
            focusByView={Object.fromEntries(VIEWS.map(v => [v, { type: "talent", id: character.id, slotKey: `talent.${character.id}.headshots.${v}`, slotLabel: `${character.name} · ${VIEW_LABEL[v]} headshot`, basePrompt: talentHeadshotPrompt(character, v) }]))}
            onSelectVersion={(view, src) => dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: character.id, slot: view, url: src })}
            onRegenerate={regenerateHeadshot}
            onClear={view => dispatch({ type: "CLEAR_TALENT_IMAGE_SLOT", id: character.id, slot: `headshots:${view}` })}
            onUpload={(view, dataUrl) => dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: character.id, slot: view, url: dataUrl })}
            onPopulateAll={() => populateAllViews(regenerateHeadshot, "headshot")}
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
            focusByView={Object.fromEntries(VIEWS.map(v => [v, { type: "talent", id: character.id, slotKey: `talent.${character.id}.fullBody.${v}`, slotLabel: `${character.name} · ${VIEW_LABEL[v]} full body`, basePrompt: talentFullBodyPrompt(character, v) }]))}
            onSelectVersion={(view, src) => dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: character.id, slot: view, url: src })}
            onRegenerate={regenerateFullBody}
            onClear={view => dispatch({ type: "CLEAR_TALENT_IMAGE_SLOT", id: character.id, slot: `fullBody:${view}` })}
            onUpload={(view, dataUrl) => dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: character.id, slot: view, url: dataUrl })}
            onPopulateAll={() => populateAllViews(regenerateFullBody, "full-body")}
          />
        </>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", borderRadius: 10,
          background: "var(--warm-04)", border: "1px dashed var(--warm-10)",
        }}>
          <SectionIcon name="sparkle" size={14} color="var(--warm-30)" />
          <span style={{ fontFamily: "var(--f)", fontSize: 12, fontWeight: 300, lineHeight: 1.5, color: "var(--warm-40)" }}>
            Generate the reference image above first — the headshot angles and full-body shots use it to keep the same face across every view.
          </span>
        </div>
      )}

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
function SlotGrid({ label, views, viewLabel, slots, ratio, locked, basePromptByView = {}, pendingKeyByView = {}, versionsBySlot = {}, focusByView = {}, onSelectVersion, onRegenerate, onClear, onUpload, onPopulateAll }) {
  const [populating, setPopulating] = useState(false);
  const hasAny = views.some(v => slots[v]);

  async function handlePopulateAll() {
    if (!(await confirmGeneration({ count: views.length, label: `Generate all ${views.length} ${label.toLowerCase()} views.` }))) return;
    setPopulating(true);
    // Mark every slot pending up front so they ALL shimmer + show
    // "Generating…" immediately while they wait their turn (populate runs
    // sequentially). Each regen clears its own key as it finishes; the
    // finally clears any stragglers.
    const keys = Object.values(pendingKeyByView).filter(Boolean);
    keys.forEach(markPending);
    try { await onPopulateAll(); } catch (e) { console.error(e); }
    finally { setPopulating(false); keys.forEach(markDone); }
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
              focus={focusByView[view]}
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
function V2ImageSlot({ src, label, ratio, locked, basePrompt, pendingKey, versions = [], onSelectVersion, onRegenerate, onClear, onUpload, focus = null }) {
  const [hovered, setHovered] = useState(false);
  // Which slot the chat is currently focused on (broadcast by the main
  // component whenever chatAssetContext changes — single source of truth).
  // This slot glows when it's the focused one. Clicking an image fires
  // ww-focus-slot to REQUEST focus; the chat panel can fire
  // ww-set-active-version to swap which saved version is live in this slot.
  const [focusedSlotKey, setFocusedSlotKey] = useState(null);
  const isFocused = !!(focus?.slotKey && focusedSlotKey === focus.slotKey);
  useEffect(() => {
    function onFocusChanged(e) { setFocusedSlotKey(e.detail?.slotKey || null); }
    function onSetVersion(e) {
      const { slotKey, src: vsrc } = e.detail || {};
      if (!focus?.slotKey || slotKey !== focus.slotKey || !vsrc) return;
      onSelectVersion?.(vsrc);
    }
    window.addEventListener("ww-focus-slot-changed", onFocusChanged);
    window.addEventListener("ww-set-active-version", onSetVersion);
    return () => {
      window.removeEventListener("ww-focus-slot-changed", onFocusChanged);
      window.removeEventListener("ww-set-active-version", onSetVersion);
    };
  }, [focus?.slotKey, onSelectVersion]);
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const [generating, setGenerating] = useState(false);
  // External pending state (from the autoGen pool's pending bus).
  // The slot shimmers whether or not its task has actually started,
  // so queued items announce themselves alongside in-flight ones.
  const externalPending = usePending(pendingKey);
  // Shimmer whenever this slot is generating — including a repopulate over an
  // existing image (every pending key is reliably cleared in a finally, so
  // there's no stuck-shimmer risk). "any time there's something generating".
  const showShimmer = generating || externalPending;
  const [improveOpen, setImproveOpen] = useState(false);
  const [improveText, setImproveText] = useState("");
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [editPromptOpen, setEditPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [improvingPrompt, setImprovingPrompt] = useState(false);
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
          border: isFocused ? "1px solid var(--accent, #43a3fd)" : "1px solid var(--warm-08)",
          boxShadow: isFocused ? "0 0 0 2px var(--accent, #43a3fd), 0 0 14px 1px rgba(67,163,253,0.45)" : "none",
          transition: "box-shadow 0.18s ease, border-color 0.18s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "visible",
        }}
        onClick={() => {
          // Clicking a generated image FOCUSES the chat on this specific
          // image: it becomes the chat's active target, the panel shows this
          // slot's version history, and the slot glows. ww-focus-slot carries
          // the asset + slot identity; the main component turns it into
          // chatAssetContext and opens the panel. Empty slot → generate.
          if (src) {
            if (focus?.slotKey) window.dispatchEvent(new CustomEvent("ww-focus-slot", { detail: focus }));
            else window.dispatchEvent(new CustomEvent("ww-open-chat"));
          } else if (!generating && !locked) handleRegen();
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
              display: "block", borderRadius: 8,
            }}
          />
        )}
        {!src && !showShimmer && (
          <div style={{ textAlign: "center", color: "var(--warm-25)", position: "relative", zIndex: 1, padding: 8 }}>
            {locked ? (
              <>
                <SectionIcon name="plus" size={16} color="var(--warm-25)" />
                <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 500, marginTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
              </>
            ) : (
              // Empty + unlocked → clicking the slot generates. Make that
              // obvious (it was just a "+ LABEL" placeholder before, so users
              // typed a description and didn't know how to generate the image).
              <>
                <SectionIcon name="sparkle" size={18} color="var(--warm-45)" />
                <div style={{ display: "flex", gap: 6, marginTop: 7, justifyContent: "center" }}>
                  <button
                    onClick={e => { e.stopPropagation(); if (!generating && !locked) handleRegen(); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, cursor: "pointer", background: "var(--warm-08)", border: "1px solid var(--warm-12)", color: "var(--warm-55)", outline: "none", fontFamily: "var(--f)", fontSize: 10, fontWeight: 600 }}
                  ><SectionIcon name="sparkle" size={10} color="currentColor" /> Generate</button>
                  <button
                    onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid var(--warm-12)", color: "var(--warm-45)", outline: "none", fontFamily: "var(--f)", fontSize: 10, fontWeight: 600 }}
                  >↑ Upload</button>
                </div>
                <div style={{ fontFamily: "var(--f)", fontSize: 8.5, fontWeight: 400, marginTop: 6, color: "var(--warm-25)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Generate or upload your own</div>
              </>
            )}
          </div>
        )}
        {showShimmer && <ShimmerOverlay label="Generating…" />}
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
            position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
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

function LocationTab({ data, dispatch, onFocusAsset }) {
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
    const ids = data.locations.map(l => l.id);
    const idx = ids.indexOf(viewingId);
    const goPrev = ids.length > 1 ? () => setViewingId(ids[(idx - 1 + ids.length) % ids.length]) : undefined;
    const goNext = ids.length > 1 ? () => setViewingId(ids[(idx + 1) % ids.length]) : undefined;
    return <LocationDetailView location={loc} data={data} dispatch={dispatch} sectionLocked={locked} aspect={aspect} onBack={() => setViewingId(null)} onPrev={goPrev} onNext={goNext} />;
  }

  async function bulkRegenerate() {
    if (locked || bulkGenerating) return;
    const n = data.locations.filter(l => !l.locked).length;
    if (!(await confirmGeneration({ count: n, label: "Regenerate every location image." }))) return;
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
        reconcileCount={data.locations.filter(l => assetReconcileStatus(l, "locations", data).needs).length}
        onReconcileAll={() => requestReconcile({ scope: "section", type: "locations" })}
      />
      <motion.div layout transition={LAYOUT_TRANSITION} style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}>
        {(() => {
          const asp = data.meta?.aspect || "16:9";
          const aspectCSS = asp.includes(":") ? asp.replace(":", "/") : `${asp}/1`;
          return (
            <>
              <AnimatePresence>
                {data.locations.map(l => (
                  <motion.div key={l.id} {...TILE_ENTER} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
                    <LocationTile location={l} onClick={() => { setViewingId(l.id); onFocusAsset?.("location", l.id); }} aspectCSS={aspectCSS} />
                    {assetReconcileStatus(l, "locations", data).needs && (
                      <ReconcileChip onClick={e => { e.stopPropagation(); requestReconcile({ scope: "object", type: "locations", id: l.id }); }} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <motion.div layout transition={LAYOUT_TRANSITION}>
                <AddTile label="Add Location" iconName="map" onClick={() => dispatch({ type: "ADD_LOCATION", data: {} })} aspectCSS={aspectCSS} />
              </motion.div>
            </>
          );
        })()}
      </motion.div>
    </div>
  );
}

function LocationTile({ location, onClick, aspectCSS = "16/9" }) {
  const [hovered, setHovered] = useState(false);
  const img = location.generatedImage || location.referenceImage;
  const status = location.generationStatus;
  const externalPending = usePending(`location.${location.id}`);
  const isPending = status === "generating" || externalPending;
  const genLabel = status === "generating" ? "Generating…" : "Queued";
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
      {isPending && <ShimmerOverlay label={genLabel} />}
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

function LocationDetailView({ location, data, dispatch, sectionLocked, aspect = "16:9", onBack, onPrev, onNext }) {
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
        onPrev={onPrev}
        onNext={onNext}
        name={location.name}
        subtitle={`${location.type === "ai" ? "AI generated" : "Reference"} · ${location.handle}`}
        locked={effLocked}
        onToggleLock={() => dispatch({ type: "TOGGLE_LOCATION_LOCK", id: location.id })}
        onRename={v => dispatch({ type: "UPDATE_LOCATION", id: location.id, field: "name", value: v })}
        lockLabel="Lock Location"
      />
      <div>
        <SectionLabel>Tag</SectionLabel>
        <TagEditor handle={location.handle} onCommit={(v) => renameAssetTag({ type: "locations", id: location.id, rawHandle: v, data, dispatch })} />
      </div>
      <DescriptionField
        label="Description"
        value={location.note || ""}
        onChange={v => dispatch({ type: "UPDATE_LOCATION", id: location.id, field: "note", value: v })}
        placeholder="Describe this location — time of day, weather, architecture, atmosphere…"
        improveContext={{ kind: "location", name: location.name, brand: data.brand?.name, projectBrief: data.meta?.treatment, existingNames: [...data.talent, ...data.products, ...data.locations].map(a => a.name).filter(n => n && n !== location.name) }}
        currentName={location.name}
        onName={(nm) => {
          dispatch({ type: "UPDATE_LOCATION", id: location.id, field: "name", value: nm });
          if (!location.handle || /^@new/i.test(location.handle)) dispatch({ type: "UPDATE_LOCATION", id: location.id, field: "handle", value: uniqueHandle(deriveHandle(nm), data, location.id) });
        }}
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
            focus={{ type: "location", id: location.id, slotKey: `location.${location.id}`, slotLabel: `${location.name} · Reference`, basePrompt: locationPrompt(location) }}
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

function ElementTab({ data, dispatch, onFocusAsset }) {
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
    const ids = data.products.map(p => p.id);
    const idx = ids.indexOf(viewingId);
    const goPrev = ids.length > 1 ? () => setViewingId(ids[(idx - 1 + ids.length) % ids.length]) : undefined;
    const goNext = ids.length > 1 ? () => setViewingId(ids[(idx + 1) % ids.length]) : undefined;
    return <ElementDetailView product={prod} data={data} dispatch={dispatch} sectionLocked={locked} onBack={() => setViewingId(null)} onPrev={goPrev} onNext={goNext} />;
  }

  async function bulkRegenerate() {
    if (locked || bulkGenerating) return;
    const n = data.products.filter(p => !p.locked).length;
    if (!(await confirmGeneration({ count: n, label: "Regenerate every element image." }))) return;
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
        reconcileCount={data.products.filter(p => assetReconcileStatus(p, "products", data).needs).length}
        onReconcileAll={() => requestReconcile({ scope: "section", type: "products" })}
      />
      <motion.div layout transition={LAYOUT_TRANSITION} style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}>
        <AnimatePresence>
          {data.products.map(p => (
            <motion.div key={p.id} {...TILE_ENTER} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
              <ElementTile product={p} onClick={() => { setViewingId(p.id); onFocusAsset?.("product", p.id); }} />
              {assetReconcileStatus(p, "products", data).needs && (
                <ReconcileChip onClick={e => { e.stopPropagation(); requestReconcile({ scope: "object", type: "products", id: p.id }); }} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.div layout transition={LAYOUT_TRANSITION}>
          <AddTile label="Add Element" iconName="box" onClick={() => dispatch({ type: "ADD_PRODUCT", data: {} })} />
        </motion.div>
      </motion.div>
    </div>
  );
}

function ElementTile({ product, onClick }) {
  const [hovered, setHovered] = useState(false);
  const img = product.referenceImage;
  const status = product.generationStatus;
  const externalPending = usePending(`product.${product.id}`);
  const isPending = status === "generating" || externalPending;
  const genLabel = status === "generating" ? "Generating…" : "Queued";
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
        {isPending && <ShimmerOverlay label={genLabel} />}
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
      }}>{`${product.focus || "Medium"} focus`}</div>
    </motion.button>
  );
}

function ElementDetailView({ product, data, dispatch, sectionLocked, onBack, onPrev, onNext }) {
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
        onPrev={onPrev}
        onNext={onNext}
        name={product.name}
        subtitle={`${product.focus || "Medium"} focus · ${product.handle}`}
        locked={effLocked}
        onToggleLock={() => dispatch({ type: "TOGGLE_PRODUCT_LOCK", id: product.id })}
        onRename={v => dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "name", value: v })}
        lockLabel="Lock Element"
      />
      {/* Focus — High / Medium / Low. Drives how prominently the storyboard
          features this element (High = hero/close-up, Low = supporting).
          Mirrors a character's Lead/Supporting/Extra role. */}
      <div>
        <SectionLabel>Focus</SectionLabel>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {[
            ["High", "Featured — very visible, often a close-up"],
            ["Medium", "Present and important, not the main focus"],
            ["Low", "There as support, not featured"],
          ].map(([f, hint]) => {
            const active = (product.focus || "Medium").toLowerCase() === f.toLowerCase();
            return (
              <button
                key={f}
                onClick={() => dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "focus", value: f })}
                title={hint}
                style={{
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer", outline: "none",
                  fontFamily: "var(--f)", fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
                  background: active ? "var(--warm-12)" : "transparent",
                  border: `1px solid ${active ? "var(--warm-30)" : "var(--warm-10)"}`,
                  color: active ? "var(--warm)" : "var(--warm-40)",
                  transition: "all 0.12s ease",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <SectionLabel>Tag</SectionLabel>
        <TagEditor handle={product.handle} onCommit={(v) => renameAssetTag({ type: "products", id: product.id, rawHandle: v, data, dispatch })} />
      </div>
      <DescriptionField
        label="Description"
        value={product.note || ""}
        onChange={v => dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "note", value: v })}
        placeholder="Describe this element — color, material, shape, key details for product photography…"
        improveContext={{ kind: "element", name: product.name, category: product.category, brand: data.brand?.name, projectBrief: data.meta?.treatment, existingNames: [...data.talent, ...data.products, ...data.locations].map(a => a.name).filter(n => n && n !== product.name) }}
        currentName={product.name}
        onName={(nm) => {
          dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "name", value: nm });
          if (!product.handle || /^@new/i.test(product.handle)) dispatch({ type: "UPDATE_PRODUCT", id: product.id, field: "handle", value: uniqueHandle(deriveHandle(nm), data, product.id) });
        }}
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
            focus={{ type: "product", id: product.id, slotKey: `product.${product.id}`, slotLabel: `${product.name} · Reference`, basePrompt: productPrompt(product) }}
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

// Cycle arrow used in the detail-view headers — ‹ / › flanking the name
// to step through the siblings in the current section (characters /
// elements / locations) with wraparound. Replaces the old "‹ Back" button;
// clicking the section name in the left nav still returns to the grid.
function CycleArrow({ dir, onClick, title }) {
  return (
    <button onClick={onClick} title={title || (dir === "prev" ? "Previous" : "Next")} style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 32, height: 32, borderRadius: 8, cursor: "pointer", flexShrink: 0,
      background: "transparent", border: "1px solid var(--warm-08)",
      color: "var(--warm-40)", outline: "none",
      fontFamily: "var(--f)", fontSize: 18, fontWeight: 500, lineHeight: 1,
    }}>{dir === "prev" ? "‹" : "›"}</button>
  );
}

function DetailHeader({ onBack, name, subtitle, locked, onToggleLock, onRename, lockLabel = "Lock", onPrev, onNext }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {onPrev || onNext ? (
        <CycleArrow dir="prev" onClick={onPrev} title="Previous" />
      ) : (
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 9px", borderRadius: 6, cursor: "pointer",
          background: "transparent", border: "1px solid var(--warm-08)",
          color: "var(--warm-40)", outline: "none",
          fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
        }}>‹ Back</button>
      )}
      <div style={{ minWidth: 0, flexShrink: 1 }}>
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
      {(onPrev || onNext) && <CycleArrow dir="next" onClick={onNext} title="Next" />}
      <button
        onClick={onToggleLock}
        style={{
          marginLeft: "auto",
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 7, cursor: "pointer",
          background: locked ? "var(--warm-12)" : "transparent",
          border: "1px solid var(--warm-12)",
          color: locked ? "var(--warm)" : "var(--warm-40)",
          outline: "none",
          fontFamily: "var(--f)", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}
      >
        {locked ? "🔒 Locked" : lockLabel}
      </button>
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

// Derive an @handle from a name: first word, lowercased, alphanumerics only.
function deriveHandle(name) {
  const w = String(name || "").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return w ? "@" + w : "";
}

// Write/expand an asset's description AND propose a short name for it. Returns
// { name, description }. Rules differ by kind so the output suits the image
// pipeline (character = appearance only; location = place; element = prop).
async function improveDescription({ kind, name, category, brand, current, existingNames, projectBrief }) {
  const kindLabel = kind === "character" ? "character" : kind === "location" ? "location" : "element / hero prop";
  const rules = kind === "character"
    ? "PRESERVE the user's stated intent and spirit EXACTLY — keep their described role / activity / vibe (e.g. 'a runner', 'a surfer', 'a chef') word-for-word in meaning; never swap it for a different activity and never drop it. THEN add concrete appearance detail: age range, ethnicity (or 'open casting'), build, hair (color/length/style), wardrobe with color + fabric, distinguishing features. The character must remain unmistakably what the user described (a runner stays a runner)."
    : kind === "location"
    ? "Describe the place for an establishing shot: setting, architecture, time of day, lighting, weather, key environmental textures and signage. No people."
    : "Describe this hero prop/product for a clean product shot: material, color, shape, finish, branding, distinctive details.";
  const nameHint = kind === "character"
    ? "a short proper first name (e.g. 'Marcus', 'Maya')"
    : kind === "location"
    ? "a short proper-noun place label (e.g. 'Brooklyn Rooftop', 'Sunny Beach')"
    : "a short product/prop name (1-3 words, e.g. 'Volleyball', 'Pepsi Can')";
  const TOOL = {
    name: "propose_asset_details",
    description: "Return a short name and a concrete description for this asset.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: `A concise name — ${nameHint}. If a specific name is already provided, keep/refine it. Otherwise pick a FRESH, distinct name — never reuse a name already in this project, and avoid the overused defaults (Marcus, Maya, Alex, Chloe, Liam, Mary, Sarah). Draw from a wide range of names/cultures.` },
        description: { type: "string", description: "1-2 tight concrete sentences. No labels, no quotes, no filler adjectives." },
      },
      required: ["name", "description"],
    },
  };
  const messages = [
    { role: "system", content: [
      `You name and describe a ${kindLabel} for an AI image pipeline that generates a reference image from it.`,
      "CRITICAL: you ENRICH the user's text — you NEVER remove, reverse, or contradict what they already wrote. Whatever role, activity, or intent they gave MUST survive in the result (if they wrote a runner, the output is still unmistakably a runner). You add detail; you do not rewrite their intent.",
      "STAY ON-THEME with the project. Keep the asset consistent with the spot's setting and tone — do NOT introduce clashing elements (e.g. no neon signs in a sunny daytime beach spot). When there's little to go on, infer plausibly FROM THE PROJECT CONTEXT, not at random.",
      rules,
      `Also propose ${nameHint}.`,
      "Return via propose_asset_details.",
    ].join("\n") },
    { role: "user", content: [
      projectBrief ? `PROJECT CONTEXT (the spot this asset belongs to — match its setting/tone): ${projectBrief}` : null,
      name ? `Current name (may be a placeholder like "New Product"): ${name}` : null,
      category ? `Category: ${category}` : null,
      brand ? `Brand context: ${brand}` : null,
      current?.trim() ? `Improve/expand this existing description: ${current.trim()}` : "There's no description yet — write one that fits the project context above.",
      existingNames && existingNames.length ? `Names ALREADY used in this project — do NOT reuse any of these, pick a different one: ${existingNames.join(", ")}.` : null,
    ].filter(Boolean).join("\n") },
  ];
  const { actions } = await chatWithTools(messages, [TOOL]);
  const call = (actions || []).find(a => a.name === "propose_asset_details");
  return {
    name: (call?.args?.name || "").trim().replace(/^["'`]+|["'`]+$/g, ""),
    description: (call?.args?.description || "").trim().replace(/^["'`]+|["'`]+$/g, ""),
  };
}

function DescriptionField({ label, value, onChange, placeholder, improveContext, onName, currentName }) {
  const [improving, setImproving] = useState(false);
  async function handleImprove() {
    if (improving) return;
    setImproving(true);
    try {
      const out = await improveDescription({ ...improveContext, current: value });
      if (out?.description) onChange(out.description);
      // Also name a still-unnamed item (placeholder "New Product/Talent/Location"
      // or empty) — never overwrite a name the user already chose.
      const cur = String(currentName || "").trim();
      const isPlaceholder = !cur || /^new (product|talent|location|element)$/i.test(cur);
      if (out?.name && onName && isPlaceholder) onName(out.name);
    } catch (e) {
      console.error("[improve description]", e);
      toast(`Couldn't improve the description: ${e?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
    } finally {
      setImproving(false);
    }
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <SectionLabel>{label}</SectionLabel>
        {improveContext && (
          <button
            onClick={handleImprove}
            disabled={improving}
            title="Write or expand this description with AI"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 9px", borderRadius: 7, cursor: improving ? "default" : "pointer",
              background: "rgba(255,200,87,0.10)", border: "1px solid rgba(255,200,87,0.40)",
              color: "#FFC857", outline: "none",
              fontFamily: "var(--f)", fontSize: 10, fontWeight: 600,
            }}
          >
            <SectionIcon name="sparkle" size={11} color="#FFC857" />
            {improving ? "Improving…" : "Improve with AI"}
          </button>
        )}
      </div>
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

function SectionHeader({ title, count, locked, onToggleLock, onAutoGenerate, generating, autoGenerateLabel = "Auto-generate", reconcileCount = 0, onReconcileAll }) {
  return (
    // flexWrap so the controls (esp. the amber "Reconcile all" button) drop to a
    // new line and make room when they appear, instead of overlapping the title
    // on narrow / mobile widths.
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <SectionTitle title={title} count={count} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {reconcileCount > 0 && onReconcileAll && (
          <button
            onClick={onReconcileAll}
            title="Add the missing items to the brief & storyboard"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 10, padding: "5px 10px", borderRadius: 7, cursor: "pointer",
              background: "rgba(245,166,35,0.14)", border: `1px solid ${RECONCILE_AMBER}`,
              color: RECONCILE_AMBER, outline: "none",
              fontFamily: "var(--f)", fontWeight: 600,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: RECONCILE_AMBER }} />
            Reconcile all ({reconcileCount})
          </button>
        )}
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

function AssetExpandedPanel({ activeTab, data, dispatch, expanded, setExpanded, typeKey, onAIAssist, onUpdateMeta, onRunRegeneration, onFocusAsset }) {
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
        <CharacterTab data={data} dispatch={dispatch} onFocusAsset={onFocusAsset} />
      </div>
    );
  }
  if (activeTab === "locations") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <LocationTab data={data} dispatch={dispatch} onFocusAsset={onFocusAsset} />
      </div>
    );
  }
  if (activeTab === "products") {
    return (
      <div style={{ position: "relative", animation: "fadeIn 0.2s ease" }}>
        <ElementTab data={data} dispatch={dispatch} onFocusAsset={onFocusAsset} />
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

function AssetTabBar({ data, dispatch, activeTab, onAIAssist, onFocusAsset, onUpdateMeta, onRunRegeneration }) {
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
          onFocusAsset={onFocusAsset}
          onUpdateMeta={onUpdateMeta}
          onRunRegeneration={onRunRegeneration}
        />
      </Card>
    </div>
  );
}

// -- ONE-SHEET WORKSPACE (drag-drop grid) ---------------------


function OneSheetWorkspace({ data, selectedFrameId, highlightedFrames, onSelectFrame, onUpdateMeta, dispatch, assetTabOpen, onToggleAssetTab, onAIAssist, onFocusAsset, onRetryFrame, onRunRegeneration }) {
  const isMobile = useIsMobile();
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
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: isMobile ? "16px 14px 120px" : "24px 24px 32px", background: "transparent" }}>
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
            const cols = isMobile ? 2 : (aspNum < 1 ? 4 : 3);
            return (
          <div style={{ paddingTop: 20, marginTop: 16 }}>
            <motion.div
              layout
              transition={LAYOUT_TRANSITION}
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
              <motion.div
                layout
                transition={LAYOUT_TRANSITION}
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
              </motion.div>
            </motion.div>
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
      position: "absolute", inset: 0, zIndex: 3, borderRadius: "inherit",
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

export function parseMentions(text, data) {
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
        <button onClick={onClose} aria-label="Close chat" title="Close chat" style={{
          width: 36, height: 36, borderRadius: 9, border: "1px solid var(--warm-20)",
          background: "var(--warm-10)", color: "var(--warm)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f)", fontSize: 24, fontWeight: 300, lineHeight: 1, outline: "none",
          paddingBottom: 2, transition: "background 0.14s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--warm-20)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--warm-10)"; }}
        >&times;</button>
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
  const [improveMode, setImproveMode] = useState("treatment"); // drives the Generating… tag label
  const [improveError, setImproveError] = useState(null);
  const [improveOpen, setImproveOpen] = useState(false);
  const [improveCustomMode, setImproveCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const fileRef = useRef(null);

  const addFiles = (fl) => {
    const nf = Array.from(fl).map(f => ({ name: f.name, size: f.size, type: f.type }));
    setFiles(prev => [...prev, ...nf]);
  };
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  // Improve with AI — rewrites the rough brief in one of three styles, all kept
  // pipeline-aware (named characters / locations / hero props the generator can
  // extract into separate image references). Treatment = evocative/artistic;
  // Script = concise, action-led; Custom = follow the user's own instruction.
  async function improveBrief(mode = "treatment", customInstruction = "") {
    const text = (meta.treatment || "").trim();
    if (!text || improving || generating) return;
    setImproveMode(mode);
    setImproveError(null);
    setImproving(true);
    setImproveOpen(false);
    setImproveCustomMode(false);
    try {
      // Shared, pipeline-aware base — every mode must preserve the entities the
      // downstream brief generator extracts (each named character/location/hero
      // prop becomes its own generated reference + storyboard tags).
      const base = [
        "You are rewriting a creative brief that feeds an AI pipeline which generates an image for every named character, location, and hero prop, plus a 6-9 frame storyboard that references them.",
        "PRESERVE every character, brand, location, and action from the input — never drop or invent entities. Give characters short proper names (e.g. 'Maya', 'Coach Rivera') so they can be tagged consistently. Refer to any brand/product EXACTLY as written — no invented variants, flavors, or SKUs. Don't single out minor background dressing as props.",
      ];
      const styles = {
        treatment: [
          "FORMAT: a TREATMENT — evocative, artistic, atmospheric prose. Lean into tone, mood, a specific color palette (named hues, not 'warm'), lighting, texture, and the emotional arc. Make it read like a director's vision.",
          "One or two flowing paragraphs, 120-200 words. No headings, labels, quotes, or preamble — return only the treatment.",
        ],
        script: [
          "FORMAT: a SCRIPT-style brief — direct, concise, present tense. Describe the specific ACTIONS of each named character and what happens in each named location, beat by beat, in order. Be literal and shootable about who does what, where. Minimal flourish — prioritize concrete action over mood.",
          "120-200 words. No headings, labels, quotes, or preamble — return only the rewritten brief.",
        ],
        custom: [
          `FORMAT: apply the user's own request for how to help — "${customInstruction}". Rewrite the brief accordingly while keeping every named entity.`,
          "120-200 words. No headings, labels, quotes, or preamble — return only the rewritten brief.",
        ],
      };
      const sys = [...base, "", ...(styles[mode] || styles.treatment)].join("\n");
      const messages = [
        { role: "system", content: sys },
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
      if (expanded) setMeta(m => ({ ...m, treatment: expanded }));
      else throw new Error("The AI returned an empty response — try again.");
    } catch (e) {
      console.error("[improve brief]", e);
      // Surface it — a silent console.error reads as "nothing happened".
      setImproveError(
        /Failed to fetch|NetworkError|50\d/.test(String(e?.message))
          ? "Couldn't reach the AI service. Check your connection and try again."
          : (e?.message || "Improve failed — try again.")
      );
    } finally {
      setImproving(false);
    }
  }
  const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const fmtType = (t) => t.startsWith("image/") ? "IMG" : t === "application/pdf" ? "PDF" : t.includes("word") ? "DOC" : t.startsWith("text/") ? "TXT" : "FILE";
  const formRowGap = 20;

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6vh 5%", position: "relative", zIndex: 1 }}>
        <div style={{ width: "min(800px, 92vw)" }}>
        <Reveal delay={60}>
          <h1 style={{ fontFamily: "var(--f)", fontSize: "clamp(40px, 7vw, 76px)", fontWeight: 250, lineHeight: 1.02, letterSpacing: "-0.045em", color: "#fbf7f2", margin: "0 0 24px 2px" }}>
            Welcome to the Workshop
          </h1>
        </Reveal>
        <Reveal delay={160}>
          {/* Create card — dark glass over the orange backdrop (Figma: Wonder
              Homescreen). Project name + folder, the "what are we making" brief
              with inline add-files (+) and Improve-with-AI (sparkle), then
              length / aspect / Create. */}
          <div style={{
            width: "100%", maxHeight: 600,
            background: "rgba(16, 14, 13, 0.7)",
            backdropFilter: "blur(40px) saturate(1.1)",
            WebkitBackdropFilter: "blur(40px) saturate(1.1)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 30px 90px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
            borderRadius: 26, padding: 24,
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {/* Row 1 — project name + folder */}
            <div style={{
              display: "flex", alignItems: "stretch",
              background: "rgba(8, 7, 7, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <input
                type="text"
                value={meta.title}
                onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
                placeholder="Project Name"
                style={{
                  flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
                  color: "var(--warm)", fontFamily: "var(--f)", fontSize: 16, fontWeight: 400,
                  padding: "16px 18px",
                }}
              />
              <div style={{ width: 1, background: "rgba(255, 255, 255, 0.08)" }} />
              <div style={{ display: "flex", alignItems: "center", paddingRight: 4 }}>
                <RootMenuDropdown
                  value={meta.client}
                  style={{ marginBottom: 0 }}
                  options={[
                    { value: "", label: "General" },
                    ...(folders.length ? [{ type: "separator" }] : []),
                    ...folders.map(folder => ({ value: folder, label: folder })),
                  ]}
                  onChange={client => setMeta(m => ({ ...m, client }))}
                  triggerIcon={<DropdownAssetIcon src={iconFolderUrl} size={16} />}
                  triggerLabel={meta.client || "General"}
                  renderIcon={() => <DropdownAssetIcon src={iconFolderUrl} size={16} />}
                  popupClassName="w-max min-w-[160px] max-w-[min(420px,calc(100vw-32px))]"
                />
              </div>
            </div>

            {/* Row 2 — what are we making + inline add-files / improve */}
            <div style={{ position: "relative" }}>
              {/* While the AI rewrites the brief, sweep the whole box with the
                  same shimmer + Generating… tag used on generating image cards,
                  so it's unmistakable that something is happening. */}
              {improving && (
                <ShimmerOverlay label={improveMode === "script" ? "Writing script…" : improveMode === "custom" ? "Improving…" : "Writing treatment…"} />
              )}
              <Textarea
                value={meta.treatment}
                onChange={e => { setMeta(m => ({ ...m, treatment: e.target.value })); if (improveError) setImproveError(null); }}
                size="lg"
                disabled={improving}
                placeholder="What are we making?"
                className="[&_[data-slot=textarea]]:pt-4 [&_[data-slot=textarea]]:pb-14 [&_[data-slot=textarea]]:px-5"
                style={{ minHeight: 280, resize: "vertical", lineHeight: 1.8, opacity: improving ? 0.6 : 1 }}
              />
              <button
                type="button"
                onClick={() => fileRef.current && fileRef.current.click()}
                title="Add reference files (treatments, scripts, images, mood boards)"
                style={{
                  position: "absolute", left: 14, bottom: 14, zIndex: 3,
                  width: 30, height: 30, borderRadius: 9,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "var(--warm-50)", cursor: "pointer", outline: "none", fontSize: 19, lineHeight: 1,
                  transition: "background 0.14s ease, color 0.14s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--warm)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--warm-50)"; }}
              >+</button>
              <button
                type="button"
                onClick={() => { if (meta.treatment?.trim() && !improving) setImproveOpen(o => !o); }}
                disabled={!meta.treatment?.trim() || improving || generating}
                title="Improve with AI"
                style={{
                  position: "absolute", right: 14, bottom: 14, zIndex: 6, overflow: "hidden",
                  width: 30, height: 30, borderRadius: 9,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: improveOpen ? "rgba(255,255,255,0.16)" : "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  cursor: meta.treatment?.trim() && !improving ? "pointer" : "not-allowed",
                  opacity: meta.treatment?.trim() && !improving ? 1 : 0.4,
                  outline: "none", transition: "background 0.14s ease, opacity 0.14s ease",
                }}
                onMouseEnter={e => { if (!e.currentTarget.disabled && !improveOpen) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { if (!improveOpen) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              >
                {improving && <ShimmerSweep color="rgba(255,255,255,0.38)" />}
                <DropdownAssetIcon src={iconSparkleUrl} size={14} style={{ filter: "brightness(0) invert(1)", opacity: 0.85, position: "relative", zIndex: 1 }} />
              </button>
              {improveOpen && (
                <div onClick={() => { setImproveOpen(false); setImproveCustomMode(false); }} style={{ position: "fixed", inset: 0, zIndex: 5 }} />
              )}
              {/* Improve-with-AI slide-out menu — rewrite the brief as a Treatment
                  (artistic), a Script (action-led), or via a custom instruction. */}
              <div style={{
                position: "absolute", right: 12, bottom: 52, zIndex: 6,
                width: 268, padding: 6, borderRadius: 14,
                background: "rgba(26, 23, 22, 0.97)", border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
                opacity: improveOpen ? 1 : 0,
                transform: improveOpen ? "translateY(0)" : "translateY(8px)",
                pointerEvents: improveOpen ? "auto" : "none",
                transition: "opacity 0.16s ease, transform 0.16s ease",
              }}>
                {!improveCustomMode ? (
                  <>
                    {[
                      { mode: "treatment", title: "Treatment", desc: "Evocative, artistic, descriptive" },
                      { mode: "script", title: "Script", desc: "Direct, concise character & location action" },
                    ].map(opt => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => improveBrief(opt.mode)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, border: "none", background: "transparent", color: "var(--warm)", cursor: "pointer", outline: "none" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ fontFamily: "var(--f)", fontSize: 13.5, fontWeight: 600 }}>{opt.title}</div>
                        <div style={{ fontFamily: "var(--f)", fontSize: 11.5, fontWeight: 400, color: "var(--warm-35)", marginTop: 1 }}>{opt.desc}</div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setImproveCustomMode(true)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, border: "none", background: "transparent", color: "var(--warm)", cursor: "pointer", outline: "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ fontFamily: "var(--f)", fontSize: 13.5, fontWeight: 600 }}>Tell the AI…</div>
                      <div style={{ fontFamily: "var(--f)", fontSize: 11.5, fontWeight: 400, color: "var(--warm-35)", marginTop: 1 }}>Describe the help you want</div>
                    </button>
                  </>
                ) : (
                  <div style={{ padding: 4 }}>
                    <textarea
                      value={customText}
                      onChange={e => setCustomText(e.target.value)}
                      placeholder="e.g. make it punchier, add a twist, focus on the product…"
                      autoFocus
                      rows={3}
                      onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && customText.trim()) improveBrief("custom", customText.trim()); }}
                      style={{ width: "100%", boxSizing: "border-box", resize: "none", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--warm)", fontFamily: "var(--f)", fontSize: 12.5, lineHeight: 1.5, outline: "none" }}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => setImproveCustomMode(false)}
                        style={{ flex: "0 0 auto", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "var(--warm-50)", cursor: "pointer", outline: "none", fontFamily: "var(--f)", fontSize: 12, fontWeight: 500 }}
                      >Back</button>
                      <button
                        type="button"
                        onClick={() => customText.trim() && improveBrief("custom", customText.trim())}
                        disabled={!customText.trim()}
                        style={{ flex: 1, padding: "6px 12px", borderRadius: 8, border: "none", background: customText.trim() ? "#f4f1ec" : "rgba(255,255,255,0.1)", color: customText.trim() ? "#15120f" : "var(--warm-35)", cursor: customText.trim() ? "pointer" : "not-allowed", outline: "none", fontFamily: "var(--f)", fontSize: 12, fontWeight: 600 }}
                      >Apply</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {improveError && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", borderRadius: 10,
                background: "rgba(229, 84, 74, 0.12)", border: "1px solid rgba(229, 84, 74, 0.3)",
                color: "#F2A39C", fontFamily: "var(--f)", fontSize: 12.5, lineHeight: 1.4,
              }}>
                <span aria-hidden="true">⚠</span>
                <span style={{ flex: 1 }}>{improveError}</span>
                <button
                  type="button"
                  onClick={() => setImproveError(null)}
                  style={{ border: "none", background: "transparent", color: "#F2A39C", cursor: "pointer", fontSize: 14, lineHeight: 1, outline: "none", padding: 2 }}
                >&times;</button>
              </div>
            )}

            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 6px", borderRadius: 6, background: "var(--warm-04)", border: "1px solid var(--warm-06)" }}>
                    <span style={{ fontFamily: "var(--f)", fontSize: 8, fontWeight: 700, color: "var(--warm-25)", background: "var(--warm-06)", padding: "2px 4px", borderRadius: 3 }}>{fmtType(f.type)}</span>
                    <span style={{ fontFamily: "var(--f)", fontSize: 11, color: "var(--warm-35)" }}>{f.name}</span>
                    <span style={{ fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-15)" }}>{fmtSize(f.size)}</span>
                    <button onClick={() => removeFile(i)} style={{ width: 16, height: 16, borderRadius: 3, border: "none", background: "transparent", color: "var(--warm-25)", cursor: "pointer", fontSize: 11, outline: "none" }}>&times;</button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.rtf"
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />

            {/* Row 3 — length + aspect + Create */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 118 }}>
                  <RootMenuDropdown
                    value={meta.format}
                    style={{ marginBottom: 0 }}
                    options={BRIEF_LENGTHS.map(s => { const sec = s.replace(/s$/, ""); return { value: sec, label: `${sec} sec` }; })}
                    onChange={v => setMeta(m => ({ ...m, format: v }))}
                    triggerIcon={<DropdownAssetIcon src={iconClockUrl} size={16} />}
                    triggerLabel={`${meta.format || "30"}s`}
                    renderIcon={() => <DropdownAssetIcon src={iconClockUrl} size={18} />}
                    popupClassName="w-max min-w-[140px] max-w-[min(320px,calc(100vw-32px))]"
                  />
                </div>
                <div style={{ width: 118 }}>
                  <RootMenuDropdown
                    value={meta.aspect}
                    style={{ marginBottom: 0 }}
                    options={BRIEF_RATIOS.map(r => ({ value: r.id, label: r.label }))}
                    onChange={v => setMeta(m => ({ ...m, aspect: v }))}
                    triggerIcon={<DropdownAssetIcon src={iconAspectUrl} size={16} />}
                    triggerLabel={meta.aspect || "16:9"}
                    renderIcon={(value, color, size = 18) => <RatioIcon ratio={value} color={color} size={size} />}
                    popupClassName="w-max min-w-[230px] max-w-[min(360px,calc(100vw-32px))]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => !generating && onGenerate(meta)}
                disabled={generating}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 26px", borderRadius: 999, border: "none",
                  background: "#f4f1ec", color: "#15120f",
                  fontFamily: "var(--f)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
                  cursor: generating ? "default" : "pointer", outline: "none",
                  boxShadow: "0 2px 14px rgba(0, 0, 0, 0.25)", opacity: generating ? 0.7 : 1,
                  transition: "filter 0.12s ease",
                }}
                onMouseEnter={e => { if (!generating) e.currentTarget.style.filter = "brightness(0.96)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
              >
                <DropdownAssetIcon src={iconSparkleUrl} size={14} style={{ filter: "brightness(0)", opacity: 0.85 }} />
                {generating ? "Creating…" : "Create"}
              </button>
            </div>

            {error && (
              <p style={{ margin: "2px 2px 0", fontFamily: "var(--f)", fontSize: 12, color: "#FF8A80" }}>{error}</p>
            )}
          </div>
        </Reveal>
        </div>
      </div>
    </div>
  );
}

// -- MAIN APP -------------------------------------------------

// Track whether we're at a phone-ish viewport. Inline styles can't be
// media-queried, so the layout reads this to collapse the 256px sidebar into
// an off-canvas drawer on mobile (offsite attendees view the homepage on
// phones — Ravi's flag).
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= breakpoint);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

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
      let initialData = activeId
        ? (isDemoProjectId(activeId) ? cloneDemoProjectData() : clearStaleGenerationState(loadProject(activeId)))
        : null;
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
  // Chat defaults CLOSED on phones (it's a full-screen overlay there, so opening
  // it by default would hide the storyboard); honors the saved preference on desktop.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 768 ? false : readAIChatDrawerOpenPreference(),
  );
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  // Chat history persists per-project: seeded from the project's saved
  // chatHistory on first paint, saved back into the project data on every
  // save, and reloaded on project switch — so it survives reloads and
  // follows you wherever you are in the project.
  const [chatMessages, setChatMessages] = useState(() => bootstrap.current.data?.chatHistory || []);
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

  // Reconciliation — which assets aren't yet in the brief + storyboard.
  // Cheap to recompute (a handful of assets × frames); drives the sidebar
  // dots, section buttons, tile chips, and the chat notice.
  const reconciliation = computeReconciliation(data);
  // Orphaned references — deleted assets still mentioned in the brief/storyboard.
  const orphans = computeOrphans(data);
  const [reconcile, setReconcile] = useState(null); // modal state

  useEffect(() => { setTimeout(() => setReady(true), 80); }, []);

  // Remember the AI chat drawer's open/closed state across reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(AI_CHAT_DRAWER_STORAGE_KEY, sidebarOpen ? "open" : "closed"); } catch {}
  }, [sidebarOpen]);

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
    if (isDemoProjectId(activeProjectId)) return; // demo is code-defined — nothing to hydrate from IDB
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
        setChatMessages(full.chatHistory || []);
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
  const chatRef = useRef(chatMessages);
  chatRef.current = chatMessages;
  const pendingSaveRef = useRef({ debounce: null, ceiling: null });

  useEffect(() => {
    if (!built || !activeProjectId) return;
    if (isDemoProjectId(activeProjectId)) return; // static demo is read-only / code-defined — never auto-save it
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
  }, [data, built, activeProjectId, chatMessages]);

  // Flush any pending save when the page unloads (refresh, close,
  // navigate away). Synchronous localStorage write — the only reliable
  // way to guarantee data is persisted before the JS context dies.
  useEffect(() => {
    function flushOnUnload() {
      if (activeRef.current && builtRef.current && !isDemoProjectId(activeRef.current)) {
        saveProjectSync(activeRef.current, clearStaleGenerationState({ ...dataRef.current, chatHistory: chatRef.current }));
      }
    }
    window.addEventListener("beforeunload", flushOnUnload);
    window.addEventListener("pagehide", flushOnUnload);
    return () => {
      window.removeEventListener("beforeunload", flushOnUnload);
      window.removeEventListener("pagehide", flushOnUnload);
    };
  }, []);

  // Clicking any image opens the AI chat (the per-image lightbox was removed
  // in favor of editing images via chat). The chat is already focused on the
  // asset/frame you're viewing; this surfaces and focuses the panel.
  useEffect(() => {
    function openChat() { setSidebarOpen(true); setChatFocusTrigger(p => p + 1); }
    window.addEventListener("ww-open-chat", openChat);
    return () => window.removeEventListener("ww-open-chat", openChat);
  }, []);

  // Click a specific image slot in a detail view → focus the chat on THAT
  // image: it becomes the active chat target, the panel shows its version
  // history, and the slot glows. The slot fires ww-focus-slot with its
  // asset + slot identity; we fold the slotKey into chatAssetContext (which
  // otherwise just carries the asset). Additive: a slotKey-less context still
  // behaves exactly as the tile-level selection always has.
  useEffect(() => {
    function onFocusSlot(e) {
      const d = e.detail;
      if (!d?.type || !d.id || !d.slotKey) return;
      setSelectedFrameId(null);
      setChatAssetContext({ type: d.type, id: d.id, slotKey: d.slotKey, slotLabel: d.slotLabel, basePrompt: d.basePrompt });
      setSidebarOpen(true);
      setChatFocusTrigger(p => p + 1);
    }
    window.addEventListener("ww-focus-slot", onFocusSlot);
    return () => window.removeEventListener("ww-focus-slot", onFocusSlot);
  }, []);

  // Single source of truth for the focused-slot glow: whenever the chat
  // context changes, broadcast which slotKey (if any) is now focused.
  // Focusing an ASSET via a tile (no slotKey) broadcasts null → any prior
  // slot glow clears. Every V2ImageSlot listens and glows iff it matches.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ww-focus-slot-changed", { detail: { slotKey: chatAssetContext?.slotKey || null } }));
  }, [chatAssetContext]);

  // Reconcile — pull a missing asset (or a whole section / everything)
  // back into the brief + storyboard. Opens the preview modal with an AI
  // suggestion the user can edit or apply. Triggered by tile chips,
  // section buttons, the chat notice (window "ww-reconcile"), or chat tools.
  const handleReconcile = useCallback(async (detail) => {
    const d = dataRef.current;
    // Reverse reconcile: clean up references to DELETED items.
    if (detail.mode === "cleanup") {
      const orph = computeOrphans(d);
      if (!orph.count) { toast("No leftover references to deleted items.", { kind: "info" }); return; }
      setReconcile({ mode: "cleanup", orphans: orph.items, loading: true, error: null, suggestion: null });
      try {
        const suggestion = await suggestOrphanCleanup({
          brief: d.meta?.treatment || "",
          frames: (d.frames || []).map(f => ({ number: f.number, brief: f.brief })),
          orphans: orph.items,
        });
        setReconcile(s => s ? { ...s, loading: false, suggestion } : s);
      } catch (e) {
        setReconcile(s => s ? { ...s, loading: false, error: e?.message?.slice(0, 200) || "Couldn't generate a cleanup. Try again." } : s);
      }
      return;
    }
    const rec = computeReconciliation(d);
    let assets;
    if (detail.scope === "object") assets = rec.items.filter(i => i.type === detail.type && i.id === detail.id);
    else if (detail.scope === "section") assets = rec.items.filter(i => i.type === detail.type);
    else assets = rec.items;
    if (!assets || assets.length === 0) {
      toast("Everything's already in the brief & storyboard.", { kind: "info" });
      return;
    }
    setReconcile({ scope: detail.scope, type: detail.type, assets, loading: true, error: null, suggestion: null });
    try {
      const ctx = buildReconcileContext(d, assets);
      const suggestion = await suggestReconciliation({
        brief: d.meta?.treatment || "",
        frames: ctx.frames,
        assets: ctx.assets,
      });
      setReconcile(s => s ? { ...s, loading: false, suggestion } : s);
    } catch (e) {
      setReconcile(s => s ? { ...s, loading: false, error: e?.message?.slice(0, 200) || "Couldn't generate a suggestion. Try again." } : s);
    }
  }, []);

  const applyReconcile = useCallback(async ({ newBrief, frameEdits, newFrames }) => {
    if (typeof newBrief === "string") dispatch({ type: "UPDATE_META", field: "treatment", value: newBrief });
    const d = dataRef.current;
    const touchedFrameIds = [];
    for (const fe of (frameEdits || [])) {
      const norm = String(fe.frameNumber || "").padStart(2, "0");
      const frame = (d.frames || []).find(f => f.number === norm);
      if (frame && fe.newBrief) { dispatch({ type: "UPDATE_FRAME", frameId: frame.id, field: "brief", value: fe.newBrief }); touchedFrameIds.push(frame.id); }
    }
    // Add any NEW frames (e.g. an establishing shot for a new location). Assign
    // explicit sequential ids so we can track them for regeneration.
    let base = Math.max(0, ...(d.frames || []).map(f => parseInt(String(f.id).slice(1)) || 0));
    for (const nf of (newFrames || [])) {
      if (!nf?.brief) continue;
      base += 1;
      const id = "f" + base;
      const afterFrameId = nf.afterFrameNumber
        ? ((d.frames || []).find(f => f.number === String(nf.afterFrameNumber).padStart(2, "0"))?.id || null)
        : null;
      dispatch({ type: "ADD_FRAME", afterFrameId, data: { id, brief: nf.brief, shotType: nf.shotType || "WIDE", imageStatus: "idle" } });
      touchedFrameIds.push(id);
    }
    // Relink @mentions so frame talent/product/location refs pick up the new text.
    dispatch({ type: "AUTO_DETECT_MENTIONS" });
    const n = touchedFrameIds.length;
    const added = (newFrames || []).filter(nf => nf?.brief).length;
    toast(`Brief reconciled${n ? ` + ${n} frame${n === 1 ? "" : "s"} updated${added ? ` (${added} new)` : ""}` : ""}.`, { kind: "success" });
    setReconcile(null);
    // Prune tombstones whose references are now gone (so a cleanup actually
    // clears the orphan flag once the deleted item is no longer mentioned).
    setTimeout(() => {
      const d2 = dataRef.current;
      const refs = d2.deletedRefs || [];
      if (refs.length) {
        const stillRef = new Set(computeOrphans(d2).items.map(i => (i.name || "") + "|" + (i.handle || "")));
        const kept = refs.filter(r => stillRef.has((r.name || "") + "|" + (r.handle || "")));
        if (kept.length !== refs.length) dispatch({ type: "PRUNE_DELETED_REFS", refs: kept });
      }
    }, 140);
    // Close the loop: regenerate the touched frames so the IMAGES actually
    // show the newly-woven-in asset (text alone left the pictures stale).
    // Gated by the generation confirm — respects "don't ask again".
    if (touchedFrameIds.length) {
      const ok = await confirmGeneration({
        count: touchedFrameIds.length,
        label: `Regenerate ${touchedFrameIds.length} storyboard frame${touchedFrameIds.length === 1 ? "" : "s"} so the reconciled item${touchedFrameIds.length === 1 ? "" : "s"} actually appear in the artwork.`,
      });
      if (ok) {
        // Let the dispatches above flush so AUTO_DETECT has linked refs before regen.
        await new Promise(r => setTimeout(r, 60));
        for (const fid of touchedFrameIds) regenerateOneFrame(fid).catch(e => console.error("[reconcile regen]", e));
      }
    }
  }, []);

  useEffect(() => {
    function onReconcile(e) { handleReconcile(e.detail || {}); }
    window.addEventListener("ww-reconcile", onReconcile);
    return () => window.removeEventListener("ww-reconcile", onReconcile);
  }, [handleReconcile]);

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
    // Don't persist the static demo when leaving it (it's read-only/code-defined).
    if (activeProjectId && built && activeProjectId !== projectId && !isDemoProjectId(activeProjectId)) {
      saveProject(activeProjectId, clearStaleGenerationState({ ...data, chatHistory: chatMessages }));
    }
    // The static demo's data lives in code (with images in /public), not storage.
    let next = isDemoProjectId(projectId) ? cloneDemoProjectData() : loadProject(projectId);
    if (!next && !isDemoProjectId(projectId)) {
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
    setChatMessages(next.chatHistory || []);
    setBuilt(true);
    setProjects(listProjects());
    setSaveStatus("idle");
  }

  // Start fresh — save current, clear active, show BriefForm.
  function startNewProject() {
    if (activeProjectId && built && !isDemoProjectId(activeProjectId)) {
      saveProject(activeProjectId, clearStaleGenerationState({ ...data, chatHistory: chatMessages }));
    }
    setActiveProjectId(null);
    setActiveProjectIdState(null);
    dispatch({ type: "SET_DATA", data: INITIAL_STATE });
    setChatMessages([]);
    setBuilt(false);
    setProjects(listProjects());
  }

  function handleBackToProjects() {
    if (activeProjectId && built && !isDemoProjectId(activeProjectId)) {
      saveProject(activeProjectId, clearStaleGenerationState({ ...data, chatHistory: chatMessages }));
    }
    setBuilt(false);
    setProductionFrameId(null);
    setSelectedFrameId(null);
    setProjects(listProjects());
  }

  function handleDeleteProject(projectId) {
    if (isDemoProjectId(projectId)) return; // the static demo isn't a real, deletable project
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
    if (isDemoProjectId(projectId)) return; // the static demo's name is fixed
    renameProject(projectId, newName);
    setProjects(listProjects());
  }

  // Clean up duplicate-name projects (fork-orphans from the old "Regenerate
  // All" bug). Groups by name, keeps the most-recently-updated of each, and
  // deletes the older same-name copies. Skips the active project if it's the
  // newest so the user isn't yanked out of what they're viewing.
  async function handleCleanupDuplicates() {
    const list = listProjects();
    const byName = new Map();
    for (const p of list) {
      const key = (p.name || "").trim().toLowerCase();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(p);
    }
    const toDelete = [];
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      // Keep the most-recently-updated; delete the rest.
      const sorted = [...group].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      toDelete.push(...sorted.slice(1));
    }
    if (toDelete.length === 0) return;
    const names = [...new Set(toDelete.map(p => p.name))].join(", ");
    const ok = await uiConfirm({
      title: `Remove ${toDelete.length} duplicate project${toDelete.length === 1 ? "" : "s"}?`,
      message: `This keeps the most recently edited copy of "${names}" and deletes the older duplicate${toDelete.length === 1 ? "" : "s"}. This can't be undone.`,
      confirmLabel: "Remove duplicates",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    for (const p of toDelete) deleteProject(p.id);
    setProjects(listProjects());
    toast(`Removed ${toDelete.length} duplicate project${toDelete.length === 1 ? "" : "s"}.`, { kind: "success" });
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
        const VIEWS = ["front", "side", "threeQuarter", "back"];
        markPending(`talent.${t.id}.primary`);
        markPending(`talent.${t.id}.headshots.front`);
        dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "generating" });
        let newPrimary = t.headshot;
        try {
          log("info", `chat: generating primary headshot for ${t.name}`);
          newPrimary = await generateImage(talentPrompt(t), { ratio: "1:1" });
          dispatch({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: newPrimary });
          dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: "front", url: newPrimary });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "complete" });
          log("info", `chat: ${t.name} primary done`);
        } catch (e) {
          log("error", `chat talent gen failed: ${t.name}`, { error: String(e?.message || e) });
          dispatch({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "error" });
          toast(`Couldn't generate headshot for ${t.name}: ${e?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
          markDone(`talent.${t.id}.primary`);
          markDone(`talent.${t.id}.headshots.front`);
          return;
        } finally {
          markDone(`talent.${t.id}.primary`);
          markDone(`talent.${t.id}.headshots.front`);
        }
        // Refresh the OTHER already-populated angle + full-body slots so the
        // whole character reflects the new appearance — not just the front.
        // Each uses the freshly-regenerated primary as the identity reference
        // so the person stays consistent across angles. Only regenerate slots
        // that already exist (don't conjure new ones).
        const refs = newPrimary ? [newPrimary] : [];
        for (const view of VIEWS) {
          if (view === "front" || !t.headshots?.[view]) continue;
          markPending(`talent.${t.id}.headshots.${view}`);
          try {
            const url = await generateImage(talentHeadshotPrompt(t, view), { ratio: "1:1", referenceImages: refs });
            dispatch({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: view, url });
          } catch (e) { log("error", `chat headshot ${view} failed: ${t.name}`, { error: String(e?.message || e) }); }
          finally { markDone(`talent.${t.id}.headshots.${view}`); }
        }
        for (const view of VIEWS) {
          if (!t.fullBody?.[view]) continue;
          markPending(`talent.${t.id}.fullBody.${view}`);
          try {
            const url = await generateImage(talentFullBodyPrompt(t, view), { ratio: "3:4", referenceImages: refs });
            dispatch({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: t.id, slot: view, url });
          } catch (e) { log("error", `chat fullbody ${view} failed: ${t.name}`, { error: String(e?.message || e) }); }
          finally { markDone(`talent.${t.id}.fullBody.${view}`); }
        }
        log("info", `chat: ${t.name} all populated angles refreshed`);
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
      case "generateMoodImage": {
        const item = (current.moodBoard || [])[Number(effect.index) - 1];
        if (!item) return;
        const aspect = current.meta?.aspect || "16:9";
        markPending(`mood.${item.id}`);
        dispatch({ type: "UPDATE_MOOD", id: item.id, field: "generationStatus", value: "generating" });
        try {
          const promptText = effect.promptOverride || item.caption || "Cinematic mood reference frame, atmospheric, on-brand";
          log("info", `chat: generating mood image #${effect.index}`);
          const url = await generateImage(promptText, { ratio: aspect });
          dispatch({ type: "UPLOAD_MOOD_IMAGE", id: item.id, dataUrl: url });
          dispatch({ type: "UPDATE_MOOD", id: item.id, field: "generationStatus", value: "complete" });
        } catch (e) {
          log("error", "chat mood gen failed", { error: String(e?.message || e) });
          dispatch({ type: "UPDATE_MOOD", id: item.id, field: "generationStatus", value: "error" });
          toast(`Couldn't generate mood image: ${e?.message?.slice(0, 100) || "unknown"}`, { kind: "error" });
        } finally {
          markDone(`mood.${item.id}`);
        }
        return;
      }
      case "reconcile": {
        // Chat-driven reconcile applies directly (undo is the backstop),
        // then posts a follow-up message describing what changed.
        const rec = computeReconciliation(current);
        let assets;
        if (effect.scope === "object") {
          const lc = String(effect.assetName || "").toLowerCase();
          assets = rec.items.filter(i => i.name?.toLowerCase().includes(lc));
        } else if (effect.scope === "section") {
          assets = rec.items.filter(i => i.type === effect.assetType);
        } else {
          assets = rec.items;
        }
        if (!assets.length) {
          setChatMessages(prev => [...prev, { id: Date.now(), role: "ai", text: "Everything's already in the brief & storyboard — nothing to reconcile.", changes: [] }]);
          return;
        }
        let suggestion;
        try {
          const ctx = buildReconcileContext(current, assets);
          suggestion = await suggestReconciliation({
            brief: current.meta?.treatment || "",
            frames: ctx.frames,
            assets: ctx.assets,
          });
        } catch (e) {
          toast(`Reconcile failed: ${e?.message?.slice(0, 120) || "unknown"}`, { kind: "error" });
          return;
        }
        dispatch({ type: "UPDATE_META", field: "treatment", value: suggestion.newBrief });
        const reconciledFrameIds = [];
        for (const fe of (suggestion.frameEdits || [])) {
          const norm = String(fe.frameNumber || "").padStart(2, "0");
          const fr = (current.frames || []).find(f => f.number === norm);
          if (fr && fe.newBrief) { dispatch({ type: "UPDATE_FRAME", frameId: fr.id, field: "brief", value: fe.newBrief }); reconciledFrameIds.push(fr.id); }
        }
        // Add new frames (e.g. an establishing shot for a location).
        let fbase = Math.max(0, ...(current.frames || []).map(f => parseInt(String(f.id).slice(1)) || 0));
        for (const nfr of (suggestion.newFrames || [])) {
          if (!nfr?.brief) continue;
          fbase += 1;
          const id = "f" + fbase;
          const afterFrameId = nfr.afterFrameNumber
            ? ((current.frames || []).find(f => f.number === String(nfr.afterFrameNumber).padStart(2, "0"))?.id || null)
            : null;
          dispatch({ type: "ADD_FRAME", afterFrameId, data: { id, brief: nfr.brief, shotType: nfr.shotType || "WIDE", imageStatus: "idle" } });
          reconciledFrameIds.push(id);
        }
        const n = reconciledFrameIds.length;
        dispatch({ type: "AUTO_DETECT_MENTIONS" });
        setChatMessages(prev => [...prev, { id: Date.now(), role: "ai", text: `Reconciled ${assets.map(a => a.name).join(", ")} into the brief${n ? ` and ${n} frame${n === 1 ? "" : "s"}` : ""}.${n ? " Regenerating the updated frame" + (n === 1 ? "" : "s") + "…" : ""}`, changes: [] }]);
        // Close the loop: regenerate the touched frames so the artwork shows the
        // reconciled asset (gated by the generation confirm / "don't ask again").
        if (n) {
          const ok = await confirmGeneration({ count: n, label: `Regenerate ${n} storyboard frame${n === 1 ? "" : "s"} so the reconciled item${n === 1 ? "" : "s"} appear in the artwork.` });
          if (ok) {
            await new Promise(r => setTimeout(r, 60));
            for (const fid of reconciledFrameIds) regenerateOneFrame(fid).catch(e => console.error("[reconcile regen]", e));
          }
        }
        return;
      }
      case "cleanupRefs": {
        // Chat-driven reverse reconcile — remove references to deleted items.
        const orph = computeOrphans(current);
        let targets = orph.items;
        if (effect.name) {
          const lc = String(effect.name).toLowerCase();
          targets = orph.items.filter(o => (o.name || "").toLowerCase().includes(lc) || (o.handle || "").toLowerCase().includes(lc));
        }
        if (!targets.length) {
          setChatMessages(prev => [...prev, { id: Date.now(), role: "ai", text: "No leftover references to deleted items.", changes: [] }]);
          return;
        }
        let suggestion;
        try {
          suggestion = await suggestOrphanCleanup({
            brief: current.meta?.treatment || "",
            frames: (current.frames || []).map(f => ({ number: f.number, brief: f.brief })),
            orphans: targets,
          });
        } catch (e) {
          toast(`Cleanup failed: ${e?.message?.slice(0, 120) || "unknown"}`, { kind: "error" });
          return;
        }
        dispatch({ type: "UPDATE_META", field: "treatment", value: suggestion.newBrief });
        const ids = [];
        for (const fe of (suggestion.frameEdits || [])) {
          const norm = String(fe.frameNumber || "").padStart(2, "0");
          const fr = (current.frames || []).find(f => f.number === norm);
          if (fr && fe.newBrief) { dispatch({ type: "UPDATE_FRAME", frameId: fr.id, field: "brief", value: fe.newBrief }); ids.push(fr.id); }
        }
        const n = ids.length;
        dispatch({ type: "AUTO_DETECT_MENTIONS" });
        setChatMessages(prev => [...prev, { id: Date.now(), role: "ai", text: `Removed references to ${targets.map(t => t.name).join(", ")} from the brief${n ? ` and ${n} frame${n === 1 ? "" : "s"}` : ""}.${n ? " Regenerating…" : ""}`, changes: [] }]);
        setTimeout(() => {
          const d2 = dataRef.current;
          const refs = d2.deletedRefs || [];
          if (refs.length) {
            const still = new Set(computeOrphans(d2).items.map(i => (i.name || "") + "|" + (i.handle || "")));
            const kept = refs.filter(r => still.has((r.name || "") + "|" + (r.handle || "")));
            if (kept.length !== refs.length) dispatch({ type: "PRUNE_DELETED_REFS", refs: kept });
          }
        }, 140);
        if (n) {
          const ok = await confirmGeneration({ count: n, label: `Regenerate ${n} storyboard frame${n === 1 ? "" : "s"} after removing the deleted item${n === 1 ? "" : "s"}.` });
          if (ok) {
            await new Promise(r => setTimeout(r, 60));
            for (const fid of ids) regenerateOneFrame(fid).catch(e => console.error("[cleanup regen]", e));
          }
        }
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
    // Match by @handle OR @-prefixed name so refs attach for assets the brief
    // tags by name (e.g. "@Coca-Cola Classic can" → @cocacola).
    const talentIds = (current.talent || []).filter(t => frameTagsAsset(frame.brief, t)).map(t => t.id);
    const productIds = (current.products || []).filter(p => frameTagsAsset(frame.brief, p)).map(p => p.id);
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
    // Attach @-mentioned products PLUS any High-focus element (a High-focus
    // element is meant to appear throughout, so ride it along on every frame
    // for cross-shot consistency) — deduped.
    const heroProductIds = (current.products || []).filter(p => /high/i.test(p.focus || "")).map(p => p.id);
    for (const pid of [...new Set([...productIds, ...heroProductIds])]) {
      const p = current.products.find(x => x.id === pid);
      const u = p?.referenceImage;
      if (u && !refs.includes(u)) refs.push(u);
    }
    markPending(`frame.${frameId}`);
    dispatch({ type: "SET_FRAME_IMAGE_STATUS", frameId, status: "generating" });
    try {
      log("info", `retrying frame ${frame.number}`);
      const url = await generateImage(framePrompt(frame, current.talent, current.products), { ratio: aspect, referenceImages: refs });
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
      const n = (current.talent?.length || 0) + (current.locations?.length || 0) + (current.products?.length || 0) + (current.frames?.length || 0);
      if (!(await confirmGeneration({ count: n, label: "Regenerate the entire project — every character, location, element, and storyboard frame — from the new brief." }))) return;
      toast("Regenerating the full project from the new brief…", { kind: "info", ttl: 4000 });
      await handleGenerate({
        title: current.meta?.title || "",
        client: current.meta?.client || "",
        format: current.meta?.format || "30",
        aspect: current.meta?.aspect || "16:9",
        treatment: current.meta?.treatment || "",
      }, { keepProjectId: activeRef.current });
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
      message: "Existing images keep their original ratio and will look cropped/letterboxed. Regenerate reshapes the things that use the project ratio — locations and storyboard frames — to the new shape, preserving each character's identity. Characters and products keep their own fixed reference ratios and are left untouched.",
      confirmLabel: "Regenerate all",
      cancelLabel: "Keep current images",
      danger: false,
    });
    if (!wantsRegen) return;
    toast(`Regenerating images at ${newRatio}…`, { kind: "info", ttl: 4000 });
    // Re-fire generation for every non-locked image in every section.
    // Sequenced through Promise.allSettled so a single failure doesn't
    // tank the whole sweep.
    // Only regenerate what actually depends on the project aspect ratio:
    // LOCATIONS and FRAMES. Character + product reference images are fixed
    // ratios (1:1 / 3:4) that don't change with the project aspect, so we
    // leave them untouched — regenerating them needlessly re-rolls identity
    // (this is what scrambled characters on a simple aspect change).
    // Build THUNKS (not already-started promises) and run them 3-at-a-time,
    // matching the throttled main pipeline. Previously each location + frame
    // promise was created — and thus fired — up front, so an aspect change on
    // a real project launched a dozen+ image gens at once, tripping Gemini's
    // rate limit and silently dropping images (Court's review #8).
    const taskThunks = [];
    for (const l of (data.locations || [])) {
      if (l.locked || data.locks?.locations) continue;
      taskThunks.push(async () => {
        try {
          // Condition on the existing location image so the reshaped version
          // keeps the same look, just at the new aspect.
          const ref = l.generatedImage || l.referenceImage;
          const url = await generateImage(locationPrompt(l), { ratio: newRatio, referenceImages: ref ? [ref] : [] });
          dispatch({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
        } catch (e) { console.error("[aspect-regen location]", e); }
      });
    }
    // Frames go through regenerateOneFrame so they're conditioned on the
    // character + location reference images (identity preserved) at the new
    // aspect — the old bare framePrompt path passed NO refs and produced
    // different-looking people.
    for (const f of (data.frames || [])) {
      taskThunks.push(() => regenerateOneFrame(f.id).catch(e => console.error("[aspect-regen frame]", e)));
    }
    const ASPECT_REGEN_CONCURRENCY = 3;
    const queue = [...taskThunks];
    const workers = Array.from({ length: ASPECT_REGEN_CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await next();
      }
    });
    await Promise.allSettled(workers);
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
    // Open the frame in production view, but DON'T auto-open the chat — clicking
    // around / into focus modes shouldn't pop the chat panel. The user opens chat
    // explicitly via the AI Chat tab.
    setSelectedFrameId(id);
    setProductionFrameId(id);
    setChatAssetContext(null);
  }, []);

  // Real brief generation, powered by v1's generateBrief() → Gemini.
  // Builds a single prompt string from the BriefForm inputs (title,
  // client, treatment, format, aspect), waits for Gemini to return the
  // structured brief, then maps it onto v2's data shape via the
  // migration utility. The user's typed inputs override anything the
  // model might guess differently (the BriefForm IS authoritative for
  // title/client/aspect/format).
  const handleGenerate = async (meta, opts = {}) => {
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
      //
      // EXCEPTION: regenerate-in-place. "Regenerate All" from the brief
      // audit passes opts.keepProjectId = the current project id, so we
      // OVERWRITE that same record instead of forking a second project
      // with an identical title (the cause of duplicate sidebar rows).
      const newId = opts.keepProjectId || newProjectId();
      if (!opts.keepProjectId) {
        setActiveProjectId(newId);
        setActiveProjectIdState(newId);
      }
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
      autoGenerateAssets(v2Data, meta.aspect, { imagePrompts, projectId: newId });
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
    // Cancellation guard (Court's review #7): this pipeline keeps firing image
    // gens for ~a minute. If the user switches to / starts a different project
    // mid-run, drop the in-flight results — otherwise they'd land on whatever
    // project is now open (asset/frame IDs are reused across projects, so a
    // result for project A's "f1" would overwrite project B's "f1").
    const genProjectId = opts.projectId ?? activeRef.current;
    const applyGen = (action) => {
      if (activeRef.current !== genProjectId) return;
      dispatch(action);
    };
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
    // Up to 3 retries with exponential backoff (1.5s → 3s → 6s) on
    // rate-limits / transient 5xx. Gemini rate-limits hard under a ~50-call
    // batch, and a single retry left too many calls dropping both attempts
    // (empty full-body SIDE slots, failed frames). More attempts + longer
    // backoff lets the per-minute window recover before giving up.
    async function withRetry(task, attempts = 3) {
      let delay = 1500;
      for (let i = 0; ; i++) {
        try {
          return await task();
        } catch (err) {
          const retryable = err?.status === 429 || (err?.status >= 500 && err?.status < 600) || !err?.status;
          if (!retryable || i >= attempts) throw err;
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
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
        applyGen({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "generating" });
        try {
          // Retry here too — the primary is the prerequisite for ALL of a
          // character's other 7 views, so a single dropped 429 here used to
          // wipe out the whole character (this was why Zoe generated nothing).
          const url = await withRetry(() => generateImage(talentPrompt(t), { ratio: "1:1" }));
          generated.talent.set(t.id, url);
          applyGen({ type: "UPDATE_TALENT", id: t.id, field: "headshot", value: url });
          // The primary also fills the FRONT headshot slot in the
          // detail-view 4-up grid — both fields point at the same image.
          applyGen({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: "front", url });
          applyGen({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "complete" });
          log("info", `talent primary done: ${t.name}`);
        } catch (err) {
          log("error", `talent primary failed: ${t.name}`, { error: String(err?.message || err) });
          applyGen({ type: "UPDATE_TALENT_GENERATION", id: t.id, status: "error" });
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
            applyGen({ type: "UPDATE_TALENT_HEADSHOT_SLOT", id: t.id, slot: view, url });
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
            applyGen({ type: "UPDATE_TALENT_FULLBODY_SLOT", id: t.id, slot: view, url });
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
        applyGen({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "generating" });
        try {
          const url = await withRetry(() => generateImage(locationPrompt(l), { ratio: aspect }));
          generated.locations.set(l.id, url);
          applyGen({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "complete", image: url });
          log("info", `location done: ${l.name}`);
        } catch (err) {
          log("error", `location failed: ${l.name}`, { error: String(err?.message || err) });
          applyGen({ type: "UPDATE_LOCATION_GENERATION", id: l.id, status: "error" });
        } finally {
          markDone(`location.${l.id}`);
        }
      });
    }
    for (const p of initialData.products || []) {
      phaseA2Tasks.push(async () => {
        applyGen({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "generating" });
        try {
          const url = await withRetry(() => generateImage(productPrompt(p), { ratio: "1:1" }));
          generated.products.set(p.id, url);
          applyGen({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "complete", image: url });
          log("info", `product done: ${p.name}`);
        } catch (err) {
          log("error", `product failed: ${p.name}`, { error: String(err?.message || err) });
          applyGen({ type: "UPDATE_PRODUCT_GENERATION", id: p.id, status: "error" });
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
          applyGen({
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
    const heroProductIds = (initialData.products || []).filter(p => /high/i.test(p.focus || "")).map(p => p.id);
    let frameSuccess = 0;
    let frameFail = 0;
    const frameTasks = (initialData.frames || []).map(f => async () => {
      applyGen({ type: "SET_FRAME_IMAGE_STATUS", frameId: f.id, status: "generating" });
      const talentIds = initialData.talent.filter(t => frameTagsAsset(f.brief, t)).map(t => t.id);
      const productIds = initialData.products.filter(p => frameTagsAsset(f.brief, p)).map(p => p.id);
      const locationId = f.locationId || (initialData.locations[0]?.id ?? null);
      const refs = [];
      for (const tid of talentIds) { const u = generated.talent.get(tid); if (u) refs.push(u); }
      if (locationId) { const u = generated.locations.get(locationId); if (u && !refs.includes(u)) refs.push(u); }
      // @-mentioned products + any High-focus element (rides along every frame).
      for (const pid of [...new Set([...productIds, ...heroProductIds])]) { const u = generated.products.get(pid); if (u && !refs.includes(u)) refs.push(u); }
      try {
        const url = await withRetry(() => generateImage(framePrompt(f, initialData.talent, initialData.products), { ratio: aspect, referenceImages: refs }));
        applyGen({ type: "UPLOAD_FRAME_IMAGE", frameId: f.id, dataUrl: url });
        frameSuccess++;
        log("info", `frame done: ${f.number}`);
      } catch (err) {
        log("error", `frame failed: ${f.number}`, { error: String(err?.message || err) });
        applyGen({ type: "SET_FRAME_IMAGE_STATUS", frameId: f.id, status: "error" });
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

    // Compact state snapshot — keep token usage reasonable. Just the
    // shape the model needs to reason about (names, ids, brief text,
    // current camera settings), not image URLs or generationStatus.
    const stateSnap = {
      meta: currentData.meta,
      talent: (currentData.talent || []).map(t => ({ id: t.id, name: t.name, handle: t.handle, role: t.role, note: t.note, hasImage: !!(t.headshot || t.headshots?.front), locked: !!t.locked })),
      locations: (currentData.locations || []).map(l => ({ id: l.id, name: l.name, handle: l.handle, type: l.type, note: l.note, hasImage: !!(l.generatedImage || l.referenceImage), locked: !!l.locked })),
      products: (currentData.products || []).map(p => ({ id: p.id, name: p.name, handle: p.handle, category: p.category, note: p.note, hasImage: !!p.referenceImage, locked: !!p.locked })),
      moodBoard: (currentData.moodBoard || []).map((m, i) => ({ index: i + 1, caption: m.caption, hasImage: !!m.image })),
      brand: currentData.brand ? { name: currentData.brand.name, url: currentData.brand.url, guidelines: currentData.brand.guidelines, hasLogo: !!currentData.brand.logo } : null,
      locks: currentData.locks || {},
      frames: (currentData.frames || []).map(f => ({
        id: f.id, number: f.number, shotType: f.shotType, brief: f.brief,
        camera: f.camera, cameraAngle: f.cameraAngle, cameraHeight: f.cameraHeight,
        lens: f.lens, movement: f.movement, hasImage: !!f.uploadedImage,
        talentIds: f.talentIds, locationId: f.locationId, productIds: f.productIds,
      })),
    };

    const focusedFrame = frameId ? currentData.frames.find(f => f.id === frameId) : null;

    // What the user has selected on the left — frame OR an asset (talent /
    // product / location / mood / brand). This is what makes pronouns like
    // "this", "her", "it" resolve to the thing the user clicked. The frame
    // path keeps its existing wording; assets get a focus line + their full
    // current fields so the model edits/regenerates the right one.
    let focusLine = focusedFrame
      ? `The user has frame ${focusedFrame.number} selected — "this"/"this frame" refers to it. Prefer edits/actions on that frame unless they say otherwise.`
      : "No frame is selected — global / multi-frame edits are appropriate.";
    if (chatAssetContext?.type) {
      const c = chatAssetContext;
      if (c.type === "talent") {
        const a = (currentData.talent || []).find(t => t.id === c.id);
        if (a) focusLine = `SELECTED: the character "${a.name}" (${a.handle}). This is the ACTIVE TARGET — every request this turn edits THIS character unless the user @-tags or names a different EXISTING character. "this/her/him/they/it" all refer to it. Use update_talent with talentName "${a.name}" to change its name, role, or note/appearance, and regenerate its image after an appearance change. DO NOT call create_talent — the character already exists, so naming or describing it just RENAMES + updates this one. Example: "a young black man named Marcus in a Pepsi sweatshirt" → update_talent name="Marcus" + note="young Black man, Pepsi sweatshirt" on the selected character, then regenerate. Only create_talent if the user explicitly says "add/create a NEW character." Current fields: ${JSON.stringify({ name: a.name, role: a.role, note: a.note, hasImage: !!(a.headshot || a.headshots?.front), locked: !!a.locked })}. The existing headshot is reused as an identity reference when regenerating.`;
      } else if (c.type === "product") {
        const a = (currentData.products || []).find(p => p.id === c.id);
        if (a) focusLine = `SELECTED: the element "${a.name}" (${a.handle}). This is the ACTIVE TARGET — every request this turn edits THIS element unless the user @-tags or names a different EXISTING element. "this/it" refers to it. Use update_product with productName "${a.name}" to change its name, category, or note, and regenerate after a change. DO NOT call create_product — naming or describing it just RENAMES + updates this one. Only create_product if the user explicitly says "add/create a NEW element." Current fields: ${JSON.stringify({ name: a.name, category: a.category, note: a.note, hasImage: !!a.referenceImage, locked: !!a.locked })}.`;
      } else if (c.type === "location") {
        const a = (currentData.locations || []).find(l => l.id === c.id);
        if (a) focusLine = `SELECTED: the location "${a.name}" (${a.handle}). This is the ACTIVE TARGET — every request this turn edits THIS location unless the user @-tags or names a different EXISTING location. "this/it/here" refers to it. Use update_location with locationName "${a.name}" to change its name or note, and regenerate after a change. DO NOT call create_location — naming or describing it just RENAMES + updates this one. Only create_location if the user explicitly says "add/create a NEW location." Current fields: ${JSON.stringify({ name: a.name, note: a.note, hasImage: !!(a.generatedImage || a.referenceImage), locked: !!a.locked })}.`;
      } else if (c.type === "mood") {
        const idx = (currentData.moodBoard || []).findIndex(m => m.id === c.id);
        if (idx >= 0) focusLine = `The user has mood-board item #${idx + 1} selected — "this"/"it" refers to it. Use index ${idx + 1} with the mood tools. Current caption: ${JSON.stringify((currentData.moodBoard || [])[idx]?.caption || "")}.`;
      } else if (c.type === "brand") {
        const b = currentData.brand || {};
        focusLine = `The user has the Brand section selected — "this"/"it"/"the brand" refer to it. Use update_brand for name/url/guidelines. Current: ${JSON.stringify({ name: b.name, url: b.url, hasLogo: !!b.logo })}.`;
      }
      // Image-level focus: the user clicked a SPECIFIC image slot, not just
      // the asset. "this image", "the prompt", "this one" refer to THAT image.
      if (c.slotKey) {
        focusLine += `\nThe user has a SPECIFIC IMAGE of this asset selected: "${c.slotLabel || c.slotKey}". "this image", "this one", "the prompt", and "this prompt" all refer to THAT image. If asked to show/print/explain the prompt, return this image's prompt verbatim: ${JSON.stringify(c.basePrompt || "")}. If asked to change THIS image, regenerate the asset (the selected view is the one to update).`;
      }
    }

    const reconcileNote = (() => {
      const rec = computeReconciliation(currentData);
      if (rec.count === 0) return "";
      const lines = rec.items.map(i => {
        const miss = [!i.inBrief && "the brief", !i.inStoryboard && "the storyboard"].filter(Boolean).join(" and ");
        return `- ${RECONCILE_LABEL[i.type]} "${i.name}" (${i.handle}) is missing from ${miss}.`;
      }).join("\n");
      return [
        "",
        "ASSETS NEEDING RECONCILIATION (generated but not yet woven into the creative):",
        lines,
        "If the user asks to add one of these to the brief / story, 'reconcile' it, or 'put it in', call reconcile_asset (one), reconcile_section (a whole section: characters/elements/locations), or reconcile_all. These rewrite the brief + relevant frames to include the asset.",
      ].join("\n");
    })();

    const orphanNote = (() => {
      const orph = computeOrphans(currentData);
      if (orph.count === 0) return "";
      const lines = orph.items.map(i => `- ${RECONCILE_LABEL[i.type]} "${i.name}"${i.handle ? ` (${i.handle})` : ""} was DELETED but is still referenced.`).join("\n");
      return [
        "",
        "DELETED ITEMS STILL REFERENCED (orphaned — the asset no longer exists but the brief/frames still mention it):",
        lines,
        "If the user asks to remove one of these, 'clean up', or 'get rid of it everywhere', call cleanup_deleted_references (pass a name to clean just one, or omit to clean all). It rewrites the brief + frames to remove the dangling references.",
      ].join("\n");
    })();

    const systemPrompt = [
      "You are a creative production assistant editing a storyboard.",
      "Use the provided tools to make changes — DON'T just describe what you'd do, actually do it via tool calls.",
      "",
      "PROJECT VOCABULARY (so you understand what the user is referring to):",
      "- The 'Brief' (or 'the brief', 'treatment', 'creative brief') is the project's top-level prose description of the spot. It lives at `meta.treatment` in state and is shown to the user in the 'Brief' panel at the top of the workshop. The Brief panel has its own Save → audit → regenerate flow, so you generally should NOT edit it via update_meta unless the user explicitly asks you to rewrite the brief; for everything else, propose changes to the talent / locations / products / frames that the brief implies.",
      "- 'Frames' (or 'shots', 'storyboard') are individual storyboard images — each has its own brief field describing that shot.",
      "- 'Talent' / 'Characters' / 'Cast' = `talent[]`. 'Locations' / 'Settings' = `locations[]`. 'Products' / 'Elements' / 'Hero items' = `products[]`.",
      "- 'Brand' = `brand` (singular): the client's logo, URL, guidelines.",
      "",
      "Tool selection guide — you can drive EVERYTHING on the left from chat:",
      "- Create: create_talent / create_location / create_product (these also generate the reference image by default); add_mood; add_frame.",
      "- Edit fields: update_talent / update_location / update_product / update_frame_brief / update_frame_shot_type / update_frame_camera / update_meta / update_brand / update_mood.",
      "- Images: generate_asset_image (talent/location/product), generate_frame_image, generate_mood_image.",
      "- Remove: delete_frame / delete_talent / delete_location / delete_product / delete_mood. Reorder: reorder_frames.",
      "- Protect from regeneration: toggle_section_lock / toggle_asset_lock.",
      "- Mood-board items have no name — reference them by 1-based index (see moodBoard in the state).",
      "",
      "What's IN a shot vs. a subject's permanent identity — IMPORTANT (most common mistake):",
      "- A request about what a FRAME depicts — who is where, their pose / action / expression, 'swap the two people', 'move X to the left', 'have her stand up', 'put the can in his other hand' — is a FRAME edit. Use update_frame_brief to rewrite THAT frame's description so it reflects the change. ACTUALLY change the wording — for a swap, exchange the two people's names / positions in the sentence (e.g. '@A leans back as @B gestures beside him' → '@B leans back as @A gestures beside her'); NEVER resubmit the brief unchanged. The system automatically regenerates the frame image after a content edit, so your job is to get the new brief text right — you don't need to call generate_frame_image yourself for frame edits.",
      "- update_talent / update_location / update_product change a subject's PERMANENT identity across the ENTIRE project (name, role, appearance note). NEVER use them for per-shot composition. e.g. 'swap the woman and the man' in a frame = rewrite that frame's brief so their positions/actions swap + regenerate the frame — it is NOT a talent edit.",
      "- Rule of thumb: whenever you change what something should LOOK like, regenerate the matching image (generate_frame_image / generate_asset_image) in the same turn. An edit with no regenerate looks to the user like nothing happened.",
      "",
      "TRACKED ASSET vs SCENE/FRAMING — decide this on EVERY add (and remove) request:",
      "- A tracked ASSET (create_talent / create_product / create_location) is for a SINGULAR, RECURRING IDENTITY that must look CONSISTENT across shots and that the user will want to see and edit on its own — a named person, the HERO product the spot is selling, a specific place. Each asset generates ONE reference image and is identity-locked into every frame that mentions it.",
      "- SCENE / FRAMING is for a MULTIPLICITY or SET DRESSING — a crowd, a wall / shelf / row of something, background fill, atmosphere — where you WANT variety or it's simply part of the environment. Do NOT create an asset for these. Instead weave them into the relevant shots with update_frame_brief (and/or the brief). Making them an asset would wrongly generate a single studio shot and lock one instance into a scene that needs many.",
      "  SCENE examples (NOT an asset): 'add a dozen background extras at the party' → update_frame_brief on the wide / medium shots to add a lively background crowd. 'show rows of Pepsi on grocery shelving' → update_frame_brief to add aisle shelving stacked with Pepsi cans receding down the row. Also: cars filling a parking lot, people in the pool, a cheering crowd.",
      "  ASSET examples: 'add a friend named Leo' → create_talent. 'the hero Pepsi can' → create_product. 'a rooftop bar location' → create_location.",
      "  Quick tell: 'a' / 'the' (one hero you'll track) → asset; 'a bunch of' / 'rows of' / 'a crowd of' / 'in the background' (many / fill) → scene/framing.",
      "- WHEN IT'S GENUINELY AMBIGUOUS which way a request should go (it could reasonably be a tracked item OR scene dressing), DON'T silently guess: state your interpretation + the plan in your reply and call suggest_followups with the options as tappable choices — e.g. 'Weave a background crowd into the wide + medium shots' vs 'Create a tracked \"Party Goers\" character instead' — and DON'T make the change until they pick one. Clear requests still just execute (the user has undo).",
      "",
      "Deletions apply immediately (the user has undo), so only delete when the user clearly asks to remove something — don't infer a delete from an edit request.",
      "You may emit MULTIPLE tool calls in one turn — e.g. 'make every shot a close-up' → one update_frame_shot_type per frame; 'remove all the extra characters' → multiple delete_talent.",
      "",
      "When creating a character: keep the `note` field to APPEARANCE only (age range, ethnicity, build, hair color/length, wardrobe). Do NOT put expression / pose / mood directions in the note — those bias every generated frame. The system will neutralize them but it's better not to add them.",
      "Each character has a ROLE: 'Lead' (hero — most screen time, appears across the storyboard, the focal/foreground subject when in a shot), 'Supporting' (secondary presence), or 'Extra' (background / incidental, rarely the focus). Respect roles when building or rebalancing the storyboard and the brief: give Leads prominence and frequency, keep Extras in the background. To change a character's importance, set its role via update_talent (field 'role', value 'Lead' | 'Supporting' | 'Extra').",
      "Each element / prop has a FOCUS level (same idea as character roles, for hero products): 'High' (feature it prominently — very visible, often a close-up that showcases it), 'Medium' (clearly present and an important part of the scene, not the main focus), or 'Low' (present as a supporting detail, not featured). Weight elements accordingly when building the storyboard — a High-focus product should get a hero/close-up shot. Set it via update_product (field 'focus', value 'High' | 'Medium' | 'Low').",
      "",
      "BE A COLLABORATOR, NOT JUST A COMMAND RUNNER (this matters):",
      "- Clear request → just do it (the user has undo), then briefly say what you changed.",
      "- AMBIGUOUS or under-specified request (you'd have to guess which frame/character, or key info is missing) → DON'T guess. Ask ONE short clarifying question in your reply, and call suggest_followups with the 2-3 likely answers as tappable options. Don't make edits in that turn.",
      "- HUGE or hard-to-undo request ('regenerate everything', 'delete all frames', 'start over') → confirm intent first in your reply + offer the confirm via suggest_followups (e.g. 'Yes, regenerate all 8 frames'); don't fire it until they confirm.",
      "- ALWAYS finish a turn by calling suggest_followups with 1-3 specific next steps that build on what just happened — proactively propose what a creative director might do next (add a complementary shot, set a lead, reconcile a new element, vary an angle). Phrase each as the exact first-person prompt that runs if tapped. This is the single most important habit: every reply should leave the user with tappable next moves.",
      "",
      "Prefer specific, narrow edits — change one item at a time when possible, change every item only when the user explicitly asks for that scope ('all frames', 'every shot', etc.).",
      focusLine,
      "After making changes, briefly explain what you changed in 1-2 sentences. Don't restate every tool call.",
      "",
      "THE CURRENT BRIEF (meta.treatment):",
      currentData.meta?.treatment || "(no brief written yet)",
      reconcileNote,
      orphanNote,
      "",
      "Current project state (JSON):",
      JSON.stringify(stateSnap, null, 2),
    ].join("\n");

    const history = [
      { role: "system", content: systemPrompt },
      ...chatMessages.filter(m => m.role === "user" || m.role === "ai").map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: text },
    ];

    try {
      const { text: replyText, actions } = await chatWithTools(history, V2_CHAT_TOOLS);

      const applied = [];
      const highlights = new Set();
      const effects = [];
      const suggestions = [];
      for (const action of (actions || [])) {
        const result = applyChatToolCall(action, currentData, dispatch);
        if (result?.applied) applied.push(result);
        if (result?.frameId) highlights.add(result.frameId);
        if (result?.effect) effects.push(result.effect);
        if (result?.suggestions) suggestions.push(...result.suggestions);
      }
      if (highlights.size > 0) setHighlightedFrames(highlights);

      // Auto-regenerate any frame whose CONTENT changed (brief / shot type /
      // camera) so the image actually updates. The model is unreliable at
      // chaining generate_frame_image itself, so an applied frame edit with no
      // regenerate looks to the user like nothing happened. Skip frames the
      // model already queued for regeneration.
      const regenIds = new Set(effects.filter(e => e.type === "generateFrameImage").map(e => e.frameId));
      for (const a of applied) {
        if (a.kind === "frame" && a.frameId && !regenIds.has(a.frameId)
            && !["added", "deleted", "reordered", "regenerating"].includes(a.field)) {
          effects.push({ type: "generateFrameImage", frameId: a.frameId, promptOverride: null });
          regenIds.add(a.frameId);
        }
      }

      const summary = replyText
        || (applied.length > 0 ? `Applied ${applied.length} change${applied.length === 1 ? "" : "s"}.` : "I'm not sure what to change here — try being more specific.");
      const regenNote = regenIds.size > 0 ? " Regenerating the frame image…" : "";

      setChatMessages(prev => [...prev, {
        id: Date.now(),
        role: "ai",
        text: summary + regenNote,
        changes: applied.map(a => ({ type: a.kind, id: a.frameId, field: a.field, label: a.message })),
        suggestions: suggestions.slice(0, 3),
      }]);

      // Fire async side-effects (image generation for newly created
      // assets, etc). Each effect resolves against the latest data
      // via dataRef, so it sees the asset the reducer just added.
      if (effects.length > 0) {
        // BULK gate: if the chat is about to generate 2+ images, confirm first
        // (Flow-style). A single image (the common edit→regen) stays instant.
        // Non-image effects (e.g. reconcile) always run.
        const GEN_EFFECTS = new Set(["generateTalentPrimary", "generateLocationImage", "generateProductImage", "generateFrameImage", "generateMoodImage"]);
        const genCount = effects.filter(e => GEN_EFFECTS.has(e.type)).length;
        let toRun = effects;
        if (genCount >= 2) {
          const ok = await confirmGeneration({ count: genCount, label: `The chat is about to generate ${genCount} images.` });
          if (!ok) toRun = effects.filter(e => !GEN_EFFECTS.has(e.type));
        }
        if (toRun.length) {
          // Give React a tick to flush the dispatches so dataRef updates.
          await new Promise(r => setTimeout(r, 50));
          for (const eff of toRun) {
            runChatEffect(eff).catch(e => console.error("[chat effect]", eff.type, e));
          }
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
  }, [data, chatMessages, chatAssetContext]);

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

  // Clicking any asset tile selects it for the chat (shows its thumbnail +
  // context card on the right and opens the chat) AND still drills into the
  // detail editor (the tile's own onClick handles that). `type` is the chat
  // context type: "talent" | "product" | "location".
  const handleFocusAsset = useCallback((type, id) => {
    if (!type || !id) return;
    // Focus the asset for chat context, but don't auto-open the chat panel —
    // navigating into a card shouldn't surface the chat.
    setChatAssetContext({ type, id });
    setSelectedFrameId(null); // focusing an asset clears any frame focus
  }, []);

  const handleFocusChat = useCallback(() => {
    setSidebarOpen(true);
    setChatFocusTrigger(prev => prev + 1);
  }, []);

  // Pending frame edits — when the user changes a frame control (shot type,
  // height, lens, movement, location, description) in the ProductionView, we
  // stage a labelled bullet here so the chat shows "what changed" + a
  // Regenerate button. The control is applied to the frame data immediately;
  // this just tracks that the IMAGE needs regenerating to match. Keyed by
  // field (one bullet per field). Resets on frame switch and after regen.
  const [pendingFrameEdits, setPendingFrameEdits] = useState({});
  useEffect(() => { setPendingFrameEdits({}); }, [productionFrameId]);
  const handleStageFrameChange = useCallback((field, label) => {
    setPendingFrameEdits(prev => ({ ...prev, [field]: label }));
    setSidebarOpen(true); // surface the chat so the Regenerate button is visible
  }, []);
  const handleRegenerateFrameEdits = useCallback(() => {
    const fid = productionFrameId;
    setPendingFrameEdits({});
    if (fid) regenerateOneFrame(fid).catch(e => console.error("[regen pending edits]", e));
  }, [productionFrameId]);

  // Any image generation in flight → drives the chat's "working" spinner.
  const anyRegenerating = useAnyPending();

  // Left-rail nav — clicking a tab selects it; clicking the ALREADY
  // active tab fires a "ww-asset-tab-reset" event so any drilled-in
  // detail view (CharacterDetailView, LocationDetailView, etc.) can
  // listen and pop back to its tile grid. Matches Logan's request
  // that clicking the tab name returns to the grid.
  const handleToggleAssetTab = useCallback((tabKey) => {
    // The left-rail nav must work from anywhere. If we're in a frame's
    // ProductionView, return to the One-Sheet first — otherwise we'd only
    // change off-screen state and nothing would visibly happen.
    setProductionFrameId(null);
    setSelectedFrameId(null);
    setChatAssetContext(null);
    setAssetTabOpen(prev => {
      if (prev === tabKey) {
        window.dispatchEvent(new CustomEvent("ww-asset-tab-reset", { detail: { tab: tabKey } }));
      }
      return tabKey;
    });
    // Once the One-Sheet has rendered, scroll the asset rail into view so
    // clicking a section actually takes you to that section.
    setTimeout(() => {
      document.getElementById("ww-asset-rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
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
      minHeight: "100dvh", fontFamily: "var(--f)", color: "var(--warm)",
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
        @keyframes spin { to { transform: rotate(360deg) } }
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

      {!built && <HomeBackground mode="orange" />}
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

      <div style={{ display: "flex", height: "100dvh", minHeight: 0, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Left: project sidebar. On mobile it collapses to an off-canvas
            drawer (hamburger + backdrop) so the homepage gets full width
            on a phone — Ravi's offsite flag. One instance, conditionally
            wrapped, so props aren't duplicated. */}
        {(() => {
          // Fixed sidebar only when inside a project on desktop. On the create
          // screen (and on mobile) the project nav floats over the background,
          // opened from a top-left dropdown pill — per the Figma homescreen.
          const useFloating = isMobile || !built;
          const sb = (
            <ProjectSidebar
              floating={useFloating}
              homeBackdrop={!built}
              mode={built && activeProjectId ? "project" : "root"}
              projects={[DEMO_PROJECT_META, ...projects.filter(p => p.id !== DEMO_PROJECT_META.id)]}
              folders={folders}
              activeProjectId={activeProjectId}
              activeProjectTitle={data.meta?.title || "Untitled"}
              activeAssetTab={assetTabOpen === "brand" ? "settings" : assetTabOpen}
              onAssetTabChange={handleToggleAssetTab}
              onBackToProjects={() => { handleBackToProjects(); setMobileNavOpen(false); }}
              assetCounts={{
                settings: data.brand?.logo ? 1 : 0,
                talent: data.talent.length,
                products: data.products.length,
                locations: data.locations.length,
                mood: (data.moodBoard || []).length,
              }}
              reconcileFlags={reconciliation.bySection}
              onSwitch={(id) => { switchToProject(id); setMobileNavOpen(false); }}
              onNew={() => { startNewProject(); setMobileNavOpen(false); }}
              onHome={() => { handleBackToProjects(); setMobileNavOpen(false); }}
              onDelete={handleDeleteProject}
              onRename={handleRenameProject}
              onMoveToFolder={handleMoveToFolder}
              onNewFolder={handleNewFolder}
              onDeleteFolder={handleDeleteFolder}
              onCleanupDuplicates={handleCleanupDuplicates}
              onRenameFolder={handleRenameFolder}
            />
          );
          if (!useFloating) return sb;
          return (
            <>
              {/* Top-left dropdown pill — opens the project nav as a floating
                  panel over the background instead of a fixed sidebar. */}
              <button
                aria-label="Projects menu"
                onClick={() => setMobileNavOpen(o => !o)}
                style={{ position: "fixed", top: 12, left: 16, zIndex: 220, display: "inline-flex", alignItems: "center", gap: 9, height: 44, padding: "0 12px 0 11px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,7,7,0.6)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", color: "var(--warm)", cursor: "pointer", outline: "none", boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }}
              >
                <WLogo color="rgba(224,224,224,0.9)" size={20} />
                <span aria-hidden="true" style={{ width: 1, height: 18, background: "rgba(255,255,255,0.14)" }} />
                <DropdownAssetIcon src={iconFolderUrl} size={15} />
                <span style={{ fontFamily: "var(--f)", fontSize: 14, fontWeight: 500 }}>Projects</span>
                <SectionIcon name="chevron-down" size={13} color="var(--warm-50)" />
              </button>
              {mobileNavOpen && (
                <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />
              )}
              <div style={{ position: "fixed", top: 64, left: 16, zIndex: 201, width: 272, height: "min(620px, calc(100dvh - 84px))", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: mobileNavOpen ? "0 24px 60px rgba(0,0,0,0.55)" : "none", transform: mobileNavOpen ? "translateY(0)" : "translateY(-10px)", opacity: mobileNavOpen ? 1 : 0, pointerEvents: mobileNavOpen ? "auto" : "none", transition: "opacity 0.18s ease, transform 0.18s ease" }}>
                {sb}
              </div>
            </>
          );
        })()}

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
          {/* Secondary controls are hidden on mobile — the floating Projects pill
              owns the top-left there, and aspect/length/save would overlap it. */}
          {built && !isMobile && <>
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
            {!isMobile && (
              <>
                <PremiumButton variant="ghost" onClick={() => dispatch({ type: "UNDO" })} disabled={past.length === 0} style={{ padding: "5px 8px", fontSize: 14 }} title="Undo (Ctrl+Z)">{"↩"}</PremiumButton>
                <PremiumButton variant="ghost" onClick={() => dispatch({ type: "REDO" })} disabled={future.length === 0} style={{ padding: "5px 8px", fontSize: 14 }} title="Redo (Ctrl+Shift+Z)">{"↪"}</PremiumButton>
                <div style={{ width: 1, height: 14, background: "var(--warm-08)", margin: "0 6px" }} />
              </>
            )}

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

      {/* Breadcrumbs — a persistent "go up a level" trail so it's always easy to
          get back after drilling in. "All Projects" → the project list; the
          project name → out of a frame's production view. */}
      {built && (() => {
        const prodFrame = productionFrameId ? data.frames.find(f => f.id === productionFrameId) : null;
        const link = (label, onClick) => (
          <button
            type="button"
            onClick={onClick}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--warm-35)", fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, outline: "none", whiteSpace: "nowrap" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--warm)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--warm-35)"; }}
          >{label}</button>
        );
        const current = label => (
          <span style={{ color: "var(--warm-60)", fontFamily: "var(--f)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        );
        const sep = <span aria-hidden="true" style={{ color: "var(--warm-15)", fontSize: 12 }}>{"›"}</span>;
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0,
            padding: isMobile ? "8px 14px" : "6px 24px",
            borderBottom: "1px solid var(--warm-04)",
          }}>
            {link("All Projects", () => handleBackToProjects())}
            {sep}
            {prodFrame ? (
              <>
                {link(data.meta?.title || "Untitled", () => setProductionFrameId(null))}
                {sep}
                {current(`Frame ${prodFrame.number}`)}
              </>
            ) : (
              current(data.meta?.title || "Untitled")
            )}
          </div>
        );
      })()}

      {/* Mobile section switcher — Characters / Elements / Locations / Mood /
          Project Settings as a scrollable row of tappable pills. On desktop these
          live in the left sidebar; on a phone they belong across the top. */}
      {built && isMobile && (
        <div style={{
          display: "flex", gap: 6, overflowX: "auto", flexShrink: 0,
          padding: "8px 12px", borderBottom: "1px solid var(--warm-06)",
          background: "rgba(10,9,9,0.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          scrollbarWidth: "none",
        }}>
          {PROJECT_SECTION_TABS.map(tab => {
            const active = (assetTabOpen === "brand" ? "settings" : assetTabOpen) === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleToggleAssetTab(tab.key)}
                style={{
                  flexShrink: 0, padding: "7px 14px", borderRadius: 999,
                  border: `1px solid ${active ? "rgba(255,255,255,0.28)" : "var(--warm-10)"}`,
                  background: active ? "rgba(255,255,255,0.13)" : "transparent",
                  color: active ? "var(--warm)" : "var(--warm-50)",
                  fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
                  whiteSpace: "nowrap", cursor: "pointer", outline: "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

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
              onFocusAsset={handleFocusAsset}
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
              onStageChange={handleStageFrameChange}
              onRegenerateFrame={regenerateOneFrame}
            />
          )}
        </main>

        {/* Sidebar -- always AI Chat */}
        {built && (
          <div style={isMobile ? {
            // Mobile: a full-screen overlay when open, and removed from the flow
            // when closed — so the one-sheet gets the full width instead of being
            // crushed by a 380px panel on a ~390px screen.
            position: "fixed", inset: 0, zIndex: 300,
            display: sidebarOpen ? "block" : "none",
            background: "rgba(10,9,9,0.97)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          } : {
            width: sidebarOpen ? 380 : 0, flexShrink: 0, overflow: "hidden",
            borderLeft: sidebarOpen ? "1px solid var(--warm-06)" : "none",
            background: "transparent",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            transition: "width 0.35s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <div style={{ width: isMobile ? "100%" : 380, height: "100%" }}>
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
                  pendingFrameEdits={pendingFrameEdits}
                  onRegeneratePending={handleRegenerateFrameEdits}
                  regenerating={anyRegenerating}
                  reconcileCount={reconciliation.count}
                  onReconcileAll={() => requestReconcile({ scope: "all" })}
                  orphanCount={orphans.count}
                  onCleanupOrphans={() => requestReconcile({ mode: "cleanup" })}
                />
              </SidebarPanel>
            </div>
          </div>
        )}

        {/* Floating AI Chat tab — right edge when sidebar closed */}
        {built && <AIChatTab sidebarOpen={sidebarOpen} onClick={() => setSidebarOpen(true)} />}

        {/* Reconcile preview — assets missing from the brief/storyboard */}
        <ReconcileModal
          state={reconcile}
          frames={data.frames}
          onClose={() => setReconcile(null)}
          onApply={applyReconcile}
        />
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
