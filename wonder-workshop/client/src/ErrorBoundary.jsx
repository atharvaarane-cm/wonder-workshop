import { Component } from "react";

// Root error boundary for the whole workshop.
//
// React error boundaries catch errors thrown during RENDER / lifecycle
// (NOT in async event handlers) — so this guards the white-screen case the
// audit flagged: a malformed project blob, a bad share-hash, or an unexpected
// data shape that throws while rendering the ~9k-line workspace, taking the
// entire app down to a blank page with no way out.
//
// Recovery: the user's work lives in IndexedDB and is almost always intact, so
// "Reload" usually fixes it. "Download a backup" is insurance for the case where
// the persisted data itself is what's crashing render (so a reload would loop) —
// it dumps localStorage + the IndexedDB projects store to a JSON file the user
// can hand back to us.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, saving: false, saved: false };
  }

  static getDerivedStateFromError(error) {
    return { error, saving: false, saved: false };
  }

  componentDidCatch(error, info) {
    console.error("[Workshop] uncaught render error — showing recovery screen:", error, info?.componentStack);
  }

  downloadBackup = async () => {
    this.setState({ saving: true });
    const dump = { exportedAt: new Date().toISOString(), localStorage: {}, projects: [] };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("ww_")) dump.localStorage[k] = localStorage.getItem(k);
      }
    } catch { /* best-effort */ }
    try {
      dump.projects = await new Promise((resolve) => {
        const req = indexedDB.open("ww_v2_db");
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("projects")) return resolve([]);
          const all = db.transaction("projects", "readonly").objectStore("projects").getAll();
          all.onsuccess = () => resolve(all.result || []);
          all.onerror = () => resolve([]);
        };
      });
    } catch { /* best-effort */ }
    try {
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wonder-workshop-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.setState({ saving: false, saved: true });
    } catch {
      this.setState({ saving: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message || String(this.state.error);
    const build = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
    const btn = {
      padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600,
      cursor: "pointer", fontFamily: "inherit",
    };
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100000, padding: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0a0a0a", color: "#f4f4f5", fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 12 }} aria-hidden="true">⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(244,244,245,0.7)", margin: "0 0 20px" }}>
            The workshop hit an unexpected error and couldn't render. Your projects are saved —
            reloading usually fixes it. If it keeps happening, download a backup and send it to the team.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => window.location.reload()} style={{ ...btn, border: "none", background: "#f4f4f5", color: "#0a0a0a" }}>
              Reload
            </button>
            <button onClick={this.downloadBackup} disabled={this.state.saving}
              style={{ ...btn, border: "1px solid rgba(244,244,245,0.25)", background: "transparent", color: "#f4f4f5", opacity: this.state.saving ? 0.6 : 1 }}>
              {this.state.saving ? "Preparing…" : this.state.saved ? "Backup downloaded ✓" : "Download a backup"}
            </button>
          </div>
          <pre style={{ marginTop: 22, fontSize: 11, lineHeight: 1.5, color: "rgba(244,244,245,0.4)", whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" }}>
            {msg}{"\n"}build {build}
          </pre>
        </div>
      </div>
    );
  }
}
