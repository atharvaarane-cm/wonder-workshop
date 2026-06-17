// Production Lab — PROTOTYPE (flag-gated via ?mode=production).
//
// A Studio-Tools-style "production mode" for Workshop: a small library of
// task-specific tools over ONE shared runner (source input + prompt + config bar
// + Generate), reusing Workshop's live engine (generateImage / upscaleImage —
// Gemini Nano Banana Pro, the same model Studio Tools recommends).
//
// Modeled on a teardown of studiotools.ai's logged-in UI. Honest about what's
// wired: ratio + references + variants + AI-Art-Director + 4K-upscale are real;
// the credits counter is a cosmetic preview (generation isn't metered yet);
// Video and Reformat are shown as coming-soon (not built).
//
// Throwaway probe to prove the direction + feel, not the final architecture.

import { useEffect, useRef, useState } from "react";
import { generateImage, upscaleImage } from "./imageGen.js";
import { hasSupabase } from "./supabaseClient.js";
import { saveProductionAsset, listProductionAssets, deleteProductionAsset, downloadUrl } from "./productionAssets.js";

/* ------------------------------------------------------------------ config */

const MODELS = [
  { id: "nbp", label: "Nano Banana Pro", tag: "Recommended", enabled: true },
  { id: "nb2", label: "Nano Banana 2", enabled: false },
  { id: "seedream", label: "Seedream 4.5", enabled: false },
];

// Only ratios Gemini actually honors (RATIO_MAP in api/_lib/geminiImage.js),
// labeled by channel use-case like Studio Tools.
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

// "AI Art Director" = the prompt-enrichment Studio Tools bakes in. Workshop
// already builds rich prompts elsewhere; here we wrap the user's words with
// production direction so they don't have to prompt-engineer.
const DIRECTOR_PREAMBLE =
  "Professional commercial photograph, art-directed for marketing: clean composition, " +
  "intentional lighting, premium styling, photorealistic, high detail. ";
const PRESERVE =
  " CRITICAL: reproduce any uploaded product/reference EXACTLY — identical shape, colour, " +
  "logo, label text, materials and proportions. Do not redesign or restyle the product; " +
  "only change the surrounding scene, surface, and lighting.";

