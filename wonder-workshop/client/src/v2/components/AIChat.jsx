// AI Chat family — extracted from Workshop.jsx (2026-05-30).
// Contains the chat panel, message rows, @-mention popup, frame/asset
// context cards, the floating chat tab, and the shared chat icon button.
//
// Shared primitives (SectionIcon, PremiumButton, parseMentions, FILM,
// isCameraDefault, CHAT_SUGGESTIONS, mockImproveText, AssetContext) are
// imported back from Workshop.jsx. This is an intentional circular import:
// every usage is at render time, never at module-load, so ESM/Vite resolve
// it cleanly (see engineering playbook on circular imports).
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  parseMentions,
  FILM,
  isCameraDefault,
  PremiumButton,
  SectionIcon,
  CHAT_SUGGESTIONS,
  mockImproveText,
  AssetContext,
} from "../Workshop.jsx";

// Slide-in wrapper — subtle 6px rise + fade, spring settle. MUST live at
// module scope so it has a STABLE component identity. Defining it inside
// ChatMessage made it a new component type on every render, so React
// remounted the motion.div and replayed the entry animation on every
// keystroke — the chat appeared to "blink". Hoisting it fixes that.
const MotionWrap = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.7 }}
  >{children}</motion.div>
);

function ChatMessage({ message: m, data, onMentionClick }) {
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
            // Prefer the explicit human label the tool returned. Fall back
            // to the frame-number form for the older frame-only changes, or
            // a generic "<kind> · <field>" for anything else.
            const fr = c.id ? data.frames.find(f => f.id === c.id) : null;
            const label = c.label
              || (fr ? `Frame ${fr.number} \xB7 ${c.type === "camera" ? "camera" : c.field}` : `${c.type}${c.field ? " \xB7 " + c.field : ""}`);
            return <div key={j} style={{ fontFamily: "var(--f)", fontSize: 11, color: "var(--warm-20)", marginBottom: 2 }}>{label}</div>;
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
          width: 52, height: 30, borderRadius: 4, flexShrink: 0, position: "relative", overflow: "hidden",
          background: FILM[fIdx >= 0 ? fIdx % FILM.length : 0],
        }}>
          {frame.uploadedImage ? (
            <img src={frame.uploadedImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8%", background: "rgba(0,0,0,0.4)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8%", background: "rgba(0,0,0,0.4)" }} />
            </>
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--f)", fontSize: 7, fontWeight: 600, color: "var(--warm-20)", background: frame.uploadedImage ? "rgba(0,0,0,0.45)" : "transparent", padding: frame.uploadedImage ? "1px 3px" : 0, borderRadius: 2 }}>{frame.number}</span>
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

export function AIChatPanel({ data, dispatch, chatMessages, chatBusy, selectedFrameId, onSendMessage, onDismissFrame, onOpenProduction, onMentionClick, chatAssetContext, onDismissAssetContext, chatFocusTrigger, pendingFrameEdits = {}, onRegeneratePending }) {
  const [val, setVal] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const [improving, setImproving] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const selectedFrame = selectedFrameId ? data.frames.find(f => f.id === selectedFrameId) : null;

  // Resolve asset context — find the focused element and the best image
  // field to use as its chat-context thumbnail. Mood items and Brand are
  // synthesized into a {name, handle} shape so they render in the same card.
  const assetContextResolved = chatAssetContext ? (() => {
    const { type, id } = chatAssetContext;
    if (type === "talent") {
      const asset = data.talent.find(t => t.id === id);
      return asset && { type, asset, thumb: asset.headshot || asset.headshots?.front || asset.headshots?.threeQuarter || asset.headshots?.side || asset.headshots?.back || null };
    }
    if (type === "product") {
      const asset = data.products.find(p => p.id === id);
      return asset && { type, asset, thumb: asset.referenceImage || null };
    }
    if (type === "location") {
      const asset = data.locations.find(l => l.id === id);
      return asset && { type, asset, thumb: asset.generatedImage || asset.referenceImage || null };
    }
    if (type === "mood") {
      const m = (data.moodBoard || []).find(x => x.id === id);
      return m && { type, asset: { name: m.caption || "Mood reference", handle: "" }, thumb: m.image || null };
    }
    if (type === "brand") {
      const b = data.brand || {};
      return { type, asset: { name: b.name || "Brand", handle: b.url || "" }, thumb: b.logo || null };
    }
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
    const pMap = {
      talent: "Describe a change to this character...",
      product: "Describe a change to this element...",
      location: "Help me refine this location...",
      mood: "Describe this mood reference...",
      brand: "Edit brand name, URL, or guidelines...",
    };
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
            <AssetContext asset={assetContextResolved.asset} type={assetContextResolved.type} thumb={assetContextResolved.thumb} onDismiss={onDismissAssetContext} />
          </div>
        )}
        {/* Pending frame changes → Regenerate. Each control you change in the
            frame editor stages a bullet here; Regenerate rebuilds the image. */}
        {Object.keys(pendingFrameEdits).length > 0 && (
          <div style={{ marginBottom: 10, borderRadius: 10, background: "var(--warm-04)", border: "1px solid var(--warm-08)", padding: "10px 12px" }}>
            <div style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Pending changes</div>
            <ul style={{ margin: "0 0 10px", paddingLeft: 16 }}>
              {Object.entries(pendingFrameEdits).map(([field, label]) => (
                <li key={field} style={{ fontFamily: "var(--f)", fontSize: 12, color: "var(--warm-50)", lineHeight: 1.7 }}>{label}</li>
              ))}
            </ul>
            <button onClick={onRegeneratePending} style={{
              width: "100%", padding: "9px 0", borderRadius: 8, border: "1px solid #43a3fd",
              background: "#006dd4", color: "#fff", cursor: "pointer",
              fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, outline: "none",
            }}>
              <SectionIcon name="sparkle" size={12} color="#fff" /> Regenerate
            </button>
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

// -- FLOATING AI CHAT TAB ------------------------------------

export function AIChatTab({ sidebarOpen, onClick }) {
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
