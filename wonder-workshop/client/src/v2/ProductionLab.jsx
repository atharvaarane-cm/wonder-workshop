// Production Lab — PROTOTYPE (flag-gated via ?mode=production).
//
// Purpose: de-risk the load-bearing assumption behind a Studio-Tools-style
// "production mode" — does Workshop's existing reference-image conditioning
// preserve a REAL PRODUCT (not just a face) well enough for marketing output?
//
// Flow: upload a product photo → pick a built-in creative direction (preset,
// "no prompting") → generate N variants in multiple sizes. Each variant reuses
// the SAME engine the storyboard uses (generateImage + referenceImages), with a
// strong product-preservation instruction. This is a throwaway probe, not the
// final UX — if fidelity holds, it becomes the seed of the real production mode.

import { useState } from "react";
import { generateImage } from "./imageGen.js";

const PRESERVE =
  "CRITICAL: reproduce the uploaded product EXACTLY as shown in the reference image — " +
  "identical shape, colour, logo, label text, materials, and proportions. Do NOT redesign, " +
  "restyle, recolour, or alter the product itself in any way. Only change the surrounding " +
  "scene, background, surface, and lighting.";

const PRESETS = [
  {
    id: "ecom-white",
    label: "eCom · Studio White",
    blurb: "Clean catalogue shot on seamless white",
    prompt:
      "Clean studio e-commerce product shot on a seamless pure-white background, soft even " +
      "softbox lighting, subtle natural contact shadow, centred composition, crisp sharp focus, " +
      "professional commercial product photography.",
  },
  {
    id: "lifestyle",
    label: "Lifestyle Scene",
    blurb: "In-context, editorial, natural light",
    prompt:
      "The product placed naturally in a warm, aspirational real-world lifestyle setting that " +
      "suits its use, shallow depth of field, soft natural window light, tasteful editorial " +
      "styling and props, photorealistic.",
  },
  {
    id: "gradient-hero",
    label: "Marketing Hero",
    blurb: "Bold gradient backdrop, room for copy",
    prompt:
      "Bold marketing hero shot of the product on a smooth coloured gradient backdrop, dramatic " +
      "studio lighting, soft glossy reflection beneath, generous negative space for ad copy, " +
      "premium high-end feel.",
  },
  {
    id: "outdoor",
    label: "Outdoor · Golden Hour",
    blurb: "Natural daylight, authentic surface",
    prompt:
      "The product photographed outdoors in natural daylight at golden hour, soft warm light, " +
      "an organic real-world surface, gentle background bokeh, authentic and premium.",
  },
];

const RATIOS = [
  { id: "1:1", label: "1:1 · Square" },
  { id: "4:5", label: "4:5 · Portrait" },
  { id: "16:9", label: "16:9 · Wide" },
  { id: "9:16", label: "9:16 · Story" },
];

const VARIATIONS = [
  "",
  " Slightly different camera angle.",
  " Alternative lighting mood.",
  " Different background tone or surface.",
  " Tighter crop on the product.",
  " Wider, more environmental composition.",
];

