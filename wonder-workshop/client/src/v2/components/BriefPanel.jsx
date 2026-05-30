import { useState, useEffect, useRef } from "react";
import { SectionIcon } from "../Workshop.jsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Brief panel — squished mask-faded preview in display mode; click to
// expand the textarea up to 600px. Tracks a local draft so the parent
// only sees committed brief text. Save click opens the audit modal
// (RegenerateAuditModal) which asks Gemini what needs to change and
// offers Regenerate List vs Regenerate All.
export function BriefPanel({ value, onUpdateMeta, data, dispatch, onRunRegeneration }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [auditOpen, setAuditOpen] = useState(false);
  const taRef = useRef(null);
  useEffect(() => { setDraft(value || ""); }, [value]);
  const dirty = draft.trim() !== (value || "").trim();
  const treatmentText = value || "";

  const autoSize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 560);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > 560 ? "auto" : "hidden";
  };
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      requestAnimationFrame(autoSize);
    }
    // eslint-disable-next-line
  }, [editing]);
  useEffect(() => { if (editing) autoSize(); /* eslint-disable-next-line */ }, [draft]);

  const startEditing = () => { if (!editing) setEditing(true); };
  const handleCancelEdit = () => { setDraft(value || ""); setEditing(false); };
  const handleSave = () => {
    if (!dirty) { setEditing(false); return; }
    // Commit the brief to project state immediately so the user's text
    // persists even if they bail on the audit modal. The modal handles
    // regeneration scope separately.
    onUpdateMeta("treatment", draft);
    setEditing(false);
    setAuditOpen(true);
  };

  return (
    <div style={{ borderTop: "1px solid var(--warm-06)", margin: "20px 0", padding: "20px 0 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <SectionIcon name="file-text" size={11} color="var(--warm-50)" />
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 700, color: "var(--warm-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Brief</span>
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 400, color: "var(--warm-25)", marginLeft: 6 }}>
          {editing ? "Save to audit changes" : "Click to edit"}
        </span>
      </div>
      <Card
        onClick={startEditing}
        className={[
          "overflow-hidden rounded-xl px-[18px] py-4 transition-[max-height,min-height] duration-300 ease-out",
          editing ? "min-h-[120px] max-h-[600px] cursor-default ring-1 ring-ring/40" : "min-h-24 max-h-24 cursor-pointer",
        ].join(" ")}
        style={{
          WebkitMaskImage: editing ? "none" : "linear-gradient(to bottom, black 55%, transparent 100%)",
          maskImage: editing ? "none" : "linear-gradient(to bottom, black 55%, transparent 100%)",
        }}
      >
        {editing ? (
          <Textarea
            ref={taRef}
            size="lg"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === "Escape") { e.preventDefault(); handleCancelEdit(); }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
            }}
            placeholder="Click here to write or paste the brief — the spot's setup, characters, tone, and intent."
            style={{ resize: "none", minHeight: 96, maxHeight: 560 }}
          />
        ) : (
          <div style={{
            fontFamily: "var(--f)", fontSize: 15, fontWeight: 300,
            color: "var(--warm-50)", lineHeight: 1.7, whiteSpace: "pre-wrap",
            minHeight: 64,
          }}>
            {treatmentText || <span style={{ opacity: 0.3 }}>Click here to write or paste the brief — the spot's setup, characters, tone, and intent.</span>}
          </div>
        )}
      </Card>
      {editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button
            onClick={handleCancelEdit}
            style={{
              fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
              padding: "7px 14px", borderRadius: 7, cursor: "pointer",
              background: "transparent", border: "1px solid var(--warm-12)",
              color: "var(--warm-50)", outline: "none",
            }}
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            title={dirty ? "Save brief and audit changes (⌘↵)" : "No changes to save"}
            style={{
              fontFamily: "var(--f)", fontSize: 12, fontWeight: 600,
              padding: "7px 16px", borderRadius: 7,
              cursor: dirty ? "pointer" : "not-allowed",
              background: dirty ? "#FFFFFF" : "rgba(255,255,255,0.08)",
              border: "1px solid " + (dirty ? "#FFFFFF" : "var(--warm-12)"),
              color: dirty ? "#111" : "var(--warm-25)",
              outline: "none",
            }}
          >Save</button>
        </div>
      )}
      {auditOpen && (
        <RegenerateAuditModal
          oldBrief={value || ""}
          newBrief={draft}
          data={data}
          onClose={() => setAuditOpen(false)}
          onRun={(scope, plan) => { setAuditOpen(false); onRunRegeneration?.(scope, plan); }}
        />
      )}
    </div>
  );
}

