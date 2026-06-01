import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ShimmerSweep, toast } from "../Workshop.jsx";

// Fullscreen image workspace — opens when you click any image tile.
// Big preview on the left, editing controls on the right (prompt
// textarea, Improve with AI, Generate, version navigator).
//
// Rendered via createPortal at document.body so it's truly viewport-
// fullscreen — `position: fixed` becomes relative to the nearest
// transformed ancestor in CSS, which was causing the lightbox to be
// constrained inside the asset panel.
export function V2Lightbox({
  src, label, basePrompt, onClose,
  versions = [], onSelectVersion,
  onRegenerate, onUpload,
}) {
  // Seed the textarea with the prompt that actually produced this
  // image so the user can iterate on it (Logan: "for us to improve
  // on the prompt, we need to see the original prompt used to make
  // the images"). Falls back to empty if the caller didn't pass one.
  const [prompt, setPrompt] = useState(basePrompt || "");
  // If the basePrompt changes (e.g. the user navigates between
  // versions of a slot whose prompt is view-derived), pick up the
  // new value — but only if the user hasn't typed their own edits yet.
  const seededRef = useRef(basePrompt || "");
  useEffect(() => {
    if (basePrompt && prompt === seededRef.current) {
      setPrompt(basePrompt);
      seededRef.current = basePrompt;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePrompt]);
  const [improving, setImproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  async function handleImprove() {
    const text = prompt.trim();
    if (!text || improving) return;
    setImproving(true);
    try {
      const messages = [
        { role: "system", content: [
          "You are a senior image-prompt engineer for cinematic / editorial photography.",
          "Take the user's rough prompt and rewrite it as a single richer prompt that:",
          "- Keeps the same SUBJECT and INTENT (don't change what's being shown)",
          "- Adds specific visual detail: lighting, mood, composition, framing, lens, color palette, texture",
          "- Stays in one paragraph, no lists or headings",
          "- Returns ONLY the improved prompt text, ready to paste into an image generator",
        ].join("\n") },
        { role: "user", content: text },
      ];
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const improved = (data?.message?.content || "").trim().replace(/^["'`]+|["'`]+$/g, "");
      if (improved) setPrompt(improved);
    } catch (e) {
      console.error("[lightbox improve]", e);
      toast(`Improve failed: ${e?.message?.slice(0, 120) || "unknown"}`, { kind: "error" });
    } finally {
      setImproving(false);
    }
  }

  async function handleGenerate() {
    const text = prompt.trim();
    if (!text || generating || !onRegenerate) return;
    setGenerating(true);
    try {
      await onRegenerate({ customPrompt: text });
      toast("Generated from your prompt", { kind: "success", ttl: 2500 });
    } catch (e) {
      console.error("[lightbox generate]", e);
      toast(`Generation failed: ${e?.message?.slice(0, 140) || "unknown"}`, { kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  function handleUploadFile(file) {
    if (!file || !onUpload) return;
    const reader = new FileReader();
    reader.onload = e => onUpload(e.target.result);
    reader.readAsDataURL(file);
  }

  const count = versions.length;
  const activeIdx = count > 0 ? versions.findIndex(v => v.src === src) : -1;
  const selectIdx = (idx) => {
    if (idx < 0 || idx >= count) return;
    onSelectVersion?.(versions[idx].src);
  };

  const modal = (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "stretch",
    }}>
      {/* Preview pane — clicks in the black space around the image close
          the lightbox (matching macOS Quick Look / Apple Preview). Only the
          image itself + the version navigator absorb clicks. */}
      <div style={{
        flex: 1, minWidth: 0, cursor: "zoom-out",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40, position: "relative",
      }}>
        <img src={src} alt={label || ""} onClick={e => e.stopPropagation()} style={{
          maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
          borderRadius: 4, boxShadow: "0 12px 64px rgba(0,0,0,0.6)",
          cursor: "default",
        }} />
        {/* Version navigator — bottom-center over the image */}
        {count >= 2 && (
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 16,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
            fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
            color: "#fff", letterSpacing: "0.04em",
            cursor: "default",
          }}>
            <button onClick={() => selectIdx(activeIdx - 1)} disabled={activeIdx <= 0}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: activeIdx > 0 ? "pointer" : "not-allowed", opacity: activeIdx > 0 ? 1 : 0.35, padding: "0 6px", fontSize: 16, lineHeight: 1, outline: "none" }}>‹</button>
            <span>{activeIdx >= 0 ? activeIdx + 1 : "?"} / {count}</span>
            <button onClick={() => selectIdx(activeIdx + 1)} disabled={activeIdx >= count - 1}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: activeIdx < count - 1 ? "pointer" : "not-allowed", opacity: activeIdx < count - 1 ? 1 : 0.35, padding: "0 6px", fontSize: 16, lineHeight: 1, outline: "none" }}>›</button>
          </div>
        )}
      </div>

      {/* Editing side panel */}
      <div onClick={e => e.stopPropagation()} style={{
        width: 360, flexShrink: 0,
        background: "rgba(20,20,22,0.95)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column",
        padding: "20px 22px", gap: 14,
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
              Image workspace
            </div>
            {label && (
              <div style={{ fontFamily: "var(--f)", fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
                {label}
              </div>
            )}
          </div>
          <button onClick={onClose} title="Close (Esc)" style={{
            width: 30, height: 30, borderRadius: 6,
            background: "transparent", border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.7)", cursor: "pointer", outline: "none",
            fontSize: 16, flexShrink: 0,
          }}>×</button>
        </div>

        <div>
          <label style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={8}
            readOnly={improving || generating}
            aria-readonly={improving || generating}
            placeholder="Describe what you want — subject, setting, lighting, framing, mood…"
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            style={{
              width: "100%", boxSizing: "border-box",
              fontFamily: "var(--f)", fontSize: 13, fontWeight: 300,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff", outline: "none", resize: "vertical",
              lineHeight: 1.6, opacity: (improving || generating) ? 0.6 : 1,
              userSelect: "text", WebkitUserSelect: "text", cursor: "text",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleImprove}
            disabled={!prompt.trim() || improving || generating}
            title="Use Gemini to expand your prompt into a richer image-generation prompt"
            style={{
              position: "relative", overflow: "hidden", flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,200,87,0.10)",
              border: "1px solid rgba(255,200,87,0.5)",
              color: "#FFC857", outline: "none",
              fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
              cursor: (prompt.trim() && !improving && !generating) ? "pointer" : "not-allowed",
              opacity: (prompt.trim() && !improving && !generating) ? 1 : 0.5,
            }}
          >
            {improving && <ShimmerSweep color="rgba(255,200,87,0.32)" />}
            <span style={{ position: "relative", zIndex: 1 }}>{improving ? "Improving…" : "✨ Improve with AI"}</span>
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || improving || generating || !onRegenerate}
            style={{
              position: "relative", overflow: "hidden", flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "8px 12px", borderRadius: 8,
              background: prompt.trim() && onRegenerate ? "#fff" : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: prompt.trim() && onRegenerate ? "#111" : "rgba(255,255,255,0.5)",
              outline: "none",
              fontFamily: "var(--f)", fontSize: 11, fontWeight: 700,
              cursor: (prompt.trim() && !improving && !generating && onRegenerate) ? "pointer" : "not-allowed",
              opacity: (prompt.trim() && !improving && !generating && onRegenerate) ? 1 : 0.6,
            }}
          >
            {generating && <ShimmerSweep />}
            <span style={{ position: "relative", zIndex: 1 }}>{generating ? "Generating…" : "✦ Generate"}</span>
          </button>
        </div>

        {onUpload && (
          <>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%",
                padding: "9px 12px", borderRadius: 8,
                background: "transparent",
                border: "1px dashed rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.65)", outline: "none",
                fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                cursor: "pointer", letterSpacing: "0.02em",
              }}
            >
              Replace with upload
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { handleUploadFile(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        )}
      </div>
    </div>
  );

  // Portal to document.body so position:fixed is relative to the
  // viewport, not whatever transformed ancestor we happen to be
  // mounted inside.
  return createPortal(modal, document.body);
}