async function runPool(tasks, concurrency, onResult) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        const image = await tasks[idx]();
        onResult(idx, { status: "done", image });
      } catch (e) {
        onResult(idx, { status: "error", error: e?.message || "Generation failed" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

export default function ProductionLab() {
  const [productUrl, setProductUrl] = useState(null);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [ratio, setRatio] = useState("1:1");
  const [count, setCount] = useState(4);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  function onFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProductUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!productUrl || busy) return;
    const preset = PRESETS.find((p) => p.id === presetId) || PRESETS[0];
    setBusy(true);
    setResults(Array.from({ length: count }, (_, i) => ({ id: i, status: "generating" })));
    const tasks = Array.from({ length: count }, (_, i) => () => {
      const prompt = `${preset.prompt}${VARIATIONS[i % VARIATIONS.length]} ${PRESERVE}`;
      return generateImage(prompt, { ratio, referenceImages: [productUrl] });
    });
    await runPool(tasks, 2, (idx, patch) => {
      setResults((prev) => prev.map((r) => (r.id === idx ? { ...r, ...patch } : r)));
    });
    setBusy(false);
  }

  function download(image, i) {
    const a = document.createElement("a");
    a.href = image;
    a.download = `production-${presetId}-${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>Production Lab</div>
        <div style={S.badge}>prototype · ?mode=production</div>
      </div>
      <div style={S.sub}>
        Upload a product photo, pick a direction, generate marketing variants. Tests whether
        reference-conditioning preserves the product. Reuses the live generation engine.
      </div>

      <div style={S.body}>
        {/* Controls */}
        <div style={S.panel}>
          <label style={S.drop}>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {productUrl ? (
              <img src={productUrl} alt="product" style={S.thumb} />
            ) : (
              <span style={S.dropHint}>Click to upload a product photo</span>
            )}
          </label>

          <div style={S.fieldLabel}>Creative direction</div>
          <div style={S.presetList}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                style={{ ...S.preset, ...(presetId === p.id ? S.presetOn : {}) }}
              >
                <div style={S.presetLabel}>{p.label}</div>
                <div style={S.presetBlurb}>{p.blurb}</div>
              </button>
            ))}
          </div>

          <div style={S.fieldLabel}>Aspect ratio</div>
          <select value={ratio} onChange={(e) => setRatio(e.target.value)} style={S.select}>
            {RATIOS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>

          <div style={S.fieldLabel}>Variants</div>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={S.select}>
            {[2, 4, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={!productUrl || busy}
            style={{ ...S.generate, ...(!productUrl || busy ? S.generateOff : {}) }}
          >
            {busy ? "Generating…" : `Generate ${count} variants`}
          </button>
        </div>

        {/* Results */}
        <div style={S.results}>
          {results.length === 0 && <div style={S.empty}>Results will appear here.</div>}
          <div style={S.grid}>
            {results.map((r) => (
              <div key={r.id} style={S.tile}>
                {r.status === "generating" && <div style={S.shimmer}>generating…</div>}
                {r.status === "error" && <div style={S.error}>{r.error}</div>}
                {r.status === "done" && (
                  <>
                    <img src={r.image} alt={`variant ${r.id + 1}`} style={S.resultImg} />
                    <button style={S.dl} onClick={() => download(r.image, r.id)}>Download</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#0e0e10", color: "#e8e8ea", padding: "28px 32px", fontFamily: "Inter, system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 12 },
  title: { fontSize: 22, fontWeight: 700 },
  badge: { fontSize: 11, color: "#9aa", border: "1px solid #333", borderRadius: 999, padding: "2px 10px" },
  sub: { color: "#9aa", fontSize: 13, maxWidth: 640, marginTop: 6, marginBottom: 22 },
  body: { display: "flex", gap: 28, alignItems: "flex-start" },
  panel: { width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 },
  drop: { display: "flex", alignItems: "center", justifyContent: "center", height: 180, border: "1px dashed #3a3a40", borderRadius: 12, cursor: "pointer", background: "#161618", overflow: "hidden" },
  dropHint: { color: "#888", fontSize: 13 },
  thumb: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginTop: 8 },
  presetList: { display: "flex", flexDirection: "column", gap: 6 },
  preset: { textAlign: "left", padding: "8px 10px", borderRadius: 10, border: "1px solid #2a2a30", background: "#161618", color: "#e8e8ea", cursor: "pointer" },
  presetOn: { borderColor: "#6b8afd", background: "#1b2030" },
  presetLabel: { fontSize: 13, fontWeight: 600 },
  presetBlurb: { fontSize: 11, color: "#999", marginTop: 2 },
  select: { padding: "8px 10px", borderRadius: 10, border: "1px solid #2a2a30", background: "#161618", color: "#e8e8ea", fontSize: 13 },
  generate: { marginTop: 14, padding: "11px 14px", borderRadius: 10, border: "none", background: "#6b8afd", color: "#0b0b0d", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  generateOff: { background: "#2a2a30", color: "#777", cursor: "not-allowed" },
  results: { flex: 1 },
  empty: { color: "#666", fontSize: 13, paddingTop: 40, textAlign: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 },
  tile: { position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", background: "#161618", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center" },
  shimmer: { color: "#888", fontSize: 12, animation: "pulse 1.4s ease-in-out infinite" },
  error: { color: "#e88", fontSize: 11, padding: 12, textAlign: "center" },
  resultImg: { width: "100%", height: "100%", objectFit: "cover" },
  dl: { position: "absolute", bottom: 8, right: 8, fontSize: 11, padding: "5px 9px", borderRadius: 8, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer" },
};
