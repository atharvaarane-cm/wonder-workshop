// Production Lab — PROTOTYPE (flag-gated via ?mode=production).
//
// A Studio-Tools-style "production mode": a small library of task tools over ONE
// runner (centered card = source pills + dropzone/prompt + config), reusing
// Workshop's live engine (generateImage / upscaleImage = Nano Banana Pro; Veo for
// video). Layout + visual system transcribed from studiotools.ai. Dark theme is
// the default (Workshop-native); a light skin (StudioTools' look) toggles in the
// account menu. Honest about what's wired: image/enhance/video + history are real;
// the credits chip is a cosmetic preview (generation isn't metered).

import { useEffect, useRef, useState } from "react";
import { generateImage, upscaleImage } from "./imageGen.js";
import { hasSupabase } from "./supabaseClient.js";
import { saveProductionAsset, listProductionAssets, deleteProductionAsset, downloadUrl } from "./productionAssets.js";

/* ------------------------------------------------------------------ config */

const MODELS = [
  { id: "nbp", label: "Nano Banana Pro", tag: "Recommended" },
];
const RATIOS = [
  { id: "1:1", label: "1:1 · Square" },
  { id: "4:5", label: "4:5 · Portrait" },
  { id: "9:16", label: "9:16 · Story" },
  { id: "16:9", label: "16:9 · Widescreen" },
  { id: "4:3", label: "4:3 · Standard" },
  { id: "21:9", label: "21:9 · Ultra-wide" },
];
const RESOLUTIONS = [
  { id: "1K", label: "1K" },
  { id: "2K", label: "2K" },
  { id: "4K", label: "4K · upscaled" },
];
const VIDEO_RATIOS = [
  { id: "16:9", label: "16:9 · Landscape" },
  { id: "9:16", label: "9:16 · Vertical" },
];
const VIDEO_RES = [{ id: "720p", label: "720p" }, { id: "1080p", label: "1080p" }];
const VIDEO_DURATIONS = [{ id: "4", label: "4s" }, { id: "6", label: "6s" }, { id: "8", label: "8s" }];

const DIRECTOR_PREAMBLE =
  "Professional commercial photograph, art-directed for marketing: clean composition, " +
  "intentional lighting, premium styling, photorealistic, high detail. ";

// AI Art Director = a real LLM rewrite (gemini-2.5-flash via /api/chat). It turns a
// rough brief into a structured, production-grade prompt so the user doesn't have
// to prompt-engineer. Falls back to the static preamble above if the call fails.
function imageDirectorSystem(hasRefs) {
  return (
    "You are an elite commercial-photography art director. Rewrite the user's brief into ONE " +
    "vivid, production-ready image-generation prompt for a marketing asset. Structure it as " +
    "Subject → Action/Pose → Setting → Style → Lighting → Lens/Technical → Quality. Be concrete " +
    "and tasteful and imply a premium, brand-safe commercial finish. Output ONLY the final prompt " +
    "as plain text — no preamble, no quotes, no bullet points, no explanation. Under 90 words." +
    (hasRefs
      ? " A reference product image is provided: the product must be reproduced EXACTLY — identical " +
        "shape, colour, logo, label text, materials and proportions. Only the surrounding scene, " +
        "surface and lighting may change; never redesign the product."
      : "")
  );
}
const VIDEO_DIRECTOR_SYSTEM =
  "You are a commercial film director. Rewrite the user's idea into ONE concise cinematic " +
  "image-to-video motion prompt: describe camera movement, subject motion, pacing, and any " +
  "lighting/atmosphere shift, in one or two flowing sentences. Keep the product and scene " +
  "consistent with the source image. Output ONLY the final prompt as plain text — no preamble, " +
  "no quotes, no explanation. Under 50 words.";

async function directPrompt(system, userPrompt) {
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt || "(no text brief — use the attached reference image as the subject)" },
    ] }),
  });
  if (!res.ok) throw new Error("art-director call failed");
  const out = ((await res.json())?.message?.content || "").trim();
  if (!out) throw new Error("empty art-director response");
  return out;
}
const PRESERVE =
  " CRITICAL: reproduce any uploaded product/reference EXACTLY — identical shape, colour, " +
  "logo, label text, materials and proportions. Do not redesign or restyle the product; " +
  "only change the surrounding scene, surface, and lighting.";
const VARIATIONS = [
  "", " Slightly different camera angle.", " Alternative lighting mood.",
  " Different background tone or surface.", " Tighter crop.", " Wider composition.",
];
const PROMPT_PRESETS = [
  { folder: "Scene", items: [
    { label: "Studio white · soft shadow", text: "On a seamless pure-white studio background with a soft natural contact shadow, even softbox lighting, centred." },
    { label: "Lifestyle · natural light", text: "In a warm, aspirational real-world lifestyle setting, soft window light, shallow depth of field, editorial styling." },
    { label: "Marketing hero · gradient", text: "On a smooth coloured gradient backdrop, dramatic studio lighting, glossy reflection, generous negative space for ad copy." },
    { label: "Outdoor · golden hour", text: "Outdoors in natural golden-hour daylight on an organic surface, gentle background bokeh, authentic and premium." },
  ] },
  { folder: "Edit", items: [
    { label: "Remove the background", text: "Remove the background entirely, place on a clean transparent / pure-white backdrop, keep the subject crisp." },
    { label: "Even studio lighting", text: "Re-light with even, soft, shadowless studio lighting; remove harsh reflections and hotspots." },
    { label: "Add a bokeh blur", text: "Add a shallow depth-of-field with a soft bokeh background blur behind the subject." },
    { label: "Remove text & graphics", text: "Remove any background text, watermarks, and graphic overlays; keep the product untouched." },
  ] },
];
const SAVED_KEY = "ww_prod_saved_prompts";
const THEME_KEY = "ww_prod_theme";
const CREDIT_COST = { image: 30, enhance: 100, video: 100 };