export function EditBriefDialog({ value, onUpdateMeta, data, onRunRegeneration }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => { setDraft(value || ""); }, [value]);

  const dirty = draft.trim() !== (value || "").trim();
  const resetDraft = () => setDraft(value || "");
  const handleCancel = () => {
    resetDraft();
    setOpen(false);
  };
  const handleSave = () => {
    if (!dirty) return;
    onUpdateMeta("treatment", draft);
    setOpen(false);
    setAuditOpen(true);
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5 dark:border-white/18 dark:bg-[#181818] dark:shadow-[0_1px_2px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.045)]" />
          }
          onClick={() => setDraft(value || "")}
        >
          <SectionIcon name="edit" size={12} color="currentColor" />
          Edit Brief
        </AlertDialogTrigger>
        <AlertDialogPopup className="max-w-2xl dark:border-white/18 dark:bg-[#181818] dark:shadow-[0_20px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.045)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Brief</AlertDialogTitle>
            <AlertDialogDescription>
              Update the project brief. Save turns on after you make a change, then runs the brief-change audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-4">
            <label
              className="mb-2 block font-semibold text-muted-foreground text-xs uppercase tracking-[0.14em]"
              htmlFor="edit-project-brief"
            >
              Brief
            </label>
            <Textarea
              id="edit-project-brief"
              size="lg"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write or paste the brief — the spot's setup, characters, tone, and intent."
              style={{ minHeight: 220, resize: "vertical", lineHeight: 1.7 }}
            />
          </div>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={!dirty}
              onClick={handleSave}
              title={dirty ? "Save brief and audit changes" : "Make a change to enable Save"}
            >
              {dirty ? "Save" : "No changes"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
      {auditOpen && (
        <RegenerateAuditModal
          oldBrief={value || ""}
          newBrief={draft}
          data={data}
          onClose={() => setAuditOpen(false)}
          onRun={(scope, plan) => { setAuditOpen(false); onRunRegeneration?.(scope, plan); }}
        />
      )}
    </>
  );
}