const VARIATIONS = [
  "",
  " Slightly different camera angle.",
  " Alternative lighting mood.",
  " Different background tone or surface.",
  " Tighter crop.",
  " Wider, more environmental composition.",
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
const CREDIT_COST = { image: 30, enhance: 100, video: 100 };

const VIDEO_RATIOS = [
  { id: "16:9", label: "16:9 · Landscape" },
  { id: "9:16", label: "9:16 · Vertical" },
];
const VIDEO_RES = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
];
const VIDEO_DURATIONS = [
  { id: "4", label: "4s" },
  { id: "6", label: "6s" },
  { id: "8", label: "8s" },
];

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
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function downloadImage(image, name) {
  const a = document.createElement("a");
  a.href = image; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

/* ------------------------------------------------------------------ root */

export default function ProductionLab() {
  const [tool, setToolRaw] = useState("image"); // image | video | reformat | enhance | history
  const [assets, setAssets] = useState([]);     // persistent: production_assets rows
  const [uploads, setUploads] = useState([]);   // session-only inputs {id, image}
  const [seed, setSeed] = useState(null);       // edit-an-asset → preload a tool
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load persistent history once (cloud only; empty locally).
  useEffect(() => {
    if (!hasSupabase) return;
    setLoadingHistory(true);
    listProductionAssets()
      .then(setAssets)
      .catch((e) => console.error("[production] load history failed", e))
      .finally(() => setLoadingHistory(false));
  }, []);

  // Manual tab switch clears any pending edit-seed; Edit sets it (below).
  const setTool = (t) => { setSeed(null); setToolRaw(t); };

  // Save a generation to the cloud and prepend to history. Returns the row (or
  // null when offline) — tools still show the result regardless.
  async function saveAsset(params) {
    try {
      const row = await saveProductionAsset(params);
      if (row) setAssets((a) => [row, ...a]);
      return row;
    } catch (e) {
      console.error("[production] save asset failed", e);
      return null;
    }
  }

  async function removeAsset(id) {
    setAssets((a) => a.filter((x) => x.id !== id));
    try { await deleteProductionAsset(id); } catch (e) { console.error("[production] delete failed", e); }
  }

  function editAsset(asset) {
    setSeed({ refs: [asset.url], prompt: asset.prompt || "", settings: asset.settings || {} });
    setToolRaw(asset.tool === "video" ? "video" : "image");
  }

  // Past image generations are reusable as inputs in the source picker.
  const imageGenerations = assets.filter((a) => a.kind === "image").map((a) => ({ id: a.id, image: a.url }));
  const shared = { generations: imageGenerations, uploads, addUpload: (image) => setUploads((u) => [{ id: nid(), image }, ...u]), saveAsset, seed };

  return (
    <div style={S.app}>
      <style>{"@keyframes wwspin { to { transform: rotate(360deg); } }"}</style>
      <Header historyCount={assets.length} onHistory={() => setTool("history")} />
      <ToolTabs tool={tool} setTool={setTool} />
      <div style={S.main}>
        {tool === "image" && <ImageTool {...shared} />}
        {tool === "enhance" && <EnhanceTool {...shared} />}
        {tool === "video" && <VideoTool {...shared} />}
        {tool === "reformat" && <ComingSoon title="Reformat Image" blurb="Outpaint an existing asset to a new aspect ratio for any channel. On the roadmap — not built yet." />}
        {tool === "history" && <HistoryView assets={assets} loading={loadingHistory} onEdit={editAsset} onDelete={removeAsset} cloud={hasSupabase} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

function Header({ historyCount = 0, onHistory }) {
  return (
    <div style={S.header}>
      <div style={S.brand}>
        <span style={S.brandMark}>◆</span> Workshop <span style={S.brandSub}>Production</span>
      </div>
      <div style={S.headerRight}>
        <button style={S.navBtn} onClick={onHistory}>My Generations{historyCount ? ` (${historyCount})` : ""}</button>
        <div style={S.credits} title="Cosmetic preview — generation is not metered in this prototype.">
          <span style={S.creditNum}>2,400</span> credits <span style={S.previewTag}>preview</span>
        </div>
        <a href="?" style={S.backLink}>← Back to Workshop</a>
      </div>
    </div>
  );
}

const TOOLS = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
];
const OPTIMIZE = [
  { id: "reformat", label: "Reformat Image" },
  { id: "enhance", label: "Enhance or Upscale" },
];

function ToolTabs({ tool, setTool }) {
  const [openOpt, setOpenOpt] = useState(false);
  const optActive = OPTIMIZE.some((o) => o.id === tool);
  return (
    <div style={S.tabs}>
      {TOOLS.map((t) => (
        <button key={t.id} onClick={() => setTool(t.id)} style={{ ...S.tab, ...(tool === t.id ? S.tabOn : {}) }}>
          {t.label}
        </button>
      ))}
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpenOpt((v) => !v)} style={{ ...S.tab, ...(optActive ? S.tabOn : {}) }}>
          Optimize ▾
        </button>
        {openOpt && (
          <div style={S.optMenu} onMouseLeave={() => setOpenOpt(false)}>
            {OPTIMIZE.map((o) => (
              <button key={o.id} onClick={() => { setTool(o.id); setOpenOpt(false); }} style={S.optItem}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ source input */

function SourceInput({ value, onChange, max, generations, uploads, addUpload }) {
  const [tab, setTab] = useState("add"); // add | gen | up
  const inputRef = useRef(null);

  async function ingest(files) {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    const urls = await Promise.all(list.map(fileToDataUrl));
    urls.forEach((u) => addUpload(u));
    onChange([...value, ...urls].slice(0, max));
  }

  function onPaste(e) {
    const items = Array.from(e.clipboardData?.items || []).filter((i) => i.type.startsWith("image/"));
    if (items.length) ingest(items.map((i) => i.getAsFile()));
  }

  function pick(url) {
    if (value.includes(url)) onChange(value.filter((u) => u !== url));
    else onChange([...value, url].slice(0, max));
  }

  const gallery = tab === "gen" ? generations : uploads;

  return (
    <div style={S.source} onPaste={onPaste}>
      <div style={S.sourceTabs}>
        {[["add", "Add"], ["gen", "My Generations"], ["up", "My Uploads"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...S.sourceTab, ...(tab === id ? S.sourceTabOn : {}) }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "add" ? (
        <div style={S.dropzone} onClick={() => inputRef.current?.click()}
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => { e.preventDefault(); ingest(e.dataTransfer.files); }}>
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                 onChange={(e) => ingest(e.target.files)} />
          <div style={S.dropHint}>Drag &amp; drop images, paste, or browse</div>
          <div style={S.dropSub}>Up to {max} reference images</div>
        </div>
      ) : (
        <div style={S.pickGrid}>
          {gallery.length === 0 && <div style={S.emptySmall}>{tab === "gen" ? "No generations yet" : "No uploads yet"}</div>}
          {gallery.map((g) => (
            <button key={g.id} onClick={() => pick(g.image)} style={{ ...S.pickThumb, ...(value.includes(g.image) ? S.pickOn : {}) }}>
              <img src={g.image} alt="" style={S.pickImg} />
            </button>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div style={S.refStrip}>
          {value.map((u, i) => (
            <div key={i} style={S.refChip}>
              <img src={u} alt="" style={S.refImg} />
              <button style={S.refX} onClick={() => onChange(value.filter((x) => x !== u))}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ image tool */

function ImageTool({ generations, uploads, addUpload, saveAsset, seed }) {
  const [refs, setRefs] = useState(() => seed?.refs || []);
  const [prompt, setPrompt] = useState(() => seed?.prompt || "");
  const [model] = useState("nbp");
  const [ratio, setRatio] = useState(() => seed?.settings?.ratio || "1:1");
  const [resolution, setResolution] = useState(() => seed?.settings?.resolution || "2K");
  const [variants, setVariants] = useState(4);
  const [director, setDirector] = useState(true);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);

  const canGo = (prompt.trim() || refs.length) && !busy;
  const cost = CREDIT_COST.image * variants * (resolution === "4K" ? 2 : 1);

  async function generate() {
    if (!canGo) return;
    const base = director ? DIRECTOR_PREAMBLE + prompt + (refs.length ? PRESERVE : "") : prompt;
    setBusy(true);
    setResults(Array.from({ length: variants }, (_, i) => ({ id: i, status: "generating" })));
    const tasks = Array.from({ length: variants }, (_, i) => async () => {
      let img = await generateImage(`${base}${VARIATIONS[i % VARIATIONS.length]}`, { ratio, referenceImages: refs });
      if (resolution === "4K") { try { img = await upscaleImage(img, "4k", ratio); } catch { /* keep base */ } }
      return img;
    });
    await runPool(tasks, 2, (idx, patch) => {
      setResults((prev) => prev.map((r) => (r.id === idx ? { ...r, ...patch } : r)));
      if (patch.status === "done") saveAsset({ kind: "image", dataUrl: patch.image, prompt, tool: "image", settings: { ratio, resolution } });
    });
    setBusy(false);
  }

  return (
    <div style={S.workspace}>
      <div style={S.inputCol}>
        <SourceInput value={refs} onChange={setRefs} max={4}
                     generations={generations} uploads={uploads} addUpload={addUpload} />
      </div>

      <div style={S.promptCol}>
        <div style={S.promptHead}>
          <span style={S.colLabel}>Prompt</span>
          <button style={S.libBtn} onClick={() => setLibOpen(true)}>⊞ Prompt Library</button>
        </div>
        <textarea
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate…"
          style={S.textarea}
        />
        <div style={S.utilRow}>
          <span style={S.how} title="Upload a product, describe the scene, keep AI Art Director on, and Generate. Your product is preserved; the scene changes.">ⓘ How it works</span>
          <label style={S.toggleWrap} title="Auto-enriches your prompt with production-grade creative direction.">
            <span style={S.toggleLabel}>AI Art Director</span>
            <input type="checkbox" checked={director} onChange={(e) => setDirector(e.target.checked)} style={{ display: "none" }} />
            <span style={{ ...S.toggle, ...(director ? S.toggleOn : {}) }}><span style={{ ...S.knob, ...(director ? S.knobOn : {}) }} /></span>
          </label>
        </div>

        <ResultsGallery results={results} onDownload={(img, i) => downloadImage(img, `image-${i + 1}.png`)} />
      </div>

      <ConfigBar
        left={
          <>
            <Field label="Model">
              <div style={S.modelBox}>
                {MODELS.find((m) => m.id === model)?.label}
                <span style={S.recBadge}>Recommended</span>
              </div>
            </Field>
            <Field label="Ratio">
              <select value={ratio} onChange={(e) => setRatio(e.target.value)} style={S.select}>
                {RATIOS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Resolution">
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={S.select}>
                {RESOLUTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
          </>
        }
        variants={variants} setVariants={setVariants}
        cost={cost} busy={busy} canGo={canGo} onGenerate={generate}
      />

      {libOpen && <PromptLibrary onPick={(t) => { setPrompt((p) => (p ? p + " " : "") + t); setLibOpen(false); }} onClose={() => setLibOpen(false)} currentPrompt={prompt} />}
    </div>
  );
}

/* ------------------------------------------------------------------ enhance tool */

function EnhanceTool({ generations, uploads, addUpload, saveAsset, seed }) {
  const [refs, setRefs] = useState(() => seed?.refs || []);
  const [resolution, setResolution] = useState("4K");
  const [variants, setVariants] = useState(1);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const source = refs[0];
  const canGo = !!source && !busy;
  const cost = CREDIT_COST.enhance * variants;

  async function generate() {
    if (!canGo) return;
    setBusy(true);
    setResults(Array.from({ length: variants }, (_, i) => ({ id: i, status: "generating" })));
    const tasks = Array.from({ length: variants }, () => async () => {
      const img = await upscaleImage(source, resolution.toLowerCase(), "1:1");
      return img;
    });
    await runPool(tasks, 2, (idx, patch) => {
      setResults((prev) => prev.map((r) => (r.id === idx ? { ...r, ...patch } : r)));
      if (patch.status === "done") saveAsset({ kind: "image", dataUrl: patch.image, tool: "enhance", settings: { resolution } });
    });
    setBusy(false);
  }

  return (
    <div style={S.workspace}>
      <div style={S.inputCol}>
        <SourceInput value={refs} onChange={setRefs} max={1}
                     generations={generations} uploads={uploads} addUpload={addUpload} />
      </div>
      <div style={S.promptCol}>
        <div style={S.promptHead}><span style={S.colLabel}>Enhance &amp; Upscale</span></div>
        <div style={S.enhanceNote}>
          Sharpen detail and upscale to large-format resolution while preserving the image exactly.
          Uses Workshop&apos;s reference-conditioned upscale.
        </div>
        <ResultsGallery results={results} onDownload={(img, i) => downloadImage(img, `enhanced-${i + 1}.png`)} />
      </div>
      <ConfigBar
        left={
          <>
            <Field label="Model"><div style={S.modelBox}>Seed-style Upscale<span style={S.recBadge}>Recommended</span></div></Field>
            <Field label="Target">
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={S.select}>
                <option value="2K">2K</option><option value="4K">4K</option>
              </select>
            </Field>
          </>
        }
        variants={variants} setVariants={setVariants}
        cost={cost} busy={busy} canGo={canGo} onGenerate={generate}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ video tool */

function VideoTool({ generations, uploads, addUpload, saveAsset, seed }) {
  const [refs, setRefs] = useState(() => seed?.refs || []);
  const [prompt, setPrompt] = useState(() => seed?.prompt || "");
  const [aspect, setAspect] = useState(() => seed?.settings?.aspect || "16:9");
  const [resolution, setResolution] = useState(() => seed?.settings?.resolution || "720p");
  const [duration, setDuration] = useState(() => seed?.settings?.duration || "8");
  const [status, setStatus] = useState("idle"); // idle | starting | polling | done | error
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const image = refs[0];
  const working = status === "starting" || status === "polling";
  const canGo = (image || prompt.trim()) && !working;
  const cost = CREDIT_COST.video;

  async function generate() {
    if (!canGo) return;
    setError(null); setVideoUrl(null); setStatus("starting");
    try {
      const startRes = await fetch("/api/video-veo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image, aspectRatio: aspect, resolution, durationSeconds: duration }),
      });
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
        const st = await pollRes.json();
        if (st.done) {
          const fileRes = await fetch(`/api/video-veo?op=${encodeURIComponent(operation)}&file=1`);
          if (!fileRes.ok) throw new Error("Video finished but the download failed");
          const blob = await fileRes.blob();
          if (!aliveRef.current) return;
          setVideoUrl(URL.createObjectURL(blob));
          setStatus("done");
          saveAsset({ kind: "video", blob, mime: "video/mp4", prompt, tool: "video", settings: { aspect, resolution, duration } });
          return;
        }
      }
    } catch (e) {
      if (aliveRef.current) { setError(e?.message || "Video generation failed"); setStatus("error"); }
    }
  }

  return (
    <div style={S.workspace}>
      <div style={S.inputCol}>
        <SourceInput value={refs} onChange={setRefs} max={1}
                     generations={generations} uploads={uploads} addUpload={addUpload} />
      </div>
      <div style={S.promptCol}>
        <div style={S.promptHead}><span style={S.colLabel}>Convert Image to Video · Veo</span></div>
        <textarea
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the motion / what should happen in the clip…"
          style={S.textarea}
        />
        <div style={S.utilRow}>
          <span style={S.how} title="Veo (Google) generates an 4–8s clip from your image + motion prompt. Takes ~1–2 minutes.">ⓘ Powered by Veo · ~1–2 min</span>
        </div>

        <div style={S.videoStage}>
          {status === "idle" && <div style={S.resultsEmpty}>Your video will appear here.</div>}
          {working && (
            <div style={S.videoBusy}>
              <div style={S.spinner} />
              <div>{status === "starting" ? "Starting Veo…" : "Generating video… (~1–2 min, you can wait here)"}</div>
            </div>
          )}
          {status === "error" && <div style={S.tileErr}>{error}</div>}
          {status === "done" && videoUrl && (
            <div style={S.videoWrap}>
              <video src={videoUrl} controls autoPlay loop style={S.video} />
              <a href={videoUrl} download="video.mp4" style={S.dlInline}>Download .mp4</a>
            </div>
          )}
        </div>
      </div>

      <div style={S.configBar}>
        <div style={S.configLeft}>
          <Field label="Model"><div style={S.modelBox}>Veo 3.1<span style={S.recBadge}>Recommended</span></div></Field>
          <Field label="Ratio">
            <select value={aspect} onChange={(e) => setAspect(e.target.value)} style={S.select}>
              {VIDEO_RATIOS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Resolution">
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={S.select}>
              {VIDEO_RES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Duration">
            <select value={duration} onChange={(e) => setDuration(e.target.value)} style={S.select}>
              {VIDEO_DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={S.configRight}>
          <button onClick={generate} disabled={!canGo} style={{ ...S.generate, ...(!canGo ? S.generateOff : {}) }}>
            {working ? "Generating…" : `Generate (${cost} credits)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared bits */

function ConfigBar({ left, variants, setVariants, cost, busy, canGo, onGenerate }) {
  return (
    <div style={S.configBar}>
      <div style={S.configLeft}>{left}</div>
      <div style={S.configRight}>
        <Field label="Variants">
          <input type="number" min={1} max={6} value={variants}
                 onChange={(e) => setVariants(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                 style={S.numInput} />
        </Field>
        <button onClick={onGenerate} disabled={!canGo} style={{ ...S.generate, ...(!canGo ? S.generateOff : {}) }}>
          {busy ? "Generating…" : `Generate (${cost} credits)`}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function ResultsGallery({ results, onDownload }) {
  if (results.length === 0) return <div style={S.resultsEmpty}>Results will appear here.</div>;
  return (
    <div style={S.grid}>
      {results.map((r) => (
        <div key={r.id} style={S.tile}>
          {r.status === "generating" && <div style={S.shimmer}>generating…</div>}
          {r.status === "error" && <div style={S.tileErr}>{r.error}</div>}
          {r.status === "done" && (
            <>
              <img src={r.image} alt="" style={S.tileImg} />
              <button style={S.dl} onClick={() => onDownload(r.image, r.id)}>Download</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function PromptLibrary({ onPick, onClose, currentPrompt }) {
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
  });
  function saveCurrent() {
    if (!currentPrompt.trim()) return;
    const next = [currentPrompt.trim(), ...saved].slice(0, 30);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
  }
  return (
    <div style={S.modalBack} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.modalTitle}>Prompt Library</span>
          <button style={S.modalClose} onClick={onClose}>×</button>
        </div>
        <div style={S.modalBody}>
          <div style={S.libFolder}>Saved ({saved.length})</div>
          {saved.length === 0 && <div style={S.emptySmall}>No saved prompts</div>}
          {saved.map((t, i) => (
            <button key={i} style={S.libItem} onClick={() => onPick(t)}>{t}</button>
          ))}
          {PROMPT_PRESETS.map((f) => (
            <div key={f.folder}>
              <div style={S.libFolder}>Presets · {f.folder}</div>
              {f.items.map((it) => (
                <button key={it.label} style={S.libItem} onClick={() => onPick(it.text)}>
                  <strong style={S.libItemLabel}>{it.label}</strong>
                  <span style={S.libItemText}>{it.text}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={S.modalFoot}>
          <button style={S.saveBtn} onClick={saveCurrent} disabled={!currentPrompt.trim()}>Save current prompt</button>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ title, blurb }) {
  return (
    <div style={S.coming}>
      <div style={S.comingTitle}>{title}</div>
      <div style={S.comingBadge}>Coming soon</div>
      <div style={S.comingBlurb}>{blurb}</div>
    </div>
  );
}

function HistoryView({ assets, loading, onEdit, onDelete, cloud }) {
  if (!cloud) return (
    <div style={S.coming}>
      <div style={S.comingTitle}>History needs the cloud</div>
      <div style={S.comingBlurb}>Supabase isn&apos;t configured in this environment, so generations aren&apos;t saved here. On wonderworkshop.cm.studio your generations are stored to your account and appear here.</div>
    </div>
  );
  if (loading) return <div style={S.resultsEmpty}>Loading your generations…</div>;
  return (
    <div style={S.historyWrap}>
      <div style={S.historyHead}>My Generations <span style={S.historyCount}>{assets.length}</span></div>
      {assets.length === 0 ? (
        <div style={S.resultsEmpty}>Nothing yet — generate an image or video and it&apos;ll be saved here automatically.</div>
      ) : (
        <div style={S.grid}>
          {assets.map((a) => (
            <div key={a.id} style={S.tile}>
              {a.kind === "video" ? (
                <video src={a.url} style={S.tileImg} muted loop playsInline
                       onMouseOver={(e) => { e.currentTarget.play().catch(() => {}); }}
                       onMouseOut={(e) => e.currentTarget.pause()} />
              ) : (
                <img src={a.url} alt="" style={S.tileImg} />
              )}
              {a.kind === "video" && <span style={S.kindBadge}>▶ video</span>}
              <div style={S.tileActions}>
                <button style={S.tileAct} title="Edit / iterate" onClick={() => onEdit(a)}>Edit</button>
                <button style={S.tileAct} title="Download" onClick={() => downloadUrl(a.url, `${a.kind}-${a.id}.${a.kind === "video" ? "mp4" : "png"}`)}>↓</button>
                <button style={S.tileAct} title="Delete" onClick={() => onDelete(a.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const C = { bg: "#0b0b0d", panel: "#161618", panel2: "#1b1b1e", line: "#2a2a30", line2: "#34343c", text: "#e8e8ea", dim: "#9a9aa2", faint: "#6c6c74", accent: "#6b8afd", accentInk: "#0b0b0d" };

const S = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column" },

  header: { height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: `1px solid ${C.line}` },
  brand: { fontSize: 15, fontWeight: 700, letterSpacing: "0.01em" },
  brandMark: { color: C.accent, marginRight: 6 },
  brandSub: { color: C.dim, fontWeight: 500, marginLeft: 4 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  credits: { fontSize: 12, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 12px" },
  creditNum: { color: C.text, fontWeight: 700 },
  previewTag: { marginLeft: 6, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint, border: `1px solid ${C.line2}`, borderRadius: 4, padding: "1px 4px" },
  backLink: { fontSize: 12, color: C.dim, textDecoration: "none" },
  navBtn: { fontSize: 12, fontWeight: 600, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" },

  tabs: { display: "flex", gap: 4, padding: "10px 20px 0", borderBottom: `1px solid ${C.line}` },
  tab: { padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.dim, background: "transparent", border: "none", borderBottom: "2px solid transparent", cursor: "pointer" },
  tabOn: { color: C.text, borderBottom: `2px solid ${C.accent}` },
  optMenu: { position: "absolute", top: "100%", left: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 6, minWidth: 200, zIndex: 50, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" },
  optItem: { display: "block", width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, color: C.text, background: "transparent", border: "none", borderRadius: 7, cursor: "pointer" },

  main: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
  workspace: { flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", gridTemplateRows: "1fr auto", gap: 0, minHeight: 0 },
  inputCol: { borderRight: `1px solid ${C.line}`, padding: 18, overflowY: "auto" },
  promptCol: { padding: 18, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" },

  source: {},
  sourceTabs: { display: "flex", gap: 4, marginBottom: 12 },
  sourceTab: { flex: 1, padding: "7px 6px", fontSize: 11, fontWeight: 600, color: C.dim, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, cursor: "pointer" },
  sourceTabOn: { color: C.text, background: C.panel2, borderColor: C.line2 },
  dropzone: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, border: `1px dashed ${C.line2}`, borderRadius: 12, background: C.panel, cursor: "pointer", gap: 6 },
  dropHint: { fontSize: 13, color: C.dim },
  dropSub: { fontSize: 11, color: C.faint },
  pickGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxHeight: 220, overflowY: "auto" },
  pickThumb: { aspectRatio: "1/1", padding: 0, border: `2px solid transparent`, borderRadius: 8, overflow: "hidden", background: C.panel, cursor: "pointer" },
  pickOn: { borderColor: C.accent },
  pickImg: { width: "100%", height: "100%", objectFit: "cover" },
  emptySmall: { fontSize: 12, color: C.faint, padding: "16px 0", gridColumn: "1 / -1", textAlign: "center" },
  refStrip: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 },
  refChip: { position: "relative", width: 52, height: 52, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.line2}` },
  refImg: { width: "100%", height: "100%", objectFit: "cover" },
  refX: { position: "absolute", top: 0, right: 0, width: 18, height: 18, lineHeight: "16px", fontSize: 13, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer" },

  promptHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  colLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint },
  libBtn: { fontSize: 12, color: C.dim, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" },
  textarea: { width: "100%", minHeight: 90, resize: "vertical", padding: 12, fontSize: 14, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, fontFamily: "inherit", boxSizing: "border-box" },
  utilRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 14 },
  how: { fontSize: 12, color: C.faint, cursor: "help" },
  toggleWrap: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  toggleLabel: { fontSize: 12, color: C.dim },
  toggle: { width: 36, height: 20, borderRadius: 999, background: C.line2, position: "relative", transition: "background .15s" },
  toggleOn: { background: C.accent },
  knob: { position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" },
  knobOn: { left: 18 },

  resultsEmpty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontSize: 13, minHeight: 160 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  tile: { position: "relative", aspectRatio: "1/1", borderRadius: 12, overflow: "hidden", background: C.panel, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" },
  shimmer: { fontSize: 12, color: C.faint },
  tileErr: { fontSize: 11, color: "#e88", padding: 12, textAlign: "center" },
  tileImg: { width: "100%", height: "100%", objectFit: "cover" },
  dl: { position: "absolute", right: 8, bottom: 8, fontSize: 11, padding: "5px 9px", borderRadius: 8, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer" },

  configBar: { gridColumn: "1 / -1", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, padding: "12px 20px", borderTop: `1px solid ${C.line}`, background: C.panel2, flexWrap: "wrap" },
  configLeft: { display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" },
  configRight: { display: "flex", gap: 14, alignItems: "flex-end" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint },
  modelBox: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, padding: "8px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9 },
  recBadge: { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: "1px 5px" },
  select: { padding: "8px 10px", fontSize: 13, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, minWidth: 130 },
  numInput: { width: 64, padding: "8px 10px", fontSize: 13, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9 },
  generate: { padding: "11px 20px", fontSize: 14, fontWeight: 700, color: C.accentInk, background: C.accent, border: "none", borderRadius: 10, cursor: "pointer" },
  generateOff: { background: C.line2, color: C.faint, cursor: "not-allowed" },

  enhanceNote: { fontSize: 13, color: C.dim, lineHeight: 1.5, marginBottom: 16, maxWidth: 520 },

  modalBack: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { width: 520, maxHeight: "78vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 14, overflow: "hidden" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${C.line}` },
  modalTitle: { fontSize: 15, fontWeight: 700 },
  modalClose: { fontSize: 20, lineHeight: 1, color: C.dim, background: "transparent", border: "none", cursor: "pointer" },
  modalBody: { padding: 14, overflowY: "auto" },
  libFolder: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint, margin: "14px 0 8px" },
  libItem: { display: "flex", flexDirection: "column", gap: 3, width: "100%", textAlign: "left", padding: "9px 11px", marginBottom: 6, fontSize: 13, color: C.text, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, cursor: "pointer" },
  libItemLabel: { fontSize: 13, fontWeight: 600 },
  libItemText: { fontSize: 11, color: C.dim, lineHeight: 1.4 },
  modalFoot: { padding: 14, borderTop: `1px solid ${C.line}` },
  saveBtn: { width: "100%", padding: "10px", fontSize: 13, fontWeight: 600, color: C.text, background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 9, cursor: "pointer" },

  historyWrap: { flex: 1, padding: 20, overflowY: "auto" },
  historyHead: { fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  historyCount: { fontSize: 12, fontWeight: 600, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 9px" },
  kindBadge: { position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.65)", borderRadius: 6, padding: "2px 7px" },
  tileActions: { position: "absolute", top: 8, right: 8, display: "flex", gap: 5, opacity: 0.95 },
  tileAct: { fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 7, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer" },

  videoStage: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 },
  videoBusy: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: C.dim, fontSize: 13 },
  spinner: { width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.line2}`, borderTopColor: C.accent, animation: "wwspin 0.9s linear infinite" },
  videoWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" },
  video: { maxWidth: "100%", maxHeight: "62vh", borderRadius: 12, background: "#000", border: `1px solid ${C.line}` },
  dlInline: { fontSize: 12, color: C.dim, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px" },

  coming: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  comingTitle: { fontSize: 22, fontWeight: 700 },
  comingBadge: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 999, padding: "3px 12px" },
  comingBlurb: { fontSize: 14, color: C.dim, maxWidth: 480, textAlign: "center", lineHeight: 1.5 },
};