/* ------------------------------------------------------------------ themes */

const THEMES = {
  dark: {
    bg: "#0b0b0d", card: "#161618", panel: "#202024", panel2: "#26262b", line: "#2a2a30", line2: "#34343c",
    text: "#e8e8ea", dim: "#9a9aa2", faint: "#6c6c74", accent: "#6b8afd", accentInk: "#0b0b0d",
    grad: "linear-gradient(90deg,#6b8afd,#7c6bfd)", pillBg: "#e8e8ea", pillInk: "#0b0b0d",
  },
  light: {
    bg: "#F7F7F7", card: "#FFFFFF", panel: "#F0F0EF", panel2: "#F2F2F1", line: "#E5E7EB", line2: "#D1D5DB",
    text: "#161413", dim: "#6B7280", faint: "#9CA3AF", accent: "#F43F5E", accentInk: "#FFFFFF",
    grad: "linear-gradient(90deg,#E11D48,#F97316)", pillBg: "#161413", pillInk: "#FFFFFF",
  },
};
function themeVars(t) {
  const p = THEMES[t] || THEMES.dark;
  const out = {};
  for (const k of Object.keys(p)) out[`--${k}`] = p[k];
  return out;
}
const C = Object.fromEntries(Object.keys(THEMES.dark).map((k) => [k, `var(--${k})`]));

/* ------------------------------------------------------------------ helpers */

let _id = 0;
const nid = () => `${Date.now()}-${_id++}`;
async function runPool(tasks, concurrency, onResult) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try { onResult(idx, { status: "done", image: await tasks[idx]() }); }
      catch (e) { onResult(idx, { status: "error", error: e?.message || "Generation failed" }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}
function fileToDataUrl(file) {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file); });
}
function useIsMobile(bp = 760) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.innerWidth < bp : false));
  useEffect(() => {
    const onR = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [bp]);
  return m;
}

/* ------------------------------------------------------------------ root */