// Modal that asks Gemini "given the OLD brief, the NEW brief, and the
// current project state, what should change?" and presents the result
// with action buttons. Cancel leaves the brief edit committed but no
// regeneration; Regenerate List runs the audit's targeted changes;
// Regenerate All re-runs generateBrief from scratch.
function RegenerateAuditModal({ oldBrief, newBrief, data, onClose, onRun }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [plan, setPlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        const stateSnap = {
          talent: (data.talent || []).map(t => ({ id: t.id, name: t.name, note: t.note, locked: t.locked })),
          products: (data.products || []).map(p => ({ id: p.id, name: p.name, note: p.note, locked: p.locked })),
          locations: (data.locations || []).map(l => ({ id: l.id, name: l.name, note: l.note, locked: l.locked })),
          frames: (data.frames || []).map(f => ({ id: f.id, number: f.number, brief: f.brief })),
        };
        const sys = [
          "You are auditing a storyboard project's brief edit.",
          "Given the OLD brief, the NEW brief, and the current project's assets, identify what needs to change to bring the project in line with the new brief.",
          "Be CONSERVATIVE — only flag items that are clearly affected by the brief change. Don't suggest cosmetic tweaks.",
          "LOCKED items must never appear in updates / removals — they're frozen by the user.",
          "Return JSON ONLY in this exact shape:",
          "{",
          "  \"summary\": \"one-sentence plain-English description of what changed in the brief\",",
          "  \"talent\": { \"update\": [\"id1\", ...], \"add\": [\"new character description\"], \"remove\": [\"id\"] },",
          "  \"locations\": { \"update\": [...], \"add\": [...], \"remove\": [...] },",
          "  \"products\": { \"update\": [...], \"add\": [...], \"remove\": [...] },",
          "  \"frames\": \"regenerate\" | \"keep\"",
          "}",
          "Empty arrays for no-op categories. \"frames\": \"regenerate\" only if the new brief implies a different storyline / scene order; otherwise \"keep\".",
        ].join("\n");
        const user = [
          "OLD BRIEF:",
          oldBrief || "(empty)",
          "",
          "NEW BRIEF:",
          newBrief || "(empty)",
          "",
          "CURRENT STATE:",
          JSON.stringify(stateSnap, null, 2),
        ].join("\n");
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
            stream: false,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const text = (payload?.message?.content || "").trim();
        // Strip ```json fences if present.
        const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(cleaned);
        if (!aborted) { setPlan(parsed); setPhase("ready"); }
      } catch (e) {
        if (!aborted) { setErrorMsg(String(e?.message || e)); setPhase("error"); }
      }
    }
    run();
    return () => { aborted = true; };
  }, [oldBrief, newBrief, data]);

  const idToName = (collection, id) => {
    const m = (data[collection] || []).find(x => x.id === id);
    return m?.name || id;
  };

  const renderCategoryLines = (label, cat, collection) => {
    if (!cat) return null;
    const lines = [];
    (cat.update || []).forEach(id => lines.push(`Update ${label}: ${idToName(collection, id)}`));
    (cat.add || []).forEach(desc => lines.push(`Add ${label}: ${desc}`));
    (cat.remove || []).forEach(id => lines.push(`Remove ${label}: ${idToName(collection, id)}`));
    return lines;
  };

  const allLines = plan ? [
    ...(renderCategoryLines("character", plan.talent, "talent") || []),
    ...(renderCategoryLines("location", plan.locations, "locations") || []),
    ...(renderCategoryLines("product", plan.products, "products") || []),
    ...(plan.frames === "regenerate" ? ["Regenerate all storyboard frames"] : []),
  ] : [];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 11200,
      background: "rgba(0,0,0,0.78)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1A1A1D",
        border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12,
        padding: "26px 28px", width: "min(100%, 560px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)",
        animation: "fadeIn 0.18s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <SectionIcon name="sparkle" size={14} color="#FFC857" />
          <div style={{ fontFamily: "var(--f)", fontSize: 17, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
            Audit brief changes
          </div>
        </div>

        {phase === "loading" && (
          <div style={{ padding: "18px 0 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--f)", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              <span style={{
                width: 12, height: 12, borderRadius: "50%",
                border: "1.5px solid rgba(255,200,87,0.45)",
                borderTopColor: "#FFC857",
                animation: "spin 0.8s linear infinite",
                display: "inline-block",
              }} />
              Analyzing what should change…
            </div>
          </div>
        )}

        {phase === "error" && (
          <div style={{ padding: "12px 0 16px", fontFamily: "var(--f)", fontSize: 13, color: "#FF8A80", lineHeight: 1.5 }}>
            Audit failed: {errorMsg.slice(0, 200)}.<br/>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>You can still regenerate everything or cancel.</span>
          </div>
        )}

        {phase === "ready" && (
          <>
            {plan?.summary && (
              <div style={{ fontFamily: "var(--f)", fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.55, marginBottom: 14 }}>
                {plan.summary}
              </div>
            )}
            {allLines.length === 0 ? (
              <div style={{ fontFamily: "var(--f)", fontSize: 13, color: "rgba(255,255,255,0.55)", padding: "8px 0 4px" }}>
                No targeted changes detected. You can still regenerate everything.
              </div>
            ) : (
              <ul style={{ margin: "0 0 18px", padding: "0 0 0 18px", color: "rgba(255,255,255,0.85)", fontFamily: "var(--f)", fontSize: 13, lineHeight: 1.7 }}>
                {allLines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
          <button onClick={onClose} style={{
            fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
            padding: "9px 16px", borderRadius: 7, cursor: "pointer",
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", outline: "none",
          }}>Cancel</button>
          <button
            disabled={phase !== "ready" || allLines.length === 0}
            onClick={() => onRun("list", plan)}
            title="Apply only the changes listed above"
            style={{
              fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
              padding: "9px 16px", borderRadius: 7,
              cursor: (phase === "ready" && allLines.length > 0) ? "pointer" : "not-allowed",
              background: (phase === "ready" && allLines.length > 0) ? "rgba(255,200,87,0.18)" : "rgba(255,255,255,0.05)",
              border: "1px solid " + ((phase === "ready" && allLines.length > 0) ? "rgba(255,200,87,0.55)" : "var(--warm-12)"),
              color: (phase === "ready" && allLines.length > 0) ? "#FFC857" : "var(--warm-25)",
              outline: "none",
            }}
          >Regenerate List</button>
          <button
            disabled={phase === "loading"}
            onClick={() => onRun("all", plan)}
            title="Re-run the full brief and regenerate every asset (locked items skipped)"
            style={{
              fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
              padding: "9px 16px", borderRadius: 7,
              cursor: phase === "loading" ? "not-allowed" : "pointer",
              background: phase === "loading" ? "rgba(255,255,255,0.08)" : "#fff",
              border: "1px solid " + (phase === "loading" ? "var(--warm-12)" : "#fff"),
              color: phase === "loading" ? "var(--warm-25)" : "#111",
              outline: "none",
            }}
          >Regenerate All</button>
        </div>
      </div>
    </div>
  );
}
