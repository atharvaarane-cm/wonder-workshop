import { useEffect } from "react";
import { AnchoredToastProvider, ToastProvider, toastManager } from "@/components/ui/toast";
import WorkshopV2 from "./v2/Workshop.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import AuthGate from "./v2/AuthGate.jsx";
import { purgeLegacyV1Storage } from "./v2/persistence.js";

export default function App() {
  useEffect(() => {
    purgeLegacyV1Storage();
  }, []);

  return (
    <ToastProvider position="top-right">
      <AnchoredToastProvider>
        <ToastEventBridge />
        <ErrorBoundary>
          <AuthGate>
            <WorkshopV2 />
          </AuthGate>
        </ErrorBoundary>
        {/* Tiny build-ID tag — lets anyone glance and confirm their build
            (vs a stale cached tab). Unobtrusive, bottom-right, non-interactive. */}
        <div
          aria-hidden="true"
          title="build"
          style={{ position: "fixed", right: 6, bottom: 4, zIndex: 9999, fontSize: 9, fontFamily: "monospace", letterSpacing: "0.04em", color: "rgba(255,255,255,0.22)", pointerEvents: "none", userSelect: "none" }}
        >
          {__BUILD_ID__}
        </div>
      </AnchoredToastProvider>
    </ToastProvider>
  );
}

function ToastEventBridge() {
  useEffect(() => {
    function onToast(event) {
      const detail = event.detail || {};
      const type = detail.type || detail.kind || "success";
      toastManager.add({
        title: detail.msg || detail.message || "",
        type,
        timeout: detail.ttl || (type === "error" ? 6000 : 3500),
        priority: type === "error" ? "high" : "low",
      });
    }
    window.addEventListener("ww-toast", onToast);
    return () => window.removeEventListener("ww-toast", onToast);
  }, []);

  return null;
}
