// Maps the v1 brief shape (what generateBrief returns) onto the v2 data
// shape that v2/Workshop.jsx's reducer expects. This is the bridge that
// lets v2's UI run on the real Gemini-generated brief instead of mock
// INITIAL_STATE. Pure function; no side effects.

function autoHandle(name) {
  return "@" + (name || "").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

function initialsFrom(name) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]).join("").toUpperCase() || "??";
}

// v1's framing tokens (EWS/WS/MS/CU/ECU/OTS/POV) → v2's wider set
// (WIDE/MED/MCU/CU/ECU/OTS/POV/INSERT). Lossy on the wide end (we
// collapse EWS→WIDE) but preserves the intent.
function mapFraming(v1) {
  const map = { EWS: "WIDE", WS: "WIDE", MS: "MED", CU: "CU", ECU: "ECU", OTS: "OTS", POV: "POV" };
  return map[v1] || "MED";
}

// v1 camera string ("Steadicam", "Drone", "Handheld" ...) → v2 movement
// + height fields. v2 also derives the camera caption from movement +
// height (deriveCameraText in Workshop.jsx).
function mapMovement(v1) {
  const s = (v1 || "").toLowerCase();
  if (s.includes("drone") || s.includes("crane")) return "crane";
  if (s.includes("steadi")) return "steadicam";
  if (s.includes("hand")) return "handheld";
  if (s.includes("gimbal")) return "track";
  if (s.includes("tripod") || s.includes("static")) return "static";
  return "static";
}

// "30s" / "30" / "30 seconds" → "30"
function extractDurationSeconds(v1Duration) {
  if (!v1Duration) return "30";
  const match = String(v1Duration).match(/(\d+)/);
  return match ? match[1] : "30";
}

// "16:9" stays "16:9"; "2.39:1" → "2.39"; default fallback "16:9".
function normalizeAspect(v1Format) {
  if (!v1Format) return "16:9";
  const s = String(v1Format).trim();
  if (/^\d+:\d+$/.test(s)) return s;
  if (/^\d+\.\d+/.test(s)) return s.split(":")[0];
  return "16:9";
}

// Talent = v1 primary character + v1 characters array. First entry is
// the "Lead" role; rest are "Supporting". @-handles taken from the v1
// name field directly (autoHandle strips spaces / non-alphanumerics).
function assembleTalent(brief) {
  const items = [];
  if (brief?.character?.name) {
    items.push({
      v1: brief.character,
      role: "Lead",
    });
  }
  for (const c of (brief?.characters || [])) {
    if (c?.name) items.push({ v1: c, role: "Supporting" });
  }
  return items.map((t, i) => ({
    id: `t${i + 1}`,
    name: t.v1.name,
    handle: autoHandle(t.v1.name),
    role: t.role,
    initials: initialsFrom(t.v1.name),
    note: [t.v1.description, t.v1.wardrobe].filter(Boolean).join(" — "),
    // Reference slot — the "hero" image users see in the character tile.
    // Carries forward as the primary tile thumbnail.
    headshot: null,
    // Per-view image slots, matching v1's Character Design section
    // (FRONT / SIDE / 3-4 ANGLE / BACK for both headshots and full body).
    // Drill-down detail view renders one V2ImageSlot per view.
    headshots: { front: null, side: null, threeQuarter: null, back: null },
    fullBody: { front: null, side: null, threeQuarter: null, back: null },
    generatedAngles: null,
    generationStatus: "idle",
    // Per-character lock (third tier in v1's slot/character/section
    // model). Toggled from the LOCK CHARACTER button in detail view.
    locked: false,
  }));
}