export default function ProductionLab() {
  const [tool, setToolRaw] = useState("image"); // image | video | reformat | enhance | history | uploads
  const [assets, setAssets] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [seed, setSeed] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; } });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!hasSupabase) return;
    setLoadingHistory(true);
    listProductionAssets().then(setAssets).catch((e) => console.error("[production] load history", e)).finally(() => setLoadingHistory(false));
  }, []);

  const setTool = (t) => { setSeed(null); setToolRaw(t); };
  const toggleTheme = () => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem(THEME_KEY, n); } catch { /**/ } return n; });

  async function saveAsset(params) {
    try { const row = await saveProductionAsset(params); if (row) setAssets((a) => [row, ...a]); return row; }
    catch (e) { console.error("[production] save asset", e); return null; }
  }
  async function removeAsset(id) { setAssets((a) => a.filter((x) => x.id !== id)); try { await deleteProductionAsset(id); } catch (e) { console.error(e); } }
  function editAsset(asset) { setSeed({ refs: [asset.url], prompt: asset.prompt || "", settings: asset.settings || {} }); setToolRaw(asset.tool === "video" ? "video" : "image"); }

  const imageGenerations = assets.filter((a) => a.kind === "image").map((a) => ({ id: a.id, image: a.url }));
  const addUpload = (image) => setUploads((u) => [{ id: nid(), image }, ...u]);
  const shared = { generations: imageGenerations, uploads, addUpload, saveAsset, seed, isMobile };

  return (
    <div style={{ ...S.app, ...themeVars(theme) }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" />
      <style>{"@keyframes wwspin{to{transform:rotate(360deg)}}"}</style>
      <Header tool={tool} setTool={setTool} historyCount={assets.length} theme={theme} onToggleTheme={toggleTheme} isMobile={isMobile} />
      <div style={S.body}>
        <div style={{ ...S.column, ...(isMobile ? S.columnM : {}) }}>
          {tool !== "history" && tool !== "uploads" && <ToolTabs tool={tool} setTool={setTool} isMobile={isMobile} />}
          {tool === "image" && <ImageTool {...shared} />}
          {tool === "enhance" && <EnhanceTool {...shared} />}
          {tool === "video" && <VideoTool {...shared} />}
          {tool === "reformat" && <ComingSoon title="Reformat Image" blurb="Outpaint an existing asset to a new aspect ratio for any channel. On the roadmap — not built yet." />}
          {tool === "history" && <GalleryPage title="My Generations" emptyLabel="No content found" emptySub="Create your first piece of content to get started" createLabel="Create New" onCreate={() => setTool("image")} items={assets} loading={loadingHistory} onEdit={editAsset} onDelete={removeAsset} cloud={hasSupabase} isMobile={isMobile} />}
          {tool === "uploads" && <GalleryPage title="My Uploads" emptyLabel="No uploads found" emptySub="Your uploaded source images appear here" createLabel="New Upload" onCreate={() => setTool("image")} items={uploads.map((u) => ({ id: u.id, kind: "image", url: u.image }))} loading={false} cloud isMobile={isMobile} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header */

const NAV_TOOLS = [
  { id: "image", label: "Create or Edit an Image" },
  { id: "video", label: "Convert Image to Video" },
  { id: "enhance", label: "Enhance or Upscale an Image" },
  { id: "reformat", label: "Reformat Image" },
];

function Header({ tool, setTool, historyCount, theme, onToggleTheme, isMobile }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (isMobile) {
    return (
      <div style={{ ...S.header, ...S.headerM }}>
        <div style={S.brand}><span style={S.brandMark}>◆</span> Workshop</div>
        <div style={{ position: "relative" }}>
          <button style={S.acct} onClick={() => setMenuOpen((v) => !v)}>☰</button>
          {menuOpen && (
            <div style={{ ...S.menu, right: 0, left: "auto" }} onMouseLeave={() => setMenuOpen(false)}>
              {NAV_TOOLS.map((t) => <button key={t.id} style={S.menuItem} onClick={() => { setTool(t.id); setMenuOpen(false); }}>{t.label}</button>)}
              <div style={S.menuSep} />
              <button style={S.menuItem} onClick={() => { setTool("history"); setMenuOpen(false); }}>My Generations{historyCount ? ` (${historyCount})` : ""}</button>
              <button style={S.menuItem} onClick={() => { setTool("uploads"); setMenuOpen(false); }}>My Uploads</button>
              <div style={S.menuSep} />
              <button style={S.menuItem} onClick={() => { onToggleTheme(); setMenuOpen(false); }}>{theme === "dark" ? "☀ Switch to light" : "☾ Switch to dark"}</button>
              <a style={S.menuItem} href="?">← Back to Workshop</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.header}>
      <div style={S.brand}><span style={S.brandMark}>◆</span> Workshop<span style={S.brandSub}>.production</span></div>
      <div style={S.nav}>
        <div style={{ position: "relative" }}>
          <button style={S.navItem} onClick={() => setToolsOpen((v) => !v)}>Studio Tools ⌄</button>
          {toolsOpen && (
            <div style={S.menu} onMouseLeave={() => setToolsOpen(false)}>
              {NAV_TOOLS.map((t) => (
                <button key={t.id} style={S.menuItem} onClick={() => { setTool(t.id); setToolsOpen(false); }}>{t.label}</button>
              ))}
            </div>
          )}
        </div>
        <button style={{ ...S.navItem, ...(tool === "history" ? S.navOn : {}) }} onClick={() => setTool("history")}>My Generations{historyCount ? ` (${historyCount})` : ""}</button>
        <button style={{ ...S.navItem, ...(tool === "uploads" ? S.navOn : {}) }} onClick={() => setTool("uploads")}>My Uploads</button>
      </div>
      <div style={S.headerRight}>
        <div style={S.creditChip} title="Cosmetic preview — generation isn't metered in this prototype.">
          <span style={S.creditNum}>0</span> credits <span style={S.addBtn}>＋ Add</span>
        </div>
        <div style={{ position: "relative" }}>
          <button style={S.acct} onClick={() => setAcctOpen((v) => !v)}>◍ Account ⌄</button>
          {acctOpen && (
            <div style={{ ...S.menu, right: 0, left: "auto" }} onMouseLeave={() => setAcctOpen(false)}>
              <button style={S.menuItem} onClick={() => { onToggleTheme(); setAcctOpen(false); }}>{theme === "dark" ? "☀ Switch to light" : "☾ Switch to dark"}</button>
              <a style={S.menuItem} href="?">← Back to Workshop</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = [{ id: "image", label: "Image" }, { id: "video", label: "Video" }];
const OPTIMIZE = [{ id: "reformat", label: "Reformat Image" }, { id: "enhance", label: "Enhance or Upscale" }];

function ToolTabs({ tool, setTool, isMobile }) {
  const [open, setOpen] = useState(false);
  const optActive = OPTIMIZE.some((o) => o.id === tool);
  const tabBase = { ...S.tab, ...(isMobile ? S.tabM : {}) };
  return (
    <div style={S.tabs}>
      {TABS.map((t) => (
        <button key={t.id} onClick={() => setTool(t.id)} style={{ ...tabBase, ...(tool === t.id ? S.tabOn : {}) }}>{t.label}</button>
      ))}
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen((v) => !v)} style={{ ...tabBase, ...(optActive ? S.tabOn : {}) }}>Optimize ⌄</button>
        {open && (
          <div style={S.menu} onMouseLeave={() => setOpen(false)}>
            {OPTIMIZE.map((o) => <button key={o.id} style={S.menuItem} onClick={() => { setTool(o.id); setOpen(false); }}>{o.label}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ source input (content only; tabs live in the card header) */

function SourceInput({ tab, value, onChange, max, generations, uploads, addUpload, isMobile }) {
  const inputRef = useRef(null);
  const panelH = isMobile ? { minHeight: 200 } : {};
  async function ingest(files) {
    const list = Array.from(files || []).filter((f) => f.type?.startsWith("image/"));
    const urls = await Promise.all(list.map(fileToDataUrl));
    urls.forEach((u) => addUpload(u));
    onChange([...value, ...urls].slice(0, max));
  }
  function onPaste(e) {
    const items = Array.from(e.clipboardData?.items || []).filter((i) => i.type.startsWith("image/"));
    if (items.length) ingest(items.map((i) => i.getAsFile()));
  }
  function pick(url) { onChange(value.includes(url) ? value.filter((u) => u !== url) : [...value, url].slice(0, max)); }
  const gallery = tab === "gen" ? generations : uploads.map((u) => ({ id: u.id, image: u.image }));

  return (
    <div style={S.dropCol} onPaste={onPaste}>
      {tab === "add" ? (
        <div style={{ ...S.dropzone, ...panelH }} onClick={() => inputRef.current?.click()}
             onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); ingest(e.dataTransfer.files); }}>
          <input ref={inputRef} type="file" accept="image/*" multiple={max > 1} style={{ display: "none" }} onChange={(e) => ingest(e.target.files)} />
          {value.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <div style={S.dropHint}>Drag &amp; drop images, paste, or <u>browse</u></div>
              <div style={S.dropSub}>{max > 1 ? `Add up to ${max} images as references` : "Add an image as reference"}</div>
            </div>
          ) : (
            <div style={S.refStrip}>
              {value.map((u, i) => (
                <div key={i} style={S.refChip}>
                  <img src={u} alt="" style={S.refImg} />
                  <button style={S.refX} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== u)); }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...S.pickWrap, ...panelH }}>
          {gallery.length === 0 ? <div style={S.emptySmall}>{tab === "gen" ? "No generations yet" : "No uploads yet"}</div> : (
            <div style={S.pickGrid}>
              {gallery.map((g) => (
                <button key={g.id} onClick={() => pick(g.image)} style={{ ...S.pickThumb, ...(value.includes(g.image) ? S.pickOn : {}) }}>
                  <img src={g.image} alt="" style={S.pickImg} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourcePills({ tab, setTab }) {
  return (
    <div style={S.pillRow}>
      {[["add", "Add"], ["gen", "My Generations"], ["up", "My Uploads"]].map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)} style={{ ...S.pill, ...(tab === id ? S.pillOn : {}) }}>{label}</button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ image tool */

function ImageTool({ generations, uploads, addUpload, saveAsset, seed, isMobile }) {
  const [tab, setTab] = useState("add");
  const [refs, setRefs] = useState(() => seed?.refs || []);
  const [prompt, setPrompt] = useState(() => seed?.prompt || "");
  const [ratio, setRatio] = useState(() => seed?.settings?.ratio || "1:1");
  const [resolution, setResolution] = useState(() => seed?.settings?.resolution || "2K");
  const [variants, setVariants] = useState(4);
  const [director, setDirector] = useState(true);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const canGo = (prompt.trim() || refs.length) && !busy;
  const cost = CREDIT_COST.image * variants * (resolution === "4K" ? 2 : 1);

  async function generate() {
    if (!canGo) return;
    setBusy(true);
    let base = prompt;
    if (director) {
      try { base = await directPrompt(imageDirectorSystem(refs.length > 0), prompt); }
      catch { base = DIRECTOR_PREAMBLE + prompt; } // fallback to static preamble
      if (refs.length) base += PRESERVE;
    }
    setResults(Array.from({ length: variants }, (_, i) => ({ id: i, status: "generating" })));
    const tasks = Array.from({ length: variants }, (_, i) => async () => {
      let img = await generateImage(`${base}${VARIATIONS[i % VARIATIONS.length]}`, { ratio, referenceImages: refs });
      if (resolution === "4K") { try { img = await upscaleImage(img, "4k", ratio); } catch { /**/ } }
      return img;
    });
    await runPool(tasks, 2, (idx, patch) => {
      setResults((prev) => prev.map((r) => (r.id === idx ? { ...r, ...patch } : r)));
      if (patch.status === "done") saveAsset({ kind: "image", dataUrl: patch.image, prompt, tool: "image", settings: { ratio, resolution } });
    });
    setBusy(false);
  }

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTop}>
          <SourcePills tab={tab} setTab={setTab} />
          <button style={S.libBtn} onClick={() => setLibOpen(true)}>▥ Prompt Library</button>
        </div>
        <div style={{ ...S.cardBody, ...(isMobile ? S.cardBodyM : {}) }}>
          <SourceInput tab={tab} value={refs} onChange={setRefs} max={8} generations={generations} uploads={uploads} addUpload={addUpload} isMobile={isMobile} />
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image you want to generate…" style={{ ...S.cardTextarea, ...(isMobile ? S.cardTextareaM : {}) }} />
        </div>
        <div style={S.cardFoot}>
          <button style={S.howBtn} onClick={() => setHowOpen(true)}>How It Works ?</button>
          <label style={S.toggleWrap}>
            <span style={director ? { ...S.toggle, ...S.toggleOn } : S.toggle}><span style={director ? { ...S.knob, ...S.knobOn } : S.knob} /></span>
            <input type="checkbox" checked={director} onChange={(e) => setDirector(e.target.checked)} style={{ display: "none" }} />
            <span style={S.toggleLabel}>AI Art Director</span>
          </label>
        </div>
      </div>

      <ConfigRow
        left={<>
          <Field label="Model"><div style={S.modelBox}>{MODELS[0].label}<span style={S.recBadge}>Recommended</span></div></Field>
          <Field label="Ratio"><Select value={ratio} onChange={setRatio} options={RATIOS} /></Field>
          <Field label="Resolution"><Select value={resolution} onChange={setResolution} options={RESOLUTIONS} /></Field>
        </>}
        variants={variants} setVariants={setVariants} cost={cost} busy={busy} canGo={canGo} onGenerate={generate} isMobile={isMobile}
      />
      <Results results={results} />

      {libOpen && <PromptLibrary onPick={(t) => { setPrompt((p) => (p ? p + " " : "") + t); setLibOpen(false); }} onClose={() => setLibOpen(false)} currentPrompt={prompt} />}
      {howOpen && <HowItWorks onClose={() => setHowOpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ video tool */

function VideoTool({ generations, uploads, addUpload, saveAsset, seed, isMobile }) {
  const [tab, setTab] = useState("add");
  const [refs, setRefs] = useState(() => seed?.refs || []);
  const [prompt, setPrompt] = useState(() => seed?.prompt || "");
  const [aspect, setAspect] = useState(() => seed?.settings?.aspect || "16:9");
  const [resolution, setResolution] = useState(() => seed?.settings?.resolution || "720p");
  const [duration, setDuration] = useState(() => seed?.settings?.duration || "8");
  const [status, setStatus] = useState("idle");
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [director, setDirector] = useState(true);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const image = refs[0];
  const working = status === "starting" || status === "polling";
  const canGo = (image || prompt.trim()) && !working;

  async function generate() {
    if (!canGo) return;
    setError(null); setVideoUrl(null); setStatus("starting");
    try {
      let motion = prompt;
      if (director && prompt.trim()) { try { motion = await directPrompt(VIDEO_DIRECTOR_SYSTEM, prompt); } catch { /* keep raw */ } }
      const startRes = await fetch("/api/video-veo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: motion, image, aspectRatio: aspect, resolution, durationSeconds: duration }) });
      if (!startRes.ok) throw new Error((await startRes.json().catch(() => ({}))).error || "Couldn't start the video");
      const { operation } = await startRes.json();
      setStatus("polling");
      const started = Date.now();
      while (aliveRef.current) {
        if (Date.now() - started > 6 * 60 * 1000) throw new Error("Timed out waiting for the video (6 min).");
        await new Promise((r) => setTimeout(r, 6000));
        if (!aliveRef.current) return;
        const pollRes = await fetch(`/api/video-veo?op=${encodeURIComponent(operation)}`);
        if (!pollRes.ok) throw new Error((await pollRes.json().catch(() => ({}))).error || "Polling failed");
        if ((await pollRes.json()).done) {
          const fileRes = await fetch(`/api/video-veo?op=${encodeURIComponent(operation)}&file=1`);
          if (!fileRes.ok) throw new Error("Video finished but the download failed");
          const blob = await fileRes.blob();
          if (!aliveRef.current) return;
          setVideoUrl(URL.createObjectURL(blob)); setStatus("done");
          saveAsset({ kind: "video", blob, mime: "video/mp4", prompt, tool: "video", settings: { aspect, resolution, duration } });
          return;
        }
      }
    } catch (e) { if (aliveRef.current) { setError(e?.message || "Video generation failed"); setStatus("error"); } }
  }

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTop}>
          <SourcePills tab={tab} setTab={setTab} />
          <span style={S.veoTag}>Powered by Veo · ~1–2 min</span>
        </div>
        <div style={{ ...S.cardBody, ...(isMobile ? S.cardBodyM : {}) }}>
          <SourceInput tab={tab} value={refs} onChange={setRefs} max={1} generations={generations} uploads={uploads} addUpload={addUpload} isMobile={isMobile} />
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the motion / what should happen in the clip…" style={{ ...S.cardTextarea, ...(isMobile ? S.cardTextareaM : {}) }} />
        </div>
        <div style={S.cardFoot}>
          <label style={S.toggleWrap}>
            <span style={director ? { ...S.toggle, ...S.toggleOn } : S.toggle}><span style={director ? { ...S.knob, ...S.knobOn } : S.knob} /></span>
            <input type="checkbox" checked={director} onChange={(e) => setDirector(e.target.checked)} style={{ display: "none" }} />
            <span style={S.toggleLabel}>AI Art Director</span>
          </label>
        </div>
      </div>

      <ConfigRow
        left={<>
          <Field label="Model"><div style={S.modelBox}>Veo 3.1<span style={S.recBadge}>Recommended</span></div></Field>
          <Field label="Ratio"><Select value={aspect} onChange={setAspect} options={VIDEO_RATIOS} /></Field>
          <Field label="Resolution"><Select value={resolution} onChange={setResolution} options={VIDEO_RES} /></Field>
          <Field label="Duration"><Select value={duration} onChange={setDuration} options={VIDEO_DURATIONS} /></Field>
        </>}
        cost={CREDIT_COST.video} busy={working} canGo={canGo} onGenerate={generate} isMobile={isMobile}
      />

      <div style={S.videoStage}>
        {status === "idle" && <div style={S.resultsEmpty}>Your video will appear here.</div>}
        {working && <div style={S.videoBusy}><div style={S.spinner} /><div>{status === "starting" ? "Starting Veo…" : "Generating video… (~1–2 min)"}</div></div>}
        {status === "error" && <div style={S.tileErr}>{error}</div>}
        {status === "done" && videoUrl && (
          <div style={S.videoWrap}>
            <video src={videoUrl} controls autoPlay loop style={S.video} />
            <a href={videoUrl} download="video.mp4" style={S.dlInline}>Download .mp4</a>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ enhance tool */

function EnhanceTool({ generations, uploads, addUpload, saveAsset, seed, isMobile }) {
  const [tab, setTab] = useState("add");
  const [refs, setRefs] = useState(() => seed?.refs || []);
  const [resolution, setResolution] = useState("4K");
  const [variants, setVariants] = useState(1);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const source = refs[0];
  const canGo = !!source && !busy;

  async function generate() {
    if (!canGo) return;
    setBusy(true);
    setResults(Array.from({ length: variants }, (_, i) => ({ id: i, status: "generating" })));
    const tasks = Array.from({ length: variants }, () => async () => upscaleImage(source, resolution.toLowerCase(), "1:1"));
    await runPool(tasks, 2, (idx, patch) => {
      setResults((prev) => prev.map((r) => (r.id === idx ? { ...r, ...patch } : r)));
      if (patch.status === "done") saveAsset({ kind: "image", dataUrl: patch.image, tool: "enhance", settings: { resolution } });
    });
    setBusy(false);
  }

  return (
    <>
      <div style={S.card}>
        <div style={S.cardTop}>
          <SourcePills tab={tab} setTab={setTab} />
          <span style={S.veoTag}>Sharpen &amp; upscale, preserving the image</span>
        </div>
        <div style={S.cardBodyOne}>
          <SourceInput tab={tab} value={refs} onChange={setRefs} max={1} generations={generations} uploads={uploads} addUpload={addUpload} isMobile={isMobile} />
        </div>
      </div>
      <ConfigRow
        left={<>
          <Field label="Model"><div style={S.modelBox}>Upscale<span style={S.recBadge}>Recommended</span></div></Field>
          <Field label="Target"><Select value={resolution} onChange={setResolution} options={[{ id: "2K", label: "2K" }, { id: "4K", label: "4K" }]} /></Field>
        </>}
        variants={variants} setVariants={setVariants} cost={CREDIT_COST.enhance * variants} busy={busy} canGo={canGo} onGenerate={generate} isMobile={isMobile}
      />
      <Results results={results} />
    </>
  );
}

/* ------------------------------------------------------------------ shared bits */

function ConfigRow({ left, variants, setVariants, cost, busy, canGo, onGenerate, isMobile }) {
  return (
    <div style={{ ...S.configRow, ...(isMobile ? S.configRowM : {}) }}>
      <div style={S.configLeft}>{left}</div>
      <div style={{ ...S.configRight, ...(isMobile ? S.configRightM : {}) }}>
        {setVariants && (
          <Field label="Variants">
            <input type="number" min={1} max={6} value={variants} onChange={(e) => setVariants(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} style={S.numInput} />
          </Field>
        )}
        <button onClick={onGenerate} disabled={!canGo} style={{ ...S.generate, ...(isMobile ? S.generateM : {}), ...(!canGo ? S.generateOff : {}) }}>{busy ? "Generating…" : `Generate (${cost} credits)`}</button>
      </div>
    </div>
  );
}
function Field({ label, children }) { return <div style={S.field}><span style={S.fieldLabel}>{label}</span>{children}</div>; }
function Select({ value, onChange, options }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={S.select}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
}
function Results({ results }) {
  if (results.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={S.grid}>
        {results.map((r) => (
          <div key={r.id} style={S.tile}>
            {r.status === "generating" && <div style={S.shimmer}>generating…</div>}
            {r.status === "error" && <div style={S.tileErr}>{r.error}</div>}
            {r.status === "done" && <><img src={r.image} alt="" style={S.tileImg} /><a style={S.dl} href={r.image} download={`image-${r.id + 1}.png`}>Download</a></>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptLibrary({ onPick, onClose, currentPrompt }) {
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; } });
  const [open, setOpen] = useState({});
  function saveCurrent() {
    if (!currentPrompt.trim()) return;
    const next = [currentPrompt.trim(), ...saved].slice(0, 30); setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /**/ }
  }
  return (
    <div style={S.modalBack} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}><span style={S.modalTitle}>Prompt Library</span><button style={S.modalClose} onClick={onClose}>×</button></div>
        <div style={S.modalBody}>
          <div style={S.folderRow}>📁 Saved ({saved.length})</div>
          {saved.map((t, i) => <button key={i} style={S.libItem} onClick={() => onPick(t)}>{t}</button>)}
          {PROMPT_PRESETS.map((f) => (
            <div key={f.folder}>
              <button style={S.folderRow} onClick={() => setOpen((o) => ({ ...o, [f.folder]: !o[f.folder] }))}>{open[f.folder] ? "📂" : "📁"} Presets · {f.folder} ({f.items.length}) <span style={{ marginLeft: "auto" }}>{open[f.folder] ? "⌄" : "›"}</span></button>
              {open[f.folder] && f.items.map((it) => (
                <button key={it.label} style={S.libItem} onClick={() => onPick(it.text)}><strong style={S.libItemLabel}>{it.label}</strong><span style={S.libItemText}>{it.text}</span></button>
              ))}
            </div>
          ))}
        </div>
        <div style={S.modalFoot}><button style={S.ghostBtn} onClick={saveCurrent} disabled={!currentPrompt.trim()}>Save current prompt</button><button style={S.ghostBtn} onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

function HowItWorks({ onClose }) {
  return (
    <div style={S.modalBack} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}><span style={S.modalTitle}>How It Works</span><button style={S.modalClose} onClick={onClose}>×</button></div>
        <div style={S.modalBody}>
          <div style={S.aiBox}>
            <div style={S.aiTitle}>✦ AI Art Director: built-in creative direction</div>
            <div style={S.aiText}>With AI Art Director on, your prompt is automatically enriched with production-grade direction — composition, lighting, premium styling — so you don&apos;t have to prompt-engineer. Workshop already builds rich prompts under the hood; this surfaces it as a toggle.</div>
          </div>
          <div style={S.howH}>Bring your own product</div>
          <div style={S.howP}>Drop in a product or reference photo and the model preserves it exactly — same shape, colour, label — while restyling the scene around it. Add up to 8 references.</div>
          <div style={S.howH}>What&apos;s wired</div>
          <div style={S.howP}>Image (Nano Banana Pro), Enhance/Upscale, and Video (Veo) all run on Workshop&apos;s live engine. Generations are saved to My Generations. The credits counter is a cosmetic preview — nothing is metered yet.</div>
        </div>
      </div>
    </div>
  );
}

function GalleryPage({ title, emptyLabel, emptySub, createLabel, onCreate, items, loading, onEdit, onDelete, cloud, isMobile }) {
  const [sort, setSort] = useState("new");
  if (!cloud) return <div style={S.coming}><div style={S.comingTitle}>{title} needs the cloud</div><div style={S.comingBlurb}>Supabase isn&apos;t configured here, so this isn&apos;t saved. On wonderworkshop.cm.studio it persists to your account.</div></div>;
  const sorted = sort === "new" ? items : [...items].slice().reverse();
  return (
    <div style={S.galleryPage}>
      <div style={{ ...S.galleryHead, ...(isMobile ? S.galleryHeadM : {}) }}>
        <div style={S.galleryTitle}>{title}</div>
        <div style={S.galleryActions}>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={S.select}><option value="new">Newest First</option><option value="old">Oldest First</option></select>
          <button style={S.darkBtn} onClick={onCreate}>＋ {createLabel}</button>
        </div>
      </div>
      {loading ? <div style={S.resultsEmpty}>Loading…</div> : sorted.length === 0 ? (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>▢</div>
          <div style={S.emptyTitle}>{emptyLabel}</div>
          <div style={S.emptySubT}>{emptySub}</div>
          <button style={S.darkBtn} onClick={onCreate}>＋ {createLabel}</button>
        </div>
      ) : (
        <div style={S.grid}>
          {sorted.map((a) => (
            <div key={a.id} style={S.tile}>
              {a.kind === "video"
                ? <video src={a.url} style={S.tileImg} muted loop playsInline onMouseOver={(e) => e.currentTarget.play().catch(() => {})} onMouseOut={(e) => e.currentTarget.pause()} />
                : <img src={a.url} alt="" style={S.tileImg} />}
              {a.kind === "video" && <span style={S.kindBadge}>▶ video</span>}
              <div style={S.tileActions}>
                {onEdit && <button style={S.tileAct} onClick={() => onEdit(a)}>Edit</button>}
                <button style={S.tileAct} onClick={() => downloadUrl(a.url, `${a.kind}-${a.id}.${a.kind === "video" ? "mp4" : "png"}`)}>↓</button>
                {onDelete && <button style={S.tileAct} onClick={() => onDelete(a.id)}>✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComingSoon({ title, blurb }) {
  return <div style={S.coming}><div style={S.comingTitle}>{title}</div><div style={S.comingBadge}>Coming soon</div><div style={S.comingBlurb}>{blurb}</div></div>;
}

/* ------------------------------------------------------------------ styles */

const S = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Sora, system-ui, sans-serif", display: "flex", flexDirection: "column" },

  header: { height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", background: C.card, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 30 },
  brand: { fontSize: 17, fontWeight: 800, whiteSpace: "nowrap" },
  brandMark: { color: C.accent, marginRight: 6 },
  brandSub: { color: C.dim, fontWeight: 500 },
  nav: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  navItem: { fontSize: 15, fontWeight: 600, color: C.text, background: "transparent", border: "none", borderRadius: 999, padding: "7px 14px", cursor: "pointer" },
  navOn: { background: C.panel2 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  creditChip: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.dim, background: C.panel2, borderRadius: 999, padding: "5px 6px 5px 14px" },
  creditNum: { color: C.accent, fontWeight: 700 },
  addBtn: { fontSize: 13, fontWeight: 700, color: "#fff", background: C.grad, borderRadius: 999, padding: "5px 12px" },
  acct: { fontSize: 14, fontWeight: 600, color: C.text, background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: "7px 14px", cursor: "pointer" },
  menu: { position: "absolute", top: "calc(100% + 6px)", left: 0, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 6, minWidth: 220, zIndex: 60, boxShadow: "0 12px 34px rgba(0,0,0,0.18)" },
  menuItem: { display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 14, color: C.text, background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", textDecoration: "none" },

  body: { flex: 1, overflowY: "auto" },
  column: { width: "100%", maxWidth: 1120, margin: "0 auto", padding: "26px 28px 90px" },
  columnM: { padding: "16px 14px 80px" },
  headerM: { padding: "0 14px" },
  tabM: { fontSize: 17 },
  cardBodyM: { gridTemplateColumns: "1fr" },
  cardTextareaM: { minHeight: 160, fontSize: 15 },
  configRowM: { flexDirection: "column", alignItems: "stretch", gap: 14 },
  configRightM: { justifyContent: "space-between" },
  generateM: { flex: 1 },
  galleryHeadM: { flexDirection: "column", alignItems: "flex-start", gap: 12 },
  menuSep: { height: 1, background: C.line, margin: "6px 4px" },

  tabs: { display: "flex", gap: 10, marginBottom: 18 },
  tab: { padding: "4px 2px", fontSize: 21, fontWeight: 700, color: C.faint, background: "transparent", border: "none", borderBottom: "2px solid transparent", cursor: "pointer" },
  tabOn: { color: C.text, borderBottom: `2px solid ${C.text}` },

  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  pillRow: { display: "flex", gap: 8 },
  pill: { padding: "8px 16px", fontSize: 14, fontWeight: 700, color: C.text, background: C.panel2, border: "none", borderRadius: 999, cursor: "pointer" },
  pillOn: { color: C.pillInk, background: C.pillBg },
  libBtn: { fontSize: 13, fontWeight: 600, color: C.text, background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" },
  veoTag: { fontSize: 12, color: C.faint },
  cardBody: { display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 16 },
  cardBodyOne: { display: "grid", gridTemplateColumns: "1fr", gap: 16 },
  dropCol: {},
  dropzone: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 430, border: `1px dashed ${C.line2}`, borderRadius: 10, background: "transparent", cursor: "pointer", padding: 16 },
  dropHint: { fontSize: 14, color: C.dim },
  dropSub: { fontSize: 12, color: C.faint, marginTop: 6 },
  cardTextarea: { width: "100%", minHeight: 430, resize: "none", padding: 16, fontSize: 16, color: C.text, background: C.panel, border: "none", borderRadius: 10, fontFamily: "ui-monospace, monospace", boxSizing: "border-box" },
  refStrip: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  refChip: { position: "relative", width: 76, height: 76, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.line2}` },
  refImg: { width: "100%", height: "100%", objectFit: "cover" },
  refX: { position: "absolute", top: 0, right: 0, width: 20, height: 20, lineHeight: "18px", fontSize: 14, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer" },
  pickWrap: { minHeight: 430, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, overflowY: "auto" },
  pickGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 },
  pickThumb: { aspectRatio: "1/1", padding: 0, border: "2px solid transparent", borderRadius: 8, overflow: "hidden", background: C.panel, cursor: "pointer" },
  pickOn: { borderColor: C.accent },
  pickImg: { width: "100%", height: "100%", objectFit: "cover" },
  emptySmall: { fontSize: 12, color: C.faint, textAlign: "center", paddingTop: 40 },
  cardFoot: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, marginTop: 14 },
  howBtn: { fontSize: 13, fontWeight: 600, color: C.text, background: C.panel2, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" },
  toggleWrap: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  toggleLabel: { fontSize: 13, color: C.dim },
  toggle: { width: 38, height: 21, borderRadius: 999, background: C.line2, position: "relative" },
  toggleOn: { background: C.accent },
  knob: { position: "absolute", top: 2, left: 2, width: 17, height: 17, borderRadius: "50%", background: "#fff" },
  knobOn: { left: 19 },

  configRow: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 16, padding: "14px 18px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, flexWrap: "wrap" },
  configLeft: { display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" },
  configRight: { display: "flex", gap: 14, alignItems: "flex-end" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint },
  modelBox: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, padding: "8px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9 },
  recBadge: { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: C.dim, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, padding: "1px 5px" },
  select: { padding: "8px 10px", fontSize: 13, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, minWidth: 130 },
  numInput: { width: 64, padding: "8px 10px", fontSize: 13, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9 },
  generate: { padding: "11px 22px", fontSize: 14, fontWeight: 700, color: "#fff", background: C.grad, border: "none", borderRadius: 10, cursor: "pointer" },
  generateOff: { background: C.line2, color: C.faint, cursor: "not-allowed" },

  resultsEmpty: { display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontSize: 13, minHeight: 160 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  tile: { position: "relative", aspectRatio: "1/1", borderRadius: 12, overflow: "hidden", background: C.panel, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" },
  shimmer: { fontSize: 12, color: C.faint },
  tileErr: { fontSize: 12, color: "#e88", padding: 12, textAlign: "center" },
  tileImg: { width: "100%", height: "100%", objectFit: "cover" },
  dl: { position: "absolute", right: 8, bottom: 8, fontSize: 11, padding: "5px 9px", borderRadius: 8, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer", textDecoration: "none" },
  kindBadge: { position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.65)", borderRadius: 6, padding: "2px 7px" },
  tileActions: { position: "absolute", top: 8, right: 8, display: "flex", gap: 5 },
  tileAct: { fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 7, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer" },

  videoStage: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220, marginTop: 20 },
  videoBusy: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: C.dim, fontSize: 13 },
  spinner: { width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.line2}`, borderTopColor: C.accent, animation: "wwspin 0.9s linear infinite" },
  videoWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" },
  video: { maxWidth: "100%", maxHeight: "62vh", borderRadius: 12, background: "#000", border: `1px solid ${C.line}` },
  dlInline: { fontSize: 12, color: C.dim, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px" },

  // gallery pages (My Generations / My Uploads)
  galleryPage: {},
  galleryHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  galleryTitle: { fontSize: 28, fontWeight: 800 },
  galleryActions: { display: "flex", alignItems: "center", gap: 10 },
  darkBtn: { fontSize: 14, fontWeight: 700, color: C.pillInk, background: C.pillBg, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "80px 0", textAlign: "center" },
  emptyIcon: { fontSize: 40, color: C.line2 },
  emptyTitle: { fontSize: 18, fontWeight: 700 },
  emptySubT: { fontSize: 13, color: C.dim, marginBottom: 8 },

  modalBack: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  modal: { width: 560, maxWidth: "100%", maxHeight: "82vh", display: "flex", flexDirection: "column", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 16, overflow: "hidden" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C.line}` },
  modalTitle: { fontSize: 18, fontWeight: 700 },
  modalClose: { fontSize: 20, lineHeight: 1, color: C.dim, background: "transparent", border: "none", cursor: "pointer" },
  modalBody: { padding: 18, overflowY: "auto" },
  folderRow: { display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "11px 12px", fontSize: 14, fontWeight: 600, color: C.text, background: C.panel2, border: "none", borderRadius: 9, cursor: "pointer", marginBottom: 6 },
  libItem: { display: "flex", flexDirection: "column", gap: 3, width: "100%", textAlign: "left", padding: "9px 11px", marginBottom: 6, marginLeft: 12, fontSize: 13, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, cursor: "pointer" },
  libItemLabel: { fontSize: 13, fontWeight: 600 },
  libItemText: { fontSize: 11, color: C.dim, lineHeight: 1.4 },
  modalFoot: { display: "flex", justifyContent: "flex-end", gap: 10, padding: 16, borderTop: `1px solid ${C.line}` },
  ghostBtn: { padding: "9px 16px", fontSize: 13, fontWeight: 600, color: C.text, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 9, cursor: "pointer" },
  aiBox: { background: C.panel2, borderRadius: 12, padding: 16, marginBottom: 18 },
  aiTitle: { fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 8 },
  aiText: { fontSize: 13, color: C.dim, lineHeight: 1.55 },
  howH: { fontSize: 15, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  howP: { fontSize: 13, color: C.dim, lineHeight: 1.55 },

  coming: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 80 },
  comingTitle: { fontSize: 22, fontWeight: 700 },
  comingBadge: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, border: `1px solid ${C.line2}`, borderRadius: 999, padding: "3px 12px" },
  comingBlurb: { fontSize: 14, color: C.dim, maxWidth: 480, textAlign: "center", lineHeight: 1.5 },
};