// Locations = v1 primary environment + v1 environments array.
// v1's heroEnvironment is the visual description; heroName is the
// short name. Loses shotRoute + keyElements (no analogue in v2).
function assembleLocations(brief) {
  const items = [];
  if (brief?.environment?.heroName || brief?.environment?.heroEnvironment) {
    items.push(brief.environment);
  }
  for (const e of (brief?.environments || [])) {
    if (e?.heroName || e?.heroEnvironment) items.push(e);
  }
  return items.map((e, i) => ({
    id: `l${i + 1}`,
    name: e.heroName || `Location ${i + 1}`,
    handle: autoHandle(e.heroName || `loc${i + 1}`),
    type: "ai",
    colors: ["#444", "#555", "#666", "#777"],
    note: e.heroEnvironment || "",
    referenceImage: null,
    generationStatus: "idle",
    generatedImage: null,
    locked: false,
  }));
}

function assembleProducts(brief) {
  return (brief?.productElements || []).map((p, i) => ({
    id: `p${i + 1}`,
    name: p.name || `Element ${i + 1}`,
    handle: autoHandle(p.name || `el${i + 1}`),
    category: "Product",
    hue: "#888888",
    note: p.description || "",
    referenceImage: null,
    generationStatus: "idle",
    locked: false,
  }));
}

// "3s" or "3" or "3 sec" → "3s". Normalizes the v1 brief's duration
// string so v2 always displays consistently.
function normalizeDuration(v) {
  if (!v) return "3s";
  const match = String(v).match(/(\d+(?:\.\d+)?)/);
  return match ? `${match[1]}s` : "3s";
}

// Shotlist → frames. Auto-detection of @handles into talentIds /
// locationId / productIds happens via the AUTO_DETECT_MENTIONS reducer
// action after the data lands (already wired in Workshop.jsx).
function assembleFrames(brief) {
  const shots = brief?.shotList || [];
  return shots.map((s, i) => {
    const movement = mapMovement(s.camera);
    const heightFromShot = movement === "crane" ? "high" : "eye";
    return {
      id: `f${i + 1}`,
      number: s.num || String(i + 1).padStart(2, "0"),
      shotType: mapFraming(s.framing),
      // camera caption gets re-derived by UPDATE_FRAME_CAMERA — set a
      // sensible default here so the UI has something to show before
      // any edit.
      camera: s.camera || "Static",
      brief: s.description || "",
      // Per-shot duration. Sum of these = project total duration.
      duration: normalizeDuration(s.duration),
      talentIds: [],
      locationId: null,
      productIds: [],
      cameraAngle: "front",
      cameraHeight: heightFromShot,
      lens: "normal",
      movement,
      imageStatus: "placeholder",
      uploadedImage: null,
    };
  });
}

// MAIN: v1 brief object → v2 data state. Idempotent; safe to call
// multiple times. Missing fields fall back to sensible defaults so
// partial briefs still render.
export function v1BriefToV2Data(brief) {
  const cd = brief?.creativeDirection || {};
  const pi = brief?.projectInfo || {};
  return {
    meta: {
      title: pi.projectName || brief?.title || "Untitled",
      client: pi.clientName || cd.brand || "",
      format: extractDurationSeconds(cd.duration),
      aspect: normalizeAspect(cd.format || brief?.generationSettings?.ratio),
      treatment: cd.description || cd.keyMessage || "",
    },
    talent: assembleTalent(brief),
    products: assembleProducts(brief),
    locations: assembleLocations(brief),
    brand: {
      name: cd.brand || pi.brandCampaignName || pi.clientName || "",
      url: brief?.brandInfo?.sourceUrl || "",
      logo: brief?.brandInfo?.logoUrl || null,
      guidelines: brief?.brandInfo?.rules || "",
    },
    // v1 strips moodBoard/environments per Ed's UX rule (users add via
    // buttons), so brief.moodBoard is usually missing — keep v2's
    // moodBoard array but seed it empty so the user adds mood refs.
    moodBoard: (brief?.moodBoard || []).map((m, i) => ({
      id: m.id || `m${i + 1}`,
      caption: m.caption || "",
      image: m.image || null,
      generationStatus: "idle",
    })),
    frames: assembleFrames(brief),
  };
}
